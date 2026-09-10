import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResearchNormalizationError, normalizeRecord, normalizeBatch, fingerprintNormalized} from '../normalization';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';
import type {ClosedLoopRecordAnalysis, ClosedLoopAnalysisResult} from '../types';

/**
 * SPRINT 036 — normalization tests (§4): order-independent, no semantic loss,
 * malformed history rejected with explicit reasons.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const batch = history.eraAnalyses[0];
const healthy = batch.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;

test('a valid record normalizes with its canonical identity fields', () => {
  const normalized = normalizeRecord(healthy, batch, config);
  assert.equal(normalized.opportunityId, 'opp_healthy__e1');
  assert.equal(normalized.domain, 'AFIS');
  assert.equal(normalized.strategyId, 'arb-guardian');
  assert.equal(normalized.sourceId, `${batch.analysisId}:opp_healthy__e1`);
  assert.ok(normalized.timestamp > 0);
  assert.ok(normalized.timeBucket.startsWith('tb_'));
  assert.ok(normalized.recordFingerprint.startsWith('clx_') || normalized.recordFingerprint.length > 0);
});

test('normalization preserves the full value triple — no semantic loss', () => {
  const normalized = normalizeRecord(healthy, batch, config);
  assert.ok(normalized.values.theoreticalNet !== null);
  assert.ok(normalized.values.realizedNet !== null);
  assert.ok(normalized.values.preservationRatio !== null);
  assert.ok(Math.abs(normalized.values.preservationRatio
    - (normalized.values.realizedNet! / normalized.values.theoreticalNet!)) < 1e-9);
});

test('venue legs are sorted and deduplicated deterministically', () => {
  const normalized = normalizeRecord(healthy, batch, config);
  assert.ok(normalized.venues.length > 0);
  assert.deepEqual(normalized.venues, [...normalized.venues].sort());
  assert.deepEqual(normalized.venueLegs.map((l) => l.venue + ':' + l.side),
    [...normalized.venueLegs.map((l) => l.venue + ':' + l.side)].sort());
});

test('leakage decomposition covers all Sprint 035 components', () => {
  const normalized = normalizeRecord(healthy, batch, config);
  const components = Object.keys(normalized.values.leakageByComponent);
  assert.equal(components.length, 17);
  for (const [name, value] of Object.entries(normalized.values.leakageByComponent)) {
    assert.ok(Number.isFinite(value), `${name} must be finite`);
    if (name !== 'RESIDUAL_UNATTRIBUTED') assert.ok(value >= 0, `${name} must be non-negative`);
  }
});

test('unavailable components are listed and never carry values', () => {
  const normalized = normalizeRecord(healthy, batch, config);
  assert.ok(normalized.values.unavailableComponents.length > 0);
  for (const name of normalized.values.unavailableComponents) {
    assert.equal(normalized.values.leakageByComponent[name], 0);
  }
});

test('a missing opportunity identity is rejected', () => {
  const broken = {...healthy, identity: {...healthy.identity, opportunityId: ''}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), ResearchNormalizationError);
});

test('an unknown domain is rejected', () => {
  const broken = {...healthy, identity: {...healthy.identity, domain: 'FOREX' as never}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /unknown domain/);
});

test('an unknown opportunity class is rejected', () => {
  const broken = {...healthy, identity: {...healthy.identity, opportunityClass: 'moonshot' as never}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /unknown opportunity class/);
});

test('a non-finite observation timestamp is rejected', () => {
  const broken = {...healthy, identity: {...healthy.identity, observedAt: Number.NaN}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /invalid timestamp/);
});

test('non-finite freshness is rejected — the record is UNKNOWABLE, fail closed', () => {
  const broken = {...healthy, identity: {...healthy.identity, freshness: Number.NaN}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /freshness/);
});

test('a record without venue legs is rejected', () => {
  const broken = {...healthy, venue: {...healthy.venue, venues: []}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /no venue legs/);
});

test('a missing strategy identity is rejected', () => {
  const broken = {...healthy, strategy: {...healthy.strategy, strategyId: ''}} as ClosedLoopRecordAnalysis;
  assert.throws(() => normalizeRecord(broken, batch, config), /missing strategy identity/);
});

test('normalizeBatch reports accepted records and their batch id', () => {
  const result = normalizeBatch(batch, config, history.input.timestamp);
  assert.equal(result.batchId, batch.analysisId);
  assert.equal(result.normalized.length, 13);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.failClosed, false);
});

test('normalizeBatch rejects malformed records instead of crashing the batch', () => {
  const brokenBatch: ClosedLoopAnalysisResult = structuredClone(batch);
  const broken = brokenBatch.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;
  (broken.identity as {freshness: number}).freshness = Number.NaN;
  const result = normalizeBatch(brokenBatch, config, history.input.timestamp);
  assert.equal(result.normalized.length, 12);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].reason, /freshness/);
});

test('fingerprints are deterministic and content-sensitive', () => {
  const n1 = normalizeRecord(healthy, batch, config);
  const n2 = normalizeRecord(healthy, batch, config);
  assert.equal(fingerprintNormalized(n1), fingerprintNormalized(n2));
  const other = batch.records.find((r) => r.identity.opportunityId === 'opp_steady__e1')!;
  assert.notEqual(fingerprintNormalized(n1), fingerprintNormalized(normalizeRecord(other, batch, config)));
});
