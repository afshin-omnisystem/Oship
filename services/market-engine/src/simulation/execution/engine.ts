import {
  ExecutionSimulationInput,
  ExecutionSimulationResult,
  SimulationMarket,
  VenueModel,
  Order,
  Fill,
  ExecutionSlice,
  AtomicGroupState,
  SimulationConfig,
  SimulationClock,
  SliceStatus,
} from './types';
import {DEFAULT_SIMULATION_CONFIG, validateSimulationConfig} from './config';
import {createSimulationClock} from './clock';
import {buildVenue, canPlaceOrder, isDegraded} from './venue';
import {buildMarket, midPrice} from './market';
import {buildOrdersFromPlan} from './plan-bridge';
import {buildExecutionSlices, defaultSubmittedFn} from './slicing';
import {executeOrderType} from './order-types';
import {computeMetrics, RealizedSlippage} from './metrics';
import {computeQuality} from './quality';
import {computePosition, positionDelta} from './position';
import {reconcile} from './reconciliation';
import {checkInvariants} from './invariants';
import {computeMarketImpact} from './slippage';
import {resolveLatency} from './latency';
import {simulationId, simulationConfigurationFingerprint} from './ids';
import {chooseRecovery} from './recovery';
import {evaluateGroup, groupForPlan} from './atomic';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 031 — Unified Market Microstructure & Deterministic Execution
 * Simulation Engine.
 *
 * Public entrypoint. Consumes a Sprint 030 Execution Plan + a deterministic
 * set of market/venue snapshots and simulates the execution of every order to
 * canonical fills, positions, metrics, a quality score, reconciliation and an
 * audit fingerprint. PAPER ONLY — no live calls, no Treasury mutation, no
 * authority bypass.
 */

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export class ExecutionSimulationEngine {
  constructor(readonly config: SimulationConfig = DEFAULT_SIMULATION_CONFIG) {}

  simulate(input: ExecutionSimulationInput): ExecutionSimulationResult {
    const config = validateSimulationConfig({...this.config, ...(input.config ?? {})});
    this.validateAuthorization(input);
    const plan = input.plan;
    const clock: SimulationClock = createSimulationClock(input.startTime);
    const venues = input.venues;
    const markets = input.markets;

    // Resolve submitted frontier (unhealthy/halted venues get 0 submitted).
    const submittedFn = defaultSubmittedFn(
      venues.map((v) => ({venueId: v.venueId, health: v.health})),
      markets.map((m) => ({venueId: m.venueId, status: m.status})),
    );

    // 1. Build execution slices.
    const slices = buildExecutionSlices(plan, clock.sequence, submittedFn);

    // 2. Build deterministic orders from the plan + slices.
    const orders = buildOrdersFromPlan({plan, slices, venues, markets, config, clock});

    // 3. Execute each order against its venue's market.
    const fills: Fill[] = [];
    const realizedSlippages: RealizedSlippage[] = [];
    const marketImpacts: number[] = [];
    let latencyTotal = 0;

    for (const order of orders) {
      const venue = venues.find((v) => v.venueId === order.venueId);
      if (!venue || !canPlaceOrder(venue)) {
        // Venue unavailable / halted → deterministic recovery; order fails closed.
        const failure = !venue ? 'VENUE_UNAVAILABLE' : isDegraded(venue) ? 'VENUE_DEGRADED' : (venue.orderBook.status === 'HALTED' ? 'MARKET_HALT' : 'VENUE_UNAVAILABLE');
        const rec = chooseRecovery(failure, input.atomicPolicy);
        void rec;
        continue;
      }
      const market = venue.orderBook;
      const ref = midPrice(market);

      const impact = computeMarketImpact(config.marketImpactModel, {
        orderSize: order.quantity,
        availableDepth: market.depth,
        spread: market.spread,
        liquidity: venue.liquidity,
        volatilityProxy: 0.15,
        referencePrice: ref,
      });
      marketImpacts.push(impact.executionCost);

      const latency = resolveLatency(config.latencyModel, venue.latencyMs, venue.networkLatencyMs);
      latencyTotal += latency.totalLatencyMs;

      const feeFn = (q: number, p: number, source: 'MAKER' | 'TAKER') => {
        const gross = Math.round(q * p * 100) / 100;
        const bps = source === 'MAKER' ? config.feeModel.defaultMakerFeeBps : config.feeModel.defaultTakerFeeBps;
        const fee = Math.round((gross * bps / 10_000 + config.feeModel.defaultFixedFee) * 100) / 100;
        return {grossNotional: gross, fee, netNotional: Math.round((gross + fee) * 100) / 100};
      };

      const res = executeOrderType(market, order, clock.now, clock.sequence, feeFn, ref);
      fills.push(...res.fills);
      realizedSlippages.push({orderId: order.orderId, quantity: res.filledQuantity, slippageBps: res.realizedSlippageBps});
    }

    // 4. Derive slice state from orders + fills.
    const derivedSlices = deriveSliceState(slices, fills, orders);

    // 5. Position from fills.
    const position = computePosition(fills);
    const posDelta = positionDelta(fills);

    // 6. Metrics.
    const avgLatency = latencyTotal / Math.max(1, orders.length);
    const metrics = computeMetrics({
      orders,
      fills,
      slices: derivedSlices,
      avgLatencyMs: avgLatency,
      marketImpacts,
      realizedSlippages,
    });

    // 7. Atomic group evaluation.
    const atomicGroups = buildAtomicGroups(plan, fills, input.atomicPolicy ?? 'REROUTE', clock.sequence);

    // 8. Quality score.
    const quality = computeQuality({
      metrics,
      maxSlippageBps: 50,
      maxLatencyMs: config.latencyModel.networkMs + config.latencyModel.venueMs + config.latencyModel.matchingMs + 2000,
      maxFees: Math.max(10, metrics.grossCost * 0.02),
      maxImpact: Math.max(10, metrics.grossCost * 0.02),
    });

    // 9. Reconciliation.
    const reconciliation = reconcile({
      orders,
      fills,
      slices: derivedSlices,
      positionDelta: posDelta,
      slippage: metrics.slippageBps,
    });

    // 10. Invariants (fail-closed).
    const invariants = checkInvariants({
      orders,
      fills,
      slices: derivedSlices,
      atomicGroups,
      metrics,
      reconciliation,
      venues: venues.map((v) => ({venueId: v.venueId, health: v.health})),
    });

    // 11. Configuration + fingerprint.
    const cfgFp = simulationConfigurationFingerprint({
      simulationConfigVersion: config.simulationConfigVersion,
      matchingPolicyVersion: config.matchingPolicyVersion,
      feePolicyVersion: config.feePolicyVersion,
      latencyPolicyVersion: config.latencyPolicyVersion,
      slippagePolicyVersion: config.slippagePolicyVersion,
      marketImpactPolicyVersion: config.marketImpactPolicyVersion,
    });
    const fp = sha256({
      planId: plan.executionPlanId,
      orders: orders.map((o) => o.orderId),
      fills: fills.map((f) => f.fillId),
      slices: derivedSlices.map((s) => s.sliceId),
      metrics,
      reconciliation: reconciliation.fingerprint,
      position: position.netPosition,
      configFingerprint: cfgFp,
      startTime: input.startTime,
    });

    const sid = simulationId({
      planId: plan.executionPlanId,
      startTime: input.startTime,
      configFingerprint: cfgFp,
      correlationId: input.correlationId,
    });

    return Object.freeze({
      simulationId: sid,
      plan,
      simulationConfig: config,
      orders: Object.freeze(orders),
      fills: Object.freeze(fills),
      slices: Object.freeze(derivedSlices),
      atomicGroups: Object.freeze(atomicGroups),
      metrics,
      quality,
      reconciliation,
      position,
      invariantsSatisfied: invariants.satisfied,
      invariantViolations: Object.freeze(invariants.violations.map((v) => v.message)),
      fingerprint: fp,
      timestamp: input.startTime,
      correlationId: input.correlationId,
      traceId: input.traceId,
    });
  }

  private validateAuthorization(input: ExecutionSimulationInput): void {
    if (input.aegisAuthorized === false) throw new Error('execution not AEGIS-authorized');
    if (input.treasuryAuthorized === false) throw new Error('execution not Treasury-authorized');
  }
}

