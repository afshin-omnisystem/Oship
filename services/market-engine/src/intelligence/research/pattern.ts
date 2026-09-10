import type {
  MemoryRecord, PatternKind, PatternSubject, PatternSubjectType, ResearchConfigSpec,
  ResearchPattern, PatternFamily,
} from './types';
import {patternIdOf} from './ids';
import {groupBy} from './knowledge';
import {memorySortKey} from './observation';
import type {LeakageComponentName} from '../closed-loop/types';

/**
 * SPRINT 036 — deterministic pattern detection (§9).
 *
 * Every pattern carries its evidence memory ids, sample size and an explicit
 * confidence state. Detectors only fire on sufficient recurrence; absence of
 * a pattern is an honest result, never a forced one.
 */

function pattern(
  family: PatternFamily, kind: PatternKind, subject: PatternSubject, scope: string,
  evidence: readonly MemoryRecord[], config: ResearchConfigSpec,
  extra: {direction?: ResearchPattern['direction']; magnitude: number} = {magnitude: 0},
): ResearchPattern {
  const timestamps = evidence.map((r) => r.timestamp).sort((a, b) => a - b);
  const meanConfidence = evidence.length === 0 ? 0
    : evidence.reduce((s, r) => s + Math.max(0, Math.min(1, r.evidence.confidence)), 0) / evidence.length;
  const state = evidence.length < config.patternRecurrenceMinimum ? 'INSUFFICIENT'
    : meanConfidence >= 0.8 ? 'STRONG' : meanConfidence >= 0.6 ? 'MODERATE' : 'WEAK';
  return Object.freeze({
    patternId: patternIdOf({family, kind, subject, scope, evidence: evidence.map((r) => r.memoryId)}),
    family, kind, subject, scope,
    evidenceMemoryIds: Object.freeze(evidence.map((r) => r.memoryId).sort()),
    sampleSize: evidence.length,
    firstSeen: timestamps[0] ?? 0,
    lastSeen: timestamps[timestamps.length - 1] ?? 0,
    direction: extra.direction ?? null,
    magnitude: extra.magnitude,
    confidenceState: state,
    fingerprint: patternIdOf({family, kind, subject, seal: true}),
  });
}

/** Base-series grouping (opportunity series across eras, by source label). */
function baseSeriesRecords(memory: readonly MemoryRecord[]): Map<string, MemoryRecord[]> {
  return groupBy(memory.filter((r) => r.status === 'ACTIVE'), (r) => {
    const series = r.opportunityId.includes('__') ? r.opportunityId.split('__')[0] : r.opportunityId;
    return `${r.domain}|${series}`;
  });
}

function meanRatio(records: readonly MemoryRecord[]): number | null {
  const ratios = records.map((r) => r.values.preservationRatio).filter((v): v is number => v !== null);
  if (ratios.length === 0) return null;
  return ratios.reduce((s, v) => s + v, 0) / ratios.length;
}

function eraMeans(records: readonly MemoryRecord[]): {bucket: string; mean: number | null}[] {
  const byBucket = groupBy(records, (r) => r.timeBucket);
  return [...byBucket.keys()].sort().map((bucket) => ({bucket, mean: meanRatio(byBucket.get(bucket)!)}));
}

function linearSlope(points: readonly {mean: number | null}[]): number | null {
  const ys = points.map((p) => p.mean).filter((v): v is number => v !== null);
  if (ys.length < 2) return null;
  const n = ys.length;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? null : num / den;
}

function leakageRecurred(
  memory: readonly MemoryRecord[], component: LeakageComponentName, kind: PatternKind,
  subject: PatternSubject, config: ResearchConfigSpec, scope = 'all-history',
): ResearchPattern | null {
  const records = memory.filter((r) => r.status === 'ACTIVE'
    && (r.values.leakageByComponent[component] ?? 0) > 1e-9
    && (subject.type === 'STRATEGY' ? r.strategyId === subject.key
      : subject.type === 'OPPORTUNITY_SERIES' ? r.opportunityId.split('__')[0] === subject.key
      : subject.type === 'OPPORTUNITY_CLASS' ? r.opportunityClass === subject.key
      : subject.type === 'VENUE' ? r.venues.includes(subject.key)
      : true));
  if (records.length < config.patternRecurrenceMinimum) return null;
  return pattern('LEAKAGE', kind, subject, scope, records, config, {
    magnitude: records.reduce((s, r) => s + (r.values.leakageByComponent[component] ?? 0), 0),
  });
}

