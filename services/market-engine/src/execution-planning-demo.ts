import {UnifiedAllocationEngine, DEFAULT_ALLOCATION_ENGINE_CONFIG, AllocationPosition} from './allocation/optimizer';
import {portfolioCtx} from './allocation/optimizer/test-fixtures';
import {RiskAssessorEngine, DEFAULT_RISK_CONFIG, DEFAULT_RISK_LIMITS} from './risk/decision';
import {emptyPortfolioRiskContext} from './risk/decision/portfolio-context';
import {ExecutionPlannerEngine, DEFAULT_EXECUTION_PLANNING_CONFIG, ExecutionPlanResult, VenueState} from './execution/planning';
import {evaluateExecutionAegis} from './execution/planning/boundaries';
import {Opportunity} from './opportunity';
import {StrategyDefinition, StrategySelection, StrategyType} from './strategy/intelligence';
import {
  crossVenueOpportunity,
  fundingOpportunity,
  surebetOpportunity,
  valueOpportunity,
  triangularOpportunity,
} from './strategy/intelligence/test-fixtures';

const NOW = 1704067200000;

const DEF_LIMITS = {maxCapital: 25_000, maxPosition: 10_000, maxExposure: 10_000, maxLegs: 2, maxLatencyMs: 100, minEdge: 0.001, minConfidence: 0.5, minLiquidity: 100, maxSlippage: 0.005};
const DEF_MODS = {capitalFactor: 1, edgeFactor: 1, confidenceFactor: 1, executionFactor: 1, riskFactor: 1, latencyFactor: 1, liquidityFactor: 1, costFactor: 1};

function fmtMoney(v: number): string {
  return Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : 'n/a';
}
function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(4) : 'n/a';
}
function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function defFor(type: StrategyType): StrategyDefinition {
  const domain = type.startsWith('SUREBET') || type.startsWith('BACK') || type.startsWith('SPORTS') || type.startsWith('HEDGE') ? 'ABL' : 'AFIS';
  return Object.freeze({
    strategyId: `${domain.toLowerCase()}.${type.toLowerCase()}.v1`,
    version: '1.0.0',
    domain,
    type,
    name: `${domain.toLowerCase()} ${type.toLowerCase()}`,
    compatibleOpportunityTypes: [],
    requiredCapabilities: [],
    requiredVenues: [],
    limits: {...DEF_LIMITS},
    correlationGroup: `cg-${type}`,
    correlationFactor: 0.5,
    enabled: true,
    modifiers: {...DEF_MODS},
  });
}

function selFor(opportunity: Opportunity, type: StrategyType): StrategySelection {
  const domain = opportunity.domain;
  const strategyId = `${domain.toLowerCase()}.${type.toLowerCase()}.v1`;
  return Object.freeze({
    decisionId: `str_${opportunity.opportunityId}_${type}`,
    opportunityId: opportunity.opportunityId,
    selectedStrategyId: strategyId,
    selectedCandidateId: `sc_${opportunity.opportunityId}`,
    selectedStrategyVersion: '1.0.0',
    selectedType: type,
    selectedDomain: domain,
    selectedScore: 0.9,
    selectedStatus: 'SELECTED',
    rejectedAlternatives: [],
    ranking: [],
    reason: 'selected',
    admissibility: true,
    policyVersion: 'policy.v1',
    rankingVersion: 'rank.v1',
    configurationVersion: 'config.v1',
    timestamp: NOW,
    correlationId: 'demo',
    traceId: 'demo-trace',
    fingerprint: `fp_${opportunity.opportunityId}`,
  });
}

function pos(opportunity: Opportunity, type: StrategyType): AllocationPosition {
  return {opportunity, selection: selFor(opportunity, type), definition: defFor(type)};
}

function demoVenue(venueName: string, domain: 'AFIS' | 'ABL', midPrice: number, liquidity: number, extra: Partial<{latencyMs: number; reliability: number; spreadBps: number; volatilityProxy: number; fillProbability: number}> = {}): VenueState {
  return Object.freeze({
    venue: venueName,
    provider: `provider-${venueName}`,
    domain,
    midPrice,
    spreadBps: extra.spreadBps ?? 5,
    depth: liquidity,
    liquidity,
    makerFeeBps: 2,
    takerFeeBps: 8,
    fixedFee: 0,
    providerFeeBps: 1,
    routingFeeBps: 0.5,
    latencyMs: extra.latencyMs ?? 120,
    reliability: extra.reliability ?? 0.9,
    volatilityProxy: extra.volatilityProxy ?? 0.15,
    fillProbability: extra.fillProbability ?? 0.9,
    timestamps: NOW,
    healthy: true,
  });
}

