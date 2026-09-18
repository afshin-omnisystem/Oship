/**
 * SPRINT 042 — source validation (§1/§3/§18/§21).
 *
 * The evaluation consumes ONLY governed Sprint 041 outputs: immutable,
 * invariant-passing, replay-identical, audit-chained StrategyIntent
 * results. Anything else rejects fail closed.
 */

import type {
  StrategyIntentEvaluationInput, EvaluationConfigSpec,
} from './types';
import {EvaluationRejectionError} from './types';
import type {StrategyIntentResult} from '../strategy-intent/types';
import {verifyStrategyIntentAudit} from '../strategy-intent/audit';
import {intentResultFingerprintOf} from '../strategy-intent/ids';

// ---------------------------------------------------------------------------
// Envelope validation
// ---------------------------------------------------------------------------

export interface ValidatedEvaluationEnvelope {
  readonly annotations: readonly string[];
}

export function validateEvaluationEnvelope(
  input: StrategyIntentEvaluationInput,
  config: EvaluationConfigSpec,
): ValidatedEvaluationEnvelope {
  if (input === null || typeof input !== 'object') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'evaluation input required');
  }
  if (input.intentResult === null
    || typeof input.intentResult !== 'object') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'an intent result is required for evaluation');
  }
  if (!Array.isArray(input.annotations)) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'annotations must be an array');
  }
  for (const annotation of input.annotations) {
    if (typeof annotation !== 'string' || annotation.length === 0) {
      throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
        'annotations must be non-empty strings');
    }
  }
  if (input.annotations.length > config.maxAnnotations) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      `${String(input.annotations.length)} annotations exceed the `
        + `maximum of ${String(config.maxAnnotations)}`);
  }
  if (typeof input.timestamp !== 'number'
    || !Number.isFinite(input.timestamp)) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'timestamp must be a finite number');
  }
  if (typeof input.correlationId !== 'string'
    || input.correlationId.length === 0) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'correlationId is required');
  }
  if (typeof input.traceId !== 'string' || input.traceId.length === 0) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'traceId is required');
  }
  return {annotations: Object.freeze([...input.annotations].sort())};
}

// ---------------------------------------------------------------------------
// Intent source validation — only governed Sprint 041 results pass
// ---------------------------------------------------------------------------

export function validateIntentSource(
  intentResult: StrategyIntentResult,
): void {
  if (intentResult === null || typeof intentResult !== 'object') {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      'a strategy intent result is required');
  }
  if (intentResult.schemaVersion !== 'oship.strategy-intent.v1') {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      `unknown intent schema version `
        + `${String(intentResult.schemaVersion)}`);
  }
  if (!Object.isFrozen(intentResult) || !Object.isFrozen(intentResult.intent)
    || !Object.isFrozen(intentResult.alternatives)
    || !Object.isFrozen(intentResult.restrictions)
    || !Object.isFrozen(intentResult.auditEvents)) {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      'the intent result must be frozen (immutable)');
  }
  if (typeof intentResult.intentId !== 'string'
    || intentResult.intentId.length === 0
    || !intentResult.intentId.startsWith('sint_')) {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      'the intent result carries no intent id');
  }
  if (intentResult.invariants === null
    || intentResult.invariants.passed !== true) {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      'the intent failed its own invariants — refusing to evaluate');
  }
  if (intentResult.replay === null
    || intentResult.replay.identical !== true) {
    throw new EvaluationRejectionError('NONDETERMINISTIC_INPUT',
      'the intent result is not replay-identical');
  }
  if (intentResult.boundary === null
    || intentResult.boundary.state !== 'BOUNDARY_RESPECTED') {
    throw new EvaluationRejectionError('STRATEGY_BOUNDARY_VIOLATION',
      'the intent result violated its own strategy boundary');
  }
  if (!Array.isArray(intentResult.auditEvents)
    || intentResult.auditEvents.length === 0) {
    throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
      'the intent result carries no audit chain');
  }
  const verification = verifyStrategyIntentAudit(
    intentResult.auditEvents, intentResult.auditEvents.length);
  if (!verification.valid) {
    throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
      `intent audit chain rejected: ${verification.reason ?? 'unknown'}`);
  }
  const identity = intentResult.intent.auditIdentity;
  if (identity === null || identity.intentId !== intentResult.intentId) {
    throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
      'intent audit identity does not bind the intent id');
  }
  if (identity.eventCount !== intentResult.auditEvents.length) {
    // Sprint 041 appends lifecycle events after the anchored identity;
    // any count mismatch without the replay seal is tampering.
    const last = intentResult.auditEvents[
      intentResult.auditEvents.length - 1];
    if (last === undefined || last.eventType !== 'replay-completed') {
      throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
        'intent audit identity does not match the event chain');
    }
  }
  const anchored = intentResult.auditEvents[
    Math.min(identity.eventCount, intentResult.auditEvents.length) - 1];
  if (anchored === undefined || anchored.hash !== identity.headHash) {
    throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
      'intent audit identity head does not match the event chain');
  }
  // The whole-result fingerprint is recomputed from the intent content
  // (the raw role ranking Sprint 041 sealed, not the gated echo) — a
  // forged or substituted fingerprint rejects fail closed.
  const preferred = intentResult.alternatives.find((alternative) =>
    alternative.role === 'PREFERRED') ?? null;
  const secondary = intentResult.alternatives
    .filter((alternative) => alternative.role === 'SECONDARY')
    .sort((a, b) => {
      const aRank = a.rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.alternativeId < b.alternativeId ? -1 : 1;
    })
    .slice(0, 8)
    .map((alternative) => alternative.alternativeId);
  const expectedFingerprint = intentResultFingerprintOf({
    intentId: intentResult.intentId,
    classification: intentResult.classification,
    priority: intentResult.priority,
    restrictions: intentResult.restrictions.map((restriction) =>
      restriction.code),
    preferredAlternativeId: preferred === null
      ? null : preferred.alternativeId,
    acceptableAlternativeIds: [
      ...(preferred === null ? [] : [preferred.alternativeId]),
      ...secondary,
    ],
    objectiveClass: intentResult.intent.objective.objectiveClass,
  });
  if (intentResult.intentFingerprint !== expectedFingerprint) {
    throw new EvaluationRejectionError('INVALID_INTENT_SOURCE',
      'the intent fingerprint does not match the intent content — '
        + 'the result was mutated after sealing');
  }
}

