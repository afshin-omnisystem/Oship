import {
  PolicyCandidate, ParameterSet, PromotionState, CandidateValidationStatus,
  SimulationStatus, RegressionStatus, OpportunityDomain,
} from './types';
import {policyCandidateId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — immutable policy candidates.
 *
 * A candidate is a recommendation: a versioned parameter set with scores and
 * gate statuses. Creating a candidate NEVER modifies the active policy.
 * Gate results produce NEW candidate objects (withGateResults) — the original
 * is immutable forever.
 */

export interface CandidateInput {
  readonly parentPolicyId: string;
  readonly parentPolicyVersion: string;
  readonly candidateIndex: number;
  readonly domain: OpportunityDomain | 'CROSS_DOMAIN';
  readonly parameters: ParameterSet;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly observedSampleSize: number;
  readonly createdAt: number;
  readonly parentLineage: PolicyCandidate['lineage'];
}

/** Candidate version: parent vN → candidate vN.M (M = candidate index). */
export function candidateVersionOf(parentVersion: string, index: number): string {
  return `${parentVersion}.${index}`;
}

export function createPolicyCandidate(input: CandidateInput): PolicyCandidate {
  if (!(input.candidateIndex >= 1)) {
    throw new Error('candidate index must be ≥ 1 — fail closed');
  }
  const candidateVersion = candidateVersionOf(input.parentPolicyVersion, input.candidateIndex);
  const lineage = Object.freeze([
    ...input.parentLineage,
    Object.freeze({
      policyId: input.parentPolicyId,
      version: candidateVersion,
      kind: 'CANDIDATE' as const,
    }),
  ]);
  const body = {
    parentPolicyId: input.parentPolicyId,
    parentPolicyVersion: input.parentPolicyVersion,
    candidateVersion,
    domain: input.domain,
    parameters: input.parameters,
    objectiveScore: input.objectiveScore,
    baselineScore: input.baselineScore,
    expectedImprovement: input.baselineScore !== 0
      ? (input.objectiveScore - input.baselineScore) / Math.abs(input.baselineScore)
      : input.objectiveScore - input.baselineScore,
    observedSampleSize: input.observedSampleSize,
    validationStatus: 'PENDING' as CandidateValidationStatus,
    simulationStatus: 'NOT_RUN' as SimulationStatus,
    regressionStatus: 'NOT_RUN' as RegressionStatus,
    promotionState: 'INSUFFICIENT_DATA' as PromotionState,
    createdAt: input.createdAt,
    lineage,
  };
  return Object.freeze({
    ...body,
    candidateId: policyCandidateId(body),
    fingerprint: `pfc_${sha256(body)}`,
  });
}

/** Produce a NEW candidate with gate results applied (original untouched). */
export function withGateResults(
  candidate: PolicyCandidate,
  gates: {
    readonly validationStatus?: CandidateValidationStatus;
    readonly simulationStatus?: SimulationStatus;
    readonly regressionStatus?: RegressionStatus;
    readonly promotionState?: PromotionState;
  },
): PolicyCandidate {
  const body = {
    ...candidate,
    validationStatus: gates.validationStatus ?? candidate.validationStatus,
    simulationStatus: gates.simulationStatus ?? candidate.simulationStatus,
    regressionStatus: gates.regressionStatus ?? candidate.regressionStatus,
    promotionState: gates.promotionState ?? candidate.promotionState,
  };
  return Object.freeze({
    ...body,
    candidateId: policyCandidateId({
      parentPolicyId: body.parentPolicyId,
      parentPolicyVersion: body.parentPolicyVersion,
      candidateVersion: body.candidateVersion,
      domain: body.domain,
      parameters: body.parameters.fingerprint,
      objectiveScore: body.objectiveScore,
    }),
    fingerprint: `pfc_${sha256(body)}`,
  });
}

/**
 * Explicit approval — the ONLY transition to APPROVED_CANDIDATE, and it can
 * only start from ELIGIBLE. ELIGIBLE ≠ ACTIVE: nothing here deploys anything;
 * the output is an auditable candidate ready for human/explicit approval.
 */
export function approveCandidate(candidate: PolicyCandidate): PolicyCandidate {
  if (candidate.promotionState !== 'ELIGIBLE') {
    throw new Error(`refusing to approve candidate ${candidate.candidateId}: state is ${candidate.promotionState}, not ELIGIBLE — fail closed`);
  }
  const body = {
    ...candidate,
    promotionState: 'APPROVED_CANDIDATE' as PromotionState,
    lineage: Object.freeze([
      ...candidate.lineage,
      Object.freeze({
        policyId: candidate.parentPolicyId,
        version: nextApprovedVersion(candidate.parentPolicyVersion),
        kind: 'APPROVED' as const,
      }),
    ]),
  };
  return Object.freeze({
    ...body,
    candidateId: policyCandidateId({
      parentPolicyId: body.parentPolicyId,
      parentPolicyVersion: body.parentPolicyVersion,
      candidateVersion: body.candidateVersion,
      domain: body.domain,
      parameters: body.parameters.fingerprint,
      objectiveScore: body.objectiveScore,
    }),
    fingerprint: `pfc_${sha256(body)}`,
  });
}

/** Parent vN (or vN.M) → approved v(N+1). */
export function nextApprovedVersion(parentVersion: string): string {
  const major = parseInt(parentVersion.split('.')[0]!.replace(/^v/, ''), 10);
  if (!Number.isFinite(major)) {
    throw new Error(`unparseable policy version ${parentVersion} — fail closed`);
  }
  return `v${major + 1}`;
}
