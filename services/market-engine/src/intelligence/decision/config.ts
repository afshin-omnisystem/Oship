/**
 * SPRINT 039 — decision intelligence configuration.
 *
 * Versioned, validated, deep-mergeable. Trade-off weights are
 * configuration-driven and auditable: they renormalize to the simplex so the
 * trade-off semantics never change, and every score records both configured
 * and effective weights. Canonical key order keeps fingerprints stable.
 */

import type {DecisionIntelligenceConfigInput, DecisionIntelligenceConfigSpec,
  TradeOffDimension} from './types';
import {DEFAULT_OPPORTUNITY_CONFIG} from '../opportunity/config';

export const DEFAULT_DECISION_CONFIG: DecisionIntelligenceConfigSpec = Object.freeze({
  schemaVersion: 'decision-intelligence.config.v1',
  dominantMargin: 0.1,
  weakMargin: 0.05,
  tieBand: 0.02,
  minDominanceCohort: 3,
  strongDimensionShare: 0.7,
  weakDimensionShare: 0.3,
  tradeOffWeights: Object.freeze({
    evidenceQuality: 0.12,
    historicalPreservation: 0.14,
    realizationQuality: 0.12,
    stability: 0.08,
    regimeFit: 0.07,
    strategyFit: 0.1,
    venueFit: 0.08,
    leakageBurden: 0.1,
    freshness: 0.04,
    sampleAdequacy: 0.06,
    comparability: 0.04,
    evidenceCompleteness: 0.05,
  }),
  opportunityConfig: DEFAULT_OPPORTUNITY_CONFIG,
});

export const TRADE_OFF_KEYS: readonly TradeOffDimension[] = Object.freeze([
  'evidenceQuality', 'historicalPreservation', 'realizationQuality',
  'stability', 'regimeFit', 'strategyFit', 'venueFit', 'leakageBurden',
  'freshness', 'sampleAdequacy', 'comparability', 'evidenceCompleteness',
]);

function renormalizeWeights(
  weights: Record<string, number>, keys: readonly string[],
): Record<string, number> {
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  if (total <= 0) {
    throw new Error('decision-intelligence config: trade-off weights sum to zero — fail closed');
  }
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = Math.max(0, weights[key] ?? 0) / total;
  return out;
}

export function mergeDecisionConfig(
  input?: DecisionIntelligenceConfigInput,
): DecisionIntelligenceConfigSpec {
  if (!input) return DEFAULT_DECISION_CONFIG;
  const tradeOff: Record<string, number> = {...DEFAULT_DECISION_CONFIG.tradeOffWeights};
  let touched = false;
  if (input.tradeOffWeights) {
    for (const key of TRADE_OFF_KEYS) {
      const value = input.tradeOffWeights[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        tradeOff[key] = value;
        touched = true;
      }
    }
  }
  if (touched) {
    Object.assign(tradeOff, renormalizeWeights(tradeOff, TRADE_OFF_KEYS));
  }
  const {tradeOffWeights: _partial, opportunityConfig, ...rest} = input;
  void _partial;
  const out: DecisionIntelligenceConfigSpec = {
    ...DEFAULT_DECISION_CONFIG,
    ...rest,
    schemaVersion: 'decision-intelligence.config.v1',
    tradeOffWeights: Object.freeze(tradeOff) as Readonly<Record<TradeOffDimension, number>>,
    opportunityConfig: opportunityConfig ?? DEFAULT_DECISION_CONFIG.opportunityConfig,
  };
  validateDecisionConfig(out);
  return Object.freeze(out);
}

export function validateDecisionConfig(config: DecisionIntelligenceConfigSpec): void {
  if (config.schemaVersion !== 'decision-intelligence.config.v1') {
    throw new Error('decision-intelligence config: unknown schema version — fail closed');
  }
  const requirePositive = (key: keyof DecisionIntelligenceConfigSpec) => {
    const value = config[key] as unknown;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(
        `decision-intelligence config: ${String(key)} must be a positive finite number — fail closed`);
    }
  };
  requirePositive('dominantMargin');
  requirePositive('weakMargin');
  requirePositive('tieBand');
  requirePositive('minDominanceCohort');
  requirePositive('strongDimensionShare');
  requirePositive('weakDimensionShare');
  if (config.weakMargin > config.dominantMargin) {
    throw new Error(
      'decision-intelligence config: weakMargin must not exceed dominantMargin — fail closed');
  }
  if (config.tieBand > config.weakMargin) {
    throw new Error(
      'decision-intelligence config: tieBand must not exceed weakMargin — fail closed');
  }
  for (const key of TRADE_OFF_KEYS) {
    const weight = config.tradeOffWeights[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `decision-intelligence config: trade-off weight ${key} invalid — fail closed`);
    }
  }
  const total = TRADE_OFF_KEYS.reduce((s, k) => s + config.tradeOffWeights[k], 0);
  if (total <= 0) {
    throw new Error('decision-intelligence config: trade-off weights sum to zero — fail closed');
  }
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(
      'decision-intelligence config: trade-off weights must renormalize to 1 — fail closed');
  }
  if (config.opportunityConfig === null
    || typeof config.opportunityConfig !== 'object') {
    throw new Error('decision-intelligence config: opportunity config required — fail closed');
  }
}
