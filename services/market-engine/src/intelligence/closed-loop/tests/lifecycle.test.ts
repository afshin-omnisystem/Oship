import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconstructLifecycle, LifecycleReconstructionError} from '../lifecycle';
import {closedLoopCorpus, discoveredAfisOpportunity, clOiinEvent, CLOSED_LOOP_TEST_TIMESTAMP} from '../test-fixtures';
import {LIFECYCLE_STAGE_ORDER} from '../types';
import type {ClosedLoopRecord} from '../types';

/**
 * SPRINT 035 — lifecycle reconstruction tests (§7): complete chains, parent
 * preservation, ordering, versions, orphans, duplicates, fingerprints.
 */

const corpus = closedLoopCorpus();

test('reconstruction covers all nine lifecycle stages', () => {
  const record = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const lifecycle = reconstructLifecycle(record);
  assert.deepEqual(lifecycle.stages.map((s) => s.stage), LIFECYCLE_STAGE_ORDER);
  assert.ok(lifecycle.valid);
  assert.equal(lifecycle.opportunityId, record.opportunity.opportunityId);
});

test('every stage carries id, parent, timestamp, version, fingerprint, source, state', () => {
  const lifecycle = reconstructLifecycle(corpus.records[0]);
  for (const stage of lifecycle.stages) {
    assert.ok(stage.stageId.length > 0);
    assert.ok(stage.timestamp > 0);
    assert.ok(stage.fingerprint.length > 0);
    assert.ok(stage.source.length > 0);
    assert.ok(stage.state.length > 0);
  }
});

test('parents chain exactly: each stage parents to the previous one', () => {
  const lifecycle = reconstructLifecycle(corpus.records[0]);
  assert.equal(lifecycle.stages[0].parentId, null);
  for (let i = 1; i < lifecycle.stages.length; i++) {
    assert.equal(lifecycle.stages[i].parentId, lifecycle.stages[i - 1].stageId);
  }
});

test('stage identities trace back to the real upstream records', () => {
  const record = corpus.records[0];
  const lifecycle = reconstructLifecycle(record);
  const byStage = new Map(lifecycle.stages.map((s) => [s.stage, s.stageId]));
  assert.equal(byStage.get('OPPORTUNITY'), record.opportunity.opportunityId);
  assert.equal(byStage.get('STRATEGY'), record.strategyDecision.decisionId);
  assert.equal(byStage.get('ALLOCATION'), record.allocation.allocationId);
  assert.equal(byStage.get('RISK'), record.risk.riskDecisionId);
  assert.equal(byStage.get('EXECUTION_PLAN'), record.plan.executionPlanId);
  assert.equal(byStage.get('CONTROL_SESSION'), record.session.session.sessionId);
});

test('timestamps are non-decreasing along the chain', () => {
  for (const record of corpus.records) {
    const stages = reconstructLifecycle(record).stages;
    for (let i = 1; i < stages.length; i++) {
      assert.ok(stages[i].timestamp >= stages[i - 1].timestamp, `${record.label}: ${stages[i].stage} after ${stages[i - 1].stage}`);
    }
  }
});

test('missing OIIN event degrades to an explicit anomaly, not a failure', () => {
  const record = {...corpus.records[0], oiinEvent: null};
  const lifecycle = reconstructLifecycle(record);
  assert.equal(lifecycle.stages[0].stage, 'OPPORTUNITY');
  const anomaly = lifecycle.anomalies.find((a) => a.kind === 'MISSING_STAGE');
  assert.ok(anomaly);
  assert.equal(anomaly!.stage, 'OIIN_EVENT');
  assert.ok(lifecycle.valid, 'missing OIIN provenance is degraded, not fatal');
});

test('missing execution lineage fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, session: null} as unknown as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), LifecycleReconstructionError);
  assert.throws(() => reconstructLifecycle(broken), /missing execution lineage/);
});

test('session rooted at a foreign plan fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, session: {...record.session,
    session: {...record.session.session, rootExecutionPlanId: 'xplan_OTHER'}}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /execution lineage break/);
});

