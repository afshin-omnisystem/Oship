import type {
  ClosedLoopProvenance, ClosedLoopValue, OpportunityClass, OpportunityDomain,
  LeakageComponentName, PreservationGrade, RiskImpactKind, ClosedLoopAction,
  ClosedLoopAnalysisResult, ClosedLoopRecordAnalysis,
} from '../closed-loop/types';

// Re-exported Sprint 035 contracts — the research plane never duplicates them.
export type {
  ClosedLoopProvenance, ClosedLoopValue, OpportunityClass, OpportunityDomain,
  LeakageComponentName, PreservationGrade, RiskImpactKind, ClosedLoopAction,
  ClosedLoopAnalysisResult, ClosedLoopRecordAnalysis,
};

/**
 * SPRINT 036 — Unified Historical Intelligence, Research & Learning Plane.
 *
 * Canonical lifecycle: Historical Records → Normalization → Intelligence
 * Memory → Knowledge Graph → Research Queries → Pattern Detection →
 * Comparative Analysis → Hypothesis Generation → Evidence Evaluation →
 * Research Findings → Intelligence Feedback.
 *
 * THIS IS AN ANALYTICAL / RESEARCH LAYER ONLY. It is NOT an authority: it
 * never mutates Treasury, Portfolio, Risk, AEGIS, Execution, the Strategy
 * Registry, active Execution Policies or any provider. Its outputs are
 * deterministic, immutable, replayable research artifacts. It consumes the
 * validated Sprint 035 Closed-Loop Intelligence results and never duplicates
 * their contracts.
 */

// ---------------------------------------------------------------------------
// Provenance — REUSED from Sprint 035 (never duplicated)
// ---------------------------------------------------------------------------

export type ResearchProvenance = ClosedLoopProvenance;
export type ResearchValue<T> = ClosedLoopValue<T>;

export type ResearchSchemaVersion =
  | 'research.memory.v1' | 'research.graph.v1' | 'research.finding.v1'
  | 'research.hypothesis.v1' | 'research.feedback.v1' | 'research.audit.v1';

export const RESEARCH_SCHEMA_VERSION = 'research.v1' as const;

// ---------------------------------------------------------------------------
// Explicit epistemic states — never silently a valid conclusion
// ---------------------------------------------------------------------------

export type EvidenceState =
  | 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT' | 'UNKNOWN'
  | 'CONTRADICTORY' | 'UNAVAILABLE';

export type RejectionKind = 'MALFORMED_HISTORY' | 'CONTRADICTORY_DUPLICATE' | 'INVARIANT_FAILURE';

export interface RejectedHistoryEntry {
  readonly sourceId: string;
  readonly batchId: string;
  readonly kind: RejectionKind;
  readonly reason: string;
  readonly timestamp: number;
}

export type HistoryOutcome = 'COMPLETED' | 'ABORTED' | 'FAILED' | 'EXHAUSTED' | string;

export type FailureClass =
  | 'STALE_INTEL' | 'REROUTE_OSCILLATION' | 'BUDGET_EXHAUSTED' | 'INCOMPLETE_EXECUTION'
  | 'EMERGENCY_STOP' | null;

// ---------------------------------------------------------------------------
// Normalization (§4) — canonical projection of one validated record analysis
// ---------------------------------------------------------------------------

