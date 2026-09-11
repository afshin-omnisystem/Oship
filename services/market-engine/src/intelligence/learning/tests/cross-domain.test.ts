import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {buildCohorts, rawCrossDomainCohort} from '../cohort';
import {domainNormalizedBaseline, historicalBaseline} from '../baseline';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — cross-domain tests (§21): raw economic comparisons between
 * AFIS and ABL are prohibited; normalized comparisons only under explicit
 * conditions, else NOT_COMPARABLE.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

test('the raw cross-domain cohort is NOT_COMPARABLE with an explicit reason', () => {
  const raw = rawCrossDomainCohort(observations, config);
  assert.equal(raw.comparable, false);
  assert.equal(raw.domains.length, 2);
  assert.ok(raw.notComparableReasons.some(
    (r) => r.includes('never comparable') && r.includes('normalization')));
});

test('the raw cohort is built from both domains deterministically', () => {
  const a = rawCrossDomainCohort(observations, config);
  const b = rawCrossDomainCohort([...observations].reverse(), config);
  assert.equal(a.cohortId, b.cohortId);
  assert.equal(a.sampleSize, 6);
  assert.deepEqual(a.domains, ['ABL', 'AFIS']);
});

test('no comparable cohort in the result mixes domains raw', () => {
  for (const cohort of engineResult.cohorts) {
    if (cohort.domains.length > 1) {
      assert.equal(cohort.comparable, false, cohort.dimension + ':' + cohort.key);
    }
  }
});

test('the DOMAIN dimension produces per-domain cohorts, comparable within one domain', () => {
  const domainCohorts = engineResult.cohorts.filter((c) => c.dimension === 'DOMAIN');
  assert.equal(domainCohorts.length, 2);
  for (const cohort of domainCohorts) {
    assert.equal(cohort.domains.length, 1);
    assert.equal(cohort.comparable, true, cohort.key);
  }
});

test('the domain-normalized baseline is the explicit normalization path', () => {
  const normalized = domainNormalizedBaseline(observations, 'preservation', config);
  assert.equal(normalized.kind, 'DOMAIN_NORMALIZED');
  const afisMean = historicalBaseline(
    observations.filter((o) => o.domain === 'AFIS'), 'preservation', config).meanValue!;
  const ablMean = historicalBaseline(
    observations.filter((o) => o.domain === 'ABL'), 'preservation', config).meanValue!;
  assert.ok(Math.abs((normalized.meanValue ?? 0) - (afisMean + ablMean) / 2) < 0.001);
});

test('the domain-normalized baseline records its MIXED scope explicitly', () => {
  const normalized = domainNormalizedBaseline(observations, 'preservation', config);
  assert.equal(normalized.kind, 'DOMAIN_NORMALIZED');
  assert.equal(normalized.scopeDomain, 'MIXED');
  assert.equal(normalized.subject, null);
});

test('single-domain strategy cohorts stay comparable; only raw-mixed does not', () => {
  const strategyCohorts = engineResult.cohorts.filter((c) => c.dimension === 'STRATEGY');
  assert.equal(strategyCohorts.length, 4);
  for (const cohort of strategyCohorts) {
    if (cohort.key === 'raw-mixed') {
      assert.equal(cohort.comparable, false);
      assert.equal(cohort.domains.length, 2);
    } else {
      assert.equal(cohort.domains.length, 1, cohort.key);
      assert.equal(cohort.comparable, true, cohort.key);
    }
  }
});

test('opportunity learnings never compare across domains raw', () => {
  for (const learning of engineResult.opportunityLearning) {
    assert.ok(['AFIS', 'ABL'].includes(learning.domain));
  }
});

test('the CROSS_DOMAIN_COMPARABILITY invariant passes in the engine result', () => {
  const check = engineResult.invariants.checks.find(
    (c) => c.invariant === 'CROSS_DOMAIN_COMPARABILITY')!;
  assert.equal(check.passed, true);
  assert.match(check.detail, /no raw cross-domain economic comparison/);
});

test('per-dimension cohort rebuilds match the engine cohort set', () => {
  const dims = [...new Set(engineResult.cohorts.map((c) => c.dimension))] as never[];
  const rebuilt = [
    ...dims.flatMap((dim) => buildCohorts(observations, dim, config, dim === 'DOMAIN')),
    rawCrossDomainCohort(observations, config),
  ];
  assert.equal(rebuilt.length, engineResult.cohorts.length);
  assert.deepEqual(rebuilt.map((c) => c.cohortId).sort(),
    engineResult.cohorts.map((c) => c.cohortId).sort());
});

test('AFIS and ABL preservation are never averaged silently in learnings', () => {
  for (const learning of engineResult.strategyLearning) {
    // every strategy is single-domain; none is MIXED
    assert.ok(['AFIS', 'ABL'].includes(learning.domain));
  }
});

test('cross-domain comparability recommendations fire only for NOT_COMPARABLE strategies', () => {
  const comparability = engineResult.recommendations.filter(
    (r) => r.kind === 'REEXAMINE_COMPARABILITY');
  // no strategy in this corpus is NOT_COMPARABLE — so none fire
  assert.equal(comparability.length, 0);
  assert.equal(engineResult.strategyLearning.filter((s) => s.classification === 'NOT_COMPARABLE').length, 0);
});

test('the normalized baseline is fingerprinted and versioned like any baseline', () => {
  const normalized = domainNormalizedBaseline(observations, 'preservation', config);
  assert.equal(normalized.schemaVersion, 'learning.baseline.v1');
  assert.match(normalized.baselineId, /^lbs_[0-9a-f]{24}$/);
  assert.match(normalized.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
});

test('an empty cross-domain cohort fails closed, never compares', () => {
  const raw = rawCrossDomainCohort([], config);
  assert.equal(raw.sampleSize, 0);
  assert.equal(raw.comparable, false);
});
