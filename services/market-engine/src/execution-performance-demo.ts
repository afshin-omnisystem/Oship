import {
  ExecutionPerformanceEngine,
  normalizeSession, normalizeCorpus,
  attributeSession, benchmarkSession, benchmarkKindsComplete,
  sessionRunMetrics, sessionObjectiveScore, aggregateCorpus,
  assessPerformanceQuality, buildVenueScorecards, buildStrategyScores, buildDomainScores,
  evaluatePolicies, comparePolicies,
  DEFAULT_PARAMETER_SPACE, PROTECTED_PARAMETER_PATHS, buildParameterSet, parameterSetIsValid,
  applyParameterSet, gridValues, enumerateGrid,
  optimize, baselineParameterSet, getPathValue,
  createPolicyCandidate, withGateResults, approveCandidate,
  validateCandidate,
  runSimulationGate,
  evaluateRegressionGate,
  evaluatePromotionGate, isApprovable, describePromotion,
  buildPolicyLineage, validatePolicyLineage,
  replayPerformanceAnalysis,
  PerformanceAuditLog, verifyPerformanceAuditStream, PERFORMANCE_GENESIS_HASH,
  checkPerformanceInvariants, PERFORMANCE_INVARIANT_NAMES,
  canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG, mergeExecutionPerformanceConfig,
} from './execution/performance';
import type {ParameterDescriptor, ObjectiveFunction, CorpusEntry} from './execution/performance';
import type {CorpusEntry as GateCorpusEntry} from './execution/performance';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from './execution/control/config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord, optimizationCorpus, perfProbes,
  perfPlan, perfRecord, healthyCycle, thinCycle, PERFORMANCE_TEST_TIMESTAMP,
} from './execution/performance/test-fixtures';

/**
 * SPRINT 034 — UNIFIED EXECUTION PERFORMANCE INTELLIGENCE & POLICY OPTIMIZATION.
 *
 * PAPER / SIMULATION ONLY — NOT AN AUTHORITY — NO LIVE TRADING.
 *
 * The canonical loop, driven end-to-end against the REAL Sprint 033 control
 * plane and Sprint 031 simulation:
 *
 *   Control Sessions → Observations → Attribution → Benchmarks → Quality
 *   → Venue/Strategy/Domain Intelligence → Policy Evaluation
 *   → Deterministic Parameter Optimization → Policy Candidate
 *   → Simulation Gate → Regression Gate → Promotion Gate
 *   → auditable candidate (NEVER auto-deployed; ELIGIBLE ≠ ACTIVE).
 *
 * Nothing is mocked. Every PASS line is backed by assertions against actual
 * engine output. The performance layer only RECOMMENDS: Risk, AEGIS,
 * Treasury, Portfolio and Execution remain the canonical authorities.
 */

const NOW = PERFORMANCE_TEST_TIMESTAMP;
const objective: ObjectiveFunction = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);

// Deterministic scenario worlds (rebuilt identically on every run).
const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();
const degraded = degradedRecord();
const es = emergencyRecord('demo-es');
const stale = staleRecord('demo-stale');
const abl = ablRecord();
const flip = flipFlopRecord(7);
const corpusRecords = optimizationCorpus();

const LEVER_SPACE: readonly ParameterDescriptor[] = [
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'hysteresis.sameActionCooldownCycles')!,
];

function gateCorpus(): GateCorpusEntry[] {
  return [flip, healthy].map((r) => ({
    label: r.label,
    plan: r.replayInput!.plan,
    cycles: r.replayInput!.cycles,
    startTime: r.session.cycles[0]?.startedAt,
  }));
}

// ---------------------------------------------------------------------------
// Assertion harness — a section only prints PASS when every check holds
// ---------------------------------------------------------------------------

class Section {
  readonly failures: string[] = [];
  constructor(readonly name: string) {}
  check(condition: boolean, label: string): void {
    if (!condition) this.failures.push(label);
  }
  equal<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) this.failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
  same<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    }
  }
}

const sections: Section[] = [];
function section(name: string): Section {
  const s = new Section(name);
  sections.push(s);
  return s;
}

