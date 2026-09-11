/**
 * SPRINT 039 — invariants (§29).
 *
 * Hard fail-closed checks over every decision-intelligence analysis:
 * deterministic identity, canonical serialization, domain isolation,
 * alternative compatibility, evidence integrity, score bounds, trade-off
 * decomposition, configuration integrity, dominance and recommendation
 * correctness, conflict preservation, dependency preservation, leakage
 * single-counting, stability semantics, ranking determinism, explanation
 * completeness, replay identity, audit integrity, fail-closed behavior,
 * AFIS/ABL semantics, BACK/LAY preservation, and the absolute prohibition of
 * future certainty, probability claims, expected-return claims, execution
 * authority and Treasury authority. The report carries ≥50 named checks; the
 * engine throws when any fails.
 */

import type {
  DecisionIntelligenceResult, DecisionIntelligenceConfigSpec, LearningResult,
  DecisionInvariantCheck, DecisionInvariantReport, DominanceState,
  DecisionClassification, CounterfactualEvaluation, AlternativeSpec,
} from './types';
import {RECOMMENDATION_DISCLAIMER, DECISION_EVENT_TYPES, DECISION_ENGINE_VERSION} from './types';
import {RECOMMENDATION_STATUS_OF} from './classification';
import {canonicalJson} from './ids';
import {verifyDecisionAudit} from './audit';
import {computeTradeOffScore, TRADE_OFF_DIMENSIONS} from './tradeoff';
import {rankAlternatives} from './ranking';

export interface DecisionInvariantContext {
  readonly baseCandidate: unknown;
  readonly alternativeSpecs: readonly AlternativeSpec[];
  readonly learning: LearningResult;
  readonly config: DecisionIntelligenceConfigSpec;
}

export class DecisionInvariantError extends Error {
  constructor(report: DecisionInvariantReport) {
    const failed = report.checks.filter((c) => !c.passed)
      .map((c) => `${c.invariant}: ${c.detail}`).join('; ');
    super(`decision-intelligence invariants failed — fail closed: ${failed}`);
    this.name = 'DecisionInvariantError';
  }
}

const AUTHORITY_VERBS = /(authoriz|approv|execute |halt|deploy|mutat|transfer|withdraw|activat)/i;
const FABRICATED_KEYS = /"(probability|expectedReturn|expected_return|expectedValue|winRate|pWin|winProbability|probabilityOfSuccess|successOdds|futurePrice|futureOdds)"/;
const CERTAINTY_CLAIMS = /(guaranteed|will (win|profit|lose)|cannot lose|risk-free|riskless|sure profit|definitely|certain to)/i;
const TREASURY_KEYS = /"(treasury|credential|apiKey|api_key|password|token|secret|privateKey)"/i;

const DOMINANCE_STATES = new Set<DominanceState>([
  'DOMINANT_BY_EVIDENCE', 'WEAKLY_PREFERRED', 'NO_DOMINANT_OPTION',
  'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED', 'REGIME_DEPENDENT',
  'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT', 'MIXED',
]);
const RECOMMENDATION_STATUSES = new Set<DecisionClassification>([
  'PREFERRED_BY_EVIDENCE', 'ALTERNATIVE', 'NO_DOMINANT_OPTION',
  'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED',
]);
const STABILITY_INTERPRETATIONS = new Set(['STABLE', 'UNSTABLE', 'IMPROVING',
  'DETERIORATING', 'REGIME_SENSITIVE', 'INSUFFICIENT_HISTORY']);
const SUPPORT_STATES = new Set(['SUPPORTED', 'LIMITED', 'INSUFFICIENT',
  'INCOMPATIBLE', 'UNKNOWN']);

function check(invariant: string, passed: boolean, detail: string):
    DecisionInvariantCheck {
  return {invariant, passed, detail};
}

function narrativeOf(result: DecisionIntelligenceResult): string[] {
  const r = result.recommendation;
  return [
    result.explanation.summary,
    ...result.explanation.acceptanceDecisions,
    ...result.explanation.recommendationRationale,
    ...r.supportingEvidence,
    ...r.opposingEvidence,
    ...r.dependencyState,
    ...result.explanation.regimeEffects,
    ...result.explanation.strategyEffects,
    ...result.explanation.venueEffects,
    ...result.explanation.leakageEffects,
    ...result.explanation.stabilityEffects,
    ...result.researchContext.recommendedPriorities.map((q) => q.question),
    result.context.evidenceQualitySummary,
    result.context.regimeSummary,
  ];
}

