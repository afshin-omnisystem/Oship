import type {ClosedLoopRecord, ExecutionAttribution} from './types';
import {executionAttributionId, derived, unavailable, measured} from './ids';
import {realizedComponents} from './value';
import {recordSessionView} from './performance';

/**
 * SPRINT 035 — execution attribution (§11).
 *
 * Consumes Sprint 034 Performance Intelligence: quality, fees, spread,
 * slippage, market impact, latency, partial fills, reroutes, reprices,
 * reslices, replans, failures, recovery. Execution leakage is the opportunity
 * value available for execution minus the value delivered by execution —
 * where data permits, honestly.
 */

export function executionAttribution(record: ClosedLoopRecord): ExecutionAttribution {
  const o = record.opportunity;
  const session = record.session.session;
  const view = recordSessionView(record);
  const attribution = view.attribution;

  const component = (name: string): number => {
    const c = attribution?.components.find((x) => x.component === name);
    return c && c.available ? c.value : 0;
  };
  const componentAvailable = (name: string): boolean => {
    const c = attribution?.components.find((x) => x.component === name);
    return !!c && c.available;
  };

  const cycles = session.cycles;
  const countAction = (action: string): number => cycles.filter((c) => c.action === action).length;
  const fr = session.finalResult;

  const fees = cycles.reduce((s, c) => s + c.telemetry.fees, 0);

  // Value available for execution = theoretical gross edge at scale.
  const realized = realizedComponents(record);
  const availableForExecution = realized.theoreticalGrossAtScale.value;
  const delivered = realized.realizedGrossValue.value;

  const executionLeakage = availableForExecution !== null && delivered !== null
    ? measured(Math.max(0, availableForExecution - delivered),
      'theoreticalGrossAtScale − realizedGrossValue (value execution failed to deliver)')
    : unavailable<number>('execution.leakage', 'gross values unavailable — never fabricated');

  return Object.freeze({
    opportunityId: o.opportunityId,
    sessionId: session.sessionId,
    finalState: fr ? fr.finalState : 'UNKNOWN',
    executionQuality: view.quality ? view.quality.score : null,
    fees,
    spreadCost: component('SPREAD_COST'),
    slippage: component('SLIPPAGE'),
    marketImpact: component('MARKET_IMPACT'),
    latencyCost: component('LATENCY_COST'),
    partialFillCost: component('PARTIAL_FILL_COST'),
    rerouteCount: countAction('REROUTE'),
    repriceCount: countAction('REPRICE'),
    resliceCount: countAction('RESLICE'),
    replanCount: countAction('REPLAN'),
    failureCount: cycles.filter((c) => c.result.rejectionReason !== null || c.action === 'ABORT').length,
    recoveryCount: cycles.filter((c) => c.result.feedback.recovery === true).length,
    executionLeakage,
    attributionId: attribution ? attribution.attributionId : 'unavailable',
    fingerprint: executionAttributionId({
      id: o.opportunityId,
      session: session.sessionId,
      finalState: fr ? fr.finalState : 'UNKNOWN',
      fees,
      slippage: component('SLIPPAGE'),
      impact: component('MARKET_IMPACT'),
      latency: component('LATENCY_COST'),
      leakage: executionLeakage.value,
    }),
  });
}

export {derived};
