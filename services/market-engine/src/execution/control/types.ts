import {
  ExecutionTelemetry,
  ExecutionSignal,
  ExecutionQualityAssessment,
  VenueHealthState,
  ExecutionPlan,
  AdaptiveAction,
  DecisionEvidence,
  AdaptiveProposal,
  VenueCandidate,
  AdaptiveCycleSpec,
} from '../intelligence/types';
import {AdaptiveExecutionConfig} from '../intelligence/config';
import {PlanRevision} from '../intelligence/replan';
import type {ReplanReason} from '../planning/types';
import {ThresholdEvaluation} from '../intelligence/thresholds';

/**
 * Sprint 033 — Unified Autonomous Execution Control Plane.
 *
 * A deterministic control layer over the Sprint 032 adaptive execution
 * intelligence: an explicit control state machine, per-action budgets, hard
 * limits, multi-cycle feedback analysis (trend / oscillation / recovery),
 * control hysteresis, deterministic completion and abort engines, narrow
 * authority bridges (Risk / AEGIS / Execution), checkpointing, recovery and
 * byte-equivalent replay.
 *
 * HARD RULES (structurally enforced):
 * - PAPER / SIMULATION ONLY. No live trading, no exchange/broker/bookmaker
 *   APIs, no provider credentials, no real money.
 * - THE CONTROL PLANE IS NOT AN AUTHORITY. It requests validation and submits
 *   revisions through narrow bridges; it never mutates Treasury or Portfolio,
 *   never overrides Risk, never bypasses AEGIS, never executes directly.
 * - FAIL CLOSED. Emergency stop dominates every autonomous action.
 * - Every decision deterministic; every cycle replayable; every action carries
 *   explicit evidence and reason.
 * - Original Execution Plans stay immutable; revisions preserve parent/child
 *   lineage; total target quantity never silently changes.
 */

// ---------------------------------------------------------------------------
// Control state machine
// ---------------------------------------------------------------------------

export type ExecutionControlState =
  | 'INITIALIZED'
  | 'OBSERVING'
  | 'EVALUATING'
  | 'DECIDING'
  | 'VALIDATING'
  | 'EXECUTING'
  | 'WAITING_FEEDBACK'
  | 'REASSESSING'
  | 'REPLANNING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'EXHAUSTED';

