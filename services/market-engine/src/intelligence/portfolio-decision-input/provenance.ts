/**
 * SPRINT 043 — provenance chain (§11/§16).
 *
 * Opportunity → Decision → Governance → StrategyIntent →
 * StrategyIntentEvaluation → PortfolioDecisionInput. The bridge is the
 * sixth link only. No anonymous inputs, no orphan steps, no
 * substitution — every upstream id is carried and re-verified.
 */

import type {StrategyIntentEvaluationResult, InputProvenance,
} from './types';
import {InputRejectionError, PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
} from './types';
import {inputProvenanceIdOf} from './ids';

export function buildInputProvenance(
  evaluation: StrategyIntentEvaluationResult,
  inputId: string,
): InputProvenance {
  const source = evaluation.provenance;
  const context = evaluation.evaluationContext;

  // --- No orphans: every chain id must be present ------------------------
  for (const [label, value] of [
    ['opportunityId', source.opportunityId],
    ['decisionContextId', source.decisionContextId],
    ['decisionId', source.decisionId],
    ['governanceContextId', source.governanceContextId],
    ['governanceId', source.governanceId],
    ['handoffId', source.handoffId],
    ['strategyInputId', source.strategyInputId],
    ['intentId', source.intentId],
    ['evaluationId', source.evaluationId],
    ['inputId', inputId],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new InputRejectionError('MISSING_PROVENANCE',
        `provenance ${label} is missing — no orphan steps are allowed`);
    }
  }

  // --- No substitution: carried ids must equal the evaluation's ----------
  if (source.evaluationId !== evaluation.evaluationId
    || source.intentId !== evaluation.intentId
    || source.decisionId !== context.decisionId
    || source.governanceId !== context.governanceId
    || source.opportunityId !== context.opportunityId) {
    throw new InputRejectionError('PROVENANCE_SUBSTITUTION',
      'the evaluation provenance does not bind the evaluation — '
        + 'substitution fails closed');
  }

  return Object.freeze({
    provenanceId: inputProvenanceIdOf({
      opportunityId: source.opportunityId,
      decisionContextId: source.decisionContextId,
      decisionId: source.decisionId,
      governanceContextId: source.governanceContextId,
      governanceId: source.governanceId,
      handoffId: source.handoffId,
      strategyInputId: source.strategyInputId,
      intentId: source.intentId,
      evaluationId: source.evaluationId,
      inputId,
    }),
    opportunityId: source.opportunityId,
    decisionContextId: source.decisionContextId,
    decisionId: source.decisionId,
    governanceContextId: source.governanceContextId,
    governanceId: source.governanceId,
    handoffId: source.handoffId,
    strategyInputId: source.strategyInputId,
    intentId: source.intentId,
    evaluationId: source.evaluationId,
    inputId,
    sourceVersions: Object.freeze({
      decisionIntelligenceVersion:
        source.sourceVersions.decisionIntelligenceVersion,
      decisionAnalysisId: source.sourceVersions.decisionAnalysisId,
      governanceVersion: source.sourceVersions.governanceVersion,
      governanceId: source.sourceVersions.governanceId,
      governancePolicyVersion:
        source.sourceVersions.governancePolicyVersion,
      intentVersion: source.sourceVersions.intentVersion,
      intentId: source.sourceVersions.intentId,
      evaluationVersion: source.sourceVersions.evaluationEngineVersion,
      evaluationId: source.evaluationId,
      bridgeVersion: PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
    }),
    informational: true as const,
  });
}

/** §11 — verification used by tests and invariants. */
export function verifyInputProvenance(
  provenance: InputProvenance,
  expectedEvaluation: StrategyIntentEvaluationResult,
): {verified: boolean; reason?: string} {
  const context = expectedEvaluation.evaluationContext;
  if (provenance.evaluationId
    !== expectedEvaluation.evaluationId) {
    return {verified: false, reason: 'evaluation id substitution'};
  }
  if (provenance.intentId !== expectedEvaluation.intentId) {
    return {verified: false, reason: 'intent id substitution'};
  }
  if (provenance.decisionId !== context.decisionId
    || provenance.governanceId !== context.governanceId
    || provenance.opportunityId !== context.opportunityId) {
    return {verified: false, reason: 'context id substitution'};
  }
  if (provenance.sourceVersions.bridgeVersion
    !== PORTFOLIO_DECISION_INPUT_ENGINE_VERSION) {
    return {verified: false, reason: 'bridge version not pinned'};
  }
  if (provenance.sourceVersions.evaluationVersion
    !== 'oship.strategy-intent-evaluation.engine.v1') {
    return {verified: false, reason: 'evaluation version not pinned'};
  }
  return {verified: true};
}
