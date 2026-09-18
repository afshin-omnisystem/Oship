/**
 * SPRINT 043 — Unified Portfolio Decision Input & Capital-Constraint
 * Bridge engine.
 *
 * Given an immutable Sprint 042 StrategyIntentEvaluation, produce an
 * immutable PortfolioDecisionInput answering: "What exactly may the
 * EXISTING downstream Portfolio/Risk/Allocation authority consider,
 * under which restrictions, dependencies and transported capital
 * constraints, with which evidence and provenance?"
 *
 * THE ENGINE IS AN INPUT CONTRACT, NOT A PORTFOLIO ENGINE. It never
 * allocates capital, computes authoritative weights, reserves capital,
 * modifies positions, creates orders or execution plans, calls AEGIS,
 * Treasury or Execution, accesses provider credentials or
 * exchange/sportsbook APIs, or mutates Portfolio, Risk, Allocation,
 * Strategy, Research or Learning state. The bridge has
 * NO_DECISION_AUTHORITY. Output is an informational decision-input
 * contract only.
 */

import type {
  PortfolioDecisionInputInput, PortfolioDecisionInput,
  PortfolioDecisionInputConfigInput, PortfolioDecisionInputConfigSpec,
  InputCoreResult, InputInvariantSubject, AlternativeReference,
} from './types';
import {
  InputRejectionError, InputInvariantError, DECISION_INPUT_DISCLAIMER,
  DOWNSTREAM_ELIGIBILITY_MEANING,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
  PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
} from './types';
import {validateInputEnvelope, validateEvaluationSource,
  validateEvaluationProvenance} from './source-validation';
import {validateInputIntegrity} from './input-integrity';
import {scanInputAnnotations, scanInputNarratives,
  inputNarrativeOf} from './safety-validation';
import {validateCapitalConstraints, constraintSafetyOf}
  from './constraints';
import {collectInputRestrictions} from './restrictions';
import {collectDependencyReferences} from './dependencies';
import {buildEvidenceReferences, evidenceIsSufficient}
  from './evidence';
import {checkPortfolioInterfaceOfEvaluation, checkInputBoundary}
  from './portfolio-interface';
import {classifyDecisionInput} from './classification';
import {assignDownstreamEligibility, eligibilityAllowsAlternatives}
  from './eligibility';
import {deriveInputResearch, buildInputResearchContext} from './research';
import {buildInputFeedback} from './feedback';
import {buildInputExplanation} from './explanation';
import {buildInputProvenance} from './provenance';
import {comparePortfolioDecisionInputs,
  serializePortfolioDecisionInput} from './replay';
import {
  PortfolioDecisionInputAuditLog, verifyPortfolioDecisionInputAudit,
  inputAuditIdentityOf,
} from './audit';
import {checkInputInvariants, inputCoreTupleOf, inputSealTupleOf}
  from './invariants';
import {mergeInputConfig} from './config';
import {canonicalJson, inputIdOf, inputContextIdOf,
  inputFingerprintOf, inputConfigFingerprint,
} from './ids';

export class PortfolioDecisionInputEngine {
  private readonly config: PortfolioDecisionInputConfigSpec;

  constructor(config?: PortfolioDecisionInputConfigInput) {
    this.config = mergeInputConfig(config);
  }

  get configuration(): PortfolioDecisionInputConfigSpec {
    return this.config;
  }

  get configurationFingerprint(): string {
    return inputConfigFingerprint(this.config);
  }

  /**
   * §18 replay — re-run the bridge over a validated input and compare
   * byte-for-byte with a recorded serialized result. Mismatches are
   * reported, never thrown, so replays stay observable.
   */
  replay(input: PortfolioDecisionInputInput,
    expectedSerialized: string): {
    readonly replayed: true;
    readonly replayMatches: boolean;
    readonly result: PortfolioDecisionInput;
    readonly actualFingerprint: string;
  } {
    const result = this.present(input);
    const actualSerialized = serializePortfolioDecisionInput(result);
    return Object.freeze({
      replayed: true as const,
      replayMatches: actualSerialized === expectedSerialized,
      result,
      actualFingerprint: result.inputFingerprint,
    });
  }

