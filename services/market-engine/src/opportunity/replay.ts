import {OiinEvent} from '../oiin';
import {Opportunity} from './types';
import {OpportunityDiscoveryEngine, DiscoverOptions, DiscoveryResult} from './discovery-engine';

/**
 * Deterministic opportunity discovery replay. It re-runs the exact discovery on
 * the same canonical event log + configuration into a fresh engine and compares
 * the reconstructed opportunities / audit records against the live run. Replay
 * never mutates live state.
 */
export interface OpportunityReplayLog {
  readonly events: readonly OiinEvent[];
  readonly options: DiscoverOptions;
}

export class OpportunityReplay {
  private readonly live = new OpportunityDiscoveryEngine();

  /** Run the live discovery pass (mutates only the engine's own state). */
  runLive(log: OpportunityReplayLog): DiscoveryResult {
    return this.live.discoverFromEvents(log.events, log.options);
  }

  /** Replay the log into a fresh isolated engine. */
  runReplay(log: OpportunityReplayLog): DiscoveryResult {
    const replayEngine = new OpportunityDiscoveryEngine();
    return replayEngine.discoverFromEvents(log.events, log.options);
  }
}

export interface OpportunityReplayComparison {
  readonly match: boolean;
  readonly opportunitiesMatch: boolean;
  readonly idsMatch: boolean;
  readonly rankingMatch: boolean;
  readonly auditMatch: boolean;
  readonly mismatches: string[];
}

export function compareOpportunityReplay(live: DiscoveryResult, replay: DiscoveryResult): OpportunityReplayComparison {
  const mismatches: string[] = [];

  const liveOpps = live.opportunities.map((o) => o.opportunityId).sort();
  const replayOpps = replay.opportunities.map((o) => o.opportunityId).sort();
  const idsMatch = arraysEqual(liveOpps, replayOpps);
  if (!idsMatch) mismatches.push('OPPORTUNITY_IDS_DIVERGED');

  const liveCanon = canonical(live.opportunities);
  const replayCanon = canonical(replay.opportunities);
  const opportunitiesMatch = liveCanon === replayCanon;
  if (!opportunitiesMatch) mismatches.push('OPPORTUNITY_STATE_DIVERGED');

  const liveRank = live.opportunities.map((o) => `${o.opportunityId}:${o.rank?.rank ?? '-'}`).join(',');
  const replayRank = replay.opportunities.map((o) => `${o.opportunityId}:${o.rank?.rank ?? '-'}`).join(',');
  const rankingMatch = liveRank === replayRank;
  if (!rankingMatch) mismatches.push('RANKING_DIVERGED');

  const liveAudit = canonical(live.auditRecords);
  const replayAudit = canonical(replay.auditRecords);
  const auditMatch = liveAudit === replayAudit;
  if (!auditMatch) mismatches.push('AUDIT_DIVERGED');

  return {
    match: mismatches.length === 0,
    opportunitiesMatch,
    idsMatch,
    rankingMatch,
    auditMatch,
    mismatches,
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

function canonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce((acc, k) => {
      acc[k] = sortValue(o[k]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return v;
}
