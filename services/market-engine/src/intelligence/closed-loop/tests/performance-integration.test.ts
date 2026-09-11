import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionObservations, sessionAttribution, sessionQuality, venueScorecardFor,
  policyEvaluationFor, baselinePolicyVersion, candidatePolicyVersions,
  recordSessionView, venueExecutionStates,
} from '../performance';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — Sprint 034 performance integration tests (§11, §14): the
 * closed loop CONSUMES performance intelligence; lookups resolve; missing
 * analysis degrades explicitly.
 */

const corpus = closedLoopCorpus();

test('every record resolves its observations from Sprint 034 output', () => {
  for (const record of corpus.records) {
    const view = recordSessionView(record);
    assert.ok(view.observations.length > 0, `${record.label} has observations`);
    assert.ok(view.observations.every((o) => o.sessionId === record.session.session.sessionId));
  }
});

test('observations are sorted deterministically (timestamp then venue)', () => {
  for (const record of corpus.records) {
    const obs = sessionObservations(record.performance, record.session.session.sessionId);
    for (let i = 1; i < obs.length; i++) {
      const ok = obs[i].timestamp > obs[i - 1].timestamp
        || (obs[i].timestamp === obs[i - 1].timestamp && obs[i].venue >= obs[i - 1].venue);
      assert.ok(ok);
    }
  }
});

test('session attribution resolves with the Sprint 034 id', () => {
  const record = corpus.records[0];
  const attr = sessionAttribution(record.performance, record.session.session.sessionId);
  assert.ok(attr);
  assert.ok(attr!.attributionId.startsWith('patt_'));
});

test('session quality resolves for analyzed records', () => {
  const record = corpus.records[0];
  const quality = sessionQuality(record.performance, record.session.session.sessionId);
  assert.ok(quality);
  assert.ok(quality!.score >= 0 && quality!.score <= 1);
});

test('venue scorecards resolve per venue', () => {
  const record = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const scorecard = venueScorecardFor(record.performance, 'venue-a');
  assert.ok(scorecard);
  assert.equal(scorecard!.venueId, 'venue-a');
});

test('policy evaluation resolves per version', () => {
  const policyRecord = corpus.records.find((r) => r.label === 'policy-v1.1-trial')!;
  const evaluation = policyEvaluationFor(policyRecord.performance, 'v1.1');
  assert.ok(evaluation);
  assert.equal(evaluation!.version, 'v1.1');
});

test('baseline policy version is the earliest evaluated version', () => {
  const policyRecord = corpus.records.find((r) => r.label === 'policy-v1.1-trial')!;
  assert.equal(baselinePolicyVersion(policyRecord.performance), 'v1');
  assert.equal(baselinePolicyVersion(null), 'unknown');
});

test('candidate policy versions come from Sprint 034 candidates', () => {
  const policyRecord = corpus.records.find((r) => r.label === 'policy-v1.1-trial')!;
  const candidates = candidatePolicyVersions(policyRecord.performance);
  assert.deepEqual(candidates, ['v1.1']);
  assert.deepEqual(candidatePolicyVersions(null), []);
});

test('venue execution states aggregate per-cycle telemetry correctly', () => {
  const partial = corpus.records.find((r) => r.label === 'partial-completion')!;
  const view = recordSessionView(partial);
  const states = venueExecutionStates(view.observations);
  assert.equal(states.length, 1);
  const state = states[0];
  assert.equal(state.plannedQuantity, 10, 'planned = first cycle work');
  assert.equal(state.filledQuantity, 9, 'filled = Σ per-cycle fills');
  assert.ok(Math.abs(state.fillRatio - 0.9) < 1e-9);
  assert.equal(state.remainingQuantity, 1);
});

test('venue VWAP is the fill-weighted average of per-cycle execution prices', () => {
  const recovery = corpus.records.find((r) => r.label === 'adaptive-recovery')!;
  const view = recordSessionView(recovery);
  const states = venueExecutionStates(view.observations);
  assert.ok(states[0].vwap !== null);
  assert.ok(Math.abs(states[0].vwap! - 100.4) < 1e-6, 'all fills at the drifted ask');
});

test('missing performance analysis degrades to empty views, never throws', () => {
  assert.deepEqual(sessionObservations(null, 's'), []);
  assert.equal(sessionAttribution(null, 's'), null);
  assert.equal(sessionQuality(null, 's'), null);
  assert.equal(venueScorecardFor(null, 'v'), null);
  assert.equal(policyEvaluationFor(null, 'v'), null);
});

test('unfilled venue yields null VWAP honestly', () => {
  const stale = corpus.records.find((r) => r.label === 'stale-intel')!;
  const view = recordSessionView(stale);
  const states = venueExecutionStates(view.observations);
  assert.equal(states[0].filledQuantity, 0);
  assert.equal(states[0].vwap, null);
});
