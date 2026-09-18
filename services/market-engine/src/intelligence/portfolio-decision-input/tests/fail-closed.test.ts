import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  inputRejectionGallery, expectInputRejection, cleanEvaluationResult,
  bridgeInputOf, assertInputRejects, staleStrategyConstraint,
  knownExposureConstraint, INPUT_REJECTION_CODE_LIST,
} from './fail-closed-gallery';
import {validateInputIntegrity} from '../input-integrity';
import {assignDownstreamEligibility} from '../eligibility';
import {serializePortfolioDecisionInput} from '../replay';
import {PortfolioDecisionInputEngine} from '../engine';
import {PortfolioDecisionInputAuditLog} from '../audit';
import {buildInputProvenance} from '../provenance';
import {assertNoRestrictionLoss, collectInputRestrictions}
  from '../restrictions';
import {INPUT_REJECTION_CODES} from '../types';

/**
 * SPRINT 043 — fail-closed rejection coverage (§20): every rejection
 * code is explicitly exercised; the bridge never falls back silently.
 */

const engine = new PortfolioDecisionInputEngine();

test('fail-closed: the rejection vocabulary has exactly 39 codes', () => {
  assert.equal(INPUT_REJECTION_CODES.length, 39);
});

test('fail-closed: every gallery fixture rejects with its exact code',
  () => {
    const gallery = inputRejectionGallery();
    assert.ok(gallery.length >= 40,
      `expected at least 40 gallery fixtures, found `
        + `${String(gallery.length)}`);
    for (const fixture of gallery) {
      const verdict = expectInputRejection(fixture.input,
        fixture.configInput);
      assert.equal(verdict.code, fixture.code,
        `${fixture.label}: expected ${fixture.code}, got `
          + `${verdict.code} (${verdict.message})`);
    }
  });

test('fail-closed: rejection messages carry the code and fail-closed',
  () => {
    for (const fixture of inputRejectionGallery().slice(0, 10)) {
      const verdict = expectInputRejection(fixture.input,
        fixture.configInput);
      assert.ok(verdict.message.includes(fixture.code));
      assert.ok(verdict.message.includes('fail closed'));
    }
  });

/** Codes exercised outside the engine gallery (unit-level surfaces). */
test('fail-closed: RESTRICTION_LOSS rejects on a dropped code', () => {
  const evaluation = cleanEvaluationResult();
  const collected = collectInputRestrictions(evaluation, []);
  assertInputRejects('RESTRICTION_LOSS', () =>
    assertNoRestrictionLoss(evaluation.restrictions,
      collected.slice(1)));
});

test('fail-closed: SERIALIZATION_VIOLATION rejects on a non-object',
  () => {
    assertInputRejects('SERIALIZATION_VIOLATION', () =>
      serializePortfolioDecisionInput(null as never));
    assertInputRejects('SERIALIZATION_VIOLATION', () =>
      serializePortfolioDecisionInput('contract' as never));
  });

test('fail-closed: AUDIT_VIOLATION rejects on an unknown event type',
  () => {
    const log = new PortfolioDecisionInputAuditLog('pdi_test', 1);
    assertInputRejects('AUDIT_VIOLATION', () =>
      log.append('funds-moved' as never, {}));
  });

test('fail-closed: MISSING_PROVENANCE rejects on an empty input id',
  () => {
    assertInputRejects('MISSING_PROVENANCE', () =>
      buildInputProvenance(cleanEvaluationResult(), ''));
  });

test('fail-closed: CLASSIFICATION_EVIDENCE_INCONSISTENCY rejects on an '
  + 'unknown evaluation classification', () => {
  assertInputRejects('CLASSIFICATION_EVIDENCE_INCONSISTENCY', () =>
    validateInputIntegrity({classification: 'EVALUATION_MIRACLE',
      eligibility: 'BLOCKED', restrictions: [], evaluationContext:
      {dependencyState: 'INDEPENDENT'}} as never));
});

test('fail-closed: ELIGIBILITY_EVIDENCE_INCONSISTENCY rejects on an '
  + 'unknown input classification', () => {
  assertInputRejects('ELIGIBILITY_EVIDENCE_INCONSISTENCY', () =>
    assignDownstreamEligibility('INPUT_MIRACLE' as never));
});

test('fail-closed: STALE_CONSTRAINT rejects under the REJECT policy',
  () => {
    const strict = new PortfolioDecisionInputEngine(
      {staleConstraintPolicy: 'REJECT'});
    assertInputRejects('STALE_CONSTRAINT', () =>
      strict.present(bridgeInputOf(cleanEvaluationResult(),
        [staleStrategyConstraint()])));
  });

test('fail-closed: MISSING_EVIDENCE rejects on an allowed evaluation '
  + 'without alternatives', () => {
  const evaluation = cleanEvaluationResult();
  const doctored = {...evaluation,
    acceptableAlternativeIds: [] as never,
    preferredAlternativeId: null,
  } as never;
  assertInputRejects('MISSING_EVIDENCE', () =>
    validateInputIntegrity(doctored));
});

