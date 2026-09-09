import {UnifiedAllocationEngine, DEFAULT_ALLOCATION_ENGINE_CONFIG, AllocationPosition} from './allocation/optimizer';
import {buildTreasuryProposal, allocationAuthorizationGate, allocationEmergencyGate} from './allocation/optimizer';
import {portfolioCtx} from './allocation/optimizer/test-fixtures';
import {Opportunity} from './opportunity';
import {StrategyDefinition, StrategySelection, StrategyType} from './strategy/intelligence';
import {
  crossVenueOpportunity,
  fundingOpportunity,
  surebetOpportunity,
  valueOpportunity,
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
 OSHIP — SPRINT 028
 UNIFIED CAPITAL ALLOCATION & PORTFOLIO OPTIMIZATION ENGINE
==============================================================

Canonical authority flow:
  OIIN → Intelligence → Opportunity Discovery → Strategy Selection
    → Portfolio Context → Risk Evaluation → Capital Optimization
    → ALLOCATION → AEGIS → TREASURY → Execution

  Allocation answers HOW MUCH.
  AEGIS answers IS AUTHORIZED.
  Treasury answers IS CAPITAL AVAILABLE / RESERVED.
  No authority is collapsed; no role is skipped.`);

  // A single unified Treasury: AFIS + ABL compete for ONE shared pool.
  const portfolio = portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}});
  const positions: AllocationPosition[] = [
    pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'),
    pos(fundingOpportunity(), 'FUNDING_CARRY'),
    pos(surebetOpportunity(), 'SUREBET_STAKE'),
    pos(valueOpportunity(), 'SPORTS_VALUE'),
  ];

  parts.push(`
--- SHARED CAPITAL (ONE UNIFIED TREASURY) ---
  total capital       : ${fmtMoney(portfolio.totalCapital)}
  reserved            : ${fmtMoney(portfolio.reservedCapital)}
  available (net)     : ${fmtMoney(portfolio.availableCapital)}
  AFIS + ABL compete  : YES (single pool, no separate treasury)`);

  const config = {...DEFAULT_ALLOCATION_ENGINE_CONFIG, constraints: {...DEFAULT_ALLOCATION_ENGINE_CONFIG.constraints, totalAvailableCapital: portfolio.totalCapital, reservedCapital: portfolio.reservedCapital}};
  const engine = new UnifiedAllocationEngine(config);
  const out = engine.allocate({
    positions,
    portfolio,
    correlationId: 'demo',
    traceId: 'demo-trace',
    timestamp: NOW,
    aegisAllowed: true,
    treasuryAvailable: portfolio.availableCapital,
    controlState: 'ACTIVE',
  });

  parts.push(`
--- CANDIDATES (eligible Opportunity + selected Strategy) ---
  ${'Candidate'.padEnd(20)}${'Domain'.padEnd(6)}${'Req Cap'.padEnd(10)}${'RiskAdj'.padEnd(10)}${'Conf'.padEnd(7)}${'Liq'.padEnd(10)}${'Mode'}`);
  for (const c of out.candidates) {
    parts.push(`  ${c.candidateId.slice(0, 18).padEnd(20)}${c.domain.padEnd(6)}${fmtMoney(c.requiredCapital).padEnd(10)}${fmtMoney(c.riskAdjustedReturn).padEnd(10)}${c.confidence.toFixed(2).padEnd(7)}${fmtMoney(c.liquidity).padEnd(10)}${c.allocationMode}`);
  }

  parts.push(`
--- OPTIMIZATION (deterministic greedy, score-ordered) ---
  ${'Rank'.padEnd(6)}${'Candidate'.padEnd(20)}${'Score'.padEnd(9)}${'Risk'.padEnd(7)}${'Liq'.padEnd(7)}${'Corr'.padEnd(7)}${'CapEff'.padEnd(9)}${'Duration'}`);
  for (const d of out.result.rankings) {
    parts.push(`  ${(`#${d.rank}`).padEnd(6)}${d.candidateId.slice(0, 18).padEnd(20)}${fmt(d.allocationScore).padEnd(9)}${d.riskScore.toFixed(2).padEnd(7)}${fmt(d.liquidity).padEnd(7)}${d.correlationGroup.slice(0, 6).padEnd(7)}${fmt(d.capitalEfficiency).padEnd(9)}${fmt(d.capitalDurationRatio)}`);
  }

  const totalAllocated = out.result.totalAllocated;
  parts.push(`
--- FINAL ALLOCATION ---
  ${'Candidate'.padEnd(20)}${'Requested'.padEnd(11)}${'Allocated'.padEnd(12)}${'Ratio'.padEnd(8)}${'Unalloc'.padEnd(10)}${'Status'}`);
  for (const d of [...out.result.rankings, ...out.result.rejections]) {
    const status = d.status;
    parts.push(`  ${d.candidateId.slice(0, 18).padEnd(20)}${fmtMoney(d.requestedCapital).padEnd(11)}${fmtMoney(d.allocatedCapital).padEnd(12)}${pct(d.allocationRatio).padEnd(8)}${fmtMoney(d.unallocatedCapital).padEnd(10)}${status}`);
  }

  parts.push(`
  Total allocated      : ${fmtMoney(totalAllocated)}
  Unallocated capital  : ${fmtMoney(out.result.unallocatedCapital)}  (kept liquid + reserve)
  INVARIANTS PASS      : ${out.result.invariantsSatisfied ? 'YES' : 'NO'}${out.result.invariantViolations.length ? `  [${out.result.invariantViolations.join(', ')}]` : ''}
  Decision             : ${out.result.decision}
  Optimization id      : ${out.result.optimizationId}`);

  parts.push(`
--- ALLOCATION → AEGIS → TREASURY → PAPER EXECUTION → POSITION → RECONCILIATION ---
  Allocation
    ${out.treasuryProposal.allocationId.slice(0, 26)}  amount=${fmtMoney(out.treasuryProposal.amount)}  purpose=${out.treasuryProposal.purpose}
    ↓
  AEGIS
    ${out.aegis.aegisEvaluationId.slice(0, 26)}  status=${out.aegis.status}  reason=${out.aegis.reason}
    ↓
  Treasury
    authorization=${out.treasuryProposal.authorizationId.slice(0, 26)}
    authorizationGate=${allocationAuthorizationGate({aegis: out.aegis, treasuryAvailable: portfolio.availableCapital, requested: out.treasuryProposal.amount}).authorized ? 'AUTHORIZED' : 'BLOCKED'}
    emergency=${
      allocationEmergencyGate('ACTIVE').canAllocate ? 'ACTIVE' : 'NO_NEW_ALLOCATION'
    }
    ↓
  Paper execution     (simulated — no real-money / provider creds)
    ↓
  Position + Reconciliation  (portfolio remains authoritative; treasury not mutated)`);

  parts.push(`
--- REPLAY / AUDIT DETERMINISM ---
  replayKey      = ${out.replayKey.slice(0, 26)}...
  audit.schema   = ${out.audit.schemaVersion}
  audit.decision = ${out.audit.decision}
  strategyIds    = ${[...new Set(out.audit.strategyIds)].join(', ')}

System:
  RECONCILED
==============================================================`);
  console.log(parts.join('\n'));
}

main();
