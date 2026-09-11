import type {
  ClosedLoopRecord, ClosedLoopInput, Opportunity, OpportunityDomain, OpportunityType,
} from './types';
import {sha256} from '../../oiin/ids';
import type {OiinEvent} from '../../oiin';
import {mkEvent, source as oiinSource, afisSpotEvents, abTwoWaySurebetEvents} from '../../opportunity/test-fixtures';
import {OpportunityDiscoveryEngine} from '../../opportunity/discovery-engine';
import type {StrategyDecision} from '../../strategy/strategy.types';
import {riskCandidate, riskDecisionFor, riskPortfolio} from '../../risk/decision/test-fixtures';
import {buildRiskDecision} from '../../risk/decision/decision';
import {DEFAULT_RISK_CONFIG} from '../../risk/decision/config';
import type {RiskConfig} from '../../risk/decision/config';
import type {AllocationDecision} from '../../allocation/optimizer/types';
import type {ExecutionPlan} from '../../execution/planning/types';
import {intelPlan} from '../../execution/intelligence/test-fixtures';
import {controlCycle} from '../../execution/control/test-fixtures';
import {
  perfRecordWith, worldVenue, healthyRecord as perfHealthyRecord,
  flipFlopRecord as perfFlipFlopRecord, staleCycle as perfStaleCycle, perfProbes,
} from '../../execution/performance/test-fixtures';
import type {SessionRecord} from '../../execution/performance/types';
import type {ControlCycleSpec} from '../../execution/control/types';
import {ExecutionPerformanceEngine, DEFAULT_PARAMETER_SPACE} from '../../execution/performance';

/**
 * SPRINT 035 — closed-loop test fixtures.
 *
 * Deterministic, complete opportunity lifecycles assembled from the REAL
 * repository contracts: OIIN events (oiin/test-fixtures), real discovery
 * (OpportunityDiscoveryEngine), real strategy decisions, real allocation
 * decisions (allocation/optimizer), real risk decisions (buildRiskDecision),
 * real execution plans (intelPlan), real control sessions
 * (ExecutionControlEngine via perfRecordWith) and real Sprint 034 performance
 * analysis (ExecutionPerformanceEngine.analyze).
 *
 * The corpus below covers every demo scenario: healthy execution, adverse
 * drift, high edge with poor execution, lower edge with superior
 * preservation, risk throttling, partial completion, adaptive recovery,
 * venue-induced leakage, oscillation abort, emergency stop, a policy-candidate
 * trial that improves execution but not end-to-end value, an ABL surebet and
 * stale intelligence.
 */

export const CLOSED_LOOP_TEST_TIMESTAMP = 1704067200000;
const BASE = CLOSED_LOOP_TEST_TIMESTAMP;

// ---------------------------------------------------------------------------
// Opportunity builders (canonical contract, controlled economics)
// ---------------------------------------------------------------------------

export interface ClOpportunitySpec {
  readonly opportunityId: string;
  readonly domain: OpportunityDomain;
  readonly type: OpportunityType;
  readonly grossEdge: number;
  readonly estimatedTotalCost: number;
  readonly requiredCapital?: number;
  readonly freshness?: number;
  readonly confidence?: number;
  readonly venues?: readonly string[];
  readonly market?: string;
  readonly instruments?: readonly string[];
  readonly direction?: string;
}

