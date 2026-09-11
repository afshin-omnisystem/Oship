import {SessionRecord} from './types';
import type {ExecutionPlan, ControlCycleSpec} from '../control/types';
import type {ControlConfigInput} from '../control/config';
import {
  intelPlan, intelVenue, venueForRoute, intelCycle, IntelVenueSpec,
} from '../intelligence/test-fixtures';
import {controlCycle, runControl, CONTROL_TEST_TIMESTAMP} from '../control/test-fixtures';
import {ExecutionControlEngine} from '../control/engine';

/**
 * SPRINT 034 — performance-layer test fixtures.
 *
 * Deterministic execution worlds (reusing the Sprint 032/033 fixture
 * vocabulary) plus corpus builders: SessionRecords with replay inputs, so the
 * simulation gate can re-run the exact same inputs under candidate policies.
 */

export const PERFORMANCE_TEST_TIMESTAMP = CONTROL_TEST_TIMESTAMP;

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PerfPlanSpec {
  readonly planId?: string;
  readonly quantity?: number;
  readonly referencePrice?: number;
  readonly venue?: string;
  readonly domain?: 'AFIS' | 'ABL';
}

export function perfPlan(spec: PerfPlanSpec = {}): ExecutionPlan {
  return intelPlan({
    planId: spec.planId ?? 'xplan_perf',
    domain: spec.domain ?? 'AFIS',
    legs: [],
    routes: [{
      routeId: 'route-1',
      venue: spec.venue ?? 'venue-a',
      instrument: 'BTC/USDT',
      side: 'BUY',
      quantity: spec.quantity ?? 10,
      referencePrice: spec.referencePrice ?? 100,
    }],
  });
}

/** ABL BACK/LAY two-route plan (semantic sides preserved). */
export function perfAblPlan(): ExecutionPlan {
  return intelPlan({
    planId: 'xplan_perf_abl',
    domain: 'ABL',
    legs: [],
    routes: [
      {routeId: 'route-1', venue: 'venue-a', instrument: 'match/ETH', side: 'BACK', quantity: 10, referencePrice: 100},
      {routeId: 'route-2', venue: 'venue-b', instrument: 'match/ETH', side: 'LAY', quantity: 10, referencePrice: 100},
    ],
  });
}

// ---------------------------------------------------------------------------
// Venue worlds
// ---------------------------------------------------------------------------

export interface WorldSpec {
  readonly askPrice?: number;
  readonly depth?: number;
  readonly latencyMs?: number;
  readonly networkLatencyMs?: number;
  readonly health?: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly status?: 'OPEN' | 'CLOSED';
  readonly liquidity?: number;
}

function worldVenue(plan: ExecutionPlan, spec: WorldSpec, venue = 'venue-a'): IntelVenueSpec {
  const route = plan.routes[0];
  const base = venueForRoute(route, {
    venue,
    liquidity: spec.liquidity ?? 200_000,
    latencyMs: spec.latencyMs ?? 5,
    networkLatencyMs: spec.networkLatencyMs ?? 5,
    health: spec.health ?? 'HEALTHY',
    status: spec.status ?? 'OPEN',
    depthPerLevel: spec.depth ?? 1_000,
  });
  if (spec.askPrice !== undefined) {
    const tick = 0.01;
    const ask = Math.round(spec.askPrice * 100) / 100;
    const bid = Math.round((ask - 0.1) * 100) / 100;
    return {...base, bids: [{price: bid, quantity: spec.depth ?? 1_000}], asks: [{price: ask, quantity: spec.depth ?? 1_000}]};
  }
  return base;
}

export function healthyCycle(label: string, plan: ExecutionPlan, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {}, venue)]});
}

export function driftedCycle(label: string, plan: ExecutionPlan, askPrice: number, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {askPrice}, venue)]});
}

export function thinCycle(label: string, plan: ExecutionPlan, askPrice: number, depth: number, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {askPrice, depth, liquidity: 50_000}, venue)]});
}

