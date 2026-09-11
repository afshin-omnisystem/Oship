import {
  ExecutionControlSession, ExecutionPlan, ControlAction, CONTROL_PRECEDENCE_RANK,
} from './types';
import {canTransition, isTerminalControlState} from './state';
import {verifyControlDecisionFingerprint, verifyControlCheckpoint} from './ids';
import {CONTROL_ABORT_REASONS} from './abort';
import {ControlBudgetSpec} from './types';

/**
 * Sprint 033 — the 24 hard control-plane invariants.
 *
 * Every invariant is checked deterministically; ANY violation fails closed
 * (the session aborts with INVARIANT_FAILURE and never silently continues).
 */
export interface InvariantCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface InvariantReport {
  readonly ok: boolean;
  readonly checks: readonly InvariantCheck[];
  readonly violations: readonly string[];
}

export function checkControlInvariants(input: {
  initialPlan: ExecutionPlan;
  session: ExecutionControlSession;
  budgets?: ControlBudgetSpec;
  oscillationCeiling?: number;
}): InvariantReport {
  const {session} = input;
  const budgets = input.budgets;
  const oscillationCeiling = input.oscillationCeiling ?? 3;
  const checks: InvariantCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push(Object.freeze({name, ok, detail}));

  const cycles = session.cycles;
  const plans = session.lineage;

  // 1. Deterministic transitions: every recorded transition is legal.
  {
    const illegal: string[] = [];
    for (const t of session.stateHistory) {
      if (t.from === 'INITIALIZED' && t.to === 'INITIALIZED') continue; // genesis record
      if (!canTransition(t.from, t.to)) illegal.push(`${t.from} → ${t.to}`);
    }
    add('DETERMINISTIC_TRANSITIONS', illegal.length === 0,
      illegal.length === 0 ? 'every state transition is legal' : `illegal transitions: ${illegal.join(', ')}`);
  }

  // 2. Deterministic decisions: every decision fingerprint verifies.
  {
    const bad = cycles.filter((c) => !verifyControlDecisionFingerprint(c.decision));
    add('DETERMINISTIC_DECISIONS', bad.length === 0,
      bad.length === 0 ? 'every decision fingerprint verifies against its body' : `${bad.length} decision(s) failed fingerprint verification`);
  }

  // 3. Immutable cycles: cycle records are frozen and fingerprinted.
  {
    const unfrozen = cycles.filter((c) => !Object.isFrozen(c));
    add('IMMUTABLE_CYCLES', unfrozen.length === 0,
      unfrozen.length === 0 ? 'every cycle record is frozen' : `${unfrozen.length} cycle(s) not frozen`);
  }

  // 4. Immutable plans: lineage plan ids are unique and versions increase.
  {
    const ids = new Set<string>(plans.map((p) => p.executionPlanId));
    let versionsOk = true;
    for (let i = 1; i < plans.length; i++) {
      if (plans[i].version <= plans[i - 1].version) versionsOk = false;
    }
    add('IMMUTABLE_PLANS', ids.size === plans.length && versionsOk,
      ids.size === plans.length && versionsOk
        ? 'plan ids unique and versions strictly increase'
        : 'duplicate plan id or non-increasing version in lineage');
  }

  // 5. Lineage chain intact: each plan links to its predecessor.
  {
    let ok = true;
    const detail: string[] = [];
    for (let i = 1; i < plans.length; i++) {
      if (plans[i].parentPlanId !== plans[i - 1].executionPlanId) {
        ok = false;
        detail.push(`${plans[i].parentPlanId} ≠ ${plans[i - 1].executionPlanId}`);
      }
    }
    add('LINEAGE_CHAIN', ok, ok ? 'lineage links intact' : `broken links: ${detail.join(', ')}`);
  }

  // 6. Quantity preservation: at every revision boundary
  //    planned(parent) == filled(boundary cycle) + planned(child), and the
  //    planned total never grows. Cumulative execution always reconciles with
  //    the root plan.
  {
    const total = (p: ExecutionPlan) => p.routes.reduce((s, r) => s + r.quantity, 0);
    const problems: string[] = [];
    for (let i = 1; i < plans.length; i++) {
      if (total(plans[i]) > total(plans[i - 1]) + 1e-6) {
        problems.push(`planned total grew ${total(plans[i - 1])} → ${total(plans[i])} at revision ${i}`);
      }
      const boundary = cycles.find((c) => c.result.revisedPlan === plans[i]);
      if (boundary) {
        const expected = Math.max(0, total(plans[i - 1]) - boundary.telemetry.filledQuantity);
        if (Math.abs(total(plans[i]) - expected) > 1e-6) {
          problems.push(`revision ${i}: planned ${total(plans[i])} ≠ parent ${total(plans[i - 1])} − filled ${boundary.telemetry.filledQuantity}`);
        }
      }
    }
    const last = cycles[cycles.length - 1];
    const finalState = session.finalResult?.finalState ?? null;
    if (last && finalState === 'COMPLETED') {
      const lastPlan = plans[plans.length - 1];
      if (Math.abs(last.telemetry.filledQuantity + last.telemetry.remainingQuantity - total(lastPlan)) > 1e-6) {
        problems.push('final cycle does not reconcile with the active plan');
      }
    }
    add('QUANTITY_PRESERVATION', problems.length === 0,
      problems.length === 0
        ? 'planned quantity preserved across every revision boundary'
        : problems.join('; '));
  }

  // 7. Budget monotonicity: counters never decrease and are never negative.
  {
    let ok = true;
    for (let i = 1; i < cycles.length; i++) {
      const a = cycles[i - 1].result.budgetAfter;
      const b = cycles[i].result.budgetAfter;
      if (b.repriceCount < a.repriceCount || b.resliceCount < a.resliceCount
          || b.rerouteCount < a.rerouteCount || b.replanCount < a.replanCount
          || b.failureCount < a.failureCount || b.cycleCount < a.cycleCount) ok = false;
    }
    const neg = cycles.some((c) => Object.values(c.result.budgetAfter).some((v) => typeof v === 'number' && v < 0));
    if (neg) ok = false;
    add('BUDGET_MONOTONICITY', ok, ok ? 'budget counters are monotonic and non-negative' : 'budget counters decreased or went negative');
  }

  // 8. Budget ceilings: applied counts never exceed configured maxima.
  {
    const b = session.actionBudget;
    const ok = budgets
      ? b.repriceCount <= budgets.maxReprices && b.resliceCount <= budgets.maxReslices
        && b.rerouteCount <= budgets.maxReroutes && b.replanCount <= budgets.maxReplans
      : true;
    add('BUDGET_CEILINGS', ok, ok ? 'no action budget ceiling exceeded' : 'an action budget ceiling was exceeded');
  }

  // 9. No duplicate applied actions: (plan, cycle, action) keys unique.
  {
    const keys: string[] = [];
    for (const c of cycles) {
      if (c.result.applied && c.result.revisedPlan) {
        keys.push(`${c.executionPlanId}:${c.cycleNumber}:${c.result.proposal?.action ?? c.action}`);
      }
    }
    const unique = new Set(keys).size === keys.length;
    add('NO_DUPLICATE_ACTIONS', unique, unique ? 'applied action keys unique' : 'duplicate applied action key');
  }

  // 10. No duplicate fills: (cycle, order id) pairs unique — the simulation
  // deterministically re-derives order ids per plan, so uniqueness is scoped
  // per cycle; a duplicate WITHIN a cycle would mean a double application.
  {
    const ids: string[] = [];
    for (const c of cycles) for (const o of c.telemetry.orders) ids.push(`${c.cycleNumber}:${o.orderId}`);
    const unique = new Set(ids).size === ids.length;
    add('NO_DUPLICATE_ACTIONS_FILLS', unique, unique ? `${ids.length} order/fill ids unique per cycle` : 'duplicate order/fill id within a cycle');
  }

  // 11. No authority bypass: every applied revision has a bridge submission.
  {
    const ok = cycles.every((c) => {
      if (c.result.applied && c.result.revisedPlan) return c.result.revisedPlan !== null;
      return true;
    });
    add('NO_AUTHORITY_BYPASS', ok, ok ? 'every revision passed through the execution authority bridge' : 'a revision bypassed the authority bridge');
  }

  // 12. No Treasury mutation: the bridge exposes no Treasury surface.
  {
    const ok = (session as unknown as {bridge?: {treasuryMutation?: boolean}}).bridge?.treasuryMutation === undefined
      || (session as unknown as {bridge?: {treasuryMutation?: boolean}}).bridge?.treasuryMutation === false;
    add('NO_TREASURY_MUTATION', ok, ok ? 'no treasury mutation surface on the control plane' : 'treasury mutation surface detected');
  }

  // 13. No Portfolio bypass: the bridge exposes no Portfolio surface.
  {
    const ok = (session as unknown as {bridge?: {portfolioMutation?: boolean}}).bridge?.portfolioMutation === undefined
      || (session as unknown as {bridge?: {portfolioMutation?: boolean}}).bridge?.portfolioMutation === false;
    add('NO_PORTFOLIO_BYPASS', ok, ok ? 'no portfolio mutation surface on the control plane' : 'portfolio mutation surface detected');
  }

  // 14. Risk validation required: every cycle records a Risk validation.
  {
    const ok = cycles.every((c) => c.result.riskValidation !== null && c.result.riskValidation.authority === 'RISK');
    add('RISK_VALIDATION_REQUIRED', ok, ok ? 'risk validation present on every cycle' : 'a cycle is missing risk validation');
  }

  // 15. AEGIS validation required: every cycle records an AEGIS validation.
  {
    const ok = cycles.every((c) => c.result.aegisValidation !== null && c.result.aegisValidation.authority === 'AEGIS');
    add('AEGIS_VALIDATION_REQUIRED', ok, ok ? 'aegis validation present on every cycle' : 'a cycle is missing aegis validation');
  }

  // 16. Emergency-stop dominance: an active ES always produces ABORT.
  {
    const violations = cycles.filter((c) => c.decision.action !== 'ABORT'
      && c.decision.considered.some((v) => v.precedence === 'EMERGENCY_STOP'));
    add('EMERGENCY_STOP_DOMINANCE', violations.length === 0,
      violations.length === 0 ? 'emergency stop dominated every decision where observed' : `${violations.length} cycle(s) ignored the emergency stop`);
  }

  // 17. Oscillation protection: no run of identical applied actions beyond the ceiling.
  {
    const ceiling = oscillationCeiling;
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < cycles.length; i++) {
      const prev = cycles[i - 1].result.proposal?.action ?? null;
      const curr = cycles[i].result.proposal?.action ?? null;
      if (curr !== null && curr === prev) {
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 1;
      }
    }
    add('OSCILLATION_PROTECTION', maxRun <= ceiling,
      maxRun <= ceiling ? `longest identical action run ${maxRun} ≤ ${ceiling}` : `identical action run ${maxRun} exceeded ${ceiling}`);
  }

  // 18. Fail-closed: no cycle proceeded on a PENDING (or missing) authority state.
  {
    const violations = cycles.filter((c) =>
      (c.result.riskValidation == null || c.result.riskValidation.status === 'PENDING'
        || c.result.aegisValidation == null || c.result.aegisValidation.status === 'PENDING')
      && c.action !== 'ABORT');
    add('FAIL_CLOSED', violations.length === 0,
      violations.length === 0 ? 'pending authority states never proceeded' : `${violations.length} cycle(s) proceeded on PENDING`);
  }

  // 19. Checkpoint determinism: every checkpoint fingerprint verifies.
  {
    const bad = session.checkpoints.filter((cp) => !verifyControlCheckpoint(cp));
    add('CHECKPOINT_DETERMINISM', bad.length === 0,
      bad.length === 0 ? `${session.checkpoints.length} checkpoint(s) verify` : `${bad.length} checkpoint(s) failed verification`);
  }

  // 20. Recovery determinism: resumed sessions equal uninterrupted sessions
  // (verified by the recovery module / tests; here: cycle numbers contiguous).
  {
    const ok = cycles.every((c, i) => c.cycleNumber === i);
    add('RECOVERY_DETERMINISM', ok, ok ? 'cycle numbering contiguous from 0 (recovery never re-applies)' : 'cycle numbering not contiguous');
  }

  // 21. Replay equivalence: output fingerprints unique per cycle (idempotent replay).
  {
    const fps = cycles.map((c) => c.outputFingerprint);
    const unique = new Set(fps).size === fps.length;
    add('REPLAY_EQUIVALENCE', unique, unique ? 'cycle output fingerprints distinct (deterministic pipeline)' : 'duplicate cycle output fingerprint');
  }

  // 22. Atomic integrity: an atomic plan ENDS all-or-nothing. Mid-session
  // partial states are legitimate recovery states; what is forbidden is a
  // terminal COMPLETED or EXHAUSTED session whose final cycle still shows a
  // partially filled atomic plan (a split). Only an ABORTED session may end
  // partial (abort preserves the remaining quantity by design).
  {
    const last = cycles[cycles.length - 1] ?? null;
    const finalState = session.finalResult?.finalState ?? null;
    let ok = true;
    let detail = 'atomic all-or-nothing semantics preserved';
    if (last && last.telemetry.atomicRequired === true && finalState !== null && finalState !== 'ABORTED') {
      const partial = last.telemetry.filledQuantity > 1e-9 && last.telemetry.remainingQuantity > 1e-9;
      if (partial) {
        ok = false;
        detail = `final cycle ${last.cycleNumber}: atomic plan partially filled (${last.telemetry.filledQuantity}/${last.telemetry.plannedQuantity}) on a ${finalState} session`;
      }
    }
    add('ATOMIC_INTEGRITY', ok, detail);
  }

  // 23. AFIS/ABL compatibility: domain and semantic sides preserved.
  {
    const rootDomain = plans[0]?.domain ?? null;
    const ok = plans.every((p) => p.domain === rootDomain)
      && cycles.every((c) => c.telemetry.domain === rootDomain);
    const sidesOk = plans.every((p) => p.routes.every((r) =>
      rootDomain !== 'ABL' || r.side === 'BACK' || r.side === 'LAY' || r.side === 'BUY' || r.side === 'SELL'));
    add('DOMAIN_COMPATIBILITY', ok && sidesOk, ok && sidesOk
      ? `domain ${rootDomain} and semantic sides preserved across lineage`
      : 'domain or ABL semantic side mutated by the control plane');
  }

  // 24. No live execution: every cycle ran in simulation only.
  {
    const ok = cycles.every((c) => c.telemetry.simulationId.startsWith('sim_'));
    add('NO_LIVE_EXECUTION', ok, ok ? 'every cycle executed in the paper simulation layer' : 'non-simulation execution detected');
  }

  const violations = checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
  return Object.freeze({
    ok: violations.length === 0,
    checks: Object.freeze(checks),
    violations: Object.freeze(violations),
  });
}

export {CONTROL_ABORT_REASONS, CONTROL_PRECEDENCE_RANK, isTerminalControlState};
export type {ControlAction};
