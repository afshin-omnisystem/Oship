/**
 * SPRINT 041 — strategy dependency preservation (§6).
 *
 * Dependencies inherited from Sprint 039/040 are preserved verbatim:
 * NONE / REGIME_DEPENDENT / STRATEGY_DEPENDENT / VENUE_DEPENDENT /
 * MULTI_DEPENDENT / UNKNOWN. A preferred alternative NEVER removes
 * dependency information. Sprint 040's INDEPENDENT maps to NONE.
 */

import type {GovernanceResult} from '../governance/types';
import type {IntentDependencies, IntentDependencyState} from './types';
import {IntentRejectionError} from './types';

export const GOVERNANCE_TO_INTENT_DEPENDENCY:
  Readonly<Record<GovernanceResult['dependencyGate']['state'],
    IntentDependencyState>> = Object.freeze({
  INDEPENDENT: 'NONE',
  REGIME_DEPENDENT: 'REGIME_DEPENDENT',
  STRATEGY_DEPENDENT: 'STRATEGY_DEPENDENT',
  VENUE_DEPENDENT: 'VENUE_DEPENDENT',
  MULTI_DEPENDENT: 'MULTI_DEPENDENT',
  UNKNOWN: 'UNKNOWN',
});

export function preserveDependencies(
  governance: GovernanceResult,
): IntentDependencies {
  const gate = governance.dependencyGate;
  const state = GOVERNANCE_TO_INTENT_DEPENDENCY[gate.state];
  if (state === undefined) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      `unknown governance dependency state ${String(gate.state)}`);
  }
  // Fail closed on inconsistent dependency evidence: the flags must match
  // the declared state exactly — dependencies are never guessed.
  const flagsTrue = (gate.regimeDependency === true ? 1 : 0)
    + (gate.strategyDependency === true ? 1 : 0)
    + (gate.venueDependency === true ? 1 : 0);
  if (state === 'NONE' && flagsTrue !== 0) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      'dependency state NONE contradicts detected dependency flags');
  }
  if (state === 'REGIME_DEPENDENT'
    && gate.regimeDependency !== true) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      'dependency state REGIME_DEPENDENT lacks the regime flag');
  }
  if (state === 'STRATEGY_DEPENDENT'
    && gate.strategyDependency !== true) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      'dependency state STRATEGY_DEPENDENT lacks the strategy flag');
  }
  if (state === 'VENUE_DEPENDENT' && gate.venueDependency !== true) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      'dependency state VENUE_DEPENDENT lacks the venue flag');
  }
  if (state === 'MULTI_DEPENDENT' && flagsTrue < 2) {
    throw new IntentRejectionError('INVALID_DEPENDENCY',
      'dependency state MULTI_DEPENDENT requires at least two flags');
  }
  return Object.freeze({
    state,
    regimeDependency: gate.regimeDependency,
    strategyDependency: gate.strategyDependency,
    venueDependency: gate.venueDependency,
    applicableRegimes: gate.applicableRegimes,
    applicableStrategies: gate.applicableStrategies,
    applicableVenues: gate.applicableVenues,
    preservedFromGovernance: true,
  });
}

/** Summary lines used by the explanation and feedback surfaces. */
export function dependencySummaryLines(
  dependencies: IntentDependencies,
): readonly string[] {
  const lines = [`dependency state ${dependencies.state} preserved from `
    + 'governance — never removed because a preferred alternative exists'];
  if (dependencies.regimeDependency === true) {
    lines.push(`regime-dependent inside ${JSON.stringify(
      dependencies.applicableRegimes)}`);
  }
  if (dependencies.strategyDependency === true) {
    lines.push(`strategy-dependent inside ${JSON.stringify(
      dependencies.applicableStrategies)}`);
  }
  if (dependencies.venueDependency === true) {
    lines.push(`venue-dependent inside ${JSON.stringify(
      dependencies.applicableVenues)}`);
  }
  return lines;
}
