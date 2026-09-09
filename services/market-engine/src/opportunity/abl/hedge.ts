import {OpportunityCandidate} from '../types';
import {buildCandidate} from '../candidate';

/**
 * ABL-04 — Hedge / Middle Candidate.
 *
 * Detects deterministic situations where multiple available prices create a
 * potentially favorable hedge/middle structure. Models outcome ranges, required
 * stakes, worst-case return, best-case return, probability-weighted return,
 * capital requirement and execution uncertainty. Opportunity candidate only.
 */
export interface HedgeOutcome {
  readonly selection: string;
  readonly probability: number; // 0..1
  readonly payoutIfWins: number;
  readonly odds: number;
  readonly bookmaker: string;
}

export interface HedgeInput {
  readonly market: string;
  readonly outcomes: readonly HedgeOutcome[];
  readonly stakePool: number;
  readonly observedAt: number;
}

export function detectHedgeMiddle(input: HedgeInput): OpportunityCandidate | undefined {
  const {market, outcomes, stakePool, observedAt} = input;
  if (outcomes.length < 2) return undefined;
  if (outcomes.some((o) => o.odds <= 1 || o.probability <= 0 || o.probability > 1)) return undefined;

  // Distribute stake pool to equalize returns (Kelly-ish / arb hedge).
  const implied = outcomes.map((o) => 1 / o.odds);
  const totalImplied = implied.reduce((a, b) => a + b, 0);
  if (totalImplied <= 0) return undefined;

  const stakes = outcomes.map((o, i) => (implied[i] / totalImplied) * stakePool);

  perOutcome(outcomes, stakes);

  const returns = outcomes.map((o, i) => o.payoutIfWins ? o.payoutIfWins * stakes[i] - stakePool : (o.odds - 1) * stakes[i] - (stakePool - stakes[i]));
  // worst-case / best-case over live outcomes: if only one outcome pays.
  const worstCase = Math.min(...returns);
  const bestCase = Math.max(...returns);
  const probWeighted = outcomes.reduce((a, o, i) => a + o.probability * returns[i], 0);

  if (worstCase <= 0) return undefined; // not a favourable hedge/middle

  const requiredCapital = stakePool;
  const executionUncertainty = Math.abs(1 - totalImplied);

  return buildCandidate({
    domain: 'ABL',
    type: 'HEDGE_MIDDLE',
    instruments: [market],
    venues: outcomes.map((o) => o.bookmaker),
    market,
    direction: 'HEDGE',
    observedAt,
    expiresAt: observedAt + 30_000,
    freshnessWindowMs: 30_000,
    grossEdge: probWeighted / stakePool,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, 1 - executionUncertainty)),
    executionRisk: Math.min(1, executionUncertainty + 0.2),
    risk: {
      executionRisk: Math.min(1, executionUncertainty + 0.2),
      correlationRisk: Math.min(1, executionUncertainty),
      liquidationRisk: Math.abs(worstCase) / stakePool,
      adverseSelectionRisk: 0.1,
      overall: Math.min(1, 0.3 + executionUncertainty * 0.5),
    },
    strategyCompatibility: ['HEDGE_MIDDLE'],
    calculation: {stakes, returns, worstCase, bestCase, probWeighted, totalImplied, executionUncertainty},
  });
}

function perOutcome(outcomes: readonly HedgeOutcome[], stakes: number[]): void {
  // helper to ensure TS sees both arrays used
  void outcomes;
  void stakes;
}
