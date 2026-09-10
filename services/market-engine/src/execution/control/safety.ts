import {ControlVerdict, ControlPrecedence, AuthorityValidation, ExecutionTelemetry} from './types';

/**
 * Sprint 033 — Emergency-stop dominance.
 *
 * The emergency stop dominates EVERY autonomous action: when it is observed,
 * the only permissible outcome is ABORT(EMERGENCY_STOP). No configuration,
 * no optimization verdict, no authority approval can override it. Checked
 * first in every cycle, fail closed.
 */

/** The verdict the emergency stop mandates. */
export function emergencyStopVerdict(detail: string): ControlVerdict {
  return Object.freeze({
    precedence: 'EMERGENCY_STOP' as ControlPrecedence,
    action: 'ABORT',
    reason: 'EMERGENCY_STOP',
    detail,
    evidence: Object.freeze([Object.freeze({kind: 'EMERGENCY_STOP' as const, detail: 'emergency stop observed — autonomous execution halted'})]),
    abortReason: 'EMERGENCY_STOP',
  });
}

/** Whether an active emergency stop forces ABORT regardless of other verdicts. */
export function emergencyStopDominates(emergencyStop: boolean): boolean {
  return emergencyStop === true;
}

/**
 * Fail-closed resolution of authority validations: REJECTED → abort-worthy;
 * PENDING is treated as REJECTED (the control plane never proceeds on an
 * unresolved authority state).
 */
export function authorityFailsClosed(
  risk: AuthorityValidation,
  aegis: AuthorityValidation,
): {risk: boolean; aegis: boolean; reason: string} {
  const riskFail = risk.status === 'REJECTED' || risk.status === 'PENDING';
  const aegisFail = aegis.status === 'REJECTED' || aegis.status === 'PENDING';
  const parts: string[] = [];
  if (riskFail) parts.push(`risk authority ${risk.status}: ${risk.reason}`);
  if (aegisFail) parts.push(`aegis authority ${aegis.status}: ${aegis.reason}`);
  return {risk: riskFail, aegis: aegisFail, reason: parts.join('; ')};
}

/**
 * The hard safety envelope, evaluated before any optimization logic:
 * emergency stop, hard risk violation (Risk rejection or hard-limit breach)
 * and AEGIS rejection. Any hit produces a terminal ABORT verdict.
 */
export function evaluateSafetyEnvelope(input: {
  emergencyStop: boolean;
  riskValidation: AuthorityValidation;
  aegisValidation: AuthorityValidation;
  hardLimitViolations: readonly {abortReason: import('./types').ControlAbortReason; detail: string}[];
  telemetry: ExecutionTelemetry;
}): readonly ControlVerdict[] {
  const verdicts: ControlVerdict[] = [];
  if (input.emergencyStop) {
    verdicts.push(emergencyStopVerdict('emergency stop active at evaluation time'));
  }
  for (const v of input.hardLimitViolations) {
    verdicts.push(Object.freeze({
      precedence: 'HARD_RISK_VIOLATION' as ControlPrecedence,
      action: 'ABORT' as const,
      reason: v.abortReason,
      detail: v.detail,
      evidence: Object.freeze([Object.freeze({kind: 'LIMIT' as const, detail: v.detail})]),
      abortReason: v.abortReason,
    }));
  }
  if (input.riskValidation.status === 'REJECTED') {
    verdicts.push(Object.freeze({
      precedence: 'HARD_RISK_VIOLATION' as ControlPrecedence,
      action: 'ABORT' as const,
      reason: 'RISK_LIMIT',
      detail: `Risk authority rejected execution: ${input.riskValidation.reason}`,
      evidence: Object.freeze([Object.freeze({kind: 'RISK' as const, detail: input.riskValidation.reason})]),
      abortReason: 'RISK_LIMIT',
    }));
  } else if (input.riskValidation.status === 'PENDING') {
    verdicts.push(Object.freeze({
      precedence: 'HARD_RISK_VIOLATION' as ControlPrecedence,
      action: 'ABORT' as const,
      reason: 'RISK_LIMIT',
      detail: `Risk authority validation PENDING — treated as rejected (fail closed): ${input.riskValidation.reason}`,
      evidence: Object.freeze([Object.freeze({kind: 'RISK' as const, detail: 'pending risk validation fails closed'})]),
      abortReason: 'RISK_LIMIT',
    }));
  }
  if (input.aegisValidation.status === 'REJECTED') {
    verdicts.push(Object.freeze({
      precedence: 'AEGIS_REJECTION' as ControlPrecedence,
      action: 'ABORT' as const,
      reason: 'AEGIS_REJECTED',
      detail: `AEGIS rejected execution: ${input.aegisValidation.reason}`,
      evidence: Object.freeze([Object.freeze({kind: 'AEGIS' as const, detail: input.aegisValidation.reason})]),
      abortReason: 'AEGIS_REJECTED',
    }));
  } else if (input.aegisValidation.status === 'PENDING') {
    verdicts.push(Object.freeze({
      precedence: 'AEGIS_REJECTION' as ControlPrecedence,
      action: 'ABORT' as const,
      reason: 'AEGIS_REJECTED',
      detail: `AEGIS validation PENDING — treated as rejected (fail closed): ${input.aegisValidation.reason}`,
      evidence: Object.freeze([Object.freeze({kind: 'AEGIS' as const, detail: 'pending AEGIS validation fails closed'})]),
      abortReason: 'AEGIS_REJECTED',
    }));
  }
  return Object.freeze(verdicts);
}
