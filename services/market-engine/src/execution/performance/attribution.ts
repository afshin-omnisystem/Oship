import {
  ExecutionControlSession, AttributionResult, AttributionComponent,
  AttributionComponentName, ATTRIBUTION_COMPONENTS,
} from './types';
import {performanceAttributionId} from './ids';
import {sha256} from '../../oiin/ids';
import type {ExecutionPerformanceConfigSpec} from './config';

/**
 * Sprint 034 — deterministic execution-cost attribution.
 *
 * Decomposes the measured execution outcome into explicit components. Every
 * component carries value, source, availability and provenance. Components the
 * repository does not measure (spread cost, adverse selection) are marked
 * UNAVAILABLE with value 0 — never fabricated. The monetary reconciliation set
 * (FEES + SLIPPAGE) must reconcile against the measured total execution cost
 * (price cost + fees) within the configured tolerance.
 */

function component(
  name: AttributionComponentName,
  value: number,
  bps: number | null,
  provenance: AttributionComponent['provenance'],
  source: string,
  available: boolean,
  status: AttributionComponent['status'],
  detail: string,
): AttributionComponent {
  return Object.freeze({
    component: name, value, bps, provenance, source, available, status, detail,
    fingerprint: `pfac_${sha256({name, value, bps, provenance, source, available, detail})}`,
  });
}

/**
 * Attribute one control session's execution outcome.
 * `config` supplies the deterministic anchors for DERIVED components.
 */
