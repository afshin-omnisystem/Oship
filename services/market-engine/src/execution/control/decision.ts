import {
  ControlVerdict, ControlAction, ControlPrecedence, CONTROL_PRECEDENCE_RANK,
  ExecutionControlDecision, MultiCycleFeedback, CycleObservation, ExecutionTrend,
  OscillationDetection, QualityBand, ControlAbortReason,
  ExecutionTelemetry, ExecutionQualityAssessment, ExecutionSignal, VenueHealthState,
  VenueCandidate, DecisionEvidence, AdaptiveAction,
} from './types';
import {ExecutionControlConfigSpec} from './types';
import {evaluatePolicies, selectPolicy, PolicyEvaluationInput} from '../intelligence/policies';
import {ThresholdEvaluation} from '../intelligence/thresholds';
import {controlDecisionId, controlDecisionFingerprintOf, controlInputFingerprint, controlConfigurationFingerprint} from './ids';

/**
 * Sprint 033 — the control decision.
 *
 * Deterministic precedence (lower rank wins, ties broken by source order then
 * reason string — never by wall-clock or randomness):
 *
 *   EMERGENCY_STOP > HARD_RISK_VIOLATION > AEGIS_REJECTION > ABORT > REPLAN
 *   > REROUTE > REPRICE/RESLICE > WAIT > CONTINUE > COMPLETE
 *
 * Safety can never be overridden by optimization; COMPLETE only wins when
 * nothing else applies. Every verdict carries explicit reason + evidence.
 */

function ev(kind: DecisionEvidence['kind'], detail: string): DecisionEvidence {
  return Object.freeze({kind, detail});
}

// ---------------------------------------------------------------------------
// Multi-cycle feedback analysis
// ---------------------------------------------------------------------------

/** Snapshot of the CURRENT (not yet decided) cycle for feedback analysis. */
export interface CurrentCycleSnapshot {
  readonly qualityScore: number;
  readonly fillRatio: number;
  readonly slippageBps: number;
  readonly latencyMs: number;
}

/**
 * Compare current vs previous vs baseline and detect trend, oscillation,
 * repeated behaviour, diminishing improvement and recovery. Oscillation and
 * repetition are analysed over APPLIED history only — the current cycle has
 * not decided an action yet, so detection guards the decision about to be
 * made (e.g. the 4th consecutive reprice is prevented, not post-hoc).
 */
export function analyzeMultiCycleFeedback(
  history: readonly CycleObservation[],
  current: CurrentCycleSnapshot,
  config: ExecutionControlConfigSpec,
): MultiCycleFeedback {
  const baselineScore = history.length > 0 ? history[0].qualityScore : current.qualityScore;
  const previous = history.length > 0 ? history[history.length - 1] : null;

  // ------------------------------------------------------------ trend
  let trend: ExecutionTrend = 'STABLE';
  let trendDelta = 0;
  if (previous) {
    trendDelta = Math.round((current.qualityScore - previous.qualityScore) * 1e6) / 1e6;
    if (trendDelta > 0.05) trend = 'IMPROVING';
    else if (trendDelta < -0.05) trend = 'DEGRADING';
  }

  const vsBaseline: MultiCycleFeedback['vsBaseline'] =
    current.qualityScore > baselineScore + 1e-9 ? 'ABOVE'
      : current.qualityScore < baselineScore - 1e-9 ? 'BELOW' : 'AT';

  // ------------------------------------------------------- oscillation
  const oscillation = detectOscillation(history, config);

  // -------------------------------------------------- repeated behaviour
  const window = history.slice(-config.oscillation.detectionWindow);
  const lastActions = window.map((o) => o.action);
  const consecutiveSameAction = (() => {
    if (lastActions.length === 0) return 0;
    let n = 1;
    for (let i = lastActions.length - 1; i > 0; i--) {
      if (lastActions[i] === lastActions[i - 1]) n += 1;
      else break;
    }
    return n;
  })();
  const reroutes = window.filter((o) => o.action === 'REROUTE');
  const reprices = window.filter((o) => o.action === 'REPRICE');
  const repeatedFailure = window.filter((o) => o.failed).length >= config.oscillation.maxConsecutiveSameAction;
  const repeatedReroutes = consecutiveSameAction >= config.oscillation.maxConsecutiveReroutes && lastActions[lastActions.length - 1] === 'REROUTE';
  const repeatedReprices = consecutiveSameAction >= config.oscillation.maxConsecutiveSameAction && lastActions[lastActions.length - 1] === 'REPRICE';

  // ------------------------------------------- diminishing improvement
  let diminishingImprovement = false;
  if (previous && history.length >= 2) {
    const before = history[history.length - 2];
    const prevDelta = previous.qualityScore - before.qualityScore;
    const currDelta = current.qualityScore - previous.qualityScore;
    if (prevDelta > 0.05 && currDelta > 0 && currDelta < prevDelta * 0.5) {
      diminishingImprovement = true;
    }
  }

  // ------------------------------------------------------- recovery
  const recovery = (() => {
    if (!previous) return false;
    const wasDegraded = previous.qualityScore < config.hysteresis.qualityDegradeThreshold;
    return wasDegraded && current.qualityScore >= config.hysteresis.qualityRecoverThreshold;
  })();


  void reroutes;
  void reprices;

  return Object.freeze({
    trend,
    trendDelta,
    vsBaseline,
    baselineScore,
    oscillation,
    repeatedFailure,
    repeatedReroutes,
    repeatedReprices,
    diminishingImprovement,
    recovery,
  });
}

