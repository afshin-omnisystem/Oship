/**
 * SPRINT 043 — serialization and replay (§17/§18).
 *
 * Canonical, key-order-independent, byte-identical serialization.
 * Identical inputs always produce byte-identical contracts; permuted
 * JSON keys deserialize to the same canonical bytes.
 */

import type {PortfolioDecisionInput, InputCoreResult,
  InputInvariantSubject,
} from './types';
import {InputRejectionError} from './types';
import {canonicalJson} from './ids';

type SerializableInput = PortfolioDecisionInput | InputCoreResult
  | InputInvariantSubject;

export function serializePortfolioDecisionInput(
  result: SerializableInput,
): string {
  if (result === null || typeof result !== 'object') {
    throw new InputRejectionError('SERIALIZATION_VIOLATION',
      'an input result is required for serialization');
  }
  return canonicalJson(result);
}

export function comparePortfolioDecisionInputs(
  a: SerializableInput,
  b: SerializableInput,
): boolean {
  return serializePortfolioDecisionInput(a)
    === serializePortfolioDecisionInput(b);
}
