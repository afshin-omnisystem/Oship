import type {
  ClosedLoopAnalysisResult, ClosedLoopRecordAnalysis, LeakageComponentName,
  NormalizedRecord, NormalizedValues, NormalizedVenueLeg, RejectedHistoryEntry,
  FailureClass, ResearchConfigSpec,
} from './types';
import {LEAKAGE_COMPONENTS} from '../closed-loop/types';
import {assertResearchProvenance} from './source';
import {contentFingerprintOf, observationSourceId} from './ids';

/**
 * SPRINT 036 — canonical normalization plane (§4).
 *
 * Projects one validated Sprint 035 record analysis into the canonical
 * historical form. Normalization is a pure function of the record content:
 * equivalent observations arriving in different orderings normalize
 * identically, no semantic information is lost (domain, BACK/LAY semantic
 * side, class, strategy, venues, policy, leakage decomposition, adaptive
 * actions, failure class) and malformed history fails closed per record.
 */

export class ResearchNormalizationError extends Error {
  constructor(message: string) {
    super(`research normalization: ${message} — fail closed`);
    this.name = 'ResearchNormalizationError';
  }
}

const KNOWN_CLASSES = new Set([
  'cross-venue-arbitrage', 'triangular-arbitrage', 'funding', 'basis',
  'market-making', 'liquidity-imbalance', 'surebet', 'back-lay', 'plus-ev',
  'hedge', 'middle',
]);

function finiteOrNull(value: number | null, field: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) {
    throw new ResearchNormalizationError(`${field} is not finite (${String(value)})`);
  }
  return value;
}

function failureClassOf(record: ClosedLoopRecordAnalysis): FailureClass {
  const state = record.execution.finalState;
  if (state === 'COMPLETED') return null;
  if (state === 'EXHAUSTED') return 'BUDGET_EXHAUSTED';
  if (record.execution.rerouteCount >= 3) return 'REROUTE_OSCILLATION';
  if (state === 'FAILED' && record.identity.freshness < 0.3) return 'STALE_INTEL';
  return 'INCOMPLETE_EXECUTION';
}

export function normalizeRecord(
  record: ClosedLoopRecordAnalysis, batch: ClosedLoopAnalysisResult, config: ResearchConfigSpec,
): NormalizedRecord {
  const id = record.identity;
  if (!id.opportunityId || typeof id.opportunityId !== 'string') {
    throw new ResearchNormalizationError('missing opportunity identity');
  }
  if (id.domain !== 'AFIS' && id.domain !== 'ABL') {
    throw new ResearchNormalizationError(`unknown domain "${String(id.domain)}"`);
  }
  if (!KNOWN_CLASSES.has(id.opportunityClass)) {
    throw new ResearchNormalizationError(`unknown opportunity class "${String(id.opportunityClass)}"`);
  }
  if (!Number.isFinite(id.observedAt) || id.observedAt <= 0) {
    throw new ResearchNormalizationError(`invalid timestamp ${id.observedAt}`);
  }
  if (!Number.isFinite(id.freshness)) {
    throw new ResearchNormalizationError('non-finite observation freshness — UNKNOWABLE, fail closed');
  }
  if (!record.strategy.strategyId) {
    throw new ResearchNormalizationError('missing strategy identity');
  }
  if (record.venue.venues.length === 0) {
    throw new ResearchNormalizationError('no venue legs');
  }
  for (const leg of record.venue.venues) {
    if (!leg.venue) throw new ResearchNormalizationError('venue leg without venue identity');
  }
  // Sprint 035's top-level realized provenance is a conservative roll-up that
  // degrades to UNAVAILABLE when ANY leakage component is unavailable. The
  // research memory records the honest per-value provenance of the realized
  // NET value itself, plus the explicit list of unavailable components.
  assertResearchProvenance(record.realized.realizedNetValue.provenance,
    `realized net value of ${id.opportunityId}`);
  const unavailableComponents = record.leakage.components
    .filter((c) => !c.available).map((c) => c.component);

  const leakageByComponent = {} as Record<LeakageComponentName, number>;
  for (const name of LEAKAGE_COMPONENTS) leakageByComponent[name] = 0;
  for (const component of record.leakage.components) {
    if (!Number.isFinite(component.value)) {
      throw new ResearchNormalizationError(`leakage component ${component.component} is not finite`);
    }
    leakageByComponent[component.component] = component.value;
  }
  let topLeakageComponent: LeakageComponentName | null = null;
  let topLeakageValue = 0;
  for (const name of LEAKAGE_COMPONENTS) {
    if (leakageByComponent[name] > topLeakageValue) {
      topLeakageValue = leakageByComponent[name];
      topLeakageComponent = name;
    }
  }

  const venues = [...new Set(record.venue.venues.map((v) => v.venue))].sort();
  const venueLegs: NormalizedVenueLeg[] = record.venue.venues
    .map((v) => ({
      venue: v.venue,
      side: v.side,
      leakage: finiteOrNull(v.venueLeakage.value, 'venue leakage'),
      venueResult: finiteOrNull(v.realizedVenueResult.value, 'venue result'),
      fillEfficiency: finiteOrNull(v.fillEfficiency.value, 'fill efficiency'),
    }))
    .sort((a, b) => a.venue.localeCompare(b.venue) || a.side.localeCompare(b.side));

  const values: NormalizedValues = Object.freeze({
    theoreticalGross: finiteOrNull(record.theoretical.theoreticalGrossEdge.value, 'theoretical gross'),
    theoreticalNet: finiteOrNull(record.theoretical.theoreticalNetEdge.value, 'theoretical net'),
    realizedGross: finiteOrNull(record.realized.realizedGrossValue.value, 'realized gross'),
    realizedCosts: finiteOrNull(record.realized.realizedCosts.value, 'realized costs'),
    realizedNet: finiteOrNull(record.realized.realizedNetValue.value, 'realized net'),
    preservationRatio: finiteOrNull(record.realized.preservationRatio.value, 'preservation ratio'),
    preservationGrade: record.score.grade,
    totalLeakage: finiteOrNull(record.realized.totalLeakage.value, 'total leakage'),
    leakageByComponent: Object.freeze(leakageByComponent),
    unavailableComponents: Object.freeze(unavailableComponents),
    topLeakageComponent,
    executionQuality: finiteOrNull(record.score.executionQuality, 'execution quality'),
    outcome: record.execution.finalState,
    failureClass: failureClassOf(record),
    capitalScale: finiteOrNull(record.theoretical.capitalScale.value, 'capital scale'),
    deployedCapital: record.capital.deployedCapital,
    approvedCapital: record.capital.approvedCapital,
    adaptiveActions: record.control.occurrences.length,
    rerouteCount: record.execution.rerouteCount,
    repriceCount: record.execution.repriceCount,
    resliceCount: record.execution.resliceCount,
    freshness: id.freshness,
    confidence: id.confidence,
    riskImpact: record.risk.impactKind,
    provenance: record.realized.realizedNetValue.provenance,
  });

  if (values.deployedCapital < 0 || values.approvedCapital < 0) {
    throw new ResearchNormalizationError('negative capital in history');
  }
  if (values.deployedCapital > values.approvedCapital + 1e-9) {
    throw new ResearchNormalizationError('deployed capital exceeds approval in history');
  }

  const timeBucket = `tb_${Math.floor(id.observedAt / config.timeBucketMs)}`;
  const sourceId = observationSourceId(batch.analysisId, id.opportunityId);
  const baseSeries = record.label.includes('__') ? record.label.split('__')[0] : record.label;

  const draft = Object.freeze({
    sourceId,
    batchId: batch.analysisId,
    opportunityId: id.opportunityId,
    baseSeries,
    domain: id.domain,
    opportunityClass: id.opportunityClass,
    semanticSide: id.semanticSide,
    strategyId: record.strategy.strategyId,
    venues: Object.freeze(venues),
    venueLegs: Object.freeze(venueLegs),
    policyId: record.policy.policyId,
    policyVersion: record.policy.policyVersion,
    timestamp: id.observedAt,
    timeBucket,
    values,
    recordFingerprint: record.fingerprint,
    closedLoopConfigFingerprint: batch.configurationFingerprint,
    contentFingerprint: '',
  }) as NormalizedRecord;
  return Object.freeze({...draft, contentFingerprint: fingerprintNormalized(draft)});
}

