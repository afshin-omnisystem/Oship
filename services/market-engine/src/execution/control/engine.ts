import {
  ExecutionControlRunInput, ExecutionControlSession, ExecutionControlCycle,
  ExecutionControlConfigSpec, ControlCycleSpec,
  ControlBudgetState, CycleObservation, ControlAction, QualityBand,
  ControlCheckpoint, ControlSessionResult, ControlFinalState,
  ControlAbortReason, ControlAuthorityBridge,
} from './types';
import {mergeControlConfig, validateExecutionControlConfig, executionControlConfigurationFingerprint, ControlConfigInput} from './config';
import {ExecutionControlController} from './controller';
import {initialControlState, ControlStateTracker as Tracker, transitionControlState} from './state';
import {initialLineage, LineageView} from './lineage';
import {ControlAuditLog} from './audit';
import {defaultAuthorityBridge} from './authority-bridge';
import {recordCheckpoint} from './checkpoint';
import {applySessionTransition} from './transition';
import {scheduleNextCycle, advanceCycleBudget} from './scheduler';
import {completeSession, abortSession, exhaustSession} from './abort';
import {initialControlBudget} from './budget';
import {verifyControlCheckpoint} from './ids';
import {checkControlInvariants} from './invariants';
import {controlSessionId, controlSessionFingerprintOf} from './ids';
import {ExecutionSimulationEngine} from '../../simulation/execution/engine';
import {ExecutionPlan} from '../intelligence/types';

/**
 * Sprint 033 — the unified autonomous execution control engine.
 *
 * One engine for BOTH domains (AFIS + ABL): the control plane is
 * domain-agnostic — ABL BACK/LAY legs keep their semantic side through the
 * existing execution simulation, and the control machine, budgets, limits,
 * decisions, checkpoints and replay are shared.
 *
 * Determinism contract: identical (plan, cycles, configuration, startTime,
 * correlationId, traceId) → byte-identical session, audit chain and
 * sessionFingerprint. A run resumed from a verified checkpoint produces the
 * same result as the uninterrupted run.
 */
export class ExecutionControlEngine {
  readonly config: ExecutionControlConfigSpec;

  constructor(config: ControlConfigInput = {}) {
    const merged: ExecutionControlConfigSpec = mergeControlConfig(config);
    const errors = validateExecutionControlConfig(merged);
    if (errors.length > 0) {
      throw new Error(`invalid execution control configuration — fail closed: ${errors.join('; ')}`);
    }
    this.config = Object.freeze(merged);
  }