export function checkDecisionInvariants(
  result: DecisionIntelligenceResult,
  context: DecisionInvariantContext,
): DecisionInvariantReport {
  const checks: DecisionInvariantCheck[] = [];
  const alternatives = result.alternatives;
  const config = context.config;

  // ------------------------------------------------------------------
  // Deterministic identity & canonical serialization
  // ------------------------------------------------------------------
  checks.push(check('DETERMINISTIC_ANALYSIS_ID',
    typeof result.analysisId === 'string' && result.analysisId.startsWith('dia_'),
    'analysisId is content-derived'));
  checks.push(check('CANONICAL_SERIALIZATION',
    canonicalJson(JSON.parse(canonicalJson(result))) === canonicalJson(result),
    'the result serializes canonically and re-parses identically'));
  checks.push(check('REPLAY_BYTE_IDENTITY',
    result.replay.identical === true
      && result.replay.fingerprint === result.analysisFingerprint,
    'engine double-run is byte-identical with matching fingerprint'));
  checks.push(check('CONTEXT_IDENTITY',
    result.context.contextId.startsWith('dctx_')
      && result.context.baseCandidateId === result.context.baseProfile.candidateId,
    'decision context identity is content-derived and consistent'));
  checks.push(check('ENGINE_VERSION_RECORDED',
    result.context.engineVersion === DECISION_ENGINE_VERSION,
    'deterministic engine version recorded in the context'));
  checks.push(check('CAUSAL_POLICY_ASSOCIATIONAL',
    result.causalPolicy === 'ASSOCIATIONAL_ONLY',
    'the result declares associational-only causal policy'));

  // ------------------------------------------------------------------
  // Domain isolation & AFIS/ABL semantics
  // ------------------------------------------------------------------
  const baseDomain = result.context.domain;
  checks.push(check('DOMAIN_ISOLATION',
    alternatives.every((a) => a.profile.domain === baseDomain),
    `every accepted alternative shares the base domain ${baseDomain}`));
  checks.push(check('NO_CROSS_DOMAIN_RANKING',
    result.ranking.domain === baseDomain
      && result.ranking.entries.every((e) =>
        alternatives.find((a) => a.alternativeId === e.alternativeId) !== undefined),
    'rankings never mix domains'));
  checks.push(check('SCENARIO_MATRIX_DOMAIN',
    result.scenarioMatrix.domain === baseDomain,
    'scenario matrix never mixes domains'));
  checks.push(check('AFIS_NO_BETTING_SEMANTICS',
    baseDomain !== 'AFIS' || alternatives.every((a) =>
      a.counterfactualCandidate.marketId === null
      && a.counterfactualCandidate.selectionId === null
      && a.counterfactualCandidate.venueLegs.every((l) => l.odds === null
        && (l.side === 'BUY' || l.side === 'SELL'))),
    'AFIS alternatives carry no betting semantics (BUY/SELL, no odds, no identity)'));
  checks.push(check('ABL_SIDE_SEMANTICS_PRESERVED',
    baseDomain !== 'ABL' || alternatives.every((a) =>
      a.counterfactualCandidate.marketId !== null
      && a.counterfactualCandidate.selectionId !== null
      && a.counterfactualCandidate.venueLegs.every((l) =>
        (l.side === 'BACK' || l.side === 'LAY')
        && typeof l.odds === 'number' && l.odds > 1)),
    'ABL alternatives preserve BACK/LAY, odds > 1 and market/selection identity'));
  checks.push(check('BACK_LAY_NEVER_COLLAPSED',
    baseDomain !== 'ABL' || alternatives.every((a) =>
      a.counterfactualCandidate.venueLegs.some((l) => l.side === 'BACK'
        || l.side === 'LAY')),
    'BACK/LAY is never collapsed into a generic direction'));
  checks.push(check('CLASS_PRESERVED',
    alternatives.every((a) =>
      a.profile.opportunityClass === result.context.opportunityClass),
    'alternatives never change the opportunity class'));

  // ------------------------------------------------------------------
  // Alternative compatibility & identity
  // ------------------------------------------------------------------
  checks.push(check('BASELINE_PRESENT',
    alternatives.some((a) => a.kind === 'BASELINE'),
    'the baseline alternative is always evaluated'));
  checks.push(check('ALL_ACCEPTED_COMPATIBLE',
    result.compatibility.filter((c) =>
      alternatives.some((a) => a.alternativeId === c.alternativeId))
      .every((c) => c.state === 'COMPATIBLE' && c.reason === null),
    'every accepted alternative passed every compatibility check'));
  checks.push(check('REJECTED_ALTERNATIVES_CODED',
    result.rejectedAlternatives.every((r) => r.reason.length > 0
      && r.schemaVersion === 'decision-intelligence.rejection.v1'),
    'every rejected alternative carries a code and a reason'));
  checks.push(check('NO_DUPLICATE_ALTERNATIVE_IDS',
    new Set(alternatives.map((a) => a.alternativeId)).size === alternatives.length,
    'accepted alternative ids are unique (duplicate submissions are rejected '
      + 'and never evaluated)'));
  checks.push(check('COUNTERFACTUAL_IDENTITY_UNIQUE',
    new Set(alternatives.map((a) => a.counterfactualCandidate.candidateId)).size
      === alternatives.length,
    'counterfactual candidate identities are unique'));
  checks.push(check('SPEC_COVERAGE',
    context.alternativeSpecs.length + 1 /* baseline */
      === alternatives.length + result.rejectedAlternatives.length,
    'every spec plus the baseline is either accepted or rejected — nothing lost'));

  // ------------------------------------------------------------------
  // Evidence integrity
  // ------------------------------------------------------------------
  checks.push(check('EVIDENCE_COUNTS_CONSISTENT',
    alternatives.every((a) => a.cohortSize >= 0
      && a.cohortSize === a.profile.similarity.cohortSize
      && a.profile.evidence.evidenceCount === a.cohortSize),
    'cohort sizes mirror the underlying profiles'));
  checks.push(check('MISSING_EVIDENCE_BLOCKS_SCORING',
    alternatives.every((a) =>
      a.confidenceState !== 'INSUFFICIENT'
      || tradeOffOf(result, a.alternativeId)?.score === null),
    'INSUFFICIENT evidence blocks scoring — never negative evidence'));
  checks.push(check('NULL_SCORE_ON_DISHONEST_CONFIDENCE',
    alternatives.every((a) =>
      !['CONFLICTED', 'STALE', 'NOT_COMPARABLE'].includes(a.confidenceState)
      || tradeOffOf(result, a.alternativeId)?.score === null),
    'CONFLICTED/STALE/NOT_COMPARABLE confidence produces null scores'));
  checks.push(check('EVIDENCE_GAPS_EXPOSED',
    alternatives.every((a) =>
      tradeOffOf(result, a.alternativeId)?.score !== null
      || a.evidenceGaps.length > 0),
    'null-scored alternatives expose their evidence gaps'));
  checks.push(check('CONFLICT_PRESERVATION',
    alternatives.every((a) => a.confidenceState !== 'CONFLICTED'
      || result.evidenceAnalysis.unresolvedConflicts.some((c) =>
        c.startsWith(a.alternativeId))),
    'conflicted evidence is visible in the evidence analysis'));
  checks.push(check('COUNTERFACTUAL_DESCRIPTIVE_ONLY',
    alternatives.every((a) => a.counterfactualOnly === true),
    'counterfactuals are descriptive — never future simulations'));
  checks.push(check('NO_FABRICATED_OUTCOMES',
    !FABRICATED_KEYS.test(canonicalJson(result)),
    'no probability/future-price-like keys anywhere in the result'));

  // ------------------------------------------------------------------
  // Trade-off score bounds & decomposition & configuration integrity
  // ------------------------------------------------------------------
  checks.push(check('TRADE_OFF_BOUNDS',
    result.tradeoff.scores.every((s) => s.score === null
      || (s.score >= 0 && s.score <= 1)),
    'trade-off scores stay in [0,1] or are null'));
  checks.push(check('TRADE_OFF_DECOMPOSITION_EXACT',
    result.tradeoff.scores.every((s) => s.score === null
      || Math.abs(s.score - s.components.reduce(
        (sum, c) => sum + (c.contribution ?? 0), 0)) <= 1e-12),
    'score equals the exact sum of contributions'));
  checks.push(check('TRADE_OFF_WEIGHT_NORMALIZATION',
    result.tradeoff.scores.every((s) => {
      const contributing = s.components.filter((c) => c.contribution !== null);
      const total = contributing.reduce((sum, c) => sum + c.effectiveWeight, 0);
      return contributing.length === 0 || Math.abs(total - 1) <= 1e-9;
    }),
    'effective weights of contributing dimensions renormalize to 1'));
  checks.push(check('NO_MAGIC_WEIGHTS',
    result.tradeoff.scores.every((s) => TRADE_OFF_DIMENSIONS.every((d) => {
      const c = s.components.find((x) => x.dimension === d);
      return c !== undefined
        && c.configuredWeight === config.tradeOffWeights[d];
    })),
    'every configured weight comes from the configuration — no hidden weights'));
  checks.push(check('TRADE_OFF_VALUES_IN_RANGE',
    result.tradeoff.scores.every((s) => s.components.every((c) =>
      c.value === null || (c.value >= 0 && c.value <= 1))),
    'dimension values are null or in [0,1]'));
  checks.push(check('TRADE_OFF_REBUILD_IDENTITY',
    alternatives.every((a) => {
      const rebuilt = computeTradeOffScore(a, config);
      return canonicalJson(rebuilt)
        === canonicalJson(tradeOffOf(result, a.alternativeId));
    }),
    'trade-off scores rebuild byte-identically from their inputs'));
  checks.push(check('TRADE_OFF_ORDER_DETERMINISTIC',
    (() => {
      const ordered = result.tradeoff.orderedAlternativeIds;
      const scores = ordered.map((id) => tradeOffOf(result, id)?.score);
      return scores.every((s, i) => i === 0 || s !== null
        && scores[i - 1] !== null && (scores[i - 1] as number) >= (s as number));
    })(),
    'ordered alternative ids follow score desc, id asc'));

  // ------------------------------------------------------------------
  // Dominance correctness
  // ------------------------------------------------------------------
  checks.push(check('DOMINANCE_STATE_LEGAL',
    DOMINANCE_STATES.has(result.dominance.state),
    `dominance state ${result.dominance.state} is a legal state`));
  checks.push(check('DOMINANCE_SELECTED_QUALIFIES',
    result.dominance.dominantAlternativeId === null
    || tradeOffOf(result, result.dominance.dominantAlternativeId)?.score !== null,
    'a selected dominant alternative always has a non-null score'));
  checks.push(check('DOMINANCE_ALL_NULL_IMPLIES_INSUFFICIENT',
    result.tradeoff.scores.every((s) => s.score === null)
      ? result.dominance.state === 'INSUFFICIENT_EVIDENCE'
        || result.dominance.state === 'NOT_COMPARABLE'
        || result.dominance.state === 'CONFLICTED'
      : true,
    'all-null scores imply an honest non-scoring dominance state'));
  checks.push(check('DOMINANCE_NOT_CERTAINTY',
    result.dominance.reasons.every((r) => !CERTAINTY_CLAIMS.test(r)),
    'dominance reasons never claim certainty'));
  checks.push(check('DOMINANCE_EXCLUSIONS_EXPLICIT',
    result.dominance.exclusions.every((e) => e.reason.length > 0),
    'every dominance exclusion carries an explicit reason'));
  checks.push(check('DOMINANCE_SUPPORT_NOT_CERTAINTY',
    result.dominance.state !== 'DOMINANT_BY_EVIDENCE'
    || result.dominance.reasons.some((r) => r.includes('support is not certainty')),
    'DOMINANT_BY_EVIDENCE explicitly states that support is not certainty'));

  // ------------------------------------------------------------------
  // Recommendation correctness
  // ------------------------------------------------------------------
  checks.push(check('RECOMMENDATION_STATUS_LEGAL',
    RECOMMENDATION_STATUSES.has(result.recommendation.status),
    `recommendation status ${result.recommendation.status} is legal`));
  checks.push(check('RECOMMENDATION_STATUS_MATCHES_DOMINANCE',
    result.recommendation.status === RECOMMENDATION_STATUS_OF[result.dominance.state],
    'recommendation status is derived deterministically from dominance'));
  checks.push(check('RECOMMENDATION_DISCLAIMER_EXACT',
    result.recommendation.disclaimer === RECOMMENDATION_DISCLAIMER,
    'the recommendation carries the exact required disclaimer'));
  checks.push(check('RECOMMENDATION_INFORMATIONAL_ONLY',
    result.recommendation.informational === true,
    'the recommendation is informational only'));
  checks.push(check('SELECTED_ONLY_WHEN_ALLOWED',
    (result.recommendation.status === 'PREFERRED_BY_EVIDENCE'
      || result.recommendation.status === 'ALTERNATIVE')
      === (result.recommendation.selectedAlternativeId !== null),
    'an alternative is selected only for selecting statuses'));
  checks.push(check('RECOMMENDATION_BREAKDOWN_MATCHES',
    result.recommendation.selectedAlternativeId === null
    || canonicalJson(result.recommendation.tradeOffBreakdown)
      === canonicalJson(tradeOffOf(
        result, result.recommendation.selectedAlternativeId)?.components ?? []),
    'the trade-off breakdown mirrors the selected alternative'));
  checks.push(check('RECOMMENDATION_NOT_EXECUTION_INSTRUCTION',
    result.recommendation.disclaimer
      === 'This is an evidence-bound analytical recommendation, not a '
        + 'probability, forecast, expected return, guarantee, or execution '
        + 'instruction.',
    'the disclaimer denies probability, forecast, return, guarantee and instruction'));

  // ------------------------------------------------------------------
  // Conflict & dependency preservation
  // ------------------------------------------------------------------
  checks.push(check('CONFLICT_VISIBLE_IN_RECOMMENDATION',
    result.evidenceAnalysis.unresolvedConflicts.length === 0
    || result.recommendation.opposingEvidence.length > 0,
    'unresolved conflicts surface as opposing evidence'));
  checks.push(check('DEPENDENCIES_VISIBLE_IN_RECOMMENDATION',
    (result.regimeAnalysis.detected || result.strategyAnalysis.detected
      || result.venueAnalysis.detected)
      === (result.recommendation.dependencyState.length > 0
        && !result.recommendation.dependencyState.includes(
          'no dependency detected across alternatives')),
    'detected dependencies are visible in the recommendation'));
  checks.push(check('REGIME_DEPENDENCY_PRESERVED',
    !result.regimeAnalysis.detected
    || (result.regimeAnalysis.perAlternative.length === alternatives.length
      && result.explanation.regimeEffects.some((e) => e.includes('regime'))),
    'regime dependencies preserve applicable regimes'));
  checks.push(check('STRATEGY_DEPENDENCY_PRESERVED',
    !result.strategyAnalysis.detected
    || result.explanation.strategyEffects.some((e) => e.includes('strategy')),
    'strategy dependencies name supported strategies'));
  checks.push(check('VENUE_DEPENDENCY_PRESERVED',
    !result.venueAnalysis.detected
    || result.explanation.venueEffects.some((e) => e.includes('venue')),
    'venue dependencies preserve venue-specific evidence'));

  // ------------------------------------------------------------------
  // Leakage single-counting & stability semantics
  // ------------------------------------------------------------------
  checks.push(check('LEAKAGE_COUNTED_EXACTLY_ONCE',
    result.leakageAnalysis.perAlternative.every((l) => {
      if (l.realizedQuality === null || l.leakageBurden === null
        || l.leakageAdjustedQuality === null) return true;
      return Math.abs(l.leakageAdjustedQuality
        - (l.realizedQuality + l.leakageBurden)) <= 1e-9;
    }),
    'leakage-adjusted quality = realized + leakage (counted once, never twice)'));
  checks.push(check('LEAKAGE_ANALYSIS_COVERS_ALL',
    result.leakageAnalysis.perAlternative.length === alternatives.length
      && alternatives.every((a) => result.leakageAnalysis.perAlternative.some(
        (l) => l.alternativeId === a.alternativeId && l.countedOnce === true)),
    'leakage analysis covers every accepted alternative'));
  checks.push(check('STABILITY_INTERPRETATIONS_LEGAL',
    result.stabilityAnalysis.perAlternative.every((s) =>
      STABILITY_INTERPRETATIONS.has(s.interpretation)),
    'stability interpretations are legal states'));
  checks.push(check('STABILITY_EXPLICIT_NOT_SILENT',
    result.explanation.stabilityEffects.length >= alternatives.length,
    'stability effects are explicit per alternative — never silent overrides'));

  // ------------------------------------------------------------------
  // Scenario matrix
  // ------------------------------------------------------------------
  checks.push(check('SCENARIO_CELLS_DETERMINISTIC',
    result.scenarioMatrix.cells.every((c, i) => i === 0
      || cellKey(result.scenarioMatrix.cells[i - 1]) < cellKey(c)),
    'scenario cells are canonically ordered'));
  checks.push(check('SCENARIO_NO_INFERENCE',
    result.scenarioMatrix.cells.every((c) => c.evidenceCount > 0
      && c.supportingObservationIds.length === c.evidenceCount),
    'every cell is backed by real observations — nothing inferred'));
  checks.push(check('SCENARIO_SUPPORT_STATES_LEGAL',
    result.scenarioMatrix.cells.every((c) => SUPPORT_STATES.has(c.evidenceState)),
    'scenario support states are legal'));
  checks.push(check('SCENARIO_INCOMPATIBLE_EXPLICIT',
    result.scenarioMatrix.incompatibleCombinations.every((c) =>
      c.includes('INCOMPATIBLE')),
    'unsupported combinations are explicitly marked INCOMPATIBLE'));

  // ------------------------------------------------------------------
  // Ranking determinism
  // ------------------------------------------------------------------
  checks.push(check('RANKING_DETERMINISTIC_ORDER',
    result.ranking.entries.every((e, i) => e.rank === i + 1)
      && result.ranking.entries.every((e, i) => i === 0
        || result.ranking.entries[i - 1].tradeOffScore > e.tradeOffScore
        || (result.ranking.entries[i - 1].tradeOffScore === e.tradeOffScore
          && result.ranking.entries[i - 1].alternativeId < e.alternativeId)),
    'ranking ordered by score desc, alternativeId asc, ranks contiguous'));
  checks.push(check('RANKING_REBUILD_IDENTITY',
    canonicalJson(rankAlternatives(alternatives, result.tradeoff))
      === canonicalJson(result.ranking),
    'ranking rebuilds byte-identically'));
  checks.push(check('RANKING_EXCLUSIONS_EXPLICIT',
    result.ranking.excluded.every((e) => e.reason.length > 0),
    'every ranking exclusion carries an explicit reason'));
  checks.push(check('RANKING_RESPECTS_NULL_SCORES',
    result.ranking.entries.every((e) =>
      tradeOffOf(result, e.alternativeId)?.score !== null),
    'null-scored alternatives never enter rankings'));
  checks.push(check('RANKING_COVERS_ALL_ALTERNATIVES',
    alternatives.every((a) =>
      result.ranking.entries.some((e) => e.alternativeId === a.alternativeId)
      || result.ranking.excluded.some((e) => e.alternativeId === a.alternativeId)),
    'every accepted alternative is ranked or explicitly excluded'));

  // ------------------------------------------------------------------
  // Explanation completeness & reconstructibility
  // ------------------------------------------------------------------
  checks.push(check('EXPLANATION_COMPLETE',
    result.explanation.summary.length > 0
      && result.explanation.acceptanceDecisions.length > 0
      && result.explanation.evidenceFor.length === alternatives.length
      && result.explanation.evidenceAgainst.length === alternatives.length
      && result.explanation.regimeEffects.length > 0
      && result.explanation.strategyEffects.length > 0
      && result.explanation.venueEffects.length > 0
      && result.explanation.leakageEffects.length > 0
      && result.explanation.stabilityEffects.length > 0
      && result.explanation.recommendationRationale.length > 0,
    'every explanation section is present and non-empty'));
  checks.push(check('EXPLANATION_COVERS_ALL_ALTERNATIVES',
    result.explanation.alternativeRationales.length
      === alternatives.length + result.rejectedAlternatives.length,
    'explanations cover accepted and rejected alternatives'));
  checks.push(check('EXPLANATION_NOT_OPAQUE',
    result.explanation.summary.includes(result.recommendation.status)
      && result.explanation.recommendationRationale.some((r) =>
        r.includes(result.dominance.state)),
    'explanations name the status and dominance state'));
  checks.push(check('EXPLANATION_RECONSTRUCTIBLE',
    alternatives.every((a) => result.explanation.alternativeRationales.some(
      (r) => r.alternativeId === a.alternativeId && r.rationale === a.rationale)),
    'every evaluated alternative carries its original rationale'));

  // ------------------------------------------------------------------
  // Research & feedback
  // ------------------------------------------------------------------
  checks.push(check('RESEARCH_INFORMATIONAL_ONLY',
    result.researchContext.informational === true,
    'research context is informational only'));
  checks.push(check('RESEARCH_QUESTIONS_PRESENT',
    result.researchContext.regimeQuestions.length > 0
      && result.researchContext.strategyQuestions.length > 0
      && result.researchContext.venueQuestions.length > 0
      && result.researchContext.recommendedPriorities.length > 0,
    'regime/strategy/venue research questions and priorities exist'));
  checks.push(check('RESEARCH_MIRRORS_DECISION',
    result.researchContext.decisionContextId === result.context.contextId
      && result.researchContext.candidateAlternativeIds.length === alternatives.length,
    'research context mirrors the decision context'));
  checks.push(check('FEEDBACK_MIRRORS_DECISION',
    result.feedback.length === 1
      && result.feedback[0].status === result.recommendation.status
      && result.feedback[0].recommendationId === result.recommendation.recommendationId
      && result.feedback[0].alternativeSet.length === alternatives.length,
    'feedback records mirror the recommendation'));
  checks.push(check('RECONCILIATION_NON_DESTRUCTIVE',
    result.reconciliations.every((r) => r.informational === true
      && r.driftSignal !== null
      && r.driftSignal.includes('never rewritten')),
    'divergence observations are informational and non-destructive'));

  // ------------------------------------------------------------------
  // Audit integrity
  // ------------------------------------------------------------------
  checks.push(check('AUDIT_SCHEMA',
    result.auditEvents.every((e) =>
      e.schemaVersion === 'oship.decision-intelligence.v1'),
    'every audit event uses the decision-intelligence schema'));
  checks.push(check('AUDIT_CHAIN_VALID',
    verifyDecisionAudit(result.auditEvents).valid,
    `hash chain of ${result.auditEvents.length} events verifies`));
  checks.push(check('AUDIT_EVENT_TYPES_LEGAL',
    result.auditEvents.every((e) =>
      (DECISION_EVENT_TYPES as readonly string[]).includes(e.eventType)),
    'every audit event type is one of the 14 canonical types'));
  checks.push(check('AUDIT_APPEND_ONLY',
    result.auditEvents.every((e, i) => e.sequence === i),
    'audit events are append-only with contiguous sequences'));
  const auditTypes = new Set(result.auditEvents.map((e) => e.eventType));
  checks.push(check('AUDIT_COVERS_LIFECYCLE',
    ['context-created', 'compatibility-evaluated', 'counterfactual-evaluated',
      'evidence-evaluated', 'tradeoff-evaluated', 'dominance-evaluated',
      'recommendation-generated', 'explanation-generated',
      'research-context-generated', 'replay-completed']
      .every((t) => auditTypes.has(t as DecisionAuditType)),
    'the audit chain covers the full lifecycle'));
  checks.push(check('AUDIT_REJECTIONS_RECORDED',
    result.rejectedAlternatives.every((r) => result.auditEvents.some((e) =>
      e.eventType === 'alternative-rejected'
      && e.payload.alternativeId === r.alternativeId)),
    'every rejected alternative has an audit event'));

  // ------------------------------------------------------------------
  // Security boundaries & semantic prohibitions
  // ------------------------------------------------------------------
  const narratives = narrativeOf(result);
  checks.push(check('NO_FUTURE_CERTAINTY_CLAIMS',
    narratives.every((line) => !CERTAINTY_CLAIMS.test(line)),
    `no certainty claims across ${narratives.length} narrative statements`));
  checks.push(check('NO_AUTHORITY_LANGUAGE',
    narratives.every((line) => !AUTHORITY_VERBS.test(line)),
    'no authority verbs in any narrative output'));
  checks.push(check('NO_EXECUTION_AUTHORITY',
    !TREASURY_KEYS.test(canonicalJson(result))
      && !/(execute the|place the (order|bet)|submit the order)/i
        .test(canonicalJson(result.recommendation)),
    'no execution instructions and no credential/treasury surface'));
  checks.push(check('INFORMATIONAL_EVERYWHERE',
    result.context.informational === true
      && result.recommendation.informational === true
      && result.researchContext.informational === true
      && result.feedback.every((f) => f.informational === true),
    'context, recommendation, research and feedback are informational'));

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}

type DecisionAuditType = import('./types').DecisionEventType;

function tradeOffOf(result: DecisionIntelligenceResult, alternativeId: string) {
  return result.tradeoff.scores.find((s) => s.alternativeId === alternativeId);
}

function cellKey(cell: import('./types').ScenarioCell): string {
  return `${cell.alternativeId}|${cell.regimeEra}|${cell.strategyId}|${cell.venue}`;
}
