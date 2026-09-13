import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDimensions} from '../dimensions';
import {analyzeRestrictions} from '../restriction-analysis';
import {
  EVALUATION_DIMENSION_NAMES, EVALUATION_RESTRICTION_CODES,
  EvaluationRejectionError,
} from '../types';
import {
  cleanIntentResult, liqIntentResult, ablIntentResult,
  cleanAblIntentResult, restrictedEvaluationResult,
  cleanEvaluationResult, venueOnlyIntentResult,
  researchEscalatedIntentResult, frozenIntentClone, evaluationClone,
} from '../test-fixtures';
import {checkPortfolioInterfaceCompatibility,
} from '../portfolio-interface';
import {DEFAULT_EVALUATION_CONFIG} from '../config';

/** SPRINT 042 — dimension battery and restriction tests (§7/§16). */

const config = DEFAULT_EVALUATION_CONFIG;

function dimensionsOf(intent: ReturnType<typeof cleanIntentResult>) {
  const compatibility = checkPortfolioInterfaceCompatibility(intent);
  return evaluateDimensions({intentResult: intent, config,
    evaluationId: 'eval_probe_dimensions',
    portfolioCompatible: compatibility.compatible,
    normalizationRequired: compatibility.normalizationRequired});
}

// ---------------------------------------------------------------------------
// The eighteen-dimension battery
// ---------------------------------------------------------------------------

test('the dimension battery evaluates exactly eighteen dimensions', () => {
  const dimensions = dimensionsOf(cleanIntentResult());
  assert.equal(dimensions.length, 18);
});

test('the dimension names are the canonical eighteen in order', () => {
  const dimensions = dimensionsOf(cleanIntentResult());
  assert.deepEqual(dimensions.map((d) => d.dimension),
    [...EVALUATION_DIMENSION_NAMES]);
});

test('every dimension carries an id, state and detail', () => {
  for (const dimension of dimensionsOf(cleanIntentResult())) {
    assert.ok(dimension.dimensionId.startsWith('evdim_'));
    assert.ok(['SATISFIED', 'LIMITED', 'DEFICIENT', 'NOT_APPLICABLE']
      .includes(dimension.state));
    assert.ok(dimension.detail.length > 0);
  }
});

test('dimension ids are unique and content-derived', () => {
  const dimensions = dimensionsOf(cleanIntentResult());
  const ids = dimensions.map((d) => d.dimensionId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(id.startsWith('evdim_'));
  }
  const other = evaluateDimensions({intentResult: liqIntentResult(),
    config, evaluationId: 'eval_probe_dimensions',
    portfolioCompatible: true, normalizationRequired: false});
  assert.notDeepEqual(dimensions.map((d) => d.dimensionId),
    other.map((d) => d.dimensionId));
});

test('the dimension battery is deterministic', () => {
  const first = dimensionsOf(liqIntentResult());
  const second = dimensionsOf(liqIntentResult());
  assert.deepEqual(first, second);
});

test('a clean intent satisfies its core dimensions', () => {
  const dimensions = dimensionsOf(cleanIntentResult());
  const byName = new Map(dimensions.map((d) => [d.dimension, d.state]));
  assert.equal(byName.get('intent-integrity'), 'SATISFIED');
  assert.equal(byName.get('historical-support'), 'SATISFIED');
  assert.equal(byName.get('stability'), 'SATISFIED');
  assert.equal(byName.get('freshness'), 'SATISFIED');
  assert.equal(byName.get('authority-compliance'), 'SATISFIED');
});

test('an insufficient ABL intent is deficient in evidence dimensions', () => {
  const dimensions = dimensionsOf(ablIntentResult());
  const byName = new Map(dimensions.map((d) => [d.dimension, d.state]));
  assert.equal(byName.get('evidence-quality'), 'DEFICIENT');
  assert.equal(byName.get('sample-adequacy'), 'DEFICIENT');
});

test('a restricted intent limits the restriction-burden dimension', () => {
  const dimensions = dimensionsOf(liqIntentResult());
  const byName = new Map(dimensions.map((d) => [d.dimension, d.state]));
  assert.equal(byName.get('restriction-burden'), 'LIMITED');
});

test('a single-flag dependency limits the dependency dimensions', () => {
  const dimensions = dimensionsOf(venueOnlyIntentResult());
  const byName = new Map(dimensions.map((d) => [d.dimension, d.state]));
  assert.equal(byName.get('dependency-completeness'), 'LIMITED');
  assert.equal(byName.get('venue-compatibility'), 'LIMITED');
  assert.equal(byName.get('regime-compatibility'), 'SATISFIED');
});

test('the historical-support dimension honors the configured threshold',
  () => {
    const dimensions = dimensionsOf(cleanIntentResult());
    const support = dimensions.find((d) =>
      d.dimension === 'historical-support');
    assert.ok(support !== undefined);
  });