// ---------------------------------------------------------------------------
// Provenance validation (§18) — no anonymous evaluations
// ---------------------------------------------------------------------------

export function validateIntentProvenance(
  intentResult: StrategyIntentResult,
): void {
  const provenance = intentResult.intent.provenance;
  if (provenance === null || typeof provenance !== 'object') {
    throw new EvaluationRejectionError('MISSING_PROVENANCE',
      'the intent carries no provenance');
  }
  for (const [label, value] of [
    ['opportunityId', provenance.opportunityId],
    ['decisionContextId', provenance.decisionContextId],
    ['decisionId', provenance.decisionId],
    ['governanceContextId', provenance.governanceContextId],
    ['governanceId', provenance.governanceId],
    ['handoffId', provenance.handoffId],
    ['strategyInputId', provenance.strategyInputId],
    ['intentId', provenance.intentId],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new EvaluationRejectionError('MISSING_PROVENANCE',
        `provenance ${label} is missing`);
    }
  }
  if (provenance.intentId !== intentResult.intentId
    || intentResult.context.intentId !== intentResult.intentId) {
    throw new EvaluationRejectionError('INVALID_PROVENANCE',
      'provenance intent id does not match the evaluated intent');
  }
  if (provenance.decisionId !== intentResult.context.decisionId
    || provenance.governanceId !== intentResult.context.governanceId
    || provenance.opportunityId !== intentResult.context.opportunityId) {
    throw new EvaluationRejectionError('INVALID_PROVENANCE',
      'provenance chain does not match the intent context');
  }
  const versions = provenance.sourceVersions;
  if (versions.decisionIntelligenceVersion
    !== 'oship.decision-intelligence.engine.v1'
    || versions.governanceVersion !== 'oship.decision-governance.engine.v1'
    || versions.intentVersion !== 'oship.strategy-intent.engine.v1'
    || versions.decisionAnalysisId !== provenance.decisionId
    || versions.governanceId !== provenance.governanceId) {
    throw new EvaluationRejectionError('INVALID_PROVENANCE',
      'provenance source versions are not the governed engine versions');
  }
  if (versions.governancePolicyVersion
    !== 'decision-governance.policy.v1') {
    throw new EvaluationRejectionError('POLICY_VIOLATION',
      `unknown governance policy version `
        + `${String(versions.governancePolicyVersion)}`);
  }
}
