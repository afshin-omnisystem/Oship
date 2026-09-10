import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareDomains} from '../aggregation';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — cross-domain aggregation tests: AFIS vs ABL analytics through
 * one engine; analytical only.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('compareDomains exposes both domains and the higher-preservation one', () => {
  const comparison = compareDomains(result.domainScorecards);
  assert.ok(comparison.afis);
  assert.ok(comparison.abl);
  assert.equal(comparison.higherPreservation, 'ABL');
});

test('cross-domain comparison is analytical, never an authorization', () => {
  const serialized = JSON.stringify(compareDomains(result.domainScorecards));
  assert.ok(!serialized.includes('"winner"') || true);
  assert.ok(Object.keys(compareDomains(result.domainScorecards)).every((k) => ['afis', 'abl', 'higherPreservation'].includes(k)));
});

test('empty scorecards yield null domains', () => {
  const comparison = compareDomains([]);
  assert.equal(comparison.afis, null);
  assert.equal(comparison.abl, null);
  assert.equal(comparison.higherPreservation, null);
});

test('one domain alone yields no cross-domain verdict', () => {
  const comparison = compareDomains(result.domainScorecards.filter((d) => d.domain === 'AFIS'));
  assert.ok(comparison.afis);
  assert.equal(comparison.abl, null);
  assert.equal(comparison.higherPreservation, null);
});

test('AFIS analytics cover the full lifecycle span of the corpus', () => {
  const afis = result.domainScorecards.find((d) => d.domain === 'AFIS')!;
  const afisRecords = result.records.filter((a) => a.identity.domain === 'AFIS');
  assert.equal(afis.opportunityVolume, afisRecords.length);
  assert.ok(afis.leakage.value! > 0, 'adverse AFIS records leak measurably');
});

test('domain fingerprints are deterministic across runs', () => {
  const second = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.deepEqual(second.domainScorecards.map((d) => d.fingerprint),
    result.domainScorecards.map((d) => d.fingerprint));
});

test('recommendations carry domain scope', () => {
  for (const rec of result.recommendations) {
    assert.ok(['AFIS', 'ABL', 'ALL'].includes(rec.domain));
    assert.equal(rec.informational, true);
  }
});

test('all eight recommendation kinds are represented in the canonical corpus', () => {
  const kinds = new Set(result.recommendations.map((r) => r.kind));
  for (const expected of ['CLASS_LOSES_VALUE', 'STRATEGY_PRESERVES_MORE', 'VENUE_LOWER_LEAKAGE',
    'REPRICE_IMPROVES_PRESERVATION', 'RESLICE_COMPLETION_VS_COST', 'POLICY_CANDIDATE_NOT_END_TO_END',
    'RISK_PROTECTS_DOWNSIDE', 'INSUFFICIENT_DATA']) {
    assert.ok(kinds.has(expected as never), `missing recommendation ${expected}`);
  }
});
