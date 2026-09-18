import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanInputResult, cleanEvaluationResult, INPUT_CORPUS,
} from '../test-fixtures';
import {buildInputProvenance, verifyInputProvenance} from '../provenance';
import {inputProvenanceIdOf} from '../ids';
import {InputRejectionError} from '../types';

/**
 * SPRINT 043 — provenance (§11/§16): Opportunity → Decision →
 * Governance → StrategyIntent → StrategyIntentEvaluation →
 * PortfolioDecisionInput; no orphans, no substitution.
 */

test('provenance: the chain carries all ten identities', () => {
  const result = cleanInputResult();
  const provenance = result.provenance;
  for (const id of [provenance.opportunityId,
    provenance.decisionContextId, provenance.decisionId,
    provenance.governanceContextId, provenance.governanceId,
    provenance.handoffId, provenance.strategyInputId,
    provenance.intentId, provenance.evaluationId, provenance.inputId]) {
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  }
});

test('provenance: the chain binds the consumed evaluation', () => {
  const evaluation = cleanEvaluationResult();
  const provenance = cleanInputResult().provenance;
  assert.equal(provenance.evaluationId, evaluation.evaluationId);
  assert.equal(provenance.intentId, evaluation.intentId);
  assert.equal(provenance.decisionId,
    evaluation.evaluationContext.decisionId);
  assert.equal(provenance.governanceId,
    evaluation.evaluationContext.governanceId);
  assert.equal(provenance.opportunityId,
    evaluation.evaluationContext.opportunityId);
});

test('provenance: the bridge link is the input itself', () => {
  const result = cleanInputResult();
  assert.equal(result.provenance.inputId, result.inputId);
});

test('provenance: the provenance id is content-derived', () => {
  const result = cleanInputResult();
  const expected = inputProvenanceIdOf({
    opportunityId: result.provenance.opportunityId,
    decisionContextId: result.provenance.decisionContextId,
    decisionId: result.provenance.decisionId,
    governanceContextId: result.provenance.governanceContextId,
    governanceId: result.provenance.governanceId,
    handoffId: result.provenance.handoffId,
    strategyInputId: result.provenance.strategyInputId,
    intentId: result.provenance.intentId,
    evaluationId: result.provenance.evaluationId,
    inputId: result.provenance.inputId,
  });
  assert.equal(result.provenance.provenanceId, expected);
  assert.match(expected, /^pdprv_[0-9a-f]{24}$/);
});

test('provenance: every upstream engine version is pinned', () => {
  const versions = cleanInputResult().provenance.sourceVersions;
  assert.equal(versions.decisionIntelligenceVersion,
    'oship.decision-intelligence.engine.v1');
  assert.equal(versions.governanceVersion,
    'oship.decision-governance.engine.v1');
  assert.equal(versions.intentVersion, 'oship.strategy-intent.engine.v1');
  assert.equal(versions.evaluationVersion,
    'oship.strategy-intent-evaluation.engine.v1');
  assert.equal(versions.bridgeVersion,
    'oship.portfolio-decision-input.engine.v1');
});

test('provenance: the analysis and governance ids bind', () => {
  const versions = cleanInputResult().provenance.sourceVersions;
  const provenance = cleanInputResult().provenance;
  assert.equal(versions.decisionAnalysisId, provenance.decisionId);
  assert.equal(versions.governanceId, provenance.governanceId);
  assert.equal(versions.intentId, provenance.intentId);
  assert.equal(versions.evaluationId, provenance.evaluationId);
});

test('provenance: buildInputProvenance is deterministic', () => {
  const evaluation = cleanEvaluationResult();
  const first = buildInputProvenance(evaluation, 'pdi_fixed');
  const second = buildInputProvenance(evaluation, 'pdi_fixed');
  assert.equal(first.provenanceId, second.provenanceId);
});

test('provenance: different inputs produce different provenance ids',
  () => {
    const evaluation = cleanEvaluationResult();
    const first = buildInputProvenance(evaluation, 'pdi_one');
    const second = buildInputProvenance(evaluation, 'pdi_two');
    assert.notEqual(first.provenanceId, second.provenanceId);
  });

test('provenance: an empty input id rejects (no orphans)', () => {
  assert.throws(() => buildInputProvenance(cleanEvaluationResult(), ''),
    (error: unknown) => error instanceof InputRejectionError
      && error.code === 'MISSING_PROVENANCE');
});

test('provenance: verifyInputProvenance passes on real results', () => {
  const evaluation = cleanEvaluationResult();
  const verdict = verifyInputProvenance(cleanInputResult().provenance,
    evaluation);
  assert.equal(verdict.verified, true);
  assert.equal(verdict.reason, undefined);
});

test('provenance: verification detects evaluation substitution', () => {
  const provenance = cleanInputResult().provenance;
  const other = INPUT_CORPUS.find(([label]) =>
    label === 'clean-abl')![1]();
  const verdict = verifyInputProvenance(provenance, {
    ...other,
    evaluationId: 'eval_other',
  } as never);
  assert.equal(verdict.verified, false);
  assert.equal(verdict.reason, 'evaluation id substitution');
});

test('provenance: verification detects intent substitution', () => {
  const provenance = cleanInputResult().provenance;
  const evaluation = cleanEvaluationResult();
  const verdict = verifyInputProvenance(provenance, {
    ...evaluation, intentId: 'intent_other',
  } as never);
  assert.equal(verdict.verified, false);
  assert.equal(verdict.reason, 'intent id substitution');
});

test('provenance: verification detects context substitution', () => {
  const provenance = cleanInputResult().provenance;
  const evaluation = cleanEvaluationResult();
  const verdict = verifyInputProvenance(provenance, {
    ...evaluation,
    evaluationContext: {...evaluation.evaluationContext,
      decisionId: 'dec_other'},
  } as never);
  assert.equal(verdict.verified, false);
  assert.equal(verdict.reason, 'context id substitution');
});

test('provenance: verification detects an unpinned bridge version', () => {
  const result = cleanInputResult();
  const forged = {...result.provenance, sourceVersions: {
    ...result.provenance.sourceVersions,
    bridgeVersion: 'oship.foreign.v9',
  }} as never;
  const verdict = verifyInputProvenance(forged, cleanEvaluationResult());
  assert.equal(verdict.verified, false);
  assert.equal(verdict.reason, 'bridge version not pinned');
});

test('provenance: verification detects an unpinned evaluation version',
  () => {
    const result = cleanInputResult();
    const forged = {...result.provenance, sourceVersions: {
      ...result.provenance.sourceVersions,
      evaluationVersion: 'oship.foreign.v9',
    }} as never;
    const verdict = verifyInputProvenance(forged,
      cleanEvaluationResult());
    assert.equal(verdict.verified, false);
    assert.equal(verdict.reason, 'evaluation version not pinned');
  });

test('provenance: the provenance is informational and frozen', () => {
  const provenance = cleanInputResult().provenance;
  assert.equal(provenance.informational, true);
  assert.ok(Object.isFrozen(provenance));
});

test('provenance: every corpus result binds its own evaluation', () => {
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    assert.equal(result.provenance.inputId, result.inputId);
    assert.equal(result.provenance.evaluationId,
      result.evaluationId);
    assert.equal(result.provenance.intentId,
      result.inputContext.intentId);
  }
});
