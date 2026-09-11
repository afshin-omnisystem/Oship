/**
 * SPRINT 039 — the decision intelligence engine.
 *
 * One engine serves AFIS and ABL base opportunities. It consumes the base
 * candidate, its validated Sprint 038 opportunity intelligence (rebuilt via
 * the Sprint 038 profile builder over the validated Sprint 037 learning
 * result) and a set of hypothetical alternatives, and produces a
 * deterministic, evidence-bound Decision Intelligence Context comparing the
 * alternatives WITHOUT EXECUTING ANY ACTION.
 *
 * Lifecycle: Opportunity → Opportunity Intelligence → Decision Context →
 * Candidate Alternatives → Counterfactual Evaluation → Trade-off Analysis →
 * Evidence-Bound Recommendation → Research / Strategy Input.
 *
 * The engine is NOT an execution engine, capital allocator, betting
 * guarantee, profit oracle, probability oracle or autonomous policy
 * activation system. The full pipeline runs twice per analysis and must be
 * byte-identical; invariants (60+) are enforced on every analysis and any
 * failure throws — fail closed.
 */

import type {
  DecisionIntelligenceInput, DecisionIntelligenceResult,
  DecisionIntelligenceConfigSpec, DecisionIntelligenceConfigInput,
  OpportunityCandidate, AlternativeSpec, CounterfactualEvaluation,
  RejectedAlternative, CompatibilityAssessment, DecisionAuditEvent,
} from './types';
import {mergeDecisionConfig, validateDecisionConfig} from './config';
import {decisionAnalysisIdOf, decisionAnalysisFingerprintOf, canonicalJson} from './ids';
import {validateCandidate} from '../opportunity/candidate';
import {buildProfile} from '../opportunity/profile';
import {baselineSpecOf, validateAlternativeSpec, rejectAlternative} from './alternative';
import {evaluateCompatibility} from './compatibility';
import {evaluateCounterfactual} from './counterfactual';
import {buildHistoricalComparison} from './historical-comparison';
import {analyzeRegimeAxis, analyzeStrategyAxis, analyzeVenueAxis,
  analyzeLeakageAxis, analyzeStabilityAxis, analyzeEvidenceAxis} from './axes';
import {buildTradeOffAnalysis} from './tradeoff';
import {analyzeDominance} from './dominance';
import {buildRecommendation} from './recommendation';
import {buildScenarioMatrix} from './scenario';
import {rankAlternatives} from './ranking';
import {buildExplanation} from './explanation';
import {buildDecisionResearchContext} from './research-context';
import {buildDecisionContext} from './context';
import {recordDecisionFeedback} from './feedback';
import {compareDecisionResults} from './replay';
import {checkDecisionInvariants, DecisionInvariantError} from './invariants';
import {DecisionAuditLog} from './audit';

export class DecisionIntelligenceEngine {
  private readonly config: DecisionIntelligenceConfigSpec;

  constructor(configInput?: DecisionIntelligenceConfigInput) {
    const config = mergeDecisionConfig(configInput);
    validateDecisionConfig(config);
    this.config = config;
  }

  get configurationFingerprint(): string {
    return canonicalJson(this.config);
  }

