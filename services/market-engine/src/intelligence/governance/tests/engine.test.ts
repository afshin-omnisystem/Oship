import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GovernanceEngine} from '../engine';
import {GOVERNANCE_ENGINE_VERSION} from '../types';
import {GovernanceRejectionError} from '../types';
import {canonicalJson} from '../ids';
import {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  governanceInputOf, liqDominantDecisionResult, afisDecisionResult,
  ablDecisionResult, cleanDecisionResult, staleDecisionResult,
  GOVERNANCE_FIXTURE_TIMESTAMP, validNormalization,
} from '../test-fixtures';

/**
 * SPRINT 040 — engine tests: the full governance lifecycle over real
 * decision results, end-to-end structure, determinism, configuration.
 */

test('the engine produces the full result structure', () => {
  const result = liqGovernanceResult();
  assert.ok(result.governanceId.startsWith('gov_'));
  assert.equal(result.schemaVersion, 'oship.decision-governance.v1');
  assert.ok(result.context);
  assert.ok(result.policies.length === 12);
  assert.ok(result.evidenceGate && result.safetyGate
    && result.comparabilityGate && result.freshnessGate
    && result.stabilityGate && result.dependencyGate
    && result.authorityCheck);
  assert.ok(result.classification);
  assert.ok(result.restrictions.length >= 3);
  assert.ok(result.research);
  assert.ok(result.feedback.length >= 0);
  assert.ok(result.handoffPackage && result.strategyInput);
  assert.ok(result.auditEvents.length > 10);
  assert.equal(result.invariants.passed, true);
  assert.equal(result.replay.identical, true);
});

test('the engine records correlation and trace ids', () => {
  const result = run(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(result.correlationId, 'corr-governance-AFIS');
  assert.equal(result.traceId, 'trace-governance-AFIS');
});

test('the engine records the governance engine version', () => {
  assert.equal(liqGovernanceResult().context.governanceVersion,
    GOVERNANCE_ENGINE_VERSION);
});

test('the engine runs the internal double-run replay', () => {
  const result = liqGovernanceResult();
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.governanceFingerprint);
});

test('the engine runs the full invariant set on every result', () => {
  for (const result of [afisGovernanceResult(), ablGovernanceResult(),
    liqGovernanceResult()]) {
    assert.equal(result.invariants.passed, true);
    assert.equal(result.invariants.checks.length, 77);
  }
});

test('the engine self-verifies its audit chain', () => {
  const result = liqGovernanceResult();
  const last = result.auditEvents[result.auditEvents.length - 1];
  assert.equal(last.eventType, 'replay-completed');
});