export interface NormalizedValues {
  readonly theoreticalGross: number | null;
  readonly theoreticalNet: number | null;
  readonly realizedGross: number | null;
  readonly realizedCosts: number | null;
  readonly realizedNet: number | null;
  readonly preservationRatio: number | null;
  readonly preservationGrade: PreservationGrade | 'UNAVAILABLE';
  readonly totalLeakage: number | null;
  readonly leakageByComponent: Readonly<Record<LeakageComponentName, number>>;
  /** Leakage components that were UNAVAILABLE upstream — they never carry values. */
  readonly unavailableComponents: readonly LeakageComponentName[];
  readonly topLeakageComponent: LeakageComponentName | null;
  readonly executionQuality: number | null;
  readonly outcome: HistoryOutcome;
  readonly failureClass: FailureClass;
  readonly capitalScale: number | null;
  readonly deployedCapital: number;
  readonly approvedCapital: number;
  readonly adaptiveActions: number;
  readonly rerouteCount: number;
  readonly repriceCount: number;
  readonly resliceCount: number;
  readonly freshness: number;
  readonly confidence: number;
  readonly riskImpact: RiskImpactKind;
  readonly provenance: ResearchProvenance;
}

export interface NormalizedVenueLeg {
  readonly venue: string;
  readonly side: string;
  readonly leakage: number | null;
  /** Sprint 035 side-normalized realized venue result (execution quality). */
  readonly venueResult: number | null;
  readonly fillEfficiency: number | null;
}

