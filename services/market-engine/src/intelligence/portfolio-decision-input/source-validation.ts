/**
 * SPRINT 043 — source validation (§6 lifecycle step 1, §16, §20).
 *
 * The bridge consumes ONLY governed Sprint 042 outputs: immutable,
 * invariant-passing, replay-identical, audit-chained
 * StrategyIntentEvaluation results whose whole-result fingerprint
 * verifies. Anything else rejects fail closed.
 */

import type {PortfolioDecisionInputInput,
  PortfolioDecisionInputConfigSpec,
} from './types';
import {InputRejectionError} from './types';
import type {StrategyIntentEvaluationResult} from '../strategy-intent-evaluation/types';
import {verifyStrategyIntentEvaluationAudit,
  verifyEvaluationAuditBinding,
} from '../strategy-intent-evaluation/audit';
import {evaluationFingerprintOf} from '../strategy-intent-evaluation/ids';

// ---------------------------------------------------------------------------
// Envelope validation
// ---------------------------------------------------------------------------

export interface ValidatedInputEnvelope {
  readonly annotations: readonly string[];
  readonly constraints: readonly unknown[];
}

export function validateInputEnvelope(
  input: PortfolioDecisionInputInput,
  config: PortfolioDecisionInputConfigSpec,
): ValidatedInputEnvelope {
  if (input === null || typeof input !== 'object') {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'bridge input required');
  }
  if (input.evaluationResult === null
    || input.evaluationResult === undefined) {
    throw new InputRejectionError('MISSING_EVALUATION',
      'a strategy intent evaluation result is required');
  }
  if (typeof input.evaluationResult !== 'object') {
    throw new InputRejectionError('MISSING_EVALUATION',
      'the evaluation result must be an object');
  }
  if (!Array.isArray(input.annotations)) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'annotations must be an array');
  }
  for (const annotation of input.annotations) {
    if (typeof annotation !== 'string' || annotation.length === 0) {
      throw new InputRejectionError('INVALID_INPUT_CONTEXT',
        'annotations must be non-empty strings');
    }
  }
  if (input.annotations.length > config.maxAnnotations) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      `${String(input.annotations.length)} annotations exceed the `
        + `maximum of ${String(config.maxAnnotations)}`);
  }
  if (!Array.isArray(input.capitalConstraints)) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'capitalConstraints must be an array');
  }
  if (input.capitalConstraints.length > config.maxCapitalConstraints) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      `${String(input.capitalConstraints.length)} constraints exceed `
        + `the maximum of ${String(config.maxCapitalConstraints)}`);
  }
  if (typeof input.timestamp !== 'number'
    || !Number.isFinite(input.timestamp)) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'timestamp must be a finite number');
  }
  if (typeof input.correlationId !== 'string'
    || input.correlationId.length === 0) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'correlationId is required');
  }
  if (typeof input.traceId !== 'string'
    || input.traceId.length === 0) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'traceId is required');
  }
  return {
    annotations: Object.freeze([...input.annotations].sort()),
    constraints: [...input.capitalConstraints],
  };
}

// ---------------------------------------------------------------------------
// Evaluation source validation — only governed Sprint 042 results pass
// ---------------------------------------------------------------------------