test('a heavier restriction set can drive the burden dimension deficient',
  () => {
    const heavy = frozenIntentClone(liqIntentResult(), (draft) => {
      draft.restrictions.push({code: 'RESEARCH_REQUIRED',
        reason: 'probe', scope: 'EVIDENCE', source: 'INTENT',
        restrictionId: 'sres_probe_a'});
      draft.restrictions.push({code: 'REGIME_LIMITED',
        reason: 'probe', scope: 'EVIDENCE', source: 'INTENT',
        restrictionId: 'sres_probe_b'});
      draft.restrictions.push({code: 'STRATEGY_LIMITED',
        reason: 'probe', scope: 'EVIDENCE', source: 'INTENT',
        restrictionId: 'sres_probe_c'});
      draft.restrictions.push({code: 'VENUE_LIMITED',
        reason: 'probe', scope: 'EVIDENCE', source: 'INTENT',
        restrictionId: 'sres_probe_d'});
      draft.restrictions.push({code: 'LEAKAGE_WARNING',
        reason: 'probe', scope: 'EVIDENCE', source: 'INTENT',
        restrictionId: 'sres_probe_e'});
    });
    const dimensions = dimensionsOf(heavy);
    const burden = dimensions.find((d) =>
      d.dimension === 'restriction-burden');
    assert.ok(burden !== undefined);
    assert.ok(['LIMITED', 'DEFICIENT'].includes(burden.state));
  });

test('the portfolio-interface dimension records the AFIS plane', () => {
  const dimensions = dimensionsOf(cleanIntentResult());
  const domain = dimensions.find((d) =>
    d.dimension === 'portfolio-interface-compatibility');
  assert.ok(domain !== undefined);
  assert.ok(domain.detail.includes('AFIS'));
});

test('the portfolio-interface dimension records the ABL plane', () => {
  const dimensions = dimensionsOf(cleanAblIntentResult());
  const domain = dimensions.find((d) =>
    d.dimension === 'portfolio-interface-compatibility');
  assert.ok(domain !== undefined);
  assert.ok(domain.detail.includes('ABL'));
});

// ---------------------------------------------------------------------------
// Restriction analysis (§16)
// ---------------------------------------------------------------------------

test('every intent restriction is carried verbatim', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    ablIntentResult(), venueOnlyIntentResult(),
    researchEscalatedIntentResult()]) {
    const restrictions = analyzeRestrictions(intent);
    for (const intentRestriction of intent.restrictions) {
      const carried = restrictions.find((r) =>
        r.code === intentRestriction.code);
      assert.ok(carried !== undefined,
        `${intentRestriction.code} is carried`);
      assert.equal(carried.reason, intentRestriction.reason);
      assert.equal(carried.source, 'INTENT');
    }
  }
});

test('the derived downstream boundary restriction is always added', () => {
  for (const intent of [cleanIntentResult(), ablIntentResult()]) {
    const restrictions = analyzeRestrictions(intent);
    const boundary = restrictions.find((r) =>
      r.code === 'DOWNSTREAM_CONSIDERATION_ONLY');
    assert.ok(boundary !== undefined);
    assert.equal(boundary.source, 'EVALUATION');
    assert.ok(boundary.reason.includes('consideration'));
  }
});

test('restrictions are canonically ordered and unique', () => {
  const restrictions = analyzeRestrictions(liqIntentResult());
  const codes = restrictions.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  const ranks = codes.map((code) =>
    (EVALUATION_RESTRICTION_CODES as readonly string[])
      .indexOf(code));
  for (let index = 1; index < ranks.length; index++) {
    assert.ok(ranks[index - 1] < ranks[index]);
  }
});

test('restriction counts grow, never shrink', () => {
  for (const [intent, evaluation] of [
    [cleanIntentResult(), cleanEvaluationResult()],
    [liqIntentResult(), restrictedEvaluationResult()],
  ] as const) {
    assert.ok(evaluation.restrictions.length
      >= intent.restrictions.length);
  }
});

test('every restriction carries a non-empty reason', () => {
  for (const restriction of analyzeRestrictions(liqIntentResult())) {
    assert.ok(restriction.reason.length > 0);
  }
});

test('an unknown restriction code fails closed', () => {
  const forged = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft.restrictions[0] as {code: string}).code = 'MAGIC';
  });
  assert.throws(() => analyzeRestrictions(forged),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'RESTRICTION_INCONSISTENCY');
});

test('the informational baseline is always present', () => {
  for (const intent of [cleanIntentResult(), ablIntentResult()]) {
    const codes = analyzeRestrictions(intent)
      .map((r) => r.code);
    for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
      'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION']) {
      assert.ok(codes.includes(baseline as never), baseline);
    }
  }
});

test('restriction analysis is deterministic', () => {
  const first = analyzeRestrictions(liqIntentResult());
  const second = analyzeRestrictions(liqIntentResult());
  assert.deepEqual(first, second);
});

test('preserving intent restrictions is the default configuration', () => {
  assert.equal(config.preserveAllIntentRestrictions, true);
  const restrictions = analyzeRestrictions(liqIntentResult());
  assert.ok(restrictions.length > liqIntentResult().restrictions.length);
});

test('the evaluation result mirrors the analyzed restrictions', () => {
  const result = restrictedEvaluationResult();
  const restrictions = analyzeRestrictions(liqIntentResult());
  assert.deepEqual(result.restrictions.map((r) => r.code),
    restrictions.map((r) => r.code));
});

test('restriction objects are frozen in the result', () => {
  for (const restriction of restrictedEvaluationResult().restrictions) {
    assert.ok(Object.isFrozen(restriction));
  }
});

test('a cloned intent does not leak into memoized results', () => {
  const intentCount = cleanIntentResult().restrictions.length;
  const evaluationCount = cleanEvaluationResult().restrictions.length;
  assert.ok(evaluationCount > intentCount);
  const clone = evaluationClone(cleanIntentResult());
  assert.equal(clone.restrictions.length, intentCount);
  assert.equal(cleanEvaluationResult().restrictions.length,
    evaluationCount);
});
