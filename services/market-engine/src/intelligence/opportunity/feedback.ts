/**
 * SPRINT 038 — feedback hooks (§15).
 *
 * recordFeedback captures the decision context at assessment time (what was
 * decided, which evidence was used, classification, score).
 * reconcileOutcome later compares the historical assessment against an
 * observed result — informational only. Reconciliation NEVER rewrites the
 * profile, the audit chain or any historical evidence; disagreement is
 * recorded as a drift observation for the learning plane to consume through
 * its own validated pipeline.
 */

import type {
  OpportunityIntelligenceProfile, DecisionFeedback, ObservedOutcome,
  OutcomeReconciliation,
} from './types';
import {feedbackIdOf, reconciliationIdOf, contentFingerprintOf} from './ids';

export function recordFeedback(
  profile: OpportunityIntelligenceProfile,
): DecisionFeedback {
  return Object.freeze({
    feedbackId: feedbackIdOf({
      profileId: profile.profileId,
      classification: profile.classification.classification,
      score: profile.score.score,
    }),
    candidateId: profile.candidateId,
    profileId: profile.profileId,
    decision: Object.freeze({
      classification: profile.classification.classification,
      score: profile.score.score,
      evidenceCount: profile.evidence.evidenceCount,
    }),
    evidenceUsed: Object.freeze(
      profile.similarity.matches.map((m) => m.observationId)),
    informational: true,
    schemaVersion: 'opportunity-intelligence.feedback.v1',
    contentFingerprint: contentFingerprintOf({
      profileId: profile.profileId,
      classification: profile.classification.classification,
      evidence: profile.similarity.matches.map((m) => m.observationId),
    }),
  });
}

export function reconcileOutcome(
  profile: OpportunityIntelligenceProfile,
  observed: ObservedOutcome,
): OutcomeReconciliation {
  const classification = profile.classification.classification;
  const favorable = classification === 'HISTORICALLY_FAVORABLE';
  const unfavorable = classification === 'HISTORICALLY_UNFAVORABLE';
  let agreement: boolean | null = null;
  let disagreementKind: OutcomeReconciliation['disagreementKind'] = 'UNDETERMINABLE';
  if (favorable && observed.realizedNet > 0) {
    agreement = true;
    disagreementKind = 'NONE';
  } else if (favorable && observed.realizedNet < 0) {
    agreement = false;
    disagreementKind = 'FAVORABLE_BUT_NEGATIVE';
  } else if (unfavorable && observed.realizedNet < 0) {
    agreement = true;
    disagreementKind = 'NONE';
  } else if (unfavorable && observed.realizedNet > 0) {
    agreement = false;
    disagreementKind = 'UNFAVORABLE_BUT_POSITIVE';
  }
  const driftSignal = agreement === false
    ? `observed realizedNet ${observed.realizedNet} disagrees with historical `
      + `classification ${classification} — informational drift observation, `
      + 'history is never rewritten'
    : null;
  return Object.freeze({
    reconciliationId: reconciliationIdOf({
      profileId: profile.profileId, realizedNet: observed.realizedNet,
      agreement,
    }),
    candidateId: profile.candidateId,
    profileId: profile.profileId,
    predictedClassification: classification,
    predictedScore: profile.score.score,
    observed: Object.freeze({...observed}),
    agreement,
    disagreementKind,
    driftSignal,
    informational: true,
    schemaVersion: 'opportunity-intelligence.reconciliation.v1',
    contentFingerprint: contentFingerprintOf({
      profileId: profile.profileId, observed, agreement, disagreementKind,
    }),
  });
}
