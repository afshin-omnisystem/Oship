import type {
  LearningObservation, LearningConfigSpec, StrategyLearning, StrategyClassification,
  LearningBaseline, StabilityAssessment, EvidenceState, OpportunityDomain,
} from './types';
import {learningResultIdOf, contentFingerprintOf} from './ids';
import {meanOf, honest, weakestState, canonicalObservations} from './source';
import {subjectBaseline, deltaAgainstBaseline} from './baseline';
import {assessStability} from './stability';
import type {FeatureVector} from './types';

/**
 * SPRINT 037 — strategy learning (§7).
 *
 * Analytical per-strategy learning. Completion is NEVER treated as equivalent
 * to profitability/preservation: they are separate metrics and the record
 * carries the explicit marker `completionIsNotPreservation: true`.
 * Classification precedence (deterministic):
 *   INSUFFICIENT_EVIDENCE → NOT_COMPARABLE → HIGH_THEORETICAL_LOW_REALIZATION
 *   → CONSISTENT_OUTPERFORMER → CONSISTENT_UNDERPERFORMER → IMPROVING
 *   → DETERIORATING → STABLE.
 */

export function classifyStrategy(
  vector: FeatureVector,
  domainBaseline: LearningBaseline,
  contradicted: boolean,
  config: LearningConfigSpec,
  theoreticalMean: number | null,
): {classification: StrategyClassification; reasons: string[]} {
  const reasons: string[] = [];
  const m = vector.strategy;
  if (vector.sampleSize < config.minSampleSize) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: [`sample ${vector.sampleSize} below minimum ${config.minSampleSize}`]};
  }
  if (vector.domain === 'MIXED') {
    return {classification: 'NOT_COMPARABLE',
      reasons: ['strategy key spans multiple domains — raw cross-domain economics are never comparable']};
  }
  const meanPreservation = m.preservation;
  const trend = m.trend;
  const baselineMean = domainBaseline.meanValue;
  const eraMeans: readonly (number | null)[] = vector.eraBreakdown.map(
    (e: {meanPreservation: number | null}) => e.meanPreservation);
  // Baseline means are rounded to 3 decimals for output; comparisons use an
  // epsilon of half a rounding unit so rounded-equal values never claim
  // outperformance (honesty over precision artifacts).
  const epsilon = 5e-4;
  const beatsBaselineEveryEra = baselineMean !== null
    && eraMeans.every((v: number | null) => v !== null && v > baselineMean + epsilon);
  const belowBaselineEveryEra = baselineMean !== null
    && eraMeans.every((v: number | null) => v !== null && v < baselineMean - epsilon);

  if (contradicted) {
    reasons.push('research-level evidence contradicted for this strategy');
  }
  if (theoreticalMean !== null && theoreticalMean >= config.highTheoreticalThreshold
    && meanPreservation !== null && meanPreservation < config.poorRealizationThreshold) {
    reasons.push(`mean theoretical ${theoreticalMean.toFixed(3)} ≥ ${config.highTheoreticalThreshold} while preservation ${meanPreservation.toFixed(3)} < ${config.poorRealizationThreshold}`);
    return {classification: 'HIGH_THEORETICAL_LOW_REALIZATION', reasons};
  }
  if (beatsBaselineEveryEra) {
    reasons.push(`mean preservation above the ${domainBaseline.scopeDomain} baseline in every era (baseline ${baselineMean!.toFixed(3)})`);
    if (trend !== null && trend > config.improvementSlopeThreshold) {
      reasons.push(`improving trend ${trend.toFixed(4)} per era`);
    }
    return {classification: 'CONSISTENT_OUTPERFORMER', reasons};
  }
  if (belowBaselineEveryEra) {
    reasons.push(`mean preservation below the ${domainBaseline.scopeDomain} baseline in every era (baseline ${baselineMean!.toFixed(3)})`);
    if (trend !== null && trend < config.deteriorationSlopeThreshold) {
      reasons.push(`deteriorating trend ${trend.toFixed(4)} per era`);
    }
    return {classification: 'CONSISTENT_UNDERPERFORMER', reasons};
  }
  if (trend !== null && trend > config.improvementSlopeThreshold) {
    reasons.push(`improving trend ${trend.toFixed(4)} per era exceeds ${config.improvementSlopeThreshold}`);
    return {classification: 'IMPROVING', reasons};
  }
  if (trend !== null && trend < config.deteriorationSlopeThreshold) {
    reasons.push(`deteriorating trend ${trend.toFixed(4)} per era below ${config.deteriorationSlopeThreshold}`);
    return {classification: 'DETERIORATING', reasons};
  }
  reasons.push(`trend within stability bands (slope ${trend === null ? 'unavailable' : trend.toFixed(4)})`);
  return {classification: 'STABLE', reasons};
}

export interface StrategyLearningInputs {
  readonly vector: FeatureVector;
  readonly observations: readonly LearningObservation[];
  readonly domainBaseline: LearningBaseline;
  readonly stability: StabilityAssessment;
  readonly contradicted: boolean;
}

export function learnStrategy(
  inputs: StrategyLearningInputs, config: LearningConfigSpec,
): StrategyLearning {
  const vector = inputs.vector;
  const observations = canonicalObservations(inputs.observations);
  const {classification, reasons} = classifyStrategy(
    vector, inputs.domainBaseline, inputs.contradicted, config,
    meanTheoreticalOf(observations));
  const domain: OpportunityDomain | 'MIXED' = vector.domain;
  const evidenceState: EvidenceState = vector.sampleSize < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(observations.map((o) => o.evidenceState));
  const baselineDelta = deltaAgainstBaseline(
    vector.strategy.preservation, inputs.domainBaseline);
  const base = {
    learningId: learningResultIdOf({
      strategy: vector.subject.key, domain, classification, sampleSize: vector.sampleSize,
    }),
    strategyId: vector.subject.key,
    domain,
    sampleSize: vector.sampleSize,
    metrics: vector.strategy,
    stability: inputs.stability.classification,
    classification,
    reasons: Object.freeze(reasons),
    baseline: inputs.domainBaseline,
    baselineDelta,
    completionIsNotPreservation: true as const,
    evidenceState,
    provenance: vector.provenance,
    schemaVersion: 'learning.strategy.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(observations.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      strategy: base.strategyId, classification, metrics: base.metrics,
      stability: base.stability, baselineDelta,
    }),
  });
}

export function domainBaselineFor(
  domain: OpportunityDomain,
  observations: readonly LearningObservation[],
  config: LearningConfigSpec,
): LearningBaseline {
  const population = observations.filter((o) => o.domain === domain);
  return subjectBaseline('HISTORICAL',
    {kind: 'DOMAIN', key: domain}, 'preservation', population, config);
}

export function meanTheoreticalOf(
  observations: readonly LearningObservation[],
): number | null {
  return honest(meanOf(
    canonicalObservations(observations).map((o) => o.values.theoreticalNet)));
}
