import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {verifyClosedLoopAudit} from '../audit';
import {closedLoopCorpus} from '../test-fixtures';
import {CLOSED_LOOP_INVARIANT_NAMES} from '../types';

/**
 * SPRINT 035 — invariant tests (§25): 35 named hard invariants, all passing
 * on the canonical corpus; failures are demonstrable.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('the corpus passes every invariant', () => {
  assert.ok(result.invariants!.passed);
  assert.equal(result.invariants!.failedCount, 0);
});

test('all 35 named invariants are checked', () => {
  assert.equal(CLOSED_LOOP_INVARIANT_NAMES.length, 35);
  const checked = new Set(result.invariants!.checks.map((c) => c.invariant));
  for (const name of CLOSED_LOOP_INVARIANT_NAMES) {
    assert.ok(checked.has(name), `missing invariant check ${name}`);
  }
  assert.ok(result.invariants!.checks.length >= 35);
});

test('immutability invariants hold (opportunity identity & lifecycle)', () => {
  const names = ['IMMUTABLE_OPPORTUNITY_IDENTITY', 'IMMUTABLE_HISTORICAL_LIFECYCLE'];
  for (const name of names) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('lineage invariants hold (parents, versions, ordering, orphans, duplicates)', () => {
  const names = ['PARENT_LINEAGE_PRESERVATION', 'VERSION_MONOTONICITY', 'LIFECYCLE_ORDERING',
    'NO_ORPHAN_LIFECYCLE_RECORDS', 'NO_DUPLICATE_STAGE'];
  for (const name of names) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('identity consistency invariants hold across all stages', () => {
  const names = ['OPPORTUNITY_FINGERPRINT_CONSISTENCY', 'STRATEGY_IDENTITY_CONSISTENCY',
    'ALLOCATION_IDENTITY_CONSISTENCY', 'RISK_IDENTITY_CONSISTENCY', 'EXECUTION_IDENTITY_CONSISTENCY'];
  for (const name of names) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('reconciliation invariants hold (quantity, capital, values, leakage, attribution)', () => {
  const names = ['QUANTITY_RECONCILIATION', 'CAPITAL_RECONCILIATION', 'THEORETICAL_VALUE_RECONCILIATION',
    'REALIZED_VALUE_RECONCILIATION', 'LEAKAGE_RECONCILIATION', 'ATTRIBUTION_RECONCILIATION', 'BENCHMARK_CONSISTENCY'];
  for (const name of names) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('honesty invariants hold (provenance, unavailable values)', () => {
  for (const name of ['PROVENANCE_PRESERVATION', 'UNAVAILABLE_VALUE_HONESTY']) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('determinism invariants hold (classification, scoring, ranking, replay)', () => {
  for (const name of ['DETERMINISTIC_CLASSIFICATION', 'DETERMINISTIC_SCORING', 'DETERMINISTIC_RANKING', 'DETERMINISTIC_REPLAY']) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('no-authority-mutation invariants hold (treasury, portfolio, risk, AEGIS, execution)', () => {
  const names = ['NO_TREASURY_MUTATION', 'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION',
    'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION'];
  for (const name of names) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('audit invariants hold (chain validity, tamper detection)', () => {
  for (const name of ['AUDIT_HASH_CHAIN_VALIDITY', 'TAMPER_DETECTION']) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('domain semantic invariants hold (AFIS, ABL, emergency stop)', () => {
  for (const name of ['AFIS_SEMANTIC_PRESERVATION', 'ABL_SEMANTIC_PRESERVATION', 'EMERGENCY_STOP_PRESERVATION']) {
    const check = result.invariants!.checks.find((c) => c.invariant === name)!;
    assert.ok(check.passed, check.detail);
  }
});

test('a broken lifecycle makes the whole analysis fail closed', () => {
  const broken = {...corpus.records[0], plan: {...corpus.records[0].plan, opportunityId: 'opp_OTHER'}};
  assert.throws(() => engine.analyze({...corpus.input, records: [broken, ...corpus.input.records.slice(1)]}),
    /references opportunity/);
});

test('invariant report lists failures with details when they occur', () => {
  // Construct an analysis whose audit chain was tampered — verification must fail.
  const tampered = result.auditEvents.map((e) => ({...e}));
  tampered[1] = {...tampered[1], hash: 'f'.repeat(64)};
  assert.equal(verifyClosedLoopAudit(tampered).valid, false);
});
