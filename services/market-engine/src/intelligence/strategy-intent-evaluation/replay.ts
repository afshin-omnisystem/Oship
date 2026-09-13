/**
 * SPRINT 042 — serialization and replay (§19).
 *
 * Canonical, key-order-independent, byte-identical serialization.
 * Identical inputs always produce byte-identical evaluations; permuted
 * JSON keys deserialize to the same canonical bytes.
 */

import type {StrategyIntentEvaluationResult, EvaluationCoreResult,
  EvaluationInvariantSubject} from './types';
import {EvaluationRejectionError} from './types';
import {canonicalJson} from './ids';

type SerializableEvaluation = StrategyIntentEvaluationResult
  | EvaluationCoreResult | EvaluationInvariantSubject;

export function serializeStrategyIntentEvaluationResult(
  result: SerializableEvaluation,
): string {
  if (result === null || typeof result !== 'object') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'an evaluation result is required for serialization');
  }
  return canonicalJson(result);
}

export function serializeStrategyIntentEvaluation(
  evaluation: StrategyIntentEvaluationResult['evaluationContext']
    & Record<string, unknown>,
): string {
  if (evaluation === null || typeof evaluation !== 'object') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'an evaluation artifact is required for serialization');
  }
  return canonicalJson(evaluation);
}

export function compareStrategyIntentEvaluationResults(
  a: SerializableEvaluation,
  b: SerializableEvaluation,
): boolean {
  return serializeStrategyIntentEvaluationResult(a)
    === serializeStrategyIntentEvaluationResult(b);
}
