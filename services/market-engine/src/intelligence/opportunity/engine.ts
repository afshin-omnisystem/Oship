/**
 * SPRINT 038 — the opportunity intelligence engine.
 *
 * One engine serves AFIS and ABL candidates. It consumes a VALIDATED
 * Sprint 037 LearningResult read-only and produces deterministic, immutable,
 * informational opportunity intelligence: profiles, evidence-bound scores,
 * classifications, rankings, explanations, research inputs, feedback hooks
 * and a hash-chained audit trail. The full pipeline runs twice per analysis
 * and must be byte-identical; invariants (60+) are enforced on every
 * analysis and any failure throws — fail closed.
 *
 * The engine is NOT an authority: nothing it produces authorizes, executes,
 * allocates or mutates anything. It never touches the Strategy Registry,
 * Portfolio, Risk, AEGIS, Treasury, Execution or provider credentials.
 */

import type {
  OpportunityIntelligenceInput, OpportunityIntelligenceResult,
  OpportunityIntelligenceConfigSpec, OpportunityIntelligenceConfigInput,
  OpportunityCandidate, OpportunityIntelligenceProfile, RejectedCandidate,
  OpportunityAuditEvent,
} from './types';
import {mergeOpportunityConfig, validateOpportunityConfig} from './config';
import {
  opportunityAnalysisIdOf, analysisFingerprintOf, canonicalJson,
} from './ids';
import {validateCandidate, rejectCandidate} from './candidate';
import {buildProfile} from './profile';
import {rankProfiles} from './ranking';
import {recordFeedback} from './feedback';
import {checkOpportunityInvariants, OpportunityInvariantError} from './invariants';
import {OpportunityAuditLog} from './audit';
import {compareOpportunityResults, serializeOpportunityResult} from './replay';

export class OpportunityIntelligenceEngine {
  private readonly config: OpportunityIntelligenceConfigSpec;

  constructor(configInput?: OpportunityIntelligenceConfigInput) {
    const config = mergeOpportunityConfig(configInput);
    validateOpportunityConfig(config);
    this.config = config;
  }

  get configurationFingerprint(): string {
    return canonicalJson(this.config);
  }

