import {StrategyRegistry, StrategyDiscoveryEngine, StrategyReplay} from './strategy/intelligence';
import {
  crossVenueOpportunity,
  surebetOpportunity,
  defaultPortfolioContext,
} from './strategy/intelligence/test-fixtures';
import {Opportunity} from './opportunity';

const NOW = 1704067200000;

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(5) : 'n/a';
}

function fmtMoney(v: number): string {
  return Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : 'n/a';
}

function summarize(
  label: string,
  engine: StrategyDiscoveryEngine,
  opp: Opportunity,
  portfolioCtx: ReturnType<typeof defaultPortfolioContext>,
  available: number,
  total: number,
): string[] {
  const res = engine.discover({opportunity: opp, portfolioContext: portfolioCtx, availableCapital: available, totalCapital: total, correlationId: 'demo', traceId: 'demo-trace', timestamp: opp.observedAt});
  const out: string[] = [];
  out.push(`${label}`);
  out.push(`  Opportunity: ${opp.opportunityId}  type=${opp.type}  status=${opp.status}  domain=${opp.domain}`);
  out.push(`  Candidates (${res.candidates.length}):`);
  for (const c of res.candidates) {
    out.push(`    - ${c.strategyId}  (${c.type})  cap=${fmtMoney(c.requiredCapital)}`);
  }
  out.push(`  Evaluation / Ranking:`);
  for (const r of res.ranking) {
    const e = res.evaluated.find((x) => x.candidateId === r.candidateId);
    const tag = r.admissible ? `rank=#${r.rank}` : 'rejected';
    out.push(`    ${tag.padEnd(14)} ${r.strategyId.padEnd(40)} score=${fmt(r.score)}${e ? `  capEff=${fmt(e.economics.capitalEfficiency)}  conf=${fmt(e.economics.confidence)}` : ''}${r.admissible ? '' : `  (${r.rejectionReason})`}`);
  }
  out.push(`  Selection:`);
  if (res.selection.admissibility) {
    out.push(`    SELECTED: ${res.selection.selectedStrategyId}  (${res.selection.selectedDomain}/${res.selection.selectedType})`);
    out.push(`    reason=${res.selection.reason}  decision=${res.selection.decisionId}`);
  } else {
    out.push(`    NO_ADMISSIBLE_STRATEGY  (${res.selection.reason})`);
  }
  out.push(`  Audit: decision=${res.selection.decisionId.slice(0, 20)}...  candidates=${res.audit.candidateIds.length}  rejected=${res.audit.rejectedStrategies.length}`);
  return out;
}

function main(): void {
  const registry = new StrategyRegistry();
  const engine = registry.engine();
  const portfolioCtx = defaultPortfolioContext();
  const parts: string[] = [];

  parts.push(`
==============================================================
 OSHIP — SPRINT 027
 UNIFIED STRATEGY INTELLIGENCE & AUTONOMOUS STRATEGY SELECTION
==============================================================

OPPORTUNITY
    ↓
STRATEGY CANDIDATES
    ↓
EVALUATION
    ↓
RANKING
    ↓
SELECTION

--- AFIS MARKET ---`);
  parts.push(summarize('Cross-Venue Spot Arbitrage', engine, crossVenueOpportunity(), portfolioCtx, 90_000, 100_000).join('\n'));

  parts.push(`
--- ABL MARKET ---`);
  parts.push(summarize('Odds Arbitrage / Surebet', engine, surebetOpportunity(), defaultPortfolioContext({correlationExposure: {['surebet']: 500}}), 90_000, 100_000).join('\n'));

  // Cross-domain capital competition: AFIS + ABL in one shared ranking.
  parts.push(`
--- CROSS-DOMAIN CAPITAL COMPETITION ---
  AFIS and ABL strategies compete for ONE shared Treasury. They are ranked
  together by the composite score, so capital goes to the best risk-adjusted
  strategy, not to the largest raw return.

  ${'AFIS Rank'.padEnd(12)}${'Strategy'.padEnd(44)}${'Score'.padEnd(12)}${'Capital Eff'.padEnd(12)}${'Confidence'}`);
  const afisRes = engine.discover({opportunity: crossVenueOpportunity(), portfolioContext: portfolioCtx, availableCapital: 90_000, totalCapital: 100_000, correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW});
  const ablRes = engine.discover({opportunity: surebetOpportunity(), portfolioContext: defaultPortfolioContext({correlationExposure: {['surebet']: 500}}), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW});
  const combined = [
    ...afisRes.selection.ranking.filter((r) => r.admissible),
    ...ablRes.selection.ranking.filter((r) => r.admissible),
  ].sort((a, b) => b.score - a.score);
  let rank = 1;
  for (const r of combined) {
    const e = [...afisRes.evaluated, ...ablRes.evaluated].find((x) => x.candidateId === r.candidateId);
    parts.push(`  ${(`#${rank++}`).padEnd(12)}${r.strategyId.padEnd(44)}${fmt(r.score).padEnd(12)}${e ? fmt(e.economics.capitalEfficiency).padEnd(12) : ''.padEnd(12)}${e ? e.economics.confidence.toFixed(3) : ''}`);
  }

  parts.push(`
--- SELECTED STRATEGY → AUTHORITY CHAIN ---
  Selected Strategy
    ↓ Portfolio evaluation     (proposal-only; portfolio stays authoritative)
    ↓ Risk evaluation          (exposure + limits enforced)
    ↓ Allocation evaluation    (capital sizing, no self-allocation)
    ↓ AEGIS                    (authorization boundary — strategy never self-authorizes)
    ↓ Treasury                 (strategy never mutates treasury)
    ↓ Paper Execution          (simulation only)

  The strategy layer is strictly proposal-only. It emits a ranked + selected
  strategy and a structured audit record; Portfolio / Risk / Allocation / AEGIS /
  Treasury / Execution remain the authority boundaries.

--- REPLAY DETERMINISM ---
  Identical inputs → identical candidates, evaluations, ranking, selection and
  decision id. Changing configuration → a changed (deterministic) decision.`);
  const replay = new StrategyReplay();
  const live = replay.runLive({opportunity: crossVenueOpportunity(), portfolioContext: portfolioCtx, availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW}});
  const again = replay.runReplay({opportunity: crossVenueOpportunity(), portfolioContext: portfolioCtx, availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'demo', traceId: 'demo-trace', timestamp: NOW}});
  const cmp = replay.compare(live, again);
  parts.push(`  match=${cmp.match}  candidates=${cmp.candidatesMatch ? 'PASS' : 'FAIL'}  evaluations=${cmp.evaluationsMatch ? 'PASS' : 'FAIL'}  ranking=${cmp.rankingMatch ? 'PASS' : 'FAIL'}  selection=${cmp.selectionMatch ? 'PASS' : 'FAIL'}  decisionId=${cmp.decisionIdMatch ? 'PASS' : 'FAIL'}`);

  parts.push(`
System:
  RECONCILED
==============================================================`);
  console.log(parts.join('\n'));
}

main();
