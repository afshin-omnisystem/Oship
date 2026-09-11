import {
  AdaptiveCycleSpec,
  ExecutionFeedback,
  ExecutionPlan,
  ExecutionTelemetry,
  IntelligenceCycleResult,
  IntelligenceFinalState,
  IntelligenceRunResult,
  VenueCandidate,
  VenueHealthState,
  AppliedAdaptiveAction,
  AdaptiveExecutionDecision,
} from './types';
import {AdaptiveExecutionConfig, validateAdaptiveConfig} from './config';
import {recordTelemetry, benchmarkPriceOf} from './telemetry';
import {evaluateQuality} from './quality';
import {generateSignals} from './signals';
import {buildFeedback} from './feedback';
import {AdaptiveExecutionController} from './controller';
import {assessVenueHealth} from './venue-health';
import {assessOrderAging} from './order-aging';
import {evaluateThresholds} from './thresholds';
import {checkIntelligenceInvariants} from './invariants';
import {IntelligenceAuditLog} from './audit';
import {intelligenceRunId, intelligenceRunFingerprintOf} from './ids';
import {
  ExecutionSimulationEngine,
} from '../../simulation/execution/engine';
import {
  DEFAULT_SIMULATION_CONFIG,
  validateSimulationConfig,
} from '../../simulation/execution/config';
import {
  DEFAULT_ADAPTIVE_CONFIG,
} from './config';
import type {
  ExecutionSimulationResult,
  SimulationConfig,
  SimulationMarket,
  VenueModel,
} from '../../simulation/execution/types';

/**
 * Sprint 032 — Execution Intelligence Engine.
 *
 * The deterministic closed loop:
 *
 *   Execution Plan → Simulation → Telemetry → Quality → Signals
 *      → Feedback → Adaptive Decision (KEEP / REPRICE / RESLICE / REROUTE /
 *        REPLAN / ABORT) → Execution Plan Revision → Simulation → …
 *
 * Paper/simulation only. The engine fails closed when any cycle is not
 * AEGIS-authorized and Treasury-authorized (no simulation runs at all), when
 * invariants are violated, or when the audit chain cannot be verified.
 */

export interface IntelligenceRunInput {
  readonly plan: ExecutionPlan;
  readonly cycles: readonly AdaptiveCycleSpec[];
  readonly startTime: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly config?: Partial<AdaptiveExecutionConfig>;
  readonly simConfig?: Partial<SimulationConfig>;
}

function midOf(market: SimulationMarket | undefined): number {
  if (!market) return 0;
  const bestAsk = market.asks.length > 0 ? market.asks[0].price : Infinity;
  const bestBid = market.bids.length > 0 ? market.bids[0].price : -Infinity;
  if (Number.isFinite(bestAsk) && Number.isFinite(bestBid)) return (bestAsk + bestBid) / 2;
  return market.lastPrice;
}

function spreadBpsOf(market: SimulationMarket): number {
  const mid = midOf(market);
  if (!(mid > 0)) return 0;
  const bestAsk = market.asks.length > 0 ? market.asks[0].price : mid;
  const bestBid = market.bids.length > 0 ? market.bids[0].price : mid;
  return ((bestAsk - bestBid) / mid) * 10_000;
}

