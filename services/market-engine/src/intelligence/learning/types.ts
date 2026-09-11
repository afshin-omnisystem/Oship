import type {
  EvidenceState, ResearchProvenance, NormalizedValues, NormalizedVenueLeg,
  MemoryRecord, ResearchResult, BatchSummary, KnowledgeEntity, ResearchPattern,
  ResearchFinding, Hypothesis, IntelligenceFeedback, ComparisonResult,
  ResearchRanking, QueryResult, OpportunityDomain, OpportunityClass,
  LeakageComponentName, PreservationGrade, HistoryOutcome, FailureClass,
} from '../research/types';

/**
 * SPRINT 037 — Unified Intelligence Learning & Research Feedback Engine.
 *
 * Canonical lifecycle: OIIN → … → Realized Value (Sprint 035) → Historical
 * Memory → Knowledge Graph → Research → Evidence → Findings (Sprint 036) →
 * Learning Observations → Features → Cohorts → Baselines → Learning
 * (strategy / opportunity / venue / policy / leakage) → Regimes → Drift →
 * Stability → Learning Signals → Research Priorities → Intelligence Feedback.
 *
 * THIS IS AN ANALYTICAL / LEARNING LAYER ONLY. It is NOT an authority: it
 * never authorizes trades, bets, capital allocation, risk changes, policy
 * activation or execution; it never mutates Treasury, Portfolio, Risk,
 * AEGIS, Execution, the Strategy Registry, active Policies or any provider.
 * Every learning output carries `informational: true`. Learning consumes the
 * validated Sprint 036 ResearchResult and never duplicates its contracts.
 */

// Re-exported Sprint 035/036 contracts — the learning plane never duplicates them.
export type {
  EvidenceState, ResearchProvenance, NormalizedValues, NormalizedVenueLeg,
  MemoryRecord, ResearchResult, BatchSummary, KnowledgeEntity, ResearchPattern,
  ResearchFinding, Hypothesis, IntelligenceFeedback, ComparisonResult,
  ResearchRanking, QueryResult, OpportunityDomain, OpportunityClass,
  LeakageComponentName, PreservationGrade, HistoryOutcome, FailureClass,
};

export const LEARNING_SCHEMA_VERSION = 'learning.v1' as const;

// ---------------------------------------------------------------------------
// Learning subjects
// ---------------------------------------------------------------------------

export type LearningSubjectKind =
  | 'STRATEGY' | 'OPPORTUNITY_CLASS' | 'VENUE' | 'POLICY' | 'DOMAIN'
  | 'OPPORTUNITY_SERIES' | 'LEAKAGE_COMPONENT' | 'REGIME';

export interface LearningSubject {
  readonly kind: LearningSubjectKind;
  readonly key: string;
}

// ---------------------------------------------------------------------------
// Learning observations (§3) — immutable projections of validated memory
// ---------------------------------------------------------------------------

/** Links one observation back to the Sprint 036 artifacts that cover it. */
export interface ObservationLineage {
  readonly researchAnalysisId: string;
  readonly memoryId: string;
  readonly batchId: string;
  readonly findingIds: readonly string[];
  readonly patternIds: readonly string[];
  readonly hypothesisIds: readonly string[];
}

export interface LearningObservation {
  readonly observationId: string;
  readonly sourceMemoryId: string;
  readonly sourceType: 'research.memory.v1';
  readonly sourceFingerprint: string;
  readonly domain: OpportunityDomain;
  readonly opportunityId: string;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly semanticSide: string;
  readonly timestamp: number;
  readonly timeBucket: string;
  /** Deterministic 1-based era ordinal within the corpus time buckets. */
  readonly era: number;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.observation.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly lineage: ObservationLineage;
  readonly evidenceState: EvidenceState;
  readonly evidenceConfidence: number;
  readonly values: NormalizedValues;
  readonly venueLegs: readonly NormalizedVenueLeg[];
}

// ---------------------------------------------------------------------------
// Feature engine (§4) — deterministic, versioned, provenance-aware
// ---------------------------------------------------------------------------

export interface OpportunityFeatures {
  readonly theoreticalEdge: number | null;
  readonly realizedEdge: number | null;
  readonly preservationRatio: number | null;
  readonly opportunityClass: OpportunityClass;
  readonly freshness: number;
  readonly opportunitySize: number | null;
  readonly evidenceQuality: number;
}

