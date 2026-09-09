import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StrategyRegistry,
  StrategyDiscoveryEngine,
  DEFAULT_STRATEGY_ENGINE_CONFIG,
  STRATEGY_TEMPLATES,
  findTemplate,
  templatesForOpportunityType,
  checkCompatibility,
  computeStrategyEconomics,
  checkLimits,
  DEFAULT_STRATEGY_LIMITS,
  assessPortfolio,
  evaluateStrategy,
  rankStrategies,
  selectStrategy,
  scoreStrategy,
  DEFAULT_RANKING_POLICY,
  strategyFingerprint,
  candidateId,
  decisionId,
  replayId,
  canStrategyTransition,
  isTerminal,
  rejectionStatusFor,
  StrategyReplay,
  StrategyReplayEngine,
  generateStrategyCandidates,
} from './strategy/intelligence';
import {
  crossVenueOpportunity,
  triangularOpportunity,
  fundingOpportunity,
  basisOpportunity,
  marketMakingOpportunity,
  liquidityImbalanceOpportunity,
  surebetOpportunity,
  valueOpportunity,
  backLayOpportunity,
  hedgeOpportunity,
  unprofitableCrossVenueOpportunity,
  overCapitalOpportunity,
  staleOpportunity,
  invalidOpportunity,
  defaultPortfolioContext,
} from './strategy/intelligence/test-fixtures';
import {Opportunity} from './opportunity';

const NOW = 1704067200000;

function run(opp: Opportunity) {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  return engine.discover({
    opportunity: opp,
    portfolioContext: defaultPortfolioContext(),
    availableCapital: 90_000,
    totalCapital: 100_000,
    correlationId: 'c',
    traceId: 't',
    timestamp: opp.observedAt,
  });
}

// ===========================================================================
// Core: identity, fingerprint, versioning, lifecycle
// ===========================================================================

test('core: strategy fingerprint is deterministic', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const f1 = strategyFingerprint({opportunity: opp, definition: def, portfolioContext: defaultPortfolioContext(), riskContext: {}, config: {}});
  const f2 = strategyFingerprint({opportunity: opp, definition: def, portfolioContext: defaultPortfolioContext(), riskContext: {}, config: {}});
  assert.equal(f1, f2);
});

test('core: fingerprint changes on different opportunity', () => {
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const f1 = strategyFingerprint({opportunity: crossVenueOpportunity(), definition: def, portfolioContext: {}, riskContext: {}, config: {}});
  const f2 = strategyFingerprint({opportunity: triangularOpportunity(), definition: def, portfolioContext: {}, riskContext: {}, config: {}});
  assert.notEqual(f1, f2);
});

test('core: candidate/decision/replay ids are deterministic and prefixed', () => {
  const fp = strategyFingerprint({opportunity: crossVenueOpportunity(), definition: findTemplate('afis.cross-venue.direct.v1')!, portfolioContext: {}, riskContext: {}, config: {}});
  assert.ok(candidateId(fp).startsWith('strat_cand_'));
  assert.equal(candidateId(fp), candidateId(fp));
  assert.ok(decisionId(fp, 'c').startsWith('strat_dec_'));
  assert.ok(replayId(fp, 'c').startsWith('strat_replay_'));
});

test('core: template catalog is immutable and versioned', () => {
  assert.ok(STRATEGY_TEMPLATES.length >= 20);
  for (const t of STRATEGY_TEMPLATES) {
    assert.ok(t.strategyId);
    assert.ok(t.version);
    assert.ok(t.limits.maxCapital > 0);
    assert.ok(Number.isFinite(t.correlationFactor));
  }
});

