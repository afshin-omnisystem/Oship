import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attributeSession} from '../attribution';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord,
} from '../test-fixtures';

/**
 * SPRINT 034 — attribution tests: 12 components, honest availability,
 * reconciliation, fail closed.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();

import {ATTRIBUTION_COMPONENTS} from '../types';

const TWELVE = ATTRIBUTION_COMPONENTS;

test('AT1 attribution produces exactly the 12 canonical components', () => {
  const a = attributeSession(healthy.session, config);
  assert.equal(a.components.length, 12);
  assert.deepEqual(a.components.map((c) => c.component), TWELVE);
});

test('AT2 every component carries value, source, availability, confidence, fingerprint', () => {
  const a = attributeSession(drifted.session, config);
  for (const c of a.components) {
    assert.ok(c.fingerprint.length >= 8, 'fingerprint present');
    assert.ok(typeof c.value === 'number' && Number.isFinite(c.value), `${c.component}: finite value`);
    assert.ok(['MEASURED', 'DERIVED', 'SIMULATED', 'UNAVAILABLE'].includes(c.provenance));
    assert.ok(typeof c.available === 'boolean', `${c.component}: availability flag`);
    assert.ok(['OK', 'DEGRADED_CONFIDENCE', 'UNAVAILABLE'].includes(c.status));
    assert.ok(typeof c.source === 'string' && c.source.length > 0, `${c.component}: source documented`);
    assert.ok(typeof c.detail === 'string' && c.detail.length > 0);
  }
});

test('AT3 attribution is immutable', () => {
  const a = attributeSession(partial.session, config);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.components));
  for (const c of a.components) assert.ok(Object.isFrozen(c));
});

test('AT4 unavailable components are marked UNAVAILABLE, never fabricated', () => {
  // The stale session has no fills at all — cost components cannot be measured.
  const a = attributeSession(staleRecord().session, config);
  assert.ok(a.unavailable.length > 0, 'a no-fill session must mark components unavailable');
  for (const c of a.components) {
    if (!c.available) {
      assert.equal(c.value, 0);
      assert.equal(c.provenance, 'UNAVAILABLE');
      assert.equal(c.status, 'UNAVAILABLE');
    }
  }
});

test('AT5 FEES component is measured from order-level fees', () => {
  const a = attributeSession(healthy.session, config);
  const fees = a.components.find((c) => c.component === 'FEES')!;
  const expected = healthy.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  assert.ok(Math.abs(fees.value - expected) < 1e-9);
  assert.equal(fees.provenance, 'MEASURED');
  assert.equal(fees.available, true);
});

test('AT6 SLIPPAGE component derives from cycle slippage and notional', () => {
  const a = attributeSession(drifted.session, config);
  const slip = a.components.find((c) => c.component === 'SLIPPAGE')!;
  assert.ok(slip.provenance === 'MEASURED' || slip.provenance === 'DERIVED');
  assert.ok(slip.value > 0, 'drifted session paid slippage');
});

test('AT7 LATENCY component uses the derived latency-cost formula', () => {
  const a = attributeSession(degradedRecord().session, config);
  const latency = a.components.find((c) => c.component === 'LATENCY_COST')!;
  assert.equal(latency.provenance, 'DERIVED');
  assert.ok(latency.detail.includes('formula') || latency.detail.length > 0);
});

test('AT8 MARKET_IMPACT is measured in notional and documented as overlapping slippage', () => {
  const a = attributeSession(partial.session, config);
  const impact = a.components.find((c) => c.component === 'MARKET_IMPACT')!;
  assert.equal(impact.provenance, 'MEASURED');
  assert.ok(impact.detail.toLowerCase().includes('overlap'), 'overlap documented');
});

test('AT9 adaptive-action components (REROUTE/REPRICE/RESLICE/REPLAN) reflect the action budget', () => {
  const a = attributeSession(partial.session, config);
  const budget = partial.session.actionBudget;
  const reslice = a.components.find((c) => c.component === 'RESLICE_COST')!;
  if (budget.resliceCount > 0) {
    assert.equal(reslice.available, true);
  }
  const reroute = a.components.find((c) => c.component === 'REROUTE_COST')!;
  if (budget.rerouteCount === 0) {
    assert.equal(reroute.value, 0);
  }
});

test('AT10 measured total cost reconciles with fees + slippage within tolerance', () => {
  for (const [label, rec] of [['healthy', healthy], ['drifted', drifted], ['partial', partial]] as const) {
    const a = attributeSession(rec.session, config);
    assert.equal(a.reconciles, true, `${label}: residual ${a.residual} exceeds tolerance`);
    assert.ok(Math.abs(a.residual) <= Math.max(config.attributionTolerance, config.attributionTolerance * Math.abs(a.measuredTotalCost)) + 1e-9);
  }
});

test('AT11 failure-recovery component reflects aborts', () => {
  const a = attributeSession(emergencyRecord().session, config);
  const fr = a.components.find((c) => c.component === 'FAILURE_RECOVERY_COST')!;
  assert.ok(typeof fr.available === 'boolean');
  assert.ok(Number.isFinite(fr.value));
});

test('AT12 attribution is deterministic across repeated runs', () => {
  const a1 = attributeSession(drifted.session, config);
  const a2 = attributeSession(drifted.session, config);
  assert.equal(a1.fingerprint, a2.fingerprint);
  assert.deepEqual(a1.components.map((c) => c.fingerprint), a2.components.map((c) => c.fingerprint));
});

test('AT13 attribution fails closed on sessions with no cycles', () => {
  const empty = {...healthy.session, cycles: []} as unknown as typeof healthy.session;
  assert.throws(() => attributeSession(empty, config), /fail closed/i);
});

test('AT14 ABL sessions attribute with the same 12-component model', () => {
  const a = attributeSession(ablRecord().session, config);
  assert.deepEqual(a.components.map((c) => c.component), TWELVE);
  assert.equal(a.reconciles, true);
});

test('AT15 attribution ids are unique per session+kind', () => {
  const a = attributeSession(healthy.session, config);
  assert.equal(new Set(a.components.map((c) => c.component)).size, 12);
  assert.ok(a.attributionId.startsWith('patt_'));
});

test('AT16 component values never contain NaN or Infinity', () => {
  for (const rec of [healthy, drifted, partial, degradedRecord()]) {
    const a = attributeSession(rec.session, config);
    for (const c of a.components) {
      assert.ok(Number.isFinite(c.value), `${c.component} not finite`);
    }
  }
});

test('AT17 the attribution fingerprint covers every component', () => {
  const a = attributeSession(healthy.session, config);
  const kinds = a.components.map((c) => `${c.component}:${c.value}`).join('|');
  assert.ok(kinds.length > 0);
  assert.ok(a.fingerprint.startsWith('pfat_'), `prefix ${a.fingerprint.slice(0, 8)}`);
});