  run(
    input: ExecutionControlRunInput,
    options: {resumeFrom?: ControlCheckpoint | null} = {},
  ): ExecutionControlSession {
    const config = this.config;
    const sessionId = controlSessionId({
      rootPlanId: input.plan.executionPlanId,
      planFingerprint: input.plan.fingerprint,
      startTime: input.startTime,
      correlationId: input.correlationId,
      traceId: input.traceId,
      configFingerprint: executionControlConfigurationFingerprint(config),
    });

    // ---------------------------------------------------------- resume state
    const resume = options.resumeFrom ?? null;
    if (resume && !verifyResumeCheckpoint(resume, input)) {
      throw new Error('recovery refused: checkpoint fingerprint invalid or checkpoint does not match this run — fail closed');
    }

    const audit = new ControlAuditLog(sessionId, input.correlationId, input.traceId, resume ? {events: resume.auditEvents} : undefined);

    let tracker: Tracker = initialControlState(0, input.startTime);
    let lineage: LineageView = initialLineage(input.plan);
    let budget: ControlBudgetState = initialControlBudget();
    let observations: readonly CycleObservation[] = [];
    let qualityBand: QualityBand | null = null;
    let qualityScore: number | null = null;
    let lastAction: ControlAction | null = null;
    let cyclesSinceLastAction = 0;
    let venueHealth: readonly import('../intelligence/types').VenueHealthState[] = [];
    let appliedActionKeys = new Set<string>();
    let currentPlan: ExecutionPlan = input.plan;
    let startCycle = 0;
    let cycles: ExecutionControlCycle[] = [];
    let sequence = 0;

    if (resume) {
      // Deterministic resume: restore every piece of cross-cycle state,
      // including the completed-cycle journal, so the recovered session is
      // byte-identical to the uninterrupted one. No action is re-applied:
      // the loop continues at checkpoint.cycleNumber + 1 with the restored
      // applied-action keys.
      tracker = restoreTracker(resume, input.startTime);
      lineage = restoreLineage(resume);
      budget = resume.actionBudget;
      observations = resume.observations;
      qualityBand = resume.qualityState.band;
      qualityScore = resume.qualityState.score;
      lastAction = resume.lastAction;
      cyclesSinceLastAction = resume.cyclesSinceLastAction;
      venueHealth = resume.venueState;
      appliedActionKeys = new Set(resume.appliedActionKeys);
      currentPlan = resume.currentPlan;
      startCycle = resume.cycleNumber + 1;
      cycles = [...resume.completedCycles];
      sequence = resume.nextSequence;
      // Re-emit the checkpoint's own CHECKPOINT_RECORDED event so the audit
      // chain continues exactly where the uninterrupted run stood.
      audit.record('CHECKPOINT_RECORDED', currentPlan.executionPlanId, cycleTimestampOf(input, input.cycles[Math.min(resume.cycleNumber, input.cycles.length - 1)]), {
        checkpointId: resume.checkpointId,
        cycle: resume.cycleNumber,
        fingerprint: resume.fingerprint,
        remainingQuantity: resume.remainingQuantity,
      });
    }

    // ------------------------------------------------------------ the bridge
    const bridge: ControlAuthorityBridge = input.bridge ?? defaultAuthorityBridge({
      riskScript: input.cycles.map((c) => ({status: c.riskValidation, reason: `scripted risk validation for cycle ${c.label}`})),
      aegisScript: input.cycles.map((c) => ({status: c.aegisValidation, reason: `scripted aegis validation for cycle ${c.label}`})),
    });

    const controller = new ExecutionControlController(config, bridge, new ExecutionSimulationEngine());
    const checkpoints: ControlCheckpoint[] = resume ? [...resume.priorCheckpoints, resume] : [];

    if (!resume) {
      audit.record('SESSION_STARTED', input.plan.executionPlanId, input.startTime, {
        sessionId,
        rootExecutionPlanId: input.plan.executionPlanId,
        planFingerprint: input.plan.fingerprint,
        configurationFingerprint: executionControlConfigurationFingerprint(config),
        cyclesProvided: input.cycles.length,
        budgets: config.budgets,
        limits: config.limits,
      });
    }

    let terminal: ControlFinalState | null = null;
    let abortReason: ControlAbortReason | null = null;
    let exhaustReason: string | null = null;

    // A checkpoint taken on a terminal cycle resumes directly to the final
    // resolution — no further cycle may ever run (fail closed).
    if (resume && (resume.controlState === 'COMPLETED' || resume.controlState === 'ABORTED')) {
      terminal = resume.controlState;
      if (resume.controlState === 'ABORTED') {
        const lastCycle = cycles[cycles.length - 1] ?? null;
        abortReason = lastCycle?.decision.abortReason ?? 'UNRECOVERABLE_PLAN';
      }
    }

    const loopEnabled = terminal === null;

    for (let i = startCycle; loopEnabled && i < input.cycles.length; i++) {
      const spec: ControlCycleSpec = input.cycles[i];
      const cycleTimestamp = cycleTimestampOf(input, spec);

      // ------------------------------------------------- budget gate (pre-cycle)
      // Checked while still in WAITING_FEEDBACK so an exhaustion takes the
      // legal WAITING_FEEDBACK → EXHAUSTED transition.
      const scheduling = scheduleNextCycle({
        budget,
        spec: config.budgets,
        remainingQuantity: lastRemaining(cycles, currentPlan),
        cyclesProvided: input.cycles.length,
        nextCycleNumber: i,
      });
      if (!scheduling.allowed) {
        if (scheduling.exhaustReason !== null) {
          tracker = transitionControlState(tracker, 'EXHAUSTED', scheduling.exhaustReason, i, cycleTimestamp);
          audit.record('STATE_CHANGED', currentPlan.executionPlanId, cycleTimestamp, {
            from: 'WAITING_FEEDBACK', to: 'EXHAUSTED', reason: scheduling.exhaustReason, cycle: i,
          });
          terminal = 'EXHAUSTED';
          exhaustReason = scheduling.exhaustReason;
        }
        break;
      }

      // ------------------------------- WAITING_FEEDBACK → REASSESSING (loop)
      if (tracker.state === 'WAITING_FEEDBACK') {
        tracker = transitionControlState(tracker, 'REASSESSING', 'feedback received — reassess before the next cycle', i, cycleTimestamp);
        audit.record('STATE_CHANGED', currentPlan.executionPlanId, cycleTimestamp, {
          from: 'WAITING_FEEDBACK', to: 'REASSESSING', reason: 'feedback received — reassess before the next cycle', cycle: i,
        });
      }
      const result = controller.runCycle({
        plan: currentPlan,
        spec,
        cycleNumber: i,
        timestamp: cycleTimestamp,
        tracker,
        budget,
        lineage,
        observations,
        previousVenueHealth: venueHealth,
        previousQualityScore: qualityScore,
        previousQualityBand: qualityBand,
        previousAction: lastAction,
        cyclesSinceLastAction,
        appliedActionKeys,
        audit,
        correlationId: input.correlationId,
        traceId: input.traceId,
        sequence,
      });
      sequence += 3;

      cycles.push(result.cycle);
      tracker = result.tracker;
      budget = advanceCycleBudget(result.budget, spec.elapsedMs ?? 0);
      lineage = result.lineage;
      observations = result.observations;
      qualityBand = result.qualityBand;
      qualityScore = result.qualityScore;
      venueHealth = result.venueHealth;
      appliedActionKeys = new Set(result.appliedActionKeys);
      if (result.revisedPlan) currentPlan = result.revisedPlan;

      // Cooldown bookkeeping from the controller result.
      lastAction = result.lastAction;
      cyclesSinceLastAction = result.cyclesSinceLastAction;

      // Checkpoint after every completed cycle (deterministic content).
      const checkpoint = recordCheckpoint({
        cycle: result.cycle,
        plan: currentPlan,
        budget,
        lineage,
        observations,
        stateHistory: tracker.history,
        lastAction,
        cyclesSinceLastAction,
        qualityBand: result.qualityBand,
        venueHealth: result.venueHealth,
        riskState: result.cycle.result.riskValidation,
        aegisState: result.cycle.result.aegisValidation,
        appliedActionKeys: [...appliedActionKeys],
        auditEvents: audit.events,
        completedCycles: cycles,
        nextSequence: sequence,
        priorCheckpoints: checkpoints,
      });
      checkpoints.push(checkpoint);
      audit.record('CHECKPOINT_RECORDED', currentPlan.executionPlanId, cycleTimestamp, {
        checkpointId: checkpoint.checkpointId,
        cycle: result.cycle.cycleNumber,
        fingerprint: checkpoint.fingerprint,
        remainingQuantity: checkpoint.remainingQuantity,
      });

      // ------------------------------------------------------ terminal states
      if (result.terminal === 'COMPLETED') {
        terminal = 'COMPLETED';
        break;
      }
      if (result.terminal === 'ABORTED') {
        terminal = 'ABORTED';
        abortReason = result.abortReason ?? 'UNRECOVERABLE_PLAN';
        break;
      }

      // ------------------------------------------- invariants (fail closed)
      const invariantCheck = checkControlInvariants({
        initialPlan: input.plan,
        session: buildSessionSkeleton(sessionId, input, cycles, tracker, budget, lineage, checkpoints, audit, config),
        budgets: config.budgets,
        oscillationCeiling: config.oscillation.maxConsecutiveSameAction,
      });
      if (!invariantCheck.ok) {
        // The cycle already ended in WAITING_FEEDBACK; an invariant violation
        // fails closed: WAITING_FEEDBACK has no ABORTED edge, so the machine
        // records the violation and the session terminates ABORTED.
        audit.record('SESSION_ABORTED', currentPlan.executionPlanId, cycleTimestamp, {
          sessionId,
          reason: 'INVARIANT_FAILURE',
          violations: invariantCheck.violations,
        });
        terminal = 'ABORTED';
        abortReason = 'INVARIANT_FAILURE';
        break;
      }

    }

    // ------------------------------------------------------- final resolution
    let finalResult: ControlSessionResult | null = null;
    if (terminal === 'COMPLETED') {
      const outcome = completeSession({cycles});
      finalResult = outcome.result;
      audit.record('SESSION_COMPLETED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
        sessionId, cyclesExecuted: cycles.length, filledQuantity: outcome.result.filledQuantity,
      });
    } else if (terminal === 'ABORTED') {
      const outcome = abortSession({reason: abortReason ?? 'UNRECOVERABLE_PLAN', detail: 'terminal abort decision', cycles, abortCycle: cycles[cycles.length - 1] ?? null});
      finalResult = outcome.result;
      if (abortReason !== 'INVARIANT_FAILURE') {
        audit.record('SESSION_ABORTED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
          sessionId, reason: abortReason, cyclesExecuted: cycles.length, detail: outcome.result.detail,
        });
      }
    } else if (terminal === 'EXHAUSTED') {
      const outcome = exhaustSession({reason: exhaustReason ?? 'budgets exhausted', cycles});
      finalResult = outcome.result;
      audit.record('SESSION_EXHAUSTED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
        sessionId, reason: exhaustReason ?? 'budgets exhausted', cyclesExecuted: cycles.length,
      });
    } else {
      // Input ended without a terminal decision.
      const remaining = lastRemaining(cycles, currentPlan);
      if (remaining <= 1e-9 && cycles.length > 0) {
        const outcome = completeSession({cycles});
        finalResult = outcome.result;
        audit.record('SESSION_COMPLETED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
          sessionId, cyclesExecuted: cycles.length, filledQuantity: outcome.result.filledQuantity,
        });
      } else {
        const last = cycles[cycles.length - 1] ?? null;
        const atomicSplit = last !== null
          && last.telemetry.atomicRequired === true
          && last.telemetry.filledQuantity > 1e-9
          && last.telemetry.remainingQuantity > 1e-9;
        if (atomicSplit) {
          // Fail closed: an atomic plan may never end partially executed on a
          // non-aborted session — convert the exhaustion into an abort that
          // preserves the remaining quantity and the full history.
          const outcome = abortSession({
            reason: 'UNRECOVERABLE_PLAN',
            detail: `atomic plan partially filled (${last.telemetry.filledQuantity}/${last.telemetry.plannedQuantity}) with no further market cycles — all-or-nothing semantics fail closed`,
            cycles,
            abortCycle: last,
          });
          finalResult = outcome.result;
          audit.record('SESSION_ABORTED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
            sessionId, reason: 'UNRECOVERABLE_PLAN', cyclesExecuted: cycles.length,
            detail: outcome.result.detail, atomicSplit: true,
          });
        } else {
          const outcome = exhaustSession({reason: `no further market cycles provided with ${remaining} still to execute`, cycles});
          finalResult = outcome.result;
          // The session ran out of market cycles with work left: WAITING_FEEDBACK
          // → EXHAUSTED is the canonical machine edge for exactly this case.
          tracker = applySessionTransition({
            tracker, to: 'EXHAUSTED', reason: 'no further market cycles with work remaining',
            cycleNumber: cycles.length, timestamp: lastTimestamp(input, cycles),
            planId: currentPlan.executionPlanId, audit,
          });
          audit.record('SESSION_EXHAUSTED', currentPlan.executionPlanId, lastTimestamp(input, cycles), {
            sessionId, reason: outcome.result.detail, cyclesExecuted: cycles.length,
          });
        }
      }
    }

    const sessionBody = {
      sessionId,
      rootExecutionPlanId: input.plan.executionPlanId,
      cycles: Object.freeze(cycles),
      currentState: tracker.state,
      stateHistory: tracker.history,
      actionBudget: budget,
      lineage: lineage.plans,
      finalResult,
      checkpoints: Object.freeze(checkpoints),
      auditEvents: audit.events,
      configurationFingerprint: executionControlConfigurationFingerprint(config),
    };

    return Object.freeze({
      ...sessionBody,
      sessionFingerprint: controlSessionFingerprintOf(sessionBody),
    });
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function cycleTimestampOf(input: ExecutionControlRunInput, spec: ControlCycleSpec): number {
  return input.startTime + (spec.elapsedMs ?? 0);
}

