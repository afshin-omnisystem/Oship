import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionPerformanceEngine} from '../engine';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {attributeSession} from '../attribution';
import {assessPerformanceQuality} from '../quality';
import {sessionRunMetrics, sessionObjectiveScore} from '../metrics';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord,
} from '../test-fixtures';

/**
 * SPRINT 034 — cross-domain tests: ONE engine for AFIS + ABL, domain-neutral
 * core with domain adapters only.
 */

const afisRecords = [healthyRecord(), driftedRecord(), partialRecord(), degradedRecord(), staleRecord()];
const ablRecords = [ablRecord()];
const engine = new ExecutionPerformanceEngine();

test('XD1 the same engine analyzes AFIS and ABL histories', () => {
  const afis = engine.analyze({records: afisRecords, policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  const abl = engine.analyze({records: ablRecords, policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  assert.ok(afis.analysisFingerprint.startsWith('pfin_'));
  assert.ok(abl.analysisFingerprint.startsWith('pfin_'));
  assert.notEqual(afis.analysisFingerprint, abl.analysisFingerprint);
});

test('XD2 a mixed corpus is analyzed in one pass', () => {
  const r = engine.analyze({records: [...afisRecords, ...ablRecords], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  assert.equal(r.domainScores.length, 2);
  assert.deepEqual(r.domainScores.map((d) => d.domain).sort(), ['ABL', 'AFIS']);
});

test('XD3 both domains score through the identical quality model', () => {
  const afisQ = assessPerformanceQuality(afisRecords[0]!.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const ablQ = assessPerformanceQuality(ablRecords[0]!.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  assert.deepEqual(afisQ.dimensions.map((d) => d.name), ablQ.dimensions.map((d) => d.name));
});

test('XD4 both domains attribute through the identical component model', () => {
  const afisA = attributeSession(afisRecords[0]!.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const ablA = attributeSession(ablRecords[0]!.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  assert.deepEqual(afisA.components.map((c) => c.component), ablA.components.map((c) => c.component));
});

test('XD5 the objective is domain-neutral', () => {
  const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const afisScore = sessionObjectiveScore(sessionRunMetrics(afisRecords[0]!.session, 'a'), objective);
  const ablScore = sessionObjectiveScore(sessionRunMetrics(ablRecords[0]!.session, 'b'), objective);
  assert.ok(Number.isFinite(afisScore));
  assert.ok(Number.isFinite(ablScore));
});

test('XD6 identical worlds produce identical scores across domains', () => {
  // AFIS healthy vs ABL healthy on the same venue model: same fill pattern →
  // identical session metrics (the domain adapter only relabels sides).
  const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const afisM = sessionRunMetrics(healthyRecord().session, 'afis');
  const ablM = sessionRunMetrics(ablRecord().session, 'abl');
  assert.equal(afisM.fillRate, ablM.fillRate);
  assert.equal(afisM.cycles, ablM.cycles);
  assert.equal(afisM.adaptations, ablM.adaptations);
  assert.equal(sessionObjectiveScore(afisM, objective), sessionObjectiveScore(ablM, objective));
});

test('XD7 domain scores expose comparable metric surfaces', () => {
  const r = engine.analyze({records: [...afisRecords, ...ablRecords], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  const [afis, abl] = r.domainScores;
  for (const d of [afis, abl]) {
    for (const field of ['executionQuality', 'averageCostBps', 'successRate', 'adaptationFrequency'] as const) {
      assert.ok(Number.isFinite(d![field]), `${d!.domain}.${field}`);
    }
  }
});

test('XD8 cross-domain venue intelligence is shared (same venue namespace)', () => {
  const r = engine.analyze({records: [...afisRecords, ...ablRecords], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  const venues = new Set(r.venueScorecards.map((v) => v.venueId));
  assert.ok(venues.has('venue-a'));
  assert.ok(venues.has('venue-b'));
});

test('XD9 neither domain is privileged in the policy evaluation', () => {
  const r = engine.analyze({records: [...afisRecords, ...ablRecords], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  // One policy group covering both domains — no domain-specific policy split.
  assert.equal(r.policyEvaluations.length, 1);
  assert.equal(r.policyEvaluations[0]!.sessionCount, afisRecords.length + ablRecords.length);
});

test('XD10 failures from either domain hit the same policy score', () => {
  const clean = engine.analyze({records: [healthyRecord(), ablRecord()], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  const dirty = engine.analyze({records: [healthyRecord(), staleRecord(), emergencyRecord('xd'), flipFlopRecord(7), ablRecord()], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  assert.ok(dirty.policyEvaluations[0]!.score < clean.policyEvaluations[0]!.score);
});
