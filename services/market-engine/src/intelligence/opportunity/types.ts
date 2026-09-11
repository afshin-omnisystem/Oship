import type {
  LearningResult, LearningObservation, RegimeAssessment, StrategyLearning,
  VenueLearning, OpportunityLearning, StabilityAssessment, DriftAssessment,
  FeatureVector, LeakageLearning, EvidenceState, CausalStatus, ResearchProvenance,
  BaselineMetric,
} from '../learning/types';
import type {OpportunityDomain, OpportunityClass} from '../closed-loop/types';

/**
 * SPRINT 038 — Unified Predictive Opportunity Intelligence & Evidence-Bound
 * Scoring Engine.
 *
 * THE OPPORTUNITY INTELLIGENCE ENGINE IS AN ANALYTICAL EVIDENCE LAYER, NOT AN
 * AUTHORITY AND NOT AN ORACLE. It transforms Sprint 035–037 historical
 * intelligence into a deterministic profile and evidence-bound score for
 * every NEW opportunity. It never claims guaranteed profit, guaranteed
 * execution, future probability, expected return, financial certainty or
 * betting certainty. Historical outcome distributions remain explicitly
 * historical. Every output is informational and associational-only.
 *
 * Lifecycle: New Opportunity → Historical Similarity → Learned Features →
 * Regime Match → Strategy History → Venue History → Leakage History →
 * Evidence Quality → Stability → Historical Outcome Distribution →
 * Opportunity Intelligence Profile → Evidence-Bound Score → Classification →
 * Explanation → Research / Decision Input.
 */

export type {LearningResult, LearningObservation, RegimeAssessment, StrategyLearning,
  VenueLearning, OpportunityLearning, StabilityAssessment, DriftAssessment,
  FeatureVector, LeakageLearning, EvidenceState, CausalStatus, ResearchProvenance};
export type {OpportunityDomain, OpportunityClass};

// ---------------------------------------------------------------------------
// Candidates (§3) — new opportunities arriving for intelligence assessment
// ---------------------------------------------------------------------------

/** AFIS execution sides (market semantics). */
export type AfisSide = 'BUY' | 'SELL';
/** ABL betting sides — never collapsed into BUY/SELL. */
export type AblSide = 'BACK' | 'LAY';
export type CandidateSide = AfisSide | AblSide;

/** ABL decimal odds, always > 1 when present. */
export interface CandidateOdds {
  readonly back: number | null;
  readonly lay: number | null;
}

/** One venue leg of a candidate. Side semantics are domain-scoped. */
export interface CandidateVenueLeg {
  readonly venue: string;
  readonly side: CandidateSide;
  /** ABL decimal odds for this leg (> 1) when available; null for AFIS. */
  readonly odds: number | null;
}

/** Market-structure and condition indicators of a new opportunity. */
export interface CandidateMarket {
  /** Positive finite theoretical edge at unit capital scale. */
  readonly theoreticalEdge: number;
  /** Bid/ask spread in basis points, when available. */
  readonly spreadBps: number | null;
  /** Liquidity index in [0,1], when available. */
  readonly liquidityIndex: number | null;
  /** Imbalance index in [0,1], when available. */
  readonly imbalanceIndex: number | null;
  /** Current volatility index in [0,1], when available. */
  readonly volatilityIndex: number | null;
  /** Current execution-quality index in [0,1], when available. */
  readonly executionQualityIndex: number | null;
}

/** A new opportunity submitted for intelligence assessment. */
export interface OpportunityCandidate {
  readonly candidateId: string;
  readonly receivedAt: number;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly venueLegs: readonly CandidateVenueLeg[];
  readonly market: CandidateMarket;
  /** ABL market identity (bookmaker market), preserved verbatim. */
  readonly marketId: string | null;
  /** ABL selection identity, preserved verbatim. */
  readonly selectionId: string | null;
}