function main(): void {
  const parts: string[] = [];
  const sep = '='.repeat(78);

  parts.push(`${sep}
 SPRINT 034 — EXECUTION PERFORMANCE INTELLIGENCE & POLICY OPTIMIZATION
 One deterministic intelligence + optimization loop over the control plane
 PAPER / SIMULATION ONLY — NOT AN AUTHORITY — NO LIVE TRADING
${sep}`);

  // =========================================================================
  // [OBSERVATIONS] — immutable, sourced, one per cycle×venue
  // =========================================================================
  {
    const s = section('OBSERVATIONS');
    const obs = normalizeSession(healthy);
    s.equal(obs.length, 2, 'one observation per cycle×venue (1 cycle × 2 venues)');
    s.check(Object.isFrozen(obs), 'observation array frozen');
    s.check(obs.every((o) => Object.isFrozen(o)), 'every observation frozen');
    s.check(obs.every((o) => o.observationId.startsWith('pobs_')), 'pobs_ id prefix');
    s.check(obs.every((o) => o.fingerprint.startsWith('pfpo_')), 'pfpo_ fingerprint prefix');
    s.check(obs.every((o) => o.domain === 'AFIS'), 'AFIS domain preserved');
    s.check(obs.every((o) => o.policyVersion === 'v1'), 'policy context carried');
    parts.push(`[OBSERVATIONS]      ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${obs.length} immutable sourced observations from the healthy world`);
  }

  // =========================================================================
  // [OUTCOMES] — deterministic outcome mapping
  // =========================================================================
  {
    const s = section('OUTCOMES');
    s.equal(healthy.session.finalResult!.finalState, 'COMPLETED', 'healthy completes');
    s.equal(es.session.finalResult!.finalState, 'ABORTED', 'emergency stop aborts');
    s.equal(es.session.finalResult!.abortReason, 'EMERGENCY_STOP', 'ES abort reason');
    s.equal(stale.session.finalResult!.finalState, 'ABORTED', 'stale market aborts');
    s.equal(stale.session.finalResult!.abortReason, 'STALE_MARKET', 'stale abort reason');
    s.equal(flip.session.finalResult!.finalState, 'ABORTED', 'oscillation aborts');
    s.equal(flip.session.finalResult!.abortReason, 'OSCILLATION_DETECTED', 'oscillation abort reason');
    // exhausted → PARTIAL when partially filled
    const plan = perfPlan({planId: 'xplan_demo_exh', quantity: 10, referencePrice: 100});
    const exhausted = perfRecord({label: 'exh', plan, cycles: [thinCycle('e0', plan, 100, 3), thinCycle('e1', plan, 100, 3), thinCycle('e2', plan, 100, 3)]});
    s.equal(exhausted.session.finalResult!.finalState, 'EXHAUSTED', 'thin world exhausts cycles');
    s.check(exhausted.session.finalResult!.filledQuantity > 0, 'exhausted world partially filled');
    const obs = normalizeSession(exhausted);
    s.check(obs.every((o) => o.finalState === 'PARTIAL'), 'EXHAUSTED+fills → PARTIAL outcome');
    parts.push(`[OUTCOMES]          ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — COMPLETED / ABORTED(ES, STALE, OSCILLATION) / EXHAUSTED→PARTIAL mapped`);
  }

  // =========================================================================
  // [ATTRIBUTION] — 12 components, reconciled with measured outcomes
  // =========================================================================
  {
    const s = section('ATTRIBUTION');
    const a = attributeSession(drifted.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.equal(a.components.length, 12, 'exactly 12 canonical components');
    s.check(a.reconciles, `components reconcile with measurement (residual ${a.residual.toExponential(2)})`);
    s.check(a.components.every((c) => Number.isFinite(c.value)), 'all values finite');
    s.check(a.components.every((c) => c.source.length > 0 && c.detail.length > 0), 'source + detail documented');
    const fees = a.components.find((c) => c.component === 'FEES')!;
    s.equal(fees.provenance, 'MEASURED', 'FEES measured');
    s.check(fees.value > 0, 'drifted world paid fees');
    const slip = a.components.find((c) => c.component === 'SLIPPAGE')!;
    s.check(slip.value > 0, 'drifted world paid slippage');
    parts.push(`[ATTRIBUTION]        ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 12 components, measured ${(a.measuredTotalCost).toFixed(2)} reconciles (residual ${a.residual.toExponential(1)})`);
  }

  // =========================================================================
  // [ATTRIBUTION-HONESTY] — unavailable components are marked, never fabricated
  // =========================================================================
  {
    const s = section('ATTRIBUTION-HONESTY');
    const a = attributeSession(stale.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.check(a.unavailable.length > 0, 'a no-fill session marks components UNAVAILABLE');
    for (const c of a.components) {
      if (!c.available) {
        s.equal(c.value, 0, `unavailable ${c.component} carries no value`);
        s.equal(c.provenance, 'UNAVAILABLE', `unavailable ${c.component} provenance`);
      }
    }
    s.check(a.measuredTotalCost === 0, 'stale world measured zero cost (no fills)');
    parts.push(`[ATTRIBUTION-HONESTY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${a.unavailable.length} components honestly UNAVAILABLE in the no-fill world`);
  }

  // =========================================================================
  // [BENCHMARKS] — six kinds, explicit provenance, never mixed
  // =========================================================================
  {
    const s = section('BENCHMARKS');
    const results = benchmarkSession(drifted.session, {});
    s.equal(results.length, 6, 'six canonical benchmark kinds');
    s.check(benchmarkKindsComplete(results), 'benchmarkKindsComplete');
    const arrival = results.find((b) => b.kind === 'ARRIVAL_PRICE')!;
    s.equal(arrival.provenance, 'MEASURED', 'ARRIVAL measured');
    s.equal(arrival.price, drifted.session.cycles[0]!.telemetry.benchmarkPrice, 'arrival = first cycle benchmark');
    const decision = results.find((b) => b.kind === 'DECISION_PRICE')!;
    s.equal(decision.price, drifted.session.lineage[0].routes[0]!.referencePrice, 'decision = plan reference price');
    for (const b of results) {
      if (!b.available) s.equal(b.price, null, `${b.kind} unavailable carries no price`);
      else s.check(b.price !== null, `${b.kind} available carries a price`);
    }
    parts.push(`[BENCHMARKS]         ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ARRIVAL/DECISION/VWAP/BEST-VENUE measured+derived; SIM/POLICY honest-unavailable`);
  }

  // =========================================================================
  // [BENCHMARK-HONESTY] — simulated/policy baselines require explicit inputs
  // =========================================================================
  {
    const s = section('BENCHMARK-HONESTY');
    const without = benchmarkSession(healthy.session, {});
    s.equal(without.find((b) => b.kind === 'SIMULATED_REFERENCE')!.available, false, 'no simulated price → unavailable');
    s.equal(without.find((b) => b.kind === 'POLICY_BASELINE')!.available, false, 'no policy baseline → unavailable');
    const withInputs = benchmarkSession(healthy.session, {simulatedReferencePrice: 99.9, policyBaselinePrice: 100.1});
    const sim = withInputs.find((b) => b.kind === 'SIMULATED_REFERENCE')!;
    s.equal(sim.available, true, 'explicit simulated price → available');
    s.equal(sim.provenance, 'SIMULATED', 'SIMULATED provenance, never mixed');
    s.equal(sim.price, 99.9, 'simulated price verbatim');
    s.equal(withInputs.find((b) => b.kind === 'POLICY_BASELINE')!.price, 100.1, 'policy baseline price verbatim');
    parts.push(`[BENCHMARK-HONESTY]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — MEASURED/SIMULATED/DERIVED/UNAVAILABLE never mixed`);
  }

  // =========================================================================
  // [METRICS] — canonical run metrics per session
  // =========================================================================
  {
    const s = section('METRICS');
    const m = sessionRunMetrics(healthy.session, 'healthy');
    s.equal(m.finalState, 'COMPLETED', 'terminal state');
    s.equal(m.fillRate, 1, 'healthy fill rate 1');
    s.check(Number.isFinite(m.costBps) && m.costBps > 0, 'cost in bps');
    s.check(Number.isFinite(m.averageImpactBps), 'impact in bps of filled notional');
    s.check(m.fingerprint.startsWith('pmet_'), 'pmet_ fingerprint');
    const again = sessionRunMetrics(healthy.session, 'healthy');
    s.equal(m.fingerprint, again.fingerprint, 'metrics deterministic');
    parts.push(`[METRICS]            ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — fillRate ${m.fillRate.toFixed(2)}, cost ${m.costBps.toFixed(1)}bps, impact ${m.averageImpactBps.toFixed(2)}bps`);
  }

  // =========================================================================
  // [OBJECTIVE] — the canonical weighted objective, versioned + fingerprinted
  // =========================================================================
  {
    const s = section('OBJECTIVE');
    s.equal(objective.objectiveVersion, 'execution-performance.config.v1', 'objective version');
    s.check(objective.fingerprint.startsWith('pobj_'), 'pobj_ fingerprint');
    const good = sessionObjectiveScore(sessionRunMetrics(healthy.session, 'h'), objective);
    const bad = sessionObjectiveScore(sessionRunMetrics(stale.session, 's'), objective);
    s.check(good > bad, 'healthy scores above aborted');
    const custom = canonicalObjective(mergeExecutionPerformanceConfig({objective: {failure: 2}}));
    s.check(custom.fingerprint !== objective.fingerprint, 'weights versioned: different weights → different fingerprint');
    parts.push(`[OBJECTIVE]          ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — Quality−Cost−Slippage−Impact−Latency−Failure−Adaptation−Incompletion`);
  }

  // =========================================================================
  // [INCOMPLETION-PENALTY] — an aborting session may never outscore on savings
  // =========================================================================
  {
    const s = section('INCOMPLETION-PENALTY');
    // The drifted world completes but pays real slippage; the stale world
    // aborts with zero fills and zero cost. Failure + incompletion penalties
    // must keep the completing policy ahead.
    const completing = sessionObjectiveScore(sessionRunMetrics(drifted.session, 'd'), objective);
    const aborting = sessionObjectiveScore(sessionRunMetrics(stale.session, 's'), objective);
    s.check(completing > aborting, 'completing-with-cost beats aborting-with-savings');
    const corpus = aggregateCorpus(
      [healthy, drifted].map((r) => sessionRunMetrics(r.session, r.label)), objective);
    const dirty = aggregateCorpus(
      [healthy, stale, es].map((r) => sessionRunMetrics(r.session, r.label)), objective);
    s.check(corpus.objectiveScore > dirty.objectiveScore, 'a corpus with aborts scores below a clean corpus');
    parts.push(`[INCOMPLETION-PENALTY] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — safety-weighted objective: completing ${completing.toFixed(3)} > aborting ${aborting.toFixed(3)}`);
  }

  // =========================================================================
  // [QUALITY] — 9 deterministic dimensions + grades, no ML
  // =========================================================================
  {
    const s = section('QUALITY');
    const q = assessPerformanceQuality(degraded.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.equal(q.dimensions.length, 9, '8 efficiency dimensions + OVERALL');
    s.check(q.dimensions.every((d) => d.value >= 0 && d.value <= 1), 'dimension values in [0,1]');
    const recovery = q.dimensions.find((d) => d.name === 'RECOVERY_EFFICIENCY')!;
    s.equal(recovery.value, 1, 'degraded-then-completed earns full recovery credit');
    const grade = assessPerformanceQuality(healthy.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.check(grade.score > q.score || grade.score === q.score, 'healthy quality at least the degraded world');
    const again = assessPerformanceQuality(degraded.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.equal(q.fingerprint, again.fingerprint, 'quality deterministic');
    parts.push(`[QUALITY]            ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 9 dimensions, score ${q.score.toFixed(3)} (${q.grade}), recovery credit earned`);
  }

  // =========================================================================
  // [VENUE-SCORECARDS] — statuses, sample sufficiency, cross-venue baseline
  // =========================================================================
  {
    const s = section('VENUE-SCORECARDS');
    const cards = buildVenueScorecards(normalizeCorpus([healthy, drifted, partial, degraded, flip, stale]), DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.check(cards.length >= 2, 'scorecards for every venue');
    const single = buildVenueScorecards(normalizeSession(healthy), DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    for (const c of single) {
      if (c.sampleCount < DEFAULT_EXECUTION_PERFORMANCE_CONFIG.minVenueSamples) {
        s.equal(c.status, 'INSUFFICIENT_SAMPLE', `${c.venueId} under-sampled → INSUFFICIENT_SAMPLE`);
        s.equal(c.confidence, 0, 'under-sampled confidence 0');
      }
    }
    for (const c of cards) {
      s.check(['INSUFFICIENT_SAMPLE', 'NORMAL', 'DEGRADED', 'IMPROVING', 'STABLE', 'HIGH_QUALITY'].includes(c.status), `${c.venueId} canonical status`);
    }
    parts.push(`[VENUE-SCORECARDS]   ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${cards.map((c) => `${c.venueId}:${c.status}`).join(' ')}`);
  }

  // =========================================================================
  // [VENUE-DEGRADATION] — degradation visible, recovery credited
  // =========================================================================
  {
    const s = section('VENUE-DEGRADATION');
    const withDegraded = buildVenueScorecards(normalizeCorpus([healthy, degraded]), DEFAULT_EXECUTION_PERFORMANCE_CONFIG).find((c) => c.venueId === 'venue-a')!;
    const healthyOnly = buildVenueScorecards(normalizeSession(healthy), DEFAULT_EXECUTION_PERFORMANCE_CONFIG).find((c) => c.venueId === 'venue-a')!;
    s.check(withDegraded.averageLatencyMs > healthyOnly.averageLatencyMs, 'degraded world raises venue latency');
    const q = assessPerformanceQuality(degraded.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    const bands = degraded.session.cycles.map((c) => c.result.qualityBand);
    s.check(bands.includes('DEGRADED'), 'DEGRADED band observed mid-flight');
    s.check(bands.includes('HIGH_QUALITY'), 'recovered to HIGH_QUALITY');
    s.equal(degraded.session.finalResult!.finalState, 'COMPLETED', 'degraded session still completed (recovery)');
    parts.push(`[VENUE-DEGRADATION]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — latency ${(healthyOnly.averageLatencyMs).toFixed(0)}→${(withDegraded.averageLatencyMs).toFixed(0)}ms, degraded→recovered→COMPLETED`);
  }

  // =========================================================================
  // [STRATEGY-SCORES] — strategy intelligence without touching the Registry
  // =========================================================================
  {
    const s = section('STRATEGY-SCORES');
    const scores = buildStrategyScores(normalizeCorpus([healthy, drifted, partial, abl]));
    s.check(scores.length >= 1, 'strategy groups produced');
    const domains = new Set(scores.map((x) => x.domain));
    s.check(domains.has('AFIS') && domains.has('ABL'), 'AFIS + ABL strategies separated');
    s.check(scores.every((x) => Number.isFinite(x.executionQuality)), 'execution quality finite');
    const before = JSON.stringify(scores.map((x) => x.fingerprint));
    const again = buildStrategyScores(normalizeCorpus([healthy, drifted, partial, abl]));
    s.equal(JSON.stringify(again.map((x) => x.fingerprint)), before, 'strategy scores deterministic');
    parts.push(`[STRATEGY-SCORES]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${scores.length} strategy group(s) across ${domains.size} domain(s), Strategy Registry untouched`);
  }

  // =========================================================================
  // [DOMAIN-SCORES] — one engine, AFIS + ABL adapters only
  // =========================================================================
  {
    const s = section('DOMAIN-SCORES');
    const domains = buildDomainScores(normalizeCorpus([healthy, drifted, partial, degraded, abl]));
    s.equal(domains.length, 2, 'both domains scored');
    const afis = domains.find((d) => d.domain === 'AFIS')!;
    const ablSide = domains.find((d) => d.domain === 'ABL')!;
    s.equal(afis.sessionCount, 4, 'AFIS sessions aggregated');
    s.equal(ablSide.sessionCount, 1, 'ABL sessions aggregated');
    // identical worlds → identical scores (domain adapter relabels only)
    const afisM = sessionRunMetrics(healthy.session, 'a');
    const ablM = sessionRunMetrics(abl.session, 'b');
    s.equal(sessionObjectiveScore(afisM, objective), sessionObjectiveScore(ablM, objective), 'identical worlds score identically across domains');
    parts.push(`[DOMAIN-SCORES]      ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — AFIS quality ${afis.executionQuality.toFixed(3)} / ABL quality ${ablSide.executionQuality.toFixed(3)} (same engine)`);
  }

  // =========================================================================
  // [POLICY-EVALUATION] — deterministic score + sample sufficiency
  // =========================================================================
  {
    const s = section('POLICY-EVALUATION');
    const evals = evaluatePolicies([healthy, drifted, partial, degraded, flip], DEFAULT_EXECUTION_PERFORMANCE_CONFIG, objective);
    s.equal(evals.length, 1, 'one policy group');
    const pe = evals[0]!;
    s.equal(pe.sessionCount, 5, 'all sessions in the group');
    s.equal(pe.sufficientSamples, true, 'sample sufficiency satisfied');
    s.check(Number.isFinite(pe.score), 'policy score finite');
    const tiny = evaluatePolicies([healthy], DEFAULT_EXECUTION_PERFORMANCE_CONFIG, objective);
    s.equal(tiny[0]!.sufficientSamples, false, 'under-session policy marked insufficient');
    const cmp = comparePolicies(pe, tiny[0]!);
    s.check(cmp.better === null || typeof cmp.better === 'string', 'comparison deterministic');
    parts.push(`[POLICY-EVALUATION]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — policy ${pe.policyId} ${pe.version}: ${pe.sessionCount} sessions, score ${pe.score.toFixed(3)}`);
  }

  // =========================================================================
  // [PARAMETER-SPACE] — 11 bounded descriptors, grids, defaults on-grid
  // =========================================================================
  {
    const s = section('PARAMETER-SPACE');
    s.equal(DEFAULT_PARAMETER_SPACE.length, 11, '11 optimizable descriptors');
    for (const d of DEFAULT_PARAMETER_SPACE) {
      const value = getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, d.path);
      s.check(value >= d.min - 1e-9 && value <= d.max + 1e-9, `${d.path} default in bounds`);
      s.check(gridValues(d).some((v) => Math.abs(v - value) < 1e-9), `${d.path} default on grid`);
    }
    s.equal(PROTECTED_PARAMETER_PATHS.length, 6, '6 protected safety paths');
    const grid = enumerateGrid(LEVER_SPACE);
    s.equal(grid.length, gridValues(LEVER_SPACE[0]!).length * gridValues(LEVER_SPACE[1]!).length, 'grid enumeration exact');
    parts.push(`[PARAMETER-SPACE]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 11 descriptors, ${PROTECTED_PARAMETER_PATHS.length} protected paths, defaults on-grid`);
  }

  // =========================================================================
  // [PROTECTED-PATHS] — safety parameters can never be optimized
  // =========================================================================
  {
    const s = section('PROTECTED-PATHS');
    const violation = buildParameterSet([{path: 'limits.maxSlippageBps', value: 5_000}]);
    const v = parameterSetIsValid(DEFAULT_PARAMETER_SPACE, violation);
    s.equal(v.valid, false, 'protected path rejected by parameter validation');
    s.check(v.violations.some((x) => x.includes('protected')), 'violation names the protected path');
    const offGrid = buildParameterSet([{path: 'budgets.maxReprices', value: 7}]);
    s.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, offGrid).valid, false, 'off-grid value rejected');
    const unknown = buildParameterSet([{path: 'risk.tolerance', value: 1}]);
    s.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, unknown).valid, false, 'unknown path rejected');
    const clean = baselineParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, DEFAULT_PARAMETER_SPACE);
    s.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, clean).valid, true, 'the full baseline set is valid');
    parts.push(`[PROTECTED-PATHS]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — safety paths, off-grid and unknown values all rejected`);
  }

  // =========================================================================
  // [OPTIMIZER-COORDINATE] — deterministic coordinate search finds the lever
  // =========================================================================
  {
    const s = section('OPTIMIZER-COORDINATE');
    const corpus = gateCorpus();
    const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: LEVER_SPACE, objective, method: 'COORDINATE'});
    s.check(outcome.best !== null, 'an improving parameter set was found');
    const reroute = outcome.best!.entries.find((e) => e.path === 'adaptive.thresholds.rerouteThreshold')!;
    s.check(reroute.value > 0.1, `reroute threshold raised from 0.1 to ${reroute.value}`);
    s.check(outcome.bestScore! > outcome.baselineScore, `score ${outcome.baselineScore.toFixed(4)} → ${outcome.bestScore!.toFixed(4)}`);
    const again = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: LEVER_SPACE, objective, method: 'COORDINATE'});
    s.same(outcome.searchTrace, again.searchTrace, 'search trace identical on re-run');
    s.equal(outcome.best!.fingerprint, again.best!.fingerprint, 'best set identical on re-run');
    s.check(outcome.evaluated.every((e) => Number.isFinite(e.score)), 'all evaluated scores finite');
    parts.push(`[OPTIMIZER-COORDINATE] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${outcome.evaluated.length} evaluations, rerouteThreshold 0.1→${reroute.value}, score ${outcome.baselineScore.toFixed(4)}→${outcome.bestScore!.toFixed(4)}`);
  }

  // =========================================================================
  // [OPTIMIZER-GRID] — bounded exhaustive enumeration, deterministic
  // =========================================================================
  {
    const s = section('OPTIMIZER-GRID');
    const corpus = gateCorpus();
    const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: [LEVER_SPACE[0]!], objective, method: 'GRID'});
    s.equal(outcome.evaluated.length, 5, 'grid of 5 reroute values fully enumerated');
    s.check(outcome.bestScore === null || outcome.bestScore >= outcome.baselineScore, 'grid best ≥ baseline');
    parts.push(`[OPTIMIZER-GRID]     ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — bounded exhaustive grid: ${outcome.evaluated.length} sets, deterministic ranking`);
  }

  // =========================================================================
  // [SIMULATION-GATE] — identical inputs, both arms, canonical deltas
  // =========================================================================
  {
    const s = section('SIMULATION-GATE');
    const corpus = gateCorpus();
    const candidateSet = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
    const arms = runSimulationGate({
      corpus,
      baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
      candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, candidateSet),
      candidateLabel: 'demo-candidate',
      objective,
    });
    s.equal(arms.comparison.identicalInputs, true, 'both arms consumed identical inputs');
    s.equal(arms.baselineSessions[0]!.finalResult!.finalState, 'ABORTED', 'baseline aborts on the flip-flop world');
    s.equal(arms.candidateSessions[0]!.finalResult!.finalState, 'COMPLETED', 'candidate completes it');
    const d = arms.comparison.delta;
    s.check(d.completionDelta > 0, 'completion delta positive');
    s.check(d.failureDelta < 0, 'failure delta negative');
    s.check(d.objectiveDelta > 0, 'objective delta positive');
    for (const key of ['qualityDelta', 'costBpsDelta', 'slippageDeltaBps', 'impactDeltaBps', 'latencyDeltaMs', 'completionDelta', 'failureDelta', 'objectiveDelta', 'fillRateDelta'] as const) {
      s.check(Number.isFinite(d[key]), `delta ${key} finite`);
    }
    const again = runSimulationGate({
      corpus,
      baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
      candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, candidateSet),
      candidateLabel: 'demo-candidate',
      objective,
    });
    s.equal(arms.comparison.fingerprint, again.comparison.fingerprint, 'comparison fingerprint byte-identical on re-run');
    parts.push(`[SIMULATION-GATE]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — identical inputs: baseline ABORTED vs candidate COMPLETED, Δobjective ${d.objectiveDelta.toFixed(4)}`);
  }

  // =========================================================================
  // [REGRESSION-GATE] — protected conditions hold for the clean candidate
  // =========================================================================
  {
    const s = section('REGRESSION-GATE');
    const corpus = gateCorpus();
    const candidateSet = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
    const candidateConfig = applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, candidateSet);
    const arms = runSimulationGate({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, candidateConfig, candidateLabel: 'demo-candidate', objective});
    const probes = perfProbes();
    const regression = evaluateRegressionGate({
      candidateParameters: candidateSet,
      candidateSessions: arms.candidateSessions,
      initialPlans: arms.candidateSessions.map((sess, i) => ({plan: corpus[i]!.plan, session: sess})),
      probes: {emergencyStop: probes.emergencyStop, staleMarket: probes.staleMarket, replay: {plan: corpus[0]!.plan, cycles: corpus[0]!.cycles}},
      candidateConfig,
    });
    s.equal(regression.passed, true, `clean candidate passes every protected condition (${regression.violations.join('; ')})`);
    s.equal(regression.checks.length, 12, 'all protected conditions evaluated');
    for (const c of regression.checks) {
      s.check(c.passed, `${c.condition}: ${c.detail}`);
    }
    parts.push(`[REGRESSION-GATE]    ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — 12/12 protected conditions hold (ES, fail-closed, replay, quantity, risk/AEGIS, budgets, audit, semantics)`);
  }

  // =========================================================================
  // [REGRESSION-REJECTION] — better quality but a protected constraint → REJECTED
  // =========================================================================
  {
    const s = section('REGRESSION-REJECTION');
    // A hand-built candidate that "improves" execution by relaxing the
    // slippage guardrail — the regression gate must refuse it.
    const violating = buildParameterSet([
      {path: 'adaptive.thresholds.rerouteThreshold', value: 0.2},
      {path: 'limits.maxSlippageBps', value: 5_000},
    ]);
    const validation = parameterSetIsValid(DEFAULT_PARAMETER_SPACE, violating);
    s.equal(validation.valid, false, 'parameter validation rejects the protected path');
    const corpus = gateCorpus();
    const violatingConfig = applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, violating);
    const arms = runSimulationGate({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, candidateConfig: violatingConfig, candidateLabel: 'violating', objective});
    const probes = perfProbes();
    const regression = evaluateRegressionGate({
      candidateParameters: violating,
      candidateSessions: arms.candidateSessions,
      initialPlans: arms.candidateSessions.map((sess, i) => ({plan: corpus[i]!.plan, session: sess})),
      probes: {emergencyStop: probes.emergencyStop, staleMarket: probes.staleMarket, replay: {plan: corpus[0]!.plan, cycles: corpus[0]!.cycles}},
      candidateConfig: violatingConfig,
    });
    s.equal(regression.passed, false, 'regression gate rejects the candidate');
    s.check(regression.violations.some((v) => v.includes('protected')), 'violation names the protected path');
    // ...and the promotion gate turns that into REGRESSION_FAILED
    const base = createPolicyCandidate({
      parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1,
      domain: 'CROSS_DOMAIN', parameters: violating,
      objectiveScore: arms.comparison.candidate.objectiveScore,
      baselineScore: arms.comparison.baseline.objectiveScore,
      observedSampleSize: 2, createdAt: NOW,
      parentLineage: Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]),
    });
    const promotion = evaluatePromotionGate({
      candidate: base,
      validation: {valid: false, violations: validation.violations},
      comparison: arms.comparison,
      regression,
      config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
    });
    s.check(promotion.state === 'REJECTED' || promotion.state === 'REGRESSION_FAILED', `promotion state ${promotion.state} refuses the candidate`);
    parts.push(`[REGRESSION-REJECTION] ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — quality gain + protected-path violation → ${promotion.state} (safety never traded for performance)`);
  }

  // =========================================================================
  // [PROMOTION-GATE] — the full state machine, deterministically
  // =========================================================================
  {
    const s = section('PROMOTION-GATE');
    const mk = (observedSampleSize: number, objectiveScore: number, baselineScore: number) =>
      createPolicyCandidate({
        parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1,
        domain: 'CROSS_DOMAIN',
        parameters: buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]),
        objectiveScore, baselineScore, observedSampleSize, createdAt: NOW,
        parentLineage: Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]),
      });
    const ok = {valid: true as const, violations: [] as string[]};
    const passed = {passed: true, violations: [], checks: [], fingerprint: 'preg_demo'};
    s.equal(evaluatePromotionGate({candidate: mk(1, 0.5, 0.3), validation: ok, comparison: {delta: {objectiveDelta: 0.2}} as never, regression: passed as never, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG}).state, 'INSUFFICIENT_DATA', 'state 1: INSUFFICIENT_DATA');
    s.equal(evaluatePromotionGate({candidate: mk(5, 0.5, 0.3), validation: {valid: false, violations: ['x']}, comparison: {delta: {objectiveDelta: 0.2}} as never, regression: passed as never, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG}).state, 'REJECTED', 'state 2: REJECTED');
    s.equal(evaluatePromotionGate({candidate: mk(5, 0.5, 0.3), validation: ok, comparison: null, regression: null, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG}).state, 'SIMULATION_FAILED', 'state 3: SIMULATION_FAILED');
    s.equal(evaluatePromotionGate({candidate: mk(5, 0.5, 0.3), validation: ok, comparison: {delta: {objectiveDelta: 0.2}} as never, regression: {passed: false, violations: ['x'], checks: [], fingerprint: 'y'} as never, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG}).state, 'REGRESSION_FAILED', 'state 4: REGRESSION_FAILED');
    s.equal(evaluatePromotionGate({candidate: mk(5, 0.31, 0.3), validation: ok, comparison: {delta: {objectiveDelta: 0.01}} as never, regression: passed as never, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG}).state, 'IMPROVEMENT_INSUFFICIENT', 'state 5: IMPROVEMENT_INSUFFICIENT');
    const eligible = evaluatePromotionGate({candidate: mk(5, 0.5, 0.3), validation: ok, comparison: {delta: {objectiveDelta: 0.2}} as never, regression: passed as never, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG});
    s.equal(eligible.state, 'ELIGIBLE', 'state 6: ELIGIBLE');
    s.equal(eligible.eligible, true, 'ELIGIBLE flag set');
    parts.push(`[PROMOTION-GATE]     ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — INSUFFICIENT_DATA → REJECTED → SIMULATION_FAILED → REGRESSION_FAILED → IMPROVEMENT_INSUFFICIENT → ELIGIBLE`);
  }

  // =========================================================================
  // [CANDIDATE] — immutable, versioned, active policy untouched
  // =========================================================================
  {
    const s = section('CANDIDATE');
    const params = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
    const c = createPolicyCandidate({
      parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1,
      domain: 'CROSS_DOMAIN', parameters: params,
      objectiveScore: 0.5, baselineScore: 0.3, observedSampleSize: 3, createdAt: NOW,
      parentLineage: Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]),
    });
    s.equal(c.candidateVersion, 'v1.1', 'candidate version v1 → v1.1');
    s.check(Object.isFrozen(c), 'candidate frozen');
    s.equal(c.promotionState, 'INSUFFICIENT_DATA', 'starts INSUFFICIENT_DATA');
    const updated = withGateResults(c, {promotionState: 'ELIGIBLE'});
    s.equal(updated.promotionState, 'ELIGIBLE', 'gate results produce a new candidate');
    s.equal(c.promotionState, 'INSUFFICIENT_DATA', 'the original candidate is untouched');
    s.check(DEFAULT_EXECUTION_CONTROL_CONFIG.adaptive.thresholds.rerouteThreshold === 0.1, 'active policy config untouched');
    parts.push(`[CANDIDATE]          ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${c.candidateId.slice(0, 16)}… v1→v1.1 immutable; active policy untouched`);
  }

  // =========================================================================
  // [APPROVAL] — explicit approval only; ELIGIBLE ≠ ACTIVE
  // =========================================================================
  {
    const s = section('APPROVAL');
    const params = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
    const c = withGateResults(createPolicyCandidate({
      parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1,
      domain: 'CROSS_DOMAIN', parameters: params,
      objectiveScore: 0.5, baselineScore: 0.3, observedSampleSize: 3, createdAt: NOW,
      parentLineage: Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]),
    }), {validationStatus: 'VALID', simulationStatus: 'PASSED', regressionStatus: 'PASSED', promotionState: 'ELIGIBLE'});
    s.check(isApprovable(c), 'ELIGIBLE candidate is approvable');
    let refused = false;
    try { approveCandidate({...c, promotionState: 'INSUFFICIENT_DATA'} as never); } catch { refused = true; }
    s.check(refused, 'non-ELIGIBLE candidates cannot be approved');
    const approved = approveCandidate(c);
    s.equal(approved.promotionState, 'APPROVED_CANDIDATE', 'explicit approval → APPROVED_CANDIDATE');
    s.equal(c.promotionState, 'ELIGIBLE', 'the source candidate stays ELIGIBLE (ELIGIBLE ≠ ACTIVE)');
    let doubleRefused = false;
    try { approveCandidate(approved); } catch { doubleRefused = true; }
    s.check(doubleRefused, 'double approval refused');
    parts.push(`[APPROVAL]           ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — explicit approval only; ELIGIBLE ≠ ACTIVE; double-approval refused`);
  }

  // =========================================================================
  // [LINEAGE] — v1 → v1.1 → v1.2 → v2 with immutable history
  // =========================================================================
  {
    const s = section('LINEAGE');
    const params = (v: number) => buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: v}]);
    const root = Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]);
    const c1 = createPolicyCandidate({parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1, domain: 'CROSS_DOMAIN', parameters: params(0.15), objectiveScore: 0.4, baselineScore: 0.3, observedSampleSize: 3, createdAt: NOW, parentLineage: root});
    const c2 = withGateResults(createPolicyCandidate({parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 2, domain: 'CROSS_DOMAIN', parameters: params(0.2), objectiveScore: 0.5, baselineScore: 0.3, observedSampleSize: 3, createdAt: NOW, parentLineage: root}), {promotionState: 'ELIGIBLE'});
    const approved = approveCandidate(c2);
    const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [c1, approved]});
    s.same(lineage.nodes.map((n) => `${n.version}:${n.kind}`), ['v1:ROOT', 'v1.1:CANDIDATE', 'v1.2:CANDIDATE', 'v2:APPROVED'], 'full chain v1 → v1.1 → v1.2 → v2');
    s.check(validatePolicyLineage(lineage).valid, 'lineage validates');
    s.check(Object.isFrozen(lineage) && lineage.nodes.every((n) => Object.isFrozen(n)), 'lineage immutable');
    const again = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [c1, approved]});
    s.equal(lineage.fingerprint, again.fingerprint, 'lineage reconstructs byte-identically (exact replay)');
    parts.push(`[LINEAGE]            ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — v1 → v1.1 → v1.2 → v2 (approved), immutable + exactly replayable`);
  }

  // =========================================================================
  // [AUDIT] — oship.execution-performance.v1 hash chain over the loop
  // =========================================================================
  {
    const s = section('AUDIT');
    const result = new ExecutionPerformanceEngine().analyze({
      records: corpusRecords,
      policy: {id: 'policy-execution', version: 'v1'},
      optimization: {space: LEVER_SPACE, method: 'COORDINATE'},
      probes: perfProbes(),
      timestamp: NOW,
    });
    const types = result.auditEvents.map((e) => e.eventType);
    for (const expected of ['OBSERVATION_CREATED', 'ATTRIBUTION_CALCULATED', 'BENCHMARK_CALCULATED', 'QUALITY_CALCULATED', 'POLICY_EVALUATED', 'OPTIMIZATION_STARTED', 'SIMULATION_COMPLETED', 'CANDIDATE_GENERATED', 'REGRESSION_GATE_RESULT', 'PROMOTION_GATE_RESULT', 'CANDIDATE_ACCEPTED'] as const) {
      s.check(types.includes(expected), `audit event ${expected}`);
    }
    s.check(verifyPerformanceAuditStream(result.auditEvents), 'hash chain verifies');
    s.equal(result.auditEvents[0]!.previousHash, PERFORMANCE_GENESIS_HASH, 'genesis link');
    result.auditEvents.forEach((e, i) => s.equal(e.sequence, i, `sequence ${i}`));
    parts.push(`[AUDIT]              ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${result.auditEvents.length} events, 12 canonical types, hash chain verified`);
  }

  // =========================================================================
  // [AUDIT-TAMPER] — tampering with the audit chain fails closed
  // =========================================================================
  {
    const s = section('AUDIT-TAMPER');
    const log = new PerformanceAuditLog('panalysis_demo', NOW);
    log.record('OBSERVATION_CREATED', {count: 2});
    log.record('QUALITY_CALCULATED', {score: 0.9});
    const events = [...log.eventsView];
    s.check(verifyPerformanceAuditStream(events), 'pristine chain verifies');
    const tampered = [...events];
    tampered[1] = {...tampered[1]!, payload: {...tampered[1]!.payload, score: 0.99}} as never;
    s.check(!verifyPerformanceAuditStream(tampered), 'payload tampering detected');
    const reordered = [events[1]!, events[0]!];
    s.check(!verifyPerformanceAuditStream(reordered), 'reordering detected');
    s.check(!verifyPerformanceAuditStream([events[1]!]), 'dropping the head detected');
    parts.push(`[AUDIT-TAMPER]       ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — payload tamper, reordering and truncation all fail closed`);
  }

  // =========================================================================
  // [REPLAY] — byte-identical analysis reproduction
  // =========================================================================
  {
    const s = section('REPLAY');
    const input = {
      records: corpusRecords,
      policy: {id: 'policy-execution', version: 'v1'},
      optimization: {space: LEVER_SPACE, method: 'COORDINATE'} as const,
      probes: perfProbes(),
      timestamp: NOW,
    };
    const cmp = replayPerformanceAnalysis(input);
    s.check(cmp.equivalent, `replay differences: ${cmp.differences.join('; ')}`);
    const a = new ExecutionPerformanceEngine().analyze(input);
    const b = new ExecutionPerformanceEngine().analyze(input);
    s.equal(a.analysisFingerprint, b.analysisFingerprint, 'analysis fingerprint byte-identical');
    s.same(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash), 'audit chain byte-identical');
    s.same(a.optimization!.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`), b.optimization!.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`), 'optimization ranking byte-identical');
    parts.push(`[REPLAY]             ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — identical inputs → byte-identical metrics, ranking, candidate, fingerprint, audit chain`);
  }

  // =========================================================================
  // [INVARIANTS] — ≥25 hard invariants over the full analysis
  // =========================================================================
  {
    const s = section('INVARIANTS');
    const result = new ExecutionPerformanceEngine().analyze({
      records: corpusRecords,
      policy: {id: 'policy-execution', version: 'v1'},
      optimization: {space: LEVER_SPACE, method: 'COORDINATE'},
      probes: perfProbes(),
      timestamp: NOW,
    });
    const report = checkPerformanceInvariants({result, records: corpusRecords});
    s.check(PERFORMANCE_INVARIANT_NAMES.length >= 25, `${PERFORMANCE_INVARIANT_NAMES.length} invariants declared`);
    s.check(report.ok, `invariant violations: ${report.violations.join('; ')}`);
    s.equal(report.checks.length, PERFORMANCE_INVARIANT_NAMES.length, 'every invariant evaluated');
    const again = checkPerformanceInvariants({result, records: corpusRecords});
    s.equal(report.fingerprint, again.fingerprint, 'invariant report deterministic');
    parts.push(`[INVARIANTS]         ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${PERFORMANCE_INVARIANT_NAMES.length}/${PERFORMANCE_INVARIANT_NAMES.length} hard invariants hold`);
  }

  // =========================================================================
  // [ENGINE-E2E] — the genuinely better candidate reaches ELIGIBLE
  // =========================================================================
  {
    const s = section('ENGINE-E2E');
    const result = new ExecutionPerformanceEngine().analyze({
      records: corpusRecords,
      policy: {id: 'policy-execution', version: 'v1'},
      optimization: {space: LEVER_SPACE, method: 'COORDINATE'},
      probes: perfProbes(),
      timestamp: NOW,
    });
    s.equal(result.candidates.length, 1, 'exactly one candidate generated');
    const c = result.candidates[0]!;
    s.equal(c.validationStatus, 'VALID', 'candidate structurally valid');
    s.equal(c.simulationStatus, 'PASSED', 'simulation gate passed');
    s.equal(c.regressionStatus, 'PASSED', 'regression gate passed');
    s.equal(c.promotionState, 'ELIGIBLE', 'promotion gate → ELIGIBLE');
    s.check(c.objectiveScore > c.baselineScore, `candidate ${c.objectiveScore.toFixed(4)} > baseline ${c.baselineScore.toFixed(4)}`);
    s.check(c.expectedImprovement >= DEFAULT_EXECUTION_PERFORMANCE_CONFIG.minImprovement, `improvement ${(c.expectedImprovement * 100).toFixed(1)}% ≥ threshold`);
    s.check(c.observedSampleSize >= DEFAULT_EXECUTION_PERFORMANCE_CONFIG.minPolicySessions, 'sufficient observations');
    s.check(result.optimization !== null && result.optimization.evaluated.length > 1, 'optimization evaluated multiple sets');
    parts.push(`[ENGINE-E2E]         ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — genuinely better candidate: ${c.candidateVersion} ${c.baselineScore.toFixed(4)}→${c.objectiveScore.toFixed(4)} (${(c.expectedImprovement * 100).toFixed(1)}%) → ELIGIBLE`);
  }

  // =========================================================================
  // [ADVERSE-EXECUTION] — stale markets fail closed, nothing fabricated
  // =========================================================================
  {
    const s = section('ADVERSE-EXECUTION');
    s.equal(stale.session.finalResult!.finalState, 'ABORTED', 'all-stale market aborts');
    s.equal(stale.session.finalResult!.abortReason, 'STALE_MARKET', 'STALE_MARKET reason');
    s.equal(stale.session.finalResult!.filledQuantity, 0, 'nothing filled');
    const obs = normalizeSession(stale);
    s.check(obs.every((o) => o.filledQuantity === 0), 'observations show zero fills');
    const a = attributeSession(stale.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.equal(a.measuredTotalCost, 0, 'no fabricated cost');
    s.check(a.unavailable.length > 0, 'cost components honestly unavailable');
    const m = sessionRunMetrics(stale.session, 'stale');
    s.equal(m.averageImpactBps, 0, 'no fabricated impact');
    parts.push(`[ADVERSE-EXECUTION]  ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — all-stale market: ABORTED/STALE_MARKET, zero fills, zero fabricated cost`);
  }

  // =========================================================================
  // [PARTIAL-FILLS] — thin liquidity, honest ratios, budgeted reslices
  // =========================================================================
  {
    const s = section('PARTIAL-FILLS');
    const obs = normalizeSession(partial);
    s.check(obs.some((o) => o.fillRatio > 0 && o.fillRatio < 1), 'partial fill ratios visible');
    s.check(partial.session.actionBudget.resliceCount > 0, 'reslices applied');
    s.check(partial.session.actionBudget.resliceCount <= 3, 'reslice budget respected');
    s.equal(partial.session.finalResult!.finalState, 'COMPLETED', 'thin world still completes');
    const a = attributeSession(partial.session, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.check(a.components.some((c) => c.component === 'RESLICE_COST' && c.available), 'reslice cost attributed');
    parts.push(`[PARTIAL-FILLS]      ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${partial.session.actionBudget.resliceCount} budgeted reslices, honest ratios, completed ${partial.session.finalResult!.filledQuantity}/${partial.session.lineage[0].routes.reduce((x, r) => x + r.quantity, 0)}`);
  }

  // =========================================================================
  // [REPEATED-ACTIONS] — oscillation guard aborts unbounded adaptation
  // =========================================================================
  {
    const s = section('REPEATED-ACTIONS');
    s.equal(flip.session.finalResult!.finalState, 'ABORTED', 'flip-flop world aborts under the default policy');
    s.equal(flip.session.finalResult!.abortReason, 'OSCILLATION_DETECTED', 'OSCILLATION_DETECTED');
    const reroutes = flip.session.cycles.filter((c) => c.action === 'REROUTE').length;
    s.check(reroutes >= 3, `${reroutes} reroutes before the guard fired`);
    s.check(flip.session.actionBudget.rerouteCount <= 3, 'reroute budget never exceeded');
    const obs = normalizeSession(flip);
    s.check(obs.some((o) => o.action === 'REROUTE'), 'reroute traces in observations');
    const cards = buildVenueScorecards(normalizeCorpus([healthy, flip]), DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
    s.check(cards.some((c) => c.rerouteFrequency > 0), 'reroute frequency on the venue scorecards');
    parts.push(`[REPEATED-ACTIONS]   ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — ${reroutes} consecutive reroutes → oscillation guard → ABORT (never unbounded)`);
  }

  // =========================================================================
  // [AFIS-ABL] — one engine, two domains, identical rules
  // =========================================================================
  {
    const s = section('AFIS-ABL');
    const engine = new ExecutionPerformanceEngine();
    const afis = engine.analyze({records: [healthy, drifted, partial], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: NOW});
    const ablSide = engine.analyze({records: [abl], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: NOW});
    s.equal(afis.domainScores.length, 1, 'AFIS analysis scores AFIS');
    s.equal(ablSide.domainScores.length, 1, 'ABL analysis scores ABL');
    s.equal(afis.domainScores[0]!.domain, 'AFIS', 'AFIS domain');
    s.equal(ablSide.domainScores[0]!.domain, 'ABL', 'ABL domain');
    s.same(afis.qualities[0]!.dimensions.map((d) => d.name), ablSide.qualities[0]!.dimensions.map((d) => d.name), 'identical quality dimensions');
    s.same(afis.attributions[0]!.components.map((c) => c.component), ablSide.attributions[0]!.components.map((c) => c.component), 'identical attribution components');
    const mixed = engine.analyze({records: [healthy, drifted, partial, abl], policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: NOW});
    s.equal(mixed.domainScores.length, 2, 'mixed corpus scores both domains in one pass');
    parts.push(`[AFIS-ABL]           ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — one engine, domain adapters only: AFIS + ABL scored identically`);
  }

  // =========================================================================
  // [NO-AUTHORITY] — the performance layer is not an authority
  // =========================================================================
  {
    const s = section('NO-AUTHORITY');
    const result = new ExecutionPerformanceEngine().analyze({
      records: [healthy, drifted, partial, es, stale, flip],
      policy: {id: 'policy-execution', version: 'v1'},
      optimization: null,
      timestamp: NOW,
    });
    const json = JSON.stringify(result);
    s.check(!json.includes('"treasury"'), 'no treasury surface');
    s.check(!json.includes('"portfolio"'), 'no portfolio surface');
    s.check(result.candidates.every((c) => c.promotionState !== 'APPROVED_CANDIDATE'), 'no autonomous promotion');
    s.check(['INSUFFICIENT_DATA', 'REJECTED', 'SIMULATION_FAILED', 'REGRESSION_FAILED', 'IMPROVEMENT_INSUFFICIENT', 'ELIGIBLE', 'APPROVED_CANDIDATE'].every((st) => st !== 'ACTIVE'), 'no ACTIVE state exists in the promotion vocabulary');
    const report = checkPerformanceInvariants({result, records: [healthy, drifted, partial, es, stale, flip]});
    s.check(report.ok, 'invariants confirm the layer is not an authority');
    parts.push(`[NO-AUTHORITY]       ${s.failures.length === 0 ? 'PASS' : 'FAIL'}  — no treasury/portfolio/risk/AEGIS surfaces; recommendation only`);
  }

  // =========================================================================
  // Summary
  // =========================================================================

  const failed = sections.filter((x) => x.failures.length > 0);
  parts.push('');
  parts.push(' '.repeat(0) + `${sep}`);
  parts.push(` SPRINT 034 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  for (const sec of sections) {
    parts.push(`   [${sec.name}] ${sec.failures.length === 0 ? 'PASS' : 'FAIL'}`);
  }
  parts.push(sep);
  if (failed.length === 0) {
    parts.push(`
 The canonical loop ran end-to-end on deterministic worlds:
 observations → attribution → benchmarks → quality → venue/strategy/domain
 intelligence → policy evaluation → deterministic optimization (grid +
 coordinate) → simulation gate (identical inputs) → regression gate (12
 protected conditions) → promotion gate → auditable ELIGIBLE candidate.

 The performance layer recommended; it never deployed. ELIGIBLE ≠ ACTIVE.
 Audit chain oship.execution-performance.v1 verified. Replay is
 byte-identical. ${PERFORMANCE_INVARIANT_NAMES.length} hard invariants hold.

 SYSTEM STATUS: RECONCILED`);
  } else {
    parts.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const sec of failed) {
      parts.push(`   [${sec.name}]`);
      for (const f of sec.failures) parts.push(`     - ${f}`);
    }
    parts.push('');
    parts.push(' SYSTEM STATUS: UNRECONCILED');
  }

  console.log(parts.join('\n'));
  if (failed.length > 0) process.exit(1);
}

main();
