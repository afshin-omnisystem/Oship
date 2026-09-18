import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, bridgeInputOf, frozenEvaluationClone,
  tamperedEvaluationClone, assertInputRejects, INPUT_FIXTURE_TIMESTAMP,
  INPUT_CORRELATION_ID, INPUT_TRACE_ID,
} from '../test-fixtures';
import {validateInputEnvelope, validateEvaluationSource,
  validateEvaluationProvenance,
} from '../source-validation';
import {DEFAULT_INPUT_CONFIG} from '../config';
import {PortfolioDecisionInputEngine} from '../engine';

/** SPRINT 043 — source validation over the consumed evaluation (§6/§16). */

const engine = new PortfolioDecisionInputEngine();

test('source: a governed evaluation passes the source check', () => {
  const evaluation = cleanEvaluationResult();
  assert.doesNotThrow(() => validateEvaluationSource(evaluation));
  assert.doesNotThrow(() => validateEvaluationProvenance(evaluation));
});

test('source: the envelope validates a well-formed bridge input', () => {
  const envelope = validateInputEnvelope(
    bridgeInputOf(cleanEvaluationResult()), DEFAULT_INPUT_CONFIG);
  assert.deepEqual([...envelope.annotations], []);
  assert.equal(envelope.constraints.length, 0);
});

test('source: the envelope sorts annotations', () => {
  const envelope = validateInputEnvelope(
    bridgeInputOf(cleanEvaluationResult(), [], ['b', 'a']),
    DEFAULT_INPUT_CONFIG);
  assert.deepEqual([...envelope.annotations], ['a', 'b']);
});

test('source: envelope rejects a null input', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputEnvelope(null as never, DEFAULT_INPUT_CONFIG));
});

test('source: envelope rejects a missing evaluation result', () => {
  assertInputRejects('MISSING_EVALUATION', () =>
    validateInputEnvelope({} as never, DEFAULT_INPUT_CONFIG));
});

test('source: envelope rejects a non-object evaluation result', () => {
  assertInputRejects('MISSING_EVALUATION', () =>
    validateInputEnvelope({evaluationResult: 'evaluated',
      annotations: [], capitalConstraints: [], timestamp: 1,
      correlationId: 'c', traceId: 't'} as never,
    DEFAULT_INPUT_CONFIG));
});

test('source: envelope rejects non-string annotations', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputEnvelope({...bridgeInputOf(cleanEvaluationResult()),
      annotations: ['ok', '']} as never, DEFAULT_INPUT_CONFIG));
});

test('source: envelope rejects a non-finite timestamp', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputEnvelope({...bridgeInputOf(cleanEvaluationResult()),
      timestamp: Number.POSITIVE_INFINITY} as never,
    DEFAULT_INPUT_CONFIG));
});

test('source: source check rejects a foreign schema version', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.schemaVersion = 'oship.foreign.v9' as never;
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects an unfrozen evaluation', () => {
  const draft = JSON.parse(JSON.stringify(cleanEvaluationResult()));
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(draft));
});

test('source: source check rejects a missing evaluation id', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationId = '';
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects failed upstream invariants', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.invariants.passed = false;
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a violated upstream boundary', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.boundary.state = 'BOUNDARY_VIOLATED';
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a non-informational evaluation', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.informational = false as never;
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a fingerprint tamper', () => {
  const forged = tamperedEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.acceptableAlternativeIds = ['alt_forged'];
  });
  assertInputRejects('INVALID_EVALUATION', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a broken audit binding', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.classification = 'EVALUATION_BLOCKED';
  });
  assertInputRejects('EVALUATION_MISMATCH', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a foreign audit identity', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.auditIdentity.evaluationId = 'eval_foreign';
  });
  assertInputRejects('EVALUATION_MISMATCH', () =>
    validateEvaluationSource(forged));
});

test('source: source check rejects a non-replay-identical evaluation',
  () => {
    const forged = frozenEvaluationClone(cleanEvaluationResult(),
      (draft) => {
        draft.replay.identical = false;
      });
    assertInputRejects('NONDETERMINISTIC_INPUT', () =>
      validateEvaluationSource(forged));
  });

test('source: provenance check rejects a null provenance', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance = null as never;
  });
  assertInputRejects('MISSING_PROVENANCE', () =>
    validateEvaluationProvenance(forged));
});

test('source: provenance check rejects an empty opportunity id', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.opportunityId = '';
  });
  assertInputRejects('MISSING_PROVENANCE', () =>
    validateEvaluationProvenance(forged));
});

test('source: provenance check rejects evaluation substitution', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.evaluationId = 'eval_other';
  });
  assertInputRejects('PROVENANCE_SUBSTITUTION', () =>
    validateEvaluationProvenance(forged));
});

test('source: provenance check rejects intent substitution', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.intentId = 'intent_other';
  });
  assertInputRejects('PROVENANCE_SUBSTITUTION', () =>
    validateEvaluationProvenance(forged));
});

test('source: provenance check rejects a context mismatch', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.decisionId = 'dec_other';
  });
  assertInputRejects('INVALID_PROVENANCE', () =>
    validateEvaluationProvenance(forged));
});

test('source: provenance check rejects unpinned versions', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.sourceVersions.intentVersion = 'oship.foreign.v9';
  });
  assertInputRejects('INVALID_PROVENANCE', () =>
    validateEvaluationProvenance(forged));
});

test('source: engine-level source rejections match the unit checks', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.provenance.governanceId = 'gov_other';
  });
  assertInputRejects('INVALID_PROVENANCE', () =>
    engine.present(bridgeInputOf(forged)));
});

test('source: envelope constants are stable', () => {
  assert.equal(typeof INPUT_FIXTURE_TIMESTAMP, 'number');
  assert.equal(INPUT_CORRELATION_ID, 'corr-portfolio-decision-input');
  assert.equal(INPUT_TRACE_ID, 'trace-portfolio-decision-input');
});
