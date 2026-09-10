import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectPatterns, detectRejectionPatterns, strategyCompletionDivergence, consistentOutperformance} from '../pattern';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — pattern detection tests (§9): preservation trends, leakage
 * recurrence, strategy divergence, venue and policy patterns, failure
 * recurrence — every pattern carries evidence counts and confidence.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_pat_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const active = activeMemory(memory);
const patterns = detectPatterns(active, config);
const result = new ResearchEngine().analyze(history.input);

const find = (kind: string, key: string) => patterns.find((p) => p.kind === kind && p.subject.key === key);

test('patterns cover all six families', () => {
  const families = new Set(patterns.map((p) => p.family));
  for (const family of ['PRESERVATION', 'LEAKAGE', 'STRATEGY', 'VENUE', 'POLICY', 'FAILURE']) {
    assert.ok(families.has(family as never), `${family} patterns must be detected`);
  }
});

test('every pattern carries evidence memory ids, counts and confidence', () => {
  for (const pattern of patterns) {
    assert.ok(pattern.patternId.startsWith('pat_'));
    assert.ok(pattern.evidenceMemoryIds.length >= config.patternRecurrenceMinimum,
      `pattern ${pattern.kind} needs recurrence evidence`);
    assert.equal(pattern.sampleSize, pattern.evidenceMemoryIds.length);
    assert.ok(['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT', 'UNKNOWN', 'CONTRADICTORY', 'UNAVAILABLE']
      .includes(pattern.confidenceState));
    assert.ok(pattern.firstSeen <= pattern.lastSeen);
    assert.ok(Object.isFrozen(pattern));
  }
});

test('the guardian strategy improves across eras', () => {
  const improvement = find('PRESERVATION_IMPROVEMENT', 'arb-guardian');
  assert.ok(improvement, 'guardian improvement must be detected');
  assert.equal(improvement.direction, 'IMPROVING');
  assert.ok(improvement.magnitude >= config.improvementThreshold);
});

test('the aggressive strategy deteriorates across eras', () => {
  const deterioration = find('PRESERVATION_DETERIORATION', 'arb-aggressive');
  assert.ok(deterioration, 'aggressive deterioration must be detected');
  assert.equal(deterioration.direction, 'DETERIORATING');
  assert.ok(deterioration.magnitude <= -config.deteriorationThreshold);
});

test('steady series preserve consistently high value', () => {
  const steady = find('CONSISTENTLY_HIGH_PRESERVATION', 'opp_steady');
  assert.ok(steady);
  assert.equal(steady.magnitude, 1);
});

test('failed series are consistently low with repeated failure classes', () => {
  const oscillation = find('CONSISTENTLY_LOW_PRESERVATION', 'opp_oscillation');
  assert.ok(oscillation);
  const stale = find('CONSISTENTLY_LOW_PRESERVATION', 'opp_stale');
  assert.ok(stale);
  const failure = patterns.filter((p) => p.kind === 'REPEATED_FAILURE_CLASS');
  assert.ok(failure.length >= 3, 'the corpus has recurring failure classes');
  for (const pattern of failure) {
    assert.ok(pattern.subject.key.length > 0);
    assert.ok(pattern.sampleSize >= config.patternRecurrenceMinimum);
  }
});

test('leakage recurrence patterns fire for the dominant components', () => {
  const slippage = patterns.filter((p) => p.kind === 'REPEATED_SLIPPAGE');
  const fees = patterns.filter((p) => p.kind === 'REPEATED_FEES');
  const partial = patterns.filter((p) => p.kind === 'REPEATED_PARTIAL_FILL');
  assert.ok(slippage.length >= 5);
  assert.ok(fees.length >= 5);
  assert.ok(partial.length >= 3);
  for (const pattern of slippage) {
    assert.ok(pattern.magnitude > 0);
  }
});

test('venue patterns capture venue-specific leakage and fill degradation', () => {
  const venueLeak = find('VENUE_SPECIFIC_LEAKAGE', 'venue-a');
  assert.ok(venueLeak, 'venue-a carries corpus-specific leakage');
  const fillDegradation = patterns.filter((p) => p.kind === 'FILL_QUALITY_DEGRADATION');
  assert.ok(fillDegradation.length >= 1);
});

