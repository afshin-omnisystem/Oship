import test from 'node:test';
import assert from 'node:assert/strict';

import {proposeReslice, validateReslice, targetSliceQuantity} from '../reslice';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';
import {intelPlan, afisCrossVenuePlan} from '../test-fixtures';
import {makeTelemetry, venueTelemetry, T0} from './helpers';

/**
 * Sprint 032 — Reslicing Engine tests. Slice quantity/timing adapt to observed
 * fill ratio and liquidity; total target quantity is NEVER altered; parent
 * plan, lineage, allocation/risk constraints and atomic semantics preserved.
 */

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function reslice(opts: {
  remaining?: number;
  filled?: number;
  planned?: number;
  fillRatio?: number;
  venues?: ReturnType<typeof venueTelemetry>[];
  liquidity?: number;
  price?: number;
  plan?: ReturnType<typeof intelPlan>;
  atomic?: boolean;
} = {}) {
  const venues = opts.venues ?? [venueTelemetry({venueId: 'venue-a', remainingQuantity: opts.remaining ?? 60, plannedQuantity: opts.planned ?? 100, filledQuantity: opts.filled ?? 40, fillRatio: opts.fillRatio ?? 0.4})];
  const plan = opts.plan ?? intelPlan({
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: opts.planned ?? 100, referencePrice: 100}],
  });
  return proposeReslice({
    plan,
    telemetry: makeTelemetry({
      executionPlanId: plan.executionPlanId,
      remainingQuantity: opts.remaining ?? 60,
      filledQuantity: opts.filled ?? 40,
      plannedQuantity: opts.planned ?? 100,
      fillRatio: opts.fillRatio ?? 0.4,
      atomicRequired: opts.atomic ?? false,
      venues,
    }),
    config: cfg,
    cycle: 0,
    timestamp: T0,
    observedLiquidity: opts.liquidity ?? 100_000,
    referencePrice: opts.price ?? 100,
  });
}

test('S01 reslice covers exactly the remaining quantity', () => {
  const p = reslice({remaining: 60, filled: 40, planned: 100})!;
  const covered = p.slices.reduce((s, x) => s + x.quantity, 0);
  assert.ok(Math.abs(covered - 60) < 1e-6);
  assert.equal(p.remainingQuantity, 60);
});

test('S02 reslice never alters the total target quantity', () => {
  const p = reslice({remaining: 60, filled: 40, planned: 100})!;
  assert.equal(p.totalTargetQuantity, 100);
  assert.equal(p.preservesTotalQuantity, true);
  assert.ok(Math.abs(p.filledQuantity + p.slices.reduce((s, x) => s + x.quantity, 0) - 100) < 1e-6);
});

test('S03 reslice returns null when nothing remains', () => {
  assert.equal(reslice({remaining: 0, filled: 100, planned: 100, venues: [venueTelemetry({remainingQuantity: 0, filledQuantity: 100})]}), null);
});

test('S04 reslice returns null for atomic plans (never silently split)', () => {
  assert.equal(reslice({atomic: true, remaining: 50, filled: 50, planned: 100}), null);
});

test('S05 poor fill ratio produces smaller slices', () => {
  const poor = targetSliceQuantity(0.4, T.resliceThreshold, 100_000, 100, 0.0001);
  const good = targetSliceQuantity(0.99, T.resliceThreshold, 100_000, 100, 0.0001);
  assert.ok(poor < good);
  // 100k liquidity → 10% notional = 100 units; scale 0.5 vs 1.25
  assert.ok(Math.abs(poor - 50) < 1e-6);
  assert.ok(Math.abs(good - 125) < 1e-6);
});

test('S06 slice count grows when remaining exceeds the target slice size', () => {
  // remaining 60, liquidity 10000 → base 10 units → scale 0.5 → 5 units/slice → 12 slices capped at 8
  const p = reslice({remaining: 60, filled: 40, planned: 100, liquidity: 10_000})!;
  assert.equal(p.sliceCount, cfg.maxResliceCount);
  const covered = p.slices.reduce((s, x) => s + x.quantity, 0);
  assert.ok(Math.abs(covered - 60) < 1e-6);
});

