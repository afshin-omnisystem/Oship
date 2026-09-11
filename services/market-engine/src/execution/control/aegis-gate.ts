import {AegisGate, AuthorityGateInput, AuthorityValidation, AuthorityStatus} from './types';

/**
 * Sprint 033 — the default deterministic AEGIS boundary bridge.
 *
 * The control plane REQUESTS AEGIS validation through this narrow interface
 * and can never bypass a rejection. In this simulation-only control plane the
 * default gate replays a per-cycle script (from
 * ControlCycleSpecInput.aegisValidation) — deterministic and replayable. A
 * PENDING state is treated as a rejection by the decision layer (fail closed).
 */
export class ScriptedAegisGate implements AegisGate {
  private readonly script: readonly {status: AuthorityStatus; reason: string}[];

  constructor(script: readonly {status: AuthorityStatus; reason: string}[] = []) {
    this.script = Object.freeze(script);
  }

  validateExecution(input: AuthorityGateInput): AuthorityValidation {
    const step = this.script[Math.min(input.cycleNumber, this.script.length - 1)];
    if (step) {
      return Object.freeze({
        authority: 'AEGIS',
        status: step.status,
        reason: step.reason,
        authorityRef: `aegis-cycle-${input.cycleNumber}`,
      });
    }
    return Object.freeze({
      authority: 'AEGIS',
      status: 'APPROVED',
      reason: 'aegis envelope validated for the current execution state',
      authorityRef: `aegis-cycle-${input.cycleNumber}`,
    });
  }
}
