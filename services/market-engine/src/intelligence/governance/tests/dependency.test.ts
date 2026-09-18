import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDependencyGate} from '../dependency-gate';
import {
  liqGovernanceResult, noDominantGovernanceResult,
  venueDependentGovernanceResult, afisGovernanceResult,
  liqDominantDecisionResult, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — dependency gate tests: regime, strategy, venue,
 * multi-dependency, unknown; preservation in the handoff.
 */

test('an independent decision maps to INDEPENDENT', () => {
  const gate = evaluateDependencyGate(liqDominantDecisionResult());
  assert.equal(gate.state, 'INDEPENDENT');
  assert.equal(gate.outcome, 'PASS');
  assert.equal(gate.regimeDependency, false);
  assert.equal(gate.strategyDependency, false);
  assert.equal(gate.venueDependency, false);
});

test('the no-dominant corpus run is strategy dependent', () => {
  const result = noDominantGovernanceResult();
  assert.equal(result.dependencyGate.state, 'STRATEGY_DEPENDENT');
  assert.equal(result.dependencyGate.strategyDependency, true);
});

test('the venue-dependent corpus run detects the venue axis', () => {
  const result = venueDependentGovernanceResult();
  assert.equal(result.dependencyGate.venueDependency, true);
  assert.notEqual(result.dependencyGate.state, 'INDEPENDENT');
});

test('the AFIS CVA run is multi dependent (regime + strategy)', () => {
  const result = afisGovernanceResult();
  assert.equal(result.dependencyGate.state, 'MULTI_DEPENDENT');
  assert.equal(result.dependencyGate.regimeDependency, true);
  assert.equal(result.dependencyGate.strategyDependency, true);
});

test('two detected axes map to MULTI_DEPENDENT', () => {
  const multi = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.regimeAnalysis.detected = true;
    draft.venueAnalysis.detected = true;
  });
  const gate = evaluateDependencyGate(multi);
  assert.equal(gate.state, 'MULTI_DEPENDENT');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
});

test('regime-only detection maps to REGIME_DEPENDENT', () => {
  const regime = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.regimeAnalysis.detected = true;
  });
  const gate = evaluateDependencyGate(regime);
  assert.equal(gate.state, 'REGIME_DEPENDENT');
});

test('strategy-only detection maps to STRATEGY_DEPENDENT', () => {
  const strategy = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.strategyAnalysis.detected = true;
  });
  const gate = evaluateDependencyGate(strategy);
  assert.equal(gate.state, 'STRATEGY_DEPENDENT');
});

test('venue-only detection maps to VENUE_DEPENDENT', () => {
  const venue = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.venueAnalysis.detected = true;
  });
  const gate = evaluateDependencyGate(venue);
  assert.equal(gate.state, 'VENUE_DEPENDENT');
});

test('missing dependency analyses map to UNKNOWN (never INDEPENDENT)', () => {
  const unknown = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.regimeAnalysis as {detected?: unknown}).detected = undefined;
  });
  const gate = evaluateDependencyGate(unknown);
  assert.equal(gate.state, 'UNKNOWN');
  assert.equal(gate.outcome, 'BLOCK');
  assert.equal(gate.code, 'INVALID_DEPENDENCY');
  assert.equal(gate.regimeDependency, null);
});

test('dependencies are preserved in the handoff package', () => {
  const result = afisGovernanceResult();
  assert.equal(result.handoffPackage.dependencies.state, 'MULTI_DEPENDENT');
  assert.ok(Array.isArray(result.handoffPackage.dependencies.regime));
  assert.ok(Array.isArray(result.handoffPackage.dependencies.strategy));
  assert.ok(Array.isArray(result.handoffPackage.dependencies.venue));
});

test('applicable regimes/strategies/venues are carried through', () => {
  const result = venueDependentGovernanceResult();
  assert.ok(Array.isArray(result.dependencyGate.applicableRegimes));
  assert.ok(Array.isArray(result.dependencyGate.applicableStrategies));
  assert.ok(Array.isArray(result.dependencyGate.applicableVenues));
});

test('dependency reasons name the detected axes', () => {
  const multi = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.regimeAnalysis.detected = true;
    draft.strategyAnalysis.detected = true;
  });
  const gate = evaluateDependencyGate(multi);
  assert.match(gate.reasons.join(' '), /multiple dependency axes/);
  assert.match(gate.reasons.join(' '), /applicable regimes/);
  assert.match(gate.reasons.join(' '), /applicable strategies/);
});

test('the gate result is immutable with content-derived ids', () => {
  const gate = evaluateDependencyGate(liqDominantDecisionResult());
  assert.ok(Object.isFrozen(gate));
  assert.ok(gate.dependencyGateId.startsWith('gdep_'));
  assert.ok(gate.contentFingerprint.startsWith('gcfp_'));
});

test('identical decision results yield identical dependency gates', () => {
  const a = evaluateDependencyGate(liqDominantDecisionResult());
  const b = evaluateDependencyGate(liqDominantDecisionResult());
  assert.equal(a.dependencyGateId, b.dependencyGateId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('every dependency state produces a limitation outcome', () => {
  for (const state of ['REGIME_DEPENDENT', 'STRATEGY_DEPENDENT',
    'VENUE_DEPENDENT', 'MULTI_DEPENDENT']) {
    const draft = governanceClone(liqDominantDecisionResult(), (d) => {
      d.regimeAnalysis.detected = state === 'REGIME_DEPENDENT'
        || state === 'MULTI_DEPENDENT';
      d.strategyAnalysis.detected = state === 'STRATEGY_DEPENDENT'
        || state === 'MULTI_DEPENDENT';
      d.venueAnalysis.detected = state === 'VENUE_DEPENDENT'
        || state === 'MULTI_DEPENDENT';
    });
    const gate = evaluateDependencyGate(draft);
    assert.equal(gate.state, state);
    assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
  }
});

test('a dependency gate over an independent result carries no axes', () => {
  const gate = evaluateDependencyGate(liqDominantDecisionResult());
  assert.equal(gate.regimeDependency, false);
  assert.equal(gate.strategyDependency, false);
  assert.equal(gate.venueDependency, false);
  assert.equal(gate.reasons.length, 1);
});