test('S07 slices are distributed across venues with remaining work', () => {
  const p = reslice({
    remaining: 60, filled: 40, planned: 100,
    venues: [
      venueTelemetry({venueId: 'venue-a', remainingQuantity: 30, plannedQuantity: 50, filledQuantity: 20}),
      venueTelemetry({venueId: 'venue-b', remainingQuantity: 30, plannedQuantity: 50, filledQuantity: 20}),
    ],
  })!;
  const venues = new Set(p.slices.map((s) => s.venue));
  assert.deepEqual([...venues].sort(), ['venue-a', 'venue-b']);
});

test('S08 slice sequences are unique and ordered', () => {
  const p = reslice({remaining: 60, liquidity: 10_000})!;
  const seqs = p.slices.map((s) => s.sequence);
  assert.equal(new Set(seqs).size, seqs.length);
  assert.deepEqual([...seqs].sort((a, b) => a - b), seqs);
});

test('S09 inter-slice delay is deterministic', () => {
  const p = reslice({remaining: 60, liquidity: 10_000})!;
  for (const s of p.slices) {
    assert.equal(s.delayMs, cfg.sliceDelayMs * (s.sequence - 1));
  }
});

test('S10 slices reference their route and leg (lineage preserved)', () => {
  const p = reslice({})!;
  assert.equal(p.slices[0].routeId, 'route-1');
  assert.equal(p.preservesLineage, true);
});

test('S11 reslice preserves atomic semantics flag', () => {
  const p = reslice({})!;
  assert.equal(p.preservesAtomicSemantics, true);
});

test('S12 proposal is authority-marked (no treasury/risk/portfolio mutation)', () => {
  const p = reslice({})!;
  assert.equal(p.requiresExecutionAuthorization, true);
  assert.equal(p.treasuryMutation, false);
  assert.equal(p.riskMutation, false);
  assert.equal(p.portfolioMutation, false);
});

test('S13 reslice is deterministic', () => {
  const a = reslice({remaining: 60, liquidity: 10_000});
  const b = reslice({remaining: 60, liquidity: 10_000});
  assert.equal(a!.resliceProposalId, b!.resliceProposalId);
  assert.equal(a!.fingerprint, b!.fingerprint);
  assert.deepEqual(a!.slices, b!.slices);
});

test('S14 validateReslice accepts a well-formed proposal', () => {
  const p = reslice({})!;
  const v = validateReslice(p);
  assert.equal(v.valid, true);
});

test('S15 validateReslice rejects slices that do not cover the remainder', () => {
  const p = reslice({})!;
  const broken = {...p, slices: p.slices.slice(0, -1)};
  assert.equal(validateReslice(broken).valid, false);
});

test('S16 validateReslice rejects quantity drift (filled + slices ≠ target)', () => {
  const p = reslice({})!;
  const broken = {...p, totalTargetQuantity: 200};
  const v = validateReslice(broken);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('total target')));
});

test('S17 validateReslice rejects empty slice sets', () => {
  const p = reslice({})!;
  assert.equal(validateReslice({...p, slices: []}).valid, false);
});

test('S18 validateReslice rejects non-positive slice quantities', () => {
  const p = reslice({})!;
  const broken = {...p, slices: [{...p.slices[0], quantity: -5}]};
  assert.equal(validateReslice(broken).valid, false);
});

test('S19 validateReslice rejects duplicate sequences', () => {
  const p = reslice({liquidity: 10_000})!;
  const broken = {...p, slices: p.slices.map((s) => ({...s, sequence: 1}))};
  assert.equal(validateReslice(broken).valid, false);
});

test('S20 reslice works for an atomic plan only when not required-atomic', () => {
  const crossVenue = afisCrossVenuePlan();
  const p = proposeReslice({
    plan: crossVenue,
    telemetry: makeTelemetry({
      executionPlanId: crossVenue.executionPlanId,
      atomicRequired: false,
      remainingQuantity: 5, filledQuantity: 15, plannedQuantity: 20,
      venues: [venueTelemetry({venueId: 'venue-a', remainingQuantity: 5})],
    }),
    config: cfg, cycle: 0, timestamp: T0, observedLiquidity: 100_000, referencePrice: 100,
  });
  assert.ok(p !== null);
});