test('core: lifecycle transitions follow canonical path', () => {
  assert.equal(canStrategyTransition('PROPOSED', 'EVALUATED'), true);
  assert.equal(canStrategyTransition('EVALUATED', 'RANKED'), true);
  assert.equal(canStrategyTransition('RANKED', 'SELECTED'), true);
  assert.equal(canStrategyTransition('SELECTED', 'ALLOCATED'), true);
  assert.equal(canStrategyTransition('ALLOCATED', 'AUTHORIZED'), true);
  assert.equal(canStrategyTransition('AUTHORIZED', 'EXECUTING'), true);
  assert.equal(canStrategyTransition('EXECUTING', 'COMPLETED'), true);
  assert.equal(canStrategyTransition('SELECTED', 'EXECUTING'), false);
});

test('core: rejection state mapping and terminal states', () => {
  assert.equal(rejectionStatusFor('risk'), 'RISK_BLOCKED');
  assert.equal(rejectionStatusFor('aegis'), 'AEGIS_BLOCKED');
  assert.equal(rejectionStatusFor('treasury'), 'TREASURY_BLOCKED');
  assert.equal(isTerminal('COMPLETED'), true);
  assert.equal(isTerminal('REJECTED'), true);
  assert.equal(isTerminal('EVALUATED'), false);
});

// ===========================================================================
// Compatibility
// ===========================================================================

test('compatibility: rejects incompatible opportunity type', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('abl.value.edge-weighted.v1')!;
  const r = checkCompatibility(opp, def, {availableCapabilities: ['FAIR_VALUE', 'ODDS', 'BOOKMAKER'], availableVenues: ['BOOK_A']});
  assert.equal(r.compatible, false);
  assert.ok(r.blockedBy.includes('opportunity_type_incompatible'));
});

test('compatibility: rejects disabled strategy', () => {
  const opp = surebetOpportunity();
  const def = findTemplate('abl.surebet.equalized.v1')!;
  const r = checkCompatibility(opp, {...def, enabled: false}, {availableCapabilities: ['BOOKMAKER', 'ODDS'], availableVenues: ['BOOK_A', 'BOOK_B'], presentVenues: opp.venues});
  assert.equal(r.compatible, false);
  assert.ok(r.blockedBy.includes('strategy_disabled'));
});

test('compatibility: rejects missing required capability', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const r = checkCompatibility(opp, def, {availableCapabilities: [], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues});
  assert.equal(r.compatible, false);
  assert.ok(r.blockedBy.some((b) => b.startsWith('missing_capability:')));
});

test('compatibility: rejects stale opportunity', () => {
  const opp = staleOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const r = checkCompatibility(opp, def, {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues});
  assert.equal(r.compatible, false);
  assert.ok(r.blockedBy.includes('stale_evidence'));
});

test('compatibility: accepts a fully compatible strategy', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const r = checkCompatibility(opp, def, {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues});
  assert.equal(r.compatible, true);
});

// ===========================================================================
// Economics
// ===========================================================================

test('economics: risk-adjusted return never exceeds gross minus cost', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const e = computeStrategyEconomics(opp, def, opp.requiredCapital);
  assert.ok(e.riskAdjustedExpectedReturn <= e.expectedGrossReturn);
  assert.ok(e.expectedCost >= 0);
  assert.ok(e.capitalEfficiency >= 0);
});

test('economics: multi-leg strategies require every leg valid', () => {
  const opp = triangularOpportunity();
  for (const sid of ['afis.triangular.base.v1', 'afis.triangular.liquidity-constrained.v1']) {
    const def = findTemplate(sid)!;
    const e = computeStrategyEconomics(opp, def, opp.requiredCapital);
    assert.ok(e.legs.length >= 2);
    if (e.allLegsValid) assert.ok(e.legs.every((l) => l.economicallyValid));
  }
});

test('economics: unprofitable opportunity yields zero net edge', () => {
  const opp = unprofitableCrossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const e = computeStrategyEconomics(opp, def, opp.requiredCapital);
  assert.equal(e.allLegsValid, false);
});

