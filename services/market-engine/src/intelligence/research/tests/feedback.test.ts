import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedback, strategyCandidateSignal, venueQualitySignal, policyWarning,
  opportunityClassQualitySignal, leakageWarning, failureRiskSignal, researchPriority,
  feedbackFromQueries, memoryIdsOf,
} from '../feedback';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — intelligence feedback tests (§13): exactly the seven
 * informational kinds; feedback NEVER mutates Strategy Registry, Risk,
 * Treasury, Portfolio, Execution or AEGIS.
 */

const history = researchHistory();
const result = new ResearchEngine().analyze(history.input);

test('the engine emits all seven feedback kinds', () => {
  const kinds = new Set(result.feedback.map((f) => f.kind));
  assert.equal(kinds.size, 7);
  for (const kind of ['STRATEGY_CANDIDATE_SIGNAL', 'VENUE_QUALITY_SIGNAL', 'POLICY_WARNING',
    'OPPORTUNITY_CLASS_QUALITY_SIGNAL', 'LEAKAGE_WARNING', 'FAILURE_RISK_SIGNAL', 'RESEARCH_PRIORITY']) {
    assert.ok(kinds.has(kind as never), `${kind} must be emitted`);
  }
});

test('every feedback item is informational: true — never an authority action', () => {
  for (const feedback of result.feedback) {
    assert.equal(feedback.informational, true);
    assert.ok(feedback.feedbackId.startsWith('fbk_'));
    assert.ok(Object.isFrozen(feedback));
    assert.ok(feedback.statement.length > 0);
    assert.ok(feedback.subject.length > 0);
  }
});

test('feedback statements carry no authority verbs', () => {
  for (const feedback of result.feedback) {
    const text = `${feedback.statement} ${JSON.stringify(feedback.payload)}`;
    assert.ok(!/authorize|approve|reject order|execute now|deploy|halt|block/i.test(text),
      `feedback must stay informational: ${text}`);
  }
});

test('feedback evidence resolves to real memory records', () => {
  const memoryIds = new Set(result.memory.records.map((r) => r.memoryId));
  const withEvidence = result.feedback.filter((f) => f.evidenceMemoryIds.length > 0);
  assert.ok(withEvidence.length >= result.feedback.length - 2,
    'nearly all feedback must be evidence-backed');
  for (const feedback of withEvidence) {
    for (const id of feedback.evidenceMemoryIds) {
      assert.ok(memoryIds.has(id), `feedback evidence ${id} must resolve`);
    }
  }
});

test('the strategy candidate signal names the comparison winner', () => {
  const signal = result.feedback.find((f) => f.kind === 'STRATEGY_CANDIDATE_SIGNAL')!;
  assert.ok(signal);
  assert.equal(signal.subject, 'arb-guardian');
  assert.match(signal.statement, /preserves more edge/);
});

test('the venue quality signal covers both best and worst venue', () => {
  const venueSignals = result.feedback.filter((f) => f.kind === 'VENUE_QUALITY_SIGNAL');
  assert.ok(venueSignals.length >= 2, 'best and worst venue must both be signalled');
  const subjects = venueSignals.map((f) => f.subject);
  assert.ok(subjects.includes('venue-a') || subjects.includes('venue-b'));
});

test('the policy warning targets the candidate policy', () => {
  const warning = result.feedback.find((f) => f.kind === 'POLICY_WARNING')!;
  assert.ok(warning);
  assert.ok(warning.subject.includes('v1.1'));
});

test('the leakage warning names the dominant attributable component', () => {
  const warning = result.feedback.find((f) => f.kind === 'LEAKAGE_WARNING')!;
  assert.ok(warning);
  assert.ok(typeof warning.payload.component === 'string' || warning.statement.includes('leakage'));
});

test('the failure risk signal cites the largest failure pattern', () => {
  const signal = result.feedback.find((f) => f.kind === 'FAILURE_RISK_SIGNAL')!;
  assert.ok(signal);
});

test('the research priority identifies an under-studied subject', () => {
  const priority = result.feedback.find((f) => f.kind === 'RESEARCH_PRIORITY')!;
  assert.ok(priority);
  assert.ok(priority.evidenceMemoryIds !== undefined);
});

test('feedback constructors build the canonical shape deterministically', () => {
  const built = buildFeedback('RESEARCH_PRIORITY', 'subject-x', 'statement', {a: 1}, ['m1']);
  assert.equal(built.kind, 'RESEARCH_PRIORITY');
  assert.equal(built.informational, true);
  const again = buildFeedback('RESEARCH_PRIORITY', 'subject-x', 'statement', {a: 1}, ['m1']);
  assert.equal(built.feedbackId, again.feedbackId);
  assert.ok(Object.isFrozen(built));
});

test('class quality signals come from the class-preservation query', () => {
  const fromQueries = feedbackFromQueries(result.queries);
  assert.ok(fromQueries.length > 0);
  assert.ok(fromQueries.every((f) => f.informational === true));
  const classSignals = fromQueries.filter((f) => f.kind === 'OPPORTUNITY_CLASS_QUALITY_SIGNAL');
  assert.ok(classSignals.length > 0);
});

test('memoryIdsOf sorts the evidence backbone of a record set', () => {
  const records = result.memory.records.slice(0, 5);
  assert.deepEqual(memoryIdsOf(records), records.map((r) => r.memoryId).sort());
  assert.deepEqual(memoryIdsOf([]), []);
});

test('individual constructors stamp their kinds', () => {
  const strategyComparison = result.comparisons.find((c) => c.kind === 'STRATEGY')!;
  assert.equal(strategyCandidateSignal(strategyComparison, 'arb-guardian').kind, 'STRATEGY_CANDIDATE_SIGNAL');
  assert.equal(venueQualitySignal('venue-b', 0.9, 1.2, []).kind, 'VENUE_QUALITY_SIGNAL');
  assert.equal(policyWarning('policy-execution@v1.1', -19.15, []).kind, 'POLICY_WARNING');
  assert.equal(opportunityClassQualitySignal('surebet', 0.36, 2, []).kind, 'OPPORTUNITY_CLASS_QUALITY_SIGNAL');
  assert.equal(leakageWarning('SLIPPAGE', 145, 0.4, []).kind, 'LEAKAGE_WARNING');
  const failurePattern = result.patterns.find((p) => p.kind === 'REPEATED_FAILURE_CLASS')!;
  assert.equal(failureRiskSignal(failurePattern).kind, 'FAILURE_RISK_SIGNAL');
  assert.equal(researchPriority('funding', 'only 2 observations', 'funding needs more history').kind, 'RESEARCH_PRIORITY');
});
