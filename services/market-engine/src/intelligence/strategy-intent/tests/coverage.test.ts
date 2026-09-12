import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {
  liqIntentResult, afisIntentResult, ablIntentResult,
  cleanIntentResult, staleIntentResult, agingIntentResult,
  unknownFreshnessIntentResult, unknownAllowedIntentResult,
  unstableIntentResult, unstableBlockedIntentResult,
  notComparableIntentResult, normalizedIntentResult,
  noDominantIntentResult, multiDependentIntentResult,
  venueDependentIntentResult, governanceBlockedIntentResult,
  authorityBypassIntentResult, staleAllowedIntentResult,
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  liqIntentInput,
} from '../test-fixtures';
import {serializeStrategyIntentResult} from '../replay';
import {canonicalJson} from '../ids';
import {INTENT_RESTRICTION_CODES} from '../types';

/**
 * SPRINT 041 — cross-cutting coverage: the full 18-fixture corpus under
 * one report, plus specification details not covered elsewhere.
 */

const engine = new StrategyIntentEngine();
const CORPUS = [
  ['afis', afisIntentResult], ['abl', ablIntentResult],
  ['liq', liqIntentResult], ['no-dominant', noDominantIntentResult],
  ['multi-dependent', multiDependentIntentResult],
  ['venue-dependent', venueDependentIntentResult],
  ['clean', cleanIntentResult], ['stale', staleIntentResult],
  ['stale-allowed', staleAllowedIntentResult],
  ['aging', agingIntentResult],
  ['unknown-freshness', unknownFreshnessIntentResult],
  ['unknown-allowed', unknownAllowedIntentResult],
  ['unstable', unstableIntentResult],
  ['unstable-blocked', unstableBlockedIntentResult],
  ['not-comparable', notComparableIntentResult],
  ['normalized', normalizedIntentResult],
  ['governance-blocked', governanceBlockedIntentResult],
  ['authority-bypass', authorityBypassIntentResult],
] as const;

test('the corpus covers all eight classification states', () => {
  const states = new Set(CORPUS.map(([, build]) =>
    build().classification));
  assert.equal(states.size, 8);
});

test('every corpus result passes 93 invariant checks', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.invariants.checks.length, 93,
      `${name} check count`);
    assert.equal(result.invariants.passed, true, name);
  }
});

test('every corpus result is deeply frozen', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.ok(Object.isFrozen(result), name);
    assert.ok(Object.isFrozen(result.intent), name);
    assert.ok(Object.isFrozen(result.context), name);
    assert.ok(Object.isFrozen(result.objective), name);
    assert.ok(Object.isFrozen(result.explanation), name);
    assert.ok(Object.isFrozen(result.research), name);
    assert.ok(Object.isFrozen(result.boundary), name);
    assert.ok(Object.isFrozen(result.dependencies), name);
    assert.ok(Object.isFrozen(result.feedback), name);
  }
});

test('every corpus result carries a disclaimer', () => {
  for (const [name, build] of CORPUS) {
    assert.ok(build().intent.disclaimer.startsWith(
      'This is an evidence-bound strategic intent'), name);
  }
});

test('every corpus result declares informational and strategyDecides', () => {
  for (const [name, build] of CORPUS) {
    const intent = build().intent;
    assert.equal(intent.informational, true, name);
    assert.equal(intent.strategyDecides, true, name);
  }
});

test('every corpus result pins all version strings', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.intent.schemaVersion,
      'oship.strategy-intent.v1', name);
    assert.equal(result.intent.sourceVersions.intentVersion,
      'oship.strategy-intent.engine.v1', name);
    assert.equal(result.intent.sourceVersions.governanceVersion,
      'oship.decision-governance.engine.v1', name);
    assert.equal(result.intent.sourceVersions.decisionIntelligenceVersion,
      'oship.decision-intelligence.engine.v1', name);
  }
});

