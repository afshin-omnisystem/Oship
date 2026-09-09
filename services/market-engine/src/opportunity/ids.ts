import {sha256} from '../oiin';
import {OpportunityCandidate} from './types';

/**
 * Deterministic canonical identity for opportunities. The same logical market
 * state (the candidate's canonical content) always produces the same
 * opportunity identity across processes, snapshots and replay.
 */
export function opportunityFingerprint(c: Omit<OpportunityCandidate, 'observedAt'>): string {
  return sha256({
    domain: c.domain,
    type: c.type,
    instruments: [...c.instruments].sort(),
    venues: [...c.venues].sort(),
    market: c.market,
    direction: c.direction,
    grossEdge: c.grossEdge,
    requiredCapital: c.requiredCapital,
    risk: c.risk,
  });
}

export function opportunityId(fingerprint: string): string {
  return `opp_${fingerprint.slice(0, 24)}`;
}

export function discoveryId(correlationId: string, traceId: string, fingerprint: string, batch: number): string {
  return `disc_${fingerprint.slice(0, 12)}_${batch}_${sha256({correlationId, traceId, fingerprint, batch}).slice(0, 12)}`;
}

export function evidenceId(source: string, eventId: string, market: string, venue: string, price: number | undefined): string {
  return `ev_${sha256({source, eventId, market, venue, price}).slice(0, 20)}`;
}

export function auditId(fingerprint: string, decision: string, timestamp: number): string {
  return `aud_${sha256({fingerprint, decision, timestamp}).slice(0, 20)}`;
}