export function clOpportunity(spec: ClOpportunitySpec): Opportunity {
  const requiredCapital = spec.requiredCapital ?? 10_000;
  const netEdge = spec.grossEdge - spec.estimatedTotalCost;
  const fingerprint = `oppfp_${sha256({
    id: spec.opportunityId, domain: spec.domain, type: spec.type,
    grossEdge: spec.grossEdge, cost: spec.estimatedTotalCost, netEdge, requiredCapital,
  })}`;
  return Object.freeze({
    opportunityId: spec.opportunityId,
    discoveryId: `disc_${spec.opportunityId.slice(3)}`,
    domain: spec.domain,
    type: spec.type,
    instruments: Object.freeze([...(spec.instruments ?? ['BTC/USDT'])]),
    venues: Object.freeze([...(spec.venues ?? ['venue-a', 'venue-b'])]),
    market: spec.market ?? 'BTC/USDT',
    direction: spec.direction ?? 'VENUE_A->VENUE_B',
    observedAt: BASE - 50_000,
    expiresAt: BASE + 60_000,
    freshnessWindowMs: 120_000,
    freshness: spec.freshness ?? 1,
    sourceEvents: Object.freeze(['evt-1', 'evt-2']),
    evidence: Object.freeze([
      Object.freeze({evidenceId: `ev-${spec.opportunityId}-1`, source: 'venusim', connector: 'conn-a', eventId: 'evt-1', observedAt: BASE - 60_000, market: spec.market ?? 'BTC/USDT', venue: 'venue-a', price: 100, quantity: 10, correlationId: 'cl'}),
      Object.freeze({evidenceId: `ev-${spec.opportunityId}-2`, source: 'venusim', connector: 'conn-a', eventId: 'evt-2', observedAt: BASE - 60_000, market: spec.market ?? 'BTC/USDT', venue: 'venue-b', price: 100.4, quantity: 10, correlationId: 'cl'}),
    ]),
    requiredCapital,
    grossEdge: spec.grossEdge,
    estimatedCosts: Object.freeze({
      fees: spec.estimatedTotalCost * 0.5, slippage: spec.estimatedTotalCost * 0.3,
      latencyPenalty: spec.estimatedTotalCost * 0.1, adverseSelection: 0,
      executionFailureCost: 0, liquidityPenalty: 0, capitalCost: spec.estimatedTotalCost * 0.1,
      riskPenalty: 0,
    }),
    estimatedTotalCost: spec.estimatedTotalCost,
    netEdge,
    confidence: spec.confidence ?? 0.95,
    liquidity: Object.freeze({
      availableDepth: 500_000, requestedSize: requiredCapital, fillRatio: 1,
      priceImpact: 0, spread: 0.1, venueReliability: 0.99, freshness: spec.freshness ?? 1,
      deployableCapital: requiredCapital,
    }),
    executionRisk: 0.1,
    risk: Object.freeze({executionRisk: 0.1, correlationRisk: 0.1, liquidationRisk: 0.05, adverseSelectionRisk: 0.05, overall: 0.1}),
    status: 'ELIGIBLE',
    strategyCompatibility: Object.freeze(['CROSS_VENUE_ARBITRAGE']),
    costModelVersion: 'cost-model.v1',
    fingerprint,
    calculation: Object.freeze({grossEdge: spec.grossEdge, costs: spec.estimatedTotalCost}),
  });
}

/** Real discovery over real OIIN events (used by ingestion/lifecycle tests). */
export function discoveredAfisOpportunity(): {readonly event: OiinEvent; readonly opportunity: Opportunity} {
  const events = afisSpotEvents();
  const result = new OpportunityDiscoveryEngine().discoverFromEvents(events, {
    now: BASE, correlationId: 'cl', traceId: 'cl-trace', availableCapital: 1_000_000_000,
  });
  const opportunity = result.opportunities.find((o) => o.status === 'RANKED') ?? result.opportunities[0];
  return Object.freeze({event: events[0], opportunity});
}

export function discoveredAblOpportunity(): {readonly event: OiinEvent; readonly opportunity: Opportunity} {
  const events = abTwoWaySurebetEvents();
  const result = new OpportunityDiscoveryEngine().discoverFromEvents(events, {
    now: BASE, correlationId: 'cl', traceId: 'cl-trace', availableCapital: 1_000_000_000,
  });
  const opportunity = result.opportunities[0];
  return Object.freeze({event: events[0], opportunity});
}

export function clOiinEvent(timestamp = BASE - 60_000, domain: OpportunityDomain = 'AFIS'): OiinEvent {
  const src = domain === 'ABL' ? {...oiinSource, domain: 'SPORTS' as const} : oiinSource;
  return mkEvent(
    domain === 'ABL' ? 'ODDS_UPDATE' : 'ORDER_BOOK_UPDATE',
    timestamp,
    domain === 'ABL'
      ? {market: 'MATCH-X', category: 'winner', selection: 'HOME', bookmaker: 'BOOK_A', back: 3.0, commission: 0.01}
      : {symbol: 'BTC/USDT', venue: 'VENUE_A', bid: 100, ask: 100.1, depth: 1_000_000, liquidity: 1_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001},
    'cl',
    src,
  );
}

// ---------------------------------------------------------------------------
// Stage builders
// ---------------------------------------------------------------------------

export interface ClStageSpec {
  readonly opportunity: Opportunity;
  readonly strategyId: string;
  readonly expectedValue: number;
  readonly allocatedCapital: number;
  readonly approvedCapital: number;
  readonly riskConfig?: RiskConfig;
  readonly plan: ExecutionPlan;
  readonly session: SessionRecord;
  readonly oiinEvent?: OiinEvent | null;
  readonly performance?: ClosedLoopRecord['performance'];
}

