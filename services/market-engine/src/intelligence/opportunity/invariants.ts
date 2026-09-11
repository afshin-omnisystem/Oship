/**
 * SPRINT 038 — invariants (§21).
 *
 * Hard fail-closed checks over every opportunity-intelligence analysis.
 * Pure stage artifacts (similarity, leakage, evidence, distribution, score,
 * classification) are REBUILT from the profile's own inputs and compared
 * byte-for-byte; composite structures are verified against their contracts.
 * The report carries ≥45 named checks; the engine throws when any fails.
 */

import type {
  OpportunityIntelligenceResult, OpportunityIntelligenceProfile,
  OpportunityIntelligenceConfigSpec, LearningResult, ScoreDimension,
  OpportunityCandidate, OpportunityInvariantCheck, OpportunityInvariantReport,
  ScoreComponent,
} from './types';
import {SCORE_DISCLAIMER, DISTRIBUTION_DISCLAIMER, OPPORTUNITY_EVENT_TYPES} from './types';
import {canonicalJson} from './ids';
import {assessSimilarity} from './similarity';
import {buildFeatureProfile} from './feature-profile';
import {buildRegimeMatch} from './regime-match';
import {assessStrategyHistory} from './strategy-match';
import {assessVenueHistory} from './venue-match';
import {assessStability} from './stability';
import {assessLeakageRisk} from './leakage-risk';
import {assessEvidence} from './evidence';
import {buildOutcomeDistribution} from './outcome-distribution';
import {computeEvidenceBoundScore, NULL_SCORE_CONFIDENCE} from './score';
import {classifyOpportunity, detectDependencies} from './classification';
import {rankProfiles} from './ranking';
import {verifyOpportunityAudit} from './audit';
import {classValidForDomain} from './candidate';

export interface OpportunityInvariantContext {
  readonly candidates: readonly unknown[];
  readonly learning: LearningResult;
  readonly config: OpportunityIntelligenceConfigSpec;
}

export class OpportunityInvariantError extends Error {
  constructor(report: OpportunityInvariantReport) {
    const failed = report.checks.filter((c) => !c.passed)
      .map((c) => `${c.invariant}: ${c.detail}`).join('; ');
    super(`opportunity-intelligence invariants failed — fail closed: ${failed}`);
    this.name = 'OpportunityInvariantError';
  }
}

const AUTHORITY_VERBS = /(authoriz|approv|execute |halt|deploy|mutat|transfer|withdraw|activat)/i;
const FABRICATED_KEYS = /"(probability|expectedReturn|expected_return|expectedValue|winRate|pWin|winProbability|probabilityOfSuccess|successOdds)"/;
const CERTAINTY_CLAIMS = /(guaranteed|will (win|profit|lose)|cannot lose|risk-free|riskless|sure profit|definitely|certain to)/i;

const CONFIDENCE_STATES = new Set(['STRONG', 'MODERATE', 'WEAK', 'SUFFICIENT',
  'LIMITED', 'INSUFFICIENT', 'CONFLICTED', 'STALE', 'NOT_COMPARABLE', 'UNKNOWN']);
const CLASSIFICATIONS = new Set(['HISTORICALLY_FAVORABLE', 'HISTORICALLY_UNFAVORABLE',
  'INSUFFICIENT_EVIDENCE', 'REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT',
  'MIXED', 'UNKNOWN', 'NOT_COMPARABLE']);
const STABILITY_INTERPRETATIONS = new Set(['STABLE', 'UNSTABLE', 'IMPROVING',
  'DETERIORATING', 'REGIME_SENSITIVE', 'INSUFFICIENT_HISTORY']);
const REJECTION_CODES = new Set(['MISSING_IDENTITY', 'UNKNOWN_DOMAIN', 'UNKNOWN_CLASS',
  'CLASS_DOMAIN_MISMATCH', 'MISSING_STRATEGY', 'INVALID_STRATEGY_REFERENCE',
  'INVALID_VENUE_REFERENCE', 'INVALID_NUMERICAL_VALUE', 'AMBIGUOUS_SEMANTIC_MAPPING',
  'MALFORMED_CANDIDATE', 'MISSING_ABL_IDENTITY', 'INVALID_ODDS', 'NON_CANONICAL_ORDER']);

