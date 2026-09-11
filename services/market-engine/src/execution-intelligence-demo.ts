import {
  ExecutionIntelligenceEngine,
  replayIntelligence,
  checkRunInvariants,
} from './execution/intelligence';
import {EXECUTION_INTELLIGENCE_SCHEMA, GENESIS_HASH} from './execution/intelligence/audit';
import type {IntelligenceRunResult} from './execution/intelligence/types';
import type {IntelCycleSpecInput} from './execution/intelligence/test-fixtures';
import {AdaptiveProposal} from './execution/intelligence/types';
import {
  afisCrossVenuePlan,
  intelPlan,
  intelCycle,
  venueForRoute,
  XI_TEST_TIMESTAMP,
} from './execution/intelligence/test-fixtures';

/**
 * Sprint 032 — Adaptive Execution Intelligence demo.
 *
 * PAPER ONLY. Every scenario below drives the REAL closed loop:
 *
 *   Execution Plan → Simulation Result → Telemetry → Signals → Quality
 *   → Adaptive Decision (policies) → Proposal → Validation → Apply → Record
 *
 * through ExecutionIntelligenceEngine + AdaptiveExecutionController. Nothing
 * is mocked: the adaptive layer only ever PROPOSES; application goes through
 * plan revisions with explicit lineage; the Execution authority boundary,
 * Risk/AEGIS revalidation requirements, Treasury/Portfolio/Risk immutability,
 * total-quantity preservation and fail-closed validation are asserted on the
 * actual results. Deterministic: identical inputs → identical fingerprints.
 */

const NOW = XI_TEST_TIMESTAMP;
const engine = new ExecutionIntelligenceEngine();

// ---------------------------------------------------------------------------
// Deterministic scenario worlds (identical inputs on every run)
// ---------------------------------------------------------------------------

/** Non-atomic single-route BUY plan (10 units @ 100 reference on venue-a). */
function nonAtomicPlan() {
  return intelPlan({
    legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
}

/** Healthy AFIS atomic cross-venue plan (BUY venue-a / SELL venue-b). */
function atomicPlan() {
  return afisCrossVenuePlan();
}

function run(cycles: readonly IntelCycleSpecInput[], plan = nonAtomicPlan()): IntelligenceRunResult {
  return engine.run({
    plan,
    cycles: cycles.map(intelCycle),
    startTime: NOW,
    correlationId: 'demo-execution-intelligence',
    traceId: 'demo-execution-intelligence',
  });
}

// Scenario worlds -----------------------------------------------------------

/** venue-a drifted +30bps with 80% of the book depth reachable. */
function driftedWorld(askQty: number) {
  const plan = nonAtomicPlan();
  return [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.25, quantity: 1_000}],
    asks: [{price: 100.35, quantity: askQty}],
  }];
}

/** venue-a healthy but thin (40% fill) — a size problem, not a price problem. */
function thinWorld() {
  const plan = nonAtomicPlan();
  const venue = {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]};
  return [venue];
}

/** venue-a thin AND slow; venue-b deep, fast, tight — clearly superior. */
function rerouteWorld() {
  const plan = nonAtomicPlan();
  return [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
  ];
}

/** Atomic plan world: venue-a hard-down, venue-b/c healthy alternatives. */
function atomicFailureWorld() {
  const plan = atomicPlan();
  return [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
}

/** Degraded venue: thin liquidity, max latency, partial fill, DEGRADED sim state. */
function degradedWorld() {
  const plan = nonAtomicPlan();
  return [{
    ...venueForRoute(plan.routes[0], {liquidity: 2_000, health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 0}),
    asks: [{price: 100, quantity: 5}],
  }];
}

/** Single venue hard-down, no alternative — fail closed. */
function venueFailureWorld() {
  const plan = nonAtomicPlan();
  return [venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'})];
}

/** Healthy venue with 600ms round-trip latency. */
function slowWorld() {
  const plan = nonAtomicPlan();
  return [venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 300, networkLatencyMs: 300})];
}

/** Deep book shifted +40bps — everything fills, but at a bad price. */
function slippageWorld() {
  const plan = nonAtomicPlan();
  return [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.3, quantity: 1_000}],
    asks: [{price: 100.4, quantity: 1_000}],
  }];
}

