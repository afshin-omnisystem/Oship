/**
 * SPRINT 042 — Unified Strategy-Intent Evaluation & Portfolio Decision
 * Bridge engine.
 *
 * Given an immutable Sprint 041 StrategyIntent, produce an immutable
 * StrategyIntentEvaluation answering: "Is this StrategyIntent
 * sufficiently supported, constrained, comparable, fresh, stable and
 * structurally valid to be considered by the existing downstream
 * Portfolio/Risk/Allocation decision plane?"
 *
 * THE ENGINE IS AN ANALYTICAL DECISION BRIDGE. It never allocates
 * capital, computes authoritative weights, reserves capital, modifies
 * positions, creates orders or execution plans, calls Treasury or AEGIS,
 * accesses provider credentials or exchange/sportsbook APIs, or mutates
 * Portfolio, Risk, Allocation, Strategy, OIIN, Research or Learning
 * state. Output is an analytical eligibility package only.
 */

import type {
  StrategyIntentEvaluationInput, StrategyIntentEvaluationResult,
  EvaluationConfigInput, EvaluationConfigSpec, EvaluationCoreResult,
  EvaluationInvariantSubject,
} from './types';
import {
  EvaluationRejectionError, EvaluationInvariantError,
  EVALUATION_DISCLAIMER, ELIGIBILITY_MEANING, EVALUATION_SCHEMA_VERSION,
  EVALUATION_ENGINE_VERSION,
} from './types';
import {validateEvaluationEnvelope, validateIntentSource,
  validateIntentProvenance} from './source-validation';
import {validateIntentIntegrity} from './intent-integrity';
import {scanEvaluationAnnotations, scanEvaluationNarratives,
  evaluationNarrativeOf} from './safety-validation';
import {evaluateEvidenceGate, evaluateComparabilityGate,
  evaluateFreshnessGate, evaluateStabilityGate, evaluateDependencyGate}
  from './gates';
import {analyzeRestrictions} from './restriction-analysis';
import {checkPortfolioInterfaceCompatibility, portfolioInterfaceGate,
  checkEvaluationBoundary} from './portfolio-interface';
import {evaluateDimensions} from './dimensions';
import {classifyEvaluation} from './classification';
import {assignDownstreamEligibility, eligibilityAllowsAlternatives}
  from './eligibility';
import {deriveEvaluationResearch, buildEvaluationResearchContext}
  from './research';
import {buildEvaluationFeedback} from './feedback';
import {buildEvaluationExplanation} from './explanation';
import {buildEvaluationProvenance} from './provenance';
import {compareStrategyIntentEvaluationResults,
  serializeStrategyIntentEvaluationResult} from './replay';
import {StrategyIntentEvaluationAuditLog,
  verifyStrategyIntentEvaluationAudit, evaluationAuditIdentityOf}
  from './audit';
import {checkEvaluationInvariants} from './invariants';
import {mergeEvaluationConfig} from './config';
import {canonicalJson, evaluationIdOf, evaluationContextIdOf,
  evaluationFingerprintOf, evaluationConfigFingerprint} from './ids';

export class StrategyIntentEvaluationEngine {
  private readonly config: EvaluationConfigSpec;

  constructor(config?: EvaluationConfigInput) {
    this.config = mergeEvaluationConfig(config);
  }

  get configuration(): EvaluationConfigSpec {
    return this.config;
  }

  get configurationFingerprint(): string {
    return evaluationConfigFingerprint(this.config);
  }

  /**
   * §19 replay — re-run the evaluation over a validated input and
   * compare byte-for-byte with a recorded serialized result. Mismatches
   * are reported, never thrown, so replays stay observable.
   */
  replay(input: StrategyIntentEvaluationInput,
    expectedSerialized: string): {
    readonly replayed: true;
    readonly replayMatches: boolean;
    readonly result: StrategyIntentEvaluationResult;
    readonly actualFingerprint: string;
  } {
    const result = this.evaluate(input);
    const actualSerialized
      = serializeStrategyIntentEvaluationResult(result);
    return Object.freeze({
      replayed: true as const,
      replayMatches: actualSerialized === expectedSerialized,
      result,
      actualFingerprint: result.evaluationFingerprint,
    });
  }

