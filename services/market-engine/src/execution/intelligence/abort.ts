import {
  AbortProposal,
  ExecutionTelemetry,
  DecisionEvidence,
  ExecutionSignal,
} from './types';
import {abortProposalId, abortFingerprintOf} from './ids';

/**
 * Sprint 032 — Abort Engine.
 *
 * Deterministic abort proposals. ABORT is the fail-closed terminal action: all
 * outstanding quantity is cancelled, atomic groups are resolved with an
 * explicit recovery action (CANCEL_REMAINDER, or HEDGE when partially filled
 * atomic exposure exists), and the abort is audited. Emergency stop always
 * forces ABORT and dominates every other adaptive action.
 */

export interface AbortInput {
  readonly telemetry: ExecutionTelemetry;
  readonly signals: readonly ExecutionSignal[];
  readonly cycle: number;
  readonly timestamp: number;
  readonly reason: string;
  readonly emergencyStop: boolean;
  readonly evidence?: readonly DecisionEvidence[];
}

export function proposeAbort(input: AbortInput): AbortProposal {
  const tel = input.telemetry;
  const partiallyFilledAtomic = tel.atomicRequired && tel.filledQuantity > 0 && tel.remainingQuantity > 0;

  const evidence: DecisionEvidence[] = [
    ...(input.evidence ?? []),
    Object.freeze({kind: 'REMAINING', detail: `cancelling outstanding ${tel.remainingQuantity} of planned ${tel.plannedQuantity} (filled ${tel.filledQuantity})`}),
    Object.freeze({kind: 'ATOMIC', detail: tel.atomicRequired ? `atomic group ${tel.atomicGroupStatus}; ${partiallyFilledAtomic ? 'partially filled → HEDGE required to flatten exposure' : 'no filled exposure → CANCEL_REMAINDER'}` : 'not an atomic plan'}),
  ];
  if (input.emergencyStop) {
    evidence.push(Object.freeze({kind: 'EMERGENCY_STOP', detail: 'emergency stop dominated this decision'}));
  }

  const body = {
    abortProposalId: abortProposalId({planId: tel.executionPlanId, cycle: input.cycle, remaining: tel.remainingQuantity, timestamp: input.timestamp}),
    executionPlanId: tel.executionPlanId,
    action: 'ABORT' as const,
    cycle: input.cycle,
    timestamp: input.timestamp,
    remainingQuantity: tel.remainingQuantity,
    cancelAllOrders: true as const,
    atomicGroupAction: (partiallyFilledAtomic ? 'HEDGE' : 'CANCEL_REMAINDER') as AbortProposal['atomicGroupAction'],
    emergencyStop: input.emergencyStop,
    reason: input.reason,
    evidence: Object.freeze(evidence),
    requiresExecutionAuthorization: true as const,
    treasuryMutation: false as const,
    riskMutation: false as const,
    portfolioMutation: false as const,
  };

  return Object.freeze({
    ...body,
    fingerprint: abortFingerprintOf(body),
  });
}

/** Deterministic abort validation used by the controller VALIDATE stage. */
export function validateAbort(proposal: AbortProposal): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (proposal.remainingQuantity < 0) violations.push('abort remaining quantity must be >= 0');
  if (!proposal.cancelAllOrders) violations.push('abort must cancel all outstanding orders');
  if (proposal.emergencyStop && proposal.atomicGroupAction === 'NONE') violations.push('emergency-stop abort of an atomic plan must resolve the group');
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}