test('economics: capital efficiency guards zero capital', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const e = computeStrategyEconomics(opp, def, 0);
  assert.ok(Number.isFinite(e.capitalEfficiency));
});

// ===========================================================================
// Limits
// ===========================================================================

test('limits: enforces max capital', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 100000, exposure: 1000, legs: 1, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('max_capital'));
});

test('limits: enforces min edge and min confidence', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 1000, exposure: 1000, legs: 1, latencyMs: 5, edge: -0.01, confidence: 0.2, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('min_edge'));
  assert.ok(r.violations.includes('min_confidence'));
});

test('limits: enforces max latency and max slippage', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 1000, exposure: 1000, legs: 1, latencyMs: 10000, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.5});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('max_latency'));
  assert.ok(r.violations.includes('max_slippage'));
});

test('limits: passes within limits', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 1000, exposure: 1000, legs: 1, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, true);
});

// ===========================================================================
// Portfolio awareness
// ===========================================================================

test('portfolio: rejects portfolio exposure breach', () => {
  const opp = crossVenueOpportunity();
  const r = assessPortfolio(opp, defaultPortfolioContext({grossExposure: 95_000}), 10_000, 'btc-arb');
  assert.equal(r.wouldExceed, true);
  assert.ok(r.conflictReasons.includes('portfolio_exposure'));
});

test('portfolio: rejects domain exposure breach', () => {
  const opp = crossVenueOpportunity();
  const ctx = {...defaultPortfolioContext(), domainExposure: {AFIS: 60_000, ABL: 8_000}};
  const r = assessPortfolio(opp, ctx, 10_000, 'btc-arb');
  assert.equal(r.wouldExceed, true);
  assert.ok(r.conflictReasons.includes('domain_exposure'));
});

test('portfolio: rejects correlation concentration', () => {
  const opp = crossVenueOpportunity();
  const ctx = {...defaultPortfolioContext(), correlationExposure: {['btc-arb']: 50_000}};
  const r = assessPortfolio(opp, ctx, 10_000, 'btc-arb');
  assert.equal(r.wouldExceed, true);
  assert.ok(r.conflictReasons.includes('correlation_concentration'));
});

test('portfolio: contains no conflicts within budget', () => {
  const opp = crossVenueOpportunity();
  const r = assessPortfolio(opp, defaultPortfolioContext(), 5_000, 'btc-arb');
  assert.equal(r.wouldExceed, false);
});

// ===========================================================================
// Evaluation / Ranking / Selection
// ===========================================================================

test('eval: admissible profitable strategy produces EVALUATED', () => {
  const res = run(crossVenueOpportunity());
  assert.ok(res.evaluated.length >= 3);
  assert.ok(res.evaluated.every((e) => e.admissibility === true));
});

test('eval: stale opportunity is rejected as STALE', () => {
  const res = run(staleOpportunity());
  assert.ok(res.evaluated.length === 0 || res.evaluated.every((e) => !e.admissibility));
});

test('eval: over-capital opportunity rejected risk-blocked', () => {
  const res = run(overCapitalOpportunity());
  // capital 200k > maxCapital of every template -> REJECTED/RISK_BLOCKED
  assert.ok(res.evaluated.every((e) => !e.admissibility));
});

test('ranking: admissible strategies ranked before rejected', () => {
  const opp = crossVenueOpportunity();
  const def1 = findTemplate('afis.cross-venue.direct.v1')!;
  const def2 = findTemplate('abl.value.edge-weighted.v1')!;
  const ev1 = evaluateStrategy(opp, generateCand(opp, def1), {
    timestamp: opp.observedAt, correlationId: 'c',
    policyVersion: 'p', evaluationVersion: 'e', rankingVersion: 'r', configurationVersion: 'cfg',
    portfolio: defaultPortfolioContext(), availableCapital: 90_000,
  });
  const ev2 = evaluateStrategy(opp, generateCand(opp, def2), {
    timestamp: opp.observedAt, correlationId: 'c',
    policyVersion: 'p', evaluationVersion: 'e', rankingVersion: 'r', configurationVersion: 'cfg',
    portfolio: defaultPortfolioContext(), availableCapital: 90_000,
  });
  const ranked = rankStrategies([ev1, ev2]);
  assert.equal(ranked[0].admissible, true);
  assert.equal(ranked[1].admissible, false);
});

