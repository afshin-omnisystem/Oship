import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strategyAttribution} from '../strategy';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — opportunity-to-strategy attribution tests (§8). The Strategy
 * Registry is never modified.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('strategy attribution tracks original, expected and realized value', () => {
  const attr = strategyAttribution(byLabel('healthy-execution'));
  assert.equal(attr.strategyId, 'arb-guardian');
  assert.ok(Math.abs(attr.originalOpportunityValue - 6.4) < 1e-9);
  assert.equal(attr.strategyExpectedValue, byLabel('healthy-execution').strategyDecision.expectedValue);
  assert.ok(attr.strategyRealizedValue.value !== null);
});

test('strategy leakage quantifies value the strategy left on the table', () => {
  const attr = strategyAttribution(byLabel('healthy-execution'));
  assert.ok(attr.strategyLeakage.value !== null);
  assert.ok(attr.strategyLeakage.value! >= 0);
  // The fixture strategies expect exactly the theoretical net → zero leakage.
  assert.ok(Math.abs(attr.strategyLeakage.value!) < 1e-9);
});

test('execution success reflects the control session outcome', () => {
  assert.equal(strategyAttribution(byLabel('healthy-execution')).executionSuccess, true);
  assert.equal(strategyAttribution(byLabel('emergency-stop')).executionSuccess, false);
});

test('adaptation frequency counts adaptive actions over cycles', () => {
  const recovery = strategyAttribution(byLabel('adaptive-recovery'));
  const cycles = byLabel('adaptive-recovery').session.session.cycles;
  const adaptive = cycles.filter((c) => ['REPRICE', 'RESLICE', 'REROUTE', 'REPLAN'].includes(c.action)).length;
  assert.equal(recovery.adaptationFrequency, adaptive / cycles.length);
  assert.ok(recovery.adaptationFrequency > 0);
});

test('strategy quality comes from Sprint 034 when available', () => {
  const attr = strategyAttribution(byLabel('healthy-execution'));
  assert.ok(attr.strategyQuality.value !== null);
  assert.ok(attr.strategyQuality.value! >= 0 && attr.strategyQuality.value! <= 1);
  assert.equal(attr.strategyQuality.provenance, 'DERIVED');
});

test('strategy benchmark delta compares realized vs expected', () => {
  const attr = strategyAttribution(byLabel('steady-single'));
  assert.ok(Math.abs(attr.benchmarkDelta.value! - 0) < 1e-9);
});

test('failed execution makes strategy realized value negative or zero honestly', () => {
  const attr = strategyAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(attr.strategyRealizedValue.value! < 0);
});

test('the Strategy Registry is never touched — attribution is read-only', () => {
  const record = byLabel('healthy-execution');
  const before = JSON.stringify(record.strategyDecision);
  strategyAttribution(record);
  assert.equal(JSON.stringify(record.strategyDecision), before);
});

test('strategy attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(strategyAttribution(record).fingerprint, strategyAttribution(record).fingerprint);
});

test('both strategies appear across the corpus', () => {
  const strategies = new Set(corpus.records.map((r) => strategyAttribution(r).strategyId));
  assert.deepEqual([...strategies].sort(), ['arb-aggressive', 'arb-guardian', 'sports-arb-strategy']);
});

test('strategy attribution never fabricates when quality is absent', () => {
  const record = {...byLabel('healthy-execution'), performance: null};
  const attr = strategyAttribution(record);
  assert.equal(attr.strategyQuality.value, null);
  assert.equal(attr.strategyQuality.provenance, 'UNAVAILABLE');
});

test('original opportunity value scales with deployed capital', () => {
  const attr = strategyAttribution(byLabel('risk-throttled'));
  assert.ok(Math.abs(attr.originalOpportunityValue - 8.4 * 0.4) < 1e-9);
});