/**
 * Deterministic oscillation detection.
 *
 * - VENUE_FLIP_FLOP: reroute targets alternate A → B → A within the window.
 * - REPEATED_ACTION: the same adaptive action repeats ≥ maxConsecutiveSameAction
 *   consecutive cycles (e.g. REPRICE → REPRICE → REPRICE).
 * - ACTION_PING_PONG: two actions alternate A → B → A → B within the window.
 */
export function detectOscillation(
  observations: readonly CycleObservation[],
  config: ExecutionControlConfigSpec,
): OscillationDetection {
  const window = observations.slice(-config.oscillation.detectionWindow);
  const w = config.oscillation.detectionWindow;

  // VENUE_FLIP_FLOP over the reroute chain.
  const rerouteChain = window
    .filter((o) => o.action === 'REROUTE' && o.rerouteTo !== null)
    .map((o) => o.rerouteTo as string);
  if (rerouteChain.length >= 3) {
    const last3 = rerouteChain.slice(-3);
    if (last3[0] === last3[2] && last3[0] !== last3[1]) {
      return Object.freeze({
        detected: true,
        kind: 'VENUE_FLIP_FLOP',
        pattern: Object.freeze(last3),
        window: w,
        detail: `reroute targets oscillate ${last3.join(' → ')}`,
      });
    }
  }

  // REPEATED_ACTION: N consecutive identical actions.
  const actions = window.map((o) => o.action);
  if (actions.length >= config.oscillation.maxConsecutiveSameAction) {
    const n = config.oscillation.maxConsecutiveSameAction;
    const tail = actions.slice(-n);
    if (tail.every((a) => a === tail[0]) && tail[0] !== 'CONTINUE' && tail[0] !== 'WAIT') {
      return Object.freeze({
        detected: true,
        kind: 'REPEATED_ACTION',
        pattern: Object.freeze(tail),
        window: w,
        detail: `action ${tail[0]} repeated ${n} consecutive cycles`,
      });
    }
  }

  // ACTION_PING_PONG: strict alternation of two non-passive actions.
  if (actions.length >= 4) {
    const tail = actions.slice(-4);
    const [a, b, c, d] = tail;
    const passive = (x: ControlAction) => x === 'CONTINUE' || x === 'WAIT';
    if (!passive(a) && a === c && b === d && a !== b) {
      return Object.freeze({
        detected: true,
        kind: 'ACTION_PING_PONG',
        pattern: Object.freeze(tail),
        window: w,
        detail: `actions alternate ${a} → ${b} → ${a} → ${d}`,
      });
    }
  }

  return Object.freeze({
    detected: false,
    kind: null,
    pattern: Object.freeze([]),
    window: w,
    detail: 'no oscillation detected',
  });
}