export function degradedCycle(label: string, plan: ExecutionPlan, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {health: 'DEGRADED', latencyMs: 250}, venue)]});
}

export function staleCycle(label: string, plan: ExecutionPlan, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {status: 'CLOSED'}, venue)]});
}

export function emergencyCycle(label: string, plan: ExecutionPlan, venue = 'venue-a'): ControlCycleSpec {
  return controlCycle({label, venueSpecs: [worldVenue(plan, {}, venue)], emergencyStop: true});
}

/**
 * Flip-flop world: the preferred venue alternates every cycle (IV17 style).
 * Under the default policy the venue advantage crosses rerouteThreshold every
 * cycle, the reroute targets alternate venue-b → venue-a → venue-b, and the
 * oscillation guard aborts the session. Raising rerouteThreshold breaks the
 * flip-flop and the session completes — the canonical optimization lever.
 */
export function flipFlopCycle(label: string, plan: ExecutionPlan, preferB: boolean): ControlCycleSpec {
  const mk = (venue: string, slow: boolean) => worldVenue(plan, {
    askPrice: plan.routes[0].referencePrice,
    depth: 8,
    latencyMs: slow ? 200 : 5,
  }, venue);
  return controlCycle({
    label,
    venueSpecs: [
      {...mk('venue-a', preferB)},
      {...mk('venue-b', !preferB)},
    ],
  });
}

export {worldVenue, intelVenue};

// ---------------------------------------------------------------------------
// Records & corpora
// ---------------------------------------------------------------------------

export interface RecordSpec {
  readonly label: string;
  readonly plan: ExecutionPlan;
  readonly cycles: readonly ControlCycleSpec[];
  readonly policyId?: string;
  readonly policyVersion?: string;
  readonly config?: ControlConfigInput;
}

/** Run the control plane and wrap the session in a replayable record. */
export function perfRecord(spec: RecordSpec): SessionRecord {
  const session = runControl(spec.plan, spec.cycles, {config: spec.config});
  return Object.freeze({
    label: spec.label,
    session,
    replayInput: Object.freeze({plan: spec.plan, cycles: spec.cycles}),
    policyId: spec.policyId ?? 'policy-execution',
    policyVersion: spec.policyVersion ?? 'v1',
  });
}

/** Run with an explicit engine (config-controlled arms). */
export function perfRecordWith(config: ControlConfigInput, spec: Omit<RecordSpec, 'config'>): SessionRecord {
  const engine = new ExecutionControlEngine(config);
  const session = engine.run({
    plan: spec.plan,
    cycles: spec.cycles,
    startTime: PERFORMANCE_TEST_TIMESTAMP,
    correlationId: 'perf-fixture',
    traceId: 'perf-fixture-trace',
  });
  return Object.freeze({
    label: spec.label,
    session,
    replayInput: Object.freeze({plan: spec.plan, cycles: spec.cycles}),
    policyId: spec.policyId ?? 'policy-execution',
    policyVersion: spec.policyVersion ?? 'v1',
  });
}

