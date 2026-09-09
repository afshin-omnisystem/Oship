import {ExecutionSimulationEngine} from './simulation/execution/engine';
import {venue, market, venuesList, marketsList, planLike} from './simulation/execution/test-fixtures';
import {DEFAULT_SIMULATION_CONFIG} from './simulation/execution/config';
import {buildOrder} from './simulation/execution/orders';
import {executeOrderType} from './simulation/execution/order-types';
import {compareExecutionReplay} from './simulation/execution/replay';
import {buildExecutionSimAudit} from './simulation/execution/audit';
import {chooseRecovery} from './simulation/execution/recovery';
import {
  ExecutionSimulationResult,
  ExecutionSimulationInput,
  Order,
} from './simulation/execution/types';

/**
 * Sprint 031 — Deterministic Market Microstructure & Execution Simulation
 * Engine demo.
 *
 * PAPER ONLY. This is a deterministic, replayable simulation of the execution
 * of Sprint 030 Execution Plans. It is NOT an execution authority, it does NOT
 * trade live, it does NOT mutate Treasury / Portfolio / Risk, and it NEVER
 * bypasses AEGIS. No `Date.now` / `Math.random` / random UUID — everything is
 * canonical and reproducible.
 */

const NOW = 1704067200000;
const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);

function run(input: Omit<ExecutionSimulationInput, 'startTime' | 'correlationId' | 'traceId' | 'aegisAuthorized' | 'treasuryAuthorized'>): ExecutionSimulationResult {
  return engine.simulate({
    ...input,
    startTime: NOW,
    correlationId: 'demo',
    traceId: 'demo-trace',
    aegisAuthorized: true,
    treasuryAuthorized: true,
  });
}

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(4) : 'n/a';
}
function money(v: number): string {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 + '' : 'n/a';
}
function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function line(title: string, value: string): string {
  return `  ${title.padEnd(30)} ${value}`;
}

function renderMetrics(r: ExecutionSimulationResult): string[] {
  const m = r.metrics;
  return [
    line('fillRatio', pct(m.fillRatio)),
    line('completionRatio', pct(m.completionRatio)),
    line('averagePrice', money(m.averagePrice)),
    line('vwap', money(m.vwap)),
    line('slippageBps', fmt(m.slippageBps)),
    line('fees', money(m.fees)),
    line('grossCost', money(m.grossCost)),
    line('netCost', money(m.netCost)),
    line('latencyMs', fmt(m.latencyMs)),
    line('marketImpact', money(m.marketImpact)),
    line('cancelRatio', pct(m.cancelRatio)),
    line('rejectRatio', pct(m.rejectRatio)),
    line('filledQuantity', `${m.filledQuantity}`),
    line('submittedQuantity', `${m.submittedQuantity}`),
    line('plannedQuantity', `${m.plannedQuantity}`),
    line('orders', `${m.orderCount}`),
    line('fills', `${m.fillCount}`),
  ];
}

function renderPosition(r: ExecutionSimulationResult): string[] {
  const p = r.position;
  return [
    line('instrument', p.instrument),
    line('domain', p.domain),
    line('netPosition', `${p.netPosition}`),
  ];
}

function renderReconciliation(r: ExecutionSimulationResult): string[] {
  const rc = r.reconciliation;
  return [
    line('balanced', rc.balanced ? 'YES' : 'NO'),
    line('plannedQuantity', `${rc.plannedQuantity}`),
    line('submittedQuantity', `${rc.submittedQuantity}`),
    line('filledQuantity', `${rc.filledQuantity}`),
    line('cancelledQuantity', `${rc.cancelledQuantity}`),
    line('remainingQuantity', `${rc.remainingQuantity}`),
    line('positionDelta', `${rc.positionDelta}`),
    line('capitalDelta', money(rc.capitalDelta)),
    line('fees', money(rc.fees)),
    line('slippage', fmt(rc.slippage)),
    line('fingerprint', rc.fingerprint.slice(0, 20) + '...'),
  ];
}

