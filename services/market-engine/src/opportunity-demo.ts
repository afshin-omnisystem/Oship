import {createEvent, OiinEvent, EventSourceMetadata} from './oiin';
import {OpportunityDiscoveryEngine, OpportunityReplay, compareOpportunityReplay} from './opportunity';

const NOW = 1704067200000;
const marketSource: EventSourceMetadata = {
  sourceId: 'venusim',
  provider: 'sim',
  connectorId: 'conn-a',
  domain: 'MARKET',
  reliability: 0.99,
  latencyMs: 5,
  observedAt: NOW,
};
const sportsSource: EventSourceMetadata = {...marketSource, domain: 'SPORTS'};

function tick(ev: OiinEvent): OiinEvent {
  return ev;
}

// AFIS cross-venue spot dislocation (deep books so the cost model accepts it).
const afisEvents: OiinEvent[] = [
  createEvent({eventType: 'ORDER_BOOK_UPDATE', timestamp: NOW, source: marketSource, correlationId: 'afis-demo', payload: {symbol: 'BTC/USDT', venue: 'VENUE_A', bid: 100_000, ask: 100_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}}),
  createEvent({eventType: 'ORDER_BOOK_UPDATE', timestamp: NOW, source: marketSource, correlationId: 'afis-demo', payload: {symbol: 'BTC/USDT', venue: 'VENUE_B', bid: 113_000, ask: 113_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}}),
];

// ABL surebet: same selection quoted deep by two bookmakers -> covered arb.
const ablEvents: OiinEvent[] = [
  createEvent({eventType: 'ODDS_UPDATE', timestamp: NOW, source: sportsSource, correlationId: 'abl-demo', payload: {market: 'MATCH-X', category: 'winner', selection: 'HOME', bookmaker: 'BOOK_A', back: 3.0, commission: 0.01}}),
  createEvent({eventType: 'ODDS_UPDATE', timestamp: NOW, source: sportsSource, correlationId: 'abl-demo', payload: {market: 'MATCH-X', category: 'winner', selection: 'HOME', bookmaker: 'BOOK_B', back: 3.5, commission: 0.01}}),
];

function summarize(label: string, engine: OpportunityDiscoveryEngine, events: readonly OiinEvent[]): string {
  const result = engine.discoverFromEvents(events.map(tick), {
    now: NOW,
    correlationId: 'demo',
    traceId: 'demo-trace',
    availableCapital: 1_000_000_000,
  });
  const lines: string[] = [];
  lines.push(`  Events: ${events.length}`);
  lines.push(`  Opportunities: ${result.opportunities.length}`);
  lines.push(`  Batch: ${result.batchId}`);
  for (const o of result.opportunities) {
    lines.push(`    - ${o.domain}/${o.type}  dir=${o.direction}  status=${o.status}` +
      (o.rank ? `  rank=#${o.rank.rank} score=${o.rank.score.toFixed(3)}` : '') +
      `\n      gross=${o.grossEdge.toFixed(5)} net=${o.netEdge.toFixed(5)} conf=${o.confidence.toFixed(3)} risk=${o.risk.overall.toFixed(3)}`);
  }
  return `${label}\n${lines.join('\n')}`;
}

function main(): void {
  const engine = new OpportunityDiscoveryEngine();
  const parts: string[] = [];

  parts.push(`
==============================================================
 OSHIP — SPRINT 026
 UNIFIED MULTI-VENUE OPPORTUNITY DISCOVERY ENGINE
==============================================================

--- AFIS MARKET ---`);
  parts.push(summarize('Cross-Venue Spot Arbitrage', new OpportunityDiscoveryEngine(), afisEvents));

  parts.push(`
--- ABL MARKET ---`);
  parts.push(summarize('Odds Arbitrage / Surebet', new OpportunityDiscoveryEngine(), ablEvents));

  // Cross-domain ranking: AFIS + ABL compete for the same capital.
  parts.push(`
--- CROSS-DOMAIN CAPITAL COMPETITION ---
  Ranking merges AFIS and ABL into a single score, so capital is allocated
  to the best risk-adjusted edge, not the largest raw percentage.`);
  const combined = new OpportunityDiscoveryEngine().discoverFromEvents([...afisEvents, ...ablEvents], {
    now: NOW, correlationId: 'demo', traceId: 'demo-trace', availableCapital: 1_000_000_000,
  });
  parts.push(`  Ranked opportunities:`);
  for (const o of combined.opportunities.filter((x) => x.rank).sort((a, b) => a.rank!.rank - b.rank!.rank)) {
    parts.push(`    #${o.rank!.rank}  ${o.domain}/${o.type}  conf=${o.confidence.toFixed(3)}  netEdge=${o.netEdge.toFixed(5)}`);
  }

  parts.push(`
--- REPLAY DETERMINISM ---
  The same canonical event log is re-run into a fresh engine and compared
  against the live run. Any divergence (ids, state, ranking, audit) fails.`);
  const replay = new OpportunityReplay();
  const live = replay.runLive({events: [...afisEvents, ...ablEvents], options: {now: NOW, correlationId: 'demo', traceId: 'demo-trace', availableCapital: 1_000_000_000}});
  const again = replay.runReplay({events: [...afisEvents, ...ablEvents], options: {now: NOW, correlationId: 'demo', traceId: 'demo-trace', availableCapital: 1_000_000_000}});
  const cmp = compareOpportunityReplay(live, again);
  parts.push(`  match=${cmp.match}  ids=${cmp.idsMatch ? 'PASS' : 'FAIL'}  state=${cmp.opportunitiesMatch ? 'PASS' : 'FAIL'}  ranking=${cmp.rankingMatch ? 'PASS' : 'FAIL'}  audit=${cmp.auditMatch ? 'PASS' : 'FAIL'}`);
  if (!cmp.match) parts.push(`  mismatches: ${cmp.mismatches.join(', ')}`);

  parts.push(`
--- AUTHORITY CHAIN ---
  Opportunity discovery is proposal-only. It emits CANDIDATE -> VALIDATED ->
  RANKED opportunities and NEVER mutates Strategy / Risk / Allocation / AEGIS /
  Treasury / Execution. Downstream consumers choose whether to act.

System:
  RECONCILED
==============================================================`);

  console.log(parts.join('\n'));
}

main();
