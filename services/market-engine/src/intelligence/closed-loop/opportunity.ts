import type {
  Opportunity, OpportunityIdentity, ClosedLoopRecord,
} from './types';
import {opportunityIdentityId, measured, unavailable} from './ids';
import {classifyOpportunity, semanticSideOf, assertFinite, assertFiniteNonNegative} from './source';
import {CLASSIFICATION_VERSION} from './types';

/**
 * SPRINT 035 — opportunity identity ingestion (§4).
 *
 * Every opportunity entering the closed loop preserves its canonical identity:
 * id/version/domain/market/instrument/venues/side/semantic side/discovery
 * timestamp/source fingerprint/theoretical edge & value/confidence/freshness/
 * evidence references. AFIS and ABL flow through the SAME ingestion path —
 * one engine, no duplicated domain implementations.
 */

export function ingestOpportunityIdentity(record: ClosedLoopRecord): OpportunityIdentity {
  const o = record.opportunity;

  // Fail closed on missing opportunity identity.
  if (!o || typeof o.opportunityId !== 'string' || o.opportunityId.length === 0) {
    throw new Error('closed-loop ingestion refused: missing opportunity identity — fail closed');
  }
  if (!o.domain || (o.domain !== 'AFIS' && o.domain !== 'ABL')) {
    throw new Error(`closed-loop ingestion refused: invalid opportunity domain "${o.domain}" — fail closed`);
  }
  if (!o.type) {
    throw new Error(`closed-loop ${o.opportunityId}: missing opportunity type — fail closed`);
  }
  if (typeof o.observedAt !== 'number' || !Number.isFinite(o.observedAt) || o.observedAt <= 0) {
    throw new Error(`closed-loop ${o.opportunityId}: invalid observedAt — fail closed`);
  }
  if (typeof o.expiresAt !== 'number' || !Number.isFinite(o.expiresAt) || o.expiresAt < o.observedAt) {
    throw new Error(`closed-loop ${o.opportunityId}: invalid expiresAt — fail closed`);
  }

  assertFiniteNonNegative(o.grossEdge, `${o.opportunityId}.grossEdge`);
  assertFiniteNonNegative(o.estimatedTotalCost, `${o.opportunityId}.estimatedTotalCost`);
  assertFinite(o.netEdge, `${o.opportunityId}.netEdge`);

  // UNKNOWN semantic side is honest for routing-direction opportunities —
  // the legs carry the actual sides; the identity never fabricates one.
  const semanticSide = semanticSideOf(o);

  const identity: OpportunityIdentity = Object.freeze({
    opportunityId: o.opportunityId,
    discoveryId: o.discoveryId,
    domain: o.domain,
    opportunityClass: classifyOpportunity(o.type),
    opportunityType: o.type,
    market: o.market,
    instruments: Object.freeze([...o.instruments]),
    venues: Object.freeze([...o.venues]),
    side: o.direction,
    semanticSide,
    observedAt: o.observedAt,
    expiresAt: o.expiresAt,
    freshness: o.freshness,
    confidence: o.confidence,
    sourceFingerprint: o.fingerprint,
    theoreticalGrossEdge: o.grossEdge,
    theoreticalCostEstimate: o.estimatedTotalCost,
    theoreticalNetEdge: o.netEdge,
    evidenceCount: o.evidence.length,
    classificationVersion: CLASSIFICATION_VERSION,
    fingerprint: opportunityIdentityId({
      opportunityId: o.opportunityId,
      discoveryId: o.discoveryId,
      domain: o.domain,
      type: o.type,
      market: o.market,
      instruments: o.instruments,
      venues: o.venues,
      side: o.direction,
      observedAt: o.observedAt,
      expiresAt: o.expiresAt,
      freshness: o.freshness,
      confidence: o.confidence,
      sourceFingerprint: o.fingerprint,
      grossEdge: o.grossEdge,
      estimatedTotalCost: o.estimatedTotalCost,
      netEdge: o.netEdge,
      evidence: o.evidence.map((e) => e.evidenceId),
      classificationVersion: CLASSIFICATION_VERSION,
    }),
  });
  return identity;
}

/** Theoretical value at the actually-deployed capital scale (§5). */
export function capitalScaleOf(record: ClosedLoopRecord): number | null {
  const required = record.opportunity.requiredCapital;
  if (!(required > 0)) return null;
  const deployed = deployedCapitalOf(record);
  if (deployed === null || deployed < 0) return null;
  return Math.max(0, Math.min(1, deployed / required));
}

/** Capital actually carried into the execution plan. */
export function deployedCapitalOf(record: ClosedLoopRecord): number | null {
  const approved = record.risk.approvedCapital;
  if (!Number.isFinite(approved) || approved < 0) return null;
  const planned = record.plan.plannedCapital;
  if (Number.isFinite(planned) && planned >= 0) {
    // Never deploy more than risk approved.
    return Math.min(approved, planned);
  }
  return approved;
}

/** Freshness-derived confidence carrier used by several attributions. */
export function freshnessConfidence(o: Opportunity): number {
  return Math.max(0, Math.min(1, o.freshness));
}

export {measured, unavailable};
