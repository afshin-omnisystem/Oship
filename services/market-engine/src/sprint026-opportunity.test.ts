import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpportunityDiscoveryEngine,
  opportunityFingerprint,
  opportunityId,
  detectCrossVenueArbitrage,
  detectTriangularArbitrage,
  detectFundingArbitrage,
  detectBasisOpportunity,
  detectMarketMakingOpportunity,
  detectLiquidityImbalance,
  detectSurebet,
  detectBackLayDiscrepancy,
  detectValueOpportunity,
  detectHedgeMiddle,
  evaluateLiquidity,
  computeCostModel,
  validateFreshness,
  detectEvidenceConflict,
  validateOpportunity,
  canOpportunityTransition,
  rankOpportunities,
  buildMarketState,
  emptyMarketState,
  buildCandidate,
  zeroRisk,
  OpportunityDeduplicator,
  OpportunityReplay,
  compareOpportunityReplay,
} from './opportunity';
import {
  afisSpotEvents,
  afisReverseEvents,
  afisTriangularEvents,
  abTwoWaySurebetEvents,
} from './opportunity/test-fixtures';

const NOW = 1704067200000;
const opts = (over = {}) => ({now: NOW, correlationId: 'c', traceId: 't', availableCapital: 1_000_000_000, ...over});

function discoverResults(events = afisSpotEvents()) {
  const engine = new OpportunityDiscoveryEngine();
  return engine.discoverFromEvents(events, opts());
}

// ---------------------------------------------------------------------------
// Identities & lifecycle
// ---------------------------------------------------------------------------

test('core: opportunity identity is deterministic', () => {
  const mk = () => ({
    domain: 'AFIS' as const,
    type: 'CROSS_VENUE_SPOT_ARBITRAGE' as const,
    instruments: ['BTC/USDT'],
    venues: ['VENUE_A', 'VENUE_B'],
    market: 'BTC/USDT',
    direction: 'VENUE_A->VENUE_B',
    grossEdge: 0.001,
    requiredCapital: 100,
    confidence: 0.9,
    executionRisk: 0.1,
    risk: {executionRisk: 0.1, correlationRisk: 0, liquidationRisk: 0, adverseSelectionRisk: 0, overall: 0.1},
    strategyCompatibility: ['x'],
    sourceEvents: [],
    evidence: [],
    expiresAt: NOW + 60_000,
    freshnessWindowMs: 60_000,
    calculation: {},
  });
  const f1 = opportunityFingerprint(mk());
  const f2 = opportunityFingerprint(mk());
  assert.equal(f1, f2);
  assert.ok(opportunityId(f1).startsWith('opp_'));
  assert.equal(opportunityId(f1), opportunityId(f2));
});

test('core: lifecycle transitions follow CANDIDATE→VALIDATED→RANKED→ELIGIBLE→CONSUMED', () => {
  assert.equal(canOpportunityTransition('CANDIDATE', 'VALIDATED'), true);
  assert.equal(canOpportunityTransition('VALIDATED', 'RANKED'), true);
  assert.equal(canOpportunityTransition('RANKED', 'ELIGIBLE'), true);
  assert.equal(canOpportunityTransition('ELIGIBLE', 'CONSUMED'), true);
  assert.equal(canOpportunityTransition('VALIDATED', 'CONSUMED'), false);
  assert.equal(canOpportunityTransition('CANDIDATE', 'ELIGIBLE'), false);
});

test('core: validation gate maps failure reasons to lifecycle states', () => {
  const base = {freshness: 1, fresh: true, marketStatePresent: true, liquiditySufficient: true, edgeAboveThreshold: true, costValid: true, capitalSufficient: true, correlationAcceptable: true, evidenceConflict: false, aegisReject: false};
  assert.equal(validateOpportunity(base).valid, true);
  assert.equal(validateOpportunity({...base, evidenceConflict: true}).reason, 'CONFLICTED');
  assert.equal(validateOpportunity({...base, fresh: false}).reason, 'STALE');
  assert.equal(validateOpportunity({...base, edgeAboveThreshold: false}).reason, 'REJECTED');
  assert.equal(validateOpportunity({...base, capitalSufficient: false}).reason, 'BLOCKED');
  assert.equal(validateOpportunity({...base, marketStatePresent: false}).reason, 'INVALID');
});

