import {Opportunity} from '../../opportunity';
import {CompatibilityContext, checkCompatibility} from './compatibility';
import {StrategyCandidate, StrategyDefinition} from './types';
import {templatesForOpportunityType} from './templates';
import {buildCandidateFingerprint} from './ids';
import {candidateId} from './ids';

/**
 * Deterministic Strategy Candidate Generator.
 *
 * Given an opportunity and a compatibility context, it enumerates every
 * compatible strategy template, verifies each against the opportunity, and
 * emits canonical candidates. Generation is fully deterministic and isolated —
 * it never evaluates, ranks, or selects, and never touches downstream systems.
 */

export function generateStrategyCandidates(
  opportunity: Opportunity,
  ctx: CompatibilityContext,
): StrategyCandidate[] {
  const templates = templatesForOpportunityType(opportunity.type);
  const candidates: StrategyCandidate[] = [];

  for (const definition of templates) {
    const compat = checkCompatibility(opportunity, definition, ctx);
    if (!compat.compatible) continue;

    const fingerprint = buildCandidateFingerprint(opportunity, definition, definition.modifiers);
    const id = candidateId(fingerprint);
    const requiredCapital = Math.max(0, opportunity.requiredCapital * definition.modifiers.capitalFactor);

    candidates.push(Object.freeze({
      candidateId: id,
      strategyId: definition.strategyId,
      strategyVersion: definition.version,
      domain: definition.domain,
      type: definition.type,
      name: definition.name,
      opportunityId: opportunity.opportunityId,
      opportunityType: opportunity.type,
      instruments: [...opportunity.instruments],
      venues: [...opportunity.venues],
      definition,
      modifiers: definition.modifiers,
      requiredCapital,
      correlationGroup: definition.correlationGroup,
      correlationFactor: definition.correlationFactor,
      fingerprint,
    }));
  }

  // Deterministic ordering by (strategyId, version) for stability.
  return candidates.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

/** Synonym helper for callers that prefer the "compatible strategies" framing. */
export function compatibleStrategies(opportunity: Opportunity, ctx: CompatibilityContext): StrategyDefinition[] {
  return templatesForOpportunityType(opportunity.type).filter((d) => checkCompatibility(opportunity, d, ctx).compatible);
}