// ---------------------------------------------------------------------------
// Control decision
// ---------------------------------------------------------------------------

export interface ControlDecisionInput {
  readonly cycleNumber: number;
  readonly timestamp: number;
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly qualityBand: QualityBand;
  readonly signals: readonly ExecutionSignal[];
  readonly venueHealth: readonly VenueHealthState[];
  readonly candidates: readonly VenueCandidate[];
  readonly priceDriftBps: number;
  readonly emergencyStop: boolean;
  readonly deadlineInMs: number;
  readonly feedback: MultiCycleFeedback;
  readonly riskValidation: {status: 'APPROVED' | 'REJECTED' | 'PENDING'; reason: string};
  readonly aegisValidation: {status: 'APPROVED' | 'REJECTED' | 'PENDING'; reason: string};
  readonly hardLimitViolations: readonly {abortReason: ControlAbortReason; detail: string}[];
  readonly completion: {complete: boolean; partial: boolean; unmet: readonly string[]};
  readonly allVenuesStale: boolean;
  readonly plan: {executionPlanId: string; fingerprint: string};
  readonly currentVenueId: string;
  readonly bestAlternativeVenueId: string | null;
  readonly bestAlternativeScore: number;
  readonly currentVenueScore: number;
  readonly config: ExecutionControlConfigSpec;
}

function policyInputOf(
  input: ControlDecisionInput,
  thresholdEvaluations: readonly ThresholdEvaluation[],
): PolicyEvaluationInput {
  return {
    telemetry: input.telemetry,
    quality: input.quality,
    signals: input.signals,
    thresholds: input.config.adaptive.thresholds,
    thresholdEvaluations,
    venueHealth: input.venueHealth,
    candidates: input.candidates,
    bestAlternativeVenueId: input.bestAlternativeVenueId,
    bestAlternativeScore: input.bestAlternativeScore,
    currentVenueScore: input.currentVenueScore,
    priceDriftBps: input.priceDriftBps,
    emergencyStop: input.emergencyStop,
    deadlineInMs: input.deadlineInMs,
    remainingQuantity: input.telemetry.remainingQuantity,
  };
}

/**
 * Evaluate the deterministic control decision: collect every candidate
 * verdict, then pick the lowest precedence rank (ties broken by insertion
 * order, which is fixed).
 */
export interface DecideControlInput extends ControlDecisionInput {
  readonly thresholdEvaluations: readonly ThresholdEvaluation[];
  readonly previousAction: ControlAction | null;
  readonly cyclesSinceLastAction: number;
}

