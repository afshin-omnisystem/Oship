import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {buildDomainScorecards} from '../aggregation';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — domain performance tests (§18): unified AFIS/ABL analytics,
 * one engine, no duplicated domain implementations.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('both domains receive scorecards', () => {
  assert.deepEqual(result.domainScorecards.map((d) => d.domain), ['AFIS', 'ABL']);
});

test('AFIS scorecard aggregates the 12 AFIS records', () => {
  const afis = result.domainScorecards.find((d) => d.domain === 'AFIS')!;
  assert.equal(afis.opportunityVolume, 12);
  const members = corpus.records.filter((r) => r.opportunity.domain === 'AFIS');
  assert.equal(members.length, 12);
});

test('ABL scorecard aggregates the ABL record', () => {
  const abl = result.domainScorecards.find((d) => d.domain === 'ABL')!;
  assert.equal(abl.opportunityVolume, 1);
});

test('theoretical value is the domain sum of theoretical nets at scale', () => {
  const abl = result.domainScorecards.find((d) => d.domain === 'ABL')!;
  assert.ok(Math.abs(abl.theoreticalValue - 4.4) < 1e-9);
});

test('execution success is completed over total', () => {
  for (const card of result.domainScorecards) {
    assert.ok(card.executionSuccess.value! >= 0 && card.executionSuccess.value! <= 1);
    const members = corpus.records.filter((r) => r.opportunity.domain === card.domain);
    const completed = members.filter((r) => r.session.session.finalResult?.finalState === 'COMPLETED').length;
    assert.ok(Math.abs(card.executionSuccess.value! - completed / members.length) < 1e-9);
  }
});

test('domain analytics carry the ten §18 metrics', () => {
  for (const card of result.domainScorecards) {
    const keys = ['opportunityVolume', 'theoreticalValue', 'realizedValue', 'preservation', 'leakage',
      'executionSuccess', 'averageQuality', 'capitalEfficiency', 'venueEfficiency', 'strategyEfficiency'];
    for (const key of keys) assert.ok(key in card, `missing ${key}`);
  }
});

test('one engine serves both domains — no duplicate implementations', () => {
  const rebuilt = buildDomainScorecards(result.records);
  assert.equal(rebuilt.length, 2);
  assert.deepEqual(rebuilt.map((d) => d.fingerprint), result.domainScorecards.map((d) => d.fingerprint));
});

test('domain scorecards are fingerprinted deterministically', () => {
  const second = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.deepEqual(second.domainScorecards, result.domainScorecards);
});

test('preservation is the mean of member preservation ratios', () => {
  const abl = result.domainScorecards.find((d) => d.domain === 'ABL')!;
  assert.ok(Math.abs(abl.preservation.value! - 3.9 / 4.4) < 1e-9);
});

test('domains with no records produce no scorecard', () => {
  const onlyAbl = buildDomainScorecards(result.records.filter((a) => a.identity.domain === 'ABL'));
  assert.equal(onlyAbl.length, 1);
  assert.equal(onlyAbl[0].domain, 'ABL');
});
