import {
  AdaptiveControllerState,
  AdaptiveProposal,
  AdaptiveExecutionDecision,
  AppliedAdaptiveAction,
  ControllerResult,
  ControllerStage,
  ControllerStageTrace,
  ExecutionFeedback,
  ExecutionPlan,
  ProposalValidation,
  VenueCandidate,
  VenueHealthState,
  ExecSide,
  ReplanReason,
} from './types';
import {AdaptiveExecutionConfig} from './config';
import {evaluateThresholds} from './thresholds';
import {evaluatePolicies, selectPolicy} from './policies';
import {decide} from './decision';
import {proposeReprice, validateReprice} from './reprice';
import {proposeReslice, validateReslice} from './reslice';
import {proposeReroute, validateReroute} from './reroute';
import {proposeReplan, reviseExecutionPlan, PlanRevision, validateReplan} from './replan';
import {proposeAbort, validateAbort} from './abort';
import {rankVenues} from './reroute';
import {IntelligenceAuditLog, proposalEventType} from './audit';
import {controllerRunId, appliedActionId, controllerResultFingerprintOf} from './ids';

/**
 * Sprint 032 — Adaptive Execution Controller.
 *
 * Deterministic closed-loop lifecycle:
 *
 *   OBSERVE → MEASURE → SCORE → SIGNAL → DECIDE → PROPOSE → VALIDATE
 *          → APPLY → RECORD
 *
 * The controller is NOT an authority. It never mutates Treasury, never mutates
 * Portfolio, never executes live orders, and never bypasses AEGIS or Risk. It
 * observes the canonical ExecutionFeedback and — when adaptation is justified
 * — proposes and applies a revision to the execution plan through the existing
 * Execution authority boundary (data-only revisions with mandatory Risk and
 * AEGIS revalidation references). Emergency stop dominates every adaptive
 * action. Everything is deterministic and replayable.
 */

export interface ControllerInput {
  readonly feedback: ExecutionFeedback;
  readonly plan: ExecutionPlan;
  readonly candidates: readonly VenueCandidate[];
  readonly currentMid: number;
  readonly benchmarkPrice: number;
  readonly emergencyStop: boolean;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly auditLog?: IntelligenceAuditLog;
}

function replanTriggerFor(feedback: ExecutionFeedback): ReplanReason {
  const types = new Set(feedback.signals.map((s) => s.type));
  if (feedback.emergencyStop) return 'EMERGENCY_STOP';
  if (types.has('VENUE_FAILED')) return 'VENUE_UNAVAILABLE';
  if (types.has('LIQUIDITY_DETERIORATION')) return 'LIQUIDITY_REDUCED';
  if (types.has('PRICE_DRIFT')) return 'PRICE_MOVED';
  if (types.has('PARTIAL_FILL')) return 'PARTIAL_FILL';
  if (types.has('ORDER_AGING')) return 'DEADLINE_APPROACHING';
  return 'RISK_CHANGED';
}

export class AdaptiveExecutionController {
  private cycle = 0;
  private lastQualityScore: number | null = null;
  private previousQualityScore: number | null = null;
  private lineage: ExecutionPlan[] = [];
  private decisions: AdaptiveExecutionDecision[] = [];
  private appliedActions: AppliedAdaptiveAction[] = [];
  private venueHealthStates: VenueHealthState[] = [];
  private dedupeKeys = new Set<string>();
  private aborted = false;
  readonly auditLog: IntelligenceAuditLog;

  constructor(readonly config: AdaptiveExecutionConfig) {
    this.auditLog = new IntelligenceAuditLog('controller', 'controller-trace');
  }

