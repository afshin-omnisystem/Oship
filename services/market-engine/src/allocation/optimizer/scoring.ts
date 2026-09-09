import {AllocationCandidate, AllocationPolicyKind, CandidateScore} from './types';
import {sha256} from '../../oiin';

/**
 * Deterministic allocation scoring. Every factor is explicit, bounded and
 * observable. The composite uses the same hybrid form for the HYBRID policy;
 * the policy-kind-specific policies re-weight the factors accordingly.
 */

export interface AllocationWeights {
  readonly edge: number;
  readonly confidence: number;
  readonly execution: number;
  readonly liquidity: number;
  readonly capitalEfficiency: number;
  readonly risk: number;          // penalty weight (subtract)
  readonly correlation: number;   // penalty weight (subtract)
  readonly duration: number;      // capital turnover bonus
}

export const DEFAULT_ALLOCATION_WEIGHTS: AllocationWeights = Object.freeze({
  edge: 3.0,
  confidence: 1.5,
  execution: 1.0,
  liquidity: 0.9,
  capitalEfficiency: 1.2,
  risk: 1.4,
  correlation: 0.8,
  duration: 0.6,
});

export interface AllocationScoringPolicy {
  readonly version: string;
  readonly kind: AllocationPolicyKind;
  readonly weights: AllocationWeights;
}

export const DEFAULT_ALLOCATION_SCORING_POLICY: AllocationScoringPolicy = Object.freeze({
  version: 'allocation.scoring.v1',
  kind: 'HYBRID',
  weights: DEFAULT_ALLOCATION_WEIGHTS,
});

/**
 * Compute the deterministic observable factor set for a candidate. All factors
 * are bounded to [0,1] so the composite is stable and comparable.
 */
export function allocationFactors(
  candidate: AllocationCandidate,
  weights: AllocationWeights = DEFAULT_ALLOCATION_WEIGHTS,
): Readonly<Record<string, number>> {
  const cap = Math.max(1, candidate.requiredCapital);
  const edgeNorm = clamp01(candidate.expectedEdge * 10);       // 10% edge -> 1.0
  const confidence = clamp01(candidate.confidence);
  const execution = clamp01(candidate.executionProbability);
  const liquidityRatio = clamp01(candidate.requiredCapital > 0 ? candidate.liquidity / cap : 0);
  const capEff = clamp01(candidate.capitalEfficiency * 20);    // 5% cap eff -> 1.0
  const riskFactor = clamp01(1 - candidate.risk);
  const correlationFactor = clamp01(1 - candidate.correlationFactor);
  const duration = clamp01(candidate.capitalDurationRatio);

  return Object.freeze({
    edge: edgeNorm,
    confidence,
    execution,
    liquidity: liquidityRatio,
    capitalEfficiency: capEff,
    risk: riskFactor,
    correlation: correlationFactor,
    duration,
  });
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function factorWeightForKind(kind: AllocationPolicyKind): AllocationWeights {
  switch (kind) {
    case 'FIXED':
      // Fixed allocation ignores quality factors; score is the requested cap.
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, edge: 0, confidence: 0, execution: 0, liquidity: 0, capitalEfficiency: 0, risk: 0, correlation: 0, duration: 0});
    case 'CONFIDENCE_WEIGHTED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, edge: 0, capitalEfficiency: 0, confidence: 4.0});
    case 'EDGE_WEIGHTED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, edge: 4.0, capitalEfficiency: 0, confidence: 0});
    case 'CAPITAL_EFFICIENCY_WEIGHTED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, edge: 0, confidence: 0, capitalEfficiency: 4.0});
    case 'RISK_ADJUSTED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, risk: 3.0, confidence: 1.2});
    case 'LIQUIDITY_CONSTRAINED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, edge: 0, liquidity: 4.0, execution: 1.5});
    case 'CORRELATION_ADJUSTED':
      return Object.freeze({...DEFAULT_ALLOCATION_WEIGHTS, correlation: 3.5});
    default: // HYBRID
      return DEFAULT_ALLOCATION_WEIGHTS;
  }
}

export function scoreCandidate(
  candidate: AllocationCandidate,
  policy: AllocationScoringPolicy = DEFAULT_ALLOCATION_SCORING_POLICY,
): CandidateScore {
  const w = factorWeightForKind(policy.kind);
  const c = allocationFactors(candidate, w);

  // Composite score. Higher is better; risk/correlation are subtracted.
  const composite =
    w.edge * c.edge +
    w.confidence * c.confidence +
    w.execution * c.execution +
    w.liquidity * c.liquidity +
    w.capitalEfficiency * c.capitalEfficiency +
    w.duration * c.duration +
    w.risk * c.risk +
    w.correlation * c.correlation;

  const scoreVersion = policy.version;
  const fingerprint = sha256({
    candidateId: candidate.candidateId,
    composite,
    factors: c,
    policy: policy.version,
  });

  return Object.freeze({
    candidateId: candidate.candidateId,
    allocationScore: composite,
    scoreVersion,
    factors: c,
  });
}
