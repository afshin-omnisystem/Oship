import test from 'node:test';
import assert from 'node:assert/strict';

import {chooseRecovery, actionAdvancesExecution} from './recovery';

// ---------- Recovery decision mapping ----------

test('REC01 venue unavailable → REROUTE', () => {
  const r = chooseRecovery('VENUE_UNAVAILABLE');
  assert.equal(r.action, 'REROUTE');
  assert.equal(r.respectAegis, true);
  assert.equal(r.respectTreasury, true);
});

test('REC02 venue degraded → REROUTE', () => {
  const r = chooseRecovery('VENUE_DEGRADED');
  assert.equal(r.action, 'REROUTE');
});

test('REC03 partial fill → REPRICE', () => {
  const r = chooseRecovery('PARTIAL_FILL');
  assert.equal(r.action, 'REPRICE');
});

test('REC04 thin liquidity → REPLAN', () => {
  const r = chooseRecovery('THIN_LIQUIDITY');
  assert.equal(r.action, 'REPLAN');
  assert.equal(r.requiresNewPlan, true);
});

test('REC05 empty book → CANCEL_REMAINDER', () => {
  const r = chooseRecovery('EMPTY_BOOK');
  assert.equal(r.action, 'CANCEL_REMAINDER');
});

test('REC06 price moved → REPRICE', () => {
  const r = chooseRecovery('PRICE_MOVED');
  assert.equal(r.action, 'REPRICE');
});

test('REC07 market halt → ABORT', () => {
  const r = chooseRecovery('MARKET_HALT');
  assert.equal(r.action, 'ABORT');
  assert.equal(r.requiresNewPlan, true);
});

test('REC08 atomic incomplete → uses defaultAction', () => {
  const r = chooseRecovery('ATOMIC_INCOMPLETE', 'HEDGE');
  assert.equal(r.action, 'HEDGE');
});

test('REC09 atomic incomplete default REROUTE', () => {
  const r = chooseRecovery('ATOMIC_INCOMPLETE');
  assert.equal(r.action, 'REROUTE');
});

test('REC10 order rejected → ABORT', () => {
  const r = chooseRecovery('ORDER_REJECTED');
  assert.equal(r.action, 'ABORT');
});

test('REC11 latency spike → HEDGE', () => {
  const r = chooseRecovery('LATENCY_SPIKE');
  assert.equal(r.action, 'HEDGE');
});

// ---------- Authority boundaries ----------

test('REC12 all recoveries respect AEGIS and Treasury', () => {
  for (const f of ['VENUE_UNAVAILABLE', 'PARTIAL_FILL', 'THIN_LIQUIDITY', 'MARKET_HALT', 'ATOMIC_INCOMPLETE'] as const) {
    const r = chooseRecovery(f);
    assert.equal(r.respectAegis, true);
    assert.equal(r.respectTreasury, true);
  }
});

test('REC13 deterministic per failure class', () => {
  const a = chooseRecovery('VENUE_UNAVAILABLE');
  const b = chooseRecovery('VENUE_UNAVAILABLE');
  assert.equal(a.action, b.action);
  assert.equal(a.reason, b.reason);
});

// ---------- actionAdvancesExecution ----------

test('REC14 REROUTE advances execution', () => {
  assert.equal(actionAdvancesExecution('REROUTE'), true);
});

test('REC15 REPLAN advances execution', () => {
  assert.equal(actionAdvancesExecution('REPLAN'), true);
});

test('REC16 HEDGE advances execution', () => {
  assert.equal(actionAdvancesExecution('HEDGE'), true);
});

test('REC17 CANCEL_REMAINDER does not advance', () => {
  assert.equal(actionAdvancesExecution('CANCEL_REMAINDER'), false);
});

test('REC18 ABORT does not advance', () => {
  assert.equal(actionAdvancesExecution('ABORT'), false);
});

test('REC19 REPRICE advances execution', () => {
  assert.equal(actionAdvancesExecution('REPRICE'), true);
});

test('REC20 recovery respects authority on all classes', () => {
  for (const f of ['VENUE_UNAVAILABLE', 'VENUE_DEGRADED', 'PARTIAL_FILL', 'THIN_LIQUIDITY', 'EMPTY_BOOK', 'PRICE_MOVED', 'MARKET_HALT', 'ATOMIC_INCOMPLETE', 'ORDER_REJECTED', 'LATENCY_SPIKE'] as const) {
    const r = chooseRecovery(f);
    assert.equal(r.respectAegis, true);
    assert.equal(r.respectTreasury, true);
    assert.ok(r.reason.length > 0);
  }
});
