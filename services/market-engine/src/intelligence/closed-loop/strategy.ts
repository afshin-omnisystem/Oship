import type {ClosedLoopRecord, StrategyAttribution, ClosedLoopValue} from './types';
import {strategyAttributionId, derived, unavailable} from './ids';
import {theoreticalValueModel, realizedComponents} from './value';
import {recordSessionView} from './performance';
import {safeDivide, blendConfidence} from './source';

/**
 * SPRINT 035 — opportunity-to-strategy attribution (§8).
 *
 * Measures how strategy selection affected value: original opportunity value
 * vs strategy expected value vs strategy realized value. The Strategy
 * Registry is never modified — this is read-only attribution over historical
 * strategy decisions.
 */

export function strategyAttribution(record: ClosedLoopRecord): StrategyAttribution {
  const o = record.opportunity;
  const theoretical = theoreticalValueModel(record);
  const realized = realizedComponents(record);
  const view = recordSessionView(record);

  const originalOpportunityValue = theoretical.theoreticalNetEdge.value ?? o.netEdge;
  const strategyExpectedValue = record.strategyDecision.expectedValue;
  const strategyRealizedValue: ClosedLoopValue<number> = realized.realizedNetValue;

  const scale = theoretical.capitalScale.value;
  const strategyLeakage = scale === null || strategyRealizedValue.value === null
    ? unavailable<number>('strategy.leakage', 'capital scale or realized value unavailable')
    : derived(
      Math.max(0, o.netEdge * scale - strategyExpectedValue),
      'theoreticalNetAtScale − strategyExpectedValue (value the strategy left on the table)',
    );

  const fr = record.session.session.finalResult;
  const executionSuccess = fr ? fr.finalState === 'COMPLETED' : null;

  const cycles = record.session.session.cycles;
  const adaptiveActions = cycles.filter((c) =>
    c.action === 'REPRICE' || c.action === 'RESLICE' || c.action === 'REROUTE' || c.action === 'REPLAN');
  const adaptationFrequency = cycles.length > 0 ? adaptiveActions.length / cycles.length : 0;

  const quality = view.quality;
  const strategyQuality = quality
    ? derived(quality.score, 'Sprint 034 execution quality')
    : unavailable<number>('strategy.quality', 'no Sprint 034 quality for this session');

  const benchmarkDelta = strategyRealizedValue.value !== null
    ? derived(strategyRealizedValue.value - strategyExpectedValue, 'strategyRealized − strategyExpected')
    : unavailable<number>('strategy.benchmarkDelta', 'realized value unavailable');

  return Object.freeze({
    opportunityId: o.opportunityId,
    strategyId: record.strategyDecision.strategyId,
    originalOpportunityValue,
    strategyExpectedValue,
    strategyRealizedValue,
    strategyLeakage,
    executionSuccess,
    adaptationFrequency,
    strategyQuality,
    benchmarkDelta,
    fingerprint: strategyAttributionId({
      id: o.opportunityId,
      strategy: record.strategyDecision.strategyId,
      original: originalOpportunityValue,
      expected: strategyExpectedValue,
      realized: strategyRealizedValue.value,
      success: executionSuccess,
      adaptationFrequency,
      quality: quality ? quality.score : null,
    }),
  });
}

export {blendConfidence, safeDivide};
