import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanAblEvaluationResult, blockedEvaluationResult,
  bridgeInputOf, runBridge, cleanInputResult, standardConstraints,
  knownExposureConstraint, INPUT_FIXTURE_TIMESTAMP, INPUT_CORRELATION_ID,
  INPUT_TRACE_ID, domainOf, assertInputRejects, frozenEvaluationClone,
  tamperedEvaluationClone, unconstrainedInputResult, annotatedInputResult,
} from '../test-fixtures';
import {PortfolioDecisionInputEngine} from '../engine';
import {
  DECISION_INPUT_DISCLAIMER, INPUT_CLASSIFICATIONS,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES, PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
} from '../types';
import {mergeInputConfig, DEFAULT_INPUT_CONFIG} from '../config';
import {serializePortfolioDecisionInput} from '../replay';

/**
 * SPRINT 043 — core engine behavior: presentation, envelope echo,
 * structure, configuration surface.
 */

const engine = new PortfolioDecisionInputEngine();

test('core: a governed evaluation is presented as a decision input', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.equal(result.schemaVersion, 'oship.portfolio-decision-input.v1');
  assert.ok(result.inputId.startsWith('pdi_'));
  assert.equal(result.informational, true);
  assert.equal(result.noDecisionAuthority, true);
  assert.equal(result.disclaimer, DECISION_INPUT_DISCLAIMER);
});

test('core: the input id is a 24-hex content fingerprint', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.match(result.inputId, /^pdi_[0-9a-f]{24}$/);
  assert.match(result.inputFingerprint, /^pdfp_[0-9a-f]{24}$/);
  assert.match(result.inputContext.contextId, /^pdctx_[0-9a-f]{24}$/);
});

test('core: envelope fields echo the request exactly', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.equal(result.timestamp, INPUT_FIXTURE_TIMESTAMP);
  assert.equal(result.correlationId, INPUT_CORRELATION_ID);
  assert.equal(result.traceId, INPUT_TRACE_ID);
});

test('core: the consumed evaluation identity is echoed', () => {
  const evaluation = cleanEvaluationResult();
  const result = engine.present(bridgeInputOf(evaluation));
  assert.equal(result.evaluationId, evaluation.evaluationId);
  assert.equal(result.evaluationFingerprint,
    evaluation.evaluationFingerprint);
  assert.equal(result.evaluationClassification,
    evaluation.classification);
  assert.equal(result.inputContext.evaluationId, evaluation.evaluationId);
  assert.equal(result.inputContext.intentId, evaluation.intentId);
  assert.equal(result.inputContext.governanceId,
    evaluation.evaluationContext.governanceId);
  assert.equal(result.inputContext.decisionId,
    evaluation.evaluationContext.decisionId);
  assert.equal(result.inputContext.opportunityId,
    evaluation.evaluationContext.opportunityId);
});

test('core: the input context echoes the governed evidence states', () => {
  const evaluation = cleanEvaluationResult();
  const result = engine.present(bridgeInputOf(evaluation));
  assert.equal(result.inputContext.evidenceState,
    evaluation.evaluationContext.evidenceState);
  assert.equal(result.inputContext.stabilityState,
    evaluation.evaluationContext.stabilityState);
  assert.equal(result.inputContext.freshnessState,
    evaluation.evaluationContext.freshnessState);
  assert.equal(result.inputContext.comparability,
    evaluation.evaluationContext.comparability);
  assert.equal(result.inputContext.dependencyState,
    evaluation.evaluationContext.dependencyState);
  assert.equal(result.inputContext.historicalEvidenceCount,
    evaluation.evaluationContext.historicalEvidenceCount);
  assert.equal(result.inputContext.researchGapCount,
    evaluation.evaluationContext.researchGapCount);
  assert.equal(result.inputContext.unresolvedConflictCount,
    evaluation.evaluationContext.unresolvedConflictCount);
});

test('core: evaluation restriction codes are echoed in the context', () => {
  const evaluation = cleanEvaluationResult();
  const result = engine.present(bridgeInputOf(evaluation));
  assert.deepEqual([...result.inputContext.evaluationRestrictionCodes],
    evaluation.restrictions.map((restriction) => restriction.code));
});

test('core: every evaluation restriction is carried with its id', () => {
  const evaluation = cleanEvaluationResult();
  const result = engine.present(bridgeInputOf(evaluation));
  for (const restriction of evaluation.restrictions) {
    const carried = result.restrictions.find((candidate) =>
      candidate.code === restriction.code);
    assert.ok(carried !== undefined,
      `restriction ${restriction.code} must survive transport`);
    assert.equal(carried.source, 'EVALUATION_CARRIED');
    assert.equal(carried.reason, restriction.reason);
    assert.equal(carried.restrictionId, restriction.restrictionId);
    assert.equal(carried.scope, restriction.scope);
  }
});

test('core: the bridge declares NO_DECISION_AUTHORITY on every input',
  () => {
    for (const build of [cleanInputResult, () => runBridge(
      bridgeInputOf(blockedEvaluationResult()))]) {
      const result = build();
      const declaration = result.restrictions.find((restriction) =>
        restriction.code === 'NO_DECISION_AUTHORITY');
      assert.ok(declaration !== undefined);
      assert.equal(declaration.source, 'BRIDGE');
      assert.equal(declaration.scope, 'BRIDGE');
    }
  });

test('core: classification and eligibility are always in vocabulary', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.ok(INPUT_CLASSIFICATIONS.includes(result.classification));
  assert.ok(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.includes(
    result.downstreamEligibility));
});

