import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEvaluationProvenance} from '../provenance';
import {
  cleanIntentResult, liqIntentResult, cleanEvaluationResult,
  restrictedEvaluationResult, conflictedEvaluationResult,
  evaluationInputOf, frozenIntentClone,
} from '../test-fixtures';

import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError} from '../types';
import {evaluationProvenanceIdOf} from '../ids';

/** SPRINT 042 — provenance chain tests (§22 provenance, §18). */

const engine = new StrategyIntentEvaluationEngine();

test('provenance chains back to the opportunity', () => {
  const intent = cleanIntentResult();
  const provenance = buildEvaluationProvenance(intent,
    'eval_probe_provenance');
  assert.ok(provenance.opportunityId.length > 0);
  assert.ok(provenance.decisionContextId.length > 0);
  assert.ok(provenance.decisionId.length > 0);
  assert.ok(provenance.governanceContextId.length > 0);
  assert.ok(provenance.governanceId.length > 0);
  assert.ok(provenance.handoffId.length > 0);
  assert.ok(provenance.strategyInputId.length > 0);
  assert.ok(provenance.intentId.length > 0);
  assert.equal(provenance.evaluationId, 'eval_probe_provenance');
});

test('the provenance id is content-derived and deterministic', () => {
  const first = buildEvaluationProvenance(cleanIntentResult(),
    'eval_probe');
  const second = buildEvaluationProvenance(cleanIntentResult(),
    'eval_probe');
  assert.equal(first.provenanceId, second.provenanceId);
  assert.ok(first.provenanceId.startsWith('evprv_'));
  assert.equal(first.provenanceId, evaluationProvenanceIdOf({
    opportunityId: first.opportunityId,
    decisionContextId: first.decisionContextId,
    decisionId: first.decisionId,
    governanceContextId: first.governanceContextId,
    governanceId: first.governanceId,
    handoffId: first.handoffId,
    strategyInputId: first.strategyInputId,
    intentId: first.intentId,
    evaluationId: first.evaluationId,
    sourceVersions: first.sourceVersions,
    informational: true,
  }));
});

test('a different evaluation id yields a different provenance id', () => {
  const first = buildEvaluationProvenance(cleanIntentResult(),
    'eval_a');
  const second = buildEvaluationProvenance(cleanIntentResult(),
    'eval_b');
  assert.notEqual(first.provenanceId, second.provenanceId);
});

test('provenance pins every upstream engine version', () => {
  const provenance = buildEvaluationProvenance(cleanIntentResult(),
    'eval_probe');
  assert.equal(provenance.sourceVersions.decisionIntelligenceVersion,
    'oship.decision-intelligence.engine.v1');
  assert.equal(provenance.sourceVersions.governanceVersion,
    'oship.decision-governance.engine.v1');
  assert.equal(provenance.sourceVersions.intentVersion,
    'oship.strategy-intent.engine.v1');
  assert.equal(provenance.sourceVersions.evaluationEngineVersion,
    'oship.strategy-intent-evaluation.engine.v1');
});

test('the result provenance matches its intent chain', () => {
  const intent = cleanIntentResult();
  const result = engine.evaluate(evaluationInputOf(intent));
  assert.equal(result.provenance.intentId, intent.intentId);
  assert.equal(result.provenance.decisionId, intent.context.decisionId);
  assert.equal(result.provenance.governanceId,
    intent.context.governanceId);
  assert.equal(result.provenance.opportunityId,
    intent.context.opportunityId);
  assert.equal(result.provenance.evaluationId, result.evaluationId);
});

test('the result provenance is frozen', () => {
  assert.ok(Object.isFrozen(cleanEvaluationResult().provenance));
});

test('every corpus result carries complete provenance', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult()]) {
    assert.equal(result.provenance.evaluationId, result.evaluationId);
    assert.ok(result.provenance.provenanceId.startsWith('evprv_'));
  }
});

test('an intent without provenance rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft.intent as {provenance: unknown}).provenance = null;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_PROVENANCE');
});

test('an intent with a blank provenance id rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.handoffId = '';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_PROVENANCE');
});

test('a provenance intent-id mismatch rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.intentId = 'sint_foreign';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_PROVENANCE');
});

test('a provenance decision-id mismatch rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.decisionId = 'dia_foreign';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_PROVENANCE');
});

test('a provenance governance-id mismatch rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.governanceId = 'gov_foreign';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_PROVENANCE');
});

test('a foreign engine version rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.sourceVersions.intentVersion
      = 'oship.evil.v1';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError);
});

test('no evaluation is anonymous — provenance is mandatory', () => {
  const result = cleanEvaluationResult();
  for (const key of ['opportunityId', 'decisionId', 'governanceId',
    'handoffId', 'strategyInputId', 'intentId', 'evaluationId']) {
    const value = (result.provenance as unknown as Record<string,
      string>)[key];
    assert.ok(typeof value === 'string' && value.length > 0, key);
  }
});

test('provenance differentiates corpus decisions', () => {
  const clean = cleanEvaluationResult();
  const conflicted = conflictedEvaluationResult();
  assert.notEqual(clean.provenance.decisionId,
    conflicted.provenance.decisionId);
});

test('the provenance carries the informational flag', () => {
  assert.equal(
    buildEvaluationProvenance(liqIntentResult(), 'eval_probe')
      .informational, true);
});
