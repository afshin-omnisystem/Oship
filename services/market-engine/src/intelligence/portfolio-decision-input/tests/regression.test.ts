import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanEvaluationResult, cleanInputResult, INPUT_CORPUS,
  cleanAblInputResult,
} from '../test-fixtures';
import {EVALUATION_TO_INPUT_CORPUS} from './coverage-corpus';
import {PortfolioDecisionInputEngine} from '../engine';
import {serializePortfolioDecisionInput} from '../replay';
import {EVALUATION_TO_INPUT_CLASSIFICATION,
  INPUT_CLASSIFICATIONS, DECISION_INPUT_DISCLAIMER,
  PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
} from '../types';
import {verifyStrategyIntentEvaluationAudit}
  from '../../strategy-intent-evaluation/audit';
import type {SuppliedCapitalConstraint} from '../types';
import {PROTECTED_INPUT_AUTHORITIES} from '../portfolio-interface';

/**
 * SPRINT 043 — regression gates (§26): prior sprint integrity stays
 * intact, the corpus is complete, and the bridge contract is stable.
 */

test('regression: the Sprint 042 engine still produces verifiable '
  + 'evaluations', () => {
  const evaluation = cleanEvaluationResult();
  assert.equal(evaluation.schemaVersion,
    'oship.strategy-intent-evaluation.v1');
  const verdict = verifyStrategyIntentEvaluationAudit(
    evaluation.auditEvents, evaluation.auditEvents.length);
  assert.equal(verdict.valid, true);
});

test('regression: the bridge consumes Sprint 042 results unmodified',
  () => {
  const evaluation = cleanEvaluationResult();
  const before = JSON.stringify({
    evaluationId: evaluation.evaluationId,
    classification: evaluation.classification,
    restrictions: evaluation.restrictions.length,
  });
  cleanInputResult();
  const after = JSON.stringify({
    evaluationId: evaluation.evaluationId,
    classification: evaluation.classification,
    restrictions: evaluation.restrictions.length,
  });
  assert.equal(before, after);
});

test('regression: the engine version and schema are pinned', () => {
  assert.equal(PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
    'oship.portfolio-decision-input.engine.v1');
  assert.equal(PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    'oship.portfolio-decision-input.v1');
});

test('regression: the disclaimer is stable verbatim text', () => {
  assert.equal(DECISION_INPUT_DISCLAIMER,
    'This is an evidence-bound portfolio decision input contract, not '
    + 'an allocation decision, not a probability, forecast, expected '
    + 'return, guarantee, execution instruction, or capital '
    + 'authorization.');
});

test('regression: the frozen evaluation→input map is unchanged', () => {
  // The exact thirteen-entry mapping frozen in §7.
  assert.deepEqual(EVALUATION_TO_INPUT_CLASSIFICATION.map(([from, to]) =>
    `${from}->${to}`), [
    'EVALUATION_ALLOWED->INPUT_READY',
    'EVALUATION_ALLOWED_WITH_LIMITATIONS->INPUT_READY_WITH_LIMITATIONS',
    'EVALUATION_REQUIRES_RESEARCH->INPUT_REQUIRES_RESEARCH',
    'EVALUATION_BLOCKED->INPUT_BLOCKED',
    'EVALUATION_INSUFFICIENT_EVIDENCE->INPUT_INSUFFICIENT_EVIDENCE',
    'EVALUATION_NOT_COMPARABLE->INPUT_NOT_COMPARABLE',
    'EVALUATION_CONFLICTED->INPUT_CONFLICTED',
    'EVALUATION_STALE->INPUT_STALE',
    'EVALUATION_UNSTABLE->INPUT_UNSTABLE',
    'EVALUATION_STRATEGY_DEPENDENT->INPUT_STRATEGY_DEPENDENT',
    'EVALUATION_VENUE_DEPENDENT->INPUT_VENUE_DEPENDENT',
    'EVALUATION_REGIME_DEPENDENT->INPUT_REGIME_DEPENDENT',
    'EVALUATION_MIXED->INPUT_MIXED']);
});

