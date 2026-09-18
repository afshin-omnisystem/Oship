import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ablDecisionResult, ablGovernanceResult, governanceInputOf,
  runGovernance, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — BACK/LAY preservation tests: orientation, odds semantics,
 * identity, and the explicit rejection of BUY/SELL reinterpretation.
 */

test('the ABL corpus carries both BACK and LAY legs', () => {
  const decision = ablDecisionResult();
  const sides = decision.alternatives.flatMap(
    (a) => a.counterfactualCandidate.venueLegs.map((l) => l.side));
  assert.ok(sides.includes('BACK'));
  assert.ok(sides.includes('LAY'));
});

test('BACK legs and LAY legs keep distinct odds', () => {
  const decision = ablDecisionResult();
  for (const alt of decision.alternatives) {
    for (const leg of alt.counterfactualCandidate.venueLegs) {
      if (leg.side === 'BACK') {
        assert.ok(leg.odds !== null && leg.odds > 1);
      }
      if (leg.side === 'LAY') {
        assert.ok(leg.odds !== null && leg.odds > 1);
      }
    }
  }
});

test('governance never renames BACK to BUY', () => {
  const result = ablGovernanceResult();
  const serialized = JSON.stringify(result);
  // The decision result echo contains BACK/LAY; governance output must not
  // equate them with BUY/SELL anywhere in its own fields.
  const governanceFields = JSON.stringify({
    context: result.context, classification: result.classification,
    restrictions: result.restrictions.map((r) => r.code),
    strategyInput: result.strategyInput,
    package: result.handoffPackage,
  });
  assert.ok(!governanceFields.includes('"side":"BUY"'));
  assert.ok(!governanceFields.includes('"side":"SELL"'));
});

test('an orientation-swapped alternative still governs under ABL rules',
  () => {
    const swapped = governanceClone(ablDecisionResult(), (draft) => {
      for (const alternative of draft.alternatives) {
        for (const leg of alternative.counterfactualCandidate.venueLegs) {
          leg.side = leg.side === 'BACK' ? 'LAY' : 'BACK';
        }
      }
    });
    // Orientation swaps preserve BACK/LAY semantics exactly — governance
    // must accept them (they are legal ABL semantics).
    const result = runGovernance(governanceInputOf(swapped));
    assert.equal(result.context.domain, 'ABL');
    assert.equal(result.comparabilityGate.ablSemanticsVerified, true);
  });

test('replacing BACK with BUY rejects with INVALID_BACK_LAY_SEMANTICS',
  () => {
    const bad = governanceClone(ablDecisionResult(), (draft) => {
      for (const alternative of draft.alternatives) {
        for (const leg of alternative.counterfactualCandidate.venueLegs) {
          if (leg.side === 'BACK') leg.side = 'BUY';
        }
      }
    });
    assert.throws(() => runGovernance(governanceInputOf(bad)),
      (e: unknown) => (e as {code?: string}).code
        === 'INVALID_BACK_LAY_SEMANTICS');
  });

test('replacing LAY with SELL rejects with INVALID_BACK_LAY_SEMANTICS',
  () => {
    const bad = governanceClone(ablDecisionResult(), (draft) => {
      for (const alternative of draft.alternatives) {
        for (const leg of alternative.counterfactualCandidate.venueLegs) {
          if (leg.side === 'LAY') leg.side = 'SELL';
        }
      }
    });
    assert.throws(() => runGovernance(governanceInputOf(bad)),
      (e: unknown) => (e as {code?: string}).code
        === 'INVALID_BACK_LAY_SEMANTICS');
  });

test('BUY/SELL inside ABL is flagged as BACK/LAY semantics violation', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.side = 'SELL';
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /BUY\/SELL is not BACK\/LAY|only BACK\/LAY are legal/);
});

test('BACK/LAY market and selection identity stay attached', () => {
  const decision = ablDecisionResult();
  const first = decision.alternatives[0].counterfactualCandidate;
  assert.equal(typeof first.marketId, 'string');
  assert.equal(typeof first.selectionId, 'string');
});

test('the market/selection identity is preserved through governance', () => {
  const result = ablGovernanceResult();
  assert.equal(result.context.domain, 'ABL');
  assert.equal(result.context.opportunityClass, 'surebet');
});

test('BACK/LAY odds semantics reject odds of exactly 1', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.odds = 1;
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /INVALID_ABL_SEMANTICS/);
});

test('BACK/LAY odds semantics reject negative odds', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.odds = -2.0;
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /INVALID_ABL_SEMANTICS/);
});

test('a missing market identity on ABL rejects fail closed', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.counterfactualCandidate.marketId = null;
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /market\/selection identity|INVALID_ABL_SEMANTICS/);
});

test('a missing selection identity on ABL rejects fail closed', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.counterfactualCandidate.selectionId = null;
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /market\/selection identity|INVALID_ABL_SEMANTICS/);
});
