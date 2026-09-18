import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceBundle} from '../evidence';
import {
  liqIntentResult, afisIntentResult, cleanIntentResult,
  ablIntentResult, liqGovernanceResult, afisGovernanceResult,
  liqDominantDecisionResult, extractDecisionFactsOf,
  extractGovernanceFactsOf,
} from '../test-fixtures';

/** SPRINT 041 — evidence bundle tests (§2/§17). */

test('the rationale names the preferred alternative', () => {
  const rationale = liqIntentResult().intent.rationale;
  assert.ok(rationale.some((line) =>
    line.includes('alt-venue-a')));
  assert.ok(rationale.some((line) =>
    line.includes('evidence-supported')));
});

test('blocked intents state that no preferred is surfaced', () => {
  const rationale = afisIntentResult().intent.rationale;
  assert.ok(rationale.some((line) =>
    line.includes('no preferred alternative')));
});

test('the rationale carries the governance classification', () => {
  for (const result of [liqIntentResult(), afisIntentResult(),
    ablIntentResult()]) {
    assert.ok(result.intent.rationale.some((line) =>
      line.includes('governance classified the handoff')));
  }
});

test('the rationale quotes the governance reasons', () => {
  assert.ok(liqIntentResult().intent.rationale.some((line) =>
    line.startsWith('governance reason:')));
});

test('historical support stays explicitly historical', () => {
  const support = liqIntentResult().intent.historicalSupport;
  assert.ok(support.some((line) => line.includes('historical')));
  assert.ok(support.some((line) => line.includes('never a future claim')));
});

test('historical support carries the trade-off score of the preferred',
  () => {
    const support = liqIntentResult().intent.historicalSupport;
    assert.ok(support.some((line) =>
      line.includes('trade-off score')));
  });

test('conflicting evidence mirrors the decision conflicts', () => {
  const bundle = afisIntentResult().intent;
  assert.ok(bundle.rationale.length > 0);
  assert.ok(afisGovernanceResult().context.unresolvedConflicts.length
    > 0);
});

test('semantic limitations include the canonical boundary statement', () => {
  const limitations = liqIntentResult().intent.semanticLimitations;
  assert.ok(limitations.some((line) =>
    line.includes('evidence-bound and associational')));
});

test('semantic limitations name non-stable stability explicitly', () => {
  const limitations = liqIntentResult().intent.semanticLimitations;
  assert.ok(limitations.some((line) =>
    line.includes('MODERATELY_STABLE')));
});

test('limited intents carry governance limitations', () => {
  const limitations = liqIntentResult().intent.semanticLimitations;
  assert.ok(limitations.some((line) =>
    line.startsWith('governance limitation:')));
});

test('the evidence bundle is deterministic', () => {
  const a = buildEvidenceBundle(
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    extractDecisionFactsOf(liqDominantDecisionResult()),
    extractGovernanceFactsOf(liqGovernanceResult()),
    'alt-venue-a', 'MODERATELY_STABLE');
  const b = buildEvidenceBundle(
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    extractDecisionFactsOf(liqDominantDecisionResult()),
    extractGovernanceFactsOf(liqGovernanceResult()),
    'alt-venue-a', 'MODERATELY_STABLE');
  assert.deepEqual(a, b);
});

test('rationale lines never assert prediction', () => {
  for (const result of [liqIntentResult(), cleanIntentResult(),
    afisIntentResult()]) {
    for (const line of result.intent.rationale) {
      assert.ok(!/\bprobability\b/i.test(line.replace(/"[^"]*"/g, ' ')),
        `predictive line: ${line}`);
    }
  }
});
