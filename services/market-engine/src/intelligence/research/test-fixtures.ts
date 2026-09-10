import {closedLoopCorpus} from '../closed-loop/test-fixtures';
import {ClosedLoopIntelligenceEngine} from '../closed-loop/engine';
import type {
  ClosedLoopAnalysisResult, ClosedLoopInput, ClosedLoopRecord,
} from '../closed-loop/types';
import type {PerformanceAnalysisResult} from '../../execution/performance/types';
import type {OpportunityType} from '../../opportunity/types';

/**
 * SPRINT 036 — research test fixtures.
 *
 * Builds a deterministic multi-era historical corpus from the REAL Sprint 035
 * closed-loop corpus: five 30-day eras of the thirteen canonical lifecycle
 * records, with deterministic era variation so that trend, recurrence and
 * degradation patterns are honestly detectable:
 *
 *   • arb-guardian fee tier improves per era (preservation IMPROVEMENT)
 *   • arb-aggressive theoretical edge grows while realization is flat
 *     (preservation DETERIORATION, high-theoretical/poor-realization)
 *   • steady-single + emergency-stop stay at exactly 1.0 (CONSISTENTLY_HIGH)
 *   • stale-intel / oscillation-abort / policy-trial stay ≤ 0.1 or negative
 *     (CONSISTENTLY_LOW, repeated failures, repeated leakage)
 *   • opportunity classes rotate per era so AFIS covers funding / basis /
 *     triangular / market-making and ABL covers surebet / back-lay / +EV /
 *     middle with honest under-sampling (hedge remains zero-sample)
 *
 * Every era is re-analyzed by the REAL ClosedLoopIntelligenceEngine; the
 * fixture refuses to build if any era fails the 35 closed-loop invariants.
 */

export const ERA_COUNT = 5;
export const ERA_OFFSET_MS = 30 * 24 * 3600 * 1000;

const TIME_KEYS = new Set(['timestamp', 'observedAt', 'expiresAt', 'startedAt',
  'completedAt', 'createdAt', 'submittedAt', 'lastFillAt', 'deadline']);

const ID_FIELDS = new Set(['id', 'opportunityId', 'discoveryId', 'decisionId',
  'allocationId', 'candidateId', 'riskDecisionId', 'assessmentId', 'executionPlanId',
  'sessionId', 'rootExecutionPlanId', 'parentCycleId', 'cycleId', 'telemetryId',
  'simulationId', 'checkpointId', 'attributionId', 'observationId', 'riskReference',
  'allocationReference', 'aegisReference', 'treasuryReference', 'parentPlanId',
  'evidenceId', 'sourceEvent', 'correlationId', 'traceId', 'orderId', 'sliceId', 'eventId']);

const GUARDIAN_FEE_LABELS = new Set(['healthy-execution', 'risk-throttled',
  'partial-completion', 'adaptive-recovery']);
const AGGRESSIVE_EDGE_LABELS = new Set(['high-edge-poor-exec', 'adverse-venue-drift',
  'venue-leakage', 'stale-intel', 'oscillation-abort', 'policy-v1.1-trial']);

const CLASS_ROTATION: Readonly<Record<string, readonly OpportunityType[]>> = Object.freeze({
  // era 1 .. era 5
  'steady-single': ['CROSS_VENUE_SPOT_ARBITRAGE', 'FUNDING_RATE_ARBITRAGE',
    'SPOT_PERPETUAL_BASIS', 'FUNDING_RATE_ARBITRAGE', 'SPOT_PERPETUAL_BASIS'],
  'high-edge-poor-exec': ['CROSS_VENUE_SPOT_ARBITRAGE', 'TRIANGULAR_ARBITRAGE',
    'MARKET_MAKING', 'TRIANGULAR_ARBITRAGE', 'MARKET_MAKING'],
  'abl-surebet': ['ODDS_ARBITRAGE_2WAY', 'BACK_LAY_DISCREPANCY', 'SPORTS_VALUE',
    'HEDGE_MIDDLE', 'ODDS_ARBITRAGE_3WAY'],
});