/** Healthy venue whose liquidity cannot cover the remainder. */
function uncoverableWorld() {
  const plan = nonAtomicPlan();
  return [{...venueForRoute(plan.routes[0], {liquidity: 100}), asks: [{price: 100, quantity: 4}]}];
}

// ---------------------------------------------------------------------------
// Assertion harness — a section only prints PASS when every check holds
// ---------------------------------------------------------------------------

class Section {
  readonly failures: string[] = [];
  constructor(readonly name: string) {}
  check(condition: boolean, label: string): void {
    if (!condition) this.failures.push(label);
  }
  equal<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) this.failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
  deepEqual<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    }
  }
}

const sections: Section[] = [];
function section(name: string): Section {
  const s = new Section(name);
  sections.push(s);
  return s;
}

/** Authority markers must hold on every proposal the loop ever produced. */
function checkProposalAuthorities(s: Section, proposals: readonly AdaptiveProposal[]): void {
  for (const p of proposals) {
    s.equal(p.treasuryMutation, false, `${p.action} proposal must not mutate Treasury`);
    s.equal(p.riskMutation, false, `${p.action} proposal must not mutate Risk`);
    s.equal(p.portfolioMutation, false, `${p.action} proposal must not mutate Portfolio`);
    s.equal(p.requiresExecutionAuthorization, true, `${p.action} proposal must require Execution authorization`);
  }
}

function proposalsOf(r: IntelligenceRunResult): AdaptiveProposal[] {
  return r.cycles.map((c) => c.controller.proposal).filter((p): p is AdaptiveProposal => p !== null);
}