/** Derive deterministic routing candidates from the cycle's venue models. */
function candidatesFromCycle(
  spec: AdaptiveCycleSpec,
  plan: ExecutionPlan,
  venueHealth: readonly VenueHealthState[],
  sim: ExecutionSimulationResult,
): readonly VenueCandidate[] {
  const explicit = spec.candidates;
  if (explicit && explicit.length > 0) return explicit;
  const primarySide = plan.routes[0]?.side ?? 'BUY';
  return spec.venues.map((v: VenueModel) => {
    const state = venueHealth.find((h) => h.venueId === v.venueId);
    const orders = sim.orders.filter((o) => o.venueId === v.venueId);
    const fills = sim.fills.filter((f) => f.venueId === v.venueId);
    const submitted = orders.reduce((s, o) => s + o.quantity, 0);
    const filled = fills.reduce((s, f) => s + f.quantity, 0);
    return Object.freeze({
      venueId: v.venueId,
      provider: v.provider,
      domain: v.domain,
      instrumentId: v.orderBook.instrumentId,
      side: plan.routes.find((r) => r.venue === v.venue || r.venue === v.venueId)?.side ?? primarySide,
      liquidity: v.liquidity,
      spreadBps: spreadBpsOf(v.orderBook),
      makerFeeBps: v.makerFeeBps,
      takerFeeBps: v.takerFeeBps,
      fixedFee: v.fixedFee,
      slippageBps: 0,
      latencyMs: v.latencyMs + v.networkLatencyMs,
      fillProbability: submitted > 0 ? Math.min(1, filled / submitted) : 1,
      executionQuality: submitted > 0 ? Math.min(1, filled / submitted) : 1,
      health: state?.state ?? 'HEALTHY',
      healthScore: state?.score ?? 1,
      currentMid: midOf(v.orderBook),
    });
  });
}

export class ExecutionIntelligenceEngine {
  readonly config: AdaptiveExecutionConfig;
  readonly simConfig: SimulationConfig;

  constructor(
    config: Partial<AdaptiveExecutionConfig> = {},
    simConfig: Partial<SimulationConfig> = {},
  ) {
    this.config = validateAdaptiveConfig({
      ...DEFAULT_ADAPTIVE_CONFIG,
      ...config,
    });
    this.simConfig = validateSimulationConfig({
      ...DEFAULT_SIMULATION_CONFIG,
      ...simConfig,
    });
  }

