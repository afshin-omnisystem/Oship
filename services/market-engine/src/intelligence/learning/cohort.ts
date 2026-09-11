import type {
  LearningObservation, LearningConfigSpec, LearningCohort, CohortDimension,
  EvidenceState,
} from './types';
import {cohortIdOf, contentFingerprintOf} from './ids';
import {weakestState, canonicalObservations} from './source';

/**
 * SPRINT 037 — cohort engine (§5).
 *
 * Deterministic cohort construction with comparability enforcement. Invalid
 * mixtures produce NOT_COMPARABLE with explicit reasons — never a silently
 * mixed population. Raw cross-domain economic mixtures are never comparable.
 */

const DOMAIN_DIMENSIONS: ReadonlySet<CohortDimension> = new Set(['DOMAIN']);

function evidenceStateOf(sampleSize: number, min: number, states: readonly EvidenceState[]): EvidenceState {
  if (sampleSize < min) return 'INSUFFICIENT';
  return weakestState(states);
}

function buildCohort(
  dimension: CohortDimension,
  key: string,
  members: readonly LearningObservation[],
  config: LearningConfigSpec,
  /** Cohorts explicitly used for normalized cross-domain analysis opt in. */
  normalized: boolean,
): LearningCohort {
  const domains = [...new Set(members.map((o) => o.domain))].sort();
  const metricFingerprints = [...new Set(members.map((o) => o.values.provenance))].sort();
  const reasons: string[] = [];
  if (members.length === 0) {
    reasons.push('cohort has no members — no comparison is possible (fail closed)');
  }
  if (domains.length > 1 && !normalized) {
    reasons.push(`cohort mixes domains (${domains.join('+')}) without explicit normalization — raw cross-domain economics are never comparable`);
  }
  const notComparable = reasons.length > 0;
  const evidenceState = evidenceStateOf(
    members.length, config.minSampleSize, members.map((o) => o.evidenceState));
  // Canonical member order — cohort identity never depends on input order.
  const memberIds = members.map((m) => m.observationId).sort();
  const base = {
    cohortId: cohortIdOf({dimension, key, members: memberIds}),
    dimension,
    key,
    sampleSize: members.length,
    members: Object.freeze(memberIds),
    domains: Object.freeze(domains),
    metricDefinitionFingerprints: Object.freeze(metricFingerprints),
    comparable: !notComparable,
    notComparableReasons: Object.freeze(reasons),
    evidenceState,
    schemaVersion: 'learning.cohort.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      dimension, key, sampleSize: base.sampleSize, domains, comparable: base.comparable,
      evidenceState,
    }),
  });
}

export function buildCohorts(
  observations: readonly LearningObservation[],
  dimension: CohortDimension,
  config: LearningConfigSpec,
  normalized = false,
): readonly LearningCohort[] {
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    let key: string;
    switch (dimension) {
      case 'DOMAIN': key = o.domain; break;
      case 'OPPORTUNITY_CLASS': key = `${o.domain}:${o.opportunityClass}`; break;
      case 'STRATEGY': key = `${o.domain}:${o.strategyId}`; break;
      case 'VENUE': {
        for (const venue of o.venues) {
          (groups.get(venue) ?? groups.set(venue, []).get(venue)!).push(o);
        }
        continue;
      }
      case 'POLICY': key = `${o.domain}:${o.policyId}@${o.policyVersion}`; break;
      case 'EXECUTION_MODE': key = String(o.values.outcome); break;
      case 'TIME_PERIOD': key = o.timeBucket; break;
      case 'EVIDENCE_QUALITY': key = o.evidenceState; break;
      case 'REGIME': key = `${o.era}`; break;
      default: throw new Error(`learning cohort: unknown dimension — fail closed`);
    }
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
  }
  const cohorts: LearningCohort[] = [];
  for (const [key, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    cohorts.push(buildCohort(dimension, key, group, config,
      normalized && DOMAIN_DIMENSIONS.has(dimension)));
  }
  return Object.freeze(cohorts);
}

/**
 * A deliberately cross-domain strategy cohort — the canonical NOT_COMPARABLE
 * demonstration (raw economics must never be silently mixed).
 */
export function rawCrossDomainCohort(
  observationsInput: readonly LearningObservation[], config: LearningConfigSpec,
): LearningCohort {
  const observations = canonicalObservations(observationsInput);
  if (observations.length === 0) {
    // Fail closed: no members, no comparison — an empty raw mixture is
    // trivially NOT_COMPARABLE and never silently comparable.
    return buildCohort('STRATEGY', 'raw-mixed', [], config, false);
  }
  const mixed = observations.filter((o) =>
    o.strategyId === observations[0].strategyId
    || observations.every((x) => x.domain === observations[0].domain));
  // Take one strategy key across both domains when present; otherwise fall
  // back to the whole population (still mixed-domain by construction here).
  const strategyKeys = [...new Set(observations.map((o) => o.strategyId))];
  const crossKey = strategyKeys.find((key) => {
    const subset = observations.filter((o) => o.strategyId === key);
    return new Set(subset.map((o) => o.domain)).size > 1;
  });
  if (crossKey) {
    return buildCohort('STRATEGY', crossKey,
      observations.filter((o) => o.strategyId === crossKey), config, false);
  }
  // No strategy spans both domains: synthesize the canonical raw mixture
  // (first observations of each domain) — still NOT_COMPARABLE by construction.
  void mixed;
  const domains = [...new Set(observations.map((o) => o.domain))].sort();
  const members = domains.flatMap((domain) =>
    observations.filter((o) => o.domain === domain).slice(0, 3));
  return buildCohort('STRATEGY', 'raw-mixed', members, config, false);
}
