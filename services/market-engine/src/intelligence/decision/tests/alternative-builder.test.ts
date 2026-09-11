import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStandardAlternatives, strategyVariants, venueVariants,
  executionVariants, sideOrientationVariant, marketVariant,
} from '../alternative-builder';
import {validateAlternativeSpec} from '../alternative';
import {
  afisCvaBase, ablSurebetBase, opportunityLearning,
} from '../test-fixtures';

/**
 * SPRINT 039 — alternative builder tests: standard, semantically legal
 * alternatives for both domains; nothing is invented that the domain does
 * not support.
 */

test('the standard AFIS set always starts with the baseline', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  assert.equal(specs[0].kind, 'BASELINE');
  assert.ok(specs[0].alternativeId.startsWith('baseline-'));
});

test('the standard AFIS set includes strategy variants', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  const strategies = specs.filter((s) => s.kind === 'STRATEGY');
  assert.ok(strategies.length >= 1);
  assert.ok(strategies.some((s) => s.strategyId === 'arb-aggressive'));
});

test('AFIS strategy variants never include cross-domain strategies', () => {
  const specs = strategyVariants(afisCvaBase(), opportunityLearning());
  for (const spec of specs) {
    assert.notEqual(spec.strategyId, 'sports-arb-strategy');
  }
});

test('the standard AFIS set includes venue variants', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  assert.ok(specs.some((s) => s.kind === 'VENUE' && s.venues?.length === 1));
});

test('AFIS venue variants only reference venues with AFIS history', () => {
  const specs = venueVariants(afisCvaBase(), opportunityLearning());
  for (const spec of specs) {
    for (const venue of spec.venues ?? []) {
      const known = opportunityLearning().venueLearning.find((v) => v.venue === venue);
      assert.ok(known && known.domains.includes('AFIS'),
        `${venue} must have AFIS history`);
    }
  }
});

test('the standard AFIS set includes execution variants', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  const exec = specs.filter((s) => s.kind === 'EXECUTION');
  assert.equal(exec.length, 2);
});

test('execution variants are conservative and aggressive', () => {
  const variants = executionVariants(afisCvaBase());
  assert.equal(variants.length, 2);
  const conservative = variants.find((v) => v.alternativeId.includes('conservative'));
  const aggressive = variants.find((v) => v.alternativeId.includes('aggressive'));
  assert.ok(conservative && aggressive);
  assert.ok((conservative.marketOverrides?.executionQualityIndex ?? 0)
    > (aggressive.marketOverrides?.executionQualityIndex ?? 1));
});

test('AFIS sets never include SIDE or MARKET alternatives', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  assert.ok(!specs.some((s) => s.kind === 'SIDE'));
  assert.ok(!specs.some((s) => s.kind === 'MARKET'));
});

test('the standard ABL set includes the orientation variant', () => {
  const specs = buildStandardAlternatives(ablSurebetBase(), opportunityLearning());
  assert.ok(specs.some((s) => s.kind === 'SIDE'));
});

test('the orientation variant swaps BACK and LAY preserving venues and odds', () => {
  const spec = sideOrientationVariant(ablSurebetBase());
  assert.ok(spec);
  const legs = spec.venueLegs ?? [];
  assert.equal(legs.length, 2);
  const back = legs.find((l) => l.side === 'BACK');
  const lay = legs.find((l) => l.side === 'LAY');
  assert.ok(back && lay);
  assert.notEqual(back.venue, lay.venue);
  assert.ok(legs.every((l) => typeof l.odds === 'number' && l.odds > 1));
});

test('the standard ABL set includes the market/selection variant', () => {
  const specs = buildStandardAlternatives(ablSurebetBase(), opportunityLearning());
  assert.ok(specs.some((s) => s.kind === 'MARKET'));
});

test('the ABL market variant preserves the market id and changes the selection', () => {
  const spec = marketVariant(ablSurebetBase());
  assert.ok(spec);
  assert.equal(spec.marketId, 'mkt-derby-winner');
  assert.equal(spec.selectionId, 'sel-home-team-alt');
});

test('ABL sets never include EXECUTION variants', () => {
  const specs = buildStandardAlternatives(ablSurebetBase(), opportunityLearning());
  assert.ok(!specs.some((s) => s.kind === 'EXECUTION'));
});

test('every standard alternative validates against its base', () => {
  for (const [base, name] of [[afisCvaBase(), 'AFIS'],
    [ablSurebetBase(), 'ABL']] as const) {
    const specs = buildStandardAlternatives(base, opportunityLearning());
    const seen = new Set<string>();
    for (const spec of specs) {
      const validation = validateAlternativeSpec(
        spec, base, opportunityLearning(), seen);
      assert.ok(validation.ok, `${name} spec ${spec.alternativeId}: ${
        validation.ok ? '' : validation.code + ' ' + validation.reason}`);
      seen.add(spec.alternativeId);
    }
  }
});

test('standard alternative ids are unique per opportunity', () => {
  for (const base of [afisCvaBase(), ablSurebetBase()]) {
    const specs = buildStandardAlternatives(base, opportunityLearning());
    assert.equal(new Set(specs.map((s) => s.alternativeId)).size, specs.length);
  }
});

test('every alternative carries a reconstruction rationale', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  for (const spec of specs) {
    assert.ok(spec.rationale.length > 10,
      `${spec.alternativeId} needs a rationale`);
  }
});

test('sideOrientationVariant is null for AFIS bases', () => {
  assert.equal(sideOrientationVariant(afisCvaBase()), null);
});

test('marketVariant is null for AFIS bases', () => {
  assert.equal(marketVariant(afisCvaBase()), null);
});
