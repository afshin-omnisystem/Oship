import test from 'node:test';
import assert from 'node:assert/strict';

import {proposeReprice, validateReprice} from '../reprice';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {makeTelemetry, makeQuality, T0} from './helpers';

/**
 * Sprint 032 — Repricing Engine tests. Deterministic repricing through the
 * current mid with tick alignment, price-limit clamping and a hard reprice
 * band. Proposals are recommendation-only.
 */

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function reprice(opts: {current?: number; benchmark?: number; side?: 'BUY' | 'SELL'; maxRepriceBps?: number; band?: number; tick?: number} = {}) {
  const config = {
    ...cfg,
    ...(opts.maxRepriceBps !== undefined ? {maxRepriceBps: opts.maxRepriceBps} : {}),
    ...(opts.band !== undefined ? {priceLimitBandBps: opts.band} : {}),
    ...(opts.tick !== undefined ? {tickSize: opts.tick} : {}),
  };
  return proposeReprice({
    telemetry: makeTelemetry({remainingQuantity: 5}),
    quality: makeQuality({score: 0.8}),
    config,
    cycle: 0,
    timestamp: T0,
    orderScope: 'venue-a',
    venueId: 'venue-a',
    side: opts.side ?? 'BUY',
    currentPrice: opts.current ?? 100.2,
    benchmarkPrice: opts.benchmark ?? 100,
  });
}

test('R01 reprice moves a BUY order one tick above the current mid', () => {
  const p = reprice({current: 100.2, tick: 0.1})!;
  assert.ok(p);
  assert.ok(Math.abs(p.proposedPrice - 100.3) < 1e-9);
  assert.equal(p.side, 'BUY');
});

test('R02 reprice moves a SELL order one tick below the current mid', () => {
  const p = reprice({current: 100.2, side: 'SELL', tick: 0.1})!;
  assert.ok(Math.abs(p.proposedPrice - 100.1) < 1e-9);
});

test('R03 proposed price is tick-aligned', () => {
  const p = reprice({current: 100.23, tick: 0.05})!;
  assert.ok(Math.abs(p.proposedPrice / 0.05 - Math.round(p.proposedPrice / 0.05)) < 1e-9);
});

test('R04 drift is computed against the benchmark in bps', () => {
  const p = reprice({current: 100.2, benchmark: 100})!;
  assert.ok(Math.abs(p.driftBps - 20) < 1e-6);
});

test('R05 price limits form a band around the benchmark', () => {
  const p = reprice({benchmark: 100, band: 100})!;
  assert.ok(Math.abs(p.priceLimitLow - 99) < 1e-6);
  assert.ok(Math.abs(p.priceLimitHigh - 101) < 1e-6);
});

test('R06 reprice clamps to the price limit band', () => {
  // BUY target 101.51 would overshoot the +100bps limit → clamped to 101.
  const buy = reprice({current: 101.5, benchmark: 100, band: 100, maxRepriceBps: 100})!;
  assert.ok(buy, 'BUY reprice proposal expected');
  assert.equal(buy.clamped, true);
  assert.equal(buy.proposedPrice, buy.priceLimitHigh);
  // SELL target 98.49 would undershoot the -100bps limit → clamped to 99.
  const sell = reprice({current: 98.5, benchmark: 100, side: 'SELL', band: 100, maxRepriceBps: 100})!;
  assert.ok(sell, 'SELL reprice proposal expected');
  assert.equal(sell.clamped, true);
  assert.equal(sell.proposedPrice, sell.priceLimitLow);
  // Unclamped proposals keep the one-tick move.
  const free = reprice({current: 100.2, benchmark: 100, band: 100, maxRepriceBps: 100})!;
  assert.equal(free.clamped, false);
});

test('R07 reprice beyond the max reprice band returns null (fail closed)', () => {
  const p = reprice({current: 100.2, benchmark: 100, maxRepriceBps: 10});
  assert.equal(p, null);
});

test('R08 reprice within the max reprice band is allowed', () => {
  const p = reprice({current: 100.2, benchmark: 100, maxRepriceBps: 50});
  assert.ok(p !== null);
});

test('R09 reprice with non-positive prices returns null', () => {
  assert.equal(reprice({current: 0}), null);
  assert.equal(reprice({benchmark: 0}), null);
});

test('R10 proposal carries authority markers (proposal-only, no mutations)', () => {
  const p = reprice({})!;
  assert.equal(p.requiresExecutionAuthorization, true);
  assert.equal(p.treasuryMutation, false);
  assert.equal(p.riskMutation, false);
  assert.equal(p.portfolioMutation, false);
});

test('R11 proposal evidence covers market, tick and quality', () => {
  const p = reprice({})!;
  const kinds = p.evidence.map((e) => e.kind);
  assert.ok(kinds.includes('MARKET'));
  assert.ok(kinds.includes('TICK'));
  assert.ok(kinds.includes('QUALITY'));
});

test('R12 proposal reason states venue, drift and clamping', () => {
  const p = reprice({})!;
  assert.ok(p.reason.includes('venue-a'));
  assert.ok(p.reason.includes('drift'));
});

test('R13 proposal id and fingerprint are canonical', () => {
  const p = reprice({})!;
  assert.ok(p.repriceProposalId.startsWith('rp_'));
  assert.ok(p.fingerprint.startsWith('rpf_'));
});

test('R14 reprice is deterministic', () => {
  const a = reprice({current: 100.3});
  const b = reprice({current: 100.3});
  assert.equal(a!.repriceProposalId, b!.repriceProposalId);
  assert.equal(a!.fingerprint, b!.fingerprint);
});

test('R15 validateReprice accepts a well-formed proposal', () => {
  const p = reprice({})!;
  const v = validateReprice(p, cfg);
  assert.equal(v.valid, true);
  assert.deepEqual(v.violations, []);
});

test('R16 validateReprice rejects a non-tick-aligned price', () => {
  const p = {...reprice({tick: 0.1})!, proposedPrice: 100.25};
  assert.equal(validateReprice(p, {...cfg, tickSize: 0.1}).valid, false);
});

test('R17 validateReprice rejects prices outside the limit band', () => {
  const p = {...reprice({})!, proposedPrice: 999};
  const v = validateReprice(p, cfg);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('price limit')));
});

test('R18 validateReprice rejects moves beyond the reprice band', () => {
  const p = {...reprice({})!, proposedPrice: 100.8};
  const v = validateReprice(p, {...cfg, maxRepriceBps: 10});
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('exceeds max')), JSON.stringify(v.violations));
  // A move within the band passes.
  const ok = validateReprice(reprice({current: 100.2, maxRepriceBps: 50})!, cfg);
  assert.equal(ok.valid, true);
});

test('R19 validateReprice rejects non-positive prices', () => {
  const p = {...reprice({})!, proposedPrice: 0};
  assert.equal(validateReprice(p, cfg).valid, false);
});

test('R20 clamped flag is false when no clamping was needed', () => {
  const p = reprice({current: 100.05})!;
  assert.equal(p.clamped, false);
});
