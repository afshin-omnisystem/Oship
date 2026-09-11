import {createHash} from 'node:crypto';
import {canonicalJson} from '../closed-loop/engine';

/**
 * SPRINT 036 — deterministic research identifiers and fingerprints.
 *
 * Every research artifact derives its identity from its CONTENT: identical
 * content under identical configuration yields identical ids and
 * fingerprints, so replay is byte-identical by construction.
 */

export function researchHash(input: unknown): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex');
}

function prefixed(prefix: string): (input: unknown) => string {
  return (input: unknown) => `${prefix}_${researchHash(input).slice(0, 24)}`;
}

export const researchAnalysisId = prefixed('res');
export const memoryIdOf = prefixed('mem');
export const observationSourceId = (batchId: string, opportunityId: string): string =>
  `${batchId}:${opportunityId}`;
export const queryIdOf = prefixed('rqy');
export const comparisonIdOf = prefixed('cmp');
export const patternIdOf = prefixed('pat');
export const hypothesisIdOf = prefixed('hyp');
export const evidenceIdOf = prefixed('evd');
export const findingIdOf = prefixed('fnd');
export const rankingIdOf = prefixed('rnk');
export const feedbackIdOf = prefixed('fbk');
export const recommendationIdOf = prefixed('rec');
export const nodeIdOf = prefixed('node');
export const edgeIdOf = prefixed('edge');
export const auditEventIdOf = prefixed('revt');

export const contentFingerprintOf = prefixed('rcfp');
export const graphFingerprintOf = prefixed('rgrp');
export const memoryFingerprintOf = prefixed('rmem');
export const indexFingerprintOf = prefixed('ridx');
export const entityFingerprintOf = prefixed('rent');
export const lineageFingerprintOf = prefixed('rlnk');
export const analysisFingerprintOf = prefixed('rfp');

export {canonicalJson};
