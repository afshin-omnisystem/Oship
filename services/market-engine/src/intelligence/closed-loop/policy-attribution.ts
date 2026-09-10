import type {
  ClosedLoopRecord, PolicyAttribution, ClosedLoopValue,
} from './types';
import {policyAttributionId, derived, unavailable} from './ids';
import {policyEvaluationFor, baselinePolicyVersion, candidatePolicyVersions} from './performance';
import {realizedComponents} from './value';

/**
 * SPRINT 035 — policy attribution (§14).
 *
 * For every execution: policy version, baseline policy, selected policy,
 * candidate policy where applicable, quality, objective, realized result and
 * policy delta — determining whether policy changes actually preserved
 * opportunity value end-to-end. Policies are never automatically activated.
 */

export function policyAttribution(record: ClosedLoopRecord): PolicyAttribution {
  const o = record.opportunity;
  const performance = record.performance;
  const policyVersion = record.session.policyVersion;
  const policyId = record.session.policyId;
  const baseline = baselinePolicyVersion(performance);
  const candidates = candidatePolicyVersions(performance);
  const candidate = candidates.length > 0 ? candidates[candidates.length - 1] : null;

  const evaluation = policyEvaluationFor(performance, policyVersion);
  const quality = evaluation ? evaluation.executionQuality : null;

  const objective: ClosedLoopValue<number> = evaluation
    ? derived(evaluation.score, 'Sprint 034 policy evaluation deterministic score')
    : unavailable<number>('policy.objective', 'no Sprint 034 policy evaluation for this version');

  const realized = realizedComponents(record);
  const realizedResult = realized.realizedNetValue;

  const baselineEvaluation = policyEvaluationFor(performance, baseline);
  const policyDelta = evaluation && baselineEvaluation && baseline !== policyVersion
    ? derived(evaluation.score - baselineEvaluation.score, `policy ${policyVersion} score − baseline ${baseline} score`)
    : baseline === policyVersion
      ? derived(0, 'this execution ran the baseline policy')
      : unavailable<number>('policy.delta', 'baseline policy evaluation unavailable');

  // Did the policy change preserve END-TO-END value (not just execution
  // quality)? Honest when both realized value and the objective are measured.
  const preservedEndToEndValue = realizedResult.value !== null && objective.value !== null
    ? realizedResult.value >= 0
    : null;

  return Object.freeze({
    opportunityId: o.opportunityId,
    policyId,
    policyVersion,
    baselinePolicyVersion: baseline,
    candidatePolicyVersion: candidate,
    quality,
    objective,
    realizedResult,
    policyDelta,
    preservedEndToEndValue,
    fingerprint: policyAttributionId({
      id: o.opportunityId,
      policyId, policyVersion, baseline, candidate,
      quality, objective: objective.value,
      realized: realizedResult.value,
    }),
  });
}
