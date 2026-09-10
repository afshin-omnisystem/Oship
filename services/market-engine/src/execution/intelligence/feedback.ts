import {
  ExecutionFeedback,
  ExecutionTelemetry,
  ExecutionSignal,
  ExecutionQualityAssessment,
  VenueHealthState,
  OrderAgingAssessment,
} from './types';
import {feedbackId, feedbackFingerprintOf} from './ids';
import {ExecutionSimulationResult} from '../../simulation/execution/types';

/**
 * Sprint 032 — Unified Feedback Loop.
 *
 * The ExecutionFeedback object connects one simulation result to its telemetry,
 * signals and quality assessment:
 *
 *   Simulation Result → Telemetry → Signals → Quality → Adaptive Decision
 *
 * It is the canonical, immutable input to the AdaptiveExecutionController.
 */

export interface FeedbackInput {
  readonly simulation: Pick<ExecutionSimulationResult, 'simulationId'> | {simulationId: string};
  readonly planId: string;
  readonly cycle: number;
  readonly timestamp: number;
  readonly sequence: number;
  readonly domain: ExecutionTelemetry['domain'];
  readonly strategyType: string;
  readonly telemetry: ExecutionTelemetry;
  readonly signals: readonly ExecutionSignal[];
  readonly quality: ExecutionQualityAssessment;
  readonly venueHealth: readonly VenueHealthState[];
  readonly orderAging: OrderAgingAssessment;
  readonly emergencyStop: boolean;
}

/** Build the immutable unified feedback object. */
export function buildFeedback(input: FeedbackInput): ExecutionFeedback {
  const planId = input.planId;
  const body = {
    feedbackId: feedbackId({planId, cycle: input.cycle, telemetry: input.telemetry.fingerprint, timestamp: input.timestamp}),
    executionPlanId: planId,
    simulationId: input.simulation.simulationId,
    cycle: input.cycle,
    timestamp: input.timestamp,
    sequence: input.sequence,
    domain: input.domain,
    strategyType: input.strategyType,
    telemetry: input.telemetry,
    signals: Object.freeze([...input.signals]),
    quality: input.quality,
    venueHealth: Object.freeze([...input.venueHealth]),
    orderAging: input.orderAging,
    emergencyStop: input.emergencyStop,
  };

  return Object.freeze({
    ...body,
    fingerprint: feedbackFingerprintOf(body),
  });
}