export function decideControl(input: DecideControlInput): ExecutionControlDecision {
  const verdicts: ControlVerdict[] = [];
  const cfg = input.config;

  // 1. EMERGENCY_STOP — dominates every autonomous action.
  if (input.emergencyStop) {
    verdicts.push({
      precedence: 'EMERGENCY_STOP',
      action: 'ABORT',
      reason: 'EMERGENCY_STOP',
      detail: 'emergency stop is active — every autonomous action is dominated by ABORT',
      evidence: Object.freeze([ev('EMERGENCY_STOP', 'emergency stop flag observed at decision time')]),
      abortReason: 'EMERGENCY_STOP',
    });
  }

  // 2. HARD_RISK_VIOLATION — hard limits and Risk-authority rejection.
  for (const v of input.hardLimitViolations) {
    verdicts.push({
      precedence: 'HARD_RISK_VIOLATION',
      action: 'ABORT',
      reason: v.abortReason,
      detail: v.detail,
      evidence: Object.freeze([ev('LIMIT', v.detail)]),
      abortReason: v.abortReason,
    });
  }
  if (input.riskValidation.status !== 'APPROVED') {
    verdicts.push({
      precedence: 'HARD_RISK_VIOLATION',
      action: 'ABORT',
      reason: 'RISK_LIMIT',
      detail: input.riskValidation.status === 'PENDING'
        ? `Risk authority validation PENDING — treated as rejected (fail closed): ${input.riskValidation.reason}`
        : `Risk authority rejected execution: ${input.riskValidation.reason}`,
      evidence: Object.freeze([ev('RISK', input.riskValidation.reason)]),
      abortReason: 'RISK_LIMIT',
    });
  }

  // 3. AEGIS_REJECTION.
  if (input.aegisValidation.status !== 'APPROVED') {
    verdicts.push({
      precedence: 'AEGIS_REJECTION',
      action: 'ABORT',
      reason: 'AEGIS_REJECTED',
      detail: input.aegisValidation.status === 'PENDING'
        ? `AEGIS validation PENDING — treated as rejected (fail closed): ${input.aegisValidation.reason}`
        : `AEGIS rejected execution: ${input.aegisValidation.reason}`,
      evidence: Object.freeze([ev('AEGIS', input.aegisValidation.reason)]),
      abortReason: 'AEGIS_REJECTED',
    });
  }

  // Optimization + protection verdicts only apply with work outstanding:
  // once the target is filled there is nothing to reroute, reprice, reslice,
  // replan or protect — COMPLETE is the honest terminal.
  const workOutstanding = input.telemetry.remainingQuantity > 1e-9;

  // 4. Oscillation protection (policy-configured: ABORT or REPLAN).
  if (input.feedback.oscillation.detected && workOutstanding) {
    const osc = input.feedback.oscillation;
    if (cfg.oscillation.onDetection === 'ABORT') {
      verdicts.push({
        precedence: 'ABORT',
        action: 'ABORT',
        reason: 'OSCILLATION_DETECTED',
        detail: `oscillation detected: ${osc.detail}`,
        evidence: Object.freeze([ev('OSCILLATION', `${osc.kind}: ${osc.detail}`)]),
        abortReason: 'OSCILLATION_DETECTED',
      });
    } else {
      verdicts.push({
        precedence: 'REPLAN',
        action: 'REPLAN',
        reason: 'OSCILLATION_DETECTED',
        detail: `oscillation detected: ${osc.detail} — replanning instead of oscillating`,
        evidence: Object.freeze([ev('OSCILLATION', `${osc.kind}: ${osc.detail}`)]),
      });
    }
  }

  // 5. Adaptive policies (Sprint 032) mapped onto control actions.
  const policyVerdicts = evaluatePolicies(policyInputOf(input, input.thresholdEvaluations));
  const chosen = selectPolicy(policyVerdicts);
  const adaptiveAction: AdaptiveAction = workOutstanding ? chosen.action : 'KEEP';
  if (adaptiveAction === 'ABORT') {
    const abortReason = mapAdaptiveAbortReason(chosen.reasons, input);
    verdicts.push({
      precedence: 'ABORT',
      action: 'ABORT',
      reason: abortReason,
      detail: chosen.reasons.join('; '),
      evidence: chosen.evidence,
      abortReason,
      adaptiveAction,
    });
  } else if (adaptiveAction === 'REPLAN') {
    verdicts.push({
      precedence: 'REPLAN',
      action: 'REPLAN',
      reason: 'ADAPTIVE_REPLAN',
      detail: chosen.reasons.join('; '),
      evidence: chosen.evidence,
      adaptiveAction,
    });
  } else if (adaptiveAction === 'REROUTE') {
    verdicts.push({
      precedence: 'REROUTE',
      action: 'REROUTE',
      reason: 'ADAPTIVE_REROUTE',
      detail: chosen.reasons.join('; '),
      evidence: chosen.evidence,
      adaptiveAction,
    });
  } else if (adaptiveAction === 'RESLICE') {
    verdicts.push({
      precedence: 'RESLICE',
      action: 'RESLICE',
      reason: 'ADAPTIVE_RESLICE',
      detail: chosen.reasons.join('; '),
      evidence: chosen.evidence,
      adaptiveAction,
    });
  } else if (adaptiveAction === 'REPRICE') {
    verdicts.push({
      precedence: 'REPRICE',
      action: 'REPRICE',
      reason: 'ADAPTIVE_REPRICE',
      detail: chosen.reasons.join('; '),
      evidence: chosen.evidence,
      adaptiveAction,
    });
  }
  // KEEP maps to CONTINUE / WAIT / COMPLETE below.

  // 6. Stale market (all venues stale and work remains) → ABORT(STALE_MARKET).
  if (input.allVenuesStale && input.telemetry.remainingQuantity > 0 && cfg.abortOnAllVenuesStale) {
    verdicts.push({
      precedence: 'ABORT',
      action: 'ABORT',
      reason: 'STALE_MARKET',
      detail: 'all venue market data is stale with quantity outstanding',
      evidence: Object.freeze([ev('MARKET', 'every venue reports stale market data')]),
      abortReason: 'STALE_MARKET',
    });
  }

  // 7. WAIT — deliberate deferral (never defers a safety verdict).
  const deferral = waitDeferral(input);
  if (deferral) {
    verdicts.push({
      precedence: 'WAIT',
      action: 'WAIT',
      reason: deferral.reason,
      detail: deferral.detail,
      evidence: Object.freeze([ev('HYSTERESIS', deferral.detail)]),
      adaptiveAction,
    });
  }

  // 8. CONTINUE — healthy plan, work remains.
  if (input.telemetry.remainingQuantity > 0 && !deferral && adaptiveAction === 'KEEP') {
    verdicts.push({
      precedence: 'CONTINUE',
      action: 'CONTINUE',
      reason: 'PLAN_HEALTHY',
      detail: 'execution is progressing within thresholds — continue the current plan',
      evidence: Object.freeze([ev('PROGRESS', `fillRatio ${input.telemetry.fillRatio.toFixed(4)}, remaining ${input.telemetry.remainingQuantity}`)]),
      adaptiveAction,
    });
  }

  // 9. COMPLETE — only when the completion engine's conditions all hold.
  if (input.completion.complete) {
    verdicts.push({
      precedence: 'COMPLETE',
      action: 'COMPLETE',
      reason: 'COMPLETION_CONDITIONS_MET',
      detail: 'target filled, atomic legs satisfied, risk + AEGIS valid, reconciliation valid, no unresolved mandatory actions',
      evidence: Object.freeze([ev('COMPLETION', `filled ${input.telemetry.filledQuantity}, remaining ${input.telemetry.remainingQuantity}`)]),
      adaptiveAction,
    });
  }

  // ------------------------------------------- fail-closed no-verdict guard
  if (verdicts.length === 0) {
    verdicts.push({
      precedence: 'ABORT',
      action: 'ABORT',
      reason: 'INVARIANT_FAILURE',
      detail: 'no applicable control verdict (work remaining without completion conditions and no adaptive action) — failing closed',
      evidence: Object.freeze([ev('INVARIANT', `remaining ${input.telemetry.remainingQuantity}, completion unmet: ${input.completion.unmet.join(', ') || 'none'}`)]),
      abortReason: 'INVARIANT_FAILURE',
    });
  }

  // ------------------------------------------- deterministic selection
  const winner = verdicts.reduce((best, v, i) => {
    if (i === 0) return v;
    const rankDiff = CONTROL_PRECEDENCE_RANK[v.precedence] - CONTROL_PRECEDENCE_RANK[best.precedence];
    if (rankDiff < 0) return v;
    if (rankDiff === 0 && v.reason < best.reason) return v; // stable tie-break
    return best;
  });

  const waitReason = winner.action === 'WAIT' ? winner.reason : null;
  const body = {
    decisionId: controlDecisionId({
      planId: input.plan.executionPlanId,
      cycle: input.cycleNumber,
      action: winner.action,
      reason: winner.reason,
      timestamp: input.timestamp,
    }),
    cycleNumber: input.cycleNumber,
    action: winner.action,
    precedence: winner.precedence,
    rank: CONTROL_PRECEDENCE_RANK[winner.precedence],
    reason: winner.reason,
    detail: winner.detail,
    evidence: winner.evidence,
    abortReason: winner.abortReason ?? null,
    waitReason,
    adaptiveAction: winner.adaptiveAction ?? null,
    considered: Object.freeze(verdicts),
    configurationFingerprint: controlConfigurationFingerprint(cfg),
    inputFingerprint: controlInputFingerprint({
      planFingerprint: input.plan.fingerprint,
      cycle: input.cycleNumber,
      telemetryFingerprint: input.telemetry.fingerprint,
      qualityFingerprint: input.quality.fingerprint,
      signalTypes: input.signals.map((s) => s.type),
      emergencyStop: input.emergencyStop,
      riskStatus: input.riskValidation.status,
      aegisStatus: input.aegisValidation.status,
      feedback: input.feedback,
    }),
  };

  return Object.freeze({
    ...body,
    decisionFingerprint: controlDecisionFingerprintOf(body),
  });
}