  evaluate(input: StrategyIntentEvaluationInput):
    StrategyIntentEvaluationResult {
    const first = this.runCore(input);
    const second = this.runCore(input);
    if (!compareStrategyIntentEvaluationResults(first.result,
      second.result)
      || canonicalJson(first.audit.snapshot())
        !== canonicalJson(second.audit.snapshot())) {
      throw new EvaluationRejectionError('SERIALIZATION_INCONSISTENCY',
        'the evaluation pipeline is not byte-identical across runs');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: second.result.evaluationFingerprint,
    });
    const withReplay: EvaluationInvariantSubject = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true,
        fingerprint: second.result.evaluationFingerprint,
      }),
    });
    const invariants = checkEvaluationInvariants(withReplay, {
      input, config: this.config,
    });
    if (!invariants.passed) {
      throw new EvaluationInvariantError(
        invariants.checks.filter((check) => !check.passed)
          .map((check) => check.invariant).join(', '));
    }
    const result: StrategyIntentEvaluationResult = Object.freeze(
      {...withReplay, invariants});
    return result;
  }

  private runCore(input: StrategyIntentEvaluationInput): {
    result: EvaluationCoreResult;
    audit: StrategyIntentEvaluationAuditLog;
  } {
    const config = this.config;
    const envelope = validateEvaluationEnvelope(input, config);
    const intentResult = input.intentResult;
    validateIntentSource(intentResult);
    validateIntentProvenance(intentResult);

    // ---- Gates (§4 lifecycle) --------------------------------------------
    const integrityGate = validateIntentIntegrity(intentResult);
    scanEvaluationAnnotations(envelope.annotations);
    const safetyGate = Object.freeze({
      gate: 'safety' as const,
      state: 'PASS' as const,
      detail: 'requester annotations and evaluation narratives carry no '
        + 'prediction, future-value, guarantee, execution, treasury, '
        + 'portfolio, risk, allocation, authority or policy semantics',
      reasons: Object.freeze([
        `${String(envelope.annotations.length)} annotations scanned`,
        'the intent disclaimer is the canonical verbatim text',
      ]),
    });
    const comparabilityGate = evaluateComparabilityGate(intentResult);
    const evidenceGate = evaluateEvidenceGate(intentResult);
    const freshnessGate = evaluateFreshnessGate(intentResult);
    const stabilityGate = evaluateStabilityGate(intentResult);
    const dependencyGate = evaluateDependencyGate(intentResult);
    const portfolioGate = portfolioInterfaceGate(intentResult);
    const compatibility = checkPortfolioInterfaceCompatibility(
      intentResult);
    const gates = Object.freeze([integrityGate, evidenceGate, safetyGate,
      comparabilityGate, freshnessGate, stabilityGate, dependencyGate,
      portfolioGate]);

    // ---- Restriction analysis (§16) ---------------------------------------
    const restrictions = analyzeRestrictions(intentResult);

    // ---- Classification and eligibility (§8/§9) ---------------------------
    const classification = classifyEvaluation(intentResult, gates);
    const eligibility = assignDownstreamEligibility(
      classification.classification);
    const surfacesAlternatives = eligibilityAllowsAlternatives(
      eligibility.eligibility);
    const preferredAlternativeId = surfacesAlternatives
      ? intentResult.preferredAlternativeId : null;
    const acceptableAlternativeIds = surfacesAlternatives
      ? intentResult.acceptableAlternativeIds : Object.freeze([]);

    // ---- Research requirements (§4 lifecycle) ------------------------------
    const researchRequirements = deriveEvaluationResearch(intentResult,
      classification.classification, config);

    // ---- Identity (§19: content-derived, timestamp-free) -------------------
    const evaluationId = evaluationIdOf({
      intentId: intentResult.intentId,
      intentFingerprint: intentResult.intentFingerprint,
      intentClassification: intentResult.classification,
      evaluationClassification: classification.classification,
      eligibility: eligibility.eligibility,
      preferredAlternativeId,
      acceptableAlternativeIds,
      restrictionCodes: restrictions.map((restriction) =>
        restriction.code),
      researchClasses: researchRequirements.map((requirement) =>
        requirement.researchClass),
      gateStates: gates.map((gate) => gate.state),
      configurationFingerprint: canonicalJson(config),
    });

    // ---- Context, provenance, dimensions, explanation, feedback ------------
    const evaluationContext = Object.freeze({
      contextId: evaluationContextIdOf({
        evaluationId,
        intentId: intentResult.intentId,
        governanceId: intentResult.context.governanceId,
        decisionId: intentResult.context.decisionId,
        domain: intentResult.context.domain,
      }),
      evaluationId,
      intentId: intentResult.intentId,
      governanceId: intentResult.context.governanceId,
      decisionId: intentResult.context.decisionId,
      opportunityId: intentResult.context.opportunityId,
      domain: intentResult.context.domain,
      opportunityClass: intentResult.context.opportunityClass,
      evidenceState: intentResult.context.evidenceState,
      stabilityState: intentResult.context.stabilityState,
      freshnessState: intentResult.context.freshnessState,
      comparability: intentResult.context.comparability,
      dependencyState: intentResult.context.dependencyState,
      historicalEvidenceCount: intentResult.context.historicalEvidenceCount,
      researchGapCount: intentResult.context.researchGapCount,
      unresolvedConflictCount:
        intentResult.context.unresolvedConflicts.length,
      intentRestrictionCodes: Object.freeze(
        intentResult.restrictions.map((restriction) => restriction.code)),
      informational: true as const,
      contentFingerprint: intentResult.context.contentFingerprint,
    });

    const researchFinal = buildEvaluationResearchContext(evaluationId,
      researchRequirements);
    const provenance = buildEvaluationProvenance(intentResult,
      evaluationId);
    const dimensions = evaluateDimensions({
      intentResult, config, evaluationId,
      portfolioCompatible: compatibility.compatible,
      normalizationRequired: compatibility.normalizationRequired,
    });
    const explanation = buildEvaluationExplanation({
      intentResult,
      classification: classification.classification,
      classificationReasons: classification.reasons,
      eligibility: eligibility.eligibility,
      eligibilityReasons: eligibility.reasons,
      dimensions,
      restrictions,
      research: researchFinal,
      provenance,
    });
    const feedback = buildEvaluationFeedback({
      evaluationId,
      intentId: intentResult.intentId,
      classification: classification.classification,
      eligibility: eligibility.eligibility,
      dependencyState: intentResult.dependencies.state,
      research: researchFinal,
      intentRestrictionCount: intentResult.restrictions.length,
      totalRestrictionCount: restrictions.length,
      acceptableAlternativeIds,
      evidenceGapCount: intentResult.context.researchGapCount,
    });

    // ---- Audit (§20) --------------------------------------------------------
    const audit = new StrategyIntentEvaluationAuditLog(evaluationId,
      input.timestamp);
    audit.append('evaluation-started', {
      intentId: intentResult.intentId,
      correlationId: input.correlationId,
    });
    audit.append('intent-verified', {
      intentId: intentResult.intentId,
      intentFingerprint: intentResult.intentFingerprint,
    });
    audit.append('integrity-validated', {
      state: integrityGate.state, gate: integrityGate.gate,
    });
    audit.append('evidence-validated', {
      state: evidenceGate.state, gate: evidenceGate.gate,
    });
    audit.append('safety-validated', {
      state: safetyGate.state, gate: safetyGate.gate,
    });
    audit.append('comparability-validated', {
      state: comparabilityGate.state, gate: comparabilityGate.gate,
    });
    audit.append('freshness-validated', {
      state: freshnessGate.state, gate: freshnessGate.gate,
    });
    audit.append('stability-validated', {
      state: stabilityGate.state, gate: stabilityGate.gate,
    });
    audit.append('dependencies-validated', {
      state: dependencyGate.state, gate: dependencyGate.gate,
      dependencyState: intentResult.dependencies.state,
    });
    audit.append('restrictions-analyzed', {
      codes: restrictions.map((restriction) => restriction.code),
    });
    audit.append('portfolio-interface-checked', {
      state: portfolioGate.state,
      domain: compatibility.domain,
      alternativeCount: compatibility.alternativeCount,
    });
    audit.append('dimensions-evaluated', {
      dimensions: dimensions.map((dimension) => dimension.dimension),
      states: dimensions.map((dimension) => dimension.state),
    });
    audit.append('classification-assigned', {
      classification: classification.classification,
    });
    audit.append('eligibility-assigned', {
      eligibility: eligibility.eligibility,
    });
    audit.append('research-escalated', {
      classes: researchFinal.requirements.map((requirement) =>
        requirement.researchClass),
    });
    for (const record of feedback) {
      audit.append('feedback-recorded', {kind: record.kind});
    }
    audit.append('explanation-built', {
      explanationId: explanation.explanationId,
    });
    audit.append('evaluation-built', {
      evaluationId,
      classification: classification.classification,
      eligibility: eligibility.eligibility,
    });
    const auditVerification = verifyStrategyIntentEvaluationAudit(
      audit.snapshot());
    if (!auditVerification.valid) {
      throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
        `the evaluation audit chain is invalid: `
          + `${auditVerification.reason ?? 'unknown'}`);
    }
    const auditIdentity = evaluationAuditIdentityOf(evaluationId,
      audit.length, audit.headHash);

    // ---- Boundary (§6) --------------------------------------------------------
    const draft: Omit<StrategyIntentEvaluationResult, 'auditEvents'
      | 'invariants' | 'replay'> = {
      evaluationId,
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      timestamp: input.timestamp,
      correlationId: input.correlationId,
      traceId: input.traceId,
      intentId: intentResult.intentId,
      intentFingerprint: intentResult.intentFingerprint,
      intentClassification: intentResult.classification,
      evaluationContext,
      gates,
      dimensions,
      classification: classification.classification,
      classificationReasons: classification.reasons,
      eligibility: eligibility.eligibility,
      eligibilityReasons: eligibility.reasons,
      eligibilityMeaning: ELIGIBILITY_MEANING,
      preferredAlternativeId,
      acceptableAlternativeIds,
      restrictions,
      research: researchFinal,
      feedback,
      explanation,
      provenance,
      boundary: {
        boundaryId: '', state: 'BOUNDARY_RESPECTED', checks: [],
        protectedAuthorities: [], informational: true,
      } as StrategyIntentEvaluationResult['boundary'],
      annotations: envelope.annotations,
      auditIdentity,
      evaluationFingerprint: evaluationFingerprintOf({
        evaluationId,
        classification: classification.classification,
        eligibility: eligibility.eligibility,
        preferredAlternativeId,
        acceptableAlternativeIds,
        restrictionCodes: restrictions.map((restriction) =>
          restriction.code),
        researchClasses: researchFinal.requirements.map((requirement) =>
          requirement.researchClass),
        dimensionStates: dimensions.map((dimension) => dimension.state),
      }),
      informational: true,
      downstreamDecides: true,
      disclaimer: EVALUATION_DISCLAIMER,
    };
    scanEvaluationNarratives(evaluationNarrativeOf({
      classificationReasons: classification.reasons,
      eligibilityReasons: eligibility.reasons,
      dimensionDetails: dimensions.map((dimension) => dimension.detail),
      restrictionReasons: restrictions.map((r) => r.reason),
      researchRationales: researchFinal.requirements.map(
        (r) => r.rationale),
      explanationSummaries: [
        ...explanation.classificationSummary,
        ...explanation.eligibilityRationale,
        ...explanation.semanticLimitations,
      ],
    }));
    const boundary = checkEvaluationBoundary({
      serializedEvaluation: canonicalJson({
        ...draft,
        boundary: undefined,
      }),
      narrative: evaluationNarrativeOf({
        classificationReasons: classification.reasons,
        eligibilityReasons: eligibility.reasons,
        dimensionDetails: dimensions.map((dimension) => dimension.detail),
        restrictionReasons: restrictions.map((r) => r.reason),
        researchRationales: researchFinal.requirements.map(
          (r) => r.rationale),
      }),
      informational: draft.informational,
      downstreamDecides: draft.downstreamDecides,
      evaluationId,
    });

    const result: EvaluationCoreResult = Object.freeze({
      ...draft,
      boundary,
      evaluationFingerprint: evaluationFingerprintOf({
        evaluationId,
        classification: classification.classification,
        eligibility: eligibility.eligibility,
        preferredAlternativeId,
        acceptableAlternativeIds,
        restrictionCodes: restrictions.map((restriction) =>
          restriction.code),
        researchClasses: researchFinal.requirements.map((requirement) =>
          requirement.researchClass),
        dimensionStates: dimensions.map((dimension) => dimension.state),
      }),
    });
    return {result, audit};
  }
}

export const STRATEGY_INTENT_EVALUATION_ENGINE_VERSION
  = EVALUATION_ENGINE_VERSION;
