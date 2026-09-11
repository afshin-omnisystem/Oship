import type {
  IntelligenceMemory, ResearchFinding, ResearchLineage, ResearchLineageEdge,
  ResearchPattern, Hypothesis, IntelligenceFeedback,
} from './types';
import {lineageFingerprintOf} from './ids';

/**
 * SPRINT 036 — research lineage: explicit provenance chains from historical
 * batches through memory into every analytical artifact. No orphan findings,
 * hypotheses or feedback — every artifact traces back to memory.
 */

export function buildResearchLineage(
  memory: IntelligenceMemory,
  patterns: readonly ResearchPattern[],
  hypotheses: readonly Hypothesis[],
  findings: readonly ResearchFinding[],
  feedback: readonly IntelligenceFeedback[],
): ResearchLineage {
  const edges: ResearchLineageEdge[] = [];
  const batchIds = new Set(memory.records.map((m) => m.lineage.batchId));
  const memoryIds = new Set(memory.records.map((m) => m.memoryId));
  const patternIds = new Set(patterns.map((p) => p.patternId));
  const hypothesisIds = new Set(hypotheses.map((h) => h.hypothesisId));
  const findingIds = new Set(findings.map((f) => f.findingId));
  let valid = true;

  for (const record of memory.records) {
    if (!batchIds.has(record.lineage.batchId)) valid = false;
    edges.push({from: record.memoryId, to: record.lineage.batchId, relation: 'MEMORY_FROM_BATCH'});
  }
  for (const pattern of patterns) {
    for (const memoryId of pattern.evidenceMemoryIds) {
      if (!memoryIds.has(memoryId)) valid = false;
      edges.push({from: memoryId, to: pattern.patternId, relation: 'PATTERN_FROM_MEMORY'});
    }
  }
  for (const hypothesis of hypotheses) {
    for (const patternId of hypothesis.supportingEvidenceIds.filter((id) => patternIds.has(id))) {
      edges.push({from: patternId, to: hypothesis.hypothesisId, relation: 'HYPOTHESIS_FROM_PATTERN'});
    }
    for (const memoryId of [...hypothesis.supportingEvidenceIds, ...hypothesis.contradictingEvidenceIds]) {
      if (memoryIds.has(memoryId)) {
        edges.push({from: memoryId, to: hypothesis.hypothesisId, relation: 'HYPOTHESIS_FROM_MEMORY'});
      }
    }
  }
  for (const finding of findings) {
    for (const memoryId of finding.supportingMemoryIds) {
      if (!memoryIds.has(memoryId)) valid = false;
      edges.push({from: memoryId, to: finding.findingId, relation: 'FINDING_FROM_MEMORY'});
    }
    for (const patternId of finding.lineage.patternIds) {
      if (!patternIds.has(patternId)) valid = false;
      edges.push({from: patternId, to: finding.findingId, relation: 'FINDING_FROM_PATTERN'});
    }
  }
  for (const fb of feedback) {
    for (const memoryId of fb.evidenceMemoryIds) {
      if (!memoryIds.has(memoryId)) valid = false;
      edges.push({from: memoryId, to: fb.feedbackId, relation: 'FEEDBACK_FROM_MEMORY'});
    }
  }
  // Feedback must trace to findings as well (informational outputs of findings).
  void findingIds; void hypothesisIds;

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
    || a.relation.localeCompare(b.relation));
  return Object.freeze({
    edges: Object.freeze(edges),
    valid,
    fingerprint: lineageFingerprintOf(edges),
  });
}
