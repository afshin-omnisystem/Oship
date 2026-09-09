import {Opportunity} from '../../opportunity';
import {StrategyCandidate, StrategyEvaluation, StrategyStatus} from './types';
import {computeStrategyEconomics} from './economics';
import {checkLimits, LimitCheck} from './limits';
import {
  assessPortfolio,
  PortfolioAwarenessContext,
  PortfolioAwarenessConfig,
} from './portfolio-awareness';
import {evaluationId} from './ids';
import {sha256} from '../../oiin';

/**
 * Deterministic strategy evaluation engine. For each candidate it computes the
 * unified economics model, enforces the strategy's explicit limits, performs a
 * portfolio-aware concentration check, validates capital availability and
 * timeframe, and produces a single deterministic `StrategyEvaluation`. It never
 * mutates Portfolio / Risk / Allocation / AEGIS / Treasury / Execution.
 */

export interface EvaluationContext {
  readonly timestamp: number;
  readonly correlationId: string;
  readonly policyVersion: string;
  readonly evaluationVersion: string;
  readonly rankingVersion: string;
  readonly configurationVersion: string;
  readonly portfolio: PortfolioAwarenessContext;
  readonly portfolioConfig?: PortfolioAwarenessConfig;
  readonly availableCapital: number;
}

export interface EvaluatorConfig {
  readonly evaluationVersion: string;
  readonly policyVersion: string;
  readonly rankingVersion: string;
  readonly configurationVersion: string;
}

export const DEFAULT_EVALUATOR_CONFIG: EvaluatorConfig = Object.freeze({
  evaluationVersion: 'strategy.eval.v1',
  policyVersion: 'strategy.policy.v1',
  rankingVersion: 'strategy.ranking.v1',
  configurationVersion: 'strategy.config.v1',
});

export function evaluateStrategy(
  opportunity: Opportunity,
  candidate: StrategyCandidate,
  ctx: EvaluationContext,
  config: EvaluatorConfig = DEFAULT_EVALUATOR_CONFIG,
): StrategyEvaluation {
  const definition = candidate.definition;

  // Economics.
  const economics = computeStrategyEconomics(opportunity, definition, opportunity.requiredCapital);

  // Limit enforcement.
  const limitCheck = checkLimits(definition.limits, {
    capital: economics.capitalRequired,
    exposure: economics.capitalRequired,
    legs: economics.legs.length,
    latencyMs: economics.latencySensitivity * definition.limits.maxLatencyMs,
    edge: economics.expectedNetEdge,
    confidence: economics.confidence,
    liquidity: economics.liquidityRequirement,
    slippage: opportunity.estimatedCosts.slippage * definition.modifiers.costFactor,
  });

  // Portfolio-aware assessment.
  const portfolio = assessPortfolio(
    opportunity,
    ctx.portfolio,
    economics.capitalRequired,
    definition.correlationGroup,
    ctx.portfolioConfig,
  );

  const capitalSufficient = ctx.availableCapital >= economics.capitalRequired;
  const timeframeValid = opportunity.expiresAt > ctx.timestamp && opportunity.freshness > 0;

  // Risk decision from portfolio concentration + capital.
  const riskDecision = (portfolio.wouldExceed || !capitalSufficient) ? 'REJECTED' : 'APPROVED';

  // Aggregate admissibility.
  const admissibility =
    limitCheck.passed &&
    economics.allLegsValid &&
    riskDecision === 'APPROVED' &&
    capitalSufficient &&
    timeframeValid &&
    !portfolio.wouldExceed &&
    declarationCompatible(opportunity, candidate);

  let status: StrategyStatus = 'EVALUATED';
  if (!admissibility) {
    if (!capitalSufficient) status = 'RISK_BLOCKED';
    else if (portfolio.wouldExceed) status = 'RISK_BLOCKED';
    else if (!timeframeValid) status = 'STALE';
    else status = 'REJECTED';
  }

  const fingerprint = sha256({
    candidate: candidate.fingerprint,
    opportunity: opportunity.opportunityId,
    economics,
    portfolio,
    policy: config.policyVersion,
    timestamp: ctx.timestamp,
  });

  const compatibilityReason = limitCheck.violations.length > 0
    ? limitCheck.violations.join(';')
    : !economics.allLegsValid
      ? 'economically_invalid_leg'
      : declarationCompatible(opportunity, candidate)
        ? 'admissible'
        : 'incompatible';

  return Object.freeze({
    evaluationId: evaluationId(fingerprint),
    candidateId: candidate.candidateId,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
    opportunityId: candidate.opportunityId,
    domain: candidate.domain,
    type: candidate.type,
    status,
    compatible: admissibility,
    compatibilityReason,
    limitViolations: limitCheck.violations,
    economics,
    portfolio,
    riskDecision,
    capitalSufficient,
    timeframeValid,
    evaluationVersion: config.evaluationVersion,
    rankingVersion: config.rankingVersion,
    policyVersion: config.policyVersion,
    configurationVersion: config.configurationVersion,
    timestamp: ctx.timestamp,
    correlationId: ctx.correlationId,
    fingerprint,
    admissibility,
  });
}

/**
 * A candidate is only admissible against an opportunity it is structurally
 * compatible with (opportunity type handled by the generator; here we also
 * reject when the strategy's domain does not match the opportunity's domain).
 */
function declarationCompatible(opportunity: Opportunity, candidate: StrategyCandidate): boolean {
  return candidate.domain === opportunity.domain;
}