export function validateEvaluationSource(
  evaluation: StrategyIntentEvaluationResult,
): void {
  if (evaluation === null || typeof evaluation !== 'object') {
    throw new InputRejectionError('MISSING_EVALUATION',
      'a strategy intent evaluation result is required');
  }
  if (evaluation.schemaVersion
    !== 'oship.strategy-intent-evaluation.v1') {
    throw new InputRejectionError('INVALID_EVALUATION',
      `unknown evaluation schema version `
        + `${String(evaluation.schemaVersion)}`);
  }
  if (!Object.isFrozen(evaluation)
    || !Object.isFrozen(evaluation.restrictions)
    || !Object.isFrozen(evaluation.auditEvents)
    || !Object.isFrozen(evaluation.evaluationContext)) {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation result must be frozen (immutable)');
  }
  if (typeof evaluation.evaluationId !== 'string'
    || evaluation.evaluationId.length === 0
    || !evaluation.evaluationId.startsWith('eval_')) {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation result carries no evaluation id');
  }
  if (evaluation.invariants === null
    || evaluation.invariants.passed !== true) {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation failed its own invariants — refusing to bridge');
  }
  if (evaluation.replay === null
    || evaluation.replay.identical !== true) {
    throw new InputRejectionError('NONDETERMINISTIC_INPUT',
      'the evaluation result is not replay-identical');
  }
  if (evaluation.boundary === null
    || evaluation.boundary.state !== 'BOUNDARY_RESPECTED') {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation result violated its own bridge boundary');
  }
  if (evaluation.informational !== true
    || evaluation.downstreamDecides !== true) {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation must be informational with downstreamDecides');
  }

  // --- Audit chain -------------------------------------------------------
  if (!Array.isArray(evaluation.auditEvents)
    || evaluation.auditEvents.length === 0) {
    throw new InputRejectionError('AUDIT_VIOLATION',
      'the evaluation result carries no audit chain');
  }
  const verdict = verifyStrategyIntentEvaluationAudit(
    evaluation.auditEvents, evaluation.auditEvents.length);
  if (!verdict.valid) {
    throw new InputRejectionError('AUDIT_VIOLATION',
      `evaluation audit chain rejected: ${verdict.reason ?? 'unknown'}`);
  }
  const identity = evaluation.auditIdentity;
  if (identity === null
    || identity.evaluationId !== evaluation.evaluationId) {
    throw new InputRejectionError('EVALUATION_MISMATCH',
      'evaluation audit identity does not bind the evaluation id');
  }
  const anchored = evaluation.auditEvents[
    Math.min(identity.eventCount, evaluation.auditEvents.length) - 1];
  if (anchored === undefined || anchored.hash !== identity.headHash) {
    throw new InputRejectionError('EVALUATION_MISMATCH',
      'evaluation audit identity head does not match the event chain');
  }
  const binding = verifyEvaluationAuditBinding(evaluation.auditEvents, {
    evaluationId: evaluation.evaluationId,
    intentId: evaluation.intentId,
    classification: evaluation.classification,
    eligibility: evaluation.eligibility,
  });
  if (!binding.valid) {
    throw new InputRejectionError('EVALUATION_MISMATCH',
      `evaluation audit binding rejected: `
        + `${binding.reason ?? 'unknown'}`);
  }

  // --- Whole-result fingerprint seal (mutation after sealing) -----------
  const expectedFingerprint = evaluationFingerprintOf({
    evaluationId: evaluation.evaluationId,
    classification: evaluation.classification,
    eligibility: evaluation.eligibility,
    preferredAlternativeId: evaluation.preferredAlternativeId,
    acceptableAlternativeIds: evaluation.acceptableAlternativeIds,
    restrictionCodes: evaluation.restrictions.map((restriction) =>
      restriction.code),
    researchClasses: evaluation.research.requirements.map(
      (requirement) => requirement.researchClass),
    dimensionStates: evaluation.dimensions.map((dimension) =>
      dimension.state),
  });
  if (evaluation.evaluationFingerprint !== expectedFingerprint) {
    throw new InputRejectionError('INVALID_EVALUATION',
      'the evaluation fingerprint does not match the evaluation '
        + 'content — the result was mutated after sealing');
  }

  // --- Context binding ----------------------------------------------------
  const context = evaluation.evaluationContext;
  if (context.evaluationId !== evaluation.evaluationId
    || context.intentId !== evaluation.intentId) {
    throw new InputRejectionError('EVALUATION_MISMATCH',
      'the evaluation context does not bind the evaluation identity');
  }
}

// ---------------------------------------------------------------------------
// Provenance validation (§16) — no anonymous inputs, no substitution
// ---------------------------------------------------------------------------

export function validateEvaluationProvenance(
  evaluation: StrategyIntentEvaluationResult,
): void {
  const provenance = evaluation.provenance;
  if (provenance === null || typeof provenance !== 'object') {
    throw new InputRejectionError('MISSING_PROVENANCE',
      'the evaluation carries no provenance');
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
    ['evaluationId', provenance.evaluationId],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new InputRejectionError('MISSING_PROVENANCE',
        `provenance ${label} is missing`);
    }
  }
  if (provenance.evaluationId !== evaluation.evaluationId) {
    throw new InputRejectionError('PROVENANCE_SUBSTITUTION',
      'the evaluation provenance belongs to a different evaluation — '
        + 'substitution fails closed');
  }
  if (provenance.intentId !== evaluation.intentId
    || provenance.intentId
      !== evaluation.evaluationContext.intentId) {
    throw new InputRejectionError('PROVENANCE_SUBSTITUTION',
      'the evaluation provenance does not bind the evaluated intent');
  }
  const context = evaluation.evaluationContext;
  if (provenance.decisionId !== context.decisionId
    || provenance.governanceId !== context.governanceId
    || provenance.opportunityId !== context.opportunityId) {
    throw new InputRejectionError('INVALID_PROVENANCE',
      'the evaluation provenance chain does not match its context');
  }
  const versions = provenance.sourceVersions;
  if (versions.decisionIntelligenceVersion
    !== 'oship.decision-intelligence.engine.v1'
    || versions.governanceVersion
      !== 'oship.decision-governance.engine.v1'
    || versions.intentVersion !== 'oship.strategy-intent.engine.v1'
    || versions.decisionAnalysisId !== provenance.decisionId
    || versions.governanceId !== provenance.governanceId) {
    throw new InputRejectionError('INVALID_PROVENANCE',
      'the evaluation provenance versions are not pinned correctly');
  }
}
