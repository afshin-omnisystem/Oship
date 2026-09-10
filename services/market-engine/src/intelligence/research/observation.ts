import type {
  MemoryRecord, NormalizedRecord, ResearchConfigSpec, EvidenceState, ResearchProvenance,
} from './types';
import {fingerprintNormalized} from './normalization';
import {memoryIdOf} from './ids';

/**
 * SPRINT 036 — historical observation (§3): the immutable, fingerprinted unit
 * of intelligence memory. One validated lifecycle observation per record.
 */

export function observationEvidenceState(record: NormalizedRecord): EvidenceState {
  if (record.values.provenance === 'UNAVAILABLE') return 'UNAVAILABLE';
  const confidence = Math.max(0, Math.min(1, record.values.confidence));
  if (record.values.preservationRatio === null) return 'UNKNOWN';
  if (confidence >= 0.8) return 'STRONG';
  if (confidence >= 0.6) return 'MODERATE';
  if (confidence >= 0.3) return 'WEAK';
  return 'INSUFFICIENT';
}

export function buildObservation(
  record: NormalizedRecord, config: ResearchConfigSpec, version = 1,
  supersedes: string | null = null, correctionReason: string | null = null,
): MemoryRecord {
  const contentFingerprint = fingerprintNormalized(record);
  const evidence = observationEvidenceState(record);
  const memoryId = memoryIdOf({contentFingerprint, version, supersedes, sourceId: record.sourceId});
  return Object.freeze({
    memoryId,
    sourceId: record.sourceId,
    sourceType: 'closed-loop.v1' as const,
    sourceFingerprint: record.recordFingerprint,
    domain: record.domain,
    opportunityId: record.opportunityId,
    opportunityClass: record.opportunityClass,
    semanticSide: record.semanticSide,
    strategyId: record.strategyId,
    venues: record.venues,
    policyId: record.policyId,
    policyVersion: record.policyVersion,
    timestamp: record.timestamp,
    timeBucket: record.timeBucket,
    provenance: record.values.provenance as ResearchProvenance,
    schemaVersion: 'research.memory.v1' as const,
    configurationFingerprint: config.schemaVersion,
    contentFingerprint,
    closedLoopConfigFingerprint: record.closedLoopConfigFingerprint,
    lineage: Object.freeze({
      batchId: record.batchId,
      recordFingerprint: record.recordFingerprint,
      supersedes,
      version,
      correctionReason,
    }),
    evidence: Object.freeze({state: evidence, confidence: record.values.confidence}),
    values: record.values,
    venueLegs: record.venueLegs,
    status: 'ACTIVE' as const,
  });
}

/** Deterministic canonical order for memory records. */
export function memorySortKey(record: MemoryRecord): string {
  return `${record.timestamp}|${record.sourceId}`;
}