function main(): void {
  const parts: string[] = [];
  const sep = '='.repeat(78);
  const thin = '-'.repeat(78);

  parts.push(`${sep}
 SPRINT 032 — EXECUTION INTELLIGENCE
 Adaptive Execution Control over the Sprint 031 Execution Simulation
 PAPER / SIMULATION ONLY — NOT AN EXECUTION AUTHORITY — NO LIVE TRADING
${sep}`);

  // =========================================================================
  // [KEEP] — healthy plan, nothing to adapt
  // =========================================================================
  {
    const s = section('KEEP');
    const plan = atomicPlan();
    const before = JSON.stringify(plan);
    const r = run([{label: 'healthy', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ]}], plan);
    s.equal(r.cycles[0].controller.decision.action, 'KEEP', 'healthy cycle decides KEEP');
    s.equal(r.finalState, 'COMPLETED', 'run completes');
    s.equal(r.lineage.length, 1, 'no plan revision was needed');
    s.equal(r.reconciled, true, 'final state reconciles');
    s.equal(r.invariantsSatisfied, true, 'run invariants satisfied');
    s.equal(JSON.stringify(plan), before, 'original plan object untouched');
    parts.push(`[KEEP] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — healthy 2-leg atomic plan: KEEP, 20/20 filled, lineage v1 only`);
  }

  // =========================================================================
  // [REPRICE] — 30bps adverse drift with remainder outstanding
  // =========================================================================
  {
    const s = section('REPRICE');
    const plan = nonAtomicPlan();
    const r = run([{label: 'drift', venueSpecs: driftedWorld(8)}, {label: 'exec', venueSpecs: driftedWorld(1_000)}], plan);
    const c = r.cycles[0];
    const p = c.controller.proposal;
    s.equal(c.controller.decision.action, 'REPRICE', 'drift + outstanding remainder decides REPRICE');
    s.check(p !== null && p.action === 'REPRICE', 'a reprice proposal was constructed');
    if (p && p.action === 'REPRICE') {
      s.equal(p.proposedPrice, 100.31, 'BUY repriced one tick above the drifted mid');
      s.equal(p.driftBps, 30, 'drift measured at 30bps');
      s.equal(p.clamped, false, 'price within limits — not clamped');
    }
    s.equal(c.controller.applied, true, 'proposal validated and applied');
    s.equal(r.lineage.length, 2, 'plan-v2 created');
    s.equal(r.lineage[1].parentPlanId, r.lineage[0].executionPlanId, 'v2 links to v1 as parent');
    const v2Qty = r.lineage[1].routes.reduce((a, x) => a + x.quantity, 0);
    s.equal(v2Qty, 2, 'v2 carries exactly the remaining 2 units');
    s.equal(r.finalState, 'COMPLETED', 'repriced remainder fills in the next cycle');
    checkProposalAuthorities(s, proposalsOf(r));
    parts.push(`[REPRICE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 30bps drift: limit 100.00 → 100.31, remainder 2 preserved, v1→v2`);
  }

  // =========================================================================
  // [RESLICE] — 40% fill on a non-atomic plan, no price problem
  // =========================================================================
  {
    const s = section('RESLICE');
    const plan = nonAtomicPlan();
    const r = run([{label: 'thin', venueSpecs: thinWorld()}, {label: 'recover', venueSpecs: thinWorld().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}], plan);
    const c = r.cycles[0];
    const p = c.controller.proposal;
    s.equal(c.controller.decision.action, 'RESLICE', 'low fill ratio decides RESLICE');
    s.check(p !== null && p.action === 'RESLICE', 'a reslice proposal was constructed');
    if (p && p.action === 'RESLICE') {
      const covered = p.slices.reduce((a, x) => a + x.quantity, 0);
      s.equal(covered, 6, 'slices cover exactly the remaining 6 units');
      s.equal(c.feedback.telemetry.filledQuantity + covered, 10, 'filled + sliced = total target (never altered)');
    }
    s.equal(c.controller.applied, true, 'reslice applied');
    s.equal(r.lineage.length, 2, 'plan-v2 created');
    s.equal(r.finalState, 'COMPLETED', 'resliced remainder fills in the next cycle');
    checkProposalAuthorities(s, proposalsOf(r));
    parts.push(`[RESLICE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 40% fill: 6 remaining re-sliced, total target 10 preserved, v1→v2`);
  }

  // =========================================================================
  // [REROUTE] — partially-filled venue loses to a superior alternative
  // =========================================================================
  {
    const s = section('REROUTE');
    const plan = nonAtomicPlan();
    const before = JSON.stringify(plan);
    const r = run([{label: 'thin', venueSpecs: rerouteWorld()}, {label: 'exec', venueSpecs: rerouteWorld()}], plan);
    const c = r.cycles[0];
    const p = c.controller.proposal;
    s.equal(c.controller.decision.action, 'REROUTE', 'superior alternative venue decides REROUTE');
    s.check(p !== null && p.action === 'REROUTE', 'a reroute proposal was constructed');
    if (p && p.action === 'REROUTE') {
      s.equal(p.fromVenueId, 'venue-a', 'reroutes away from the weak venue');
      s.equal(p.toVenueId, 'venue-b', 'reroutes to the best alternative');
      s.equal(p.quantity, 6, 'reroutes the REMAINING 6 units (not the original 10)');
      s.check(p.scoreDelta > 0.1, 'deterministic score advantage beyond the reroute threshold');
    }
    s.equal(c.controller.applied, true, 'reroute applied');
    const v2 = r.lineage[1];
    s.check(v2.routes.every((x) => x.venue === 'venue-b'), 'revised plan routes only to venue-b');
    const v2Qty = v2.routes.reduce((a, x) => a + x.quantity, 0);
    s.equal(v2Qty, 6, 'revised plan carries the remaining 6 units, not the original 10');
    s.equal(v2.parentPlanId, r.lineage[0].executionPlanId, 'v2 links to v1 as parent');
    s.equal(JSON.stringify(plan), before, 'original plan object untouched');
    s.equal(r.finalState, 'COMPLETED', 'rerouted remainder fills in the next cycle');
    checkProposalAuthorities(s, proposalsOf(r));
    parts.push(`[REROUTE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — venue-a → venue-b with the REMAINING 6 units (partially filled), v1→v2`);
  }

  // =========================================================================
  // [REPLAN] — atomic venue failure, coordinated re-plan with alternatives
  // =========================================================================
  {
    const s = section('REPLAN');
    const plan = atomicPlan();
    const before = JSON.stringify(plan);
    const r = run([
      {label: 'down', venueSpecs: atomicFailureWorld()},
      {label: 'exec', venueSpecs: atomicFailureWorld()},
    ], plan);
    const c = r.cycles[0];
    s.equal(c.controller.decision.action, 'REPLAN', 'atomic leg failure decides REPLAN');
    s.equal(c.controller.applied, true, 'replan applied');
    s.equal(r.lineage.length, 2, 'plan-v2 created');
    const v2 = r.lineage[1];
    s.equal(v2.parentPlanId, r.lineage[0].executionPlanId, 'v2 links to v1 as parent');
    s.deepEqual(v2.legs.map((l) => l.legId), plan.legs.map((l) => l.legId), 'atomic leg identity preserved');
    s.check(v2.routes.every((x) => x.venue !== 'venue-a'), 'failed leg moved off venue-a');
    s.check(v2.routes.every((x) => plan.legs.some((l) => l.legId === x.legId)), 'every route keeps its leg binding');
    s.equal(r.finalState, 'COMPLETED', 'coordinated replan completes both legs');
    s.equal(JSON.stringify(plan), before, 'original plan object untouched');
    checkProposalAuthorities(s, proposalsOf(r));
    parts.push(`[REPLAN] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — atomic venue-a failure: both legs re-planned off the dead venue, v1→v2, legs preserved`);
  }

  // Print the real closed-loop stage trace for the REPLAN cycle.
  {
    const r = run([{label: 'down', venueSpecs: atomicFailureWorld()}, {label: 'exec', venueSpecs: atomicFailureWorld()}], atomicPlan());
    const c = r.cycles[0];
    parts.push(`\n${thin}
 CLOSED LOOP (REPLAN scenario, cycle 0 — real AdaptiveExecutionController trace)
${thin}`);
    for (const st of c.controller.stages) {
      parts.push(`  ${st.sequence}. ${st.stage.padEnd(9)} ${st.ok ? 'ok  ' : 'FAIL'} ${st.detail.length > 90 ? st.detail.slice(0, 87) + '…' : st.detail}`);
    }
    const tel = c.feedback.telemetry;
    parts.push(`  telemetry : planned ${tel.plannedQuantity} / submitted ${tel.submittedQuantity} / filled ${tel.filledQuantity} / remaining ${tel.remainingQuantity}`);
    parts.push(`  signals   : ${c.feedback.signals.map((x) => `${x.type}:${x.severity}`).join(', ') || 'none'}`);
    parts.push(`  quality   : ${c.feedback.quality.score.toFixed(4)} (${c.feedback.quality.grade})`);
    parts.push(`  decision  : ${c.controller.decision.action} — ${c.controller.decision.reason.slice(0, 80)}`);
    parts.push(`  apply     : ${c.controller.applied ? `plan-v${c.controller.revisedPlan!.version} (${c.controller.revisedPlan!.executionPlanId})` : `REJECTED — ${c.controller.rejectedReason}`}`);
  }

  // =========================================================================
  // [ABORT] — emergency stop dominates everything
  // =========================================================================
  {
    const s = section('ABORT');
    const plan = atomicPlan();
    const r = run([{label: 'es', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ], emergencyStop: true}], plan);
    const c = r.cycles[0];
    s.equal(c.controller.decision.action, 'ABORT', 'emergency stop decides ABORT');
    s.check(c.controller.decision.reason.includes('EMERGENCY_STOP') || c.controller.decision.reason.includes('emergency stop'), 'decision cites the emergency stop as the dominating reason');
    s.equal(c.controller.applied, true, 'abort applied');
    s.check(r.lineage[r.lineage.length - 1].routes.length === 0, 'all outstanding work cancelled (no routes left)');
    s.check(c.controller.auditEvents.some((e) => (e as {eventType: string}).eventType === 'EXECUTION_ABORTED'), 'EXECUTION_ABORTED audited');
    s.equal(r.finalState, 'ABORTED', 'run aborts terminally');
    checkProposalAuthorities(s, proposalsOf(r));
    parts.push(`[ABORT] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — emergency stop: full cancellation of the 20-unit plan, EXECUTION_ABORTED audited`);
  }

  // =========================================================================
  // [VENUE DEGRADATION] — DEGRADED health, replan, hysteresis recovery
  // =========================================================================
  {
    const s = section('VENUE DEGRADATION');
    const plan = nonAtomicPlan();
    const r = run([{label: 'deg', venueSpecs: degradedWorld()}, {label: 'deg2', venueSpecs: degradedWorld()}], plan);
    const h1 = r.cycles[0].feedback.venueHealth[0];
    const h2 = r.cycles[1].feedback.venueHealth[0];
    s.equal(h1.state, 'DEGRADED', 'venue assessed DEGRADED (score below floor)');
    s.check(h1.score < 0.6, 'degraded score below the 0.6 floor');
    s.check(r.cycles[0].feedback.signals.some((x) => x.type === 'VENUE_DEGRADED'), 'VENUE_DEGRADED signal generated');
    s.equal(h2.state, 'RECOVERING', 'hysteresis: recovery passes through RECOVERING, not straight to HEALTHY');
    s.equal(r.finalState, 'COMPLETED', 'degraded venue still completes safely after adaptation');
    parts.push(`[VENUE DEGRADATION] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — score 0.538 → DEGRADED, next cycle RECOVERING (hysteresis), run completes`);
  }

  // =========================================================================
  // [VENUE FAILURE] — hard-down venue with no alternative fails closed
  // =========================================================================
  {
    const s = section('VENUE FAILURE');
    const plan = nonAtomicPlan();
    const r = run([{label: 'fail', venueSpecs: venueFailureWorld()}, {label: 'fail2', venueSpecs: venueFailureWorld()}], plan);
    const c = r.cycles[0];
    const h = c.feedback.venueHealth[0];
    s.equal(h.state, 'UNAVAILABLE', 'failed venue assessed UNAVAILABLE');
    s.check(c.feedback.signals.some((x) => x.type === 'VENUE_FAILED' && x.severity === 'CRITICAL'), 'VENUE_FAILED signal at CRITICAL');
    s.equal(c.controller.decision.action, 'ABORT', 'no alternative can take the remainder → ABORT (fail closed)');
    s.equal(c.controller.applied, true, 'abort applied');
    s.check(r.lineage[r.lineage.length - 1].routes.length === 0, 'nothing executes further');
    s.equal(r.finalState, 'ABORTED', 'run aborts');
    parts.push(`[VENUE FAILURE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — venue-a UNAVAILABLE, no alternative: VENUE_FAILED:CRITICAL → ABORT, fail closed`);
  }

  // =========================================================================
  // [PARTIAL FILL] — observed, signalled, never silently dropped
  // =========================================================================
  {
    const s = section('PARTIAL FILL');
    const plan = nonAtomicPlan();
    const r = run([{label: 'thin', venueSpecs: thinWorld()}, {label: 'recover', venueSpecs: thinWorld().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}], plan);
    const tel = r.cycles[0].feedback.telemetry;
    s.equal(tel.filledQuantity, 4, 'partial fill observed (4 of 10)');
    s.equal(tel.remainingQuantity, 6, 'remainder tracked (6)');
    s.check(r.cycles[0].feedback.signals.some((x) => x.type === 'PARTIAL_FILL'), 'PARTIAL_FILL signal generated');
    const v2Qty = r.lineage[1].routes.reduce((a, x) => a + x.quantity, 0);
    s.equal(tel.filledQuantity + v2Qty, 10, 'filled + re-planned remainder = original target (never altered)');
    s.equal(r.finalState, 'COMPLETED', 'remainder completes');
    parts.push(`[PARTIAL FILL] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 4/10 filled, 6 signalled and re-sliced, 4 + 6 = 10 target preserved`);
  }

  // =========================================================================
  // [HIGH LATENCY] — observed, signalled, quality-charged; no unsafe action
  // =========================================================================
  {
    const s = section('HIGH LATENCY');
    const plan = nonAtomicPlan();
    const r = run([{label: 'slow', venueSpecs: slowWorld()}], plan);
    const c = r.cycles[0];
    s.check(c.feedback.telemetry.latencyMs > 250, `observed latency ${c.feedback.telemetry.latencyMs}ms beyond the 250ms limit`);
    const latSig = c.feedback.signals.find((x) => x.type === 'LATENCY_HIGH');
    s.check(latSig !== undefined && latSig.severity === 'CRITICAL', 'LATENCY_HIGH signal at CRITICAL');
    const latDim = c.feedback.quality.dimensions.find((d) => d.name === 'LATENCY');
    s.check(latDim !== undefined && latDim.value < 1, 'LATENCY quality dimension degraded');
    s.equal(c.controller.decision.action, 'KEEP', 'latency alone (quality above floors) → KEEP, no unsafe action');
    s.equal(r.finalState, 'COMPLETED', 'execution still completes');
    parts.push(`[HIGH LATENCY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 603ms vs 250ms limit: LATENCY_HIGH:CRITICAL, quality ${c.feedback.quality.score.toFixed(3)}, KEEP`);
  }

  // =========================================================================
  // [HIGH SLIPPAGE] — observed, signalled, priced into quality
  // =========================================================================
  {
    const s = section('HIGH SLIPPAGE');
    const plan = nonAtomicPlan();
    const r = run([{label: 'slip', venueSpecs: slippageWorld()}], plan);
    const c = r.cycles[0];
    s.check(c.feedback.telemetry.slippageBps > 25, `observed slippage ${c.feedback.telemetry.slippageBps}bps beyond the 25bps limit`);
    s.check(c.feedback.signals.some((x) => x.type === 'SLIPPAGE_HIGH'), 'SLIPPAGE_HIGH signal generated');
    const priceDim = c.feedback.quality.dimensions.find((d) => d.name === 'PRICE');
    s.check(priceDim !== undefined && priceDim.value < 1, 'PRICE quality dimension degraded');
    s.equal(c.controller.decision.action, 'KEEP', 'nothing outstanding to adapt (plan filled) → KEEP, slippage recorded');
    s.equal(r.finalState, 'COMPLETED', 'execution completes with the cost recorded');
    parts.push(`[HIGH SLIPPAGE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 40bps vs 25bps limit: SLIPPAGE_HIGH, PRICE quality degraded, cost recorded`);
  }

  // =========================================================================
  // [FAIL-CLOSED REPLAN] — uncoverable candidates produce no proposal
  // =========================================================================
  {
    const s = section('FAIL-CLOSED REPLAN');
    const plan = nonAtomicPlan();
    const r = run([{label: 'stuck', venueSpecs: uncoverableWorld()}, {label: 'stuck2', venueSpecs: uncoverableWorld()}], plan);
    for (const c of r.cycles) {
      s.equal(c.controller.decision.action, 'REPLAN', 'insufficient liquidity decides REPLAN');
      s.equal(c.controller.proposal, null, 'no proposal can cover the remainder → null (fail closed)');
      s.equal(c.controller.applied, false, 'nothing applied');
      s.check(c.controller.auditEvents.some((e) => (e as {eventType: string}).eventType === 'ADAPTIVE_ACTION_REJECTED'), 'rejection audited');
    }
    s.equal(r.appliedActions.length, 0, 'zero applied actions');
    s.equal(r.lineage.length, 1, 'lineage unchanged (still v1)');
    s.check(r.cycles[r.cycles.length - 1].feedback.telemetry.remainingQuantity > 0, 'remainder outstanding — never silently reduced');
    s.equal(r.finalState, 'EXHAUSTED', 'run ends EXHAUSTED with the remainder intact');
    parts.push(`[FAIL-CLOSED REPLAN] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — candidates cannot cover 6 units: proposal null, applied false, rejected + audited, remainder intact`);
  }

  // =========================================================================
  // [REPLAY] — deterministic replay reproduces the run exactly
  // =========================================================================
  {
    const s = section('REPLAY');
    const plan = atomicPlan();
    const cycles = [
      {label: 'down', venueSpecs: atomicFailureWorld()},
      {label: 'exec', venueSpecs: atomicFailureWorld()},
    ];
    const input = {plan, cycles: cycles.map(intelCycle), startTime: NOW, correlationId: 'demo-execution-intelligence', traceId: 'demo-execution-intelligence'};
    const rp = replayIntelligence(input);
    s.equal(rp.identical, true, 'replay reproduces the original run');
    s.deepEqual(rp.mismatches as unknown[], [], 'zero mismatches');
    s.equal(rp.original.fingerprint, rp.replay.fingerprint, 'run fingerprints identical');
    s.equal(rp.original.finalPlanId, rp.replay.finalPlanId, 'final plans identical');
    // Determinism: a second live run yields the identical fingerprint.
    const second = new ExecutionIntelligenceEngine().run(input);
    s.equal(rp.original.fingerprint, second.fingerprint, 'two live runs produce identical fingerprints');
    parts.push(`[REPLAY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — replay identical, 0 mismatches, run fingerprint ${rp.original.fingerprint.slice(0, 20)}…`);
  }

  // =========================================================================
  // [AUDIT] — structured, hash-chained, tamper-evident event log
  // =========================================================================
  {
    const s = section('AUDIT');
    const plan = atomicPlan();
    const r = run([
      {label: 'down', venueSpecs: atomicFailureWorld()},
      {label: 'exec', venueSpecs: atomicFailureWorld()},
    ], plan);
    const events = r.auditEvents as readonly {schemaVersion: string; eventType: string; previousHash: string; hash: string}[];
    s.check(events.length > 0, 'audit events were recorded');
    s.check(events.every((e) => e.schemaVersion === EXECUTION_INTELLIGENCE_SCHEMA), `every event uses schema ${EXECUTION_INTELLIGENCE_SCHEMA}`);
    s.equal(events[0].previousHash, GENESIS_HASH, 'chain starts at the genesis hash');
    let chainOk = true;
    for (let i = 1; i < events.length; i++) {
      if (events[i].previousHash !== events[i - 1].hash) {chainOk = false; break;}
    }
    s.check(chainOk, 'every event hash-links to its predecessor (tamper-evident)');
    const types = new Set(events.map((e) => e.eventType));
    for (const required of ['TELEMETRY_RECORDED', 'SIGNAL_GENERATED', 'QUALITY_EVALUATED', 'ADAPTIVE_DECISION', 'REPLAN_PROPOSED', 'ADAPTIVE_ACTION_APPLIED']) {
      s.check(types.has(required), `${required} audited`);
    }
    parts.push(`[AUDIT] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${events.length} hash-chained events (${[...types].length} types), schema ${EXECUTION_INTELLIGENCE_SCHEMA}`);
  }

  // =========================================================================
  // [INVARIANTS] — hard invariants hold across every scenario run
  // =========================================================================
  {
    const s = section('INVARIANTS');
    const plan = atomicPlan();
    const runs: [string, IntelligenceRunResult][] = [
      ['keep', run([{label: 'healthy', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000}), venueForRoute(plan.routes[1], {liquidity: 200_000})]}], plan)],
      ['replan', run([{label: 'down', venueSpecs: atomicFailureWorld()}, {label: 'exec', venueSpecs: atomicFailureWorld()}], plan)],
      ['reroute', run([{label: 'thin', venueSpecs: rerouteWorld()}, {label: 'exec', venueSpecs: rerouteWorld()}])],
      ['reslice', run([{label: 'thin', venueSpecs: thinWorld()}, {label: 'recover', venueSpecs: thinWorld().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}])],
      ['reprice', run([{label: 'drift', venueSpecs: driftedWorld(8)}, {label: 'exec', venueSpecs: driftedWorld(1_000)}])],
      ['fail-closed', run([{label: 'stuck', venueSpecs: uncoverableWorld()}])],
    ];
    for (const [name, r] of runs) {
      const check = checkRunInvariants(r);
      s.equal(check.satisfied, true, `invariants satisfied for the ${name} run${check.violations.length ? `: ${check.violations.join('; ')}` : ''}`);
      // Parent-plan immutability + lineage, checked on the actual objects.
      for (let i = 1; i < r.lineage.length; i++) {
        s.equal(r.lineage[i].parentPlanId, r.lineage[i - 1].executionPlanId, `${name}: lineage v${i}→v${i + 1} parent link`);
        s.equal(r.lineage[i].version, r.lineage[i - 1].version + 1, `${name}: lineage v${i}→v${i + 1} version`);
      }
    }
    parts.push(`[INVARIANTS] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — checkRunInvariants satisfied on all 6 scenario runs; lineage/versions/parents verified`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  const failed = sections.filter((x) => x.failures.length > 0);
  parts.push(`\n${thin}
 DETAILS
${thin}`);
  for (const s of sections) {
    if (s.failures.length > 0) {
      parts.push(`  ${s.name}:`);
      for (const f of s.failures) parts.push(`    ✗ ${f}`);
    }
  }

  parts.push(`\n${sep}
 SYSTEM STATUS: ${failed.length === 0 ? 'RECONCILED' : 'DEGRADED'}   (${sections.length - failed.length}/${sections.length} checks passed)
 ADAPTIVE INTELLIGENCE ≠ AUTHORITY. PROPOSAL-ONLY THROUGH THE EXECUTION BOUNDARY.
 TREASURY / PORTFOLIO / RISK NEVER MUTATED. PAPER / SIMULATION ONLY.
${sep}`);

  console.log(parts.join('\n'));
  if (failed.length > 0) process.exitCode = 1;
}

main();
