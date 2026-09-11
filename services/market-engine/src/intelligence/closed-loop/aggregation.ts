import type {
  ClosedLoopRecordAnalysis, DomainScorecard, ComparableGroup, ComparableGroupKey,
  OpportunityDomain, OpportunityClass,
} from './types';
import type {ClosedLoopConfigSpec} from './config';
import type {Band, FreshnessBandKind} from './source';
import {domainScorecardFingerprint, derived, unavailable} from './ids';
import {meanValue, weightedMean} from './attribution';
import {liquidityBand, freshnessBand, riskBand, deterministicSort} from './source';

/**
 * SPRINT 035 — unified domain analytics (§18) and comparable groups (§21).
 *
 * AFIS vs ABL through ONE engine — no duplicated domain implementations.
 * Comparable analysis groups observations under equivalent conditions and
 * never silently mixes incomparable observations.
 */

export function buildDomainScorecards(
  analyses: readonly ClosedLoopRecordAnalysis[],
): readonly DomainScorecard[] {
  const domains: OpportunityDomain[] = ['AFIS', 'ABL'];
  const scorecards: DomainScorecard[] = [];
  for (const domain of domains) {
    const list = analyses.filter((a) => a.identity.domain === domain);
    if (list.length === 0) continue;
    const completed = list.filter((a) => a.execution.finalState === 'COMPLETED');

    scorecards.push(Object.freeze({
      domain,
      opportunityVolume: list.length,
      theoreticalValue: list.reduce((s, a) => s + a.theoretical.theoreticalNetEdge.value!, 0),
      realizedValue: meanValue(list.map((a) => a.realized.realizedNetValue), 'mean realized net value'),
      preservation: meanValue(list.map((a) => a.realized.preservationRatio), 'mean preservation ratio'),
      leakage: meanValue(list.map((a) => a.realized.totalLeakage), 'mean total leakage'),
      executionSuccess: derived(list.length > 0 ? completed.length / list.length : 0,
        'completed ÷ total in domain'),
      averageQuality: meanValue(list.map((a) => a.strategy.strategyQuality), 'mean Sprint 034 quality'),
      capitalEfficiency: meanValue(list.map((a) => a.capital.allocationEfficiency), 'mean allocation efficiency'),
      venueEfficiency: meanValue(
        list.map((a) => meanValue(a.venue.venues.map((v) => v.fillEfficiency), 'venue fill efficiency')),
        'mean venue fill efficiency'),
      strategyEfficiency: meanValue(list.map((a) => a.capital.valuePerUnitCapital), 'mean value per unit capital'),
      fingerprint: domainScorecardFingerprint({
        domain, volume: list.length, completed: completed.length,
        theoretical: list.reduce((s, a) => s + a.theoretical.theoreticalNetEdge.value!, 0),
        realized: list.map((a) => a.realized.realizedNetValue.value),
      }),
    }));
  }
  return Object.freeze(scorecards);
}

export function comparableGroupKeyOf(
  analysis: ClosedLoopRecordAnalysis, config: ClosedLoopConfigSpec,
): ComparableGroupKey {
  const o = analysis.identity;
  const primaryVenue = analysis.venue.venues[0]?.venue ?? o.venues[0] ?? 'unknown';
  const liq = liquidityBand(
    analysis.capital.deployedCapital, config.liquidityBands.low, config.liquidityBands.high);
  const fresh = freshnessBand(o.freshness, config.staleFreshnessThreshold, config.veryFreshThreshold);
  const risk = riskBand(analysis.risk.riskScore, config.riskBands.low, config.riskBands.high);
  return Object.freeze({
    opportunityClass: o.opportunityClass,
    domain: o.domain,
    strategyId: analysis.strategy.strategyId,
    venue: primaryVenue,
    policyVersion: analysis.policy.policyVersion,
    liquidityBand: liq as Band,
    freshnessBand: fresh as FreshnessBandKind,
    riskBand: risk as Band,
  });
}

export function buildComparableGroups(
  analyses: readonly ClosedLoopRecordAnalysis[], config: ClosedLoopConfigSpec,
): readonly ComparableGroup[] {
  const groups = new Map<string, ClosedLoopRecordAnalysis[]>();
  for (const a of analyses) {
    const key = JSON.stringify(comparableGroupKeyOf(a, config));
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  const out: ComparableGroup[] = [];
  for (const [keyStr, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const key = JSON.parse(keyStr) as ComparableGroupKey;
    const comparable = list.length >= config.minComparableGroupSize;
    const avgTheoretical = list.length > 0
      ? list.reduce((s, a) => s + a.theoretical.theoreticalNetEdge.value!, 0) / list.length
      : 0;
    out.push(Object.freeze({
      key,
      opportunityIds: Object.freeze(list.map((a) => a.identity.opportunityId).sort()),
      averageTheoreticalEdge: avgTheoretical,
      averageRealizedValue: meanValue(list.map((a) => a.realized.realizedNetValue), 'mean realized value in group'),
      averagePreservation: meanValue(list.map((a) => a.realized.preservationRatio), 'mean preservation in group'),
      comparable,
      insufficientDataReason: comparable
        ? null
        : `group has ${list.length} observation(s) — below minComparableGroupSize ${config.minComparableGroupSize}; not compared`,
      fingerprint: domainScorecardFingerprint({key, ids: list.map((a) => a.identity.opportunityId)}),
    }));
  }
  return Object.freeze(out);
}

/** Cross-domain comparison — analytical only. */
export function compareDomains(
  scorecards: readonly DomainScorecard[],
): {readonly afis: DomainScorecard | null; readonly abl: DomainScorecard | null;
    readonly higherPreservation: OpportunityDomain | null} {
  const afis = scorecards.find((s) => s.domain === 'AFIS') ?? null;
  const abl = scorecards.find((s) => s.domain === 'ABL') ?? null;
  let higher: OpportunityDomain | null = null;
  if (afis && abl) {
    const a = afis.preservation.value;
    const b = abl.preservation.value;
    if (a !== null && b !== null) higher = a >= b ? 'AFIS' : 'ABL';
  }
  return Object.freeze({afis, abl, higherPreservation: higher});
}

export {weightedMean, unavailable, deterministicSort};
