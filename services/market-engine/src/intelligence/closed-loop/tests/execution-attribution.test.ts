import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionAttribution} from '../execution';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — execution attribution tests (§11): consumes Sprint 034
 * performance intelligence; execution leakage where data permits.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('execution attribution consumes Sprint 034 observations', () => {
  const attr = executionAttribution(byLabel('healthy-execution'));
  assert.equal(attr.sessionId, byLabel('healthy-execution').session.session.sessionId);
  assert.ok(attr.attributionId.startsWith('patt_'), 'Sprint 034 attribution id carried through');
});

test('final state and quality flow from Sprint 034', () => {
  const attr = executionAttribution(byLabel('healthy-execution'));
  assert.equal(attr.finalState, 'COMPLETED');
  assert.ok(attr.executionQuality !== null && attr.executionQuality > 0);
});

test('fees are measured from the real session telemetry', () => {
  const attr = executionAttribution(byLabel('healthy-execution'));
  const fees = byLabel('healthy-execution').session.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  assert.ok(Math.abs(attr.fees - fees) < 1e-9);
});

test('adaptive action counts match the control session exactly', () => {
  for (const record of corpus.records) {
    const attr = executionAttribution(record);
    const cycles = record.session.session.cycles;
    const count = (a: string) => cycles.filter((c) => c.action === a).length;
    assert.equal(attr.rerouteCount, count('REROUTE'), `${record.label} reroute`);
    assert.equal(attr.repriceCount, count('REPRICE'), `${record.label} reprice`);
    assert.equal(attr.resliceCount, count('RESLICE'), `${record.label} reslice`);
    assert.equal(attr.replanCount, count('REPLAN'), `${record.label} replan`);
  }
});

test('oscillation record counts its reroutes', () => {
  const attr = executionAttribution(byLabel('oscillation-abort'));
  assert.equal(attr.rerouteCount, 3);
  assert.equal(attr.finalState, 'ABORTED');
});

test('adaptive-recovery record counts reslices and a reprice', () => {
  const attr = executionAttribution(byLabel('adaptive-recovery'));
  assert.equal(attr.resliceCount, 2);
  assert.equal(attr.repriceCount, 1);
});

test('execution leakage measures undelivered theoretical gross', () => {
  const attr = executionAttribution(byLabel('adverse-venue-drift'));
  assert.ok(attr.executionLeakage.value !== null);
  assert.ok(Math.abs(attr.executionLeakage.value! - 10.5) < 1e-6);
  assert.equal(attr.executionLeakage.provenance, 'MEASURED');
});

test('perfect execution delivers zero execution leakage', () => {
  const attr = executionAttribution(byLabel('steady-single'));
  assert.equal(attr.executionLeakage.value, 0);
});

test('slippage and impact flow from Sprint 034 attribution components', () => {
  const attr = executionAttribution(byLabel('adverse-venue-drift'));
  assert.ok(attr.slippage >= 0);
  assert.ok(attr.marketImpact >= 0);
});

test('failures are counted from rejection reasons and aborts', () => {
  const es = executionAttribution(byLabel('emergency-stop'));
  assert.ok(es.failureCount >= 1);
});

test('missing performance analysis degrades honestly — never fabricates', () => {
  const record = {...byLabel('healthy-execution'), performance: null};
  const attr = executionAttribution(record);
  assert.equal(attr.attributionId, 'unavailable');
  assert.equal(attr.slippage, 0);
  assert.equal(attr.executionQuality, null);
});

test('execution attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(executionAttribution(record).fingerprint, executionAttribution(record).fingerprint);
});