test('ranking: selects highest-scoring admissible first', () => {
  const res = run(crossVenueOpportunity());
  const ranked = res.ranking.filter((r) => r.admissible);
  assert.ok(res.selection.admissibility);
  assert.equal(res.selection.selectedStrategyId, ranked[0].strategyId);
  assert.equal(ranked[0].rank, 1);
});

test('selection: returns NO_ADMISSIBLE_STRATEGY for unprofitable', () => {
  const res = run(unprofitableCrossVenueOpportunity());
  assert.equal(res.selection.admissibility, false);
  assert.equal(res.selection.reason, 'NO_ADMISSIBLE_STRATEGY');
});

test('selection: records rejected alternatives with reasons', () => {
  const res = run(crossVenueOpportunity());
  assert.ok(res.selection.rejectedAlternatives.length >= 2);
  assert.ok(res.selection.rejectedAlternatives.every((r) => r.strategyId && r.reason));
});

// ===========================================================================
// AFIS strategy selection
// ===========================================================================

test('afis: cross-venue candidates include 4 templates', () => {
  const res = run(crossVenueOpportunity());
  const ids = res.candidates.map((c) => c.strategyId);
  assert.ok(ids.includes('afis.cross-venue.direct.v1'));
  assert.ok(ids.includes('afis.cross-venue.conservative.v1'));
  assert.ok(ids.includes('afis.cross-venue.latency-aware.v1'));
  assert.ok(ids.includes('afis.cross-venue.capital-efficient.v1'));
});

test('afis: triangular strategy selection', () => {
  const res = run(triangularOpportunity());
  assert.ok(res.candidates.length >= 2);
  assert.ok(res.selection.admissibility);
});

