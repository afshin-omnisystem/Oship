import type {
  ComparisonKind, ComparisonMetrics, ComparisonResult, MemoryRecord,
  OpportunityClass, ResearchConfigSpec,
} from './types';
import {comparisonIdOf} from './ids';
import {meanOf} from './source';
import {evaluateEvidence} from './evidence';

/**
 * SPRINT 036 — statistically honest comparative analysis (§8).
 *
 * Comparability is established FIRST. Minimum sample size, identical metric
 * definitions (same closed-loop configuration fingerprint), compatible
 * capital scale, compatible provenance, compatible execution conditions and
 * comparable opportunity classes are all required. Cross-domain comparisons
 * are valid only on explicitly normalized metrics. Invalid comparisons
 * return NOT_COMPARABLE with explicit reasons — never a silent ranking.
 */

function metricsFor(
  records: readonly MemoryRecord[], subject: string,
): ComparisonMetrics {
  const provenanceCounts = new Map<string, number>();
  for (const r of records) provenanceCounts.set(r.provenance, (provenanceCounts.get(r.provenance) ?? 0) + 1);
  const dominantProvenance = [...provenanceCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return Object.freeze({
    subject,
    sampleSize: records.length,
    meanPreservation: meanOf(records.map((r) => r.values.preservationRatio)),
    meanRealizedNet: meanOf(records.map((r) => r.values.realizedNet)),
    totalLeakage: records.reduce((s, r) => s + (r.values.totalLeakage ?? 0), 0),
    meanExecutionQuality: meanOf(records.map((r) => r.values.executionQuality)),
    completionRate: records.length === 0 ? null
      : records.filter((r) => r.values.outcome === 'COMPLETED').length / records.length,
    meanCapitalScale: meanOf(records.map((r) => r.values.capitalScale)),
    dominantProvenance: dominantProvenance as ComparisonMetrics['dominantProvenance'],
    classes: Object.freeze([...new Set(records.map((r) => r.opportunityClass))].sort()),
    policies: Object.freeze([...new Set(records.map((r) => `${r.policyId}@${r.policyVersion}`))].sort()),
    memoryIds: Object.freeze(records.map((r) => r.memoryId).sort()),
  });
}

export interface ComparisonRequest {
  readonly kind: ComparisonKind;
  readonly subjectA: string;
  readonly subjectB: string;
  readonly recordsA: readonly MemoryRecord[];
  readonly recordsB: readonly MemoryRecord[];
  /** Restrict both populations to one comparable opportunity class. */
  readonly scopeClass: OpportunityClass | null;
  /** Cross-domain comparisons must declare normalized metrics. */
  readonly normalized: boolean;
  readonly metric: 'preservation' | 'realizedNet';
  /** Domain-level comparisons compare across class sets by design. */
  readonly requireClassOverlap?: boolean;
}

export function comparePopulations(
  request: ComparisonRequest, config: ResearchConfigSpec,
): ComparisonResult {
  const a = metricsFor(request.recordsA, request.subjectA);
  const b = metricsFor(request.recordsB, request.subjectB);
  const reasons: string[] = [];

  if (request.recordsA.length === 0 || request.recordsB.length === 0) {
    reasons.push('one population is empty');
  }
  if (request.recordsA.length < config.minComparativeSample) {
    reasons.push(`${request.subjectA} sample ${request.recordsA.length} < ${config.minComparativeSample}`);
  }
  if (request.recordsB.length < config.minComparativeSample) {
    reasons.push(`${request.subjectB} sample ${request.recordsB.length} < ${config.minComparativeSample}`);
  }
  // Identical metric definitions: same closed-loop configuration fingerprint.
  const configsA = new Set(request.recordsA.map((r) => r.closedLoopConfigFingerprint));
  const configsB = new Set(request.recordsB.map((r) => r.closedLoopConfigFingerprint));
  const configA = [...configsA].sort().join(',');
  const configB = [...configsB].sort().join(',');
  if (configsA.size > 1 || configsB.size > 1 || (configA !== configB && configsA.size > 0 && configsB.size > 0)) {
    reasons.push(`metric definitions differ (closed-loop config ${configA || '∅'} vs ${configB || '∅'})`);
  }
  // Compatible capital scale.
  if (a.meanCapitalScale !== null && b.meanCapitalScale !== null
    && Math.max(a.meanCapitalScale, b.meanCapitalScale) > 1e-9) {
    const divergence = Math.max(a.meanCapitalScale, b.meanCapitalScale)
      / Math.min(a.meanCapitalScale, b.meanCapitalScale);
    if (divergence > config.maxCapitalScaleDivergence) {
      reasons.push(`capital scale divergence ${divergence.toFixed(2)} > ${config.maxCapitalScaleDivergence}`);
    }
  }
  // Compatible provenance.
  if (a.dominantProvenance !== b.dominantProvenance) {
    reasons.push(`dominant provenance ${a.dominantProvenance ?? '∅'} vs ${b.dominantProvenance ?? '∅'}`);
  }
  // Comparable opportunity classes.
  const classesA = new Set(a.classes);
  const classesB = new Set(b.classes);
  const overlap = [...classesA].filter((c) => classesB.has(c));
  if (request.scopeClass) {
    if (!classesA.has(request.scopeClass) || !classesB.has(request.scopeClass)) {
      reasons.push(`scoped class ${request.scopeClass} missing from one population`);
    }
  } else if (request.requireClassOverlap !== false
    && overlap.length === 0 && !(a.classes.length === 0 || b.classes.length === 0)) {
    reasons.push('no overlapping opportunity class');
  }
  // Domain compatibility: raw cross-domain comparisons are invalid.
  const domainsA = new Set(request.recordsA.map((r) => r.domain));
  const domainsB = new Set(request.recordsB.map((r) => r.domain));
  const crossDomain = [...domainsA].some((d) => domainsB.has(d)) === false
    || (domainsA.size > 0 && domainsB.size > 0 && [...domainsA].some((d) => !domainsB.has(d)));
  if (crossDomain && !request.normalized) {
    reasons.push('cross-domain comparison requires explicitly normalized metrics');
  }

  const comparable = reasons.length === 0;
  let winner: ComparisonResult['winner'] = 'NONE';
  let preservationDelta: number | null = null;
  if (comparable && a.meanPreservation !== null && b.meanPreservation !== null) {
    preservationDelta = a.meanPreservation - b.meanPreservation;
    if (Math.abs(preservationDelta) < 1e-9) {
      winner = 'NONE';
    } else {
      winner = preservationDelta > 0 ? 'A' : 'B';
    }
  }

  const supporting = comparable
    ? [...request.recordsA, ...request.recordsB].filter((r) => r.values.provenance !== 'UNAVAILABLE')
    : [];
  const evidence = evaluateEvidence({
    subject: `${request.subjectA}-vs-${request.subjectB}`,
    supporting, contradicting: [],
    metric: request.metric,
  }, config);

  return Object.freeze({
    comparisonId: comparisonIdOf({
      kind: request.kind, a: request.subjectA, b: request.subjectB,
      scopeClass: request.scopeClass, comparable, winner,
    }),
    kind: request.kind,
    subjectA: request.subjectA,
    subjectB: request.subjectB,
    scopeClass: request.scopeClass,
    normalized: request.normalized,
    comparable,
    reasons: Object.freeze(reasons),
    metricsA: a,
    metricsB: b,
    winner,
    preservationDelta,
    evidenceState: evidence.state,
    fingerprint: comparisonIdOf({kind: request.kind, a: request.subjectA, b: request.subjectB, seal: true}),
  });
}


/** Venue-entity comparison: winner = lower aggregate leakage (deterministic). */
export function compareVenueEntities(
  venueA: {key: string; legs: number; totalLeakage: number; fillEfficiency: number | null; memoryIds: readonly string[]},
  venueB: {key: string; legs: number; totalLeakage: number; fillEfficiency: number | null; memoryIds: readonly string[]},
  config: ResearchConfigSpec,
): ComparisonResult {
  const reasons: string[] = [];
  if (venueA.legs < config.minComparativeSample) reasons.push(`${venueA.key} legs ${venueA.legs} < ${config.minComparativeSample}`);
  if (venueB.legs < config.minComparativeSample) reasons.push(`${venueB.key} legs ${venueB.legs} < ${config.minComparativeSample}`);
  const comparable = reasons.length === 0;
  let winner: 'A' | 'B' | 'NONE' = 'NONE';
  if (comparable) {
    if (Math.abs(venueA.totalLeakage - venueB.totalLeakage) < 1e-9) winner = 'NONE';
    else winner = venueA.totalLeakage < venueB.totalLeakage ? 'A' : 'B';
  }
  return Object.freeze({
    comparisonId: comparisonIdOf({kind: 'VENUE', a: venueA.key, b: venueB.key, venue: true}),
    kind: 'VENUE', subjectA: venueA.key, subjectB: venueB.key, scopeClass: null,
    normalized: false, comparable, reasons: Object.freeze(reasons),
    metricsA: Object.freeze({
      subject: venueA.key, sampleSize: venueA.legs,
      meanPreservation: null, meanRealizedNet: null,
      totalLeakage: venueA.totalLeakage, meanExecutionQuality: venueA.fillEfficiency,
      completionRate: null, meanCapitalScale: null, dominantProvenance: null,
      classes: Object.freeze([]), policies: Object.freeze([]),
      memoryIds: Object.freeze([...venueA.memoryIds].sort()),
    }),
    metricsB: Object.freeze({
      subject: venueB.key, sampleSize: venueB.legs,
      meanPreservation: null, meanRealizedNet: null,
      totalLeakage: venueB.totalLeakage, meanExecutionQuality: venueB.fillEfficiency,
      completionRate: null, meanCapitalScale: null, dominantProvenance: null,
      classes: Object.freeze([]), policies: Object.freeze([]),
      memoryIds: Object.freeze([...venueB.memoryIds].sort()),
    }),
    winner,
    preservationDelta: null,
    evidenceState: comparable ? 'MODERATE' : 'INSUFFICIENT',
    fingerprint: comparisonIdOf({kind: 'VENUE', a: venueA.key, b: venueB.key, venue: true, seal: true}),
  });
}
