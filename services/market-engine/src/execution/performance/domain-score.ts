import {PerformanceObservation, DomainPerformance, OpportunityDomain} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — domain-level performance aggregation.
 *
 * ONE implementation aggregates AFIS and ABL identically (domain-neutral
 * core; the domain label is data, not logic). No separate engines.
 */

export function buildDomainScores(observations: readonly PerformanceObservation[]): readonly DomainPerformance[] {
  const domains: OpportunityDomain[] = ['AFIS', 'ABL'];
  return Object.freeze(domains.map((domain) => {
    const obs = observations.filter((o) => o.domain === domain);
    const n = obs.length;
    const sessions = new Set(obs.map((o) => o.sessionId));
    const completed = obs.filter((o) => o.finalState === 'COMPLETED').length;
    const adaptations = obs.filter((o) =>
      o.action === 'REROUTE' || o.action === 'REPRICE' || o.action === 'RESLICE' || o.action === 'REPLAN').length;
    const costBpsValues = obs
      .filter((o) => o.filledQuantity > 0 && (o.benchmarkPrice.value ?? 0) > 0)
      .map((o) => {
        const notional = o.filledQuantity * (o.benchmarkPrice.value ?? 0);
        return ((Math.abs(o.slippageBps) / 1e4) * notional + o.fees) / notional * 1e4;
      });
    const body = {
      domain,
      sessionCount: sessions.size,
      observationCount: n,
      executionQuality: n > 0 ? average(obs.map((o) => domainQualityOf(o))) : 0,
      averageCostBps: average(costBpsValues),
      successRate: n > 0 ? completed / n : 0,
      adaptationFrequency: n > 0 ? adaptations / n : 0,
      strategies: Object.freeze([...new Set(obs.map((o) => o.strategyId))].sort()),
      venues: Object.freeze([...new Set(obs.map((o) => o.venue))].sort()),
    };
    return Object.freeze({...body, fingerprint: `pfdm_${sha256(body)}`});
  }).filter((d) => d.observationCount > 0));
}

function domainQualityOf(o: PerformanceObservation): number {
  const slipPenalty = Math.min(0.5, Math.abs(o.slippageBps) / 200);
  return Math.max(0, Math.min(1, o.fillRatio - slipPenalty - (o.failure.failed ? 0.25 : 0)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Cross-domain comparison — one engine, both domains, identical rules. */
export function compareDomains(afis: DomainPerformance | undefined, abl: DomainPerformance | undefined): {better: string | null; detail: string} {
  if (!afis || !abl) return {better: null, detail: 'one domain has no observations'};
  const sa = afis.executionQuality - afis.averageCostBps / 1_000 - afis.adaptationFrequency * 0.1;
  const sb = abl.executionQuality - abl.averageCostBps / 1_000 - abl.adaptationFrequency * 0.1;
  if (Math.abs(sa - sb) < 1e-9) return {better: null, detail: 'tied'};
  return {better: sa > sb ? 'AFIS' : 'ABL', detail: `${sa > sb ? 'AFIS' : 'ABL'} scores ${Math.max(sa, sb).toFixed(4)} vs ${Math.min(sa, sb).toFixed(4)} under identical rules`};
}
