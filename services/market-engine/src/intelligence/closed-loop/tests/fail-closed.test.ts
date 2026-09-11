import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {ingestOpportunityIdentity} from '../opportunity';
import {reconstructLifecycle} from '../lifecycle';
import {closedLoopCorpus} from '../test-fixtures';
import {assertKnownProvenance} from '../source';
import type {ClosedLoopRecord, ClosedLoopInput} from '../types';

/**
 * SPRINT 035 — fail-closed tests: missing opportunity identity, contradictory
 * lifecycle records, missing allocation information, missing execution
 * lineage, invalid quantity reconciliation, invalid timestamps, inconsistent
 * financial values, unknown provenance — every one refuses to analyze.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();

function inputWith(record: ClosedLoopRecord): ClosedLoopInput {
  return {...corpus.input, records: [record]};
}

test('analysis refuses an empty corpus', () => {
  assert.throws(() => engine.analyze({...corpus.input, records: []}), /no records/);
});

test('analysis refuses an invalid timestamp', () => {
  assert.throws(() => engine.analyze({...corpus.input, timestamp: 0}), /invalid timestamp/);
  assert.throws(() => engine.analyze({...corpus.input, timestamp: Number.NaN}), /invalid timestamp/);
});

test('missing opportunity identity fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, opportunityId: ''}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /missing opportunity identity/);
});

test('contradictory lifecycle records fail closed (strategy vs opportunity)', () => {
  const record = corpus.records[0];
  const broken = {...record, strategyDecision: {...record.strategyDecision, opportunityId: 'opp_MISMATCH'}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /references opportunity/);
});

test('contradictory lifecycle records fail closed (risk vs allocation)', () => {
  const record = corpus.records[0];
  const broken = {...record, risk: {...record.risk, allocationId: 'alloc_MISMATCH'}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /references allocation/);
});

test('contradictory lifecycle records fail closed (plan risk reference)', () => {
  const record = corpus.records[0];
  const broken = {...record, plan: {...record.plan, riskReference: 'risk_MISMATCH'}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /riskReference/);
});

test('missing execution lineage fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, session: null} as unknown as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /missing execution lineage/);
});

test('session rooted at a foreign plan fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, session: {...record.session,
    session: {...record.session.session, rootExecutionPlanId: 'xplan_FOREIGN'}}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /execution lineage break/);
});

test('impossible timestamp ordering fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, risk: {...record.risk, timestamp: record.plan.timestamp + 5_000}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /impossible ordering/);
});

test('invalid strategy timestamp fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, strategyDecision: {...record.strategyDecision, timestamp: 'yesterday'}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /invalid timestamp/);
});

test('inconsistent financial values fail closed (negative costs)', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, estimatedTotalCost: -5}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /estimatedTotalCost/);
});

test('inconsistent financial values fail closed (NaN edge)', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, grossEdge: Number.NaN}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /grossEdge/);
});

test('unknown provenance fails closed at the source boundary', () => {
  assert.throws(() => assertKnownProvenance('WISHED', 'test'), /unknown provenance/);
});

test('invalid quantity reconciliation fails closed (quantity contradiction)', () => {
  const record = corpus.records[0];
  // Break the session's final quantity reconciliation.
  const broken = {...record, session: {...record.session, session: {...record.session.session,
    finalResult: {...record.session.session.finalResult!, filledQuantity: 999}}}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /quantity/i);
});

test('missing allocation information fails closed (orphan allocation)', () => {
  const record = corpus.records[0];
  const broken = {...record, allocation: {...record.allocation, opportunityId: 'opp_ORPHAN'}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /references opportunity/);
});

test('unknown opportunity type fails closed at ingestion', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, type: 'UFO sighting' as never}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /unclassifiable/);
});

test('reconstruction fails closed on plan-opportunity mismatch', () => {
  const record = corpus.records[0];
  const broken = {...record, plan: {...record.plan, opportunityId: 'opp_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /references opportunity/);
});

test('one broken record poisons the whole analysis — never partially analyzed', () => {
  const broken = {...corpus.records[3], plan: {...corpus.records[3].plan, strategyId: 'strat_MISMATCH'}};
  assert.throws(() => engine.analyze({...corpus.input,
    records: [...corpus.input.records.slice(0, 3), broken, ...corpus.input.records.slice(4)]}),
    /strategy/);
});

test('missing OIIN provenance degrades gracefully (not fatal)', () => {
  const record = {...corpus.records[0], oiinEvent: null};
  const result = engine.analyze(inputWith(record));
  assert.equal(result.records[0].lifecycle.anomalies.filter((a) => a.kind === 'MISSING_STAGE').length, 1);
  assert.ok(result.records[0].lifecycle.valid);
});

test('missing performance analysis degrades to honest unavailable, never fabricates', () => {
  const record = {...corpus.records[0], performance: null};
  const result = engine.analyze(inputWith(record));
  const analysis = result.records[0];
  assert.equal(analysis.strategy.strategyQuality.value, null);
  assert.equal(analysis.policy.objective.value, null);
  assert.equal(analysis.execution.attributionId, 'unavailable');
  assert.equal(analysis.score.executionQuality, null);
});

test('invalid expiresAt fails closed at ingestion', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity,
    expiresAt: record.opportunity.observedAt - 1}} as ClosedLoopRecord;
  assert.throws(() => engine.analyze(inputWith(broken)), /invalid expiresAt/);
});