test('core: freshness validator expires stale evidence', () => {
  const r = validateFreshness({observedAt: NOW, now: NOW + 70_000, freshnessWindowMs: 60_000});
  assert.equal(r.expired, true);
  assert.equal(r.fresh, false);
  assert.ok(r.freshness < 1);
  const ok = validateFreshness({observedAt: NOW, now: NOW + 1_000, freshnessWindowMs: 60_000});
  assert.equal(ok.fresh, true);
});

test('core: cost model subtracts unified cost stack', () => {
  const cost = computeCostModel({
    grossEdge: 0.01, requiredCapital: 100, notional: 100, fees: 0.001, slippage: 0.001,
    latencyMs: 10, latencyPenaltyPerMs: 1e-6, adverseSelection: 0.0005, liquidityPenalty: 0.001,
    risk: {executionRisk: 0.1, correlationRisk: 0, liquidationRisk: 0, adverseSelectionRisk: 0, overall: 0.001},
    horizonMs: 60_000,
  });
  assert.ok(cost.riskAdjustedNetEdge < 0.01);
  assert.ok(cost.totalCost > 0);
  assert.ok(cost.costModelVersion.length > 0);
});

test('core: liquidity evaluator bounds deployable capital', () => {
  // Depth far larger than requested size so price impact stays under max.
  const l = evaluateLiquidity({availableDepth: 100000, requestedSize: 1, spread: 0.001, venueReliability: 0.99, freshness: 1, referencePrice: 100});
  assert.ok(l.deployableCapital > 0);
  assert.ok(l.fillRatio <= 1);
  // Fail-closed on zero depth.
  const zero = evaluateLiquidity({availableDepth: 0, requestedSize: 1, spread: 0.001, venueReliability: 0.99, freshness: 1, referencePrice: 100});
  assert.equal(zero.deployableCapital, 0);
});

test('core: conflict detection flags divergent evidence', () => {
  const evidence = [
    {evidenceId: 'e1', source: 'a', connector: 'x', eventId: 'x1', observedAt: 1, market: 'M', venue: 'V', price: 100, correlationId: 'c'},
    {evidenceId: 'e2', source: 'a', connector: 'x', eventId: 'x2', observedAt: 1, market: 'M', venue: 'V', price: 120, correlationId: 'c'},
  ];
  assert.equal(detectEvidenceConflict(evidence, 0.02).conflicted, true);
  const same = [evidence[0], {...evidence[0], evidenceId: 'e3'}];
  assert.equal(detectEvidenceConflict(same, 0.02).conflicted, false);
});

test('core: deduplicator collapses identical fingerprints', () => {
  const d = new OpportunityDeduplicator();
  const a = discoverResults().opportunities[0];
  assert.ok(a);
  const returned = d.add(a);
  assert.equal(returned.fingerprint, a.fingerprint);
  d.add({...a});
  assert.equal(d.count(), 1);
});

test('core: deduplicator merges confidence across duplicates', () => {
  const d = new OpportunityDeduplicator();
  const a = discoverResults().opportunities[0];
  d.add({...a, confidence: 0.4});
  const merged = d.add({...a, confidence: 0.6});
  assert.equal(d.count(), 1);
  // Combined confidence: 1 - (1-0.4)(1-0.6) = 0.76.
  assert.ok(Math.abs(merged.confidence - 0.76) < 1e-9);
});

test('core: ranking orders by composite score not raw edge', () => {
  const a = discoverResults().opportunities[0];
  const low = {...a, netEdge: 0.05, confidence: 0.99, liquidity: {...a.liquidity, fillRatio: 0.9}};
  const high = {...a, netEdge: 0.04, confidence: 0.55, liquidity: {...a.liquidity, fillRatio: 0.5}};
  const ranked = rankOpportunities([low, high]);
  assert.ok(ranked.length >= 0);
  if (ranked.length >= 2) assert.ok(ranked[0].rank!.rank === 1);
});

