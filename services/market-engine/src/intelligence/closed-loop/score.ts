import type {
  ClosedLoopRecord, OpportunityPreservationScore, PreservationGrade,
} from './types';
import {scoreFingerprint, derived, unavailable} from './ids';
import {realizedOpportunityValue} from './realized';
import {recordSessionView} from './performance';
import type {ClosedLoopConfigSpec} from './config';

/**
 * SPRINT 035 — deterministic preservation scoring.
 *
 * The preservation score answers one question: how much of the original
 * opportunity value survived the full lifecycle? 100% preservation → 1.0.
 * Grades: A ≥ 0.9, B ≥ 0.8, C ≥ 0.65, D ≥ 0.5, F below. No ML, no
 * probabilistic scoring — pure deterministic arithmetic over measured values.
 */

export function preservationScore(
  record: ClosedLoopRecord, config: ClosedLoopConfigSpec,
): OpportunityPreservationScore {
  const o = record.opportunity;
  const realized = realizedOpportunityValue(record, config);
  const view = recordSessionView(record);
  const leakage = realized.totalLeakage.value;

  const ratio = realized.preservationRatio.value;
  const theoreticalNet = realized.theoreticalNetEdge.value;

  let score;
  if (ratio !== null) {
    score = derived(Math.max(0, Math.min(1, ratio)), 'clamped preservation ratio');
  } else if (theoreticalNet !== null && Math.abs(theoreticalNet) <= 1e-12 && realized.realizedNetValue.value !== null) {
    // Zero theoretical edge with a measured realized value: no ratio exists.
    score = unavailable<number>('score', 'theoretical net edge is zero — ratio undefined');
  } else {
    score = unavailable<number>('score', 'preservation ratio unavailable');
  }

  const grade: PreservationGrade | 'UNAVAILABLE' = score.value === null
    ? 'UNAVAILABLE'
    : score.value >= 0.9 ? 'A'
      : score.value >= 0.8 ? 'B'
        : score.value >= 0.65 ? 'C'
          : score.value >= 0.5 ? 'D'
            : 'F';

  return Object.freeze({
    opportunityId: o.opportunityId,
    preservationScore: score,
    grade,
    edgePreservationRatio: realized.preservationRatio,
    executionQuality: view.quality ? view.quality.score : null,
    leakageTotal: leakage ?? 0,
    fingerprint: scoreFingerprint({
      id: o.opportunityId,
      score: score.value,
      grade,
      leakage,
      quality: view.quality ? view.quality.score : null,
    }),
  });
}
