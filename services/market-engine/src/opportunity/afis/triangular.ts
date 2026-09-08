import {OpportunityCandidate} from '../types';
import {NormalizedMarketState, QuoteState} from '../market-state';
import {buildCandidate} from '../candidate';

/**
 * AFIS-02 — Triangular Arbitrage.
 *
 * Supports deterministic three-leg cycles of the form A -> B -> C -> A (e.g.
 * USDT -> BTC -> ETH -> USDT). It computes effective conversion rate, cumulative
 * fees/slippage, cycle return, required liquidity, execution confidence and net
 * edge. Rejects cycles whose final amount is not greater than the initial amount
 * after all costs, and prunes duplicate/reversed/rotated cycles.
 */
export interface TriangularConfig {
  readonly version: string;
  readonly minReturnPct: number;
  readonly maxLegs: number;
}

export const DEFAULT_TRIANGULAR_CONFIG: TriangularConfig = {
  version: 'triangular.v1',
  minReturnPct: 0.0,
  maxLegs: 3,
};

export function detectTriangularArbitrage(
  state: NormalizedMarketState,
  instruments: readonly string[],
  base: string,
  config: TriangularConfig = DEFAULT_TRIANGULAR_CONFIG,
): OpportunityCandidate[] {
  const nodes = [...new Set([...instruments, base])];
  const cycles = enumerateCycles(nodes, base, config.maxLegs);

  const candidates: OpportunityCandidate[] = [];
  const seen = new Set<string>();

  for (const cycle of cycles) {
    if (cycle.length !== 3) continue; // only pure triangles
    const [a, b, c] = cycle; // a->b, b->c, c->a
    const legs: Array<{from: string; to: string; quote: QuoteState | undefined; venue: string}> = [
      {from: a, to: b, quote: pickQuote(state, a, b), venue: venueFor(state, a, b)},
      {from: b, to: c, quote: pickQuote(state, b, c), venue: venueFor(state, b, c)},
      {from: c, to: a, quote: pickQuote(state, c, a), venue: venueFor(state, c, a)},
    ];

    if (legs.some((l) => !l.quote || l.quote.ask <= 0)) continue;

    const candidate = computeTriangle(legs as Array<{from: string; to: string; quote: QuoteState & {}; venue: string}>, base, config);
    if (!candidate) continue;

    // Canonical cycle key prevents duplicate/reversed duplicates.
    const signature = canonicalCycle([a, b, c]);
    if (seen.has(signature)) continue;
    seen.add(signature);

    candidates.push(candidate);
  }

  return candidates;
}

