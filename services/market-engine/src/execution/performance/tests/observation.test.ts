import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSession, normalizeCorpus, validateSessionTelemetry,
  validateCycleTelemetry, observationOutcome,
} from '../normalization';
import {observationsOfSession, observationsOfVenue, observationsAreFrozen, observedVenues, observationsWithOutcome} from '../observation';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord, perfRecord, perfPlan, healthyCycle, driftedCycle, thinCycle,
} from '../test-fixtures';
import type {ExecutionControlSession} from '../../control/types';

/**
 * SPRINT 034 — observation tests: immutable, sourced, fail-closed.
 */

const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();
const degraded = degradedRecord();
const es = emergencyRecord();
const stale = staleRecord();
const abl = ablRecord();
const flip = flipFlopRecord(7);

test('OB1 normalization produces one observation per cycle×venue pair', () => {
  const obs = normalizeSession(healthy);
  for (const o of obs) {
    assert.ok(o.observationId.startsWith('pobs_'), `id prefix: ${o.observationId}`);
    assert.ok(o.fingerprint.startsWith('pfpo_'));
  }
  // healthy record completes on the first cycle: 1 cycle × 2 venues
  assert.equal(healthy.session.cycles.length, 1);
  assert.equal(obs.length, 2);
  assert.equal(new Set(obs.map((o) => o.observationId)).size, 2);
});

test('OB2 observations are deeply frozen (immutable)', () => {
  for (const [label, rec] of [['healthy', healthy], ['drifted', drifted], ['partial', partial], ['flip', flip]] as const) {
    const obs = normalizeSession(rec);
    assert.ok(Object.isFrozen(obs), `${label}: array frozen`);
    assert.ok(observationsAreFrozen(obs), `${label}: every observation frozen`);
    for (const o of obs) {
      assert.ok(Object.isFrozen(o.plannedPrice) && Object.isFrozen(o.executionPrice) && Object.isFrozen(o.benchmarkPrice));
    }
  }
});

test('OB3 every observation carries all required fields', () => {
  const obs = normalizeSession(drifted);
  assert.ok(obs.length > 0);
  for (const o of obs) {
    for (const field of [
      'observationId', 'fingerprint', 'sessionId', 'cycleId', 'planId', 'rootPlanId',
      'domain', 'strategyId', 'policyId', 'policyVersion', 'venue', 'market', 'side',
      'plannedQuantity', 'filledQuantity', 'remainingQuantity', 'fillRatio',
      'plannedPrice', 'executionPrice', 'benchmarkPrice', 'fees', 'slippageBps',
      'marketImpact', 'latencyMs', 'partialFillCount', 'rejectionRatio',
      'executionDurationMs', 'failure', 'finalState', 'action', 'timestamp',
    ] as const) {
      assert.ok(field in o, `missing field ${field}`);
    }
  }
});

test('OB4 outcome mapping: COMPLETED for completed sessions', () => {
  assert.equal(observationOutcome(healthy.session as ExecutionControlSession), 'COMPLETED');
  assert.equal(observationOutcome(drifted.session as ExecutionControlSession), 'COMPLETED');
});

test('OB5 outcome mapping: ABORTED for aborted sessions', () => {
  assert.equal(observationOutcome(es.session as ExecutionControlSession), 'ABORTED');
  assert.equal(observationOutcome(stale.session as ExecutionControlSession), 'ABORTED');
  assert.equal(observationOutcome(flip.session as ExecutionControlSession), 'ABORTED');
});

test('OB6 outcome mapping: EXHAUSTED→PARTIAL when partially filled, else EXHAUSTED', () => {
  // A thin world that runs out of cycles with a remainder: exhausted + partial.
  const plan = perfPlan({planId: 'xplan_obs_exh', quantity: 10, referencePrice: 100});
  const rec = perfRecord({
    label: 'exhausted',
    plan,
    cycles: [thinCycle('e0', plan, 100, 3), thinCycle('e1', plan, 100, 3), thinCycle('e2', plan, 100, 3)],
  });
  const fr = rec.session.finalResult!;
  assert.equal(fr.finalState, 'EXHAUSTED', `expected EXHAUSTED, got ${fr.finalState}/${fr.abortReason}`);
  assert.ok(fr.filledQuantity > 0, 'partially filled');
  assert.ok(fr.remainingQuantity > 0, 'remainder left');
  assert.equal(observationOutcome(rec.session as ExecutionControlSession), 'PARTIAL');
});

test('OB7 cycle telemetry validation accepts healthy cycles', () => {
  const v = validateCycleTelemetry(healthy.session.cycles[0]!.telemetry);
  assert.equal(v.valid, true);
  assert.deepEqual(v.violations, []);
});

test('OB8 session telemetry validation accepts all fixture sessions', () => {
  for (const [label, rec] of [['healthy', healthy], ['partial', partial], ['es', es], ['stale', stale], ['abl', abl]] as const) {
    const v = validateSessionTelemetry(rec.session as ExecutionControlSession);
    assert.equal(v.valid, true, `${label}: ${v.violations.join('; ')}`);
  }
});