test('fail-closed: every one of the 39 codes is exercised somewhere',
  () => {
    const exercised = new Set<string>([
      ...inputRejectionGallery().map((fixture) => fixture.code),
      // Unit-level surfaces below.
      'RESTRICTION_LOSS', 'SERIALIZATION_VIOLATION', 'AUDIT_VIOLATION',
      'MISSING_PROVENANCE', 'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      'ELIGIBILITY_EVIDENCE_INCONSISTENCY', 'STALE_CONSTRAINT',
      'MISSING_EVIDENCE',
    ]);
    for (const code of INPUT_REJECTION_CODES) {
      assert.ok(exercised.has(code),
        `rejection code ${code} is never exercised — fail closed`);
    }
  });

test('fail-closed: the gallery covers every rejection family', () => {
  const families = [
    ['INVALID_INPUT_CONTEXT', 'MISSING_EVALUATION', 'INVALID_EVALUATION',
      'EVALUATION_MISMATCH'],
    ['MISSING_PROVENANCE', 'INVALID_PROVENANCE',
      'PROVENANCE_SUBSTITUTION'],
    ['MISSING_EVIDENCE', 'STALE_EVIDENCE', 'UNKNOWN_FRESHNESS',
      'UNSTABLE_EVIDENCE', 'INSUFFICIENT_EVIDENCE',
      'CONFLICTING_EVIDENCE', 'NOT_COMPARABLE'],
    ['RESTRICTION_LOSS', 'RESTRICTION_INCONSISTENCY'],
    ['MISSING_DEPENDENCY', 'INVALID_DEPENDENCY'],
    ['UNKNOWN_CONSTRAINT', 'CONFLICTED_CONSTRAINT', 'STALE_CONSTRAINT',
      'CONSTRAINT_MISMATCH', 'MISSING_CONSTRAINT_AUTHORITY'],
    ['PORTFOLIO_BOUNDARY_VIOLATION', 'RISK_BOUNDARY_VIOLATION',
      'ALLOCATION_BOUNDARY_VIOLATION', 'STRATEGY_BOUNDARY_VIOLATION',
      'AEGIS_BOUNDARY_VIOLATION', 'TREASURY_BOUNDARY_VIOLATION',
      'EXECUTION_BOUNDARY_VIOLATION'],
    ['SEMANTIC_PREDICTION_VIOLATION', 'FUTURE_VALUE_VIOLATION',
      'NORMALIZATION_VIOLATION', 'SERIALIZATION_VIOLATION',
      'AUDIT_VIOLATION'],
    ['CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      'ELIGIBILITY_EVIDENCE_INCONSISTENCY', 'AUTHORITY_MISMATCH',
      'NONDETERMINISTIC_INPUT'],
  ].flat();
  const galleryCodes = new Set<string>(inputRejectionGallery().map(
    (fixture) => fixture.code));
  for (const code of families) {
    if (['RESTRICTION_LOSS', 'SERIALIZATION_VIOLATION',
      'AUDIT_VIOLATION', 'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      'ELIGIBILITY_EVIDENCE_INCONSISTENCY', 'MISSING_EVIDENCE']
      .includes(code)) {
      continue;
    }
    assert.ok(galleryCodes.has(code),
      `gallery must cover ${code}`);
  }
});

test('fail-closed: a second engine instance rejects identically', () => {
  const fixture = inputRejectionGallery()[0];
  const first = expectInputRejection(fixture.input,
    fixture.configInput);
  const second = expectInputRejection(fixture.input,
    fixture.configInput);
  assert.equal(first.code, second.code);
  assert.equal(first.message, second.message);
});

test('fail-closed: rejection is deterministic across the gallery', () => {
  for (const fixture of inputRejectionGallery()) {
    const first = expectInputRejection(fixture.input,
      fixture.configInput);
    const second = expectInputRejection(fixture.input,
      fixture.configInput);
    assert.equal(first.code, second.code);
    assert.equal(first.message, second.message,
      `${fixture.label} must reject deterministically`);
  }
});

test('fail-closed: constraints reject before classification runs', () => {
  // A hostile constraint over a clean evaluation never reaches the
  // classification stage.
  assertInputRejects('CONFLICTED_CONSTRAINT', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('AFIS', 's', 1),
        knownExposureConstraint('AFIS', 's', 2)])));
});

test('fail-closed: no rejection silently succeeds', () => {
  const verdict = expectInputRejection(bridgeInputOf(
    cleanEvaluationResult()));
  assert.equal(verdict.code, 'NO_REJECTION');
});

test('fail-closed: the gallery labels are unique', () => {
  const labels = inputRejectionGallery().map((fixture) =>
    fixture.label);
  assert.equal(new Set(labels).size, labels.length);
});
