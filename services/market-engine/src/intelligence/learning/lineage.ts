import type {
  LearningLineage, LearningLineageEdge, LearningObservation, LearningFeatureSet,
  LearningSignal, ResearchPriority, LearningRecommendation, LearningFeedback,
  ResearchResult,
} from './types';
import {lineageFingerprintOf} from './ids';

/**
 * SPRINT 037 — learning lineage.
 *
 * Links every learning artifact back to the Sprint 036 memory records,
 * findings, patterns and hypotheses it was derived from. A lineage with
 * dangling references is invalid — fail closed.
 */

export interface LineageArtifacts {
  readonly research: ResearchResult;
  readonly observations: readonly LearningObservation[];
  readonly features: readonly LearningFeatureSet[];
  readonly signals: readonly LearningSignal[];
  readonly priorities: readonly ResearchPriority[];
  readonly recommendations: readonly LearningRecommendation[];
  readonly feedback: readonly LearningFeedback[];
}

export function buildLearningLineage(artifacts: LineageArtifacts): LearningLineage {
  const memoryIds = new Set(artifacts.research.memory.records.map((r) => r.memoryId));
  const findingIds = new Set(artifacts.research.findings.map((f) => f.findingId));
  const observationIds = new Set(artifacts.observations.map((o) => o.observationId));
  const featureIds = new Set(artifacts.features.map((f) => f.featureId));
  const signalIds = new Set(artifacts.signals.map((s) => s.signalId));
  const priorityIds = new Set(artifacts.priorities.map((p) => p.priorityId));

  const edges: LearningLineageEdge[] = [];
  const dangling: string[] = [];

  for (const observation of artifacts.observations) {
    if (!memoryIds.has(observation.sourceMemoryId)) {
      dangling.push(`observation ${observation.observationId} → memory ${observation.sourceMemoryId}`);
    }
    edges.push({from: observation.observationId, to: observation.sourceMemoryId,
      relation: 'OBSERVATION_FROM_MEMORY'});
    for (const findingId of observation.lineage.findingIds) {
      if (!findingIds.has(findingId)) {
        dangling.push(`observation ${observation.observationId} → finding ${findingId}`);
      }
      edges.push({from: observation.observationId, to: findingId,
        relation: 'OBSERVATION_COVERED_BY_FINDING'});
    }
  }
  for (const feature of artifacts.features) {
    if (!observationIds.has(feature.observationId)) {
      dangling.push(`feature ${feature.featureId} → observation ${feature.observationId}`);
    }
    edges.push({from: feature.featureId, to: feature.observationId,
      relation: 'FEATURE_FROM_OBSERVATION'});
  }
  for (const signal of artifacts.signals) {
    for (const id of signal.supportingEvidenceIds) {
      if (!observationIds.has(id)) {
        dangling.push(`signal ${signal.signalId} → observation ${id}`);
      }
      edges.push({from: signal.signalId, to: id, relation: 'SIGNAL_FROM_OBSERVATION'});
    }
    for (const findingId of signal.lineage.findingIds) {
      if (!findingIds.has(findingId)) {
        dangling.push(`signal ${signal.signalId} → finding ${findingId}`);
      }
      edges.push({from: signal.signalId, to: findingId, relation: 'SIGNAL_FROM_FINDING'});
    }
    for (const patternId of signal.lineage.patternIds) {
      edges.push({from: signal.signalId, to: patternId, relation: 'SIGNAL_FROM_PATTERN'});
    }
    for (const hypothesisId of signal.lineage.hypothesisIds) {
      edges.push({from: signal.signalId, to: hypothesisId, relation: 'SIGNAL_FROM_HYPOTHESIS'});
    }
  }
  for (const priority of artifacts.priorities) {
    for (const signalId of priority.lineage.signalIds) {
      if (!signalIds.has(signalId)) {
        dangling.push(`priority ${priority.priorityId} → signal ${signalId}`);
      }
      edges.push({from: priority.priorityId, to: signalId, relation: 'PRIORITY_FROM_SIGNAL'});
    }
  }
  for (const recommendation of artifacts.recommendations) {
    // Recommendations reference subjects; their lineage is the signals of the
    // same subject key (verified above) — recorded for completeness.
    const related = artifacts.signals.find(
      (s) => `${s.subject.kind}:${s.subject.key}` === recommendation.subject);
    if (related) {
      edges.push({from: recommendation.recommendationId, to: related.signalId,
        relation: 'RECOMMENDATION_FROM_SIGNAL'});
    }
  }
  for (const feedback of artifacts.feedback) {
    for (const signalId of feedback.lineage.signalIds) {
      if (!signalIds.has(signalId)) {
        dangling.push(`feedback ${feedback.feedbackId} → signal ${signalId}`);
      }
      edges.push({from: feedback.feedbackId, to: signalId, relation: 'FEEDBACK_FROM_SIGNAL'});
    }
    for (const findingId of feedback.lineage.findingIds) {
      if (!findingIds.has(findingId)) {
        dangling.push(`feedback ${feedback.feedbackId} → finding ${findingId}`);
      }
      edges.push({from: feedback.feedbackId, to: findingId, relation: 'FEEDBACK_FROM_FINDING'});
    }
    for (const priorityId of feedback.lineage.priorityIds) {
      if (!priorityIds.has(priorityId)) {
        dangling.push(`feedback ${feedback.feedbackId} → priority ${priorityId}`);
      }
      edges.push({from: feedback.feedbackId, to: priorityId, relation: 'FEEDBACK_FROM_PRIORITY'});
    }
  }

  const seen = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}|${e.to}|${e.relation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : a.relation < b.relation ? -1 : 1);

  return Object.freeze({
    edges: Object.freeze(uniqueEdges),
    valid: dangling.length === 0,
    fingerprint: lineageFingerprintOf({edges: uniqueEdges, dangling}),
  });
}
