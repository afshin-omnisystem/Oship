import {
  AdaptiveAction,
  DecisionConstraint,
  DecisionEvidence,
  ExecutionSignal,
  ExecutionTelemetry,
  ExecutionQualityAssessment,
  VenueCandidate,
  VenueHealthState,
  SignalSeverity,
} from './types';
import {ThresholdEvaluation, AdaptiveThresholds} from './thresholds';

/**
 * Sprint 032 — Adaptive Policy Engine.
 *
 * Deterministic policies for each adaptive action. Every policy is a pure
 * function of (telemetry, quality, signals, thresholds, venue context); no
 * randomness, no learning, no hidden state. A policy is *applicable* when all
 * of its trigger conditions hold; the decision layer picks the applicable
 * policy with the best (lowest) dominance priority. Emergency stop always
 * forces ABORT regardless of every other policy (dominance rule).
 */

export interface PolicyVerdict {
  readonly action: AdaptiveAction;
  readonly applicable: boolean;
  readonly priority: number;
  readonly score: number;              // 0..1 policy strength (deterministic)
  readonly reasons: readonly string[];
  readonly evidence: readonly DecisionEvidence[];
  readonly constraints: readonly DecisionConstraint[];
}

export interface PolicyEvaluationInput {
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly signals: readonly ExecutionSignal[];
  readonly thresholds: AdaptiveThresholds;
  readonly thresholdEvaluations: readonly ThresholdEvaluation[];
  readonly venueHealth: readonly VenueHealthState[];
  readonly candidates: readonly VenueCandidate[];
  readonly bestAlternativeVenueId: string | null;   // best non-current venue (from reroute ranking)
  readonly bestAlternativeScore: number;
  readonly currentVenueScore: number;
  readonly priceDriftBps: number;
  readonly emergencyStop: boolean;
  readonly deadlineInMs: number;
  readonly remainingQuantity: number;
}

const ALL_ACTIONS: readonly AdaptiveAction[] = ['ABORT', 'REPLAN', 'REROUTE', 'RESLICE', 'REPRICE', 'KEEP'];
const PRIORITY: Readonly<Record<AdaptiveAction, number>> = Object.freeze({
  ABORT: 0, REPLAN: 1, REROUTE: 2, RESLICE: 3, REPRICE: 4, KEEP: 5,
});

function ev(kind: string, detail: string): DecisionEvidence {
  return Object.freeze({kind, detail});
}

function con(name: string, satisfied: boolean, detail: string): DecisionConstraint {
  return Object.freeze({name, satisfied, detail});
}

function hasSig(signals: readonly ExecutionSignal[], type: string): boolean {
  return signals.some((s) => s.type === type);
}

function hasCrit(signals: readonly ExecutionSignal[], type: string): boolean {
  return signals.some((s) => s.type === type && s.severity === 'CRITICAL');
}

/** Evaluate all six policies deterministically. */
export function evaluatePolicies(input: PolicyEvaluationInput): readonly PolicyVerdict[] {
  return Object.freeze(ALL_ACTIONS.map((action) => evaluatePolicy(action, input)));
}

function evaluatePolicy(action: AdaptiveAction, input: PolicyEvaluationInput): PolicyVerdict {
  switch (action) {
    case 'ABORT': return abortPolicy(input);
    case 'REPLAN': return replanPolicy(input);
    case 'REROUTE': return reroutePolicy(input);
    case 'RESLICE': return reslicePolicy(input);
    case 'REPRICE': return repricePolicy(input);
    case 'KEEP': return keepPolicy(input);
  }
}

// ---------------------------------------------------------------------------
// ABORT — execution unsafe or hard constraints violated. Always dominant.
// ---------------------------------------------------------------------------

function abortPolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const reasons: string[] = [];
  const evidence: DecisionEvidence[] = [];
  const t = input.thresholds;
  const tel = input.telemetry;

  if (input.emergencyStop) {
    reasons.push('emergency stop is active — every adaptive action is dominated by ABORT');
    evidence.push(ev('EMERGENCY_STOP', 'emergency stop flag observed at decision time'));
  }
  if (tel.atomicRisk && input.bestAlternativeVenueId === null) {
    reasons.push(`atomic group ${tel.atomicGroupStatus} with all-or-nothing semantics and no recoverable alternative — leg imbalance is unsafe`);
    evidence.push(ev('ATOMIC_RISK', `atomicGroupStatus=${tel.atomicGroupStatus}, remaining=${tel.remainingQuantity}, no alternative venue`));
  }
  if (hasCrit(input.signals, 'VENUE_FAILED') && input.bestAlternativeVenueId === null) {
    reasons.push('a venue failed and no alternative venue can take the remaining quantity');
    evidence.push(ev('NO_ALTERNATIVE_VENUE', 'no eligible routing candidate for remainder'));
  }
  if (tel.submittedQuantity > 0 && tel.fillRatio < t.abortFillRatio && input.remainingQuantity > 0) {
    reasons.push(`fill ratio ${tel.fillRatio.toFixed(4)} below abort floor ${t.abortFillRatio} with ${input.remainingQuantity} still outstanding`);
    evidence.push(ev('FILL_COLLAPSE', `fillRatio=${tel.fillRatio}, remaining=${input.remainingQuantity}`));
  }
  if (tel.rejectionRatio >= 0.5 && input.remainingQuantity > 0) {
    reasons.push(`rejection ratio ${tel.rejectionRatio.toFixed(4)} ≥ 50% — venue is rejecting the plan`);
    evidence.push(ev('REJECTIONS', `rejectionRatio=${tel.rejectionRatio}`));
  }
  if (input.quality.score < t.replanThreshold * 0.5 && input.remainingQuantity > 0) {
    reasons.push(`quality score ${input.quality.score.toFixed(4)} collapsed below half the replan floor — execution unsafe`);
    evidence.push(ev('QUALITY_COLLAPSE', `score=${input.quality.score}, replanFloor=${t.replanThreshold}`));
  }

  const applicable = reasons.length > 0;
  const score = applicable ? Math.min(1, 0.5 + 0.1 * reasons.length) : 0;
  return Object.freeze({
    action: 'ABORT',
    applicable,
    priority: PRIORITY.ABORT,
    score,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze([
      con('EMERGENCY_STOP_DOMINANCE', true, 'ABORT dominates every other adaptive action'),
      con('FAIL_CLOSED', true, 'abort cancels all outstanding quantity; nothing executes further'),
    ]),
  });
}

// ---------------------------------------------------------------------------
// REPLAN — the plan can no longer satisfy its constraints.
// ---------------------------------------------------------------------------

function replanPolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const reasons: string[] = [];
  const evidence: DecisionEvidence[] = [];
  const t = input.thresholds;
  const tel = input.telemetry;

  const qualityBelowReplan = input.quality.score < t.replanThreshold;
  if (qualityBelowReplan) {
    reasons.push(`quality score ${input.quality.score.toFixed(4)} below replan floor ${t.replanThreshold}`);
    evidence.push(ev('QUALITY_BELOW_REPLAN', `score=${input.quality.score}, grade=${input.quality.grade}`));
  }
  const liquidityBreach = input.thresholdEvaluations.find((e) => e.name === 'minLiquidity' && e.breached);
  if (liquidityBreach && input.remainingQuantity > 0) {
    reasons.push(`liquidity ${liquidityBreach.value.toFixed(2)} below floor ${liquidityBreach.limit} — plan sizing no longer executable`);
    evidence.push(ev('LIQUIDITY_INSUFFICIENT', `observed=${liquidityBreach.value}, floor=${liquidityBreach.limit}`));
  }
  if (input.deadlineInMs <= 0 && input.remainingQuantity > 0) {
    reasons.push('plan deadline passed with quantity outstanding — current plan invalid');
    evidence.push(ev('DEADLINE_PASSED', `remaining=${input.remainingQuantity}, deadlineInMs=${input.deadlineInMs}`));
  }
  if (tel.atomicRisk && input.bestAlternativeVenueId !== null) {
    reasons.push('atomic group degraded but recoverable via a coordinated replan');
    evidence.push(ev('ATOMIC_REPLAN', `atomicGroupStatus=${tel.atomicGroupStatus}`));
  }

  const applicable = reasons.length > 0;
  return Object.freeze({
    action: 'REPLAN',
    applicable,
    priority: PRIORITY.REPLAN,
    score: applicable ? Math.min(1, 0.5 + 0.1 * reasons.length) : 0,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze([
      con('IMMUTABLE_PARENT_PLAN', true, 'the original plan stays immutable; revision creates plan-v(n+1) in explicit lineage'),
      con('RISK_REVALIDATION', true, 'revised plan requires Risk revalidation before execution'),
      con('AEGIS_REVALIDATION', true, 'revised plan requires AEGIS revalidation before execution'),
      con('TOTAL_QUANTITY_PRESERVED', true, 'replan never alters the total target quantity'),
    ]),
  });
}

// ---------------------------------------------------------------------------
// REROUTE — another simulated venue provides superior deterministic conditions.
// ---------------------------------------------------------------------------

function reroutePolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const reasons: string[] = [];
  const evidence: DecisionEvidence[] = [];
  const t = input.thresholds;
  const tel = input.telemetry;

  const hasAlternative = input.bestAlternativeVenueId !== null && input.remainingQuantity > 0;
  const advantage = hasAlternative ? input.bestAlternativeScore - input.currentVenueScore : 0;
  const superior = hasAlternative && advantage >= t.rerouteThreshold;

  if (superior) {
    reasons.push(`venue ${input.bestAlternativeVenueId} scores ${input.bestAlternativeScore.toFixed(4)} vs current ${input.currentVenueScore.toFixed(4)} (advantage ${advantage.toFixed(4)} ≥ threshold ${t.rerouteThreshold})`);
    evidence.push(ev('VENUE_ADVANTAGE', `from=${input.currentVenueScore}, to=${input.bestAlternativeScore}, delta=${advantage}`));
  }
  if (hasSig(input.signals, 'VENUE_DEGRADED') && hasAlternative && advantage >= 0) {
    reasons.push('current venue degraded; a healthier venue is available');
    evidence.push(ev('VENUE_DEGRADED', `alternative=${input.bestAlternativeVenueId}`));
  }
  if (hasCrit(input.signals, 'VENUE_FAILED') && hasAlternative && !tel.atomicRisk) {
    reasons.push(`venue failed; rerouting remaining ${input.remainingQuantity} units to ${input.bestAlternativeVenueId}`);
    evidence.push(ev('VENUE_FAILED_REROUTE', `remaining=${input.remainingQuantity}, to=${input.bestAlternativeVenueId}`));
  }

  const applicable = reasons.length > 0;
  return Object.freeze({
    action: 'REROUTE',
    applicable,
    priority: PRIORITY.REROUTE,
    score: applicable ? Math.min(1, 0.4 + advantage) : 0,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze([
      con('DETERMINISTIC_RANKING', true, 'ranking is a pure function of venue attributes with deterministic tie-breaking'),
      con('HEALTH_GATED', true, 'UNAVAILABLE venues are never routing targets'),
    ]),
  });
}

// ---------------------------------------------------------------------------
// RESLICE — current slicing is suboptimal for observed liquidity/fills.
// ---------------------------------------------------------------------------

function reslicePolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const reasons: string[] = [];
  const evidence: DecisionEvidence[] = [];
  const t = input.thresholds;
  const tel = input.telemetry;

  const fillBelowReslice = tel.fillRatio < t.resliceThreshold && input.remainingQuantity > 0;
  if (fillBelowReslice) {
    reasons.push(`fill ratio ${tel.fillRatio.toFixed(4)} below reslice floor ${t.resliceThreshold} — slice sizes are suboptimal`);
    evidence.push(ev('FILL_BELOW_RESLICE', `fillRatio=${tel.fillRatio}, remaining=${input.remainingQuantity}`));
  }
  if (hasSig(input.signals, 'ORDER_AGING') && input.remainingQuantity > 0) {
    reasons.push('outstanding orders are aging — reslice the remainder across fresh slices');
    evidence.push(ev('ORDER_AGING', `agedOrders=${input.signals.find((s) => s.type === 'ORDER_AGING')?.evidence.agedOrderCount ?? 0}`));
  }
  if (hasSig(input.signals, 'PARTIAL_FILL') && tel.fillRatio >= t.resliceThreshold && input.remainingQuantity > 0 && !tel.atomicRisk) {
    // Only when the price is NOT drifting away: with an active drift breach
    // the problem is the order price, not the slice size — REPRICE owns it.
    const driftBreached = Math.abs(input.priceDriftBps) >= t.repriceThresholdBps;
    if (!driftBreached) {
      reasons.push(`partial fill with ${input.remainingQuantity} outstanding — smaller slices improve completion`);
      evidence.push(ev('PARTIAL_FILL_RESLICE', `remaining=${input.remainingQuantity}`));
    }
  }

  const applicable = reasons.length > 0 && !tel.atomicRisk;
  if (tel.atomicRisk && reasons.length > 0) {
    reasons.push('NOTE: atomic group — reslice suppressed in favour of REPLAN to preserve all-or-nothing semantics');
  }
  return Object.freeze({
    action: 'RESLICE',
    applicable,
    priority: PRIORITY.RESLICE,
    score: applicable ? Math.min(1, 0.4 + (1 - tel.fillRatio)) : 0,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze([
      con('TOTAL_QUANTITY_PRESERVED', true, 'reslice covers the remaining quantity; total target never changes'),
      con('LINEAGE_PRESERVED', true, 'parent plan, route/leg references and allocation constraints are preserved'),
      con('ATOMIC_SEMANTICS', true, 'atomic groups are never silently split'),
    ]),
  });
}

// ---------------------------------------------------------------------------
// REPRICE — market drift / adverse conditions made the current price stale.
// ---------------------------------------------------------------------------

function repricePolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const reasons: string[] = [];
  const evidence: DecisionEvidence[] = [];
  const t = input.thresholds;
  const tel = input.telemetry;

  const driftBreached = Math.abs(input.priceDriftBps) >= t.repriceThresholdBps;
  if (driftBreached && input.remainingQuantity > 0) {
    reasons.push(`price drift ${input.priceDriftBps.toFixed(2)}bps beyond reprice threshold ${t.repriceThresholdBps}bps — order price is stale`);
    evidence.push(ev('PRICE_DRIFT', `driftBps=${input.priceDriftBps}, thresholdBps=${t.repriceThresholdBps}`));
  }
  if (hasSig(input.signals, 'PARTIAL_FILL') && driftBreached) {
    reasons.push('partial fill combined with adverse price drift — reprice the remainder');
    evidence.push(ev('PARTIAL_FILL_REPRICE', `remaining=${input.remainingQuantity}, driftBps=${input.priceDriftBps}`));
  }
  if (hasSig(input.signals, 'SLIPPAGE_HIGH') && input.remainingQuantity > 0 && driftBreached) {
    reasons.push('slippage high and price drifting — repricing limits further adverse selection');
    evidence.push(ev('SLIPPAGE_REPRICE', `slippageBps=${tel.slippageBps}`));
  }

  const applicable = reasons.length > 0;
  return Object.freeze({
    action: 'REPRICE',
    applicable,
    priority: PRIORITY.REPRICE,
    score: applicable ? Math.min(1, 0.4 + Math.abs(input.priceDriftBps) / (t.repriceThresholdBps * 10)) : 0,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze([
      con('WITHIN_PRICE_LIMITS', true, 'proposed price is clamped to the configured tick size and price limits'),
      con('PROPOSAL_ONLY', true, 'reprice never bypasses Risk / Execution authorities'),
    ]),
  });
}

// ---------------------------------------------------------------------------
// KEEP — quality remains inside acceptable bounds. Fallback action.
// ---------------------------------------------------------------------------

function keepPolicy(input: PolicyEvaluationInput): PolicyVerdict {
  const tel = input.telemetry;
  const quality = input.quality;
  const noCritical = !input.signals.some((s) => s.severity === 'CRITICAL');
  const withinBounds = !quality.degraded && quality.score >= input.thresholds.qualityDowngradeThreshold;
  const complete = input.remainingQuantity <= 0;

  const reasons: string[] = [];
  if (complete) reasons.push('plan fully filled — nothing to adapt');
  if (withinBounds) reasons.push(`quality score ${quality.score.toFixed(4)} (${quality.grade}) within acceptable bounds`);
  if (noCritical) reasons.push('no critical execution signals observed');
  if (input.remainingQuantity > 0 && !withinBounds) reasons.push('NOTE: KEEP chosen as fallback only because no stronger policy applies');

  const applicable = true; // KEEP is always applicable — it is the safe fallback
  return Object.freeze({
    action: 'KEEP',
    applicable,
    priority: PRIORITY.KEEP,
    score: complete ? 1 : Math.min(1, quality.score),
    reasons: Object.freeze(reasons),
    evidence: Object.freeze([
      ev('QUALITY', `score=${quality.score}, grade=${quality.grade}, trend=${quality.trend}`),
      ev('COMPLETION', `remaining=${input.remainingQuantity}`),
    ]),
    constraints: Object.freeze([
      con('QUALITY_BOUNDS', withinBounds, `score ${quality.score.toFixed(4)} vs downgrade floor ${input.thresholds.qualityDowngradeThreshold}`),
      con('NO_CRITICAL_SIGNALS', noCritical, 'no CRITICAL severity signals in this cycle'),
    ]),
  });
}

/** Pick the winning policy: applicable + lowest priority number (dominance). */
export function selectPolicy(verdicts: readonly PolicyVerdict[]): PolicyVerdict {
  const applicable = verdicts.filter((v) => v.applicable);
  if (applicable.length === 0) {
    return verdicts.find((v) => v.action === 'KEEP')!;
  }
  const sorted = [...applicable].sort((a, b) =>
    a.priority - b.priority ||
    b.score - a.score ||
    a.action.localeCompare(b.action),
  );
  return sorted[0];
}

/** Deterministic decision severity: worst signal severity feeding the action. */
export function policySeverity(verdict: PolicyVerdict, signals: readonly ExecutionSignal[]): SignalSeverity {
  if (verdict.action === 'ABORT') return 'CRITICAL';
  if (signals.some((s) => s.severity === 'CRITICAL')) return 'CRITICAL';
  if (verdict.applicable && verdict.action !== 'KEEP' && signals.some((s) => s.severity === 'WARNING')) return 'WARNING';
  if (verdict.applicable && verdict.action !== 'KEEP') return 'WARNING';
  return 'INFO';
}
