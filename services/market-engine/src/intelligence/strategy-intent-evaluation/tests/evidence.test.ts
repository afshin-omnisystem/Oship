import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidenceGate, evaluateFreshnessGate,
  evaluateStabilityGate, evaluateComparabilityGate,
  evaluateDependencyGate} from '../gates';
import {validateIntentIntegrity} from '../intent-integrity';
import {
  cleanIntentResult, liqIntentResult, ablIntentResult,
  afisIntentResult, staleIntentResult, agingIntentResult,
  unstableIntentResult, notComparableIntentResult,
  normalizedIntentResult, venueOnlyIntentResult,
  venueDependentIntentResult, frozenIntentClone, evaluationClone,
} from '../test-fixtures';

/** SPRINT 042 — evidence, freshness, stability and dependency gates
 * (§22 evidence). */

test('a clean intent passes the evidence gate with moderate limits', () => {
  const gate = evaluateEvidenceGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('MODERATE')));
});

test('a moderate confidence intent passes with limitations', () => {
  const gate = evaluateEvidenceGate(liqIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('MODERATE') || reason.includes('WEAK')));
});

test('an insufficient intent fails the evidence gate', () => {
  const gate = evaluateEvidenceGate(ablIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
  assert.ok(gate.reasons.length > 0);
});

test('a conflicted intent fails the evidence gate', () => {
  const gate = evaluateEvidenceGate(afisIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
});

test('an evidence gate carries its name and detail', () => {
  const gate = evaluateEvidenceGate(cleanIntentResult());
  assert.equal(gate.gate, 'evidence');
  assert.ok(gate.detail.length > 0);
});

test('gate results are frozen', () => {
  assert.ok(Object.isFrozen(evaluateEvidenceGate(cleanIntentResult())));
  assert.ok(Object.isFrozen(evaluateFreshnessGate(cleanIntentResult())));
});

test('the evidence gate is deterministic', () => {
  const first = evaluateEvidenceGate(liqIntentResult());
  const second = evaluateEvidenceGate(liqIntentResult());
  assert.deepEqual(first, second);
});

test('a fresh intent passes the freshness gate', () => {
  const gate = evaluateFreshnessGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS');
});

test('an aging intent limits the freshness gate', () => {
  const gate = evaluateFreshnessGate(agingIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
});

test('a stale intent fails the freshness gate', () => {
  const gate = evaluateFreshnessGate(staleIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
});

test('an unknown freshness intent fails the freshness gate', () => {
  const intent = evaluationClone(cleanIntentResult(), (draft) => {
    draft.context.freshnessState = 'UNKNOWN';
  });
  const gate = evaluateFreshnessGate(intent);
  assert.equal(gate.state, 'DEFICIENT');
});

test('a stable intent passes the stability gate', () => {
  const gate = evaluateStabilityGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS');
});

test('an unstable intent fails the stability gate', () => {
  const gate = evaluateStabilityGate(unstableIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
});

test('a comparable intent passes the comparability gate', () => {
  const gate = evaluateComparabilityGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS');
});

test('a not-comparable intent fails the comparability gate', () => {
  const gate = evaluateComparabilityGate(notComparableIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
});

test('a normalized intent limits the comparability gate', () => {
  const gate = evaluateComparabilityGate(normalizedIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
});

test('an independent intent passes the dependency gate', () => {
  const gate = evaluateDependencyGate(cleanIntentResult());
  assert.equal(gate.state, 'PASS');
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('independent')));
});

test('a single-flag dependency limits the dependency gate', () => {
  const gate = evaluateDependencyGate(venueOnlyIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
});

test('a multi-flag dependency limits the dependency gate', () => {
  const gate = evaluateDependencyGate(venueDependentIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('MULTI') || reason.includes('multiple')));
});

test('the dependency gate names the dependency family', () => {
  const gate = evaluateDependencyGate(venueOnlyIntentResult());
  assert.ok(gate.detail.includes('VENUE')
    || gate.reasons.some((reason) => reason.includes('venue')));
});

test('an actionable intent with unknown dependencies fails closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.dependencies.state = 'UNKNOWN';
  });
  assert.throws(() => validateIntentIntegrity(intent),
    (e: unknown) => e instanceof Error
      && e.message.includes('MISSING_DEPENDENCY'));
});

test('a stale actionable intent without its warning fails closed', () => {
  const intent = frozenIntentClone(liqIntentResult(), (draft) => {
    draft.context.freshnessState = 'STALE';
  });
  assert.throws(() => validateIntentIntegrity(intent),
    (e: unknown) => e instanceof Error
      && e.message.includes('RESTRICTION_INCONSISTENCY'));
});

test('every gate state is from the explicit vocabulary', () => {
  for (const gate of [evaluateEvidenceGate(cleanIntentResult()),
    evaluateFreshnessGate(staleIntentResult()),
    evaluateStabilityGate(unstableIntentResult()),
    evaluateComparabilityGate(notComparableIntentResult()),
    evaluateDependencyGate(venueOnlyIntentResult())]) {
    assert.ok(['PASS', 'PASS_WITH_LIMITATIONS', 'DEFICIENT', 'BLOCKED']
      .includes(gate.state));
  }
});

test('the integrity gate passes every corpus fixture', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    ablIntentResult(), afisIntentResult(), staleIntentResult(),
    agingIntentResult(), unstableIntentResult(),
    notComparableIntentResult(), normalizedIntentResult(),
    venueOnlyIntentResult(), venueDependentIntentResult()]) {
    const gate = validateIntentIntegrity(intent);
    assert.equal(gate.state, 'PASS', intent.intentId);
    assert.equal(gate.gate, 'integrity');
  }
});

