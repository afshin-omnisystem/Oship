import {EvidenceRef} from './types';

/**
 * Evidence binding + conflict detection. Every opportunity references the
 * evidence used to produce it. If two evidence refs for the same market/venue
 * disagree materially on price/quantity, we flag CONFLICTED rather than silently
 * picking arbitrary data.
 */

export interface EvidenceConflictResult {
  readonly conflicted: boolean;
  readonly conflictingEvidenceIds: readonly string[];
  readonly reason?: string;
}

export function detectEvidenceConflict(evidence: readonly EvidenceRef[], conflictTolerance: number): EvidenceConflictResult {
  const byKey = new Map<string, EvidenceRef[]>();
  for (const e of evidence) {
    const key = `${e.market}|${e.venue}|${e.connector}`;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  }

  const conflicting: string[] = [];
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    const prices = list.filter((e) => e.price !== undefined).map((e) => e.price as number);
    if (prices.length < 2) continue;
    const ref = prices[0];
    for (const p of prices) {
      if (ref !== 0 && Math.abs(p - ref) / Math.abs(ref) > conflictTolerance) {
        conflicting.push(...list.map((e) => e.evidenceId));
        break;
      }
    }
  }

  return Object.freeze({
    conflicted: conflicting.length > 0,
    conflictingEvidenceIds: [...new Set(conflicting)],
    reason: conflicting.length > 0 ? 'CONFLICTED_EVIDENCE' : undefined,
  });
}

/** Bind a set of source events + intelligence records into canonical evidence refs. */
export function bindEvidence(input: {
  source: string;
  connector: string;
  eventIds: readonly string[];
  observedAt: number;
  market: string;
  venue: string;
  price?: number;
  quantity?: number;
  intelligenceId?: string;
  correlationId: string;
  evidenceId: (e: {source: string; eventId: string; market: string; venue: string; price: number | undefined}) => string;
}): EvidenceRef[] {
  return input.eventIds.map((eventId) => Object.freeze({
    evidenceId: input.evidenceId({source: input.source, eventId, market: input.market, venue: input.venue, price: input.price}),
    source: input.source,
    connector: input.connector,
    eventId,
    observedAt: input.observedAt,
    market: input.market,
    venue: input.venue,
    price: input.price,
    quantity: input.quantity,
    intelligenceId: input.intelligenceId,
    correlationId: input.correlationId,
  }));
}
