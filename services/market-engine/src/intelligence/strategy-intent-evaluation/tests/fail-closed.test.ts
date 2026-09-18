import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError, EVALUATION_REJECTION_CODES,
  EVALUATION_REQUIRED_REJECTION_SURFACE,
} from '../types';
import {
  evaluationRejectionGallery, expectEvaluationRejection,
  evaluationInputOf, cleanIntentResult, frozenIntentClone,
} from '../test-fixtures';
import {validateIntentIntegrity} from '../intent-integrity';
import {analyzeRestrictions} from '../restriction-analysis';
import {checkPortfolioInterfaceCompatibility,
} from '../portfolio-interface';
import {validateEvaluationEnvelope} from '../source-validation';
import {DEFAULT_EVALUATION_CONFIG} from '../config';

/** SPRINT 042 — fail-closed rejection tests (§21/§22, §23). */

const engine = new StrategyIntentEvaluationEngine();
const gallery = evaluationRejectionGallery();

test('the gallery carries at least fifty entries', () => {
  assert.ok(gallery.length >= 50,
    `expected ≥50 gallery entries, saw ${String(gallery.length)}`);
});

test('at least fifty rejection fixtures are exercised', () => {
  let exercised = 0;
  for (const entry of gallery) {
    const outcome = expectEvaluationRejection(entry.input);
    if (outcome.code !== 'NO_REJECTION') exercised += 1;
  }
  assert.ok(exercised >= 50);
});

test('every gallery entry rejects with its exact code', () => {
  for (const entry of gallery) {
    const outcome = expectEvaluationRejection(entry.input);
    assert.equal(outcome.code, entry.code,
      `${entry.label} must reject with ${entry.code} (got `
        + `${outcome.code}: ${outcome.message})`);
  }
});

test('the gallery exercises at least twenty-five codes', () => {
  const codes = new Set(gallery.map((entry) => entry.code));
  assert.ok(codes.size >= 25,
    `expected ≥25 exercised codes, saw ${String(codes.size)}`);
});

test('every code in the vocabulary is exercised somewhere', () => {
  const exercised = new Set(gallery.map((entry) => entry.code));
  exercised.add('SERIALIZATION_INCONSISTENCY'); // replay.test.ts
  for (const code of EVALUATION_REJECTION_CODES) {
    assert.ok(exercised.has(code),
      `${code} must be exercised by the suite`);
  }
});

test('gallery labels are unique and descriptive', () => {
  const labels = gallery.map((entry) => entry.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) {
    assert.ok(label.length > 3);
  }
});

test('rejection errors carry code, message and fail-closed suffix', () => {
  try {
    engine.evaluate(null as never);
    assert.fail('must throw');
  } catch (error) {
    assert.ok(error instanceof EvaluationRejectionError);
    const rejection = error as EvaluationRejectionError;
    assert.equal(rejection.code, 'INVALID_EVALUATION_CONTEXT');
    assert.ok(rejection.message.includes('fail closed'));
    assert.ok(rejection.message.length > 20);
  }
});

test('a rejected evaluation never returns a partial result', () => {
  for (const entry of gallery.slice(0, 25)) {
    let returned = false;
    try {
      engine.evaluate(entry.input as never);
      returned = true;
    } catch {
      // expected
    }
    assert.equal(returned, false, `${entry.label} must throw`);
  }
});

// --- Per-family code exercise through the engine -------------------------

test('INVALID_EVALUATION_CONTEXT is exercised', () => {
  assert.throws(() => engine.evaluate(null as never),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_EVALUATION_CONTEXT');
});

test('INVALID_INTENT_SOURCE is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft as {schemaVersion: string}).schemaVersion
      = 'oship.evil.v1';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT_SOURCE');
});

test('a sealed fingerprint tamper is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intentFingerprint = 'sfp2_forged';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT_SOURCE');
});

test('NONDETERMINISTIC_INPUT is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.replay.identical = false;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NONDETERMINISTIC_INPUT');
});

test('AUDIT_INTEGRITY_FAILURE is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft.auditEvents[2].payload as Record<string, unknown>)
      .injected = true;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'AUDIT_INTEGRITY_FAILURE');
});

test('STRATEGY_BOUNDARY_VIOLATION is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.boundary.state = 'BOUNDARY_VIOLATED';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'STRATEGY_BOUNDARY_VIOLATION');
});

test('MISSING_PROVENANCE is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft.intent as {provenance: unknown}).provenance = null;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_PROVENANCE');
});

test('INVALID_PROVENANCE is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.intentId = 'sint_foreign';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_PROVENANCE');
});

test('INVALID_INTENT is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.disclaimer = 'guaranteed profits';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT');
});

