/**
 * SPRINT 041 — the strategy-intent engine.
 *
 * Orchestrates the full lifecycle over a governed Sprint-040 result and
 * its Sprint-039 decision result: Intent Context → Source Validation →
 * Governance Input → Decision Input → Objective → Classification →
 * Priority → Dependencies → Alternatives → Restrictions → Research →
 * Evidence → Ranking → Explanation → Feedback → Strategy Boundary →
 * StrategyIntent → Audit.
 *
 * The engine runs its whole pipeline twice per intent run and requires
 * byte-identical results (replay); it then runs the full invariant set
 * and fails closed on any violation. NO EXECUTION OCCURS — the output is
 * an informational, evidence-bound STRATEGY-INPUT INTENT for the
 * existing Strategy authority, never an executable strategy, order,
 * Treasury command or AEGIS authorization.
 */

import type {
  StrategyIntentInput, StrategyIntentResult, StrategyIntentConfigSpec,
  StrategyIntentConfigInput, StrategyIntent, IntentContext,
  IntentProvenance, IntentSourceVersions,
} from './types';
import {IntentRejectionError, IntentInvariantError,
  INTENT_DISCLAIMER, STRATEGY_INTENT_ENGINE_VERSION,
  STRATEGY_INTENT_SCHEMA_VERSION} from './types';
import {mergeStrategyIntentConfig} from './config';
import {canonicalJson, intentIdOf, intentResultFingerprintOf,
  intentProvenanceIdOf} from './ids';
import {validateIntentEnvelope, validateGovernanceSource,
  validateDecisionSource} from './source-validation';
import {createIntentContext} from './context';
import {extractGovernanceFacts} from './governance-input';
import {extractDecisionFacts} from './decision-input';
import {buildIntentObjective} from './objective';
import {classifyIntent, classificationIsActionable} from './classification';
import {assignIntentPriority} from './priority';
import {preserveDependencies} from './dependencies';
import {assessAlternatives} from './alternatives';
import {rankAcceptableAlternatives} from './ranking';
import {deriveIntentRestrictions, validateIntentRestrictions}
  from './restrictions';
import {deriveResearchRequirements, buildIntentResearchContext}
  from './research';
import {buildEvidenceBundle} from './evidence';
import {buildIntentExplanation} from './explanation';
import {buildIntentFeedback} from './feedback';
import {compareStrategyIntentResults, serializeStrategyIntentResult}
  from './replay';
import {StrategyIntentAuditLog, verifyStrategyIntentAudit,
  intentAuditIdentityOf} from './audit';
import {checkIntentInvariants} from './invariants';
import {checkStrategyBoundary, intentNarrativeOf}
  from './strategy-boundary';

export class StrategyIntentEngine {
  private readonly config: StrategyIntentConfigSpec;

  constructor(config?: StrategyIntentConfigInput) {
    this.config = mergeStrategyIntentConfig(config);
  }

  get configuration(): StrategyIntentConfigSpec {
    return this.config;
  }

  get configurationFingerprint(): string {
    return canonicalJson(this.config);
  }

