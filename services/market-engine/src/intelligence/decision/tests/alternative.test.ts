import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ALTERNATIVE_KINDS, validateAlternativeSpec, rejectAlternative,
  baselineSpecOf, applyOverrides, isCanonicalVenueOrder, classesOfDomain,
} from '../alternative';
import {afisCvaBase, ablSurebetBase, opportunityLearning,
  alternativeRejectionGallery} from '../test-fixtures';
import type {OpportunityCandidate, AlternativeSpec} from '../types';

/**
 * SPRINT 039 — alternative model tests: fail-closed validation of every
 * alternative surface, override application and baseline derivation.
 */

function validSpec(base: OpportunityCandidate, extra: Record<string, unknown> = {}) {
  return {
    alternativeId: 'spec-1', label: 'Spec one', kind: 'STRATEGY',
    baseCandidateId: base.candidateId,
    strategyId: base.domain === 'AFIS' ? 'arb-aggressive' : 'sports-arb-strategy',
    venues: null, venueLegs: null, marketId: null, selectionId: null,
    marketOverrides: null, rationale: 'test rationale',
    ...extra,
  };
}

test('valid strategy alternatives pass validation', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase()), afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(validation.ok, JSON.stringify(validation));
});

test('the seven alternative kinds are exactly defined', () => {
  assert.equal(ALTERNATIVE_KINDS.length, 7);
  assert.ok(ALTERNATIVE_KINDS.includes('BASELINE'));
  assert.ok(ALTERNATIVE_KINDS.includes('SIDE'));
});

test('null specs are malformed', () => {
  const validation = validateAlternativeSpec(
    null, afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'MALFORMED_ALTERNATIVE');
});

test('missing alternativeId is rejected', () => {
  const validation = validateAlternativeSpec(
    {label: 'x', kind: 'STRATEGY', baseCandidateId: 'dec-afis-cva-base',
      rationale: 'r'}, afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'MISSING_ALTERNATIVE_IDENTITY');
});

test('unknown kinds are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {kind: 'MAGIC'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'UNKNOWN_ALTERNATIVE_KIND');
});

test('duplicate alternative ids are rejected', () => {
  const seen = new Set(['spec-1']);
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase()), afisCvaBase(), opportunityLearning(), seen);
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'DUPLICATE_ALTERNATIVE_ID');
});

test('a wrong base candidate is rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {baseCandidateId: 'someone-else'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'BASE_CANDIDATE_MISMATCH');
});

test('cross-domain strategies are rejected as cross-domain comparisons', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: 'sports-arb-strategy'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'CROSS_DOMAIN_COMPARISON');
});

test('strategies without learning history are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: 'martingale-5000'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_STRATEGY');
});

test('venues without domain history are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null, venues: ['venue-z']}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_VENUE');
});

test('unsorted venue overrides are rejected as non-canonical', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null, venues: ['venue-b', 'venue-a']}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'NON_CANONICAL_ORDER');
});

test('illegal sides for the domain are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null,
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: null}]}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_SIDE_SEMANTICS');
});

test('odds on AFIS legs are rejected as ambiguous semantics', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null,
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2.1}]}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('ABL legs without odds are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(ablSurebetBase(), {strategyId: null,
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: null}]}),
    ablSurebetBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_ODDS');
});

test('marketId on AFIS alternatives is rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null, marketId: 'm'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('negative theoretical edge is rejected as incompatible units', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null, marketOverrides: {theoreticalEdge: -1}}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INCOMPATIBLE_UNITS');
});

test('out-of-range index overrides are rejected as incompatible units', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null,
      marketOverrides: {liquidityIndex: 1.5}}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INCOMPATIBLE_UNITS');
});

test('non-baseline alternatives that vary nothing are rejected', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {strategyId: null}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'EMPTY_ALTERNATIVE_VARIATION');
});

