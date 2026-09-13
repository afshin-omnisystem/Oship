import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPortfolioInterfaceCompatibility, portfolioInterfaceGate,
  checkEvaluationBoundary, PROTECTED_DOWNSTREAM_AUTHORITIES,
  FORBIDDEN_EVALUATION_KEYS, EVALUATION_EXECUTION_VERBS,
} from '../portfolio-interface';
import {
  cleanIntentResult, cleanAblIntentResult, cleanEvaluationResult,
  restrictedEvaluationResult, evaluationInputOf, frozenIntentClone,
  evaluationClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError} from '../types';
import {serializeStrategyIntentEvaluationResult} from '../replay';

/** SPRINT 042 — authority and portfolio-boundary tests (§22 authority,
 * §6/§7.17). */

const engine = new StrategyIntentEvaluationEngine();

test('nine protected authorities are declared', () => {
  assert.equal(PROTECTED_DOWNSTREAM_AUTHORITIES.length, 9);
  for (const authority of PROTECTED_DOWNSTREAM_AUTHORITIES) {
    assert.ok(authority.length > 0);
  }
});

test('the protected authorities cover the decision plane', () => {
  assert.deepEqual([...PROTECTED_DOWNSTREAM_AUTHORITIES], [
    'Portfolio', 'Risk', 'Allocation', 'Strategy Registry', 'AEGIS',
    'Treasury', 'Execution', 'Research Plane', 'Learning/Feedback',
  ]);
});

test('the forbidden-key pattern exists and is anchored', () => {
  assert.ok(FORBIDDEN_EVALUATION_KEYS instanceof RegExp);
  assert.ok(FORBIDDEN_EVALUATION_KEYS.test('"orderType":"LIMIT"'));
  assert.ok(!FORBIDDEN_EVALUATION_KEYS.test('"classification":"X"'));
});

test('execution verbs are enumerated', () => {
  assert.ok(EVALUATION_EXECUTION_VERBS instanceof RegExp);
  assert.ok(EVALUATION_EXECUTION_VERBS.test('transfer funds'));
  assert.ok(EVALUATION_EXECUTION_VERBS.test('allocate capital'));
});

test('a clean intent is portfolio compatible', () => {
  const compatibility = checkPortfolioInterfaceCompatibility(
    cleanIntentResult());
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.normalizationRequired, false);
  assert.equal(compatibility.domain, 'AFIS');
  assert.ok(compatibility.alternativeCount > 0);
});

test('a clean ABL intent is portfolio compatible', () => {
  const compatibility = checkPortfolioInterfaceCompatibility(
    cleanAblIntentResult());
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.domain, 'ABL');
});

test('an unknown domain rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft.context.domain as string) = 'FOREX';
  });
  assert.throws(() => checkPortfolioInterfaceCompatibility(intent),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT');
});

test('an alternative without assessment identity rejects fail closed',
  () => {
    const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
      draft.alternatives[0].assessmentId = '';
    });
    assert.throws(() => checkPortfolioInterfaceCompatibility(intent),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'INVALID_INTENT');
  });

test('an ABL alternative without selection identity rejects fail closed',
  () => {
    const intent = frozenIntentClone(cleanAblIntentResult(),
      (draft) => {
        draft.alternatives[0].selectionId = null;
      });
    assert.throws(() => checkPortfolioInterfaceCompatibility(intent),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'INVALID_INTENT');
  });

test('the portfolio interface gate passes for a clean intent', () => {
  const gate = portfolioInterfaceGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS');
  assert.equal(gate.gate, 'portfolio-interface');
});

test('the evaluation boundary is respected on every corpus result', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
    assert.ok(result.boundary.checks.every((check) => check.passed));
    assert.equal(result.boundary.informational, true);
    assert.ok(result.boundary.boundaryId.startsWith('evbnd_'));
  }
});

test('the boundary enumerates its protected authorities', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.boundary.protectedAuthorities.length >= 9);
});