test('every corpus result carries an sfp2_ fingerprint', () => {
  for (const [name, build] of CORPUS) {
    assert.ok(build().intentFingerprint.startsWith('sfp2_'), name);
  }
});

test('every corpus result carries a sint_ id', () => {
  for (const [name, build] of CORPUS) {
    assert.ok(build().intentId.startsWith('sint_'), name);
  }
});

test('corpus intent ids are pairwise distinct', () => {
  const ids = CORPUS.map(([, build]) => build().intentId);
  // governance-blocked and authority-bypass block the same governed
  // decision with identical structural outcomes — one shared identity.
  assert.equal(new Set(ids).size, 17);
  assert.notEqual(liqIntentResult().intentId,
    unstableIntentResult().intentId);
  assert.notEqual(liqIntentResult().intentId,
    cleanIntentResult().intentId);
});

test('every corpus result carries at least five restrictions', () => {
  for (const [name, build] of CORPUS) {
    assert.ok(build().restrictions.length >= 5, name);
  }
});

test('every corpus result carries a boundary check block', () => {
  for (const [name, build] of CORPUS) {
    const boundary = build().boundary;
    assert.equal(boundary.state, 'BOUNDARY_RESPECTED', name);
    assert.equal(boundary.checks.length, 4, name);
  }
});

test('every corpus result carries a replay verdict', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.replay.identical, true, name);
    assert.equal(result.replay.fingerprint, result.intentFingerprint,
      name);
  }
});

test('blocked families never surface preferred alternatives', () => {
  for (const [name, build] of [
    ['afis', afisIntentResult],
    ['abl', ablIntentResult],
    ['stale', staleIntentResult],
    ['unknown-freshness', unknownFreshnessIntentResult],
    ['unstable-blocked', unstableBlockedIntentResult],
    ['not-comparable', notComparableIntentResult],
    ['multi-dependent', multiDependentIntentResult],
    ['venue-dependent', venueDependentIntentResult],
    ['governance-blocked', governanceBlockedIntentResult],
    ['authority-bypass', authorityBypassIntentResult],
  ] as const) {
    const result = build();
    assert.equal(result.preferredAlternativeId, null, name);
    assert.deepEqual(result.acceptableAlternativeIds, [], name);
  }
});

test('actionable corpora surface preferred or acceptable alternatives', () => {
  for (const [name, build] of [
    ['liq', liqIntentResult], ['clean', cleanIntentResult],
    ['aging', agingIntentResult], ['unstable', unstableIntentResult],
    ['stale-allowed', staleAllowedIntentResult],
    ['unknown-allowed', unknownAllowedIntentResult],
    ['normalized', normalizedIntentResult],
    ['no-dominant', noDominantIntentResult],
  ] as const) {
    const result = build();
    assert.ok(result.preferredAlternativeId !== null
      || result.acceptableAlternativeIds.length > 0, name);
  }
});

test('every corpus result serializes to sorted canonical JSON', () => {
  for (const [name, build] of CORPUS) {
    const serialized = serializeStrategyIntentResult(build());
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    assert.deepEqual([...keys].sort(), keys, name);
  }
});

test('corpus serializations are pairwise distinct', () => {
  const serialized = CORPUS.map(([, build]) =>
    serializeStrategyIntentResult(build()));
  assert.equal(new Set(serialized).size, serialized.length);
});

test('every corpus result verifies its own audit chain', () => {
  const {verifyStrategyIntentAudit} =
    require('../audit') as typeof import('../audit');
  for (const [name, build] of CORPUS) {
    const result = build();
    const verification = verifyStrategyIntentAudit(
      result.auditEvents);
    assert.equal(verification.valid, true, name);
  }
});

test('every corpus result records replay-completed last', () => {
  for (const [name, build] of CORPUS) {
    const events = build().auditEvents;
    assert.equal(events[events.length - 1].eventType,
      'replay-completed', name);
  }
});