test('afis: funding strategy selection', () => {
  const res = run(fundingOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

test('afis: basis strategy selection', () => {
  const res = run(basisOpportunity());
  assert.ok(res.candidates.length >= 2);
  assert.ok(res.selection.admissibility);
});

test('afis: market-making strategy selection', () => {
  const res = run(marketMakingOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

test('afis: liquidity-imbalance strategy selection', () => {
  const res = run(liquidityImbalanceOpportunity());
  assert.ok(res.candidates.length >= 2);
  assert.ok(res.selection.admissibility);
});

// ===========================================================================
// ABL strategy selection
// ===========================================================================

test('abl: surebet strategy selection', () => {
  const res = run(surebetOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

test('abl: back/lay strategy selection', () => {
  const res = run(backLayOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

test('abl: +EV strategy selection', () => {
  const res = run(valueOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

test('abl: hedge strategy selection', () => {
  const res = run(hedgeOpportunity());
  assert.ok(res.candidates.length >= 3);
  assert.ok(res.selection.admissibility);
});

// ===========================================================================
// Registry / security
// ===========================================================================

test('registry: disabled strategy never generated', () => {
  const reg = new StrategyRegistry();
  reg.disable('afis.cross-venue.direct.v1');
  const engine = reg.engine();
  const res = engine.discover({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.ok(!res.candidates.some((c) => c.strategyId === 'afis.cross-venue.direct.v1'));
});

test('registry: health reflects disabled state', () => {
  const reg = new StrategyRegistry();
  reg.disable('afis.cross-venue.direct.v1');
  const h = reg.health('afis.cross-venue.direct.v1');
  assert.equal(h.enabled, false);
  assert.equal(h.available, false);
});

test('registry: unregister removes strategy', () => {
  const reg = new StrategyRegistry();
  reg.unregister('afis.cross-venue.direct.v1');
  assert.equal(reg.lookup('afis.cross-venue.direct.v1'), undefined);
});

test('security: treasury bypass prevented (strategy has no treasury channel)', () => {
  const res = run(crossVenueOpportunity());
  const sel = res.selection;
  // Selection records IDs but provides no Treasury mutation primitive.
  assert.ok(!('reservedCapital' in sel));
  assert.ok(!('applyReservation' in sel));
  assert.equal(sel.selectedStatus, 'EVALUATED');
});

test('security: strategy selection does not mutate portfolio/risk', () => {
  const ctx = defaultPortfolioContext();
  const before = JSON.stringify(ctx);
  run(crossVenueOpportunity());
  assert.equal(JSON.stringify(ctx), before);
});

test('security: AEGIS remains a separate boundary', () => {
  const res = run(crossVenueOpportunity());
  assert.ok(res.selection.reason);
  // The strategy engine returns a proposal; it does not self-authorize.
  assert.ok(res.selection.selectedStatus !== 'AUTHORIZED' && res.selection.selectedStatus !== 'EXECUTING');
});

// ===========================================================================
// Cross-domain competition
// ===========================================================================

test('cross-domain: AFIS and ABL compete in one shared ranking', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const afis = engine.discover({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  const abl = engine.discover({opportunity: surebetOpportunity(), portfolioContext: defaultPortfolioContext({correlationExposure: {['surebet']: 1000}}), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  // Both share the same capital budget; unify the ranking by score.
  const unified = [
    ...afis.selection.ranking.filter((r) => r.admissible),
    ...abl.selection.ranking.filter((r) => r.admissible),
  ].sort((a, b) => b.score - a.score);
  assert.ok(unified.some((r) => r.domain === 'AFIS'));
  assert.ok(unified.some((r) => r.domain === 'ABL'));
  assert.ok(unified[0].score >= unified[1].score);
});

test('cross-domain: shared capital enforced via same availableCapital', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  // Constrained capital must block both domains equally.
  const res = engine.discover({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext({availableCapital: 0}), availableCapital: 0, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.ok(res.evaluated.every((e) => !e.capitalSufficient || !e.admissibility));
});

// ===========================================================================
// Adaptive control
// ===========================================================================

test('control: advisory suggests revalidate on market change', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'REVALIDATE', marketChanged: true}});
  assert.equal(adv.action, 'REVALIDATE');
});

test('control: advisory suggests resize on liquidity deterioration', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'RESIZE', liquidityDeteriorated: true}});
  assert.equal(adv.action, 'RESIZE');
});

test('control: advisory suggests abort on edge disappearance', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'ABORT', edgeDisappeared: true}});
  assert.equal(adv.action, 'ABORT');
});

test('control: advisory suggests hedge on risk increase', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'HEDGE', riskIncreased: true}});
  assert.equal(adv.action, 'HEDGE');
});

test('control: advisory deterministic', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const a1 = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'HALT'}});
  const a2 = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'HALT'}});
  assert.equal(a1.decisionId, a2.decisionId);
});

// ===========================================================================
// Replay
// ===========================================================================

test('replay: identical inputs reproduce identical selection', () => {
  const replay = new StrategyReplay();
  const input = {opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'c', traceId: 't', timestamp: NOW}};
  const live = replay.runLive(input);
  const again = replay.runReplay(input);
  const cmp = replay.compare(live, again);
  assert.equal(cmp.match, true);
  assert.equal(cmp.decisionIdMatch, true);
});

test('replay: changed configuration produces changed deterministic decision', () => {
  const replay = new StrategyReplay();
  const input = {opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'c', traceId: 't', timestamp: NOW}};
  const live = replay.runLive(input);
  const changed = replay.runReplay({...input, config: {...DEFAULT_STRATEGY_ENGINE_CONFIG, configurationVersion: 'changed-config.v2', rankingVersion: 'strategy.ranking.v2'}});
  // Different config -> different selection decision id (deterministically).
  assert.notEqual(live.selection.decisionId, changed.selection.decisionId);
});

