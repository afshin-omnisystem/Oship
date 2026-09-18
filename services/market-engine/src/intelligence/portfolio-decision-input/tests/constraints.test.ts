import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, bridgeInputOf, knownExposureConstraint,
  knownConcentrationConstraint, knownOperationalConstraint,
  unknownVenueConstraint, staleStrategyConstraint,
  declarativeEvidenceConstraint, allKindsConstraints,
  standardConstraints, assertInputRejects, INPUT_FIXTURE_TIMESTAMP,
  domainOf,
} from '../test-fixtures';
import {validateCapitalConstraints, constraintSafetyOf,
  constraintSummaryOf,
} from '../constraints';
import {DEFAULT_INPUT_CONFIG, mergeInputConfig} from '../config';
import {PortfolioDecisionInputEngine} from '../engine';

const engine = new PortfolioDecisionInputEngine();
import {CAPITAL_CONSTRAINT_KINDS, CAPITAL_CONSTRAINT_AUTHORITIES,
  CAPITAL_CONSTRAINT_UNITS, CAPITAL_CONSTRAINT_KIND_UNITS,
} from '../types';

/**
 * SPRINT 043 — the capital-constraint contract (§5/§9/§10): transported
 * only, never computed; UNKNOWN ≠ zero ≠ unlimited; conflicts and
 * staleness fail closed or restrict per the explicit policy.
 */

test('constraints: nine kinds are in the vocabulary', () => {
  assert.equal(CAPITAL_CONSTRAINT_KINDS.length, 9);
  assert.deepEqual([...CAPITAL_CONSTRAINT_KINDS], [
    'ABSOLUTE_EXPOSURE_CAP', 'RELATIVE_CONCENTRATION_CAP', 'VENUE_CAP',
    'STRATEGY_CAP', 'REGIME_CAP', 'ASSET_MARKET_CAP', 'OPERATIONAL_CAP',
    'EVIDENCE_RESTRICTION', 'FRESHNESS_RESTRICTION']);
});

test('constraints: only existing authorities may supply constraints',
  () => {
    assert.deepEqual([...CAPITAL_CONSTRAINT_AUTHORITIES], ['RISK',
      'PORTFOLIO', 'ALLOCATION', 'TREASURY', 'GOVERNANCE']);
  });

test('constraints: four units are in the vocabulary', () => {
  assert.deepEqual([...CAPITAL_CONSTRAINT_UNITS], ['CURRENCY_UNITS',
    'FRACTION', 'COUNT', 'NONE']);
});

test('constraints: every kind declares its compatible units', () => {
  for (const kind of CAPITAL_CONSTRAINT_KINDS) {
    const units = CAPITAL_CONSTRAINT_KIND_UNITS.find(([candidate]) =>
      candidate === kind)?.[1];
    assert.ok(units !== undefined && units.length > 0,
      `kind ${kind} must declare units`);
  }
});

test('constraints: a known constraint transports as KNOWN', () => {
  const records = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'KNOWN');
  assert.equal(records[0].suppliedStatus, 'KNOWN');
  assert.equal(records[0].value, 250_000);
  assert.equal(records[0].unit, 'CURRENCY_UNITS');
  assert.equal(records[0].sourceAuthority, 'RISK');
});

test('constraints: the record id is content-derived', () => {
  const records = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.match(records[0].constraintId, /^pdcon_[0-9a-f]{24}$/);
});

test('constraints: identical supplies produce identical ids', () => {
  const first = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  const second = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(first[0].constraintId, second[0].constraintId);
});

test('constraints: records are frozen', () => {
  const records = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.ok(Object.isFrozen(records));
  assert.ok(Object.isFrozen(records[0]));
});

test('constraints: an UNKNOWN constraint stays UNKNOWN — never zero, '
  + 'never unlimited', () => {
  const records = validateCapitalConstraints([unknownVenueConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].status, 'UNKNOWN');
  assert.equal(records[0].value, null);
  assert.ok(records[0].reason.includes('never zero'));
  assert.ok(records[0].reason.includes('never unlimited'));
  assert.deepEqual([...records[0].restrictions],
    ['DOWNSTREAM_CONSIDERATION_ONLY', 'CAPACITY_UNKNOWN']);
});