/** Map a Sprint 032 adaptive-abort rationale onto a canonical abort reason. */
function mapAdaptiveAbortReason(reasons: readonly string[], input: ControlDecisionInput): ControlAbortReason {
  const joined = reasons.join('; ');
  if (joined.includes('emergency stop')) return 'EMERGENCY_STOP';
  if (joined.includes('venue failed and no alternative')) return 'VENUE_UNAVAILABLE';
  if (joined.includes('atomic group') && joined.includes('no recoverable alternative')) return 'UNRECOVERABLE_PLAN';
  if (joined.includes('fill ratio') && joined.includes('abort floor')) return 'UNRECOVERABLE_PLAN';
  if (joined.includes('rejection ratio')) return 'VENUE_UNAVAILABLE';
  if (joined.includes('collapsed below half the replan floor')) return 'UNRECOVERABLE_PLAN';
  void input;
  return 'UNRECOVERABLE_PLAN';
}

/**
 * Deliberate deferral (WAIT): an optimization action is applicable, but a
 * deterministic wait policy says observing one more cycle is better than
 * acting now. Never defers safety verdicts (those live at higher precedence).
 */
export function waitDeferral(input: DecideControlInput): {reason: string; detail: string} | null {
  const cfg = input.config;

  // Cooldown: an identical optimization action repeated inside the cooldown
  // window is deferred (deterministic anti-churn hysteresis).
  if (input.config.hysteresis.sameActionCooldownCycles > 0
      && input.previousAction !== null
      && (input.previousAction === 'REROUTE' || input.previousAction === 'REPRICE' || input.previousAction === 'RESLICE')
      && input.cyclesSinceLastAction <= input.config.hysteresis.sameActionCooldownCycles) {
    return {
      reason: 'SAME_ACTION_COOLDOWN',
      detail: `previous action ${input.previousAction} applied ${input.cyclesSinceLastAction} cycle(s) ago — cooldown is ${input.config.hysteresis.sameActionCooldownCycles} cycle(s)`,
    };
  }

  // Hysteresis: a weak venue that is RECOVERING gets the chance to heal.
  if (cfg.hysteresis.waitOnVenueRecovery) {
    const recovering = input.venueHealth.find(
      (v) => v.venueId === input.currentVenueId && v.state === 'RECOVERING',
    );
    if (recovering && input.telemetry.remainingQuantity > 0) {
      return {
        reason: 'VENUE_RECOVERING',
        detail: `venue ${input.currentVenueId} is RECOVERING (score ${recovering.score.toFixed(3)}) — hysteresis holds action for one cycle`,
      };
    }
  }

  // Improving execution with no critical signal: allow the trend to complete.
  if (cfg.wait.waitOnImprovingTrend && input.feedback.trend === 'IMPROVING'
      && input.qualityBand !== 'DEGRADED'
      && !input.signals.some((s) => s.severity === 'CRITICAL')
      && input.telemetry.remainingQuantity > 0
      && input.feedback.diminishingImprovement === false) {
    return {
      reason: 'EXECUTION_IMPROVING',
      detail: `quality improving (+${input.feedback.trendDelta.toFixed(4)} vs previous cycle) with no critical signals — observe before acting`,
    };
  }

  return null;
}