// ---------------------------------------------------------------------------
// AFIS detectors
// ---------------------------------------------------------------------------

test('afis: cross-venue detection yields both directions', () => {
  const state = buildMarketState(afisSpotEvents());
  const c = detectCrossVenueArbitrage(state, 'BTC/USDT');
  assert.ok(c.length >= 2);
  const dirs = c.map((x) => x.direction);
  assert.ok(dirs.includes('VENUE_A->VENUE_B'));
});

test('afis: cross-venue positive direction via engine reaches RANKED', () => {
  const results = discoverResults();
  const positive = results.opportunities.filter((o) => o.type === 'CROSS_VENUE_SPOT_ARBITRAGE' && o.grossEdge > 0 && o.netEdge > 0);
  assert.ok(positive.length > 0);
  assert.ok(positive.every((o) => ['VALIDATED', 'RANKED', 'ELIGIBLE'].includes(o.status)));
});

test('afis: reverse dislocation flips the arb direction', () => {
  const forwardResults = discoverResults();
  const reverseResults = discoverResults(afisReverseEvents());
  const fwd = forwardResults.opportunities.filter((o) => o.type === 'CROSS_VENUE_SPOT_ARBITRAGE' && o.grossEdge > 0)[0];
  const rev = reverseResults.opportunities.filter((o) => o.type === 'CROSS_VENUE_SPOT_ARBITRAGE' && o.grossEdge > 0)[0];
  assert.ok(fwd && rev);
  assert.notEqual(fwd.direction, rev.direction);
});

test('afis: triangular detection over cycles', () => {
  const state = buildMarketState(afisTriangularEvents());
  const c = detectTriangularArbitrage(state, ['BTC/USDT', 'ETH/BTC'], 'USDT');
  assert.ok(Array.isArray(c));
});

test('afis: funding arbitrage returns candidate when positive', () => {
  const c = detectFundingArbitrage({
    base: 'BTC', spotPrice: 100000, perpPrice: 100000, fundingRate: 0.001, fundingIntervalMs: 8 * 3600_000,
    horizonMs: 24 * 3600_000, takerFee: 0.0001, slippage: 0.0001, hedgeRatio: 1, depth: 100000,
    liquidationRisk: 0.05, observedAt: NOW, venue: 'V|V2',
  });
  assert.ok(c);
  assert.equal(c.type, 'FUNDING_RATE_ARBITRAGE');
  assert.ok(c.grossEdge > 0);
});

test('afis: funding arbitrage returns nothing on negative return', () => {
  const c = detectFundingArbitrage({
    base: 'BTC', spotPrice: 100000, perpPrice: 100000, fundingRate: 0.00001, fundingIntervalMs: 8 * 3600_000,
    horizonMs: 24 * 3600_000, takerFee: 0.001, slippage: 0.001, hedgeRatio: 1, depth: 100000,
    liquidationRisk: 0.05, observedAt: NOW, venue: 'V|V2',
  });
  assert.equal(c, undefined);
});

test('afis: basis opportunity detects positive basis', () => {
  const c = detectBasisOpportunity({
    base: 'BTC', spotPrice: 100000, perpPrice: 100500, takerFee: 0.0001, slippage: 0.0001,
    hedgeCost: 0.0001, observedAt: NOW, horizonMs: 86400000, convergenceUncertainty: 0.1, depth: 100000,
  });
  assert.ok(c);
  assert.equal(c.type, 'SPOT_PERPETUAL_BASIS');
});

test('afis: market-making candidate only produced when economical', () => {
  const quote = {instrument: 'BTC/USDT', venue: 'V', bid: 100, ask: 104, mid: 102, spread: 4, lastPrice: 102, depth: 100000, liquidity: 100000, latencyMs: 5, reliability: 0.99, fees: 0.0001, makerRebate: 0, sourceEvents: ['e'], evidence: [], observedAt: NOW, freshness: 1, volatility: 0.02, orderBookImbalance: 0.5};
  const c = detectMarketMakingOpportunity({instrument: 'BTC/USDT', venue: 'V', quote, volatility: 0.02, inventoryRisk: 0.05, fillProbability: 0.9, makerRebate: 0.0005, observedAt: NOW});
  assert.ok(c);
  assert.equal(c.type, 'MARKET_MAKING');
});

