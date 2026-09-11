import type {
  LearningResult, EvidenceState, CausalStatus, ResearchProvenance,
} from '../learning/types';
import type {OpportunityDomain, OpportunityClass} from '../closed-loop/types';
import type {
  OpportunityCandidate, CandidateVenueLeg, CandidateMarket, CandidateSide,
  OpportunityIntelligenceProfile, EvidenceConfidence, EvidenceBoundScore,
  HistoricalOutcomeDistribution, DependencyAnalysis, StabilityInterpretation,
  OpportunityIntelligenceConfigSpec, LearningObservation,
} from '../opportunity/types';

/**
 * SPRINT 039 — Unified Decision Intelligence & Counterfactual Evaluation
 * Engine.
 *
 * THE DECISION INTELLIGENCE ENGINE IS AN ANALYTICAL DECISION-SUPPORT LAYER,
 * NOT AN AUTHORITY AND NOT AN ORACLE. It transforms an Opportunity
 * Intelligence Profile into a deterministic, evidence-bound Decision
 * Intelligence Context that compares multiple hypothetical alternatives
 * WITHOUT EXECUTING ANY ACTION.
 *
 * Counterfactual means: "What does the existing evidence say about this
 * alternative if this alternative had been selected?" — NEVER "What will
 * happen in the future?" No probabilities, no expected profit, no expected
 * ROI, no future prices, no future odds, no future execution success, no
 * guaranteed outcomes, no guaranteed edges are ever manufactured.
 *
 * Lifecycle: Opportunity → Opportunity Intelligence → Decision Context →
 * Candidate Alternatives → Counterfactual Evaluation → Trade-off Analysis →
 * Evidence-Bound Recommendation → Research / Strategy Input.
 *
 * The engine preserves the boundary:
 *   Evidence → Analysis → Comparison → Recommendation
 * It is NOT: Evidence → Prediction → Certainty → Execution.
 */

export type {LearningResult, LearningObservation, EvidenceState, CausalStatus,
  ResearchProvenance};
export type {OpportunityDomain, OpportunityClass};
export type {OpportunityCandidate, CandidateVenueLeg, CandidateMarket,
  CandidateSide, OpportunityIntelligenceProfile, EvidenceConfidence,
  EvidenceBoundScore, HistoricalOutcomeDistribution, DependencyAnalysis,
  StabilityInterpretation, OpportunityIntelligenceConfigSpec};

// ---------------------------------------------------------------------------
// Alternatives (§4) — hypothetical variations of one opportunity
// ---------------------------------------------------------------------------

/** What an alternative varies, by kind. */
export type AlternativeKind =
  | 'BASELINE'      // the opportunity exactly as received
  | 'STRATEGY'      // same opportunity under a different strategy
  | 'VENUE'         // different venue composition
  | 'EXECUTION'     // conservative vs aggressive execution configuration
  | 'SIDE'          // ABL BACK-oriented vs LAY-oriented (sides swapped)
  | 'MARKET'        // ABL market/selection identity variant
  | 'HANDLING';     // other valid opportunity handling modes

/** A hypothetical alternative specification — never an instruction. */
export interface AlternativeSpec {
  readonly alternativeId: string;
  readonly label: string;
  readonly kind: AlternativeKind;
  /** Must equal the base candidate's candidateId. */
  readonly baseCandidateId: string;
  /** Strategy override — must be valid for the base domain. */
  readonly strategyId?: string | null;
  /** Venue-set override — canonically sorted unique venues. */
  readonly venues?: readonly string[] | null;
  /** Venue-leg override — sides/odds semantics are domain-scoped. */
  readonly venueLegs?: readonly CandidateVenueLeg[] | null;
  /** ABL market identity override. */
  readonly marketId?: string | null;
  /** ABL selection identity override. */
  readonly selectionId?: string | null;
  /** Market/execution-condition overrides (spread, indices). */
  readonly marketOverrides?: Partial<CandidateMarket> | null;
  /** Why this alternative is considered — reconstructibility input. */
  readonly rationale: string;
}