export function clStrategyDecision(o: Opportunity, strategyId: string, expectedValue: number): StrategyDecision {
  return Object.freeze({
    decisionId: `sd_${o.opportunityId}`,
    strategyId,
    opportunityId: o.opportunityId,
    action: 'EXECUTE_REQUEST',
    confidence: o.confidence,
    expectedValue,
    capitalRequirement: o.requiredCapital,
    riskParameters: Object.freeze({maxSlippageBps: 50}),
    reason: 'positive net edge within freshness window',
    evidence: Object.freeze({grossEdge: o.grossEdge, netEdge: o.netEdge}),
    timestamp: String(BASE - 40_000),
    correlationId: 'cl',
  });
}

export function clAllocationDecision(o: Opportunity, strategyId: string, allocated: number): AllocationDecision {
  const candidate = riskCandidate({
    candidateId: `cand_${o.opportunityId}`,
    opportunityId: o.opportunityId,
    strategyId,
    domain: o.domain,
    requiredCapital: o.requiredCapital,
    expectedNetReturn: o.netEdge,
    riskAdjustedReturn: o.netEdge,
    confidence: o.confidence,
  });
  const decision = riskDecisionFor(candidate, allocated);
  return Object.freeze({
    ...decision,
    timestamp: BASE - 30_000,
    correlationId: 'cl',
  });
}

export function clRiskDecision(
  o: Opportunity, strategyId: string, allocation: AllocationDecision, approved: number,
  riskConfig: RiskConfig = DEFAULT_RISK_CONFIG,
) {
  const candidate = riskCandidate({
    candidateId: `cand_${o.opportunityId}`,
    opportunityId: o.opportunityId,
    strategyId,
    domain: o.domain,
    requiredCapital: allocation.allocatedCapital,
    expectedNetReturn: o.netEdge,
    riskAdjustedReturn: o.netEdge,
    confidence: o.confidence,
  });
  return buildRiskDecision({
    allocationDecision: allocation,
    candidate,
    portfolio: riskPortfolio(),
    config: riskConfig,
    budget: riskConfig.budget,
    evaluationTime: BASE - 20_000,
    controlState: 'NORMAL',
    correlationId: 'cl',
    traceId: 'cl-trace',
  });
}

/** Risk config that throttles this opportunity to a partial approval. */
export function throttlingRiskConfig(maxOpportunityExposure: number): RiskConfig {
  return Object.freeze({
    ...DEFAULT_RISK_CONFIG,
    limits: Object.freeze({...DEFAULT_RISK_CONFIG.limits, maxOpportunityExposure}),
  });
}

/** Wire plan references to the exact upstream stage identities. */
export function clPlan(
  plan: ExecutionPlan, o: Opportunity, strategyId: string,
  allocationId: string, riskDecisionId: string, approvedCapital: number,
): ExecutionPlan {
  return Object.freeze({
    ...plan,
    opportunityId: o.opportunityId,
    strategyId,
    allocationId,
    riskReference: riskDecisionId,
    allocationReference: allocationId,
    requestedCapital: o.requiredCapital,
    approvedCapital,
    plannedCapital: approvedCapital,
    unplannedCapital: 0,
    timestamp: BASE - 10_000,
  });
}

export function clRecord(spec: {
  readonly label: string;
  readonly opportunity: Opportunity;
  readonly strategyId: string;
  readonly expectedValue: number;
  readonly allocated: number;
  readonly approved: number;
  readonly riskConfig?: RiskConfig;
  readonly plan: ExecutionPlan;
  readonly cycles: readonly ControlCycleSpec[];
  readonly policyVersion?: string;
  readonly oiinEvent?: OiinEvent | null;
  readonly performance?: ClosedLoopRecord['performance'];
}): ClosedLoopRecord {
  const strategyDecision = clStrategyDecision(spec.opportunity, spec.strategyId, spec.expectedValue);
  const allocation = clAllocationDecision(spec.opportunity, spec.strategyId, spec.allocated);
  const risk = clRiskDecision(spec.opportunity, spec.strategyId, allocation, spec.approved, spec.riskConfig);
  const plan = clPlan(spec.plan, spec.opportunity, spec.strategyId, allocation.allocationId, risk.riskDecisionId, spec.approved);
  const session = perfRecordWith({}, {
    label: spec.label,
    plan,
    cycles: spec.cycles,
    policyId: 'policy-execution',
    policyVersion: spec.policyVersion ?? 'v1',
  });
  return Object.freeze({
    label: spec.label,
    oiinEvent: spec.oiinEvent === undefined ? clOiinEvent(BASE - 60_000, spec.opportunity.domain) : spec.oiinEvent,
    opportunity: spec.opportunity,
    strategyDecision,
    allocation,
    risk,
    plan,
    session,
    performance: spec.performance ?? null,
  });
}