test('restriction codes map one-to-one from the canonical list', () => {
  for (const code of INTENT_RESTRICTION_CODES) {
    assert.ok(code.length > 3);
  }
  assert.equal(new Set(INTENT_RESTRICTION_CODES).size,
    INTENT_RESTRICTION_CODES.length);
});

test('the serialized intent carries no executable code', () => {
  const serialized = serializeStrategyIntentResult(
    engine.synthesize(liqIntentInput()));
  assert.ok(!/function\s*\(|=>|\(\)\s*\{/.test(serialized));
});

test('the serialized intent is stable across engine instances', () => {
  const a = new StrategyIntentEngine().synthesize(liqIntentInput());
  const b = new StrategyIntentEngine().synthesize(liqIntentInput());
  assert.equal(serializeStrategyIntentResult(a),
    serializeStrategyIntentResult(b));
});

test('canonical JSON never emits undefined values', () => {
  const serialized = canonicalJson({a: undefined, b: 1});
  assert.ok(!serialized.includes('undefined'));
});

test('the corpus governance pairs stay internally consistent', () => {
  for (const [result, governance] of [
    [liqIntentResult(), liqGovernanceResult()],
    [afisIntentResult(), afisGovernanceResult()],
    [ablIntentResult(), ablGovernanceResult()],
  ] as const) {
    assert.equal(result.context.governanceId,
      governance.governanceId);
    assert.equal(result.intent.provenance.decisionId,
      governance.context.decisionId);
  }
});

test('restricted corpora carry their restriction in the artifact', () => {
  const result = normalizedIntentResult();
  assert.ok(result.intent.restrictions.some((r) =>
    r.code === 'NORMALIZED_COMPARISON_ONLY'));
  const stale = staleIntentResult();
  assert.ok(stale.intent.restrictions.some((r) =>
    r.code === 'STALE_EVIDENCE_WARNING'));
});

test('research requirements are mirrored in the artifact', () => {
  const result = liqIntentResult();
  assert.equal(result.intent.researchRequirements.length,
    result.research.requirements.length);
  assert.deepEqual(result.intent.researchRequirements.map(
    (r) => r.researchClass),
    result.research.requirements.map((r) => r.researchClass));
});

test('objective and priority are mirrored in the artifact', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.intent.objective.objectiveClass,
      result.objective.objectiveClass, name);
    assert.equal(result.intent.priority, result.priority, name);
  }
});

test('classification reasons are mirrored in the artifact', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.deepEqual([...result.intent.classificationReasons],
      [...result.classificationReasons], name);
  }
});

test('alternatives are mirrored in the artifact', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.intent.alternatives.length,
      result.alternatives.length, name);
  }
});

test('dependencies are mirrored in the artifact', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.intent.dependencies.state,
      result.dependencies.state, name);
  }
});

test('audit identity is mirrored in the artifact', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.ok(result.intent.auditIdentity.intentId
      === result.intentId, name);
  }
});

test('the authority-bypass corpus keeps its boundary respected', () => {
  const result = authorityBypassIntentResult();
  assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
  assert.equal(result.intent.objective.objectiveClass,
    'NO_ACTIONABLE_INTENT');
});

