/**
 * SPRINT 039 — dominance analysis (§9).
 *
 * Determines whether one alternative is genuinely better supported by
 * evidence — NEVER guaranteed superiority. Uses explicit evidence thresholds
 * from the configuration. Deterministic precedence:
 *   NOT_COMPARABLE → INSUFFICIENT_EVIDENCE → CONFLICTED →
 *   REGIME_DEPENDENT → STRATEGY_DEPENDENT → VENUE_DEPENDENT →
 *   DOMINANT_BY_EVIDENCE / WEAKLY_PREFERRED / NO_DOMINANT_OPTION → MIXED.
 */

import type {
  CounterfactualEvaluation, TradeOffAnalysis, TradeOffScore,
  DominanceAnalysis, DominanceState, DecisionIntelligenceConfigSpec,
  DependencyAxisAnalysis,
} from './types';
import {dominanceIdOf, contentFingerprintOf} from './ids';

/** Finds the trade-off score of one alternative. */
export function scoreOf(
  tradeoff: TradeOffAnalysis, alternativeId: string,
): TradeOffScore | undefined {
  return tradeoff.scores.find((s) => s.alternativeId === alternativeId);
}

export function analyzeDominance(
  alternatives: readonly CounterfactualEvaluation[],
  tradeoff: TradeOffAnalysis,
  regimeAxis: DependencyAxisAnalysis,
  strategyAxis: DependencyAxisAnalysis,
  venueAxis: DependencyAxisAnalysis,
  config: DecisionIntelligenceConfigSpec,
): DominanceAnalysis {
  const reasons: string[] = [];
  const exclusions: {alternativeId: string; reason: string}[] = [];

  if (alternatives.length === 0) {
    return result('NOT_COMPARABLE', null,
      ['no comparable alternatives exist — nothing to compare'], null, exclusions);
  }

  // Exclude alternatives whose evidence confidence forbids honest scoring.
  const scoreable: CounterfactualEvaluation[] = [];
  for (const a of alternatives) {
    const score = scoreOf(tradeoff, a.alternativeId);
    if (!score || score.score === null) {
      exclusions.push({
        alternativeId: a.alternativeId,
        reason: `trade-off score is null — evidence confidence ${a.confidenceState}`,
      });
    } else {
      scoreable.push(a);
    }
  }

  if (scoreable.length === 0) {
    return result('INSUFFICIENT_EVIDENCE', null,
      ['every alternative has a null trade-off score — no honest comparison possible'],
      null, exclusions);
  }

  // Insufficient evidence: no scoreable alternative reaches the dominance cohort.
  const qualified = scoreable.filter((a) =>
    a.cohortSize >= config.minDominanceCohort);
  for (const a of scoreable) {
    if (a.cohortSize < config.minDominanceCohort) {
      exclusions.push({
        alternativeId: a.alternativeId,
        reason: `cohort ${a.cohortSize} below the dominance threshold `
          + `${config.minDominanceCohort}`,
      });
    }
  }
  if (qualified.length === 0) {
    return result('INSUFFICIENT_EVIDENCE', null,
      [`no alternative reaches the minimum dominance cohort of `
        + `${config.minDominanceCohort} similar observations`], null, exclusions);
  }

  // Conflicts: never force a winner over contradictory evidence.
  const conflicted = alternatives.filter(
    (a) => a.confidenceState === 'CONFLICTED' || a.conflicts.length > 0);
  if (conflicted.length > 0) {
    return result('CONFLICTED', null, [
      `${conflicted.length} alternative(s) carry conflicting evidence `
        + `(${conflicted.map((a) => a.alternativeId).sort().join(', ')}) — `
        + `no winner is forced over contradictory evidence`,
    ], null, exclusions);
  }

  // Dependency-aware dominance: a dependency that separates the alternatives.
  if (regimeAxis.detected && regimeAxis.alternativesDiffer) {
    return result('REGIME_DEPENDENT', null, [
      'regime dependency detected and the alternatives differ across regimes '
        + `(${regimeAxis.alternativesDiffer ? 'differing regime matches' : ''})`,
      `applicable regimes preserved: ${regimeAxis.applicable.join(', ') || 'none measured'}`,
    ], null, exclusions);
  }
  if (strategyAxis.detected && strategyAxis.alternativesDiffer) {
    return result('STRATEGY_DEPENDENT', null, [
      'strategy dependency detected and the alternatives differ by strategy '
        + '— the opportunity is not universally superior',
      `supported strategies: ${strategyAxis.applicable.join(', ') || 'none measured'}`,
    ], null, exclusions);
  }
  if (venueAxis.detected && venueAxis.alternativesDiffer) {
    return result('VENUE_DEPENDENT', null, [
      'venue dependency detected and the alternatives differ by venue '
        + '— venue-specific evidence is preserved, not aggregated away',
      `venues with measured evidence: ${venueAxis.applicable.join(', ') || 'none'}`,
    ], null, exclusions);
  }

  // Score margins over the runner-up (deterministic order from the analysis).
  const ordered = tradeoff.orderedAlternativeIds
    .map((id) => scoreOf(tradeoff, id))
    .filter((s): s is TradeOffScore => s !== undefined && s.score !== null);
  const best = ordered[0];
  const runnerUp = ordered[1];
  const topMargin = runnerUp
    ? (best.score as number) - (runnerUp.score as number) : null;
  const bestId = best.alternativeId;
  const bestEvaluation = qualified.find((a) => a.alternativeId === bestId)
    ?? scoreable.find((a) => a.alternativeId === bestId);
  if (!bestEvaluation) {
    return result('NO_DOMINANT_OPTION', null,
      ['the best-scoring alternative does not qualify for dominance'], topMargin, exclusions);
  }

  if (qualified.length === 1) {
    return result('WEAKLY_PREFERRED', bestId, [
      `only one alternative qualifies for dominance (${bestId}) — `
        + 'weakly preferred because no comparison partner exists',
    ], topMargin, exclusions);
  }

  if (topMargin !== null && topMargin < config.tieBand) {
    return result('NO_DOMINANT_OPTION', null, [
      `top margin ${topMargin.toFixed(4)} is inside the tie band `
        + `${config.tieBand} — no dominant option`,
    ], topMargin, exclusions);
  }
  if (topMargin !== null && topMargin >= config.dominantMargin) {
    return result('DOMINANT_BY_EVIDENCE', bestId, [
      `${bestId} leads the runner-up by ${topMargin.toFixed(4)} `
        + `(≥ dominant margin ${config.dominantMargin}) with a qualifying cohort `
        + `(${bestEvaluation.cohortSize} similar observations) — better supported `
        + 'by existing evidence; support is not certainty',
    ], topMargin, exclusions);
  }
  if (topMargin !== null && topMargin >= config.weakMargin) {
    return result('WEAKLY_PREFERRED', bestId, [
      `${bestId} leads the runner-up by ${topMargin.toFixed(4)} `
        + `(≥ weak margin ${config.weakMargin} but < dominant margin `
        + `${config.dominantMargin}) — weakly preferred by evidence`,
    ], topMargin, exclusions);
  }

  // Evidence quality qualifier: strong margin but weak evidence → MIXED.
  const bestScore = scoreOf(tradeoff, bestId);
  const evidenceComponent = bestScore?.components.find(
    (c) => c.dimension === 'evidenceQuality');
  if (evidenceComponent && evidenceComponent.value !== null
    && evidenceComponent.value < 0.5) {
    return result('MIXED', null, [
      `${bestId} leads by ${topMargin !== null ? topMargin.toFixed(4) : 'n/a'} `
        + 'but its evidence quality is weak — mixed support',
    ], topMargin, exclusions);
  }
  return result('NO_DOMINANT_OPTION', null, [
    `top margin ${topMargin !== null ? topMargin.toFixed(4) : 'n/a'} does not `
      + 'cross any evidence threshold — no dominant option',
  ], topMargin, exclusions);

  function result(
    state: DominanceState,
    dominantAlternativeId: string | null,
    why: readonly string[],
    topMargin: number | null,
    exclusions: readonly {alternativeId: string; reason: string}[],
  ): DominanceAnalysis {
    return Object.freeze({
      state,
      dominantAlternativeId,
      reasons: Object.freeze([...why, ...reasons]),
      topMargin,
      exclusions: Object.freeze(exclusions),
      dominanceId: dominanceIdOf({state, dominantAlternativeId, why}),
      contentFingerprint: contentFingerprintOf({state, dominantAlternativeId}),
    });
  }
}
