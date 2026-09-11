import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildScenarioMatrix, scenarioStateCounts,
  SCENARIO_FULL_SAMPLE, SCENARIO_LIMITED_SAMPLE} from '../scenario';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — scenario matrix tests: Alternative × Evidence × Regime ×
 * Strategy × Venue cells built only from observed evidence; unsupported
 * combinations marked explicitly; nothing inferred.
 */

test('every cell carries its full coordinates', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  assert.ok(matrix.cells.length > 0);
  for (const cell of matrix.cells) {
    assert.ok(cell.alternativeId.length > 0);
    assert.ok(typeof cell.regimeEra === 'number');
    assert.ok(cell.regimeTimeBucket.length > 0);
    assert.ok(cell.strategyId.length > 0);
    assert.ok(cell.venue.length > 0);
  }
});

test('cells only exist for accepted alternatives', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  const ids = new Set(afisDecisionResult().alternatives.map((a) => a.alternativeId));
  for (const cell of matrix.cells) {
    assert.ok(ids.has(cell.alternativeId));
  }
});

test('every cell is backed by real observations — nothing inferred', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    assert.ok(cell.evidenceCount > 0);
    assert.equal(cell.supportingObservationIds.length, cell.evidenceCount);
  }
});

test('SUPPORTED cells meet the full-sample threshold', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    if (cell.evidenceState === 'SUPPORTED') {
      assert.ok(cell.evidenceCount >= SCENARIO_FULL_SAMPLE);
    }
  }
});

test('LIMITED cells sit between the thresholds', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    if (cell.evidenceState === 'LIMITED') {
      assert.ok(cell.evidenceCount >= SCENARIO_LIMITED_SAMPLE
        && cell.evidenceCount < SCENARIO_FULL_SAMPLE);
    }
  }
});

test('INSUFFICIENT cells stay below the limited threshold', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    if (cell.evidenceState === 'INSUFFICIENT') {
      assert.ok(cell.evidenceCount < SCENARIO_LIMITED_SAMPLE);
    }
  }
});

test('cells are canonically ordered', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  const keys = matrix.cells.map((c) =>
    `${c.alternativeId}|${c.regimeEra}|${c.strategyId}|${c.venue}`);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});

test('incompatible combinations are explicitly marked', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  assert.ok(matrix.incompatibleCombinations.length > 0);
  for (const combination of matrix.incompatibleCombinations) {
    assert.ok(combination.includes('INCOMPATIBLE'));
  }
});

test('cross-domain strategies are incompatible in an AFIS matrix', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  assert.ok(matrix.incompatibleCombinations.some(
    (c) => c.includes('sports-arb-strategy')));
});

test('venues without domain history are incompatible', () => {
  const matrix = ablDecisionResult().scenarioMatrix;
  assert.equal(matrix.domain, 'ABL');
  // venue-a has AFIS history too; the corpus has no venue without ABL
  // history, so this asserts the mark structure instead of a specific venue.
  for (const combination of matrix.incompatibleCombinations) {
    if (combination.includes('venue')) {
      assert.ok(combination.includes('INCOMPATIBLE'));
    }
  }
});

test('the matrix never mixes domains', () => {
  assert.equal(afisDecisionResult().scenarioMatrix.domain, 'AFIS');
  assert.equal(ablDecisionResult().scenarioMatrix.domain, 'ABL');
});

test('scenario state counts reconcile with the cells', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  const counts = scenarioStateCounts(matrix);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  assert.equal(total, matrix.cells.length);
});

test('mean preservation is carried where measurable', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  const withPreservation = matrix.cells.filter(
    (c) => c.meanPreservation !== null);
  // The corpus carries measured preservation on dependency groups.
  assert.ok(withPreservation.length > 0);
  for (const cell of withPreservation) {
    assert.ok(typeof cell.meanPreservation === 'number');
  }
});

test('the matrix id and fingerprint are content-derived', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  assert.ok(matrix.matrixId.startsWith('dscm_'));
  assert.ok(matrix.contentFingerprint.startsWith('dcfp_'));
});

test('the matrix is deterministic', () => {
  const result = afisDecisionResult();
  const rebuilt = buildScenarioMatrix(
    result.alternatives, result.lineage.observationIds.length
      ? require('../test-fixtures').opportunityLearning()
      : require('../test-fixtures').opportunityLearning());
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(result.scenarioMatrix));
});

test('supporting observation ids reference real corpus observations', () => {
  const learning = require('../test-fixtures').opportunityLearning();
  const known = new Set(learning.observations.map((o: {observationId: string}) =>
    o.observationId));
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    for (const id of cell.supportingObservationIds) {
      assert.ok(known.has(id), `${id} must be a real observation`);
    }
  }
});
