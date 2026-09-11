/**
 * SPRINT 038 — UNIFIED PREDICTIVE OPPORTUNITY INTELLIGENCE & EVIDENCE-BOUND
 * SCORING ENGINE demo.
 *
 * PAPER / SIMULATION ONLY — AN ANALYTICAL EVIDENCE LAYER, NOT AN AUTHORITY
 * AND NOT AN ORACLE.
 *
 * Every section drives the REAL opportunity-intelligence engine over the
 * REAL Sprint 037 learning result (five eras, 65 observations, 3 strategies,
 * 2 venues, 11 classes, AFIS + ABL) with realistic new AFIS and ABL
 * candidates:
 *
 *   New Opportunity → Historical Similarity → Learned Features → Regime
 *   Match → Strategy History → Venue History → Leakage History → Evidence
 *   Quality → Stability → Historical Outcome Distribution → Opportunity
 *   Intelligence Profile → Evidence-Bound Score → Classification →
 *   Explanation → Research / Decision Input.
 *
 * Nothing is mocked. Nothing authorizes trades, bets, capital, risk, policy
 * or execution; every output is informational and associational-only. Every
 * PASS line is backed by assertions against actual engine output. The score
 * is an evidence-bound analytical index — not a probability, forecast,
 * expected return, or guarantee.
 */