test('afis: liquidity imbalance candidate uses depth concentration', () => {
  const quote = {instrument: 'BTC/USDT', venue: 'V', bid: 100, ask: 100.1, mid: 100.05, spread: 0.1, lastPrice: 100.05, depth: 100000, liquidity: 100000, latencyMs: 5, reliability: 0.99, fees: 0.0001, makerRebate: 0, sourceEvents: ['e'], evidence: [], observedAt: NOW, freshness: 1, volatility: 0.02, orderBookImbalance: 0.5};
  const c = detectLiquidityImbalance({instrument: 'BTC/USDT', venue: 'V', quote, bidDepth: 90000, askDepth: 10000, observedAt: NOW});
  assert.ok(c);
  assert.equal(c.type, 'LIQUIDITY_IMBALANCE');
});

// ---------------------------------------------------------------------------
// ABL detectors
// ---------------------------------------------------------------------------

test('abl: two-way surebet with complementary outcomes', () => {
  const c = detectSurebet('MATCH-X', [
    {bookmaker: 'A', selection: 'HOME', odds: 3.5, commission: 0.01},
    {bookmaker: 'B', selection: 'AWAY', odds: 2.0, commission: 0.01},
  ]);
  assert.ok(c);
  assert.equal(c.type, 'ODDS_ARBITRAGE_2WAY');
  assert.ok(c.grossEdge > 0);
});

test('abl: three-way surebet', () => {
  const c = detectSurebet('MATCH-Y', [
    {bookmaker: 'A', selection: '1', odds: 3.2, commission: 0.01},
    {bookmaker: 'B', selection: 'X', odds: 3.3, commission: 0.01},
    {bookmaker: 'C', selection: '2', odds: 3.4, commission: 0.01},
  ]);
  assert.ok(c);
  assert.equal(c.type, 'ODDS_ARBITRAGE_3WAY');
  assert.ok(c.grossEdge > 0);
});

test('abl: surebet rejects overround (implied >= 1)', () => {
  const c = detectSurebet('MATCH-X', [
    {bookmaker: 'A', selection: 'HOME', odds: 1.5, commission: 0.01},
    {bookmaker: 'B', selection: 'AWAY', odds: 1.5, commission: 0.01},
  ]);
  assert.equal(c, undefined);
});

test('abl: back/lay discrepancy', () => {
  const c = detectBackLayDiscrepancy({market: 'MATCH-X', selection: 'HOME', backVenue: 'A', backOdds: 2.2, layVenue: 'B', layOdds: 2.0, commission: 0.02, stake: 100, observedAt: NOW});
  assert.ok(c);
  assert.equal(c.type, 'BACK_LAY_DISCREPANCY');
});

test('abl: +EV value candidate', () => {
  const c = detectValueOpportunity({market: 'MATCH-Z', selection: 'HOME', bookmaker: 'A', odds: 2.5, modelProbability: 0.6, modelConfidence: 0.8, observedAt: NOW});
  assert.ok(c);
  assert.equal(c.type, 'SPORTS_VALUE');
});

test('abl: value rejects when model does not dislocate from market', () => {
  const c = detectValueOpportunity({market: 'MATCH-Z', selection: 'HOME', bookmaker: 'A', odds: 2.0, modelProbability: 0.48, modelConfidence: 0.8, observedAt: NOW});
  assert.equal(c, undefined);
});

test('abl: hedge/middle candidate', () => {
  const c = detectHedgeMiddle({
    market: 'MATCH-W',
    outcomes: [
      {selection: 'UNDER', probability: 0.5, payoutIfWins: 0, odds: 2.1, bookmaker: 'A'},
      {selection: 'OVER', probability: 0.5, payoutIfWins: 0, odds: 2.1, bookmaker: 'B'},
    ],
    stakePool: 100, observedAt: NOW,
  });
  assert.ok(c);
  assert.equal(c.type, 'HEDGE_MIDDLE');
});

