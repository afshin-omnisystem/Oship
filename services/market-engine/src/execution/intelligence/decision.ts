import {
  AdaptiveExecutionDecision,
  AdaptiveAction,
  DecisionConstraint,
  DecisionEvidence,
  ExecutionSignal,
  ExecutionTelemetry,
  ExecutionQualityAssessment,
  SignalSeverity,
} from './types';
import {decisionId, decisionFingerprintOf, adaptiveInputFingerprint, adaptiveConfigurationFingerprint} from './ids';
import {PolicyVerdict, selectPolicy, policySeverity, evaluatePolicies, PolicyEvaluationInput} from './policies';

/**
 * Sprint 032 — Adaptive Decision Model.
 *
 * Combines signals + quality + deterministic policies into ONE auditable
 * AdaptiveExecutionDecision. Emergency stop dominates every adaptive action
 * (ABORT is forced). Confidence is a deterministic function of policy score,
 * signal severities and quality — never a random or learned value. The
 * decision carries its configuration fingerprint, input fingerprint and
 * decision fingerprint so it can be verified and replayed bit-for-bit.
 */

export interface DecisionInput {
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly signals: readonly ExecutionSignal[];
  readonly policies: readonly PolicyVerdict[];
  readonly parentPlanId: string | null;
  readonly cycle: number;
  readonly timestamp: number;
  readonly emergencyStop: boolean;
  readonly configuration: unknown;            // fingerprinted config object
  readonly inputState: unknown;               // fingerprinted input state
}

export function decide(input: DecisionInput): AdaptiveExecutionDecision {
  const emergency = input.emergencyStop;

  // Completion short-circuit: with nothing remaining there is nothing to
  // adapt — KEEP is the only meaningful action (execution is complete).
  const nothingRemaining = input.telemetry.remainingQuantity <= 0;

  // Emergency-stop dominance: ABORT regardless of every other policy.
  const chosen: PolicyVerdict = emergency
    ? forceAbort(input.policies)
    : nothingRemaining
      ? forceKeep(input.policies)
      : selectPolicy(input.policies);

  const action: AdaptiveAction = chosen.action;
  const severity: SignalSeverity = emergency ? 'CRITICAL' : policySeverity(chosen, input.signals);

  const confidence = decisionConfidence(action, chosen, input.signals, input.quality, emergency);

  const evidence: DecisionEvidence[] = [
    Object.freeze({kind: 'POLICY', detail: `${action} policy: ${chosen.reasons.join('; ') || 'fallback'}`}),
    ...chosen.evidence,
  ];
  if (emergency && action !== 'ABORT') {
    evidence.push(Object.freeze({kind: 'EMERGENCY_STOP', detail: 'emergency stop forced ABORT over the policy verdict'}));
  }

  const constraints: DecisionConstraint[] = [
    ...chosen.constraints,
    Object.freeze({name: 'PROPOSAL_ONLY', satisfied: true, detail: 'adaptive control is not an authority; it revises plans only through the Execution boundary'}),
  ];

  const reason = emergency
    ? `EMERGENCY_STOP: adaptive action forced to ABORT (emergency stop dominates every adaptive action); ${chosen.reasons.join('; ')}`
    : nothingRemaining && action === 'KEEP'
      ? 'KEEP: execution complete — no remaining quantity to adapt'
      : `${action}: ${chosen.reasons.join('; ') || 'quality within bounds; continue current execution'}`;

  const configurationFingerprint = adaptiveConfigurationFingerprint(input.configuration);
  const inputFingerprint = adaptiveInputFingerprint(input.inputState);

  const body = {
    decisionId: decisionId({
      planId: input.telemetry.executionPlanId,
      cycle: input.cycle,
      action,
      timestamp: input.timestamp,
      inputFingerprint,
      configurationFingerprint,
    }),
    executionPlanId: input.telemetry.executionPlanId,
    parentPlanId: input.parentPlanId,
    cycle: input.cycle,
    timestamp: input.timestamp,
    action,
    confidence,
    severity,
    signals: Object.freeze([...input.signals]),
    evidence: Object.freeze(evidence),
    constraints: Object.freeze(constraints),
    reason,
    configurationFingerprint,
    inputFingerprint,
  };

  return Object.freeze({
    ...body,
    decisionFingerprint: decisionFingerprintOf(body),
  });
}

function forceKeep(policies: readonly PolicyVerdict[]): PolicyVerdict {
  const keep = policies.find((p) => p.action === 'KEEP');
  if (keep) {
    return Object.freeze({
      ...keep,
      applicable: true,
      reasons: Object.freeze(['execution complete — no remaining quantity to adapt', ...keep.reasons]),
    });
  }
  return Object.freeze({
    action: 'KEEP' as const,
    applicable: true,
    priority: 5,
    score: 1,
    reasons: Object.freeze(['execution complete — no remaining quantity to adapt']),
    evidence: Object.freeze([]),
    constraints: Object.freeze([]),
  });
}

function forceAbort(policies: readonly PolicyVerdict[]): PolicyVerdict {
  const abort = policies.find((p) => p.action === 'ABORT');
  if (abort) return abort;
  return Object.freeze({
    action: 'ABORT' as const,
    applicable: true,
    priority: 0,
    score: 1,
    reasons: Object.freeze(['emergency stop is active — every adaptive action is dominated by ABORT']),
    evidence: Object.freeze([Object.freeze({kind: 'EMERGENCY_STOP', detail: 'forced abort'})]),
    constraints: Object.freeze([]),
  });
}

/**
 * Deterministic confidence: policy strength blended with signal-severity
 * support and execution quality. Range 0..1.
 */
export function decisionConfidence(
  action: AdaptiveAction,
  policy: PolicyVerdict,
  signals: readonly ExecutionSignal[],
  quality: ExecutionQualityAssessment,
  emergency: boolean,
): number {
  if (emergency) return 1;
  const criticalCount = signals.filter((s) => s.severity === 'CRITICAL').length;
  const warningCount = signals.filter((s) => s.severity === 'WARNING').length;
  const severitySupport = Math.min(1, criticalCount * 0.25 + warningCount * 0.1);
  const qualitySupport = action === 'KEEP' ? quality.score : 1 - quality.score;
  const raw = 0.5 * policy.score + 0.3 * severitySupport + 0.2 * qualitySupport;
  return Math.round(Math.min(1, Math.max(0, raw)) * 1e6) / 1e6;
}

/** Convenience wrapper: evaluate policies + decide in one deterministic step. */
export function evaluateAndDecide(
  input: Omit<DecisionInput, 'policies'> & {policyInput: PolicyEvaluationInput},
): {decision: AdaptiveExecutionDecision; policies: readonly PolicyVerdict[]} {
  const policies = evaluatePolicies(input.policyInput);
  const decision = decide({...input, policies});
  return Object.freeze({decision, policies});
}