test('BASELINE alternatives must not override anything', () => {
  const validation = validateAlternativeSpec(
    validSpec(afisCvaBase(), {kind: 'BASELINE'}),
    afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('the rejection gallery produces exactly its declared codes', () => {
  const base = afisCvaBase();
  const gallery = alternativeRejectionGallery(base);
  assert.ok(gallery.length >= 12);
  for (const entry of gallery) {
    const validation = validateAlternativeSpec(
      entry.spec, base, opportunityLearning(), new Set(['g-dupe']));
    if (entry.code === 'DUPLICATE_ALTERNATIVE_ID') {
      assert.ok(!validation.ok && validation.code === entry.code,
        `${entry.label} should be ${entry.code}`);
      continue;
    }
    assert.ok(!validation.ok, `${entry.label} should be rejected`);
    assert.equal(validation.code, entry.code,
      `${entry.label}: expected ${entry.code}, got ${validation.ok ? 'ok' : validation.code}`);
  }
});

test('rejectAlternative records id, code, reason and schema', () => {
  const rejection = rejectAlternative(
    {alternativeId: 'x1'}, 'INVALID_VENUE', 'venue has no history');
  assert.equal(rejection.alternativeId, 'x1');
  assert.equal(rejection.code, 'INVALID_VENUE');
  assert.ok(rejection.reason.length > 0);
  assert.equal(rejection.schemaVersion, 'decision-intelligence.rejection.v1');
  assert.ok(rejection.contentFingerprint.startsWith('dcfp_'));
});

test('the baseline spec of a base candidate overrides nothing', () => {
  const spec = baselineSpecOf(afisCvaBase());
  assert.equal(spec.kind, 'BASELINE');
  assert.equal(spec.strategyId, null);
  assert.equal(spec.venues, null);
  assert.equal(spec.venueLegs, null);
  assert.equal(spec.marketId, null);
  assert.equal(spec.selectionId, null);
  assert.equal(spec.marketOverrides, null);
  const validation = validateAlternativeSpec(
    spec, afisCvaBase(), opportunityLearning(), new Set());
  assert.ok(validation.ok);
});

test('applyOverrides derives the counterfactual candidate identity', () => {
  const base = afisCvaBase();
  const spec = validSpec(base, {alternativeId: 'cf-1'}) as AlternativeSpec;
  const candidate = applyOverrides(base, spec);
  assert.equal(candidate.candidateId, 'dec-afis-cva-base--alt--cf-1');
  assert.equal(candidate.strategyId, 'arb-aggressive');
  assert.deepEqual([...candidate.venues], [...base.venues]);
});

test('applyOverrides with the baseline spec returns the base untouched', () => {
  const base = afisCvaBase();
  const candidate = applyOverrides(base, baselineSpecOf(base));
  assert.deepEqual({...candidate, candidateId: base.candidateId}, {...base});
});

test('applyOverrides preserves ABL identity unless overridden', () => {
  const base = ablSurebetBase();
  const spec = validSpec(base, {kind: 'MARKET', strategyId: null,
    marketId: 'mkt-2', selectionId: 'sel-2'}) as AlternativeSpec;
  const candidate = applyOverrides(base, spec);
  assert.equal(candidate.marketId, 'mkt-2');
  assert.equal(candidate.selectionId, 'sel-2');
  const untouched = applyOverrides(base, baselineSpecOf(base) as AlternativeSpec);
  assert.equal(untouched.marketId, base.marketId);
  assert.equal(untouched.selectionId, base.selectionId);
});

test('canonical venue order requires sorted unique venues', () => {
  assert.ok(isCanonicalVenueOrder(['venue-a']));
  assert.ok(isCanonicalVenueOrder(['venue-a', 'venue-b']));
  assert.ok(!isCanonicalVenueOrder(['venue-b', 'venue-a']));
  assert.ok(!isCanonicalVenueOrder(['venue-a', 'venue-a']));
});

test('domain-scoped classes are exposed for both domains', () => {
  assert.ok(classesOfDomain('AFIS').includes('cross-venue-arbitrage'));
  assert.ok(classesOfDomain('ABL').includes('surebet'));
  assert.ok(!classesOfDomain('AFIS').includes('surebet'));
  assert.ok(!classesOfDomain('ABL').includes('market-making'));
});
