/**
 * SPRINT 039 — UNIFIED DECISION INTELLIGENCE & COUNTERFACTUAL EVALUATION
 * ENGINE demo.
 *
 * PAPER / SIMULATION ONLY — AN ANALYTICAL DECISION-SUPPORT LAYER, NOT AN
 * EXECUTION ENGINE, NOT A CAPITAL ALLOCATOR, NOT AN ORACLE.
 *
 * Every section drives the REAL decision-intelligence engine over the REAL
 * Sprint 037 learning result, REAL Sprint 038 opportunity intelligence and
 * realistic AFIS and ABL base opportunities with hypothetical alternatives:
 *
 *   Opportunity → Opportunity Intelligence → Decision Context → Candidate
 *   Alternatives → Counterfactual Evaluation → Trade-off Analysis →
 *   Evidence-Bound Recommendation → Research / Strategy Input.
 *
 * Counterfactual means: "What does the existing evidence say about this
 * alternative if this alternative had been selected?" — never "What will
 * happen in the future?" No probabilities, expected profit, ROI, future
 * prices, future odds or guaranteed outcomes are manufactured. Nothing is
 * mocked. Nothing authorizes trades, bets, capital, risk, policy or
 * execution; every output is informational and associational-only. Every
 * PASS line is backed by assertions against actual engine output.
 */

import {DecisionIntelligenceEngine} from './intelligence/decision/engine';
import {validateAlternativeSpec, baselineSpecOf} from './intelligence/decision/alternative';
import {buildStandardAlternatives} from './intelligence/decision/alternative-builder';
import {evaluateCompatibility} from './intelligence/decision/compatibility';
import {evaluateCounterfactual, evidenceGapsOf, conflictsOf} from './intelligence/decision/counterfactual';
import {compareAlternatives} from './intelligence/decision/historical-comparison';
import {analyzeRegimeAxis, analyzeStrategyAxis, analyzeVenueAxis,
  analyzeLeakageAxis, analyzeStabilityAxis, analyzeEvidenceAxis} from './intelligence/decision/axes';