function lastRemaining(cycles: readonly ExecutionControlCycle[], currentPlan: ExecutionPlan): number {
  if (cycles.length === 0) return currentPlan.routes.reduce((s, r) => s + r.quantity, 0);
  return cycles[cycles.length - 1].telemetry.remainingQuantity;
}

function lastTimestamp(input: ExecutionControlRunInput, cycles: readonly ExecutionControlCycle[]): number {
  if (cycles.length === 0) return input.startTime;
  return cycles[cycles.length - 1].completedAt;
}

function verifyResumeCheckpoint(checkpoint: ControlCheckpoint, input: ExecutionControlRunInput): boolean {
  if (!verifyControlCheckpoint(checkpoint)) return false;
  return checkpoint.executionPlanId === input.plan.executionPlanId
    || lineageRootOf(checkpoint) === input.plan.executionPlanId;
}

function lineageRootOf(checkpoint: ControlCheckpoint): string {
  return checkpoint.lineage.length > 0 ? checkpoint.lineage[0].executionPlanId : checkpoint.executionPlanId;
}

function restoreTracker(checkpoint: ControlCheckpoint, startTime: number): Tracker {
  // Rebuild the tracker with the checkpointed state + full history.
  const history = checkpoint.stateHistory;
  return Object.freeze({
    state: checkpoint.controlState,
    history: Object.freeze(history),
  });
}

