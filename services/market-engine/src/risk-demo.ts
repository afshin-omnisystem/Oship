import {UnifiedAllocationEngine, DEFAULT_ALLOCATION_ENGINE_CONFIG, AllocationPosition} from './allocation/optimizer';
import {portfolioCtx} from './allocation/optimizer/test-fixtures';
import {RiskAssessorEngine, DEFAULT_RISK_CONFIG, DEFAULT_RISK_LIMITS} from './risk/decision';
import {emptyPortfolioRiskContext} from './risk/decision/portfolio-context';
import {evaluateRiskAegis, riskTreasuryGate, riskEmergencyGate} from './risk/decision/boundaries';
import {buildRiskAudit} from './risk/decision/audit';
import {RiskReplay} from './risk/decision/replay';
import {riskCandidate as makeRiskCandidate, riskDecisionFor, riskPortfolio as makeRiskPortfolio} from './risk/decision/test-fixtures';
import {Opportunity} from './opportunity';
import {StrategyDefinition, StrategySelection, StrategyType} from './strategy/intelligence';
import {
  crossVenueOpportunity,
  fundingOpportunity,
  surebetOpportunity,
  valueOpportunity,
  hedgeOpportunity,
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

function main(): void {
  const parts: string[] = [];

  parts.push(`
==============================================================
 OSHIP — SPRINT 029
 UNIFIED PORTFOLIO RISK DECISION & RISK BUDGET ENGINE
==============================================================

Canonical authority flow:
  OIIN → Intelligence → Opportunity → Strategy → Allocation
    → RISK DECISION → AEGIS → Treasury → Execution

  Allocation answers HOW MUCH.
  Risk Decision answers IS IT SAFE.
  AEGIS answers IS AUTHORIZED.
  Treasury answers IS CAPITAL AVAILABLE / RESERVED.
  One Portfolio, one Risk Authority, one Treasury.`);

  // ONE unified Treasury: AFIS + ABL compete for the same pool, then the
  // resulting allocations are all assessed in a single unified risk plane.
  const portfolio = portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}});
  const positions: AllocationPosition[] = [
    pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'),
    pos(fundingOpportunity(), 'FUNDING_CARRY'),
    pos(surebetOpportunity(), 'SUREBET_STAKE'),
    pos(valueOpportunity(), 'SPORTS_VALUE'),
    pos(hedgeOpportunity(), 'HEDGE_MIDDLE'),
  ];

  parts.push(`
--- UNIFIED TREASURY (ONE POOL, AFIS + ABL COMPETE) ---
  total capital       : ${fmtMoney(portfolio.totalCapital)}
  reserved            : ${fmtMoney(portfolio.reservedCapital)}
  available (net)     : ${fmtMoney(portfolio.availableCapital)}

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
    parts.push(`  ${d.candidateId.slice(0, 18).padEnd(20)}${d.domain.padEnd(6)}${fmtMoney(d.allocatedCapital).padEnd(12)}${d.strategyId.slice(0, 34)}`);
  }
  parts.push(`  TOTAL ALLOCATED: ${fmtMoney(alloc.result.totalAllocated)}   UNALLOCATED: ${fmtMoney(alloc.result.unallocatedCapital)}   INVARIANTS: ${alloc.result.invariantsSatisfied ? 'PASS' : 'FAIL'}`);

  // Build the risk input from the allocation result.
  const candidates: Record<string, import('./allocation/optimizer').AllocationCandidate> = {};
  for (const c of alloc.candidates) candidates[c.candidateId] = c;
  const riskPortfolio = emptyPortfolioRiskContext({
    totalCapital: portfolio.totalCapital,
    availableCapital: portfolio.availableCapital,
    reservedCapital: portfolio.reservedCapital,
    grossExposure: alloc.result.totalAllocated,
    domainExposure: {AFIS: alloc.result.decisions.filter((d) => d.domain === 'AFIS').reduce((a, d) => a + d.allocatedCapital, 0), ABL: alloc.result.decisions.filter((d) => d.domain === 'ABL').reduce((a, d) => a + d.allocatedCapital, 0)},
  });

  parts.push(`
--- PROJECTED PORTFOLIO (existing + new allocations) ---
  Portfolio id        : ${riskPortfolio.portfolioId}
  gross exposure      : ${fmtMoney(riskPortfolio.grossExposure)}
  available capital   : ${fmtMoney(riskPortfolio.availableCapital)}
  domain AFIS / ABL   : ${fmtMoney(riskPortfolio.domainExposure.AFIS ?? 0)} / ${fmtMoney(riskPortfolio.domainExposure.ABL ?? 0)}`);

  const riskConfig = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxConcentration: 0.35}};
  const risk = new RiskAssessorEngine(riskConfig).assess({
    decisions: alloc.result.decisions,
    candidates,
    portfolio: riskPortfolio,
    correlationId: 'demo',
    traceId: 'demo-trace',
    timestamp: NOW,
    controlState: 'ACTIVE',
  });

  parts.push(`
--- RISK ASSESSMENT (AFIS + ABL in one unified risk budget) ---
  ${'Candidate'.padEnd(20)}${'Domain'.padEnd(6)}${'Requested'.padEnd(11)}${'Approved'.padEnd(11)}${'Blocked'.padEnd(11)}${'Scale'.padEnd(18)}${'Score'.padEnd(8)}${'State'}`);
  for (const d of [...risk.decisions].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    parts.push(`  ${d.candidateId.slice(0, 18).padEnd(20)}${d.domain.padEnd(6)}${fmtMoney(d.requestedCapital).padEnd(11)}${fmtMoney(d.approvedCapital).padEnd(11)}${fmtMoney(d.blockedCapital).padEnd(11)}${d.scale.padEnd(18)}${fmt(d.riskScore).padEnd(8)}${d.state}`);
  }
  parts.push(`  RiskRun total approved = ${fmtMoney(risk.approvedCapital)}   blocked = ${fmtMoney(risk.blockedCapital)}   decision = ${risk.decision}`);
  for (const d of risk.decisions) {
    if (d.scale === 'BLOCKED') parts.push(`    BLOCKED ${d.candidateId}: ${d.riskReason}`);
    else if (d.scale === 'PARTIAL_APPROVAL' || d.scale === 'REDUCED') parts.push(`    SCALED  ${d.candidateId}: ${d.riskReason}`);
  }

  parts.push(`
--- STRESS TEST (NORMAL / ADVERSE / SEVERE / EXTREME) ---
  ${'Scenario'.padEnd(10)}${'Portfolio Loss'.padEnd(17)}${'Candidate Loss'.padEnd(17)}${'Domain Loss'.padEnd(15)}${'Budget Util'.padEnd(14)}${'Remaining'.padEnd(12)}${'Constrained'}`);
  for (const s of risk.stress.scenarios) {
    parts.push(`  ${s.scenario.padEnd(10)}${fmtMoney(s.portfolioLoss).padEnd(17)}${fmtMoney(s.candidateLoss).padEnd(17)}${fmtMoney(s.domainLoss).padEnd(15)}${pct(s.riskBudgetUtilization).padEnd(14)}${fmtMoney(s.remainingRiskBudget).padEnd(12)}${s.constrained ? 'YES' : 'no'}`);
  }
  parts.push(`  WORST-CASE: ${risk.stress.worstCase}   worst-case loss = ${fmtMoney(risk.stress.worstCaseLoss)}   maxScenarioLossExceeded = ${risk.stress.maxScenarioLossExceeded ? 'YES' : 'no'}`);

  // Show one FULL, one PARTIAL, one BLOCKED if present in the data.
  const d0 = risk.decisions[0];
  const aegis = evaluateRiskAegis(d0, true);
  const gate = riskTreasuryGate({authorizedAmount: risk.approvedCapital, treasuryAvailable: portfolio.availableCapital, reserved: portfolio.reservedCapital});
  const emergency = riskEmergencyGate('ACTIVE');
  const audit = buildRiskAudit(d0, riskPortfolio.portfolioId);

  parts.push(`
--- RISK DECISION → AEGIS → TREASURY → PAPER EXECUTION ---
  Risk decision id    : ${d0.riskDecisionId}
  risk score          : ${fmt(d0.riskScore)}   state=${d0.state}   scale=${d0.scale}
    ↓
  AEGIS
    status            : ${aegis.aegisStatus}   reason=${aegis.reason}
    ↓
  Treasury
    authorized        : ${fmtMoney(risk.approvedCapital)}   gate=${gate.authorized ? 'AUTHORIZED' : 'BLOCKED'}   (${gate.reason})
    emergency         : ${emergency.canApprove ? 'ACTIVE' : 'NO_NEW_ALLOCATION'}
    ↓
  Paper execution     (simulated — no real-money / provider creds)
    ↓
  Audit (oship.risk.v1)
    riskDecisionId    : ${audit.riskDecisionId}
    schema            : ${audit.schemaVersion}   decision=${audit.decision}   stress=${audit.stressSummary}`);

  // ------------------------------------------------------------------
  // RISK SCALING DEMONSTRATION: show FULL / PARTIAL / BLOCKED explicitly.
  // ------------------------------------------------------------------
  parts.push(`
--- RISK SCALING (FULL / PARTIAL / BLOCKED) ---`);
  // A safe candidate -> FULL_APPROVAL.
  const fullCand = makeRiskCandidate({candidateId: 'sc-full', domain: 'ABL', requiredCapital: 3_000, risk: 0.06, confidence: 0.95, liquidity: 20_000});
  // A candidate that spikes domain exposure -> PARTIAL_APPROVAL.
  const partialCand = makeRiskCandidate({candidateId: 'sc-partial', domain: 'AFIS', requiredCapital: 12_000, risk: 0.15, confidence: 0.8, liquidity: 50_000});
  // An all-or-nothing candidate that cannot be fully funded -> BLOCKED.
  const blockCand = makeRiskCandidate({candidateId: 'sc-block', domain: 'AFIS', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', risk: 0.4, confidence: 0.5, liquidity: 20_000});

  const scalingConfig = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxDomainExposure: {AFIS: 12_000, ABL: 10_000}, maxCorrelationExposure: 12_000}};
  const scalingPortfolio = makeRiskPortfolio({availableCapital: 30_000, totalCapital: 40_000, grossExposure: 9_000, domainExposure: {AFIS: 3_000, ABL: 2_000}});
  const scaling = new RiskAssessorEngine(scalingConfig).assess({
    decisions: [riskDecisionFor(fullCand), riskDecisionFor(partialCand), riskDecisionFor(blockCand)],
    candidates: {[fullCand.candidateId]: fullCand, [partialCand.candidateId]: partialCand, [blockCand.candidateId]: blockCand},
    portfolio: scalingPortfolio,
    correlationId: 'demo',
    traceId: 'demo-trace',
    timestamp: NOW,
  });
  for (const d of scaling.decisions) {
    parts.push(`  ${d.candidateId.padEnd(16)}${d.domain.padEnd(6)}requested=${fmtMoney(d.requestedCapital).padEnd(9)}approved=${fmtMoney(d.approvedCapital).padEnd(9)}blocked=${fmtMoney(d.blockedCapital).padEnd(9)}${d.scale.padEnd(18)}${d.state}`);
  }

  parts.push(`
--- REPLAY DETERMINISM ---`);
  const replay = new RiskReplay();
  const live = replay.runLive({decisions: alloc.result.decisions, candidates, portfolio: riskPortfolio, correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW});
  const again = replay.runReplay({decisions: alloc.result.decisions, candidates, portfolio: riskPortfolio, correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW});
  const cmp = replay.compare(live, again);
  parts.push(`  original.decisionId === replay.decisionId  : ${cmp.decisionIdsMatch ? 'PASS' : 'FAIL'}`);
  parts.push(`  original.fingerprint === replay.fingerprint : ${cmp.fingerprintsMatch ? 'PASS' : 'FAIL'}`);
  parts.push(`  replay match                              : ${cmp.match ? 'PASS' : 'FAIL'}`);

  parts.push(`
System:
  RECONCILED
==============================================================`);
  console.log(parts.join('\n'));
}

main();
