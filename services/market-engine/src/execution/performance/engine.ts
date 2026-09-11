import {
  SessionRecord, PerformanceAnalysisResult, PerformanceObservation,
  AttributionResult, BenchmarkResult, ExecutionPerformanceQuality,
  PolicyCandidate, ParameterDescriptor, OptimizationMethod, PolicyEvaluation,
  ObjectiveFunction, ControlCycleSpec, ExecutionPlan,
} from './types';
import {
  mergeExecutionPerformanceConfig, canonicalObjective,
  ExecutionPerformanceConfigSpec, ExecutionPerformanceConfigInput,
} from './config';
import {normalizeSession} from './normalization';
import {attributeSession} from './attribution';
import {benchmarkSession} from './benchmark';
import {assessPerformanceQuality} from './quality';
import {buildVenueScorecards} from './venue-score';
import {buildStrategyScores} from './strategy-score';
import {buildDomainScores} from './domain-score';
import {evaluatePolicies} from './policy-evaluation';
import {optimize, baselineParameterSet} from './optimizer';
import {runSimulationGate, CorpusEntry} from './simulation-gate';
import {evaluateRegressionGate} from './regression-gate';
import {evaluatePromotionGate} from './promotion-gate';
import {createPolicyCandidate, withGateResults} from './candidate';
import {validateCandidate} from './candidate-validation';
import {buildPolicyLineage} from './lineage';
import {PerformanceAuditLog} from './audit';
import {DEFAULT_PARAMETER_SPACE, applyParameterSet} from './parameter-space';
import {performanceAnalysisId, performanceAnalysisFingerprint} from './ids';
import {sha256} from '../../oiin/ids';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../control/config';
import type {ControlConfigInput} from '../control/config';
import type {ExecutionControlConfigSpec} from '../control/types';

function performanceAnalysisFingerprintOf(config: ExecutionPerformanceConfigSpec): string {
  return `pcfg_${sha256(config)}`;
}

/**
 * SPRINT 034 — the Execution Performance Engine.
 *
 * Canonical loop, one deterministic pass:
 *
 *   Execution Control Sessions → Observations → Attribution → Benchmarks
 *   → Quality → Venue/Strategy/Domain Intelligence → Policy Evaluation
 *   → Deterministic Parameter Optimization → Policy Candidate
 *   → Simulation Gate → Regression Gate → Promotion Gate
 *   → auditable candidate (NEVER auto-deployed).
 *
 * The performance layer is NOT an authority: it only reads control-session
 * history and produces recommendations. The active policy is never mutated.
 */

export interface PerformanceAnalysisInput {
  readonly records: readonly SessionRecord[];
  readonly policy: {readonly id: string; readonly version: string};
  /** Optional optimization request (requires replay inputs on the records). */
  readonly optimization?: {
    readonly space?: readonly ParameterDescriptor[];
    readonly method?: OptimizationMethod;
  } | null;
  /** Protected probes for the regression gate. */
  readonly probes?: {
    readonly emergencyStop?: {readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[]} | null;
    readonly staleMarket?: {readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[]} | null;
  };
  /** The active control configuration (defaults to the Sprint 033 default). */
  readonly baselineControlConfig?: ControlConfigInput;
  readonly timestamp: number;
}

export class ExecutionPerformanceEngine {
  readonly config: ExecutionPerformanceConfigSpec;

  constructor(configInput: ExecutionPerformanceConfigInput = {}) {
    this.config = mergeExecutionPerformanceConfig(configInput);
  }

