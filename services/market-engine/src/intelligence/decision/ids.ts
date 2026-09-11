/**
 * SPRINT 039 — decision intelligence identity.
 *
 * Every artifact id is content-derived and prefix-tagged; canonical JSON
 * (sorted keys) makes key order irrelevant. Reuses the learning plane's hash
 * primitive so identity semantics stay uniform across all intelligence
 * planes.
 */

import {learningHash} from '../learning/ids';

function prefixed(prefix: string): (input: unknown) => string {
  return (input: unknown) => `${prefix}_${learningHash(input).slice(0, 24)}`;
}

export const decisionAnalysisIdOf = prefixed('dia');
export const decisionContextIdOf = prefixed('dctx');
export const alternativeIdFingerprintOf = prefixed('dalt');
export const compatibilityIdOf = prefixed('dcmp');
export const counterfactualIdOf = prefixed('dcfx');
export const dependencyAxisIdOf = prefixed('daxs');
export const leakageAxisIdOf = prefixed('dlka');
export const stabilityAxisIdOf = prefixed('dsta');
export const evidenceAxisIdOf = prefixed('deva');
export const comparisonIdOf = prefixed('dcmp2');
export const tradeOffIdOf = prefixed('dtrd');
export const tradeOffAxisIdOf = prefixed('dtra');
export const dominanceIdOf = prefixed('ddom');
export const rankingIdOf = prefixed('drnk');
export const recommendationIdOf = prefixed('drec');
export const scenarioMatrixIdOf = prefixed('dscm');
export const decisionExplanationIdOf = prefixed('dexp');
export const decisionResearchContextIdOf = prefixed('drcx');
export const decisionFeedbackIdOf = prefixed('dfdb');
export const divergenceIdOf = prefixed('ddiv');
export const decisionAuditEventIdOf = prefixed('dea');

export const contentFingerprintOf = prefixed('dcfp');
export const decisionAnalysisFingerprintOf = prefixed('dfp2');

export {learningHash};

/** Canonical JSON — deterministic serialization with sorted object keys. */
import {canonicalJson} from '../learning/ids';
export {canonicalJson};
