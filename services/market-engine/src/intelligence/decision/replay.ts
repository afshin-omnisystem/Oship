/**
 * SPRINT 039 — replay and determinism (§25).
 *
 * The engine runs its full pipeline twice per analysis; the two runs must be
 * byte-identical under canonical serialization. Repeated execution with
 * identical input reproduces the Decision Context, alternative matrix,
 * counterfactual results, trade-off scores, dominance, recommendation,
 * explanation, research context and audit events — byte for byte.
 */

import type {DecisionIntelligenceResult} from './types';
import {canonicalJson} from './ids';

export function serializeDecisionResult(result: DecisionIntelligenceResult): string {
  return canonicalJson(result);
}

export function compareDecisionResults(
  a: DecisionIntelligenceResult,
  b: DecisionIntelligenceResult,
): boolean {
  return serializeDecisionResult(a) === serializeDecisionResult(b);
}