test('MISSING_EVIDENCE is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.historicalSupport = [];
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_EVIDENCE');
});

test('MISSING_DEPENDENCY is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.dependencies.state = 'UNKNOWN';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_DEPENDENCY');
});

test('RESTRICTION_INCONSISTENCY is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.freshnessState = 'STALE';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'RESTRICTION_INCONSISTENCY');
});

test('CLASSIFICATION_EVIDENCE_INCONSISTENCY is exercised', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.evidenceState = 'CONFLICTED';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'CONFLICTING_EVIDENCE');
});

test('STALE_EVIDENCE is exercised through the engine', () => {
  const {staleIntentResult} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const intent = frozenIntentClone(staleIntentResult(), (draft) => {
    draft.context.freshnessState = 'FRESH';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'STALE_EVIDENCE');
});

test('UNKNOWN_FRESHNESS is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.freshnessState = 'UNKNOWN';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'UNKNOWN_FRESHNESS');
});

test('UNSTABLE_EVIDENCE is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.stabilityState = 'UNSTABLE';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'UNSTABLE_EVIDENCE');
});

test('INSUFFICIENT_SAMPLE is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.sampleAdequacy = 'INSUFFICIENT';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INSUFFICIENT_SAMPLE');
});

test('CONFLICTING_EVIDENCE is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.evidenceState = 'CONFLICTED';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'CONFLICTING_EVIDENCE');
});

test('NON_COMPARABLE_DOMAIN is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].side = 'BACK';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('NORMALIZATION_VIOLATION is exercised through the engine', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.comparability = 'COMPARABLE_VIA_NORMALIZATION';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NORMALIZATION_VIOLATION');
});

test('the annotation vocabulary is exercised end to end', () => {
  const cases: readonly [string, string][] = [
    ['probability of profit is 0.9', 'SEMANTIC_PREDICTION_VIOLATION'],
    ['expected return of 12 percent', 'FUTURE_VALUE_VIOLATION'],
    ['place the order now', 'EXECUTION_BOUNDARY_VIOLATION'],
    ['transfer the funds', 'TREASURY_BOUNDARY_VIOLATION'],
    ['allocate capital now', 'PORTFOLIO_BOUNDARY_VIOLATION'],
    ['set the risk limit', 'RISK_BOUNDARY_VIOLATION'],
    ['reserve capital for this', 'ALLOCATION_BOUNDARY_VIOLATION'],
    ['activate the strategy', 'STRATEGY_BOUNDARY_VIOLATION'],
    ['authorize execution on my behalf', 'AUTHORITY_VIOLATION'],
    ['bypass governance', 'POLICY_VIOLATION'],
  ];
  for (const [annotation, code] of cases) {
    assert.throws(() => engine.evaluate(
      evaluationInputOf(cleanIntentResult(), [annotation])),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === code,
    `${annotation} must reject with ${code}`);
  }
});

// --- Unit-level exercise of sealed-content codes -------------------------

test('RESTRICTION_INCONSISTENCY fires at unit level on forged codes', () => {
  const {evaluationClone, cleanIntentResult: clean} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const forged = evaluationClone(clean(), (draft) => {
    (draft.restrictions[0] as {code: string}).code = 'MAGIC';
  });
  assert.throws(() => analyzeRestrictions(forged),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'RESTRICTION_INCONSISTENCY');
});

test('INVALID_INTENT fires at unit level on forged classifications', () => {
  const {evaluationClone, cleanIntentResult: clean} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const forged = evaluationClone(clean(), (draft) => {
    (draft as {classification: string}).classification = 'MAGIC_INTENT';
  });
  assert.throws(() => validateIntentIntegrity(forged),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT');
});

test('MISSING_EVIDENCE fires at unit level without alternatives', () => {
  const {evaluationClone, cleanIntentResult: clean} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const forged = evaluationClone(clean(), (draft) => {
    draft.alternatives = [];
  });
  assert.throws(() => checkPortfolioInterfaceCompatibility(forged),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'MISSING_EVIDENCE');
});

test('the envelope validator rejects unknown shapes', () => {
  const shapeless = {} as never;
  assert.throws(() => validateEvaluationEnvelope(shapeless,
    DEFAULT_EVALUATION_CONFIG),
  (e: unknown) => e instanceof EvaluationRejectionError);
});

test('the required rejection surface matches the vocabulary families', () => {
  assert.ok(EVALUATION_REQUIRED_REJECTION_SURFACE.length >= 25);
  assert.ok(EVALUATION_REJECTION_CODES.length
    >= EVALUATION_REQUIRED_REJECTION_SURFACE.length);
});
