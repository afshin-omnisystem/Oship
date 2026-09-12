/**
 * SPRINT 040 — comparability gate (§5/§22).
 *
 * AFIS BUY/SELL and ABL BACK/LAY remain semantically distinct. Raw AFIS↔ABL
 * comparison is structurally NOT_COMPARABLE. Only an explicit, versioned,
 * declared-loss normalization may cross the domain boundary — and a
 * normalization that equates BACK with BUY or LAY with SELL is rejected
 * outright. Normalization is never inferred.
 */

import type {
  DecisionIntelligenceResult, ComparabilityGateResult,
  GovernanceGateCheck, DomainNormalizationSpec, DomainNormalization,
  GovernanceConfigSpec, OpportunityDomain,
} from './types';
import {GovernanceRejectionError} from './types';
import {comparabilityGateIdOf, contentFingerprintOf,
  normalizationFingerprintOf} from './ids';

const DOMAINS: readonly OpportunityDomain[] = ['AFIS', 'ABL'];

/**
 * Validates an explicit normalization declaration, fail closed.
 * A legal normalization: covers exactly AFIS+ABL, carries the required
 * version, declares non-empty semantic loss, attests policy allowance and
 * maps domain sides onto a NEUTRAL namespace — never onto another domain's
 * side vocabulary.
 */
export function validateNormalization(
  spec: DomainNormalizationSpec | null | undefined,
  config: GovernanceConfigSpec,
): DomainNormalization | null {
  if (spec === null || spec === undefined) return null;
  if (spec === null || typeof spec !== 'object') {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'normalization must be an object or null');
  }
  if (typeof spec.normalizationId !== 'string'
    || spec.normalizationId.length === 0) {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'normalization identity must be explicit and non-empty');
  }
  if (spec.version !== config.normalizationVersion) {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      `normalization version "${String(spec.version)}" does not match the `
      + `required "${config.normalizationVersion}"`);
  }
  const domains = [...spec.domains].sort();
  if (domains.length !== 2 || domains[0] !== 'ABL' || domains[1] !== 'AFIS') {
    throw new GovernanceRejectionError('UNSUPPORTED_DOMAIN',
      'a cross-domain normalization must cover exactly AFIS and ABL');
  }
  if (!Array.isArray(spec.semanticLoss) || spec.semanticLoss.length === 0) {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'semantic loss must be declared — comparison without declared loss is '
      + 'never legal');
  }
  if (spec.policyAllowsComparison !== true) {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'the normalization must explicitly attest that policy allows the '
      + 'comparison');
  }
  if (spec.sideMapping === null || typeof spec.sideMapping !== 'object') {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'side mapping required');
  }
  // The mapping must be total over the four domain sides and neutral.
  const requiredKeys = ['AFIS:BUY', 'AFIS:SELL', 'ABL:BACK', 'ABL:LAY'];
  const mapping = spec.sideMapping as Readonly<Record<string, unknown>>;
  for (const key of requiredKeys) {
    if (typeof mapping[key] !== 'string' || mapping[key].length === 0) {
      throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
        `side mapping must cover "${key}" with a non-empty neutral key`);
    }
  }
  const forbiddenValues = ['BUY', 'SELL', 'BACK', 'LAY'];
  for (const [side, neutral] of Object.entries(mapping)) {
    if (forbiddenValues.includes(String(neutral))) {
      throw new GovernanceRejectionError('INVALID_BACK_LAY_SEMANTICS',
        `normalization maps "${side}" onto domain side "${String(neutral)}" — `
        + 'cross-domain side equations (BACK==BUY, LAY==SELL) are forbidden; '
        + 'map onto a neutral namespace instead');
    }
  }
  const normalization: DomainNormalization = Object.freeze({
    normalizationId: spec.normalizationId,
    version: spec.version,
    domains: Object.freeze([...spec.domains].sort()),
    semanticLoss: Object.freeze([...spec.semanticLoss]),
    sideMapping: Object.freeze({...spec.sideMapping}),
    policyAllowsComparison: true,
    normalizationFingerprint: normalizationFingerprintOf(spec),
  });
  return normalization;
}