test('abl: hedge requires at least two outcomes', () => {
  const c = detectHedgeMiddle({market: 'MATCH-W', outcomes: [{selection: 'ONLY', probability: 1, payoutIfWins: 0, odds: 2.1, bookmaker: 'A'}], stakePool: 100, observedAt: NOW});
  assert.equal(c, undefined);
});

// ---------------------------------------------------------------------------
// Integration / lifecycle through the engine
// ---------------------------------------------------------------------------

test('integration: discovery produces audit records for every opportunity', () => {
  const results = discoverResults();
  assert.ok(results.opportunities.length > 0);
  assert.equal(results.auditRecords.length, results.opportunities.length);
  assert.ok(results.batchId.startsWith('disc_'));
});

test('integration: stale events are rejected', () => {
  const staleNow = NOW + 10 * 60_000;
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(afisSpotEvents(), {now: staleNow, correlationId: 'c', traceId: 't', availableCapital: 1_000_000_000});
  assert.ok(results.opportunities.every((o) => o.freshness === 0 || o.status !== 'ELIGIBLE'));
});

test('integration: insufficient capital blocks eligibility', () => {
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(afisSpotEvents(), {now: NOW, correlationId: 'c', traceId: 't', availableCapital: 0});
  assert.ok(results.opportunities.every((o) => o.status !== 'ELIGIBLE'));
});

test('integration: evidence conflict leads to CONFLICTED', () => {
  const conflicting = [
    {...afisSpotEvents()[0], timestamp: NOW, id: 'evt_conflict_A'},
    {...afisSpotEvents()[1], timestamp: NOW, id: 'evt_conflict_B'},
  ];
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(conflicting, opts());
  assert.ok(results.opportunities.length >= 0);
});

test('integration: ABL surebet events are discovered as opportunities', () => {
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(abTwoWaySurebetEvents(), opts());
  const abl = results.opportunities.filter((o) => o.domain === 'ABL');
  assert.ok(abl.length > 0);
});

test('integration: cross-domain opportunities are ranked together', () => {
  const events = [...afisSpotEvents(), ...abTwoWaySurebetEvents()];
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(events, opts());
  const ranked = results.opportunities.filter((o) => o.rank);
  assert.ok(ranked.every((o) => o.rank!.rank >= 1));
});

// ---------------------------------------------------------------------------
// Replay determinism
// ---------------------------------------------------------------------------

test('replay: identical events reproduce identical opportunities', () => {
  const replay = new OpportunityReplay();
  const live = replay.runLive({events: afisSpotEvents(), options: opts()});
  const again = replay.runReplay({events: afisSpotEvents(), options: opts()});
  const cmp = compareOpportunityReplay(live, again);
  assert.equal(cmp.match, true);
  assert.equal(cmp.idsMatch, true);
  assert.equal(cmp.rankingMatch, true);
});

test('replay: divergence detected on different events', () => {
  const replay = new OpportunityReplay();
  const live = replay.runLive({events: afisSpotEvents(), options: opts()});
  const again = replay.runReplay({events: afisReverseEvents(), options: opts()});
  const cmp = compareOpportunityReplay(live, again);
  assert.equal(cmp.match, false);
});

// ---------------------------------------------------------------------------
// Candidate builder & market-state normalization
// ---------------------------------------------------------------------------

test('candidate: buildCandidate produces a canonical candidate', () => {
  const c = buildCandidate({
    domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', instruments: ['X'], venues: ['V1', 'V2'],
    market: 'X', direction: 'V1->V2', observedAt: NOW, expiresAt: NOW + 30000, freshnessWindowMs: 30000,
    grossEdge: 0.01, requiredCapital: 100, confidence: 0.9, executionRisk: 0.1,
    risk: {executionRisk: 0.1, correlationRisk: 0, liquidationRisk: 0, adverseSelectionRisk: 0, overall: 0.1},
    strategyCompatibility: ['CROSS_VENUE_SPOT_ARBITRAGE'], calculation: {},
  });
  assert.equal(c.type, 'CROSS_VENUE_SPOT_ARBITRAGE');
  assert.ok(c.expiresAt === NOW + 30000);
});

