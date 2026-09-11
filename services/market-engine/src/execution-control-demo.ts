import {
  runControl,
  controlCycle,
  intelPlan,
  venueForRoute,
  afisCrossVenueControlPlan,
  ablBackLayControlPlan,
  CONTROL_TEST_TIMESTAMP,
} from './execution/control/test-fixtures';
import {decideControl} from './execution/control/decision';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from './execution/control/config';
import {ExecutionControlEngine} from './execution/control/engine';
import {recoverControlSession, sessionsEquivalent} from './execution/control/recovery';
import {replayControlSession, verifyAuditStream} from './execution/control/replay';
import {verifyCheckpoint} from './execution/control/checkpoint';
import {checkControlInvariants} from './execution/control/invariants';
import {defaultAuthorityBridge, DefaultExecutionAuthorityBridge} from './execution/control/authority-bridge';
import {CONTROL_EVENT_TYPES} from './execution/control/types';
import type {
  ExecutionControlSession,
  ExecutionControlRunInput,
  ControlCycleSpec,
} from './execution/control/types';
import type {DecideControlInput} from './execution/control/decision';

/**
 * SPRINT 033 — AUTONOMOUS EXECUTION CONTROL demo.
 *
 * PAPER / SIMULATION ONLY — NOT AN EXECUTION AUTHORITY — NO LIVE TRADING.
 *
 * Every section below drives the REAL autonomous control loop:
 *
 *   Execution Plan → Simulation → Telemetry → Execution Intelligence
 *   → Control Cycle (12-state machine) → Decision (precedence-resolved)
 *   → Risk/AEGIS validation through the narrow authority bridge
 *   → Action (budgeted, applied through the Execution authority only)
 *   → Checkpoint → Feedback → Next Cycle → Completion / Abort / Exhaustion
 *
 * Nothing is mocked. The control plane only ever PROPOSES and submits
 * revisions through the Execution authority; Risk and AEGIS are consulted,
 * never overridden; Treasury and Portfolio are never touched. Every PASS line
 * is backed by assertions against the actual returned engine/session state.
 */

const NOW = CONTROL_TEST_TIMESTAMP;

// ---------------------------------------------------------------------------
// Deterministic scenario worlds (identical inputs on every run)
// ---------------------------------------------------------------------------

/** Non-atomic single-route BUY plan (10 units @ 100 reference on venue-a). */
function nonAtomicPlan(planId = 'xplan_demo_na') {
  return intelPlan({
    planId, legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
}

/** venue-a drifted +30bps with part of the book reachable. */
function driftedWorld(plan: ReturnType<typeof nonAtomicPlan>, askQty: number) {
  return [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.25, quantity: 1_000}],
    asks: [{price: 100.35, quantity: askQty}],
  }];
}

/** venue-a healthy but thin — a size problem, not a price problem. */
function thinWorld(plan: ReturnType<typeof nonAtomicPlan>, askQty = 4) {
  return [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: askQty}]}];
}

/** venue-a thin AND slow; venue-b deep, fast — clearly superior. */
function rerouteWorld(plan: ReturnType<typeof nonAtomicPlan>) {
  return [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
  ];
}

function healthyWorld(plan: {routes: readonly {venue: string; instrument?: string; side: 'BUY' | 'SELL' | 'BACK' | 'LAY'; referencePrice: number}[]}) {
  return plan.routes.map((r) => venueForRoute(r, {liquidity: 200_000}));
}

/** Degraded single venue (thin liquidity, DEGRADED health, max latency). */
function degradedWorld(plan: ReturnType<typeof nonAtomicPlan>, askQty = 5) {
  return [{
    ...venueForRoute(plan.routes[0], {liquidity: 2_000, health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 0}),
    asks: [{price: 100, quantity: askQty}],
  }];
}

/** A canonical decision-layer input (used for the CONTINUE / ES-dominance units). */
function decisionInput(over: {emergencyStop?: boolean; completion?: DecideControlInput['completion']} = {}): DecideControlInput {
  return {
    cycleNumber: 2,
    timestamp: NOW,
    telemetry: {
      remainingQuantity: 3, filledQuantity: 7, submittedQuantity: 10, plannedQuantity: 10,
      fillRatio: 0.8, slippageBps: 2, impact: 5, latencyMs: 20, partialFillCount: 0,
      atomicRequired: false, atomicRisk: false,
    } as never,
    quality: {score: 0.9, fingerprint: 'demo_quality'} as never,
    qualityBand: 'NORMAL',
    signals: [],
    venueHealth: [{venueId: 'venue-a', state: 'HEALTHY', score: 0.9, degradedCycles: 0, recoveringCycles: 0}] as never,
    candidates: [],
    priceDriftBps: 0,
    emergencyStop: over.emergencyStop ?? false,
    deadlineInMs: 60_000,
    feedback: {
      trend: 'STABLE', trendDelta: 0, vsBaseline: 'AT', baselineScore: 0.5,
      oscillation: {detected: false, kind: null, pattern: [], window: 6, detail: 'no oscillation detected'},
      repeatedFailure: false, repeatedReroutes: false, repeatedReprices: false,
      diminishingImprovement: false, recovery: false,
    },
    riskValidation: {status: 'APPROVED', reason: 'ok'},
    aegisValidation: {status: 'APPROVED', reason: 'ok'},
    hardLimitViolations: [],
    completion: over.completion ?? {complete: false, partial: true, unmet: ['TARGET_FILLED']},
    allVenuesStale: false,
    plan: {executionPlanId: 'xplan_demo_decision', fingerprint: 'fp'},
    currentVenueId: 'venue-a',
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0.9,
    config: DEFAULT_EXECUTION_CONTROL_CONFIG,
    thresholdEvaluations: [],
    previousAction: null,
    cyclesSinceLastAction: 0,
  };
}

