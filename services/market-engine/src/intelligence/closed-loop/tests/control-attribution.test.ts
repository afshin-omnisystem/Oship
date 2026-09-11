import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlAttribution} from '../control';
import {closedLoopCorpus} from '../test-fixtures';
import {CLOSED_LOOP_ACTIONS} from '../types';

/**
 * SPRINT 035 — control attribution tests (§12): per-action occurrence,
 * trigger, pre/post quality, value/cost deltas, completion impact.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('every action count key starts at zero and counts real actions', () => {
  for (const record of corpus.records) {
    const attr = controlAttribution(record);
    for (const action of CLOSED_LOOP_ACTIONS) {
      assert.ok(typeof attr.actionCounts[action] === 'number');
    }
    const total = Object.values(attr.actionCounts).reduce((s, n) => s + n, 0);
    assert.equal(total, record.session.session.cycles.length, `${record.label}: every cycle attributed`);
  }
});

test('occurrences carry trigger and cycle identity', () => {
  const attr = controlAttribution(byLabel('adaptive-recovery'));
  assert.ok(attr.occurrences.length === 3);
  for (const occ of attr.occurrences) {
    assert.ok(occ.cycleId.length > 0);
    assert.ok(occ.trigger.length > 0);
    assert.ok(occ.cycleNumber >= 0);
  }
});

test('pre/post action quality and quality delta are tracked', () => {
  const attr = controlAttribution(byLabel('adaptive-recovery'));
  const first = attr.occurrences[0];
  assert.equal(first.preActionQuality, null, 'first cycle has no prior');
  const second = attr.occurrences[1];
  assert.ok(second.preActionQuality !== null);
  assert.ok(second.postActionQuality !== null);
  assert.ok(Math.abs(second.qualityDelta! - (second.postActionQuality! - second.preActionQuality!)) < 1e-12);
});

test('adaptive-recovery shows improving adaptive actions', () => {
  const attr = controlAttribution(byLabel('adaptive-recovery'));
  assert.ok(attr.adaptiveActionImprovements >= 2, 'reslices improved quality');
  assert.equal(attr.adaptiveActionDegradations, 0);
});

test('oscillation record shows the reroute storm', () => {
  const attr = controlAttribution(byLabel('oscillation-abort'));
  assert.equal(attr.actionCounts.REROUTE, 3);
  assert.equal(attr.actionCounts.ABORT, 1);
  assert.equal(attr.finalState, 'ABORTED');
});

test('completion impact marks COMPLETE +1 and ABORT −1', () => {
  const healthy = controlAttribution(byLabel('healthy-execution'));
  const complete = healthy.occurrences.find((o) => o.action === 'COMPLETE')!;
  assert.equal(complete.completionImpact, 1);
  const es = controlAttribution(byLabel('emergency-stop'));
  const abort = es.occurrences.find((o) => o.action === 'ABORT')!;
  assert.equal(abort.completionImpact, -1);
});

test('cost delta is the measured cycle fee', () => {
  const attr = controlAttribution(byLabel('healthy-execution'));
  const cycle = byLabel('healthy-execution').session.session.cycles[0];
  const occ = attr.occurrences[0];
  assert.ok(Math.abs(occ.costDelta.value! - cycle.telemetry.fees) < 1e-12);
  assert.equal(occ.costDelta.provenance, 'DERIVED');
});

test('value delta is honest about its quality-resolution provenance', () => {
  const attr = controlAttribution(byLabel('adaptive-recovery'));
  const second = attr.occurrences[1];
  assert.ok(second.valueDelta.provenance === 'DERIVED');
  assert.equal(second.valueDelta.status, 'DEGRADED_CONFIDENCE');
});

test('improved flag reflects the quality delta', () => {
  const attr = controlAttribution(byLabel('adaptive-recovery'));
  const reprice = attr.occurrences.find((o) => o.action === 'REPRICE')!;
  assert.equal(reprice.improved, true);
});

test('emergency stop cycle appears as an ABORT occurrence', () => {
  const attr = controlAttribution(byLabel('emergency-stop'));
  const abort = attr.occurrences.find((o) => o.action === 'ABORT');
  assert.ok(abort);
});

test('cycles executed matches the session', () => {
  for (const record of corpus.records) {
    assert.equal(controlAttribution(record).cyclesExecuted, record.session.session.cycles.length);
  }
});

test('control attribution never mutates the control session', () => {
  const record = byLabel('oscillation-abort');
  const before = JSON.stringify(record.session.session.cycles.map((c) => c.action));
  controlAttribution(record);
  assert.equal(JSON.stringify(record.session.session.cycles.map((c) => c.action)), before);
});

test('control attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(controlAttribution(record).fingerprint, controlAttribution(record).fingerprint);
});

test('stale abort with no fills still attributes its ABORT action', () => {
  const attr = controlAttribution(byLabel('stale-intel'));
  assert.equal(attr.actionCounts.ABORT, 1);
});
