import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSafetyGate, FABRICATED_KEYS, CERTAINTY_CLAIMS,
  containsCertaintyClaim, PREDICTION_TERMS, EXECUTION_INSTRUCTIONS,
  narrativeOf, disclaimerFieldsOf} from '../safety-gate';
import {RECOMMENDATION_DISCLAIMER} from '../../decision/types';
import {GOVERNANCE_DISCLAIMER} from '../types';
import {
  liqDominantDecisionResult, alteredDisclaimerDecisionResult,
  fabricatedKeyDecisionResult, UNSAFE_ANNOTATIONS, CLEAN_ANNOTATIONS,
  governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — safety gate tests: disclaimer verification, fabricated keys,
 * certainty claims, prediction terms, execution instructions, annotation
 * injection.
 */

test('a real decision result passes the safety gate', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(), []);
  assert.equal(gate.state, 'SAFE');
  assert.equal(gate.code, null);
});

test('the gate verifies the exact canonical disclaimer', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(), []);
  assert.equal(gate.disclaimerVerified, true);
  assert.equal(RECOMMENDATION_DISCLAIMER, GOVERNANCE_DISCLAIMER);
});

test('the disclaimer text is the exact required wording', () => {
  assert.equal(GOVERNANCE_DISCLAIMER,
    'This is an evidence-bound analytical recommendation, not a '
    + 'probability, forecast, expected return, guarantee, or execution '
    + 'instruction.');
});

test('an altered disclaimer blocks with UNSAFE_SEMANTICS', () => {
  const gate = evaluateSafetyGate(alteredDisclaimerDecisionResult(), []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.equal(gate.code, 'UNSAFE_SEMANTICS');
});

test('a fabricated probability key blocks with UNSAFE_SEMANTICS', () => {
  const gate = evaluateSafetyGate(fabricatedKeyDecisionResult(), []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /fabricated keys/);
});

test('clean annotations pass', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    CLEAN_ANNOTATIONS);
  assert.equal(gate.state, 'SAFE');
});

test('every unsafe annotation blocks the gate', () => {
  for (const annotation of UNSAFE_ANNOTATIONS) {
    const gate = evaluateSafetyGate(liqDominantDecisionResult(), [annotation]);
    assert.equal(gate.state, 'BLOCK_UNSAFE',
      `annotation "${annotation}" was not blocked`);
    assert.equal(gate.code, 'UNSAFE_SEMANTICS');
  }
});

test('probability annotations are rejected with an explicit reason', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['probability of success is high']);
  assert.match(gate.reasons.join(' '), /prediction semantics/);
});

test('expected-ROI annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['expected ROI 0.12']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('guaranteed-return annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['guaranteed return on this arb']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('guaranteed-execution annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['guaranteed execution at these odds']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('certainty annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['this outcome is certain']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('execution-instruction annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['execute the order immediately']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /execution instruction/);
});

test('place-a-trade annotations are rejected', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(),
    ['place a trade on venue-a now']);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('the gate runs eight explicit checks', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(), []);
  assert.equal(gate.checks.length, 8);
  for (const check of gate.checks) {
    assert.equal(check.passed, true, check.detail);
  }
});

test('a non-informational recommendation blocks', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.recommendation as {informational?: boolean}).informational
      = false;
  });
  const gate = evaluateSafetyGate(mutated, []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /informational/);
});

test('a non-associational causal policy blocks', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.causalPolicy = 'CAUSAL_CLAIM' as typeof draft.causalPolicy;
  });
  const gate = evaluateSafetyGate(mutated, []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
});

test('a non-counterfactual alternative blocks', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.alternatives[0] as {counterfactualOnly?: boolean})
      .counterfactualOnly = false;
  });
  const gate = evaluateSafetyGate(mutated, []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /counterfactualOnly/);
});

test('a non-historical outcome distribution blocks', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.alternatives[0].profile.outcomeDistribution as
      {historicalOnly?: boolean}).historicalOnly = false;
  });
  const gate = evaluateSafetyGate(mutated, []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /historical/);
});

