import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, staleEvaluationResult,
  insufficientAblEvaluationResult, conflictedEvaluationResult,
  unstableEvaluationResult, notComparableEvaluationResult,
  venueDependentEvaluationResult, frozenEvaluationClone,
  assertInputRejects,
} from '../test-fixtures';
import {validateInputIntegrity, inputClassificationOf}
  from '../input-integrity';
import {EVALUATION_TO_INPUT_CLASSIFICATION} from '../types';

/** SPRINT 043 — input integrity over the consumed evaluation (§6/§20). */

test('integrity: a clean evaluation passes', () => {
  assert.doesNotThrow(() => validateInputIntegrity(cleanEvaluationResult()));
});

test('integrity: every corpus evaluation passes its own integrity check',
  () => {
    for (const build of [cleanEvaluationResult, staleEvaluationResult,
      insufficientAblEvaluationResult, conflictedEvaluationResult,
      unstableEvaluationResult, notComparableEvaluationResult,
      venueDependentEvaluationResult]) {
      assert.doesNotThrow(() => validateInputIntegrity(build()),
        `${build.name} must pass integrity`);
    }
  });

test('integrity: unknown evaluation classification rejects', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.classification = 'EVALUATION_MIRACLE' as never;
  });
  assertInputRejects('CLASSIFICATION_EVIDENCE_INCONSISTENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: classification contradicting eligibility rejects', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.eligibility = 'BLOCKED';
  });
  assertInputRejects('ELIGIBILITY_EVIDENCE_INCONSISTENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: a blocked family can never be eligible', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.classification = 'EVALUATION_BLOCKED';
    draft.eligibility = 'ELIGIBLE_FOR_CONSIDERATION';
  });
  assertInputRejects('ELIGIBILITY_EVIDENCE_INCONSISTENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: conflicted classification requires conflicted evidence',
  () => {
    const forged = frozenEvaluationClone(conflictedEvaluationResult(),
      (draft) => {
        draft.evaluationContext.evidenceState = 'CONSISTENT';
      });
    assertInputRejects('CONFLICTING_EVIDENCE', () =>
      validateInputIntegrity(forged));
  });

test('integrity: insufficient classification requires insufficient '
  + 'evidence or unknown freshness', () => {
  const forged = frozenEvaluationClone(insufficientAblEvaluationResult(),
    (draft) => {
      draft.evaluationContext.evidenceState = 'SUFFICIENT';
      draft.evaluationContext.freshnessState = 'FRESH';
    });
  assertInputRejects('INSUFFICIENT_EVIDENCE', () =>
    validateInputIntegrity(forged));
});

test('integrity: insufficient classification tolerates unknown freshness',
  () => {
    const forged = frozenEvaluationClone(insufficientAblEvaluationResult(),
      (draft) => {
        draft.evaluationContext.evidenceState = 'SUFFICIENT';
        draft.evaluationContext.freshnessState = 'UNKNOWN';
      });
    assert.doesNotThrow(() => validateInputIntegrity(forged));
  });

test('integrity: stale classification requires stale-or-unknown freshness',
  () => {
    const forged = frozenEvaluationClone(staleEvaluationResult(),
      (draft) => {
        draft.evaluationContext.freshnessState = 'FRESH';
      });
    assertInputRejects('STALE_EVIDENCE', () =>
      validateInputIntegrity(forged));
  });

test('integrity: stale classification tolerates unknown freshness', () => {
  const forged = frozenEvaluationClone(staleEvaluationResult(), (draft) => {
    draft.evaluationContext.freshnessState = 'UNKNOWN';
  });
  assert.doesNotThrow(() => validateInputIntegrity(forged));
});

test('integrity: unstable classification requires unstable stability',
  () => {
    const forged = frozenEvaluationClone(unstableEvaluationResult(),
      (draft) => {
        draft.evaluationContext.stabilityState = 'STABLE';
      });
    assertInputRejects('UNSTABLE_EVIDENCE', () =>
      validateInputIntegrity(forged));
  });