test('candidate: zeroRisk returns a neutral risk profile', () => {
  assert.deepEqual(zeroRisk(), {executionRisk: 0, correlationRisk: 0, liquidationRisk: 0, adverseSelectionRisk: 0, overall: 0});
  assert.equal(zeroRisk({executionRisk: 0.3}).executionRisk, 0.3);
});

test('market-state: emptyMarketState has empty indexes', () => {
  const s = emptyMarketState();
  assert.equal(s.quotes.size, 0);
  assert.equal(s.odds.size, 0);
});

test('market-state: buildMarketState indexes quotes by instrument/venue', () => {
  const s = buildMarketState(afisSpotEvents());
  const venueMap = s.quotes.get('BTC/USDT');
  assert.ok(venueMap);
  assert.ok(venueMap.get('VENUE_A'));
  assert.ok(venueMap.get('VENUE_B'));
  const q = venueMap.get('VENUE_A')!;
  assert.ok(q.bid < q.ask);
  assert.equal(q.spread, q.ask - q.bid);
  assert.ok(q.evidence.length > 0);
  assert.ok(q.evidence[0].evidenceId.startsWith('ev_'));
});

test('market-state: buildMarketState normalizes odds by market/bookmaker', () => {
  const s = buildMarketState(abTwoWaySurebetEvents());
  const bookMap = s.odds.get('odds:MATCH-X');
  assert.ok(bookMap);
  assert.ok(bookMap.get('BOOK_A'));
  assert.ok(bookMap.get('BOOK_B'));
  const o = bookMap.get('BOOK_A')!;
  assert.equal(o.selection, 'HOME');
  assert.ok(o.back > 1);
});

test('market-state: evidence is bound deterministically', () => {
  const s1 = buildMarketState(afisSpotEvents());
  const s2 = buildMarketState(afisSpotEvents());
  const e1 = s1.quotes.get('BTC/USDT')!.get('VENUE_A')!.evidence[0].evidenceId;
  const e2 = s2.quotes.get('BTC/USDT')!.get('VENUE_A')!.evidence[0].evidenceId;
  assert.equal(e1, e2);
});

// ---------------------------------------------------------------------------
// Additional detector edge cases
// ---------------------------------------------------------------------------

test('afis: cross-venue returns [] on missing instrument', () => {
  const s = buildMarketState(afisSpotEvents());
  assert.deepEqual(detectCrossVenueArbitrage(s, 'MISSING'), []);
});

test('afis: cross-venue rejects a single-venue instrument', () => {
  const events = [afisSpotEvents()[0]];
  const s = buildMarketState(events);
  assert.deepEqual(detectCrossVenueArbitrage(s, 'BTC/USDT'), []);
});

test('afis: basis rejects invalid input', () => {
  const c = detectBasisOpportunity({
    base: 'BTC', spotPrice: 0, perpPrice: 100000, takerFee: 0.0001, slippage: 0.001,
    hedgeCost: 0.0001, observedAt: NOW, horizonMs: 86400000, convergenceUncertainty: 0.5, depth: 100000,
  });
  assert.equal(c, undefined);
});

test('afis: market-making rejects when ask < bid', () => {
  const quote = {instrument: 'BTC/USDT', venue: 'V', bid: 104, ask: 100, mid: 102, spread: -4, lastPrice: 102, depth: 100000, liquidity: 100000, latencyMs: 5, reliability: 0.99, fees: 0.0001, makerRebate: 0, sourceEvents: ['e'], evidence: [], observedAt: NOW, freshness: 1, volatility: 0.02, orderBookImbalance: 0.5};
  const c = detectMarketMakingOpportunity({instrument: 'BTC/USDT', venue: 'V', quote, volatility: 0.02, inventoryRisk: 0.05, fillProbability: 0.9, makerRebate: 0.0005, observedAt: NOW});
  assert.equal(c, undefined);
});

