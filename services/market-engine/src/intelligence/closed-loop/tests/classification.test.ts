import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyOpportunity, isAblClass} from '../source';
import {ingestOpportunityIdentity} from '../opportunity';
import {closedLoopCorpus} from '../test-fixtures';
import {CLASSIFICATION_VERSION} from '../types';
import type {OpportunityType} from '../types';

/**
 * SPRINT 035 — classification tests (§20): deterministic, versioned AFIS and
 * ABL opportunity classes.
 */

const corpus = closedLoopCorpus();

test('AFIS classes map deterministically', () => {
  assert.equal(classifyOpportunity('CROSS_VENUE_SPOT_ARBITRAGE'), 'cross-venue-arbitrage');
  assert.equal(classifyOpportunity('TRIANGULAR_ARBITRAGE'), 'triangular-arbitrage');
  assert.equal(classifyOpportunity('FUNDING_RATE_ARBITRAGE'), 'funding');
  assert.equal(classifyOpportunity('SPOT_PERPETUAL_BASIS'), 'basis');
  assert.equal(classifyOpportunity('MARKET_MAKING'), 'market-making');
  assert.equal(classifyOpportunity('LIQUIDITY_IMBALANCE'), 'liquidity-imbalance');
});

test('ABL classes map deterministically', () => {
  assert.equal(classifyOpportunity('ODDS_ARBITRAGE_2WAY'), 'surebet');
  assert.equal(classifyOpportunity('ODDS_ARBITRAGE_3WAY'), 'surebet');
  assert.equal(classifyOpportunity('BACK_LAY_DISCREPANCY'), 'back-lay');
  assert.equal(classifyOpportunity('SPORTS_VALUE'), 'plus-ev');
  assert.equal(classifyOpportunity('HEDGE_MIDDLE'), 'middle');
});

test('classification is a pure function — repeated calls agree', () => {
  const types: OpportunityType[] = ['CROSS_VENUE_SPOT_ARBITRAGE', 'ODDS_ARBITRAGE_2WAY', 'SPORTS_VALUE', 'MARKET_MAKING'];
  for (const t of types) {
    assert.equal(classifyOpportunity(t), classifyOpportunity(t));
  }
});

test('classification is versioned', () => {
  assert.equal(CLASSIFICATION_VERSION, 'closed-loop.classification.v1');
  for (const record of corpus.records) {
    assert.equal(ingestOpportunityIdentity(record).classificationVersion, CLASSIFICATION_VERSION);
  }
});

test('isAblClass separates domain families', () => {
  assert.ok(isAblClass('surebet'));
  assert.ok(isAblClass('back-lay'));
  assert.ok(isAblClass('plus-ev'));
  assert.ok(isAblClass('middle'));
  assert.ok(!isAblClass('cross-venue-arbitrage'));
  assert.ok(!isAblClass('funding'));
});

test('corpus covers both AFIS and ABL classes', () => {
  const classes = new Set(corpus.records.map((r) => ingestOpportunityIdentity(r).opportunityClass));
  for (const expected of ['cross-venue-arbitrage', 'liquidity-imbalance', 'surebet']) {
    assert.ok(classes.has(expected as never), `missing class ${expected}`);
  }
});

test('class agrees with domain for every corpus record', () => {
  for (const record of corpus.records) {
    const identity = ingestOpportunityIdentity(record);
    assert.equal(isAblClass(identity.opportunityClass), identity.domain === 'ABL',
      `${record.label}: class ${identity.opportunityClass} vs domain ${identity.domain}`);
  }
});

test('unknown type fails closed rather than guessing a class', () => {
  assert.throws(() => classifyOpportunity('MYSTERY' as OpportunityType), /unclassifiable/);
});

test('classification never mutates the opportunity', () => {
  const record = corpus.records[0];
  const before = JSON.stringify(record.opportunity);
  ingestOpportunityIdentity(record);
  assert.equal(JSON.stringify(record.opportunity), before);
});

test('identity classification matches direct classification for the corpus', () => {
  for (const record of corpus.records) {
    const identity = ingestOpportunityIdentity(record);
    assert.equal(identity.opportunityClass, classifyOpportunity(record.opportunity.type));
  }
});
