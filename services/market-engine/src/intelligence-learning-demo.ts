import {LearningEngine} from './intelligence/learning/engine';
import {mergeLearningConfig} from './intelligence/learning/config';
import {buildLearningObservations} from './intelligence/learning/sample';
import {buildFeatureVectors} from './intelligence/learning/feature-vector';
import {buildCohorts, rawCrossDomainCohort} from './intelligence/learning/cohort';
import {historicalBaseline, domainNormalizedBaseline, baselineUsable} from './intelligence/learning/baseline';
import {classifyRegimes, regimeSummary} from './intelligence/learning/regime';
import {assessDrift} from './intelligence/learning/drift';
import {assessStability} from './intelligence/learning/stability';
import {causalVerdictOf} from './intelligence/learning/causal-safety';
import {verifyLearningAudit} from './intelligence/learning/audit';
import {compareLearningResults} from './intelligence/learning/replay';
import {checkLearningInvariants} from './intelligence/learning/invariants';
import {learningCorpus, learningInput, contradictedResearch} from './intelligence/learning/test-fixtures';

/**
 * SPRINT 037 — UNIFIED INTELLIGENCE LEARNING & FEEDBACK ENGINE demo.
 *
 * PAPER / SIMULATION ONLY — AN ANALYTICAL LAYER, NOT AN AUTHORITY.
 *
 * Every section drives the REAL learning engine over the REAL Sprint 036
 * research result (five eras of closed-loop history, 65 memory records,
 * AFIS + ABL, 3 strategies, 2 venues, 2 policy versions, 10 classes):
 *
 *   Findings → Learning Signals → Opportunity/Strategy Intelligence →
 *   Future Research Priorities → Intelligence Feedback.
 *
 * Nothing is mocked. The plane never authorizes trades, bets, capital, risk,
 * policy or execution; every learning output is informational. Every PASS
 * line is backed by assertions against actual engine output.
 */

const config = mergeLearningConfig();
const baseInput = learningInput();
const engine = new LearningEngine({});
const result = engine.analyze(baseInput);
const observations = result.observations;
const strategy = (key: string) => result.strategyLearning.find((s) => s.strategyId === key)!;
const oppClass = (key: string) => result.opportunityLearning.find(
  (o) => o.opportunityClass === key)!;
const venue = (key: string) => result.venueLearning.find((v) => v.venue === key)!;
const driftOf = (key: string, metric: string) =>
  result.drift.find((d) => d.subject.key === key && d.metric === metric)!;

