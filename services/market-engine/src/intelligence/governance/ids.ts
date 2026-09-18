/**
 * SPRINT 040 — governance identity.
 *
 * Every governance artifact id is content-derived and prefix-tagged;
 * canonical JSON (sorted keys) makes key order irrelevant. Reuses the
 * learning plane's hash primitive so identity semantics stay uniform across
 * all intelligence planes, exactly like Sprint 039.
 */

import {learningHash, canonicalJson} from '../decision/ids';

function prefixed(prefix: string): (input: unknown) => string {
  return (input: unknown) => `${prefix}_${learningHash(input).slice(0, 24)}`;
}

export const governanceIdOf = prefixed('gov');
export const governanceContextIdOf = prefixed('gctx');
export const policyEvaluationIdOf = prefixed('gpol');
export const evidenceGateIdOf = prefixed('gevg');
export const safetyGateIdOf = prefixed('gsfg');
export const comparabilityGateIdOf = prefixed('gcmp');
export const freshnessGateIdOf = prefixed('gfsh');
export const stabilityGateIdOf = prefixed('gstb');
export const dependencyGateIdOf = prefixed('gdep');
export const authorityCheckIdOf = prefixed('gaut');
export const classificationIdOf = prefixed('gcls');
export const restrictionIdOf = prefixed('gres');
export const researchEscalationIdOf = prefixed('grsc');
export const governanceResearchContextIdOf = prefixed('grcx');
export const governanceFeedbackIdOf = prefixed('gfdb');
export const handoffPackageIdOf = prefixed('ghof');
export const strategyInputIdOf = prefixed('gstr');
export const normalizationFingerprintOf = prefixed('gnrm');
export const governanceAuditEventIdOf = prefixed('gea');

export const contentFingerprintOf = prefixed('gcfp');
export const governanceResultFingerprintOf = prefixed('gfp2');

export {learningHash, canonicalJson};