  /**
   * Present a governed evaluation as a portfolio decision input.
   * The pipeline runs twice and must be byte-identical both times.
   */
  present(input: PortfolioDecisionInputInput): PortfolioDecisionInput {
    const first = this.runCore(input);
    const second = this.runCore(input);
    if (!comparePortfolioDecisionInputs(first.result, second.result)
      || canonicalJson(first.audit.snapshot())
        !== canonicalJson(second.audit.snapshot())) {
      throw new InputRejectionError('NONDETERMINISTIC_INPUT',
        'the bridge pipeline is not byte-identical across runs');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: second.result.inputFingerprint,
    });
    const withReplay: InputInvariantSubject = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true,
        fingerprint: second.result.inputFingerprint,
      }),
    });
    const invariants = checkInputInvariants(withReplay, {
      input, config: this.config,
    });
    if (!invariants.passed) {
      throw new InputInvariantError(
        invariants.checks.filter((check) => !check.passed)
          .map((check) => check.invariant).join(', '));
    }
    const result: PortfolioDecisionInput = Object.freeze(
      {...withReplay, invariants});
    return result;
  }

  private runCore(input: PortfolioDecisionInputInput): {
    result: InputCoreResult;
    audit: PortfolioDecisionInputAuditLog;
  } {
    const config = this.config;
    const envelope = validateInputEnvelope(input, config);
    const evaluation = input.evaluationResult;
    validateEvaluationSource(evaluation);
    validateEvaluationProvenance(evaluation);

    // ---- Input integrity (§6 lifecycle) ----------------------------------
    validateInputIntegrity(evaluation);
    scanInputAnnotations(envelope.annotations);

    // ---- Portfolio interface of the consumed evaluation -------------------
    const compatibility = checkPortfolioInterfaceOfEvaluation(evaluation);
    const domain = compatibility.domain;

    // ---- Capital constraints (§9/§10 — transported only) -------------------
    const constraints = validateCapitalConstraints(envelope.constraints,
      domain, input.timestamp, config);

    // ---- Restriction collection (§15 — carried verbatim) -------------------
    const restrictions = collectInputRestrictions(evaluation,
      constraints);

    // ---- Dependency collection (§17) -----------------------------------------
    const dependencies = collectDependencyReferences(evaluation);

    // ---- Evidence validation (§14 — referenced, never synthesized) ----------
    const evidence = buildEvidenceReferences(evaluation);
    if (!evidenceIsSufficient(evidence)) {
      throw new InputRejectionError('MISSING_EVIDENCE',
        'the input references no governed evidence — fail closed');
    }

    // ---- Classification and downstream eligibility (§7/§8) ------------------
    const classification = classifyDecisionInput(evaluation,
      constraints);
    const eligibility = assignDownstreamEligibility(
      classification.classification);
    const surfacesAlternatives = eligibilityAllowsAlternatives(
      eligibility.eligibility);
    const preferredAlternativeId = surfacesAlternatives
      ? evaluation.preferredAlternativeId : null;
    const acceptableAlternativeIds = surfacesAlternatives
      ? evaluation.acceptableAlternativeIds : Object.freeze([]);
    const alternativeReferences: readonly AlternativeReference[] =
      Object.freeze(acceptableAlternativeIds.map((alternativeId) =>
        Object.freeze({
          alternativeId,
          domain,
          role: alternativeId === preferredAlternativeId
            ? 'PREFERRED' as const : 'ACCEPTABLE' as const,
          informational: true as const,
        })));

    // ---- Research escalation (§6 lifecycle — carried verbatim) ----------------
    const researchRequirements = deriveInputResearch(evaluation);

    // ---- Identity (§17: content-derived, timestamp-free) ----------------------
    const coreTuple = {
      evaluationId: evaluation.evaluationId,
      evaluationFingerprint: evaluation.evaluationFingerprint,
      evaluationClassification: evaluation.classification,
      inputClassification: classification.classification,
      eligibility: eligibility.eligibility,
      preferredAlternativeId,
      acceptableAlternativeIds,
      restrictionCodes: restrictions.map((restriction) =>
        restriction.code),
      constraintIds: constraints.map((constraint) =>
        constraint.constraintId),
      researchClasses: researchRequirements.map((requirement) =>
        requirement.researchClass),
      evidenceCount: evidence.length,
      annotations: envelope.annotations,
      configurationFingerprint: inputConfigFingerprint(config),
    };
    const inputId = inputIdOf(coreTuple);

    // ---- Decision input construction (§3) --------------------------------------
    const context = evaluation.evaluationContext;
    const semanticPreservation = domain === 'AFIS'
      ? Object.freeze(['AFIS action semantics (BUY/SELL) are preserved '
          + 'exactly as evaluated — never converted, merged or renamed'])
      : Object.freeze(['ABL action semantics (BACK/LAY) are preserved '
          + 'exactly as evaluated — never converted to BUY/SELL, never '
          + 'merged']);
    const inputContext = Object.freeze({
      contextId: inputContextIdOf({
        inputId,
        evaluationId: evaluation.evaluationId,
        domain,
        classification: classification.classification,
      }),
      inputId,
      evaluationId: evaluation.evaluationId,
      intentId: evaluation.intentId,
      governanceId: context.governanceId,
      decisionId: context.decisionId,
      opportunityId: context.opportunityId,
      domain,
      opportunityClass: context.opportunityClass,
      evidenceState: context.evidenceState,
      stabilityState: context.stabilityState,
      freshnessState: context.freshnessState,
      comparability: context.comparability,
      dependencyState: context.dependencyState,
      historicalEvidenceCount: context.historicalEvidenceCount,
      researchGapCount: context.researchGapCount,
      unresolvedConflictCount: context.unresolvedConflictCount,
      evaluationRestrictionCodes: Object.freeze(
        evaluation.restrictions.map((restriction) =>
          restriction.code)),
      semanticPreservation,
      informational: true as const,
      contentFingerprint: context.contentFingerprint,
    });

    const research = buildInputResearchContext(inputId,
      researchRequirements);
    const provenance = buildInputProvenance(evaluation, inputId);
    const explanation = buildInputExplanation({
      evaluation,
      classification: classification.classification,
      classificationReasons: classification.reasons,
      eligibility: eligibility.eligibility,
      eligibilityReasons: eligibility.reasons,
      constraints,
      restrictions,
      evidence,
      dependencies,
      inputId,
    });
    const constraintSafety = constraintSafetyOf(constraints);
    const feedback = buildInputFeedback({
      inputId,
      evaluationId: evaluation.evaluationId,
      classification: classification.classification,
      eligibility: eligibility.eligibility,
      restrictionCount: restrictions.length,
      evaluationRestrictionCount: evaluation.restrictions.length,
      constraints,
      research,
    });

    // ---- Audit (§19) --------------------------------------------------------------
    const audit = new PortfolioDecisionInputAuditLog(inputId,
      input.timestamp);
    audit.append('input-received', {
      evaluationId: evaluation.evaluationId,
      correlationId: input.correlationId,
    });
    audit.append('evaluation-verified', {
      evaluationId: evaluation.evaluationId,
      evaluationFingerprint: evaluation.evaluationFingerprint,
      intentId: evaluation.intentId,
    });
    audit.append('integrity-validated', {
      evaluationClassification: evaluation.classification,
      evaluationEligibility: evaluation.eligibility,
    });
    audit.append('evidence-validated', {
      evidenceState: context.evidenceState,
      historicalEvidenceCount: context.historicalEvidenceCount,
      freshnessState: context.freshnessState,
      stabilityState: context.stabilityState,
    });
    audit.append('eligibility-validated', {
      evaluationEligibility: evaluation.eligibility,
    });
    audit.append('restrictions-collected', {
      codes: restrictions.map((restriction) => restriction.code),
      evaluationRestrictionCount: evaluation.restrictions.length,
    });
    audit.append('dependencies-collected', {
      state: context.dependencyState,
      family: dependencies[0]?.family ?? 'NONE',
    });
    audit.append('constraints-validated', {
      constraintIds: constraints.map((constraint) =>
        constraint.constraintId),
      statuses: constraints.map((constraint) => constraint.status),
      unknownCount: constraintSafety.unknownCount,
      staleCount: constraintSafety.staleCount,
    });
    audit.append('portfolio-interface-checked', {
      domain,
      alternativeCount: compatibility.alternativeCount,
      restrictionCount: compatibility.restrictionCount,
    });
    audit.append('decision-input-constructed', {
      inputId,
      contextId: inputContext.contextId,
    });
    audit.append('input-classified', {
      classification: classification.classification,
    });
    audit.append('downstream-eligibility-assigned', {
      eligibility: eligibility.eligibility,
    });
    audit.append('research-escalated', {
      classes: research.requirements.map((requirement) =>
        requirement.researchClass),
    });
    for (const record of feedback) {
      audit.append('feedback-recorded', {kind: record.kind});
    }
    audit.append('explanation-built', {
      explanationId: explanation.explanationId,
    });

    // ---- Boundary (§4/§21) ------------------------------------------------------------
    const draft: Omit<PortfolioDecisionInput, 'auditEvents'
      | 'invariants' | 'replay'> = {
      inputId,
      schemaVersion: PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
      timestamp: input.timestamp,
      correlationId: input.correlationId,
      traceId: input.traceId,
      evaluationId: evaluation.evaluationId,
      evaluationFingerprint: evaluation.evaluationFingerprint,
      evaluationClassification: evaluation.classification,
      inputContext,
      classification: classification.classification,
      classificationReasons: classification.reasons,
      downstreamEligibility: eligibility.eligibility,
      eligibilityReasons: eligibility.reasons,
      eligibilityMeaning: DOWNSTREAM_ELIGIBILITY_MEANING,
      preferredAlternativeId,
      acceptableAlternativeIds,
      alternativeReferences,
      restrictions,
      evidence,
      dependencyReferences: dependencies,
      capitalConstraints: constraints,
      research,
      feedback,
      explanation,
      provenance,
      boundary: {
        boundaryId: '', state: 'BOUNDARY_RESPECTED', checks: [],
        protectedAuthorities: [], noDecisionAuthority: true,
        informational: true,
      } as PortfolioDecisionInput['boundary'],
      annotations: envelope.annotations,
      auditIdentity: {
        schemaVersion: PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
        inputId, eventCount: 0, headHash: '',
      } as PortfolioDecisionInput['auditIdentity'],
      inputFingerprint: inputFingerprintOf(inputSealTupleOf({
        inputId,
        classification: classification.classification,
        downstreamEligibility: eligibility.eligibility,
        restrictions,
        capitalConstraints: constraints,
        evidence,
        dependencyReferences: dependencies,
        research,
        annotations: envelope.annotations,
      })),
      informational: true,
      noDecisionAuthority: true,
      disclaimer: DECISION_INPUT_DISCLAIMER,
    };
    scanInputNarratives({
      classificationReasons: classification.reasons,
      eligibilityReasons: eligibility.reasons,
      constraintReasons: constraints.map((constraint) =>
        constraint.reason),
      restrictionReasons: restrictions.map((restriction) =>
        restriction.reason),
      evidenceObservations: evidence.map((reference) =>
        reference.observation),
      explanationSummaries: [
        ...explanation.presentationSummary,
        ...explanation.constraintSummary,
        ...explanation.restrictionSummary,
        ...explanation.evidenceSummary,
        ...explanation.eligibilityRationale,
        ...explanation.semanticLimitations,
      ],
    });
    const boundary = checkInputBoundary({
      serializedInput: canonicalJson({
        ...draft,
        boundary: undefined,
        auditIdentity: undefined,
      }),
      narrative: inputNarrativeOf({
        classificationReasons: classification.reasons,
        eligibilityReasons: eligibility.reasons,
        constraintReasons: constraints.map((constraint) =>
          constraint.reason),
        restrictionReasons: restrictions.map((restriction) =>
          restriction.reason),
        evidenceObservations: evidence.map((reference) =>
          reference.observation),
      }),
      informational: draft.informational,
      noDecisionAuthority: draft.noDecisionAuthority,
      inputId,
    });
    audit.append('boundary-checked', {
      state: boundary.state,
      checks: boundary.checks.length,
    });
    audit.append('input-built', {
      inputId,
      classification: classification.classification,
      eligibility: eligibility.eligibility,
    });
    const auditVerification = verifyPortfolioDecisionInputAudit(
      audit.snapshot());
    if (!auditVerification.valid) {
      throw new InputRejectionError('AUDIT_VIOLATION',
        `the input audit chain is invalid: `
          + `${auditVerification.reason ?? 'unknown'}`);
    }
    const auditIdentity = inputAuditIdentityOf(inputId, audit.length,
      audit.headHash);

    const result: InputCoreResult = Object.freeze({
      ...draft,
      boundary,
      auditIdentity,
    });
    return {result, audit};
  }
}

export const PORTFOLIO_DECISION_INPUT_ENGINE_VERSION_EXPORT
  = PORTFOLIO_DECISION_INPUT_ENGINE_VERSION;
