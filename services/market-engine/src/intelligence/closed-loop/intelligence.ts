import type {ClosedLoopRecordAnalysis, ClosedLoopRecommendation, RecommendationKind,
  StrategyScorecard, DomainScorecard, ComparableGroup,
  ClosedLoopAction,} from './types';
import {recommendationId} from './ids';
import type {ClosedLoopConfigSpec} from './config';

/**
 * SPRINT 035 — closed-loop intelligence (§19).
 *
 * Deterministic, informational recommendations over the analyzed corpus.
 * Recommendations NEVER mutate the system: no Treasury, no Portfolio, no
 * Risk, no AEGIS, no Execution, no Strategy Registry, no policy activation.
 * Every recommendation carries its evidence.
 */

export function buildRecommendations(input: {
  readonly analyses: readonly ClosedLoopRecordAnalysis[];
  readonly strategyScorecards: readonly StrategyScorecard[];
  readonly domainScorecards: readonly DomainScorecard[];
  readonly comparableGroups: readonly ComparableGroup[];
  readonly config: ClosedLoopConfigSpec;
}): readonly ClosedLoopRecommendation[] {
  const {analyses, strategyScorecards, domainScorecards, comparableGroups, config} = input;
  const recommendations: ClosedLoopRecommendation[] = [];

  const add = (
    kind: RecommendationKind, domain: 'AFIS' | 'ABL' | 'ALL', statement: string,
    evidence: Readonly<Record<string, unknown>>,
  ): void => {
    recommendations.push(Object.freeze({
      recommendationId: recommendationId({kind, statement, evidence}),
      kind, domain, statement, evidence,
      informational: true as const,
      fingerprint: recommendationId({kind, statement, evidence}),
    }));
  };

  if (analyses.length === 0) {
    add('INSUFFICIENT_DATA', 'ALL',
      'no closed-loop records analyzed — nothing to recommend',
      {records: 0});
    return Object.freeze(recommendations);
  }

  // 1. Opportunity classes that consistently lose value during execution.
  const byClass = new Map<string, ClosedLoopRecordAnalysis[]>();
  for (const a of analyses) {
    const key = `${a.identity.domain}:${a.identity.opportunityClass}`;
    const list = byClass.get(key) ?? [];
    list.push(a);
    byClass.set(key, list);
  }
  for (const [key, list] of [...byClass.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < config.minSampleRecords) continue;
    const losing = list.filter((a) => (a.realized.preservationRatio.value ?? 0) < 0.5);
    if (losing.length === list.length) {
      add('CLASS_LOSES_VALUE', list[0].identity.domain,
        `opportunity class ${key} consistently loses value during execution (${losing.length}/${list.length} below 50% preservation)`,
        {class: key, records: list.length, preservationRatios: list.map((a) => a.realized.preservationRatio.value)});
    }
  }

  // 2. Strategy X preserves more edge than Strategy Y (same domain, enough samples).
  const comparableStrategies = strategyScorecards.filter(
    (s) => s.opportunityCount >= config.minSampleRecords && s.preservationRatio.value !== null);
  if (comparableStrategies.length >= 2) {
    const sorted = [...comparableStrategies].sort((a, b) =>
      (b.preservationRatio.value ?? 0) - (a.preservationRatio.value ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.strategyId !== worst.strategyId
      && (best.preservationRatio.value ?? 0) > (worst.preservationRatio.value ?? 0)) {
      add('STRATEGY_PRESERVES_MORE', best.domain,
        `strategy ${best.strategyId} preserves more edge than ${worst.strategyId} (${((best.preservationRatio.value ?? 0) * 100).toFixed(1)}% vs ${((worst.preservationRatio.value ?? 0) * 100).toFixed(1)}%)`,
        {best: best.strategyId, worst: worst.strategyId,
          bestPreservation: best.preservationRatio.value, worstPreservation: worst.preservationRatio.value});
    }
  }

  // 3. Venue A produces lower execution leakage for a class.
  const venueByClass = new Map<string, Map<string, number[]>>();
  for (const a of analyses) {
    const key = `${a.identity.domain}:${a.identity.opportunityClass}`;
    const venues = venueByClass.get(key) ?? new Map<string, number[]>();
    for (const leg of a.venue.venues) {
      const leakage = leg.venueLeakage.value;
      if (leakage === null) continue;
      const list = venues.get(leg.venue) ?? [];
      list.push(leakage);
      venues.set(leg.venue, list);
    }
    venueByClass.set(key, venues);
  }
  for (const [key, venues] of [...venueByClass.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const averages = [...venues.entries()]
      .filter(([, list]) => list.length >= 1)
      .map(([venue, list]) => ({venue, avg: list.reduce((s, v) => s + v, 0) / list.length}))
      .sort((a, b) => a.avg - b.avg || a.venue.localeCompare(b.venue));
    if (averages.length >= 2 && averages[0].avg < averages[averages.length - 1].avg) {
      add('VENUE_LOWER_LEAKAGE', key.split(':')[0] as 'AFIS' | 'ABL',
        `venue ${averages[0].venue} produces lower execution leakage for opportunity class ${key} than ${averages[averages.length - 1].venue}`,
        {class: key, best: averages[0].venue, bestAvgLeakage: averages[0].avg,
          worst: averages[averages.length - 1].venue, worstAvgLeakage: averages[averages.length - 1].avg});
    }
  }

  // 4. Repricing improves preservation under specific conditions.
  const repriceImproved = analyses.filter((a) =>
    a.control.occurrences.some((occ) => occ.action === 'REPRICE' && occ.improved === true));
  const repriceDegraded = analyses.filter((a) =>
    a.control.occurrences.some((occ) => occ.action === 'REPRICE' && occ.improved === false));
  if (repriceImproved.length > repriceDegraded.length && repriceImproved.length > 0) {
    add('REPRICE_IMPROVES_PRESERVATION', 'ALL',
      `repricing improves preservation under specific conditions (${repriceImproved.length} improving vs ${repriceDegraded.length} degrading sessions)`,
      {improving: repriceImproved.map((a) => a.identity.opportunityId),
        degrading: repriceDegraded.map((a) => a.identity.opportunityId)});
  }

  // 5. Reslicing improves completion but increases cost.
  const resliced = analyses.filter((a) =>
    a.control.actionCounts.RESLICE > 0 || a.execution.resliceCount > 0);
  if (resliced.length > 0) {
    const completed = resliced.filter((a) => a.execution.finalState === 'COMPLETED').length;
    const costs = resliced.map((a) => a.execution.fees);
    const avgCost = costs.reduce((s, c) => s + c, 0) / costs.length;
    add('RESLICE_COMPLETION_VS_COST', 'ALL',
      `reslicing improves completion but increases cost (${completed}/${resliced.length} resliced sessions completed; average fees ${avgCost.toFixed(4)})`,
      {sessions: resliced.length, completed, averageFees: avgCost});
  }

  // 6. A policy candidate improves execution but not end-to-end preservation.
  const candidateRecords = analyses.filter((a) => a.policy.candidatePolicyVersion !== null);
  if (candidateRecords.length > 0) {
    const notEndToEnd = candidateRecords.filter((a) =>
      (a.policy.policyDelta.value ?? 0) > 0 && (a.realized.preservationRatio.value ?? 1) < 0.5);
    if (notEndToEnd.length > 0) {
      add('POLICY_CANDIDATE_NOT_END_TO_END', 'ALL',
        `a policy candidate improves execution metrics (policy score up ${(notEndToEnd[0].policy.policyDelta.value ?? 0).toFixed(4)}) but does not improve end-to-end opportunity preservation (${notEndToEnd.length} record(s) below 50%)`,
        {records: notEndToEnd.map((a) => a.identity.opportunityId),
          policyDelta: notEndToEnd.map((a) => a.policy.policyDelta.value),
          preservation: notEndToEnd.map((a) => a.realized.preservationRatio.value)});
    }
  }

  // 7. Risk constraints protect downside while reducing theoretical value.
  const riskConstrained = analyses.filter((a) => a.risk.impactKind === 'PROTECTIVE_CONSTRAINT');
  if (riskConstrained.length > 0) {
    add('RISK_PROTECTS_DOWNSIDE', 'ALL',
      `risk constraints protect downside while reducing theoretical opportunity value (${riskConstrained.length} constrained record(s))`,
      {records: riskConstrained.map((a) => a.identity.opportunityId),
        constrainedValue: riskConstrained.map((a) => a.risk.constrainedValue)});
  }

  // 8. Insufficient data groups (never silently mixed).
  const insufficient = comparableGroups.filter((g) => !g.comparable);
  if (insufficient.length > 0) {
    add('INSUFFICIENT_DATA', 'ALL',
      `${insufficient.length} comparable group(s) have insufficient data — excluded from comparison`,
      {groups: insufficient.map((g) => JSON.stringify(g.key))});
  }

  return Object.freeze(recommendations);
}
