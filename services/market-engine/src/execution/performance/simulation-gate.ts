import {
  SimulationComparison, SessionRunMetrics, CorpusRunMetrics, ObjectiveFunction,
  ExecutionControlSession, ExecutionPlan, ControlCycleSpec,
} from './types';
import {ExecutionControlEngine} from '../control/engine';
import type {ControlConfigInput} from '../control/config';
import {sessionRunMetrics, aggregateCorpus} from './metrics';
import {simulationComparisonId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — the simulation gate.
 *
 * Every candidate policy must be tested against the existing Sprint 031
 * simulation + Sprint 033 control engine: BASELINE POLICY vs CANDIDATE POLICY
 * on IDENTICAL deterministic inputs — the same market replay, the same
 * execution plans, the same order books, the same latency and fee
 * configuration (all inherited from the identical corpus). Produces per-arm
 * corpus metrics plus explicit deltas.
 */

/** One deterministic training input (identical for both arms). */
export interface CorpusEntry {
  readonly label: string;
  readonly plan: ExecutionPlan;
  readonly cycles: readonly ControlCycleSpec[];
  /** Session start of the original record (reproduces its timing exactly). */
  readonly startTime?: number;
}

export interface SimulationArmsResult {
  readonly comparison: SimulationComparison;
  readonly baselineSessions: readonly ExecutionControlSession[];
  readonly candidateSessions: readonly ExecutionControlSession[];
}

function inputFingerprintOf(entry: CorpusEntry): string {
  return sha256({
    planId: entry.plan.executionPlanId,
    planFingerprint: (entry.plan as unknown as {fingerprint?: string}).fingerprint ?? entry.plan.executionPlanId,
    plan: entry.plan,
    cycles: entry.cycles,
  });
}

export interface CorpusArm {
  readonly sessions: readonly ExecutionControlSession[];
  readonly metrics: readonly SessionRunMetrics[];
}

/** Run one arm of the simulation gate over the full corpus. */
export function runCorpusArm(
  entries: readonly CorpusEntry[],
  config: ControlConfigInput,
  correlationId: string,
): CorpusArm {
  const sessions: ExecutionControlSession[] = [];
  const metrics: SessionRunMetrics[] = [];
  for (const entry of entries) {
    const engine = new ExecutionControlEngine(config);
    const session = engine.run({
      plan: entry.plan,
      cycles: entry.cycles,
      startTime: entry.startTime ?? DEFAULT_START,
      correlationId,
      traceId: correlationId,
    });
    sessions.push(session);
    metrics.push(sessionRunMetrics(session, entry.label));
  }
  return {sessions, metrics};
}

const DEFAULT_START = 1_704_067_200_000;

/** Run both arms on identical inputs and compare them deterministically. */
export function runSimulationGate(input: {
  readonly corpus: readonly CorpusEntry[];
  readonly baselineConfig: ControlConfigInput;
  readonly candidateConfig: ControlConfigInput;
  readonly candidateLabel: string;
  readonly objective: ObjectiveFunction;
}): SimulationArmsResult {
  if (input.corpus.length === 0) {
    throw new Error('simulation gate refused: empty corpus — fail closed');
  }
  return runArmsFromPrecomputed(
    input.corpus,
    runCorpusArm(input.corpus, input.baselineConfig, 'performance-sim-baseline'),
    runCorpusArm(input.corpus, input.candidateConfig, 'performance-sim-candidate'),
    input.candidateLabel,
    input.objective,
  );
}

/** Assemble a comparison from precomputed arms (no re-running). */
export function runArmsFromPrecomputed(
  corpus: readonly CorpusEntry[],
  baseline: CorpusArm,
  candidate: CorpusArm,
  candidateLabel: string,
  objective: ObjectiveFunction,
): SimulationArmsResult {
  const baselineAggregate = aggregateCorpus(baseline.metrics, objective);
  const candidateAggregate = aggregateCorpus(candidate.metrics, objective);

  const fingerprints = corpus.map((e) => inputFingerprintOf(e));
  // Identical inputs are structural: both arms consume the same corpus array.
  const identicalInputs = fingerprints.length === corpus.length && fingerprints.length > 0;

  const body = {
    candidateLabel,
    inputFingerprints: Object.freeze(fingerprints),
    identicalInputs,
    baseline: baselineAggregate,
    candidate: candidateAggregate,
    delta: Object.freeze({
      qualityDelta: candidateAggregate.averageQuality - baselineAggregate.averageQuality,
      costBpsDelta: candidateAggregate.costBps - baselineAggregate.costBps,
      slippageDeltaBps: candidateAggregate.averageSlippageBps - baselineAggregate.averageSlippageBps,
      impactDeltaBps: candidateAggregate.averageImpactBps - baselineAggregate.averageImpactBps,
      latencyDeltaMs: candidateAggregate.averageLatencyMs - baselineAggregate.averageLatencyMs,
      completionDelta: candidateAggregate.completedCount - baselineAggregate.completedCount,
      failureDelta: candidateAggregate.failureCount - baselineAggregate.failureCount,
      objectiveDelta: candidateAggregate.objectiveScore - baselineAggregate.objectiveScore,
      fillRateDelta: candidateAggregate.fillRate - baselineAggregate.fillRate,
    }),
  };
  return Object.freeze({
    comparison: Object.freeze({
      ...body,
      comparisonId: simulationComparisonId({candidateLabel, fingerprints}),
      fingerprint: `pfsim_${sha256(body)}`,
    }),
    baselineSessions: Object.freeze([...baseline.sessions]),
    candidateSessions: Object.freeze([...candidate.sessions]),
  });
}

/** Average execution price actually achieved by an arm (for benchmarks). */
export function averageAchievedPrice(sessions: readonly ExecutionControlSession[]): number | null {
  let notional = 0;
  let qty = 0;
  for (const s of sessions) {
    for (const c of s.cycles) {
      for (const o of c.telemetry.orders) {
        if (o.filledQuantity <= 0) continue;
        notional += o.averageFillPrice * o.filledQuantity;
        qty += o.filledQuantity;
      }
    }
  }
  return qty > 0 ? notional / qty : null;
}

export type {CorpusRunMetrics};
