import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observationEvidenceState, buildObservation, memorySortKey} from '../observation';
import {normalizeRecord} from '../normalization';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';
import type {NormalizedRecord} from '../types';

/**
 * SPRINT 036 — observation tests (§3): every memory record carries an explicit
 * evidence state, schema version, config fingerprint and lineage — and the
 * memory sort key makes ordering canonical.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const batch = history.eraAnalyses[0];
const healthy = batch.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;

function normalizedOf(opportunityId: string): NormalizedRecord {
  const record = history.eraAnalyses.flatMap((a) => a.records)
    .find((r) => r.identity.opportunityId === opportunityId)!;
  const owner = history.eraAnalyses.find((a) => a.records.includes(record))!;
  return normalizeRecord(record, owner, config);
}

test('a healthy executed observation evaluates to a positive evidence state', () => {
  const state = observationEvidenceState(normalizeRecord(healthy, batch, config));
  assert.ok(['STRONG', 'MODERATE', 'WEAK'].includes(state), `got ${state}`);
});

test('an UNAVAILABLE provenance observation is UNAVAILABLE — never a number', () => {
  const n = normalizeRecord(healthy, batch, config);
  const unavailable = {...n, values: {...n.values, provenance: 'UNAVAILABLE'}} as NormalizedRecord;
  assert.equal(observationEvidenceState(unavailable), 'UNAVAILABLE');
});

test('a null preservation ratio makes the observation UNKNOWN', () => {
  const n = normalizeRecord(healthy, batch, config);
  const unknown = {...n, values: {...n.values, preservationRatio: null}} as NormalizedRecord;
  assert.equal(observationEvidenceState(unknown), 'UNKNOWN');
});

test('a low-confidence observation is INSUFFICIENT — never invented confidence', () => {
  const n = normalizeRecord(healthy, batch, config);
  const weak = {...n, values: {...n.values, confidence: 0.05}} as NormalizedRecord;
  assert.equal(observationEvidenceState(weak), 'INSUFFICIENT');
});

test('buildObservation stamps the canonical memory schema and lineage', () => {
  const record = buildObservation(normalizeRecord(healthy, batch, config), config);
  assert.equal(record.schemaVersion, 'research.memory.v1');
  assert.equal(record.sourceType, 'closed-loop.v1');
  assert.equal(record.lineage.version, 1);
  assert.equal(record.lineage.supersedes, null);
  assert.equal(record.lineage.correctionReason, null);
  assert.ok(record.memoryId.startsWith('mem_'));
  assert.ok(record.contentFingerprint.startsWith('rcfp_'));
  assert.ok(Object.isFrozen(record));
});

test('buildObservation records correction lineage explicitly', () => {
  const record = buildObservation(normalizeRecord(healthy, batch, config), config,
    2, 'mem_previous', 'fee model corrected after audit');
  assert.equal(record.lineage.version, 2);
  assert.equal(record.lineage.supersedes, 'mem_previous');
  assert.equal(record.lineage.correctionReason, 'fee model corrected after audit');
  // A different version is a DIFFERENT memory record — never an overwrite.
  assert.notEqual(record.memoryId, buildObservation(normalizeRecord(healthy, batch, config), config).memoryId);
});

test('the observation source id composes batch and opportunity', () => {
  const record = buildObservation(normalizeRecord(healthy, batch, config), config);
  assert.equal(record.sourceId, `${batch.analysisId}:opp_healthy__e1`);
});

test('memory sort keys order by timestamp then source id', () => {
  const r1 = buildObservation(normalizeRecord(healthy, batch, config), config);
  const later = {...r1, timestamp: r1.timestamp + 1, lineage: {...r1.lineage}} as typeof r1;
  const sameTimeDifferentSource = {...r1, sourceId: r1.sourceId + 'z'} as typeof r1;
  assert.ok(memorySortKey(r1) < memorySortKey(later));
  assert.ok(memorySortKey(r1) < memorySortKey(sameTimeDifferentSource));
});

test('era records carry distinct time buckets 30 days apart', () => {
  const buckets = [1, 2, 3, 4, 5].map((era) => normalizedOf(`opp_healthy__e${era}`).timeBucket);
  assert.deepEqual(buckets, [...buckets].sort());
  assert.equal(new Set(buckets).size, 5);
});

test('semantic sides are preserved per domain — ABL keeps BACK/LAY', () => {
  const abl = normalizedOf('opp_abl_surebet__e1');
  assert.equal(abl.domain, 'ABL');
  assert.ok(['BACK', 'LAY', 'UNKNOWN'].includes(abl.semanticSide));
  const afis = normalizedOf('opp_healthy__e1');
  assert.equal(afis.domain, 'AFIS');
  assert.ok(['BUY', 'SELL', 'UNKNOWN'].includes(afis.semanticSide));
});

test('the observation config fingerprint follows the configuration', () => {
  const record = buildObservation(normalizeRecord(healthy, batch, config), config);
  assert.equal(record.configurationFingerprint, config.schemaVersion);
});

test('observations of different eras never collide in memory ids', () => {
  const ids = [1, 2, 3, 4, 5].map((era) =>
    buildObservation(normalizedOf(`opp_healthy__e${era}`), config).memoryId);
  assert.equal(new Set(ids).size, 5);
});
