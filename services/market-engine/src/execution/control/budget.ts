import {ControlBudgetState, ControlBudgetSpec, ControlAction, ActionUsage, BudgetDecision, ControlAction as CA} from './types';

/**
 * Sprint 033 — Autonomous Control Budget.
 *
 * Deterministic per-action budgets. Every action has a current count, a
 * maximum, a remaining budget and a deterministic rejection reason. Budget
 * exhaustion is explicit: the controller stops (EXHAUSTED) or aborts; it
 * never silently continues.
 */

export function initialControlBudget(): ControlBudgetState {
  return Object.freeze({
    cycleCount: 0,
    repriceCount: 0,
    resliceCount: 0,
    rerouteCount: 0,
    replanCount: 0,
    failureCount: 0,
    elapsedMs: 0,
  });
}

function counterFor(action: ControlAction): keyof ControlBudgetState | null {
  switch (action) {
    case 'REPRICE': return 'repriceCount';
    case 'RESLICE': return 'resliceCount';
    case 'REROUTE': return 'rerouteCount';
    case 'REPLAN': return 'replanCount';
    default: return null;
  }
}

function maximumFor(action: ControlAction, spec: ControlBudgetSpec): number | null {
  switch (action) {
    case 'REPRICE': return spec.maxReprices;
    case 'RESLICE': return spec.maxReslices;
    case 'REROUTE': return spec.maxReroutes;
    case 'REPLAN': return spec.maxReplans;
    default: return null;
  }
}

/** Usage view of one action: current / maximum / remaining. */
export function actionUsage(action: ControlAction, budget: ControlBudgetState, spec: ControlBudgetSpec): ActionUsage {
  const key = counterFor(action);
  const maximum = maximumFor(action, spec);
  const current = key === null ? 0 : budget[key] as number;
  return Object.freeze({
    action,
    current,
    maximum: maximum ?? 0,
    remaining: maximum === null ? Number.POSITIVE_INFINITY : Math.max(0, maximum - current),
  });
}

/** Usage views for every budgeted action. */
export function actionBudgetView(budget: ControlBudgetState, spec: ControlBudgetSpec): readonly ActionUsage[] {
  const actions: readonly CA[] = ['REPRICE', 'RESLICE', 'REROUTE', 'REPLAN'];
  return Object.freeze(actions.map((a) => actionUsage(a, budget, spec)));
}

/**
 * Consume one unit of an action's budget. Pure: returns the new budget state
 * or a deterministic rejection. Non-budgeted actions (CONTINUE / WAIT /
 * COMPLETE / ABORT) consume nothing.
 */
export function consumeActionBudget(
  action: ControlAction,
  budget: ControlBudgetState,
  spec: ControlBudgetSpec,
): BudgetDecision {
  const key = counterFor(action);
  if (key === null) return {allowed: true, budget};
  const maximum = maximumFor(action, spec);
  const current = budget[key] as number;
  if (maximum !== null && current >= maximum) {
    return {
      allowed: false,
      reason: `${action} budget exhausted: ${current}/${maximum} used, 0 remaining`,
      usage: Object.freeze({action, current, maximum, remaining: 0}),
    };
  }
  return {
    allowed: true,
    budget: Object.freeze({...budget, [key]: current + 1}),
  };
}

/** Whether any action budget remains for the given action. */
export function canAfford(action: ControlAction, budget: ControlBudgetState, spec: ControlBudgetSpec): boolean {
  return consumeActionBudget(action, budget, spec).allowed;
}

/** Record one failed cycle / rejected action against the failure budget. */
export function recordFailure(budget: ControlBudgetState): ControlBudgetState {
  return Object.freeze({...budget, failureCount: budget.failureCount + 1});
}

/** Whether the failure budget is exhausted. */
export function failureBudgetExhausted(budget: ControlBudgetState, spec: ControlBudgetSpec): boolean {
  return budget.failureCount >= spec.maxFailures;
}

/** Whether the cycle budget allows another cycle. */
export function cycleBudgetAvailable(budget: ControlBudgetState, spec: ControlBudgetSpec): boolean {
  return budget.cycleCount < spec.maxCycles;
}

/** Whether the execution-time budget allows continuing. */
export function timeBudgetAvailable(budget: ControlBudgetState, spec: ControlBudgetSpec): boolean {
  return budget.elapsedMs < spec.maxExecutionTimeMs;
}

/**
 * The deterministic reason the run must stop as EXHAUSTED (cycle or time
 * budget), or null when budgets remain.
 */
export function exhaustionReason(budget: ControlBudgetState, spec: ControlBudgetSpec): string | null {
  if (!cycleBudgetAvailable(budget, spec)) {
    return `cycle budget exhausted: ${budget.cycleCount}/${spec.maxCycles} cycles used`;
  }
  if (!timeBudgetAvailable(budget, spec)) {
    return `execution time budget exhausted: ${budget.elapsedMs}ms ≥ ${spec.maxExecutionTimeMs}ms`;
  }
  return null;
}