/** One recorded state transition (immutable, audited). */
export interface ControlStateTransition {
  readonly from: ExecutionControlState;
  readonly to: ExecutionControlState;
  readonly reason: string;
  readonly cycleNumber: number;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Control decisions
// ---------------------------------------------------------------------------

export type ControlAction =
  | 'CONTINUE'
  | 'REPRICE'
  | 'RESLICE'
  | 'REROUTE'
  | 'REPLAN'
  | 'WAIT'
  | 'COMPLETE'
  | 'ABORT';

/** Canonical abort reasons (fixed vocabulary). */
export type ControlAbortReason =
  | 'EMERGENCY_STOP'
  | 'RISK_LIMIT'
  | 'AEGIS_REJECTED'
  | 'BUDGET_EXHAUSTED'
  | 'EXCESSIVE_SLIPPAGE'
  | 'EXCESSIVE_IMPACT'
  | 'EXCESSIVE_LATENCY'
  | 'VENUE_UNAVAILABLE'
  | 'OSCILLATION_DETECTED'
  | 'STALE_MARKET'
  | 'UNRECOVERABLE_PLAN'
  | 'INVARIANT_FAILURE';

/**
 * Deterministic precedence ranks (lower wins). Safety can never be overridden
 * by optimization; completion only wins when nothing else applies.
 */
export type ControlPrecedence =
  | 'EMERGENCY_STOP'        // rank 0
  | 'HARD_RISK_VIOLATION'   // rank 1
  | 'AEGIS_REJECTION'       // rank 2
  | 'ABORT'                 // rank 3
  | 'REPLAN'                // rank 4
  | 'REROUTE'               // rank 5
  | 'REPRICE'               // rank 6 (REPRICE / RESLICE share the tier)
  | 'RESLICE'               // rank 6
  | 'WAIT'                  // rank 8
  | 'CONTINUE'              // rank 9
  | 'COMPLETE';             // rank 10

export const CONTROL_PRECEDENCE_RANK: Readonly<Record<ControlPrecedence, number>> = Object.freeze({
  EMERGENCY_STOP: 0,
  HARD_RISK_VIOLATION: 1,
  AEGIS_REJECTION: 2,
  ABORT: 3,
  REPLAN: 4,
  REROUTE: 5,
  REPRICE: 6,
  RESLICE: 6,
  WAIT: 8,
  CONTINUE: 9,
  COMPLETE: 10,
});

/** One candidate verdict considered by the control decision. */
export interface ControlVerdict {
  readonly precedence: ControlPrecedence;
  readonly action: ControlAction;
  readonly reason: string;
  readonly detail: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly abortReason?: ControlAbortReason;
  /** The Sprint 032 adaptive action this verdict maps from, if any. */
  readonly adaptiveAction?: AdaptiveAction;
}

export interface ExecutionControlDecision {
  readonly decisionId: string;
  readonly cycleNumber: number;
  readonly action: ControlAction;
  readonly precedence: ControlPrecedence;
  readonly rank: number;
  readonly reason: string;
  readonly detail: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly abortReason: ControlAbortReason | null;
  readonly waitReason: string | null;
  readonly adaptiveAction: AdaptiveAction | null;
  readonly considered: readonly ControlVerdict[];
  readonly configurationFingerprint: string;
  readonly inputFingerprint: string;
  readonly decisionFingerprint: string;
}

// ---------------------------------------------------------------------------
// Budgets and limits
// ---------------------------------------------------------------------------

/** Hard budgets — the controller stops or aborts when exhausted. */
export interface ControlBudgetSpec {
  readonly maxCycles: number;
  readonly maxReprices: number;
  readonly maxReslices: number;
  readonly maxReroutes: number;
  readonly maxReplans: number;
  readonly maxFailures: number;
  readonly maxExecutionTimeMs: number;
}

/** Hard observation limits — breaches abort with an explicit reason. */
export interface ControlLimitSpec {
  readonly maxSlippageBps: number;
  readonly maxImpactNotional: number;
  readonly maxLatencyMs: number;
}

export interface ControlBudgetState {
  readonly cycleCount: number;
  readonly repriceCount: number;
  readonly resliceCount: number;
  readonly rerouteCount: number;
  readonly replanCount: number;
  readonly failureCount: number;
  readonly elapsedMs: number;
}

export interface ActionUsage {
  readonly action: ControlAction;
  readonly current: number;
  readonly maximum: number;
  readonly remaining: number;
}

export interface BudgetRejection {
  readonly allowed: false;
  readonly reason: string;
  readonly usage: ActionUsage;
}

export type BudgetDecision = {allowed: true; budget: ControlBudgetState} | BudgetRejection;

export interface LimitViolation {
  readonly limit: 'maxSlippageBps' | 'maxImpactNotional' | 'maxLatencyMs';
  readonly abortReason: ControlAbortReason;
  readonly observed: number;
  readonly maximum: number;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// Multi-cycle feedback, oscillation, hysteresis
// ---------------------------------------------------------------------------

/** Compact, immutable per-cycle observation used for cross-cycle analysis. */
export interface CycleObservation {
  readonly cycleNumber: number;
  readonly fillRatio: number;
  readonly qualityScore: number;
  readonly slippageBps: number;
  readonly latencyMs: number;
  readonly action: ControlAction;
  readonly decisionReason: string;
  readonly applied: boolean;
  readonly failed: boolean;
  readonly rerouteFrom: string | null;
  readonly rerouteTo: string | null;
}

export type ExecutionTrend = 'IMPROVING' | 'DEGRADING' | 'STABLE';

export type OscillationKind =
  | 'VENUE_FLIP_FLOP'
  | 'REPEATED_ACTION'
  | 'ACTION_PING_PONG';

export interface OscillationDetection {
  readonly detected: boolean;
  readonly kind: OscillationKind | null;
  readonly pattern: readonly string[];
  readonly window: number;
  readonly detail: string;
}

export interface MultiCycleFeedback {
  readonly trend: ExecutionTrend;
  readonly trendDelta: number;
  readonly vsBaseline: 'ABOVE' | 'BELOW' | 'AT';
  readonly baselineScore: number;
  readonly oscillation: OscillationDetection;
  readonly repeatedFailure: boolean;
  readonly repeatedReroutes: boolean;
  readonly repeatedReprices: boolean;
  readonly diminishingImprovement: boolean;
  readonly recovery: boolean;
}

/** Control-level quality band with hysteresis (recovery ≠ degradation). */
export type QualityBand = 'HIGH_QUALITY' | 'NORMAL' | 'DEGRADED';

// ---------------------------------------------------------------------------
// Authority bridges
// ---------------------------------------------------------------------------

export type AuthorityStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

export interface AuthorityValidation {
  readonly authority: 'RISK' | 'AEGIS';
  readonly status: AuthorityStatus;
  readonly reason: string;
  readonly authorityRef: string | null;
}

export interface AuthorityGateInput {
  readonly plan: ExecutionPlan;
  readonly cycleNumber: number;
  readonly telemetry: ExecutionTelemetry;
  readonly emergencyStop: boolean;
}

/** Narrow bridge to the Risk authority: request validation, never override. */
export interface RiskGate {
  validateExecution(input: AuthorityGateInput): AuthorityValidation;
}

/** Narrow bridge to the AEGIS boundary: request validation, never bypass. */
export interface AegisGate {
  validateExecution(input: AuthorityGateInput): AuthorityValidation;
}

export interface RevisionSubmissionInput {
  readonly plan: ExecutionPlan;
  readonly decisionId: string;
  readonly cycleNumber: number;
  readonly revision: PlanRevision;
  readonly filledQuantity: number;
  readonly remainingByVenue: Readonly<Record<string, number>>;
}

export interface RevisionSubmission {
  readonly accepted: boolean;
  readonly resultingPlan: ExecutionPlan | null;
  readonly authorityRef: string | null;
  readonly rejectionReason: string | null;
}

/**
 * Narrow bridge to the Execution authority: the ONLY path through which the
 * control plane submits execution revisions. There is deliberately no
 * Treasury or Portfolio method on this interface — Treasury mutation remains
 * outside the control plane entirely.
 */
export interface ExecutionAuthorityBridge {
  submitRevision(input: RevisionSubmissionInput): RevisionSubmission;
}

export interface ControlAuthorityBridge {
  readonly risk: RiskGate;
  readonly aegis: AegisGate;
  readonly execution: ExecutionAuthorityBridge;
  /** Structural marker: no Treasury/Portfolio surface exists on the bridge. */
  readonly treasuryMutation: false;
  readonly portfolioMutation: false;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export interface CompletionCondition {
  readonly name: string;
  readonly met: boolean;
  readonly detail: string;
}

export interface CompletionEvaluation {
  readonly complete: boolean;
  readonly partial: boolean;
  readonly remainingQuantity: number;
  readonly filledQuantity: number;
  readonly conditions: readonly CompletionCondition[];
}

// ---------------------------------------------------------------------------
// Control cycles
// ---------------------------------------------------------------------------

export interface ControlCycleResult {
  readonly applied: boolean;
  readonly action: ControlAction;
  readonly revisedPlan: ExecutionPlan | null;
  readonly rejectionReason: string | null;
  readonly budgetAfter: ControlBudgetState;
  readonly proposal: AdaptiveProposal | null;
  readonly validation: {valid: boolean; violations: readonly string[]};
  readonly riskValidation: AuthorityValidation;
  readonly aegisValidation: AuthorityValidation;
  readonly stateTransitions: readonly ControlStateTransition[];
  readonly feedback: MultiCycleFeedback;
  readonly qualityBand: QualityBand;
}

export interface ExecutionControlCycle {
  readonly cycleId: string;
  readonly executionPlanId: string;
  readonly parentCycleId: string | null;
  readonly cycleNumber: number;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly state: ExecutionControlState;
  readonly telemetry: ExecutionTelemetry;
  readonly signals: readonly ExecutionSignal[];
  readonly quality: ExecutionQualityAssessment;
  readonly venueHealth: readonly VenueHealthState[];
  readonly decision: ExecutionControlDecision;
  readonly action: ControlAction;
  readonly result: ControlCycleResult;
  readonly configurationFingerprint: string;
  readonly inputFingerprint: string;
  readonly outputFingerprint: string;
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

export type ControlEventType =
  | 'SESSION_STARTED'
  | 'STATE_CHANGED'
  | 'CYCLE_COMPLETED'
  | 'CONTROL_DECISION'
  | 'ACTION_APPLIED'
  | 'ACTION_REJECTED'
  | 'CHECKPOINT_RECORDED'
  | 'SESSION_RECOVERED'
  | 'SESSION_COMPLETED'
  | 'SESSION_ABORTED'
  | 'SESSION_EXHAUSTED'
  | 'REPLAY_COMPLETED';

export const CONTROL_EVENT_TYPES: readonly ControlEventType[] = Object.freeze([
  'SESSION_STARTED', 'STATE_CHANGED', 'CYCLE_COMPLETED', 'CONTROL_DECISION',
  'ACTION_APPLIED', 'ACTION_REJECTED', 'CHECKPOINT_RECORDED', 'SESSION_RECOVERED',
  'SESSION_COMPLETED', 'SESSION_ABORTED', 'SESSION_EXHAUSTED', 'REPLAY_COMPLETED',
]);

export interface ControlAuditEvent {
  readonly eventId: string;
  readonly schemaVersion: 'oship.execution-control.v1';
  readonly eventType: ControlEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly executionPlanId: string;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

export interface ControlCheckpoint {
  readonly checkpointId: string;
  readonly executionPlanId: string;
  readonly cycleNumber: number;
  readonly controlState: ExecutionControlState;
  readonly remainingQuantity: number;
  readonly actionBudget: ControlBudgetState;
  readonly venueState: readonly VenueHealthState[];
  readonly qualityState: {score: number; grade: string; band: QualityBand};
  readonly riskState: AuthorityValidation;
  readonly aegisState: AuthorityValidation;
  readonly lineage: readonly {executionPlanId: string; version: number; parentPlanId: string | null}[];
  /** Full plan lineage (root → … → currentPlan) so recovery is byte-equivalent. */
  readonly lineagePlans: readonly ExecutionPlan[];
  readonly appliedActionKeys: readonly string[];
  readonly currentPlan: ExecutionPlan;
  readonly auditEvents: readonly ControlAuditEvent[];
  readonly observations: readonly CycleObservation[];
  readonly stateHistory: readonly ControlStateTransition[];
  readonly lastAction: ControlAction | null;
  readonly cyclesSinceLastAction: number;
  /** Completed cycle journal (root → checkpoint) so recovery is byte-equivalent. */
  readonly completedCycles: readonly ExecutionControlCycle[];
  /** Earlier checkpoints (0 … k-1) so the recovered session is byte-equivalent. */
  readonly priorCheckpoints: readonly ControlCheckpoint[];
  /** The deterministic sequence counter to resume from. */
  readonly nextSequence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type ControlFinalState = 'COMPLETED' | 'ABORTED' | 'EXHAUSTED';

export interface ControlSessionResult {
  readonly finalState: ControlFinalState;
  readonly abortReason: ControlAbortReason | null;
  readonly partial: boolean;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly cyclesExecuted: number;
  readonly detail: string;
}

export interface ExecutionControlSession {
  readonly sessionId: string;
  readonly rootExecutionPlanId: string;
  readonly cycles: readonly ExecutionControlCycle[];
  readonly currentState: ExecutionControlState;
  readonly stateHistory: readonly ControlStateTransition[];
  readonly actionBudget: ControlBudgetState;
  readonly lineage: readonly ExecutionPlan[];
  readonly finalResult: ControlSessionResult | null;
  readonly checkpoints: readonly ControlCheckpoint[];
  readonly auditEvents: readonly ControlAuditEvent[];
  readonly configurationFingerprint: string;
  readonly sessionFingerprint: string;
}

// ---------------------------------------------------------------------------
// Engine input
// ---------------------------------------------------------------------------

/** One market world + control flags for one control cycle. */
export interface ControlCycleSpecInput {
  readonly label: string;
  readonly venueSpecs: readonly import('../intelligence/test-fixtures').IntelVenueSpec[];
  readonly emergencyStop?: boolean;
  readonly aegisAuthorized?: boolean;
  readonly treasuryAuthorized?: boolean;
  readonly benchmarkPrice?: number;
  readonly elapsedMs?: number;
  /** Deterministic gate script consumed by the default authority bridge. */
  readonly riskValidation?: AuthorityStatus;
  readonly aegisValidation?: AuthorityStatus;
}

export interface ControlCycleSpec extends AdaptiveCycleSpec {
  readonly riskValidation: AuthorityStatus;
  readonly aegisValidation: AuthorityStatus;
}

export interface ExecutionControlRunInput {
  readonly plan: ExecutionPlan;
  readonly cycles: readonly ControlCycleSpec[];
  readonly startTime: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly bridge?: ControlAuthorityBridge;
  /** Resume deterministically from a verified checkpoint. */
  readonly resumeFrom?: ControlCheckpoint | null;
}

export interface ExecutionControlConfigSpec {
  readonly controlConfigVersion: string;
  readonly budgets: ControlBudgetSpec;
  readonly limits: ControlLimitSpec;
  readonly oscillation: {
    readonly detectionWindow: number;
    readonly maxConsecutiveSameAction: number;
    readonly maxConsecutiveReroutes: number;
    readonly onDetection: 'ABORT' | 'REPLAN';
  };
  readonly hysteresis: {
    readonly qualityHighThreshold: number;   // ≥ → HIGH_QUALITY
    readonly qualityDegradeThreshold: number; // < → DEGRADED
    readonly qualityRecoverThreshold: number; // ≥ (from DEGRADED) → NORMAL
    readonly waitOnVenueRecovery: boolean;
    readonly sameActionCooldownCycles: number;
  };
  readonly wait: {
    readonly waitOnImprovingTrend: boolean;
  };
  readonly abortOnAllVenuesStale: boolean;
  readonly adaptive: AdaptiveExecutionConfig;
}

export type {ExecutionTelemetry, ExecutionSignal, ExecutionQualityAssessment, VenueHealthState, ExecutionPlan, AdaptiveAction, DecisionEvidence, AdaptiveProposal, VenueCandidate, PlanRevision, ReplanReason};