function restoreLineage(checkpoint: ControlCheckpoint): LineageView {
  // The checkpoint carries the full plan lineage, so recovery reproduces the
  // exact same session lineage as the uninterrupted run.
  return Object.freeze({
    plans: Object.freeze(checkpoint.lineagePlans),
    versions: Object.freeze(checkpoint.lineage),
    chain: checkpoint.lineage.map((v) => v.executionPlanId).join(' → '),
  });
}

function buildSessionSkeleton(
  sessionId: string,
  input: ExecutionControlRunInput,
  cycles: readonly ExecutionControlCycle[],
  tracker: Tracker,
  budget: ControlBudgetState,
  lineage: LineageView,
  checkpoints: readonly ControlCheckpoint[],
  audit: ControlAuditLog,
  config: ExecutionControlConfigSpec,
): ExecutionControlSession {
  return Object.freeze({
    sessionId,
    rootExecutionPlanId: input.plan.executionPlanId,
    cycles: Object.freeze([...cycles]),
    currentState: tracker.state,
    stateHistory: tracker.history,
    actionBudget: budget,
    lineage: lineage.plans,
    finalResult: null,
    checkpoints: Object.freeze([...checkpoints]),
    auditEvents: audit.events,
    configurationFingerprint: executionControlConfigurationFingerprint(config),
    sessionFingerprint: 'pending',
  });
}
