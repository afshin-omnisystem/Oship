import {
  ControlCycleSpecInput, ControlCycleSpec, ExecutionControlRunInput,
  ExecutionControlSession, AuthorityStatus,
} from './types';
import {ControlConfigInput} from './config';
import type {ExecutionControlConfigSpec} from './types';
import {ExecutionControlEngine} from './engine';
import {
  intelPlan, intelVenue, intelCycle, intelCandidate, venueForRoute,
  afisCrossVenuePlan, ablBackLayPlan, IntelPlanSpec, IntelVenueSpec,
  IntelCycleSpecInput, IntelCandidateSpec, XI_TEST_TIMESTAMP,
} from '../intelligence/test-fixtures';
import {ExecutionPlan} from '../intelligence/types';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from './config';


/**
 * Sprint 033 — control-plane test fixtures.
 *
 * Thin deterministic wrappers over the Sprint 032 intelligence fixtures (the
 * SAME venue/plan worlds, so scenarios stay comparable across planes) plus
 * the control-specific authority scripts.
 */

export const CONTROL_TEST_TIMESTAMP = XI_TEST_TIMESTAMP;

export type {IntelPlanSpec, IntelVenueSpec, IntelCycleSpecInput, IntelCandidateSpec};
export {intelPlan, intelVenue, intelCycle, intelCandidate, venueForRoute};

/** Build one control cycle spec from venue specs (+ authority scripts). */
export function controlCycle(input: ControlCycleSpecInput): ControlCycleSpec {
  const base = intelCycle(input);
  return Object.freeze({
    ...base,
    riskValidation: (input.riskValidation ?? 'APPROVED') as AuthorityStatus,
    aegisValidation: (input.aegisValidation ?? 'APPROVED') as AuthorityStatus,
  });
}

/** Standard AFIS cross-venue two-leg plan (BUY venue-a / SELL venue-b). */
export function afisCrossVenueControlPlan(): ExecutionPlan {
  return afisCrossVenuePlan();
}

/** Standard ABL back/lay plan (BACK → BUY/long, LAY → SELL/short). */
export function ablBackLayControlPlan(): ExecutionPlan {
  return ablBackLayPlan();
}

export interface ControlRunOptions {
  readonly config?: ControlConfigInput;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly startTime?: number;
  readonly bridge?: ExecutionControlRunInput['bridge'];
  readonly resumeFrom?: ExecutionControlRunInput['resumeFrom'];
}

/** Run the control plane over a plan + cycle specs with sensible defaults. */
export function runControl(
  plan: ExecutionPlan,
  cycles: readonly ControlCycleSpec[],
  options: ControlRunOptions = {},
): ExecutionControlSession {
  const engine = new ExecutionControlEngine(options.config);
  const input: ExecutionControlRunInput = {
    plan,
    cycles,
    startTime: options.startTime ?? CONTROL_TEST_TIMESTAMP,
    correlationId: options.correlationId ?? 'xec-test',
    traceId: options.traceId ?? 'xec-test-trace',
    bridge: options.bridge,
    resumeFrom: options.resumeFrom,
  };
  return engine.run(input, options.resumeFrom ? {resumeFrom: options.resumeFrom} : {});
}

/** Run the control plane with an explicit engine (recovery / replay tests). */
export function runControlWith(
  engine: ExecutionControlEngine,
  plan: ExecutionPlan,
  cycles: readonly ControlCycleSpec[],
  options: ControlRunOptions = {},
): ExecutionControlSession {
  const input: ExecutionControlRunInput = {
    plan,
    cycles,
    startTime: options.startTime ?? CONTROL_TEST_TIMESTAMP,
    correlationId: options.correlationId ?? 'xec-test',
    traceId: options.traceId ?? 'xec-test-trace',
    bridge: options.bridge,
    resumeFrom: options.resumeFrom,
  };
  return engine.run(input, options.resumeFrom ? {resumeFrom: options.resumeFrom} : {});
}

export const DEFAULT_CONTROL_CONFIG: ExecutionControlConfigSpec = DEFAULT_EXECUTION_CONTROL_CONFIG;
