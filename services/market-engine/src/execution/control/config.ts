import {ExecutionControlConfigSpec} from './types';
import {controlConfigurationFingerprint} from './ids';
import {DEFAULT_ADAPTIVE_CONFIG} from '../intelligence/config';

/**
 * Sprint 033 — Execution Control configuration. Every threshold is explicit,
 * validated and fingerprinted: identical configuration → identical
 * fingerprint → identical decisions.
 */

export const DEFAULT_EXECUTION_CONTROL_CONFIG: ExecutionControlConfigSpec = Object.freeze({
  controlConfigVersion: 'execution-control.config.v1',
  budgets: Object.freeze({
    maxCycles: 12,
    maxReprices: 3,
    maxReslices: 3,
    maxReroutes: 3,
    maxReplans: 3,
    maxFailures: 3,
    maxExecutionTimeMs: 60_000,
  }),
  limits: Object.freeze({
    maxSlippageBps: 200,
    maxImpactNotional: 5_000,
    maxLatencyMs: 2_000,
  }),
  oscillation: Object.freeze({
    detectionWindow: 6,
    maxConsecutiveSameAction: 3,
    maxConsecutiveReroutes: 3,
    onDetection: 'ABORT',
  }),
  hysteresis: Object.freeze({
    qualityHighThreshold: 0.85,
    qualityDegradeThreshold: 0.6,
    qualityRecoverThreshold: 0.75,
    waitOnVenueRecovery: true,
    sameActionCooldownCycles: 0,
  }),
  wait: Object.freeze({
    waitOnImprovingTrend: true,
  }),
  abortOnAllVenuesStale: true,
  adaptive: DEFAULT_ADAPTIVE_CONFIG,
});

/** Deep-partial configuration input accepted by the engine constructor. */
export type ControlConfigInput = {
  readonly controlConfigVersion?: string;
  readonly budgets?: Partial<ExecutionControlConfigSpec['budgets']>;
  readonly limits?: Partial<ExecutionControlConfigSpec['limits']>;
  readonly oscillation?: Partial<ExecutionControlConfigSpec['oscillation']>;
  readonly hysteresis?: Partial<ExecutionControlConfigSpec['hysteresis']>;
  readonly wait?: Partial<ExecutionControlConfigSpec['wait']>;
  readonly abortOnAllVenuesStale?: boolean;
  readonly adaptive?: ExecutionControlConfigSpec['adaptive'];
};

/** Merge a partial input over the defaults into a full validated spec. */
export function mergeControlConfig(input: ControlConfigInput = {}): ExecutionControlConfigSpec {
  return Object.freeze({
    ...DEFAULT_EXECUTION_CONTROL_CONFIG,
    ...input,
    budgets: Object.freeze({...DEFAULT_EXECUTION_CONTROL_CONFIG.budgets, ...input.budgets}),
    limits: Object.freeze({...DEFAULT_EXECUTION_CONTROL_CONFIG.limits, ...input.limits}),
    oscillation: Object.freeze({...DEFAULT_EXECUTION_CONTROL_CONFIG.oscillation, ...input.oscillation}),
    hysteresis: Object.freeze({...DEFAULT_EXECUTION_CONTROL_CONFIG.hysteresis, ...input.hysteresis}),
    wait: Object.freeze({...DEFAULT_EXECUTION_CONTROL_CONFIG.wait, ...input.wait}),
    adaptive: input.adaptive ?? DEFAULT_EXECUTION_CONTROL_CONFIG.adaptive,
  });
}

/** Validate a control configuration. Returns violation strings (empty = ok). */
export function validateExecutionControlConfig(config: ExecutionControlConfigSpec): readonly string[] {
  const errs: string[] = [];
  const b = config.budgets;
  if (!(b.maxCycles > 0)) errs.push('maxCycles must be > 0');
  for (const [name, value] of Object.entries({
    maxReprices: b.maxReprices, maxReslices: b.maxReslices, maxReroutes: b.maxReroutes,
    maxReplans: b.maxReplans, maxFailures: b.maxFailures, maxExecutionTimeMs: b.maxExecutionTimeMs,
  })) {
    if (!(value >= 0)) errs.push(`${name} must be ≥ 0`);
  }
  const l = config.limits;
  if (!(l.maxSlippageBps > 0)) errs.push('maxSlippageBps must be > 0');
  if (!(l.maxImpactNotional >= 0)) errs.push('maxImpactNotional must be ≥ 0');
  if (!(l.maxLatencyMs > 0)) errs.push('maxLatencyMs must be > 0');
  const o = config.oscillation;
  if (!(o.detectionWindow >= 2)) errs.push('detectionWindow must be ≥ 2');
  if (!(o.maxConsecutiveSameAction >= 2)) errs.push('maxConsecutiveSameAction must be ≥ 2');
  if (!(o.maxConsecutiveReroutes >= 2)) errs.push('maxConsecutiveReroutes must be ≥ 2');
  if (o.onDetection !== 'ABORT' && o.onDetection !== 'REPLAN') errs.push('onDetection must be ABORT or REPLAN');
  const h = config.hysteresis;
  if (!(h.qualityDegradeThreshold > 0 && h.qualityDegradeThreshold <= 1)) errs.push('qualityDegradeThreshold must be in (0,1]');
  if (!(h.qualityRecoverThreshold >= h.qualityDegradeThreshold && h.qualityRecoverThreshold <= 1)) errs.push('qualityRecoverThreshold must be ≥ degrade threshold and ≤ 1');
  if (!(h.qualityHighThreshold >= h.qualityRecoverThreshold && h.qualityHighThreshold <= 1)) errs.push('qualityHighThreshold must be ≥ recover threshold and ≤ 1');
  if (!(h.sameActionCooldownCycles >= 0)) errs.push('sameActionCooldownCycles must be ≥ 0');
  if (!config.adaptive) errs.push('adaptive configuration is required');
  return Object.freeze(errs);
}

/** Fingerprint of the exact control configuration (part of every decision). */
export function executionControlConfigurationFingerprint(config: ExecutionControlConfigSpec): string {
  return controlConfigurationFingerprint(config);
}
