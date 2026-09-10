import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policyAttribution} from '../policy-attribution';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — policy attribution tests (§14): policy versions, baseline,
 * candidate, quality, objective, realized result, policy delta. Policies are
 * never automatically activated.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('v1 records attribute the baseline policy', () => {
  const attr = policyAttribution(byLabel('healthy-execution'));
  assert.equal(attr.policyId, 'policy-execution');
  assert.equal(attr.policyVersion, 'v1');
  assert.equal(attr.baselinePolicyVersion, 'v1');
  assert.equal(attr.candidatePolicyVersion, null);
});

test('the v1.1 trial record carries the candidate policy version', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.equal(attr.policyVersion, 'v1.1');
  assert.equal(attr.baselinePolicyVersion, 'v1');
  assert.equal(attr.candidatePolicyVersion, 'v1.1');
});

test('policy objective comes from the Sprint 034 policy evaluation', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(attr.objective.value !== null);
  assert.equal(attr.objective.provenance, 'DERIVED');
});

test('policy delta compares the trial against the baseline policy score', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(attr.policyDelta.value !== null);
  assert.ok(attr.policyDelta.value! > 0, 'v1.1 scored above the v1 baseline on the policy corpus');
});

test('baseline records report a zero policy delta honestly', () => {
  const attr = policyAttribution(byLabel('healthy-execution'));
  assert.ok(Math.abs(attr.policyDelta.value!) < 1e-12);
});

test('realized result is the end-to-end realized net value', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(Math.abs(attr.realizedResult.value! + 3.11) < 1e-6);
});

test('the policy candidate improved execution but NOT end-to-end preservation', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(attr.policyDelta.value! > 0, 'execution metrics improved');
  assert.ok(attr.realizedResult.value! < 0, 'end-to-end value destroyed');
  assert.equal(attr.preservedEndToEndValue, false);
});

test('policy attribution never activates a policy — informational only', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.equal(Object.keys(attr).includes('activated'), false);
  assert.equal(Object.keys(attr).includes('deployed'), false);
});

test('policy quality flows from the Sprint 034 evaluation', () => {
  const attr = policyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(attr.quality !== null);
  assert.ok(attr.quality! >= 0 && attr.quality! <= 1);
});

test('missing performance analysis yields honest unavailable objective', () => {
  const record = {...byLabel('healthy-execution'), performance: null};
  const attr = policyAttribution(record);
  assert.equal(attr.objective.value, null);
  assert.equal(attr.objective.provenance, 'UNAVAILABLE');
  assert.equal(attr.baselinePolicyVersion, 'unknown');
});

test('policy attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(policyAttribution(record).fingerprint, policyAttribution(record).fingerprint);
});

test('every corpus record attributes its session policy version', () => {
  for (const record of corpus.records) {
    assert.equal(policyAttribution(record).policyVersion, record.session.policyVersion);
  }
});
