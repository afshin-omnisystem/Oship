import type {
  LearningObservation, LearningConfigSpec, PolicyLearning, PolicyClassification,
  StabilityAssessment, EvidenceState,
} from './types';
import {policyLearningIdOf, contentFingerprintOf} from './ids';
import {meanOf, slopeOf, honest, weakestState, canonicalObservations} from './source';

/**
 * SPRINT 037 — policy learning (§10).
 *
 * Historical policy-version analysis: baseline vs candidate under a
 * comparable peer cohort (same domain, strategy and opportunity class under
 * the baseline policy). Explicitly detects the Sprint 034 class of failure —
 * execution-quality improvement WITHOUT end-to-end value improvement. A
 * candidate NEVER becomes ACTIVE here: promotion is outside this engine and
 * every candidate record carries `promotion: 'OUTSIDE_ENGINE'`.
 */

export function peerPopulationOf(
  candidate: readonly LearningObservation[],
  all: readonly LearningObservation[],
): readonly LearningObservation[] {
  // The candidate's comparable peers: same domain + strategy + class under a
  // DIFFERENT policy version. Deterministic and comparable by construction.
  if (candidate.length === 0) return [];
  const reference = candidate[0];
  return all.filter((o) => o.domain === reference.domain
    && o.strategyId === reference.strategyId
    && o.opportunityClass === reference.opportunityClass
    && o.policyVersion !== reference.policyVersion);
}

export function classifyPolicy(
  role: 'BASELINE' | 'CANDIDATE',
  sampleSize: number,
  executionQualityDelta: number | null,
  preservationDelta: number | null,
  baselineTrend: number | null,
  config: LearningConfigSpec,
): {classification: PolicyClassification; reasons: string[]} {
  const reasons: string[] = [];
  if (sampleSize < config.minSampleSize) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: [`sample ${sampleSize} below minimum ${config.minSampleSize}`]};
  }
  if (role === 'BASELINE') {
    if (baselineTrend === null) {
      return {classification: 'INSUFFICIENT_EVIDENCE',
        reasons: ['baseline trend not measurable']};
    }
    if (Math.abs(baselineTrend) <= config.driftBand) {
      reasons.push(`baseline preservation trend ${baselineTrend.toFixed(4)} within stability band ${config.driftBand}`);
      return {classification: 'STABLE_BASELINE', reasons};
    }
    reasons.push(`baseline preservation trend ${baselineTrend.toFixed(4)} outside stability band — stability cannot be claimed`);
    return {classification: 'INSUFFICIENT_EVIDENCE', reasons};
  }
  if (executionQualityDelta === null || preservationDelta === null) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: ['deltas not measurable against the comparable peer cohort']};
  }
  if (executionQualityDelta > 0 && preservationDelta < -config.policyDivergenceBand) {
    reasons.push(`execution quality ${executionQualityDelta > 0 ? '+' : ''}${executionQualityDelta.toFixed(4)} vs peers while end-to-end preservation ${preservationDelta.toFixed(4)} < -${config.policyDivergenceBand}`);
    reasons.push('execution-quality improvement does NOT equal end-to-end value improvement (Sprint 034 class of failure)');
    return {classification: 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END', reasons};
  }
  if (preservationDelta < -config.policyDivergenceBand) {
    reasons.push(`end-to-end preservation ${preservationDelta.toFixed(4)} below -${config.policyDivergenceBand} without execution-quality improvement`);
    return {classification: 'CANDIDATE_REGRESSION', reasons};
  }
  if (preservationDelta > config.policyDivergenceBand && executionQualityDelta >= 0) {
    reasons.push(`end-to-end preservation ${preservationDelta.toFixed(4)} above ${config.policyDivergenceBand} with execution quality not degraded`);
    return {classification: 'CANDIDATE_IMPROVES_END_TO_END', reasons};
  }
  reasons.push('no significant divergence measured against the comparable peer cohort');
  return {classification: 'INSUFFICIENT_EVIDENCE', reasons};
}

export interface PolicyLearningInputs {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly population: readonly LearningObservation[];
  readonly all: readonly LearningObservation[];
  readonly stability: StabilityAssessment;
}

export function learnPolicy(
  inputs: PolicyLearningInputs, config: LearningConfigSpec,
): PolicyLearning {
  const population = canonicalObservations(inputs.population);
  const all = canonicalObservations(inputs.all);
  const versions = [...new Set(all.map((o) => o.policyVersion))].sort();
  const isBaseline = inputs.policyVersion === versions[0];
  const role: 'BASELINE' | 'CANDIDATE' = isBaseline ? 'BASELINE' : 'CANDIDATE';
  const executionQuality = honest(meanOf(population.map((o) => o.values.executionQuality)));
  const endToEndPreservation = honest(meanOf(population.map((o) => o.values.preservationRatio)));
  const leakage = honest(meanOf(population.map((o) => o.values.totalLeakage)));

  const peers = peerPopulationOf(population, all);
  const peerExecution = honest(meanOf(peers.map((o) => o.values.executionQuality)));
  const peerPreservation = honest(meanOf(peers.map((o) => o.values.preservationRatio)));
  const peerLeakage = honest(meanOf(peers.map((o) => o.values.totalLeakage)));
  const deltaVsBaseline = role === 'CANDIDATE' && peers.length >= config.minComparativeSample
    ? Object.freeze({
      executionQuality: honest(executionQuality !== null && peerExecution !== null
        ? executionQuality - peerExecution : null),
      endToEndPreservation: honest(endToEndPreservation !== null && peerPreservation !== null
        ? endToEndPreservation - peerPreservation : null),
      leakage: honest(leakage !== null && peerLeakage !== null ? leakage - peerLeakage : null),
    })
    : null;

  const buckets = [...new Set(population.map((o) => o.timeBucket))].sort();
  const baselineTrend = honest(slopeOf(buckets.map(
    (b) => meanOf(population.filter((o) => o.timeBucket === b)
      .map((o) => o.values.preservationRatio)))));

  const {classification, reasons} = classifyPolicy(
    role, population.length,
    deltaVsBaseline?.executionQuality ?? null,
    deltaVsBaseline?.endToEndPreservation ?? null,
    baselineTrend, config);

  const evidenceState: EvidenceState = population.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(population.map((o) => o.evidenceState));
  const base = {
    learningId: policyLearningIdOf({
      policy: `${inputs.policyId}@${inputs.policyVersion}`, role, classification,
      sampleSize: population.length,
    }),
    policyId: inputs.policyId,
    policyVersion: inputs.policyVersion,
    role,
    sampleSize: population.length,
    executionQuality,
    endToEndPreservation,
    leakage,
    deltaVsBaseline,
    classification,
    reasons: Object.freeze(reasons),
    stability: inputs.stability.classification,
    promotion: 'OUTSIDE_ENGINE' as const,
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.policy.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(population.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      policy: base.policyVersion, role, classification,
      executionQuality, endToEndPreservation, deltaVsBaseline,
    }),
  });
}
