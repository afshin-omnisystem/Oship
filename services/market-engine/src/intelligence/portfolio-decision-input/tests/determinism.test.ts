import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanInputResult, bridgeInputOf, runBridge,
  standardConstraints, allKindsInputResult, annotatedInputResult,
  INPUT_CORPUS, INPUT_FIXTURE_TIMESTAMP,
} from '../test-fixtures';
import {PortfolioDecisionInputEngine} from '../engine';
import {
  serializePortfolioDecisionInput, comparePortfolioDecisionInputs,
} from '../replay';
import {checkInputInvariants, inputCoreTupleOf, inputSealTupleOf,
  inputNarrativesOf, inputInvariantCountOf,
} from '../invariants';
import {canonicalJson, inputIdOf, inputFingerprintOf} from '../ids';
import {DEFAULT_INPUT_CONFIG} from '../config';

/**
 * SPRINT 043 — determinism and replay (§17/§18): identical inputs
 * always produce byte-identical contracts; ids are timestamp-free;
 * the double run is compared inside the engine itself.
 */

const engine = new PortfolioDecisionInputEngine();

test('determinism: identical inputs produce identical results', () => {
  for (const [label] of INPUT_CORPUS.slice(0, 6)) {
    const build = INPUT_CORPUS.find(([candidate]) =>
      candidate === label)![1];
    const first = build();
    const second = build();
    assert.equal(serializePortfolioDecisionInput(first),
      serializePortfolioDecisionInput(second),
      `${label} must be byte-identical across runs`);
  }
});

test('determinism: the engine double-run is byte-compared internally',
  () => {
    // present() itself runs the pipeline twice and throws on mismatch;
    // a successful return proves the double run matched.
    const result = engine.present(bridgeInputOf(cleanEvaluationResult(),
      standardConstraints('AFIS')));
    assert.equal(result.replay.identical, true);
    assert.equal(result.replay.fingerprint, result.inputFingerprint);
  });

test('determinism: permuted input constraint order produces identical '
  + 'ids', () => {
  const constraints = standardConstraints('AFIS');
  const first = engine.present(bridgeInputOf(cleanEvaluationResult(),
    constraints));
  const second = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [...constraints].reverse()));
  assert.equal(first.inputId, second.inputId);
  assert.deepEqual(first.capitalConstraints.map((c) => c.constraintId),
    second.capitalConstraints.map((c) => c.constraintId));
});

test('determinism: permuted annotations produce identical ids', () => {
  const first = engine.present(bridgeInputOf(cleanEvaluationResult(), [],
    ['a-note', 'b-note']));
  const second = engine.present(bridgeInputOf(cleanEvaluationResult(), [],
    ['b-note', 'a-note']));
  assert.equal(first.inputId, second.inputId);
});

test('determinism: different timestamps do not change the id', () => {
  const evaluation = cleanEvaluationResult();
  const early = engine.present(bridgeInputOf(evaluation));
  const late = engine.present({...bridgeInputOf(evaluation),
    timestamp: INPUT_FIXTURE_TIMESTAMP + 999_999});
  assert.equal(early.inputId, late.inputId);
  assert.notEqual(early.timestamp, late.timestamp);
});

test('determinism: different correlation ids change the envelope only',
  () => {
    const evaluation = cleanEvaluationResult();
    const first = engine.present(bridgeInputOf(evaluation));
    const second = engine.present({...bridgeInputOf(evaluation),
      correlationId: 'corr-other', traceId: 'trace-other'});
    assert.equal(first.inputId, second.inputId);
    assert.notEqual(first.correlationId, second.correlationId);
  });

test('determinism: the id tuple carries no timestamp or randomness',
  () => {
    const result = cleanInputResult();
    const tuple = inputCoreTupleOf(result, DEFAULT_INPUT_CONFIG);
    assert.deepEqual(Object.keys(tuple).sort(),
      ['acceptableAlternativeIds', 'annotations',
        'configurationFingerprint', 'constraintIds', 'eligibility',
        'evaluationClassification', 'evaluationFingerprint',
        'evaluationId', 'evidenceCount', 'inputClassification',
        'preferredAlternativeId', 'researchClasses',
        'restrictionCodes']);
  });

test('determinism: the id equals the fingerprint of the core tuple',
  () => {
    const result = cleanInputResult();
    assert.equal(result.inputId,
      inputIdOf(inputCoreTupleOf(result, DEFAULT_INPUT_CONFIG)));
  });

