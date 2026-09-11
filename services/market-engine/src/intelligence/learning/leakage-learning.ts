import type {
  LearningObservation, LearningConfigSpec, LeakageLearning, EvidenceState,
  OpportunityDomain, LeakageComponentName,
} from './types';
import {leakageLearningIdOf, contentFingerprintOf} from './ids';
import {meanOf, slopeOf, honest, weakestState, canonicalObservations} from './source';

/**
 * SPRINT 037 — leakage learning (§11 leakage intelligence).
 *
 * Per-component recurrence analysis: which leakage components recur, how
 * much they cost, at what rate, with what trend, and which subjects
 * dominate them. Every fact is evidence-backed and deterministic; components
 * below the sample floor are INSUFFICIENT, never silently omitted.
 */

const ALL_COMPONENTS: readonly LeakageComponentName[] = Object.freeze([
  'SPREAD_COST', 'SLIPPAGE', 'FEES', 'MARKET_IMPACT', 'LATENCY_COST',
  'PARTIAL_FILL_LEAKAGE', 'ADAPTIVE_ACTION_COST', 'REROUTE_COST' as LeakageComponentName,
  'REPRICE_COST' as LeakageComponentName, 'RESLICE_COST' as LeakageComponentName,
  'REPLAN_COST', 'FAILURE_RECOVERY_COST', 'COMPLETION_DELAY',
  'OPPORTUNITY_DECAY', 'STALE_INFORMATION', 'STRATEGY_LEAKAGE',
  'ALLOCATION_LEAKAGE', 'RISK_CONSTRAINT', 'VENUE_LEAKAGE',
  'RESIDUAL_UNATTRIBUTED', 'ADVERSE_MOVEMENT' as LeakageComponentName,
]);

export function componentsOf(
  observations: readonly LearningObservation[],
): readonly LeakageComponentName[] {
  const present = new Set<LeakageComponentName>();
  for (const o of observations) {
    for (const key of Object.keys(o.values.leakageByComponent) as LeakageComponentName[]) {
      present.add(key);
    }
  }
  return Object.freeze([...present].sort());
}

export function learnLeakageComponent(
  component: LeakageComponentName,
  domain: OpportunityDomain | 'MIXED',
  populationInput: readonly LearningObservation[],
  config: LearningConfigSpec,
): LeakageLearning {
  const population = canonicalObservations(populationInput);
  const bearing = population.filter(
    (o) => (o.values.leakageByComponent[component] ?? 0) > 0);
  const totalValue = honest(bearing.reduce(
    (s, o) => s + o.values.leakageByComponent[component], 0)) ?? 0;
  const buckets = [...new Set(population.map((o) => o.timeBucket))].sort();
  const perEraTotal = buckets.map((b) => population
    .filter((o) => o.timeBucket === b)
    .reduce((s, o) => s + o.values.leakageByComponent[component], 0));
  const trend = slopeOf(perEraTotal);
  const strategyTotals = new Map<string, number>();
  for (const o of bearing) {
    strategyTotals.set(o.strategyId,
      (strategyTotals.get(o.strategyId) ?? 0) + o.values.leakageByComponent[component]);
  }
  const dominantSubjects = [...strategyTotals.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([key]) => key);
  const evidenceState: EvidenceState = bearing.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(bearing.map((o) => o.evidenceState));
  const base = {
    learningId: leakageLearningIdOf({
      component, domain, occurrences: bearing.length, totalValue,
    }),
    component,
    domain,
    occurrences: bearing.length,
    totalValue,
    meanPerOccurrence: bearing.length > 0 ? honest(totalValue / bearing.length) : null,
    recurrenceRate: population.length > 0 ? honest(bearing.length / population.length) : null,
    trend: honest(trend),
    dominantSubjects: Object.freeze(dominantSubjects),
    sampleSize: population.length,
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.leakage.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(bearing.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      component, occurrences: base.occurrences, totalValue, trend,
      dominantSubjects,
    }),
  });
}

export function learnLeakage(
  observationsInput: readonly LearningObservation[],
  config: LearningConfigSpec,
): readonly LeakageLearning[] {
  const observations = canonicalObservations(observationsInput);
  const domains = [...new Set(observations.map((o) => o.domain))].sort();
  const results: LeakageLearning[] = [];
  for (const domain of domains) {
    const population = observations.filter((o) => o.domain === domain);
    for (const component of componentsOf(population)) {
      results.push(learnLeakageComponent(component, domain, population, config));
    }
  }
  results.sort((a, b) => (a.learningId < b.learningId ? -1 : a.learningId > b.learningId ? 1 : 0));
  return Object.freeze(results);
}

export function allKnownComponents(): readonly LeakageComponentName[] {
  return ALL_COMPONENTS;
}

export function meanOfPresent(
  values: readonly (number | null)[],
): number | null {
  return meanOf(values);
}