export function evaluateComparabilityGate(
  decisionResult: DecisionIntelligenceResult,
  normalizationSpec: DomainNormalizationSpec | null | undefined,
  config: GovernanceConfigSpec,
): ComparabilityGateResult {
  const domain = decisionResult.context.domain;
  const alternatives = decisionResult.alternatives;
  const checks: GovernanceGateCheck[] = [];
  const reasons: string[] = [];

  // 1. Every alternative stays inside the decision's domain.
  const sameDomain = alternatives.every(
    (a) => a.counterfactualCandidate.domain === domain);
  checks.push({check: 'single-domain', passed: sameDomain,
    detail: `all alternatives stay inside domain ${domain}`});

  // 2. Domain side semantics verified.
  let afisSemanticsVerified = true;
  let ablSemanticsVerified = true;
  let ablSideVocabularyViolated = false;
  if (domain === 'AFIS') {
    for (const alternative of alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        if (leg.side !== 'BUY' && leg.side !== 'SELL') {
          afisSemanticsVerified = false;
        }
        if (leg.odds !== null && leg.odds !== undefined) {
          afisSemanticsVerified = false;
        }
      }
    }
    ablSemanticsVerified = false;
  } else {
    for (const alternative of alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        if (leg.side !== 'BACK' && leg.side !== 'LAY') {
          ablSemanticsVerified = false;
          // BUY/SELL inside ABL is specifically a BACK/LAY semantics
          // violation — BACK is never BUY and LAY is never SELL.
          if (leg.side === 'BUY' || leg.side === 'SELL') {
            ablSideVocabularyViolated = true;
          }
        }
        if (leg.odds !== null && leg.odds !== undefined
          && !(typeof leg.odds === 'number' && leg.odds > 1)) {
          ablSemanticsVerified = false;
        }
      }
      if (typeof alternative.counterfactualCandidate.marketId !== 'string'
        || typeof alternative.counterfactualCandidate.selectionId
          !== 'string') {
        ablSemanticsVerified = false;
      }
    }
    afisSemanticsVerified = false;
  }
  checks.push({check: 'afis-side-semantics',
    passed: domain === 'AFIS' ? afisSemanticsVerified : true,
    detail: 'AFIS alternatives use BUY/SELL only, never odds'});
  checks.push({check: 'abl-back-lay-semantics',
    passed: domain === 'ABL' ? ablSemanticsVerified : true,
    detail: 'ABL alternatives use BACK/LAY with decimal odds > 1 and '
      + 'market/selection identity'});

  // 3. Cross-domain rejections from Sprint 039 are preserved, never erased.
  const crossDomainRejectionsPreserved = decisionResult.rejectedAlternatives
    .filter((r) => r.code === 'CROSS_DOMAIN_COMPARISON')
    .map((r) => r.alternativeId).sort();
  checks.push({check: 'cross-domain-rejections-preserved',
    passed: true,
    detail: `${crossDomainRejectionsPreserved.length} raw cross-domain `
      + 'rejections preserved from decision intelligence'});

  // 4. Evidence comparability from the decision result.
  const evidenceComparable = alternatives.every(
    (a) => a.profile.evidence.comparability === 'COMPARABLE');
  checks.push({check: 'evidence-comparable', passed: evidenceComparable,
    detail: evidenceComparable
      ? 'all alternatives carry comparable evidence'
      : 'at least one alternative carries NOT_COMPARABLE evidence'});

  // 5. Optional explicit normalization (validated fail-closed).
  const normalization = validateNormalization(normalizationSpec, config);
  if (normalization !== null) {
    reasons.push(`explicit normalization ${normalization.normalizationId} `
      + `(v${normalization.version}) declares semantic loss: `
      + `${normalization.semanticLoss.join('; ')}`);
  }

  let state: ComparabilityGateResult['state'];
  let code: ComparabilityGateResult['code'] = null;
  if (!sameDomain) {
    state = 'NOT_COMPARABLE';
    code = 'NOT_COMPARABLE';
    reasons.unshift('alternatives span domains — raw cross-domain '
      + 'comparison is structurally NOT_COMPARABLE');
  } else if (domain === 'AFIS' && !afisSemanticsVerified) {
    state = 'NOT_COMPARABLE';
    code = 'INVALID_AFIS_SEMANTICS';
    reasons.unshift('AFIS side semantics violated');
  } else if (domain === 'ABL' && !ablSemanticsVerified) {
    state = 'NOT_COMPARABLE';
    code = ablSideVocabularyViolated
      ? 'INVALID_BACK_LAY_SEMANTICS' : 'INVALID_ABL_SEMANTICS';
    reasons.unshift(ablSideVocabularyViolated
      ? 'ABL BACK/LAY semantics violated — BUY/SELL is not BACK/LAY'
      : 'ABL BACK/LAY semantics violated');
  } else if (!evidenceComparable) {
    state = 'NOT_COMPARABLE';
    code = 'NOT_COMPARABLE';
    reasons.unshift('the underlying evidence is NOT_COMPARABLE');
  } else if (normalization !== null) {
    state = 'COMPARABLE_VIA_NORMALIZATION';
    reasons.unshift('intra-domain evidence is comparable and an explicit '
      + 'normalization is declared for cross-domain analytical use');
  } else {
    state = 'COMPARABLE';
    reasons.unshift(`intra-domain evidence is comparable within ${domain}`);
  }

  const core = {
    state,
    code,
    reasons: Object.freeze(reasons),
    checks: Object.freeze(checks),
    afisSemanticsVerified,
    ablSemanticsVerified,
    crossDomainRejectionsPreserved: Object.freeze(crossDomainRejectionsPreserved),
    normalization,
    comparabilityGateId: comparabilityGateIdOf({state, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}

/** Whether the two domains may be compared raw — never. */
export function rawDomainsComparable(
  _left: OpportunityDomain, _right: OpportunityDomain,
): boolean {
  void DOMAINS;
  return false;
}