// ---------------------------------------------------------------------------
// Worlds
// ---------------------------------------------------------------------------

function arbPlan(planId: string, askA?: number): ExecutionPlan {
  return intelPlan({
    planId, legs: [],
    routes: [
      {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
      {routeId: 'route-2', venue: 'venue-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 10, referencePrice: 100},
    ],
  });
}

function healthyTwoVenueCycles(plan: ExecutionPlan, count = 1) {
  return Array.from({length: count}, (_, i) => controlCycle({
    label: `h${i}`,
    venueSpecs: [worldVenue(plan, {}, 'venue-a'), worldVenue(plan, {}, 'venue-b')],
  }));
}

function adverseTwoVenueCycles(plan: ExecutionPlan, askA = 101.0) {
  return [controlCycle({
    label: 'adv',
    venueSpecs: [worldVenue(plan, {askPrice: askA}, 'venue-a'), worldVenue(plan, {}, 'venue-b')],
  })];
}

function thinCycles(plan: ExecutionPlan, ask: number, depth: number, count = 3) {
  return Array.from({length: count}, (_, i) => controlCycle({
    label: `thin${i}`,
    venueSpecs: [worldVenue(plan, {askPrice: ask, depth}, 'venue-a')],
  }));
}

// ---------------------------------------------------------------------------
// The canonical closed-loop corpus
// ---------------------------------------------------------------------------

export interface ClosedLoopCorpus {
  readonly input: ClosedLoopInput;
  readonly records: readonly ClosedLoopRecord[];
  readonly policyArmRecord: SessionRecord;
}

export const CAP = 10_000;

export function closedLoopCorpus(): ClosedLoopCorpus {
  // ---- performance analyses (Sprint 034, real engine) ----------------------
  // The main analysis covers the v1 policy corpus (no optimization).
  // The policy analysis covers the oscillation corpus + a healthy v1.1 arm,
  // with a bounded grid optimization that produces the v1.1 ELIGIBLE candidate.
  const policyArmRecord = perfHealthyRecord('healthy-v11-arm', 'v1.1');
  const oscillationTemplate = perfFlipFlopRecord(7, 'oscillation-abort', 'v1');

  // Record 11's session is built first; the policy analysis covers the wired
  // sessions so observation lookups resolve for every record.
  const policyPlan = arbPlan('xplan_policy_trial');
  const policyWorld = adverseTwoVenueCycles(policyPlan, 101.0);

  const policyTrialUnwired: ClosedLoopRecord = ((): ClosedLoopRecord => {
    const opportunity = clOpportunity({
      opportunityId: 'opp_policy_trial', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE',
      grossEdge: 9.0, estimatedTotalCost: 1.61, requiredCapital: CAP,
    });
    return clRecord({
      label: 'policy-v1.1-trial', opportunity, strategyId: 'arb-aggressive',
      expectedValue: opportunity.netEdge, allocated: CAP, approved: CAP,
      plan: policyPlan, cycles: policyWorld, policyVersion: 'v1.1',
      performance: null,
    });
  })();

  const oscillationUnwired: ClosedLoopRecord = ((): ClosedLoopRecord => {
    const opportunity = clOpportunity({
      opportunityId: 'opp_oscillation', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE',
      grossEdge: 8.0, estimatedTotalCost: 1.6, requiredCapital: CAP,
    });
    const strategyDecision = clStrategyDecision(opportunity, 'arb-aggressive', opportunity.netEdge);
    const allocation = clAllocationDecision(opportunity, 'arb-aggressive', CAP);
    const risk = clRiskDecision(opportunity, 'arb-aggressive', allocation, CAP);
    const plan = clPlan(
      oscillationTemplate.replayInput!.plan, opportunity, 'arb-aggressive',
      allocation.allocationId, risk.riskDecisionId, CAP);
    // Re-run the oscillation world against the wired plan (identical world).
    const session = perfRecordWith({}, {
      label: 'oscillation-abort', plan,
      cycles: oscillationTemplate.replayInput!.cycles,
      policyId: 'policy-execution', policyVersion: 'v1',
    });
    return Object.freeze({
      label: 'oscillation-abort', oiinEvent: clOiinEvent(BASE - 60_000, 'AFIS'),
      opportunity, strategyDecision, allocation, risk, plan, session,
      performance: null,
    });
  })();

  const policyAnalysis = new ExecutionPerformanceEngine().analyze({
    records: [oscillationUnwired.session, policyArmRecord, policyTrialUnwired.session],
    policy: {id: 'policy-execution', version: 'v1'},
    timestamp: BASE + 60_000,
    optimization: {
      space: DEFAULT_PARAMETER_SPACE.filter((d) =>
        d.path === 'adaptive.thresholds.rerouteThreshold' || d.path === 'hysteresis.sameActionCooldownCycles'),
      method: 'GRID',
    },
    probes: perfProbes(),
  });

  const policyTrial: ClosedLoopRecord = Object.freeze({...policyTrialUnwired, performance: policyAnalysis});
  const oscillation: ClosedLoopRecord = Object.freeze({...oscillationUnwired, performance: policyAnalysis});

  // ---- main records --------------------------------------------------------
  const healthyPlan = arbPlan('xplan_healthy');
  const steadyPlan = intelPlan({planId: 'xplan_steady', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const highEdgePlan = intelPlan({planId: 'xplan_high_edge', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const adversePlan = arbPlan('xplan_adverse');
  const riskPlan = arbPlan('xplan_risk_throttled');
  const partialPlan = intelPlan({planId: 'xplan_partial', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const recoveryPlan = intelPlan({planId: 'xplan_recovery', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const venueLeakPlan = intelPlan({planId: 'xplan_venue_leak', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
    {routeId: 'route-2', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const esPlan = intelPlan({planId: 'xplan_es', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const stalePlan = intelPlan({planId: 'xplan_stale', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const ablPlan = intelPlan({planId: 'xplan_abl', domain: 'ABL', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'match/ETH', side: 'BACK', quantity: 10, referencePrice: 100},
    {routeId: 'route-2', venue: 'venue-b', instrument: 'match/ETH', side: 'LAY', quantity: 10, referencePrice: 100},
  ]});

  const mk = (spec: {
    readonly label: string; readonly opportunity: Opportunity; readonly strategyId: string;
    readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[];
    readonly allocated?: number; readonly approved?: number; readonly riskConfig?: RiskConfig;
  }): ClosedLoopRecord => clRecord({
    label: spec.label, opportunity: spec.opportunity, strategyId: spec.strategyId,
    expectedValue: spec.opportunity.netEdge,
    allocated: spec.allocated ?? CAP, approved: spec.approved ?? CAP, riskConfig: spec.riskConfig,
    plan: spec.plan, cycles: spec.cycles, performance: null,
  });

  const mainRecords: ClosedLoopRecord[] = [
    mk({label: 'healthy-execution', strategyId: 'arb-guardian', plan: healthyPlan,
      cycles: healthyTwoVenueCycles(healthyPlan),
      opportunity: clOpportunity({opportunityId: 'opp_healthy', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 8.0, estimatedTotalCost: 1.6, requiredCapital: CAP})}),
    mk({label: 'steady-single', strategyId: 'arb-guardian', plan: steadyPlan,
      cycles: [controlCycle({label: 's0', venueSpecs: [worldVenue(steadyPlan, {}, 'venue-a')]})],
      opportunity: clOpportunity({opportunityId: 'opp_steady', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 2.0, estimatedTotalCost: 0.8, requiredCapital: CAP})}),
    mk({label: 'high-edge-poor-exec', strategyId: 'arb-aggressive', plan: highEdgePlan,
      cycles: [controlCycle({label: 'he0', venueSpecs: [worldVenue(highEdgePlan, {askPrice: 100.3}, 'venue-a')]})],
      opportunity: clOpportunity({opportunityId: 'opp_high_edge', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 12.0, estimatedTotalCost: 0.8, requiredCapital: CAP})}),
    mk({label: 'adverse-venue-drift', strategyId: 'arb-aggressive', plan: adversePlan,
      cycles: adverseTwoVenueCycles(adversePlan, 101.0),
      opportunity: clOpportunity({opportunityId: 'opp_adverse', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 15.0, estimatedTotalCost: 1.61, requiredCapital: CAP})}),
    mk({label: 'risk-throttled', strategyId: 'arb-guardian', plan: riskPlan,
      cycles: healthyTwoVenueCycles(riskPlan), approved: 4_000,
      riskConfig: throttlingRiskConfig(4_000),
      opportunity: clOpportunity({opportunityId: 'opp_risk_throttled', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 10.0, estimatedTotalCost: 1.6, requiredCapital: CAP})}),
    mk({label: 'partial-completion', strategyId: 'arb-guardian', plan: partialPlan,
      cycles: thinCycles(partialPlan, 100.0, 3),
      opportunity: clOpportunity({opportunityId: 'opp_partial', domain: 'AFIS', type: 'LIQUIDITY_IMBALANCE', grossEdge: 3.5, estimatedTotalCost: 0.8, requiredCapital: CAP})}),
    mk({label: 'adaptive-recovery', strategyId: 'arb-guardian', plan: recoveryPlan,
      cycles: thinCycles(recoveryPlan, 100.4, 3),
      opportunity: clOpportunity({opportunityId: 'opp_recovery', domain: 'AFIS', type: 'LIQUIDITY_IMBALANCE', grossEdge: 5.0, estimatedTotalCost: 0.8, requiredCapital: CAP})}),
    mk({label: 'venue-leakage', strategyId: 'arb-aggressive', plan: venueLeakPlan,
      cycles: [controlCycle({label: 'vl0', venueSpecs: [worldVenue(venueLeakPlan, {askPrice: 100.5}, 'venue-a'), worldVenue(venueLeakPlan, {}, 'venue-b')]})],
      opportunity: clOpportunity({opportunityId: 'opp_venue_leak', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 12.0, estimatedTotalCost: 1.6, requiredCapital: CAP})}),
    mk({label: 'emergency-stop', strategyId: 'arb-guardian', plan: esPlan,
      cycles: [controlCycle({label: 'es0', venueSpecs: [worldVenue(esPlan, {}, 'venue-a')], emergencyStop: true})],
      opportunity: clOpportunity({opportunityId: 'opp_es', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 6.0, estimatedTotalCost: 0.8, requiredCapital: CAP})}),
    mk({label: 'abl-surebet', strategyId: 'sports-arb-strategy', plan: ablPlan,
      cycles: [controlCycle({label: 'abl0', venueSpecs: [worldVenue(ablPlan, {}, 'venue-a'), worldVenue(ablPlan, {}, 'venue-b')]})],
      opportunity: clOpportunity({opportunityId: 'opp_abl_surebet', domain: 'ABL', type: 'ODDS_ARBITRAGE_2WAY',
        grossEdge: 6.0, estimatedTotalCost: 1.6, requiredCapital: CAP,
        venues: ['venue-a', 'venue-b'], market: 'winner|HOME', instruments: ['winner|HOME'], direction: 'BACK@100+LAY@99.95'})}),
    mk({label: 'stale-intel', strategyId: 'arb-aggressive', plan: stalePlan,
      cycles: [perfStaleCycle('st0', stalePlan, 'venue-a')],
      opportunity: clOpportunity({opportunityId: 'opp_stale', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE',
        grossEdge: 4.0, estimatedTotalCost: 0.8, requiredCapital: CAP, freshness: 0.2})}),
  ];

  const mainAnalysis = new ExecutionPerformanceEngine().analyze({
    records: mainRecords.map((r) => r.session),
    policy: {id: 'policy-execution', version: 'v1'},
    timestamp: BASE + 61_000,
  });

  const records: ClosedLoopRecord[] = [
    ...mainRecords.map((r) => Object.freeze({...r, performance: mainAnalysis})),
    oscillation,
    policyTrial,
  ];

  return Object.freeze({
    records,
    policyArmRecord,
    input: Object.freeze({
      records,
      timestamp: BASE + 120_000,
      correlationId: 'closed-loop-demo',
      traceId: 'closed-loop-demo-trace',
    }),
  });
}

/** A minimal single-record input for focused tests. */
export function singleRecordInput(label = 'healthy-execution'): ClosedLoopInput {
  const corpus = closedLoopCorpus();
  const record = corpus.records.find((r) => r.label === label) ?? corpus.records[0];
  return Object.freeze({
    records: [record],
    timestamp: BASE + 120_000,
    correlationId: 'cl-test',
    traceId: 'cl-test-trace',
  });
}