function check(invariant: string, passed: boolean, detail: string): OpportunityInvariantCheck {
  return {invariant, passed, detail};
}

function narrativeOf(profile: OpportunityIntelligenceProfile): string[] {
  return [
    profile.explanation.summary,
    ...profile.explanation.scoreExplanation,
    profile.explanation.evidenceSufficiency,
    profile.explanation.regimeDependence,
    profile.explanation.strategyDependence,
    profile.explanation.venueDependence,
    profile.explanation.leakageEffect,
    profile.explanation.stabilityEffect,
    ...profile.explanation.classificationRationale,
    ...profile.researchContext.recommendedQuestions.map((q) => q.question + q.rationale),
    ...profile.researchContext.evidenceGaps,
  ];
}

function candidateOf(
  context: OpportunityInvariantContext, profile: OpportunityIntelligenceProfile,
): OpportunityCandidate | undefined {
  return (context.candidates as OpportunityCandidate[])
    .find((c) => c && typeof c === 'object'
      && (c as OpportunityCandidate).candidateId === profile.candidateId);
}

export function checkOpportunityInvariants(
  result: OpportunityIntelligenceResult,
  context: OpportunityInvariantContext,
): OpportunityInvariantReport {
  const {config, learning} = context;
  const checks: OpportunityInvariantCheck[] = [];
  const profileById = new Map(result.profiles.map((p) => [p.candidateId, p]));

  // ------------------------------------------------------------------
  // Determinism (replay, canonical serialization, rebuilds)
  // ------------------------------------------------------------------
  checks.push(check('REPLAY_BYTE_IDENTITY', result.replay.identical === true,
    `internal replay identical with fingerprint ${result.replay.fingerprint}`));
  checks.push(check('REPLAY_FINGERPRINT_CONSISTENT',
    result.replay.fingerprint === result.analysisFingerprint,
    'replay fingerprint equals the analysis fingerprint'));
  const serialized = canonicalJson(result);
  checks.push(check('CANONICAL_SERIALIZATION_STABLE',
    canonicalJson(JSON.parse(serialized)) === serialized,
    `result canonicalizes stably (${serialized.length} bytes)`));
  checks.push(check('ANALYSIS_FINGERPRINT_DERIVED',
    typeof result.analysisFingerprint === 'string'
      && result.analysisFingerprint.startsWith('ofp2_'),
    'analysis fingerprint is content-derived'));

  // Deterministic rebuilds of every pure stage artifact.
  let rebuildOk = true;
  let rebuildDetail = 'all stage artifacts rebuilt identically';
  for (const profile of result.profiles) {
    const candidate = candidateOf(context, profile);
    if (!candidate) {
      rebuildOk = false;
      rebuildDetail = `candidate ${profile.candidateId} missing from context`;
      break;
    }
    const similarity = assessSimilarity(candidate, learning, config);
    const featureProfile = buildFeatureProfile(candidate, learning, config);
    const regimeMatch = buildRegimeMatch(candidate, learning, config);
    const strategyHistory = assessStrategyHistory(candidate, learning, config);
    const venueHistory = assessVenueHistory(candidate, learning, config);
    const stability = assessStability(candidate, learning, config);
    const leakage = assessLeakageRisk(candidate, similarity, learning, config);
    const evidence = assessEvidence(
      candidate, similarity, learning, leakage, strategyHistory, config);
    const distribution = buildOutcomeDistribution(
      candidate, similarity, learning, config);
    const score = computeEvidenceBoundScore(
      candidate, similarity, leakage, evidence, stability, strategyHistory,
      venueHistory, regimeMatch, distribution, config);
    const dependencies = detectDependencies(candidate, similarity, learning, config);
    const classification = classifyOpportunity(
      candidate, evidence, score, stability, dependencies, config);
    if (canonicalJson(similarity) !== canonicalJson(profile.similarity)
      || canonicalJson(featureProfile) !== canonicalJson(profile.featureProfile)
      || canonicalJson(regimeMatch) !== canonicalJson(profile.regimeMatch)
      || canonicalJson(strategyHistory) !== canonicalJson(profile.strategyHistory)
      || canonicalJson(venueHistory) !== canonicalJson(profile.venueHistory)
      || canonicalJson(stability) !== canonicalJson(profile.stability)
      || canonicalJson(leakage) !== canonicalJson(profile.leakageRisk)
      || canonicalJson(evidence) !== canonicalJson(profile.evidence)
      || canonicalJson(distribution) !== canonicalJson(profile.outcomeDistribution)
      || canonicalJson(score) !== canonicalJson(profile.score)
      || canonicalJson(dependencies) !== canonicalJson(profile.dependencies)
      || canonicalJson(classification) !== canonicalJson(profile.classification)) {
      rebuildOk = false;
      rebuildDetail = `stage artifacts of ${profile.candidateId} did not rebuild identically`;
      break;
    }
  }
  checks.push(check('DETERMINISTIC_STAGE_REBUILD', rebuildOk, rebuildDetail));
  const rebuiltRankings = rankProfiles(result.profiles, config);
  checks.push(check('DETERMINISTIC_RANKING_REBUILD',
    canonicalJson(rebuiltRankings) === canonicalJson(result.rankings),
    `${result.rankings.length} domain rankings rebuilt identically`));

  // ------------------------------------------------------------------
  // Identity
  // ------------------------------------------------------------------
  checks.push(check('UNIQUE_PROFILE_IDS',
    new Set(result.profiles.map((p) => p.profileId)).size === result.profiles.length,
    `${result.profiles.length} distinct profile ids`));
  const acceptedIds = result.profiles.map((p) => p.candidateId);
  const rejectedIds = result.rejected.map((r) => r.candidateId);
  checks.push(check('ACCEPTED_REJECTED_DISJOINT',
    acceptedIds.every((id) => !rejectedIds.includes(id)),
    `${rejectedIds.length} rejections disjoint from ${acceptedIds.length} profiles`));
  checks.push(check('CONTENT_DERIVED_ARTIFACT_IDS',
    result.profiles.every((p) => [
      [p.profileId, 'opr_'], [p.similarity.similarityId, 'osm_'],
      [p.featureProfile.featureProfileId, 'ofp_'],
      [p.regimeMatch.regimeMatchId, 'orm_'],
      [p.strategyHistory.strategyHistoryId, 'ost_'],
      [p.leakageRisk.leakageRiskId, 'olk_'], [p.evidence.evidenceId, 'oev_'],
      [p.stability.stabilityIntegrationId, 'osi_'],
      [p.outcomeDistribution.distributionId, 'odb_'],
      [p.score.scoreId, 'osc_'], [p.dependencies.dependenciesId, 'odp_'],
      [p.classification.classificationId, 'ocl_'],
      [p.explanation.explanationId, 'oex_'],
      [p.researchContext.researchContextId, 'orc_'],
      ...p.venueHistory.map((v) => [v.venueHistoryId, 'ovh_'] as const),
    ].every(([id, prefix]) => typeof id === 'string' && id.startsWith(prefix))),
    'every artifact id carries its content-derived prefix'));
  checks.push(check('LINEAGE_COMPLETE',
    result.lineage.valid === true
      && result.lineage.profileIds.length === result.profiles.length
      && result.lineage.learningAnalysisId === learning.analysisId
      && result.lineage.observationIds.every((id) =>
        learning.observations.some((o) => o.observationId === id)),
    `lineage spans ${result.lineage.profileIds.length} profiles and `
      + `${result.lineage.observationIds.length} observations`));

  // ------------------------------------------------------------------
  // Domain isolation and AFIS/ABL separation
  // ------------------------------------------------------------------
  checks.push(check('SIMILARITY_DOMAIN_ISOLATION',
    result.profiles.every((p) => p.similarity.matches.every(
      (m) => m.domain === p.domain)),
    'every similar observation shares the profile domain'));
  checks.push(check('CLASS_DOMAIN_SEPARATION',
    result.profiles.every((p) => classValidForDomain(p.domain, p.opportunityClass)),
    'every profile class belongs to its domain vocabulary'));
  checks.push(check('NO_CROSS_DOMAIN_RANKING',
    new Set(result.rankings.map((r) => r.domain)).size === result.rankings.length
      && result.rankings.every((r) => r.entries.every((e) =>
        profileById.get(e.candidateId)?.domain === r.domain)),
    'rankings are per-domain and never mix domains'));
  checks.push(check('STRATEGY_HISTORY_DOMAIN_SCOPED',
    result.profiles.every((p) => p.strategyHistory.domain === null
      || p.strategyHistory.domain === p.domain),
    'strategy history is domain-scoped or absent'));
  checks.push(check('CROSS_DOMAIN_NOT_COMPARABLE',
    result.profiles.every((p) => p.evidence.comparability !== 'NOT_COMPARABLE'
      || p.score.score === null),
    'NOT_COMPARABLE evidence never yields a numeric score'));

  // ------------------------------------------------------------------
  // AFIS semantics
  // ------------------------------------------------------------------
  const afisCandidates = (context.candidates as OpportunityCandidate[]).filter(
    (c) => c && typeof c === 'object' && profileById.has(c.candidateId)
      && profileById.get(c.candidateId)?.domain === 'AFIS');
  checks.push(check('AFIS_SIDE_SEMANTICS',
    afisCandidates.every((c) => c.venueLegs.every(
      (leg) => leg.side === 'BUY' || leg.side === 'SELL')),
    `${afisCandidates.length} AFIS candidates carry BUY/SELL legs only`));
  checks.push(check('AFIS_NO_ODDS_NO_BETTING_IDENTITY',
    afisCandidates.every((c) => c.venueLegs.every((leg) => leg.odds === null)
      && c.marketId === null && c.selectionId === null)
      && result.profiles.every((p) => p.domain !== 'AFIS'
        || (p.marketId === null && p.selectionId === null)),
    'AFIS candidates carry no odds and no bookmaker identity'));

  // ------------------------------------------------------------------
  // ABL semantics
  // ------------------------------------------------------------------
  const ablCandidates = (context.candidates as OpportunityCandidate[]).filter(
    (c) => c && typeof c === 'object' && profileById.has(c.candidateId)
      && profileById.get(c.candidateId)?.domain === 'ABL');
  checks.push(check('ABL_SIDE_SEMANTICS',
    ablCandidates.every((c) => c.venueLegs.every(
      (leg) => leg.side === 'BACK' || leg.side === 'LAY')),
    `${ablCandidates.length} ABL candidates carry BACK/LAY legs only`));
  checks.push(check('ABL_ODDS_SEMANTICS',
    ablCandidates.every((c) => c.venueLegs.every(
      (leg) => leg.odds === null || leg.odds > 1)),
    'ABL odds are decimal and strictly greater than 1'));
  checks.push(check('ABL_IDENTITY_PRESERVED',
    ablCandidates.every((c) => typeof c.marketId === 'string' && c.marketId.length > 0
      && typeof c.selectionId === 'string' && c.selectionId.length > 0)
      && result.profiles.every((p) => p.domain !== 'ABL'
        || (typeof p.marketId === 'string' && typeof p.selectionId === 'string')),
    'ABL market/selection identity preserved verbatim'));

  // ------------------------------------------------------------------
  // Evidence
  // ------------------------------------------------------------------
  checks.push(check('MISSING_EVIDENCE_NEVER_NEGATIVE',
    result.profiles.every((p) => p.evidence.evidenceCount >= config.minSimilarObservations
      || (p.evidence.confidenceState === 'INSUFFICIENT'
        && p.score.score === null
        && p.classification.classification !== 'HISTORICALLY_UNFAVORABLE')),
    'absence of evidence blocks scoring, never scores negative'));
  checks.push(check('EVIDENCE_STATES_CANONICAL',
    result.profiles.every((p) => CONFIDENCE_STATES.has(p.evidence.confidenceState)
      && ['SUFFICIENT', 'LIMITED', 'INSUFFICIENT'].includes(p.evidence.sampleAdequacy)
      && ['FRESH', 'STALE'].includes(p.evidence.freshness)
      && ['CONSISTENT', 'INCONSISTENT'].includes(p.evidence.consistency)),
    'evidence metadata uses canonical states'));
  checks.push(check('EVIDENCE_COUNT_CONSISTENT',
    result.profiles.every((p) => p.evidence.evidenceCount === p.similarity.cohortSize
      && p.similarity.cohortSize <= config.similarityTopK
      && p.similarity.matches.every((m) => m.score >= config.similarityFloor)),
    'evidence counts match the similarity cohort'));
  checks.push(check('EVIDENCE_SOURCE_DECLARED',
    result.profiles.every((p) => typeof p.evidence.source === 'string'
      && p.evidence.source.length > 0),
    'every evidence profile declares its source'));
  checks.push(check('EVIDENCE_DISCLAIMERS_ATTACHED',
    result.profiles.every((p) => p.score.disclaimer === SCORE_DISCLAIMER
      && p.outcomeDistribution.disclaimer === DISTRIBUTION_DISCLAIMER),
    'score and distribution disclaimers travel with every profile'));

  // ------------------------------------------------------------------
  // Score
  // ------------------------------------------------------------------
  checks.push(check('SCORE_BOUNDS',
    result.profiles.every((p) => p.score.score === null
      || (p.score.score >= 0 && p.score.score <= 1)),
    'scores are null or within [0,1]'));
  checks.push(check('SCORE_DECOMPOSITION_EXACT',
    result.profiles.every((p) => {
      if (p.score.score === null) return true;
      const sum = p.score.components.reduce(
        (s, c) => s + (c.contribution ?? 0), 0);
      return Math.abs(sum - p.score.score) < 1e-9;
    }),
    'score equals the sum of its contributions'));
  checks.push(check('SCORE_WEIGHT_NORMALIZATION',
    result.profiles.every((p) => {
      if (p.score.score === null) return true;
      const total = p.score.components.reduce(
        (s, c) => s + c.effectiveWeight, 0);
      return Math.abs(total - 1) < 1e-9
        && p.score.components.every((c) => c.contribution === null
          || c.effectiveWeight > 0);
    }),
    'effective weights renormalize to 1 over contributing dimensions'));
  checks.push(check('NULL_SCORE_ON_DISHONEST_CONFIDENCE',
    result.profiles.every((p) => !NULL_SCORE_CONFIDENCE.has(p.evidence.confidenceState)
      || p.score.score === null),
    'INSUFFICIENT/NOT_COMPARABLE/CONFLICTED/STALE evidence yields null scores'));
  checks.push(check('NO_MAGIC_WEIGHTS',
    result.profiles.every((p) => p.score.components.length === 11
      && p.score.components.every((c) =>
        c.configuredWeight === Math.max(0, config.scoreWeights[c.dimension]))),
    'all eleven configured weights are recorded per component'));
  checks.push(check('SCORE_COMPONENT_COMPLETENESS',
    result.profiles.every((p) => {
      const available = p.score.components.filter((c) => c.value !== null).length;
      return (p.score.score === null
        ? p.score.contributingDimensions === 0
        : p.score.contributingDimensions === available)
        && p.score.components.every((c) =>
          (c.contribution !== null) === (p.score.score !== null && c.value !== null));
    }),
    'contributing dimension count matches non-null components'));

  // ------------------------------------------------------------------
  // Classification
  // ------------------------------------------------------------------
  checks.push(check('CLASSIFICATION_VOCABULARY',
    result.profiles.every((p) => CLASSIFICATIONS.has(p.classification.classification)),
    'classifications use the canonical vocabulary'));
  checks.push(check('CLASSIFICATION_BAND_CONSISTENCY',
    result.profiles.every((p) => {
      const s = p.score.score;
      const c = p.classification.classification;
      if (c === 'HISTORICALLY_FAVORABLE') return s !== null && s >= config.favorableScoreBand;
      if (c === 'HISTORICALLY_UNFAVORABLE') return s !== null && s <= config.unfavorableScoreBand;
      if (c === 'NOT_COMPARABLE' || c === 'INSUFFICIENT_EVIDENCE') return s === null;
      return true;
    }),
    'classification agrees with score bands'));
  checks.push(check('CLASSIFICATION_REASONED',
    result.profiles.every((p) => p.classification.reasons.length > 0
      && p.classification.reasons[0].includes(p.evidence.confidenceState)),
    'every classification carries reconstructible reasons'));
  checks.push(check('DEPENDENCY_DETECTION_RULE',
    result.profiles.every((p) => [p.dependencies.regime, p.dependencies.strategy,
      p.dependencies.venue].every((d) => (!d.determinable || d.groups.length >= 2)
        && (d.detected === (d.determinable && d.spread !== null
          && d.spread > config.dependencySpreadBand)))),
    'dependency detection follows the spread rule exactly'));
  checks.push(check('DEPENDENCY_AFFECTS_CLASSIFICATION',
    result.profiles.every((p) => {
      const c = p.classification.classification;
      // Insufficient / unknown / non-comparable evidence takes precedence
      // over dependencies (no score exists to condition).
      const blocked = p.score.score === null;
      if (p.dependencies.regime.detected) {
        return c === 'REGIME_DEPENDENT' || blocked;
      }
      if (p.dependencies.strategy.detected) {
        return c === 'STRATEGY_DEPENDENT' || blocked;
      }
      if (p.dependencies.venue.detected) {
        return c === 'VENUE_DEPENDENT' || blocked;
      }
      return !['REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT'].includes(c);
    }),
    'detected dependencies surface in the classification'));

  // ------------------------------------------------------------------
  // Leakage (§10) — counted exactly once
  // ------------------------------------------------------------------
  checks.push(check('LEAKAGE_COUNTED_ONCE',
    result.profiles.every((p) => {
      const {realizedQuality, leakageBurden, leakageAdjustedQuality} = p.leakageRisk;
      if (realizedQuality === null || leakageBurden === null
        || leakageAdjustedQuality === null) return true;
      return Math.abs(leakageAdjustedQuality - (realizedQuality + leakageBurden)) < 1e-9;
    }),
    'leakage-adjusted quality = realized + leakage (no double count)'));
  checks.push(check('LEAKAGE_SHARE_BOUNDS',
    result.profiles.every((p) => p.leakageRisk.leakageShare === null
      || (p.leakageRisk.leakageShare >= 0
        && p.leakageRisk.leakageShare <= config.leakageShareCap)),
    'leakage share within [0, cap]'));
  checks.push(check('LEAKAGE_UNITS_EXPLICIT',
    result.profiles.every((p) => p.leakageRisk.recurringComponents.every(
      (c) => typeof c === 'string')),
    'recurring leakage components are explicit'));
  checks.push(check('LEAKAGE_NEVER_SUBTRACTED_TWICE',
    result.profiles.every((p) => {
      const {realizedQuality, leakageBurden, leakageAdjustedQuality} = p.leakageRisk;
      if (realizedQuality === null || leakageBurden === null
        || leakageAdjustedQuality === null || leakageBurden < 0) return true;
      return leakageAdjustedQuality >= realizedQuality - 1e-9;
    }),
    'leakage is added back, never subtracted twice'));

  // ------------------------------------------------------------------
  // Stability (§11)
  // ------------------------------------------------------------------
  checks.push(check('STABILITY_VOCABULARY',
    result.profiles.every((p) => STABILITY_INTERPRETATIONS.has(p.stability.interpretation)),
    'stability interpretations use the canonical vocabulary'));
  checks.push(check('STABILITY_FACTOR_BOUNDS',
    result.profiles.every((p) => p.stability.stabilityFactor === null
      || (p.stability.stabilityFactor >= 0 && p.stability.stabilityFactor <= 1)),
    'stability factors are null or within [0,1]'));
  checks.push(check('STABILITY_EXPLICIT_NOT_SILENT',
    result.profiles.every((p) => p.explanation.stabilityEffect.length > 0
      && p.explanation.stabilityEffect.includes(p.stability.interpretation)),
    'stability effects are explained, never silent'));

  // ------------------------------------------------------------------
  // Historical outcome distribution (§6) — descriptive only
  // ------------------------------------------------------------------
  checks.push(check('DISTRIBUTION_HISTORICAL_ONLY',
    result.profiles.every((p) => p.outcomeDistribution.historicalOnly === true),
    'distributions are explicitly historical'));
  checks.push(check('DISTRIBUTION_COUNTS_CONSISTENT',
    result.profiles.every((p) => {
      const d = p.outcomeDistribution;
      return d.positiveCount + d.negativeCount + d.neutralCount
        === d.measuredRealizedCount
        && d.measuredRealizedCount <= d.sampleSize
        && d.sampleSize === p.evidence.evidenceCount
        && (d.minPreservation === null || d.maxPreservation === null
          || d.minPreservation <= d.maxPreservation)
        && (d.quartile25 === null || d.medianPreservation === null
          || d.quartile25 <= d.medianPreservation + 1e-9)
        && (d.medianPreservation === null || d.quartile75 === null
          || d.medianPreservation <= d.quartile75 + 1e-9);
    }),
    'distribution counts, ranges and quartiles are ordered'));
  checks.push(check('DISTRIBUTION_NOT_PROBABILITY',
    !FABRICATED_KEYS.test(canonicalJson(result.profiles.map((p) => p.outcomeDistribution))),
    'no probability-like keys anywhere in distributions'));

  // ------------------------------------------------------------------
  // Ranking (§12)
  // ------------------------------------------------------------------
  checks.push(check('RANKING_DETERMINISTIC_ORDER',
    result.rankings.every((r) => r.entries.every((e, i) => e.rank === i + 1)
      && r.entries.every((e, i) => i === 0
        || r.entries[i - 1].score > e.score
        || (r.entries[i - 1].score === e.score
          && r.entries[i - 1].candidateId < e.candidateId))),
    'rankings ordered by score desc, candidateId asc, ranks contiguous'));
  checks.push(check('RANKING_EXCLUSIONS_EXPLICIT',
    result.rankings.every((r) => r.excluded.every((e) => e.reason.length > 0
      && CLASSIFICATIONS.has(e.classification))),
    'every excluded candidate carries an explicit reason'));
  checks.push(check('RANKING_NO_UNRANKABLE_ENTRIES',
    result.rankings.every((r) => r.entries.every((e) =>
      !['INSUFFICIENT_EVIDENCE', 'UNKNOWN', 'NOT_COMPARABLE']
        .includes(e.classification))),
    'unrankable classifications never enter rankings'));
  const rankedIds = new Set(result.rankings.flatMap((r) => [
    ...r.entries.map((e) => e.candidateId),
    ...r.excluded.map((e) => e.candidateId),
  ]));
  checks.push(check('RANKING_COVERS_ALL_PROFILES',
    result.profiles.every((p) => rankedIds.has(p.candidateId)),
    'every profile is either ranked or explicitly excluded'));

  // ------------------------------------------------------------------
  // Explanation (§13) — reconstructible, no opaque scores
  // ------------------------------------------------------------------
  checks.push(check('EXPLANATION_RECONSTRUCTIBLE',
    result.profiles.every((p) => {
      const missing = p.score.components.filter((c) => c.value === null)
        .map((c) => c.dimension);
      return canonicalJson(missing)
        === canonicalJson(p.explanation.missingEvidence)
        && p.explanation.scoreExplanation.length >= 2
        && p.explanation.classificationRationale.length > 0;
    }),
    'explanations expose missing dimensions and full rationale'));
  checks.push(check('EXPLANATION_NOT_OPAQUE',
    result.profiles.every((p) => p.explanation.summary.includes(p.candidateId)
      && p.explanation.summary.includes(p.classification.classification)),
    'summaries name the candidate and the classification'));
  const narratives = result.profiles.flatMap(narrativeOf);
  checks.push(check('NO_FUTURE_CERTAINTY_CLAIMS',
    narratives.every((line) => !CERTAINTY_CLAIMS.test(line)),
    `no certainty claims across ${narratives.length} narrative statements`));
  checks.push(check('NO_AUTHORITY_LANGUAGE',
    narratives.every((line) => !AUTHORITY_VERBS.test(line)),
    'no authority verbs in any narrative output'));

  // ------------------------------------------------------------------
  // Research context (§14) — informational, never auto-mutates
  // ------------------------------------------------------------------
  checks.push(check('RESEARCH_CONTEXT_INFORMATIONAL',
    result.profiles.every((p) => p.researchContext.informational === true
      && p.researchContext.recommendedQuestions.every((q) => q.informational === true)),
    'research contexts are informational'));
  checks.push(check('RESEARCH_GAPS_DECLARED',
    result.profiles.every((p) => Array.isArray(p.researchContext.evidenceGaps)
      && p.researchContext.dependencySignals.length > 0),
    'research contexts declare gaps and dependency signals'));

  // ------------------------------------------------------------------
  // Feedback (§15) — hooks, never history rewrites
  // ------------------------------------------------------------------
  checks.push(check('FEEDBACK_MATCHES_PROFILE',
    result.feedback.every((f) => {
      const p = profileById.get(f.candidateId);
      return p !== undefined && f.profileId === p.profileId
        && f.decision.classification === p.classification.classification
        && f.decision.score === p.score.score
        && f.decision.evidenceCount === p.evidence.evidenceCount;
    }),
    `${result.feedback.length} feedback records mirror their profiles`));
  checks.push(check('RECONCILIATION_NON_DESTRUCTIVE',
    result.reconciliations.every((r) => {
      const p = profileById.get(r.candidateId);
      return p !== undefined && r.profileId === p.profileId
        && r.informational === true
        && r.predictedClassification === p.classification.classification
        && r.predictedScore === p.score.score;
    }),
    `${result.reconciliations.length} reconciliations are informational only`));

  // ------------------------------------------------------------------
  // Audit (§17) — append-only hash chain
  // ------------------------------------------------------------------
  const auditVerification = verifyOpportunityAudit(result.auditEvents);
  checks.push(check('AUDIT_CHAIN_VERIFIED', auditVerification.valid,
    auditVerification.reason ?? `${auditVerification.events} events verified`));
  checks.push(check('AUDIT_APPEND_ONLY',
    result.auditEvents.every((e, i) => e.sequence === i)
      && result.auditEvents.every((e) =>
        e.schemaVersion === 'oship.opportunity-intelligence.v1'),
    'audit sequences are contiguous and schema-versioned'));
  checks.push(check('AUDIT_EVENT_TYPES_CANONICAL',
    result.auditEvents.every((e) =>
      (OPPORTUNITY_EVENT_TYPES as readonly string[]).includes(e.eventType)),
    'only the 13 canonical event types appear'));

  // ------------------------------------------------------------------
  // Fail-closed (§18)
  // ------------------------------------------------------------------
  checks.push(check('FAIL_CLOSED_REJECTIONS_CANONICAL',
    result.rejected.every((r) => REJECTION_CODES.has(r.code)
      && r.reason.length > 0
      && r.schemaVersion === 'opportunity-intelligence.rejection.v1'
      && !profileById.has(r.candidateId)),
    `${result.rejected.length} rejections carry codes and never produce profiles`));
  checks.push(check('FAIL_CLOSED_NO_SILENT_REPAIRS',
    result.profiles.every((p) => {
      const candidate = candidateOf(context, p);
      if (!candidate) return false;
      const same = candidate.domain === p.domain
        && candidate.opportunityClass === p.opportunityClass
        && candidate.strategyId === p.strategyId
        && candidate.receivedAt === p.receivedAt
        && candidate.venues.length === p.venues.length
        && candidate.venues.every((v, i) => v === p.venues[i]);
      return same;
    }),
    'accepted candidates are analyzed verbatim — never silently repaired'));

  // ------------------------------------------------------------------
  // Security boundaries (§19)
  // ------------------------------------------------------------------
  checks.push(check('INFORMATIONAL_ONLY',
    result.profiles.every((p) => p.informational === true)
      && result.causalPolicy === 'ASSOCIATIONAL_ONLY',
    'profiles are informational and associational-only'));
  checks.push(check('NO_EXECUTION_OR_TREASURY_AUTHORITY',
    !FABRICATED_KEYS.test(serialized)
      && !/"(treasury|credential|apiKey|api_key|password|accessToken|access_token)"/i.test(serialized),
    'no execution, treasury or credential surface in results'));
  checks.push(check('SOURCE_LINKED_TO_LEARNING',
    result.source.learningAnalysisId === learning.analysisId
      && result.source.learningFingerprint === learning.analysisFingerprint
      && result.source.observationCount === learning.observations.length,
    'results consume the validated learning result read-only'));

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}
