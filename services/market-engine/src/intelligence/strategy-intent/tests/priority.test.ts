import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assignIntentPriority, INTENT_PRIORITY_OF}
  from '../priority';
import {INTENT_PRIORITIES} from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, agingIntentResult,
  unknownFreshnessIntentResult, unstableBlockedIntentResult,
  notComparableIntentResult, venueDependentIntentResult,
  authorityBypassIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — priority model tests (§16). */

test('six priorities are enumerated', () => {
  assert.equal(INTENT_PRIORITIES.length, 6);
});

test('every classification maps to a priority', () => {
  const mappings = Object.values(INTENT_PRIORITY_OF);
  assert.equal(mappings.length, 8);
  assert.ok(mappings.every((priority) =>
    INTENT_PRIORITIES.includes(priority)));
});

test('READY intents are NORMAL_STRATEGY_INPUT', () => {
  assert.equal(cleanIntentResult().priority, 'NORMAL_STRATEGY_INPUT');
});

test('limited intents are LIMITED_STRATEGY_INPUT', () => {
  assert.equal(liqIntentResult().priority, 'LIMITED_STRATEGY_INPUT');
  assert.equal(agingIntentResult().priority, 'LIMITED_STRATEGY_INPUT');
});

test('research-required intents are HIGH_RESEARCH_PRIORITY', () => {
  assert.equal(venueDependentIntentResult().priority,
    'HIGH_RESEARCH_PRIORITY');
});

test('stale and insufficient intents are RESEARCH_ONLY', () => {
  assert.equal(staleIntentResult().priority, 'RESEARCH_ONLY');
  assert.equal(ablIntentResult().priority, 'RESEARCH_ONLY');
  assert.equal(unknownFreshnessIntentResult().priority, 'RESEARCH_ONLY');
});

test('conflicted and not-comparable intents need governance review', () => {
  assert.equal(afisIntentResult().priority,
    'CRITICAL_GOVERNANCE_REVIEW');
  assert.equal(notComparableIntentResult().priority,
    'CRITICAL_GOVERNANCE_REVIEW');
});

test('blocked intents are BLOCKED', () => {
  assert.equal(unstableBlockedIntentResult().priority, 'BLOCKED');
  assert.equal(authorityBypassIntentResult().priority, 'BLOCKED');
});

test('priority assignment is deterministic', () => {
  assert.deepEqual(assignIntentPriority('STRATEGIC_INTENT_READY'),
    assignIntentPriority('STRATEGIC_INTENT_READY'));
});

test('priority reasons disclaim execution urgency', () => {
  const result = assignIntentPriority('STRATEGIC_INTENT_READY');
  assert.ok(result.reasons.some((r) =>
    r.includes('never') && r.includes('urgency')));
});

test('priority reasons explain the mapping', () => {
  const result = assignIntentPriority('STRATEGIC_INTENT_STALE');
  assert.ok(result.reasons[0].includes('STRATEGIC_INTENT_STALE'));
  assert.ok(result.reasons[0].includes('RESEARCH_ONLY'));
});

test('every priority carries an explanatory reason', () => {
  for (const priority of INTENT_PRIORITIES) {
    const source = Object.entries(INTENT_PRIORITY_OF).find(
      ([, value]) => value === priority);
    assert.ok(source !== undefined);
    const result = assignIntentPriority(
      source[0] as Parameters<typeof assignIntentPriority>[0]);
    assert.ok(result.reasons.length >= 2);
  }
});

test('the result priority is mirrored in the artifact', () => {
  const result = liqIntentResult();
  assert.equal(result.intent.priority, result.priority);
  assert.deepEqual([...result.intent.priorityReasons],
    [...result.priorityReasons]);
});

test('priority never implies profitability', () => {
  for (const result of [afisIntentResult(), liqIntentResult(),
    cleanIntentResult(), staleIntentResult()]) {
    for (const reason of result.priorityReasons) {
      const hit = /profitab|expected return|roi/i.exec(reason);
      if (hit !== null) {
        // Mentions are legal only inside the explicit disavowal clause.
        const clause = reason.slice(0, hit.index);
        assert.ok(/never|not|no\b/.test(clause),
          `un-negated profitability language: ${reason}`);
      }
    }
  }
});
