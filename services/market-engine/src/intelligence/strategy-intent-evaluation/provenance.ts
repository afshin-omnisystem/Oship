/**
 * SPRINT 042 — provenance (§18).
 *
 * Every evaluation preserves the full chain
 * Opportunity → Intelligence → Decision → Governance → StrategyIntent
 * → Evaluation with deterministic identifiers and pinned versions.
 * No anonymous evaluation objects.
 */

import type {
  StrategyIntentResult, EvaluationProvenance,
  EvaluationSourceVersions,
} from './types';
import {EVALUATION_ENGINE_VERSION, EvaluationRejectionError}
  from './types';
import {evaluationProvenanceIdOf} from './ids';

export function buildEvaluationProvenance(
  intentResult: StrategyIntentResult,
  evaluationId: string,
): EvaluationProvenance {
  const intentProvenance = intentResult.intent.provenance;
  const sourceVersions: EvaluationSourceVersions = {
    decisionIntelligenceVersion:
      intentProvenance.sourceVersions.decisionIntelligenceVersion,
    decisionAnalysisId: intentProvenance.sourceVersions.decisionAnalysisId,
    governanceVersion: intentProvenance.sourceVersions.governanceVersion,
    governanceId: intentProvenance.sourceVersions.governanceId,
    governancePolicyVersion:
      intentProvenance.sourceVersions.governancePolicyVersion,
    intentVersion: intentProvenance.sourceVersions.intentVersion,
    intentId: intentResult.intentId,
    evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
  };
  for (const [label, value] of Object.entries(sourceVersions)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new EvaluationRejectionError('MISSING_PROVENANCE',
        `provenance source version ${label} is missing`);
    }
  }
  const core = {
    opportunityId: intentProvenance.opportunityId,
    decisionContextId: intentProvenance.decisionContextId,
    decisionId: intentProvenance.decisionId,
    governanceContextId: intentProvenance.governanceContextId,
    governanceId: intentProvenance.governanceId,
    handoffId: intentProvenance.handoffId,
    strategyInputId: intentProvenance.strategyInputId,
    intentId: intentResult.intentId,
    evaluationId,
    sourceVersions,
    informational: true as const,
  };
  return Object.freeze({
    ...core,
    provenanceId: evaluationProvenanceIdOf(core),
  });
}
