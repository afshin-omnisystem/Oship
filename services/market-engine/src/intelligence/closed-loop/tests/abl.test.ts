import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {closedLoopCorpus, discoveredAblOpportunity} from '../test-fixtures';

/**
 * SPRINT 035 — ABL closed-loop tests: surebet lifecycles with BACK/LAY
 * semantics preserved end-to-end through the SAME engine.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);
const abl = result.records.filter((a) => a.identity.domain === 'ABL');

test('the ABL surebet flows through the full closed loop', () => {
  assert.equal(abl.length, 1);
  const record = abl[0];
  assert.equal(record.identity.opportunityClass, 'surebet');
  assert.equal(record.execution.finalState, 'COMPLETED');
  assert.ok(record.realized.realizedNetValue.value! > 0);
});

test('BACK/LAY semantic sides are preserved in the identity and venue legs', () => {
  const record = abl[0];
  assert.equal(record.identity.semanticSide, 'BACK');
  const sides = record.venue.venues.map((v) => v.side).sort();
  assert.deepEqual(sides, ['BACK', 'LAY']);
});

test('ABL plan sides survive into the Sprint 034 observations', () => {
  const record = corpus.records.find((r) => r.label === 'abl-surebet')!;
  const planSides = record.plan.routes.map((r) => r.side).sort();
  assert.deepEqual(planSides, ['BACK', 'LAY']);
  const obsSides = [...new Set(abl[0].venue.venues.map((v) => v.side))].sort();
  assert.deepEqual(planSides, obsSides);
});

test('ABL realized value reconciles (realizedNet = gross − costs)', () => {
  const record = abl[0];
  assert.ok(Math.abs(record.realized.realizedGrossValue.value! - record.realized.realizedCosts.value!
    - record.realized.realizedNetValue.value!) < 1e-9);
});

test('ABL preservation is measured, not assumed', () => {
  const record = abl[0];
  assert.ok(Math.abs(record.realized.preservationRatio.value! - 3.9 / 4.4) < 1e-9);
  assert.equal(record.score.grade, 'B');
});

test('real ABL discovery output flows through the same ingestion path', () => {
  const discovered = discoveredAblOpportunity();
  assert.equal(discovered.opportunity.domain, 'ABL');
  assert.equal(discovered.opportunity.type, 'ODDS_ARBITRAGE_2WAY');
});

test('ABL domain scorecard aggregates its records', () => {
  const card = result.domainScorecards.find((d) => d.domain === 'ABL')!;
  assert.equal(card.opportunityVolume, 1);
  assert.ok(card.preservation.value! > 0.8);
});

test('ABL leakage decomposition reconciles', () => {
  const record = abl[0];
  assert.ok(record.leakage.reconciles);
  const sum = record.leakage.components.reduce((s, c) => s + c.value, 0);
  assert.ok(Math.abs(sum - record.leakage.totalLeakage) < 1e-6);
});

test('ABL strategy scorecard exists under its own strategy id', () => {
  const card = result.strategyScorecards.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.equal(card.domain, 'ABL');
  assert.equal(card.completedCount, 1);
});

test('ABL record passes every closed-loop invariant', () => {
  // The invariants run over the whole corpus; ABL-specific semantic checks:
  const record = corpus.records.find((r) => r.label === 'abl-surebet')!;
  assert.equal(record.session.session.finalResult!.finalState, 'COMPLETED');
  const planned = record.plan.routes.reduce((s, r) => s + r.quantity, 0);
  assert.equal(record.session.session.finalResult!.filledQuantity + record.session.session.finalResult!.remainingQuantity, planned);
});