test('a serialized evaluation carries no forbidden keys', () => {
  const serialized = serializeStrategyIntentEvaluationResult(
    cleanEvaluationResult());
  assert.ok(!FORBIDDEN_EVALUATION_KEYS.test(serialized));
});

test('a serialized evaluation carries no order semantics', () => {
  const serialized = serializeStrategyIntentEvaluationResult(
    cleanEvaluationResult());
  assert.ok(!/"order"/.test(serialized));
  assert.ok(!/"quantity"/.test(serialized));
  assert.ok(!/"apiKey"/.test(serialized));
});

test('the boundary check rejects a forged order key', () => {
  assert.throws(() => checkEvaluationBoundary({
    serializedEvaluation: '{"orderType":"LIMIT"}',
    narrative: [], informational: true, downstreamDecides: true,
    evaluationId: 'eval_probe',
  }), (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('the boundary check rejects a forged credential key', () => {
  assert.throws(() => checkEvaluationBoundary({
    serializedEvaluation: '{"apiKey":"abc"}',
    narrative: [], informational: true, downstreamDecides: true,
    evaluationId: 'eval_probe',
  }), (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('the boundary check rejects execution narratives', () => {
  assert.throws(() => checkEvaluationBoundary({
    serializedEvaluation: '{}',
    narrative: ['place the order now'], informational: true,
    downstreamDecides: true, evaluationId: 'eval_probe',
  }), (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('the boundary check rejects non-informational evaluations', () => {
  assert.throws(() => checkEvaluationBoundary({
    serializedEvaluation: '{}', narrative: [],
    informational: false, downstreamDecides: true,
    evaluationId: 'eval_probe',
  }), (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('the boundary check rejects downstream-decides violations', () => {
  assert.throws(() => checkEvaluationBoundary({
    serializedEvaluation: '{}', narrative: [], informational: true,
    downstreamDecides: false, evaluationId: 'eval_probe',
  }), (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('a clean boundary verdict passes with its checks', () => {
  const verdict = checkEvaluationBoundary({
    serializedEvaluation: '{"classification":"EVALUATION_ALLOWED"}',
    narrative: ['the evaluation is informational only'],
    informational: true, downstreamDecides: true,
    evaluationId: 'eval_probe',
  });
  assert.equal(verdict.state, 'BOUNDARY_RESPECTED');
  assert.ok(verdict.checks.length >= 4);
});

test('the engine never mutates the consumed intent', () => {
  const intent = cleanIntentResult();
  const before = JSON.stringify(intent);
  engine.evaluate(evaluationInputOf(intent));
  assert.equal(JSON.stringify(intent), before);
});

test('evaluation results never contain allocation payloads', () => {
  const serialized = serializeStrategyIntentEvaluationResult(
    cleanEvaluationResult());
  assert.ok(!/"allocationWeight"/.test(serialized));
  assert.ok(!/"positionSize"/.test(serialized));
  assert.ok(!/"reserveAmount"/.test(serialized));
  assert.ok(!/"riskLimit"/.test(serialized));
});

test('an authority-claiming annotation rejects through the engine', () => {
  assert.throws(() => engine.evaluate(evaluationInputOf(
    cleanIntentResult(), ['approve the trade for today'])),
  (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'AUTHORITY_VIOLATION');
});

test('the evaluation claims no authority of its own', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    assert.equal(result.downstreamDecides, true);
    assert.equal(result.informational, true);
    for (const line of result.eligibilityReasons) {
      assert.ok(!/\bthe evaluation approves\b/.test(line));
    }
  }
});

test('the evaluation result binds its boundary identity', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.boundary.boundaryId.startsWith('evbnd_'));
  assert.ok(Object.isFrozen(result.boundary));
  assert.ok(result.boundary.checks.every((check) =>
    Object.isFrozen(check)));
});

test('a mutated boundary result is detectable downstream', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.boundary.state = 'BOUNDARY_VIOLATED';
  });
  assert.equal(forged.boundary.state, 'BOUNDARY_VIOLATED');
  assert.equal(cleanEvaluationResult().boundary.state,
    'BOUNDARY_RESPECTED');
});
