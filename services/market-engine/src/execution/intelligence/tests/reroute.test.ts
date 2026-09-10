import test from 'node:test';
import assert from 'node:assert/strict';

import {proposeReroute, rankVenues, scoreVenueCandidate, validateReroute} from '../reroute';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';
import {intelCandidate} from '../test-fixtures';
import {makeTelemetry, T0} from './helpers';

/**
 * Sprint 032 — Rerouting Engine tests. Deterministic ranking over liquidity,
 * spread, fees, slippage, latency, venue health, fill probability and
 * execution quality; deterministic tie-breaking; UNAVAILABLE venues are never
 * routing targets; no random routing.
 */

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function reroute(opts: {
  candidates?: ReturnType<typeof intelCandidate>[];
  current?: string;
  remaining?: number;
  rerouteThreshold?: number;
} = {}) {
  return proposeReroute({
    telemetry: makeTelemetry({remainingQuantity: opts.remaining ?? 10}),
    config: {...cfg, ...(opts.rerouteThreshold !== undefined ? {thresholds: {...T, rerouteThreshold: opts.rerouteThreshold}} : {})},
    cycle: 0,
    timestamp: T0,
    candidates: opts.candidates ?? [
      intelCandidate({venueId: 'venue-a', liquidity: 10_000, healthScore: 0.4, health: 'DEGRADED'}),
      intelCandidate({venueId: 'venue-b', liquidity: 200_000, healthScore: 1, health: 'HEALTHY'}),
    ],
    currentVenueId: opts.current ?? 'venue-a',
    remainingQuantityOnVenue: opts.remaining ?? 10,
    instrumentId: 'BTC/USDT',
    side: 'BUY',
  });
}

test('V01 scoreVenueCandidate normalizes all eight factors to 0..1', () => {
  const s = scoreVenueCandidate(intelCandidate({venueId: 'v'}), cfg);
  for (const [name, value] of Object.entries(s.factors)) {
    assert.ok(value >= 0 && value <= 1, `factor ${name} out of range: ${value}`);
  }
  assert.ok(s.score >= 0 && s.score <= 1);
  assert.equal(s.eligible, true);
});

test('V02 higher liquidity scores higher (all else equal)', () => {
  const low = scoreVenueCandidate(intelCandidate({venueId: 'v-low', liquidity: 10_000}), cfg);
  const high = scoreVenueCandidate(intelCandidate({venueId: 'v-high', liquidity: 500_000}), cfg);
  assert.ok(high.score > low.score);
});

test('V03 wider spread scores lower', () => {
  const tight = scoreVenueCandidate(intelCandidate({venueId: 'a', spreadBps: 2}), cfg);
  const wide = scoreVenueCandidate(intelCandidate({venueId: 'b', spreadBps: 40}), cfg);
  assert.ok(tight.score > wide.score);
});

test('V04 higher fees score lower', () => {
  const cheap = scoreVenueCandidate(intelCandidate({venueId: 'a', takerFeeBps: 2}), cfg);
  const dear = scoreVenueCandidate(intelCandidate({venueId: 'b', takerFeeBps: 40}), cfg);
  assert.ok(cheap.score > dear.score);
});

test('V05 worse slippage scores lower', () => {
  const clean = scoreVenueCandidate(intelCandidate({venueId: 'a', slippageBps: 1}), cfg);
  const dirty = scoreVenueCandidate(intelCandidate({venueId: 'b', slippageBps: 30}), cfg);
  assert.ok(clean.score > dirty.score);
});

test('V06 higher latency scores lower', () => {
  const fast = scoreVenueCandidate(intelCandidate({venueId: 'a', latencyMs: 10}), cfg);
  const slow = scoreVenueCandidate(intelCandidate({venueId: 'b', latencyMs: 500}), cfg);
  assert.ok(fast.score > slow.score);
});

test('V07 venue health multiplies the score', () => {
  const healthy = scoreVenueCandidate(intelCandidate({venueId: 'a', health: 'HEALTHY', healthScore: 1}), cfg);
  const degraded = scoreVenueCandidate(intelCandidate({venueId: 'b', health: 'DEGRADED', healthScore: 0.5}), cfg);
  assert.ok(healthy.score > degraded.score);
});

test('V08 UNAVAILABLE venues are excluded from ranking eligibility', () => {
  const s = scoreVenueCandidate(intelCandidate({venueId: 'v', health: 'UNAVAILABLE', healthScore: 0}), cfg);
  assert.equal(s.eligible, false);
  assert.equal(s.score, 0);
  assert.ok(s.exclusionReason!.includes('UNAVAILABLE'));
});

test('V09 zero-liquidity venues are excluded', () => {
  const s = scoreVenueCandidate(intelCandidate({venueId: 'v', liquidity: 0}), cfg);
  assert.equal(s.eligible, false);
});