export type AlternativeRejectionCode =
  | 'MALFORMED_ALTERNATIVE' | 'MISSING_ALTERNATIVE_IDENTITY'
  | 'UNKNOWN_ALTERNATIVE_KIND' | 'DUPLICATE_ALTERNATIVE_ID'
  | 'BASE_CANDIDATE_MISMATCH' | 'DOMAIN_MISMATCH'
  | 'CROSS_DOMAIN_COMPARISON' | 'CLASS_MISMATCH'
  | 'INVALID_STRATEGY' | 'INVALID_VENUE' | 'INVALID_SIDE_SEMANTICS'
  | 'INVALID_ODDS' | 'INVALID_MARKET_IDENTITY' | 'INCOMPATIBLE_UNITS'
  | 'NON_CANONICAL_ORDER' | 'AMBIGUOUS_SEMANTIC_MAPPING'
  | 'EMPTY_ALTERNATIVE_VARIATION' | 'NON_DETERMINISTIC_SPEC';

export interface RejectedAlternative {
  readonly alternativeId: string;
  readonly code: AlternativeRejectionCode;
  readonly reason: string;
  readonly schemaVersion: 'decision-intelligence.rejection.v1';
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Compatibility (§5) — alternatives must be comparable to the base
// ---------------------------------------------------------------------------

export type CompatibilityState = 'COMPATIBLE' | 'NOT_COMPARABLE';

export interface CompatibilityCheck {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface CompatibilityAssessment {
  readonly alternativeId: string;
  readonly state: CompatibilityState;
  readonly checks: readonly CompatibilityCheck[];
  readonly reason: string | null;
  readonly compatibilityId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Counterfactual evaluation (§6) — evidence under the hypothetical selection
// ---------------------------------------------------------------------------

/** Evidence gaps of one alternative's counterfactual. */
export interface EvidenceGap {
  readonly dimension: string;
  readonly detail: string;
}

/** A counterfactual evaluation — descriptive, never predictive. */
export interface CounterfactualEvaluation {
  readonly alternativeId: string;
  readonly baseCandidateId: string;
  readonly kind: AlternativeKind;
  readonly label: string;
  readonly rationale: string;
  /** The hypothetical candidate this evaluation describes. */
  readonly counterfactualCandidate: OpportunityCandidate;
  /** The full Sprint 038 profile of the hypothetical candidate. */
  readonly profile: OpportunityIntelligenceProfile;
  /** Similar cohort size backing the evaluation. */
  readonly cohortSize: number;
  /** Evidence confidence of the underlying profile. */
  readonly confidenceState: EvidenceConfidence;
  /** Historical realization quality (measured nets only), null if none. */
  readonly realizationQuality: number | null;
  /** Historical preservation quality of the cohort, null if none. */
  readonly meanPreservation: number | null;
  /** Leakage-adjusted analytical quality (counted exactly once). */
  readonly leakageAdjustedQuality: number | null;
  /** Stability interpretation of the underlying evidence. */
  readonly stability: StabilityInterpretation;
  /** Dependency analysis carried through unchanged. */
  readonly dependencies: DependencyAnalysis;
  /** Evidence gaps — what the evidence does NOT cover. */
  readonly evidenceGaps: readonly EvidenceGap[];
  /** Explicit conflicts in the underlying evidence. */
  readonly conflicts: readonly string[];
  /** Descriptive-only marker: counterfactuals never simulate futures. */
  readonly counterfactualOnly: true;
  readonly counterfactualId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Analyses (§10-20 of the spec) — regime / strategy / venue / leakage /
// stability / evidence structure across alternatives
// ---------------------------------------------------------------------------

export interface DependencyAxisAnalysis {
  readonly axis: 'REGIME' | 'STRATEGY' | 'VENUE';
  /** Whether the alternatives separate on this axis at all. */
  readonly alternativesDiffer: boolean;
  /** Dependency detected in the underlying profiles. */
  readonly detected: boolean;
  /** The per-alternative groups that drive the dependency. */
  readonly perAlternative: readonly {
    readonly alternativeId: string;
    readonly detected: boolean;
    readonly spread: number | null;
    readonly groups: readonly string[];
  }[];
  /** Applicable regimes / supported strategies / venues — never generalized. */
  readonly applicable: readonly string[];
  readonly analysisId: string;
  readonly contentFingerprint: string;
}

export interface LeakageAlternativeAnalysis {
  readonly alternativeId: string;
  readonly apparentQuality: number | null;
  readonly realizedQuality: number | null;
  readonly leakageBurden: number | null;
  readonly leakageAdjustedQuality: number | null;
  readonly leakageShare: number | null;
  /** True when leakage is already inside realized quality upstream. */
  readonly countedOnce: true;
}

export interface LeakageAxisAnalysis {
  readonly perAlternative: readonly LeakageAlternativeAnalysis[];
  /** Highest-leakage alternative id, null when unmeasurable. */
  readonly highestLeakageAlternativeId: string | null;
  readonly analysisId: string;
  readonly contentFingerprint: string;
}

export interface StabilityAlternativeAnalysis {
  readonly alternativeId: string;
  readonly interpretation: StabilityInterpretation;
  readonly stabilityFactor: number | null;
}

export interface StabilityAxisAnalysis {
  readonly perAlternative: readonly StabilityAlternativeAnalysis[];
  /** True when any alternative's evidence is stability-limited. */
  readonly anyInsufficientHistory: boolean;
  readonly analysisId: string;
  readonly contentFingerprint: string;
}

export interface EvidenceAlternativeAnalysis {
  readonly alternativeId: string;
  readonly evidenceCount: number;
  readonly confidenceState: EvidenceConfidence;
  readonly completeness: number;
  readonly gaps: readonly EvidenceGap[];
  readonly conflicts: readonly string[];
}

export interface EvidenceAxisAnalysis {
  readonly perAlternative: readonly EvidenceAlternativeAnalysis[];
  /** Unresolved conflicts across alternatives — never forced to a winner. */
  readonly unresolvedConflicts: readonly string[];
  /** Shared evidence gaps across ALL alternatives. */
  readonly sharedGaps: readonly string[];
  readonly analysisId: string;
  readonly contentFingerprint: string;
}

/** Descriptive pairwise historical comparison — observed facts only. */
export interface AlternativeComparison {
  readonly leftAlternativeId: string;
  readonly rightAlternativeId: string;
  readonly leftEvidenceCount: number;
  readonly rightEvidenceCount: number;
  readonly leftMeanPreservation: number | null;
  readonly rightMeanPreservation: number | null;
  /** left − right preservation delta, null when either side unmeasurable. */
  readonly preservationDelta: number | null;
  readonly leftRealizationQuality: number | null;
  readonly rightRealizationQuality: number | null;
  readonly comparable: boolean;
  readonly descriptiveOnly: true;
  readonly comparisonId: string;
  readonly contentFingerprint: string;
}

export interface HistoricalComparisonAnalysis {
  readonly comparisons: readonly AlternativeComparison[];
  readonly analysisId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Trade-off engine (§8) — explicit, auditable, config-weighted dimensions
// ---------------------------------------------------------------------------

export type TradeOffDimension =
  | 'evidenceQuality' | 'historicalPreservation' | 'realizationQuality'
  | 'stability' | 'regimeFit' | 'strategyFit' | 'venueFit' | 'leakageBurden'
  | 'freshness' | 'sampleAdequacy' | 'comparability' | 'evidenceCompleteness';

export interface TradeOffComponent {
  readonly dimension: TradeOffDimension;
  readonly value: number | null;
  readonly configuredWeight: number;
  readonly effectiveWeight: number;
  readonly contribution: number | null;
}

export interface TradeOffScore {
  readonly alternativeId: string;
  readonly score: number | null;
  readonly components: readonly TradeOffComponent[];
  readonly contributingDimensions: number;
  readonly tradeOffId: string;
  readonly contentFingerprint: string;
}

export interface TradeOffAnalysis {
  readonly scores: readonly TradeOffScore[];
  /** Score ordering used for dominance/ranking (score desc, id asc). */
  readonly orderedAlternativeIds: readonly string[];
  readonly tradeOffId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Dominance (§9) — genuinely better supported by evidence, never guaranteed
// ---------------------------------------------------------------------------

export type DominanceState =
  | 'DOMINANT_BY_EVIDENCE' | 'WEAKLY_PREFERRED' | 'NO_DOMINANT_OPTION'
  | 'INSUFFICIENT_EVIDENCE' | 'NOT_COMPARABLE' | 'CONFLICTED'
  | 'REGIME_DEPENDENT' | 'STRATEGY_DEPENDENT' | 'VENUE_DEPENDENT' | 'MIXED';

export interface DominanceAnalysis {
  readonly state: DominanceState;
  /** Best-supported alternative id, null when no candidate qualifies. */
  readonly dominantAlternativeId: string | null;
  /** Deterministic ordered reasons — the full decision chain. */
  readonly reasons: readonly string[];
  /** Score margin between the top two scoreable alternatives, null if <2. */
  readonly topMargin: number | null;
  /** Alternatives excluded from dominance consideration and why. */
  readonly exclusions: readonly {readonly alternativeId: string;
    readonly reason: string}[];
  readonly dominanceId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Classification (§9/§10) and ranking (§21)
// ---------------------------------------------------------------------------

export type DecisionClassification =
  | 'PREFERRED_BY_EVIDENCE' | 'ALTERNATIVE' | 'NO_DOMINANT_OPTION'
  | 'INSUFFICIENT_EVIDENCE' | 'NOT_COMPARABLE' | 'CONFLICTED';

export interface AlternativeRankingEntry {
  readonly alternativeId: string;
  readonly tradeOffScore: number;
  readonly rank: number;
}

export interface AlternativeRankingExclusion {
  readonly alternativeId: string;
  readonly reason: string;
}

export interface AlternativeRanking {
  readonly domain: OpportunityDomain;
  readonly entries: readonly AlternativeRankingEntry[];
  readonly excluded: readonly AlternativeRankingExclusion[];
  readonly rankingId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Recommendation (§10) — evidence-bound, informational only
// ---------------------------------------------------------------------------

export const RECOMMENDATION_DISCLAIMER = 'This is an evidence-bound analytical '
  + 'recommendation, not a probability, forecast, expected return, guarantee, '
  + 'or execution instruction.';

export interface Recommendation {
  readonly status: DecisionClassification;
  /** Selected alternative id, null unless PREFERRED_BY_EVIDENCE/ALTERNATIVE. */
  readonly selectedAlternativeId: string | null;
  readonly dominanceState: DominanceState;
  /** Evidence supporting the selected alternative. */
  readonly supportingEvidence: readonly string[];
  /** Evidence against / limiting the selected alternative. */
  readonly opposingEvidence: readonly string[];
  /** Score/trade-off breakdown of the selected alternative. */
  readonly tradeOffBreakdown: readonly TradeOffComponent[];
  readonly evidenceGaps: readonly EvidenceGap[];
  /** Dependency state carried into the recommendation. */
  readonly dependencyState: readonly string[];
  readonly explanation: readonly string[];
  readonly informational: true;
  readonly disclaimer: string;
  readonly recommendationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Scenario matrix (§11) — Alternative × Evidence × Regime × Strategy × Venue
// ---------------------------------------------------------------------------

export type ScenarioSupportState =
  | 'SUPPORTED'      // historical evidence exists and is adequate
  | 'LIMITED'        // some evidence exists but below sufficiency
  | 'INSUFFICIENT'   // explicitly not enough evidence
  | 'INCOMPATIBLE'   // combination is semantically illegal for the domain
  | 'UNKNOWN';       // no evidence and not inferable — never guessed

export interface ScenarioCell {
  readonly alternativeId: string;
  readonly regimeEra: number;
  readonly regimeTimeBucket: string;
  readonly strategyId: string;
  readonly venue: string;
  readonly evidenceState: ScenarioSupportState;
  readonly evidenceCount: number;
  readonly meanPreservation: number | null;
  readonly supportingObservationIds: readonly string[];
}

export interface ScenarioMatrix {
  readonly domain: OpportunityDomain;
  readonly cells: readonly ScenarioCell[];
  /** Combinations explicitly marked unsupported — nothing inferred. */
  readonly incompatibleCombinations: readonly string[];
  readonly matrixId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Explanation (§22) — every decision reconstructible
// ---------------------------------------------------------------------------

export interface DecisionExplanation {
  readonly decisionId: string;
  readonly summary: string;
  /** Why each alternative was evaluated (from its rationale). */
  readonly alternativeRationales: readonly {
    readonly alternativeId: string; readonly rationale: string;
    readonly evaluated: boolean; readonly outcome: string}[];
  /** Why alternatives were accepted/rejected. */
  readonly acceptanceDecisions: readonly string[];
  /** Evidence for / against each alternative. */
  readonly evidenceFor: readonly {readonly alternativeId: string;
    readonly points: readonly string[]}[];
  readonly evidenceAgainst: readonly {readonly alternativeId: string;
    readonly points: readonly string[]}[];
  readonly strongestDimensions: readonly TradeOffDimension[];
  readonly weakestDimensions: readonly TradeOffDimension[];
  readonly regimeEffects: readonly string[];
  readonly strategyEffects: readonly string[];
  readonly venueEffects: readonly string[];
  readonly leakageEffects: readonly string[];
  readonly stabilityEffects: readonly string[];
  readonly evidenceGaps: readonly EvidenceGap[];
  readonly conflictConditions: readonly string[];
  readonly recommendationRationale: readonly string[];
  readonly explanationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Research context (§23) — informational only
// ---------------------------------------------------------------------------

export interface DecisionResearchQuestion {
  readonly question: string;
  readonly rationale: string;
  readonly priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DecisionResearchContext {
  readonly decisionContextId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly baseCandidateId: string;
  readonly candidateAlternativeIds: readonly string[];
  readonly rejectedAlternativeIds: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly unresolvedConflicts: readonly string[];
  readonly regimeQuestions: readonly DecisionResearchQuestion[];
  readonly strategyQuestions: readonly DecisionResearchQuestion[];
  readonly venueQuestions: readonly DecisionResearchQuestion[];
  readonly recommendedPriorities: readonly DecisionResearchQuestion[];
  readonly informational: true;
  readonly researchContextId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Decision Context (§3) — the canonical context of one decision
// ---------------------------------------------------------------------------

export interface DecisionContext {
  readonly contextId: string;
  readonly baseCandidateId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly receivedAt: number;
  /** The Sprint 038 profile of the base opportunity. */
  readonly baseProfile: OpportunityIntelligenceProfile;
  readonly historicalEvidenceCount: number;
  readonly evidenceQualitySummary: string;
  readonly similaritySummary: string;
  readonly regimeSummary: string;
  readonly strategySummary: string;
  readonly venueSummary: string;
  readonly leakageSummary: string;
  readonly stabilitySummary: string;
  readonly supportedAlternativeIds: readonly string[];
  readonly rejectedAlternativeIds: readonly string[];
  readonly comparabilityState: CompatibilityState;
  readonly configurationFingerprint: string;
  readonly engineVersion: string;
  readonly informational: true;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Feedback (§24) — capture for later learning, never rewrite
// ---------------------------------------------------------------------------

export interface DecisionFeedbackRecord {
  readonly feedbackId: string;
  readonly decisionContextId: string;
  readonly recommendationId: string;
  readonly selectedAlternativeId: string | null;
  readonly status: DecisionClassification;
  readonly alternativeSet: readonly string[];
  readonly evidenceState: EvidenceConfidence;
  readonly informational: true;
  readonly schemaVersion: 'decision-intelligence.feedback.v1';
  readonly contentFingerprint: string;
}

export interface DecisionObservedOutcome {
  /** Which alternative was actually selected downstream (informational). */
  readonly selectedAlternativeId: string;
  readonly realizedNet: number;
  readonly observedRegimeEra: number | null;
  readonly observedStrategyId: string | null;
  readonly observedVenue: string | null;
  readonly observedLeakage: number | null;
}

export type DivergenceKind =
  | 'AGREEMENT' | 'RECOMMENDED_BUT_NEGATIVE' | 'SPURNED_ALTERNATIVE_POSITIVE'
  | 'INSUFFICIENT_RECOMMENDATION' | 'UNDETERMINABLE';

export interface OutcomeDivergence {
  readonly divergenceId: string;
  readonly decisionContextId: string;
  readonly recommendationId: string;
  readonly recommendationStatus: DecisionClassification;
  readonly recommendedAlternativeId: string | null;
  readonly observed: DecisionObservedOutcome;
  readonly kind: DivergenceKind;
  readonly regimeMismatch: boolean | null;
  readonly strategyMismatch: boolean | null;
  readonly venueMismatch: boolean | null;
  readonly leakageMismatch: boolean | null;
  readonly stabilityMismatch: boolean | null;
  readonly evidenceGap: string | null;
  /** Informational drift observation — never rewrites decisions or audit. */
  readonly driftSignal: string | null;
  readonly informational: true;
  readonly schemaVersion: 'decision-intelligence.divergence.v1';
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (§26) — oship.decision-intelligence.v1
// ---------------------------------------------------------------------------

export type DecisionEventType =
  | 'context-created' | 'alternative-added' | 'alternative-rejected'
  | 'compatibility-evaluated' | 'counterfactual-evaluated'
  | 'evidence-evaluated' | 'tradeoff-evaluated' | 'dominance-evaluated'
  | 'recommendation-generated' | 'explanation-generated'
  | 'research-context-generated' | 'feedback-recorded' | 'replay-completed'
  | 'fail-closed';

export const DECISION_EVENT_TYPES: readonly DecisionEventType[] = Object.freeze([
  'context-created', 'alternative-added', 'alternative-rejected',
  'compatibility-evaluated', 'counterfactual-evaluated', 'evidence-evaluated',
  'tradeoff-evaluated', 'dominance-evaluated', 'recommendation-generated',
  'explanation-generated', 'research-context-generated', 'feedback-recorded',
  'replay-completed', 'fail-closed',
]);

export const DECISION_GENESIS_HASH = '0'.repeat(64);

export interface DecisionAuditEvent {
  readonly schemaVersion: 'oship.decision-intelligence.v1';
  readonly eventId: string;
  readonly eventType: DecisionEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§29) — ≥50 hard fail-closed checks
// ---------------------------------------------------------------------------

export interface DecisionInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface DecisionInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly DecisionInvariantCheck[];
  readonly failedCount: number;
}

// ---------------------------------------------------------------------------
// Engine input / result
// ---------------------------------------------------------------------------

export interface DecisionIntelligenceInput {
  /** The raw base candidate — validated fail-closed via Sprint 038 rules. */
  readonly baseCandidate: unknown;
  /** Hypothetical alternative specs; the BASELINE is auto-derived. */
  readonly alternatives: readonly AlternativeSpec[];
  /** The validated Sprint 037 learning result, consumed read-only. */
  readonly learning: LearningResult;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface DecisionLineage {
  readonly contextId: string;
  readonly baseProfileId: string;
  readonly counterfactualIds: readonly string[];
  readonly observationIds: readonly string[];
  readonly learningAnalysisId: string;
  readonly valid: true;
}

export interface DecisionSourceSummary {
  readonly learningAnalysisId: string;
  readonly learningFingerprint: string;
  readonly baseProfileId: string;
  readonly opportunityAnalysisId: string;
}

export interface DecisionIntelligenceResult {
  readonly analysisId: string;
  readonly timestamp: number;
  readonly schemaVersion: 'oship.decision-intelligence.v1';
  readonly correlationId: string;
  readonly traceId: string;
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
  readonly causalPolicy: CausalStatus;
  readonly source: DecisionSourceSummary;
  readonly context: DecisionContext;
  /** Accepted (compatible) alternatives incl. the baseline, in spec order. */
  readonly alternatives: readonly CounterfactualEvaluation[];
  readonly rejectedAlternatives: readonly RejectedAlternative[];
  readonly compatibility: readonly CompatibilityAssessment[];
  readonly historicalComparison: HistoricalComparisonAnalysis;
  readonly regimeAnalysis: DependencyAxisAnalysis;
  readonly strategyAnalysis: DependencyAxisAnalysis;
  readonly venueAnalysis: DependencyAxisAnalysis;
  readonly leakageAnalysis: LeakageAxisAnalysis;
  readonly stabilityAnalysis: StabilityAxisAnalysis;
  readonly evidenceAnalysis: EvidenceAxisAnalysis;
  readonly tradeoff: TradeOffAnalysis;
  readonly scenarioMatrix: ScenarioMatrix;
  readonly dominance: DominanceAnalysis;
  readonly ranking: AlternativeRanking;
  readonly recommendation: Recommendation;
  readonly explanation: DecisionExplanation;
  readonly researchContext: DecisionResearchContext;
  readonly feedback: readonly DecisionFeedbackRecord[];
  readonly reconciliations: readonly OutcomeDivergence[];
  readonly lineage: DecisionLineage;
  readonly auditEvents: readonly DecisionAuditEvent[];
  readonly invariants: DecisionInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
}

// ---------------------------------------------------------------------------
// Configuration contracts
// ---------------------------------------------------------------------------

export interface DecisionIntelligenceConfigSpec {
  readonly schemaVersion: 'decision-intelligence.config.v1';
  /** Trade-off score ≥ this over the runner-up → DOMINANT_BY_EVIDENCE. */
  readonly dominantMargin: number;
  /** Trade-off score ≥ this over the runner-up → WEAKLY_PREFERRED. */
  readonly weakMargin: number;
  /** Score gap below this between the top two → NO_DOMINANT_OPTION tie. */
  readonly tieBand: number;
  /** Minimum cohort size for an alternative to qualify for dominance. */
  readonly minDominanceCohort: number;
  /** Trade-off dimension-strength shares for explanations. */
  readonly strongDimensionShare: number;
  readonly weakDimensionShare: number;
  /** Trade-off dimension weights — auditable, renormalized to the simplex. */
  readonly tradeOffWeights: Readonly<Record<TradeOffDimension, number>>;
  /** The Sprint 038 configuration used for counterfactual profiles. */
  readonly opportunityConfig: OpportunityIntelligenceConfigSpec;
}

export type DecisionIntelligenceConfigInput = Partial<
  Omit<DecisionIntelligenceConfigSpec,
    'schemaVersion' | 'tradeOffWeights' | 'opportunityConfig'>
> & {
  readonly tradeOffWeights?: Partial<Record<TradeOffDimension, number>>;
  readonly opportunityConfig?: OpportunityIntelligenceConfigSpec;
};

export const DECISION_ENGINE_VERSION = 'oship.decision-intelligence.engine.v1';