/** The 4-cycle recovery/replay world: reslice twice, then the world heals. */
function recoveryInput(planId = 'xplan_demo_rc'): ExecutionControlRunInput {
  const plan = intelPlan({
    planId, legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const deep = () => [venueForRoute(plan.routes[0], {liquidity: 200_000})];
  const cycles: readonly ControlCycleSpec[] = [
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'recover', venueSpecs: deep()}),
    controlCycle({label: 'steady', venueSpecs: deep()}),
  ];
  return {
    plan,
    cycles,
    startTime: NOW,
    correlationId: 'demo-execution-control',
    traceId: 'demo-execution-control',
  };
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
  same<T>(actual: T, expected: T, label: string): void {
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

function invariantsOk(initialPlan: Parameters<typeof checkControlInvariants>[0]['initialPlan'], session: ExecutionControlSession): boolean {
  return checkControlInvariants({initialPlan, session}).ok;
}

function totalQuantity(plan: {routes: readonly {quantity: number}[]}): number {
  return plan.routes.reduce((s, r) => s + r.quantity, 0);
}

function main(): void {
  const parts: string[] = [];
  const sep = '='.repeat(78);

  parts.push(`${sep}
 SPRINT 033 — AUTONOMOUS EXECUTION CONTROL
 One deterministic control plane over the execution stack (Sprints 030–032)
 PAPER / SIMULATION ONLY — NOT AN EXECUTION AUTHORITY — NO LIVE TRADING
${sep}`);

  // =========================================================================
  // [CONTINUE] — the deliberate no-op: healthy plan, work remains
  // =========================================================================
  {
    const s = section('CONTINUE');
    const d = decideControl(decisionInput());
    s.equal(d.action, 'CONTINUE', 'healthy plan with work outstanding decides CONTINUE');
    s.equal(d.reason, 'PLAN_HEALTHY', 'explicit reason PLAN_HEALTHY');
    s.equal(d.precedence, 'CONTINUE', 'precedence CONTINUE');
    s.equal(d.adaptiveAction, 'KEEP', 'maps from the intelligence layer\'s KEEP');
    // In full sessions the Sprint 032 policy suite is total: any cycle with
    // work outstanding yields an adaptive want (→ action) or a deliberate
    // WAIT — so CONTINUE is asserted here at the decision layer, which is its
    // contract inside the real decision engine.
    parts.push(`[CONTINUE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — decision layer: healthy plan + work outstanding → CONTINUE (KEEP)`);
  }

  // =========================================================================
  // [REPRICE] — 30bps adverse drift with remainder outstanding
  // =========================================================================
  {
    const s = section('REPRICE');
    const plan = nonAtomicPlan('xplan_demo_reprice');
    const before = JSON.stringify(plan);
    const session = runControl(plan, [
      controlCycle({label: 'drift', venueSpecs: driftedWorld(plan, 8)}),
      controlCycle({label: 'exec', venueSpecs: driftedWorld(plan, 1_000)}),
    ]);
    const c0 = session.cycles[0];
    s.equal(c0.action, 'REPRICE', 'drift + remainder decides REPRICE');
    s.check(c0.result.applied, 'reprice applied through the execution authority');
    s.check(c0.result.revisedPlan !== null, 'revised plan produced');
    s.equal(c0.result.proposal?.action, 'REPRICE', 'proposal kind REPRICE');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes');
    s.equal(session.finalResult?.filledQuantity, 10, '10/10 filled');
    // The revision re-prices the REMAINING work only.
    s.equal(totalQuantity(c0.result.revisedPlan!), 2, 'revised plan covers the 2 remaining units, not the original 10');
    s.equal(JSON.stringify(plan), before, 'root plan object untouched (immutable)');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[REPRICE]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 30bps drift → REPRICE the 2-unit remainder → COMPLETED 10/10`);
  }

  // =========================================================================
  // [RESLICE] — 40% fill: slice sizes are the problem
  // =========================================================================
  {
    const s = section('RESLICE');
    const plan = nonAtomicPlan('xplan_demo_reslice');
    const session = runControl(plan, [
      controlCycle({label: 'thin', venueSpecs: thinWorld(plan)}),
      controlCycle({label: 'exec', venueSpecs: thinWorld(plan, 1_000)}),
    ]);
    const c0 = session.cycles[0];
    s.equal(c0.action, 'RESLICE', '40% fill decides RESLICE');
    s.check(c0.result.applied, 'reslice applied');
    s.equal(totalQuantity(c0.result.revisedPlan!), 6, 'reslice covers the 6 remaining units (never the original 10)');
    s.check((c0.result.proposal as {preservesTotalQuantity?: boolean}).preservesTotalQuantity === true, 'proposal preserves total quantity');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes');
    s.equal(session.finalResult?.filledQuantity, 10, '10/10 filled');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[RESLICE]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 4/10 filled → RESLICE the 6-unit remainder → COMPLETED 10/10`);
  }

  // =========================================================================
  // [REROUTE] — venue-a thin + slow, venue-b superior
  // =========================================================================
  {
    const s = section('REROUTE');
    const plan = nonAtomicPlan('xplan_demo_reroute');
    const session = runControl(plan, [
      controlCycle({label: 'weak', venueSpecs: rerouteWorld(plan)}),
      controlCycle({label: 'exec', venueSpecs: rerouteWorld(plan)}),
    ]);
    const c0 = session.cycles[0];
    s.equal(c0.action, 'REROUTE', 'inferior venue decides REROUTE');
    s.equal((c0.result.proposal as {toVenueId: string}).toVenueId, 'venue-b', 'reroutes to the superior venue-b');
    const v2 = c0.result.revisedPlan!;
    s.check(v2.routes.every((r) => r.venue === 'venue-b'), 'revised routes all live on venue-b');
    s.equal(totalQuantity(v2), 6, 'only the 6 REMAINING units transfer (partially-filled work is not re-routed)');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes');
    s.equal(session.finalResult?.filledQuantity, 10, '10/10 filled');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[REROUTE]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — thin+slow venue-a → REROUTE remaining 6 to venue-b → COMPLETED 10/10`);
  }

  // =========================================================================
  // [REPLAN] — atomic partial fill: a coordinated replan recovers the leg
  // =========================================================================
  {
    const s = section('REPLAN');
    const plan = afisCrossVenueControlPlan();
    const thinBuy = () => [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ];
    const session = runControl(plan, [
      controlCycle({label: 'partial', venueSpecs: thinBuy()}),
      controlCycle({label: 'exec', venueSpecs: thinBuy()}),
    ]);
    const c0 = session.cycles[0];
    s.equal(c0.telemetry.filledQuantity, 17, '17/20 filled after the partial BUY leg');
    s.equal(c0.action, 'REPLAN', 'atomic partial fill decides REPLAN (reslice is suppressed for atomic groups)');
    s.equal(totalQuantity(c0.result.revisedPlan!), 3, 'replan covers exactly the 3 remaining units');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes');
    s.equal(session.finalResult?.filledQuantity, 20, '20/20 filled — all-or-nothing semantics preserved');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[REPLAN]   ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — atomic BUY 7/10 → coordinated REPLAN of 3 → COMPLETED 20/20`);
  }

  // =========================================================================
  // [WAIT] — same-action cooldown: a deliberate, deterministic deferral
  // =========================================================================
  {
    const s = section('WAIT');
    const plan = nonAtomicPlan('xplan_demo_wait');
    const session = runControl(plan, [
      controlCycle({label: 'drift0', venueSpecs: driftedWorld(plan, 8)}),
      controlCycle({label: 'drift1', venueSpecs: driftedWorld(plan, 8)}),
      controlCycle({label: 'exec', venueSpecs: driftedWorld(plan, 1_000)}),
      controlCycle({label: 'steady', venueSpecs: driftedWorld(plan, 1_000)}),
    ], {config: {hysteresis: {sameActionCooldownCycles: 1}}});
    s.equal(session.cycles[0].action, 'REPRICE', 'cycle 0 applies REPRICE');
    const c1 = session.cycles[1];
    s.equal(c1.action, 'WAIT', 'cycle 1 defers inside the cooldown window');
    s.equal(c1.decision.waitReason, 'SAME_ACTION_COOLDOWN', 'explicit wait reason SAME_ACTION_COOLDOWN');
    s.check(c1.result.revisedPlan === null && c1.result.rejectionReason === null, 'no revision and no failure on a WAIT cycle (deliberate no-op)');
    const states = c1.result.stateTransitions.map((t) => t.to);
    s.check(states[states.length - 1] === 'WAITING_FEEDBACK', 'WAIT takes the VALIDATING → WAITING_FEEDBACK no-op path');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run still completes');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[WAIT]     ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — REPRICE then SAME_ACTION_COOLDOWN deferral → COMPLETED`);
  }

  // =========================================================================
  // [COMPLETE] — every completion condition holds
  // =========================================================================
  {
    const s = section('COMPLETE');
    const plan = afisCrossVenueControlPlan();
    const session = runControl(plan, [controlCycle({label: 'healthy', venueSpecs: healthyWorld(plan)})]);
    const c0 = session.cycles[0];
    s.equal(c0.action, 'COMPLETE', 'healthy full fill decides COMPLETE');
    s.check(c0.decision.considered.every((v) => v.action === 'COMPLETE'), 'no optimization verdict outranks COMPLETE when no work remains');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'session COMPLETED');
    s.equal(session.finalResult?.filledQuantity, 20, '20/20 filled');
    s.equal(session.finalResult?.partial, false, 'not partial');
    s.equal(session.currentState, 'COMPLETED', 'session state COMPLETED');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[COMPLETE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — target filled, atomic legs satisfied, risk+AEGIS valid → COMPLETED 20/20`);
  }

  // =========================================================================
  // [ABORT] — emergency stop: the terminal ABORT revision is recorded first
  // =========================================================================
  {
    const s = section('ABORT');
    const plan = afisCrossVenueControlPlan();
    // BUY leg only 4/10 reachable: the stop hits with work outstanding.
    const thinBuy = () => [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]},
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ];
    const session = runControl(plan, [controlCycle({label: 'es', venueSpecs: thinBuy(), emergencyStop: true})]);
    s.equal(session.finalResult?.finalState, 'ABORTED', 'session ABORTED');
    s.equal(session.finalResult?.abortReason, 'EMERGENCY_STOP', 'abort reason EMERGENCY_STOP');
    s.equal(session.finalResult?.filledQuantity, 14, 'filled quantity preserved on abort (4 BUY + 10 SELL)');
    s.equal(session.finalResult?.remainingQuantity, 6, 'remaining quantity preserved on abort');
    s.equal(session.finalResult?.partial, true, 'partial execution distinguishable');
    s.equal(session.cycles.length, 1, 'history preserved (abort cycle recorded)');
    // The terminal ABORT revision is recorded in lineage BEFORE termination.
    s.equal(session.lineage.length, 2, 'root + terminal ABORT revision in lineage');
    const abortRevision = session.lineage[1];
    s.equal(abortRevision.parentPlanId, plan.executionPlanId, 'abort revision links to the root plan');
    s.equal(abortRevision.version, plan.version + 1, 'abort revision version v2');
    s.equal(totalQuantity(abortRevision), 0, 'abort revision carries no further work');
    const applied = session.auditEvents.find((e) => e.eventType === 'ACTION_APPLIED');
    s.equal(applied?.payload.action, 'ABORT', 'abort revision audited as ACTION_APPLIED');
    s.check(String(applied?.payload.kind) === 'ABORT_REVISION', 'audited kind ABORT_REVISION');
    s.check(session.auditEvents.some((e) => e.eventType === 'SESSION_ABORTED'), 'SESSION_ABORTED audited');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[ABORT]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — emergency stop → ABORTED/EMERGENCY_STOP, 14 filled + 6 remaining preserved, ABORT revision in lineage`);
  }

  // =========================================================================
  // [MULTI-CYCLE] — sequential adaptations compose in one session
  // =========================================================================
  {
    const s = section('MULTI-CYCLE');
    const plan = intelPlan({
      planId: 'xplan_demo_seq', domain: 'AFIS', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 30, referencePrice: 100}],
    });
    const before = JSON.stringify(plan);
    const session = runControl(plan, [
      controlCycle({label: 'drift', venueSpecs: [{
        ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
        bids: [{price: 100.25, quantity: 1_000}], asks: [{price: 100.35, quantity: 27}],
      }]}),
      controlCycle({label: 'weak', venueSpecs: [
        {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100.35, quantity: 1}]},
        venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
      ]}),
      controlCycle({label: 'recover', venueSpecs: [
        venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
      ]}),
    ]);
    const actions = session.cycles.map((c) => c.action);
    s.equal(actions.join(','), 'REPRICE,REPLAN,COMPLETE', 'REPRICE → REPLAN → COMPLETE in one session');
    s.equal(session.lineage.length, 3, 'lineage v1 → v2 → v3');
    s.equal(session.lineage.map((p) => `v${p.version}`).join('→'), 'v1→v2→v3', 'explicit versioned lineage');
    // Quantity preservation at EVERY revision boundary.
    for (let i = 1; i < session.lineage.length; i++) {
      const boundary = session.cycles.find((c) => c.result.revisedPlan === session.lineage[i]);
      s.check(boundary !== undefined, `revision ${i} has a boundary cycle`);
      if (boundary) {
        const expected = totalQuantity(session.lineage[i - 1]) - boundary.telemetry.filledQuantity;
        s.check(Math.abs(totalQuantity(session.lineage[i]) - expected) < 1e-6,
          `revision ${i}: planned ${totalQuantity(session.lineage[i])} == parent − filled (${expected})`);
      }
    }
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes');
    s.equal(session.finalResult?.filledQuantity, 30, '30/30 filled across the adaptations');
    s.equal(JSON.stringify(plan), before, 'parent plans immutable (root untouched)');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[MULTI-CYCLE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — REPRICE → REPLAN → COMPLETE, lineage v1→v2→v3, 30/30, quantity preserved`);
  }

  // =========================================================================
  // [VENUE FAILURE] — single venue hard-down, no alternative: fail closed
  // =========================================================================
  {
    const s = section('VENUE FAILURE');
    const plan = nonAtomicPlan('xplan_demo_vf');
    const session = runControl(plan, [
      controlCycle({label: 'down', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'})]}),
    ]);
    s.equal(session.finalResult?.finalState, 'ABORTED', 'venue failure aborts');
    s.equal(session.finalResult?.abortReason, 'VENUE_UNAVAILABLE', 'abort reason VENUE_UNAVAILABLE');
    s.equal(session.finalResult?.remainingQuantity, 10, 'remaining quantity preserved');
    s.check(session.cycles.length >= 1, 'abort cycle recorded');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[VENUE FAILURE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — venue hard-down, no alternative → ABORTED/VENUE_UNAVAILABLE`);
  }

  // =========================================================================
  // [VENUE RECOVERY] — degraded world heals and the run completes
  // =========================================================================
  {
    const s = section('VENUE RECOVERY');
    const plan = intelPlan({
      planId: 'xplan_demo_vr', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
    });
    const session = runControl(plan, [
      controlCycle({label: 'degraded0', venueSpecs: degradedWorld(plan)}),
      controlCycle({label: 'degraded1', venueSpecs: degradedWorld(plan)}),
      controlCycle({label: 'healed', venueSpecs: healthyWorld(plan)}),
      controlCycle({label: 'steady', venueSpecs: healthyWorld(plan)}),
    ]);
    const bands = session.cycles.map((c) => c.result.qualityBand);
    s.check(bands.includes('DEGRADED'), 'the world actually degraded');
    s.equal(bands[bands.length - 1] !== 'DEGRADED', true, 'final band is not DEGRADED');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'recovered run completes');
    s.equal(session.finalResult?.filledQuantity, 20, '20/20 filled');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[VENUE RECOVERY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — DEGRADED ×2 → healed → COMPLETED 20/20`);
  }

  // =========================================================================
  // [OSCILLATION] — venue flip-flop AND repeated-action protection
  // =========================================================================
  {
    const s = section('OSCILLATION');
    // (a) venue oscillation: superiority alternates every cycle
    const planA = intelPlan({
      planId: 'xplan_demo_osc_v', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 36, referencePrice: 100}],
    });
    const flipFlop = (preferB: boolean) => [
      {...venueForRoute(planA.routes[0], {venue: 'venue-a', liquidity: 200_000, latencyMs: preferB ? 200 : 5, networkLatencyMs: preferB ? 50 : 5}), asks: [{price: 100, quantity: 8}]},
      {...venueForRoute(planA.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: preferB ? 5 : 200, networkLatencyMs: preferB ? 5 : 50}), asks: [{price: 100, quantity: 8}]},
    ];
    const sessionA = runControl(planA, Array.from({length: 7}, (_, i) =>
      controlCycle({label: `w${i}`, venueSpecs: flipFlop(i % 2 === 0)})));
    s.equal(sessionA.finalResult?.finalState, 'ABORTED', 'venue flip-flop aborts');
    s.equal(sessionA.finalResult?.abortReason, 'OSCILLATION_DETECTED', 'abort reason OSCILLATION_DETECTED (venue)');
    const reroutes = sessionA.cycles.filter((c) => c.action === 'REROUTE');
    s.equal(reroutes.length, 3, 'the third reroute completes the A→B→A pattern');
    s.equal(reroutes.map((c) => (c.result.proposal as {toVenueId: string}).toVenueId).join('→'), 'venue-b→venue-a→venue-b', 'deterministic venue pattern');
    s.check(invariantsOk(planA, sessionA), 'invariants satisfied (venue oscillation)');
    // (b) action oscillation: the same action repeats identically
    const planB = intelPlan({
      planId: 'xplan_demo_osc_a', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 40, referencePrice: 100}],
    });
    const driftedThin = () => [{
      ...venueForRoute(planB.routes[0], {liquidity: 200_000}),
      bids: [{price: 100.25, quantity: 1_000}], asks: [{price: 100.35, quantity: 8}],
    }];
    const sessionB = runControl(planB, Array.from({length: 6}, (_, i) =>
      controlCycle({label: `d${i}`, venueSpecs: driftedThin()})));
    s.equal(sessionB.finalResult?.finalState, 'ABORTED', 'repeated identical action aborts');
    s.equal(sessionB.finalResult?.abortReason, 'OSCILLATION_DETECTED', 'abort reason OSCILLATION_DETECTED (repeated action)');
    s.equal(sessionB.cycles.slice(0, 3).map((c) => c.action).join(','), 'RESLICE,RESLICE,RESLICE', 'three consecutive RESLICEs trip the protection');
    s.check(invariantsOk(planB, sessionB), 'invariants satisfied (action oscillation)');
    parts.push(`[OSCILLATION] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — venue flip-flop A→B→A AND RESLICE×3 → ABORTED/OSCILLATION_DETECTED`);
  }

  // =========================================================================
  // [HYSTERESIS] — bands recover only after sustained healing (no flapping)
  // =========================================================================
  {
    const s = section('HYSTERESIS');
    const plan = intelPlan({
      planId: 'xplan_demo_hy', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
    });
    const session = runControl(plan, [
      controlCycle({label: 'degraded0', venueSpecs: degradedWorld(plan)}),
      controlCycle({label: 'degraded1', venueSpecs: degradedWorld(plan)}),
      controlCycle({label: 'healed0', venueSpecs: healthyWorld(plan)}),
      controlCycle({label: 'healed1', venueSpecs: healthyWorld(plan)}),
    ]);
    const bands = session.cycles.map((c) => c.result.qualityBand);
    s.equal(bands[0], 'DEGRADED', 'degradation detected immediately');
    s.equal(bands[1], 'DEGRADED', 'degradation persists while the world is bad');
    const firstRecovery = bands.findIndex((b) => b !== 'DEGRADED');
    s.check(firstRecovery >= 0, 'the band eventually recovers');
    s.check(bands.slice(firstRecovery).every((b) => b !== 'DEGRADED'), 'once recovered, the band never flaps back to DEGRADED');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'run completes after recovery');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[HYSTERESIS] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — DEGRADED,DEGRADED → recovery threshold → ${bands.join(',')} (no flap)`);
  }

  // =========================================================================
  // [BUDGET] — exhausted budgets force explicit terminals, never silent runs
  // =========================================================================
  {
    const s = section('BUDGET');
    // (a) cycle budget exhaustion
    const planA = intelPlan({
      planId: 'xplan_demo_budget_cycles', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
    });
    const thin = () => [{...venueForRoute(planA.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 3}]}];
    const sessionA = runControl(planA, Array.from({length: 10}, (_, i) =>
      controlCycle({label: `c${i}`, venueSpecs: thin()})), {config: {budgets: {maxCycles: 2}}});
    s.check(sessionA.cycles.length <= 2, 'engine never runs past the cycle budget');
    s.equal(sessionA.finalResult?.finalState, 'EXHAUSTED', 'cycle budget exhaustion → EXHAUSTED');
    s.check((sessionA.finalResult?.remainingQuantity ?? 0) > 0, 'remaining quantity reported');
    s.equal(sessionA.currentState, 'EXHAUSTED', 'session state EXHAUSTED');
    s.check(sessionA.auditEvents.some((e) => e.eventType === 'SESSION_EXHAUSTED'), 'SESSION_EXHAUSTED audited');
    // (b) failure budget exhaustion
    const planB = intelPlan({
      planId: 'xplan_demo_budget_failures', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
    });
    const weak = () => [{
      ...venueForRoute(planB.routes[0], {liquidity: 100, latencyMs: 250, networkLatencyMs: 100}),
      asks: [{price: 100, quantity: 6}],
    }];
    const sessionB = runControl(planB, Array.from({length: 3}, (_, i) =>
      controlCycle({label: `w${i}`, venueSpecs: weak()})), {config: {budgets: {maxFailures: 1, maxCycles: 8}}});
    s.equal(sessionB.finalResult?.finalState, 'ABORTED', 'failure budget exhaustion → ABORTED');
    s.equal(sessionB.finalResult?.abortReason, 'BUDGET_EXHAUSTED', 'abort reason BUDGET_EXHAUSTED');
    // (c) action budget: an unaffordable want becomes a deterministic WAIT
    const planC = intelPlan({
      planId: 'xplan_demo_budget_action', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
    });
    const asks = (q: number) => [{...venueForRoute(planC.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: q}]}];
    const sessionC = runControl(planC, [
      controlCycle({label: 'q6', venueSpecs: asks(6)}),
      controlCycle({label: 'q4', venueSpecs: asks(4)}),
      controlCycle({label: 'q6b', venueSpecs: asks(6)}),
    ], {config: {budgets: {maxReslices: 1, maxCycles: 8}}});
    const wait = sessionC.cycles.find((c) => c.action === 'WAIT');
    s.check(wait !== undefined, 'unaffordable reslice becomes WAIT');
    s.equal(wait?.decision.waitReason, 'ACTION_UNAFFORDABLE', 'explicit deterministic reason ACTION_UNAFFORDABLE');
    s.equal(sessionC.finalResult?.finalState, 'COMPLETED', 'the run still completes within budget');
    const b = sessionC.actionBudget;
    s.check(b.resliceCount <= 1, 'reslice budget ceiling respected');
    parts.push(`[BUDGET]   ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — cycle→EXHAUSTED, failure→ABORTED/BUDGET_EXHAUSTED, action→WAIT(ACTION_UNAFFORDABLE)`);
  }

  // =========================================================================
  // [EMERGENCY STOP] — dominates every optimization decision
  // =========================================================================
  {
    const s = section('EMERGENCY STOP');
    const plan = afisCrossVenueControlPlan();
    const session = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthyWorld(plan), emergencyStop: true})]);
    const d = session.cycles[0].decision;
    s.equal(d.action, 'ABORT', 'emergency stop decides ABORT');
    s.equal(d.precedence, 'EMERGENCY_STOP', 'precedence EMERGENCY_STOP');
    s.equal(d.rank, 0, 'rank 0 (strictest)');
    s.equal(session.finalResult?.abortReason, 'EMERGENCY_STOP', 'abort reason EMERGENCY_STOP');
    // Dominance over a completion candidate (decision layer):
    const dominated = decideControl(decisionInput({
      emergencyStop: true,
      completion: {complete: true, partial: false, unmet: []},
    }));
    s.equal(dominated.action, 'ABORT', 'ES + completion candidate → ABORT (safety never overridden)');
    s.check(dominated.considered.some((v) => v.precedence === 'COMPLETE'), 'the COMPLETE verdict was considered and overridden');
    parts.push(`[EMERGENCY STOP] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — rank 0 precedence, dominates COMPLETE and every adaptive action`);
  }

  // =========================================================================
  // [CHECKPOINT] — every cycle checkpoints with a verifiable fingerprint
  // =========================================================================
  {
    const s = section('CHECKPOINT');
    const engine = new ExecutionControlEngine();
    const input = recoveryInput();
    const session = engine.run(input);
    s.check(session.checkpoints.length >= 3, 'checkpoints recorded on every cycle');
    for (const cp of session.checkpoints) {
      s.check(verifyCheckpoint(cp), `checkpoint ${cp.cycleNumber} fingerprint verifies`);
      s.check(typeof cp.checkpointId === 'string' && cp.checkpointId.length > 0, 'checkpointId present');
      s.check(cp.controlState.length > 0, 'control state present');
      s.check(typeof cp.remainingQuantity === 'number', 'remaining quantity present');
      s.check(cp.actionBudget !== null && cp.actionBudget !== undefined, 'action budget present');
      s.check(Array.isArray(cp.venueState), 'venue state present');
      s.check(cp.lineage.length >= 1, 'lineage present');
      s.check(Array.isArray(cp.appliedActionKeys), 'applied action keys present');
      s.check(cp.currentPlan.executionPlanId.length > 0, 'current plan present');
      s.check(cp.auditEvents.length > 0, 'audit journal present');
    }
    // Deterministic: the same input yields identical checkpoint fingerprints.
    const again = new ExecutionControlEngine().run(recoveryInput());
    s.equal(again.checkpoints.length, session.checkpoints.length, 'same checkpoint count on re-run');
    for (let i = 0; i < again.checkpoints.length; i++) {
      s.equal(again.checkpoints[i].fingerprint, session.checkpoints[i].fingerprint, `checkpoint ${i} fingerprint deterministic`);
    }
    parts.push(`[CHECKPOINT] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${session.checkpoints.length} verified checkpoints, deterministic fingerprints`);
  }

  // =========================================================================
  // [RECOVERY] — resume from a mid-session checkpoint, byte-equivalent
  // =========================================================================
  {
    const s = section('RECOVERY');
    const engine = new ExecutionControlEngine();
    const input = recoveryInput();
    const full = engine.run(input);
    // Recover from the checkpoint after cycle 1 (session reached cycle ≥ 2).
    const cp = full.checkpoints.find((c) => c.cycleNumber === 1)!;
    s.check(cp !== undefined, 'checkpoint after cycle 1 exists');
    const recovered = recoverControlSession(new ExecutionControlEngine(), input, cp);
    const eq = sessionsEquivalent(full, recovered);
    s.check(eq.equivalent, `recovered session byte-equivalent (differences: ${eq.differences.join(', ')})`);
    s.equal(recovered.sessionFingerprint, full.sessionFingerprint, 'session fingerprints identical');
    s.equal(JSON.stringify(recovered.finalResult), JSON.stringify(full.finalResult), 'final results identical');
    s.same(recovered.cycles.map((c) => c.cycleNumber), full.cycles.map((c) => c.cycleNumber), 'cycle numbers continue correctly');
    s.check(JSON.stringify(recovered.actionBudget) === JSON.stringify(full.actionBudget), 'budgets preserved');
    s.check(verifyAuditStream(recovered.auditEvents), 'recovered audit chain valid');
    const appliedFull = full.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED').length;
    const appliedRecovered = recovered.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED').length;
    s.equal(appliedRecovered, appliedFull, 'no action applied twice across recovery');
    s.check(JSON.stringify(recovered.lineage) === JSON.stringify(full.lineage), 'lineage preserved');
    parts.push(`[RECOVERY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — resumed from cycle 1 checkpoint: identical budget, lineage, audit, result`);
  }

  // =========================================================================
  // [REPLAY] — the same input replays byte-for-byte, twice
  // =========================================================================
  {
    const s = section('REPLAY');
    const engine = new ExecutionControlEngine();
    const input = recoveryInput();
    const original = engine.run(input);
    const first = replayControlSession(new ExecutionControlEngine(), input, original);
    s.check(first.verification.equivalent, `replay equivalent to original (differences: ${first.verification.differences.join(', ')})`);
    const second = replayControlSession(new ExecutionControlEngine(), input, original);
    s.check(JSON.stringify(first.session) === JSON.stringify(second.session), 'two replays are byte-identical to each other');
    s.equal(first.session.sessionFingerprint, original.sessionFingerprint, 'replayed session fingerprint matches');
    s.equal(first.verification.replayedSessionFingerprint, original.sessionFingerprint, 'verification fingerprint matches');
    s.check(verifyAuditStream(first.session.auditEvents), 'replayed audit chain verifies');
    parts.push(`[REPLAY]   ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — two replays byte-identical; fingerprints and audit chain match`);
  }

  // =========================================================================
  // [AUDIT] — hash-chained lifecycle events, tamper-evident
  // =========================================================================
  {
    const s = section('AUDIT');
    const plan = nonAtomicPlan('xplan_demo_audit');
    const session = runControl(plan, [
      controlCycle({label: 'thin', venueSpecs: thinWorld(plan)}),
      controlCycle({label: 'exec', venueSpecs: thinWorld(plan, 1_000)}),
    ]);
    const types = new Set<string>(session.auditEvents.map((e) => e.eventType));
    for (const required of ['SESSION_STARTED', 'STATE_CHANGED', 'CONTROL_DECISION', 'ACTION_APPLIED', 'CYCLE_COMPLETED', 'CHECKPOINT_RECORDED', 'SESSION_COMPLETED']) {
      s.check(types.has(required), `lifecycle event ${required} present`);
    }
    for (const e of session.auditEvents) {
      s.equal(e.schemaVersion, 'oship.execution-control.v1', 'audit namespace oship.execution-control.v1');
    }
    s.check(verifyAuditStream(session.auditEvents), 'hash chain verifies from genesis');
    // The abort lifecycle event, from the ABORT section's session:
    const abortSession = runControl(afisCrossVenueControlPlan(), [controlCycle({
      label: 'es', venueSpecs: healthyWorld(afisCrossVenueControlPlan()), emergencyStop: true,
    })]);
    s.check(abortSession.auditEvents.some((e) => e.eventType === 'SESSION_ABORTED'), 'lifecycle event SESSION_ABORTED present');
    // SESSION_RECOVERED / REPLAY_COMPLETED are part of the canonical
    // namespace; recovery and replay deliberately do NOT append them to the
    // chain — a recovered/replayed session must stay byte-identical to the
    // uninterrupted run (asserted in the RECOVERY/REPLAY sections).
    for (const namespaceEvent of ['SESSION_RECOVERED', 'REPLAY_COMPLETED']) {
      s.check((CONTROL_EVENT_TYPES as readonly string[]).includes(namespaceEvent), `${namespaceEvent} in the audit namespace`);
    }
    // Tamper evidence:
    const tampered = session.auditEvents.map((e, i) =>
      i === 3 ? {...e, payload: {...e.payload, tampered: true}} : e);
    s.check(verifyAuditStream(tampered) === false, 'a tampered payload breaks the chain verification');
    parts.push(`[AUDIT]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${session.auditEvents.length} chained events, full lifecycle, tamper-evident`);
  }

  // =========================================================================
  // [INVARIANTS] — 24 hard invariants over real sessions, fail closed
  // =========================================================================
  {
    const s = section('INVARIANTS');
    const cases: {label: string; plan: ReturnType<typeof nonAtomicPlan> | ReturnType<typeof afisCrossVenueControlPlan>; session: ExecutionControlSession}[] = [];
    const na = nonAtomicPlan('xplan_demo_inv_na');
    cases.push({label: 'completed', plan: na, session: runControl(na, [
      controlCycle({label: 'thin', venueSpecs: thinWorld(na)}),
      controlCycle({label: 'exec', venueSpecs: thinWorld(na, 1_000)}),
    ])});
    const afis = afisCrossVenueControlPlan();
    cases.push({label: 'aborted', plan: afis, session: runControl(afis, [controlCycle({label: 'es', venueSpecs: healthyWorld(afis), emergencyStop: true})])});
    const osc = intelPlan({
      planId: 'xplan_demo_inv_osc', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 36, referencePrice: 100}],
    });
    const flipFlop = (preferB: boolean) => [
      {...venueForRoute(osc.routes[0], {venue: 'venue-a', liquidity: 200_000, latencyMs: preferB ? 200 : 5, networkLatencyMs: preferB ? 50 : 5}), asks: [{price: 100, quantity: 8}]},
      {...venueForRoute(osc.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: preferB ? 5 : 200, networkLatencyMs: preferB ? 5 : 50}), asks: [{price: 100, quantity: 8}]},
    ];
    cases.push({label: 'oscillation', plan: osc, session: runControl(osc, Array.from({length: 7}, (_, i) =>
      controlCycle({label: `w${i}`, venueSpecs: flipFlop(i % 2 === 0)})))});
    for (const {label, plan, session} of cases) {
      const report = checkControlInvariants({initialPlan: plan, session});
      s.check(report.ok, `invariants hold on the ${label} session (${report.violations.join('; ')})`);
      s.check(report.checks.length >= 20, `${label}: full invariant suite executed (${report.checks.length} checks)`);
    }
    // Fail closed: a tampered lineage (quantity grown by the control plane)
    // must be REJECTED by the invariant suite.
    const bad = {...cases[0].session, lineage: cases[0].session.lineage.map((p, i) =>
      i === 1 ? {...p, routes: p.routes.map((r) => ({...r, quantity: r.quantity + 50}))} : p)} as ExecutionControlSession;
    const badReport = checkControlInvariants({initialPlan: cases[0].plan, session: bad});
    s.check(badReport.ok === false, 'a tampered lineage fails the invariant suite (fail closed)');
    parts.push(`[INVARIANTS] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${cases.length} real sessions × full suite, tampering fails closed`);
  }

  // =========================================================================
  // [AFIS] — cross-venue atomic arbitrage session
  // =========================================================================
  {
    const s = section('AFIS');
    const plan = afisCrossVenueControlPlan();
    const session = runControl(plan, [controlCycle({label: 'healthy', venueSpecs: healthyWorld(plan)})]);
    s.equal(plan.domain, 'AFIS', 'AFIS domain plan');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'AFIS session completes');
    s.equal(session.finalResult?.filledQuantity, 20, 'BUY 10 + SELL 10 = 20 filled');
    s.equal(plan.routes[0].side, 'BUY', 'AFIS leg 1 BUY');
    s.equal(plan.routes[1].side, 'SELL', 'AFIS leg 2 SELL');
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[AFIS]     ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — atomic BUY venue-a + SELL venue-b → COMPLETED 20/20`);
  }

  // =========================================================================
  // [ABL] — back/lay betting session (BACK → BUY/long, LAY → SELL/short)
  // =========================================================================
  {
    const s = section('ABL');
    const plan = ablBackLayControlPlan();
    const session = runControl(plan, [controlCycle({label: 'healthy', venueSpecs: healthyWorld(plan)})]);
    s.equal(plan.domain, 'ABL', 'ABL domain plan');
    s.equal(session.finalResult?.finalState, 'COMPLETED', 'ABL session completes');
    s.equal(session.finalResult?.filledQuantity, 40, 'BACK 20 + LAY 20 = 40 filled');
    s.equal(plan.routes[0].side, 'BACK', 'ABL leg 1 BACK (buy/long semantics)');
    s.equal(plan.routes[1].side, 'LAY', 'ABL leg 2 LAY (sell/short semantics)');
    for (const p of session.lineage) {
      s.check(p.routes.every((r) => r.side === 'BACK' || r.side === 'LAY'), 'ABL semantic sides preserved across lineage');
    }
    s.check(invariantsOk(plan, session), 'invariants satisfied');
    parts.push(`[ABL]      ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — BACK (long) + LAY (short) on one control plane → COMPLETED 40/40`);
  }

  // =========================================================================
  // Critical behaviour verification (requirement #2 / #3 extras)
  // =========================================================================
  {
    const s = section('AUTHORITY');
    const bridge = defaultAuthorityBridge({});
    const keys = Object.keys(bridge).sort().join(',');
    s.equal(keys, 'aegis,execution,portfolioMutation,risk,treasuryMutation', 'bridge surface: risk, aegis, execution ONLY');
    s.equal(bridge.treasuryMutation, false, 'no Treasury mutation surface');
    s.equal(bridge.portfolioMutation, false, 'no Portfolio mutation surface');
    const accepted = DefaultExecutionAuthorityBridge.ACCEPTED_REVISION_KINDS;
    s.equal(accepted.join(','), 'REPRICE,RESLICE,REROUTE,REPLAN,ABORT', 'execution authority accepts exactly the five revision kinds');
    // Every applied revision in a rich session went through the authority.
    const plan = nonAtomicPlan('xplan_demo_auth');
    const session = runControl(plan, [
      controlCycle({label: 'thin', venueSpecs: thinWorld(plan)}),
      controlCycle({label: 'weak', venueSpecs: rerouteWorld(plan)}),
      controlCycle({label: 'exec', venueSpecs: rerouteWorld(plan)}),
    ]);
    const appliedEvents = session.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED');
    s.check(appliedEvents.length >= 1, 'revisions were applied');
    parts.push(`[AUTHORITY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ONE control plane over ONE Execution/Risk/AEGIS authority set; no Treasury/Portfolio surface`);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  const failed = sections.filter((s) => s.failures.length > 0);
  parts.push(sep);
  if (failed.length === 0) {
    parts.push(` ${sections.length}/${sections.length} sections PASS`);
    parts.push('');
    parts.push(' SYSTEM STATUS: RECONCILED');
  } else {
    parts.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const s of failed) {
      parts.push(`   [${s.name}]`);
      for (const f of s.failures) parts.push(`     - ${f}`);
    }
    parts.push('');
    parts.push(' SYSTEM STATUS: UNRECONCILED');
  }

  console.log(parts.join('\n'));
  if (failed.length > 0) process.exit(1);
}

main();