test('regression: the protected authority list is unchanged', () => {
  assert.deepEqual([...PROTECTED_INPUT_AUTHORITIES], ['Portfolio',
    'Risk', 'Allocation', 'Strategy', 'AEGIS', 'Treasury', 'Execution',
    'Research Plane', 'Learning/Feedback']);
});

test('regression: all thirteen classifications remain in vocabulary',
  () => {
    assert.equal(INPUT_CLASSIFICATIONS.length, 13);
  });

test('regression: the corpus still covers both domains and all '
  + 'classifications', () => {
  const classifications = new Set<string>();
  const domains = new Set<string>();
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    classifications.add(result.classification);
    domains.add(result.inputContext.domain);
  }
  assert.equal(classifications.size, 13);
  assert.deepEqual([...domains].sort(), ['ABL', 'AFIS']);
});

test('regression: memoized corpus results are stable references', () => {
  assert.equal(cleanInputResult(), cleanInputResult());
  assert.equal(cleanAblInputResult(), cleanAblInputResult());
});

test('regression: every corpus result passes every gate', () => {
  for (const [label, build] of INPUT_CORPUS) {
    const result = build();
    assert.equal(result.invariants.passed, true, `${label} invariants`);
    assert.equal(result.replay.identical, true, `${label} replay`);
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED',
      `${label} boundary`);
    assert.equal(result.auditIdentity.inputId, result.inputId,
      `${label} audit identity`);
  }
});

test('regression: serialized results always parse back', () => {
  for (const [, build] of INPUT_CORPUS) {
    const serialized = serializePortfolioDecisionInput(build());
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    assert.equal(parsed.informational, true);
    assert.equal(parsed.noDecisionAuthority, true);
    assert.equal(parsed.schemaVersion,
      'oship.portfolio-decision-input.v1');
  }
});

test('regression: a fresh engine reproduces the memoized results', () => {
  const engine = new PortfolioDecisionInputEngine();
  for (const [label, build] of INPUT_CORPUS.slice(0, 5)) {
    const memoized = build();
    const evaluation = memoizedEvaluationOf(label);
    const fresh = engine.present({
      evaluationResult: evaluation,
      capitalConstraints: memoizedCapitalSetOf(memoized),
      annotations: [...memoized.annotations],
      timestamp: memoized.timestamp,
      correlationId: memoized.correlationId,
      traceId: memoized.traceId,
    });
    assert.equal(serializePortfolioDecisionInput(fresh),
      serializePortfolioDecisionInput(memoized),
      `${label} must reproduce byte-identically`);
  }
});

function memoizedEvaluationOf(label: string) {
  return EVALUATION_TO_INPUT_CORPUS[label]() as ReturnType<
    typeof cleanEvaluationResult>;
}

function memoizedCapitalSetOf(result: ReturnType<typeof cleanInputResult>) {
  return result.capitalConstraints.map((record) => ({
    constraintKind: record.constraintKind,
    sourceAuthority: record.sourceAuthority,
    domain: record.domain,
    scope: record.scope,
    value: record.value,
    unit: record.unit,
    status: record.suppliedStatus,
    contextTimestamp: record.provenance.contextTimestamp,
    reason: record.reason.split(' — ')[0],
  }));
}

test('regression: the bridge never mutates its input array references',
  () => {
  const evaluation = cleanEvaluationResult();
  const constraints: SuppliedCapitalConstraint[] = [];
  const annotations = ['a'];
  const input = {
    evaluationResult: evaluation,
    capitalConstraints: constraints,
    annotations,
    timestamp: evaluation.timestamp + 1,
    correlationId: 'c',
    traceId: 't',
  };
  new PortfolioDecisionInputEngine().present(input);
  assert.equal(constraints.length, 0);
  assert.deepEqual(annotations, ['a']);
});

test('regression: the corpus count is exactly 23 fixtures', () => {
  assert.equal(INPUT_CORPUS.length, 23);
});
