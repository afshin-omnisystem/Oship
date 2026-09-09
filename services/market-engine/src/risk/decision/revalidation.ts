import {RiskDecision, RiskRevalidation} from './types';
import {riskRevalidationId} from './ids';

/**
 * Deterministic risk revalidation. Before approval, freshness is re-checked
 * (opportunity expired, strategy stale, allocation stale, market data stale,
 * risk config changed). Any material change yields a REVALIDATE / REJECT /
 * EXPIRED / STALE using the Control vocabulary; it does not introduce a new
 * action set.
 */

export interface RiskRevalidationInput {
  readonly decisions: readonly RiskDecision[];
  readonly evaluationTime: number;
  readonly riskConfigVersion: string;
  readonly previousRiskConfigVersion: string | undefined;
  readonly controlState: string;
  readonly correlationId: string;
  readonly traceId: string;
}

export function revalidateRisk(input: RiskRevalidationInput): RiskRevalidation {
  const changes: string[] = [];

  if (input.controlState === 'EMERGENCY_STOP' || input.controlState === 'HALTED') changes.push('CONTROL_STOP');
  if (input.previousRiskConfigVersion && input.previousRiskConfigVersion !== input.riskConfigVersion) changes.push('RISK_CONFIG_CHANGED');

  for (const d of input.decisions) {
    if (d.metrics.expired) changes.push(`EXPIRED_${d.candidateId}`);
    else if (d.metrics.stale) changes.push(`STALE_${d.candidateId}`);
    if (d.scale === 'BLOCKED') changes.push(`BLOCKED_${d.candidateId}`);
  }

  const action = input.controlState === 'EMERGENCY_STOP' || input.controlState === 'HALTED'
    ? 'REVALIDATE'
    : changes.some((c) => c.startsWith('EXPIRED_'))
      ? 'EXPIRED'
      : changes.some((c) => c.startsWith('STALE_'))
        ? 'STALE'
        : changes.length > 0
          ? 'REVALIDATE'
          : 'CONTINUE';

  return Object.freeze({
    revalidationId: riskRevalidationId({
      configVersion: input.riskConfigVersion,
      prevConfigVersion: input.previousRiskConfigVersion ?? 'none',
      changes,
      timestamp: input.evaluationTime,
    }),
    action,
    materialChanges: Object.freeze([...changes]),
    reason: changes.length > 0 ? changes.join(';') : 'no material change',
    timestamp: input.evaluationTime,
    correlationId: input.correlationId,
    traceId: input.traceId,
  });
}