export type RejectionCode =
  | 'MISSING_IDENTITY' | 'UNKNOWN_DOMAIN' | 'UNKNOWN_CLASS' | 'CLASS_DOMAIN_MISMATCH'
  | 'MISSING_STRATEGY' | 'INVALID_STRATEGY_REFERENCE' | 'INVALID_VENUE_REFERENCE'
  | 'INVALID_NUMERICAL_VALUE' | 'AMBIGUOUS_SEMANTIC_MAPPING' | 'MALFORMED_CANDIDATE'
  | 'MISSING_ABL_IDENTITY' | 'INVALID_ODDS' | 'NON_CANONICAL_ORDER';

export interface RejectedCandidate {
  readonly candidateId: string;
  readonly code: RejectionCode;
  readonly reason: string;
  readonly receivedAt: number;
  readonly schemaVersion: 'opportunity-intelligence.rejection.v1';
}

// ---------------------------------------------------------------------------
// Similarity (§4) — deterministic explicit-feature similarity
// ---------------------------------------------------------------------------

export type SimilarityDimension =
  | 'classMatch' | 'strategyMatch' | 'venueOverlap' | 'edgeProximity'
  | 'executionProximity';

export interface SimilarityComponents {
  readonly classMatch: number;
  readonly strategyMatch: number;
  readonly venueOverlap: number;
  readonly edgeProximity: number | null;
  readonly executionProximity: number | null;
}

export interface SimilarityMatch {
  readonly observationId: string;
  readonly sourceMemoryId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly era: number;
  readonly score: number;
  readonly components: SimilarityComponents;
}