// ---------------------------------------------------------------------------
// Assertion harness (house style)
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
  near(actual: number | null | undefined, expected: number, label: string, tolerance = 1e-6): void {
    if (actual === null || actual === undefined || Math.abs(actual - expected) > tolerance) {
      this.failures.push(`${label} (expected ~${expected}, got ${String(actual)})`);
    }
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
  // -------------------------------------------------------------------
  // 1 — Historical input (real Sprint 036 research result)
  // -------------------------------------------------------------------
  {
    const s = section('01 historical input — five eras of closed-loop history');
    const research = baseInput.research;
    s.equal(research.invariants.passed, true, 'research invariants passed');
    s.equal(research.memory.records.length, 65, 'memory records');
    s.equal(result.source.researchAnalysisId, research.analysisId, 'source analysis id');
    s.equal(result.source.memoryRecords, 65, 'source memory records');
    const domains = new Set(observations.map((o) => o.domain));
    s.same([...domains].sort(), ['ABL', 'AFIS'], 'both domains present');
    s.same([...new Set(observations.map((o) => o.era))].sort((a, b) => a - b),
      [1, 2, 3, 4, 5], 'five eras');
    s.equal(observations.length, 65, 'observations built');
  }

  // -------------------------------------------------------------------
  // 2 — Observations (ACTIVE-only, immutable, lineage-preserved)
  // -------------------------------------------------------------------
  {
    const s = section('02 observations — ACTIVE-only, immutable, lineage-preserved');
    const active = baseInput.research.memory.records.filter((r) => r.status === 'ACTIVE');
    s.equal(active.length, 65, 'all consumed records are ACTIVE');
    for (const o of observations) {
      s.check(Object.isFrozen(o), `observation ${o.observationId} frozen`);
      s.check(o.contentFingerprint.startsWith('lcfp_'), 'content fingerprint namespace');
      s.check(o.lineage.researchAnalysisId === baseInput.research.analysisId, 'lineage to research');
      break;
    }
    s.equal(new Set(observations.map((o) => o.sourceMemoryId)).size, 65, 'source identity preserved');
  }

  // -------------------------------------------------------------------
  // 3 — Features
  // -------------------------------------------------------------------
  {
    const s = section('03 features — deterministic, versioned, provenance-aware');
    s.equal(result.features.length, 65, 'one feature set per observation');
    s.check(result.features.every((f) => f.provenance === 'MEASURED'
      || f.provenance === 'DERIVED' || f.provenance === 'SIMULATED'
      || f.provenance === 'ESTIMATED'), 'known provenances only');
    s.check(result.features.every((f) => f.schemaVersion === 'learning.feature.v1'),
      'versioned feature schema');
    const rebuilt = buildLearningObservations(learningCorpus(), config);
    s.equal(rebuilt.length, 65, 'features rebuild from the same corpus');
  }

  // -------------------------------------------------------------------
  // 4 — Feature vectors
  // -------------------------------------------------------------------
  {
    const s = section('04 feature vectors — per-subject aggregate intelligence');
    s.check(result.featureVectors.length >= 8, 'subject vectors built');
    const guardian = result.featureVectors.find((v) => v.subject.key === 'arb-guardian')!;
    s.equal(guardian.sampleSize, 30, 'guardian sample');
    s.equal(guardian.eraBreakdown.length, 5, 'guardian era breakdown');
    s.same(guardian.eraBreakdown.map((e) => Math.round((e.meanPreservation ?? 0) * 10000) / 10000),
      [0.6226, 0.6663, 0.7099, 0.7536, 0.7973], 'guardian era means improve monotonically');
    s.check(guardian.contentFingerprint.startsWith('lcfp_'), 'vector fingerprint');
  }

  // -------------------------------------------------------------------
  // 5 — Cohorts
  // -------------------------------------------------------------------
  {
    const s = section('05 cohorts — 9 dimensions, comparability enforced');
    s.equal(result.cohorts.length, 35, 'cohort count');
    const dims = new Set(result.cohorts.map((c) => c.dimension));
    s.equal(dims.size, 9, 'nine dimensions');
    for (const cohort of result.cohorts) {
      if (cohort.domains.length > 1) {
        s.equal(cohort.comparable, false, `mixed cohort ${cohort.key} not comparable`);
      }
    }
  }

  // -------------------------------------------------------------------
  // 6 — Baselines
  // -------------------------------------------------------------------
  {
    const s = section('06 baselines — explicit, never vs undefined');
    const afis = observations.filter((o) => o.domain === 'AFIS');
    const baseline = historicalBaseline(afis, 'preservation', config);
    s.equal(baseline.sampleSize, 60, 'AFIS baseline sample');
    s.equal(baselineUsable(baseline), true, 'AFIS baseline usable');
    const tiny = historicalBaseline(afis.slice(0, 2), 'preservation', config);
    s.equal(tiny.evidenceState, 'INSUFFICIENT', 'below-floor baseline is INSUFFICIENT');
    s.equal(baselineUsable(tiny), false, 'below-floor baseline unusable');
    s.check(result.baselines.length > 0, 'engine baselines produced');
  }

  // -------------------------------------------------------------------
  // 7 — Strategy learning: consistent outperformer
  // -------------------------------------------------------------------
  {
    const s = section('07 strategy learning — arb-guardian is a CONSISTENT_OUTPERFORMER');
    const guardian = strategy('arb-guardian');
    s.equal(guardian.classification, 'CONSISTENT_OUTPERFORMER', 'classification');
    s.equal(guardian.stability, 'REGIME_DEPENDENT', 'stability');
    s.near(guardian.metrics.preservation, 0.7099, 'mean preservation', 1e-3);
    s.near(guardian.metrics.trend, 0.0437, 'trend per era', 1e-3);
    s.equal(guardian.baselineDelta, 0.306, 'baseline delta');
    s.equal(guardian.completionIsNotPreservation, true, 'completion never preservation');
    s.equal(guardian.metrics.completion, 0.5, 'completion honestly separate (0.5)');
  }

  // -------------------------------------------------------------------
  // 8 — Strategy learning: high theoretical, low realization
  // -------------------------------------------------------------------
  {
    const s = section('08 strategy learning — arb-aggressive is HIGH_THEORETICAL_LOW_REALIZATION');
    const aggressive = strategy('arb-aggressive');
    s.equal(aggressive.classification, 'HIGH_THEORETICAL_LOW_REALIZATION', 'classification');
    s.equal(aggressive.stability, 'CONTRADICTORY', 'contradicted by research');
    s.check((aggressive.metrics.preservation ?? 1) < 0.3, 'preservation below poor band');
    s.equal(aggressive.baselineDelta, -0.306, 'baseline delta negative');
  }

  // -------------------------------------------------------------------
  // 9 — Strategy learning: honest stability (epsilon guard)
  // -------------------------------------------------------------------
  {
    const s = section('09 strategy learning — sports-arb is STABLE (no rounding fiction)');
    const sports = strategy('sports-arb-strategy');
    s.equal(sports.classification, 'STABLE', 'classification');
    s.equal(sports.metrics.trend, 0, 'zero trend');
    s.equal(sports.baselineDelta, 0, 'zero baseline delta — era means equal the baseline');
    s.equal(sports.metrics.consistency, 1, 'perfect consistency');
    s.check(sports.classification !== 'CONSISTENT_OUTPERFORMER',
      'rounded-equal values never claim outperformance');
  }

  // -------------------------------------------------------------------
  // 10 — Opportunity learning: deteriorating class
  // -------------------------------------------------------------------
  {
    const s = section('10 opportunity learning — cross-venue-arbitrage is DETERIORATING');
    const cv = oppClass('cross-venue-arbitrage');
    s.equal(cv.classification, 'DETERIORATING', 'classification');
    s.equal(cv.sampleSize, 42, 'sample');
    s.equal(cv.trend, -0.023, 'negative trend per era');
    s.equal(cv.recurringLeakage.length, 10, 'recurring leakage facts');
    s.equal(cv.recurringFailures.length, 2, 'recurring failure facts');
    s.check(cv.highQualityConditions.length === 1, 'high-quality conditions stated historically');
  }

  // -------------------------------------------------------------------
  // 11 — Opportunity learning: improving class
  // -------------------------------------------------------------------
  {
    const s = section('11 opportunity learning — liquidity-imbalance is IMPROVING');
    const li = oppClass('liquidity-imbalance');
    s.equal(li.classification, 'IMPROVING', 'classification');
    s.equal(li.sampleSize, 10, 'sample');
    s.check((li.trend ?? 0) > 0.02, 'positive trend');
  }

  // -------------------------------------------------------------------
  // 12 — Venue learning: consistently weak
  // -------------------------------------------------------------------
  {
    const s = section('12 venue learning — venue-a is CONSISTENTLY_WEAK');
    const a = venue('venue-a');
    s.equal(a.classification, 'CONSISTENTLY_WEAK', 'classification');
    s.near(a.metrics.fillEfficiency, 0.862, 'fill efficiency', 1e-3);
    s.near(a.metrics.leakage, 0.385, 'leg leakage', 1e-3);
    s.equal(a.sampleSize, 65, 'legs observed');
  }

  // -------------------------------------------------------------------
  // 13 — Venue learning: consistently strong
  // -------------------------------------------------------------------
  {
    const s = section('13 venue learning — venue-b is CONSISTENTLY_STRONG');
    const b = venue('venue-b');
    s.equal(b.classification, 'CONSISTENTLY_STRONG', 'classification');
    s.near(b.metrics.fillEfficiency, 0.929, 'fill efficiency', 1e-3);
    s.equal(b.metrics.leakage, 0, 'zero leg leakage');
    s.check((b.baselineDelta ?? -1) > 0, 'positive baseline delta');
  }

  // -------------------------------------------------------------------
  // 14 — Policy learning: stable baseline
  // -------------------------------------------------------------------
  {
    const s = section('14 policy learning — v1 is the STABLE_BASELINE');
    const v1 = result.policyLearning.find(
      (p) => p.policyVersion === 'v1' && p.sampleSize === 55)!;
    s.equal(v1.role, 'BASELINE', 'role');
    s.equal(v1.classification, 'STABLE_BASELINE', 'classification');
    s.equal(v1.deltaVsBaseline, null, 'baseline has no delta vs itself');
  }

  // -------------------------------------------------------------------
  // 15 — Policy learning: execution ≠ end-to-end (Sprint 034 class)
  // -------------------------------------------------------------------
  {
    const s = section('15 policy learning — v1.1 improves execution, NOT end-to-end');
    const v11 = result.policyLearning.find((p) => p.policyVersion === 'v1.1')!;
    s.equal(v11.role, 'CANDIDATE', 'role');
    s.equal(v11.classification, 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END', 'classification');
    s.equal(v11.deltaVsBaseline!.executionQuality, 0.049, 'execution delta');
    s.equal(v11.deltaVsBaseline!.endToEndPreservation, -0.714, 'end-to-end delta');
    s.equal(v11.promotion, 'OUTSIDE_ENGINE', 'promotion is outside the engine');
  }

  // -------------------------------------------------------------------
  // 16 — Leakage learning
  // -------------------------------------------------------------------
  {
    const s = section('16 leakage learning — recurring components, per domain');
    s.equal(result.leakageLearning.length, 34, 'component learnings');
    const ablSlip = result.leakageLearning.find(
      (l) => l.domain === 'ABL' && l.component === 'SLIPPAGE')!;
    s.equal(ablSlip.recurrenceRate, 1, 'ABL slippage recurs on every observation');
    s.same(ablSlip.dominantSubjects, ['sports-arb-strategy'], 'dominated by sports-arb');
    const afisLatency = result.leakageLearning.find(
      (l) => l.domain === 'AFIS' && l.component === 'LATENCY_COST')!;
    s.check((afisLatency.recurrenceRate ?? 0) > 0.9, 'AFIS latency near-universal');
  }

  // -------------------------------------------------------------------
  // 17 — Regime detection
  // -------------------------------------------------------------------
  {
    const s = section('17 regimes — explainable, deterministic, no ML');
    const regimes = classifyRegimes(observations, config);
    s.equal(result.regimes.length, 5, 'one regime per era');
    s.equal(regimes.length, 5, 'regimes rebuild identically');
    for (const regime of result.regimes) {
      s.equal(regime.dimensions.length, 6, 'six dimensions per era');
      const venueCond = regime.dimensions.find((d) => d.dimension === 'VENUE_CONDITIONS')!;
      s.equal(venueCond.classification, 'ADVERSE', 'venue conditions adverse every era');
    }
    s.check(regimeSummary(result.regimes[1]).includes('VENUE_CONDITIONS=ADVERSE'),
      'human-readable regime summary');
  }

  // -------------------------------------------------------------------
  // 18 — Drift: improving preservation, structural leakage shift
  // -------------------------------------------------------------------
  {
    const s = section('18 drift — guardian improving, leakage structurally shifting');
    s.equal(driftOf('arb-guardian', 'STRATEGY_PRESERVATION').classification, 'IMPROVING', 'guardian preservation improving');
    s.equal(driftOf('arb-guardian', 'STRATEGY_PRESERVATION').observedDelta, 0.109, 'guardian preservation delta');
    s.equal(driftOf('arb-guardian', 'LEAKAGE').classification, 'STRUCTURAL_SHIFT', 'guardian leakage structural shift');
    s.equal(driftOf('arb-guardian', 'LEAKAGE').observedDelta, -0.435, 'guardian leakage delta');
  }

  // -------------------------------------------------------------------
  // 19 — Drift: deteriorating strategy
  // -------------------------------------------------------------------
  {
    const s = section('19 drift — arb-aggressive preservation deteriorating');
    s.equal(driftOf('arb-aggressive', 'STRATEGY_PRESERVATION').classification, 'DETERIORATING', 'aggressive preservation deteriorating');
    s.equal(driftOf('arb-aggressive', 'STRATEGY_PRESERVATION').observedDelta, -0.083, 'aggressive preservation delta');
    s.equal(driftOf('arb-aggressive', 'LEAKAGE').classification, 'NO_DRIFT', 'aggressive leakage no drift');
  }

  // -------------------------------------------------------------------
  // 20 — Stability
  // -------------------------------------------------------------------
  {
    const s = section('20 stability — never stable from one observation');
    s.equal(result.stability.length, 20, 'stability assessments');
    const single = assessStability({
      subject: {kind: 'STRATEGY', key: 'one'}, metric: 'preservation',
      observations: observations.slice(0, 1), contradicted: false, eraMeans: [0.5],
    }, config);
    s.equal(single.classification, 'INSUFFICIENT_EVIDENCE', 'one observation is never stable');
  }

  // -------------------------------------------------------------------
  // 21 — Confidence
  // -------------------------------------------------------------------
  {
    const s = section('21 confidence — honest states, no fake precision');
    s.equal(result.confidence.length, 8, 'confidence assessments');
    const aggressive = result.confidence.find((c) => c.subject === 'STRATEGY:arb-aggressive')!;
    s.equal(aggressive.state, 'INSUFFICIENT', 'contradicted strategy gets INSUFFICIENT');
    s.equal(aggressive.score, null, 'no numeric score when contradicted');
    const guardian = result.confidence.find((c) => c.subject === 'STRATEGY:arb-guardian')!;
    s.equal(guardian.state, 'STRONG', 'guardian confidence');
    s.check((guardian.score ?? 0) === Math.round((guardian.score ?? 0) * 1000) / 1000,
      'at most 3 decimals');
  }

  // -------------------------------------------------------------------
  // 22 — Causal safety
  // -------------------------------------------------------------------
  {
    const s = section('22 causal safety — ASSOCIATIONAL_ONLY everywhere');
    s.equal(result.causalPolicy, 'ASSOCIATIONAL_ONLY', 'analysis causal policy');
    s.check(causalVerdictOf('arb-guardian caused better preservation').safe === false,
      'causal language detected');
    s.check(causalVerdictOf('arb-guardian is historically classified CONSISTENT_OUTPERFORMER').safe === true,
      'associational language accepted');
    for (const signal of result.signals) {
      s.check(causalVerdictOf(signal.statement).safe, `signal safe: ${signal.statement}`);
    }
  }

  // -------------------------------------------------------------------
  // 23 — Learning signals
  // -------------------------------------------------------------------
  {
    const s = section('23 learning signals — immutable, informational');
    s.equal(result.signals.length, 67, 'signal count');
    const kinds = result.signals.reduce<Record<string, number>>((m, x) => {
      m[x.kind] = (m[x.kind] ?? 0) + 1; return m;
    }, {});
    s.same(kinds, {
      DRIFT_SIGNAL: 23, RESEARCH_PRIORITY_SIGNAL: 8, LEAKAGE_SIGNAL: 13,
      OPPORTUNITY_SIGNAL: 10, REGIME_SIGNAL: 5, STRATEGY_SIGNAL: 3,
      VENUE_SIGNAL: 2, POLICY_SIGNAL: 3,
    }, 'signal kinds');
    s.check(result.signals.every((x) => x.informational === true), 'informational only');
    s.check(result.signals.every((x) => x.causalStatus === 'ASSOCIATIONAL_ONLY'),
      'associational only');
  }

  // -------------------------------------------------------------------
  // 24 — Signal lineage
  // -------------------------------------------------------------------
  {
    const s = section('24 lineage — every artifact traces to the research plane');
    s.equal(result.lineage.valid, true, 'lineage graph valid');
    s.check(result.lineage.edges.length > 2000, 'lineage edges');
    for (const signal of result.signals) {
      s.check(signal.supportingEvidenceIds.length > 0, 'signals carry evidence');
      s.check(signal.lineage.observationIds.length > 0, 'signals trace to observations');
    }
  }

  // -------------------------------------------------------------------
  // 25 — Research priorities
  // -------------------------------------------------------------------
  {
    const s = section('25 research priorities — ranked by expected information value');
    s.equal(result.priorities.length, 55, 'priority count');
    s.equal(result.priorities[0].kind, 'COLLECT_MORE_EVIDENCE', 'top kind');
    s.equal(result.priorities[0].subject.key, 'back-lay', 'top subject');
    s.equal(result.priorities[0].score, 0.572, 'top score (neutral impact — no fabricated delta)');
    const classDegradation = result.priorities.find(
      (p) => p.kind === 'INVESTIGATE_CLASS_DEGRADATION')!;
    s.equal(classDegradation.subject.key, 'cross-venue-arbitrage', 'class degradation target');
    s.check((classDegradation.score ?? 0) > 0.47, 'class degradation score 0.480');
    s.check(result.priorities.every((p) => p.informational === true), 'informational only');
  }

  // -------------------------------------------------------------------
  // 26 — Recommendations
  // -------------------------------------------------------------------
  {
    const s = section('26 recommendations — informational, never authorizing');
    s.equal(result.recommendations.length, 11, 'recommendation count');
    const kinds = result.recommendations.reduce<Record<string, number>>((m, r) => {
      m[r.kind] = (m[r.kind] ?? 0) + 1; return m;
    }, {});
    s.same(kinds, {COLLECT_EVIDENCE: 8, MONITOR_SUBJECT: 2, RESEARCH_INVESTIGATION: 1},
      'recommendation kinds');
    for (const rec of result.recommendations) {
      s.check(!/authoriz|approve|execute|deploy/i.test(rec.statement), 'no authority language');
    }
  }

  // -------------------------------------------------------------------
  // 27 — Intelligence feedback
  // -------------------------------------------------------------------
  {
    const s = section('27 intelligence feedback — finding → signal → priority → query');
    s.equal(result.feedback.length, 12, 'feedback count');
    const kinds = result.feedback.reduce<Record<string, number>>((m, f) => {
      m[f.kind] = (m[f.kind] ?? 0) + 1; return m;
    }, {});
    s.equal(kinds.NEW_RESEARCH_QUERY, 3, 'new research queries');
    s.equal(kinds.EVIDENCE_GAP, 8, 'evidence gaps');
    s.equal(kinds.PRIORITY_UPDATE, 1, 'priority updates');
    for (const fb of result.feedback) {
      s.check(fb.lineage.signalIds.length > 0, 'feedback lineage to signals');
      s.check(fb.informational === true, 'informational only');
    }
    const query = result.feedback.find((f) => f.kind === 'NEW_RESEARCH_QUERY')!;
    s.check(query.proposedQuery !== null, 'new research queries are proposed, never executed');
  }

  // -------------------------------------------------------------------
  // 28 — AFIS semantics
  // -------------------------------------------------------------------
  {
    const s = section('28 AFIS — market semantics preserved');
    const afis = observations.filter((o) => o.domain === 'AFIS');
    s.equal(afis.length, 60, 'AFIS observations');
    const legSides = new Set(afis.flatMap((o) => o.venueLegs.map((l) => l.side)));
    s.same([...legSides].sort(), ['BUY', 'SELL'], 'AFIS legs are BUY/SELL');
    const classes = new Set(afis.map((o) => o.opportunityClass));
    s.equal(classes.size, 6, 'all six AFIS classes');
    s.equal(strategy('arb-guardian').domain, 'AFIS', 'guardian scoped to AFIS');
  }

  // -------------------------------------------------------------------
  // 29 — ABL semantics
  // -------------------------------------------------------------------
  {
    const s = section('29 ABL — betting semantics preserved');
    const abl = observations.filter((o) => o.domain === 'ABL');
    s.equal(abl.length, 5, 'ABL observations');
    const legSides = new Set(abl.flatMap((o) => o.venueLegs.map((l) => l.side)));
    s.same([...legSides].sort(), ['BACK', 'LAY'], 'ABL legs are BACK/LAY');
    s.equal(strategy('sports-arb-strategy').domain, 'ABL', 'sports-arb scoped to ABL');
  }

  // -------------------------------------------------------------------
  // 30 — BACK/LAY never collapsed
  // -------------------------------------------------------------------
  {
    const s = section('30 BACK/LAY is never collapsed into BUY/SELL');
    const venueB = venue('venue-b');
    s.check(venueB.semanticSides.includes('BACK') || venueB.semanticSides.includes('LAY'),
      'venue sides include betting sides');
    s.check(venueB.semanticSides.includes('SELL'), 'market sides kept separate');
    const ablSignals = result.signals.filter((s2) => s2.subject.key.includes('sports-arb'));
    for (const signal of ablSignals) {
      s.check(!/\b(BUY|SELL)\b/.test(signal.statement), `no BUY/SELL in ABL output: ${signal.statement}`);
    }
  }

  // -------------------------------------------------------------------
  // 31 — Cross-domain: explicit normalization path
  // -------------------------------------------------------------------
  {
    const s = section('31 cross-domain — normalized comparison only under explicit conditions');
    const normalized = domainNormalizedBaseline(observations, 'preservation', config);
    s.equal(normalized.kind, 'DOMAIN_NORMALIZED', 'normalized baseline kind');
    s.equal(normalized.scopeDomain, 'MIXED', 'explicit MIXED scope');
    const afisMean = historicalBaseline(
      observations.filter((o) => o.domain === 'AFIS'), 'preservation', config).meanValue!;
    const ablMean = historicalBaseline(
      observations.filter((o) => o.domain === 'ABL'), 'preservation', config).meanValue!;
    s.near(normalized.meanValue, (afisMean + ablMean) / 2, 'mean of domain means', 1e-3);
  }

  // -------------------------------------------------------------------
  // 32 — Cross-domain: raw comparison is NOT_COMPARABLE
  // -------------------------------------------------------------------
  {
    const s = section('32 cross-domain — raw economics are NOT_COMPARABLE');
    const raw = rawCrossDomainCohort(observations, config);
    s.equal(raw.comparable, false, 'raw mixed cohort not comparable');
    s.check(raw.notComparableReasons.some((r) => r.includes('never comparable')),
      'explicit not-comparable reason');
    s.equal(raw.domains.length, 2, 'mixes both domains');
    for (const cohort of result.cohorts) {
      if (cohort.domains.length > 1) s.equal(cohort.comparable, false, 'engine-wide enforcement');
    }
  }

  // -------------------------------------------------------------------
  // 33 — Insufficient evidence is stated, never guessed
  // -------------------------------------------------------------------
  {
    const s = section('33 insufficient evidence — explicit, never fabricated');
    const insufficient = result.opportunityLearning.filter(
      (o) => o.classification === 'INSUFFICIENT_EVIDENCE');
    s.equal(insufficient.length, 8, 'insufficient classes');
    for (const learning of insufficient) {
      s.check(learning.sampleSize < 3, 'below the analytical floor');
      s.check(learning.reasons.some((r) => r.includes('below minimum')), 'reason stated');
    }
    for (const drift of result.drift) {
      if (drift.classification === 'INSUFFICIENT_EVIDENCE') {
        s.equal(drift.observedDelta, null, 'insufficient drift carries no delta');
      }
    }
  }

  // -------------------------------------------------------------------
  // 34 — Contradictory evidence surfaces honestly
  // -------------------------------------------------------------------
  {
    const s = section('34 contradictory evidence — CONTRADICTORY, never STABLE');
    const contradicted = new LearningEngine({}).analyze(
      {...baseInput, research: contradictedResearch()});
    const guardian = contradicted.strategyLearning.find((x) => x.strategyId === 'arb-guardian')!;
    s.equal(guardian.stability, 'CONTRADICTORY', 'contradicted stability');
    const signal = contradicted.signals.find(
      (x) => x.kind === 'STRATEGY_SIGNAL' && x.subject.key === 'arb-guardian')!;
    s.check(signal.contradictingEvidenceIds.length > 0, 'contradicting evidence carried');
    const conf = contradicted.confidence.find((c) => c.subject === 'STRATEGY:arb-guardian')!;
    s.equal(conf.score, null, 'no numeric confidence when contradicted');
  }

  // -------------------------------------------------------------------
  // 35 — Fragile populations are named fragile
  // -------------------------------------------------------------------
  {
    const s = section('35 fragile — alternating eras are FRAGILE, never stable');
    const alternating = assessStability({
      subject: {kind: 'STRATEGY', key: 'alt'}, metric: 'preservation',
      observations: observations.slice(0, 10), contradicted: false,
      eraMeans: [0.1, 0.9, 0.1, 0.9, 0.1, 0.9],
    }, config);
    s.check(alternating.classification === 'FRAGILE'
      || alternating.classification === 'REGIME_DEPENDENT', 'alternating eras not STABLE');
    const flat = assessStability({
      subject: {kind: 'STRATEGY', key: 'flat'}, metric: 'preservation',
      observations: observations.slice(0, 10), contradicted: false,
      eraMeans: [0.5, 0.5, 0.5, 0.5, 0.5],
    }, config);
    s.equal(flat.classification, 'STABLE', 'flat eras are STABLE');
  }

  // -------------------------------------------------------------------
  // 36 — Regime dependence is named
  // -------------------------------------------------------------------
  {
    const s = section('36 regime-dependent — improvement across eras is REGIME_DEPENDENT');
    s.equal(strategy('arb-guardian').stability, 'REGIME_DEPENDENT', 'guardian');
    s.equal(strategy('sports-arb-strategy').stability, 'REGIME_DEPENDENT', 'sports-arb');
    const regimePriorities = result.priorities.filter(
      (p) => p.kind === 'INVESTIGATE_REGIME_DEPENDENCE');
    s.equal(regimePriorities.length, 5, 'one regime-dependence investigation per era');
  }

  // -------------------------------------------------------------------
  // 37 — Strategy and venue deterioration
  // -------------------------------------------------------------------
  {
    const s = section('37 deterioration — strategy, class and venue all flagged');
    s.equal(strategy('arb-aggressive').classification, 'HIGH_THEORETICAL_LOW_REALIZATION',
      'strategy deterioration flagged');
    s.equal(oppClass('cross-venue-arbitrage').classification, 'DETERIORATING',
      'class deterioration flagged');
    s.equal(venue('venue-a').classification, 'CONSISTENTLY_WEAK', 'venue weakness flagged');
    s.check(result.priorities.some((p) => p.kind === 'INVESTIGATE_VENUE_DETERIORATION'),
      'venue deterioration investigation exists');
  }

  // -------------------------------------------------------------------
  // 38 — Policy divergence
  // -------------------------------------------------------------------
  {
    const s = section('38 policy divergence — execution quality ≠ end-to-end value');
    const v11 = result.policyLearning.find((p) => p.policyVersion === 'v1.1')!;
    s.check((v11.deltaVsBaseline!.executionQuality ?? -1) > 0, 'execution improved');
    s.check((v11.deltaVsBaseline!.endToEndPreservation ?? 0) < -0.1, 'end-to-end regressed');
    s.check(result.priorities.some((p) => p.kind === 'INVESTIGATE_POLICY_END_TO_END_DIVERGENCE'),
      'divergence investigation exists');
    s.equal(v11.promotion, 'OUTSIDE_ENGINE', 'candidate never becomes ACTIVE here');
  }

  // -------------------------------------------------------------------
  // 39 — Replay byte-identity
  // -------------------------------------------------------------------
  {
    const s = section('39 replay — byte-identical reproduction');
    s.equal(result.replay.identical, true, 'internal double-run identical');
    const rerun = new LearningEngine({}).analyze(learningInput());
    s.equal(compareLearningResults(result, rerun).identical, true, 'fresh run identical');
    s.equal(rerun.analysisFingerprint, result.analysisFingerprint, 'fingerprints equal');
  }

  // -------------------------------------------------------------------
  // 40 — Order determinism
  // -------------------------------------------------------------------
  {
    const s = section('40 order determinism — input permutations change nothing');
    const records = baseInput.research.memory.records;
    const permuted = {
      ...baseInput,
      research: {
        ...baseInput.research,
        memory: {
          ...baseInput.research.memory,
          records: [...records].reverse(),
        },
      },
    };
    const permutedResult = new LearningEngine({}).analyze(permuted);
    s.equal(compareLearningResults(result, permutedResult).identical, true,
      'reversed memory order → identical output');
    const stride = records.filter((_, i) => i % 2 === 0)
      .concat(records.filter((_, i) => i % 2 === 1));
    const strided = new LearningEngine({}).analyze({
      ...baseInput,
      research: {...baseInput.research,
        memory: {...baseInput.research.memory, records: stride}},
    });
    s.equal(compareLearningResults(result, strided).identical, true,
      'strided memory order → identical output');
  }

  // -------------------------------------------------------------------
  // 41 — Audit chain
  // -------------------------------------------------------------------
  {
    const s = section('41 audit — GENESIS-rooted hash chain over 386 events');
    s.equal(result.auditEvents.length, 386, 'event count');
    s.equal(result.auditEvents[0].eventType, 'learning-started', 'first event');
    s.equal(result.auditEvents[385].eventType, 'replay-completed', 'last event');
    s.equal(result.auditEvents[0].previousHash, '0'.repeat(64), 'GENESIS root');
    const verification = verifyLearningAudit(result.auditEvents, 386);
    s.equal(verification.valid, true, 'chain verifies');
  }

  // -------------------------------------------------------------------
  // 42 — Tamper / reorder / truncation detection
  // -------------------------------------------------------------------
  {
    const s = section('42 audit — tampering, substitution, reorder, truncation detected');
    const events = result.auditEvents;
    const tampered = events.map((e, i) =>
      i === 200 ? {...e, payload: {...e.payload, injected: 'treasury'}} : e);
    s.check(!verifyLearningAudit(tampered, 386).valid, 'payload substitution detected');
    const hashBroken = events.map((e, i) => i === 100 ? {...e, hash: 'f'.repeat(64)} : e);
    s.check(!verifyLearningAudit(hashBroken, 386).valid, 'hash tampering detected');
    const swapped = [...events];
    const tmp = swapped[10];
    swapped[10] = swapped[11];
    swapped[11] = tmp;
    s.check(!verifyLearningAudit(swapped, 386).valid, 'reordering detected');
    s.check(!verifyLearningAudit(events.slice(0, 300), 386).valid, 'truncation detected');
  }

  // -------------------------------------------------------------------
  // 43 — Invariants
  // -------------------------------------------------------------------
  {
    const s = section('43 invariants — 47 hard fail-closed checks, all passing');
    s.check(result.invariants.checks.length >= 40, 'at least 40 invariants');
    s.equal(result.invariants.checks.length, 47, 'exact invariant count');
    s.equal(result.invariants.passed, true, 'all invariants pass');
    s.equal(result.invariants.failedCount, 0, 'zero failures');
    const independent = checkLearningInvariants(result,
      {research: baseInput.research, config});
    s.equal(independent.passed, true, 'independent re-check agrees');
  }

  // -------------------------------------------------------------------
  // 44 — Authority boundary
  // -------------------------------------------------------------------
  {
    const s = section('44 authority boundary — analytical only, zero authority mutation');
    for (const name of ['NO_TREASURY_MUTATION', 'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION',
      'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION', 'NO_STRATEGY_REGISTRY_MUTATION',
      'NO_ACTIVE_POLICY_MUTATION', 'POLICY_CANDIDATE_NEVER_ACTIVE']) {
      const check = result.invariants.checks.find((c) => c.invariant === name)!;
      s.equal(check.passed, true, name);
    }
    const json = JSON.stringify(result);
    s.check(!json.includes('"probability"'), 'no manufactured probability');
    s.check(!json.includes('"expectedReturn"'), 'no manufactured expected return');
    s.check(result.signals.every((x) => x.informational), 'signals informational');
    s.check(result.priorities.every((x) => x.informational), 'priorities informational');
    s.check(result.recommendations.every((x) => x.informational), 'recommendations informational');
    s.check(result.feedback.every((x) => x.informational), 'feedback informational');
  }

  // -------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  const lines: string[] = [];
  lines.push('');
  lines.push(' ====================================================================');
  lines.push(' SPRINT 037 — UNIFIED INTELLIGENCE LEARNING & FEEDBACK ENGINE');
  lines.push(' PAPER / SIMULATION ONLY — ANALYTICAL, NOT AN AUTHORITY');
  lines.push(' ====================================================================');
  lines.push('');
  lines.push(` Engine:        ${result.analysisId}`);
  lines.push(` Fingerprint:   ${result.analysisFingerprint}`);
  lines.push(` Research:      ${result.source.researchAnalysisId} (65 memory records, 5 eras)`);
  lines.push(` Domains:       AFIS (60 observations) + ABL (5 observations), one shared engine`);
  lines.push(` Causal policy: ${result.causalPolicy}`);
  lines.push('');
  lines.push(' CHAIN: Findings → Learning Signals → Opportunity/Strategy Intelligence');
  lines.push('        → Future Research Priorities → Intelligence Feedback');
  lines.push('');
  lines.push(' Best strategy:   arb-guardian — CONSISTENT_OUTPERFORMER (Δ +0.306 vs AFIS baseline)');
  lines.push(' Worst strategy:  arb-aggressive — HIGH_THEORETICAL_LOW_REALIZATION (preservation 0.098)');
  lines.push(' Deteriorating:   cross-venue-arbitrage class (n=42, trend −0.023/era)');
  lines.push(' Improving:       liquidity-imbalance class (n=10)');
  lines.push(' Weak venue:      venue-a — CONSISTENTLY_WEAK (leg leakage 0.385)');
  lines.push(' Strong venue:    venue-b — CONSISTENTLY_STRONG (fill 0.929, zero leg leakage)');
  lines.push(' Policy verdict:  v1.1 candidate — execution +0.049 BUT end-to-end −0.714');
  lines.push('                  (Sprint 034 class: execution quality is not end-to-end value;');
  lines.push('                   promotion stays OUTSIDE_ENGINE)');
  lines.push(' Top priority:    COLLECT_MORE_EVIDENCE for back-lay (score 0.572)');
  lines.push(' Feedback:        3 new research queries, 8 evidence gaps, 1 priority update');
  lines.push(' Learning facts:  67 signals · 55 priorities · 11 recommendations · 12 feedback');
  lines.push(' Integrity:       47/47 invariants · 386 audit events · replay byte-identical');
  lines.push('');
  lines.push(` SPRINT 037 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  if (failed.length === 0) {
    lines.push('');
    lines.push(' All 44 sections passed. Every learning output is informational and');
    lines.push(' associational; no authority was granted, invoked or mutated; history');
    lines.push(' was consumed read-only and every artifact is immutable with lineage.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 037: COMPLETE');
  } else {
    lines.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const s of failed) {
      lines.push(`   [${s.name}]`);
      for (const f of s.failures) lines.push(`     - ${f}`);
    }
    lines.push('');
    lines.push(' SYSTEM STATUS: UNRECONCILED');
  }
  console.log(lines.join('\n'));
  if (failed.length > 0) process.exit(1);
}

main();