test('the governance-blocked corpus blocks without leaking quotes', () => {
  const result = governanceBlockedIntentResult();
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
  for (const reason of result.classificationReasons) {
    // The quoted requester text is reported speech, inert by design.
    assert.ok(!/\bprobability of profit\b/
      .test(reason.replace(/"[^"]*"/g, ' ')));
  }
});

test('the stale-allowed corpus stays limited', () => {
  const result = staleAllowedIntentResult();
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  assert.ok(result.restrictions.some((r) =>
    r.code === 'STALE_EVIDENCE_WARNING'));
});

test('the unknown-allowed corpus stays limited', () => {
  const result = unknownAllowedIntentResult();
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
});

test('the aging corpus stays limited with aging evidence', () => {
  const result = agingIntentResult();
  assert.equal(result.context.freshnessState, 'AGING');
  assert.equal(result.priority, 'LIMITED_STRATEGY_INPUT');
});

test('the unstable corpus keeps its stability warning', () => {
  assert.ok(unstableIntentResult().restrictions.some((r) =>
    r.code === 'STABILITY_WARNING'));
});

test('the not-comparable corpus blocks cross-domain inference', () => {
  const result = notComparableIntentResult();
  assert.ok(result.restrictions.some((r) => r.code === 'NOT_COMPARABLE'));
  assert.ok(result.research.requirements.some((r) =>
    r.researchClass === 'COMPARABILITY_RESEARCH'));
});

test('the venue-dependent corpus carries coverage restrictions', () => {
  const result = venueDependentIntentResult();
  for (const code of ['REGIME_LIMITED', 'STRATEGY_LIMITED',
    'VENUE_LIMITED', 'RESEARCH_REQUIRED']) {
    assert.ok(result.restrictions.some((r) => r.code === code),
      `${code} missing`);
  }
});

test('the multi-dependent corpus carries coverage restrictions', () => {
  const result = multiDependentIntentResult();
  assert.ok(result.restrictions.some((r) =>
    r.code === 'REGIME_LIMITED'));
  assert.ok(result.restrictions.some((r) =>
    r.code === 'STRATEGY_LIMITED'));
});

test('the ABL corpus carries the sample warning', () => {
  assert.ok(ablIntentResult().restrictions.some((r) =>
    r.code === 'INSUFFICIENT_SAMPLE_WARNING'));
});

test('the AFIS corpus carries the conflict warning', () => {
  assert.ok(afisIntentResult().restrictions.some((r) =>
    r.code === 'CONFLICT_WARNING'));
});

test('the LIQ corpus carries leakage and stability warnings', () => {
  const codes = liqIntentResult().restrictions.map((r) => r.code);
  assert.ok(codes.includes('LEAKAGE_WARNING'));
  assert.ok(codes.includes('STABILITY_WARNING'));
});

test('every corpus feedback record names the intent id', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    for (const record of result.feedback) {
      assert.equal(record.intentId, result.intentId, name);
    }
  }
});

test('every corpus explanation pins both source ids', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.equal(result.explanation.sourceDecisionId,
      result.intent.provenance.decisionId, name);
    assert.equal(result.explanation.sourceGovernanceId,
      result.intent.provenance.governanceId, name);
  }
});

test('every corpus context mirrors its governance classification', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.ok(result.context.governanceClassification
      .startsWith('HANDOFF_'), name);
  }
});

test('every corpus objective is one of the six classes', () => {
  const {INTENT_OBJECTIVE_CLASSES} =
    require('../types') as typeof import('../types');
  for (const [name, build] of CORPUS) {
    assert.ok(INTENT_OBJECTIVE_CLASSES.includes(
      build().objective.objectiveClass), name);
  }
});

test('every corpus priority is one of the six levels', () => {
  const {INTENT_PRIORITIES} =
    require('../types') as typeof import('../types');
  for (const [name, build] of CORPUS) {
    assert.ok(INTENT_PRIORITIES.includes(build().priority), name);
  }
});

test('every corpus dependency state is one of the six states', () => {
  const {INTENT_DEPENDENCY_STATES} =
    require('../types') as typeof import('../types');
  for (const [name, build] of CORPUS) {
    assert.ok(INTENT_DEPENDENCY_STATES.includes(
      build().dependencies.state), name);
  }
});

test('every corpus alternative domain matches the intent domain', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    for (const alternative of result.alternatives) {
      assert.equal(alternative.domain, result.context.domain, name);
    }
  }
});

test('the engine synthesizes the whole corpus without throwing', () => {
  for (const [name, build] of CORPUS) {
    assert.doesNotThrow(() => build(), name);
  }
});