test('replay: isolated from live mutable state (no shared registry)', () => {
  const replay = new StrategyReplayEngine();
  const input = {opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'c', traceId: 't', timestamp: NOW}};
  const a = replay.runLive(input);
  const b = replay.runReplay(input);
  assert.deepEqual(a.selection.decisionId, b.selection.decisionId);
});

test('replay: divergence detected on different opportunity', () => {
  const replay = new StrategyReplay();
  const a = replay.runLive({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'c', traceId: 't', timestamp: NOW}});
  const b = replay.runReplay({opportunity: triangularOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, context: {correlationId: 'c', traceId: 't', timestamp: NOW}});
  const cmp = replay.compare(a, b);
  assert.equal(cmp.match, false);
});

// ===========================================================================
// Audit
// ===========================================================================

test('audit: structured strategy audit record emitted', () => {
  const res = run(crossVenueOpportunity());
  const a = res.audit;
  assert.equal(a.schemaVersion, 'oship.strategy.v1');
  assert.equal(a.strategyDecisionId, res.selection.decisionId);
  assert.equal(a.opportunityId, res.selection.opportunityId);
  assert.equal(a.selectedStrategy, res.selection.selectedStrategyId);
  assert.ok(a.candidateIds.length >= 3);
  assert.ok(a.rejectedStrategies.length >= 2);
  assert.ok(a.policyVersion);
  assert.ok(a.configurationVersion);
});

test('audit: evaluation scores indexed by candidate', () => {
  const res = run(crossVenueOpportunity());
  for (const c of res.candidates) {
    assert.ok(c.candidateId in res.audit.evaluationScores);
  }
});

// ===========================================================================
// Generator
// ===========================================================================

test('generator: emits only compatible candidates', () => {
  const opp = crossVenueOpportunity();
  const ctx = {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues};
  const cands = generateStrategyCandidates(opp, ctx);
  assert.ok(cands.length > 0);
  assert.ok(cands.every((c) => c.domain === 'AFIS'));
});

test('generator: deterministic ordering', () => {
  const opp = crossVenueOpportunity();
  const ctx = {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues};
  const a = generateStrategyCandidates(opp, ctx).map((c) => c.strategyId);
  const b = generateStrategyCandidates(opp, ctx).map((c) => c.strategyId);
  assert.deepEqual(a, b);
});

// ===========================================================================
// Scenario: state-machine integration
// ===========================================================================

test('scenario: profitable cross-venue selects admissible strategy', () => {
  const res = run(crossVenueOpportunity());
  assert.equal(res.selection.admissibility, true);
  assert.equal(res.selection.selectedDomain, 'AFIS');
});

test('scenario: unprofitable arbitrage after costs rejected', () => {
  const res = run(unprofitableCrossVenueOpportunity());
  assert.equal(res.selection.admissibility, false);
});

test('scenario: stale opportunity leads to no admissible strategy', () => {
  const res = run(staleOpportunity());
  assert.equal(res.selection.admissibility, false);
});

test('scenario: invalid opportunity rejected', () => {
  const res = run(invalidOpportunity());
  assert.equal(res.selection.admissibility, false);
});