export interface NormalizedRecord {
  readonly sourceId: string;
  readonly batchId: string;
  readonly opportunityId: string;
  readonly baseSeries: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly semanticSide: string;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly venueLegs: readonly NormalizedVenueLeg[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly timestamp: number;
  readonly timeBucket: string;
  readonly values: NormalizedValues;
  readonly recordFingerprint: string;
  readonly closedLoopConfigFingerprint: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Intelligence Memory (§3) — immutable, deduplicated, versioned
// ---------------------------------------------------------------------------

export type MemoryStatus = 'ACTIVE' | 'SUPERSEDED' | 'REJECTED';

export interface MemoryLineage {
  readonly batchId: string;
  readonly recordFingerprint: string;
  readonly supersedes: string | null;
  readonly version: number;
  readonly correctionReason: string | null;
}

export interface MemoryRecord {
  readonly memoryId: string;
  readonly sourceId: string;
  readonly sourceType: 'closed-loop.v1';
  readonly sourceFingerprint: string;
  readonly domain: OpportunityDomain;
  readonly opportunityId: string;
  readonly opportunityClass: OpportunityClass;
  readonly semanticSide: string;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly timestamp: number;
  readonly timeBucket: string;
  readonly provenance: ResearchProvenance;
  readonly schemaVersion: 'research.memory.v1';
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  /** Sprint 035 configuration fingerprint — identical metric definitions. */
  readonly closedLoopConfigFingerprint: string;
  readonly lineage: MemoryLineage;
  readonly evidence: {state: EvidenceState; confidence: number};
  readonly values: NormalizedValues;
  readonly venueLegs: readonly NormalizedVenueLeg[];
  readonly status: MemoryStatus;
}

export interface MemoryCorrection {
  readonly sourceId: string;
  readonly reason: string;
  /** Deterministic cost correction (dollars) applied to realized costs. */
  readonly realizedCostDelta: number;
}

export interface IntelligenceMemory {
  readonly records: readonly MemoryRecord[];
  readonly duplicatesIgnored: number;
  readonly rejected: readonly RejectedHistoryEntry[];
  readonly correctionsApplied: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Memory index (§5) — deterministic analytical lookup
// ---------------------------------------------------------------------------

export type MemoryIndexDimension =
  | 'domain' | 'opportunityClass' | 'strategy' | 'venue' | 'policy'
  | 'outcome' | 'preservationGrade' | 'leakageClass' | 'failureClass'
  | 'timeBucket' | 'executionQualityBand';

export type ExecutionQualityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNAVAILABLE';

export interface MemoryIndex {
  readonly dimensions: Readonly<Record<MemoryIndexDimension, Readonly<Record<string, readonly string[]>>>>;
  readonly memoryCount: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Knowledge graph (§6)
// ---------------------------------------------------------------------------

export type KnowledgeNodeType =
  | 'OPPORTUNITY' | 'OPPORTUNITY_CLASS' | 'STRATEGY' | 'VENUE' | 'POLICY'
  | 'RISK_PROFILE' | 'EXECUTION_MODE' | 'OUTCOME' | 'LEAKAGE_TYPE'
  | 'FINDING' | 'HYPOTHESIS' | 'DOMAIN' | 'PATTERN';

export type KnowledgeRelation =
  | 'OPPORTUNITY_USED_STRATEGY' | 'OPPORTUNITY_EXECUTED_AT' | 'OPPORTUNITY_USED_POLICY'
  | 'OPPORTUNITY_RESULTED_IN' | 'OPPORTUNITY_LEAKED_BY' | 'STRATEGY_PERFORMED_ON'
  | 'VENUE_PERFORMED_ON' | 'POLICY_PERFORMED_ON' | 'STRATEGY_OUTPERFORMED'
  | 'VENUE_OUTPERFORMED' | 'PATTERN_SUPPORTS' | 'EVIDENCE_SUPPORTS'
  | 'FINDING_DERIVED_FROM' | 'HYPOTHESIS_SUPPORTED_BY' | 'OPPORTUNITY_CONSTRAINED_BY';

export interface KnowledgeNode {
  readonly nodeId: string;
  readonly type: KnowledgeNodeType;
  readonly key: string;
  readonly fingerprint: string;
}

export interface KnowledgeEdge {
  readonly edgeId: string;
  readonly from: string;
  readonly to: string;
  readonly relation: KnowledgeRelation;
  readonly weight: number;
  readonly fingerprint: string;
}

export interface KnowledgeGraph {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Knowledge entities (aggregated analytical facts)
// ---------------------------------------------------------------------------

export type KnowledgeEntityKind = 'STRATEGY' | 'VENUE' | 'OPPORTUNITY_CLASS' | 'POLICY' | 'DOMAIN';

export interface KnowledgeEntity {
  readonly kind: KnowledgeEntityKind;
  readonly key: string;
  readonly domain: OpportunityDomain | 'MIXED';
  readonly observationCount: number;
  readonly meanPreservation: number | null;
  readonly meanTheoreticalNet: number | null;
  readonly meanRealizedNet: number | null;
  readonly totalLeakage: number | null;
  readonly meanExecutionQuality: number | null;
  readonly completionRate: number | null;
  readonly semanticSides: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly memoryIds: readonly string[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Research queries (§7)
// ---------------------------------------------------------------------------

export interface ResearchQueryFilter {
  readonly domains?: readonly OpportunityDomain[];
  readonly classes?: readonly OpportunityClass[];
  readonly strategies?: readonly string[];
  readonly venues?: readonly string[];
  readonly policies?: readonly string[];
  readonly outcomes?: readonly HistoryOutcome[];
  readonly minPreservation?: number;
  readonly maxPreservation?: number;
  readonly minTheoreticalNet?: number;
  readonly maxLeakage?: number;
  readonly minExecutionQuality?: number;
  readonly from?: number;
  readonly to?: number;
  readonly minEvidenceQuality?: EvidenceState;
  readonly minSampleSize?: number;
}

export type QueryGroupBy = 'none' | 'class' | 'strategy' | 'venue' | 'policy' | 'outcome' | 'timeBucket' | 'domain';

export interface ResearchQuery {
  readonly queryId: string;
  readonly name: string;
  readonly filter: ResearchQueryFilter;
  readonly groupBy: QueryGroupBy;
}

export interface QueryGroupAggregate {
  readonly key: string;
  readonly sampleSize: number;
  readonly meanPreservation: number | null;
  readonly meanTheoreticalNet: number | null;
  readonly meanRealizedNet: number | null;
  readonly totalLeakage: number | null;
  readonly leakageByComponent: Readonly<Record<string, number>>;
  readonly meanExecutionQuality: number | null;
  readonly completionRate: number | null;
  readonly outcomeCounts: Readonly<Record<string, number>>;
  readonly evidenceState: EvidenceState;
  readonly memoryIds: readonly string[];
}

export interface QueryResult {
  readonly queryId: string;
  readonly name: string;
  readonly filter: ResearchQueryFilter;
  readonly groupBy: QueryGroupBy;
  readonly matched: readonly string[];
  readonly sampleSize: number;
  readonly groups: readonly QueryGroupAggregate[];
  readonly insufficientReason: string | null;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Comparative analysis (§8)
// ---------------------------------------------------------------------------

export type ComparisonKind = 'STRATEGY' | 'VENUE' | 'POLICY' | 'CLASS' | 'DOMAIN' | 'PERIOD';

export interface ComparisonMetrics {
  readonly subject: string;
  readonly sampleSize: number;
  readonly meanPreservation: number | null;
  readonly meanRealizedNet: number | null;
  readonly totalLeakage: number | null;
  readonly meanExecutionQuality: number | null;
  readonly completionRate: number | null;
  readonly meanCapitalScale: number | null;
  readonly dominantProvenance: ResearchProvenance | null;
  readonly classes: readonly OpportunityClass[];
  readonly policies: readonly string[];
  readonly memoryIds: readonly string[];
}

export interface ComparisonResult {
  readonly comparisonId: string;
  readonly kind: ComparisonKind;
  readonly subjectA: string;
  readonly subjectB: string;
  readonly scopeClass: OpportunityClass | null;
  readonly normalized: boolean;
  readonly comparable: boolean;
  readonly reasons: readonly string[];
  readonly metricsA: ComparisonMetrics | null;
  readonly metricsB: ComparisonMetrics | null;
  readonly winner: 'A' | 'B' | 'NONE';
  readonly preservationDelta: number | null;
  readonly evidenceState: EvidenceState;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Patterns (§9)
// ---------------------------------------------------------------------------

export type PatternFamily = 'PRESERVATION' | 'LEAKAGE' | 'STRATEGY' | 'VENUE' | 'POLICY' | 'FAILURE';

export type PatternKind =
  | 'CONSISTENTLY_HIGH_PRESERVATION' | 'CONSISTENTLY_LOW_PRESERVATION'
  | 'PRESERVATION_DETERIORATION' | 'PRESERVATION_IMPROVEMENT'
  | 'REPEATED_SLIPPAGE' | 'REPEATED_FEES' | 'REPEATED_PARTIAL_FILL'
  | 'REPEATED_VENUE_LEAKAGE' | 'REPEATED_ALLOCATION_LEAKAGE'
  | 'REPEATED_RISK_CONSTRAINT' | 'REPEATED_CONTROL_LEAKAGE'
  | 'CONSISTENT_OUTPERFORMANCE' | 'COMPLETION_PRESERVATION_DIVERGENCE'
  | 'HIGH_THEORETICAL_POOR_REALIZATION'
  | 'VENUE_SPECIFIC_LEAKAGE' | 'FILL_QUALITY_DEGRADATION' | 'RECURRING_ADVERSE_DRIFT'
  | 'POLICY_IMPROVEMENT_NOT_END_TO_END' | 'POLICY_REGRESSION' | 'POLICY_STABILITY'
  | 'REPEATED_FAILURE_CLASS' | 'RECURRING_CONTRADICTORY_INPUTS' | 'RECURRING_FAIL_CLOSED';

export type PatternSubjectType = 'STRATEGY' | 'VENUE' | 'OPPORTUNITY_CLASS' | 'OPPORTUNITY_SERIES' | 'POLICY';

export interface PatternSubject {
  readonly type: PatternSubjectType;
  readonly key: string;
}

export interface ResearchPattern {
  readonly patternId: string;
  readonly family: PatternFamily;
  readonly kind: PatternKind;
  readonly subject: PatternSubject;
  readonly scope: string;
  readonly evidenceMemoryIds: readonly string[];
  readonly sampleSize: number;
  readonly firstSeen: number;
  readonly lastSeen: number;
  readonly direction: 'IMPROVING' | 'DETERIORATING' | 'STABLE' | null;
  readonly magnitude: number;
  readonly confidenceState: EvidenceState;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Evidence (§11) and hypotheses (§10)
// ---------------------------------------------------------------------------

export interface EvidenceInput {
  readonly subject: string;
  readonly supporting: readonly MemoryRecord[];
  readonly contradicting: readonly MemoryRecord[];
  readonly metric: 'preservation' | 'realizedNet' | 'leakage';
}

export interface EvidenceEvaluation {
  readonly evaluationId: string;
  readonly subject: string;
  readonly supportingCount: number;
  readonly contradictingCount: number;
  readonly score: number | null;
  readonly state: EvidenceState;
  readonly contributors: readonly {memoryId: string; provenance: ResearchProvenance; weight: number}[];
  readonly reason: string;
  readonly fingerprint: string;
}

export type HypothesisStatus =
  | 'PROPOSED' | 'SUPPORTED' | 'WEAKLY_SUPPORTED' | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE' | 'REJECTED';

export interface HypothesisScope {
  readonly domains: readonly OpportunityDomain[];
  readonly classes: readonly OpportunityClass[];
  readonly strategies?: readonly string[];
  readonly venues?: readonly string[];
}

export interface Hypothesis {
  readonly hypothesisId: string;
  readonly statement: string;
  readonly scope: HypothesisScope;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly sampleSize: number;
  readonly confidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly fingerprint: string;
  readonly status: HypothesisStatus;
  readonly evaluationReason: string;
}

// ---------------------------------------------------------------------------
// Findings (§12)
// ---------------------------------------------------------------------------

export interface ResearchFinding {
  readonly findingId: string;
  readonly query: string;
  readonly scope: string;
  readonly result: Readonly<Record<string, unknown>>;
  readonly supportingMemoryIds: readonly string[];
  readonly evidenceScore: number | null;
  readonly confidenceState: EvidenceState;
  readonly provenance: ResearchProvenance;
  readonly createdAt: number;
  readonly configurationFingerprint: string;
  readonly contentFingerprint: string;
  readonly lineage: {batchIds: readonly string[]; patternIds: readonly string[]; hypothesisIds: readonly string[]};
}

// ---------------------------------------------------------------------------
// Ranking (§14)
// ---------------------------------------------------------------------------

export type RankingKind = 'STRATEGY' | 'VENUE' | 'CLASS' | 'POLICY' | 'PATTERN' | 'FINDING' | 'HYPOTHESIS';

export interface RankingEntry {
  readonly subject: string;
  readonly rank: number;
  readonly score: number;
  readonly sampleSize: number;
  readonly evidenceState: EvidenceState;
}

export interface RankingExclusion {
  readonly subject: string;
  readonly reason: string;
}

export interface ResearchRanking {
  readonly rankingId: string;
  readonly kind: RankingKind;
  readonly metric: string;
  readonly entries: readonly RankingEntry[];
  readonly excluded: readonly RankingExclusion[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Intelligence feedback (§13) and research recommendations
// ---------------------------------------------------------------------------

export type FeedbackKind =
  | 'STRATEGY_CANDIDATE_SIGNAL' | 'VENUE_QUALITY_SIGNAL' | 'POLICY_WARNING'
  | 'OPPORTUNITY_CLASS_QUALITY_SIGNAL' | 'LEAKAGE_WARNING' | 'FAILURE_RISK_SIGNAL'
  | 'RESEARCH_PRIORITY';

export interface IntelligenceFeedback {
  readonly feedbackId: string;
  readonly kind: FeedbackKind;
  readonly subject: string;
  readonly statement: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly evidenceMemoryIds: readonly string[];
  readonly informational: true;
  readonly fingerprint: string;
}

export type RecommendationKind = 'COLLECT_MORE_EVIDENCE' | 'REEXAMINE_COMPARABILITY' | 'RESEARCH_PRIORITY';

export interface ResearchRecommendation {
  readonly recommendationId: string;
  readonly kind: RecommendationKind;
  readonly subject: string;
  readonly statement: string;
  readonly reason: string;
  readonly informational: true;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Lineage (research provenance chains)
// ---------------------------------------------------------------------------

export interface ResearchLineageEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'MEMORY_FROM_BATCH' | 'FINDING_FROM_MEMORY' | 'FINDING_FROM_PATTERN'
    | 'HYPOTHESIS_FROM_PATTERN' | 'HYPOTHESIS_FROM_MEMORY' | 'FEEDBACK_FROM_FINDING'
    | 'PATTERN_FROM_MEMORY' | 'FEEDBACK_FROM_MEMORY';
}

export interface ResearchLineage {
  readonly edges: readonly ResearchLineageEdge[];
  readonly valid: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (§19)
// ---------------------------------------------------------------------------

export type ResearchEventType =
  | 'memory-created' | 'memory-linked' | 'normalization-completed' | 'graph-built'
  | 'query-executed' | 'comparison-completed' | 'pattern-detected' | 'hypothesis-created'
  | 'evidence-evaluated' | 'finding-created' | 'feedback-created' | 'replay-completed'
  | 'rejected' | 'fail-closed';

export const RESEARCH_EVENT_TYPES: readonly ResearchEventType[] = Object.freeze([
  'memory-created', 'memory-linked', 'normalization-completed', 'graph-built',
  'query-executed', 'comparison-completed', 'pattern-detected', 'hypothesis-created',
  'evidence-evaluated', 'finding-created', 'feedback-created', 'replay-completed',
  'rejected', 'fail-closed',
]);

export interface ResearchAuditEvent {
  readonly schemaVersion: 'oship.historical-research.v1';
  readonly eventId: string;
  readonly eventType: ResearchEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

export const RESEARCH_GENESIS_HASH = '0'.repeat(64);

export interface AuditVerification {
  readonly valid: boolean;
  readonly events: number;
  readonly reason: string | null;
}

// ---------------------------------------------------------------------------
// Invariants (§20)
// ---------------------------------------------------------------------------

export interface ResearchInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ResearchInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly ResearchInvariantCheck[];
  readonly failedCount: number;
}

export const RESEARCH_INVARIANT_NAMES: readonly string[] = Object.freeze([
  'IMMUTABLE_MEMORY', 'DETERMINISTIC_NORMALIZATION', 'DETERMINISTIC_IDS',
  'DETERMINISTIC_FINGERPRINTS', 'NO_FABRICATED_VALUES', 'UNAVAILABLE_VALUES_REMAIN_UNAVAILABLE',
  'PROVENANCE_PRESERVED', 'LINEAGE_PRESERVED', 'SOURCE_IDENTITY_PRESERVED',
  'GRAPH_DETERMINISM', 'GRAPH_EDGE_VALIDITY', 'NO_ORPHAN_EVIDENCE', 'NO_ORPHAN_FINDING',
  'NO_ORPHAN_HYPOTHESIS', 'COMPARABLE_GROUPS_VALIDATED', 'MINIMUM_SAMPLE_ENFORCED',
  'CONTRADICTORY_EVIDENCE_REJECTED', 'RANKING_DETERMINISTIC', 'QUERY_DETERMINISM',
  'REPLAY_BYTE_IDENTITY', 'AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
  'AUDIT_TRUNCATION_DETECTION', 'AFIS_SEMANTICS_PRESERVED', 'ABL_BACK_LAY_SEMANTICS_PRESERVED',
  'CROSS_DOMAIN_COMPARABILITY_ENFORCED', 'INFORMATIONAL_FEEDBACK_ONLY', 'NO_TREASURY_MUTATION',
  'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION', 'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION',
  'NO_STRATEGY_REGISTRY_MUTATION', 'FAIL_CLOSED_ON_MALFORMED_HISTORY',
  'FAIL_CLOSED_ON_INVALID_RESEARCH_CONCLUSIONS', 'MEMORY_DEDUPLICATION_DETERMINISTIC',
  'MEMORY_INDEX_CONSISTENCY', 'CORRECTION_LINEAGE_PRESERVED', 'HYPOTHESIS_STATUS_CONSISTENCY',
  'FEEDBACK_EVIDENCE_LINKED',
]);

// ---------------------------------------------------------------------------
// Configuration contract
// ---------------------------------------------------------------------------

export interface ResearchConfigSpec {
  readonly schemaVersion: string;
  /** Minimum observations for an entity to be analytically comparable. */
  readonly minSampleSize: number;
  /** Minimum observations on EACH side of a comparison. */
  readonly minComparativeSample: number;
  /** Sample count at which evidence reaches full weight. */
  readonly evidenceFullSample: number;
  readonly strongEvidenceThreshold: number;
  readonly moderateEvidenceThreshold: number;
  readonly weakEvidenceThreshold: number;
  /** Max ratio between mean capital scales of two compared populations. */
  readonly maxCapitalScaleDivergence: number;
  /** Size of a deterministic time bucket (ms). */
  readonly timeBucketMs: number;
  /** Minimum recurrences for a repetition pattern. */
  readonly patternRecurrenceMinimum: number;
  /** Minimum distinct time buckets for a trend pattern. */
  readonly trendMinimumEras: number;
  readonly deteriorationThreshold: number;
  readonly improvementThreshold: number;
  readonly highPreservationThreshold: number;
  readonly lowPreservationThreshold: number;
  readonly highTheoreticalThreshold: number;
  readonly poorRealizationThreshold: number;
  /** Slope band within which a baseline policy counts as STABLE. */
  readonly policyStabilityBand: number;
  readonly rankingWeights: Readonly<Record<'preservation' | 'realizedValue' | 'leakage'
    | 'quality' | 'sampleSize' | 'evidence', number>>;
  readonly freshnessReferenceMs: number;
}

export interface ResearchConfigInput extends Partial<Omit<ResearchConfigSpec, 'rankingWeights' | 'schemaVersion'>> {
  readonly schemaVersion?: string;
  readonly rankingWeights?: Partial<ResearchConfigSpec['rankingWeights']>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface ResearchInput {
  /** Validated Sprint 035 analyses (historical batches). */
  readonly analyses: readonly ClosedLoopAnalysisResult[];
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  /** Explicit corrections — new versions, never in-place mutation. */
  readonly corrections?: readonly MemoryCorrection[];
}

export interface BatchSummary {
  readonly batchId: string;
  readonly records: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly failClosed: boolean;
  readonly reason: string | null;
}

export interface ResearchResult {
  readonly analysisId: string;
  readonly timestamp: number;
  readonly schemaVersion: string;
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
  readonly batches: readonly BatchSummary[];
  readonly memory: IntelligenceMemory;
  readonly index: MemoryIndex;
  readonly graph: KnowledgeGraph;
  readonly entities: readonly KnowledgeEntity[];
  readonly queries: readonly QueryResult[];
  readonly comparisons: readonly ComparisonResult[];
  readonly patterns: readonly ResearchPattern[];
  readonly hypotheses: readonly Hypothesis[];
  readonly evidence: readonly EvidenceEvaluation[];
  readonly findings: readonly ResearchFinding[];
  readonly rankings: readonly ResearchRanking[];
  readonly feedback: readonly IntelligenceFeedback[];
  readonly recommendations: readonly ResearchRecommendation[];
  readonly lineage: ResearchLineage;
  readonly auditEvents: readonly ResearchAuditEvent[];
  readonly invariants: ResearchInvariantReport;
  readonly replay: {identical: boolean; fingerprint: string};
}
