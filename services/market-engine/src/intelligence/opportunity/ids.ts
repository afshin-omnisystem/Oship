/**
 * SPRINT 038 — opportunity intelligence identity.
 *
 * Every artifact id is content-derived and prefix-tagged; canonical JSON
 * makes key order irrelevant. Reuses the learning plane's hash primitive so
 * identity semantics stay uniform across planes.
 */

import {learningHash} from '../learning/ids';

function prefixed(prefix: string): (input: unknown) => string {
  return (input: unknown) => `${prefix}_${learningHash(input).slice(0, 24)}`;
}

export const opportunityAnalysisIdOf = prefixed('oai');
export const similarityIdOf = prefixed('osm');
export const featureProfileIdOf = prefixed('ofp');
export const regimeMatchIdOf = prefixed('orm');
export const strategyHistoryIdOf = prefixed('ost');
export const venueHistoryIdOf = prefixed('ovh');
export const leakageRiskIdOf = prefixed('olk');
export const evidenceIdOf = prefixed('oev');
export const stabilityIntegrationIdOf = prefixed('osi');
export const distributionIdOf = prefixed('odb');
export const scoreIdOf = prefixed('osc');
export const dependenciesIdOf = prefixed('odp');
export const classificationIdOf = prefixed('ocl');
export const profileIdOf = prefixed('opr');
export const explanationIdOf = prefixed('oex');
export const researchContextIdOf = prefixed('orc');
export const feedbackIdOf = prefixed('ofb');
export const reconciliationIdOf = prefixed('orb');
export const rankingIdOf = prefixed('orn');
export const auditEventIdOf = prefixed('oea');

export const contentFingerprintOf = prefixed('ocfp');
export const analysisFingerprintOf = prefixed('ofp2');

export {learningHash};

/** Canonical JSON — deterministic serialization with sorted object keys. */
import {canonicalJson} from '../learning/ids';
export {canonicalJson};