function renderQuality(r: ExecutionSimulationResult): string[] {
  const q = r.quality;
  const factors = q.factors.map((f) => `    ${f.name.padEnd(22)} w=${f.weight.toFixed(2)}  value=${f.value.toFixed(3)}  contrib=${f.contribution.toFixed(3)}`);
  return [line('score', q.score.toFixed(4)), line('verdict', q.verdict), ...factors];
}

function main(): void {
  const parts: string[] = [];
  const sep = '='.repeat(78);

  parts.push(`
${sep}
 OSHIP — SPRINT 031
 DETERMINISTIC MARKET MICROSTRUCTURE & EXECUTION SIMULATION ENGINE
${sep}

Canonical authority flow:
  Human → AETHER → OSHIP Core
    → Opportunity → Strategy → Allocation → Risk Decision
    → AEGIS → Treasury Authorization → Execution Plan
    → SIMULATION MARKET → ORDERS → MATCHING ENGINE → FILLS
    → POSITION → RECONCILIATION → REPLAY

  SIMULATION ≠ EXECUTION AUTHORITY.
  SIMULATION ≠ LIVE TRADING.
  PAPER EXECUTION ONLY.   No real-money movement.   No provider credentials.

  Deterministic: same input → same orders/fills/metrics/fingerprint.
  No Date.now / Math.random / random UUID in canonical math.
  Consumers Sprint 030 Execution Plans. Runs a single shared simulation infra
  for AFIS and ABL strategies (no ABL-specific simulator).`);

  // ---------------------------------------------------------------------------
  // 1) FULL FILL
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})]),
    });
    parts.push(`
--- [1] FULL FILL (deep book, MARKET) ---
  Execution Plan ${r.plan.executionPlanId.slice(0, 24)}...  strategy=${r.plan.strategyType}
  Requested 10 @ ~100; book shows 100 units at 100 → complete fill.
${renderMetrics(r).join('\n')}
  Position:
${renderPosition(r).join('\n')}
  Reconciliation:
${renderReconciliation(r).join('\n')}
  Atomic groups: ${r.atomicGroups.length ? r.atomicGroups.map((g) => `${g.status}(${g.recoveryAction ?? 'none'})`).join(' ') : 'none'}
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 2) PARTIAL FILL
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 4}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 4}]})]),
    });
    parts.push(`
--- [2] PARTIAL FILL (thin book) ---
  Requested 10; only 4 units rest at 100 → filled 4, remaining 6.
  Quantity conservation: filled + remaining = requested.
${renderMetrics(r).join('\n')}
  Position netPosition = ${r.position.netPosition}
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 3) SLIPPAGE (multi-level consumption)
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 5}, {price: 102, quantity: 10}, {price: 103, quantity: 5}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 5}, {price: 102, quantity: 10}, {price: 103, quantity: 5}]})]),
    });
    const fills = r.fills.map((f) => `    @${f.price} x${f.quantity}  (gross=${money(f.grossNotional)}, fee=${money(f.fee)})`).join('\n');
    parts.push(`
--- [3] SLIPPAGE + FEES (consume three price levels) ---
  Book: 5 @100, 10 @102, 5 @103. Requested 20 (MARKET).
  Actual fills consume best→worst; VWAP > reference → realized slippage.
${fills}
${renderMetrics(r).join('\n')}
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 4) IOC
  // ---------------------------------------------------------------------------
  {
    const m = market({venue: 'ven-a', asks: [{price: 100, quantity: 5}]});
    const o = buildOrder({
      planId: 'plan', routeId: 'r', sliceId: 's', venueId: 'ven-a', instrumentId: 'BTC/USDT',
      side: 'BUY', orderType: 'IOC', quantity: 10, limitPrice: 0, timeInForce: 'IOC', createdAt: NOW, sequence: 0,
    });
    const fee = (q: number, p: number) => {
      const gross = Math.round(q * p * 100) / 100;
      const f = Math.round((gross * 8 / 10_000) * 100) / 100;
      return {grossNotional: gross, fee: f, netNotional: gross + f};
    };
    const res = executeOrderType(m, o, NOW, 0, fee, 100);
    parts.push(`
--- [4] IOC (execute available, cancel remainder) ---
  Requested 10; book rest 5 @100.
  → filled ${res.filledQuantity}, remaining ${res.remainingQuantity}, status=${res.status}
  No residual live order (IOC cancels the rest). INVARIANTS: partial fill allowed, no live remainder.`);
  }

  // ---------------------------------------------------------------------------
  // 5) FOK (atomic all-or-nothing)
  // ---------------------------------------------------------------------------
  {
    const mFull = market({venue: 'ven-a', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
    const oFull = buildOrder({
      planId: 'plan', routeId: 'r', sliceId: 's', venueId: 'ven-a', instrumentId: 'BTC/USDT',
      side: 'BUY', orderType: 'FOK', quantity: 10, limitPrice: 0, timeInForce: 'FOK', createdAt: NOW, sequence: 0,
    });
    const fee = (q: number, p: number) => {
      const gross = Math.round(q * p * 100) / 100;
      const f = Math.round((gross * 8 / 10_000) * 100) / 100;
      return {grossNotional: gross, fee: f, netNotional: gross + f};
    };
    const full = executeOrderType(mFull, oFull, NOW, 0, fee, 100);

    const mThin = market({venue: 'ven-a', asks: [{price: 100, quantity: 5}]});
    const thin = executeOrderType(mThin, oFull, NOW, 0, fee, 100);
    parts.push(`
--- [5] FOK (atomic all-or-nothing) ---
  Depth sufficient (20 @100-101): status=${full.status}, filled=${full.filledQuantity}, fills=${full.fills.length}
  Depth insufficient (5 @100):      status=${thin.status}, filled=${thin.filledQuantity}, fills=${thin.fills.length}
  FOK never partially fills — atomic failure → REJECTED (no residual).`);
  }

  // ---------------------------------------------------------------------------
  // 6) POST_ONLY (never crosses
  // ---------------------------------------------------------------------------
  {
    const fee = (q: number, p: number) => {
      const gross = Math.round(q * p * 100) / 100;
      const f = Math.round((gross * 2 / 10_000) * 100) / 100;
      return {grossNotional: gross, fee: f, netNotional: gross + f};
    };
    const mkOrder = (limit: number): Order => buildOrder({
      planId: 'plan', routeId: 'r', sliceId: 's', venueId: 'ven-a', instrumentId: 'BTC/USDT',
      side: 'BUY', orderType: 'POST_ONLY', quantity: 10, limitPrice: limit, timeInForce: 'GTC', createdAt: NOW, sequence: 0,
    });
    // Marketable: ask @100, buy limit 101 → crosses → REJECTED.
    const mCross = market({venue: 'ven-a', asks: [{price: 100, quantity: 10}]});
    const reject = executeOrderType(mCross, mkOrder(101), NOW, 0, fee, 100);
    // Not marketable: ask @101, buy limit 100 → rests → UNFILLED.
    const mRest = market({venue: 'ven-a', asks: [{price: 101, quantity: 10}]});
    const rest = executeOrderType(mRest, mkOrder(100), NOW, 0, fee, 100);
    parts.push(`
--- [6] POST_ONLY (never crosses the book) ---
  Buy limit 101 vs ask @100  → marketable → status=${reject.status}, fills=${reject.fills.length} (REJECTED)
  Buy limit 100 vs ask @101  → not marketable → status=${rest.status}, fills=${rest.fills.length} (rests)
  POST_ONLY never crosses; it never takes liquidity.`);
  }

  // ---------------------------------------------------------------------------
  // 7) MULTI-VENUE (unified position, no per-venue authority)
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [
        {routeId: 'rA', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
        {routeId: 'rB', venue: 'ven-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
        {routeId: 'rC', venue: 'ven-c', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
      ]}),
      venues: venuesList([
        venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]})}),
        venue({venue: 'ven-b', market: market({venue: 'ven-b', asks: [{price: 100, quantity: 20}]})}),
        venue({venue: 'ven-c', market: market({venue: 'ven-c', asks: [{price: 101, quantity: 20}]})}),
      ]),
      markets: marketsList([
        market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]}),
        market({venue: 'ven-b', asks: [{price: 100, quantity: 20}]}),
        market({venue: 'ven-c', asks: [{price: 101, quantity: 20}]}),
      ]),
    });
    parts.push(`
--- [7] MULTI-VENUE (three independent venues, ONE unified position) ---
  Route A (ven-a @100) = 5, Route B (ven-b @100) = 5, Route C (ven-c @101) = 5.
  Fills per venue:
${r.fills.map((f) => `    ${f.venueId.padEnd(8)} ${f.side.padEnd(4)} ${f.quantity} @ ${money(f.price)}`).join('\n')}
  Position (no per-venue authority):
${renderPosition(r).join('\n')}
  Unified reconciliation:
${renderReconciliation(r).join('\n')}
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 8) VENUE FAILURE
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [
        {routeId: 'rA', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
        {routeId: 'rB', venue: 'ven-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
      ]}),
      venues: venuesList([
        venue({venue: 'ven-a', health: 'UNAVAILABLE', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]})}),
        venue({venue: 'ven-b', market: market({venue: 'ven-b', asks: [{price: 100, quantity: 20}]})}),
      ]),
      markets: marketsList([
        market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]}),
        market({venue: 'ven-b', asks: [{price: 100, quantity: 20}]}),
      ]),
    });
    const rec = chooseRecovery('VENUE_UNAVAILABLE');
    parts.push(`
--- [8] VENUE FAILURE (ven-a UNAVAILABLE) ---
  UNAVAILABLE venues accept NO new orders (fail closed); remaining routes fill.
  Fills: ${r.fills.length}  venues: ${[...new Set(r.fills.map((f) => f.venueId))].join(', ')}
  netPosition = ${r.position.netPosition} (ven-a contributed 0)
  Recovery class for VENUE_UNAVAILABLE → ${rec.action} (respects AEGIS=${rec.respectAegis}, Treasury=${rec.respectTreasury})
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 9) ATOMIC FAILURE (all-or-nothing group)
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({
        strategyType: 'TRIANGULAR_ARBITRAGE',
        routes: [
          {routeId: 'leg-1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
          {routeId: 'leg-2', venue: 'ven-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 10, referencePrice: 99},
        ],
        slices: [
          {sliceId: 'slice-1', routeId: 'leg-1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10},
          {sliceId: 'slice-2', routeId: 'leg-2', venue: 'ven-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 10},
        ],
        legs: [
          {legId: 'leg-1', quantity: 10, venue: 'ven-a', instrument: 'BTC/USDT', mandatory: true},
          {legId: 'leg-2', quantity: 10, venue: 'ven-b', instrument: 'BTC/USDT', mandatory: true},
        ],
      }),
      venues: venuesList([
        venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})}),
        venue({venue: 'ven-b', market: market({venue: 'ven-b', bids: [{price: 99, quantity: 3}]})}),
      ]),
      markets: marketsList([
        market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]}),
        market({venue: 'ven-b', bids: [{price: 99, quantity: 3}]}),
      ]),
      atomicPolicy: 'REROUTE',
    });
    const group = r.atomicGroups[0];
    parts.push(`
--- [9] ATOMIC FAILURE (TRIANGULAR_ARBITRAGE, all-or-nothing) ---
  Leg 1 BUY 10 @ ven-a fills (100 @100). Leg 2 SELL 10 @ ven-b only 3 @99.
  Leg 2 incomplete → atomic group cannot complete → deterministic recovery.
  Group: strategyType=${group.strategyType}  required=${group.required}
    status=${group.status}  recoveryAction=${group.recoveryAction}  reason="${group.reason}"
  Service executes the configured policy (REROUTE); it never invents strategy.
  INVARIANTS: ${r.invariantsSatisfied ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // 10) LATENCY (composable, deterministic)
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', latencyMs: 60, networkLatencyMs: 30, market: market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 20}]})]),
    });
    const base = DEFAULT_SIMULATION_CONFIG.latencyModel;
    const composed = base.networkMs + base.venueMs + base.matchingMs + base.ackMs;
    parts.push(`
--- [10] LATENCY (network + venue + matching + ack) ---
  Config latency components: network=${base.networkMs}ms venue=${base.venueMs}ms
                            matching=${base.matchingMs}ms ack=${base.ackMs}ms
  Base composed latency = ${composed}ms; simulated avg = ${fmt(r.metrics.latencyMs)}ms
  Deterministic, composable, no random jitter. Market-impact cost = ${money(r.metrics.marketImpact)}.`);
  }

  // ---------------------------------------------------------------------------
  // 11) REPLAY (run twice → identical)
  // ---------------------------------------------------------------------------
  {
    const input = {
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 4}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 4}]})]),
    };
    const a = run(input);
    const b = run(input);
    const replay = compareExecutionReplay(a, b);
    parts.push(`
--- [11] REPLAY DETERMINISM ---
  Same plan + market + venue + config + timestamp, run twice.
  identicalOrders=${replay.identicalOrders} identicalFills=${replay.identicalFills} identicalVwap=${replay.identicalVwap}
  identicalFees=${replay.identicalFees} identicalLatency=${replay.identicalLatency} identicalPositions=${replay.identicalPositions}
  identicalReconciliation=${replay.identicalReconciliation} identicalFingerprint=${replay.identicalFingerprint}
  Replay verdict: ${replay.identical ? 'PASS' : 'FAIL'}${replay.mismatches.length ? `  mismatches=${replay.mismatches.join(', ')}` : ''}`);
  }

  // ---------------------------------------------------------------------------
  // 12) RECONCILIATION + AUDIT
  // ---------------------------------------------------------------------------
  {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})]),
    });
    const audit = buildExecutionSimAudit(r);
    parts.push(`
--- [12] RECONCILIATION + AUDIT (oship.execution-sim.v1) ---
  Reconciliation:
${renderReconciliation(r).join('\n')}
  Quality score:
${renderQuality(r).join('\n')}
  Audit record:
    schema        : ${audit.schemaVersion}
    simulationId  : ${audit.simulationId.slice(0, 24)}...
    planId        : ${audit.planId.slice(0, 24)}...
    orders/fills  : ${audit.orders.length} / ${audit.fills.length}
    venues        : ${audit.venues.join(', ')}
    fees/slippage : ${money(audit.fees)} / ${fmt(audit.slippage)}
    latency       : ${fmt(audit.latency)}ms
    marketImpact  : ${money(audit.marketImpact)}
    status        : ${audit.status}
    configVersion : ${audit.configVersions.simulation_config_version}`);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const sanity = (() => {
    const r = run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})]),
    });
    const replay = compareExecutionReplay(r, run({
      plan: planLike({routes: [{routeId: 'r1', venue: 'ven-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
      venues: venuesList([venue({venue: 'ven-a', market: market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})})]),
      markets: marketsList([market({venue: 'ven-a', asks: [{price: 100, quantity: 100}]})]),
    }));
    return {reconciled: r.reconciliation.balanced, replayPass: replay.identical, invariantsPass: r.invariantsSatisfied};
  })();

  parts.push(`
${sep}
 SYSTEM STATUS
${sep}
  RECONCILED   : ${sanity.reconciled ? 'PASS' : 'FAIL'}
  REPLAY       : ${sanity.replayPass ? 'PASS' : 'FAIL'}
  INVARIANTS   : ${sanity.invariantsPass ? 'PASS' : 'FAIL'}
${sep}
 SIMULATION ≠ EXECUTION AUTHORITY. SIMULATION ≠ LIVE TRADING. PAPER ONLY.
${sep}`);

  console.log(parts.join('\n'));
}

main();