  /**
   * Run the adaptive closed loop. Deterministic + replayable: identical input
   * (plan, cycles, configuration, start time) → identical result + fingerprint.
   */
  run(input: IntelligenceRunInput): IntelligenceRunResult {
    const config = this.config;
    const simEngine = new ExecutionSimulationEngine(this.simConfig);
    const controller = new AdaptiveExecutionController(config);
    const audit = new IntelligenceAuditLog(input.correlationId, input.traceId);

    let currentPlan = input.plan;
    controller.seed(currentPlan);
    const lineage: ExecutionPlan[] = [currentPlan];
    const decisions: AdaptiveExecutionDecision[] = [];
    const appliedActions: AppliedAdaptiveAction[] = [];
    const cycleResults: IntelligenceCycleResult[] = [];
    const feedbacks: ExecutionFeedback[] = [];
    const telemetries: ExecutionTelemetry[] = [];
    const proposals: import('./types').AdaptiveProposal[] = [];

    let aegisAuthorizedEveryCycle = true;
    let treasuryAuthorizedEveryCycle = true;
    let finalState: IntelligenceFinalState = 'EXHAUSTED';
    let consecutiveKeeps = 0;
    let stopped = false;
    let sequence = 0;

    const maxCycles = Math.min(input.cycles.length, config.maxAdaptiveCycles);

    for (let i = 0; i < maxCycles && !stopped; i++) {
      const spec = input.cycles[i];
      const cycle = i;
      const cycleStart = input.startTime + (spec.elapsedMs ?? 0);

      // Authorization gate — fail closed BEFORE any simulation.
      const aegisOk = spec.aegisAuthorized === true;
      const treasuryOk = spec.treasuryAuthorized === true;
      if (!aegisOk || !treasuryOk) {
        aegisAuthorizedEveryCycle = aegisAuthorizedEveryCycle && aegisOk;
        treasuryAuthorizedEveryCycle = treasuryAuthorizedEveryCycle && treasuryOk;
        finalState = 'BLOCKED';
        stopped = true;
        break;
      }

      // 1. SIMULATE the current plan against this cycle's market world.
      const sim = simEngine.simulate({
        plan: currentPlan,
        markets: spec.markets,
        venues: spec.venues,
        startTime: cycleStart,
        correlationId: input.correlationId,
        traceId: input.traceId,
        aegisAuthorized: true,
        treasuryAuthorized: true,
        atomicPolicy: spec.atomicPolicy,
        config: this.simConfig,
      });

      // 2. Assess venue health (hysteresis across cycles).
      const venueHealth: VenueHealthState[] = spec.venues.map((v: VenueModel) => {
        const orders = sim.orders.filter((o) => o.venueId === v.venueId);
        const rejected = orders.filter((o) => o.status === 'REJECTED').length;
        const filled = sim.fills.filter((f) => f.venueId === v.venueId).reduce((s, f) => s + f.quantity, 0);
        const submitted = orders.reduce((s, o) => s + o.quantity, 0);
        const previous = controller.state.venueHealth.find((h: VenueHealthState) => h.venueId === v.venueId) ?? undefined;
        return assessVenueHealth({
          venueId: v.venueId,
          latencyMs: v.latencyMs + v.networkLatencyMs,
          rejectionRate: orders.length > 0 ? rejected / orders.length : 0,
          fillQuality: submitted > 0 ? Math.min(1, filled / submitted) : 1,
          liquidity: v.liquidity,
          minLiquidity: config.thresholds.minLiquidity,
          staleMarketData: v.orderBook.status !== 'OPEN' || v.orderBook.timestamp < cycleStart - 5_000,
          simulationFailures: v.health === 'UNAVAILABLE' ? 3 : v.health === 'DEGRADED' ? 1 : 0,
          previous,
          timestamp: cycleStart,
          maxLatencyMs: config.thresholds.maxLatencyMs,
          minVenueScore: config.thresholds.minVenueScore,
          weights: config.venueHealthWeights,
          maxSimulationFailures: 3,
        });
      });

      // 3. OBSERVE — record immutable telemetry.
      const telemetry = recordTelemetry({
        plan: currentPlan,
        simulationId: sim.simulationId,
        orders: sim.orders,
        fills: sim.fills,
        slices: sim.slices,
        atomicGroups: sim.atomicGroups,
        metrics: sim.metrics,
        venueHealth: Object.fromEntries(venueHealth.map((v) => [v.venueId, {state: v.state, score: v.score}])),
        venueLiquidity: Object.fromEntries(spec.venues.map((v: VenueModel) => [v.venueId, v.liquidity])),
        venueLatencyMs: Object.fromEntries(spec.venues.map((v: VenueModel) => [v.venueId, v.latencyMs + v.networkLatencyMs])),
        cycle,
        timestamp: cycleStart,
        sequence,
      });
      sequence += 1;
      telemetries.push(telemetry);
      audit.record('TELEMETRY_RECORDED', currentPlan.executionPlanId, cycleStart, {
        telemetryId: telemetry.telemetryId,
        cycle,
        fillRatio: telemetry.fillRatio,
        slippageBps: telemetry.slippageBps,
        latencyMs: telemetry.latencyMs,
        remainingQuantity: telemetry.remainingQuantity,
      });

      // 4. Routing candidates for this cycle.
      const candidates = candidatesFromCycle(spec, currentPlan, venueHealth, sim);
      const benchmarkPrice = spec.benchmarkPrice ?? benchmarkPriceOf(currentPlan);
      const primaryVenue = currentPlan.routes[0]?.venue ?? spec.venues[0]?.venueId ?? 'UNKNOWN';
      const primaryMarket = spec.markets.find((m) => m.venueId === primaryVenue) ?? spec.venues.find((v: VenueModel) => v.venueId === primaryVenue)?.orderBook;
      const currentMid = midOf(primaryMarket) || benchmarkPrice;

      // Per-route price drift: how far each route's venue mid has moved from
      // the route's own reference (arrival) price. The plan-level drift is the
      // worst (max absolute) drift across routes.
      const routeDriftBps = currentPlan.routes.map((route) => {
        const m = spec.markets.find((x) => x.venueId === route.venue) ?? spec.venues.find((v: VenueModel) => v.venueId === route.venue)?.orderBook;
        const routeMid = midOf(m) || route.referencePrice;
        return route.referencePrice > 0 ? ((routeMid - route.referencePrice) / route.referencePrice) * 10_000 : 0;
      });
      const priceDriftBps = routeDriftBps.length > 0
        ? routeDriftBps.reduce((m, d) => (Math.abs(d) > Math.abs(m) ? d : m), 0)
        : 0;

      // 5. SCORE — deterministic execution quality.
      const minVenueHealthScore = venueHealth.length > 0 ? Math.min(...venueHealth.map((v) => v.score)) : 1;
      const minObservedLiquidity = candidates.length > 0 ? Math.min(...candidates.map((c) => c.liquidity)) : 0;
      const quality = evaluateQuality({
        telemetry,
        thresholds: config.thresholds,
        weights: config.qualityWeights,
        minVenueHealthScore,
        minObservedLiquidity,
        previousScore: controller.state.lastQualityScore,
        cycle,
        timestamp: cycleStart,
      });
      audit.record('QUALITY_EVALUATED', currentPlan.executionPlanId, cycleStart, {
        qualityId: quality.qualityId,
        cycle,
        score: quality.score,
        grade: quality.grade,
        trend: quality.trend,
        dimensions: quality.dimensions.map((d) => `${d.name}:${d.value.toFixed(3)}`).join(','),
      });

      // 6. MEASURE + SIGNAL.
      const evaluations = evaluateThresholds({
        telemetry,
        qualityScore: quality.score,
        minVenueHealthScore,
        minObservedLiquidity,
        priceDriftBps,
        thresholds: config.thresholds,
      });
      const aging = assessOrderAging({
        orders: sim.orders,
        fills: sim.fills,
        now: cycleStart,
        maxOrderAgeMs: config.thresholds.maxOrderAgeMs,
        criticalMultiplier: config.thresholds.criticalMultiplier,
      });
      const signals = generateSignals({
        telemetry,
        quality,
        venueHealth,
        orderAging: aging,
        thresholdEvaluations: evaluations,
        priceDriftBps,
        previousQualityScore: controller.state.lastQualityScore,
        observedLiquidity: minObservedLiquidity,
        timestamp: cycleStart,
        sequence,
      });
      sequence += 1;
      for (const s of signals) {
        audit.record('SIGNAL_GENERATED', currentPlan.executionPlanId, cycleStart, {
          signalId: s.signalId,
          type: s.type,
          severity: s.severity,
          evidence: s.evidence,
        });
      }

      // 7. Unified feedback object.
      const feedback = buildFeedback({
        simulation: sim,
        planId: currentPlan.executionPlanId,
        cycle,
        timestamp: cycleStart,
        sequence,
        domain: currentPlan.domain,
        strategyType: currentPlan.strategyType,
        telemetry,
        signals,
        quality,
        venueHealth,
        orderAging: aging,
        emergencyStop: spec.emergencyStop === true,
      });
      sequence += 1;
      feedbacks.push(feedback);

      // 8. DECIDE → PROPOSE → VALIDATE → APPLY → RECORD.
      const controllerResult = controller.process({
        feedback,
        plan: currentPlan,
        candidates,
        currentMid,
        benchmarkPrice,
        emergencyStop: spec.emergencyStop === true,
        correlationId: input.correlationId,
        traceId: input.traceId,
        timestamp: cycleStart,
        auditLog: audit,
      });
      decisions.push(controllerResult.decision);
      if (controllerResult.proposal) proposals.push(controllerResult.proposal);
      if (controllerResult.appliedAction) appliedActions.push(controllerResult.appliedAction);

      cycleResults.push(Object.freeze({
        cycle,
        label: spec.label,
        planVersion: currentPlan.version,
        simulation: sim,
        feedback,
        controller: controllerResult,
        fingerprint: controllerResult.fingerprint,
      }));

      // 9. Advance the loop. An applied revision (including an ABORT revision)
      // always enters the lineage first — execution history is never dropped.
      // ABORT is then terminal (fail closed). A cycle with nothing remaining
      // ends the loop as COMPLETED (nothing left to adapt).
      if (controllerResult.applied && controllerResult.revisedPlan) {
        currentPlan = controllerResult.revisedPlan;
        lineage.push(currentPlan);
        consecutiveKeeps = 0;
      } else if (controllerResult.decision.action === 'KEEP' && controllerResult.applied) {
        consecutiveKeeps += 1;
        if (consecutiveKeeps >= config.maxConsecutiveKeeps) {
          stopped = true;
          break;
        }
      } else {
        consecutiveKeeps = 0;
      }
      if (controllerResult.decision.action === 'ABORT' && controllerResult.applied) {
        finalState = 'ABORTED';
        stopped = true;
        break;
      }
      if (feedback.telemetry.remainingQuantity <= 1e-9) {
        stopped = true;
        break;
      }
    }

    if (!stopped) finalState = 'EXHAUSTED';

    // Final-state semantics:
    //   ABORTED  — an abort was applied (terminal, fail closed).
    //   BLOCKED  — a cycle was not AEGIS/Treasury authorized (fail closed).
    //   COMPLETED — the final cycle has no remaining quantity.
    //   EXHAUSTED — the cycle budget ended with quantity outstanding.
    const lastCycle = cycleResults[cycleResults.length - 1];
    if (finalState !== 'ABORTED' && finalState !== 'BLOCKED') {
      const remaining = lastCycle?.feedback.telemetry.remainingQuantity ?? 0;
      finalState = remaining <= 1e-9 ? 'COMPLETED' : 'EXHAUSTED';
    }

    // Invariants — fail closed.
    const invariantCheck = checkIntelligenceInvariants({
      initialPlan: input.plan,
      lineage,
      telemetry: telemetries,
      decisions,
      proposals,
      appliedActions,
      feedback: feedbacks,
      aegisAuthorizedEveryCycle,
      treasuryAuthorizedEveryCycle,
      replayEquivalent: true,
    });

    const auditVerified = audit.verify();
    const invariantViolations = [...invariantCheck.violations];
    if (!auditVerified) invariantViolations.push('audit chain verification failed');

    const reconciled = invariantViolations.length === 0
      && auditVerified
      && cycleResults.every((c) => c.simulation.reconciliation.balanced);

    const lastDecision = decisions[decisions.length - 1];
    const lastQuality = cycleResults[cycleResults.length - 1]?.feedback.quality.score ?? 0;

    const body = {
      intelligenceRunId: intelligenceRunId({
        planId: input.plan.executionPlanId,
        cycles: input.cycles.map((c) => c.label),
        startTime: input.startTime,
        configFingerprint: JSON.stringify([this.config.configVersion, this.config.policyVersion]),
      }),
      executionPlanId: input.plan.executionPlanId,
      finalPlanId: currentPlan.executionPlanId,
      cycles: Object.freeze(cycleResults),
      lineage: Object.freeze(lineage),
      decisions: Object.freeze(decisions),
      appliedActions: Object.freeze(appliedActions),
      auditEvents: audit.events,
      invariantsSatisfied: invariantViolations.length === 0,
      invariantViolations: Object.freeze(invariantViolations),
      aegisAuthorizedEveryCycle,
      treasuryAuthorizedEveryCycle,
      paperOnly: true as const,
      finalState,
      finalQualityScore: lastQuality,
      finalAction: lastDecision?.action ?? 'KEEP',
      reconciled,
      timestamp: input.startTime,
      correlationId: input.correlationId,
      traceId: input.traceId,
    };

    return Object.freeze({
      ...body,
      fingerprint: intelligenceRunFingerprintOf(body),
    });
  }
}