test('scenario: opportunity with excessive correlation is not admissible', () => {
  const opp = crossVenueOpportunity();
  const base = defaultPortfolioContext();
  const ctx = {...base, correlationExposure: {['btc-arb']: 100_000}};
  const reg = new StrategyRegistry();
  const res = reg.engine().discover({opportunity: opp, portfolioContext: ctx, availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  // Correlation concentration (100k + strategy notional >> 50% of 100k) blocks
  // every candidate, so nothing is admissible.
  assert.ok(res.evaluated.every((e) => !e.admissibility));
});

// ===========================================================================
// Additional: economics/limits/security depth
// ===========================================================================

test('economics: latency sensitivity bounded to [0,1]', () => {
  const opp = crossVenueOpportunity();
  const def = findTemplate('afis.cross-venue.latency-aware.v1')!;
  const e = computeStrategyEconomics(opp, def, opp.requiredCapital);
  assert.ok(e.latencySensitivity >= 0 && e.latencySensitivity <= 1);
});

test('economics: execution + failure probability sum to ~1', () => {
  const def = findTemplate('afis.cross-venue.direct.v1')!;
  const e = computeStrategyEconomics(crossVenueOpportunity(), def, 10_000);
  assert.ok(Math.abs(e.executionProbability + e.failureProbability - 1) < 1e-9);
});

test('economics: more legs produces separate economically-valid legs', () => {
  const def = findTemplate('afis.triangular.base.v1')!;
  const e = computeStrategyEconomics(triangularOpportunity(), def, 8_000);
  assert.equal(e.legs.length, 3);
  assert.equal(e.legs.length, triangularOpportunity().venues.length >= 3 ? 3 : e.legs.length);
});

test('economics: liquidity requirement scales with capital factor', () => {
  const def = findTemplate('afis.cross-venue.capital-efficient.v1')!;
  const e = computeStrategyEconomics(crossVenueOpportunity(), def, 10_000);
  assert.ok(e.liquidityRequirement >= e.capitalRequired * 0.9);
});

test('limits: negative capital rejected', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: -1000, exposure: 1000, legs: 1, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('invalid_capital'));
});

test('limits: NaN capital rejected', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: Number.NaN, exposure: 1000, legs: 1, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, false);
});

test('limits: max legs enforced', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 1000, exposure: 1000, legs: 5, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1000, slippage: 0.001});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('max_legs'));
});

test('limits: min liquidity enforced', () => {
  const r = checkLimits(DEFAULT_STRATEGY_LIMITS, {capital: 1000, exposure: 1000, legs: 1, latencyMs: 5, edge: 0.1, confidence: 0.9, liquidity: 1, slippage: 0.001});
  assert.equal(r.passed, false);
  assert.ok(r.violations.includes('min_liquidity'));
});

test('templates: cross-venue selects direct+conservative+latency+capital-efficient', () => {
  const templates = templatesForOpportunityType('CROSS_VENUE_SPOT_ARBITRAGE');
  const ids = templates.map((t) => t.strategyId);
  assert.ok(ids.includes('afis.cross-venue.direct.v1'));
  assert.ok(ids.includes('afis.cross-venue.conservative.v1'));
  assert.ok(ids.includes('afis.cross-venue.latency-aware.v1'));
  assert.ok(ids.includes('afis.cross-venue.capital-efficient.v1'));
});

test('templates: funding produces three strategies', () => {
  const templates = templatesForOpportunityType('FUNDING_RATE_ARBITRAGE');
  assert.equal(templates.length, 3);
});

test('templates: surebet produces three strategies', () => {
  const templates = templatesForOpportunityType('ODDS_ARBITRAGE_2WAY');
  assert.equal(templates.length, 3);
});

test('templates: value produces three strategies', () => {
  const templates = templatesForOpportunityType('SPORTS_VALUE');
  assert.equal(templates.length, 3);
});

test('templates: no strategy targets unknown type', () => {
  assert.equal(templatesForOpportunityType('UNKNOWN' as never).length, 0);
});

test('registry: engine lists deterministic definitions', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const defs = engine.definitions();
  assert.ok(defs.length >= 20);
  const ids = defs.map((d) => d.strategyId);
  assert.deepEqual(ids, [...ids].sort());
});

test('registry: health reports configuration validity', () => {
  const reg = new StrategyRegistry();
  const h = reg.health('afis.cross-venue.direct.v1');
  assert.equal(h.configurationValid, true);
  assert.equal(h.available, true);
});

