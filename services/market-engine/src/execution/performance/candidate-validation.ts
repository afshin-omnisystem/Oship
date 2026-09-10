import {PolicyCandidate, ParameterDescriptor} from './types';
import {parameterSetIsValid, PROTECTED_PARAMETER_PATHS} from './parameter-space';

/**
 * Sprint 034 — structural candidate validation (fail closed).
 *
 * A candidate is structurally VALID only when: its parameter set touches only
 * declared, unprotected, in-bounds, on-grid paths; its lineage is intact and
 * version-monotonic; and its scores are finite. Protected safety paths are an
 * automatic INVALID — optimization may never trade safety for performance.
 */

export interface CandidateValidation {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateCandidate(
  candidate: PolicyCandidate,
  space: readonly ParameterDescriptor[],
): CandidateValidation {
  const violations: string[] = [];

  const params = parameterSetIsValid(space, candidate.parameters);
  violations.push(...params.violations);

  for (const e of candidate.parameters.entries) {
    if (PROTECTED_PARAMETER_PATHS.includes(e.path)) {
      violations.push(`${e.path} is protected — safety parameters are not optimizable`);
    }
  }

  // Lineage integrity: starts at the parent, versions strictly increase.
  if (candidate.lineage.length === 0) {
    violations.push('candidate lineage is empty');
  } else {
    const root = candidate.lineage[0];
    if (root.version !== candidate.parentPolicyVersion) {
      violations.push(`lineage root ${root.version} ≠ parent ${candidate.parentPolicyVersion}`);
    }
    for (let i = 1; i < candidate.lineage.length; i++) {
      if (candidate.lineage[i].version <= candidate.lineage[i - 1].version) {
        violations.push(`lineage version not monotonic at ${candidate.lineage[i].version}`);
      }
    }
    if (candidate.lineage[candidate.lineage.length - 1].version !== candidate.candidateVersion) {
      violations.push('candidate lineage does not end at the candidate version');
    }
  }

  if (!Number.isFinite(candidate.objectiveScore) || !Number.isFinite(candidate.baselineScore)) {
    violations.push('candidate scores must be finite');
  }
  if (candidate.observedSampleSize < 0) {
    violations.push('observedSampleSize must be ≥ 0');
  }
  if (candidate.candidateVersion <= candidate.parentPolicyVersion) {
    violations.push('candidate version must sort after the parent version');
  }

  return Object.freeze({valid: violations.length === 0, violations: Object.freeze(violations)});
}