test('constraints: an UNKNOWN constraint with a value rejects', () => {
  assertInputRejects('UNKNOWN_CONSTRAINT', () =>
    validateCapitalConstraints([{...unknownVenueConstraint(),
      value: 100}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: NOT_APPLICABLE carries no value', () => {
  const records = validateCapitalConstraints(
    [{...knownExposureConstraint(), status: 'NOT_APPLICABLE',
      value: null}],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].status, 'NOT_APPLICABLE');
  assert.equal(records[0].value, null);
});

test('constraints: NOT_APPLICABLE with a value rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      status: 'NOT_APPLICABLE'}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: declarative kinds carry unit NONE and no value', () => {
  const records = validateCapitalConstraints(
    [declarativeEvidenceConstraint()], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].unit, 'NONE');
  assert.equal(records[0].value, null);
  assert.equal(records[0].status, 'KNOWN');
});

test('constraints: a KNOWN declarative constraint with a value rejects',
  () => {
    assertInputRejects('CONSTRAINT_MISMATCH', () =>
      validateCapitalConstraints([{...declarativeEvidenceConstraint(),
        value: 5}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
      DEFAULT_INPUT_CONFIG));
  });

test('constraints: KNOWN numeric constraints require finite '
  + 'non-negative values', () => {
  for (const bad of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInputRejects('CONSTRAINT_MISMATCH', () =>
      validateCapitalConstraints([{...knownExposureConstraint(),
        value: bad}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
      DEFAULT_INPUT_CONFIG));
  }
});

test('constraints: FRACTION constraints never exceed one', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([knownConcentrationConstraint('AFIS',
      'x', 1.5)], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
  const records = validateCapitalConstraints(
    [knownConcentrationConstraint('AFIS', 'x', 1)],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].value, 1);
});

test('constraints: kind-unit incompatibility rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      unit: 'FRACTION'}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownOperationalConstraint(),
      unit: 'CURRENCY_UNITS', value: 5}], 'AFIS',
    INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
});

test('constraints: an unknown kind rejects', () => {
  assertInputRejects('UNKNOWN_CONSTRAINT', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      constraintKind: 'MAGIC_CAP'} as never], 'AFIS',
    INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
});

test('constraints: a non-existing authority rejects', () => {
  assertInputRejects('MISSING_CONSTRAINT_AUTHORITY', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      sourceAuthority: 'BRIDGE'} as never], 'AFIS',
    INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
});

test('constraints: a foreign domain rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([knownExposureConstraint('ABL')],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
});

test('constraints: BOTH applies to both domains', () => {
  for (const domain of ['AFIS', 'ABL'] as const) {
    const records = validateCapitalConstraints(
      [knownExposureConstraint('BOTH')], domain, INPUT_FIXTURE_TIMESTAMP,
      DEFAULT_INPUT_CONFIG);
    assert.equal(records.length, 1);
  }
});

test('constraints: a missing scope rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      scope: ''}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: a missing reason rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      reason: ''}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: a non-finite context timestamp rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints([{...knownExposureConstraint(),
      contextTimestamp: Number.NaN}], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: a non-object constraint rejects', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    validateCapitalConstraints(['cap'], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
});

