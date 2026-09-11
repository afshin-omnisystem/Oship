/**
 * SPRINT 038 — venue history assessment.
 *
 * Consumes Sprint 037 VenueLearning per candidate venue. Domain-correct by
 * construction (venue learnings carry their observed domains); the fit
 * sub-score maps the venue classification deterministically; insufficient
 * venue history yields null — never a silent average.
 */

import type {
  OpportunityCandidate, VenueHistoryAssessment,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult} from '../learning/types';
import {meanOf, honest} from '../learning/source';
import {venueHistoryIdOf, contentFingerprintOf} from './ids';

export const VENUE_FIT_OF: Readonly<Record<string, number>> = Object.freeze({
  CONSISTENTLY_STRONG: 1,
  IMPROVING: 0.7,
  DETERIORATING: 0.3,
  CONSISTENTLY_WEAK: 0.2,
});

export function venueFitOf(classification: string | null): number | null {
  if (classification === null) return null;
  return VENUE_FIT_OF[classification] ?? null;
}

export function assessVenueHistory(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): readonly VenueHistoryAssessment[] {
  return Object.freeze(candidate.venues.map((venue) => {
    // Domain-scoped: venue history counts only when the venue was observed
    // in the candidate's domain (AFIS venue fills say nothing about ABL
    // bookmaker behavior on that name, and vice versa).
    const learned = learning.venueLearning.find(
      (v) => v.venue === venue && v.domains.includes(candidate.domain));
    const classification = learned?.classification ?? null;
    return Object.freeze({
      candidateId: candidate.candidateId,
      venue,
      classification,
      fillEfficiency: learned?.metrics.fillEfficiency ?? null,
      leakage: learned?.metrics.leakage ?? null,
      stability: learned?.metrics.stability ?? null,
      sampleSize: learned?.sampleSize ?? 0,
      evidenceState: learned?.evidenceState ?? 'INSUFFICIENT',
      venueFit: venueFitOf(classification),
      venueHistoryId: venueHistoryIdOf({candidateId: candidate.candidateId, venue}),
      contentFingerprint: contentFingerprintOf({
        candidateId: candidate.candidateId, venue, classification,
      }),
    });
  }));
}

/** Mean venue fit across the candidate's venues, null when none measurable. */
export function meanVenueFitOf(
  assessments: readonly VenueHistoryAssessment[],
): number | null {
  return honest(meanOf(assessments.map((a) => a.venueFit)));
}