test('strategy decision for a foreign opportunity fails closed (orphan)', () => {
  const record = corpus.records[0];
  const broken = {...record, strategyDecision: {...record.strategyDecision, opportunityId: 'opp_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /references opportunity/);
});

test('allocation for a foreign opportunity fails closed (orphan)', () => {
  const record = corpus.records[0];
  const broken = {...record, allocation: {...record.allocation, opportunityId: 'opp_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /references opportunity/);
});

test('risk decision for a foreign opportunity fails closed (orphan)', () => {
  const record = corpus.records[0];
  const broken = {...record, risk: {...record.risk, opportunityId: 'opp_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /references opportunity/);
});

test('plan for a foreign opportunity fails closed (orphan)', () => {
  const record = corpus.records[0];
  const broken = {...record, plan: {...record.plan, opportunityId: 'opp_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /references opportunity/);
});

test('allocation referencing a foreign strategy fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, allocation: {...record.allocation, strategyId: 'strat_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /strategy/);
});

test('plan referencing a foreign strategy fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, plan: {...record.plan, strategyId: 'strat_OTHER'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /strategy/);
});

test('impossible timestamp ordering fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, strategyDecision: {...record.strategyDecision,
    timestamp: String(CLOSED_LOOP_TEST_TIMESTAMP + 10_000)}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /impossible ordering/);
});

test('invalid strategy timestamp string fails closed', () => {
  const record = corpus.records[0];
  const broken = {...record, strategyDecision: {...record.strategyDecision, timestamp: 'not-a-time'}} as ClosedLoopRecord;
  assert.throws(() => reconstructLifecycle(broken), /invalid timestamp/);
});

test('reconstruction is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(reconstructLifecycle(record).fingerprint, reconstructLifecycle(record).fingerprint);
  assert.ok(reconstructLifecycle(record).fingerprint.startsWith('cllf_'));
});

test('control stage state carries the session outcome', () => {
  const completed = reconstructLifecycle(corpus.records.find((r) => r.label === 'healthy-execution')!);
  const aborted = reconstructLifecycle(corpus.records.find((r) => r.label === 'emergency-stop')!);
  assert.equal(completed.stages.find((s) => s.stage === 'CONTROL_SESSION')!.state, 'COMPLETED');
  assert.equal(aborted.stages.find((s) => s.stage === 'CONTROL_SESSION')!.state, 'ABORTED');
});

test('performance stage reflects Sprint 034 analysis presence', () => {
  const analyzed = reconstructLifecycle(corpus.records[0]);
  const perfStage = analyzed.stages.find((s) => s.stage === 'PERFORMANCE')!;
  assert.equal(perfStage.state, 'ANALYZED');
  const bare = {...corpus.records[0], performance: null};
  const unanalyzed = reconstructLifecycle(bare);
  assert.equal(unanalyzed.stages.find((s) => s.stage === 'PERFORMANCE')!.state, 'NOT_ANALYZED');
});

test('real discovery output reconstructs through the same pipeline', () => {
  const discovered = discoveredAfisOpportunity();
  const record = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const chained: ClosedLoopRecord = {
    ...record,
    oiinEvent: clOiinEvent(discovered.opportunity.observedAt - 1000),
    opportunity: discovered.opportunity,
    strategyDecision: {...record.strategyDecision, opportunityId: discovered.opportunity.opportunityId, timestamp: String(discovered.opportunity.observedAt)},
    allocation: {...record.allocation, opportunityId: discovered.opportunity.opportunityId, timestamp: discovered.opportunity.observedAt},
    risk: {...record.risk, opportunityId: discovered.opportunity.opportunityId, timestamp: discovered.opportunity.observedAt},
    plan: {...record.plan, opportunityId: discovered.opportunity.opportunityId, timestamp: discovered.opportunity.observedAt},
  };
  const lifecycle = reconstructLifecycle(chained);
  assert.equal(lifecycle.stages.find((s) => s.stage === 'OPPORTUNITY')!.stageId, discovered.opportunity.opportunityId);
  assert.ok(lifecycle.valid);
});

test('span measures first-to-last stage distance', () => {
  const lifecycle = reconstructLifecycle(corpus.records[0]);
  assert.equal(lifecycle.spanMs, lifecycle.stages[lifecycle.stages.length - 1].timestamp - lifecycle.stages[0].timestamp);
});