test('the integrity gate reports its structural detail', () => {
  const gate = validateIntentIntegrity(cleanIntentResult());
  assert.ok(gate.detail.includes('structurally valid'));
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('restrictions are consistent')));
});

test('evidence gates never assert certainty', () => {
  for (const gate of [evaluateEvidenceGate(cleanIntentResult()),
    evaluateEvidenceGate(liqIntentResult()),
    evaluateFreshnessGate(agingIntentResult()),
    evaluateStabilityGate(unstableIntentResult())]) {
    for (const line of [gate.detail, ...gate.reasons]) {
      assert.ok(!/\bcertainty\b|\bguaranteed\b/.test(line));
    }
  }
});

test('a forged evidence state on an actionable intent fails closed', () => {
  const intent = frozenIntentClone(liqIntentResult(), (draft) => {
    draft.context.evidenceState = 'CONFLICTED';
  });
  assert.throws(() => validateIntentIntegrity(intent),
    (e: unknown) => e instanceof Error
      && e.message.includes('CONFLICTING_EVIDENCE'));
});

test('a forged not-comparable state on an actionable intent fails closed',
  () => {
    const intent = frozenIntentClone(liqIntentResult(), (draft) => {
      draft.context.evidenceState = 'NOT_COMPARABLE';
    });
    assert.throws(() => validateIntentIntegrity(intent),
      (e: unknown) => e instanceof Error
        && e.message.includes('NON_COMPARABLE_DOMAIN'));
  });

test('the freshness gate mirrors the governed freshness state', () => {
  const gate = evaluateFreshnessGate(staleIntentResult());
  assert.ok(gate.detail.includes('STALE')
    || gate.reasons.some((r) => r.includes('STALE')));
});

test('gate details are non-empty across the corpus', () => {
  for (const intent of [cleanIntentResult(), staleIntentResult(),
    unstableIntentResult(), notComparableIntentResult()]) {
    for (const gate of [evaluateEvidenceGate(intent),
      evaluateFreshnessGate(intent), evaluateStabilityGate(intent),
      evaluateComparabilityGate(intent), evaluateDependencyGate(intent)]) {
      assert.ok(gate.detail.length > 0, gate.gate);
    }
  }
});