  analyze(input: OpportunityIntelligenceInput): OpportunityIntelligenceResult {
    this.validateInput(input);
    const first = this.runCore(input);
    const second = this.runCore(input);
    const identical = compareOpportunityResults(first.result, second.result);
    if (!identical) {
      throw new Error(
        'opportunity-intelligence: internal replay is not byte-identical — fail closed');
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: first.result.analysisFingerprint,
    });
    const withReplay: OpportunityIntelligenceResult = Object.freeze({
      ...second.result,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({
        identical: true, fingerprint: second.result.analysisFingerprint,
      }),
    });
    const invariants = checkOpportunityInvariants(withReplay, {
      candidates: input.candidates, learning: input.learning, config: this.config,
    });
    if (!invariants.passed) {
      throw new OpportunityInvariantError(invariants);
    }
    return Object.freeze({...withReplay, invariants});
  }

  private validateInput(input: OpportunityIntelligenceInput): void {
    if (input === null || typeof input !== 'object') {
      throw new Error('opportunity-intelligence: input required — fail closed');
    }
    if (!Array.isArray(input.candidates)) {
      throw new Error('opportunity-intelligence: candidates array required — fail closed');
    }
    if (input.learning === null || typeof input.learning !== 'object'
      || !Array.isArray(input.learning.observations)) {
      throw new Error(
        'opportunity-intelligence: validated learning result required — fail closed');
    }
    if (input.learning.invariants?.passed !== true) {
      throw new Error(
        'opportunity-intelligence: learning result failed its own invariants — fail closed');
    }
    if (input.learning.replay?.identical !== true) {
      throw new Error(
        'opportunity-intelligence: learning result is not replay-verified — fail closed');
    }
    if (typeof input.correlationId !== 'string' || input.correlationId.length === 0) {
      throw new Error('opportunity-intelligence: correlationId required — fail closed');
    }
    if (typeof input.traceId !== 'string' || input.traceId.length === 0) {
      throw new Error('opportunity-intelligence: traceId required — fail closed');
    }
    if (typeof input.timestamp !== 'number' || !Number.isFinite(input.timestamp)) {
      throw new Error('opportunity-intelligence: finite timestamp required — fail closed');
    }
  }

  private runCore(input: OpportunityIntelligenceInput): {
    result: OpportunityIntelligenceResult;
    audit: OpportunityAuditLog;
  } {
    const config = this.config;
    const learning = input.learning;
    const timestamp = input.timestamp;
    const analysisId = opportunityAnalysisIdOf({
      learningAnalysisId: learning.analysisId,
      candidates: input.candidates.map(
        (c) => (c as Partial<OpportunityCandidate>)?.candidateId ?? null),
      timestamp, config: config.schemaVersion,
    });
    const audit = new OpportunityAuditLog(analysisId, timestamp);
    audit.append('opportunity-received', {
      candidateCount: input.candidates.length,
      learningAnalysisId: learning.analysisId,
      correlationId: input.correlationId, traceId: input.traceId,
    });

    const profiles: OpportunityIntelligenceProfile[] = [];
    const rejected: RejectedCandidate[] = [];
    for (const raw of input.candidates) {
      const validation = validateCandidate(raw, learning);
      if ('rejected' in validation) {
        const rejection = rejectCandidate(raw, validation, timestamp);
        rejected.push(rejection);
        audit.append('candidate-rejected', {
          candidateId: rejection.candidateId, code: rejection.code,
          reason: rejection.reason,
        });
        continue;
      }
      const candidate = validation.candidate;
      // Every profile is DERIVED from the consumed learning result and is
      // associational-only by construction.
      const profile = buildProfile(candidate, learning, config, 'DERIVED');
      profiles.push(profile);
      audit.append('similarity-evaluated', {
        candidateId: candidate.candidateId,
        similarityId: profile.similarity.similarityId,
        cohortSize: profile.similarity.cohortSize,
        consideredCount: profile.similarity.consideredCount,
      });
      audit.append('evidence-evaluated', {
        candidateId: candidate.candidateId,
        evidenceId: profile.evidence.evidenceId,
        evidenceCount: profile.evidence.evidenceCount,
        confidenceState: profile.evidence.confidenceState,
      });
      audit.append('dependencies-evaluated', {
        candidateId: candidate.candidateId,
        dependenciesId: profile.dependencies.dependenciesId,
        regime: profile.dependencies.regime.detected,
        strategy: profile.dependencies.strategy.detected,
        venue: profile.dependencies.venue.detected,
      });
      audit.append('score-calculated', {
        candidateId: candidate.candidateId,
        scoreId: profile.score.scoreId,
        score: profile.score.score,
        contributingDimensions: profile.score.contributingDimensions,
      });
      audit.append('classification-selected', {
        candidateId: candidate.candidateId,
        classificationId: profile.classification.classificationId,
        classification: profile.classification.classification,
      });
      audit.append('profile-created', {
        candidateId: candidate.candidateId,
        profileId: profile.profileId,
        contentFingerprint: profile.contentFingerprint,
      });
      audit.append('explanation-generated', {
        candidateId: candidate.candidateId,
        explanationId: profile.explanation.explanationId,
      });
    }

    const rankings = rankProfiles(profiles, config);
    for (const ranking of rankings) {
      audit.append('ranking-generated', {
        domain: ranking.domain, rankingId: ranking.rankingId,
        entries: ranking.entries.length, excluded: ranking.excluded.length,
      });
    }

    const feedback = profiles.map((profile) => {
      const record = recordFeedback(profile);
      audit.append('feedback-recorded', {
        feedbackId: record.feedbackId, candidateId: record.candidateId,
        classification: record.decision.classification,
      });
      return record;
    });

    const observationIds = [...new Set(
      profiles.flatMap((p) => p.similarity.matches.map((m) => m.observationId)),
    )].sort();

    const result: OpportunityIntelligenceResult = Object.freeze({
      analysisId,
      timestamp,
      schemaVersion: 'oship.opportunity-intelligence.v1',
      correlationId: input.correlationId,
      traceId: input.traceId,
      configurationFingerprint: this.configurationFingerprint,
      analysisFingerprint: '',
      causalPolicy: 'ASSOCIATIONAL_ONLY',
      source: Object.freeze({
        learningAnalysisId: learning.analysisId,
        learningFingerprint: learning.analysisFingerprint,
        observationCount: learning.observations.length,
        regimeCount: learning.regimes.length,
      }),
      profiles: Object.freeze(profiles),
      rejected: Object.freeze(rejected),
      rankings: Object.freeze(rankings),
      feedback: Object.freeze(feedback),
      reconciliations: Object.freeze([]),
      lineage: Object.freeze({
        profileIds: Object.freeze(profiles.map((p) => p.profileId)),
        observationIds: Object.freeze(observationIds),
        learningAnalysisId: learning.analysisId,
        valid: true as const,
      }),
      auditEvents: audit.snapshot() as readonly OpportunityAuditEvent[],
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
      replay: Object.freeze({identical: false, fingerprint: ''}),
    });
    const withFingerprint = Object.freeze({
      ...result,
      analysisFingerprint: analysisFingerprintOf({
        analysisId, profiles: profiles.length, rejected: rejected.length,
        observationIds, timestamp,
      }),
    });
    return {result: withFingerprint, audit};
  }
}
