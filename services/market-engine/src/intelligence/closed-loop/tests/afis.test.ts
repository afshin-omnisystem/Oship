import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — AFIS closed-loop tests: one engine, real crypto-market
 * lifecycles, deterministic analytics.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);
const afis = result.records.filter((a) => a.identity.domain === 'AFIS');

test('AFIS records flow through the full closed loop', () => {
  assert.equal(afis.length, 12);
  for (const a of afis) {
    assert.equal(a.identity.domain, 'AFIS');
    assert.ok(a.lifecycle.valid);
    assert.ok(a.realized.realizedNetValue.value !== null);
  }
});

test('AFIS classes cover arbitrage and liquidity scenarios', () => {
  const classes = new Set(afis.map((a) => a.identity.opportunityClass));
  assert.deepEqual([...classes].sort(), ['cross-venue-arbitrage', 'liquidity-imbalance']);
});

test('AFIS healthy lifecycle reconstructs with COMPLETED control state', () => {
  const healthy = afis.find((a) => a.label === 'healthy-execution')!;
  const control = healthy.lifecycle.stages.find((s) => s.stage === 'CONTROL_SESSION')!;
  assert.equal(control.state, 'COMPLETED');
});

test('AFIS emergency stop terminates ABORTED with ES reason', () => {
  const es = afis.find((a) => a.label === 'emergency-stop')!;
  assert.equal(es.execution.finalState, 'ABORTED');
  const record = corpus.records.find((r) => r.label === 'emergency-stop')!;
  assert.equal(record.session.session.finalResult!.abortReason, 'EMERGENCY_STOP');
});

test('AFIS adverse drift is quantified end-to-end', () => {
  const adverse = afis.find((a) => a.label === 'adverse-venue-drift')!;
  assert.ok(adverse.edge.executionLeakage >= 10);
  assert.ok(adverse.realized.preservationRatio.value! < 0.5);
});

test('AFIS partial completion attributes partial-fill leakage', () => {
  const partial = afis.find((a) => a.label === 'partial-completion')!;
  const component = partial.leakage.components.find((c) => c.component === 'PARTIAL_FILL_LEAKAGE')!;
  assert.ok(component.value > 0);
});

test('AFIS risk throttling is protective, never punitive', () => {
  const throttled = afis.find((a) => a.label === 'risk-throttled')!;
  assert.equal(throttled.risk.impactKind, 'PROTECTIVE_CONSTRAINT');
  assert.equal(throttled.risk.riskPreservedBoundary, true);
});

test('AFIS venue leakage is deterministic against the best venue', () => {
  const venueLeak = afis.find((a) => a.label === 'venue-leakage')!;
  assert.equal(venueLeak.venue.benchmarkVenue, 'venue-b');
  const venueA = venueLeak.venue.venues.find((v) => v.venue === 'venue-a')!;
  assert.ok(Math.abs(venueA.venueLeakage.value! - 5) < 1e-6);
});

test('AFIS semantic sides stay BUY/SELL end-to-end', () => {
  for (const a of afis) {
    assert.notEqual(a.identity.semanticSide, 'BACK');
    assert.notEqual(a.identity.semanticSide, 'LAY');
    for (const leg of a.venue.venues) {
      assert.ok(leg.side !== 'BACK' && leg.side !== 'LAY');
    }
  }
});

test('AFIS strategy comparison separates guardian from aggressive', () => {
  const guardian = result.strategyScorecards.find((s) => s.strategyId === 'arb-guardian')!;
  const aggressive = result.strategyScorecards.find((s) => s.strategyId === 'arb-aggressive')!;
  assert.equal(guardian.opportunityCount, 6);
  assert.equal(aggressive.opportunityCount, 6);
  assert.ok(guardian.preservationRatio.value! > aggressive.preservationRatio.value!);
});

test('AFIS policy trial on v1.1 is attributed to the candidate policy', () => {
  const trial = afis.find((a) => a.label === 'policy-v1.1-trial')!;
  assert.equal(trial.policy.policyVersion, 'v1.1');
  assert.equal(trial.policy.candidatePolicyVersion, 'v1.1');
});

test('AFIS stale intelligence is isolated by freshness band', () => {
  const stale = afis.find((a) => a.label === 'stale-intel')!;
  assert.equal(stale.identity.freshness, 0.2);
  assert.equal(stale.realized.preservationRatio.value, 0);
});

test('AFIS analysis is fully invariant-clean', () => {
  assert.ok(result.invariants!.passed);
});
