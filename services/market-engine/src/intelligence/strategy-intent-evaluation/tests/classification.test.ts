import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyEvaluation} from '../classification';
import {assignDownstreamEligibility, EVALUATION_TO_ELIGIBILITY,
  eligibilityAllowsAlternatives} from '../eligibility';
import {
  EvaluationRejectionError, EVALUATION_CLASSIFICATIONS,
  DOWNSTREAM_ELIGIBILITY_STATES,
} from '../types';
import type {EvaluationClassification, DownstreamEligibility} from '../types';
import {
  cleanIntentResult, liqIntentResult, afisIntentResult, ablIntentResult,
  staleIntentResult, unstableIntentResult, governanceBlockedIntentResult,
  notComparableIntentResult, venueOnlyIntentResult,
  strategyOnlyIntentResult, regimeOnlyIntentResult,
  venueDependentIntentResult, researchEscalatedIntentResult,
  noDominantIntentResult,
} from '../test-fixtures';
import {validateIntentIntegrity} from '../intent-integrity';

/** SPRINT 042 — classification and eligibility tests (§8/§9). */

function gatesOf(intent: ReturnType<typeof cleanIntentResult>) {
  const integrity = validateIntentIntegrity(intent);
  return [
    integrity,
    {gate: 'evidence', state: 'PASS', detail: '', reasons: []},
    {gate: 'safety', state: 'PASS', detail: '', reasons: []},
    {gate: 'comparability', state: 'PASS', detail: '', reasons: []},
    {gate: 'freshness', state: 'PASS', detail: '', reasons: []},
    {gate: 'stability', state: 'PASS', detail: '', reasons: []},
    {gate: 'dependency', state: 'PASS', detail: '', reasons: []},
  ] as never[];
}

// ---------------------------------------------------------------------------
// Classification precedence
// ---------------------------------------------------------------------------

test('a blocked intent source never becomes un-blocked', () => {
  const result = classifyEvaluation(governanceBlockedIntentResult(),
    gatesOf(governanceBlockedIntentResult()));
  assert.equal(result.classification, 'EVALUATION_BLOCKED');
});

test('an actionable intent with an unstable gate classifies UNSTABLE', () => {
  const intent = unstableIntentResult();
  const gates = gatesOf(intent);
  (gates[5] as {state: string}).state = 'DEFICIENT';
  const result = classifyEvaluation(intent, gates);
  assert.equal(result.classification, 'EVALUATION_UNSTABLE');
});

test('a stale intent with a deficient freshness gate classifies STALE', () => {
  const intent = staleIntentResult();
  const gates = gatesOf(intent);
  (gates[4] as {state: string}).state = 'DEFICIENT';
  const result = classifyEvaluation(intent, gates);
  assert.equal(result.classification, 'EVALUATION_STALE');
});

test('a research-required multi-flag intent classifies MIXED', () => {
  const intent = venueDependentIntentResult();
  const result = classifyEvaluation(intent, gatesOf(intent));
  assert.equal(result.classification, 'EVALUATION_MIXED');
});

test('a single venue flag classifies VENUE_DEPENDENT', () => {
  const intent = venueOnlyIntentResult();
  const result = classifyEvaluation(intent, gatesOf(intent));
  assert.equal(result.classification, 'EVALUATION_VENUE_DEPENDENT');
});

test('a single strategy flag classifies STRATEGY_DEPENDENT', () => {
  const intent = strategyOnlyIntentResult();
  const result = classifyEvaluation(intent, gatesOf(intent));
  assert.equal(result.classification, 'EVALUATION_STRATEGY_DEPENDENT');
});

test('a single regime flag classifies REGIME_DEPENDENT', () => {
  const intent = regimeOnlyIntentResult();
  const result = classifyEvaluation(intent, gatesOf(intent));
  assert.equal(result.classification, 'EVALUATION_REGIME_DEPENDENT');
});

