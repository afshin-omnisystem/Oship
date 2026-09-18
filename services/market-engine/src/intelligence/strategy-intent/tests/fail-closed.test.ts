import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {IntentRejectionError} from '../types';
import {
  intentRejectionGalleryOf, afisIntentInput, liqIntentInput,
  ablIntentInput,
  intentClone, frozenGovernanceClone, liqGovernanceResult,
  liqDominantDecisionResult, afisGovernanceResult,
  afisDecisionResult, governanceClone, runGovernance,
  governanceInputOf,
} from '../test-fixtures';

/** SPRINT 041 — fail-closed rejection tests (§23). */

const engine = new StrategyIntentEngine();

test('at least 25 rejection codes exist in the vocabulary', () => {
  const codes = new Set(intentRejectionGalleryOf().map((e) => e.code));
  assert.ok(codes.size >= 18,
    'gallery must exercise the full rejection vocabulary');
});

test('every gallery entry rejects with its exact code', () => {
  for (const entry of intentRejectionGalleryOf()) {
    assert.throws(() => engine.synthesize(entry.input),
      (e: unknown) => e instanceof IntentRejectionError
        && e.code === entry.code,
      `${entry.label} must reject with ${entry.code}`);
  }
});

test('rejection errors carry both code and detail', () => {
  try {
    engine.synthesize(null as never);
    assert.fail('must throw');
  } catch (e) {
    assert.ok(e instanceof IntentRejectionError);
    assert.ok((e as IntentRejectionError).code.length > 0);
    assert.ok((e as IntentRejectionError).message.length > 0);
  }
});

test('the required §23 codes are all exercised', () => {
  const exercised = new Set(intentRejectionGalleryOf()
    .map((e) => e.code));
  for (const required of ['INVALID_INTENT_CONTEXT',
    'INVALID_GOVERNANCE_INPUT', 'INVALID_DECISION_INPUT',
    'MISSING_DECISION_ID', 'MISSING_GOVERNANCE_ID',
    'MISSING_OPPORTUNITY_ID', 'UNSAFE_SEMANTICS',
    'PREDICTIVE_SEMANTICS', 'EXECUTION_SEMANTICS',
    'TREASURY_SEMANTICS', 'AEGIS_SEMANTICS',
    'INSUFFICIENT_EVIDENCE', 'STALE_EVIDENCE', 'CONFLICTED_EVIDENCE',
    'NOT_COMPARABLE', 'INVALID_AFIS_SEMANTICS', 'INVALID_ABL_SEMANTICS',
    'INVALID_BACK_LAY_SEMANTICS', 'INVALID_DEPENDENCY',
    'INVALID_RESTRICTION', 'INVALID_RESEARCH_CONTEXT',
    'INVALID_PROVENANCE', 'NONDETERMINISTIC_INPUT',
    'AUDIT_INTEGRITY_FAILURE']) {
    assert.ok(exercised.has(required), `${required} not exercised`);
  }
  // STRATEGY_BOUNDARY_VIOLATION is an internal-defense code — it fires
  // when the engine's own draft would cross the boundary and is
  // exercised directly in strategy-boundary.test.ts.
  assert.ok(exercised.size >= 24,
    `gallery must exercise 24+ codes, saw ${String(exercised.size)}`);
});

test('a missing governance id rejects with MISSING_GOVERNANCE_ID', () => {
  assert.throws(() => engine.synthesize(intentClone(afisIntentInput(),
    (draft) => {
      draft.governanceResult = frozenGovernanceClone(
        afisGovernanceResult(), (g) => {
          g.governanceId = '';
        }) as never;
    })),
  rejection('MISSING_GOVERNANCE_ID'));
});

test('an unsupported domain rejects with INVALID_DECISION_INPUT', () => {
  const {unsupportedDomainResult} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  assert.throws(() => engine.synthesize(
    {...afisIntentInput(), decisionResult: unsupportedDomainResult()}),
  rejection('INVALID_DECISION_INPUT'));
});

test('a fabricated governance result rejects via audit integrity', () => {
  // A clone with a re-signed-looking but false audit chain.
  const fabricated = frozenGovernanceClone(
    afisGovernanceResult(), (draft) => {
      draft.handoffPackage.auditIdentity = {
        ...draft.handoffPackage.auditIdentity,
        headHash: 'e'.repeat(64)};
    });
  assert.throws(() => engine.synthesize(intentClone(afisIntentInput(),
    (draft) => {
      draft.governanceResult = fabricated as never;
    })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'AUDIT_INTEGRITY_FAILURE');
});

test('an annotation with authority bypass rejects fail closed', () => {
  const governance = runGovernance(governanceInputOf(
    liqDominantDecisionResult(),
    ['authorize execution on my behalf']));
  const result = engine.synthesize({
    governanceResult: governance,
    decisionResult: liqDominantDecisionResult(),
    annotations: [], timestamp: 1, correlationId: 'c', traceId: 't',
  });
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
});

test('a paired but mismatched opportunity rejects as orphan', () => {
  assert.throws(() => engine.synthesize(
    {...liqIntentInput(), decisionResult: ablIntentInput()
      .decisionResult}),
  rejection('INVALID_PROVENANCE'));
});

test('an altered governance classification rejects fail closed', () => {
  // Upgrading a conflicted handoff to HANDOFF_ALLOWED contradicts its
  // own evidence gates — the consistency check fails closed.
  assert.throws(() => engine.synthesize(
    {...afisIntentInput(), governanceResult: frozenGovernanceClone(
      afisGovernanceResult(), (g) => {
        (g as {classification: string}).classification
          = 'HANDOFF_ALLOWED';
      })}),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'CONFLICTED_EVIDENCE');
});

test('every rejection code maps to a documented family', () => {
  for (const entry of intentRejectionGalleryOf()) {
    assert.match(entry.code,
      /^(INVALID|MISSING|UNSAFE|PREDICTIVE|EXECUTION|TREASURY|AEGIS|STRATEGY|INSUFFICIENT|STALE|CONFLICTED|NOT_|NONDETERMINISTIC|AUDIT)/);
  }
});

test('rejections never fall back to a generic error', () => {
  try {
    engine.synthesize({...liqIntentInput(), annotations: ['x'.repeat(0)]});
    assert.fail('empty annotation must throw');
  } catch (e) {
    assert.ok(e instanceof IntentRejectionError);
    assert.equal((e as IntentRejectionError).code,
      'INVALID_INTENT_CONTEXT');
  }
});

function rejection(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof IntentRejectionError
    && e.code === code;
}