  synthesize(input: StrategyIntentInput): StrategyIntentResult {
    const first = this.runCore(input);
    const second = this.runCore(input);
    if (!compareStrategyIntentResults(first.result, second.result)) {
      throw new IntentRejectionError('NONDETERMINISTIC_INPUT',
        'the intent pipeline is not byte-identical across runs');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: second.result.intentFingerprint,
    });
    const withReplay: StrategyIntentResult = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true, fingerprint: second.result.intentFingerprint,
      }),
    });
    const invariants = checkIntentInvariants(withReplay, {
      input, config: this.config,
    });
    if (!invariants.passed) {
      throw new IntentInvariantError(
        invariants.checks.filter((check) => !check.passed)
          .map((check) => check.invariant).join(', '));
    }
    return Object.freeze({...withReplay, invariants});
  }

  /**
   * §21 replay — re-run the pipeline over a validated envelope and
   * compare it byte-for-byte with a recorded serialized result
   * (e.g. restored from audit). Mismatches are reported, never thrown,
   * so replays stay observable for governance review.
   */
  replay(input: StrategyIntentInput,
    expectedSerialized: string): {
    readonly replayed: true;
    readonly replayMatches: boolean;
    readonly result: StrategyIntentResult;
    readonly expectedFingerprint: string | null;
    readonly actualFingerprint: string;
  } {
    const result = this.synthesize(input);
    const actualSerialized = serializeStrategyIntentResult(result);
    return Object.freeze({
      replayed: true as const,
      replayMatches: actualSerialized === expectedSerialized,
      result,
      expectedFingerprint: Object.freeze({
        ...JSON.parse(expectedSerialized) as {intentFingerprint?: string},
      }).intentFingerprint ?? null,
      actualFingerprint: result.intentFingerprint,
    });
  }

  private runCore(input: StrategyIntentInput): {
    result: StrategyIntentResult;
    audit: StrategyIntentAuditLog;
  } {
    const config = this.config;
    const envelope = validateIntentEnvelope(input, config);
    validateGovernanceSource(input.governanceResult);
    validateDecisionSource(input.decisionResult,
      input.governanceResult);

    const governance = input.governanceResult;
    const decision = input.decisionResult;
    const timestamp = input.timestamp;

    // ---- Governed facts ---------------------------------------------------
    const governanceFacts = extractGovernanceFacts(governance);
    const decisionFacts = extractDecisionFacts(decision);

    const classification = classifyIntent(governanceFacts.classification,
      governanceFacts.classificationReasons);
    const priority = assignIntentPriority(classification.classification);
    const dependencies = preserveDependencies(governance);
    const alternatives = assessAlternatives({
      decisionFacts,
      classification: classification.classification,
      governanceRecommendedAlternativeId:
        governanceFacts.recommendedAlternativeId,
      secondaryLimit: config.secondaryAlternativesLimit,
      includeRejected: config.includeRejectedAlternatives,
      includeUnsupported: config.includeUnsupportedAlternatives,
    });
    const ranking = rankAcceptableAlternatives(alternatives,
      config.secondaryAlternativesLimit);
    // Acceptable alternatives exist only for actionable intents — blocked
    // families surface no acceptable set to Strategy.
    const acceptableAlternativeIds = classificationIsActionable(
      classification.classification)
      ? ranking.acceptableAlternativeIds : Object.freeze([]);
    const restrictions = deriveIntentRestrictions({
      classification: classification.classification,
      governanceRestrictionCodes: governanceFacts.restrictionCodes,
      dependencies,
    });
    validateIntentRestrictions(restrictions);
    const researchRequirements = deriveResearchRequirements({
      classification: classification.classification,
      governanceFacts,
      dependencies,
      decisionResearchQuestionCount: decisionFacts.researchQuestionCount,
      escalateStabilityResearch: config.escalateStabilityResearch,
    });
    const stabilityLimitations = restrictions.some((restriction) =>
      restriction.code === 'STABILITY_WARNING');
    const objective = buildIntentObjective(classification.classification,
      stabilityLimitations);

    // ---- Identity (§19: content-derived, timestamp-free) ------------------
    const intentId = intentIdOf({
      governanceId: governance.governanceId,
      decisionId: decision.analysisId,
      opportunityId: decision.context.baseCandidateId,
      domain: decision.context.domain,
      classification: classification.classification,
      stabilityState: governanceFacts.stabilityState,
      freshnessState: governanceFacts.freshnessState,
      comparabilityStatus: governanceFacts.comparabilityStatus,
      preferredAlternativeId: ranking.preferredAlternativeId,
      acceptableAlternativeIds,
      restrictionCodes: restrictions.map((restriction) =>
        restriction.code),
      researchClasses: researchRequirements.map((requirement) =>
        requirement.researchClass),
      objectiveClass: objective.objectiveClass,
      priority: priority.priority,
      configurationFingerprint: this.configurationFingerprint,
    });

    // ---- Audit lifecycle ----------------------------------------------------
    const audit = new StrategyIntentAuditLog(intentId, timestamp);
    audit.append('context-created', {
      governanceId: governance.governanceId,
      decisionId: decision.analysisId,
      opportunityId: decision.context.baseCandidateId,
      domain: decision.context.domain,
      intentVersion: STRATEGY_INTENT_ENGINE_VERSION,
    });
    const context: IntentContext = createIntentContext(input, intentId);
    audit.append('sources-validated', {
      annotations: envelope.annotations.length,
      correlationId: input.correlationId,
    });
    audit.append('governance-verified', {
      governanceId: governance.governanceId,
      classification: governanceFacts.classification,
    });
    audit.append('decision-verified', {
      decisionId: decision.analysisId,
      domain: decision.context.domain,
    });
    audit.append('objective-selected', {
      objectiveClass: objective.objectiveClass,
    });
    audit.append('priority-assigned', {priority: priority.priority});
    audit.append('alternatives-assessed', {
      count: alternatives.length,
      preferred: ranking.preferredAlternativeId,
      roles: alternatives.map((alternative) => alternative.role),
    });
    audit.append('dependencies-preserved', {
      state: dependencies.state,
      regime: dependencies.regimeDependency,
      strategy: dependencies.strategyDependency,
      venue: dependencies.venueDependency,
    });
    audit.append('restrictions-applied', {
      count: restrictions.length,
      codes: restrictions.map((restriction) => restriction.code),
    });
    const research = buildIntentResearchContext(intentId,
      researchRequirements, governanceFacts.researchEscalations.length,
      decisionFacts.researchQuestionCount);
    audit.append('research-escalated', {
      classes: researchRequirements.map((requirement) =>
        requirement.researchClass),
    });
    audit.append('intent-classified', {
      classification: classification.classification,
      reasons: classification.reasons.length,
    });

    // ---- Explanation & feedback ---------------------------------------------
    const evidence = buildEvidenceBundle(classification.classification,
      decisionFacts, governanceFacts, ranking.preferredAlternativeId,
      governanceFacts.stabilityState);
    const explanation = buildIntentExplanation({
      decisionId: decision.analysisId,
      governanceId: governance.governanceId,
      preferredAlternativeId: ranking.preferredAlternativeId,
      classification: classification.classification,
      evidence,
      dependencies,
      restrictions,
      researchRequirements,
      governanceFacts,
    });
    audit.append('explanation-built', {
      preferred: ranking.preferredAlternativeId,
      supporting: evidence.supportingEvidence.length,
      conflicting: evidence.conflictingEvidence.length,
    });

    const feedback = buildIntentFeedback({
      intentId,
      governanceId: governance.governanceId,
      decisionAnalysisId: decision.analysisId,
      classification: classification.classification,
      dependencies,
      researchRequirements,
      alternatives,
      evidenceGapCount: decisionFacts.alternatives.reduce(
        (total, facts) => total + facts.evidenceGaps, 0),
    });
    for (const record of feedback) {
      audit.append('feedback-recorded', {
        feedbackId: record.feedbackId, kind: record.kind,
      });
    }

    // ---- Provenance (§18) -----------------------------------------------------
    const sourceVersions: IntentSourceVersions = Object.freeze({
      decisionIntelligenceVersion: decision.context.engineVersion,
      decisionAnalysisId: decision.analysisId,
      learningAnalysisId:
        governance.handoffPackage.sourceVersions.learningAnalysisId,
      governanceVersion: governance.context.governanceVersion,
      governanceId: governance.governanceId,
      governancePolicyVersion: governance.context.policyVersion,
      intentVersion: STRATEGY_INTENT_ENGINE_VERSION,
    });
    const provenance: IntentProvenance = Object.freeze({
      opportunityId: decision.context.baseCandidateId,
      decisionContextId: decision.context.contextId,
      decisionId: decision.analysisId,
      governanceContextId: governance.context.contextId,
      governanceId: governance.governanceId,
      handoffId: governance.handoffPackage.handoffId,
      strategyInputId: governance.strategyInput.strategyInputId,
      intentId,
      sourceVersions,
      informational: true,
      provenanceId: '',
    });
    const withProvenanceId: IntentProvenance = Object.freeze({
      ...provenance,
      provenanceId: intentProvenanceIdOf({
        opportunityId: provenance.opportunityId,
        decisionId: provenance.decisionId,
        governanceId: provenance.governanceId,
        intentId,
      }),
    });

    // ---- The StrategyIntent artifact (§2) --------------------------------------
    const intentDraft: StrategyIntent = Object.freeze({
      intentId,
      schemaVersion: STRATEGY_INTENT_SCHEMA_VERSION,
      provenance: withProvenanceId,
      domain: decision.context.domain,
      opportunityClass: decision.context.opportunityClass,
      objective,
      classification: classification.classification,
      classificationReasons: Object.freeze(classification.reasons),
      priority: priority.priority,
      priorityReasons: Object.freeze(priority.reasons),
      preferredAlternativeId: ranking.preferredAlternativeId,
      acceptableAlternativeIds,
      alternatives,
      dependencies,
      restrictions,
      researchRequirements,
      rationale: evidence.rationale,
      historicalSupport: evidence.historicalSupport,
      semanticLimitations: evidence.semanticLimitations,
      governanceStatus: governanceFacts.classification,
      governanceRestrictions: Object.freeze(
        [...governanceFacts.restrictionCodes]),
      sourceVersions,
      disclaimer: INTENT_DISCLAIMER,
      auditIdentity: intentAuditIdentityOf(intentId, audit.length,
        audit.headHash),
      strategyDecides: true,
      informational: true,
    });

    // ---- Strategy boundary (§12/§13) — fail closed ----------------------------
    const boundary = checkStrategyBoundary({
      serializedIntent: canonicalJson(intentDraft),
      narrative: intentNarrativeOf(intentDraft),
      informational: intentDraft.informational,
      strategyDecides: intentDraft.strategyDecides,
      intentId,
    });
    audit.append('boundary-checked', {
      state: boundary.state,
      protected: boundary.protectedAuthorities.length,
    });
    audit.append('intent-built', {
      intentId,
      classification: classification.classification,
      preferred: ranking.preferredAlternativeId,
      restrictions: restrictions.length,
    });

    // ---- Audit self-verification -----------------------------------------------
    const auditVerification = verifyStrategyIntentAudit(audit.snapshot());
    if (!auditVerification.valid) {
      throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
        `internal audit verification failed: `
        + `${String(auditVerification.reason)}`);
    }

    const core: StrategyIntentResult = Object.freeze({
      intentId,
      schemaVersion: STRATEGY_INTENT_SCHEMA_VERSION,
      timestamp,
      correlationId: input.correlationId,
      traceId: input.traceId,
      context,
      intent: intentDraft,
      objective,
      classification: classification.classification,
      classificationReasons: Object.freeze(classification.reasons),
      priority: priority.priority,
      priorityReasons: Object.freeze(priority.reasons),
      preferredAlternativeId: ranking.preferredAlternativeId,
      acceptableAlternativeIds,
      alternatives,
      dependencies,
      restrictions,
      research,
      feedback: Object.freeze(feedback),
      explanation,
      boundary,
      annotations: Object.freeze([...envelope.annotations]),
      auditEvents: audit.snapshot(),
      invariants: Object.freeze({passed: true, checks: [],
        failedCount: 0}),
      replay: Object.freeze({identical: false, fingerprint: ''}),
      intentFingerprint: '',
      informational: true,
      strategyDecides: true,
      disclaimer: INTENT_DISCLAIMER,
    });
    const withFingerprint = Object.freeze({
      ...core,
      intentFingerprint: intentResultFingerprintOf({
        intentId,
        classification: classification.classification,
        priority: priority.priority,
        restrictions: restrictions.map((restriction) =>
          restriction.code),
        preferredAlternativeId: ranking.preferredAlternativeId,
        acceptableAlternativeIds: ranking.acceptableAlternativeIds,
        objectiveClass: objective.objectiveClass,
      }),
    });
    return {result: withFingerprint, audit};
  }
}