test('OB9 invalid telemetry fails closed (negative filled quantity)', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, filledQuantity: -5}};
  const v = validateCycleTelemetry(bad.telemetry);
  assert.equal(v.valid, false);
  assert.ok(v.violations.length > 0);
});

test('OB10 invalid telemetry fails closed (NaN slippage)', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, slippageBps: Number.NaN}};
  const v = validateCycleTelemetry(bad.telemetry);
  assert.equal(v.valid, false);
});

test('OB11 normalization throws on invalid telemetry (never fabricates)', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, benchmarkPrice: Number.NaN}};
  const badSession = {...healthy.session, cycles: [bad]} as unknown as typeof healthy.session;
  assert.throws(() => normalizeSession({label: 'bad', session: badSession, replayInput: null, policyId: 'p', policyVersion: 'v1'}), /fail closed/i);
});

test('OB12 observation lookups: by session and by venue', () => {
  const obs = normalizeCorpus([healthy, drifted]);
  const healthyObs = observationsOfSession(obs, healthy.session.sessionId);
  assert.ok(healthyObs.length > 0);
  assert.ok(healthyObs.every((o) => o.sessionId === healthy.session.sessionId));
  const aObs = observationsOfVenue(obs, 'venue-a');
  assert.ok(aObs.length > 0);
  assert.ok(aObs.every((o) => o.venue === 'venue-a'));
  assert.equal(observationsOfSession(obs, 'no-such-session').length, 0);
});

test('OB13 observedVenues is deterministic and sorted', () => {
  const obs = normalizeCorpus([healthy, abl]);
  const venues = observedVenues(obs);
  assert.deepEqual(venues, [...venues].sort((a, b) => a.localeCompare(b)));
  assert.ok(venues.includes('venue-a'));
  assert.ok(venues.includes('venue-b'));
});

test('OB14 observationsWithOutcome filters by final outcome', () => {
  const obs = normalizeCorpus([healthy, es]);
  const completed = observationsWithOutcome(obs, 'COMPLETED');
  const aborted = observationsWithOutcome(obs, 'ABORTED');
  assert.ok(completed.length > 0);
  assert.ok(aborted.length > 0);
  assert.ok(completed.every((o) => o.finalState === 'COMPLETED'));
  assert.ok(aborted.every((o) => o.finalState === 'ABORTED'));
});

test('OB15 fingerprints are stable across repeated normalization', () => {
  const a = normalizeSession(degraded);
  const b = normalizeSession(degraded);
  assert.deepEqual(a.map((o) => o.fingerprint), b.map((o) => o.fingerprint));
});

test('OB16 sourcing: execution prices come from measured fills or are UNAVAILABLE', () => {
  const obs = normalizeSession(stale);
  for (const o of obs) {
    if (o.executionPrice.value === null) {
      assert.equal(o.executionPrice.status, 'UNAVAILABLE');
      assert.equal(o.executionPrice.provenance, 'UNAVAILABLE');
    } else {
      assert.notEqual(o.executionPrice.provenance, 'UNAVAILABLE');
      assert.ok(Number.isFinite(o.executionPrice.value));
    }
  }
});

test('OB17 partial fills are visible in observations (thin world)', () => {
  const obs = normalizeSession(partial);
  // The partial world fills 3 of 10 per cycle before reslicing — the
  // observation-level fill ratio must show the partial fill honestly.
  assert.ok(obs.some((o) => o.fillRatio < 1 && o.fillRatio > 0));
  assert.ok(obs.every((o) => o.filledQuantity <= o.plannedQuantity));
});

test('OB18 degradation is visible in observations', () => {
  const obs = normalizeSession(degraded);
  const first = obs.find((o) => o.cycleId === degraded.session.cycles[0]!.cycleId);
  assert.ok(first !== undefined);
  assert.ok(first.latencyMs > 100, `degraded cycle latency ${first.latencyMs}ms`);
});

test('OB19 policy context is carried on every observation', () => {
  const rec = perfRecord({
    label: 'ctx',
    plan: perfPlan({planId: 'xplan_obs_ctx'}),
    cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_obs_ctx'}))],
    policyId: 'policy-x',
    policyVersion: 'v9',
  });
  const obs = normalizeSession(rec);
  assert.ok(obs.length > 0);
  for (const o of obs) {
    assert.equal(o.policyId, 'policy-x');
    assert.equal(o.policyVersion, 'v9');
  }
});

test('OB20 normalizeCorpus preserves record order deterministically', () => {
  const a = normalizeCorpus([healthy, drifted, partial]);
  const b = normalizeCorpus([healthy, drifted, partial]);
  assert.deepEqual(
    a.map((o) => o.observationId),
    b.map((o) => o.observationId),
  );
  assert.equal(a.length, normalizeSession(healthy).length + normalizeSession(drifted).length + normalizeSession(partial).length);
});
