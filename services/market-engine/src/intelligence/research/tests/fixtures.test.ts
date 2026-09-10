import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchHistory, researchInput, ERA_COUNT, ERA_OFFSET_MS} from '../test-fixtures';

/**
 * SPRINT 036 — test fixture tests: the five-era corpus is built from REAL
 * Sprint 035 closed-loop analyses (never fabricated records), every era passes
 * the upstream invariants, and the fail-closed variants behave as designed.
 */

const history = researchHistory();

test('the corpus spans five eras of 13 records each', () => {
  assert.equal(ERA_COUNT, 5);
  assert.equal(history.eraAnalyses.length, 5);
  for (const analysis of history.eraAnalyses) {
    assert.equal(analysis.records.length, 13);
    assert.ok(analysis.analysisId.startsWith('clx_'));
  }
});

test('eras are 30 days apart with distinct analysis identities', () => {
  const ids = history.eraAnalyses.map((a) => a.analysisId);
  assert.equal(new Set(ids).size, 5);
  for (let i = 1; i < ERA_COUNT; i++) {
    const delta = history.eraAnalyses[i].timestamp - history.eraAnalyses[i - 1].timestamp;
    assert.equal(delta, ERA_OFFSET_MS);
  }
  assert.equal(ERA_OFFSET_MS, 30 * 24 * 3600 * 1000);
});

test('every era passed the upstream closed-loop invariants', () => {
  for (const analysis of history.eraAnalyses) {
    assert.equal(analysis.invariants!.passed, true);
  }
});

test('era records carry era-suffixed identities and shifted timestamps', () => {
  for (let era = 1; era <= ERA_COUNT; era++) {
    const records = history.eraAnalyses[era - 1].records;
    for (const record of records) {
      assert.match(record.identity.opportunityId, /__e\d$/);
      assert.equal(record.identity.opportunityId.endsWith(`__e${era}`), true);
    }
  }
  const healthyByEra = history.eraAnalyses.map((a) =>
    a.records.find((r) => r.identity.opportunityId.startsWith('opp_healthy'))!);
  for (let i = 1; i < healthyByEra.length; i++) {
    assert.ok(healthyByEra[i].identity.observedAt - healthyByEra[i - 1].identity.observedAt > 0);
  }
});

test('the full research input wraps the five eras canonically', () => {
  const input = researchInput();
  assert.equal(input.analyses.length, 5);
  assert.equal(input.correlationId, 'research-history');
  assert.equal(input.traceId, 'research-history-trace');
  assert.ok(Number.isFinite(input.timestamp));
  assert.deepEqual(input, history.input);
});

test('the corpus is memoized — one deterministic instance', () => {
  const again = researchHistory();
  assert.equal(again, history);
});

test('the base Sprint 035 corpus is the single source of truth', () => {
  assert.equal(history.base.records.length, 13);
  assert.ok(history.base.input.correlationId.length > 0);
  // Era 1 is the base history re-analyzed under era-suffixed identities.
  assert.equal(history.eraAnalyses[0].records.length, history.base.records.length);
});

test('aggressive edges decay across eras — alpha decay with constant leakages', () => {
  const adverseByEra = history.eraAnalyses.map((a) =>
    a.records.find((r) => r.identity.opportunityId.startsWith('opp_adverse'))!);
  const theoretical = adverseByEra.map((r) => r.realized.theoreticalNetEdge.value);
  assert.ok(theoretical[0]! > theoretical[4]!, 'theoretical edge must decay');
  for (let i = 1; i < theoretical.length; i++) {
    assert.ok(theoretical[i]! < theoretical[i - 1]!);
  }
});

test('guardian fees decay across eras — execution improves', () => {
  const healthyByEra = history.eraAnalyses.map((a) =>
    a.records.find((r) => r.identity.opportunityId.startsWith('opp_healthy'))!);
  // The FEES leakage component is the analysis-level truth about paid fees.
  const fees = healthyByEra.map((r) =>
    r.leakage.components.find((c) => c.component === 'FEES')!.value);
  assert.ok(fees[0]! > fees[4]!, `session fees must decay (${fees[0]} → ${fees[4]})`);
  for (let i = 1; i < fees.length; i++) {
    assert.ok(fees[i]! <= fees[i - 1]!);
  }
});

test('class rotation moves series across classes over eras', () => {
  const steadyByEra = history.eraAnalyses.map((a) =>
    a.records.find((r) => r.identity.opportunityId.startsWith('opp_steady'))!);
  const classes = steadyByEra.map((r) => r.identity.opportunityClass);
  assert.ok(new Set(classes).size > 1, `steady-single must rotate (got ${classes.join(',')})`);
});

test('malformedAnalysis breaks exactly one record in a reusable clone', () => {
  const malformed = history.malformedAnalysis();
  assert.notEqual(malformed, history.eraAnalyses[0]);
  const broken = malformed.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;
  assert.ok(Number.isNaN(broken.identity.freshness));
  // The original corpus is untouched.
  const pristine = history.eraAnalyses[0].records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;
  assert.ok(Number.isFinite(pristine.identity.freshness));
});

test('invariantFailedAnalysis reports failed upstream invariants', () => {
  const failed = history.invariantFailedAnalysis();
  assert.equal(failed.invariants!.passed, false);
});

test('contradictoryAnalysis mutates the realized value only', () => {
  const contradictory = history.contradictoryAnalysis();
  const healthy = contradictory.records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;
  assert.ok(Math.abs((healthy.realized.realizedNetValue?.value ?? -1) - 4.2) < 1e-9);
  const original = history.eraAnalyses[0].records.find((r) => r.identity.opportunityId === 'opp_healthy__e1')!;
  assert.notEqual(original.realized.realizedNetValue.value, 4.2);
});

test('healthySourceId addresses the era observation for corrections', () => {
  for (let era = 1; era <= ERA_COUNT; era++) {
    const sourceId = history.healthySourceId(era);
    assert.equal(sourceId, `${history.eraAnalyses[era - 1].analysisId}:opp_healthy__e${era}`);
  }
});
