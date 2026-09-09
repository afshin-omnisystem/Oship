import {Opportunity} from '../../opportunity';
import {StrategyCandidate, StrategyEvaluation, StrategySelection, StrategyAuditRecord} from './types';
import {StrategyRegistry} from './registry';
import {
  CompatibilityContext,
  checkCompatibility,
} from './compatibility';
import {generateStrategyCandidates} from './generator';
import {evaluateStrategy, EvaluationContext, DEFAULT_EVALUATOR_CONFIG} from './evaluator';
import {
  selectStrategy,
  SelectionContext,
} from './selection';
import {RankingPolicy, DEFAULT_RANKING_POLICY, rankStrategies} from './ranking';
import {
  assessPortfolio,
  PortfolioAwarenessContext,
  PortfolioAwarenessConfig,
  DEFAULT_PORTFOLIO_AWARENESS_CONFIG,
} from './portfolio-awareness';
import {sha256} from '../../oiin';

/**
 * Sprint 027 — Unified Strategy Intelligence Engine.
 *
 * Given a validated/ranked Opportunity it deterministically:
 *   1. generates compatible strategy candidates,
 *   2. evaluates each against the unified economics model + limits,
 *   3. performs portfolio-aware concentration checks,
 *   4. ranks admissible candidates by the composite ranking policy,
 *   5. selects the best admissible strategy (or NO_ADMISSIBLE_STRATEGY),
 *   6. emits a structured audit record.
 *
 * The engine is proposal-only. It NEVER mutates Portfolio / Risk / Allocation /
 * AEGIS / Treasury / Execution; those remain the authority boundaries. It also
 * exposes a control-plane advisory (from the existing ControlAction vocabulary)
 * so the Control Engine — not this engine — decides the action.
 */

export interface StrategyEngineConfig {
  readonly engineVersion: string;
  readonly evaluationVersion: string;
  readonly policyVersion: string;
  readonly rankingVersion: string;
  readonly configurationVersion: string;
  readonly rankingPolicy: RankingPolicy;
  readonly portfolioConfig: PortfolioAwarenessConfig;
  readonly availableCapabilities: readonly string[];
  readonly availableVenues: readonly string[];
  readonly enabledStrategyIds?: readonly string[];
}

export const DEFAULT_STRATEGY_ENGINE_CONFIG: StrategyEngineConfig = Object.freeze({
  engineVersion: 'strategy.engine.v1',
  evaluationVersion: DEFAULT_EVALUATOR_CONFIG.evaluationVersion,
  policyVersion: DEFAULT_EVALUATOR_CONFIG.policyVersion,
  rankingVersion: DEFAULT_EVALUATOR_CONFIG.rankingVersion,
  configurationVersion: DEFAULT_EVALUATOR_CONFIG.configurationVersion,
  rankingPolicy: DEFAULT_RANKING_POLICY,
  portfolioConfig: DEFAULT_PORTFOLIO_AWARENESS_CONFIG,
  availableCapabilities: ['ORDER_BOOK', 'BOOKMAKER', 'ODDS', 'SPOT', 'PERPETUAL', 'HEDGE', 'TWO_VENUE', 'TRADE_EXECUTION', 'LOW_LATENCY', 'DEEP_LIQUIDITY', 'EXCHANGE', 'FAIR_VALUE', 'DELTA_NEUTRAL', 'ADAPTIVE', 'INVENTORY', 'THREE_VENUE', 'QUOTE', 'DEPTH', 'HISTORY'],
  availableVenues: ['VENUE_A', 'VENUE_B', 'VENUE_C', 'BOOK_A', 'BOOK_B', 'BOOK_C'],
});

/** Output of a single full discovery pass. */
export interface StrategyDiscoveryResult {
  readonly opportunityId: string;
  readonly candidates: readonly StrategyCandidate[];
  readonly evaluated: readonly StrategyEvaluation[];
  readonly ranking: readonly import('./types').StrategyRank[];
  readonly selection: StrategySelection;
  readonly audit: StrategyAuditRecord;
  readonly replayKey: string;
}

export interface StrategyControlAdvisory {
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  /** From the existing ControlAction vocabulary (CONTINUE/REVALIDATE/RESIZE/...). */
  readonly action: string;
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
}

export interface StrategyDiscoveryInput {
  readonly opportunity: Opportunity;
  readonly portfolioContext: PortfolioAwarenessContext;
  readonly availableCapital: number;
  readonly totalCapital: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly controlState?: {
    readonly action: string;
    readonly marketChanged?: boolean;
    readonly liquidityDeteriorated?: boolean;
    readonly venueDegraded?: boolean;
    readonly edgeDisappeared?: boolean;
    readonly riskIncreased?: boolean;
  };
}

export class StrategyDiscoveryEngine {
  constructor(
    private readonly registry: StrategyRegistry,
    private readonly config: StrategyEngineConfig = DEFAULT_STRATEGY_ENGINE_CONFIG,
  ) {}

  get configVersion(): string {
    return this.config.configurationVersion;
  }

  /** List the definitions in this engine's registry (deterministic order). */
  definitions(): readonly import('./types').StrategyDefinition[] {
    return this.registry.allDefinitions().slice().sort((a, b) => a.strategyId.localeCompare(b.strategyId));
  }

