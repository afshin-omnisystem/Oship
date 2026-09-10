import {
  ControlAuthorityBridge, RiskGate, AegisGate, ExecutionAuthorityBridge,
  RevisionSubmissionInput, RevisionSubmission, AuthorityStatus, AuthorityValidation,
} from './types';
import {ScriptedRiskGate} from './risk-gate';
import {ScriptedAegisGate} from './aegis-gate';
import {reviseExecutionPlan, PlanRevision} from '../intelligence/replan';

/**
 * Sprint 033 — the authority bridge.
 *
 * The control plane is NOT an authority. It operates strictly through the
 * existing authority boundaries:
 *
 *   - Risk:     request validation (RiskGate) — never override.
 *   - AEGIS:    request validation (AegisGate) — never bypass.
 *   - Execution: submit plan revisions (ExecutionAuthorityBridge) — the ONLY
 *               path through which a plan changes. The bridge wraps the
 *               Sprint 032 revision engine (reviseExecutionPlan).
 *
 * There is deliberately NO Treasury and NO Portfolio method anywhere on this
 * bridge: Treasury mutation and portfolio state remain outside the control
 * plane. The interface carries explicit structural markers
 * (treasuryMutation: false, portfolioMutation: false) so invariants can assert
 * the absence of those surfaces.
 */
export class DefaultExecutionAuthorityBridge implements ExecutionAuthorityBridge {
  /** The only accepted revision kinds — anything else is refused. */
  static readonly ACCEPTED_REVISION_KINDS: readonly PlanRevision['kind'][] =
    Object.freeze(['REPRICE', 'RESLICE', 'REROUTE', 'REPLAN', 'ABORT']);

  submitRevision(input: RevisionSubmissionInput): RevisionSubmission {
    const kind = input.revision.kind;
    if (!DefaultExecutionAuthorityBridge.ACCEPTED_REVISION_KINDS.includes(kind)) {
      return Object.freeze({
        accepted: false,
        resultingPlan: null,
        authorityRef: null,
        rejectionReason: `unknown revision kind ${String(kind)} — execution authority refuses`,
      });
    }
    let revised: import('../intelligence/types').ExecutionPlan;
    try {
      revised = reviseExecutionPlan(input.plan, input.revision, input.filledQuantity, input.remainingByVenue);
    } catch (err) {
      return Object.freeze({
        accepted: false,
        resultingPlan: null,
        authorityRef: null,
        rejectionReason: `execution authority rejected revision: ${(err as Error).message}`,
      });
    }
    return Object.freeze({
      accepted: true,
      resultingPlan: revised,
      authorityRef: `exec-rev-${revised.executionPlanId}`,
      rejectionReason: null,
    });
  }
}

/** Submit a revision through an ExecutionAuthorityBridge. */
export function submitRevisionThrough(
  bridge: ExecutionAuthorityBridge,
  req: RevisionSubmissionInput,
): RevisionSubmission {
  return bridge.submitRevision(req);
}

/**
 * The default bridge: scripted Risk + AEGIS gates plus the Sprint 032-backed
 * execution revision path. Structural markers are literal `false`.
 */
export function defaultAuthorityBridge(input: {
  riskScript?: readonly {status: AuthorityStatus; reason: string}[];
  aegisScript?: readonly {status: AuthorityStatus; reason: string}[];
  execution?: ExecutionAuthorityBridge;
}): ControlAuthorityBridge {
  const risk: RiskGate = new ScriptedRiskGate(input.riskScript ?? []);
  const aegis: AegisGate = new ScriptedAegisGate(input.aegisScript ?? []);
  const execution = input.execution ?? new DefaultExecutionAuthorityBridge();
  return Object.freeze({
    risk,
    aegis,
    execution,
    treasuryMutation: false as const,
    portfolioMutation: false as const,
  });
}

export type {AuthorityValidation, AuthorityStatus};