const LEAKAGE_REPEAT_COMPONENTS: readonly [LeakageComponentName, PatternKind][] = [
  ['SLIPPAGE', 'REPEATED_SLIPPAGE'],
  ['FEES', 'REPEATED_FEES'],
  ['PARTIAL_FILL_LEAKAGE', 'REPEATED_PARTIAL_FILL'],
  ['VENUE_LEAKAGE', 'REPEATED_VENUE_LEAKAGE'],
  ['ALLOCATION_LEAKAGE', 'REPEATED_ALLOCATION_LEAKAGE'],
  ['RISK_CONSTRAINT', 'REPEATED_RISK_CONSTRAINT'],
  ['ADAPTIVE_ACTION_COST', 'REPEATED_CONTROL_LEAKAGE'],
];

export function detectPatterns(
  memory: readonly MemoryRecord[], config: ResearchConfigSpec,
): readonly ResearchPattern[] {
  // Canonical input order: pattern content must not depend on caller ordering.
  const sorted = [...memory].sort((a, b) => memorySortKey(a).localeCompare(memorySortKey(b)));
  const active = sorted.filter((r) => r.status === 'ACTIVE');
  const patterns: ResearchPattern[] = [];
  const series = baseSeriesRecords(active);
  const strategies = groupBy(active, (r) => r.strategyId);
  const classes = groupBy(active, (r) => r.opportunityClass);

  // --- Preservation patterns (per series + per strategy) -------------------
  for (const [key, records] of [...series.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [, seriesKey] = key.split('|');
    const subject: PatternSubject = {type: 'OPPORTUNITY_SERIES', key: seriesKey};
    const ratios = records.map((r) => r.values.preservationRatio).filter((v): v is number => v !== null);
    if (ratios.length >= config.patternRecurrenceMinimum) {
      if (ratios.every((v) => v >= config.highPreservationThreshold)) {
        patterns.push(pattern('PRESERVATION', 'CONSISTENTLY_HIGH_PRESERVATION', subject,
          'series across eras', records, config, {magnitude: Math.min(...ratios)}));
      }
      if (ratios.every((v) => v <= config.lowPreservationThreshold)) {
        patterns.push(pattern('PRESERVATION', 'CONSISTENTLY_LOW_PRESERVATION', subject,
          'series across eras', records, config, {magnitude: Math.max(...ratios)}));
      }
      // Trend patterns: at least trendMinimumEras distinct buckets, all means ≥ 0.
      const eras = eraMeans(records);
      const allMeans = eras.map((e) => e.mean);
      if (eras.length >= config.trendMinimumEras && allMeans.every((m) => m !== null && m >= 0)) {
        const slope = linearSlope(eras);
        if (slope !== null && slope <= -config.deteriorationThreshold) {
          patterns.push(pattern('PRESERVATION', 'PRESERVATION_DETERIORATION', subject,
            'per-era mean preservation', records, config, {direction: 'DETERIORATING', magnitude: slope}));
        }
        if (slope !== null && slope >= config.improvementThreshold) {
          patterns.push(pattern('PRESERVATION', 'PRESERVATION_IMPROVEMENT', subject,
            'per-era mean preservation', records, config, {direction: 'IMPROVING', magnitude: slope}));
        }
      }
      // High theoretical value / poor realization.
      const meanTheoretical = records.reduce((s, r) => s + (r.values.theoreticalNet ?? 0), 0) / records.length;
      const meanRatioValue = ratios.reduce((s, v) => s + v, 0) / ratios.length;
      if (meanTheoretical >= config.highTheoreticalThreshold
        && meanRatioValue <= config.poorRealizationThreshold) {
        patterns.push(pattern('STRATEGY', 'HIGH_THEORETICAL_POOR_REALIZATION', subject,
          'series mean theoretical vs realization', records, config, {magnitude: meanTheoretical}));
      }
    }
  }
  // Strategy-level trends.
  for (const [key, records] of [...strategies.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const subject: PatternSubject = {type: 'STRATEGY', key};
    const eras = eraMeans(records);
    const allMeans = eras.map((e) => e.mean);
    if (eras.length >= config.trendMinimumEras && allMeans.every((m) => m !== null && m >= 0)) {
      const slope = linearSlope(eras);
      if (slope !== null && slope <= -config.deteriorationThreshold) {
        patterns.push(pattern('PRESERVATION', 'PRESERVATION_DETERIORATION', subject,
          'strategy per-era mean preservation', records, config, {direction: 'DETERIORATING', magnitude: slope}));
      }
      if (slope !== null && slope >= config.improvementThreshold) {
        patterns.push(pattern('PRESERVATION', 'PRESERVATION_IMPROVEMENT', subject,
          'strategy per-era mean preservation', records, config, {direction: 'IMPROVING', magnitude: slope}));
      }
    }
  }

  // --- Leakage patterns -----------------------------------------------------
  const leakageSubjects: PatternSubject[] = [
    ...[...strategies.keys()].sort().map((key): PatternSubject => ({type: 'STRATEGY', key})),
    ...[...series.keys()].map((k) => k.split('|')[1]).sort()
      .map((key): PatternSubject => ({type: 'OPPORTUNITY_SERIES', key})),
  ];
  for (const subject of leakageSubjects) {
    for (const [component, kind] of LEAKAGE_REPEAT_COMPONENTS) {
      const detected = leakageRecurred(active, component, kind, subject, config);
      if (detected) patterns.push(detected);
    }
  }

  // --- Venue patterns --------------------------------------------------------
  const venues = new Set<string>();
  for (const record of active) for (const venue of record.venues) venues.add(venue);
  for (const venue of [...venues].sort()) {
    const legs = active.flatMap((r) => r.venueLegs.filter((l) => l.venue === venue)
      .map((l) => ({record: r, leg: l})));
    const venueRecords = legs.map((l) => l.record);
    const totalLeakage = legs.reduce((s, l) => s + (l.leg.leakage ?? 0), 0);
    if (legs.length >= config.patternRecurrenceMinimum && totalLeakage > 1e-6) {
      patterns.push(pattern('VENUE', 'VENUE_SPECIFIC_LEAKAGE', {type: 'VENUE', key: venue},
        'aggregate venue leakage across history', venueRecords, config, {magnitude: totalLeakage}));
    }
    const partialFills = legs.filter((l) => l.leg.fillEfficiency !== null && l.leg.fillEfficiency < 0.999);
    if (partialFills.length >= config.patternRecurrenceMinimum) {
      patterns.push(pattern('VENUE', 'FILL_QUALITY_DEGRADATION', {type: 'VENUE', key: venue},
        'recurring sub-1 fill efficiency', partialFills.map((l) => l.record), config, {
          magnitude: partialFills.length,
        }));
    }
  }
  // Recurring adverse drift: series with repeated SLIPPAGE on one dominant venue.
  for (const [key, records] of [...series.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [, seriesKey] = key.split('|');
    const slipping = records.filter((r) => (r.values.leakageByComponent.SLIPPAGE ?? 0) > 1e-9);
    if (slipping.length >= config.patternRecurrenceMinimum) {
      patterns.push(pattern('VENUE', 'RECURRING_ADVERSE_DRIFT', {type: 'OPPORTUNITY_SERIES', key: seriesKey},
        'repeated slippage across eras', slipping, config,
        {magnitude: slipping.reduce((s, r) => s + (r.values.leakageByComponent.SLIPPAGE ?? 0), 0)}));
    }
  }

  // --- Policy patterns -------------------------------------------------------
  const policies = groupBy(active, (r) => `${r.policyId}@${r.policyVersion}`);
  for (const [key, records] of [...policies.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const subject: PatternSubject = {type: 'POLICY', key};
    const candidateRecords = records.filter((r) => r.values.realizedNet !== null && r.values.realizedNet < 0);
    // Policy improvement without end-to-end improvement: recurring negative
    // realized value under a non-baseline candidate policy.
    if (key.includes('@v1.') && candidateRecords.length >= config.patternRecurrenceMinimum) {
      patterns.push(pattern('POLICY', 'POLICY_IMPROVEMENT_NOT_END_TO_END', subject,
        'candidate policy with recurring negative end-to-end value', candidateRecords, config,
        {magnitude: candidateRecords.reduce((s, r) => s + (r.values.realizedNet ?? 0), 0)}));
    }
    // Policy stability: BASELINE policy spanning ≥ trendMinimumEras buckets
    // with stable preservation. Regression applies to any policy — candidate
    // versions can regress too.
    const eras = eraMeans(records);
    const means = eras.map((e) => e.mean).filter((m): m is number => m !== null);
    if (eras.length >= config.trendMinimumEras && means.length === eras.length) {
      const slope = linearSlope(eras);
      if (!key.includes('@v1.') && slope !== null && Math.abs(slope) < config.policyStabilityBand) {
        patterns.push(pattern('POLICY', 'POLICY_STABILITY', subject,
          'baseline policy preservation stable across eras', records, config,
          {direction: 'STABLE', magnitude: slope}));
      }
      if (slope !== null && slope <= -config.deteriorationThreshold) {
        patterns.push(pattern('POLICY', 'POLICY_REGRESSION', subject,
          'policy preservation regressing across eras', records, config,
          {direction: 'DETERIORATING', magnitude: slope}));
      }
    }
  }

  // --- Failure patterns ------------------------------------------------------
  const failures = groupBy(active.filter((r) => r.values.failureClass !== null), (r) => r.values.failureClass as string);
  for (const [key, records] of [...failures.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (records.length >= config.patternRecurrenceMinimum) {
      const seriesKeys = [...new Set(records.map((r) => r.opportunityId.split('__')[0]))].sort();
      patterns.push(pattern('FAILURE', 'REPEATED_FAILURE_CLASS',
        {type: 'OPPORTUNITY_SERIES', key: seriesKeys.join('+')},
        `failure class ${key} across eras`, records, config, {magnitude: records.length}));
    }
  }

  // Contradiction / fail-closed recurrence is derived from memory.rejected —
  // the engine injects those patterns separately (see engine.ts).

  // Deduplicate by patternId (deterministic).
  const unique = new Map<string, ResearchPattern>();
  for (const p of patterns) unique.set(p.patternId, p);
  return Object.freeze([...unique.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)));
}

export function detectRejectionPatterns(
  rejectedCount: number, contradictoryCount: number, config: ResearchConfigSpec,
  evidence: readonly MemoryRecord[] = [],
): readonly ResearchPattern[] {
  const patterns: ResearchPattern[] = [];
  if (contradictoryCount >= config.patternRecurrenceMinimum) {
    patterns.push(pattern('FAILURE', 'RECURRING_CONTRADICTORY_INPUTS',
      {type: 'OPPORTUNITY_SERIES', key: 'history-ingestion'},
      'contradictory duplicates rejected at ingestion', evidence, config, {magnitude: contradictoryCount}));
  }
  if (rejectedCount >= config.patternRecurrenceMinimum) {
    patterns.push(pattern('FAILURE', 'RECURRING_FAIL_CLOSED',
      {type: 'OPPORTUNITY_SERIES', key: 'history-ingestion'},
      'malformed history rejected at ingestion', evidence, config, {magnitude: rejectedCount}));
  }
  return Object.freeze(patterns);
}

export function strategyCompletionDivergence(
  strategyA: {key: string; completionRate: number | null; meanPreservation: number | null},
  strategyB: {key: string; completionRate: number | null; meanPreservation: number | null},
  evidence: readonly MemoryRecord[], config: ResearchConfigSpec,
): ResearchPattern | null {
  if (evidence.length < config.patternRecurrenceMinimum) return null;
  if (strategyA.completionRate === null || strategyB.completionRate === null
    || strategyA.meanPreservation === null || strategyB.meanPreservation === null) return null;
  if (strategyA.completionRate > strategyB.completionRate
    && strategyA.meanPreservation < strategyB.meanPreservation) {
    return pattern('STRATEGY', 'COMPLETION_PRESERVATION_DIVERGENCE',
      {type: 'STRATEGY', key: strategyA.key},
      `${strategyA.key} completes more yet preserves less than ${strategyB.key}`,
      evidence, config, {
        magnitude: strategyB.meanPreservation - strategyA.meanPreservation,
      });
  }
  return null;
}

export function consistentOutperformance(
  winnerKey: string, eraWins: number, totalEras: number, evidence: readonly MemoryRecord[],
  config: ResearchConfigSpec,
): ResearchPattern | null {
  if (eraWins < config.trendMinimumEras || eraWins < totalEras) return null;
  return pattern('STRATEGY', 'CONSISTENT_OUTPERFORMANCE', {type: 'STRATEGY', key: winnerKey},
    `won the preservation comparison in all ${eraWins} of ${totalEras} eras`,
    evidence, config, {magnitude: eraWins});
}
