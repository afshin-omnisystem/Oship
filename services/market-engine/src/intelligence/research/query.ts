import type {
  MemoryIndex, MemoryRecord, QueryGroupAggregate, QueryGroupBy, QueryResult,
  ResearchConfigSpec, ResearchQuery, ResearchQueryFilter,
} from './types';
import {queryIdOf} from './ids';
import {meanOf, meetsEvidenceFloor} from './source';
import {LEAKAGE_COMPONENTS} from '../closed-loop/types';
import type {LeakageComponentName} from '../closed-loop/types';

/**
 * SPRINT 036 — deterministic research query engine (§7).
 *
 * Structured (non-LLM) queries over memory with deterministic filters,
 * ordering and aggregation. No database: pure in-memory evaluation.
 */

function recordMatches(record: MemoryRecord, filter: ResearchQueryFilter): boolean {
  if (filter.domains && !filter.domains.includes(record.domain)) return false;
  if (filter.classes && !filter.classes.includes(record.opportunityClass)) return false;
  if (filter.strategies && !filter.strategies.includes(record.strategyId)) return false;
  if (filter.venues && !record.venues.some((v) => filter.venues!.includes(v))) return false;
  if (filter.policies
    && !filter.policies.includes(`${record.policyId}@${record.policyVersion}`)
    && !filter.policies.includes(record.policyVersion)) return false;
  if (filter.outcomes && !filter.outcomes.includes(record.values.outcome)) return false;
  if (filter.minPreservation !== undefined
    && (record.values.preservationRatio === null || record.values.preservationRatio < filter.minPreservation)) return false;
  if (filter.maxPreservation !== undefined
    && (record.values.preservationRatio === null || record.values.preservationRatio > filter.maxPreservation)) return false;
  if (filter.minTheoreticalNet !== undefined
    && (record.values.theoreticalNet === null || record.values.theoreticalNet < filter.minTheoreticalNet)) return false;
  if (filter.maxLeakage !== undefined
    && (record.values.totalLeakage === null || record.values.totalLeakage > filter.maxLeakage)) return false;
  if (filter.minExecutionQuality !== undefined
    && (record.values.executionQuality === null || record.values.executionQuality < filter.minExecutionQuality)) return false;
  if (filter.from !== undefined && record.timestamp < filter.from) return false;
  if (filter.to !== undefined && record.timestamp > filter.to) return false;
  if (filter.minEvidenceQuality !== undefined
    && !meetsEvidenceFloor(record.evidence.state, filter.minEvidenceQuality)) return false;
  return true;
}

function groupKeyOf(record: MemoryRecord, groupBy: QueryGroupBy): string {
  switch (groupBy) {
    case 'class': return record.opportunityClass;
    case 'strategy': return record.strategyId;
    case 'venue': return record.venues.join('+');
    case 'policy': return `${record.policyId}@${record.policyVersion}`;
    case 'outcome': return record.values.outcome;
    case 'timeBucket': return record.timeBucket;
    case 'domain': return record.domain;
    default: return 'ALL';
  }
}

function aggregateFor(key: string, records: readonly MemoryRecord[], config: ResearchConfigSpec): QueryGroupAggregate {
  const leakageByComponent: Record<string, number> = {};
  for (const name of LEAKAGE_COMPONENTS) {
    const total = records.reduce((s, r) => s + (r.values.leakageByComponent[name] ?? 0), 0);
    if (Math.abs(total) > 1e-12) leakageByComponent[name] = total;
  }
  const outcomeCounts: Record<string, number> = {};
  for (const r of records) outcomeCounts[r.values.outcome] = (outcomeCounts[r.values.outcome] ?? 0) + 1;
  const meanConfidence = records.length === 0 ? 0
    : records.reduce((s, r) => s + Math.max(0, Math.min(1, r.evidence.confidence)), 0) / records.length;
  return Object.freeze({
    key,
    sampleSize: records.length,
    meanPreservation: meanOf(records.map((r) => r.values.preservationRatio)),
    meanTheoreticalNet: meanOf(records.map((r) => r.values.theoreticalNet)),
    meanRealizedNet: meanOf(records.map((r) => r.values.realizedNet)),
    totalLeakage: records.reduce((s, r) => s + (r.values.totalLeakage ?? 0), 0),
    leakageByComponent: Object.freeze(leakageByComponent),
    meanExecutionQuality: meanOf(records.map((r) => r.values.executionQuality)),
    completionRate: records.length === 0 ? null
      : records.filter((r) => r.values.outcome === 'COMPLETED').length / records.length,
    outcomeCounts: Object.freeze(outcomeCounts),
    evidenceState: records.length < config.minSampleSize ? 'INSUFFICIENT'
      : meanConfidence >= 0.8 ? 'STRONG' : meanConfidence >= 0.6 ? 'MODERATE'
      : meanConfidence >= 0.3 ? 'WEAK' : 'INSUFFICIENT',
    memoryIds: Object.freeze(records.map((r) => r.memoryId).sort()),
  });
}

export function runQuery(
  query: Omit<ResearchQuery, 'queryId'>,
  memory: readonly MemoryRecord[],
  _index: MemoryIndex,
  config: ResearchConfigSpec,
): QueryResult {
  const matched = memory
    .filter((r) => r.status === 'ACTIVE' && recordMatches(r, query.filter))
    .sort((a, b) => a.timestamp - b.timestamp || a.sourceId.localeCompare(b.sourceId));
  const minSample = query.filter.minSampleSize ?? config.minSampleSize;
  const groups = new Map<string, MemoryRecord[]>();
  for (const record of matched) {
    const key = groupKeyOf(record, query.groupBy);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(record);
  }
  const aggregates = [...groups.entries()]
    .map(([key, records]) => aggregateFor(key, records, config))
    .sort((a, b) => a.key.localeCompare(b.key));
  const insufficientReason = matched.length === 0 ? 'no matching historical observations'
    : matched.length < minSample ? `matched ${matched.length} < required ${minSample}`
    : null;
  return Object.freeze({
    queryId: queryIdOf({name: query.name, filter: query.filter, groupBy: query.groupBy}),
    name: query.name,
    filter: query.filter,
    groupBy: query.groupBy,
    matched: Object.freeze(matched.map((r) => r.memoryId)),
    sampleSize: matched.length,
    groups: Object.freeze(aggregates),
    insufficientReason,
    fingerprint: queryIdOf({name: query.name, matched: matched.map((r) => r.memoryId), seal: true}),
  });
}

export function leakageTotals(records: readonly MemoryRecord[]): Readonly<Record<string, number>> {
  // Canonical order: sums must be float-identical regardless of caller order.
  const ordered = [...records].sort((a, b) => a.memoryId.localeCompare(b.memoryId));
  const totals: Record<string, number> = {};
  for (const name of LEAKAGE_COMPONENTS as readonly LeakageComponentName[]) {
    const total = ordered.reduce((s, r) => s + (r.values.leakageByComponent[name] ?? 0), 0);
    totals[name] = total;
  }
  return Object.freeze(totals);
}
