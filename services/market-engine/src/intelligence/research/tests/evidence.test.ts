import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidence, metricMean} from '../evidence';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import type {MemoryRecord} from '../types';

/**
 * SPRINT 036 — evidence evaluation tests (§11): scoring considers provenance,
 * sample, consistency and contradiction; UNAVAILABLE never contributes; no
 * invented confidence — a null score exactly when nothing is admissible.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const result = new ResearchEngine().analyze(history.input);

function fakeRecord(overrides: Partial<MemoryRecord> & {memoryId: string}): MemoryRecord {
  return {
    sourceId: 'src', sourceType: 'closed-loop.v1', sourceFingerprint: 'f',
    domain: 'AFIS', opportunityId: 'opp', opportunityClass: 'cross-venue-arbitrage',
    semanticSide: 'BUY', strategyId: 's', venues: ['venue-a'], policyId: 'p',
    policyVersion: 'v1', timestamp: 1, timeBucket: 'tb_1', provenance: 'DERIVED',
    schemaVersion: 'research.memory.v1', configurationFingerprint: 'c',
    contentFingerprint: 'cf', status: 'ACTIVE', lineage: null as never,
    values: null as never, evidence: null as never, ...overrides,
  } as unknown as MemoryRecord;
}

function recordWith(memoryId: string, ratio: number | null, provenance: MemoryRecord['provenance'],
  confidence = 0.9, leakage = 1): MemoryRecord {
  return fakeRecord({
    memoryId,
    provenance,
    evidence: {confidence, state: 'WEAK'} as never,
    values: {preservationRatio: ratio, realizedNet: ratio === null ? null : ratio * 10,
      totalLeakage: leakage, provenance: provenance === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DERIVED'} as never,
  });
}

test('no admissible evidence yields UNAVAILABLE with a null score', () => {
  const evaluation = evaluateEvidence({subject: 's', supporting: [], contradicting: [], metric: 'preservation'}, config);
  assert.equal(evaluation.state, 'UNAVAILABLE');
  assert.equal(evaluation.score, null);
  assert.match(evaluation.reason, /no admissible/);
});

test('UNAVAILABLE records never contribute numerical evidence', () => {
  const unavailable = [recordWith('m1', 0.5, 'UNAVAILABLE'), recordWith('m2', 0.7, 'UNAVAILABLE')];
  const evaluation = evaluateEvidence({subject: 's', supporting: unavailable, contradicting: [], metric: 'preservation'}, config);
  assert.equal(evaluation.state, 'UNAVAILABLE');
  assert.equal(evaluation.supportingCount, 0);
  assert.equal(evaluation.score, null);
});

test('a sample below the minimum is INSUFFICIENT — never a conclusion', () => {
  const small = Array.from({length: config.minSampleSize - 1},
    (_, i) => recordWith(`m${i}`, 0.5, 'DERIVED'));
  const evaluation = evaluateEvidence({subject: 's', supporting: small, contradicting: [], metric: 'preservation'}, config);
  assert.equal(evaluation.state, 'INSUFFICIENT');
  assert.equal(evaluation.score, null);
  assert.match(evaluation.reason, /sample/);
});

test('a large consistent MEASURED population yields a strong state', () => {
  const consistent = Array.from({length: config.evidenceFullSample},
    (_, i) => recordWith(`m${i}`, 0.5 + (i % 2) * 0.001, 'MEASURED', 1));
  const evaluation = evaluateEvidence({subject: 's', supporting: consistent, contradicting: [], metric: 'preservation'}, config);
  assert.equal(evaluation.state, 'STRONG');
  assert.ok(evaluation.score! >= config.strongEvidenceThreshold);
});

test('contradiction requires the opposing mean to beat the supporting mean', () => {
  const supporting = Array.from({length: 20}, (_, i) => recordWith(`s${i}`, 0.1, 'MEASURED', 1));
  const contradicting = Array.from({length: 20}, (_, i) => recordWith(`c${i}`, 0.9, 'MEASURED', 1));
  const evaluation = evaluateEvidence({subject: 'claim A better', supporting, contradicting, metric: 'preservation'}, config);
  assert.equal(evaluation.state, 'CONTRADICTORY');
  assert.equal(evaluation.score, 0);
  assert.match(evaluation.reason, /opposing mean/);
});

test('an opposing population with a LOWER mean does not contradict a claim', () => {
  const supporting = Array.from({length: 20}, (_, i) => recordWith(`s${i}`, 0.9, 'MEASURED', 1));
  const opposing = Array.from({length: 26}, (_, i) => recordWith(`c${i}`, 0.1, 'MEASURED', 1));
  const evaluation = evaluateEvidence({subject: 'claim A better', supporting, contradicting: opposing, metric: 'preservation'}, config);
  assert.notEqual(evaluation.state, 'CONTRADICTORY');
});

test('a tiny contradicting sample cannot trigger contradiction', () => {
  const supporting = Array.from({length: 20}, (_, i) => recordWith(`s${i}`, 0.1, 'MEASURED', 1));
  const contradicting = [recordWith('c0', 0.9, 'MEASURED', 1)];
  const evaluation = evaluateEvidence({subject: 's', supporting, contradicting, metric: 'preservation'}, config);
  assert.notEqual(evaluation.state, 'CONTRADICTORY');
});

test('contributors are weighted by provenance and sorted deterministically', () => {
  const mixed = [recordWith('m_est', 0.5, 'ESTIMATED', 1), recordWith('m_meas', 0.5, 'MEASURED', 1)];
  const evaluation = evaluateEvidence({subject: 's', supporting: mixed, contradicting: [], metric: 'preservation'}, config);
  assert.equal(evaluation.contributors.length, 2);
  assert.ok(evaluation.contributors[0].weight >= evaluation.contributors[1].weight);
  assert.ok(evaluation.contributors[0].weight > 0);
});

test('evidence evaluation is deterministic', () => {
  const supporting = result.memory.records.filter((r) => r.strategyId === 'arb-guardian');
  const e1 = evaluateEvidence({subject: 'guardian preservation', supporting, contradicting: [], metric: 'preservation'}, config);
  const e2 = evaluateEvidence({subject: 'guardian preservation', supporting, contradicting: [], metric: 'preservation'}, config);
  assert.equal(e1.evaluationId, e2.evaluationId);
  assert.equal(e1.fingerprint, e2.fingerprint);
});

test('metricMean averages preservation, realized net and leakage honestly', () => {
  const records = [recordWith('a', 0.5, 'DERIVED', 0.9, 2), recordWith('b', 0.7, 'DERIVED', 0.9, 4)];
  assert.ok(Math.abs(metricMean(records, 'preservation')! - 0.6) < 1e-9);
  assert.ok(Math.abs(metricMean(records, 'realizedNet')! - 6) < 1e-9);
  assert.equal(metricMean(records, 'leakage'), 3);
});

test('metricMean returns null when nothing is present', () => {
  assert.equal(metricMean([], 'preservation'), null);
  assert.equal(metricMean([recordWith('a', null, 'DERIVED')], 'preservation'), null);
});

test('the engine emits an evidence evaluation per hypothesis', () => {
  assert.equal(result.evidence.length, result.hypotheses.length);
  for (const evaluation of result.evidence) {
    assert.ok(evaluation.evaluationId.startsWith('evd_'));
    assert.ok(['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT', 'UNKNOWN',
      'CONTRADICTORY', 'UNAVAILABLE'].includes(evaluation.state));
  }
});