export function attributeSession(session: ExecutionControlSession, config: ExecutionPerformanceConfigSpec): AttributionResult {
  if (session.cycles.length === 0) {
    throw new Error(`refusing to attribute session ${session.sessionId}: no cycles — fail closed`);
  }
  // ---- measured aggregates (order level — the ground truth of the sim)
  let fees = 0;
  let priceCost = 0;          // |exec − benchmark| × filled, signed-cost absolute
  let slippageNotional = 0;   // |slippageBps|/1e4 × benchmark × filled
  let impactNotional = 0;
  let filledNotionalBenchmark = 0;
  let filledQuantity = 0;
  for (const c of session.cycles) {
    for (const o of c.telemetry.orders) {
      if (o.filledQuantity <= 0) continue;
      const bench = c.telemetry.benchmarkPrice;
      const notional = o.filledQuantity * bench;
      fees += o.fees;
      priceCost += Math.abs(o.averageFillPrice - bench) * o.filledQuantity;
      slippageNotional += (Math.abs(c.telemetry.slippageBps) / 1e4) * notional;
      impactNotional += Number.isFinite(o.impact) ? o.impact : 0;
      filledNotionalBenchmark += notional;
      filledQuantity += o.filledQuantity;
    }
  }
  const measuredTotalCost = priceCost + fees;

  // ---- adaptation counts (applied actions, from the audit-grade session data)
  const reroutes = session.actionBudget.rerouteCount;
  const reprices = session.actionBudget.repriceCount;
  const reslices = session.actionBudget.resliceCount;
  const replans = session.actionBudget.replanCount;
  const failures = session.actionBudget.failureCount;

  // ---- remaining work (opportunity cost)
  const remaining = session.finalResult?.remainingQuantity ?? 0;
  const lastBenchmark = session.cycles[session.cycles.length - 1].telemetry.benchmarkPrice;
  const partialFillCost = remaining * lastBenchmark;

  // ---- latency (DERIVED: anchor-scaled notional proxy, explicit formula)
  const avgLatency = session.cycles.reduce((s, c) => s + c.telemetry.latencyMs, 0) / session.cycles.length;
  const latencyBps = (avgLatency / config.latencyCostAnchorMs) * 1; // 1bp per anchor-ms
  const latencyCost = (latencyBps / 1e4) * (filledNotionalBenchmark || 0);

  const bpsOf = (v: number) => filledNotionalBenchmark > 0 ? (v / filledNotionalBenchmark) * 1e4 : null;

  const components: AttributionComponent[] = [
    component('FEES', fees, bpsOf(fees), 'MEASURED', 'order-level fee sum', true, 'OK', `${fees.toFixed(6)} measured fees across ${session.cycles.length} cycle(s)`),
    component('SLIPPAGE', slippageNotional, bpsOf(slippageNotional), 'DERIVED', '|telemetry.slippageBps|/1e4 × benchmark notional', true, 'OK', `side-aware slippage vs benchmark over ${filledQuantity.toFixed(8)} filled units`),
    component('MARKET_IMPACT', impactNotional, bpsOf(impactNotional), 'MEASURED', 'order-level impact sum', true, 'OK', 'simulated market-impact notional (overlaps the slippage component by construction)'),
    component('SPREAD_COST', 0, null, 'UNAVAILABLE', 'execution telemetry carries no per-fill spread', false, 'UNAVAILABLE', 'not measured by the execution stack — spread cost is embedded in slippage vs benchmark'),
    component('ADVERSE_SELECTION', 0, null, 'UNAVAILABLE', 'no adverse-selection measurement exists', false, 'UNAVAILABLE', 'not measured by the execution stack'),
    component('LATENCY_COST', latencyCost, filledNotionalBenchmark > 0 ? latencyBps : null, 'DERIVED', `(avgLatency ${avgLatency.toFixed(0)}ms / anchor ${config.latencyCostAnchorMs}ms) × 1bp × notional`, true, 'OK', 'anchor-scaled latency cost proxy — deterministic, not a measurement'),
    component('PARTIAL_FILL_COST', partialFillCost, bpsOf(partialFillCost), 'DERIVED', 'remaining quantity × last benchmark', true, remaining > 0 ? 'OK' : 'OK', remaining > 0 ? `${remaining} unfilled units at benchmark ${lastBenchmark}` : 'nothing left unfilled'),
    component('REROUTE_COST', reroutes * config.adaptationCostAnchors.REROUTE, null, 'DERIVED', `${reroutes} reroute(s) × anchor ${config.adaptationCostAnchors.REROUTE}`, true, 'OK', 'adaptation cost anchor — deterministic'),
    component('REPRICE_COST', reprices * config.adaptationCostAnchors.REPRICE, null, 'DERIVED', `${reprices} reprice(s) × anchor ${config.adaptationCostAnchors.REPRICE}`, true, 'OK', 'adaptation cost anchor — deterministic'),
    component('RESLICE_COST', reslices * config.adaptationCostAnchors.RESLICE, null, 'DERIVED', `${reslices} reslice(s) × anchor ${config.adaptationCostAnchors.RESLICE}`, true, 'OK', 'adaptation cost anchor — deterministic'),
    component('REPLAN_COST', replans * config.adaptationCostAnchors.REPLAN, null, 'DERIVED', `${replans} replan(s) × anchor ${config.adaptationCostAnchors.REPLAN}`, true, 'OK', 'adaptation cost anchor — deterministic'),
    component('FAILURE_RECOVERY_COST', failures * config.adaptationCostAnchors.REPLAN, null, 'DERIVED', `${failures} rejected action(s) × replan anchor`, true, 'OK', 'failure/recovery cost anchor — deterministic'),
  ];

  const ordered = ATTRIBUTION_COMPONENTS.map(
    (name) => components.find((c) => c.component === name)!,
  );
  const reconciliationSet = ordered.filter((c) => c.component === 'FEES' || c.component === 'SLIPPAGE');
  const attributableTotal = reconciliationSet.reduce((s, c) => s + c.value, 0);
  const residual = measuredTotalCost - attributableTotal;
  const reconciles = Math.abs(residual) <= Math.max(config.attributionTolerance, config.attributionTolerance * measuredTotalCost);
  const unavailable = ordered.filter((c) => !c.available).map((c) => c.component);

  const body = {
    sessionId: session.sessionId,
    components: Object.freeze(ordered),
    measuredTotalCost,
    attributableTotal,
    reconciles,
    residual,
    unavailable,
  };
  return Object.freeze({
    ...body,
    attributionId: performanceAttributionId({sessionId: session.sessionId, measuredTotalCost, attributableTotal}),
    fingerprint: `pfat_${sha256(body)}`,
  });
}
