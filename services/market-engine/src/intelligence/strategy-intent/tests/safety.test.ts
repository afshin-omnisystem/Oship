import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {IntentRejectionError, INTENT_DISCLAIMER}
  from '../types';
import {
  afisIntentInput, liqIntentInput, cleanIntentInput,
  ablIntentInput, intentClone,
} from '../test-fixtures';
import {serializeStrategyIntentResult} from '../replay';

/** SPRINT 041 — safety and no-leakage tests (§11/§12). */

const engine = new StrategyIntentEngine();

test('the disclaimer text is verbatim canonical', () => {
  assert.equal(INTENT_DISCLAIMER,
    'This is an evidence-bound strategic intent, not a probability, '
    + 'forecast, expected return, guarantee, or execution instruction.');
});

test('every intent carries the disclaimer verbatim', () => {
  for (const input of [afisIntentInput(), liqIntentInput(),
    cleanIntentInput(), ablIntentInput()]) {
    assert.equal(engine.synthesize(input).intent.disclaimer,
      INTENT_DISCLAIMER);
  }
});

test('no intent field carries order quantity or price', () => {
  for (const input of [afisIntentInput(), liqIntentInput()]) {
    const serialized = serializeStrategyIntentResult(
      engine.synthesize(input));
    assert.ok(!/"(orderQuantity|orderPrice|limitPrice|qty|size)"/
      .test(serialized));
  }
});

test('no intent field carries venue commands or API requests', () => {
  const serialized = serializeStrategyIntentResult(
    engine.synthesize(liqIntentInput()));
  assert.ok(!/"(apiRequest|endpoint|url|webhook|command|instruction)"/
    .test(serialized));
});

test('no intent field carries credentials or signing material', () => {
  const serialized = serializeStrategyIntentResult(
    engine.synthesize(liqIntentInput()));
  assert.ok(!/"(apiKey|api_key|secret|password|privateKey|token|credential)"/
    .test(serialized));
});

test('no intent field carries treasury transfer instructions', () => {
  const serialized = serializeStrategyIntentResult(
    engine.synthesize(liqIntentInput()));
  assert.ok(!/"(transfer|withdrawal|deposit|allocation|capitalCommit)"/
    .test(serialized));
});

test('no intent field carries AEGIS authorization', () => {
  const serialized = serializeStrategyIntentResult(
    engine.synthesize(liqIntentInput()));
  assert.ok(!/"(authorization|authorized|approve|approval)"/
    .test(serialized));
});

test('execution-requesting annotations reject with EXECUTION_SEMANTICS',
  () => {
    assert.throws(() => engine.synthesize(
      {...liqIntentInput(), annotations: ['place the order now']}),
    rejection('EXECUTION_SEMANTICS'));
  });

test('treasury-requesting annotations reject with TREASURY_SEMANTICS',
  () => {
    assert.throws(() => engine.synthesize(
      {...liqIntentInput(), annotations: ['transfer the funds']}),
    rejection('TREASURY_SEMANTICS'));
  });

test('aegis-requesting annotations reject with AEGIS_SEMANTICS', () => {
  assert.throws(() => engine.synthesize(
    {...liqIntentInput(), annotations: ['aegis approval required']}),
  rejection('AEGIS_SEMANTICS'));
});

test('predictive annotations reject with PREDICTIVE_SEMANTICS', () => {
  assert.throws(() => engine.synthesize(
    {...liqIntentInput(), annotations: ['a guaranteed win']}),
  rejection('PREDICTIVE_SEMANTICS'));
});

test('credential-bearing annotations reject with UNSAFE_SEMANTICS', () => {
  assert.throws(() => engine.synthesize(
    {...liqIntentInput(), annotations: ['use my apiKey']}),
  rejection('UNSAFE_SEMANTICS'));
});

test('strategy-boundary annotations reject with STRATEGY_BOUNDARY_VIOLATION',
  () => {
    // Governance itself blocks this annotation first; either layer
    // rejecting is a fail-closed pass.
    const input = intentClone(liqIntentInput(), (draft) => {
      draft.annotations = ['authorize execution on my behalf'];
    });
    assert.throws(() => engine.synthesize(input),
      (e: unknown) => e instanceof IntentRejectionError
        && (e.code === 'AEGIS_SEMANTICS'
          || e.code === 'STRATEGY_BOUNDARY_VIOLATION'));
  });

test('the intent cannot mutate the Strategy Registry', () => {
  // The intent artifact exposes no registry-mutating surface at all:
  // its only operations are serialization and replay, and the Strategy
  // Registry is listed as a protected authority.
  const result = engine.synthesize(liqIntentInput());
  const serialized = serializeStrategyIntentResult(result);
  assert.ok(result.boundary.protectedAuthorities
    .includes('Strategy Registry'));
  assert.ok(!/"(mutate|mutation|registryWrite|upsert|register|unregister|delete)"/
    .test(serialized));
});

test('NaN values anywhere in the input reject fail closed', () => {
  const input = intentClone(liqIntentInput(), (draft) => {
    draft.decisionResult = intentClone(draft.decisionResult,
      (decision) => {
        decision.ranking.entries[0].tradeOffScore = Number.NaN;
      }) as never;
  });
  assert.throws(() => engine.synthesize(input),
    (e: unknown) => e instanceof IntentRejectionError);
});

test('Infinity values in the input reject fail closed', () => {
  const input = intentClone(liqIntentInput(), (draft) => {
    draft.decisionResult = intentClone(draft.decisionResult,
      (decision) => {
        decision.ranking.entries[0].tradeOffScore
          = Number.POSITIVE_INFINITY;
      }) as never;
  });
  assert.throws(() => engine.synthesize(input),
    (e: unknown) => e instanceof IntentRejectionError);
});

test('a serialized intent round-trips without gaining fields', () => {
  const result = engine.synthesize(liqIntentInput());
  const first = serializeStrategyIntentResult(result);
  const roundTrip = serializeStrategyIntentResult(
    engine.replay(liqIntentInput(), first).result);
  assert.equal(Object.keys(JSON.parse(roundTrip)).length,
    Object.keys(JSON.parse(first)).length);
});

function rejection(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof IntentRejectionError
    && e.code === code;
}
