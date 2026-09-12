import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIntentEnvelope, scanIntentAnnotations, validateGovernanceSource,
  validateDecisionSource, validateDecisionSemantics, containsNonFinite,
  INTENT_AEGIS_TERMS, INTENT_TREASURY_TERMS, INTENT_EXECUTION_TERMS,
  INTENT_PREDICTIVE_TERMS, INTENT_UNSAFE_TERMS, FABRICATED_INTENT_KEYS,
  INTENT_DOMAINS,
} from '../source-validation';
import {IntentRejectionError} from '../types';
import {DEFAULT_STRATEGY_INTENT_CONFIG} from '../config';
import {
  afisIntentInput, liqIntentInput, afisGovernanceResult,
  afisDecisionResult, liqGovernanceResult, liqDominantDecisionResult,
  intentClone, frozenGovernanceClone,
} from '../test-fixtures';

/** SPRINT 041 — fail-closed source-validation tests (§1/§23). */

test('a valid envelope passes with canonically sorted annotations', () => {
  const envelope = validateIntentEnvelope(
    {...afisIntentInput(), annotations: ['b-note', 'a-note']},
    DEFAULT_STRATEGY_INTENT_CONFIG);
  assert.deepEqual([...envelope.annotations], ['a-note', 'b-note']);
});

test('a null input rejects with INVALID_INTENT_CONTEXT', () => {
  assert.throws(() => validateIntentEnvelope(null as never,
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('a missing governance result rejects with INVALID_INTENT_CONTEXT',
  () => {
    assert.throws(() => validateIntentEnvelope(
      {...afisIntentInput(), governanceResult: null as never},
      DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
  });

test('a non-array annotation list rejects', () => {
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), annotations: 'note' as never},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('a non-string annotation rejects', () => {
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), annotations: [7] as never},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('too many annotations reject', () => {
  const many = Array.from({length: 17}, (_, i) => `note-${i}`);
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), annotations: many},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('a NaN timestamp rejects', () => {
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), timestamp: Number.NaN},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('an empty correlation id rejects', () => {
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), correlationId: ''},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('an empty trace id rejects', () => {
  assert.throws(() => validateIntentEnvelope(
    {...afisIntentInput(), traceId: ''},
    DEFAULT_STRATEGY_INTENT_CONFIG),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('probability annotations reject with PREDICTIVE_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['the probability of profit is 0.9']),
    rejection('PREDICTIVE_SEMANTICS'));
});

test('forecast annotations reject with PREDICTIVE_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['the forecast shows a rise']),
    rejection('PREDICTIVE_SEMANTICS'));
});

test('expected-return annotations reject', () => {
  assert.throws(() => scanIntentAnnotations(
    ['expected return is twelve percent']),
    rejection('PREDICTIVE_SEMANTICS'));
});

test('guarantee annotations reject', () => {
  assert.throws(() => scanIntentAnnotations(
    ['this is a guaranteed profit']),
    rejection('PREDICTIVE_SEMANTICS'));
});

test('execution annotations reject with EXECUTION_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(['execute now']),
    rejection('EXECUTION_SEMANTICS'));
});

test('order annotations reject with EXECUTION_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['place the order at venue-a']),
    rejection('EXECUTION_SEMANTICS'));
});

test('submission annotations reject with EXECUTION_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['submit the request to the exchange']),
    rejection('EXECUTION_SEMANTICS'));
});

test('treasury annotations reject with TREASURY_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['treasury should transfer the funds']),
    rejection('TREASURY_SEMANTICS'));
});

test('withdrawal annotations reject with TREASURY_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(['withdraw the funds']),
    rejection('TREASURY_SEMANTICS'));
});

test('aegis annotations reject with AEGIS_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['aegis approval is assumed']),
    rejection('AEGIS_SEMANTICS'));
});

test('authorization annotations reject with AEGIS_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['requesting authorization to proceed']),
    rejection('AEGIS_SEMANTICS'));
});