/** Recompute the content fingerprint over the canonical projection. */
export function fingerprintNormalized(record: NormalizedRecord): string {
  return contentFingerprintOf({
    sourceId: record.sourceId, opportunityId: record.opportunityId,
    domain: record.domain, class: record.opportunityClass, side: record.semanticSide,
    strategy: record.strategyId, venues: record.venues, legs: record.venueLegs,
    policy: record.policyVersion, timestamp: record.timestamp, values: record.values,
    recordFingerprint: record.recordFingerprint,
    closedLoopConfig: record.closedLoopConfigFingerprint,
  });
}

export interface BatchNormalization {
  readonly batchId: string;
  readonly normalized: readonly NormalizedRecord[];
  readonly rejected: readonly RejectedHistoryEntry[];
  readonly failClosed: boolean;
  readonly reason: string | null;
}

/** Normalize one historical batch — malformed records fail closed individually. */
export function normalizeBatch(
  batch: ClosedLoopAnalysisResult, config: ResearchConfigSpec, timestamp: number,
): BatchNormalization {
  if (!batch.invariants || batch.invariants.passed !== true) {
    return {
      batchId: batch.analysisId,
      normalized: [],
      rejected: batch.records.map((r) => ({
        sourceId: observationSourceId(batch.analysisId, r.identity.opportunityId),
        batchId: batch.analysisId,
        kind: 'INVARIANT_FAILURE' as const,
        reason: 'source closed-loop analysis failed its own invariants — history not trusted',
        timestamp,
      })),
      failClosed: true,
      reason: 'closed-loop invariant failure',
    };
  }
  const normalized: NormalizedRecord[] = [];
  const rejected: RejectedHistoryEntry[] = [];
  for (const record of batch.records) {
    try {
      normalized.push(normalizeRecord(record, batch, config));
    } catch (error) {
      rejected.push({
        sourceId: observationSourceId(batch.analysisId, record.identity?.opportunityId ?? 'unknown'),
        batchId: batch.analysisId,
        kind: 'MALFORMED_HISTORY',
        reason: error instanceof Error ? error.message : String(error),
        timestamp,
      });
    }
  }
  return {batchId: batch.analysisId, normalized, rejected, failClosed: false, reason: null};
}