test('certainty claims in the narrative would block', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.explanation.summary =
      'This strategy will profit on both venues with certainty.';
  });
  const gate = evaluateSafetyGate(mutated, []);
  assert.equal(gate.state, 'BLOCK_UNSAFE');
  assert.match(gate.reasons.join(' '), /certainty claims/);
});

test('the gate result is immutable', () => {
  const gate = evaluateSafetyGate(liqDominantDecisionResult(), []);
  assert.ok(Object.isFrozen(gate));
  assert.ok(Object.isFrozen(gate.checks));
});

test('the gate id is content-derived and deterministic', () => {
  const a = evaluateSafetyGate(liqDominantDecisionResult(), []);
  const b = evaluateSafetyGate(liqDominantDecisionResult(), []);
  assert.equal(a.safetyGateId, b.safetyGateId);
  assert.ok(a.safetyGateId.startsWith('gsfg_'));
});

test('FABRICATED_KEYS matches forbidden property names', () => {
  assert.ok(FABRICATED_KEYS.test('{"probability":0.5}'));
  assert.ok(FABRICATED_KEYS.test('{"expectedReturn":0.1}'));
  assert.ok(FABRICATED_KEYS.test('{"winRate":0.6}'));
  assert.ok(FABRICATED_KEYS.test('{"futurePrice":100}'));
  assert.ok(FABRICATED_KEYS.test('{"guaranteedProfit":1}'));
  assert.ok(FABRICATED_KEYS.test('{"roi":0.2}'));
  assert.ok(!FABRICATED_KEYS.test('{"theoreticalEdge":12}'));
  assert.ok(!FABRICATED_KEYS.test('{"realizationQuality":0.8}'));
});

test('CERTAINTY_CLAIMS matches forbidden narrative', () => {
  assert.ok(containsCertaintyClaim('guaranteed profit'));
  assert.ok(containsCertaintyClaim('this will win'));
  assert.ok(containsCertaintyClaim('risk-free return'));
  assert.ok(containsCertaintyClaim('this outcome is certain'));
  assert.ok(!containsCertaintyClaim('evidence supports this alternative'));
});

test('negated certainty statements are legitimate boundary language', () => {
  assert.ok(!containsCertaintyClaim('support is not certainty'));
  assert.ok(!containsCertaintyClaim('this is not a guarantee'));
  assert.ok(!containsCertaintyClaim('no certainty is implied'));
  assert.ok(containsCertaintyClaim('this is certain'));
});

test('PREDICTION_TERMS matches forbidden annotations', () => {
  assert.ok(PREDICTION_TERMS.test('probability is high'));
  assert.ok(PREDICTION_TERMS.test('forecast says up'));
  assert.ok(PREDICTION_TERMS.test('expected profit is 12'));
  assert.ok(!PREDICTION_TERMS.test('evidence review requested'));
});

test('EXECUTION_INSTRUCTIONS matches forbidden annotations', () => {
  assert.ok(EXECUTION_INSTRUCTIONS.test('execute the order'));
  assert.ok(EXECUTION_INSTRUCTIONS.test('buy now'));
  assert.ok(EXECUTION_INSTRUCTIONS.test('submit the order'));
  assert.ok(!EXECUTION_INSTRUCTIONS.test('execution quality was reviewed'));
});

test('narrativeOf excludes disclaimer fields', () => {
  const decision = liqDominantDecisionResult();
  const narrative = narrativeOf(decision);
  const disclaimers = disclaimerFieldsOf(decision);
  for (const disclaimer of disclaimers) {
    assert.ok(!narrative.includes(disclaimer));
  }
});

test('the narrative of a real decision result carries no certainty claims',
  () => {
    const narrative = narrativeOf(liqDominantDecisionResult()).join(' ');
    assert.ok(!containsCertaintyClaim(narrative));
  });
