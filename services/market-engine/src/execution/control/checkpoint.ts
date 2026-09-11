import {
  ControlCheckpoint, ExecutionControlCycle, ControlBudgetState, ExecutionPlan,
  CycleObservation, ControlStateTransition, ControlAction, QualityBand,
  AuthorityValidation, VenueHealthState, ControlAuditEvent,
} from './types';
import {LineageView} from './lineage';
import {controlCheckpointId, controlCheckpointFingerprintOf, verifyControlCheckpoint} from './ids';

/**
 * Sprint 033 — control checkpoints.
 *
 * A checkpoint captures EVERYTHING needed to resume deterministically:
 * the cycle pointer, control state, action budget, venue + quality state,
 * authority states, lineage, applied action keys, the current plan, the FULL
 * audit chain, the observations, the state-transition history and the
 * cooldown bookkeeping. Recovery from a verified checkpoint replays exactly
 * the same subsequent decisions as an uninterrupted run — no action is ever
 * applied twice (resume starts at checkpoint.cycleNumber + 1).
 */
export function recordCheckpoint(input: {
  cycle: ExecutionControlCycle;
  plan: ExecutionPlan;
  budget: ControlBudgetState;
  lineage: LineageView;
  observations: readonly CycleObservation[];
  stateHistory: readonly ControlStateTransition[];
  lastAction: ControlAction | null;
  cyclesSinceLastAction: number;
  qualityBand: QualityBand;
  venueHealth: readonly VenueHealthState[];
  riskState: AuthorityValidation;
  aegisState: AuthorityValidation;
  appliedActionKeys: readonly string[];
  auditEvents: readonly ControlAuditEvent[];
  completedCycles: readonly ExecutionControlCycle[];
  nextSequence: number;
  priorCheckpoints: readonly ControlCheckpoint[];
}): ControlCheckpoint {
  const body = {
    checkpointId: controlCheckpointId({
      planId: input.plan.executionPlanId,
      cycle: input.cycle.cycleNumber,
      budget: input.budget,
      planFingerprint: input.plan.fingerprint,
      auditHead: input.auditEvents.length > 0 ? input.auditEvents[input.auditEvents.length - 1].hash : 'genesis',
    }),
    executionPlanId: input.plan.executionPlanId,
    cycleNumber: input.cycle.cycleNumber,
    controlState: input.cycle.state,
    remainingQuantity: input.cycle.telemetry.remainingQuantity,
    actionBudget: input.budget,
    venueState: Object.freeze([...input.venueHealth]),
    qualityState: Object.freeze({
      score: input.cycle.quality.score,
      grade: input.cycle.quality.grade,
      band: input.qualityBand,
    }),
    riskState: input.riskState,
    aegisState: input.aegisState,
    lineage: Object.freeze(input.lineage.versions),
    lineagePlans: Object.freeze(input.lineage.plans),
    appliedActionKeys: Object.freeze([...input.appliedActionKeys]),
    currentPlan: input.plan,
    auditEvents: Object.freeze([...input.auditEvents]),
    observations: Object.freeze([...input.observations]),
    stateHistory: Object.freeze([...input.stateHistory]),
    lastAction: input.lastAction,
    cyclesSinceLastAction: input.cyclesSinceLastAction,
    completedCycles: Object.freeze([...input.completedCycles]),
    nextSequence: input.nextSequence,
    priorCheckpoints: Object.freeze([...input.priorCheckpoints]),
  };
  return Object.freeze({
    ...body,
    fingerprint: controlCheckpointFingerprintOf(body),
  });
}

/** Verify a checkpoint (integrity gate for recovery). */
export function verifyCheckpoint(checkpoint: ControlCheckpoint): boolean {
  return verifyControlCheckpoint(checkpoint);
}

/** The latest verified checkpoint from a list (recovery start point). */
export function latestVerifiedCheckpoint(
  checkpoints: readonly ControlCheckpoint[],
): ControlCheckpoint | null {
  for (let i = checkpoints.length - 1; i >= 0; i--) {
    if (verifyCheckpoint(checkpoints[i])) return checkpoints[i];
  }
  return null;
}
