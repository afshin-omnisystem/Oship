import {sha256} from '../../oiin';
import {Opportunity} from '../../opportunity';
import {StrategyCandidate, StrategyDefinition} from './types';

/**
 * Deterministic identity + fingerprint helpers for strategy decisions.
 *
 * The same (opportunity, strategy, configuration, portfolio context, risk
 * context) always yields the same candidate id, evaluation id, decision id and
 * canonical fingerprint. No random ids, no wall-clock identity, no
 * process-local counters.
 */

export function strategyFingerprint(input: {
  readonly opportunity: Opportunity;
  readonly definition: StrategyDefinition;
  readonly portfolioContext: Readonly<Record<string, unknown>>;
  readonly riskContext: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Record<string, unknown>>;
}): string {
  return sha256({
    opportunityId: input.opportunity.opportunityId,
    opportunityFingerprint: input.opportunity.fingerprint,
    strategyId: input.definition.strategyId,
    strategyVersion: input.definition.version,
    domain: input.definition.domain,
    type: input.definition.type,
    limits: input.definition.limits,
    modifiers: input.definition.modifiers,
    correlationGroup: input.definition.correlationGroup,
    correlationFactor: input.definition.correlationFactor,
    portfolioContext: input.portfolioContext,
    riskContext: input.riskContext,
    config: input.config,
  });
}

export function candidateId(fingerprint: string): string {
  return `strat_cand_${fingerprint.slice(0, 24)}`;
}

export function evaluationId(fingerprint: string): string {
  return `strat_eval_${fingerprint.slice(0, 24)}`;
}

export function decisionId(fingerprint: string, correlationId: string): string {
  return `strat_dec_${sha256({fingerprint, correlationId}).slice(0, 24)}`;
}

export function replayId(fingerprint: string, correlationId: string): string {
  return `strat_replay_${sha256({fingerprint, correlationId}).slice(0, 20)}`;
}

/**
 * Derive a canonical candidate from a definition + opportunity. The candidate
 * id and fingerprint are stable across processes and replay.
 */
export function buildCandidateFingerprint(
  opportunity: Opportunity,
  definition: StrategyDefinition,
  modifiers: StrategyDefinition['modifiers'],
): string {
  return sha256({
    opportunityId: opportunity.opportunityId,
    strategyId: definition.strategyId,
    strategyVersion: definition.version,
    modifiers,
  });
}