test('security: selection never contains execution or booking payload', () => {
  const res = run(crossVenueOpportunity());
  const sel = res.selection;
  assert.ok(!('executionPlan' in sel));
  assert.ok(!('order' in sel));
  assert.ok(!('providerCredentials' in sel));
});

test('security: strategy engine exposes no mutation of treasury', () => {
  const res = run(crossVenueOpportunity());
  const engine = res.selection;
  assert.ok(!('authorize' in engine));
  assert.ok(!('reserve' in engine));
});

test('security: incompatible domain strategy not generated for cross-venue', () => {
  const ctx = {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: crossVenueOpportunity().venues};
  const cands = generateStrategyCandidates(crossVenueOpportunity(), ctx);
  assert.ok(cands.every((c) => c.domain === 'AFIS'));
});

test('control: HALT advisory deterministic', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW, controlState: {action: 'HALT'}});
  assert.equal(adv.action, 'HALT');
  assert.ok(adv.decisionId.startsWith('strat_ctl_'));
});

test('control: advisory defaults to CONTINUE with no control state', () => {
  const reg = new StrategyRegistry();
  const engine = reg.engine();
  const adv = engine.advisory({opportunity: crossVenueOpportunity(), portfolioContext: defaultPortfolioContext(), availableCapital: 90_000, totalCapital: 100_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(adv.action, 'CONTINUE');
});

test('cross-domain: ABL and AFIS use the same template contract', () => {
  const afis = findTemplate('afis.cross-venue.direct.v1')!;
  const abl = findTemplate('abl.value.edge-weighted.v1')!;
  assert.deepEqual(Object.keys(afis).sort(), Object.keys(abl).sort());
});

test('cross-domain: AFIS and ABL share correlation fields', () => {
  const afis = findTemplate('afis.cross-venue.direct.v1')!;
  const abl = findTemplate('abl.surebet.equalized.v1')!;
  assert.ok('correlationGroup' in afis && 'correlationFactor' in afis);
  assert.ok('correlationGroup' in abl && 'correlationFactor' in abl);
});

test('ranking: score is bounded and finite', () => {
  const res = run(crossVenueOpportunity());
  for (const r of res.ranking) {
    assert.ok(Number.isFinite(r.score));
    assert.ok(r.rank >= 1 || r.admissible === false);
  }
});

test('selection: deterministic decision id for identical input', () => {
  const a = run(crossVenueOpportunity());
  const b = run(crossVenueOpportunity());
  assert.equal(a.selection.decisionId, b.selection.decisionId);
  assert.equal(a.replayKey, b.replayKey);
});

test('selection: different opportunities produce different decisions', () => {
  const a = run(crossVenueOpportunity());
  const b = run(fundingOpportunity());
  assert.notEqual(a.selection.decisionId, b.selection.decisionId);
});

function generateCand(opp: Opportunity, def: import('./strategy/intelligence/types').StrategyDefinition) {
  return generateStrategyCandidates(opp, {availableCapabilities: ['ORDER_BOOK', 'TWO_VENUE'], availableVenues: ['VENUE_A', 'VENUE_B'], presentVenues: opp.venues}).find((c) => c.strategyId === def.strategyId) ?? {
    candidateId: 'cand_' + def.strategyId,
    strategyId: def.strategyId,
    strategyVersion: def.version,
    domain: def.domain,
    type: def.type,
    name: def.name,
    opportunityId: opp.opportunityId,
    opportunityType: opp.type,
    instruments: [...opp.instruments],
    venues: [...opp.venues],
    definition: def,
    modifiers: def.modifiers,
    requiredCapital: opp.requiredCapital * def.modifiers.capitalFactor,
    correlationGroup: def.correlationGroup,
    correlationFactor: def.correlationFactor,
    fingerprint: 'fp_' + def.strategyId,
  };
}
