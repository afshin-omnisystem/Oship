import type {
  EvidenceEvaluation, MemoryRecord, QueryResult, ResearchConfigSpec, ResearchFinding,
} from './types';
import {findingIdOf, researchHash} from './ids';

/**
 * SPRINT 036 — immutable research findings (§12): the analytical output of a
 * research query with full evidence, provenance, fingerprints and lineage.
 * Findings never authorize execution.
 */

export function buildFinding(
  query: QueryResult,
  evidence: EvidenceEvaluation,
  config: ResearchConfigSpec,
  timestamp: number,
  patternIds: readonly string[] = [],
  hypothesisIds: readonly string[] = [],
  batchIds: readonly string[] = [],
): ResearchFinding {
  const supportingMemoryIds = query.matched;
  const result: Record<string, unknown> = {
    sampleSize: query.sampleSize,
    groups: query.groups.map((g) => ({
      key: g.key, sampleSize: g.sampleSize,
      meanPreservation: g.meanPreservation, meanRealizedNet: g.meanRealizedNet,
      totalLeakage: g.totalLeakage, completionRate: g.completionRate,
      evidenceState: g.evidenceState,
    })),
    insufficientReason: query.insufficientReason,
  };
  const contentFingerprint = findingIdOf({query: query.name, result, supportingMemoryIds, evidence});
  return Object.freeze({
    findingId: contentFingerprint,
    query: query.name,
    scope: `groupBy=${query.groupBy};domains=${(query.filter.domains ?? ['ALL']).join('+')}`,
    result: Object.freeze(result),
    supportingMemoryIds: Object.freeze([...supportingMemoryIds]),
    evidenceScore: evidence.score,
    confidenceState: evidence.state,
    provenance: 'DERIVED',
    createdAt: timestamp,
    configurationFingerprint: researchHash(config),
    contentFingerprint,
    lineage: Object.freeze({
      batchIds: Object.freeze([...batchIds].sort()),
      patternIds: Object.freeze([...patternIds].sort()),
      hypothesisIds: Object.freeze([...hypothesisIds].sort()),
    }),
  });
}
