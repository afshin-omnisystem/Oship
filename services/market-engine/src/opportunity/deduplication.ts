import {Opportunity} from './types';

/**
 * Deterministic opportunity deduplication. Equivalent opportunities from
 * multiple events, snapshots, agents or discovery passes collapse into the same
 * canonical identity (keyed on the opportunity fingerprint). Deduplication is
 * deterministic across processes and replay.
 */

export class OpportunityDeduplicator {
  private readonly byFingerprint = new Map<string, Opportunity>();

  /** Add/merge an opportunity. Returns the canonical surviving record. */
  add(opportunity: Opportunity): Opportunity {
    const existing = this.byFingerprint.get(opportunity.fingerprint);
    if (!existing) {
      this.byFingerprint.set(opportunity.fingerprint, opportunity);
      return opportunity;
    }
    // Merge: prefer the most recent, aggregate confidence, union evidence/events.
    const merged: Opportunity = Object.freeze({
      ...(opportunity.observedAt >= existing.observedAt ? opportunity : existing),
      confidence: 1 - (1 - existing.confidence) * (1 - opportunity.confidence),
      evidence: dedupeEvidence(existing, opportunity),
      sourceEvents: [...new Set([...existing.sourceEvents, ...opportunity.sourceEvents])],
      rank: opportunity.rank ?? existing.rank,
    });
    this.byFingerprint.set(opportunity.fingerprint, merged);
    return merged;
  }

  has(fingerprint: string): boolean {
    return this.byFingerprint.has(fingerprint);
  }

  all(): readonly Opportunity[] {
    return [...this.byFingerprint.values()];
  }

  count(): number {
    return this.byFingerprint.size;
  }
}

function dedupeEvidence(a: Opportunity, b: Opportunity): readonly import('./types').EvidenceRef[] {
  const byId = new Map<string, import('./types').EvidenceRef>();
  for (const e of [...a.evidence, ...b.evidence]) {
    if (!byId.has(e.evidenceId)) byId.set(e.evidenceId, e);
  }
  return [...byId.values()];
}
