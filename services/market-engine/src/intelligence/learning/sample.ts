import type {
  MemoryRecord, ResearchResult, LearningObservation, LearningConfigSpec,
} from './types';
import {observationIdOf, contentFingerprintOf} from './ids';

/**
 * SPRINT 037 — learning observations (§3).
 *
 * Immutable projections of the Sprint 036 intelligence memory. Every
 * observation preserves source identity, provenance, lineage (memory record,
 * batch, findings, patterns, hypotheses covering it), configuration
 * fingerprint, timestamp, content fingerprint and evidence state. They are
 * built from ACTIVE memory records only and are never mutated afterwards.
 */

export function observationLineageOf(
  research: ResearchResult, memory: MemoryRecord,
): {batchId: string; findingIds: string[]; patternIds: string[]; hypothesisIds: string[]} {
  const findingIds = research.findings
    .filter((f) => f.supportingMemoryIds.includes(memory.memoryId))
    .map((f) => f.findingId).sort();
  const patternIds = research.patterns
    .filter((p) => p.evidenceMemoryIds.includes(memory.memoryId))
    .map((p) => p.patternId).sort();
  const hypothesisIds = research.hypotheses
    .filter((h) => h.supportingEvidenceIds.includes(memory.memoryId)
      || h.contradictingEvidenceIds.includes(memory.memoryId))
    .map((h) => h.hypothesisId).sort();
  return {batchId: memory.lineage.batchId, findingIds, patternIds, hypothesisIds};
}

export function buildLearningObservations(
  research: ResearchResult,
  config: LearningConfigSpec,
): readonly LearningObservation[] {
  const buckets = [...new Set(research.memory.records.map((r) => r.timeBucket))].sort();
  const eraOf = new Map(buckets.map((b, i) => [b, i + 1]));
  const observations: LearningObservation[] = [];
  for (const memory of research.memory.records) {
    if (memory.status !== 'ACTIVE') continue;
    const lineage = observationLineageOf(research, memory);
    const era = eraOf.get(memory.timeBucket) ?? 0;
    if (era === 0) {
      throw new Error(`learning: memory record ${memory.memoryId} has unknown time bucket — fail closed`);
    }
    const observation: LearningObservation = Object.freeze({
      observationId: observationIdOf({memoryId: memory.memoryId, config: config.schemaVersion}),
      sourceMemoryId: memory.memoryId,
      sourceType: 'research.memory.v1',
      sourceFingerprint: memory.contentFingerprint,
      domain: memory.domain,
      opportunityId: memory.opportunityId,
      opportunityClass: memory.opportunityClass,
      strategyId: memory.strategyId,
      venues: [...memory.venues].sort(),
      policyId: memory.policyId,
      policyVersion: memory.policyVersion,
      semanticSide: memory.semanticSide,
      timestamp: memory.timestamp,
      timeBucket: memory.timeBucket,
      era,
      provenance: memory.provenance,
      schemaVersion: 'learning.observation.v1',
      configurationFingerprint: config.schemaVersion,
      contentFingerprint: '',
      lineage: Object.freeze({
        researchAnalysisId: research.analysisId,
        memoryId: memory.memoryId,
        batchId: lineage.batchId,
        findingIds: Object.freeze(lineage.findingIds),
        patternIds: Object.freeze(lineage.patternIds),
        hypothesisIds: Object.freeze(lineage.hypothesisIds),
      }),
      evidenceState: memory.evidence.state,
      evidenceConfidence: memory.evidence.confidence,
      values: memory.values,
      venueLegs: memory.venueLegs,
    });
    const sealed: LearningObservation = Object.freeze({
      ...observation,
      contentFingerprint: contentFingerprintOf({
        sourceMemoryId: observation.sourceMemoryId, sourceFingerprint: observation.sourceFingerprint,
        era, lineage: observation.lineage, values: observation.values,
        venueLegs: observation.venueLegs, evidenceState: observation.evidenceState,
      }),
    });
    observations.push(sealed);
  }
  observations.sort((a, b) => (a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0));
  return Object.freeze(observations);
}

/** Observations grouped by a key function, deterministically ordered by key. */
export function groupObservations<K extends string>(
  observations: readonly LearningObservation[], keyOf: (o: LearningObservation) => K,
): Readonly<Record<string, readonly LearningObservation[]>> {
  const groups: Record<string, LearningObservation[]> = {};
  for (const o of observations) {
    const key = keyOf(o);
    (groups[key] ??= []).push(o);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (a.observationId < b.observationId ? -1 : 1));
  }
  const sorted: Record<string, readonly LearningObservation[]> = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = Object.freeze(groups[key]);
  return Object.freeze(sorted);
}

/**
 * Strategies on the LOSING side of a CONTRADICTED research hypothesis: the
 * hypothesis's supporting population (the side the claim predicted would
 * win, which the evidence contradicted). Learning must surface these as
 * CONTRADICTORY — never as clean conclusions.
 */
export function contradictedStrategiesOf(research: ResearchResult): ReadonlySet<string> {
  const byMemory = new Map(research.memory.records.map((r) => [r.memoryId, r.strategyId]));
  const contradicted = new Set<string>();
  for (const hypothesis of research.hypotheses) {
    if (hypothesis.status !== 'CONTRADICTED') continue;
    for (const memoryId of hypothesis.supportingEvidenceIds) {
      const strategyId = byMemory.get(memoryId);
      if (strategyId) contradicted.add(strategyId);
    }
  }
  return contradicted;
}
