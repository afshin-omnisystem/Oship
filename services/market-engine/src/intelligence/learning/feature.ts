import type {
  LearningObservation, LearningFeatureSet, LearningSubject, LearningConfigSpec,
  OpportunityFeatures, ExecutionFeatures, ControlFeatures, VenueLegFeatures,
} from './types';
import {featureIdOf, contentFingerprintOf} from './ids';
import {meanOf} from './source';

/**
 * SPRINT 037 — feature engine (§4).
 *
 * Deterministic, versioned, provenance-aware, fingerprinted analytical
 * features per learning observation. Features never invent values: UNAVAILABLE
 * inputs stay null, division by zero is impossible (guarded denominators) and
 * every feature set carries the provenance of its source observation.
 */

export function opportunityFeaturesOf(o: LearningObservation): OpportunityFeatures {
  const v = o.values;
  return Object.freeze({
    theoreticalEdge: v.theoreticalNet,
    realizedEdge: v.realizedNet,
    preservationRatio: v.preservationRatio,
    opportunityClass: o.opportunityClass,
    freshness: v.freshness,
    opportunitySize: v.capitalScale,
    evidenceQuality: o.evidenceConfidence,
  });
}

export function executionFeaturesOf(o: LearningObservation): ExecutionFeatures {
  const v = o.values;
  const fillEfficiency = meanOf(o.venueLegs.map((l) => l.fillEfficiency));
  const theoreticalGross = v.theoreticalGross;
  const partialFillRatio = theoreticalGross !== null && theoreticalGross > 0
    ? v.leakageByComponent.PARTIAL_FILL_LEAKAGE / theoreticalGross
    : null;
  return Object.freeze({
    fillEfficiency,
    slippage: v.leakageByComponent.SLIPPAGE,
    fees: v.leakageByComponent.FEES,
    impact: v.leakageByComponent.MARKET_IMPACT,
    latency: v.leakageByComponent.LATENCY_COST,
    partialFillRatio,
    failureRate: v.outcome === 'FAILED' ? 1 : 0,
    completionStatus: v.outcome,
  });
}

export function controlFeaturesOf(o: LearningObservation): ControlFeatures {
  const v = o.values;
  return Object.freeze({
    adaptiveActionFrequency: v.adaptiveActions,
    repriceRate: v.repriceCount > 0 ? 1 : 0,
    resliceRate: v.resliceCount > 0 ? 1 : 0,
    rerouteRate: v.rerouteCount > 0 ? 1 : 0,
    // The normalized memory carries reprice/reslice/reroute counters; a replan
    // is evidenced honestly by a non-zero REPLAN_COST leakage component.
    replanRate: v.leakageByComponent.REPLAN_COST > 0 ? 1 : 0,
    abortRate: v.outcome === 'ABORTED' ? 1 : 0,
    completionRate: v.outcome === 'COMPLETED' ? 1 : 0,
  });
}

export function venueLegFeaturesOf(o: LearningObservation): readonly VenueLegFeatures[] {
  return Object.freeze(o.venueLegs.map((leg) => Object.freeze({
    venue: leg.venue,
    side: leg.side,
    fillEfficiency: leg.fillEfficiency,
    leakage: leg.leakage,
    // Adverse drift indicator: a side-normalized negative realized venue result.
    adverseDrift: leg.venueResult !== null && leg.venueResult < 0 ? 1 : 0,
  })));
}

export function buildFeatureSet(
  o: LearningObservation, config: LearningConfigSpec,
): LearningFeatureSet {
  const subject: LearningSubject = Object.freeze({
    kind: 'OPPORTUNITY_SERIES', key: o.opportunityId,
  });
  const opportunity = opportunityFeaturesOf(o);
  const execution = executionFeaturesOf(o);
  const control = controlFeaturesOf(o);
  const venueLegs = venueLegFeaturesOf(o);
  const base: Omit<LearningFeatureSet, 'contentFingerprint'> = {
    featureId: featureIdOf({observationId: o.observationId, schema: 'learning.feature.v1'}),
    observationId: o.observationId,
    subject,
    opportunity,
    execution,
    control,
    venueLegs,
    provenance: o.provenance,
    schemaVersion: 'learning.feature.v1',
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      observationId: o.observationId, opportunity, execution, control, venueLegs,
      provenance: o.provenance,
    }),
  });
}

export function buildFeatureSets(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly LearningFeatureSet[] {
  const features = observations.map((o) => buildFeatureSet(o, config));
  features.sort((a, b) => (a.featureId < b.featureId ? -1 : 1));
  return Object.freeze(features);
}