function collectIds(value: unknown, key: string | null, ids: Map<string, string>, era: number): void {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && key !== null && ID_FIELDS.has(key) && value.length > 0) {
      if (!ids.has(value)) ids.set(value, `${value}__e${era}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, key, ids, era);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    collectIds(v, k, ids, era);
  }
}

function transform(value: unknown, key: string | null, idMap: Map<string, string>, offset: number): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && idMap.has(value)) return idMap.get(value)!;
    if (key !== null && TIME_KEYS.has(key)) {
      // Numeric timestamps may be serialized as numeric strings (e.g. the
      // Strategy contract) — shift them identically.
      if (typeof value === 'number') return value + offset;
      if (typeof value === 'string' && /^-?\d+$/.test(value)) return String(Number(value) + offset);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => transform(item, key, idMap, offset));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = transform(v, k, idMap, offset);
  }
  return out;
}

function scaleCosts(costs: Record<string, number>, factor: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(costs)) {
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v * factor : v;
  }
  return out;
}

function eraRecord(base: ClosedLoopRecord, era: number, idMap: Map<string, string>): ClosedLoopRecord {
  const offset = (era - 1) * ERA_OFFSET_MS;
  const record = transform(base, null, idMap, offset) as unknown as ClosedLoopRecord;
  const label = base.label;
  const o = record.opportunity as unknown as Record<string, unknown>;
  const session = (record.session as unknown as {session: {cycles: {telemetry: {fees: number}}[]}})
    .session;
  // Era value variation (deterministic).
  if (GUARDIAN_FEE_LABELS.has(label)) {
    // Guardian improves across eras: session fees decay toward ~10% of baseline.
    const factor = 1 - 0.225 * (era - 1);
    for (const cycle of session.cycles) cycle.telemetry.fees *= factor;
  }
  if (AGGRESSIVE_EDGE_LABELS.has(label)) {
    // Aggressive deteriorates across eras: theoretical edges decay (alpha
    // decay) while its absolute execution leakages stay constant, so realized
    // value disappears over time.
    const factor = 1 - 0.04 * (era - 1);
    o.grossEdge = (o.grossEdge as number) * factor;
    o.netEdge = (o.netEdge as number) * factor;
    o.estimatedCosts = scaleCosts(o.estimatedCosts as Record<string, number>, factor);
    o.estimatedTotalCost = (o.estimatedTotalCost as number) * factor;
  }
  const rotation = CLASS_ROTATION[label];
  if (rotation) {
    o.type = rotation[era - 1];
  }
  o.fingerprint = `${base.opportunity.fingerprint}__e${era}`;
  return record;
}

export interface ResearchHistoryCorpus {
  readonly base: ReturnType<typeof closedLoopCorpus>;
  readonly eraAnalyses: readonly ClosedLoopAnalysisResult[];
  readonly input: {analyses: readonly ClosedLoopAnalysisResult[]; timestamp: number;
    correlationId: string; traceId: string};
  /** One record analysis with non-finite freshness — research must reject it. */
  malformedAnalysis(): ClosedLoopAnalysisResult;
  /** An analysis whose own invariants failed — the whole batch is untrusted. */
  invariantFailedAnalysis(): ClosedLoopAnalysisResult;
  /** Same content, mutated value — a contradictory duplicate of era 1. */
  contradictoryAnalysis(): ClosedLoopAnalysisResult;
  /** The sourceId of the era-1 healthy observation (for corrections). */
  healthySourceId(era: number): string;
}

let cached: ResearchHistoryCorpus | null = null;

export function researchHistory(): ResearchHistoryCorpus {
  if (cached) return cached;
  const base = closedLoopCorpus();
  const engine = new ClosedLoopIntelligenceEngine();
  const eraAnalyses: ClosedLoopAnalysisResult[] = [];

  // Distinct shared Sprint 034 performance objects.
  const perfObjects: (PerformanceAnalysisResult | null)[] = [];
  for (const record of base.records) {
    if (record.performance && !perfObjects.includes(record.performance)) {
      perfObjects.push(record.performance);
    }
  }

  for (let era = 1; era <= ERA_COUNT; era++) {
    // Pass 1: collect the era id map over records + shared performance.
    const idMap = new Map<string, string>();
    for (const record of base.records) collectIds(record, null, idMap, era);
    for (const perf of perfObjects) if (perf) collectIds(perf, null, idMap, era);
    // Pass 2: transform.
    const offset = (era - 1) * ERA_OFFSET_MS;
    const perfMap = new Map<PerformanceAnalysisResult | null, PerformanceAnalysisResult | null>();
    for (const perf of perfObjects) {
      perfMap.set(perf, perf ? transform(perf, null, idMap, offset) as PerformanceAnalysisResult : null);
    }
    const records = base.records.map((record) => {
      const eraRec = eraRecord(record, era, idMap) as unknown as Record<string, unknown>;
      eraRec.performance = perfMap.get(record.performance) ?? null;
      eraRec.label = `${record.label}__e${era}`;
      return Object.freeze(eraRec) as unknown as ClosedLoopRecord;
    });
    const input: ClosedLoopInput = {
      records,
      timestamp: base.input.timestamp + offset,
      correlationId: `${base.input.correlationId}__e${era}`,
      traceId: `${base.input.traceId}__e${era}`,
    };
    const analysis = engine.analyze(input);
    if (!analysis.invariants?.passed) {
      throw new Error(`research fixtures: era ${era} failed closed-loop invariants — refusing to build`);
    }
    eraAnalyses.push(analysis);
  }

  const healthySourceId = (era: number): string =>
    `${eraAnalyses[era - 1].analysisId}:opp_healthy__e${era}`;

  cached = {
    base,
    eraAnalyses: Object.freeze(eraAnalyses),
    input: Object.freeze({
      analyses: Object.freeze(eraAnalyses),
      timestamp: base.input.timestamp + ERA_COUNT * ERA_OFFSET_MS,
      correlationId: 'research-history',
      traceId: 'research-history-trace',
    }),
    malformedAnalysis(): ClosedLoopAnalysisResult {
      const clone = structuredClone(eraAnalyses[0]);
      const broken = clone.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1');
      if (!broken) throw new Error('fixture: healthy record missing');
      (broken.identity as unknown as {freshness: number}).freshness = Number.NaN;
      return clone;
    },
    invariantFailedAnalysis(): ClosedLoopAnalysisResult {
      const clone = structuredClone(eraAnalyses[0]);
      return {...clone, invariants: {passed: false, checks: clone.invariants?.checks ?? [], failedCount: 1}};
    },
    contradictoryAnalysis(): ClosedLoopAnalysisResult {
      const clone = structuredClone(eraAnalyses[0]);
      const healthy = clone.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1');
      if (!healthy) throw new Error('fixture: healthy record missing');
      (healthy as unknown as {realized: unknown}).realized = {...healthy.realized,
        realizedNetValue: {...healthy.realized.realizedNetValue, value: 4.2}};
      return clone;
    },
    healthySourceId,
  };
  return cached;
}

/** Full research input over the five-era history. */
export function researchInput(): {analyses: readonly ClosedLoopAnalysisResult[]; timestamp: number;
  correlationId: string; traceId: string} {
  return researchHistory().input;
}