test('credential annotations reject with UNSAFE_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(['use the apiKey please']),
    rejection('UNSAFE_SEMANTICS'));
});

test('signing-material annotations reject with UNSAFE_SEMANTICS', () => {
  assert.throws(() => scanIntentAnnotations(
    ['sign it with the private key']),
    rejection('UNSAFE_SEMANTICS'));
});

test('clean annotations pass the scan', () => {
  assert.doesNotThrow(() => scanIntentAnnotations(
    ['requesting strategic intent synthesis for the governed decision']));
});

test('the semantic vocabularies are non-trivial', () => {
  assert.ok(INTENT_AEGIS_TERMS.test('authorize'));
  assert.ok(INTENT_TREASURY_TERMS.test('treasury'));
  assert.ok(INTENT_EXECUTION_TERMS.test('execute now'));
  assert.ok(INTENT_PREDICTIVE_TERMS.test('probability'));
  assert.ok(INTENT_UNSAFE_TERMS.test('credential'));
});

test('fabricated keys are detected as JSON property names', () => {
  assert.ok(FABRICATED_INTENT_KEYS.test('"probabilityOfSuccess":0.9'));
  assert.ok(FABRICATED_INTENT_KEYS.test('"expectedRoi":0.2'));
  assert.ok(!FABRICATED_INTENT_KEYS.test('"probabilityText":"x"'));
});

test('containsNonFinite finds NaN at any depth', () => {
  assert.equal(containsNonFinite({a: {b: [1, Number.NaN]}}), true);
  assert.equal(containsNonFinite({a: {b: [1, 2]}}, ), false);
  assert.equal(containsNonFinite(Number.POSITIVE_INFINITY), true);
  assert.equal(containsNonFinite('NaN'), false);
});

test('a valid governance result passes validation', () => {
  assert.doesNotThrow(() =>
    validateGovernanceSource(afisGovernanceResult()));
});

test('a governance result without an id rejects', () => {
  assert.throws(() => validateGovernanceSource(
    intentClone(afisGovernanceResult(), (draft) => {
      draft.governanceId = '';
    })),
  rejection('MISSING_GOVERNANCE_ID'));
});

test('an unfrozen governance result rejects', () => {
  assert.throws(() => validateGovernanceSource(
    intentClone(afisGovernanceResult())),
  rejection('INVALID_GOVERNANCE_INPUT'));
});

test('a tampered governance audit chain rejects', () => {
  assert.throws(() => validateGovernanceSource(
    frozenGovernanceClone(afisGovernanceResult(), (draft) => {
      draft.auditEvents[2].payload.injected = true;
    })),
  rejection('AUDIT_INTEGRITY_FAILURE'));
});

test('a valid decision result passes with its governance pair', () => {
  assert.doesNotThrow(() => validateDecisionSource(
    afisDecisionResult(), afisGovernanceResult()));
});

test('a decision without an analysis id rejects', () => {
  assert.throws(() => validateDecisionSource(
    intentClone(afisDecisionResult(), (draft) => {
      draft.analysisId = '';
    }), afisGovernanceResult()),
  rejection('MISSING_DECISION_ID'));
});

test('a decision without an opportunity identity rejects', () => {
  assert.throws(() => validateDecisionSource(
    intentClone(afisDecisionResult(), (draft) => {
      draft.context.baseCandidateId = '';
    }), afisGovernanceResult()),
  rejection('MISSING_OPPORTUNITY_ID'));
});

test('a decision from another governance run rejects as orphan', () => {
  assert.throws(() => validateDecisionSource(
    afisDecisionResult(), liqGovernanceResult()),
  rejection('INVALID_PROVENANCE'));
});

test('the intent domains are AFIS and ABL only', () => {
  assert.deepEqual([...INTENT_DOMAINS], ['AFIS', 'ABL']);
});

test('decision semantics validation passes the clean corpus', () => {
  assert.doesNotThrow(() =>
    validateDecisionSemantics(liqDominantDecisionResult()));
});

function rejection(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof IntentRejectionError
    && e.code === code;
}
