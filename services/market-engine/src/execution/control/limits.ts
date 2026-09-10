import {ControlLimitSpec, LimitViolation, ExecutionTelemetry} from './types';

/**
 * Sprint 033 — hard control limits.
 *
 * Unlike Sprint 032 thresholds (advisory signals feeding policies), these are
 * hard abort limits: an observed slippage / impact / latency beyond the
 * configured maximum aborts the session with an explicit reason. Checked
 * every cycle, deterministic, fail closed.
 */

export interface HardLimitEvaluation {
  readonly violations: readonly LimitViolation[];
  readonly ok: boolean;
}

export function evaluateHardLimits(
  telemetry: ExecutionTelemetry,
  limits: ControlLimitSpec,
): HardLimitEvaluation {
  const violations: LimitViolation[] = [];

  const absSlippage = Math.abs(telemetry.slippageBps);
  if (absSlippage > limits.maxSlippageBps) {
    violations.push({
      limit: 'maxSlippageBps',
      abortReason: 'EXCESSIVE_SLIPPAGE',
      observed: absSlippage,
      maximum: limits.maxSlippageBps,
      detail: `slippage ${absSlippage.toFixed(2)}bps exceeds hard limit ${limits.maxSlippageBps}bps`,
    });
  }

  const impact = telemetry.impact;
  if (impact > limits.maxImpactNotional) {
    violations.push({
      limit: 'maxImpactNotional',
      abortReason: 'EXCESSIVE_IMPACT',
      observed: impact,
      maximum: limits.maxImpactNotional,
      detail: `market impact ${impact.toFixed(2)} exceeds hard limit ${limits.maxImpactNotional.toFixed(2)}`,
    });
  }

  const latency = telemetry.latencyMs;
  if (latency > limits.maxLatencyMs) {
    violations.push({
      limit: 'maxLatencyMs',
      abortReason: 'EXCESSIVE_LATENCY',
      observed: latency,
      maximum: limits.maxLatencyMs,
      detail: `latency ${latency.toFixed(2)}ms exceeds hard limit ${limits.maxLatencyMs}ms`,
    });
  }

  return Object.freeze({violations: Object.freeze(violations), ok: violations.length === 0});
}
