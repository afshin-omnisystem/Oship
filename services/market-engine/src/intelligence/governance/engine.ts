/**
 * SPRINT 040 — the governance engine.
 *
 * Orchestrates the full lifecycle over a Sprint 039 decision result:
 * Governance Context → Policy Validation → Evidence Gate → Safety Gate →
 * Comparability Gate → Freshness Gate → Stability Gate → Dependency Gate →
 * Authority Check → Handoff Classification → Restrictions → Strategy
 * Handoff Package → Research / Feedback → Audit.
 *
 * The engine runs its whole pipeline twice per governance run and requires
 * byte-identical results (replay); it then runs the full invariant set and
 * fails closed on any violation. NO EXECUTION OCCURS — the output is an
 * informational, evidence-bound handoff package for the existing Strategy
 * authority, never a strategy, order or instruction.
 */

import type {
  GovernanceInput, GovernanceResult, GovernanceConfigSpec,
  GovernanceConfigInput, PolicyEvaluation, StrategyHandoffPackage,
  StrategyInputView, GovernanceContext,
} from './types';
import {GovernanceRejectionError, GOVERNANCE_DISCLAIMER,
  GOVERNANCE_ENGINE_VERSION} from './types';
import {mergeGovernanceConfig} from './config';
import {governanceIdOf, governanceResultFingerprintOf, canonicalJson}
  from './ids';
import {createGovernanceContext, validateDecisionResult} from './context';
import {evaluateEvidenceGate} from './evidence-gate';
import {evaluateSafetyGate} from './safety-gate';
import {evaluateComparabilityGate} from './comparability-gate';
import {evaluateFreshnessGate} from './freshness-gate';
import {evaluateStabilityGate} from './stability-gate';
import {evaluateDependencyGate} from './dependency-gate';
import {checkAuthorityBoundary} from './authority-check';
import {GOVERNANCE_POLICIES, validatePolicyRegistry} from './policy-registry';
import {evaluatePolicy} from './policy';
import type {PolicyFacts} from './policy';
import {classifyHandoff} from './handoff-classification';
import {deriveRestrictions, validateRestrictions} from './handoff-restrictions';
import {buildStrategyHandoffPackage} from './handoff';
import {buildStrategyInput} from './strategy-input';
import {deriveResearchEscalations, buildGovernanceResearchContext}
  from './research-context';
import {buildGovernanceFeedback} from './feedback';
import {compareGovernanceResults} from './replay';
import {GovernanceAuditLog, verifyGovernanceAudit} from './audit';
import {checkGovernanceInvariants} from './invariants';
import {GovernanceInvariantError} from './types';

export class GovernanceEngine {
  private readonly config: GovernanceConfigSpec;

  constructor(config?: GovernanceConfigInput) {
    this.config = mergeGovernanceConfig(config);
    validatePolicyRegistry(this.config);
  }

  get configuration(): GovernanceConfigSpec {
    return this.config;
  }

  get configurationFingerprint(): string {
    return canonicalJson(this.config);
  }