export interface SimilarityAssessment {
  readonly candidateId: string;
  readonly matches: readonly SimilarityMatch[];
  /** Mean similarity of the selected cohort, null when the cohort is empty. */
  readonly similarityQuality: number | null;
  /** Observations considered (same domain only — cross-domain never similar). */
  readonly consideredCount: number;
  readonly cohortSize: number;
  readonly similarityId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Learned feature profile (lifecycle: Learned Features)
// ---------------------------------------------------------------------------

export interface LearnedSubjectSummary {
  readonly subject: string;
  readonly sampleSize: number;
  readonly classification: string | null;
  readonly meanPreservation: number | null;
  readonly trend: number | null;
  readonly stability: string | null;
  readonly evidenceState: EvidenceState;
}

export interface FeatureProfile {
  readonly candidateId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly classSummary: LearnedSubjectSummary;
  readonly strategySummary: LearnedSubjectSummary;
  readonly venueSummaries: readonly LearnedSubjectSummary[];
  readonly featureProfileId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Regime match (lifecycle: Regime Match)
// ---------------------------------------------------------------------------

export interface RegimeMatchDimension {
  readonly dimension: string;
  readonly candidateValue: number | null;
  readonly regimeValue: number | null;
  /** 1 − normalized distance, in [0,1], null when either side is unavailable. */
  readonly proximity: number | null;
}

export interface RegimeMatchAssessment {
  readonly candidateId: string;
  /** Nearest historical regime by available-dimension proximity, null if none. */
  readonly matchedEra: number | null;
  readonly matchedTimeBucket: string | null;
  readonly matchQuality: number | null;
  readonly dimensions: readonly RegimeMatchDimension[];
  readonly state: 'MATCHED' | 'UNAVAILABLE';
  readonly regimeMatchId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Strategy / venue history (lifecycle: Strategy History, Venue History)
// ---------------------------------------------------------------------------

export interface StrategyHistoryAssessment {
  readonly candidateId: string;
  readonly strategyId: string;
  readonly domain: OpportunityDomain | null;
  readonly classification: string | null;
  readonly stability: string | null;
  readonly meanPreservation: number | null;
  readonly baselineDelta: number | null;
  readonly sampleSize: number;
  readonly evidenceState: EvidenceState;
  /** Fit sub-score in [0,1], null when history is insufficient/not comparable. */
  readonly strategyFit: number | null;
  readonly strategyHistoryId: string;
  readonly contentFingerprint: string;
}

export interface VenueHistoryAssessment {
  readonly candidateId: string;
  readonly venue: string;
  readonly classification: string | null;
  readonly fillEfficiency: number | null;
  readonly leakage: number | null;
  readonly stability: string | null;
  readonly sampleSize: number;
  readonly evidenceState: EvidenceState;
  readonly venueFit: number | null;
  readonly venueHistoryId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Leakage (§10) — apparent vs realized vs leakage-adjusted quality
// ---------------------------------------------------------------------------

export interface LeakageRiskAssessment {
  readonly candidateId: string;
  /** Mean theoretical value of the similar cohort — the apparent quality. */
  readonly apparentQuality: number | null;
  /** Mean realized net of the similar cohort — the realized quality. */
  readonly realizedQuality: number | null;
  /** Mean leakage of the similar cohort (counted exactly once). */
  readonly leakageBurden: number | null;
  /** Realized + leakage: the quality that would exist with zero leakage. */
  readonly leakageAdjustedQuality: number | null;
  /** Leakage share of theoretical value, in [0,1], null when unmeasurable. */
  readonly leakageShare: number | null;
  /** Recurring leakage components of the candidate's class (Sprint 037 facts). */
  readonly recurringComponents: readonly string[];
  readonly leakageRiskId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Evidence (§5)
// ---------------------------------------------------------------------------

export type SampleAdequacy = 'SUFFICIENT' | 'LIMITED' | 'INSUFFICIENT';
export type EvidenceFreshness = 'FRESH' | 'STALE';
export type EvidenceConsistency = 'CONSISTENT' | 'INCONSISTENT';
export type EvidenceComparability = 'COMPARABLE' | 'NOT_COMPARABLE';
export type EvidenceConfidence =
  | 'STRONG' | 'MODERATE' | 'WEAK' | 'SUFFICIENT' | 'LIMITED' | 'INSUFFICIENT'
  | 'CONFLICTED' | 'STALE' | 'NOT_COMPARABLE' | 'UNKNOWN';

export interface EvidenceProfile {
  readonly candidateId: string;
  readonly source: string;
  readonly evidenceCount: number;
  readonly sampleAdequacy: SampleAdequacy;
  readonly freshness: EvidenceFreshness;
  readonly oldestEvidenceAge: number;
  readonly consistency: EvidenceConsistency;
  /** Share of analytical dimensions that carried values, in [0,1]. */
  readonly completeness: number;
  readonly conflicts: number;
  readonly domainCompatibility: 'SAME_DOMAIN' | 'MIXED_DOMAIN';
  readonly comparability: EvidenceComparability;
  readonly confidenceState: EvidenceConfidence;
  readonly evidenceId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Stability integration (§11)
// ---------------------------------------------------------------------------

export type StabilityInterpretation =
  | 'STABLE' | 'UNSTABLE' | 'IMPROVING' | 'DETERIORATING' | 'REGIME_SENSITIVE'
  | 'INSUFFICIENT_HISTORY';

export interface StabilityIntegration {
  readonly candidateId: string;
  readonly strategyStability: string | null;
  readonly classStability: string | null;
  readonly preservationDrift: string | null;
  readonly interpretation: StabilityInterpretation;
  /** Stability factor in [0,1] (1 = no stability concern), null when insufficient. */
  readonly stabilityFactor: number | null;
  readonly stabilityIntegrationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Historical outcome distribution (§6) — explicitly historical
// ---------------------------------------------------------------------------

export interface HistoricalOutcomeDistribution {
  readonly candidateId: string;
  readonly sampleSize: number;
  readonly outcomeCounts: Readonly<Record<string, number>>;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly neutralCount: number;
  readonly medianPreservation: number | null;
  readonly quartile25: number | null;
  readonly quartile75: number | null;
  readonly minPreservation: number | null;
  readonly maxPreservation: number | null;
  readonly dispersion: number | null;
  readonly meanRealizedNet: number | null;
  /** Observations whose realized net was actually measured. */
  readonly measuredRealizedCount: number;
  /** Mean realized / mean theoretical when measurable — realization quality. */
  readonly realizationQuality: number | null;
  readonly meanPreservation: number | null;
  /** Historical facts only — never a probability or forecast. */
  readonly historicalOnly: true;
  readonly disclaimer: string;
  readonly distributionId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Evidence-bound score (§7)
// ---------------------------------------------------------------------------

export type ScoreDimension =
  | 'historicalPreservation' | 'realizationQuality' | 'evidenceQuality'
  | 'similarityQuality' | 'regimeFit' | 'strategyFit' | 'venueFit'
  | 'stabilityFactor' | 'leakageBurden' | 'freshnessFactor' | 'sampleAdequacy';

export interface ScoreComponent {
  readonly dimension: ScoreDimension;
  readonly value: number | null;
  /** Configured weight before availability renormalization. */
  readonly configuredWeight: number;
  /** Effective weight after renormalizing over available dimensions. */
  readonly effectiveWeight: number;
  readonly contribution: number | null;
}

export interface EvidenceBoundScore {
  readonly candidateId: string;
  readonly score: number | null;
  readonly components: readonly ScoreComponent[];
  /** Number of dimensions that actually contributed. */
  readonly contributingDimensions: number;
  readonly disclaimer: string;
  readonly scoreId: string;
  readonly contentFingerprint: string;
}

export const SCORE_DISCLAIMER = 'This is an evidence-bound analytical index, '
  + 'not a probability, forecast, expected return, or guarantee.';

export const DISTRIBUTION_DISCLAIMER = 'Historical distribution of similar '
  + 'opportunities — explicitly historical, not a future probability or forecast.';

// ---------------------------------------------------------------------------
// Classification (§8) and dependencies (§9)
// ---------------------------------------------------------------------------

export type OpportunityIntelligenceClassification =
  | 'HISTORICALLY_FAVORABLE' | 'HISTORICALLY_UNFAVORABLE' | 'INSUFFICIENT_EVIDENCE'
  | 'REGIME_DEPENDENT' | 'STRATEGY_DEPENDENT' | 'VENUE_DEPENDENT' | 'MIXED'
  | 'UNKNOWN' | 'NOT_COMPARABLE';

export type DependencyKind = 'REGIME' | 'STRATEGY' | 'VENUE';

export interface DependencyEvidence {
  readonly kind: DependencyKind;
  readonly detected: boolean;
  readonly groups: readonly {readonly key: string; readonly sampleSize: number;
    readonly meanPreservation: number | null}[];
  /** Max between-group mean-preservation spread, null when undeterminable. */
  readonly spread: number | null;
  readonly determinable: boolean;
}

export interface DependencyAnalysis {
  readonly candidateId: string;
  readonly regime: DependencyEvidence;
  readonly strategy: DependencyEvidence;
  readonly venue: DependencyEvidence;
  readonly dependenciesId: string;
  readonly contentFingerprint: string;
}

export interface ClassificationDecision {
  readonly candidateId: string;
  readonly classification: OpportunityIntelligenceClassification;
  /** Deterministic ordered reasons — the decision chain, reconstructible. */
  readonly reasons: readonly string[];
  readonly classificationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Explanation (§13)
// ---------------------------------------------------------------------------

export interface ExplanationDimensionNote {
  readonly dimension: ScoreDimension;
  readonly contribution: number | null;
  readonly strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNAVAILABLE';
}

export interface IntelligenceExplanation {
  readonly candidateId: string;
  readonly summary: string;
  readonly scoreExplanation: readonly string[];
  readonly strongDimensions: readonly ScoreDimension[];
  readonly weakDimensions: readonly ScoreDimension[];
  readonly evidenceSufficiency: string;
  readonly regimeDependence: string;
  readonly strategyDependence: string;
  readonly venueDependence: string;
  readonly leakageEffect: string;
  readonly stabilityEffect: string;
  readonly missingEvidence: readonly ScoreDimension[];
  readonly classificationRationale: readonly string[];
  readonly explanationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Research context (§14) and feedback (§15)
// ---------------------------------------------------------------------------

export interface RecommendedResearchQuestion {
  readonly question: string;
  readonly rationale: string;
  readonly informational: true;
}

export interface ResearchContext {
  readonly candidateId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly similarObservationIds: readonly string[];
  readonly evidenceProfileSummary: string;
  readonly scoreComponents: readonly ScoreComponent[];
  readonly classification: OpportunityIntelligenceClassification;
  readonly dependencySignals: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly recommendedQuestions: readonly RecommendedResearchQuestion[];
  readonly informational: true;
  readonly researchContextId: string;
  readonly contentFingerprint: string;
}

export interface DecisionFeedback {
  readonly feedbackId: string;
  readonly candidateId: string;
  readonly profileId: string;
  readonly decision: {
    readonly classification: OpportunityIntelligenceClassification;
    readonly score: number | null;
    readonly evidenceCount: number;
  };
  readonly evidenceUsed: readonly string[];
  readonly informational: true;
  readonly schemaVersion: 'opportunity-intelligence.feedback.v1';
  readonly contentFingerprint: string;
}

export interface ObservedOutcome {
  readonly realizedNet: number;
  readonly preservationRatio: number | null;
  readonly outcome: string;
}

export interface OutcomeReconciliation {
  readonly reconciliationId: string;
  readonly candidateId: string;
  readonly profileId: string;
  readonly predictedClassification: OpportunityIntelligenceClassification;
  readonly predictedScore: number | null;
  readonly observed: ObservedOutcome;
  /** True when the historical assessment and observation point the same way. */
  readonly agreement: boolean | null;
  readonly disagreementKind: 'FAVORABLE_BUT_NEGATIVE' | 'UNFAVORABLE_BUT_POSITIVE'
    | 'NONE' | 'UNDETERMINABLE';
  /** Informational drift observation — never rewrites historical evidence. */
  readonly driftSignal: string | null;
  readonly informational: true;
  readonly schemaVersion: 'opportunity-intelligence.reconciliation.v1';
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Ranking (§12)
// ---------------------------------------------------------------------------

export interface RankingEntry {
  readonly candidateId: string;
  readonly profileId: string;
  readonly score: number;
  readonly classification: OpportunityIntelligenceClassification;
  readonly rank: number;
}

export interface RankingExclusion {
  readonly candidateId: string;
  readonly classification: OpportunityIntelligenceClassification;
  readonly reason: string;
}

export interface DomainRanking {
  readonly domain: OpportunityDomain;
  readonly entries: readonly RankingEntry[];
  readonly excluded: readonly RankingExclusion[];
  readonly rankingId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// The profile (lifecycle: Opportunity Intelligence Profile)
// ---------------------------------------------------------------------------

export interface OpportunityIntelligenceProfile {
  readonly profileId: string;
  readonly candidateId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly marketId: string | null;
  readonly selectionId: string | null;
  readonly receivedAt: number;
  readonly similarity: SimilarityAssessment;
  readonly featureProfile: FeatureProfile;
  readonly regimeMatch: RegimeMatchAssessment;
  readonly strategyHistory: StrategyHistoryAssessment;
  readonly venueHistory: readonly VenueHistoryAssessment[];
  readonly leakageRisk: LeakageRiskAssessment;
  readonly evidence: EvidenceProfile;
  readonly stability: StabilityIntegration;
  readonly outcomeDistribution: HistoricalOutcomeDistribution;
  readonly dependencies: DependencyAnalysis;
  readonly score: EvidenceBoundScore;
  readonly classification: ClassificationDecision;
  readonly explanation: IntelligenceExplanation;
  readonly researchContext: ResearchContext;
  readonly informational: true;
  readonly causalStatus: CausalStatus;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'opportunity-intelligence.profile.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Engine input / result
// ---------------------------------------------------------------------------

export interface OpportunityIntelligenceInput {
  /** Raw candidates — every one is validated fail-closed before acceptance. */
  readonly candidates: readonly unknown[];
  /** The validated Sprint 037 learning result consumed read-only. */
  readonly learning: LearningResult;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface OpportunitySourceSummary {
  readonly learningAnalysisId: string;
  readonly learningFingerprint: string;
  readonly observationCount: number;
  readonly regimeCount: number;
}

export interface OpportunityLineage {
  readonly profileIds: readonly string[];
  readonly observationIds: readonly string[];
  readonly learningAnalysisId: string;
  readonly valid: true;
}

export interface OpportunityIntelligenceResult {
  readonly analysisId: string;
  readonly timestamp: number;
  readonly schemaVersion: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
  readonly causalPolicy: CausalStatus;
  readonly source: OpportunitySourceSummary;
  readonly profiles: readonly OpportunityIntelligenceProfile[];
  readonly rejected: readonly RejectedCandidate[];
  readonly rankings: readonly DomainRanking[];
  readonly feedback: readonly DecisionFeedback[];
  readonly reconciliations: readonly OutcomeReconciliation[];
  readonly lineage: OpportunityLineage;
  readonly auditEvents: readonly OpportunityAuditEvent[];
  readonly invariants: OpportunityInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
}

// ---------------------------------------------------------------------------
// Audit (§17) — oship.opportunity-intelligence.v1
// ---------------------------------------------------------------------------

export type OpportunityEventType =
  | 'opportunity-received' | 'candidate-rejected' | 'similarity-evaluated'
  | 'evidence-evaluated' | 'dependencies-evaluated' | 'score-calculated'
  | 'classification-selected' | 'profile-created' | 'ranking-generated'
  | 'explanation-generated' | 'feedback-recorded' | 'replay-completed'
  | 'fail-closed';

export const OPPORTUNITY_EVENT_TYPES: readonly OpportunityEventType[] = Object.freeze([
  'opportunity-received', 'candidate-rejected', 'similarity-evaluated',
  'evidence-evaluated', 'dependencies-evaluated', 'score-calculated',
  'classification-selected', 'profile-created', 'ranking-generated',
  'explanation-generated', 'feedback-recorded', 'replay-completed', 'fail-closed',
]);

export const OPPORTUNITY_GENESIS_HASH = '0'.repeat(64);

export interface OpportunityAuditEvent {
  readonly schemaVersion: 'oship.opportunity-intelligence.v1';
  readonly eventId: string;
  readonly eventType: OpportunityEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§21) — ≥45 hard fail-closed checks
// ---------------------------------------------------------------------------

export interface OpportunityInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface OpportunityInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly OpportunityInvariantCheck[];
  readonly failedCount: number;
}

// ---------------------------------------------------------------------------
// Baseline metric re-export for score dimension typing
// ---------------------------------------------------------------------------

export type {BaselineMetric};

// ---------------------------------------------------------------------------
// Configuration contracts
// ---------------------------------------------------------------------------

export interface OpportunityIntelligenceConfigSpec {
  readonly schemaVersion: 'opportunity-intelligence.config.v1';
  /** Minimum similar observations for any evidence at all (fail-closed floor). */
  readonly minSimilarObservations: number;
  /** Sample size at which evidence adequacy becomes SUFFICIENT. */
  readonly fullEvidenceSample: number;
  /** Maximum similar observations retained per candidate. */
  readonly similarityTopK: number;
  /** Minimum similarity score for an observation to join the cohort. */
  readonly similarityFloor: number;
  /** Evidence-bound score ≥ this band → HISTORICALLY_FAVORABLE candidate. */
  readonly favorableScoreBand: number;
  /** Evidence-bound score ≤ this band → HISTORICALLY_UNFAVORABLE candidate. */
  readonly unfavorableScoreBand: number;
  /** Between-group mean-preservation spread above this → dependency detected. */
  readonly dependencySpreadBand: number;
  /** Minimum sample per group before a dependency comparison is determinable. */
  readonly dependencyMinGroupSample: number;
  /** Evidence older than this (ms) is STALE. */
  readonly evidenceStaleMs: number;
  /** Preservation dispersion above this → INCONSISTENT evidence. */
  readonly consistencyDispersionBand: number;
  /** Clamp for leakage share of theoretical value. */
  readonly leakageShareCap: number;
  /** Dimension-strength thresholds for explanations (share of max contribution). */
  readonly strongDimensionShare: number;
  readonly weakDimensionShare: number;
  readonly similarityWeights: Readonly<Record<SimilarityDimension, number>>;
  readonly scoreWeights: Readonly<Record<ScoreDimension, number>>;
}

export type OpportunityIntelligenceConfigInput = Partial<
  Omit<OpportunityIntelligenceConfigSpec, 'schemaVersion' | 'similarityWeights' | 'scoreWeights'>
> & {
  readonly similarityWeights?: Partial<Record<SimilarityDimension, number>>;
  readonly scoreWeights?: Partial<Record<ScoreDimension, number>>;
};
