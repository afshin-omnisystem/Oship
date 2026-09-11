import type {
  ClosedLoopAnalysisResult, IntelligenceMemory, MemoryCorrection, MemoryRecord,
  NormalizedRecord, RejectedHistoryEntry, ResearchConfigSpec,
} from './types';
import {normalizeBatch} from './normalization';
import {buildObservation, memorySortKey} from './observation';
import {contentFingerprintOf, memoryFingerprintOf, memoryIdOf} from './ids';
import type {ResearchAuditLog} from './audit';

/**
 * SPRINT 036 — historical intelligence memory (§3).
 *
 * Immutable, deduplicated, versioned. Identical observations collapse to one
 * record; contradictory duplicates are rejected explicitly; corrections
 * create NEW versions with lineage and reason — historical truth is never
 * mutated in place.
 */

export interface MemoryBuildResult {
  readonly memory: IntelligenceMemory;
  readonly normalizedByBatch: readonly {batchId: string; records: readonly NormalizedRecord[]}[];
  readonly batchSummaries: readonly {batchId: string; records: number; accepted: number;
    rejected: number; failClosed: boolean; reason: string | null}[];
}

export function buildMemory(
  analyses: readonly ClosedLoopAnalysisResult[],
  corrections: readonly MemoryCorrection[],
  config: ResearchConfigSpec,
  timestamp: number,
  audit: ResearchAuditLog,
): MemoryBuildResult {
  const accepted: MemoryRecord[] = [];
  const rejected: RejectedHistoryEntry[] = [];
  const normalizedByBatch: {batchId: string; records: readonly NormalizedRecord[]}[] = [];
  const batchSummaries: {
    batchId: string; records: number; accepted: number; rejected: number;
    failClosed: boolean; reason: string | null;
  }[] = [];
  let duplicatesIgnored = 0;

  // Deterministic batch order: analyses arrive sorted by (timestamp, analysisId);
  // per-batch record order is the closed-loop canonical order.
  for (const batch of analyses) {
    const normalization = normalizeBatch(batch, config, timestamp);
    normalizedByBatch.push({batchId: normalization.batchId, records: normalization.normalized});
    for (const entry of normalization.rejected) {
      rejected.push(entry);
      audit.append('fail-closed', {sourceId: entry.sourceId, batchId: entry.batchId, reason: entry.reason});
    }
    if (normalization.failClosed) {
      audit.append('fail-closed', {
        batchId: normalization.batchId, rejectedRecords: normalization.rejected.length,
        reason: normalization.reason,
      });
    }
    let batchAccepted = 0;
    for (const normalized of normalization.normalized) {
      // Contradiction: same opportunity observed at the same instant with
      // different content — the later record is rejected. Never silently merged.
      const contradiction = accepted.find((m) =>
        m.opportunityId === normalized.opportunityId
        && m.timestamp === normalized.timestamp
        && m.contentFingerprint !== normalized.contentFingerprint);
      if (contradiction) {
        const entry: RejectedHistoryEntry = {
          sourceId: normalized.sourceId, batchId: normalized.batchId,
          kind: 'CONTRADICTORY_DUPLICATE',
          reason: `contradicts ${contradiction.sourceId}: same opportunity ${normalized.opportunityId}`
            + ` at ${normalized.timestamp} with different content`,
          timestamp,
        };
        rejected.push(entry);
        audit.append('rejected', {sourceId: entry.sourceId, kind: entry.kind, reason: entry.reason});
        continue;
      }
      // Dedup: identical observation content — one memory record.
      const duplicate = accepted.find((m) =>
        m.sourceId === normalized.sourceId
        && m.contentFingerprint === normalized.contentFingerprint);
      if (duplicate) {
        duplicatesIgnored++;
        continue;
      }
      const observation = buildObservation(normalized, config);
      accepted.push(observation);
      batchAccepted++;
      audit.append('memory-created', {
        memoryId: observation.memoryId, sourceId: observation.sourceId,
        domain: observation.domain, class: observation.opportunityClass,
        strategy: observation.strategyId, timestamp: observation.timestamp,
      });
    }
    batchSummaries.push({
      batchId: normalization.batchId,
      records: batch.records.length,
      accepted: batchAccepted,
      rejected: normalization.rejected.length,
      failClosed: normalization.failClosed,
      reason: normalization.reason,
    });
  }

  // Corrections — new versions, never in-place mutation.
  let correctionsApplied = 0;
  for (const correction of [...corrections].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    const active = accepted.find((m) => m.sourceId === correction.sourceId && m.status === 'ACTIVE');
    if (!active) continue;
    const index = accepted.indexOf(active);
    const costs = active.values.realizedCosts === null
      ? null : active.values.realizedCosts + correction.realizedCostDelta;
    const gross = active.values.realizedGross;
    const net = costs === null || gross === null ? null : gross - costs;
    const theoretical = active.values.theoreticalNet;
    const ratio = net === null || theoretical === null || Math.abs(theoretical) < 1e-12
      ? null : net / theoretical;
    const totalLeakage = net === null || theoretical === null ? null : theoretical - net;
    const correctedValues = Object.freeze({
      ...active.values,
      realizedCosts: costs,
      realizedNet: net,
      preservationRatio: ratio,
      totalLeakage,
      provenance: 'ESTIMATED' as const,
    });
    const version = active.lineage.version + 1;
    const contentFingerprint = contentFingerprintOf({
      sourceId: active.sourceId, values: correctedValues, corrected: true, version,
    });
    const memoryId = memoryIdOf({contentFingerprint, version, sourceId: active.sourceId, corrected: true});
    const superseded: MemoryRecord = Object.freeze({...active, status: 'SUPERSEDED'});
    const corrected: MemoryRecord = Object.freeze({
      ...active,
      memoryId,
      contentFingerprint,
      values: correctedValues,
      provenance: 'ESTIMATED',
      lineage: Object.freeze({
        ...active.lineage,
        version,
        supersedes: active.memoryId,
        correctionReason: correction.reason,
      }),
      evidence: Object.freeze({...active.evidence, state: 'INSUFFICIENT' as const}),
    });
    accepted[index] = superseded;
    accepted.push(corrected);
    correctionsApplied++;
    audit.append('memory-linked', {
      supersedes: superseded.memoryId, supersededBy: corrected.memoryId,
      reason: correction.reason, version,
    });
  }

  accepted.sort((a, b) => memorySortKey(a).localeCompare(memorySortKey(b)));
  const memory: IntelligenceMemory = Object.freeze({
    records: Object.freeze(accepted),
    duplicatesIgnored,
    rejected: Object.freeze(rejected),
    correctionsApplied,
    fingerprint: memoryFingerprintOf({
      count: accepted.length, ids: accepted.map((m) => m.memoryId),
      duplicates: duplicatesIgnored, rejected: rejected.map((r) => r.sourceId),
    }),
  });
  return {memory, normalizedByBatch, batchSummaries};
}

/** Read-only accessor: active (non-superseded) memory records. */
export function activeMemory(memory: IntelligenceMemory): readonly MemoryRecord[] {
  return memory.records.filter((m) => m.status === 'ACTIVE');
}