function emptyVenue(venueName: string, domain: 'AFIS' | 'ABL'): VenueState {
  return Object.freeze({
    venue: venueName,
    provider: `provider-${venueName}`,
    domain,
    midPrice: 100,
    spreadBps: 5,
    depth: 0,
    liquidity: 0,
    makerFeeBps: 2,
    takerFeeBps: 8,
    fixedFee: 0,
    providerFeeBps: 1,
    routingFeeBps: 0.5,
    latencyMs: 120,
    reliability: 0.1,
    volatilityProxy: 0.15,
    fillProbability: 0,
    timestamps: NOW,
    healthy: false,
  });
}

function recoverOpportunity(cand: import('./allocation/optimizer').AllocationCandidate, venueNames?: readonly string[]): Opportunity {
  return {
    opportunityId: cand.opportunityId,
    discoveryId: cand.opportunityId,
    domain: cand.domain,
    type: cand.strategyType,
    instruments: [...cand.instruments],
    venues: venueNames && venueNames.length ? [...venueNames] : (cand.domain === 'ABL' ? ['book-a', 'book-b'] : ['venue-a', 'venue-b', 'venue-c']),
    market: cand.instruments[0] ?? 'BTC/USDT',
    direction: '',
    observedAt: NOW,
    expiresAt: NOW + 30_000,
    freshnessWindowMs: 30_000,
    freshness: 1,
    sourceEvents: [],
    evidence: [],
    requiredCapital: cand.requiredCapital,
    grossEdge: 0.1,
    estimatedCosts: {fees: 0.01, slippage: 0.005, latencyPenalty: 0.002, adverseSelection: 0.005, executionFailureCost: 0.003, liquidityPenalty: 0.002, capitalCost: 0.001, riskPenalty: 0.005},
    estimatedTotalCost: 0.04,
    netEdge: 0.06,
    confidence: cand.confidence,
    liquidity: {availableDepth: 50_000, requestedSize: cand.requiredCapital, fillRatio: 1, priceImpact: 0.01, spread: 5, venueReliability: 0.9, freshness: 1, deployableCapital: cand.liquidity},
    executionRisk: cand.risk,
    risk: {executionRisk: cand.risk, correlationRisk: 0.1, liquidationRisk: 0.1, adverseSelectionRisk: 0.1, overall: cand.risk},
    status: 'CONFIRMED',
    strategyCompatibility: [cand.strategyType],
    costModelVersion: 'cost.v1',
    fingerprint: cand.fingerprint,
    calculation: {},
  } as unknown as Opportunity;
}