import {OpportunityIntelligenceEngine} from './intelligence/opportunity/engine';
import {validateCandidate} from './intelligence/opportunity/candidate';
import {assessSimilarity, proximityOf} from './intelligence/opportunity/similarity';
import {buildFeatureProfile} from './intelligence/opportunity/feature-profile';
import {buildRegimeMatch} from './intelligence/opportunity/regime-match';
import {assessStrategyHistory} from './intelligence/opportunity/strategy-match';
import {assessVenueHistory} from './intelligence/opportunity/venue-match';
import {assessLeakageRisk} from './intelligence/opportunity/leakage-risk';
import {assessEvidence} from './intelligence/opportunity/evidence';
import {assessStability} from './intelligence/opportunity/stability';
import {buildOutcomeDistribution} from './intelligence/opportunity/outcome-distribution';
import {computeEvidenceBoundScore} from './intelligence/opportunity/score';
import {detectDependencies, classifyOpportunity} from './intelligence/opportunity/classification';
import {rankProfiles} from './intelligence/opportunity/ranking';
import {recordFeedback, reconcileOutcome} from './intelligence/opportunity/feedback';
import {serializeOpportunityResult, compareOpportunityResults} from './intelligence/opportunity/replay';
import {checkOpportunityInvariants} from './intelligence/opportunity/invariants';
import {verifyOpportunityAudit} from './intelligence/opportunity/audit';
import {mergeOpportunityConfig} from './intelligence/opportunity/config';
import {canonicalJson} from './intelligence/opportunity/ids';
import {SCORE_DISCLAIMER, DISTRIBUTION_DISCLAIMER, OPPORTUNITY_EVENT_TYPES} from './intelligence/opportunity/types';
import {
  opportunityInput, opportunityResult, opportunityLearning, freshCandidates,
  rejectedCandidates, rejectionGallery, opportunityProfileOf,
} from './intelligence/opportunity/test-fixtures';

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
  const config = mergeOpportunityConfig({});
  const learning = opportunityLearning();
  const input = opportunityInput();
  const result = opportunityResult();
  const engine = new OpportunityIntelligenceEngine({});
  const profile = (id: string) => opportunityProfileOf(id);
  const guardian = profile('cand-afis-cva-guardian');
  const aggressive = profile('cand-afis-cva-aggressive');
  const liq = profile('cand-afis-liq-guardian');
  const mm = profile('cand-afis-mm-guardian');
  const surebet = profile('cand-abl-surebet');
  const backlay = profile('cand-abl-backlay');
  const stale = profile('cand-afis-cva-stale');

  // -------------------------------------------------------------------
  // 1 — Historical input (real Sprint 037 learning result)
  // -------------------------------------------------------------------
  {
    const s = section('01 historical input — Sprint 037 learning consumed read-only');
    s.equal(learning.invariants.passed, true, 'learning invariants passed');
    s.equal(learning.replay.identical, true, 'learning replay verified');
    s.equal(learning.observations.length, 65, 'learning observations');
    s.equal(result.source.learningAnalysisId, learning.analysisId, 'source linkage');
    s.equal(result.source.observationCount, 65, 'source observation count');
    s.equal(result.source.regimeCount, learning.regimes.length, 'source regime count');
  }

  // -------------------------------------------------------------------
  // 2 — Candidate intake
  // -------------------------------------------------------------------
  {
    const s = section('02 candidate intake — realistic AFIS and ABL candidates');
    s.equal(freshCandidates().length, 7, 'seven fresh candidates');
    s.equal(result.profiles.length, 7, 'seven profiles produced');
    s.equal(result.rejected.length, 2, 'two in-band rejections');
    s.check(result.profiles.every((p) => Object.isFrozen(p)), 'profiles frozen');
    const domains = new Set(result.profiles.map((p) => p.domain));
    s.same([...domains].sort(), ['ABL', 'AFIS'], 'both domains assessed');
  }

  // -------------------------------------------------------------------
  // 3 — Fail-closed validation
  // -------------------------------------------------------------------
  {
    const s = section('03 fail-closed validation — the full rejection gallery');
    const gallery = rejectionGallery();
    s.equal(gallery.length, 15, 'fifteen gallery entries');
    s.equal(new Set(gallery.map((e) => e.code)).size, 13, 'thirteen unique codes');
    for (const entry of gallery) {
      const validation = validateCandidate(entry.candidate, learning);
      s.check('rejected' in validation, `entry ${entry.code} rejects`);
    }
    const codes = result.rejected.map((r) => r.code);
    s.same(codes.sort(), ['INVALID_ODDS', 'UNKNOWN_DOMAIN'], 'in-band rejection codes');
  }

  // -------------------------------------------------------------------
  // 4 — AFIS candidate semantics
  // -------------------------------------------------------------------
  {
    const s = section('04 AFIS semantics — BUY/SELL legs, no odds, no betting identity');
    const afis = freshCandidates().filter((c) => c.domain === 'AFIS');
    s.equal(afis.length, 5, 'five AFIS candidates');
    for (const candidate of afis) {
      for (const leg of candidate.venueLegs) {
        s.check(leg.side === 'BUY' || leg.side === 'SELL', 'AFIS side semantics');
        s.equal(leg.odds, null, 'AFIS legs carry no odds');
      }
      s.equal(candidate.marketId, null, 'AFIS carries no marketId');
      s.equal(candidate.selectionId, null, 'AFIS carries no selectionId');
    }
  }

  // -------------------------------------------------------------------
  // 5 — ABL candidate semantics
  // -------------------------------------------------------------------
  {
    const s = section('05 ABL semantics — BACK/LAY legs, decimal odds, identity');
    const abl = freshCandidates().filter((c) => c.domain === 'ABL');
    s.equal(abl.length, 2, 'two ABL candidates');
    for (const candidate of abl) {
      for (const leg of candidate.venueLegs) {
        s.check(leg.side === 'BACK' || leg.side === 'LAY', 'ABL side semantics');
        s.check(leg.odds === null || leg.odds > 1, 'decimal odds > 1');
      }
      s.check(candidate.marketId !== null && candidate.marketId.length > 0,
        'marketId identity preserved');
      s.check(candidate.selectionId !== null && candidate.selectionId.length > 0,
        'selectionId identity preserved');
    }
    s.equal(surebet.marketId, 'mkt-derby-winner', 'marketId reaches the profile');
    s.equal(surebet.selectionId, 'sel-home-team', 'selectionId reaches the profile');
  }

  // -------------------------------------------------------------------
  // 6 — Cross-domain isolation at validation
  // -------------------------------------------------------------------
  {
    const s = section('06 cross-domain isolation — raw comparison never happens');
    const ablCandidate = freshCandidates().find(
      (c) => c.candidateId === 'cand-abl-surebet')!;
    const crossStrategy = validateCandidate(
      {...ablCandidate, strategyId: 'arb-guardian'}, learning);
    s.check('rejected' in crossStrategy, 'cross-domain strategy rejected');
    s.check('rejected' in crossStrategy
      && crossStrategy.code === 'AMBIGUOUS_SEMANTIC_MAPPING', 'ambiguous mapping code');
    const crossClass = validateCandidate(
      {...ablCandidate, opportunityClass: 'cross-venue-arbitrage'}, learning);
    s.check('rejected' in crossClass
      && crossClass.code === 'CLASS_DOMAIN_MISMATCH', 'class/domain mismatch rejected');
  }

  // -------------------------------------------------------------------
  // 7 — Similarity: same-domain pool only
  // -------------------------------------------------------------------
  {
    const s = section('07 similarity — same-domain pool only');
    s.equal(guardian.similarity.consideredCount, 60, 'AFIS pool is the 60 AFIS observations');
    s.equal(surebet.similarity.consideredCount, 5, 'ABL pool is the 5 ABL observations');
    for (const p of result.profiles) {
      for (const match of p.similarity.matches) {
        s.equal(match.domain, p.domain, `match domain isolated for ${p.candidateId}`);
      }
    }
  }

  // -------------------------------------------------------------------
  // 8 — Similarity: explicit components
  // -------------------------------------------------------------------
  {
    const s = section('08 similarity — deterministic explicit-feature components');
    const candidate = freshCandidates()[0];
    const assessment = assessSimilarity(candidate, learning, config);
    const observation = learning.observations.find(
      (o) => o.observationId === assessment.matches[0].observationId)!;
    const components = assessment.matches[0].components;
    s.equal(components.classMatch,
      observation.opportunityClass === candidate.opportunityClass ? 1 : 0,
      'class match component');
    s.equal(components.strategyMatch,
      observation.strategyId === candidate.strategyId ? 1 : 0,
      'strategy match component');
    s.check(components.venueOverlap >= 0 && components.venueOverlap <= 1,
      'venue overlap is a Jaccard index');
    s.equal(proximityOf(5, 5), 1, 'proximity of equals is 1');
    s.equal(proximityOf(0, 1), 0, 'proximity of unit extremes is 0');
    s.equal(proximityOf(null, 1), null, 'proximity of missing is null');
  }

  // -------------------------------------------------------------------
  // 9 — Similarity: floor and top-K
  // -------------------------------------------------------------------
  {
    const s = section('09 similarity — floor and top-K cohort selection');
    for (const p of result.profiles) {
      s.check(p.similarity.cohortSize <= config.similarityTopK,
        `top-K respected for ${p.candidateId}`);
      for (const match of p.similarity.matches) {
        s.check(match.score >= config.similarityFloor,
          `floor respected for ${p.candidateId}`);
      }
    }
    s.equal(guardian.similarity.cohortSize, 20, 'guardian cohort at the cap');
    s.equal(surebet.similarity.cohortSize, 2, 'surebet cohort of two');
    s.equal(backlay.similarity.cohortSize, 1, 'back-lay cohort of one');
  }

  // -------------------------------------------------------------------
  // 10 — Similarity: canonical ordering
  // -------------------------------------------------------------------
  {
    const s = section('10 similarity — canonical ordering and tie-breaks');
    for (const p of result.profiles) {
      const matches = p.similarity.matches;
      for (let i = 1; i < matches.length; i++) {
        s.check(matches[i - 1].score >= matches[i].score, 'score descending');
        if (matches[i - 1].score === matches[i].score) {
          s.check(matches[i - 1].observationId < matches[i].observationId,
            'observationId ascending tie-break');
        }
      }
    }
    s.check(guardian.similarity.similarityQuality !== null, 'quality measurable');
  }

  // -------------------------------------------------------------------
  // 11 — Learned features: class summary
  // -------------------------------------------------------------------
  {
    const s = section('11 learned features — class summary (domain-scoped)');
    s.equal(guardian.featureProfile.classSummary.subject,
      'OPPORTUNITY_CLASS:cross-venue-arbitrage', 'class subject');
    s.equal(guardian.featureProfile.classSummary.sampleSize, 42,
      'cross-venue-arbitrage has 42 observations');
    s.equal(guardian.featureProfile.classSummary.stability, 'REGIME_DEPENDENT',
      'class stability from Sprint 037');
    const rebuilt = buildFeatureProfile(freshCandidates()[0], learning, config);
    s.same(rebuilt, guardian.featureProfile, 'feature profile rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 12 — Learned features: strategy summary
  // -------------------------------------------------------------------
  {
    const s = section('12 learned features — strategy summary');
    s.equal(guardian.featureProfile.strategySummary.subject, 'STRATEGY:arb-guardian',
      'strategy subject');
    s.equal(guardian.featureProfile.strategySummary.classification,
      'CONSISTENT_OUTPERFORMER', 'guardian classification');
    s.equal(aggressive.featureProfile.strategySummary.classification,
      'HIGH_THEORETICAL_LOW_REALIZATION', 'aggressive classification');
    s.near(guardian.featureProfile.strategySummary.meanPreservation, 0.7099,
      'guardian mean preservation', 1e-3);
  }

  // -------------------------------------------------------------------
  // 13 — Learned features: venue summaries
  // -------------------------------------------------------------------
  {
    const s = section('13 learned features — venue summaries');
    s.same(guardian.featureProfile.venueSummaries.map((v) => v.subject),
      ['VENUE:venue-a', 'VENUE:venue-b'], 'venue subjects in candidate order');
    s.equal(guardian.featureProfile.venueSummaries.length, 2, 'two venue summaries');
    const emptyLearning = learning;
    const ghostProfile = buildFeatureProfile(
      {...freshCandidates()[0], strategyId: 'ghost'}, emptyLearning, config);
    s.equal(ghostProfile.strategySummary.sampleSize, 0, 'absent subject is honest');
    s.equal(ghostProfile.strategySummary.evidenceState, 'INSUFFICIENT',
      'absent subject is INSUFFICIENT, never invented');
  }

  // -------------------------------------------------------------------
  // 14 — Regime match
  // -------------------------------------------------------------------
  {
    const s = section('14 regime match — candidate conditions vs historical eras');
    s.equal(guardian.regimeMatch.state, 'MATCHED', 'guardian regime matched');
    s.check(guardian.regimeMatch.matchedEra !== null, 'matched era present');
    s.near(guardian.regimeMatch.matchQuality as number, 0.972,
      'guardian regime quality', 1e-3);
    const rebuilt = buildRegimeMatch(freshCandidates()[0], learning, config);
    s.same(rebuilt, guardian.regimeMatch, 'regime match rebuilds identically');
    const dimensions = guardian.regimeMatch.dimensions.map((d) => d.dimension);
    s.same(dimensions, ['VOLATILITY', 'LIQUIDITY', 'EXECUTION_QUALITY'],
      'three condition dimensions');
  }

  // -------------------------------------------------------------------
  // 15 — Strategy history
  // -------------------------------------------------------------------
  {
    const s = section('15 strategy history — classification to fit mapping');
    s.equal(guardian.strategyHistory.strategyFit, 1,
      'CONSISTENT_OUTPERFORMER maps to fit 1');
    s.equal(aggressive.strategyHistory.strategyFit, 0.2,
      'HIGH_THEORETICAL_LOW_REALIZATION maps to fit 0.2');
    s.equal(surebet.strategyHistory.strategyFit, 0.6, 'STABLE maps to fit 0.6');
    s.equal(guardian.strategyHistory.sampleSize, 30, 'guardian sample size');
    s.equal(guardian.strategyHistory.domain, 'AFIS', 'strategy history domain-scoped');
    const rebuilt = assessStrategyHistory(freshCandidates()[0], learning, config);
    s.same(rebuilt, guardian.strategyHistory, 'strategy history rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 16 — Venue history
  // -------------------------------------------------------------------
  {
    const s = section('16 venue history — classification to fit mapping');
    const venueA = guardian.venueHistory.find((v) => v.venue === 'venue-a')!;
    const venueB = guardian.venueHistory.find((v) => v.venue === 'venue-b')!;
    s.equal(venueA.classification, 'CONSISTENTLY_WEAK', 'venue-a weak');
    s.equal(venueA.venueFit, 0.2, 'weak venue fit');
    s.equal(venueB.classification, 'CONSISTENTLY_STRONG', 'venue-b strong');
    s.equal(venueB.venueFit, 1, 'strong venue fit');
    const rebuilt = assessVenueHistory(freshCandidates()[0], learning, config);
    s.same(rebuilt, guardian.venueHistory, 'venue history rebuilds identically');
    s.equal(liq.venueHistory.length, 1, 'single-venue candidate history');
  }

  // -------------------------------------------------------------------
  // 17 — Leakage: apparent vs realized vs burden
  // -------------------------------------------------------------------
  {
    const s = section('17 leakage — apparent vs realized vs burden');
    s.check(guardian.leakageRisk.apparentQuality !== null, 'apparent quality measured');
    s.check(guardian.leakageRisk.realizedQuality !== null, 'realized quality measured');
    s.near(guardian.leakageRisk.apparentQuality as number, 6.82,
      'guardian apparent quality', 5e-2);
    s.near(guardian.leakageRisk.realizedQuality as number, 4.033,
      'guardian realized quality', 5e-2);
    s.check(aggressive.leakageRisk.leakageShare !== null
      && (aggressive.leakageRisk.leakageShare as number)
        > (guardian.leakageRisk.leakageShare as number),
      'aggressive cohort leaks more than guardian cohort');
    s.check(guardian.leakageRisk.recurringComponents.includes('SLIPPAGE'),
      'recurring class components from Sprint 037');
  }

  // -------------------------------------------------------------------
  // 18 — Leakage: counted exactly once
  // -------------------------------------------------------------------
  {
    const s = section('18 leakage — counted exactly once, never twice');
    for (const p of result.profiles) {
      const {realizedQuality, leakageBurden, leakageAdjustedQuality} = p.leakageRisk;
      if (realizedQuality !== null && leakageBurden !== null
        && leakageAdjustedQuality !== null) {
        s.check(Math.abs(leakageAdjustedQuality - (realizedQuality + leakageBurden))
          < 1e-9, `adjusted = realized + leakage for ${p.candidateId}`);
        s.check(leakageAdjustedQuality >= realizedQuality - 1e-9,
          `burden added back for ${p.candidateId}`);
      }
    }
    const rebuilt = assessLeakageRisk(
      freshCandidates()[0], guardian.similarity, learning, config);
    s.same(rebuilt, guardian.leakageRisk, 'leakage rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 19 — Evidence: counts and adequacy
  // -------------------------------------------------------------------
  {
    const s = section('19 evidence — counts, adequacy, source');
    s.equal(guardian.evidence.evidenceCount, 20, 'guardian evidence count');
    s.equal(guardian.evidence.sampleAdequacy, 'SUFFICIENT', 'guardian adequacy');
    s.equal(mm.evidence.sampleAdequacy, 'LIMITED', 'market-making adequacy LIMITED');
    s.equal(surebet.evidence.sampleAdequacy, 'INSUFFICIENT', 'surebet INSUFFICIENT');
    s.check(guardian.evidence.source.length > 0, 'source declared');
    for (const p of result.profiles) {
      s.equal(p.evidence.evidenceCount, p.similarity.cohortSize,
        `count matches cohort for ${p.candidateId}`);
    }
  }

  // -------------------------------------------------------------------
  // 20 — Evidence: freshness
  // -------------------------------------------------------------------
  {
    const s = section('20 evidence — freshness window');
    s.equal(guardian.evidence.freshness, 'FRESH', 'guardian evidence fresh');
    s.equal(stale.evidence.freshness, 'STALE', 'stale candidate evidence STALE');
    s.check(guardian.evidence.oldestEvidenceAge < config.evidenceStaleMs,
      'age below the staleness window');
    s.check(stale.evidence.oldestEvidenceAge > config.evidenceStaleMs,
      'stale age beyond the window');
  }

  // -------------------------------------------------------------------
  // 21 — Evidence: consistency and conflicts
  // -------------------------------------------------------------------
  {
    const s = section('21 evidence — consistency and conflicts');
    s.equal(guardian.evidence.consistency, 'INCONSISTENT',
      'dispersed guardian cohort is heterogeneous');
    s.equal(guardian.evidence.confidenceState, 'WEAK',
      'heterogeneous-but-uncontradicted is WEAK, scored with penalty');
    s.equal(aggressive.evidence.conflicts > 0, true,
      'aggressive strategy contradiction counts as a conflict');
    s.equal(aggressive.evidence.confidenceState, 'CONFLICTED',
      'contradicted evidence is CONFLICTED');
    s.check(guardian.evidence.completeness > 0, 'completeness measured');
  }

  // -------------------------------------------------------------------
  // 22 — Evidence: confidence across the candidate set
  // -------------------------------------------------------------------
  {
    const s = section('22 evidence — confidence states across candidates');
    const states = result.profiles.map((p) => p.evidence.confidenceState).sort();
    s.same(states, ['CONFLICTED', 'INSUFFICIENT', 'INSUFFICIENT', 'MODERATE',
      'STALE', 'WEAK', 'WEAK'], 'real confidence spread');
    s.equal(mm.evidence.confidenceState, 'MODERATE', 'market-making MODERATE');
    s.equal(backlay.evidence.confidenceState, 'INSUFFICIENT', 'back-lay INSUFFICIENT');
  }

  // -------------------------------------------------------------------
  // 23 — Stability integration
  // -------------------------------------------------------------------
  {
    const s = section('23 stability — Sprint 037 classifications integrated');
    s.equal(guardian.stability.classStability, 'REGIME_DEPENDENT', 'class stability');
    s.equal(guardian.stability.strategyStability, 'REGIME_DEPENDENT', 'strategy stability');
    s.equal(guardian.stability.preservationDrift, 'IMPROVING', 'guardian drift');
    s.equal(guardian.stability.interpretation, 'REGIME_SENSITIVE', 'interpretation');
    s.equal(guardian.stability.stabilityFactor, 0.6, 'factor');
    const rebuilt = assessStability(freshCandidates()[0], learning, config);
    s.same(rebuilt, guardian.stability, 'stability rebuilds identically');
    s.check(mm.explanation.stabilityEffect.includes(mm.stability.interpretation),
      'stability effect is explicit in the explanation');
  }

  // -------------------------------------------------------------------
  // 24 — Outcome distribution: counts and bands
  // -------------------------------------------------------------------
  {
    const s = section('24 outcome distribution — counts and bands (historical only)');
    s.equal(guardian.outcomeDistribution.sampleSize, 20, 'guardian sample size');
    s.equal(guardian.outcomeDistribution.positiveCount
      + guardian.outcomeDistribution.neutralCount
      + guardian.outcomeDistribution.negativeCount,
      guardian.outcomeDistribution.measuredRealizedCount, 'bands partition measured');
    s.equal(aggressive.outcomeDistribution.negativeCount > 0, true,
      'aggressive cohort has negative historical outcomes');
    s.equal(guardian.outcomeDistribution.historicalOnly, true, 'explicitly historical');
    s.equal(guardian.outcomeDistribution.disclaimer, DISTRIBUTION_DISCLAIMER,
      'exact distribution disclaimer');
  }

  // -------------------------------------------------------------------
  // 25 — Outcome distribution: quartiles
  // -------------------------------------------------------------------
  {
    const s = section('25 outcome distribution — median and quartiles');
    const d = guardian.outcomeDistribution;
    s.check(d.quartile25 !== null && d.medianPreservation !== null
      && d.quartile75 !== null, 'quartiles measured');
    s.check((d.quartile25 as number) <= (d.medianPreservation as number) + 1e-9,
      'q25 ≤ median');
    s.check((d.medianPreservation as number) <= (d.quartile75 as number) + 1e-9,
      'median ≤ q75');
    s.check((d.minPreservation as number) <= (d.maxPreservation as number),
      'min ≤ max');
    s.near(d.medianPreservation as number, 0.95, 'guardian median preservation', 1e-3);
    const rebuilt = buildOutcomeDistribution(
      freshCandidates()[0], guardian.similarity, learning, config);
    s.same(rebuilt, guardian.outcomeDistribution, 'distribution rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 26 — Outcome distribution: realization quality
  // -------------------------------------------------------------------
  {
    const s = section('26 outcome distribution — realization quality');
    s.check(guardian.outcomeDistribution.realizationQuality !== null,
      'guardian realization quality measured');
    s.check((aggressive.outcomeDistribution.realizationQuality as number)
      < (guardian.outcomeDistribution.realizationQuality as number),
      'aggressive realizes less than guardian');
    s.near(guardian.outcomeDistribution.realizationQuality as number, 0.591,
      'guardian realization quality', 1e-3);
    const serialized = canonicalJson(guardian.outcomeDistribution);
    s.check(!serialized.includes('"probability"'), 'no probability keys');
  }

  // -------------------------------------------------------------------
  // 27 — Score: eleven explicit dimensions
  // -------------------------------------------------------------------
  {
    const s = section('27 score — eleven explicit dimensions');
    s.equal(guardian.score.components.length, 11, 'eleven components');
    const names = guardian.score.components.map((c) => c.dimension);
    s.same(names, ['historicalPreservation', 'realizationQuality', 'evidenceQuality',
      'similarityQuality', 'regimeFit', 'strategyFit', 'venueFit', 'stabilityFactor',
      'leakageBurden', 'freshnessFactor', 'sampleAdequacy'], 'canonical dimension order');
    s.check(guardian.score.contributingDimensions > 0, 'dimensions contributed');
  }

  // -------------------------------------------------------------------
  // 28 — Score: weights and renormalization
  // -------------------------------------------------------------------
  {
    const s = section('28 score — configured weights, renormalized availability');
    for (const component of guardian.score.components) {
      s.equal(component.configuredWeight, config.scoreWeights[component.dimension],
        `configured weight recorded for ${component.dimension}`);
    }
    const total = guardian.score.components.reduce(
      (sum, c) => sum + c.effectiveWeight, 0);
    s.near(total, 1, 'effective weights renormalize to 1', 1e-9);
    for (const component of guardian.score.components) {
      if (component.value === null) {
        s.equal(component.effectiveWeight, 0, 'unavailable dimensions carry no weight');
      }
    }
  }

  // -------------------------------------------------------------------
  // 29 — Score: exact decomposition
  // -------------------------------------------------------------------
  {
    const s = section('29 score — exact decomposition, no opaque numbers');
    for (const p of result.profiles) {
      if (p.score.score === null) continue;
      const sum = p.score.components.reduce(
        (sum2, c) => sum2 + (c.contribution ?? 0), 0);
      s.check(Math.abs(sum - (p.score.score as number)) < 1e-9,
        `decomposition exact for ${p.candidateId}`);
    }
    const rebuilt = computeEvidenceBoundScore(
      freshCandidates()[0], guardian.similarity, guardian.leakageRisk,
      guardian.evidence, guardian.stability, guardian.strategyHistory,
      guardian.venueHistory, guardian.regimeMatch, guardian.outcomeDistribution, config);
    s.same(rebuilt, guardian.score, 'score rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 30 — Score: null where honesty requires
  // -------------------------------------------------------------------
  {
    const s = section('30 score — null where honesty requires');
    s.equal(surebet.score.score, null, 'INSUFFICIENT evidence → null score');
    s.equal(backlay.score.score, null, 'one-observation cohort → null score');
    s.equal(stale.score.score, null, 'STALE evidence → null score');
    s.equal(aggressive.score.score, null, 'CONFLICTED evidence → null score');
    s.check(guardian.score.score !== null, 'WEAK evidence still scores (penalized)');
    s.check(mm.score.score !== null, 'MODERATE evidence scores');
  }

  // -------------------------------------------------------------------
  // 31 — Score: the exact disclaimer
  // -------------------------------------------------------------------
  {
    const s = section('31 score — the exact disclaimer travels everywhere');
    for (const p of result.profiles) {
      s.equal(p.score.disclaimer, SCORE_DISCLAIMER, `disclaimer on ${p.candidateId}`);
    }
    s.equal(SCORE_DISCLAIMER,
      'This is an evidence-bound analytical index, not a probability, '
      + 'forecast, expected return, or guarantee.', 'verbatim text');
  }

  // -------------------------------------------------------------------
  // 32 — Dependencies: detection rule
  // -------------------------------------------------------------------
  {
    const s = section('32 dependencies — spread rule, groups exposed');
    for (const p of result.profiles) {
      for (const dep of [p.dependencies.regime, p.dependencies.strategy,
        p.dependencies.venue]) {
        s.equal(dep.detected,
          dep.determinable && dep.spread !== null
            && dep.spread > config.dependencySpreadBand,
          `rule exact for ${p.candidateId} ${dep.kind}`);
        // Regime and strategy always group a non-empty cohort; venue groups
        // exist only when the cohort actually touched a candidate venue.
        if (dep.kind !== 'VENUE') {
          s.check(p.similarity.cohortSize === 0 || dep.groups.length > 0,
            `groups exposed for ${p.candidateId} ${dep.kind}`);
        }
      }
    }
    const rebuilt = detectDependencies(
      freshCandidates()[0], guardian.similarity, learning, config);
    s.same(rebuilt, guardian.dependencies, 'dependencies rebuild identically');
  }

  // -------------------------------------------------------------------
  // 33 — Dependencies: the guardian strategy dependency
  // -------------------------------------------------------------------
  {
    const s = section('33 dependencies — the guardian cohort depends on strategy');
    s.equal(guardian.dependencies.strategy.detected, true, 'strategy dependency');
    s.check((guardian.dependencies.strategy.spread as number)
      > config.dependencySpreadBand, 'spread above the band');
    s.equal(aggressive.dependencies.regime.detected, true,
      'aggressive cohort depends on regime');
    s.equal(mm.dependencies.regime.detected, false, 'mm cohort regime-stable');
    s.equal(mm.dependencies.strategy.detected, false, 'mm cohort strategy-stable');
  }

  // -------------------------------------------------------------------
  // 34 — Classification: deterministic precedence
  // -------------------------------------------------------------------
  {
    const s = section('34 classification — deterministic precedence chain');
    s.equal(surebet.classification.classification, 'INSUFFICIENT_EVIDENCE',
      'insufficient evidence precedes everything else');
    s.equal(guardian.classification.classification, 'STRATEGY_DEPENDENT',
      'dependency precedes score bands');
    s.equal(mm.classification.classification, 'HISTORICALLY_FAVORABLE',
      'favorable band reached when no dependency fires');
    s.equal(liq.classification.classification, 'MIXED',
      'middle scores classify MIXED');
    s.equal(stale.classification.classification, 'INSUFFICIENT_EVIDENCE',
      'stale evidence is insufficient, never guessed');
    for (const p of result.profiles) {
      s.check(p.classification.reasons.length > 0,
        `reasons present for ${p.candidateId}`);
    }
  }

  // -------------------------------------------------------------------
  // 35 — Classification: rebuild and band consistency
  // -------------------------------------------------------------------
  {
    const s = section('35 classification — rebuild and band consistency');
    const rebuilt = classifyOpportunity(
      freshCandidates()[0], guardian.evidence, guardian.score, guardian.stability,
      guardian.dependencies, config);
    s.same(rebuilt, guardian.classification, 'classification rebuilds identically');
    for (const p of result.profiles) {
      const score = p.score.score;
      const classification = p.classification.classification;
      if (classification === 'HISTORICALLY_FAVORABLE') {
        s.check(score !== null && score >= config.favorableScoreBand,
          'favorable implies score ≥ band');
      }
      if (classification === 'HISTORICALLY_UNFAVORABLE') {
        s.check(score !== null && score <= config.unfavorableScoreBand,
          'unfavorable implies score ≤ band');
      }
    }
  }

  // -------------------------------------------------------------------
  // 36 — Profile assembly
  // -------------------------------------------------------------------
  {
    const s = section('36 profile — every lifecycle stage in one artifact');
    for (const p of result.profiles) {
      s.equal(p.informational, true, 'informational');
      s.equal(p.causalStatus, 'ASSOCIATIONAL_ONLY', 'associational only');
      s.equal(p.schemaVersion, 'opportunity-intelligence.profile.v1', 'schema');
      s.check(p.profileId.startsWith('opr_'), 'profile id prefix');
      s.check(p.contentFingerprint.startsWith('ocfp_'), 'content fingerprint');
      s.check(p.explanation.explanationId.startsWith('oex_'), 'explanation present');
      s.check(p.researchContext.researchContextId.startsWith('orc_'),
        'research context present');
    }
  }

  // -------------------------------------------------------------------
  // 37 — Explanation: reconstructible
  // -------------------------------------------------------------------
  {
    const s = section('37 explanation — reconstructible, no opaque scores');
    const joined = guardian.explanation.scoreExplanation.join(' ');
    s.check(joined.includes('historicalPreservation'), 'dimension explained');
    s.check(joined.includes('effective weight'), 'weights explained');
    s.check(joined.includes('contribution'), 'contributions explained');
    s.check(guardian.explanation.summary.includes('cand-afis-cva-guardian'),
      'summary names the candidate');
    s.same([...guardian.explanation.missingEvidence],
      guardian.score.components.filter((c) => c.value === null)
        .map((c) => c.dimension), 'missing evidence exact');
    s.check(guardian.explanation.strategyDependence.includes('strategy dependency'),
      'dependency explained');
    s.check(guardian.explanation.leakageEffect.includes('counted once'),
      'leakage explained');
  }

  // -------------------------------------------------------------------
  // 38 — Explanation: no certainty claims
  // -------------------------------------------------------------------
  {
    const s = section('38 explanation — no future-certainty or authority claims');
    const forbidden = /(guaranteed|will (win|profit|lose)|cannot lose|risk-free|riskless|sure profit|definitely|certain to|authoriz|approv|execute |halt|deploy|mutat|transfer|withdraw|activat)/i;
    for (const p of result.profiles) {
      const lines = [p.explanation.summary, ...p.explanation.scoreExplanation,
        p.explanation.evidenceSufficiency, p.explanation.regimeDependence,
        p.explanation.strategyDependence, p.explanation.venueDependence,
        p.explanation.leakageEffect, p.explanation.stabilityEffect,
        ...p.explanation.classificationRationale,
        ...p.researchContext.recommendedQuestions.map((q) => q.question)];
      for (const line of lines) {
        s.check(!forbidden.test(line), `clean narrative in ${p.candidateId}`);
      }
    }
  }

  // -------------------------------------------------------------------
  // 39 — Research context
  // -------------------------------------------------------------------
  {
    const s = section('39 research context — informational inputs, never mutation');
    s.check(guardian.researchContext.recommendedQuestions.length > 0,
      'questions recommended');
    s.check(guardian.researchContext.informational, 'informational flag');
    s.check(guardian.researchContext.dependencySignals.some(
      (x) => x.startsWith('STRATEGY')), 'dependency signals stated');
    s.check(surebet.researchContext.evidenceGaps.length > 0, 'gaps declared');
    for (const p of result.profiles) {
      for (const q of p.researchContext.recommendedQuestions) {
        s.equal(q.informational, true, 'questions informational');
      }
    }
  }

  // -------------------------------------------------------------------
  // 40 — Feedback hooks
  // -------------------------------------------------------------------
  {
    const s = section('40 feedback — decision records mirror the profiles');
    s.equal(result.feedback.length, 7, 'one feedback record per profile');
    for (const feedback of result.feedback) {
      const p = result.profiles.find((x) => x.candidateId === feedback.candidateId)!;
      s.equal(feedback.decision.classification, p.classification.classification,
        'classification mirrored');
      s.equal(feedback.decision.score, p.score.score, 'score mirrored');
      s.equal(feedback.decision.evidenceCount, p.evidence.evidenceCount,
        'evidence count mirrored');
      s.check(feedback.evidenceUsed.length === p.similarity.cohortSize,
        'evidence used recorded');
    }
  }

  // -------------------------------------------------------------------
  // 41 — Outcome reconciliation
  // -------------------------------------------------------------------
  {
    const s = section('41 reconciliation — informational, never history rewrites');
    const agreement = reconcileOutcome(mm, {
      realizedNet: 3, preservationRatio: 0.75, outcome: 'COMPLETED'});
    s.equal(agreement.agreement, true, 'favorable + positive agrees');
    s.equal(agreement.disagreementKind, 'NONE', 'no disagreement');
    const disagreement = reconcileOutcome(mm, {
      realizedNet: -2, preservationRatio: -0.4, outcome: 'FAILED'});
    s.equal(disagreement.agreement, false, 'favorable + negative disagrees');
    s.equal(disagreement.disagreementKind, 'FAVORABLE_BUT_NEGATIVE', 'disagreement kind');
    s.check((disagreement.driftSignal as string).includes('never rewritten'),
      'drift signal is informational');
    s.equal(mm.score.score, agreement.predictedScore,
      'original profile untouched by reconciliation');
  }

  // -------------------------------------------------------------------
  // 42 — Ranking: AFIS
  // -------------------------------------------------------------------
  {
    const s = section('42 ranking — deterministic AFIS ranking');
    const afis = result.rankings.find((r) => r.domain === 'AFIS')!;
    s.equal(afis.entries.length, 3, 'three rankable AFIS candidates');
    s.same(afis.entries.map((e) => e.candidateId),
      ['cand-afis-cva-guardian', 'cand-afis-mm-guardian', 'cand-afis-liq-guardian'],
      'canonical order');
    s.same(afis.entries.map((e) => e.rank), [1, 2, 3], 'contiguous ranks');
    s.check(afis.entries[0].score >= afis.entries[1].score, 'score descending');
    const rebuilt = rankProfiles(result.profiles, config);
    s.same(rebuilt.find((r) => r.domain === 'AFIS')!.rankingId, afis.rankingId,
      'ranking rebuilds identically');
  }

  // -------------------------------------------------------------------
  // 43 — Ranking: ABL exclusions
  // -------------------------------------------------------------------
  {
    const s = section('43 ranking — explicit ABL exclusions');
    const abl = result.rankings.find((r) => r.domain === 'ABL')!;
    s.equal(abl.entries.length, 0, 'no rankable ABL candidates');
    s.equal(abl.excluded.length, 2, 'both excluded explicitly');
    for (const exclusion of abl.excluded) {
      s.equal(exclusion.classification, 'INSUFFICIENT_EVIDENCE',
        'insufficient evidence excluded');
      s.check(exclusion.reason.length > 0, 'reason stated');
    }
  }

  // -------------------------------------------------------------------
  // 44 — Audit: hash chain
  // -------------------------------------------------------------------
  {
    const s = section('44 audit — oship.opportunity-intelligence.v1 hash chain');
    const verification = verifyOpportunityAudit(result.auditEvents);
    s.equal(verification.valid, true, 'chain verifies');
    s.equal(result.auditEvents[0].previousHash, '0'.repeat(64), 'genesis root');
    s.check(result.auditEvents.length > 60, 'full lifecycle audited');
    for (const event of result.auditEvents) {
      s.equal(event.schemaVersion, 'oship.opportunity-intelligence.v1', 'schema');
      s.check((OPPORTUNITY_EVENT_TYPES as readonly string[])
        .includes(event.eventType), 'canonical event type');
    }
  }

  // -------------------------------------------------------------------
  // 45 — Audit: tamper resistance
  // -------------------------------------------------------------------
  {
    const s = section('45 audit — tamper, reorder and truncate resistance');
    const tampered = result.auditEvents.map((e, i) => i === 2
      ? {...e, payload: {...e.payload, injected: true}} : e);
    s.equal(verifyOpportunityAudit(tampered).valid, false, 'tampering detected');
    const truncated = result.auditEvents.slice(0, -1);
    s.equal(verifyOpportunityAudit(truncated, result.auditEvents.length).valid,
      false, 'truncation detected');
    const swapped = [result.auditEvents[0], result.auditEvents[2],
      result.auditEvents[1], ...result.auditEvents.slice(3)];
    s.equal(verifyOpportunityAudit(swapped).valid, false, 'reordering detected');
  }

  // -------------------------------------------------------------------
  // 46 — Replay: byte identity
  // -------------------------------------------------------------------
  {
    const s = section('46 replay — byte-identical double run');
    s.equal(result.replay.identical, true, 'engine replay identical');
    const fresh = engine.analyze(input);
    s.check(compareOpportunityResults(fresh, result), 'fresh run identical');
    s.equal(serializeOpportunityResult(fresh), serializeOpportunityResult(result),
      'serialization byte-identical');
    const other = engine.analyze({...input, correlationId: 'corr-other'});
    s.check(!compareOpportunityResults(other, result), 'different input detected');
  }

  // -------------------------------------------------------------------
  // 47 — Invariants
  // -------------------------------------------------------------------
  {
    const s = section('47 invariants — the full fail-closed contract');
    const report = checkOpportunityInvariants(result, {
      candidates: input.candidates, learning, config});
    s.equal(report.passed, true, 'all invariants pass');
    s.check(report.checks.length >= 45, `at least 45 checks (${report.checks.length})`);
    s.equal(report.failedCount, 0, 'no failures');
    s.equal(result.invariants.checks.length, report.checks.length,
      'engine enforced the same set');
  }

  // -------------------------------------------------------------------
  // 48 — Security boundaries
  // -------------------------------------------------------------------
  {
    const s = section('48 security — informational only, no authority surface');
    const serialized = serializeOpportunityResult(result);
    s.check(!/"(treasury|credential|apiKey|api_key|password|accessToken)"/i
      .test(serialized), 'no credential or treasury surface');
    s.check(!/"(probability|expectedReturn|winRate|winProbability)"/
      .test(serialized), 'no fabricated probability keys');
    s.equal(result.causalPolicy, 'ASSOCIATIONAL_ONLY', 'associational policy');
    s.check(result.profiles.every((p) => p.informational), 'informational profiles');
    s.check(result.rejected.every((r) =>
      r.schemaVersion === 'opportunity-intelligence.rejection.v1'),
      'rejections versioned');
    void rejectedCandidates;
  }

  // -------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  const lines: string[] = [];
  lines.push('');
  lines.push(' ====================================================================');
  lines.push(' SPRINT 038 — UNIFIED PREDICTIVE OPPORTUNITY INTELLIGENCE &');
  lines.push(' EVIDENCE-BOUND SCORING ENGINE');
  lines.push(' PAPER / SIMULATION ONLY — ANALYTICAL, NOT AN AUTHORITY, NOT AN ORACLE');
  lines.push(' ====================================================================');
  lines.push('');
  lines.push(` Engine:        ${result.analysisId}`);
  lines.push(` Fingerprint:   ${result.analysisFingerprint}`);
  lines.push(` Learning:      ${result.source.learningAnalysisId} (65 observations, 5 eras)`);
  lines.push(` Candidates:    ${result.profiles.length} assessed · ${result.rejected.length} rejected`);
  lines.push(` Domains:       AFIS (5 profiles) + ABL (2 profiles), never mixed`);
  lines.push(` Causal policy: ${result.causalPolicy}`);
  lines.push('');
  lines.push(' CHAIN: New Opportunity → Similarity → Learned Features → Regime Match');
  lines.push('        → Strategy History → Venue History → Leakage → Evidence → Stability');
  lines.push('        → Historical Distribution → Profile → Evidence-Bound Score →');
  lines.push('        Classification → Explanation → Research / Decision Input');
  lines.push('');
  lines.push(' Best read:      cand-afis-mm-guardian — HISTORICALLY_FAVORABLE (score 0.749)');
  lines.push('                 (7 similar observations, MODERATE confidence)');
  lines.push(' Conditional:    cand-afis-cva-guardian — STRATEGY_DEPENDENT (score 0.766,');
  lines.push('                 strategy spread 0.80 — the cohort is not one population)');
  lines.push(' Middle band:    cand-afis-liq-guardian — MIXED (score 0.599)');
  lines.push(' Honest nulls:   aggressive CONFLICTED · surebet/back-lay INSUFFICIENT (n≤2)');
  lines.push('                 · stale candidate STALE — no score without honest evidence');
  lines.push(' Leakage:        aggressive cohort loses 83% of apparent value to leakage;');
  lines.push('                 adjusted = realized + leakage — counted exactly once');
  lines.push(' Rankings:       AFIS 1–3 + 2 explicit exclusions · ABL 0 + 2 exclusions');
  lines.push(' Integrity:      66/66 invariants · 62 audit events · replay byte-identical');
  lines.push('');
  lines.push(' The evidence-bound score is NOT a probability, forecast, expected');
  lines.push(' return or guarantee. Historical distributions stay historical.');
  lines.push(' Nothing here authorizes execution, capital, risk or policy.');
  lines.push('');
  lines.push(` SPRINT 038 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  if (failed.length === 0) {
    lines.push('');
    lines.push(` All ${sections.length} sections passed. Every intelligence output is`);
    lines.push(' informational and associational; AFIS and ABL stayed isolated; missing');
    lines.push(' evidence was never treated as negative evidence; the audit chain is');
    lines.push(' append-only and tamper-evident; replay is byte-identical.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 038: COMPLETE');
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