  analyze(input: DecisionIntelligenceInput): DecisionIntelligenceResult {
    this.validateInput(input);
    const first = this.runCore(input);
    const second = this.runCore(input);
    const identical = compareDecisionResults(first.result, second.result);
    if (!identical) {
      throw new Error(
        'decision-intelligence: internal replay is not byte-identical — fail closed');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: first.result.analysisFingerprint,
    });
    const withReplay: DecisionIntelligenceResult = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true, fingerprint: second.result.analysisFingerprint,
      }),
    });
    const invariants = checkDecisionInvariants(withReplay, {
      baseCandidate: input.baseCandidate,
      alternativeSpecs: input.alternatives,
      learning: input.learning,
      config: this.config,
    });
    if (!invariants.passed) {
      throw new DecisionInvariantError(invariants);
    }
    return Object.freeze({...withReplay, invariants});
  }

  private validateInput(input: DecisionIntelligenceInput): void {
    if (input === null || typeof input !== 'object') {
      throw new Error('decision-intelligence: input required — fail closed');
    }
    if (input.learning === null || typeof input.learning !== 'object'
      || !Array.isArray(input.learning.observations)) {
      throw new Error(
        'decision-intelligence: validated learning result required — fail closed');
    }
    if (input.learning.invariants?.passed !== true) {
      throw new Error(
        'decision-intelligence: learning result failed its own invariants — fail closed');
    }
    if (input.learning.replay?.identical !== true) {
      throw new Error(
        'decision-intelligence: learning result is not replay-verified — fail closed');
    }
    if (!Array.isArray(input.alternatives)) {
      throw new Error('decision-intelligence: alternatives array required — fail closed');
    }
    if (typeof input.correlationId !== 'string' || input.correlationId.length === 0) {
      throw new Error('decision-intelligence: correlationId required — fail closed');
    }
    if (typeof input.traceId !== 'string' || input.traceId.length === 0) {
      throw new Error('decision-intelligence: traceId required — fail closed');
    }
    if (typeof input.timestamp !== 'number' || !Number.isFinite(input.timestamp)) {
      throw new Error('decision-intelligence: finite timestamp required — fail closed');
    }
  }

  private runCore(input: DecisionIntelligenceInput): {
    result: DecisionIntelligenceResult;
    audit: DecisionAuditLog;
  } {
    const config = this.config;
    const learning = input.learning;
    const timestamp = input.timestamp;

    // The base candidate must pass the Sprint 038 fail-closed validation.
    const baseValidation = validateCandidate(input.baseCandidate, learning);
    if ('rejected' in baseValidation) {
      throw new Error(
        `decision-intelligence: base candidate rejected (${baseValidation.code}: `
        + `${baseValidation.reason}) — fail closed`);
    }
    const base = baseValidation.candidate;
    const baseProfile = buildProfile(
      base, learning, config.opportunityConfig, 'DERIVED');

    const analysisId = decisionAnalysisIdOf({
      learningAnalysisId: learning.analysisId,
      baseProfileId: baseProfile.profileId,
      alternativeIds: input.alternatives.map(
        (a) => (a as Partial<AlternativeSpec>)?.alternativeId ?? null),
      timestamp, config: config.schemaVersion,
    });
    const audit = new DecisionAuditLog(analysisId, timestamp);
    audit.append('context-created', {
      baseCandidateId: base.candidateId,
      domain: base.domain,
      opportunityClass: base.opportunityClass,
      profileId: baseProfile.profileId,
      correlationId: input.correlationId, traceId: input.traceId,
    });

    // Alternative validation + compatibility (fail closed, never coerced).
    const acceptedSpecs: AlternativeSpec[] = [baselineSpecOf(base)];
    // The auto-baseline id is reserved: submitted specs may not collide.
    const seenIds = new Set<string>([acceptedSpecs[0].alternativeId]);
    const rejectedAlternatives: RejectedAlternative[] = [];
    const compatibility: CompatibilityAssessment[] = [];
    for (const raw of input.alternatives) {
      const validation = validateAlternativeSpec(raw, base, learning, seenIds);
      if (!validation.ok) {
        const rejection = rejectAlternative(raw, validation.code, validation.reason);
        rejectedAlternatives.push(rejection);
        audit.append('alternative-rejected', {
          alternativeId: rejection.alternativeId, code: rejection.code,
          reason: rejection.reason,
        });
        continue;
      }
      seenIds.add(validation.spec.alternativeId);
      const assessment = evaluateCompatibility(validation.spec, base, learning);
      compatibility.push(assessment);
      audit.append('compatibility-evaluated', {
        alternativeId: validation.spec.alternativeId,
        state: assessment.state,
        checks: assessment.checks.length,
        passed: assessment.checks.every((c) => c.passed),
      });
      if (assessment.state === 'NOT_COMPARABLE') {
        const rejection = rejectAlternative(
          raw, 'DOMAIN_MISMATCH',
          assessment.reason ?? 'NOT_COMPARABLE — incompatible alternative');
        rejectedAlternatives.push(rejection);
        audit.append('alternative-rejected', {
          alternativeId: rejection.alternativeId, code: rejection.code,
          reason: rejection.reason,
        });
        continue;
      }
      acceptedSpecs.push(validation.spec);
      audit.append('alternative-added', {
        alternativeId: validation.spec.alternativeId,
        kind: validation.spec.kind, label: validation.spec.label,
      });
    }
    // The baseline is always first and always compatible.
    const baselineAssessment = evaluateCompatibility(
      acceptedSpecs[0], base, learning);
    compatibility.unshift(baselineAssessment);
    audit.append('alternative-added', {
      alternativeId: acceptedSpecs[0].alternativeId,
      kind: 'BASELINE', label: acceptedSpecs[0].label,
    });
    audit.append('compatibility-evaluated', {
      alternativeId: acceptedSpecs[0].alternativeId,
      state: baselineAssessment.state,
      checks: baselineAssessment.checks.length,
      passed: baselineAssessment.checks.every((c) => c.passed),
    });

    // Counterfactual evaluation of every accepted alternative.
    const alternatives: CounterfactualEvaluation[] = acceptedSpecs.map((spec) =>
      evaluateCounterfactual(spec, base, learning, config.opportunityConfig));
    for (const evaluation of alternatives) {
      audit.append('counterfactual-evaluated', {
        alternativeId: evaluation.alternativeId,
        counterfactualId: evaluation.counterfactualId,
        cohortSize: evaluation.cohortSize,
        confidenceState: evaluation.confidenceState,
      });
      audit.append('evidence-evaluated', {
        alternativeId: evaluation.alternativeId,
        evidenceCount: evaluation.cohortSize,
        gaps: evaluation.evidenceGaps.length,
        conflicts: evaluation.conflicts.length,
      });
    }

    // Analyses across alternatives.
    const historicalComparison = buildHistoricalComparison(alternatives);
    const regimeAnalysis = analyzeRegimeAxis(alternatives);
    const strategyAnalysis = analyzeStrategyAxis(alternatives);
    const venueAnalysis = analyzeVenueAxis(alternatives);
    const leakageAnalysis = analyzeLeakageAxis(alternatives);
    const stabilityAnalysis = analyzeStabilityAxis(alternatives);
    const evidenceAnalysis = analyzeEvidenceAxis(alternatives);

    const tradeoff = buildTradeOffAnalysis(alternatives, config);
    audit.append('tradeoff-evaluated', {
      scored: tradeoff.orderedAlternativeIds.length,
      total: tradeoff.scores.length,
      ordered: tradeoff.orderedAlternativeIds,
    });

    const dominance = analyzeDominance(
      alternatives, tradeoff, regimeAnalysis, strategyAnalysis, venueAnalysis, config);
    audit.append('dominance-evaluated', {
      state: dominance.state,
      dominantAlternativeId: dominance.dominantAlternativeId,
      topMargin: dominance.topMargin,
    });

    const recommendation = buildRecommendation(
      alternatives, tradeoff, dominance, regimeAnalysis, strategyAnalysis,
      venueAnalysis);
    audit.append('recommendation-generated', {
      recommendationId: recommendation.recommendationId,
      status: recommendation.status,
      selectedAlternativeId: recommendation.selectedAlternativeId,
    });

    const scenarioMatrix = buildScenarioMatrix(alternatives, learning);
    const ranking = rankAlternatives(alternatives, tradeoff);

    const explanation = buildExplanation(
      alternatives, rejectedAlternatives, tradeoff, dominance, recommendation,
      regimeAnalysis, strategyAnalysis, venueAnalysis, leakageAnalysis,
      stabilityAnalysis, evidenceAnalysis, ranking, config);
    audit.append('explanation-generated', {
      explanationId: explanation.explanationId,
      alternatives: explanation.alternativeRationales.length,
    });

    const context = buildDecisionContext(
      base, baseProfile, learning,
      alternatives.map((a) => a.alternativeId),
      rejectedAlternatives, compatibility, config);

    const researchContext = buildDecisionResearchContext(
      context, alternatives, rejectedAlternatives, evidenceAnalysis,
      regimeAnalysis, strategyAnalysis, venueAnalysis);
    audit.append('research-context-generated', {
      researchContextId: researchContext.researchContextId,
      priorities: researchContext.recommendedPriorities.length,
    });

    const feedback = [recordDecisionFeedback(context, recommendation, alternatives)];
    for (const record of feedback) {
      audit.append('feedback-recorded', {
        feedbackId: record.feedbackId,
        status: record.status,
        selectedAlternativeId: record.selectedAlternativeId,
      });
    }

    const observationIds = [...new Set(alternatives.flatMap(
      (a) => a.profile.similarity.matches.map((m) => m.observationId)))].sort();

    const result: DecisionIntelligenceResult = Object.freeze({
      analysisId,
      timestamp,
      schemaVersion: 'oship.decision-intelligence.v1',
      correlationId: input.correlationId,
      traceId: input.traceId,
      configurationFingerprint: this.configurationFingerprint,
      analysisFingerprint: '',
      causalPolicy: 'ASSOCIATIONAL_ONLY',
      source: Object.freeze({
        learningAnalysisId: learning.analysisId,
        learningFingerprint: learning.analysisFingerprint,
        baseProfileId: baseProfile.profileId,
        opportunityAnalysisId: baseProfile.profileId,
      }),
      context,
      alternatives: Object.freeze(alternatives),
      rejectedAlternatives: Object.freeze(rejectedAlternatives),
      compatibility: Object.freeze(compatibility),
      historicalComparison,
      regimeAnalysis,
      strategyAnalysis,
      venueAnalysis,
      leakageAnalysis,
      stabilityAnalysis,
      evidenceAnalysis,
      tradeoff,
      scenarioMatrix,
      dominance,
      ranking,
      recommendation,
      explanation,
      researchContext,
      feedback: Object.freeze(feedback),
      reconciliations: Object.freeze([]),
      lineage: Object.freeze({
        contextId: context.contextId,
        baseProfileId: baseProfile.profileId,
        counterfactualIds: Object.freeze(
          alternatives.map((a) => a.counterfactualId)),
        observationIds: Object.freeze(observationIds),
        learningAnalysisId: learning.analysisId,
        valid: true as const,
      }),
      auditEvents: audit.snapshot() as readonly DecisionAuditEvent[],
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
      replay: Object.freeze({identical: false, fingerprint: ''}),
    });
    const withFingerprint = Object.freeze({
      ...result,
      analysisFingerprint: decisionAnalysisFingerprintOf({
        analysisId, alternatives: alternatives.length,
        rejected: rejectedAlternatives.length, observationIds, timestamp,
      }),
    });
    return {result: withFingerprint, audit};
  }
}