  govern(input: GovernanceInput): GovernanceResult {
    this.validateInput(input);
    const first = this.runCore(input);
    const second = this.runCore(input);
    if (!compareGovernanceResults(first.result, second.result)) {
      throw new GovernanceRejectionError('NONDETERMINISTIC_INPUT',
        'the governance pipeline is not byte-identical across runs');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: second.result.governanceFingerprint,
    });
    const withReplay: GovernanceResult = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true, fingerprint: second.result.governanceFingerprint,
      }),
    });
    const invariants = checkGovernanceInvariants(withReplay, {
      input, config: this.config,
    });
    if (!invariants.passed) {
      throw new GovernanceInvariantError(invariants);
    }
    return Object.freeze({...withReplay, invariants});
  }

  private validateInput(input: GovernanceInput): void {
    if (input === null || typeof input !== 'object') {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        'governance input required');
    }
    if (input.decisionResult === null || typeof input.decisionResult
      !== 'object') {
      throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
        'decision result required');
    }
    if (!Array.isArray(input.annotations)) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        'annotations must be an array of strings');
    }
    if (input.annotations.some((note) => typeof note !== 'string')) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        'every annotation must be a string');
    }
    if (input.annotations.length > this.config.maxAnnotations) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        `at most ${this.config.maxAnnotations} annotations are accepted`);
    }
    if (typeof input.timestamp !== 'number'
      || !Number.isFinite(input.timestamp)) {
      throw new GovernanceRejectionError('NONDETERMINISTIC_INPUT',
        'finite timestamp required');
    }
    if (typeof input.correlationId !== 'string'
      || input.correlationId.length === 0
      || typeof input.traceId !== 'string' || input.traceId.length === 0) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        'correlation and trace ids required');
    }
    const normalization = input.normalization ?? null;
    if (normalization !== null
      && (typeof normalization !== 'object'
        || Array.isArray(normalization))) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        'normalization must be a declaration object or null');
    }
    validateDecisionResult(input.decisionResult);
  }

  private runCore(input: GovernanceInput): {
    result: GovernanceResult;
    audit: GovernanceAuditLog;
  } {
    const config = this.config;
    const decisionResult = input.decisionResult;
    const timestamp = input.timestamp;
    // Annotations are stored and evaluated in canonical sorted order so the
    // governance result is independent of annotation submission order.
    const annotations = [...input.annotations].sort();

    const context: GovernanceContext =
      createGovernanceContext(decisionResult, config);

    const governanceId = governanceIdOf({
      decisionAnalysisId: decisionResult.analysisId,
      opportunityId: context.opportunityId,
      domain: context.domain,
      correlationId: input.correlationId,
      configurationFingerprint: this.configurationFingerprint,
      timestamp,
    });
    const audit = new GovernanceAuditLog(governanceId, timestamp);
    audit.append('context-created', {
      decisionId: context.decisionId,
      opportunityId: context.opportunityId,
      domain: context.domain,
      recommendationState: context.recommendationState,
      policyVersion: context.policyVersion,
      governanceVersion: context.governanceVersion,
    });

    // ---- Gates (facts) --------------------------------------------------
    const evidenceGate = evaluateEvidenceGate(decisionResult, config);
    audit.append('evidence-gate', {
      state: evidenceGate.state, code: evidenceGate.code,
      worstConfidence: evidenceGate.worstConfidence,
    });
    const safetyGate = evaluateSafetyGate(decisionResult, annotations);
    audit.append('safety-gate', {
      state: safetyGate.state,
      checksPassed: safetyGate.checks.filter((c) => c.passed).length,
      checksTotal: safetyGate.checks.length,
    });
    const comparabilityGate = evaluateComparabilityGate(
      decisionResult, input.normalization ?? null, config);
    audit.append('comparability-gate', {
      state: comparabilityGate.state,
      normalization: comparabilityGate.normalization?.normalizationId ?? null,
    });
    const freshnessGate = evaluateFreshnessGate(decisionResult, config);
    audit.append('freshness-gate', {
      state: freshnessGate.state, outcome: freshnessGate.outcome,
    });
    const stabilityGate = evaluateStabilityGate(decisionResult, config);
    audit.append('stability-gate', {
      state: stabilityGate.state, outcome: stabilityGate.outcome,
    });
    const dependencyGate = evaluateDependencyGate(decisionResult);
    audit.append('dependency-gate', {
      state: dependencyGate.state,
      regime: dependencyGate.regimeDependency,
      strategy: dependencyGate.strategyDependency,
      venue: dependencyGate.venueDependency,
    });
    const authorityCheck = checkAuthorityBoundary(
      decisionResult, annotations);
    audit.append('authority-checked', {
      state: authorityCheck.state,
      protected: authorityCheck.protectedAuthorities.length,
    });

    // ---- Policies (judgments) -------------------------------------------
    const facts: PolicyFacts = {
      evidenceGate,
      safetyGate,
      comparabilityGate,
      freshnessGate,
      stabilityGate,
      dependencyGate,
      authorityCheck,
      maxLeakageShare: context.maxLeakageShare,
      researchGapCount: context.researchGaps.length,
      researchQuestionCount:
        decisionResult.researchContext.recommendedPriorities.length,
    };
    const policies: PolicyEvaluation[] = GOVERNANCE_POLICIES.map((rule) =>
      evaluatePolicy(rule, facts, config));
    for (const policyEvaluation of policies) {
      audit.append('policy-evaluated', {
        policyId: policyEvaluation.policyId,
        verdict: policyEvaluation.verdict,
      });
    }

    // ---- Classification --------------------------------------------------
    const classification = classifyHandoff({
      policies, evidenceGate, safetyGate, comparabilityGate, freshnessGate,
      stabilityGate, dependencyGate, authorityCheck,
    });
    audit.append('handoff-classified', {
      classification: classification.classification,
      code: classification.code,
      reasons: classification.reasons.length,
    });

    // ---- Restrictions ----------------------------------------------------
    const restrictions = deriveRestrictions({
      classification: classification.classification,
      evidenceGate, freshnessGate, stabilityGate, dependencyGate,
      comparabilityGate, policies,
      maxLeakageShare: context.maxLeakageShare, config,
    });
    validateRestrictions(restrictions);
    audit.append('restrictions-applied', {
      count: restrictions.length,
      codes: restrictions.map((r) => r.code),
    });

    // ---- Research escalation ---------------------------------------------
    const escalations = deriveResearchEscalations({
      classification: classification.classification,
      evidenceGate, freshnessGate, dependencyGate, comparabilityGate,
      maxLeakageShare: context.maxLeakageShare, config,
    });
    const research = buildGovernanceResearchContext(
      governanceId, decisionResult, escalations);
    audit.append('research-escalated', {
      escalations: escalations.map((e) => e.kind),
    });

    // ---- Feedback ----------------------------------------------------------
    const feedback = buildGovernanceFeedback(
      governanceId, decisionResult, classification.classification,
      evidenceGate, freshnessGate, dependencyGate);
    for (const record of feedback) {
      audit.append('feedback-recorded', {
        feedbackId: record.feedbackId, kind: record.kind,
      });
    }

    // ---- Handoff package --------------------------------------------------
    const handoffPackage: StrategyHandoffPackage =
      buildStrategyHandoffPackage({
        decisionResult, context,
        classification: classification.classification,
        classificationReasons: classification.reasons,
        restrictions,
        researchRequirements: escalations.map((e) => e.kind),
        evidenceGate, freshnessGate, stabilityGate, dependencyGate,
        comparabilityGate,
        auditIdentity: {
          schemaVersion: 'oship.decision-governance.v1',
          governanceId,
          eventCount: audit.length,
          headHash: audit.headHash,
        },
      });
    const strategyInput: StrategyInputView = buildStrategyInput(
      handoffPackage, decisionResult);
    audit.append('package-built', {
      handoffId: handoffPackage.handoffId,
      classification: handoffPackage.governanceResult.classification,
      restrictions: handoffPackage.governanceRestrictions.length,
    });

    // ---- Audit self-verification ------------------------------------------
    const auditVerification = verifyGovernanceAudit(audit.snapshot());
    if (!auditVerification.valid) {
      throw new GovernanceRejectionError('AUDIT_INTEGRITY_FAILURE',
        `internal audit verification failed: `
          + `${String(auditVerification.reason)}`);
    }

    const core: GovernanceResult = Object.freeze({
      governanceId,
      timestamp,
      schemaVersion: 'oship.decision-governance.v1',
      correlationId: input.correlationId,
      traceId: input.traceId,
      context,
      policies: Object.freeze(policies),
      evidenceGate,
      safetyGate,
      comparabilityGate,
      freshnessGate,
      stabilityGate,
      dependencyGate,
      authorityCheck,
      classification: classification.classification,
      classificationReasons: Object.freeze(classification.reasons),
      restrictions: Object.freeze(restrictions),
      research,
      feedback: Object.freeze(feedback),
      handoffPackage,
      strategyInput,
      annotations: Object.freeze(annotations),
      auditEvents: audit.snapshot(),
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
      replay: Object.freeze({identical: false, fingerprint: ''}),
      governanceFingerprint: '',
      informational: true,
      disclaimer: GOVERNANCE_DISCLAIMER,
    });
    const withFingerprint = Object.freeze({
      ...core,
      governanceFingerprint: governanceResultFingerprintOf({
        governanceId,
        classification: classification.classification,
        restrictions: restrictions.map((r) => r.code),
        handoffId: handoffPackage.handoffId,
        contextFingerprint: context.contentFingerprint,
      }),
    });
    return {result: withFingerprint, audit};
  }
}

/** Re-exported for the public surface (engine version identity). */
export {GOVERNANCE_ENGINE_VERSION};