function main(): void {
  const parts: string[] = [];

  parts.push(`
==============================================================
 OSHIP — SPRINT 030
 UNIFIED EXECUTION PLANNING & SMART ROUTING ENGINE
==============================================================

Canonical authority flow:
  Human → AETHER → OSHIP Core
    → Opportunity → Strategy → Allocation → Risk Decision
    → AEGIS → Treasury Authorization
    → EXECUTION PLAN → Paper Execution → Position → Reconciliation

  Allocation answers HOW MUCH.
  Risk Decision answers IS IT SAFE.
  Execution Plan answers WHAT / WHERE / WHEN / HOW.
  AEGIS answers IS AUTHORIZED.
  Treasury answers IS CAPITAL AVAILABLE / RESERVED.
  Planning ≠ Execution. Paper only. No real-money / provider creds.`);

  const portfolio = portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}});
  const positions: AllocationPosition[] = [
    pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'),
    pos(triangularOpportunity(), 'TRIANGULAR_ARBITRAGE'),
    pos(fundingOpportunity(), 'FUNDING_CARRY'),
    pos(surebetOpportunity(), 'SUREBET_STAKE'),
    pos(valueOpportunity(), 'SPORTS_VALUE'),
  ];

  parts.push(`
--- UNIFIED TREASURY (ONE POOL, AFIS + ABL COMPETE) ---
  total capital       : ${fmtMoney(portfolio.totalCapital)}
  reserved            : ${fmtMoney(portfolio.reservedCapital)}
  available (net)     : ${fmtMoney(portfolio.availableCapital)}`);

  parts.push(`
--- ALLOCATION (Sprint 028) ---`);
  const allocCfg = {...DEFAULT_ALLOCATION_ENGINE_CONFIG, constraints: {...DEFAULT_ALLOCATION_ENGINE_CONFIG.constraints, totalAvailableCapital: portfolio.totalCapital, reservedCapital: portfolio.reservedCapital}};
  const alloc = new UnifiedAllocationEngine(allocCfg).allocate({
    positions,
    portfolio,
    correlationId: 'demo',
    traceId: 'demo-trace',
    timestamp: NOW,
    aegisAllowed: true,
    treasuryAvailable: portfolio.availableCapital,
    controlState: 'ACTIVE',
  });
  for (const d of alloc.result.rankings) {
    parts.push(`  ${d.candidateId.slice(0, 18).padEnd(20)}${d.domain.padEnd(6)}${fmtMoney(d.allocatedCapital).padEnd(12)}${d.strategyId.slice(0, 40)}`);
  }
  parts.push(`  TOTAL ALLOCATED: ${fmtMoney(alloc.result.totalAllocated)}   INVARIANTS: ${alloc.result.invariantsSatisfied ? 'PASS' : 'FAIL'}`);

  const candidates: Record<string, import('./allocation/optimizer').AllocationCandidate> = {};
  for (const c of alloc.candidates) candidates[c.candidateId] = c;
  const riskPortfolio = emptyPortfolioRiskContext({
    totalCapital: portfolio.totalCapital,
    availableCapital: portfolio.availableCapital,
    reservedCapital: portfolio.reservedCapital,
    grossExposure: alloc.result.totalAllocated,
    domainExposure: {
      AFIS: alloc.result.decisions.filter((d) => d.domain === 'AFIS').reduce((a, d) => a + d.allocatedCapital, 0),
      ABL: alloc.result.decisions.filter((d) => d.domain === 'ABL').reduce((a, d) => a + d.allocatedCapital, 0),
    },
  });

  parts.push(`
--- RISK ASSESSMENT (AFIS + ABL in one unified risk budget) ---
  ${'Candidate'.padEnd(20)}${'Domain'.padEnd(6)}${'Requested'.padEnd(11)}${'Approved'.padEnd(11)}${'Blocked'.padEnd(11)}${'Scale'.padEnd(18)}${'State'}`);
  const riskConfig = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxConcentration: 0.5}};
  const risk = new RiskAssessorEngine(riskConfig).assess({
    decisions: alloc.result.decisions,
    candidates,
    portfolio: riskPortfolio,
    correlationId: 'demo',
    traceId: 'demo-trace',
    timestamp: NOW,
    controlState: 'ACTIVE',
  });
  for (const d of [...risk.decisions].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    parts.push(`  ${d.candidateId.slice(0, 18).padEnd(20)}${d.domain.padEnd(6)}${fmtMoney(d.requestedCapital).padEnd(11)}${fmtMoney(d.approvedCapital).padEnd(11)}${fmtMoney(d.blockedCapital).padEnd(11)}${d.scale.padEnd(18)}${d.state}`);
  }
  parts.push(`  Risk approved total = ${fmtMoney(risk.approvedCapital)}   decision = ${risk.decision}`);

  // Build planner + a base venue set per domain.
  const planner = new ExecutionPlannerEngine({...DEFAULT_EXECUTION_PLANNING_CONFIG, routingPolicy: 'BALANCED'});
  const afisVenues: VenueState[] = [
    demoVenue('venue-a', 'AFIS', 100, 500_000, {latencyMs: 30, reliability: 0.98, spreadBps: 2, fillProbability: 0.97}),
    demoVenue('venue-b', 'AFIS', 100, 120_000, {latencyMs: 220, reliability: 0.85, spreadBps: 12, fillProbability: 0.7}),
    demoVenue('venue-c', 'AFIS', 100, 60_000, {latencyMs: 400, reliability: 0.7, spreadBps: 25, fillProbability: 0.5}),
  ];
  const ablVenues: VenueState[] = [
    demoVenue('book-a', 'ABL', 2, 200_000, {latencyMs: 40, reliability: 0.97, spreadBps: 3, fillProbability: 0.96}),
    demoVenue('book-b', 'ABL', 2, 150_000, {latencyMs: 60, reliability: 0.95, spreadBps: 4, fillProbability: 0.94}),
  ];

  const planned = risk.decisions.filter((d) => d.state === 'RISK_APPROVED' && d.approvedCapital > 0);
  // Pick a multi-venue AFIS candidate (cross-venue) for the reroute/replan demo.
  const multiLegAfin = risk.decisions.find((d) => candidates[d.candidateId]?.strategyType === 'CROSS_VENUE_ARBITRAGE' && d.state === 'RISK_APPROVED');

  parts.push(`
--- EXECUTION PLANNING (Smart Routing → Multi-Venue → Slicing) ---`);
  const planResults: ExecutionPlanResult[] = [];
  for (const d of planned) {
    const cand = candidates[d.candidateId];
    if (!cand) continue;
    const decision = alloc.result.decisions.find((x) => x.candidateId === d.candidateId);
    if (!decision) continue;
    const venueSet = d.domain === 'ABL' ? ablVenues : afisVenues;
    const result = planner.plan({
      allocation: decision,
      candidate: cand,
      opportunity: recoverOpportunity(cand, venueSet.map((v) => v.venue)),
      strategy: defFor(cand.strategyType),
      riskDecision: d,
      venues: venueSet,
      controlState: 'ACTIVE',
      timestamp: NOW,
      correlationId: 'demo',
      traceId: 'demo-trace',
      treasuryAvailable: portfolio.availableCapital,
      treasuryReserved: portfolio.reservedCapital,
      aegisAllowed: true,
    });
    planResults.push(result);
    const p = result.plan;
    parts.push(`
  ${d.candidateId.slice(0, 18)}  domain=${p.domain}  mode=${p.executionMode}  lifecycle=${p.status}
    approved=${fmtMoney(p.approvedCapital)}  planned=${fmtMoney(p.plannedCapital)}  unplanned=${fmtMoney(p.unplannedCapital)}
    routes=${p.routeCount}  slices=${p.orderCount}  legs=${p.legCount}  venues=${p.venueCount}
    slippage=${fmtMoney(p.estimatedSlippage)}  fees=${fmtMoney(p.estimatedFees)}  latency=${Math.round(p.estimatedLatencyMs)}ms
    router=${p.routingPolicy}  slicer=${p.slicingPolicy}  fill=${pct(p.expectedFillRatio)}
    routes: ${p.routes.map((r) => `${r.venue}[${fmtMoney(r.notional)}]`).join(' ')}
    slices: ${p.slices.slice(0, 4).map((s) => `#${s.sequence}:${fmtMoney(s.notional)}@${fmt(s.estimatedPrice)}`).join(' ')}${p.slices.length > 4 ? ` ...(+${p.slices.length - 4})` : ''}`);
  }

  parts.push(`
--- PLAN OUTCOMES (FULL / PARTIAL / BLOCKED / REROUTE / REPLAN) ---`);
  const labels: Record<string, string> = {
    EXECUTABLE: 'FULL EXECUTION PLAN',
    PARTIAL_EXECUTABLE: 'PARTIAL EXECUTION PLAN',
    BLOCKED: 'BLOCKED PLAN',
  };
  for (const r of planResults) {
    parts.push(`  ${(labels[r.decision] ?? r.decision).padEnd(24)}  ${r.plan.executionPlanId.slice(0, 26)}  planned=${fmtMoney(r.plan.plannedCapital)}  reason=${r.reason}`);
  }

  // A deliberately BLOCKED plan: an ATOMIC (coordinated) strategy with an
  // unavailable mandatory leg must block — never emit a dangerous partial plan.
  const blockTarget = risk.decisions.find((d) => candidates[d.candidateId]?.strategyType === 'TRIANGULAR_ARBITRAGE' && d.state === 'RISK_APPROVED') ?? planned[0];
  if (blockTarget && candidates[blockTarget.candidateId]) {
    const afisCand = candidates[blockTarget.candidateId];
    const afisDecision = alloc.result.decisions.find((x) => x.candidateId === afisCand.candidateId);
    const blocked = planner.plan({
      allocation: afisDecision as import('./allocation/optimizer').AllocationDecision,
      candidate: afisCand,
      opportunity: recoverOpportunity(afisCand, ['venue-a', 'venue-b', 'venue-c']),
      strategy: defFor(afisCand.strategyType),
      riskDecision: risk.decisions.find((x) => x.candidateId === afisCand.candidateId) ?? null,
      venues: [emptyVenue('venue-a', afisCand.domain), emptyVenue('venue-b', afisCand.domain), emptyVenue('venue-c', afisCand.domain)],
      controlState: 'ACTIVE',
      timestamp: NOW,
      correlationId: 'demo',
      traceId: 'demo-trace',
      treasuryAvailable: portfolio.availableCapital,
      aegisAllowed: true,
    });
    parts.push(`  ${'BLOCKED PLAN'.padEnd(24)}  ${blocked.plan.executionPlanId.slice(0, 26)}  status=${blocked.plan.status}  reason=${blocked.reason}`);
  }

  // A REROUTED plan: venue-b becomes unhealthy, remaining reroutes.
  const rerouteTarget = multiLegAfin && candidates[multiLegAfin.candidateId] ? multiLegAfin : planned[0];
  if (rerouteTarget && candidates[rerouteTarget.candidateId]) {
    const d = rerouteTarget;
    const cand = candidates[d.candidateId];
    const decision = alloc.result.decisions.find((x) => x.candidateId === d.candidateId);
    const rerouted = planner.plan({
      allocation: decision as import('./allocation/optimizer').AllocationDecision,
      candidate: cand,
      opportunity: recoverOpportunity(cand, ['venue-a', 'venue-b']),
      strategy: defFor(cand.strategyType),
      riskDecision: d,
      venues: [
        demoVenue('venue-a', 'AFIS', 100, 500_000, {latencyMs: 30, reliability: 0.98, spreadBps: 2, fillProbability: 0.97}),
        emptyVenue('venue-b', 'AFIS'),
      ],
      controlState: 'ACTIVE',
      timestamp: NOW,
      correlationId: 'demo',
      traceId: 'demo-trace',
      treasuryAvailable: portfolio.availableCapital,
      treasuryReserved: portfolio.reservedCapital,
      aegisAllowed: true,
    });
    parts.push(`  ${'REROUTED PLAN'.padEnd(24)}  ${rerouted.plan.executionPlanId.slice(0, 26)}  decision=${rerouted.decision}  reason=${rerouted.reason}`);
  }

  // A REPLAN v2 with parent history preserved.
  if (planResults[0]) {
    const parent = planResults[0].plan;
    const d = rerouteTarget && candidates[rerouteTarget.candidateId] ? rerouteTarget : planned[0];
    const cand = candidates[d.candidateId];
    const replanned = planner.plan({
      allocation: alloc.result.decisions.find((x) => x.candidateId === d.candidateId) as import('./allocation/optimizer').AllocationDecision,
      candidate: cand,
      opportunity: recoverOpportunity(cand, ['venue-a']),
      strategy: defFor(cand.strategyType),
      riskDecision: d,
      venues: [demoVenue('venue-a', 'AFIS', 100, 500_000, {latencyMs: 30, reliability: 0.98, spreadBps: 2, fillProbability: 0.97})],
      controlState: 'ACTIVE',
      timestamp: NOW,
      correlationId: 'demo',
      traceId: 'demo-trace',
      treasuryAvailable: portfolio.availableCapital,
      aegisAllowed: true,
      planVersion: parent.version + 1,
      parentPlanId: parent.executionPlanId,
      replanTrigger: 'LIQUIDITY_REDUCED',
    });
    parts.push(`  ${'REPLAN v' + replanned.plan.version}`.padEnd(24) + `  (parent v${parent.version} ${parent.executionPlanId.slice(0, 22)}...)  reason=${replanned.plan.replanTrigger}`);
  }

  // ------------------------------------------------------------------
  // AEGIS → Treasury → Paper Execution → Position → Reconciliation.
  // ------------------------------------------------------------------
  if (planResults[0]) {
    const p = planResults[0].plan;
    const aegis = evaluateExecutionAegis({
      plan: p,
      riskReference: p.riskReference,
      allocationReference: p.allocationReference,
      strategyReference: p.strategyId,
      aegisAllowed: true,
      controlState: 'ACTIVE',
    });
    parts.push(`
--- EXECUTION PLAN → AEGIS → TREASURY → PAPER EXECUTION → POSITION → RECONCILIATION ---
  Execution Plan
    ${p.executionPlanId.slice(0, 30)}  status=${p.status}  planned=${fmtMoney(p.plannedCapital)}  routes=${p.routeCount}  slices=${p.orderCount}
    ↓
  AEGIS
    ${aegis.aegisEvaluationId.slice(0, 30)}  status=${aegis.status}  authorized=${fmtMoney(aegis.authorizedAmount)}
    ↓
  Treasury
    proposal=${p.treasuryReference.slice(0, 30)}  (recommendation only; Treasury stays authoritative)
    ↓
  Paper Execution     (simulated — no real-money / provider creds; deterministic fill model)
    ↓
  Position + Reconciliation  (portfolio remains authoritative; treasury never mutated)`);
  }

  const firstPlan = planResults[0]?.plan;
  parts.push(`
--- REPLAY DETERMINISM ---
  ${firstPlan ? `firstPlanId=${firstPlan.executionPlanId.slice(0, 22)}...  fingerprint=${firstPlan.fingerprint.slice(0, 22)}...` : 'no plan'}

System:
  RECONCILED
==============================================================`);
  console.log(parts.join('\n'));
}

main();
