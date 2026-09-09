import {
  ExecutionSimAuditRecord,
  ExecutionMetrics,
  SimulationConfig,
  ExecutionSimulationResult,
} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Audit record (`oship.execution-sim.v1`). Reports simulation_id, plan_id,
 * orders, fills, venues, metrics, fees, slippage, latency, market_impact,
 * status, config_versions, timestamp and fingerprint. Everything is derived
 * deterministically from the simulation result.
 */

export function buildExecutionSimAudit(result: ExecutionSimulationResult): ExecutionSimAuditRecord {
  const configVersions: Record<string, string> = {
    simulation_config_version: result.simulationConfig.simulationConfigVersion,
    matching_policy_version: result.simulationConfig.matchingPolicyVersion,
    fee_policy_version: result.simulationConfig.feePolicyVersion,
    latency_policy_version: result.simulationConfig.latencyPolicyVersion,
    slippage_policy_version: result.simulationConfig.slippagePolicyVersion,
    market_impact_policy_version: result.simulationConfig.marketImpactPolicyVersion,
  };

  const fp = sha256({
    simulationId: result.simulationId,
    planId: result.plan.executionPlanId,
    orders: result.orders.map((o) => o.orderId),
    fills: result.fills.map((f) => f.fillId),
    venues: [...new Set(result.fills.map((f) => f.venueId))],
    metrics: result.metrics,
    configVersions,
    status: result.reconciliation.balanced ? 'RECONCILED' : 'FAILED',
  });

  return Object.freeze({
    simulationId: result.simulationId,
    planId: result.plan.executionPlanId,
    orders: Object.freeze(result.orders.map((o) => o.orderId)),
    fills: Object.freeze(result.fills.map((f) => f.fillId)),
    venues: Object.freeze([...new Set(result.fills.map((f) => f.venueId))]),
    metrics: result.metrics,
    fees: result.metrics.fees,
    slippage: result.metrics.slippageBps,
    latency: result.metrics.latencyMs,
    marketImpact: result.metrics.marketImpact,
    status: result.reconciliation.balanced ? 'RECONCILED' : 'FAILED',
    configVersions: Object.freeze(configVersions),
    timestamp: result.timestamp,
    correlationId: result.correlationId,
    traceId: result.traceId,
    fingerprint: fp,
    schemaVersion: 'oship.execution-sim.v1',
  });
}
