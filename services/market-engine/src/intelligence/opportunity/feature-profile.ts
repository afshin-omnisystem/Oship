/**
 * SPRINT 038 — learned feature profile.
 *
 * Summarizes the Sprint 037 learned features for the candidate's class,
 * strategy and venues: sample sizes, classifications, mean preservation,
 * trend and stability, with honest evidence states. Class and strategy
 * lookups are domain-scoped (a class or strategy in the wrong domain is NOT
 * this candidate's history). Nothing is fabricated — missing subjects stay
 * absent, never invented.
 */

import type {
  OpportunityCandidate, FeatureProfile, LearnedSubjectSummary,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult, FeatureVector} from '../learning/types';
import {featureProfileIdOf, contentFingerprintOf} from './ids';

function stabilityOfClassification(
  learning: LearningResult, kind: string, key: string,
): string | null {
  const found = learning.stability.find(
    (s) => s.subject.kind === kind && s.subject.key === key);
  return found?.classification ?? null;
}

function strategyClassification(
  learning: LearningResult, strategyId: string, domain: string,
): string | null {
  const found = learning.strategyLearning.find(
    (s) => s.strategyId === strategyId && s.domain === domain);
  return found?.classification ?? null;
}

function classClassification(
  learning: LearningResult, opportunityClass: string, domain: string,
): string | null {
  const found = learning.opportunityLearning.find(
    (o) => o.opportunityClass === opportunityClass && o.domain === domain);
  return found?.classification ?? null;
}

function venueClassification(
  learning: LearningResult, venue: string, domain: string,
): string | null {
  const found = learning.venueLearning.find(
    (v) => v.venue === venue && v.domains.includes(domain as never));
  return found?.classification ?? null;
}

function vectorSummary(
  learning: LearningResult,
  subject: string,
  vector: FeatureVector | undefined,
  classification: string | null,
): LearnedSubjectSummary {
  if (!vector) {
    return Object.freeze({
      subject, sampleSize: 0, classification: null, meanPreservation: null,
      trend: null, stability: null, evidenceState: 'INSUFFICIENT' as const,
    });
  }
  return Object.freeze({
    subject,
    sampleSize: vector.sampleSize,
    classification,
    meanPreservation: vector.strategy.preservation,
    trend: vector.strategy.trend,
    stability: stabilityOfClassification(
      learning, vector.subject.kind, vector.subject.key),
    evidenceState: vector.evidenceState,
  });
}

export function buildFeatureProfile(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): FeatureProfile {
  // Sprint 037 feature-vector subjects: OPPORTUNITY_CLASS:<class>,
  // STRATEGY:<strategyId>, VENUE:<venue> — vectors carry a domain field
  // (or MIXED for venues) so class/strategy history stays domain-scoped.
  const classVector = learning.featureVectors.find(
    (v) => v.subject.kind === 'OPPORTUNITY_CLASS'
      && v.subject.key === candidate.opportunityClass
      && v.domain === candidate.domain);
  const strategyVector = learning.featureVectors.find(
    (v) => v.subject.kind === 'STRATEGY'
      && v.subject.key === candidate.strategyId
      && v.domain === candidate.domain);
  const classSummary = vectorSummary(
    learning,
    `OPPORTUNITY_CLASS:${candidate.opportunityClass}`,
    classVector,
    classClassification(learning, candidate.opportunityClass, candidate.domain),
  );
  const strategySummary = vectorSummary(
    learning,
    `STRATEGY:${candidate.strategyId}`,
    strategyVector,
    strategyClassification(learning, candidate.strategyId, candidate.domain),
  );
  const venueSummaries = Object.freeze(candidate.venues.map((venue) => {
    const vector = learning.featureVectors.find(
      (v) => v.subject.kind === 'VENUE' && v.subject.key === venue);
    return vectorSummary(
      learning, `VENUE:${venue}`, vector,
      venueClassification(learning, venue, candidate.domain));
  }));
  return Object.freeze({
    candidateId: candidate.candidateId,
    domain: candidate.domain,
    opportunityClass: candidate.opportunityClass,
    classSummary,
    strategySummary,
    venueSummaries,
    featureProfileId: featureProfileIdOf({
      candidateId: candidate.candidateId,
      classSubject: classSummary.subject,
      strategySubject: strategySummary.subject,
      venueSubjects: venueSummaries.map((v) => v.subject),
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, classSummary, strategySummary,
      venueSummaries,
    }),
  });
}
