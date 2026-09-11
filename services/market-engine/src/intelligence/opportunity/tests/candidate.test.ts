import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  AFIS_CLASSES, ABL_CLASSES, ALL_CLASSES, classValidForDomain,
  validateCandidate, rejectCandidate,
} from '../candidate';
import {
  opportunityLearning, freshCandidates, rejectedCandidates, rejectionGallery,
} from '../test-fixtures';
import type {OpportunityCandidate, RejectedCandidate} from '../types';

/**
 * SPRINT 038 — candidate validation tests: every fail-closed rule, the full
 * rejection gallery, and acceptance of realistic AFIS/ABL candidates.
 */

const learning = opportunityLearning();

test('AFIS classes are the six market classes', () => {
  assert.equal(AFIS_CLASSES.length, 6);
  assert.ok(AFIS_CLASSES.includes('cross-venue-arbitrage'));
  assert.ok(AFIS_CLASSES.includes('liquidity-imbalance'));
});

test('ABL classes are the five betting classes', () => {
  assert.equal(ABL_CLASSES.length, 5);
  assert.ok(ABL_CLASSES.includes('surebet'));
  assert.ok(ABL_CLASSES.includes('back-lay'));
});

test('AFIS and ABL class vocabularies are disjoint', () => {
  for (const cls of AFIS_CLASSES) {
    assert.equal(ABL_CLASSES.includes(cls), false);
  }
  assert.equal(ALL_CLASSES.length, AFIS_CLASSES.length + ABL_CLASSES.length);
});

test('class validity is domain-scoped', () => {
  assert.equal(classValidForDomain('AFIS', 'cross-venue-arbitrage'), true);
  assert.equal(classValidForDomain('ABL', 'cross-venue-arbitrage'), false);
  assert.equal(classValidForDomain('ABL', 'surebet'), true);
  assert.equal(classValidForDomain('AFIS', 'surebet'), false);
});

test('every fresh fixture candidate validates against the real learning result', () => {
  for (const candidate of freshCandidates()) {
    const result = validateCandidate(candidate, learning);
    if ('rejected' in result) {
      assert.fail(`${candidate.candidateId} rejected: ${result.code}`);
    } else {
      assert.equal(result.valid, true);
      assert.equal(result.candidate, candidate);
    }
  }
});

test('validation returns the candidate verbatim — no silent repair', () => {
  const candidate = freshCandidates()[0];
  const result = validateCandidate(candidate, learning);
  if ('rejected' in result) {
    assert.fail('unexpected rejection');
  } else {
    assert.equal(result.candidate, candidate);
  }
});

test('a null candidate is malformed', () => {
  const result = validateCandidate(null, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MALFORMED_CANDIDATE');
});

test('a non-object candidate is malformed', () => {
  const result = validateCandidate('opportunity', learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MALFORMED_CANDIDATE');
});

test('a missing candidateId rejects with MISSING_IDENTITY', () => {
  const result = validateCandidate({domain: 'AFIS'}, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MISSING_IDENTITY');
});

test('an empty candidateId rejects with MISSING_IDENTITY', () => {
  const result = validateCandidate({candidateId: '', domain: 'AFIS'}, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MISSING_IDENTITY');
});

test('an unknown domain rejects with UNKNOWN_DOMAIN', () => {
  const candidate = {...freshCandidates()[0], domain: 'PREDICTION_MARKET'};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'UNKNOWN_DOMAIN');
});

test('an unknown class rejects with UNKNOWN_CLASS', () => {
  const candidate = {...freshCandidates()[0], opportunityClass: 'snooker-arb'};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'UNKNOWN_CLASS');
});

test('an AFIS class on an ABL candidate rejects with CLASS_DOMAIN_MISMATCH', () => {
  const candidate = {
    ...freshCandidates()[0], domain: 'ABL', opportunityClass: 'cross-venue-arbitrage',
  };
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'CLASS_DOMAIN_MISMATCH');
});

test('a missing strategy rejects with MISSING_STRATEGY', () => {
  const candidate = {...freshCandidates()[0], strategyId: ''};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MISSING_STRATEGY');
});

test('an unknown strategy rejects with INVALID_STRATEGY_REFERENCE', () => {
  const candidate = {...freshCandidates()[0], strategyId: 'martingale-5000'};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_STRATEGY_REFERENCE');
});

test('an AFIS strategy on an ABL candidate rejects (cross-domain mapping)', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate, strategyId: 'arb-guardian'};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
  if ('rejected' in result) {
    assert.match(result.reason, /cross-domain strategy mapping/);
  }
});

test('an unknown venue rejects with INVALID_VENUE_REFERENCE', () => {
  const candidate = {
    ...freshCandidates()[0],
    venues: ['venue-a', 'venue-z'],
    venueLegs: [...freshCandidates()[0].venueLegs, {venue: 'venue-z', side: 'BUY'}],
  };
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_VENUE_REFERENCE');
});

test('a negative theoretical edge rejects with INVALID_NUMERICAL_VALUE', () => {
  const candidate = {...freshCandidates()[0],
    market: {...freshCandidates()[0].market, theoreticalEdge: -5}};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_NUMERICAL_VALUE');
});

test('a NaN theoretical edge rejects with INVALID_NUMERICAL_VALUE', () => {
  const candidate = {...freshCandidates()[0],
    market: {...freshCandidates()[0].market, theoreticalEdge: Number.NaN}};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_NUMERICAL_VALUE');
});

test('an out-of-range liquidity index rejects with INVALID_NUMERICAL_VALUE', () => {
  const candidate = {...freshCandidates()[0],
    market: {...freshCandidates()[0].market, liquidityIndex: 1.5}};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_NUMERICAL_VALUE');
});

