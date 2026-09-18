import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {
  liqIntentInput, afisIntentInput, ablIntentInput, cleanIntentInput,
  staleIntentInput, agingIntentInput, unknownFreshnessIntentInput,
  unknownAllowedIntentInput, unstableIntentInput,
  unstableBlockedIntentInput, notComparableIntentInput,
  normalizedIntentInput, multiDependentIntentInput,
  venueDependentIntentInput, noDominantIntentInput,
  governanceBlockedIntentInput, authorityBypassIntentInput,
  staleAllowedIntentInput,
} from '../test-fixtures';

/**
 * SPRINT 041 — full-chain regression: every corpus input must synthesize
 * without throwing, pass its own invariants and replay identically.
 */

const engine = new StrategyIntentEngine();

const CORPUS: readonly [string, () => unknown][] = [
  ['afis', afisIntentInput],
  ['abl', ablIntentInput],
  ['liq', liqIntentInput],
  ['no-dominant', noDominantIntentInput],
  ['multi-dependent', multiDependentIntentInput],
  ['venue-dependent', venueDependentIntentInput],
  ['clean', cleanIntentInput],
  ['stale', staleIntentInput],
  ['stale-allowed', staleAllowedIntentInput],
  ['aging', agingIntentInput],
  ['unknown-freshness', unknownFreshnessIntentInput],
  ['unknown-allowed', unknownAllowedIntentInput],
  ['unstable', unstableIntentInput],
  ['unstable-blocked', unstableBlockedIntentInput],
  ['not-comparable', notComparableIntentInput],
  ['normalized', normalizedIntentInput],
  ['governance-blocked', governanceBlockedIntentInput],
  ['authority-bypass', authorityBypassIntentInput],
];

test('every corpus input synthesizes cleanly', () => {
  for (const [name, build] of CORPUS) {
    const result = engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0]);
    assert.equal(result.invariants.passed, true,
      `${name} failed invariants`);
    assert.equal(result.replay.identical, true,
      `${name} failed replay`);
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED',
      `${name} violated the strategy boundary`);
  }
});

test('every corpus result passes its own audit verification', () => {
  for (const [name, build] of CORPUS) {
    const result = engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0]);
    const last = result.auditEvents[result.auditEvents.length - 1];
    assert.equal(last.eventType, 'replay-completed',
      `${name} audit missing replay event`);
    const {eventCount, headHash} = result.intent.auditIdentity;
    assert.ok(eventCount <= result.auditEvents.length,
      `${name} audit count exceeds chain`);
    assert.equal(headHash,
      result.auditEvents[eventCount - 1].hash,
      `${name} audit head mismatch`);
  }
});

test('every corpus result disclaims execution in every field', () => {
  for (const [name, build] of CORPUS) {
    const result = engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0]);
    assert.equal(result.intent.informational, true,
      `${name} not informational`);
    assert.equal(result.intent.strategyDecides, true,
      `${name} does not defer to Strategy`);
    assert.equal(result.intent.schemaVersion,
      'oship.strategy-intent.v1');
  }
});

test('blocked corpora never surface preferred alternatives', () => {
  for (const [name, build] of [
    ['afis', afisIntentInput],
    ['abl', ablIntentInput],
    ['stale', staleIntentInput],
    ['unknown-freshness', unknownFreshnessIntentInput],
    ['unstable-blocked', unstableBlockedIntentInput],
    ['not-comparable', notComparableIntentInput],
    ['multi-dependent', multiDependentIntentInput],
    ['venue-dependent', venueDependentIntentInput],
    ['governance-blocked', governanceBlockedIntentInput],
    ['authority-bypass', authorityBypassIntentInput],
  ] as const) {
    const result = engine.synthesize(build());
    assert.equal(result.preferredAlternativeId, null,
      `${name} surfaced a preferred alternative`);
    assert.deepEqual(result.acceptableAlternativeIds, [],
      `${name} surfaced acceptable alternatives`);
  }
});

test('the corpus exercises all eight classification states', () => {
  const states = new Set(CORPUS.map(([name, build]) =>
    engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0])
      .classification));
  assert.equal(states.size, 8);
});

test('the corpus exercises all six priority levels', () => {
  const priorities = new Set(CORPUS.map(([name, build]) =>
    engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0]).priority));
  assert.equal(priorities.size, 6);
});

test('the corpus exercises all six objective classes', () => {
  const classes = new Set(CORPUS.map(([name, build]) =>
    engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0])
      .objective.objectiveClass));
  assert.equal(classes.size, 6);
});

test('governance restriction preservation holds across the corpus', () => {
  for (const [name, build] of CORPUS) {
    const result = engine.synthesize(
      build() as Parameters<typeof engine.synthesize>[0]);
    assert.ok(result.restrictions.length >= 5,
      `${name} lost restrictions`);
  }
});