  /** Full deterministic discovery: generate → evaluate → rank → select → audit. */
  discover(input: StrategyDiscoveryInput): StrategyDiscoveryResult {
    const {opportunity, portfolioContext, availableCapital, totalCapital, correlationId, traceId, timestamp} = input;

    // 1. Candidate generation with compatibility filtering.
    const compatCtx: CompatibilityContext = {
      availableCapabilities: this.config.availableCapabilities,
      availableVenues: this.config.availableVenues,
      presentVenues: opportunity.venues,
      enabledStrategyIds: this.config.enabledStrategyIds,
    };
    const candidates = generateStrategyCandidates(opportunity, compatCtx).filter((c) => {
      const def = this.registry.lookup(c.strategyId);
      return def && def.enabled;
    });

    // 2. Evaluation.
    const evalCtx: EvaluationContext = {
      timestamp,
      correlationId,
      policyVersion: this.config.policyVersion,
      evaluationVersion: this.config.evaluationVersion,
      rankingVersion: this.config.rankingVersion,
      configurationVersion: this.config.configurationVersion,
      portfolio: portfolioContext,
      portfolioConfig: this.config.portfolioConfig,
      availableCapital,
    };
    const evaluated = candidates.map((c) => evaluateStrategy(opportunity, c, evalCtx, {
      evaluationVersion: this.config.evaluationVersion,
      policyVersion: this.config.policyVersion,
      rankingVersion: this.config.rankingVersion,
      configurationVersion: this.config.configurationVersion,
    }));

    // 3 + 4. Ranking.
    const rankResult = this.rank(evaluated);

    // 5. Selection.
    const selCtx: SelectionContext = {
      correlationId,
      traceId,
      timestamp,
      policyVersion: this.config.policyVersion,
      rankingVersion: this.config.rankingVersion,
      configurationVersion: this.config.configurationVersion,
      availableCapital,
      totalCapital,
    };
    const selection = selectStrategy(opportunity, evaluated, selCtx, this.config.rankingPolicy);

    // 6. Audit.
    const audit = this.audit(opportunity, candidates, evaluated, selection, correlationId, traceId, timestamp);

    const replayKey = sha256({
      opportunityId: opportunity.opportunityId,
      selectionDecisionId: selection.decisionId,
      engineVersion: this.config.engineVersion,
      policyVersion: this.config.policyVersion,
      rankingPolicyVersion: this.config.rankingPolicy.version,
    });

    return Object.freeze({
      opportunityId: opportunity.opportunityId,
      candidates,
      evaluated,
      ranking: rankResult,
      selection,
      audit,
      replayKey,
    });
  }

  private rank(evaluated: readonly StrategyEvaluation[]): readonly import('./types').StrategyRank[] {
    return rankStrategies(evaluated, this.config.rankingPolicy);
  }

  /**
   * Control-plane advisory. Uses the existing ControlAction vocabulary but only
   * *suggests* an action — the control engine remains the decision maker.
   */
  advisory(input: StrategyDiscoveryInput): StrategyControlAdvisory {
    const st = input.controlState;
    const action = st?.action ?? 'CONTINUE';
    let reason = 'no-change';
    if (st?.marketChanged) { reason = 'market changed'; }
    if (st?.liquidityDeteriorated) { reason = 'liquidity deteriorated'; }
    if (st?.venueDegraded) { reason = 'venue degraded'; }
    if (st?.edgeDisappeared) { reason = 'edge disappeared'; }
    if (st?.riskIncreased) { reason = 'risk increased'; }
    const fingerprint = sha256({opportunityId: input.opportunity.opportunityId, action, reason, correlationId: input.correlationId});
    return Object.freeze({
      decisionId: `strat_ctl_${fingerprint.slice(0, 24)}`,
      opportunityId: input.opportunity.opportunityId,
      strategyId: 'n/a',
      action,
      reason,
      timestamp: input.timestamp,
      correlationId: input.correlationId,
    });
  }

  private audit(
    opportunity: Opportunity,
    candidates: readonly StrategyCandidate[],
    evaluated: readonly StrategyEvaluation[],
    selection: StrategySelection,
    correlationId: string,
    traceId: string,
    timestamp: number,
  ): StrategyAuditRecord {
    const scores: Record<string, number> = {};
    for (const e of evaluated) scores[e.candidateId] = e.economics.riskAdjustedExpectedReturn;

    const ranking = selection.ranking.map((r) => ({candidateId: r.candidateId, rank: r.rank, score: r.score}));

    return Object.freeze({
      strategyDecisionId: selection.decisionId,
      opportunityId: opportunity.opportunityId,
      strategyId: selection.selectedStrategyId,
      strategyVersion: selection.selectedStrategyVersion,
      candidateIds: candidates.map((c) => c.candidateId),
      evaluationScores: scores,
      ranking,
      selectedStrategy: selection.selectedStrategyId,
      rejectedStrategies: selection.rejectedAlternatives.map((r) => r.strategyId),
      reason: selection.reason,
      policyVersion: this.config.policyVersion,
      configurationVersion: this.config.configurationVersion,
      evaluationVersion: this.config.evaluationVersion,
      rankingVersion: this.config.rankingVersion,
      timestamp,
      correlationId,
      traceId,
      schemaVersion: 'oship.strategy.v1',
    });
  }
}
