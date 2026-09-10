import {RiskGate, AuthorityGateInput, AuthorityValidation, AuthorityStatus} from './types';

/**
 * Sprint 033 — the default deterministic Risk-authority bridge.
 *
 * The control plane REQUESTS validation from the Risk authority through this
 * narrow interface; it can never override a rejection and never re-implements
 * Risk logic. The default implementation replays a per-cycle script (from
 * ControlCycleSpecInput.riskValidation) — identical input → identical
 * validation. Hard control limits are surfaced separately by the control
 * plane itself (see limits.ts / safety.ts); they are control-plane concerns,
 * not a second Risk authority.
 */
export class ScriptedRiskGate implements RiskGate {
  private readonly script: readonly {status: AuthorityStatus; reason: string}[];

  constructor(script: readonly {status: AuthorityStatus; reason: string}[] = []) {
    this.script = Object.freeze(script);
  }

  validateExecution(input: AuthorityGateInput): AuthorityValidation {
    const step = this.script[Math.min(input.cycleNumber, this.script.length - 1)];
    if (step) {
      return Object.freeze({
        authority: 'RISK',
        status: step.status,
        reason: step.reason,
        authorityRef: `risk-cycle-${input.cycleNumber}`,
      });
    }
    return Object.freeze({
      authority: 'RISK',
      status: 'APPROVED',
      reason: 'risk envelope validated for the current execution state',
      authorityRef: `risk-cycle-${input.cycleNumber}`,
    });
  }
}
