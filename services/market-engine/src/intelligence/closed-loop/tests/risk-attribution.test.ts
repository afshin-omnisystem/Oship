import {test} from 'node:test';
import assert from 'node:assert/strict';
import {riskAttribution} from '../risk';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — risk attribution tests (§10): protective vs rejected vs
 * constrained; Risk is NEVER scored by realized profit alone.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('unconstrained record reports NO_CONSTRAINT', () => {
  const attr = riskAttribution(byLabel('healthy-execution'));
  assert.equal(attr.impactKind, 'NO_CONSTRAINT');
  assert.equal(attr.constrainedValue, 0);
});

test('risk-throttled record reports PROTECTIVE_CONSTRAINT', () => {
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.equal(attr.impactKind, 'PROTECTIVE_CONSTRAINT');
  assert.ok(attr.constrainedValue > 0);
  assert.ok(attr.riskInducedLeakage.value !== null);
  assert.ok(attr.riskInducedLeakage.value! > 0);
});

test('theoretical value before risk scales with allocated capital', () => {
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.ok(Math.abs(attr.theoreticalValueBeforeRisk - 8.4) < 1e-9);
});

test('theoretical value after risk scales with approved capital', () => {
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.ok(Math.abs(attr.theoreticalValueAfterRisk - 8.4 * 0.4) < 1e-9);
});

test('protected value quantifies what Risk kept out of harm', () => {
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.ok(attr.protectedValue.value! > 0);
  assert.equal(attr.protectedValue.provenance, 'DERIVED');
});

test('rejected value is zero unless the risk decision blocks outright', () => {
  for (const record of corpus.records) {
    const attr = riskAttribution(record);
    if (record.risk.scale === 'BLOCKED') {
      assert.ok(attr.rejectedValue > 0);
      assert.equal(attr.impactKind, 'OPPORTUNITY_REJECTION');
    } else {
      assert.equal(attr.rejectedValue, 0);
    }
  }
});

test('risk boundary preservation is verified, not assumed', () => {
  for (const record of corpus.records) {
    const attr = riskAttribution(record);
    assert.equal(attr.riskPreservedBoundary, true, `${record.label}`);
  }
});

test('risk attribution never judges Risk by realized profit', () => {
  // Even the value-destroying records keep protective classification when the
  // constraint was protective — the metric is boundary-based, not pnl-based.
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.notEqual(attr.impactKind, 'EXECUTION_LOSS');
});

test('violations are carried through verbatim', () => {
  const attr = riskAttribution(byLabel('risk-throttled'));
  assert.deepEqual(attr.violations, ['MAX_OPPORTUNITY_EXPOSURE']);
});

test('risk score is a boundary measurement, always in [0,1]', () => {
  for (const record of corpus.records) {
    const attr = riskAttribution(record);
    assert.ok(attr.riskScore >= 0 && attr.riskScore <= 1, `${record.label}`);
    assert.equal(attr.riskScore, record.risk.riskScore);
  }
});

test('risk attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(riskAttribution(record).fingerprint, riskAttribution(record).fingerprint);
});

test('risk attribution is read-only over the risk decision', () => {
  const record = byLabel('risk-throttled');
  const before = JSON.stringify(record.risk);
  riskAttribution(record);
  assert.equal(JSON.stringify(record.risk), before);
});
