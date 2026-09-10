import type {
  KnowledgeEntity, KnowledgeEntityKind, MemoryRecord, ResearchConfigSpec,
} from './types';
import {entityFingerprintOf} from './ids';
import {meanOf} from './source';

/**
 * SPRINT 036 — knowledge extraction (§6): deterministic per-entity analytical
 * facts aggregated from ACTIVE memory. One extraction rule set serves AFIS
 * and ABL (domain adapters only via the records themselves).
 */

function evidenceStateFor(count: number, meanConfidence: number, minSample: number): KnowledgeEntity['evidenceState'] {
  if (count < minSample) return 'INSUFFICIENT';
  if (meanConfidence >= 0.8) return 'STRONG';
  if (meanConfidence >= 0.6) return 'MODERATE';
  if (meanConfidence >= 0.3) return 'WEAK';
  return 'INSUFFICIENT';
}

function entityOf(
  kind: KnowledgeEntityKind, key: string, records: readonly MemoryRecord[],
  config: ResearchConfigSpec, venueView?: {leakage: number | null; fillEfficiency: number | null; count: number},
): KnowledgeEntity {
  const domains = [...new Set(records.map((r) => r.domain))].sort();
  const meanConfidence = records.length === 0 ? 0
    : records.reduce((s, r) => s + Math.max(0, Math.min(1, r.evidence.confidence)), 0) / records.length;
  const totalLeakage = venueView
    ? (venueView.leakage === null ? null : venueView.leakage)
    : records.reduce((s, r) => s + (r.values.totalLeakage ?? 0), 0);
  return Object.freeze({
    kind, key,
    domain: domains.length === 1 ? domains[0] : 'MIXED',
    observationCount: venueView ? venueView.count : records.length,
    meanPreservation: venueView ? null : meanOf(records.map((r) => r.values.preservationRatio)),
    meanTheoreticalNet: venueView ? null : meanOf(records.map((r) => r.values.theoreticalNet)),
    meanRealizedNet: venueView ? null : meanOf(records.map((r) => r.values.realizedNet)),
    totalLeakage,
    meanExecutionQuality: venueView
      ? venueView.fillEfficiency
      : meanOf(records.map((r) => r.values.executionQuality)),
    completionRate: records.length === 0 ? null
      : records.filter((r) => r.values.outcome === 'COMPLETED').length / records.length,
    semanticSides: Object.freeze([...new Set(records.map((r) => r.semanticSide))].sort()),
    evidenceState: evidenceStateFor(venueView ? venueView.count : records.length, meanConfidence, config.minSampleSize),
    memoryIds: Object.freeze(records.map((r) => r.memoryId).sort()),
    fingerprint: '',
  });
}

/** Extract every knowledge entity from ACTIVE memory. */
export function buildEntities(
  records: readonly MemoryRecord[], config: ResearchConfigSpec,
): readonly KnowledgeEntity[] {
  const active = records.filter((r) => r.status === 'ACTIVE');
  const entities: KnowledgeEntity[] = [];

  const byStrategy = groupBy(active, (r) => r.strategyId);
  for (const key of [...byStrategy.keys()].sort()) {
    entities.push(finish(entityOf('STRATEGY', key, byStrategy.get(key)!, config)));
  }
  const byClass = groupBy(active, (r) => r.opportunityClass);
  for (const key of [...byClass.keys()].sort()) {
    entities.push(finish(entityOf('OPPORTUNITY_CLASS', key, byClass.get(key)!, config)));
  }
  const byPolicy = groupBy(active, (r) => `${r.policyId}@${r.policyVersion}`);
  for (const key of [...byPolicy.keys()].sort()) {
    entities.push(finish(entityOf('POLICY', key, byPolicy.get(key)!, config)));
  }
  const byDomain = groupBy(active, (r) => r.domain);
  for (const key of [...byDomain.keys()].sort()) {
    entities.push(finish(entityOf('DOMAIN', key, byDomain.get(key)!, config)));
  }
  // Venue entities aggregate over per-leg observations.
  interface VenueAccumulator {records: MemoryRecord[]; leakage: number; fillEfficiencySum: number; count: number; fillKnown: number}
  const venueRecords = new Map<string, VenueAccumulator>();
  for (const record of active) {
    for (const leg of record.venueLegs) {
      const entry = venueRecords.get(leg.venue)
        ?? {records: [], leakage: 0, fillEfficiencySum: 0, count: 0, fillKnown: 0};
      entry.records.push(record);
      entry.leakage += leg.leakage ?? 0;
      if (leg.fillEfficiency !== null) {
        entry.fillEfficiencySum += leg.fillEfficiency;
        entry.fillKnown++;
      }
      entry.count++;
      venueRecords.set(leg.venue, entry);
    }
  }
  for (const key of [...venueRecords.keys()].sort()) {
    const entry = venueRecords.get(key)!;
    const base = entityOf('VENUE', key, entry.records, config, {
      leakage: entry.leakage,
      fillEfficiency: entry.fillKnown > 0 ? entry.fillEfficiencySum / entry.fillKnown : null,
      count: entry.count,
    });
    entities.push(finish(base));
  }
  return Object.freeze(entities.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key)));
}

function finish(entity: KnowledgeEntity): KnowledgeEntity {
  return Object.freeze({...entity, fingerprint: entityFingerprintOf({
    kind: entity.kind, key: entity.key, count: entity.observationCount,
    meanPreservation: entity.meanPreservation, totalLeakage: entity.totalLeakage,
    memoryIds: entity.memoryIds,
  })});
}

export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    (map.get(key) ?? map.set(key, []).get(key)!).push(item);
  }
  return map;
}
