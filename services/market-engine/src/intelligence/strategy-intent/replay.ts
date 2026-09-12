/**
 * SPRINT 041 — replay (§21).
 *
 * Given identical Governance Result, Decision Result, policy/version,
 * configuration and source versions, the generated StrategyIntent is
 * byte-identical. Serialization is canonical (key-order independent,
 * deterministic array order).
 */

import type {StrategyIntentResult} from './types';
import {IntentRejectionError} from './types';
import {canonicalJson} from './ids';

/** Canonical serialization of a strategy-intent result. */
export function serializeStrategyIntentResult(
  result: StrategyIntentResult,
): string {
  return canonicalJson(result);
}

/** Byte comparison of two results via canonical serialization. */
export function compareStrategyIntentResults(
  a: StrategyIntentResult,
  b: StrategyIntentResult,
): boolean {
  return serializeStrategyIntentResult(a)
    === serializeStrategyIntentResult(b);
}

/** Canonical serialization of the bare intent artifact. */
export function serializeStrategyIntent(
  intent: StrategyIntentResult['intent'],
): string {
  if (intent === null || typeof intent !== 'object') {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'a strategy intent artifact is required for serialization');
  }
  return canonicalJson(intent);
}