test('a zero receivedAt rejects with INVALID_NUMERICAL_VALUE', () => {
  const candidate = {...freshCandidates()[0], receivedAt: 0};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_NUMERICAL_VALUE');
});

test('unsorted venues reject with NON_CANONICAL_ORDER', () => {
  const candidate = {...freshCandidates()[0], venues: ['venue-b', 'venue-a']};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'NON_CANONICAL_ORDER');
});

test('duplicate venues reject with NON_CANONICAL_ORDER', () => {
  const candidate = {...freshCandidates()[0], venues: ['venue-a', 'venue-a']};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'NON_CANONICAL_ORDER');
});

test('an AFIS leg with a BACK side rejects with AMBIGUOUS_SEMANTIC_MAPPING', () => {
  const base = freshCandidates()[0];
  const candidate = {...base, venueLegs: [{venue: 'venue-a', side: 'BACK'}]};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('an ABL leg with a BUY side rejects with AMBIGUOUS_SEMANTIC_MAPPING', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate, venueLegs: [{venue: 'venue-a', side: 'BUY'}]};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('an AFIS leg carrying odds rejects with AMBIGUOUS_SEMANTIC_MAPPING', () => {
  const base = freshCandidates()[0];
  const candidate = {...base,
    venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2.1}]};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('an ABL leg with odds of exactly 1 rejects with INVALID_ODDS', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate,
    venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 1}]};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_ODDS');
});

test('an ABL leg with odds below 1 rejects with INVALID_ODDS', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate,
    venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 0.5}]};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'INVALID_ODDS');
});

test('an ABL leg with valid decimal odds above 1 is accepted', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const result = validateCandidate(ablCandidate, learning);
  assert.equal('rejected' in result, false);
});

test('an ABL candidate without marketId rejects with MISSING_ABL_IDENTITY', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate, marketId: null};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MISSING_ABL_IDENTITY');
});

test('an ABL candidate without selectionId rejects with MISSING_ABL_IDENTITY', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet') as OpportunityCandidate;
  const candidate = {...ablCandidate, selectionId: ''};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MISSING_ABL_IDENTITY');
});

test('an AFIS candidate needs no betting identity', () => {
  const result = validateCandidate(freshCandidates()[0], learning);
  assert.equal('rejected' in result, false);
});

test('missing venueLegs reject with MALFORMED_CANDIDATE', () => {
  const base = freshCandidates()[0] as unknown as Record<string, unknown>;
  const candidate = {...base, venueLegs: undefined};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MALFORMED_CANDIDATE');
});

test('empty venueLegs reject with MALFORMED_CANDIDATE', () => {
  const candidate = {...freshCandidates()[0], venueLegs: []};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MALFORMED_CANDIDATE');
});

test('a leg referencing a venue outside the candidate rejects', () => {
  const base = freshCandidates()[0];
  const candidate = {...base,
    venueLegs: [...base.venueLegs, {venue: 'venue-b', side: 'BUY'}],
    venues: ['venue-a']};
  const result = validateCandidate(candidate, learning);
  assert.ok('rejected' in result);
  assert.equal(result.code, 'MALFORMED_CANDIDATE');
});

test('the rejection gallery covers every rejection code exactly', () => {
  const gallery = rejectionGallery();
  const codes = new Set(gallery.map((e) => e.code));
  // Thirteen unique codes; the ambiguous-mapping rule has three variants.
  assert.equal(codes.size, 13);
  assert.equal(gallery.length, 15);
});

test('every gallery entry rejects (none is accidentally valid)', () => {
  for (const entry of rejectionGallery()) {
    const result = validateCandidate(entry.candidate, learning);
    assert.ok('rejected' in result, String(entry.code));
  }
});

test('the in-band rejected fixture candidates reject with their codes', () => {
  const rejected = rejectedCandidates();
  const first = validateCandidate(rejected[0], learning);
  assert.ok('rejected' in first);
  assert.equal(first.code, 'UNKNOWN_DOMAIN');
  const second = validateCandidate(rejected[1], learning);
  assert.ok('rejected' in second);
  assert.equal(second.code, 'INVALID_ODDS');
});

test('rejectCandidate builds an immutable, versioned rejection record', () => {
  const validation = validateCandidate(null, learning);
  assert.ok('rejected' in validation);
  const record: RejectedCandidate = rejectCandidate(null, validation, 123);
  assert.equal(record.candidateId, '<missing>');
  assert.equal(record.code, 'MALFORMED_CANDIDATE');
  assert.equal(record.receivedAt, 123);
  assert.equal(record.schemaVersion, 'opportunity-intelligence.rejection.v1');
  assert.ok(Object.isFrozen(record));
  assert.ok(record.reason.length > 0);
});

test('rejectCandidate preserves the candidate id when present', () => {
  const candidate = {...freshCandidates()[0], domain: 'DEX'};
  const validation = validateCandidate(candidate, learning);
  assert.ok('rejected' in validation);
  const record = rejectCandidate(candidate, validation, 5);
  assert.equal(record.candidateId, freshCandidates()[0].candidateId);
});

test('validation reasons are explicit and mention fail-closed', () => {
  const gallery = rejectionGallery();
  for (const entry of gallery) {
    assert.ok(entry.code.length > 0);
  }
  const validation = validateCandidate({candidateId: 'x'}, learning);
  assert.ok('rejected' in validation);
  if ('rejected' in validation) {
    assert.match(validation.reason, /fail closed/);
  }
});