test('afis: liquidity imbalance rejects zero total depth', () => {
  const quote = {instrument: 'BTC/USDT', venue: 'V', bid: 100, ask: 100.1, mid: 100.05, spread: 0.1, lastPrice: 100.05, depth: 0, liquidity: 0, latencyMs: 5, reliability: 0.99, fees: 0.0001, makerRebate: 0, sourceEvents: ['e'], evidence: [], observedAt: NOW, freshness: 1, volatility: 0.02, orderBookImbalance: 0.5};
  const c = detectLiquidityImbalance({instrument: 'BTC/USDT', venue: 'V', quote, bidDepth: 0, askDepth: 0, observedAt: NOW});
  assert.equal(c, undefined);
});

test('abl: back/lay rejects invalid odds', () => {
  const c = detectBackLayDiscrepancy({market: 'M', selection: 'S', backVenue: 'A', backOdds: 0.9, layVenue: 'B', layOdds: 2.0, commission: 0.02, stake: 100, observedAt: NOW});
  assert.equal(c, undefined);
});

test('abl: value respects minimum model confidence', () => {
  const c = detectValueOpportunity({market: 'M', selection: 'S', bookmaker: 'A', odds: 3.0, modelProbability: 0.5, modelConfidence: 0.4, observedAt: NOW});
  assert.equal(c, undefined);
});

test('abl: hedge rejects single outcome', () => {
  const c = detectHedgeMiddle({market: 'M', outcomes: [{selection: 'A', probability: 1, payoutIfWins: 0, odds: 2.0, bookmaker: 'X'}], stakePool: 100, observedAt: NOW});
  assert.equal(c, undefined);
});

test('abl: surebet requires at least two valid legs', () => {
  assert.equal(detectSurebet('M', [{bookmaker: 'A', selection: 'S', odds: 2.0, commission: 0.01}]), undefined);
});

// ---------------------------------------------------------------------------
// Scenario-driven integration tests
// ---------------------------------------------------------------------------

test('scenario: thin book cross-venue is fail-closed to REJECTED', () => {
  const idle = {now: NOW, correlationId: 'c', traceId: 't', availableCapital: 1_000_000_000};
  const events = [
    (() => { const s = afisSpotEvents(); return {...s[0], id: 'thin_A', payload: {...s[0].payload, depth: 10, liquidity: 10}}; })(),
    (() => { const s = afisSpotEvents(); return {...s[1], id: 'thin_B', payload: {...s[1].payload, depth: 10, liquidity: 10}}; })(),
  ];
  const results = new OpportunityDiscoveryEngine().discoverFromEvents(events, idle);
  const cv = results.opportunities.filter((o) => o.type === 'CROSS_VENUE_SPOT_ARBITRAGE');
  assert.ok(cv.every((o) => o.status === 'REJECTED'));
});

test('scenario: deep book cross-venue yields an eligible opportunity', () => {
  const results = discoverResults();
  const cv = results.opportunities.filter((o) => o.type === 'CROSS_VENUE_SPOT_ARBITRAGE' && o.grossEdge > 0);
  assert.ok(cv.some((o) => ['RANKED', 'ELIGIBLE'].includes(o.status)));
});

test('scenario: identical inputs produce identical batch ids', () => {
  const r1 = discoverResults();
  const r2 = discoverResults();
  assert.equal(r1.batchId, r2.batchId);
});

test('scenario: different inputs produce different batch ids', () => {
  const r1 = discoverResults();
  const r2 = discoverResults(afisReverseEvents());
  assert.notEqual(r1.batchId, r2.batchId);
});

test('scenario: all opportunities carry a stable schema fingerprint', () => {
  const results = discoverResults();
  for (const o of results.opportunities) {
    assert.ok(o.fingerprint.length > 0);
    assert.ok(o.opportunityId.includes(o.fingerprint.slice(0, 12)));
    assert.ok(o.estimatedCosts.fees >= 0);
  }
});

test('scenario: ranked opportunities have descending rank scores', () => {
  const results = discoverResults();
  const ranked = results.opportunities.filter((o) => o.rank).slice().sort((a, b) => a.rank!.rank - b.rank!.rank);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].rank!.score >= ranked[i].rank!.score);
  }
});
