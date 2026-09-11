import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {buildCohorts, rawCrossDomainCohort} from '../cohort';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';
import type {LearningObservation, OpportunityDomain} from '../types';

/**
 * SPRINT 037 — cohort engine tests (§5): deterministic construction with
 * comparability enforcement; invalid mixtures are NOT_COMPARABLE.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);

test('domain cohorts split AFIS and ABL', () => {
  const cohorts = buildCohorts(observations, 'DOMAIN', config);
  assert.equal(cohorts.length, 2);
  assert.deepEqual(cohorts.map((c) => c.key).sort(), ['ABL', 'AFIS']);
  assert.equal(cohorts.find((c) => c.key === 'AFIS')!.sampleSize, 60);
});

test('single-domain cohorts are comparable', () => {
  for (const cohort of buildCohorts(observations, 'DOMAIN', config)) {
    assert.equal(cohort.comparable, true);
    assert.deepEqual(cohort.notComparableReasons, []);
  }
});

test('strategy cohorts are domain-scoped keys', () => {
  const cohorts = buildCohorts(observations, 'STRATEGY', config);
  assert.equal(cohorts.length, 3);
  assert.deepEqual(cohorts.map((c) => c.key).sort(),
    ['ABL:sports-arb-strategy', 'AFIS:arb-aggressive', 'AFIS:arb-guardian']);
});

test('venue cohorts aggregate observations touching each venue', () => {
  const cohorts = buildCohorts(observations, 'VENUE', config);
  assert.equal(cohorts.length, 2);
  assert.equal(cohorts.find((c) => c.key === 'venue-a')!.sampleSize, 65);
});

test('time period cohorts cover the five eras', () => {
  const cohorts = buildCohorts(observations, 'TIME_PERIOD', config);
  assert.equal(cohorts.length, 5);
  assert.deepEqual(cohorts.map((c) => c.key), ['tb_657', 'tb_658', 'tb_659', 'tb_660', 'tb_661']);
});

test('evidence quality cohorts group by evidence state', () => {
  const cohorts = buildCohorts(observations, 'EVIDENCE_QUALITY', config);
  assert.ok(cohorts.length >= 1);
  for (const cohort of cohorts) {
    assert.match(cohort.key, /^(STRONG|MODERATE|WEAK|INSUFFICIENT|UNKNOWN|CONTRADICTORY|UNAVAILABLE)$/);
  }
});

test('execution mode cohorts group by outcome', () => {
  const cohorts = buildCohorts(observations, 'EXECUTION_MODE', config);
  assert.deepEqual(cohorts.map((c) => c.key).sort(),
    ['ABORTED', 'COMPLETED', 'EXHAUSTED']);
});

test('mixed-domain time-period cohorts are NOT_COMPARABLE with reasons', () => {
  const cohorts = buildCohorts(observations, 'TIME_PERIOD', config);
  const mixed = cohorts.filter((c) => c.domains.length > 1);
  assert.ok(mixed.length > 0);
  for (const cohort of mixed) {
    assert.equal(cohort.comparable, false);
    assert.ok(cohort.notComparableReasons.length > 0);
    assert.match(cohort.notComparableReasons[0], /without explicit normalization/);
  }
});

test('the raw cross-domain cohort is NOT_COMPARABLE by construction', () => {
  const raw = rawCrossDomainCohort(observations, config);
  assert.equal(raw.comparable, false);
  assert.ok(raw.domains.length > 1 || raw.sampleSize > 0);
  assert.ok(raw.notComparableReasons.length > 0);
});

test('below-floor cohorts carry INSUFFICIENT evidence, not silence', () => {
  const cohorts = buildCohorts(observations, 'OPPORTUNITY_CLASS', config);
  const small = cohorts.find((c) => c.sampleSize < config.minSampleSize);
  if (small) {
    assert.equal(small.evidenceState, 'INSUFFICIENT');
  }
});

test('cohort membership lists match sample sizes', () => {
  for (const cohort of buildCohorts(observations, 'STRATEGY', config)) {
    assert.equal(cohort.members.length, cohort.sampleSize);
    assert.equal(new Set(cohort.members).size, cohort.members.length);
  }
});

test('cohorts are deterministic across rebuilds', () => {
  const dims = ['DOMAIN', 'OPPORTUNITY_CLASS', 'STRATEGY', 'VENUE', 'POLICY',
    'EXECUTION_MODE', 'TIME_PERIOD', 'REGIME', 'EVIDENCE_QUALITY'] as const;
  for (const dim of dims) {
    const a = buildCohorts(observations, dim, config).map((c) => c.cohortId);
    const b = buildCohorts([...observations].reverse(), dim, config).map((c) => c.cohortId);
    assert.deepEqual(a, b, dim);
  }
});

test('cohorts are versioned and content-fingerprinted', () => {
  for (const cohort of buildCohorts(observations, 'DOMAIN', config)) {
    assert.equal(cohort.schemaVersion, 'learning.cohort.v1');
    assert.match(cohort.cohortId, /^lch_[0-9a-f]{24}$/);
    assert.match(cohort.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
  }
});

test('a synthetic mixed-domain cohort is rejected unless explicitly normalized', () => {
  const synthetic: LearningObservation[] = observations.filter(
    (o) => o.domain === ('AFIS' as OpportunityDomain)).slice(0, 3).concat(
    observations.filter((o) => o.domain === 'ABL').slice(0, 3));
  const raw = buildCohorts(synthetic, 'DOMAIN', config, false)
    .find((c) => c.domains.length > 1);
  if (raw) {
    assert.equal(raw.comparable, false);
    assert.ok(raw.notComparableReasons.length > 0);
  }
  const normalized = buildCohorts(synthetic, 'DOMAIN', config, true)
    .find((c) => c.domains.length > 1);
  if (normalized) {
    assert.equal(normalized.comparable, true);
  }
});
