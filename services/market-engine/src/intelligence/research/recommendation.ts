import type {ResearchRecommendation, RecommendationKind} from './types';
import {recommendationIdOf} from './ids';

/**
 * SPRINT 036 — research recommendations: what to investigate next. These are
 * research-priorities, never system actions. informational: true always.
 */

export function buildRecommendation(
  kind: RecommendationKind, subject: string, statement: string, reason: string,
): ResearchRecommendation {
  return Object.freeze({
    recommendationId: recommendationIdOf({kind, subject, statement, reason}),
    kind, subject, statement, reason,
    informational: true,
    fingerprint: recommendationIdOf({kind, subject, seal: true}),
  });
}

export function underSampledRecommendations(
  subjects: readonly {key: string; sampleSize: number; minimum: number}[],
): readonly ResearchRecommendation[] {
  return subjects
    .filter((s) => s.sampleSize < s.minimum)
    .sort((a, b) => a.sampleSize - b.sampleSize || a.key.localeCompare(b.key))
    .map((s) => buildRecommendation(
      'COLLECT_MORE_EVIDENCE', s.key,
      `Collect more historical evidence for ${s.key}`,
      `${s.sampleSize} observations < analytical minimum ${s.minimum}`,
    ));
}

export function comparabilityRecommendations(
  subjects: readonly {a: string; b: string; reasons: readonly string[]}[],
): readonly ResearchRecommendation[] {
  return subjects.map((s) => buildRecommendation(
    'REEXAMINE_COMPARABILITY', `${s.a}-vs-${s.b}`,
    `Re-examine comparability of ${s.a} vs ${s.b}`,
    s.reasons.join('; '),
  ));
}
