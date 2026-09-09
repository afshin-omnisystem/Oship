import {ExecutionPlan, ReplanResult, ReplanReason} from './types';

/**
 * Deterministic replanning.
 *
 * Replan triggers: venue unavailable, liquidity reduced, price moved,
 * opportunity stale, risk changed, allocation changed, partial fill, deadline
 * approaching. Produces REPLAN_REQUIRED or a new execution-plan version with
 * `parent_plan_id` and `replan_reason` set, preserving plan history.
 */
export function evaluateReplan(input: {
  readonly plan: ExecutionPlan;
  readonly trigger: ReplanReason | null;
  readonly controlState: string;
  readonly venueAvailable: boolean;
  readonly liquidityAvailable: number;
  readonly deadlineApproaching: boolean;
}): ReplanResult {
  const {plan, trigger, controlState} = input;
  const blocked = plan.status === 'BLOCKED' || plan.status === 'FAILED' || plan.status === 'STALE' || plan.status === 'EXPIRED';
  const emergency = controlState === 'EMERGENCY_STOP' || controlState === 'HALTED';

  // Emergency stop is authoritative: it cannot be replanned around.
  if (emergency) {
    return Object.freeze({
      replanRequired: true,
      planVersion: plan.version,
      parentPlanId: plan.executionPlanId,
      replanReason: 'EMERGENCY_STOP',
      reason: 'emergency stop active; replan blocked',
      newPlan: null,
    });
  }

  if (blocked) {
    return Object.freeze({
      replanRequired: false,
      planVersion: plan.version,
      parentPlanId: plan.executionPlanId,
      replanReason: null,
      reason: 'plan is in a terminal/blocked state; cannot replan',
      newPlan: null,
    });
  }

  const reason: ReplanReason | null = trigger ?? (
    !input.venueAvailable ? 'VENUE_UNAVAILABLE' :
    input.liquidityAvailable < plan.approvedCapital ? 'LIQUIDITY_REDUCED' :
    input.deadlineApproaching ? 'DEADLINE_APPROACHING' : null
  );

  if (reason === null) {
    return Object.freeze({
      replanRequired: false,
      planVersion: plan.version,
      parentPlanId: plan.executionPlanId,
      replanReason: null,
      reason: 'no replan trigger',
      newPlan: null,
    });
  }

  // A new plan version is required (history is preserved by the engine).
  return Object.freeze({
    replanRequired: true,
    planVersion: plan.version + 1,
    parentPlanId: plan.executionPlanId,
    replanReason: reason,
    reason: `replan required: ${reason}`,
    newPlan: null,
  });
}
