import {EvidenceRef, OpportunityCandidate, OpportunityType, OpportunityDomain, RiskProfile} from './types';

/**
 * Shared candidate builder. Each detector produces a pre-cost candidate with a
 * gross edge; the discovery engine then runs the cost model, validation and
 * lifecycle. This keeps the detectors focused on the market logic.
 */
export interface BuildCandidateInput {
  readonly domain: OpportunityDomain;
  readonly type: OpportunityType;
  readonly instruments: readonly string[];
  readonly venues: readonly string[];
  readonly market: string;
  readonly direction: string;
  readonly observedAt: number;
  readonly expiresAt: number;
  readonly freshnessWindowMs: number;
  readonly grossEdge: number;
  readonly requiredCapital: number;
  readonly confidence: number;
  readonly executionRisk: number;
  readonly risk: RiskProfile;
  readonly strategyCompatibility: readonly string[];
  readonly calculation: Readonly<Record<string, unknown>>;
  readonly sourceEvents?: readonly string[];
  readonly evidence?: readonly EvidenceRef[];
}

export function buildCandidate(input: BuildCandidateInput): OpportunityCandidate {
  return Object.freeze({
    domain: input.domain,
    type: input.type,
    instruments: [...input.instruments],
    venues: [...input.venues],
    market: input.market,
    direction: input.direction,
    observedAt: input.observedAt,
    expiresAt: input.expiresAt,
    freshnessWindowMs: input.freshnessWindowMs,
    sourceEvents: input.sourceEvents ?? [],
    evidence: input.evidence ?? [],
    requiredCapital: input.requiredCapital,
    grossEdge: input.grossEdge,
    confidence: input.confidence,
    executionRisk: input.executionRisk,
    risk: Object.freeze(input.risk),
    strategyCompatibility: [...input.strategyCompatibility],
    calculation: Object.freeze(input.calculation),
  });
}

/** A minimal risk profile with zero risk, used when a detector does not compute one. */
export function zeroRisk(over: Partial<RiskProfile> = {}): RiskProfile {
  return Object.freeze({
    executionRisk: 0,
    correlationRisk: 0,
    liquidationRisk: 0,
    adverseSelectionRisk: 0,
    overall: 0,
    ...over,
  });
}
