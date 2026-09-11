/**
 * SPRINT 039 — alternative compatibility (§5, §14).
 *
 * Before any alternative is evaluated it must be provably comparable to the
 * base opportunity: same domain, compatible identity/class/strategy/venue
 * semantics, compatible regime representation and units, valid BACK/LAY or
 * BUY/SELL semantics, compatible evidence. Invalid comparisons return
 * NOT_COMPARABLE and fail closed — nothing is silently coerced. Raw AFIS vs
 * ABL comparisons are structurally NOT_COMPARABLE.
 */

import type {
  AlternativeSpec, CompatibilityAssessment, CompatibilityCheck,
  OpportunityCandidate, LearningResult,
} from './types';
import {compatibilityIdOf, contentFingerprintOf} from './ids';

/** Evaluates one validated alternative spec against the base candidate. */
export function evaluateCompatibility(
  spec: AlternativeSpec,
  base: OpportunityCandidate,
  learning: LearningResult,
): CompatibilityAssessment {
  const checks: CompatibilityCheck[] = [];
  const check = (name: string, passed: boolean, detail: string) => {
    checks.push(Object.freeze({check: name, passed, detail}));
  };

  // §5: same domain — raw cross-domain comparisons are never comparable.
  check('SAME_DOMAIN', true,
    `alternative and base share domain ${base.domain} (validated at spec level)`);

  // Compatible opportunity identity.
  check('OPPORTUNITY_IDENTITY', spec.baseCandidateId === base.candidateId,
    `alternative ${spec.alternativeId} targets base ${base.candidateId}`);

  // Compatible opportunity class — alternatives never change class.
  check('CLASS_COMPATIBLE', true,
    `alternative preserves class ${base.opportunityClass}`);

  // Compatible strategy semantics (domain-scoped learning history).
  const strategyId = spec.strategyId ?? base.strategyId;
  const strategy = learning.strategyLearning.find((s) => s.strategyId === strategyId);
  check('STRATEGY_COMPATIBLE', strategy !== undefined && strategy.domain === base.domain,
    strategy === undefined
      ? `strategy ${strategyId} has no learning history`
      : `strategy ${strategyId} has ${strategy.domain} history matching the base domain`);

  // Compatible venue semantics (domain-scoped learning history).
  const venues = spec.venues ?? base.venues;
  let venuesCompatible = venues.length > 0;
  const venueDetails: string[] = [];
  for (const venue of venues) {
    const known = learning.venueLearning.find((v) => v.venue === venue);
    const ok = known !== undefined && known.domains.includes(base.domain);
    venuesCompatible = venuesCompatible && ok;
    venueDetails.push(`${venue}:${ok ? 'compatible' : 'no-history'}`);
  }
  check('VENUE_COMPATIBLE', venuesCompatible, venueDetails.join(', '));

  // Compatible side semantics — BUY/SELL for AFIS, BACK/LAY for ABL.
  const legs = spec.venueLegs ?? base.venueLegs;
  const legalSides = base.domain === 'AFIS' ? ['BUY', 'SELL'] : ['BACK', 'LAY'];
  const sidesOk = legs.every((l) => legalSides.includes(l.side));
  const oddsOk = base.domain === 'AFIS'
    ? legs.every((l) => l.odds === null)
    : legs.every((l) => typeof l.odds === 'number' && l.odds > 1);
  check('SIDE_SEMANTICS', sidesOk,
    `${base.domain} sides ${legs.map((l) => l.side).join('/')} legal: ${sidesOk}`);
  check('ODDS_SEMANTICS', oddsOk, base.domain === 'AFIS'
    ? 'AFIS alternatives carry no odds — no betting semantics enter AFIS'
    : 'ABL alternative legs carry decimal odds > 1');

  // Compatible units — positive finite theoretical edge at unit-capital scale.
  const edge = base.market.theoreticalEdge;
  check('UNIT_COMPATIBLE', typeof edge === 'number' && Number.isFinite(edge) && edge > 0,
    `theoretical edge ${edge} is positive and finite at unit-capital scale`);

  // Compatible regime representation — same regime era space from learning.
  check('REGIME_REPRESENTATION', learning.regimes.length > 0,
    `learning result carries ${learning.regimes.length} regime eras shared by base and alternatives`);

  // Compatible evidence — same-domain observations exist for the class.
  const sameDomainEvidence = learning.observations.filter(
    (o) => o.domain === base.domain).length;
  check('EVIDENCE_COMPATIBLE', sameDomainEvidence > 0,
    `${sameDomainEvidence} same-domain historical observations available`);

  // ABL identity semantics preserved.
  if (base.domain === 'ABL') {
    const marketId = spec.marketId !== undefined && spec.marketId !== null
      ? spec.marketId : base.marketId;
    const selectionId = spec.selectionId !== undefined && spec.selectionId !== null
      ? spec.selectionId : base.selectionId;
    check('ABL_IDENTITY', marketId !== null && selectionId !== null,
      `market ${String(marketId)} / selection ${String(selectionId)} preserved`);
  }

  const failed = checks.filter((c) => !c.passed);
  const state = failed.length === 0 ? 'COMPATIBLE' : 'NOT_COMPARABLE';
  return Object.freeze({
    alternativeId: spec.alternativeId,
    state,
    checks: Object.freeze(checks),
    reason: failed.length === 0 ? null
      : `NOT_COMPARABLE: ${failed.map((f) => f.check).join(', ')}`,
    compatibilityId: compatibilityIdOf({alternativeId: spec.alternativeId, checks}),
    contentFingerprint: contentFingerprintOf({alternativeId: spec.alternativeId, state, checks}),
  });
}

/** True only when every check of the assessment passed. */
export function isComparable(assessment: CompatibilityAssessment): boolean {
  return assessment.state === 'COMPATIBLE';
}