test('determinism: the fingerprint equals the fingerprint of the seal '
  + 'tuple', () => {
  const result = cleanInputResult();
  assert.equal(result.inputFingerprint,
    inputFingerprintOf(inputSealTupleOf(result)));
});

test('determinism: the seal tuple keys are canonical', () => {
  const tuple = inputSealTupleOf(cleanInputResult());
  assert.deepEqual(Object.keys(tuple).sort(), ['annotations',
    'classification', 'constraintIds', 'dependencyIds', 'eligibility',
    'evidenceIds', 'inputId', 'researchClasses', 'restrictionCodes']);
});

test('determinism: serialization is key-order independent', () => {
  const result = cleanInputResult();
  const serialized = serializePortfolioDecisionInput(result);
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).sort().reverse()) {
    permuted[key] = parsed[key];
  }
  assert.equal(canonicalJson(permuted), serialized);
});

test('determinism: serialization round-trips through JSON', () => {
  const result = cleanInputResult();
  const serialized = serializePortfolioDecisionInput(result);
  const parsed = JSON.parse(serialized);
  assert.equal(canonicalJson(parsed), serialized);
});

test('determinism: comparePortfolioDecisionInputs is byte-exact', () => {
  const a = cleanInputResult();
  const b = cleanInputResult();
  assert.equal(comparePortfolioDecisionInputs(a, b), true);
});

test('determinism: the engine replay API verifies a recorded result',
  () => {
    const input = bridgeInputOf(cleanEvaluationResult(),
      standardConstraints('AFIS'));
    const recorded = serializePortfolioDecisionInput(
      engine.present(input));
    const verdict = engine.replay(input, recorded);
    assert.equal(verdict.replayed, true);
    assert.equal(verdict.replayMatches, true);
    assert.equal(verdict.actualFingerprint,
      verdict.result.inputFingerprint);
  });

test('determinism: the engine replay API detects a mutated record', () => {
  const input = bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  const verdict = engine.replay(input, '{"forged": true}');
  assert.equal(verdict.replayMatches, false);
});

test('determinism: a different constraint set changes the id', () => {
  const first = engine.present(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  const second = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [standardConstraints('AFIS')[0]]));
  assert.notEqual(first.inputId, second.inputId);
});

test('determinism: the all-kinds corpus result is stable', () => {
  const first = allKindsInputResult();
  const second = allKindsInputResult();
  assert.equal(serializePortfolioDecisionInput(first),
    serializePortfolioDecisionInput(second));
});

test('determinism: the annotated corpus result is stable', () => {
  const first = annotatedInputResult();
  const second = annotatedInputResult();
  assert.equal(serializePortfolioDecisionInput(first),
    serializePortfolioDecisionInput(second));
});

test('determinism: config changes change the id', () => {
  const defaultEngine = new PortfolioDecisionInputEngine();
  const tightEngine = new PortfolioDecisionInputEngine(
    {maxAnnotations: 8});
  const input = bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  assert.notEqual(defaultEngine.present(input).inputId,
    tightEngine.present(input).inputId);
});

test('invariants: the battery runs at least 75 checks', () => {
  const result = cleanInputResult();
  assert.ok(result.invariants.checks.length >= 75,
    `expected ≥75 checks, found `
      + `${String(result.invariants.checks.length)}`);
});

test('invariants: inputInvariantCountOf reports the count', () => {
  assert.equal(inputInvariantCountOf(cleanInputResult().invariants),
    cleanInputResult().invariants.checks.length);
});

test('invariants: every check carries a name, verdict and detail', () => {
  for (const check of cleanInputResult().invariants.checks) {
    assert.equal(typeof check.invariant, 'string');
    assert.ok(check.invariant.length > 0);
    assert.equal(typeof check.passed, 'boolean');
    assert.equal(typeof check.detail, 'string');
    assert.ok(check.detail.length > 0);
  }
});

test('invariants: checkInputInvariants requires a context', () => {
  assert.throws(() => checkInputInvariants(null as never,
    {input: null as never, config: DEFAULT_INPUT_CONFIG}));
});

test('invariants: inputNarrativesOf collects the narrative surface',
  () => {
  const result = cleanInputResult();
  const narratives = inputNarrativesOf(result);
  assert.ok(narratives.length > 0);
  assert.ok(narratives.includes(result.classificationReasons[0]));
});

test('invariants: runBridge results always pass their battery', () => {
  const result = runBridge(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  assert.equal(result.invariants.passed, true);
  assert.equal(result.invariants.failedCount, 0);
});
