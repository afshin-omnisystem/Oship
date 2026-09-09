import {Opportunity} from '../../opportunity';
import {StrategyDefinition} from './types';

/**
 * Deterministic strategy-compatibility engine. A strategy is compatible only
 * when opportunity type, data/capabilities, venues, liquidity, limits and
 * freshness all align. Not-compatible strategies never reach evaluation.
 */

export interface CompatibilityContext {
  readonly availableCapabilities: readonly string[];
  /** Venues the runtime can actually reach (simulated). */
  readonly availableVenues: readonly string[];
  /** Extra set of venues present in market state (may exceed availableVenues). */
  readonly presentVenues?: readonly string[];
  readonly enabledStrategyIds?: readonly string[];
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason: string;
  readonly blockedBy: readonly string[];
}

const ELIGIBLE_OPPORTUNITY_STATUS = new Set(['VALIDATED', 'RANKED', 'ELIGIBLE']);

export function checkCompatibility(
  opportunity: Opportunity,
  definition: StrategyDefinition,
  ctx: CompatibilityContext,
): CompatibilityResult {
  const blockedBy: string[] = [];
  let reason = 'compatible';

  // 1. Registry/health: disabled strategy must never be selected.
  if (!definition.enabled) {
    blockedBy.push('strategy_disabled');
  }
  if (ctx.enabledStrategyIds && !ctx.enabledStrategyIds.includes(definition.strategyId)) {
    blockedBy.push('strategy_disabled_by_registry');
  }

  // 2. Opportunity type compatibility.
  if (!definition.compatibleOpportunityTypes.includes(opportunity.type)) {
    blockedBy.push('opportunity_type_incompatible');
  }

  // 3. Opportunity lifecycle: only validated/ranked/eligible opportunities.
  if (!ELIGIBLE_OPPORTUNITY_STATUS.has(opportunity.status)) {
    blockedBy.push('opportunity_not_eligible');
    reason = `opportunity status ${opportunity.status}`;
  }

  // 4. Freshness: stale opportunities are rejected outright.
  if (opportunity.freshness <= 0 || !Number.isFinite(opportunity.freshness)) {
    blockedBy.push('stale_evidence');
  }

  // 5. Required data/capabilities available.
  for (const cap of definition.requiredCapabilities) {
    if (!ctx.availableCapabilities.includes(cap)) blockedBy.push(`missing_capability:${cap}`);
  }

  // 6. Required venues present/available.
  const present = new Set([...ctx.presentVenues ?? [], ...opportunity.venues]);
  for (const v of definition.requiredVenues) {
    if (!ctx.availableVenues.includes(v) && !present.has(v)) blockedBy.push(`venue_unavailable:${v}`);
  }

  // 7. Liquidity must be materially present for the strategy's risk appetite.
  if (opportunity.liquidity.deployableCapital <= 0) blockedBy.push('no_deployable_liquidity');

  // 8. Bottom-line: whether at least one opportunity venue is reachable.
  if (opportunity.venues.length === 0) blockedBy.push('no_venue');

  // 9. Zero/negative/NaN capital is always incompatible.
  if (!Number.isFinite(opportunity.requiredCapital) || opportunity.requiredCapital <= 0) {
    blockedBy.push('invalid_capital');
  }

  if (blockedBy.length > 0) {
    reason = blockedBy.join(';');
  }

  return Object.freeze({compatible: blockedBy.length === 0, reason, blockedBy});
}
