import {createHash} from 'node:crypto';
import {canonicalJson} from '../closed-loop/engine';

/**
 * SPRINT 037 — deterministic learning identifiers and fingerprints.
 *
 * Every learning artifact derives its identity from its CONTENT: identical
 * content under identical configuration yields identical ids and
 * fingerprints, so replay is byte-identical by construction.
 */

export function learningHash(input: unknown): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex');
}

function prefixed(prefix: string): (input: unknown) => string {
  return (input: unknown) => `${prefix}_${learningHash(input).slice(0, 24)}`;
}

export const learningAnalysisIdOf = prefixed('lres');
export const observationIdOf = prefixed('lob');
export const featureIdOf = prefixed('lft');
export const featureVectorIdOf = prefixed('lfv');
export const cohortIdOf = prefixed('lch');
export const baselineIdOf = prefixed('lbs');
export const regimeIdOf = prefixed('lrg');
export const driftIdOf = prefixed('ldr');
export const stabilityIdOf = prefixed('lst');
export const confidenceIdOf = prefixed('lcn');
export const signalIdOf = prefixed('lsg');
export const priorityIdOf = prefixed('lpr');
export const recommendationIdOf = prefixed('lrc');
export const feedbackIdOf = prefixed('lfb');
export const learningResultIdOf = prefixed('lsd');
export const opportunityLearningIdOf = prefixed('lop');
export const venueLearningIdOf = prefixed('lvn');
export const policyLearningIdOf = prefixed('lpl');
export const leakageLearningIdOf = prefixed('lkg');
export const auditEventIdOf = prefixed('lev');

export const contentFingerprintOf = prefixed('lcfp');
export const lineageFingerprintOf = prefixed('llnk');
export const analysisFingerprintOf = prefixed('lfp');

export {canonicalJson};