function computeTriangle(
  legs: Array<{from: string; to: string; quote: QuoteState; venue: string}>,
  base: string,
  config: TriangularConfig,
): OpportunityCandidate | undefined {
  // Convert base -> a -> b -> c -> base using ask prices and inverse via mid.
  const rate = (leg: {from: string; to: string; quote: QuoteState}) => {
    const q = leg.quote;
    if (q.instrument.startsWith(`${leg.from}/${leg.to}`)) return q.ask;       // quote: from/to
    if (q.instrument.startsWith(`${leg.to}/${leg.from}`)) return 1 / q.bid;   // inverse
    return q.ask;
  };

  let amount = 1;
  const fees: number[] = [];
  const slippages: number[] = [];
  const latencies: number[] = [];

  for (const leg of legs) {
    const r = rate(leg);
    if (!Number.isFinite(r) || r <= 0) return undefined;
    amount *= r;
    fees.push(leg.quote.fees);
    slippages.push(slippage(leg.quote));
    latencies.push(leg.quote.latencyMs);
  }

  const grossReturn = amount - 1;
  const cumulativeFees = fees.reduce((a, b) => a + b, 0);
  const cumulativeSlippage = slippages.reduce((a, b) => a + b, 0);
  const latencyPenalty = latencies.reduce((a, b) => a + b, 0) * 1e-6;
  const adverseSelection = legs.reduce((a, l) => a + l.quote.spread / Math.max(l.quote.mid, 1e-9), 0);
  const liquidityPenalty = Math.min(1, 1 / (1 + Math.min(...legs.map((l) => l.quote.depth))));
  const totalCost = cumulativeFees + cumulativeSlippage + latencyPenalty + adverseSelection + liquidityPenalty;
  const netReturn = grossReturn - totalCost;

  if (netReturn <= config.minReturnPct) return undefined;

  const minDepth = Math.min(...legs.map((l) => l.quote.depth));
  const minReliability = Math.min(...legs.map((l) => l.quote.reliability));
  const executionRisk = 0.15 + (1 - minReliability) * 0.6 + (minDepth > 0 ? 0 : 0.25);

  const requiredCapital = legs[0].quote.ask; // notional to run the cycle once

  return buildCandidate({
    domain: 'AFIS',
    type: 'TRIANGULAR_ARBITRAGE',
    instruments: [legs[0].from, legs[0].to, legs[1].to, base],
    venues: legs.map((l) => l.venue),
    market: `triangle:${canonicalCycle([legs[0].from, legs[0].to, legs[1].to])}`,
    direction: `${legs[0].from}->${legs[0].to}->${legs[1].to}->${base}`,
    observedAt: Math.max(...legs.map((l) => l.quote.observedAt)),
    expiresAt: Math.max(...legs.map((l) => l.quote.observedAt)) + 20_000,
    freshnessWindowMs: 20_000,
    grossEdge: grossReturn,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, minReliability)),
    executionRisk,
    risk: {
      executionRisk,
      correlationRisk: 1 - minReliability,
      liquidationRisk: 0.15,
      adverseSelectionRisk: Math.min(1, adverseSelection * 100),
      overall: Math.min(1, executionRisk * 0.5 + (1 - minReliability) * 0.3 + Math.min(1, adverseSelection * 100) * 0.2),
    },
    strategyCompatibility: ['TRIANGULAR_ARBITRAGE'],
    calculation: {amount, grossReturn, cumulativeFees, cumulativeSlippage, latencyPenalty, adverseSelection, liquidityPenalty, totalCost, netReturn, minDepth},
  });
}

function enumerateCycles(nodes: readonly string[], base: string, maxLegs: number): string[][] {
  const others = nodes.filter((n) => n !== base);
  const out: string[][] = [];
  const combos = combinations(others, maxLegs - 1);
  for (const combo of combos) {
    // Every permutation of the intermediate legs is a distinct cycle axis
    // (A->B->C vs A->C->B), but we collapse reverse/rotation via canonicalCycle.
    out.push([base, ...combo]);
  }
  return out;
}

function combinations(arr: readonly string[], k: number): string[][] {
  const result: string[][] = [];
  const combo: string[] = [];
  const walk = (start: number) => {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return result;
}

/** Normalize a cycle to a canonical rotation-independent key. */
function canonicalCycle(cycle: readonly string[]): string {
  const rotations = cycle.map((_, i) => [...cycle.slice(i), ...cycle.slice(0, i)].join('->'));
  const reversed = [...cycle].reverse();
  const revRotations = reversed.map((_, i) => [...reversed.slice(i), ...reversed.slice(0, i)].join('->'));
  return [...rotations, ...revRotations].sort()[0];
}

function pickQuote(state: NormalizedMarketState, from: string, to: string): QuoteState | undefined {
  // Try direct pair and inverse pair.
  const direct = state.quotes.get(`${from}/${to}`);
  if (direct) return firstQuote(direct);
  const inverse = state.quotes.get(`${to}/${from}`);
  if (inverse) return firstQuote(inverse);
  return undefined;
}

function venueFor(state: NormalizedMarketState, from: string, to: string): string {
  const direct = state.quotes.get(`${from}/${to}`);
  if (direct) return direct.keys().next().value ?? 'UNKNOWN';
  const inverse = state.quotes.get(`${to}/${from}`);
  return inverse?.keys().next().value ?? 'UNKNOWN';
}

function firstQuote(map: ReadonlyMap<string, QuoteState>): QuoteState | undefined {
  const first = map.values().next();
  return first.done ? undefined : first.value;
}

function slippage(q: QuoteState): number {
  if (q.depth <= 0) return 0.01;
  return Math.min(0.02, 1 / (1 + q.depth));
}