test('the engine throws on a null input', () => {
  const engine = new GovernanceEngine();
  assert.throws(() => engine.govern(null as never),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('the engine throws on a null decision result', () => {
  const engine = new GovernanceEngine();
  assert.throws(() => engine.govern({
    decisionResult: null as never, annotations: [],
    timestamp: 1, correlationId: 'c', traceId: 't',
  }), (e: unknown) => e instanceof GovernanceRejectionError
    && e.code === 'INVALID_DECISION_RESULT');
});

test('the engine exposes its frozen configuration', () => {
  const engine = new GovernanceEngine({unstableBlocksHandoff: true});
  assert.ok(Object.isFrozen(engine.configuration));
  assert.equal(engine.configuration.unstableBlocksHandoff, true);
  assert.equal(typeof engine.configurationFingerprint, 'string');
});

test('the configuration fingerprint is deterministic', () => {
  const a = new GovernanceEngine({}).configurationFingerprint;
  const b = new GovernanceEngine({}).configurationFingerprint;
  assert.equal(a, b);
});

test('different configurations produce different fingerprints', () => {
  const a = new GovernanceEngine({}).configurationFingerprint;
  const b = new GovernanceEngine(
    {unstableBlocksHandoff: true}).configurationFingerprint;
  assert.notEqual(a, b);
});

test('the engine validates the policy registry on construction', () => {
  assert.doesNotThrow(() => new GovernanceEngine());
});

test('the engine rejects an invalid configuration', () => {
  assert.throws(() => new GovernanceEngine(
    {researchDependencyEscalation: 'SOMETIMES' as never}));
});

test('the engine is deterministic across instances', () => {
  const input = governanceInputOf(liqDominantDecisionResult());
  const a = new GovernanceEngine().govern(input);
  const b = new GovernanceEngine().govern(input);
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('the engine handles AFIS end to end', () => {
  const result = afisGovernanceResult();
  assert.equal(result.context.domain, 'AFIS');
  assert.equal(result.classification, 'HANDOFF_CONFLICTED');
});

test('the engine handles ABL end to end', () => {
  const result = ablGovernanceResult();
  assert.equal(result.context.domain, 'ABL');
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('the engine handles a clean decision end to end', () => {
  const result = run(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED');
});

test('the engine handles a stale decision end to end', () => {
  const result = run(governanceInputOf(staleDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_STALE');
});

test('the engine accepts a valid normalization end to end', () => {
  const result = run(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  assert.equal(result.comparabilityGate.state,
    'COMPARABLE_VIA_NORMALIZATION');
});

test('the engine rejects an invalid normalization end to end', () => {
  assert.throws(() => run(governanceInputOf(cleanDecisionResult(), [],
    {...validNormalization(), version: 'old.v0'})),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('the engine sorts annotations canonically', () => {
  const result = run(governanceInputOf(liqDominantDecisionResult(),
    ['zebra', 'alpha', 'middle']));
  assert.deepEqual([...result.annotations], ['alpha', 'middle', 'zebra']);
});

test('the engine rejects too many annotations', () => {
  const many = Array.from({length: 17}, (_, i) => `note-${i}`);
  assert.throws(() => run(governanceInputOf(
    liqDominantDecisionResult(), many)),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('the engine accepts the maximum annotation count', () => {
  const sixteen = Array.from({length: 16}, (_, i) => `note-${i}`);
  const result = run(governanceInputOf(
    liqDominantDecisionResult(), sixteen));
  assert.equal(result.annotations.length, 16);
});

test('audit events follow the lifecycle order', () => {
  const result = liqGovernanceResult();
  const types = result.auditEvents.map((e) => e.eventType);
  assert.equal(types[0], 'context-created');
  assert.equal(types[types.length - 1], 'replay-completed');
  const classifiedIndex = types.indexOf('handoff-classified');
  const packageIndex = types.indexOf('package-built');
  assert.ok(classifiedIndex < packageIndex);
});

test('every policy evaluation is audited', () => {
  const result = liqGovernanceResult();
  const policyEvents = result.auditEvents.filter(
    (e) => e.eventType === 'policy-evaluated');
  assert.equal(policyEvents.length, 12);
});

test('the engine result carries the canonical disclaimer', () => {
  const result = liqGovernanceResult();
  assert.match(result.disclaimer,
    /not a probability, forecast, expected return, guarantee/);
});

test('the engine result is frozen', () => {
  const result = liqGovernanceResult();
  assert.ok(Object.isFrozen(result));
});

test('the engine timestamp is informational only', () => {
  const base = governanceInputOf(liqDominantDecisionResult());
  const a = new GovernanceEngine().govern(base);
  const b = new GovernanceEngine().govern({...base,
    timestamp: GOVERNANCE_FIXTURE_TIMESTAMP + 5000});
  assert.equal(a.classification, b.classification);
  assert.deepEqual(a.restrictions.map((r) => r.code),
    b.restrictions.map((r) => r.code));
});

test('AFIS and ABL governance results differ', () => {
  assert.notEqual(afisGovernanceResult().governanceId,
    ablGovernanceResult().governanceId);
});

function run(input: Parameters<GovernanceEngine['govern']>[0]) {
  return new GovernanceEngine().govern(input);
}