  /** Deterministic processing of one feedback cycle through all 9 stages. */
  process(input: ControllerInput): ControllerResult {
    const stages: ControllerStageTrace[] = [];
    let seq = 0;
    const trace = (stage: ControllerStage, ok: boolean, detail: string): void => {
      stages.push(Object.freeze({stage, ok, detail, sequence: seq}));
      seq += 1;
    };

    const feedback = input.feedback;
    const plan = input.plan;
    const audit = input.auditLog ?? this.auditLog;
    const auditFrom = audit.events.length;
    const cycle = this.cycle;

    // ---------------------------------------------------------------- OBSERVE
    const venueStates = feedback.venueHealth;
    this.venueHealthStates = [...venueStates];
    const minVenueHealthScore = venueStates.length > 0 ? Math.min(...venueStates.map((v) => v.score)) : 1;
    const minObservedLiquidity = input.candidates.length > 0
      ? Math.min(...input.candidates.map((c) => c.liquidity))
      : 0;
    trace('OBSERVE', true, `telemetry ${feedback.telemetry.telemetryId} (${feedback.telemetry.orders.length} orders, ${venueStates.length} venues), aging ${feedback.orderAging.agedOrderCount} aged`);

    // ---------------------------------------------------------------- MEASURE
    const priceDriftBps = input.benchmarkPrice > 0
      ? ((input.currentMid - input.benchmarkPrice) / input.benchmarkPrice) * 10_000
      : 0;
    const evaluations = evaluateThresholds({
      telemetry: feedback.telemetry,
      qualityScore: feedback.quality.score,
      minVenueHealthScore,
      minObservedLiquidity,
      priceDriftBps,
      thresholds: this.config.thresholds,
    });
    const breaches = evaluations.filter((e) => e.breached);
    trace('MEASURE', true, `${evaluations.length} thresholds evaluated, ${breaches.length} breached (${breaches.map((b) => b.name).join(', ') || 'none'})`);

    // ---------------------------------------------------------------- SCORE
    this.previousQualityScore = this.lastQualityScore;
    this.lastQualityScore = feedback.quality.score;
    trace('SCORE', true, `quality ${feedback.quality.score.toFixed(4)} (${feedback.quality.grade}), trend ${feedback.quality.trend}`);

    // ---------------------------------------------------------------- SIGNAL
    const signals = feedback.signals;
    const criticalCount = signals.filter((s) => s.severity === 'CRITICAL').length;
    trace('SIGNAL', true, `${signals.length} signals (${criticalCount} critical): ${signals.map((s) => s.type).join(', ') || 'none'}`);

    // ---------------------------------------------------------------- DECIDE
    // Deterministic venue ranking (shared with the reroute proposal engine):
    // the best alternative venue feeds the reroute / replan / abort policies.
    const ranking = rankVenues(input.candidates, this.config);
    const venuesWithRemaining = [...feedback.telemetry.venues].filter((v) => v.remainingQuantity > 0);
    const currentVenue = venuesWithRemaining.length > 0
      ? venuesWithRemaining.sort((a, b) => (a.fillRatio - b.fillRatio) || a.venueId.localeCompare(b.venueId))[0]
      : null;
    const currentVenueId = currentVenue?.venueId ?? plan.routes[0]?.venue ?? 'UNKNOWN';
    const currentVenueScore = ranking.find((r) => r.venueId === currentVenueId)?.score ?? 0;
    const bestAlternativeRank = ranking.find((r) => r.venueId !== currentVenueId && r.eligible) ?? null;
    const bestAlternative = bestAlternativeRank ? input.candidates.find((c) => c.venueId === bestAlternativeRank.venueId) ?? null : null;
    const bestAlternativeScore = bestAlternativeRank?.score ?? 0;

    const deadlineInMs = plan.deadline > 0 ? plan.deadline - input.timestamp : Number.MAX_SAFE_INTEGER;

    const policyVerdicts = evaluatePolicies({
      telemetry: feedback.telemetry,
      quality: feedback.quality,
      signals,
      thresholds: this.config.thresholds,
      thresholdEvaluations: evaluations,
      venueHealth: venueStates,
      candidates: input.candidates,
      bestAlternativeVenueId: bestAlternative?.venueId ?? null,
      bestAlternativeScore,
      currentVenueScore,
      priceDriftBps,
      emergencyStop: input.emergencyStop,
      deadlineInMs,
      remainingQuantity: feedback.telemetry.remainingQuantity,
    });

    const chosenPolicy = selectPolicy(policyVerdicts);
    const decision = decide({
      telemetry: feedback.telemetry,
      quality: feedback.quality,
      signals,
      policies: policyVerdicts,
      parentPlanId: plan.parentPlanId,
      cycle,
      timestamp: input.timestamp,
      emergencyStop: input.emergencyStop,
      configuration: this.config,
      inputState: {
        planFingerprint: plan.fingerprint,
        feedbackFingerprint: feedback.fingerprint,
        currentMid: input.currentMid,
        benchmarkPrice: input.benchmarkPrice,
        candidates: input.candidates.map((c) => c.venueId),
      },
    });
    this.decisions.push(decision);
    trace('DECIDE', true, `action ${decision.action} (confidence ${decision.confidence.toFixed(4)}, severity ${decision.severity}) — ${decision.reason}`);

    audit.record('ADAPTIVE_DECISION', plan.executionPlanId, input.timestamp, {
      decisionId: decision.decisionId,
      action: decision.action,
      confidence: decision.confidence,
      severity: decision.severity,
      cycle,
      signalTypes: signals.map((s) => s.type),
      reason: decision.reason,
      decisionFingerprint: decision.decisionFingerprint,
    });

    // ---------------------------------------------------------------- PROPOSE
    let proposal: AdaptiveProposal | null = null;
    let proposeFailed: string | null = null;
    const tel = feedback.telemetry;

    const primaryRoute = plan.routes[0] ?? null;
    const primarySide: ExecSide = currentVenue
      ? (plan.routes.find((r) => r.venue === currentVenueId)?.side ?? primaryRoute?.side ?? 'BUY')
      : (primaryRoute?.side ?? 'BUY');
    const primaryInstrument = plan.routes.find((r) => r.venue === currentVenueId)?.instrument ?? primaryRoute?.instrument ?? 'UNKNOWN';

    switch (decision.action) {
      case 'KEEP':
        proposal = null;
        break;
      case 'REPRICE': {
        proposal = proposeReprice({
          telemetry: tel,
          quality: feedback.quality,
          config: this.config,
          cycle,
          timestamp: input.timestamp,
          orderScope: currentVenueId,
          venueId: currentVenueId,
          side: primarySide,
          currentPrice: input.currentMid,
          benchmarkPrice: input.benchmarkPrice,
        });
        if (!proposal) proposeFailed = 'reprice within price limits impossible (drift beyond max reprice band) — no proposal';
        break;
      }
      case 'RESLICE': {
        const targetVenue = currentVenueId;
        const liquidity = input.candidates.find((c) => c.venueId === targetVenue)?.liquidity
          ?? input.candidates.reduce((m, c) => Math.max(m, c.liquidity), 0);
        proposal = proposeReslice({
          plan,
          telemetry: tel,
          config: this.config,
          cycle,
          timestamp: input.timestamp,
          targetVenueId: targetVenue,
          observedLiquidity: liquidity,
          referencePrice: input.currentMid > 0 ? input.currentMid : input.benchmarkPrice,
        });
        if (!proposal) proposeFailed = 'nothing to reslice or atomic plan (reslice suppressed to preserve atomic semantics)';
        break;
      }
      case 'REROUTE': {
        const remainingOnVenue = currentVenue?.remainingQuantity ?? tel.remainingQuantity;
        proposal = proposeReroute({
          telemetry: tel,
          config: this.config,
          cycle,
          timestamp: input.timestamp,
          candidates: input.candidates,
          currentVenueId,
          remainingQuantityOnVenue: remainingOnVenue,
          instrumentId: primaryInstrument,
          side: primarySide,
        });
        if (!proposal) proposeFailed = 'no alternative venue provides a superior deterministic score';
        break;
      }
      case 'REPLAN': {
        proposal = proposeReplan({
          plan,
          telemetry: tel,
          config: this.config,
          cycle,
          timestamp: input.timestamp,
          trigger: replanTriggerFor(feedback),
          candidates: input.candidates,
          venueHealth: venueStates,
          now: input.timestamp,
          reason: decision.reason,
          evidence: decision.evidence,
        });
        break;
      }
      case 'ABORT': {
        proposal = proposeAbort({
          telemetry: tel,
          signals,
          cycle,
          timestamp: input.timestamp,
          reason: decision.reason,
          emergencyStop: input.emergencyStop,
          evidence: decision.evidence,
        });
        break;
      }
    }

    if (proposal && proposal.action !== 'ABORT') {
      const type = proposalEventType(proposal.action);
      audit.record(type, plan.executionPlanId, input.timestamp, {
        proposalId: (proposal as {fingerprint: string}).fingerprint,
        cycle,
        reason: proposal.reason,
      });
    }
    trace('PROPOSE', proposal !== null || decision.action === 'KEEP', proposal
      ? `${proposal.action} proposal ${proposal.fingerprint.slice(0, 18)}… — ${proposal.reason}`
      : (proposeFailed ?? 'KEEP — no proposal required'));

    // ---------------------------------------------------------------- VALIDATE
    let validation: ProposalValidation;
    if (decision.action === 'KEEP') {
      validation = Object.freeze({valid: true, violations: [], reason: 'KEEP requires no proposal'});
    } else if (!proposal) {
      validation = Object.freeze({valid: false, violations: [proposeFailed ?? 'no proposal produced'], reason: 'fail closed: proposal could not be constructed'});
    } else {
      const violations: string[] = [];
      if (proposal.executionPlanId !== plan.executionPlanId) violations.push('proposal targets a different plan');
      switch (proposal.action) {
        case 'REPRICE': violations.push(...validateReprice(proposal, this.config).violations); break;
        case 'RESLICE': violations.push(...validateReslice(proposal).violations); break;
        case 'REROUTE': violations.push(...validateReroute(proposal, this.config).violations); break;
        case 'REPLAN': violations.push(...validateReplan(proposal).violations); break;
        case 'ABORT': violations.push(...validateAbort(proposal).violations); break;
      }
      // Deduplicate adaptive actions: one applied action per (plan, cycle).
      const dedupeKey = `${plan.executionPlanId}:${cycle}:${proposal.action}`;
      if (this.dedupeKeys.has(dedupeKey)) violations.push(`duplicate adaptive action ${dedupeKey}`);
      validation = Object.freeze({
        valid: violations.length === 0,
        violations: Object.freeze(violations),
        reason: violations.length === 0 ? 'proposal valid' : `fail closed: ${violations.join('; ')}`,
      });
    }
    trace('VALIDATE', validation.valid, validation.reason);

    // ---------------------------------------------------------------- APPLY
    let applied = false;
    let rejectedReason: string | null = null;
    let revisedPlan: ExecutionPlan | null = null;
    let appliedAction: AppliedAdaptiveAction | null = null;

    if (decision.action === 'KEEP' && validation.valid) {
      applied = true; // KEEP is always "applied" as a no-op on the plan
      appliedAction = Object.freeze({
        actionId: appliedActionId({planId: plan.executionPlanId, cycle, action: 'KEEP'}),
        action: 'KEEP',
        executionPlanId: plan.executionPlanId,
        cycle,
        decisionId: decision.decisionId,
        resultingPlanVersion: plan.version,
        appliedAt: input.timestamp,
        dedupeKey: `${plan.executionPlanId}:${cycle}:KEEP`,
      });
      this.appliedActions.push(appliedAction);
      this.dedupeKeys.add(appliedAction.dedupeKey);
      audit.record('ADAPTIVE_ACTION_APPLIED', plan.executionPlanId, input.timestamp, {
        action: 'KEEP',
        cycle,
        decisionId: decision.decisionId,
        revisedPlanId: null,
        revisedPlanVersion: plan.version,
      });
      trace('APPLY', true, 'KEEP — current execution plan unchanged');
    } else if (validation.valid && proposal) {
      try {
        const remainingByVenue: Record<string, number> = {};
        for (const v of tel.venues) remainingByVenue[v.venueId] = v.remainingQuantity;

        if (proposal.action === 'REPLAN') {
          revisedPlan = (proposal as import('./types').ReplanProposal).revisedPlan;
        } else if (proposal.action === 'ABORT') {
          revisedPlan = reviseExecutionPlan(plan, {
            kind: 'ABORT',
            trigger: 'EMERGENCY_STOP',
            timestamp: input.timestamp,
            note: proposal.reason,
          }, tel.filledQuantity, remainingByVenue);
        } else if (proposal.action === 'REPRICE') {
          const p = proposal as import('./types').RepriceProposal;
          revisedPlan = reviseExecutionPlan(plan, {
            kind: 'REPRICE',
            trigger: 'PRICE_MOVED',
            timestamp: input.timestamp,
            note: p.reason,
            reprice: {venueId: p.venueId, price: p.proposedPrice},
          }, tel.filledQuantity, remainingByVenue);
        } else if (proposal.action === 'RESLICE') {
          const p = proposal as import('./types').ResliceProposal;
          revisedPlan = reviseExecutionPlan(plan, {
            kind: 'RESLICE',
            trigger: 'PARTIAL_FILL',
            timestamp: input.timestamp,
            note: p.reason,
            reslice: {slices: p.slices.map((s) => ({venue: s.venue, instrument: s.instrument, side: s.side, quantity: s.quantity, routeId: s.routeId, delayMs: s.delayMs}))},
          }, tel.filledQuantity, remainingByVenue);
        } else if (proposal.action === 'REROUTE') {
          const p = proposal as import('./types').RerouteProposal;
          revisedPlan = reviseExecutionPlan(plan, {
            kind: 'REROUTE',
            trigger: 'VENUE_UNAVAILABLE',
            timestamp: input.timestamp,
            note: p.reason,
            reroute: {fromVenue: p.fromVenueId, toVenue: p.toVenueId, quantity: p.quantity, instrument: p.instrumentId, side: p.side},
          }, tel.filledQuantity, remainingByVenue);
        }

        applied = true;
        const dedupeKey = `${plan.executionPlanId}:${cycle}:${proposal.action}`;
        appliedAction = Object.freeze({
          actionId: appliedActionId({planId: plan.executionPlanId, cycle, action: proposal.action, revisedPlanId: revisedPlan?.executionPlanId ?? null}),
          action: proposal.action,
          executionPlanId: plan.executionPlanId,
          cycle,
          decisionId: decision.decisionId,
          resultingPlanVersion: revisedPlan ? revisedPlan.version : plan.version,
          appliedAt: input.timestamp,
          dedupeKey,
        });
        this.appliedActions.push(appliedAction);
        this.dedupeKeys.add(dedupeKey);
        if (revisedPlan) this.lineage.push(revisedPlan);
        if (proposal.action === 'ABORT') this.aborted = true;
        trace('APPLY', true, revisedPlan
          ? `${proposal.action} applied → plan-v${revisedPlan.version} ${revisedPlan.executionPlanId} (lineage preserved)`
          : `${proposal.action} applied`);

        audit.record('ADAPTIVE_ACTION_APPLIED', plan.executionPlanId, input.timestamp, {
          action: proposal.action,
          cycle,
          decisionId: decision.decisionId,
          revisedPlanId: revisedPlan?.executionPlanId ?? null,
          revisedPlanVersion: revisedPlan?.version ?? plan.version,
        });
        if (proposal.action === 'ABORT') {
          audit.record('EXECUTION_ABORTED', plan.executionPlanId, input.timestamp, {
            cycle,
            remainingQuantity: tel.remainingQuantity,
            emergencyStop: input.emergencyStop,
            atomicGroupAction: (proposal as import('./types').AbortProposal).atomicGroupAction,
            reason: proposal.reason,
          });
        }
      } catch (e) {
        applied = false;
        rejectedReason = `revision failed closed: ${(e as Error).message}`;
        trace('APPLY', false, rejectedReason);
      }
    } else {
      rejectedReason = validation.valid ? 'no proposal to apply' : validation.reason;
      trace('APPLY', false, `rejected — ${rejectedReason}`);
    }

    if (!applied && decision.action !== 'KEEP') {
      audit.record('ADAPTIVE_ACTION_REJECTED', plan.executionPlanId, input.timestamp, {
        action: decision.action,
        cycle,
        decisionId: decision.decisionId,
        reason: rejectedReason ?? validation.reason,
      });
    }

    // ---------------------------------------------------------------- RECORD
    const cycleEvents = audit.events.slice(auditFrom);
    trace('RECORD', true, `${cycleEvents.length} audit events recorded (chain head ${audit.lastHash.slice(0, 16)}…)`);

    this.cycle += 1;

    const runId = controllerRunId({planId: plan.executionPlanId, cycle, decisionId: decision.decisionId});
    const body = {
      controllerRunId: runId,
      cycle,
      stages: Object.freeze(stages),
      decision,
      proposal,
      validation,
      applied,
      rejectedReason,
      revisedPlan,
      appliedAction,
      auditEvents: Object.freeze(cycleEvents),
    };

    return Object.freeze({
      ...body,
      fingerprint: controllerResultFingerprintOf(body),
    });
  }

  /** Seed the lineage with the initial plan (call before the first cycle). */
  seed(plan: ExecutionPlan): void {
    if (this.lineage.length === 0) this.lineage.push(plan);
  }

  reset(): void {
    this.cycle = 0;
    this.lastQualityScore = null;
    this.previousQualityScore = null;
    this.lineage = [];
    this.decisions = [];
    this.appliedActions = [];
    this.venueHealthStates = [];
    this.dedupeKeys.clear();
    this.aborted = false;
  }

  get state(): AdaptiveControllerState {
    return Object.freeze({
      cycle: this.cycle,
      lastQualityScore: this.lastQualityScore,
      previousQualityScore: this.previousQualityScore,
      lineage: Object.freeze([...this.lineage]),
      decisions: Object.freeze([...this.decisions]),
      appliedActions: Object.freeze([...this.appliedActions]),
      venueHealth: Object.freeze([...this.venueHealthStates]),
      aborted: this.aborted,
    });
  }
}