  analyze(input: PerformanceAnalysisInput): PerformanceAnalysisResult {
    if (input.records.length === 0) {
      throw new Error('performance analysis refused: no session records — fail closed');
    }
    const analysisId = performanceAnalysisId({
      timestamp: input.timestamp,
      policy: input.policy,
      records: input.records.map((r) => r.session.sessionFingerprint),
    });
    const audit = new PerformanceAuditLog(analysisId, input.timestamp);
    const objective = canonicalObjective(this.config);

    // ---- 1. observations (immutable) — fail closed on invalid telemetry
    const observations: PerformanceObservation[] = [];
    for (const r of input.records) {
      const obs = normalizeSession(r);
      observations.push(...obs);
      audit.record('OBSERVATION_CREATED', {sessionId: r.session.sessionId, count: obs.length});
    }

    // ---- 2. attribution
    const attributions: AttributionResult[] = [];
    for (const r of input.records) {
      const a = attributeSession(r.session, this.config);
      attributions.push(a);
      audit.record('ATTRIBUTION_CALCULATED', {sessionId: r.session.sessionId, measuredTotalCost: a.measuredTotalCost, reconciles: a.reconciles});
    }

    // ---- 3. benchmarks
    const benchmarks: BenchmarkResult[] = [];
    for (const r of input.records) {
      const b = benchmarkSession(r.session, {});
      benchmarks.push(...b);
      audit.record('BENCHMARK_CALCULATED', {sessionId: r.session.sessionId, kinds: b.map((x) => `${x.kind}:${x.provenance}`)});
    }

    // ---- 4. quality
    const qualities: ExecutionPerformanceQuality[] = [];
    for (const r of input.records) {
      const q = assessPerformanceQuality(r.session, this.config);
      qualities.push(q);
      audit.record('QUALITY_CALCULATED', {sessionId: r.session.sessionId, score: q.score, grade: q.grade});
    }

    // ---- 5/6/7. venue / strategy / domain intelligence
    const venueScorecards = buildVenueScorecards(observations, this.config);
    const strategyScores = buildStrategyScores(observations);
    const domainScores = buildDomainScores(observations);

    // ---- 8. policy evaluation
    const policyEvaluations: readonly PolicyEvaluation[] = evaluatePolicies(input.records, this.config, objective);
    for (const pe of policyEvaluations) {
      audit.record('POLICY_EVALUATED', {policyId: pe.policyId, version: pe.version, score: pe.score, sufficientSamples: pe.sufficientSamples});
    }

    // ---- 9. optimization → candidate → gates
    const candidates: PolicyCandidate[] = [];
    let optimization: PerformanceAnalysisResult['optimization'] = null;
    if (input.optimization !== null && input.optimization !== undefined) {
      const withInputs = input.records.filter((r) => r.replayInput !== null);
      if (withInputs.length === 0) {
        throw new Error('optimization requested but no record carries a replay input — fail closed');
      }
      const space = input.optimization.space ?? DEFAULT_PARAMETER_SPACE;
      const method = input.optimization.method ?? this.config.optimization.method;
      const corpus: CorpusEntry[] = withInputs.map((r) => ({
        label: r.label,
        plan: r.replayInput!.plan,
        cycles: r.replayInput!.cycles,
        startTime: r.session.cycles[0]?.startedAt,
      }));
      const baselineSpec = (input.baselineControlConfig ?? DEFAULT_EXECUTION_CONTROL_CONFIG) as ExecutionControlConfigSpec;

      audit.record('OPTIMIZATION_STARTED', {method, parameters: space.length, corpusSize: corpus.length, objective: objective.fingerprint});
      const outcome = optimize({corpus, baselineConfig: baselineSpec, space, objective, method});
      audit.record('SIMULATION_COMPLETED', {
        evaluated: outcome.evaluated.length,
        baselineScore: outcome.baselineScore,
        bestScore: outcome.bestScore,
      });
      optimization = {
        objective,
        evaluated: outcome.evaluated.map((e) => Object.freeze({parameters: e.parameters, score: e.score})),
        baselineScore: outcome.baselineScore,
      };

      if (outcome.best !== null && outcome.bestScore !== null && outcome.bestArms !== null) {
        // Full arms for the winning parameter set (sessions feed the gates).
        // Reused from the optimizer's winning evaluation — identical inputs.
        const arms = outcome.bestArms;
        let candidate = createPolicyCandidate({
          parentPolicyId: input.policy.id,
          parentPolicyVersion: input.policy.version,
          candidateIndex: 1,
          domain: 'CROSS_DOMAIN',
          parameters: outcome.best,
          objectiveScore: arms.comparison.candidate.objectiveScore,
          baselineScore: arms.comparison.baseline.objectiveScore,
          observedSampleSize: withInputs.length,
          createdAt: input.timestamp,
          parentLineage: [Object.freeze({policyId: input.policy.id, version: input.policy.version, kind: 'ROOT' as const})],
        });
        audit.record('CANDIDATE_GENERATED', {
          candidateId: candidate.candidateId,
          candidateVersion: candidate.candidateVersion,
          parameters: candidate.parameters.fingerprint,
          expectedImprovement: candidate.expectedImprovement,
        });

        const validation = validateCandidate(candidate, space);
        candidate = withGateResults(candidate, {validationStatus: validation.valid ? 'VALID' : 'INVALID'});

        const replayProbe = corpus[0];
        const regression = evaluateRegressionGate({
          candidateParameters: candidate.parameters,
          candidateSessions: arms.candidateSessions,
          initialPlans: arms.candidateSessions.map((s, i) => ({plan: corpus[i]!.plan, session: s})),
          probes: {
            emergencyStop: input.probes?.emergencyStop ?? null,
            staleMarket: input.probes?.staleMarket ?? null,
            replay: {plan: replayProbe.plan, cycles: replayProbe.cycles},
          },
          candidateConfig: applyParameterSet(baselineSpec, candidate.parameters),
        });
        candidate = withGateResults(candidate, {
          simulationStatus: 'PASSED',
          regressionStatus: regression.passed ? 'PASSED' : 'FAILED',
        });
        audit.record('REGRESSION_GATE_RESULT', {candidateId: candidate.candidateId, passed: regression.passed, violations: regression.violations});

        const promotion = evaluatePromotionGate({
          candidate,
          validation,
          comparison: arms.comparison,
          regression,
          config: this.config,
        });
        candidate = withGateResults(candidate, {promotionState: promotion.state});
        audit.record('PROMOTION_GATE_RESULT', {candidateId: candidate.candidateId, state: promotion.state, reasons: promotion.reasons});
        if (promotion.state === 'ELIGIBLE') {
          audit.record('CANDIDATE_ACCEPTED', {candidateId: candidate.candidateId, state: promotion.state});
        } else {
          audit.record('CANDIDATE_REJECTED', {candidateId: candidate.candidateId, state: promotion.state, reasons: promotion.reasons});
        }
        candidates.push(candidate);
      }
    }

    // ---- 10. policy lineage
    const policyLineage = buildPolicyLineage({
      policyId: input.policy.id,
      rootVersion: input.policy.version,
      candidates,
    });

    const body = {
      analysisId,
      observations: Object.freeze(observations),
      attributions: Object.freeze(attributions),
      benchmarks: Object.freeze(benchmarks),
      qualities: Object.freeze(qualities),
      venueScorecards,
      strategyScores,
      domainScores,
      policyEvaluations,
      optimization,
      candidates: Object.freeze(candidates),
      policyLineage,
      auditEvents: audit.eventsView,
      configurationFingerprint: this.configurationFingerprint,
    };
    return Object.freeze({
      ...body,
      analysisFingerprint: performanceAnalysisFingerprint({
        ...body,
        auditHead: audit.head,
      }),
    });
  }

  get configurationFingerprint(): string {
    return performanceAnalysisFingerprintOf(this.config);
  }
}

export {baselineParameterSet};
export type {ExecutionPerformanceConfigSpec};