test('core: the result is deeply frozen', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.restrictions));
  assert.ok(Object.isFrozen(result.evidence));
  assert.ok(Object.isFrozen(result.capitalConstraints));
  assert.ok(Object.isFrozen(result.auditEvents));
  assert.ok(Object.isFrozen(result.inputContext));
  assert.ok(Object.isFrozen(result.provenance));
  assert.ok(Object.isFrozen(result.boundary));
  assert.ok(Object.isFrozen(result.explanation));
});

test('core: annotations are sorted deterministically', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult(), [],
    ['zeta note', 'alpha note', 'mid note']));
  assert.deepEqual([...result.annotations],
    ['alpha note', 'mid note', 'zeta note']);
});

test('core: empty annotations are accepted', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.deepEqual([...result.annotations], []);
});

test('core: requester annotations survive into the contract', () => {
  const result = annotatedInputResult();
  assert.ok(result.annotations.includes('historical review only'));
});

test('core: a clean evaluation classifies INPUT_READY', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  assert.equal(result.classification, 'INPUT_READY');
  assert.equal(result.downstreamEligibility,
    'READY_FOR_DOWNSTREAM_CONSIDERATION');
});

test('core: alternatives surface under an eligible evaluation', () => {
  const evaluation = cleanEvaluationResult();
  const result = engine.present(bridgeInputOf(evaluation));
  assert.equal(result.preferredAlternativeId,
    evaluation.preferredAlternativeId);
  assert.deepEqual([...result.acceptableAlternativeIds],
    [...evaluation.acceptableAlternativeIds]);
  assert.equal(result.alternativeReferences.length,
    evaluation.acceptableAlternativeIds.length);
  const preferred = result.alternativeReferences.find((reference) =>
    reference.role === 'PREFERRED');
  assert.ok(preferred !== undefined);
  assert.equal(preferred.alternativeId, evaluation.preferredAlternativeId);
});

test('core: an input without constraints is legal', () => {
  const result = unconstrainedInputResult();
  assert.deepEqual([...result.capitalConstraints], []);
  assert.equal(result.classification, 'INPUT_READY');
});

test('core: standard constraints transport as KNOWN records', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  assert.equal(result.capitalConstraints.length, 3);
  for (const record of result.capitalConstraints) {
    assert.equal(record.status, 'KNOWN');
    assert.equal(record.suppliedStatus, 'KNOWN');
    assert.equal(record.provenance.suppliedByExistingAuthority, true);
  }
});

test('core: the domain helper reads the evaluation domain', () => {
  assert.equal(domainOf(cleanEvaluationResult()), 'AFIS');
  assert.equal(domainOf(cleanAblEvaluationResult()), 'ABL');
});

test('core: the engine exposes its configuration fingerprint', () => {
  assert.equal(engine.configurationFingerprint,
    new PortfolioDecisionInputEngine().configurationFingerprint);
  assert.deepEqual(engine.configuration, DEFAULT_INPUT_CONFIG);
});

test('core: mergeInputConfig(null) returns the defaults (no throw)', () => {
  const merged = mergeInputConfig(null as never);
  assert.deepEqual(merged, DEFAULT_INPUT_CONFIG);
});

test('core: mergeInputConfig(undefined) returns the defaults', () => {
  assert.deepEqual(mergeInputConfig(undefined), DEFAULT_INPUT_CONFIG);
});

test('core: mergeInputConfig applies partial overrides', () => {
  const merged = mergeInputConfig({maxAnnotations: 8});
  assert.equal(merged.maxAnnotations, 8);
  assert.equal(merged.maxCapitalConstraints,
    DEFAULT_INPUT_CONFIG.maxCapitalConstraints);
  assert.equal(merged.schemaVersion, 'portfolio-decision-input.config.v1');
});

test('core: the engine version is pinned', () => {
  assert.equal(PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
    'oship.portfolio-decision-input.engine.v1');
});

test('core: serialization is canonical JSON', () => {
  const result = engine.present(bridgeInputOf(cleanEvaluationResult()));
  const serialized = serializePortfolioDecisionInput(result);
  assert.equal(JSON.parse(serialized).inputId, result.inputId);
  assert.ok(!serialized.includes('undefined'));
});

test('core: domain-scoped constraints must match the input domain', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('ABL')])));
});

test('core: BOTH-domain constraints apply to every input domain', () => {
  const afis = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [knownExposureConstraint('BOTH')]));
  const abl = engine.present(bridgeInputOf(cleanAblEvaluationResult(),
    [knownExposureConstraint('BOTH')]));
  assert.equal(afis.capitalConstraints.length, 1);
  assert.equal(abl.capitalConstraints.length, 1);
});

test('core: a mutated evaluation is rejected at the source check', () => {
  const forged = tamperedEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.acceptableAlternativeIds = ['alt_forged'];
    });
  assertInputRejects('INVALID_EVALUATION', () =>
    engine.present(bridgeInputOf(forged)));
});

test('core: present is idempotent per identical input', () => {
  const input = bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  const first = engine.present(input);
  const second = engine.present(input);
  assert.equal(serializePortfolioDecisionInput(first),
    serializePortfolioDecisionInput(second));
});

test('core: input timestamps do not leak into ids', () => {
  const evaluation = cleanEvaluationResult();
  const early = engine.present(bridgeInputOf(evaluation, [], [],
  ));
  const lateInput = {
    ...bridgeInputOf(evaluation),
    timestamp: INPUT_FIXTURE_TIMESTAMP + 123_456,
  };
  const late = engine.present(lateInput);
  // Same content tuple → same input id despite different timestamps.
  assert.equal(early.inputId, late.inputId);
});
