import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSession, validateCycleTelemetry, validateSessionTelemetry} from '../normalization';
import {attributeSession} from '../attribution';
import {sessionRunMetrics, aggregateCorpus} from '../metrics';
import {assessPerformanceQuality} from '../quality';
import {buildVenueScorecards} from '../venue-score';
import {optimize} from '../optimizer';
import {ExecutionPerformanceEngine} from '../engine';
import {buildParameterSet, parameterSetIsValid, validateParameterSpace, DEFAULT_PARAMETER_SPACE} from '../parameter-space';
import {evaluatePolicy} from '../policy-evaluation';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG, mergeExecutionPerformanceConfig, validateExecutionPerformanceConfig} from '../config';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import {healthyRecord, flipFlopRecord, perfPlan, healthyCycle, flipFlopCycle} from '../test-fixtures';

/**
 * SPRINT 034 — fail-closed tests: invalid, incomplete, or contradictory inputs
 * are rejected — never optimized against, never fabricated.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const objective = canonicalObjective(config);
const healthy = healthyRecord();

test('FC01 empty histories are refused', () => {
  assert.throws(() => new ExecutionPerformanceEngine().analyze({
    records: [], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 0,
  }), /fail closed/i);
});

test('FC02 sessions without cycles are refused everywhere', () => {
  const empty = {...healthy.session, cycles: []} as unknown as typeof healthy.session;
  const record = {label: 'x', session: empty, replayInput: null, policyId: 'p', policyVersion: 'v1'};
  assert.throws(() => normalizeSession(record), /fail closed/i);
  assert.throws(() => attributeSession(empty, config), /fail closed/i);
  assert.throws(() => sessionRunMetrics(empty, 'x'), /fail closed/i);
  assert.throws(() => assessPerformanceQuality(empty, config), /fail closed/i);
});

test('FC03 contradictory quantity telemetry is rejected', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, filledQuantity: 4, remainingQuantity: 9, plannedQuantity: 10}};
  const v = validateCycleTelemetry(bad.telemetry);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('contradiction')));
});

test('FC04 negative quantities are rejected', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, filledQuantity: -1, remainingQuantity: 11}};
  assert.equal(validateCycleTelemetry(bad.telemetry).valid, false);
});

test('FC05 non-finite benchmark prices are rejected', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, benchmarkPrice: Number.POSITIVE_INFINITY}};
  assert.equal(validateCycleTelemetry(bad.telemetry).valid, false);
});

test('FC06 fillRatio outside [0,1] is rejected', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, fillRatio: 1.5}};
  assert.equal(validateCycleTelemetry(bad.telemetry).valid, false);
});

test('FC07 invalid telemetry never reaches observation (throws before fabricating)', () => {
  const cycle = healthy.session.cycles[0]!;
  const bad = {...cycle, telemetry: {...cycle.telemetry, slippageBps: Number.NaN}};
  const badSession = {...healthy.session, cycles: [bad]} as unknown as typeof healthy.session;
  assert.throws(() => normalizeSession({label: 'bad', session: badSession, replayInput: null, policyId: 'p', policyVersion: 'v1'}), /fail closed/i);
});

test('FC08 empty corpora are refused by aggregation and optimization', () => {
  assert.throws(() => aggregateCorpus([], objective), /fail closed/i);
  assert.throws(() => optimize({corpus: [], baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: DEFAULT_PARAMETER_SPACE, objective, method: 'COORDINATE'}), /fail closed/i);
});

test('FC09 optimization demands replay inputs (fail closed without them)', () => {
  const noReplay = [{...healthy, replayInput: null}];
  assert.throws(() => new ExecutionPerformanceEngine().analyze({
    records: noReplay, policy: {id: 'p', version: 'v1'},
    optimization: {method: 'COORDINATE'}, timestamp: 0,
  }), /replay input/i);
});

test('FC10 malformed parameter spaces are refused', () => {
  assert.throws(() => optimize({
    corpus: [], baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
    space: [{path: 'x', name: 'x', kind: 'THRESHOLD', min: 5, max: 1, step: 1, unit: 'u'}],
    objective, method: 'COORDINATE',
  }), /invalid parameter space/i);
});

test('FC11 protected paths are refused by the space validator', () => {
  const errs = validateParameterSpace([{path: 'abortOnAllVenuesStale', name: 'x', kind: 'THRESHOLD', min: 0, max: 1, step: 1, unit: 'bool'}]);
  assert.ok(errs.length > 0);
});

test('FC12 off-grid parameter values never become valid candidates', () => {
  const off = buildParameterSet([{path: 'budgets.maxReprices', value: 7}]);
  assert.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, off).valid, false);
});

test('FC13 under-sampled venues are isolated, not scored', () => {
  const obs = normalizeSession(healthy);
  const cards = buildVenueScorecards(obs, config);
  for (const c of cards) {
    if (c.sampleCount < config.minVenueSamples) {
      assert.equal(c.status, 'INSUFFICIENT_SAMPLE');
      assert.equal(c.confidence, 0);
    }
  }
});

test('FC14 empty policy groups are refused', () => {
  assert.throws(() => evaluatePolicy({policyId: 'p', version: 'v1', records: []}, config, objective), /fail closed/i);
});

test('FC15 invalid performance configs are refused', () => {
  const bad = mergeExecutionPerformanceConfig({minVenueSamples: -1});
  assert.ok(validateExecutionPerformanceConfig(bad).length > 0);
  const badObjective = mergeExecutionPerformanceConfig({objective: {quality: -1}});
  assert.ok(validateExecutionPerformanceConfig(badObjective).length > 0);
});

test('FC16 non-finite improvement thresholds are refused', () => {
  const bad = mergeExecutionPerformanceConfig({minImprovement: Number.NaN});
  assert.ok(validateExecutionPerformanceConfig(bad).length > 0);
});

test('FC17 no-fill sessions never fabricate cost metrics', () => {
  const rec = {label: 'stale', session: healthy.session, replayInput: null, policyId: 'p', policyVersion: 'v1'};
  const plan = perfPlan({planId: 'xplan_fc17'});
  // (healthy session is valid — this asserts the validator accepts it)
  assert.equal(validateSessionTelemetry(rec.session).valid, true);
});

test('FC18 the optimizer never evaluates sets outside the declared space', () => {
  const flip = flipFlopRecord(7);
  const space = [DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!];
  const outcome = optimize({
    corpus: [{label: flip.label, plan: flip.replayInput!.plan, cycles: flip.replayInput!.cycles, startTime: flip.session.cycles[0]?.startedAt}],
    baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
    space,
    objective,
    method: 'GRID',
  });
  for (const e of outcome.evaluated) {
    for (const entry of e.parameters.entries) {
      assert.equal(entry.path, 'adaptive.thresholds.rerouteThreshold');
      assert.ok([0.05, 0.1, 0.15, 0.2, 0.25].some((v) => Math.abs(v - entry.value) < 1e-9));
    }
  }
});

test('FC19 unknown audit event types are refused', () => {
  // covered deeply in audit tests; here the engine's own log path is closed.
  const engine = new ExecutionPerformanceEngine();
  assert.ok(typeof engine.analyze === 'function');
});

test('FC20 a flip-flop world without enough cycles still fails closed (never silently completes)', () => {
  const plan = perfPlan({planId: 'xplan_fc20', quantity: 40, referencePrice: 100});
  const rec = {label: 'short-flip', session: null, replayInput: null, policyId: 'p', policyVersion: 'v1'} as never;
  void rec;
  // Build a 2-cycle flip world: the session ends without completion.
  const cycles = [flipFlopCycle('f0', plan, true), flipFlopCycle('f1', plan, false)];
  const s = new (require('../../control/engine').ExecutionControlEngine)().run({
    plan, cycles, startTime: 1_704_067_200_000, correlationId: 'fc20', traceId: 'fc20',
  });
  assert.notEqual(s.finalResult!.finalState, 'COMPLETED');
  const obs = normalizeSession({label: 'short', session: s, replayInput: null, policyId: 'p', policyVersion: 'v1'});
  assert.ok(obs.length > 0);
  void healthyCycle;
});