test('V10 ranking is sorted by score descending', () => {
  // Latency differentiates; liquidity alone saturates at the floor (all ≥ min).
  const ranking = rankVenues([
    intelCandidate({venueId: 'a', latencyMs: 200}),
    intelCandidate({venueId: 'b', latencyMs: 10}),
    intelCandidate({venueId: 'c', latencyMs: 100}),
  ], cfg);
  const scores = ranking.map((r) => r.score);
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2], `scores not strictly descending: ${scores}`);
  assert.deepEqual(ranking.map((r) => r.venueId), ['b', 'c', 'a']);
});

test('V11 ties are broken deterministically by venueId ascending', () => {
  const ranking = rankVenues([
    intelCandidate({venueId: 'venue-z'}),
    intelCandidate({venueId: 'venue-a'}),
    intelCandidate({venueId: 'venue-m'}),
  ], cfg);
  assert.deepEqual(ranking.map((r) => r.venueId), ['venue-a', 'venue-m', 'venue-z']);
});

test('V12 ranking is deterministic across repeated calls', () => {
  const candidates = [intelCandidate({venueId: 'a', liquidity: 1000}), intelCandidate({venueId: 'b', liquidity: 999})];
  assert.deepEqual(rankVenues(candidates, cfg), rankVenues(candidates, cfg));
});

test('V13 reroute proposes the best alternative venue', () => {
  const p = reroute()!;
  assert.equal(p.fromVenueId, 'venue-a');
  assert.equal(p.toVenueId, 'venue-b');
  assert.equal(p.quantity, 10);
});

test('V14 reroute reports the deterministic score delta', () => {
  const p = reroute()!;
  assert.ok(p.scoreDelta >= cfg.thresholds.rerouteThreshold);
  assert.ok(Math.abs(p.scoreDelta - (p.toScore - p.fromScore)) < 1e-9);
});

test('V15 reroute returns null when no alternative exists', () => {
  const p = reroute({candidates: [intelCandidate({venueId: 'venue-a'})]});
  assert.equal(p, null);
});

test('V16 reroute returns null when the advantage is below the threshold', () => {
  const p = reroute({
    candidates: [
      intelCandidate({venueId: 'venue-a', liquidity: 200_000, healthScore: 1, health: 'HEALTHY'}),
      intelCandidate({venueId: 'venue-b', liquidity: 200_000, healthScore: 0.97, health: 'HEALTHY'}),
    ],
    rerouteThreshold: 0.5,
  });
  assert.equal(p, null);
});

test('V17 reroute returns null when nothing remains to move', () => {
  assert.equal(reroute({remaining: 0}), null);
});

test('V18 reroute never targets an UNAVAILABLE venue', () => {
  const p = reroute({
    candidates: [
      intelCandidate({venueId: 'venue-a', health: 'DEGRADED', healthScore: 0.4}),
      intelCandidate({venueId: 'venue-x', health: 'UNAVAILABLE', healthScore: 0, liquidity: 10_000_000}),
      intelCandidate({venueId: 'venue-b', health: 'HEALTHY', healthScore: 1, liquidity: 150_000}),
    ],
  })!;
  assert.equal(p.toVenueId, 'venue-b');
});

test('V19 reroute proposal is authority-marked', () => {
  const p = reroute()!;
  assert.equal(p.requiresExecutionAuthorization, true);
  assert.equal(p.treasuryMutation, false);
  assert.equal(p.riskMutation, false);
  assert.equal(p.portfolioMutation, false);
});

test('V20 reroute ranking is included as evidence', () => {
  const p = reroute()!;
  assert.equal(p.ranking.length, 2);
  assert.ok(p.evidence.some((e) => e.kind === 'RANKING'));
  assert.ok(p.evidence.some((e) => e.kind === 'ADVANTAGE'));
});

test('V21 validateReroute accepts a well-formed proposal', () => {
  const v = validateReroute(reroute()!, cfg);
  assert.equal(v.valid, true);
});

test('V22 validateReroute rejects a below-threshold advantage', () => {
  const p = reroute()!;
  const v = validateReroute(p, {...cfg, thresholds: {...T, rerouteThreshold: 0.99}});
  assert.equal(v.valid, false);
});

test('V23 validateReroute rejects self-reroutes and non-positive quantities', () => {
  const p = reroute()!;
  assert.equal(validateReroute({...p, toVenueId: p.fromVenueId}, cfg).valid, false);
  assert.equal(validateReroute({...p, quantity: 0}, cfg).valid, false);
});

test('V24 reroute is deterministic', () => {
  const a = reroute();
  const b = reroute();
  assert.equal(a!.rerouteProposalId, b!.rerouteProposalId);
  assert.equal(a!.fingerprint, b!.fingerprint);
});

test('V25 no random routing — input order never changes the ranking', () => {
  const first = [
    intelCandidate({venueId: 'a', liquidity: 12345, latencyMs: 77, spreadBps: 3}),
    intelCandidate({venueId: 'b', liquidity: 99999, latencyMs: 12, spreadBps: 9}),
  ];
  const reversed = [...first].reverse();
  const a = rankVenues(first, cfg);
  const b = rankVenues(reversed, cfg);
  assert.deepEqual(a.map((r) => r.venueId), b.map((r) => r.venueId));
});