test('an escalated research intent classifies REQUIRES_RESEARCH', () => {
  const intent = researchEscalatedIntentResult();
  const result = classifyEvaluation(intent, gatesOf(intent));
  assert.equal(result.classification, 'EVALUATION_REQUIRES_RESEARCH');
});

test('a deficient evidence gate demotes an actionable intent', () => {
  const intent = liqIntentResult();
  const gates = gatesOf(intent);
  (gates[1] as {state: string}).state = 'DEFICIENT';
  const result = classifyEvaluation(intent, gates);
  assert.equal(result.classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE');
  assert.ok(result.reasons.some((reason) =>
    reason.includes('the harder state wins')));
});

test('a deficient comparability gate demotes to NOT_COMPARABLE', () => {
  const intent = liqIntentResult();
  const gates = gatesOf(intent);
  (gates[3] as {state: string}).state = 'DEFICIENT';
  const result = classifyEvaluation(intent, gates);
  assert.equal(result.classification, 'EVALUATION_NOT_COMPARABLE');
});

test('classification is deterministic over the same inputs', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    afisIntentResult(), ablIntentResult()]) {
    const first = classifyEvaluation(intent, gatesOf(intent));
    const second = classifyEvaluation(intent, gatesOf(intent));
    assert.deepEqual(first, second);
  }
});

test('classification reasons are always non-empty', () => {
  for (const intent of [cleanIntentResult(), governanceBlockedIntentResult(),
    venueOnlyIntentResult()]) {
    const result = classifyEvaluation(intent, gatesOf(intent));
    assert.ok(result.reasons.length > 0);
    for (const reason of result.reasons) {
      assert.ok(reason.length > 0);
    }
  }
});

test('the classification is always inside the vocabulary', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    staleIntentResult(), notComparableIntentResult(),
    noDominantIntentResult()]) {
    const result = classifyEvaluation(intent, gatesOf(intent));
    assert.ok(EVALUATION_CLASSIFICATIONS.includes(result.classification));
  }
});

// ---------------------------------------------------------------------------
// Eligibility mapping (§9)
// ---------------------------------------------------------------------------

test('every classification maps to exactly one eligibility state', () => {
  for (const classification of EVALUATION_CLASSIFICATIONS) {
    const result = assignDownstreamEligibility(classification);
    assert.ok(DOWNSTREAM_ELIGIBILITY_STATES.includes(result.eligibility));
  }
});

test('the frozen mapping covers all thirteen classifications', () => {
  assert.equal(EVALUATION_TO_ELIGIBILITY.length, 13);
  const classifications = new Set(EVALUATION_TO_ELIGIBILITY.map(
    ([classification]) => classification));
  for (const classification of EVALUATION_CLASSIFICATIONS) {
    assert.ok(classifications.has(classification),
      `${classification} is mapped`);
  }
});

test('the mapping is injective per blocked family', () => {
  const map = new Map<string, string>();
  for (const [classification, eligibility]
    of EVALUATION_TO_ELIGIBILITY) {
    const existing = map.get(eligibility);
    if (existing !== undefined) {
      // Only the eligible and research families may share a state.
      assert.ok(['ELIGIBLE_WITH_RESTRICTIONS',
        'ELIGIBLE_FOR_CONSIDERATION', 'RESEARCH_REQUIRED']
        .includes(eligibility));
    }
    map.set(eligibility, classification);
  }
});

test('ALLOWED maps to ELIGIBLE_FOR_CONSIDERATION', () => {
  assert.equal(assignDownstreamEligibility('EVALUATION_ALLOWED')
    .eligibility, 'ELIGIBLE_FOR_CONSIDERATION');
});

test('ALLOWED_WITH_LIMITATIONS maps to ELIGIBLE_WITH_RESTRICTIONS', () => {
  assert.equal(assignDownstreamEligibility(
    'EVALUATION_ALLOWED_WITH_LIMITATIONS').eligibility,
  'ELIGIBLE_WITH_RESTRICTIONS');
});

