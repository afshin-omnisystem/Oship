import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  preserveDependencies, GOVERNANCE_TO_INTENT_DEPENDENCY,
  dependencySummaryLines,
} from '../dependencies';
import {IntentRejectionError, INTENT_DEPENDENCY_STATES}
  from '../types';
import {
  liqIntentResult, afisIntentResult, noDominantIntentResult,
  multiDependentIntentResult, venueDependentIntentResult,
  liqGovernanceResult, multiDependentGovernanceResult,
  frozenGovernanceClone, governanceClone, runGovernance,
  governanceInputOf, cleanDecisionResult, venueDependentDecisionResult,
} from '../test-fixtures';

/** SPRINT 041 — dependency preservation tests (§6). */

test('six dependency states are enumerated', () => {
  assert.equal(INTENT_DEPENDENCY_STATES.length, 6);
  assert.ok(INTENT_DEPENDENCY_STATES.includes('NONE'));
});

test('governance INDEPENDENT maps to intent NONE', () => {
  assert.equal(GOVERNANCE_TO_INTENT_DEPENDENCY.INDEPENDENT, 'NONE');
  assert.equal(liqIntentResult().dependencies.state, 'NONE');
});

test('regime dependency is preserved', () => {
  const regimeDep = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
    })));
  const preserved = preserveDependencies(regimeDep);
  assert.equal(preserved.state, 'REGIME_DEPENDENT');
  assert.equal(preserved.regimeDependency, true);
});

test('strategy dependency is preserved', () => {
  assert.equal(noDominantIntentResult().dependencies.state,
    'STRATEGY_DEPENDENT');
  assert.equal(noDominantIntentResult().dependencies.strategyDependency,
    true);
});

test('venue dependency is preserved', () => {
  const result = venueDependentIntentResult();
  assert.equal(result.dependencies.state, 'MULTI_DEPENDENT');
  assert.equal(result.dependencies.venueDependency, true);
});

test('multi dependency is preserved with its flags', () => {
  const result = multiDependentIntentResult();
  assert.equal(result.dependencies.state, 'MULTI_DEPENDENT');
  assert.equal(result.dependencies.regimeDependency, true);
  assert.equal(result.dependencies.strategyDependency, true);
  const venueDep = venueDependentIntentResult();
  assert.equal(venueDep.dependencies.venueDependency, true);
  assert.equal(venueDep.dependencies.state, 'MULTI_DEPENDENT');
});

test('the AFIS corpus preserves its multi dependency', () => {
  assert.equal(afisIntentResult().dependencies.state,
    'MULTI_DEPENDENT');
});

test('dependencies declare preservation from governance', () => {
  assert.equal(liqIntentResult().dependencies.preservedFromGovernance,
    true);
});

test('applicable regimes, strategies and venues are carried', () => {
  const dependencies = afisIntentResult().dependencies;
  assert.ok(dependencies.applicableRegimes.length > 0);
  assert.ok(dependencies.applicableStrategies.includes('arb-guardian'));
  assert.ok(dependencies.applicableVenues.length > 0);
});

test('a NONE state contradicting true flags rejects fail closed', () => {
  assert.throws(() => preserveDependencies(
    frozenGovernanceClone(multiDependentGovernanceResult(),
      (draft) => {
        (draft.dependencyGate as {state: string}).state = 'NONE';
      })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_DEPENDENCY');
});

test('a REGIME state without the regime flag rejects', () => {
  assert.throws(() => preserveDependencies(
    frozenGovernanceClone(liqGovernanceResult(), (draft) => {
      (draft.dependencyGate as {state: string}).state
        = 'REGIME_DEPENDENT';
    })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_DEPENDENCY');
});

test('a MULTI state with a single flag rejects', () => {
  assert.throws(() => preserveDependencies(
    frozenGovernanceClone(liqGovernanceResult(), (draft) => {
      (draft.dependencyGate as {state: string}).state
        = 'MULTI_DEPENDENT';
      (draft.dependencyGate as {regimeDependency: boolean})
        .regimeDependency = true;
    })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_DEPENDENCY');
});

test('a preferred alternative never removes dependency information', () => {
  // LIQ has a preferred alternative AND is NONE — but the venue-dependent
  // corpus shows dependencies survive alongside alternatives.
  const result = venueDependentIntentResult();
  assert.equal(result.preferredAlternativeId, null);
  assert.notEqual(result.dependencies.state, 'NONE');
  assert.ok(result.alternatives.length > 0);
});

test('dependency summary lines name the preserved state', () => {
  const lines = dependencySummaryLines(
    afisIntentResult().dependencies);
  assert.ok(lines.some((line) =>
    line.includes('MULTI_DEPENDENT')));
  assert.ok(lines.some((line) =>
    line.includes('never removed')));
});

test('dependency preservation is deterministic', () => {
  assert.deepEqual(preserveDependencies(liqGovernanceResult()),
    preserveDependencies(liqGovernanceResult()));
});

test('the venue-dependent decision preserves its flags end to end', () => {
  const governance = runGovernance(
    governanceInputOf(venueDependentDecisionResult()));
  const preserved = preserveDependencies(governance);
  assert.equal(preserved.venueDependency, true);
  assert.equal(preserved.state, 'MULTI_DEPENDENT');
});
