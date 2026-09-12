import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createIntentContext} from '../context';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, liqIntentInput,
  INTENT_CORRELATION_ID, INTENT_TRACE_ID, INTENT_FIXTURE_TIMESTAMP,
} from '../test-fixtures';
import {STRATEGY_INTENT_ENGINE_VERSION} from '../types';

/** SPRINT 041 — intent context tests. */

test('the context mirrors the governed decision identity', () => {
  const context = liqIntentResult().context;
  assert.ok(context.decisionId.startsWith('dia_'));
  assert.equal(context.governanceId,
    liqIntentResult().intent.provenance.governanceId);
  assert.equal(context.opportunityId, 'dec-afis-liq-base');
});

test('the context carries the domain and class', () => {
  assert.equal(liqIntentResult().context.domain, 'AFIS');
  assert.equal(liqIntentResult().context.opportunityClass,
    'liquidity-imbalance');
  assert.equal(ablIntentResult().context.opportunityClass, 'surebet');
});

test('the context mirrors the governance classification', () => {
  assert.equal(liqIntentResult().context.governanceClassification,
    'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.equal(afisIntentResult().context.governanceClassification,
    'HANDOFF_CONFLICTED');
  assert.equal(ablIntentResult().context.governanceClassification,
    'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('the context mirrors the recommendation status', () => {
  assert.equal(liqIntentResult().context.recommendationStatus,
    'PREFERRED_BY_EVIDENCE');
  assert.equal(afisIntentResult().context.recommendationStatus,
    'CONFLICTED');
  assert.equal(ablIntentResult().context.recommendationStatus,
    'INSUFFICIENT_EVIDENCE');
});

test('the context mirrors both recommendation identities', () => {
  const context = liqIntentResult().context;
  assert.equal(context.selectedAlternativeId, 'alt-venue-a');
  assert.equal(context.governanceRecommendedAlternativeId, 'alt-venue-a');
  assert.equal(afisIntentResult().context.selectedAlternativeId, null);
});

test('the context mirrors the evidence state', () => {
  assert.equal(liqIntentResult().context.evidenceState, 'WEAK');
});

test('the context mirrors the governed statuses', () => {
  const context = liqIntentResult().context;
  assert.equal(context.stabilityState, 'MODERATELY_STABLE');
  assert.equal(context.freshnessState, 'FRESH');
  assert.equal(context.sampleAdequacy, 'SUFFICIENT');
  assert.equal(context.comparability, 'COMPARABLE');
});

test('the context mirrors the dependency state', () => {
  assert.equal(liqIntentResult().context.dependencyState, 'INDEPENDENT');
  assert.equal(afisIntentResult().context.dependencyState,
    'MULTI_DEPENDENT');
});

test('the context carries historical evidence and research gaps', () => {
  const context = liqIntentResult().context;
  assert.ok(context.historicalEvidenceCount > 0);
  assert.equal(typeof context.researchGapCount, 'number');
});

test('the context mirrors unresolved conflicts', () => {
  assert.ok(afisIntentResult().context.unresolvedConflicts.length > 0);
  assert.equal(liqIntentResult().context.unresolvedConflicts.length, 0);
});

test('the context pins the intent engine version', () => {
  assert.equal(liqIntentResult().context.intentVersion,
    STRATEGY_INTENT_ENGINE_VERSION);
});

test('the context is informational only', () => {
  assert.equal(liqIntentResult().context.informational, true);
});

test('the context id is content-derived and prefixed', () => {
  const context = liqIntentResult().context;
  assert.ok(context.contextId.startsWith('sctx_'));
  assert.equal(context.contextId, liqIntentResult().context.contextId);
});

test('the context carries a content fingerprint', () => {
  assert.ok(liqIntentResult().context.contentFingerprint
    .startsWith('scfp_'));
});

test('the context is frozen', () => {
  const context = liqIntentResult().context;
  assert.ok(Object.isFrozen(context));
});

test('the context is deterministic across runs', () => {
  const a = createIntentContext(liqIntentInput(),
    liqIntentResult().intentId);
  const b = createIntentContext(liqIntentInput(),
    liqIntentResult().intentId);
  assert.deepEqual(a, b);
});

test('stale governance mirrors a stale freshness state', () => {
  assert.equal(staleIntentResult().context.freshnessState, 'STALE');
});

test('clean governance keeps comparability COMPARABLE', () => {
  assert.equal(cleanIntentResult().context.comparability, 'COMPARABLE');
});

test('the context domain differs between corpora', () => {
  assert.equal(liqIntentResult().context.domain, 'AFIS');
  assert.equal(ablIntentResult().context.domain, 'ABL');
});

test('the context is rebuilt identically from the same input', () => {
  const result = liqIntentResult();
  const rebuilt = createIntentContext(liqIntentInput(),
    result.intentId);
  assert.equal(rebuilt.contextId, result.context.contextId);
  assert.equal(rebuilt.contentFingerprint,
    result.context.contentFingerprint);
});

test('the intent correlation and trace ids are recorded', () => {
  assert.equal(liqIntentResult().correlationId, INTENT_CORRELATION_ID);
  assert.equal(liqIntentResult().traceId, INTENT_TRACE_ID);
});

test('the intent timestamp is carried informationally', () => {
  assert.equal(liqIntentResult().timestamp, INTENT_FIXTURE_TIMESTAMP);
});
