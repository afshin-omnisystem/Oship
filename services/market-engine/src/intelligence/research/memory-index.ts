import type {
  ExecutionQualityBand, MemoryIndex, MemoryIndexDimension, MemoryRecord,
} from './types';
import {indexFingerprintOf} from './ids';

/**
 * SPRINT 036 — deterministic memory indexes (§5). No database: sorted
 * in-memory maps, compatible with future persistence. Every lookup is a pure
 * function of the memory content.
 */

export function executionQualityBand(quality: number | null): ExecutionQualityBand {
  if (quality === null) return 'UNAVAILABLE';
  if (quality >= 0.85) return 'HIGH';
  if (quality >= 0.6) return 'MEDIUM';
  return 'LOW';
}

function addToIndex(index: Record<string, string[]>, key: string, memoryId: string): void {
  (index[key] ??= []).push(memoryId);
}

export function buildMemoryIndex(records: readonly MemoryRecord[]): MemoryIndex {
  const dimensions: Record<MemoryIndexDimension, Record<string, string[]>> = {
    domain: {}, opportunityClass: {}, strategy: {}, venue: {}, policy: {},
    outcome: {}, preservationGrade: {}, leakageClass: {}, failureClass: {},
    timeBucket: {}, executionQualityBand: {},
  };
  for (const record of records) {
    if (record.status !== 'ACTIVE') continue;
    const id = record.memoryId;
    addToIndex(dimensions.domain, record.domain, id);
    addToIndex(dimensions.opportunityClass, record.opportunityClass, id);
    addToIndex(dimensions.strategy, record.strategyId, id);
    for (const venue of record.venues) addToIndex(dimensions.venue, venue, id);
    addToIndex(dimensions.policy, `${record.policyId}@${record.policyVersion}`, id);
    addToIndex(dimensions.outcome, record.values.outcome, id);
    addToIndex(dimensions.preservationGrade, record.values.preservationGrade, id);
    addToIndex(dimensions.leakageClass, record.values.topLeakageComponent ?? 'NONE', id);
    addToIndex(dimensions.failureClass, record.values.failureClass ?? 'NONE', id);
    addToIndex(dimensions.timeBucket, record.timeBucket, id);
    addToIndex(dimensions.executionQualityBand, executionQualityBand(record.values.executionQuality), id);
  }
  // Deterministic: sort ids within keys, sort keys.
  const frozen = {} as Record<MemoryIndexDimension, Readonly<Record<string, readonly string[]>>>;
  for (const dimension of Object.keys(dimensions) as MemoryIndexDimension[]) {
    const sorted: Record<string, readonly string[]> = {};
    for (const key of Object.keys(dimensions[dimension]).sort()) {
      sorted[key] = Object.freeze([...dimensions[dimension][key]].sort());
    }
    frozen[dimension] = Object.freeze(sorted);
  }
  return Object.freeze({
    dimensions: Object.freeze(frozen),
    memoryCount: records.filter((r) => r.status === 'ACTIVE').length,
    fingerprint: indexFingerprintOf(frozen),
  });
}

/** Deterministic lookup: all ACTIVE memory ids for one dimension key. */
export function lookupIndex(
  index: MemoryIndex, dimension: MemoryIndexDimension, key: string,
): readonly string[] {
  return index.dimensions[dimension][key] ?? [];
}

/** Deterministic intersection of id sets. */
export function intersectIds(sets: readonly (readonly string[])[]): readonly string[] {
  if (sets.length === 0) return [];
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    result = new Set(sets[i].filter((x) => result.has(x)));
  }
  return [...result].sort();
}