test('high theoretical edge with poor realization is detected as a strategy pattern', () => {
  const oscillation = find('HIGH_THEORETICAL_POOR_REALIZATION', 'opp_oscillation');
  const policy = find('HIGH_THEORETICAL_POOR_REALIZATION', 'opp_policy_trial');
  assert.ok(oscillation, 'oscillation series is high-theoretical poor-realization');
  assert.ok(policy, 'policy trial series is high-theoretical poor-realization');
});

test('policy patterns distinguish baseline stability from candidate regression', () => {
  const stability = find('POLICY_STABILITY', 'policy-execution@v1');
  const notEndToEnd = find('POLICY_IMPROVEMENT_NOT_END_TO_END', 'policy-execution@v1.1');
  const regression = find('POLICY_REGRESSION', 'policy-execution@v1.1');
  assert.ok(stability, 'v1 baseline is stable');
  assert.equal(stability.direction, 'STABLE');
  assert.ok(notEndToEnd, 'the v1.1 candidate does not improve end-to-end value');
  assert.ok(regression, 'v1.1 preservation regresses across eras');
});

test('rejection patterns recur when history keeps being rejected', () => {
  const rejections = detectRejectionPatterns(3, 0, config, active.slice(0, 3));
  assert.ok(rejections.length >= 1);
  assert.ok(rejections.every((p) => p.kind === 'RECURRING_FAIL_CLOSED'));
  const contradictions = detectRejectionPatterns(0, 3, config, active.slice(0, 3));
  assert.ok(contradictions.every((p) => p.kind === 'RECURRING_CONTRADICTORY_INPUTS'));
  const quiet = detectRejectionPatterns(1, 1, config, active.slice(0, 1));
  assert.equal(quiet.length, 0);
});

test('strategy completion divergence is quantified pairwise', () => {
  // The aggressive strategy COMPLETES more (0.67) yet PRESERVES less (0.10).
  const aggressiveStats = {
    key: 'arb-aggressive',
    completionRate: 0.6667,
    meanPreservation: 0.098,
  };
  const guardianStats = {
    key: 'arb-guardian',
    completionRate: 0.5,
    meanPreservation: 0.710,
  };
  const divergence = strategyCompletionDivergence(aggressiveStats, guardianStats, active, config);
  assert.ok(divergence, 'aggressive completes more yet preserves less');
  assert.equal(divergence.subject.key, 'arb-aggressive');
  assert.ok(divergence.magnitude > 0);
  const none = strategyCompletionDivergence(guardianStats, aggressiveStats, active, config);
  assert.equal(none, null, 'completing less while preserving more is not divergence');
  // The engine-level divergence pattern exists for arb-aggressive.
  const engineDivergence = result.patterns.find((p) => p.kind === 'COMPLETION_PRESERVATION_DIVERGENCE'
    && p.subject.key === 'arb-aggressive');
  assert.ok(engineDivergence, 'aggressive completion/preservation divergence must be detected');
  assert.ok(engineDivergence.magnitude > 0);
});

test('consistent outperformance requires winning EVERY era', () => {
  const guardian = consistentOutperformance('arb-guardian', 5, 5, active, config);
  assert.ok(guardian, 'guardian outperforms aggressive in every era');
  assert.equal(guardian.magnitude, 5);
  const notEvery = consistentOutperformance('arb-aggressive', 3, 5, active, config);
  assert.equal(notEvery, null, 'winning only some eras is not consistent outperformance');
  const tooFew = consistentOutperformance('x', 1, 1, active.slice(0, 1), config);
  assert.equal(tooFew, null);
});

test('pattern detection is deterministic and order-independent', () => {
  const again = detectPatterns([...active].reverse(), config);
  assert.deepEqual(patterns.map((p) => p.patternId), again.map((p) => p.patternId));
  assert.equal(new Set(patterns.map((p) => p.patternId)).size, patterns.length);
});

test('a single-era corpus detects no trend patterns', () => {
  const oneEra = active.filter((r) => r.timeBucket === [...new Set(active.map((r) => r.timeBucket))].sort()[0]);
  const single = detectPatterns(oneEra, config);
  assert.equal(single.filter((p) => p.direction === 'IMPROVING' || p.direction === 'DETERIORATING').length, 0);
});

test('the engine links patterns to at least one hypothesis', () => {
  const linkedHypotheses = new Set(result.hypotheses.map((h) => h.hypothesisId));
  assert.ok(linkedHypotheses.size > 0);
  assert.ok(patterns.length >= 40, `rich pattern set expected (got ${patterns.length})`);
});