function buildAtomicGroups(
  plan: ExecutionSimulationInput['plan'],
  fills: readonly Fill[],
  defaultAction: AtomicGroupState['recoveryAction'],
  sequence: number,
): AtomicGroupState[] {
  const base = groupForPlan({executionPlanId: plan.executionPlanId, strategyType: plan.strategyType, legs: plan.legs}, sequence);
  if (base.legs.length === 0) return [];
  const completedByLeg: Record<string, number> = {};
  const plannedByLeg: Record<string, number> = {};
  for (const leg of plan.legs ?? []) {
    plannedByLeg[leg.legId] = leg.quantity;
    const legFills = fills.filter((f) => f.routeId === leg.legId);
    completedByLeg[leg.legId] = legFills.reduce((a, f) => a + f.quantity, 0);
  }
  const evaluated = evaluateGroup(base, completedByLeg, plannedByLeg, (defaultAction ?? 'REROUTE') as NonNullable<AtomicGroupState['recoveryAction']>);
  return [evaluated];
}

/**
 * Derive the slice-level fill/remaining/cancelled/rejected state from fills.
 *
 * `remainingQuantity` is measured against the *submitted* quantity, not the
 * planned quantity, so quantity conservation (`filled + remaining + cancelled
 * + rejected = submitted`) holds even when a venue was unavailable/halted and
 * its slice was never submitted (submittedQuantity = 0 → remaining = 0).
 */
function deriveSliceState(slices: readonly ExecutionSlice[], fills: readonly Fill[], orders: readonly Order[]): ExecutionSlice[] {
  return slices.map((slice) => {
    const sliceFills = fills.filter((f) => f.sliceId === slice.sliceId);
    const filledQuantity = round2(sliceFills.reduce((a, f) => a + f.quantity, 0));
    const sliceOrders = orders.filter((o) => o.sliceId === slice.sliceId);
    const cancelledQuantity = round2(sliceOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED').reduce((a, o) => a + o.quantity, 0));
    const rejectedQuantity = round2(sliceOrders.filter((o) => o.status === 'REJECTED' || o.status === 'FAILED').reduce((a, o) => a + o.quantity, 0));
    const submittedQuantity = round2(slice.submittedQuantity);
    const remainingQuantity = round2(Math.max(0, submittedQuantity - filledQuantity - cancelledQuantity - rejectedQuantity));
    let status: SliceStatus = 'PLANNED';
    if (submittedQuantity <= 0) status = 'PLANNED';
    else if (rejectedQuantity > 0 && filledQuantity <= 0) status = 'REJECTED';
    else if (filledQuantity >= submittedQuantity - 1e-9 && filledQuantity > 0) status = 'FILLED';
    else if (filledQuantity > 0) status = 'PARTIALLY_FILLED';
    else if (cancelledQuantity > 0) status = 'CANCELLED';
    return Object.freeze({
      ...slice,
      filledQuantity,
      cancelledQuantity,
      rejectedQuantity,
      remainingQuantity,
      submittedQuantity,
      status,
    });
  });
}