test('dependency classifications map to RESEARCH_REQUIRED', () => {
  for (const classification of ['EVALUATION_REQUIRES_RESEARCH',
    'EVALUATION_STRATEGY_DEPENDENT', 'EVALUATION_VENUE_DEPENDENT',
    'EVALUATION_REGIME_DEPENDENT', 'EVALUATION_MIXED'] as const) {
    assert.equal(assignDownstreamEligibility(classification).eligibility,
      'RESEARCH_REQUIRED', classification);
  }
});

test('blocked families map to their hard states', () => {
  const expected: readonly [EvaluationClassification,
    DownstreamEligibility][] = [
    ['EVALUATION_BLOCKED', 'BLOCKED'],
    ['EVALUATION_INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'],
    ['EVALUATION_NOT_COMPARABLE', 'NOT_COMPARABLE'],
    ['EVALUATION_CONFLICTED', 'CONFLICTED'],
    ['EVALUATION_STALE', 'STALE'],
    ['EVALUATION_UNSTABLE', 'UNSTABLE'],
  ];
  for (const [classification, eligibility] of expected) {
    assert.equal(assignDownstreamEligibility(classification).eligibility,
      eligibility, classification);
  }
});

test('eligibility reasons always carry the verbatim meaning', () => {
  for (const classification of EVALUATION_CLASSIFICATIONS) {
    const result = assignDownstreamEligibility(classification);
    assert.ok(result.reasons.some((reason) =>
      reason.includes('never approved for trading, betting, execution, '
        + 'capital allocation or strategy activation')),
      classification);
    assert.ok(result.meaning.length > 0);
  }
});

test('eligible families explain that the downstream plane decides', () => {
  for (const classification of ['EVALUATION_ALLOWED',
    'EVALUATION_ALLOWED_WITH_LIMITATIONS'] as const) {
    const result = assignDownstreamEligibility(classification);
    assert.ok(result.reasons.some((reason) =>
      reason.includes('downstream analytical authority decides')));
  }
});

test('research families explain the Research Plane requirement', () => {
  const result = assignDownstreamEligibility(
    'EVALUATION_STRATEGY_DEPENDENT');
  assert.ok(result.reasons.some((reason) =>
    reason.includes('Research Plane')));
});

test('blocked families explain the harder-state rule', () => {
  const result = assignDownstreamEligibility('EVALUATION_BLOCKED');
  assert.ok(result.reasons.some((reason) =>
    reason.includes('never silently upgraded')));
});

test('eligibilityAllowsAlternatives admits only surfacing states', () => {
  assert.equal(eligibilityAllowsAlternatives(
    'ELIGIBLE_FOR_CONSIDERATION'), true);
  assert.equal(eligibilityAllowsAlternatives(
    'ELIGIBLE_WITH_RESTRICTIONS'), true);
  assert.equal(eligibilityAllowsAlternatives('RESEARCH_REQUIRED'), true);
  for (const eligibility of ['BLOCKED', 'NOT_COMPARABLE',
    'INSUFFICIENT_EVIDENCE', 'STALE', 'UNSTABLE', 'CONFLICTED'] as const) {
    assert.equal(eligibilityAllowsAlternatives(eligibility), false,
      eligibility);
  }
});

test('eligibility never asserts approval language', () => {
  for (const classification of EVALUATION_CLASSIFICATIONS) {
    const result = assignDownstreamEligibility(classification);
    for (const reason of result.reasons) {
      assert.ok(!/\bapproved for trading\b/.test(reason)
        || reason.includes('never approved'));
    }
  }
});

test('an unknown classification fails closed', () => {
  assert.throws(() => assignDownstreamEligibility(
    'MAGIC' as EvaluationClassification), Error);
});

test('classification failure surfaces as a rejection error', () => {
  assert.ok(typeof EvaluationRejectionError === 'function');
  const error = new EvaluationRejectionError('INVALID_INTENT', 'x');
  assert.equal(error.code, 'INVALID_INTENT');
  assert.ok(error.message.includes('fail closed'));
});