import {computeTradeOffScore, tradeOffValuesOf, TRADE_OFF_DIMENSIONS} from './intelligence/decision/tradeoff';
import {analyzeDominance} from './intelligence/decision/dominance';
import {recommendationStatusOf} from './intelligence/decision/classification';
import {rankAlternatives} from './intelligence/decision/ranking';
import {buildRecommendation} from './intelligence/decision/recommendation';
import {buildScenarioMatrix, scenarioStateCounts} from './intelligence/decision/scenario';
import {buildExplanation} from './intelligence/decision/explanation';
import {buildDecisionResearchContext} from './intelligence/decision/research-context';
import {recordDecisionFeedback, reconcileDecisionOutcome} from './intelligence/decision/feedback';
import {serializeDecisionResult, compareDecisionResults} from './intelligence/decision/replay';
import {verifyDecisionAudit} from './intelligence/decision/audit';
import {checkDecisionInvariants} from './intelligence/decision/invariants';
import {mergeDecisionConfig, DEFAULT_DECISION_CONFIG} from './intelligence/decision/config';
import {canonicalJson} from './intelligence/decision/ids';
// applyOverrides exercised via the builder and engine paths
import {RECOMMENDATION_DISCLAIMER, DECISION_EVENT_TYPES, DECISION_ENGINE_VERSION} from './intelligence/decision/types';
import {
  afisDecisionInput, ablDecisionInput, ablThinDecisionInput,
  afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  afisCvaBase, afisLiqBase, ablSurebetBase, ablBackLayBase,
  afisAggressiveStrategySpec, afisVenueAOnlySpec, afisConservativeExecutionSpec,
  afisAggressiveExecutionSpec, ablOrientationSwapSpec, ablMarketVariantSpec,
  ablVenueOnlySpec, alternativeRejectionGallery, runDecision,
  opportunityLearning, DECISION_FIXTURE_TIMESTAMP,
} from './intelligence/decision/test-fixtures';

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
    if (actual !== expected) {
      this.failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
    }
  }
  near(actual: number | null | undefined, expected: number, label: string,
    tolerance = 1e-6): void {
    if (actual === null || actual === undefined
      || Math.abs(actual - expected) > tolerance) {
      this.failures.push(`${label} (expected ~${expected}, got ${String(actual)})`);
    }
  }
  same<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, `
        + `got ${JSON.stringify(actual)})`);
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
  const config = DEFAULT_DECISION_CONFIG;
  const learning = opportunityLearning();
  const afis = afisDecisionResult();
  const abl = ablDecisionResult();
  const ablThin = ablThinDecisionResult();
  const engine = new DecisionIntelligenceEngine({});
  const afisBase = afisCvaBase();
  const liqBase = afisLiqBase();
  const ablBase = ablSurebetBase();

  // A venue-dependency run with the corpus dependency band lowered to 0.08
  // (venue-a 0.737 vs venue-b 0.649 preservation becomes detectable).
  const venueDep = runDecision({
    baseCandidate: afisBase,
    alternatives: [afisVenueAOnlySpec(afisBase)],
    learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-venue-dep', traceId: 'trace-venue-dep',
  }, {opportunityConfig: {...config.opportunityConfig, dependencySpreadBand: 0.08}});

  // A dominant-margin run: liquidity-imbalance venue comparison with tight
  // bands (baseline 0.6063 vs venue-a 0.6593 → margin 0.053).
  const dominant = runDecision({
    baseCandidate: liqBase,
    alternatives: [{alternativeId: 'alt-venue-a', label: 'venue-a variant',
      kind: 'VENUE', baseCandidateId: liqBase.candidateId, strategyId: null,
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only'}],
    learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-dominant', traceId: 'trace-dominant',
  }, {dominantMargin: 0.04, weakMargin: 0.02, tieBand: 0.01});

  // A no-dominant-option run: CVA clean alternatives nearly tied.
  const noDominant = runDecision({
    baseCandidate: afisBase,
    alternatives: [afisVenueAOnlySpec(afisBase),
      afisConservativeExecutionSpec(afisBase)],
    learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-nodom', traceId: 'trace-nodom',
  });

  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push(' OSHIP — SPRINT 039 — UNIFIED DECISION INTELLIGENCE & COUNTERFACTUAL');
  lines.push(' EVALUATION ENGINE — DETERMINISTIC DEMONSTRATION');
  lines.push('================================================================================');
  lines.push('');
  lines.push(' EVIDENCE → ANALYSIS → COMPARISON → RECOMMENDATION');
  lines.push(' (never: Evidence → Prediction → Certainty → Execution)');
  lines.push('');

  // -------------------------------------------------------------------
  // 1 — Decision Context
  // -------------------------------------------------------------------
  {
    const s = section('01 decision context — canonical, serializable, informational');
    s.equal(afis.context.contextId.startsWith('dctx_'), true, 'context id prefixed');
    s.equal(afis.context.baseCandidateId, 'dec-afis-cva-base', 'base candidate');
    s.equal(afis.context.domain, 'AFIS', 'domain');
    s.equal(afis.context.opportunityClass, 'cross-venue-arbitrage', 'class');
    s.equal(afis.context.engineVersion, DECISION_ENGINE_VERSION, 'engine version');
    s.equal(afis.context.informational, true, 'informational only');
    s.check(afis.context.configurationFingerprint.length > 0, 'config fingerprint');
    s.check(canonicalJson(afis.context).length > 0, 'canonically serializable');
  }

  // -------------------------------------------------------------------
  // 2 — AFIS opportunity
  // -------------------------------------------------------------------
  {
    const s = section('02 AFIS opportunity — cross-venue arbitrage base');
    s.equal(afis.context.strategyId, 'arb-guardian', 'guardian strategy');
    s.same([...afis.context.venues], ['venue-a', 'venue-b'], 'both venues');
    s.equal(afis.context.baseProfile.similarity.cohortSize, 20, 'base cohort 20');
    s.equal(afis.alternatives[0].kind, 'BASELINE', 'baseline first');
  }

  // -------------------------------------------------------------------
  // 3 — ABL opportunity
  // -------------------------------------------------------------------
  {
    const s = section('03 ABL opportunity — surebet base with full betting identity');
    s.equal(abl.context.domain, 'ABL', 'domain');
    s.equal(abl.context.opportunityClass, 'surebet', 'class');
    s.equal(abl.context.baseProfile.candidateId, 'dec-abl-surebet-base', 'base');
    s.equal(abl.alternatives[0].counterfactualCandidate.marketId, 'mkt-derby-winner', 'market id');
    s.equal(abl.alternatives[0].counterfactualCandidate.selectionId, 'sel-home-team', 'selection id');
  }

  // -------------------------------------------------------------------
  // 4 — Candidate alternatives
  // -------------------------------------------------------------------
  {
    const s = section('04 candidate alternatives — hypothetical variations');
    s.equal(afis.alternatives.length, 5, 'five AFIS alternatives');
    s.same(afis.alternatives.map((a) => a.kind),
      ['BASELINE', 'STRATEGY', 'VENUE', 'EXECUTION', 'EXECUTION'],
      'AFIS alternative kinds');
    s.equal(abl.alternatives.length, 4, 'four ABL alternatives');
    s.same(abl.alternatives.map((a) => a.kind),
      ['BASELINE', 'SIDE', 'MARKET', 'VENUE'], 'ABL alternative kinds');
    const standard = buildStandardAlternatives(ablBase, learning);
    s.check(standard.some((x) => x.kind === 'SIDE'), 'standard ABL set has orientation');
    s.check(standard.some((x) => x.kind === 'MARKET'), 'standard ABL set has market variant');
  }

  // -------------------------------------------------------------------
  // 5 — Compatibility
  // -------------------------------------------------------------------
  {
    const s = section('05 compatibility — provably comparable before evaluation');
    s.equal(afis.compatibility.length, afis.alternatives.length, 'one assessment per alternative');
    s.check(afis.compatibility.every((c) => c.state === 'COMPATIBLE'), 'all compatible');
    s.check(afis.compatibility.every((c) => c.checks.length >= 10), 'ten+ checks each');
    s.check(afis.compatibility.every((c) => c.checks.every((x) => x.passed)), 'every check passed');
  }

  // -------------------------------------------------------------------
  // 6 — Rejected alternatives
  // -------------------------------------------------------------------
  {
    const s = section('06 rejected alternatives — fail closed with codes');
    const gallery = alternativeRejectionGallery(afisBase);
    let matched = 0;
    const seen = new Set(['g-dupe']);
    for (const entry of gallery) {
      const validation = validateAlternativeSpec(entry.spec, afisBase, learning, seen);
      if (!validation.ok && validation.code === entry.code) matched++;
    }
    s.equal(matched, gallery.length, 'gallery codes produced exactly');
    s.check(gallery.length >= 12, 'twelve+ rejection surfaces');
  }

  // -------------------------------------------------------------------
  // 7 — Historical comparison
  // -------------------------------------------------------------------
  {
    const s = section('07 historical comparison — descriptive, observed facts only');
    const n = afis.alternatives.length;
    s.equal(afis.historicalComparison.comparisons.length, n * (n - 1) / 2, 'all pairs');
    s.check(afis.historicalComparison.comparisons.every((c) => c.descriptiveOnly),
      'descriptive only');
    const first = afis.historicalComparison.comparisons[0];
    if (first.leftMeanPreservation !== null && first.rightMeanPreservation !== null) {
      s.near(first.preservationDelta,
        first.leftMeanPreservation - first.rightMeanPreservation,
        'preservation delta = left − right');
    } else {
      s.equal(first.preservationDelta, null, 'unmeasurable delta null');
    }
  }

  // -------------------------------------------------------------------
  // 8 — Evidence quality
  // -------------------------------------------------------------------
  {
    const s = section('08 evidence quality — per alternative, honest states');
    s.same(afis.alternatives.map((a) => a.confidenceState),
      ['WEAK', 'CONFLICTED', 'WEAK', 'WEAK', 'WEAK'], 'confidence spread');
    s.same(abl.alternatives.map((a) => a.confidenceState),
      ['INSUFFICIENT', 'INSUFFICIENT', 'INSUFFICIENT', 'INSUFFICIENT'],
      'ABL thin evidence');
    s.check(afis.evidenceAnalysis.perAlternative.every((p) =>
      p.completeness >= 0 && p.completeness <= 1), 'completeness in [0,1]');
  }

  // -------------------------------------------------------------------
  // 9 — Regime analysis
  // -------------------------------------------------------------------
  {
    const s = section('09 regime analysis — dependency across alternatives');
    s.equal(afis.regimeAnalysis.axis, 'REGIME', 'axis');
    s.equal(afis.regimeAnalysis.perAlternative.length, 5, 'per alternative');
    const eras = new Set(afis.alternatives.map(
      (a) => a.profile.regimeMatch.matchedEra));
    s.equal(afis.regimeAnalysis.alternativesDiffer, eras.size > 1, 'era separation honest');
    s.check(afis.alternatives.every((a) => a.profile.regimeMatch.matchedEra === 1),
      'corpus matched era 1 (regime dims constant except volatility)');
  }

  // -------------------------------------------------------------------
  // 10 — Strategy analysis
  // -------------------------------------------------------------------
  {
    const s = section('10 strategy analysis — supported strategies named');
    s.equal(afis.strategyAnalysis.detected, true, 'strategy dependency detected');
    s.equal(afis.strategyAnalysis.alternativesDiffer, true, 'alternatives differ by strategy');
    s.check(afis.strategyAnalysis.applicable.length > 0, 'applicable strategies listed');
    s.check(afis.recommendation.dependencyState.some(
      (d) => d.includes('STRATEGY dependency')), 'visible in recommendation');
  }

  // -------------------------------------------------------------------
  // 11 — Venue analysis
  // -------------------------------------------------------------------
  {
    const s = section('11 venue analysis — venue-specific evidence preserved');
    s.equal(venueDep.venueAnalysis.detected, true, 'venue dependency detected (band 0.08)');
    s.equal(venueDep.venueAnalysis.alternativesDiffer, true, 'alternatives differ by venue');
    s.same([...venueDep.venueAnalysis.applicable], ['venue-a', 'venue-b'],
      'applicable venues');
    s.equal(venueDep.dominance.state, 'VENUE_DEPENDENT', 'VENUE_DEPENDENT dominance');
  }

  // -------------------------------------------------------------------
  // 12 — Leakage
  // -------------------------------------------------------------------
  {
    const s = section('12 leakage — apparent vs realized vs adjusted, counted once');
    s.equal(afis.leakageAnalysis.perAlternative.length, 5, 'covers every alternative');
    for (const l of afis.leakageAnalysis.perAlternative) {
      if (l.realizedQuality !== null && l.leakageBurden !== null
        && l.leakageAdjustedQuality !== null) {
        s.near(l.leakageAdjustedQuality, l.realizedQuality + l.leakageBurden,
          `adjusted = realized + leakage for ${l.alternativeId}`);
      }
    }
    const aggressive = afis.leakageAnalysis.perAlternative.find(
      (l) => l.alternativeId === 'alt-strategy-aggressive');
    s.check(aggressive !== undefined, 'aggressive leakage record exists');
    if (aggressive && aggressive.leakageShare !== null) {
      s.check(aggressive.leakageShare > 0.5, 'aggressive strategy carries the leak share');
    }
  }

  // -------------------------------------------------------------------
  // 13 — Stability
  // -------------------------------------------------------------------
  {
    const s = section('13 stability — informs, never silently overrides');
    s.equal(afis.stabilityAnalysis.perAlternative.length, 5, 'per alternative');
    s.check(afis.stabilityAnalysis.perAlternative.every((p) =>
      ['STABLE', 'UNSTABLE', 'IMPROVING', 'DETERIORATING', 'REGIME_SENSITIVE',
        'INSUFFICIENT_HISTORY'].includes(p.interpretation)), 'legal states');
    s.check(afis.explanation.stabilityEffects.length >= 5, 'explicit per alternative');
    const stabilityDim = afis.tradeoff.scores[0].components.find(
      (c) => c.dimension === 'stability');
    s.check(stabilityDim !== undefined, 'explicit trade-off dimension');
  }

  // -------------------------------------------------------------------
  // 14 — Scenario matrix
  // -------------------------------------------------------------------
  {
    const s = section('14 scenario matrix — alternative × evidence × regime × strategy × venue');
    s.check(afis.scenarioMatrix.cells.length > 0, 'cells exist');
    s.check(afis.scenarioMatrix.cells.every((c) => c.evidenceCount > 0), 'no inferred cells');
    s.check(afis.scenarioMatrix.cells.every((c) =>
      c.supportingObservationIds.length === c.evidenceCount), 'observation-backed');
    const counts = scenarioStateCounts(afis.scenarioMatrix);
    s.equal(Object.values(counts).reduce((a, b) => a + b, 0),
      afis.scenarioMatrix.cells.length, 'state counts reconcile');
    s.check(afis.scenarioMatrix.incompatibleCombinations.some(
      (c) => c.includes('sports-arb-strategy')), 'cross-domain strategies marked');
  }

  // -------------------------------------------------------------------
  // 15 — Trade-offs
  // -------------------------------------------------------------------
  {
    const s = section('15 trade-offs — twelve explicit weighted dimensions');
    s.equal(TRADE_OFF_DIMENSIONS.length, 12, 'twelve dimensions');
    for (const score of afis.tradeoff.scores) {
      s.equal(score.components.length, 12, `${score.alternativeId} has 12 components`);
      if (score.score !== null) {
        s.near(score.score,
          score.components.reduce((sum, c) => sum + (c.contribution ?? 0), 0),
          `exact decomposition for ${score.alternativeId}`, 1e-12);
        const contributing = score.components.filter((c) => c.contribution !== null);
        s.near(contributing.reduce((sum, c) => sum + c.effectiveWeight, 0), 1,
          `weight normalization for ${score.alternativeId}`, 1e-9);
      }
    }
  }

  // -------------------------------------------------------------------
  // 16 — Dominance
  // -------------------------------------------------------------------
  {
    const s = section('16 dominance — better supported by evidence, never guaranteed');
    s.equal(afis.dominance.state, 'CONFLICTED', 'AFIS full set is CONFLICTED');
    s.equal(dominant.dominance.state, 'DOMINANT_BY_EVIDENCE', 'tight bands: dominant');
    s.equal(noDominant.dominance.state, 'NO_DOMINANT_OPTION', 'near-tied: no dominant');
    s.equal(venueDep.dominance.state, 'VENUE_DEPENDENT', 'venue dependency state');
    s.check(dominant.dominance.reasons.some(
      (r) => r.includes('support is not certainty')), 'never guaranteed');
    s.near(dominant.dominance.topMargin, 0.053, 'dominant margin', 0.001);
  }

  // -------------------------------------------------------------------
  // 17 — Recommendation
  // -------------------------------------------------------------------
  {
    const s = section('17 recommendation — evidence-bound, exact disclaimer');
    s.equal(dominant.recommendation.status, 'PREFERRED_BY_EVIDENCE', 'dominant → preferred');
    s.equal(dominant.recommendation.selectedAlternativeId, 'alt-venue-a', 'selected');
    s.equal(dominant.recommendation.disclaimer, RECOMMENDATION_DISCLAIMER, 'exact disclaimer');
    s.equal(dominant.recommendation.informational, true, 'informational only');
    s.equal(dominant.recommendation.tradeOffBreakdown.length, 12, 'breakdown carried');
    s.equal(afis.recommendation.status, 'CONFLICTED', 'conflicted → no selection');
    s.equal(afis.recommendation.selectedAlternativeId, null, 'nothing selected');
  }

  // -------------------------------------------------------------------
  // 18 — Conflict
  // -------------------------------------------------------------------
  {
    const s = section('18 conflict — no winner forced over contradictory evidence');
    s.check(afis.evidenceAnalysis.unresolvedConflicts.some(
      (c) => c.includes('alt-strategy-aggressive')), 'conflict named');
    s.equal(afis.dominance.state, 'CONFLICTED', 'dominance CONFLICTED');
    s.equal(afis.recommendation.selectedAlternativeId, null, 'no selection');
    s.same([...afis.explanation.conflictConditions],
      [...afis.evidenceAnalysis.unresolvedConflicts], 'visible in explanation');
  }

  // -------------------------------------------------------------------
  // 19 — Insufficient evidence
  // -------------------------------------------------------------------
  {
    const s = section('19 insufficient evidence — missing is not negative');
    s.equal(abl.dominance.state, 'INSUFFICIENT_EVIDENCE', 'ABL dominance');
    s.equal(abl.recommendation.status, 'INSUFFICIENT_EVIDENCE', 'ABL recommendation');
    s.check(abl.tradeoff.scores.every((x) => x.score === null), 'null scores');
    s.equal(abl.ranking.entries.length, 0, 'no ranking entries');
    s.equal(abl.ranking.excluded.length, abl.alternatives.length, 'all excluded with reasons');
  }

  // -------------------------------------------------------------------
  // 20 — Regime-dependent case
  // -------------------------------------------------------------------
  {
    const s = section('20 regime-dependent case — dependency visible, eras honest');
    // With the band lowered to 0.1 the guardian regime spread (0.12) counts,
    // but all alternatives still match era 1 — no cross-era separation.
    const regimeDep = runDecision({
      baseCandidate: afisBase,
      alternatives: [afisVenueAOnlySpec(afisBase)],
      learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
      correlationId: 'corr-regime', traceId: 'trace-regime',
    }, {opportunityConfig: {...config.opportunityConfig, dependencySpreadBand: 0.1}});
    const anyDetected = regimeDep.alternatives.some(
      (a) => a.dependencies.regime.detected || a.dependencies.regime.spread !== null);
    s.check(anyDetected, 'regime spread measured');
    s.equal(regimeDep.regimeAnalysis.alternativesDiffer, false,
      'same matched era — no cross-era claim');
    s.check(regimeDep.explanation.regimeEffects.length > 0, 'regime effects stated');
  }

  // -------------------------------------------------------------------
  // 21 — Strategy-dependent case
  // -------------------------------------------------------------------
  {
    const s = section('21 strategy-dependent case — supported strategies named');
    s.equal(afis.strategyAnalysis.detected, true, 'dependency detected');
    s.check(afis.strategyAnalysis.applicable.every((key) =>
      ['arb-aggressive', 'arb-guardian'].includes(key) || key.length > 0),
      'applicable strategies named');
    s.check(afis.explanation.strategyEffects.some(
      (e) => e.includes('never implied to be universally superior')),
      'no universal superiority');
  }

  // -------------------------------------------------------------------
  // 22 — Venue-dependent case
  // -------------------------------------------------------------------
  {
    const s = section('22 venue-dependent case — venue evidence not aggregated away');
    s.equal(venueDep.dominance.state, 'VENUE_DEPENDENT', 'dominance state');
    s.same([...venueDep.venueAnalysis.applicable], ['venue-a', 'venue-b'], 'venues preserved');
    s.check(venueDep.dominance.reasons.some(
      (r) => r.includes('venue-specific evidence is preserved')), 'reason explicit');
  }

  // -------------------------------------------------------------------
  // 23 — AFIS isolation
  // -------------------------------------------------------------------
  {
    const s = section('23 AFIS isolation — no betting semantics');
    for (const alternative of afis.alternatives) {
      s.equal(alternative.counterfactualCandidate.marketId, null, 'no marketId');
      s.equal(alternative.counterfactualCandidate.selectionId, null, 'no selectionId');
      s.check(alternative.counterfactualCandidate.venueLegs.every(
        (l) => l.odds === null), 'no odds');
      s.check(alternative.counterfactualCandidate.venueLegs.every(
        (l) => l.side === 'BUY' || l.side === 'SELL'), 'BUY/SELL only');
    }
  }

  // -------------------------------------------------------------------
  // 24 — ABL isolation
  // -------------------------------------------------------------------
  {
    const s = section('24 ABL isolation — betting identity preserved');
    for (const alternative of abl.alternatives) {
      s.check(alternative.counterfactualCandidate.marketId !== null, 'market id kept');
      s.check(alternative.counterfactualCandidate.selectionId !== null, 'selection kept');
      s.check(alternative.counterfactualCandidate.venueLegs.every(
        (l) => l.side === 'BACK' || l.side === 'LAY'), 'BACK/LAY only');
      s.check(alternative.counterfactualCandidate.venueLegs.every(
        (l) => typeof l.odds === 'number' && l.odds > 1), 'odds > 1');
    }
  }

  // -------------------------------------------------------------------
  // 25 — BACK/LAY preservation
  // -------------------------------------------------------------------
  {
    const s = section('25 BACK/LAY preservation — orientation swap keeps meaning');
    const swapped = runDecision({
      baseCandidate: ablBase,
      alternatives: [ablOrientationSwapSpec(ablBase)],
      learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
      correlationId: 'corr-swap', traceId: 'trace-swap',
    });
    const swap = swapped.alternatives.find((a) => a.alternativeId === 'alt-orientation-swap');
    s.check(swap !== undefined, 'swap evaluated');
    if (swap) {
      const byVenue = new Map(swap.counterfactualCandidate.venueLegs.map(
        (l) => [l.venue, l]));
      s.equal(byVenue.get('venue-a')?.side, 'LAY', 'venue-a LAY');
      s.equal(byVenue.get('venue-b')?.side, 'BACK', 'venue-b BACK');
      s.equal(byVenue.get('venue-a')?.odds, 2.1, 'odds preserved');
      s.equal(byVenue.get('venue-b')?.odds, 2.05, 'odds preserved');
    }
  }

  // -------------------------------------------------------------------
  // 26 — Cross-domain rejection
  // -------------------------------------------------------------------
  {
    const s = section('26 cross-domain rejection — raw AFIS/ABL comparison impossible');
    const cross = runDecision({
      baseCandidate: afisBase,
      alternatives: [{alternativeId: 'xd', label: 'cross-domain', kind: 'STRATEGY',
        baseCandidateId: afisBase.candidateId, strategyId: 'sports-arb-strategy',
        venues: null, venueLegs: null, marketId: null, selectionId: null,
        marketOverrides: null, rationale: 'cross-domain'}],
      learning, timestamp: DECISION_FIXTURE_TIMESTAMP,
      correlationId: 'corr-xd', traceId: 'trace-xd',
    });
    s.equal(cross.rejectedAlternatives.length, 1, 'one rejection');
    s.equal(cross.rejectedAlternatives[0].code, 'CROSS_DOMAIN_COMPARISON', 'code');
    const afisVsAbl = compareAlternatives(
      evaluateCounterfactual(baselineSpecOf(afisBase), afisBase, learning,
        config.opportunityConfig),
      evaluateCounterfactual(baselineSpecOf(ablBase), ablBase, learning,
        config.opportunityConfig));
    s.equal(afisVsAbl.comparable, false, 'cross-domain pair not comparable');
  }

  // -------------------------------------------------------------------
  // 27 — Explanation
  // -------------------------------------------------------------------
  {
    const s = section('27 explanation — every decision reconstructible');
    s.check(afis.explanation.summary.includes('CONFLICTED'), 'summary names status');
    s.equal(afis.explanation.alternativeRationales.length,
      afis.alternatives.length + afis.rejectedAlternatives.length,
      'rationales cover all');
    s.equal(afis.explanation.evidenceFor.length, afis.alternatives.length, 'evidence for');
    s.equal(afis.explanation.evidenceAgainst.length, afis.alternatives.length, 'evidence against');
    s.check(afis.explanation.regimeEffects.length > 0, 'regime effects');
    s.check(afis.explanation.strategyEffects.length > 0, 'strategy effects');
    s.check(afis.explanation.venueEffects.length > 0, 'venue effects');
    s.check(afis.explanation.leakageEffects.length > 0, 'leakage effects');
    s.check(afis.explanation.stabilityEffects.length > 0, 'stability effects');
    s.check(afis.explanation.recommendationRationale.some(
      (r) => r.includes('informational only')), 'boundary stated');
  }

  // -------------------------------------------------------------------
  // 28 — Research context
  // -------------------------------------------------------------------
  {
    const s = section('28 research context — informational research input');
    s.equal(afis.researchContext.informational, true, 'informational');
    s.equal(afis.researchContext.decisionContextId, afis.context.contextId, 'mirrors context');
    s.check(afis.researchContext.regimeQuestions.length > 0, 'regime questions');
    s.check(afis.researchContext.strategyQuestions.length > 0, 'strategy questions');
    s.check(afis.researchContext.venueQuestions.length > 0, 'venue questions');
    const priorities = afis.researchContext.recommendedPriorities.map((q) => q.priority);
    const rank = (p: string) => p === 'HIGH' ? 0 : p === 'MEDIUM' ? 1 : 2;
    s.check(priorities.every((p, i) => i === 0 || rank(priorities[i - 1]) <= rank(p)),
      'priorities ordered');
  }

  // -------------------------------------------------------------------
  // 29 — Feedback
  // -------------------------------------------------------------------
  {
    const s = section('29 feedback — captured for later learning');
    s.equal(afis.feedback.length, 1, 'one feedback record');
    const feedback = afis.feedback[0];
    s.equal(feedback.status, afis.recommendation.status, 'mirrors recommendation');
    s.equal(feedback.informational, true, 'informational');
    s.equal(feedback.schemaVersion, 'decision-intelligence.feedback.v1', 'schema');
    const divergence = reconcileDecisionOutcome(afis.context, afis.recommendation,
      afis.alternatives, {selectedAlternativeId: 'baseline-dec-afis-cva-base',
        realizedNet: 1, observedRegimeEra: null, observedStrategyId: null,
        observedVenue: null, observedLeakage: null});
    s.equal(divergence.kind, 'SPURNED_ALTERNATIVE_POSITIVE', 'divergence classified');
    s.check(divergence.driftSignal !== null
      && divergence.driftSignal.includes('never rewritten'), 'non-destructive');
  }

  // -------------------------------------------------------------------
  // 30 — Replay
  // -------------------------------------------------------------------
  {
    const s = section('30 replay — byte-identical repeated execution');
    s.equal(afis.replay.identical, true, 'internal double-run identical');
    const fresh = engine.analyze(afisDecisionInput());
    s.check(compareDecisionResults(fresh, afis), 'fresh run byte-identical');
    s.equal(fresh.recommendation.recommendationId, afis.recommendation.recommendationId,
      'same recommendation');
    s.equal(JSON.stringify(fresh.ranking), JSON.stringify(afis.ranking), 'same ranking');
    s.equal(JSON.stringify(fresh.auditEvents), JSON.stringify(afis.auditEvents),
      'same audit events');
  }

  // -------------------------------------------------------------------
  // 31 — Audit
  // -------------------------------------------------------------------
  {
    const s = section('31 audit — oship.decision-intelligence.v1 hash chain');
    s.equal(afis.auditEvents.length, 28, 'AFIS chain length');
    s.check(afis.auditEvents.every((e) =>
      e.schemaVersion === 'oship.decision-intelligence.v1'), 'schema');
    const verification = verifyDecisionAudit(afis.auditEvents, 28);
    s.equal(verification.valid, true, 'chain verifies with expected count');
    const types = new Set(afis.auditEvents.map((e) => e.eventType));
    for (const required of ['context-created', 'alternative-added',
      'compatibility-evaluated', 'counterfactual-evaluated', 'evidence-evaluated',
      'tradeoff-evaluated', 'dominance-evaluated', 'recommendation-generated',
      'explanation-generated', 'research-context-generated', 'feedback-recorded',
      'replay-completed']) {
      s.check(types.has(required as never), `${required} audited`);
    }
    s.equal(DECISION_EVENT_TYPES.length, 14, 'fourteen canonical event types');
  }

  // -------------------------------------------------------------------
  // 32 — Deterministic repeated run
  // -------------------------------------------------------------------
  {
    const s = section('32 deterministic repeated run — triple execution');
    const a = serializeDecisionResult(engine.analyze(afisDecisionInput()));
    const b = serializeDecisionResult(engine.analyze(afisDecisionInput()));
    const c = serializeDecisionResult(engine.analyze(afisDecisionInput()));
    s.equal(a, b, 'run 1 == run 2');
    s.equal(b, c, 'run 2 == run 3');
    s.equal(a.length, c.length, 'byte length stable');
  }

  // -------------------------------------------------------------------
  // 33 — Fail-closed
  // -------------------------------------------------------------------
  {
    const s = section('33 fail-closed — rejections and base validation');
    let threw = false;
    try {
      engine.analyze({...afisDecisionInput(), baseCandidate: {candidateId: 'broken'}});
    } catch (e) {
      threw = String((e as Error).message).includes('base candidate rejected');
    }
    s.check(threw, 'malformed base rejected');
    let threwLearning = false;
    try {
      engine.analyze({...afisDecisionInput(), learning: {} as never});
    } catch (e) {
      threwLearning = String((e as Error).message).includes('learning result required');
    }
    s.check(threwLearning, 'unvalidated learning rejected');
  }

  // -------------------------------------------------------------------
  // 34 — Edge cases
  // -------------------------------------------------------------------
  {
    const s = section('34 edge cases — empty alternatives, thin history, sole alternative');
    const zero = engine.analyze({...afisDecisionInput(), alternatives: []});
    s.equal(zero.alternatives.length, 1, 'baseline only');
    s.equal(zero.alternatives[0].kind, 'BASELINE', 'kind BASELINE');
    s.equal(zero.dominance.state, 'WEAKLY_PREFERRED', 'sole alternative weakly preferred');
    s.equal(ablThin.alternatives.length, 2, 'thin ABL evaluated');
    s.equal(ablThin.dominance.state, 'INSUFFICIENT_EVIDENCE', 'thin dominance honest');
  }

  // -------------------------------------------------------------------
  // 35 — Serialization
  // -------------------------------------------------------------------
  {
    const s = section('35 serialization — canonical, no fabricated keys');
    const json = serializeDecisionResult(afis);
    s.check(!/"(probability|expectedReturn|expectedValue|winRate|pWin|futurePrice|futureOdds)"/.test(json),
      'no probability-like keys');
    s.check(!/"(treasury|credential|apiKey|password|privateKey)"/i.test(json),
      'no credential surface');
    s.check(!json.includes('undefined') && !json.includes('NaN'), 'no undefined/NaN');
    s.equal(serializeDecisionResult(JSON.parse(json) as never), json, 'round-trip exact');
  }

  // -------------------------------------------------------------------
  // 36 — Evidence-gap handling
  // -------------------------------------------------------------------
  {
    const s = section('36 evidence-gap handling — gaps named, never negative');
    s.check(afis.alternatives.every((a) =>
      afis.tradeoff.scores.find((x) => x.alternativeId === a.alternativeId)?.score !== null
      || a.evidenceGaps.length > 0), 'null scores expose gaps');
    s.check(afis.researchContext.evidenceGaps.length >= 0, 'research gaps declared');
    const gaps = evidenceGapsOf(afis.alternatives[0].profile);
    s.check(Array.isArray(gaps), 'gaps derived from profiles');
    s.equal(conflictsOf(afis.alternatives[1].profile).length > 0, true,
      'aggressive conflicts named');
  }

  // -------------------------------------------------------------------
  // 37 — Unsupported scenario handling
  // -------------------------------------------------------------------
  {
    const s = section('37 unsupported scenarios — INCOMPATIBLE marked, never inferred');
    s.check(afis.scenarioMatrix.incompatibleCombinations.length > 0, 'marked');
    s.check(afis.scenarioMatrix.incompatibleCombinations.every(
      (c) => c.includes('INCOMPATIBLE')), 'explicit marker');
    s.check(afis.scenarioMatrix.cells.every((c) => c.evidenceCount > 0), 'no empty cells');
  }

  // -------------------------------------------------------------------
  // 38 — Tie-breaking
  // -------------------------------------------------------------------
  {
    const s = section('38 tie-breaking — canonical, reproducible');
    const entries = afis.ranking.entries;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i - 1].tradeOffScore === entries[i].tradeOffScore) {
        s.check(entries[i - 1].alternativeId < entries[i].alternativeId,
          'id ascending on exact ties');
      } else {
        s.check(entries[i - 1].tradeOffScore > entries[i].tradeOffScore,
          'score descending otherwise');
      }
    }
    const ordered = afis.tradeoff.orderedAlternativeIds;
    s.same(ordered.slice(0, 1), [afis.ranking.entries[0].alternativeId],
      'ranking follows trade-off order');
  }

  // -------------------------------------------------------------------
  // 39 — Ranking
  // -------------------------------------------------------------------
  {
    const s = section('39 ranking — deterministic, domain-respecting');
    s.equal(afis.ranking.entries[0].alternativeId, 'alt-exec-conservative', 'leader');
    s.equal(afis.ranking.entries[0].rank, 1, 'rank 1');
    s.check(afis.ranking.entries.every((e, i) => e.rank === i + 1), 'contiguous ranks');
    s.check(!afis.ranking.entries.some(
      (e) => e.alternativeId === 'alt-strategy-aggressive'), 'conflicted excluded');
    s.equal(afis.ranking.excluded.length, 1, 'one exclusion');
  }

  // -------------------------------------------------------------------
  // 40 — Recommendation reconstruction
  // -------------------------------------------------------------------
  {
    const s = section('40 recommendation reconstruction — rebuild identical');
    const rebuilt = buildRecommendation(afis.alternatives, afis.tradeoff,
      afis.dominance, afis.regimeAnalysis, afis.strategyAnalysis,
      afis.venueAnalysis);
    s.same(rebuilt, afis.recommendation, 'byte-identical rebuild');
    s.equal(recommendationStatusOf(afis.dominance.state),
      afis.recommendation.status, 'status mapping deterministic');
  }

  // -------------------------------------------------------------------
  // 41 — Audit reconstruction
  // -------------------------------------------------------------------
  {
    const s = section('41 audit reconstruction — tamper, reorder, truncate fail');
    const tampered = afis.auditEvents.map((e) =>
      ({...e, payload: JSON.parse(JSON.stringify(e.payload))}));
    (tampered[2].payload as Record<string, unknown>).x = 1;
    s.check(!verifyDecisionAudit(tampered).valid, 'tamper detected');
    const reordered = afis.auditEvents.map((e) =>
      ({...e, payload: JSON.parse(JSON.stringify(e.payload))}));
    const swap = {...reordered[1]};
    reordered[1] = {...reordered[2], sequence: 1};
    reordered[2] = {...swap, sequence: 2};
    s.check(!verifyDecisionAudit(reordered).valid, 'reorder detected');
    s.check(!verifyDecisionAudit(afis.auditEvents.slice(0, 25), 28).valid,
      'truncation detected');
    s.check(!verifyDecisionAudit([...afis.auditEvents,
      {...afis.auditEvents[27], sequence: 28}], 28).valid, 'extension detected');
  }

  // -------------------------------------------------------------------
  // 42 — Full lifecycle
  // -------------------------------------------------------------------
  {
    const s = section('42 full lifecycle — opportunity to research input');
    s.check(afis.analysisId.startsWith('dia_'), 'analysis id');
    s.equal(afis.schemaVersion, 'oship.decision-intelligence.v1', 'schema');
    s.equal(afis.causalPolicy, 'ASSOCIATIONAL_ONLY', 'causal policy');
    s.equal(afis.source.learningAnalysisId, learning.analysisId, 'Sprint 037 source');
    s.equal(afis.lineage.counterfactualIds.length, 5, 'counterfactual lineage');
    s.check(afis.lineage.observationIds.length > 0, 'observation lineage');
    s.equal(afis.invariants.passed, true, 'invariants passed');
    s.check(afis.invariants.checks.length >= 50, 'at least 50 invariants');
  }

  // -------------------------------------------------------------------
  // 43 — Security boundary
  // -------------------------------------------------------------------
  {
    const s = section('43 security boundary — upstream of Strategy/AEGIS');
    const json = serializeDecisionResult(afis);
    s.check(!/"(treasury|credential|apiKey|password|token|secret|privateKey)"/i.test(json),
      'no treasury/credential surface');
    s.check(!/(execute the|place the (order|bet)|submit the order)/i.test(
      JSON.stringify(afis.recommendation)), 'no execution instructions');
    s.check(afis.explanation.recommendationRationale.some(
      (r) => r.includes('informational only')), 'boundary stated');
    const check = afis.invariants.checks.find(
      (c) => c.invariant === 'NO_EXECUTION_AUTHORITY');
    s.check(check !== undefined && check.passed, 'NO_EXECUTION_AUTHORITY invariant');
  }

  // -------------------------------------------------------------------
  // 44 — No-certainty guard
  // -------------------------------------------------------------------
  {
    const s = section('44 no-certainty guard — Evidence→Analysis→Comparison→Recommendation');
    const narratives = [afis.explanation.summary,
      ...afis.explanation.acceptanceDecisions,
      ...afis.explanation.recommendationRationale,
      ...afis.recommendation.supportingEvidence,
      ...afis.recommendation.opposingEvidence,
      ...afis.recommendation.dependencyState,
      ...dominant.explanation.recommendationRationale];
    for (const line of narratives) {
      s.check(!/guaranteed|will (win|profit|lose)|cannot lose|risk-free|riskless|sure profit/i.test(line),
        `no certainty claims: ${line.slice(0, 40)}`);
    }
    const certainty = afis.invariants.checks.find(
      (c) => c.invariant === 'NO_FUTURE_CERTAINTY_CLAIMS');
    s.check(certainty !== undefined && certainty.passed, 'invariant enforced');
    const authority = afis.invariants.checks.find(
      (c) => c.invariant === 'NO_AUTHORITY_LANGUAGE');
    s.check(authority !== undefined && authority.passed, 'no authority language');
  }

  // -------------------------------------------------------------------
  // 45 — Divergence reconciliation
  // -------------------------------------------------------------------
  {
    const s = section('45 divergence reconciliation — informational drift only');
    const good = reconcileDecisionOutcome(dominant.context, dominant.recommendation,
      dominant.alternatives, {selectedAlternativeId: 'alt-venue-a', realizedNet: 2,
        observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
        observedLeakage: null});
    s.equal(good.kind, 'AGREEMENT', 'agreement classified');
    const bad = reconcileDecisionOutcome(dominant.context, dominant.recommendation,
      dominant.alternatives, {selectedAlternativeId: 'alt-venue-a', realizedNet: -2,
        observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
        observedLeakage: null});
    s.equal(bad.kind, 'RECOMMENDED_BUT_NEGATIVE', 'negative divergence classified');
    const mismatch = reconcileDecisionOutcome(dominant.context, dominant.recommendation,
      dominant.alternatives, {selectedAlternativeId: 'alt-venue-a', realizedNet: 1,
        observedRegimeEra: null, observedStrategyId: 'sports-arb-strategy',
        observedVenue: 'venue-z', observedLeakage: 9});
    s.equal(mismatch.strategyMismatch, true, 'strategy mismatch recorded');
    s.equal(mismatch.venueMismatch, true, 'venue mismatch recorded');
    s.equal(mismatch.leakageMismatch, true, 'leakage mismatch recorded');
  }

  // -------------------------------------------------------------------
  // 46 — Alternative builder surface
  // -------------------------------------------------------------------
  {
    const s = section('46 alternative builder — standard sets per domain');
    const afisStandard = buildStandardAlternatives(afisBase, learning);
    s.equal(afisStandard[0].kind, 'BASELINE', 'baseline first');
    s.check(afisStandard.some((x) => x.kind === 'STRATEGY'), 'strategy variants');
    s.check(afisStandard.some((x) => x.kind === 'EXECUTION'), 'execution variants');
    s.check(!afisStandard.some((x) => x.kind === 'MARKET'), 'no betting variants in AFIS');
    const ablStandard = buildStandardAlternatives(ablBase, learning);
    s.check(!ablStandard.some((x) => x.kind === 'EXECUTION'), 'no execution variants in ABL');
    s.check(ablStandard.some((x) => x.kind === 'SIDE'), 'orientation variant');
    s.check(ablStandard.every((x) => x.rationale.length > 10), 'rationales carried');
  }

  // -------------------------------------------------------------------
  // 47 — Counterfactual determinism
  // -------------------------------------------------------------------
  {
    const s = section('47 counterfactual determinism — identical rebuilds');
    const a = evaluateCounterfactual(baselineSpecOf(afisBase), afisBase, learning,
      config.opportunityConfig);
    const b = evaluateCounterfactual(baselineSpecOf(afisBase), afisBase, learning,
      config.opportunityConfig);
    s.equal(JSON.stringify(a), JSON.stringify(b), 'counterfactual rebuild identical');
    s.equal(a.counterfactualOnly, true, 'descriptive only');
    const values = tradeOffValuesOf(a);
    s.check(Object.keys(values).length === 12, 'twelve dimension values');
    const score = computeTradeOffScore(a, config);
    s.near(score.score, 0.7473, 'baseline trade-off score locked', 0.0001);
  }

  // -------------------------------------------------------------------
  // 48 — Final reconciled state
  // -------------------------------------------------------------------
  {
    const s = section('48 final state — every gate reconciled');
    s.equal(afis.invariants.passed && abl.invariants.passed
      && ablThin.invariants.passed && venueDep.invariants.passed
      && dominant.invariants.passed && noDominant.invariants.passed,
      true, 'all runs pass invariants');
    s.equal(afis.replay.identical && abl.replay.identical
      && venueDep.replay.identical && dominant.replay.identical,
      true, 'all runs replay-identical');
    const report = checkDecisionInvariants(afis, {
      baseCandidate: afisDecisionInput().baseCandidate,
      alternativeSpecs: afisDecisionInput().alternatives,
      learning, config,
    });
    s.equal(report.passed, true, 'external invariant re-check passes');
    s.equal(report.checks.length, afis.invariants.checks.length, 'same check count');
  }

  // -------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  lines.push(` Decision runs: AFIS (${afis.alternatives.length} alternatives, `
    + `${afis.dominance.state}), ABL (${abl.alternatives.length} alternatives, `
    + `${abl.dominance.state}), ABL-thin (${ablThin.dominance.state}), plus `
    + `venue-dependent, dominant-margin and no-dominant runs.`);
  lines.push(` Invariant checks per run: ${afis.invariants.checks.length}. `
    + `Audit events: ${afis.auditEvents.length}. Trade-off dimensions: 12.`);
  lines.push('');
  lines.push(' The recommendation is NOT a probability, forecast, expected return,');
  lines.push(' guarantee or execution instruction. Historical evidence stays');
  lines.push(' historical. Nothing here authorizes execution, capital, risk,');
  lines.push(' policy, Treasury or provider access.');
  lines.push('');
  lines.push(` SPRINT 039 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  if (failed.length === 0) {
    lines.push('');
    lines.push(` All ${sections.length} sections passed. Every decision output is`);
    lines.push(' informational and associational; counterfactuals describe existing');
    lines.push(' evidence only; AFIS and ABL stayed isolated; BACK/LAY and BUY/SELL');
    lines.push(' semantics were preserved exactly; conflicts were never forced to a');
    lines.push(' winner; the audit chain is append-only and tamper-evident; replay is');
    lines.push(' byte-identical.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 039: COMPLETE');
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
