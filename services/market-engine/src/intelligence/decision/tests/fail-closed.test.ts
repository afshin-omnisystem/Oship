import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DecisionIntelligenceEngine} from '../engine';
import {validateAlternativeSpec} from '../alternative';
import {
  afisCvaBase, ablSurebetBase, opportunityLearning, afisDecisionInput,
  alternativeRejectionGallery, runDecision,
} from '../test-fixtures';
import type {DecisionIntelligenceInput} from '../types';

/**
 * SPRINT 039 — fail-closed tests: malformed contexts, unknown domains,
 * incompatible alternatives, invalid identities, cross-domain raw
 * comparisons, invalid units/strategies/venues/sides, unsupported
 * dimensions, ambiguous mappings and nondeterministic specs are all
 * rejected — nothing is silently repaired.
 */

function inputWith(overrides: Partial<DecisionIntelligenceInput>): DecisionIntelligenceInput {
  return {...afisDecisionInput(), ...overrides};
}

test('a missing input object fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(null as never), /input required/);
});

test('a learning result without observations fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({
    learning: {} as never})), /learning result required/);
});

test('a learning result with failed invariants fails closed', () => {
  const learning = opportunityLearning();
  const broken = {...learning, invariants: {...learning.invariants, passed: false}};
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({learning: broken})),
    /failed its own invariants/);
});

test('a non-replay-verified learning result fails closed', () => {
  const learning = opportunityLearning();
  const broken = {...learning, replay: {identical: false, fingerprint: 'x'}};
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({learning: broken})),
    /replay-verified/);
});

test('a malformed base candidate fails closed with its code', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({
    baseCandidate: {candidateId: 'broken'}})), /base candidate rejected/);
});

test('an unknown-domain base candidate fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  const unknown = {...afisCvaBase(), domain: 'PREDICTION_MARKET' as never};
  assert.throws(() => engine.analyze(inputWith({baseCandidate: unknown})),
    /base candidate rejected/);
});

test('a missing correlation id fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({correlationId: ''})),
    /correlationId required/);
});

test('a missing trace id fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({traceId: ''})), /traceId required/);
});

test('a non-finite timestamp fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith({timestamp: Number.NaN})),
    /finite timestamp/);
});

test('missing alternatives array fails closed', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze(inputWith(
    {alternatives: undefined as never})), /alternatives array required/);
});

test('every gallery rejection code is produced by the validator', () => {
  const base = afisCvaBase();
  for (const entry of alternativeRejectionGallery(base)) {
    const validation = validateAlternativeSpec(
      entry.spec, base, opportunityLearning(), new Set(['g-dupe']));
    assert.ok(!validation.ok, `${entry.label} must be rejected`);
    assert.equal(validation.code, entry.code);
  }
});

test('rejected alternatives never enter the evaluated set', () => {
  const base = afisCvaBase();
  const result = runDecision(inputWith({
    baseCandidate: base,
    alternatives: [
      {alternativeId: 'bad-1', label: 'cross-domain', kind: 'STRATEGY',
        baseCandidateId: base.candidateId, strategyId: 'sports-arb-strategy',
        venues: null, venueLegs: null, marketId: null, selectionId: null,
        marketOverrides: null, rationale: 'x'},
      {alternativeId: 'bad-2', label: 'unknown venue', kind: 'VENUE',
        baseCandidateId: base.candidateId, strategyId: null,
        venues: ['venue-z'], venueLegs: null, marketId: null, selectionId: null,
        marketOverrides: null, rationale: 'y'},
    ]}));
  assert.equal(result.rejectedAlternatives.length, 2);
  assert.ok(result.alternatives.every(
    (a) => !['bad-1', 'bad-2'].includes(a.alternativeId)));
});

test('rejections are audited as alternative-rejected events', () => {
  const base = afisCvaBase();
  const result = runDecision(inputWith({
    baseCandidate: base,
    alternatives: [{alternativeId: 'bad-1', label: 'cross-domain',
      kind: 'STRATEGY', baseCandidateId: base.candidateId,
      strategyId: 'sports-arb-strategy', venues: null, venueLegs: null,
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}]}));
  assert.ok(result.auditEvents.some((e) =>
    e.eventType === 'alternative-rejected' && e.payload.code === 'CROSS_DOMAIN_COMPARISON'));
});

test('a duplicate baseline id in the spec list is rejected', () => {
  const base = afisCvaBase();
  const result = runDecision(inputWith({
    baseCandidate: base,
    alternatives: [{alternativeId: `baseline-${base.candidateId}`,
      label: 'fake baseline', kind: 'BASELINE', baseCandidateId: base.candidateId,
      strategyId: null, venues: null, venueLegs: null, marketId: null,
      selectionId: null, marketOverrides: null, rationale: 'duplicate'}]}));
  // The engine adds its own baseline first; the duplicate is rejected.
  assert.ok(result.rejectedAlternatives.some(
    (r) => r.code === 'DUPLICATE_ALTERNATIVE_ID'));
});

test('the engine still succeeds with zero submitted alternatives', () => {
  const base = afisCvaBase();
  const result = runDecision(inputWith({
    baseCandidate: base, alternatives: []}));
  // Only the auto-baseline is evaluated.
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].kind, 'BASELINE');
});

test('negative-spread execution overrides fail closed', () => {
  const base = afisCvaBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'neg', label: 'negative spread', kind: 'EXECUTION',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: {spreadBps: -5}, rationale: 'x'},
    base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INCOMPATIBLE_UNITS');
});

test('ABL orientation swaps with swapped-back odds are still legal', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'swap', label: 'swap', kind: 'SIDE',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: [{venue: 'venue-a', side: 'LAY', odds: 2.1},
        {venue: 'venue-b', side: 'BACK', odds: 2.05}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(validation.ok);
});

test('an empty-string market override on ABL fails closed', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'm', label: 'empty market', kind: 'MARKET',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: null, marketId: '', selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_MARKET_IDENTITY');
});

test('nothing is silently inferred for missing rationale', () => {
  const base = afisCvaBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'r', label: 'no rationale', kind: 'STRATEGY',
      baseCandidateId: base.candidateId, strategyId: 'arb-aggressive',
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'MISSING_ALTERNATIVE_IDENTITY');
});
