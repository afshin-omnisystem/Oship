import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHypothesis, hypothesisPatternIds} from '../hypothesis';
import {evaluateEvidence} from '../evidence';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import type {Hypothesis, HypothesisScope, MemoryRecord} from '../types';

/**
 * SPRINT 036 — hypothesis tests (§10): full structure, epistemic honesty —
 * correlation is never promoted to fact; invalid bases are REJECTED.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const result = new ResearchEngine().analyze(history.input);

function fakeRecord(memoryId: string, ratio: number | null, confidence = 0.9): MemoryRecord {
  return {
    memoryId, evidence: {confidence, state: 'WEAK'}, provenance: 'DERIVED',
    values: {preservationRatio: ratio, provenance: 'DERIVED'},
  } as unknown as MemoryRecord;
}

function evidenceFor(
  state: 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT' | 'UNAVAILABLE' | 'CONTRADICTORY',
  confidence = 1,
): ReturnType<typeof evaluateEvidence> {
  const supporting = state === 'UNAVAILABLE' || state === 'INSUFFICIENT'
    ? (state === 'UNAVAILABLE' ? [] : [fakeRecord('m1', 0.5)])
    : Array.from({length: config.evidenceFullSample}, (_, i) => fakeRecord(`m${i}`, 0.6, confidence));
  const contradicting = state === 'CONTRADICTORY'
    ? Array.from({length: config.evidenceFullSample}, (_, i) => fakeRecord(`c${i}`, 0.95))
    : [];
  return evaluateEvidence({subject: 'test', supporting, contradicting, metric: 'preservation'}, config);
}

const scope: HypothesisScope = {domains: ['AFIS'], classes: ['cross-venue-arbitrage']};
const baseDraft = {
  statement: 'Strategy A preserves more edge than strategy B.',
  scope, supporting: [fakeRecord('m1', 0.6)], contradicting: [],
  provenance: 'DERIVED' as const, invalidBasisReason: null,
};

test('STRONG evidence supports the hypothesis', () => {
  const hypothesis = evaluateHypothesis(baseDraft, evidenceFor('STRONG'));
  assert.equal(hypothesis.status, 'SUPPORTED');
  assert.equal(hypothesis.confidenceState, 'STRONG');
});

test('MODERATE and WEAK evidence only weakly support', () => {
  // confidence 0.7 → score 0.7 → MODERATE; confidence 0.35 → 0.35 → WEAK.
  const moderate = evidenceFor('STRONG', 0.7);
  const weak = evidenceFor('STRONG', 0.35);
  assert.equal(moderate.state, 'MODERATE');
  assert.equal(weak.state, 'WEAK');
  assert.equal(evaluateHypothesis(baseDraft, moderate).status, 'WEAKLY_SUPPORTED');
  assert.equal(evaluateHypothesis(baseDraft, weak).status, 'WEAKLY_SUPPORTED');
});

test('INSUFFICIENT evidence never becomes support', () => {
  const hypothesis = evaluateHypothesis(baseDraft, evidenceFor('INSUFFICIENT'));
  assert.equal(hypothesis.status, 'INSUFFICIENT_EVIDENCE');
});

test('UNAVAILABLE evidence is explicit — the claim simply cannot be evaluated', () => {
  const hypothesis = evaluateHypothesis(baseDraft, evidenceFor('UNAVAILABLE'));
  assert.equal(hypothesis.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(hypothesis.confidenceState, 'UNAVAILABLE');
});

test('CONTRADICTORY evidence marks the hypothesis CONTRADICTED — not silently kept', () => {
  const hypothesis = evaluateHypothesis(baseDraft, evidenceFor('CONTRADICTORY'));
  assert.equal(hypothesis.status, 'CONTRADICTED');
  assert.equal(hypothesis.confidenceState, 'CONTRADICTORY');
});

test('an invalid comparison basis is REJECTED regardless of evidence', () => {
  const invalid = {...baseDraft, invalidBasisReason: 'cross-domain comparison without normalized metrics'};
  const hypothesis = evaluateHypothesis(invalid, evidenceFor('STRONG'));
  assert.equal(hypothesis.status, 'REJECTED');
  assert.match(hypothesis.evaluationReason, /invalid comparison basis/);
});

test('the hypothesis carries its evidence ids sorted and its scope verbatim', () => {
  const draft = {...baseDraft,
    supporting: [fakeRecord('m2', 0.6), fakeRecord('m1', 0.6)],
    contradicting: [fakeRecord('c2', 0.9)]};
  const hypothesis = evaluateHypothesis(draft, evidenceFor('STRONG'));
  assert.deepEqual(hypothesis.supportingEvidenceIds, ['m1', 'm2']);
  assert.deepEqual(hypothesis.contradictingEvidenceIds, ['c2']);
  assert.deepEqual(hypothesis.scope, scope);
  assert.equal(hypothesis.sampleSize, 2);
});

test('hypothesis ids are content-derived and frozen', () => {
  const h1 = evaluateHypothesis(baseDraft, evidenceFor('STRONG'));
  const h2 = evaluateHypothesis(baseDraft, evidenceFor('STRONG'));
  assert.equal(h1.hypothesisId, h2.hypothesisId);
  assert.equal(h1.fingerprint, h2.fingerprint);
  assert.ok(Object.isFrozen(h1));
  assert.ok(h1.hypothesisId.startsWith('hyp_'));
});

test('different statements produce different hypotheses', () => {
  const other = evaluateHypothesis({...baseDraft, statement: 'A different claim.'}, evidenceFor('STRONG'));
  const original = evaluateHypothesis(baseDraft, evidenceFor('STRONG'));
  assert.notEqual(other.hypothesisId, original.hypothesisId);
});

test('correlation is never promoted to fact: statuses stay epistemic', () => {
  for (const hypothesis of result.hypotheses) {
    assert.ok(['PROPOSED', 'SUPPORTED', 'WEAKLY_SUPPORTED', 'CONTRADICTED',
      'INSUFFICIENT_EVIDENCE', 'REJECTED'].includes(hypothesis.status));
    assert.ok(!/proven|fact|certain/i.test(hypothesis.statement),
      `statements must stay hypothetical: ${hypothesis.statement}`);
    assert.ok(hypothesis.evaluationReason.length > 0);
  }
});

test('the corpus yields hypotheses across the epistemic spectrum', () => {
  const statuses = new Set(result.hypotheses.map((h) => h.status));
  assert.ok(statuses.has('SUPPORTED'), 'guardian direction is supported');
  assert.ok(statuses.has('CONTRADICTED'), 'aggressive direction is contradicted');
  assert.ok(statuses.has('REJECTED'), 'invalid bases are rejected');
  assert.ok(statuses.has('INSUFFICIENT_EVIDENCE'), 'under-sampled classes stay honest');
});

test('hypothesisPatternIds exposes the supporting evidence backbone', () => {
  const hypothesis: Hypothesis = result.hypotheses[0];
  assert.deepEqual(hypothesisPatternIds(hypothesis), hypothesis.supportingEvidenceIds);
  assert.ok(hypothesisPatternIds(hypothesis).length > 0);
});
