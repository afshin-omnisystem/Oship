/**
 * SPRINT 038 — replay (§16).
 *
 * The engine runs its full pipeline twice per analysis; the two runs must be
 * byte-identical under canonical serialization. compareOpportunityResults
 * performs that comparison (and is reused by the REPLAY_BYTE_IDENTITY
 * invariant and the replay tests). Canonical JSON with sorted keys makes key
 * order irrelevant; deterministic construction makes everything else
 * reproducible.
 */

import type {OpportunityIntelligenceResult} from './types';
import {canonicalJson} from './ids';

export function serializeOpportunityResult(
  result: OpportunityIntelligenceResult,
): string {
  return canonicalJson(result);
}

export function compareOpportunityResults(
  a: OpportunityIntelligenceResult,
  b: OpportunityIntelligenceResult,
): boolean {
  return serializeOpportunityResult(a) === serializeOpportunityResult(b);
}