test('integrity: not-comparable classification requires the state', () => {
  const forged = frozenEvaluationClone(notComparableEvaluationResult(),
    (draft) => {
      draft.evaluationContext.comparability = 'COMPARABLE';
    });
  assertInputRejects('NOT_COMPARABLE', () =>
    validateInputIntegrity(forged));
});

test('integrity: unqualified allowed never carries unknown freshness',
  () => {
    const forged = frozenEvaluationClone(cleanEvaluationResult(),
      (draft) => {
        draft.evaluationContext.freshnessState = 'UNKNOWN';
      });
    assertInputRejects('UNKNOWN_FRESHNESS', () =>
      validateInputIntegrity(forged));
  });

test('integrity: a missing baseline restriction rejects', () => {
  for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION',
    'DOWNSTREAM_CONSIDERATION_ONLY']) {
    const forged = frozenEvaluationClone(cleanEvaluationResult(),
      (draft) => {
        draft.restrictions = draft.restrictions.filter((restriction) =>
          restriction.code !== baseline);
      });
    assertInputRejects('RESTRICTION_INCONSISTENCY', () =>
      validateInputIntegrity(forged), );
  }
});

test('integrity: duplicate restriction codes reject', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.restrictions = [...draft.restrictions,
      {...draft.restrictions[0]}];
  });
  assertInputRejects('RESTRICTION_INCONSISTENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: a restriction without a reason rejects', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.restrictions[0].reason = '';
  });
  assertInputRejects('RESTRICTION_INCONSISTENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: normalization declaration must match the state', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.comparability
      = 'COMPARABLE_VIA_NORMALIZATION';
  });
  assertInputRejects('NORMALIZATION_VIOLATION', () =>
    validateInputIntegrity(forged));
});

test('integrity: not-comparable never surfaces a preferred alternative',
  () => {
    const forged = frozenEvaluationClone(notComparableEvaluationResult(),
      (draft) => {
        draft.preferredAlternativeId = 'alt_forged';
      });
    assertInputRejects('NORMALIZATION_VIOLATION', () =>
      validateInputIntegrity(forged));
  });

test('integrity: unknown dependency state vocabulary rejects', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.dependencyState = 'SOMETIMES';
  });
  assertInputRejects('INVALID_DEPENDENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: a non-blocked evaluation never carries UNKNOWN '
  + 'dependency state', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.dependencyState = 'UNKNOWN';
  });
  assertInputRejects('MISSING_DEPENDENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: INDEPENDENT contradicts dependency restrictions', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.dependencyState = 'INDEPENDENT';
    draft.restrictions.push({code: 'REGIME_LIMITED', scope: 'REGIME',
      reason: 'forged', source: 'INTENT', restrictionId: 'res_forged'});
  });
  assertInputRejects('INVALID_DEPENDENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: a single-family state requires its restriction', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.dependencyState = 'VENUE_DEPENDENT';
  });
  assertInputRejects('INVALID_DEPENDENCY', () =>
    validateInputIntegrity(forged));
});

test('integrity: a dependency-restricted evaluation stays consistent',
  () => {
    assert.doesNotThrow(() =>
      validateInputIntegrity(venueDependentEvaluationResult()));
  });

test('integrity: an allowed evaluation must surface alternatives', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.acceptableAlternativeIds = [];
  });
  assertInputRejects('MISSING_EVIDENCE', () =>
    validateInputIntegrity(forged));
});

test('integrity: inputClassificationOf maps every evaluation class', () => {
  for (const [evaluationClass, inputClass]
    of EVALUATION_TO_INPUT_CLASSIFICATION) {
    assert.equal(inputClassificationOf(evaluationClass), inputClass);
  }
});

test('integrity: inputClassificationOf rejects unknown classes', () => {
  assertInputRejects('CLASSIFICATION_EVIDENCE_INCONSISTENCY', () =>
    inputClassificationOf('EVALUATION_MIRACLE' as never));
});