test('constraints: same kind and scope with different values conflict',
  () => {
    assertInputRejects('CONFLICTED_CONSTRAINT', () =>
      validateCapitalConstraints([knownExposureConstraint('AFIS', 's', 1),
        knownExposureConstraint('AFIS', 's', 2)], 'AFIS',
      INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
  });

test('constraints: same kind and scope with different statuses conflict',
  () => {
    assertInputRejects('CONFLICTED_CONSTRAINT', () =>
      validateCapitalConstraints([knownExposureConstraint('AFIS', 's'),
        {...knownExposureConstraint('AFIS', 's'),
          status: 'UNKNOWN', value: null}], 'AFIS',
      INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG));
  });

test('constraints: same kind with different scopes do not conflict',
  () => {
    const records = validateCapitalConstraints(
      [knownExposureConstraint('AFIS', 's1'),
        knownExposureConstraint('AFIS', 's2')], 'AFIS',
      INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
    assert.equal(records.length, 2);
  });

test('constraints: identical duplicate supplies are accepted', () => {
  const records = validateCapitalConstraints(
    [knownExposureConstraint('AFIS', 's', 1),
      knownExposureConstraint('AFIS', 's', 1)], 'AFIS',
    INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records.length, 2);
});

test('constraints: a stale context marks the record STALE under RESTRICT',
  () => {
    const records = validateCapitalConstraints([staleStrategyConstraint()],
      'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
    assert.equal(records[0].status, 'STALE');
    assert.equal(records[0].suppliedStatus, 'KNOWN');
    assert.ok(records[0].reason.includes('stale'));
    assert.ok(records[0].restrictions.includes('NO_DECISION_AUTHORITY'));
  });

test('constraints: a stale context rejects under REJECT policy', () => {
  assertInputRejects('STALE_CONSTRAINT', () =>
    validateCapitalConstraints([staleStrategyConstraint()], 'AFIS',
      INPUT_FIXTURE_TIMESTAMP,
      mergeInputConfig({staleConstraintPolicy: 'REJECT'})));
});

test('constraints: a fresh context stays KNOWN', () => {
  const records = validateCapitalConstraints(
    [knownExposureConstraint()], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].status, 'KNOWN');
});

test('constraints: all nine kinds transport together', () => {
  const records = validateCapitalConstraints(allKindsConstraints('AFIS'),
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records.length, 9);
  assert.equal(new Set(records.map((record) =>
    record.constraintKind)).size, 9);
});

test('constraints: records sort deterministically by composite key',
  () => {
    const first = validateCapitalConstraints(allKindsConstraints('AFIS'),
      'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
    const second = validateCapitalConstraints(
      [...allKindsConstraints('AFIS')].reverse(), 'AFIS',
      INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
    assert.deepEqual(first.map((record) => record.constraintId),
      second.map((record) => record.constraintId));
  });

test('constraints: constraintSafetyOf summarizes the statuses', () => {
  const safety = constraintSafetyOf(validateCapitalConstraints(
    [knownExposureConstraint(), unknownVenueConstraint(),
      staleStrategyConstraint()], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
  assert.deepEqual(safety, {unknownCount: 1, staleCount: 1,
    knownCount: 1, notApplicableCount: 0});
});

test('constraints: constraintSummaryOf is audit-facing', () => {
  const summary = constraintSummaryOf(validateCapitalConstraints(
    [knownExposureConstraint()], 'AFIS', INPUT_FIXTURE_TIMESTAMP,
    DEFAULT_INPUT_CONFIG));
  assert.equal(summary.length, 1);
  assert.equal(summary[0].kind, 'ABSOLUTE_EXPOSURE_CAP');
  assert.equal(summary[0].status, 'KNOWN');
  assert.equal(summary[0].value, 250_000);
  assert.match(summary[0].constraintId, /^pdcon_/);
});

test('constraints: provenance pins the existing authority', () => {
  const records = validateCapitalConstraints([knownExposureConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].provenance.sourceAuthority, 'RISK');
  assert.equal(records[0].provenance.contextTimestamp,
    INPUT_FIXTURE_TIMESTAMP - 60_000);
  assert.equal(records[0].provenance.suppliedByExistingAuthority, true);
});

test('constraints: engine-level conflict rejection', () => {
  assertInputRejects('CONFLICTED_CONSTRAINT', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('AFIS', 's', 1),
        knownExposureConstraint('AFIS', 's', 2)])));
});

test('constraints: domainOf reads the fixture domain', () => {
  assert.equal(domainOf(cleanEvaluationResult()), 'AFIS');
});

test('constraints: standard constraints carry three known records',
  () => {
    const records = validateCapitalConstraints(
      standardConstraints('AFIS'), 'AFIS', INPUT_FIXTURE_TIMESTAMP,
      DEFAULT_INPUT_CONFIG);
    assert.equal(records.length, 3);
    assert.ok(records.every((record) => record.status === 'KNOWN'));
  });
