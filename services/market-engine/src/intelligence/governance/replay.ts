/**
 * SPRINT 040 — replay and determinism (§17).
 *
 * The engine runs its full pipeline twice per governance run; the two runs
 * must be byte-identical under canonical serialization. Repeated execution
 * with identical decision result, policies, configuration and versions
 * reproduces the governance result and handoff package byte for byte.
 */

import type {GovernanceResult} from './types';
import {canonicalJson} from './ids';

export function serializeGovernanceResult(result: GovernanceResult): string {
  return canonicalJson(result);
}

export function compareGovernanceResults(
  a: GovernanceResult,
  b: GovernanceResult,
): boolean {
  return serializeGovernanceResult(a) === serializeGovernanceResult(b);
}
