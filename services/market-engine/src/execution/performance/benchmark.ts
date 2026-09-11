import {ExecutionControlSession, BenchmarkResult, BenchmarkKind, BENCHMARK_KINDS} from './types';
import {performanceBenchmarkId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — deterministic execution benchmarks.
 *
 * Six canonical benchmark kinds, each explicitly tagged MEASURED / SIMULATED /
 * DERIVED / UNAVAILABLE — never silently mixed. Simulated-reference and
 * policy-baseline prices are supplied by the caller (the simulation gate);
 * at historical-session level they are UNAVAILABLE unless provided.
 */

export interface BenchmarkInputs {
  /** Simulated reference execution price (from the Sprint 031 sim). */
  readonly simulatedReferencePrice?: number;
  /** The baseline policy's achieved average execution price. */
  readonly policyBaselinePrice?: number;
}

function benchmark(
  sessionId: string,
  kind: BenchmarkKind,
  price: number | null,
  provenance: BenchmarkResult['provenance'],
  available: boolean,
  source: string,
  detail: string,
): BenchmarkResult {
  return Object.freeze({
    sessionId, kind, price, provenance, available, source, detail,
    fingerprint: `pfbm_${sha256({sessionId, kind, price, provenance, available, source})}`,
  });
}

/** Compute the six canonical benchmarks for one control session. */
export function benchmarkSession(session: ExecutionControlSession, inputs: BenchmarkInputs = {}): readonly BenchmarkResult[] {
  if (session.cycles.length === 0) {
    throw new Error(`refusing to benchmark session ${session.sessionId}: no cycles — fail closed`);
  }
  const results: BenchmarkResult[] = [];

  // ARRIVAL_PRICE — the benchmark price observed at the session's first cycle.
  const arrival = session.cycles[0].telemetry.benchmarkPrice;
  results.push(benchmark(session.sessionId, 'ARRIVAL_PRICE', arrival, 'MEASURED', true,
    'first cycle telemetry.benchmarkPrice', `arrival benchmark ${arrival}`));

  // DECISION_PRICE — the root plan's route reference price (decision time).
  const root = session.lineage[0] ?? null;
  const refRoute = root?.routes[0] ?? null;
  const decisionPrice = refRoute ? refRoute.referencePrice : null;
  results.push(benchmark(session.sessionId, 'DECISION_PRICE', decisionPrice, decisionPrice === null ? 'UNAVAILABLE' : 'MEASURED', decisionPrice !== null,
    'root plan route referencePrice', decisionPrice === null ? 'root plan unavailable' : `decision price ${decisionPrice}`));

  // VWAP — fill-weighted average of per-cycle benchmark prices (DERIVED).
  let notional = 0;
  let weight = 0;
  for (const c of session.cycles) {
    const cycleFilled = c.telemetry.filledQuantity;
    if (cycleFilled <= 0) continue;
    notional += c.telemetry.benchmarkPrice * cycleFilled;
    weight += cycleFilled;
  }
  const vwap = weight > 0 ? notional / weight : null;
  results.push(benchmark(session.sessionId, 'VWAP', vwap, vwap === null ? 'UNAVAILABLE' : 'DERIVED', vwap !== null,
    'fill-weighted average of per-cycle benchmark prices', vwap === null ? 'no fills to weight' : `VWAP-like ${vwap.toFixed(6)} over ${weight} units`));

  // SIMULATED_REFERENCE — supplied by the simulation gate, else unavailable.
  results.push(benchmark(session.sessionId, 'SIMULATED_REFERENCE',
    inputs.simulatedReferencePrice ?? null,
    inputs.simulatedReferencePrice === undefined ? 'UNAVAILABLE' : 'SIMULATED',
    inputs.simulatedReferencePrice !== undefined,
    'Sprint 031 simulation reference execution',
    inputs.simulatedReferencePrice === undefined ? 'no reference simulation was run for this session' : `reference price ${inputs.simulatedReferencePrice}`));

  // BEST_OBSERVED_VENUE — the venue with the lowest average |slippage|.
  const venueAgg = new Map<string, {slip: number; n: number}>();
  for (const c of session.cycles) {
    for (const v of c.telemetry.venues) {
      if (v.filledQuantity <= 0) continue;
      const agg = venueAgg.get(v.venueId) ?? {slip: 0, n: 0};
      agg.slip += Math.abs(v.slippageBps);
      agg.n += 1;
      venueAgg.set(v.venueId, agg);
    }
  }
  let bestVenue: string | null = null;
  let bestSlip = Infinity;
  for (const [venueId, agg] of [...venueAgg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const avg = agg.slip / agg.n;
    if (avg < bestSlip) { bestSlip = avg; bestVenue = venueId; }
  }
  const arrivalForVenue = arrival;
  const bestVenuePrice = bestVenue !== null && Number.isFinite(bestSlip) ? arrivalForVenue * (1 + bestSlip / 1e4) : null;
  results.push(benchmark(session.sessionId, 'BEST_OBSERVED_VENUE', bestVenuePrice, bestVenuePrice === null ? 'UNAVAILABLE' : 'DERIVED', bestVenuePrice !== null,
    bestVenue === null ? 'no venue fills observed' : `venue ${bestVenue} avg |slippage| ${bestSlip.toFixed(2)}bps applied to arrival`,
    bestVenue === null ? 'no filled venue to rank' : `best-observed venue ${bestVenue}`));

  // POLICY_BASELINE — the baseline policy's achieved price, else unavailable.
  results.push(benchmark(session.sessionId, 'POLICY_BASELINE',
    inputs.policyBaselinePrice ?? null,
    inputs.policyBaselinePrice === undefined ? 'UNAVAILABLE' : 'DERIVED',
    inputs.policyBaselinePrice !== undefined,
    'baseline policy simulation arm',
    inputs.policyBaselinePrice === undefined ? 'no baseline comparison was run for this session' : `baseline achieved ${inputs.policyBaselinePrice}`));

  const ordered = BENCHMARK_KINDS.map((k) => results.find((r) => r.kind === k)!);
  return Object.freeze(ordered.map((r) => Object.freeze({
    ...r,
    // keep ids deterministic per (session, kind)
    fingerprint: r.fingerprint,
  })));
}

/** Whether every benchmark kind is present exactly once for a session. */
export function benchmarkKindsComplete(results: readonly BenchmarkResult[]): boolean {
  const kinds = results.map((r) => r.kind);
  return BENCHMARK_KINDS.every((k) => kinds.filter((x) => x === k).length === 1);
}

export {performanceBenchmarkId};