export interface ExecutionFeatures {
  readonly fillEfficiency: number | null;
  readonly slippage: number | null;
  readonly fees: number | null;
  readonly impact: number | null;
  readonly latency: number | null;
  readonly partialFillRatio: number | null;
  readonly failureRate: number;
  readonly completionStatus: HistoryOutcome;
}

export interface ControlFeatures {
  readonly adaptiveActionFrequency: number;
  readonly repriceRate: number;
  readonly resliceRate: number;
  readonly rerouteRate: number;
  readonly replanRate: number;
  readonly abortRate: number;
  readonly completionRate: number;
}

export interface VenueLegFeatures {
  readonly venue: string;
  readonly side: string;
  readonly fillEfficiency: number | null;
  readonly leakage: number | null;
  readonly adverseDrift: number;
}

export interface LearningFeatureSet {
  readonly featureId: string;
  readonly observationId: string;
  readonly subject: LearningSubject;
  readonly opportunity: OpportunityFeatures;
  readonly execution: ExecutionFeatures;
  readonly control: ControlFeatures;
  readonly venueLegs: readonly VenueLegFeatures[];
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.feature.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

/** Per-subject aggregate of features across eras. */
export interface EraBreakdown {
  readonly era: number;
  readonly timeBucket: string;
  readonly sampleSize: number;
  readonly meanPreservation: number | null;
  readonly meanRealizedNet: number | null;
  readonly meanExecutionQuality: number | null;
  readonly meanLeakage: number | null;
}

export interface StrategyFeatureMetrics {
  readonly preservation: number | null;
  readonly realizedValue: number | null;
  readonly completion: number | null;
  readonly leakage: number | null;
  readonly consistency: number | null;
  readonly trend: number | null;
  readonly sampleSize: number;
  readonly evidenceQuality: number | null;
}

export interface ExecutionFeatureMetrics {
  readonly fillEfficiency: number | null;
  readonly slippage: number | null;
  readonly fees: number | null;
  readonly impact: number | null;
  readonly latency: number | null;
  readonly partialFillRatio: number | null;
  readonly failureRate: number | null;
  readonly completionRate: number | null;
}

export interface ControlFeatureMetrics {
  readonly adaptiveActionFrequency: number | null;
  readonly repriceRate: number | null;
  readonly resliceRate: number | null;
  readonly rerouteRate: number | null;
  readonly replanRate: number | null;
  readonly abortRate: number | null;
  readonly completionRate: number | null;
}

export interface FeatureVector {
  readonly vectorId: string;
  readonly subject: LearningSubject;
  readonly domain: OpportunityDomain | 'MIXED';
  readonly sampleSize: number;
  readonly strategy: StrategyFeatureMetrics;
  readonly execution: ExecutionFeatureMetrics;
  readonly control: ControlFeatureMetrics;
  readonly eraBreakdown: readonly EraBreakdown[];
  readonly semanticSides: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.feature.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly sourceMemoryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Cohorts (§5) — comparability enforced
// ---------------------------------------------------------------------------

export type CohortDimension =
  | 'DOMAIN' | 'OPPORTUNITY_CLASS' | 'STRATEGY' | 'VENUE' | 'POLICY'
  | 'EXECUTION_MODE' | 'TIME_PERIOD' | 'REGIME' | 'EVIDENCE_QUALITY';

export interface LearningCohort {
  readonly cohortId: string;
  readonly dimension: CohortDimension;
  readonly key: string;
  readonly sampleSize: number;
  readonly members: readonly string[];
  readonly domains: readonly OpportunityDomain[];
  readonly metricDefinitionFingerprints: readonly string[];
  readonly comparable: boolean;
  readonly notComparableReasons: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly schemaVersion: 'learning.cohort.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Baselines (§6) — never compare against an undefined baseline
// ---------------------------------------------------------------------------

export type BaselineKind =
  | 'HISTORICAL' | 'STRATEGY' | 'VENUE' | 'POLICY' | 'OPPORTUNITY_CLASS'
  | 'DOMAIN_NORMALIZED';

export type BaselineMetric =
  | 'preservation' | 'realizedNet' | 'leakage' | 'executionQuality' | 'completion';

export interface LearningBaseline {
  readonly baselineId: string;
  readonly kind: BaselineKind;
  readonly subject: LearningSubject | null;
  readonly scopeDomain: OpportunityDomain | 'MIXED';
  readonly metric: BaselineMetric;
  readonly meanValue: number | null;
  readonly sampleSize: number;
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.baseline.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Learning results per subject family
// ---------------------------------------------------------------------------

export type StrategyClassification =
  | 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'CONSISTENT_OUTPERFORMER'
  | 'CONSISTENT_UNDERPERFORMER' | 'HIGH_THEORETICAL_LOW_REALIZATION'
  | 'INSUFFICIENT_EVIDENCE' | 'NOT_COMPARABLE';

export interface StrategyLearning {
  readonly learningId: string;
  readonly strategyId: string;
  readonly domain: OpportunityDomain | 'MIXED';
  readonly sampleSize: number;
  readonly metrics: StrategyFeatureMetrics;
  readonly stability: StabilityClassification;
  readonly classification: StrategyClassification;
  readonly reasons: readonly string[];
  readonly baseline: LearningBaseline | null;
  readonly baselineDelta: number | null;
  readonly completionIsNotPreservation: true;
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.strategy.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

export type OpportunityClassification =
  | 'HIGH_PRESERVATION' | 'LOW_PRESERVATION' | 'HIGH_THEORETICAL_LOW_REALIZATION'
  | 'DETERIORATING' | 'IMPROVING' | 'STABLE' | 'INSUFFICIENT_EVIDENCE';

export interface RecurringLeakageFact {
  readonly component: LeakageComponentName;
  readonly occurrences: number;
  readonly totalValue: number;
  readonly sampleSize: number;
}

export interface RecurringFailureFact {
  readonly failureClass: NonNullable<FailureClass>;
  readonly occurrences: number;
  readonly sampleSize: number;
}

export interface OpportunityLearning {
  readonly learningId: string;
  readonly opportunityClass: OpportunityClass;
  readonly domain: OpportunityDomain | 'MIXED';
  readonly sampleSize: number;
  readonly meanPreservation: number | null;
  readonly trend: number | null;
  readonly classification: OpportunityClassification;
  readonly reasons: readonly string[];
  readonly recurringLeakage: readonly RecurringLeakageFact[];
  readonly recurringFailures: readonly RecurringFailureFact[];
  readonly highQualityConditions: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.opportunity.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

export type VenueClassification =
  | 'CONSISTENTLY_STRONG' | 'CONSISTENTLY_WEAK' | 'DETERIORATING'
  | 'IMPROVING' | 'INSUFFICIENT_EVIDENCE';

export interface VenueLearning {
  readonly learningId: string;
  readonly venue: string;
  readonly domains: readonly OpportunityDomain[];
  readonly semanticSides: readonly string[];
  readonly sampleSize: number;
  readonly metrics: {
    readonly fillEfficiency: number | null;
    readonly slippage: number | null;
    readonly leakage: number | null;
    readonly latency: number | null;
    readonly adverseDrift: number | null;
    readonly failureRate: number | null;
    readonly preservationContribution: number | null;
    readonly evidenceQuality: number | null;
    readonly stability: StabilityClassification;
  };
  readonly classification: VenueClassification;
  readonly reasons: readonly string[];
  readonly baseline: LearningBaseline | null;
  readonly baselineDelta: number | null;
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.venue.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

export type PolicyClassification =
  | 'STABLE_BASELINE' | 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END'
  | 'CANDIDATE_REGRESSION' | 'CANDIDATE_IMPROVES_END_TO_END' | 'INSUFFICIENT_EVIDENCE';

export interface PolicyLearning {
  readonly learningId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly role: 'BASELINE' | 'CANDIDATE';
  readonly sampleSize: number;
  readonly executionQuality: number | null;
  readonly endToEndPreservation: number | null;
  readonly leakage: number | null;
  readonly deltaVsBaseline: {
    readonly executionQuality: number | null;
    readonly endToEndPreservation: number | null;
    readonly leakage: number | null;
  } | null;
  readonly classification: PolicyClassification;
  readonly reasons: readonly string[];
  readonly stability: StabilityClassification;
  /** Promotion is ALWAYS outside this engine — a candidate never becomes ACTIVE here. */
  readonly promotion: 'OUTSIDE_ENGINE';
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.policy.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

export interface LeakageLearning {
  readonly learningId: string;
  readonly component: LeakageComponentName;
  readonly domain: OpportunityDomain | 'MIXED';
  readonly occurrences: number;
  readonly totalValue: number;
  readonly meanPerOccurrence: number | null;
  readonly recurrenceRate: number | null;
  readonly trend: number | null;
  readonly dominantSubjects: readonly string[];
  readonly sampleSize: number;
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.leakage.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Regimes (§11) — explainable, deterministic, fingerprinted, evidence-backed
// ---------------------------------------------------------------------------

export type RegimeDimensionKind =
  | 'VOLATILITY' | 'LIQUIDITY' | 'OPPORTUNITY_DENSITY' | 'EXECUTION_QUALITY'
  | 'VENUE_CONDITIONS' | 'PRESERVATION_TREND';

export type RegimeLabel =
  | 'HIGH' | 'LOW' | 'ADVERSE' | 'NORMAL' | 'STABLE' | 'DETERIORATING'
  | 'UNAVAILABLE';

export interface RegimeDimensionAssessment {
  readonly dimension: RegimeDimensionKind;
  readonly classification: RegimeLabel;
  readonly metric: string;
  readonly value: number | null;
  /** Human-readable deterministic rule — regimes are never hidden labels. */
  readonly rule: string;
}

export interface RegimeAssessment {
  readonly regimeId: string;
  readonly timeBucket: string;
  readonly era: number;
  readonly from: number;
  readonly to: number;
  readonly sampleSize: number;
  readonly dimensions: readonly RegimeDimensionAssessment[];
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.regime.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly memoryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Drift (§12)
// ---------------------------------------------------------------------------

export type DriftClassification =
  | 'NO_DRIFT' | 'IMPROVING' | 'DETERIORATING' | 'STRUCTURAL_SHIFT'
  | 'INSUFFICIENT_EVIDENCE';

export type DriftMetric =
  | 'STRATEGY_PRESERVATION' | 'VENUE_QUALITY' | 'OPPORTUNITY_QUALITY'
  | 'LEAKAGE' | 'EXECUTION_QUALITY' | 'COMPLETION' | 'FAILURE_RATE'
  | 'POLICY_IMPACT';

export interface DriftAssessment {
  readonly driftId: string;
  readonly subject: LearningSubject;
  readonly metric: DriftMetric;
  readonly baseline: LearningBaseline;
  readonly comparisonWindow: {
    readonly from: number;
    readonly to: number;
    readonly buckets: readonly string[];
    readonly sampleSize: number;
  };
  readonly baselineSampleSize: number;
  readonly observedDelta: number | null;
  readonly classification: DriftClassification;
  readonly evidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.drift.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Stability (§13)
// ---------------------------------------------------------------------------

export type StabilityClassification =
  | 'STABLE' | 'FRAGILE' | 'REGIME_DEPENDENT' | 'CONTRADICTORY'
  | 'INSUFFICIENT_EVIDENCE';

export interface StabilityAssessment {
  readonly stabilityId: string;
  readonly subject: LearningSubject;
  readonly metric: string;
  readonly sampleSize: number;
  readonly eraConsistency: number | null;
  readonly dispersion: number | null;
  readonly regimeConsistency: number | null;
  readonly classification: StabilityClassification;
  readonly reasons: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly schemaVersion: 'learning.stability.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Confidence (§14) — honest, never fabricated
// ---------------------------------------------------------------------------

export interface ConfidenceAssessment {
  readonly confidenceId: string;
  readonly subject: string;
  readonly sampleSize: number;
  readonly sampleFactor: number | null;
  readonly provenanceFactor: number | null;
  readonly consistencyFactor: number | null;
  readonly comparabilityFactor: number | null;
  readonly contradictionFactor: number | null;
  readonly stabilityFactor: number | null;
  readonly freshnessFactor: number | null;
  /** Null exactly when a numeric score cannot honestly be computed. */
  readonly score: number | null;
  readonly state: EvidenceState;
  readonly reasons: readonly string[];
  readonly schemaVersion: 'learning.confidence.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Causal safety (§15)
// ---------------------------------------------------------------------------

export type CausalStatus = 'ASSOCIATIONAL_ONLY' | 'CAUSAL_BASIS_DOCUMENTED';

// ---------------------------------------------------------------------------
// Learning signals (§16) — immutable, informational
// ---------------------------------------------------------------------------

export type LearningSignalKind =
  | 'STRATEGY_SIGNAL' | 'OPPORTUNITY_SIGNAL' | 'VENUE_SIGNAL' | 'POLICY_SIGNAL'
  | 'LEAKAGE_SIGNAL' | 'REGIME_SIGNAL' | 'DRIFT_SIGNAL' | 'RESEARCH_PRIORITY_SIGNAL';

export interface SignalLineage {
  readonly researchAnalysisId: string;
  readonly batchIds: readonly string[];
  readonly findingIds: readonly string[];
  readonly patternIds: readonly string[];
  readonly hypothesisIds: readonly string[];
  readonly observationIds: readonly string[];
}

export interface LearningSignal {
  readonly signalId: string;
  readonly subject: LearningSubject;
  readonly kind: LearningSignalKind;
  readonly scope: string;
  readonly statement: string;
  readonly classification: string;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly baseline: LearningBaseline | null;
  readonly measuredDelta: number | null;
  readonly confidenceState: EvidenceState;
  readonly stability: StabilityClassification;
  readonly regime: string | null;
  readonly causalStatus: CausalStatus;
  readonly provenance: ResearchProvenance;
  readonly lineage: SignalLineage;
  readonly informational: true;
  readonly schemaVersion: 'learning.signal.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Research priorities (§17) — informational, never actions
// ---------------------------------------------------------------------------

export type ResearchPriorityKind =
  | 'INVESTIGATE_VENUE_DETERIORATION' | 'INVESTIGATE_STRATEGY_PRESERVATION_COLLAPSE'
  | 'INVESTIGATE_RECURRING_PARTIAL_FILLS' | 'INVESTIGATE_POLICY_END_TO_END_DIVERGENCE'
  | 'INVESTIGATE_CLASS_DEGRADATION' | 'INVESTIGATE_LEAKAGE_RECURRENCE'
  | 'INVESTIGATE_REGIME_DEPENDENCE' | 'COLLECT_MORE_EVIDENCE';

export interface PriorityRationale {
  readonly impactMagnitude: number;
  readonly recurrence: number;
  readonly uncertainty: number;
  readonly evidenceGap: number;
  readonly instability: number;
  readonly sampleInsufficiency: number;
}

export interface ResearchPriority {
  readonly priorityId: string;
  readonly kind: ResearchPriorityKind;
  readonly subject: LearningSubject;
  readonly statement: string;
  readonly rationale: PriorityRationale;
  readonly score: number;
  readonly rank: number;
  readonly informational: true;
  readonly provenance: ResearchProvenance;
  readonly lineage: {readonly signalIds: readonly string[]};
  readonly schemaVersion: 'learning.priority.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Recommendations (informational)
// ---------------------------------------------------------------------------

export type LearningRecommendationKind =
  | 'MONITOR_SUBJECT' | 'COLLECT_EVIDENCE' | 'RESEARCH_INVESTIGATION'
  | 'REEXAMINE_COMPARABILITY';

export interface LearningRecommendation {
  readonly recommendationId: string;
  readonly kind: LearningRecommendationKind;
  readonly subject: string;
  readonly statement: string;
  readonly reason: string;
  readonly informational: true;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'learning.recommendation.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Feedback to the research plane (§18)
// ---------------------------------------------------------------------------

export type LearningFeedbackKind = 'NEW_RESEARCH_QUERY' | 'EVIDENCE_GAP' | 'PRIORITY_UPDATE';

/** A future Sprint 036 query proposed by learning — informational only. */
export interface ProposedResearchQuery {
  readonly name: string;
  readonly groupBy: string;
  readonly rationale: string;
}

export interface LearningFeedback {
  readonly feedbackId: string;
  readonly kind: LearningFeedbackKind;
  readonly subject: string;
  readonly statement: string;
  readonly proposedQuery: ProposedResearchQuery | null;
  readonly informational: true;
  readonly provenance: ResearchProvenance;
  readonly lineage: {
    readonly signalIds: readonly string[];
    readonly findingIds: readonly string[];
    readonly priorityIds: readonly string[];
  };
  readonly schemaVersion: 'learning.feedback.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Lineage (learning provenance chains)
// ---------------------------------------------------------------------------

export type LearningLineageRelation =
  | 'OBSERVATION_FROM_MEMORY' | 'OBSERVATION_COVERED_BY_FINDING'
  | 'FEATURE_FROM_OBSERVATION'
  | 'SIGNAL_FROM_OBSERVATION' | 'SIGNAL_FROM_FINDING' | 'SIGNAL_FROM_PATTERN'
  | 'SIGNAL_FROM_HYPOTHESIS' | 'PRIORITY_FROM_SIGNAL'
  | 'RECOMMENDATION_FROM_SIGNAL' | 'FEEDBACK_FROM_SIGNAL'
  | 'FEEDBACK_FROM_FINDING' | 'FEEDBACK_FROM_PRIORITY';

export interface LearningLineageEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: LearningLineageRelation;
}

export interface LearningLineage {
  readonly edges: readonly LearningLineageEdge[];
  readonly valid: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (§23) — oship.intelligence-learning.v1
// ---------------------------------------------------------------------------

export type LearningEventType =
  | 'learning-started' | 'observation-created' | 'feature-created'
  | 'cohort-created' | 'baseline-created' | 'strategy-learned'
  | 'opportunity-learned' | 'venue-learned' | 'policy-learned'
  | 'regime-detected' | 'drift-detected' | 'stability-evaluated'
  | 'evidence-evaluated' | 'signal-created' | 'priority-created'
  | 'feedback-created' | 'replay-completed' | 'rejected' | 'fail-closed';

export const LEARNING_EVENT_TYPES: readonly LearningEventType[] = Object.freeze([
  'learning-started', 'observation-created', 'feature-created', 'cohort-created',
  'baseline-created', 'strategy-learned', 'opportunity-learned', 'venue-learned',
  'policy-learned', 'regime-detected', 'drift-detected', 'stability-evaluated',
  'evidence-evaluated', 'signal-created', 'priority-created', 'feedback-created',
  'replay-completed', 'rejected', 'fail-closed',
]);

export interface LearningAuditEvent {
  readonly schemaVersion: 'oship.intelligence-learning.v1';
  readonly eventId: string;
  readonly eventType: LearningEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

export const LEARNING_GENESIS_HASH = '0'.repeat(64);

// ---------------------------------------------------------------------------
// Invariants (§24) — ≥40, hard fail-closed contract
// ---------------------------------------------------------------------------

export interface LearningInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface LearningInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly LearningInvariantCheck[];
  readonly failedCount: number;
}

export const LEARNING_INVARIANT_NAMES: readonly string[] = Object.freeze([
  'DETERMINISTIC_FEATURES', 'FEATURE_PROVENANCE', 'IMMUTABLE_OBSERVATIONS',
  'DETERMINISTIC_COHORTS', 'COMPARABILITY_ENFORCED', 'BASELINE_VALIDITY',
  'MINIMUM_SAMPLE_ENFORCED', 'NO_FABRICATED_CONFIDENCE', 'NO_FABRICATED_PROBABILITY',
  'NO_FABRICATED_EXPECTED_RETURN', 'EVIDENCE_PRESERVATION', 'CONTRADICTION_HANDLING',
  'STRATEGY_LEARNING_DETERMINISM', 'VENUE_LEARNING_DETERMINISM',
  'OPPORTUNITY_LEARNING_DETERMINISM', 'POLICY_LEARNING_DETERMINISM',
  'REGIME_DETERMINISM', 'DRIFT_DETERMINISM', 'STABILITY_DETERMINISM',
  'CAUSAL_SAFETY_ENFORCED', 'ASSOCIATIONAL_ONLY_DEFAULT', 'SIGNAL_IMMUTABILITY',
  'SIGNAL_LINEAGE', 'SIGNAL_EVIDENCE_REFERENCES', 'PRIORITY_DETERMINISM',
  'PRIORITY_INFORMATIONAL_ONLY', 'AFIS_SEMANTICS_PRESERVED',
  'ABL_BACK_LAY_SEMANTICS_PRESERVED', 'CROSS_DOMAIN_COMPARABILITY',
  'REPLAY_BYTE_IDENTITY', 'AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
  'AUDIT_TRUNCATION_DETECTION', 'AUDIT_TAMPER_DETECTION', 'NO_TREASURY_MUTATION',
  'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION', 'NO_AEGIS_MUTATION',
  'NO_EXECUTION_MUTATION', 'NO_STRATEGY_REGISTRY_MUTATION', 'NO_ACTIVE_POLICY_MUTATION',
  'FAIL_CLOSED_ON_MALFORMED_HISTORY', 'FAIL_CLOSED_ON_CONTRADICTORY_EVIDENCE',
  'FAIL_CLOSED_ON_INSUFFICIENT_EVIDENCE', 'COMPLETION_NEVER_EQUALS_PRESERVATION',
  'SIGNAL_INFORMATIONAL_ONLY', 'FEEDBACK_INFORMATIONAL_ONLY',
  'POLICY_CANDIDATE_NEVER_ACTIVE',
]);

// ---------------------------------------------------------------------------
// Configuration contract
// ---------------------------------------------------------------------------

export interface LearningConfigSpec {
  readonly schemaVersion: string;
  readonly minSampleSize: number;
  readonly minComparativeSample: number;
  readonly evidenceFullSample: number;
  readonly strongConfidenceThreshold: number;
  readonly moderateConfidenceThreshold: number;
  readonly weakConfidenceThreshold: number;
  readonly improvementSlopeThreshold: number;
  readonly deteriorationSlopeThreshold: number;
  readonly driftBand: number;
  readonly structuralShiftFactor: number;
  readonly regimeHighBand: number;
  readonly regimeLowBand: number;
  readonly consistencyFloor: number;
  readonly fragileDispersion: number;
  readonly highPreservationThreshold: number;
  readonly lowPreservationThreshold: number;
  readonly highTheoreticalThreshold: number;
  readonly poorRealizationThreshold: number;
  readonly venueStrongBand: number;
  readonly venueWeakBand: number;
  readonly policyDivergenceBand: number;
  readonly priorityWeights: Readonly<Record<
    'impact' | 'recurrence' | 'uncertainty' | 'evidenceGap' | 'instability'
    | 'sampleInsufficiency', number>>;
  readonly freshnessReferenceMs: number;
}

export interface LearningConfigInput
  extends Partial<Omit<LearningConfigSpec, 'priorityWeights' | 'schemaVersion'>> {
  readonly schemaVersion?: string;
  readonly priorityWeights?: Partial<LearningConfigSpec['priorityWeights']>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface LearningInput {
  /** Validated Sprint 036 research result (its invariants must have passed). */
  readonly research: ResearchResult;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface LearningSourceSummary {
  readonly researchAnalysisId: string;
  readonly researchFingerprint: string;
  readonly memoryRecords: number;
  readonly batches: readonly BatchSummary[];
  readonly findings: number;
  readonly patterns: number;
  readonly hypotheses: number;
}

export interface LearningResult {
  readonly analysisId: string;
  readonly timestamp: number;
  readonly schemaVersion: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
  readonly causalPolicy: CausalStatus;
  readonly source: LearningSourceSummary;
  readonly observations: readonly LearningObservation[];
  readonly features: readonly LearningFeatureSet[];
  readonly featureVectors: readonly FeatureVector[];
  readonly cohorts: readonly LearningCohort[];
  readonly baselines: readonly LearningBaseline[];
  readonly regimes: readonly RegimeAssessment[];
  readonly strategyLearning: readonly StrategyLearning[];
  readonly opportunityLearning: readonly OpportunityLearning[];
  readonly venueLearning: readonly VenueLearning[];
  readonly policyLearning: readonly PolicyLearning[];
  readonly leakageLearning: readonly LeakageLearning[];
  readonly drift: readonly DriftAssessment[];
  readonly stability: readonly StabilityAssessment[];
  readonly confidence: readonly ConfidenceAssessment[];
  readonly signals: readonly LearningSignal[];
  readonly priorities: readonly ResearchPriority[];
  readonly recommendations: readonly LearningRecommendation[];
  readonly feedback: readonly LearningFeedback[];
  readonly lineage: LearningLineage;
  readonly auditEvents: readonly LearningAuditEvent[];
  readonly invariants: LearningInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
}