/** Healthy completed AFIS session over two venues. */
export function healthyRecord(label = 'healthy', policyVersion = 'v1'): SessionRecord {
  const plan = intelPlan({
    planId: 'xplan_perf_healthy', legs: [],
    routes: [
      {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
      {routeId: 'route-2', venue: 'venue-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 10, referencePrice: 100},
    ],
  });
  const cycles = [0, 1].map((i) => controlCycle({
    label: `healthy-${i}`,
    venueSpecs: [worldVenue(plan, {}, 'venue-a'), worldVenue(plan, {}, 'venue-b')],
  }));
  return perfRecord({label, plan, cycles, policyVersion});
}

/** Reprice-pressure record: drifting asks on both cycles. */
export function driftedRecord(label = 'drifted', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_drift', quantity: 10, referencePrice: 100});
  const cycles = [
    driftedCycle('drift-0', plan, 100.3),
    driftedCycle('drift-1', plan, 100.6),
  ];
  return perfRecord({label, plan, cycles, policyVersion});
}

/** Thin-liquidity record: partial fills force reslicing. */
export function partialRecord(label = 'partial', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_partial', quantity: 10, referencePrice: 100});
  const cycles = [
    thinCycle('thin-0', plan, 100, 3),
    thinCycle('thin-1', plan, 100, 3),
    thinCycle('thin-2', plan, 100, 3),
    thinCycle('thin-3', plan, 100, 3),
  ];
  return perfRecord({label, plan, cycles, policyVersion});
}

/** Degraded-venue record: degraded health + thin depth, then recovery. */
export function degradedRecord(label = 'degraded', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_degraded', quantity: 10, referencePrice: 100});
  const degraded = () => [worldVenue(plan, {health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 100, depth: 3, liquidity: 50_000})];
  const cycles = [
    controlCycle({label: 'degraded-0', venueSpecs: degraded()}),
    controlCycle({label: 'degraded-1', venueSpecs: degraded()}),
    controlCycle({label: 'degraded-2', venueSpecs: degraded()}),
    controlCycle({label: 'degraded-3', venueSpecs: [worldVenue(plan, {})]}),
  ];
  return perfRecord({label, plan, cycles, policyVersion});
}

/** Emergency-stop record (aborts immediately). */
export function emergencyRecord(label = 'es', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_es'});
  const cycles = [
    emergencyCycle('es-0', plan),
    healthyCycle('es-1', plan),
  ];
  return perfRecord({label, plan, cycles, policyVersion});
}

/** All-stale record (fails closed with STALE_MARKET). */
export function staleRecord(label = 'stale', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_stale'});
  const cycles = [
    staleCycle('stale-0', plan),
    healthyCycle('stale-1', plan),
  ];
  return perfRecord({label, plan, cycles, policyVersion});
}

/** ABL BACK/LAY record. */
export function ablRecord(label = 'abl', policyVersion = 'v1'): SessionRecord {
  const plan = perfAblPlan();
  const cycles = [0, 1].map((i) => controlCycle({
    label: `abl-${i}`,
    venueSpecs: [worldVenue(plan, {}, 'venue-a'), worldVenue(plan, {}, 'venue-b')],
  }));
  return perfRecord({label, plan, cycles, policyVersion});
}

/** Flip-flop (oscillation-pressure) record with N alternating cycles. */
export function flipFlopRecord(cycles = 7, label = 'flipflop', policyVersion = 'v1'): SessionRecord {
  const plan = perfPlan({planId: 'xplan_perf_flip', quantity: 40, referencePrice: 100});
  const specs = Array.from({length: cycles}, (_, i) => flipFlopCycle(`flip-${i}`, plan, i % 2 === 0));
  return perfRecord({label, plan, cycles: specs, policyVersion});
}

/**
 * The canonical mixed corpus for optimization: oscillation pressure (the
 * rerouteThreshold lever world), drift pressure, and a healthy baseline.
 */
export function optimizationCorpus(policyVersion = 'v1'): readonly SessionRecord[] {
  return [
    flipFlopRecord(7, 'flipflop', policyVersion),
    driftedRecord('drifted', policyVersion),
    healthyRecord('healthy', policyVersion),
  ];
}

/** Standard regression-gate probes (identical for every candidate). */
export function perfProbes(): {
  readonly emergencyStop: {plan: ExecutionPlan; cycles: readonly ControlCycleSpec[]};
  readonly staleMarket: {plan: ExecutionPlan; cycles: readonly ControlCycleSpec[]};
} {
  const esPlan = perfPlan({planId: 'xplan_perf_probe_es'});
  const stalePlan = perfPlan({planId: 'xplan_perf_probe_stale'});
  return {
    emergencyStop: {plan: esPlan, cycles: [emergencyCycle('probe-es', esPlan), healthyCycle('probe-es-1', esPlan)]},
    staleMarket: {plan: stalePlan, cycles: [staleCycle('probe-stale', stalePlan), healthyCycle('probe-stale-1', stalePlan)]},
  };
}
