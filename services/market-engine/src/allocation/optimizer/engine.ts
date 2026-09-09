import {Opportunity} from '../../opportunity';
import {StrategyDefinition, StrategySelection} from '../../strategy/intelligence';
import {AllocationCandidate, AllocationResult, AllocationAuditRecord, CapitalConstraints} from './types';
import {buildAllocationCandidate, CandidateBuilderConfig, DEFAULT_CANDIDATE_BUILDER_CONFIG} from './candidate-builder';
import {CapitalOptimizer, OptimizeInput, OptimizerConfig, DEFAULT_OPTIMIZER_CONFIG} from './optimizer';
import {PortfolioAllocationContext, emptyPortfolioAllocationContext} from './portfolio-context';
import {evaluateAllocationAegis, buildTreasuryProposal, AegisAllocationEvaluation, TreasuryAuthorizationProposal} from './boundaries';
import {buildAllocationAudit} from './replay';
import {revalidateAllocation, AllocationRevalidation} from './revalidation';
import {sha256} from '../../oiin';

/**
 * Sprint 028 — Unified Capital Allocation Engine.
 *
 * The public entrypoint that maps a set of (Opportunity + selected Strategy)
 * into a deterministic unified allocation for the single shared Treasury pool.
 * It never mutates Treasury / Portfolio / Risk / AEGIS / Execution.
 */

export interface AllocationEngineConfig {
  readonly configurationVersion: string;
  readonly policyVersion: string;
  readonly optimizer: OptimizerConfig;
  readonly candidateBuilder: CandidateBuilderConfig;
  readonly constraints: CapitalConstraints;
}

export const DEFAULT_ALLOCATION_ENGINE_CONFIG: AllocationEngineConfig = Object.freeze({
  configurationVersion: 'allocation.engine.v1',
  policyVersion: 'allocation.policy.v1',
  optimizer: DEFAULT_OPTIMIZER_CONFIG,
  candidateBuilder: DEFAULT_CANDIDATE_BUILDER_CONFIG,
  constraints: DEFAULT_OPTIMIZER_CONFIG.constraints,
});

export interface AllocationPosition {
  readonly opportunity: Opportunity;
  readonly selection: StrategySelection;
  readonly definition: StrategyDefinition | undefined;
}

export interface AllocationEngineInput {
  readonly positions: readonly AllocationPosition[];
  readonly portfolio: PortfolioAllocationContext;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly aegisAllowed?: boolean;
  readonly controlState?: string;
  readonly treasuryAvailable?: number;
  readonly config?: Partial<AllocationEngineConfig>;
}

export interface AllocationEngineOutput {
  readonly candidates: readonly AllocationCandidate[];
  readonly result: AllocationResult;
  readonly aegis: AegisAllocationEvaluation;
  readonly treasuryProposal: TreasuryAuthorizationProposal;
  readonly audit: AllocationAuditRecord;
  readonly revalidation: AllocationRevalidation;
  readonly authorized: boolean;
  readonly authorizationReason: string;
  readonly replayKey: string;
}

export class UnifiedAllocationEngine {
  constructor(readonly config: AllocationEngineConfig = DEFAULT_ALLOCATION_ENGINE_CONFIG) {}

  /** The effective optimizer config with the engine-level constraints applied. */
  private optimizerConfig(): OptimizerConfig {
    return Object.freeze({...this.config.optimizer, constraints: this.config.constraints});
  }

  /**
   * Full deterministic allocation pass: build candidates → optimize → AEGIS →
   * Treasury proposal → audit. Emergency-stop / HALTED gate applies first
   * (no new allocation), while reconciliation/audit/replay remain available.
   */
  allocate(input: AllocationEngineInput): AllocationEngineOutput {
    // Emergency-stop gate (reuses Control vocabulary, not a second kill switch).
    const controlState = input.controlState ?? 'ACTIVE';
    const emergencyGate = controlState === 'EMERGENCY_STOP' || controlState === 'HALTED';
    const emergencyReason = emergencyGate ? 'NO_NEW_ALLOCATION' : '';

    // 1. Build + validate candidates (re-check freshness against evaluation time).
    const candidates = input.positions.map((p) => buildAllocationCandidate(p.opportunity, p.selection, p.definition, this.config.candidateBuilder, input.timestamp));

    // 2. Optimize (empty candidate inputs when emergency stop => no new alloc).
    const effectiveInput: OptimizeInput = {
      candidates: emergencyGate ? [] : candidates,
      portfolio: input.portfolio ?? emptyPortfolioAllocationContext(),
      correlationId: input.correlationId,
      traceId: input.traceId,
      timestamp: input.timestamp,
      config: this.optimizerConfig(),
    };
    const result = new CapitalOptimizer(this.optimizerConfig()).optimize(effectiveInput);

    // 3. AEGIS boundary.
    const aegis = evaluateAllocationAegis({
      allocation: result,
      strategyId: result.decisions[0]?.strategyId ?? '',
      opportunityId: result.decisions[0]?.opportunityId ?? '',
      portfolioId: input.portfolio?.portfolioId ?? 'portfolio-1',
      riskDecisionId: 'risk_approved',
      aegisAllowed: input.aegisAllowed ?? true,
      treasuryAvailable: input.treasuryAvailable ?? Number.MAX_SAFE_INTEGER,
    });

    // 4. Treasury proposal (never mutates Treasury).
    const treasuryProposal = buildTreasuryProposal({
      allocation: result,
      domain: result.decisions[0]?.domain ?? 'CROSS',
      aegisEvaluationId: aegis.aegisEvaluationId,
      riskDecisionId: 'risk_approved',
      correlationId: input.correlationId,
      traceId: input.traceId,
    });

    // 5. Audit.
    const audit = buildAllocationAudit(result, candidates);

    // 6. Revalidation snapshot (reuses the Control vocabulary).
    const revalidation = revalidateAllocation({
      allocation: result,
      evaluationTime: input.timestamp,
      portfolioNow: input.portfolio ?? emptyPortfolioAllocationContext(),
      capitalNow: this.config.constraints.totalAvailableCapital,
      reservedNow: this.config.constraints.reservedCapital,
      correlationId: input.correlationId,
      traceId: input.traceId,
      controlState,
    });

    const authorized = aegis.status === 'APPROVED' && !emergencyGate;
    const authorizationReason = emergencyGate ? emergencyReason : (aegis.status === 'APPROVED' ? 'authorized' : aegis.reason);

    const replayKey = sha256({
      optimizationId: result.optimizationId,
      aegis: aegis.aegisEvaluationId,
      treasury: treasuryProposal.authorizationId,
      engineConfig: this.config.configurationVersion,
    });

    return Object.freeze({
      candidates,
      result,
      aegis,
      treasuryProposal,
      audit,
      revalidation,
      authorized,
      authorizationReason,
      replayKey,
    });
  }
}
