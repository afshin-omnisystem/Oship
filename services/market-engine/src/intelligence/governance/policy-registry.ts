/**
 * SPRINT 040 — the governance policy registry (§2).
 *
 * Exactly twelve deterministic policies: evidence sufficiency, stale
 * evidence, conflicted evidence, comparability, stability, leakage, regime
 * dependency, strategy dependency, venue dependency, research gaps,
 * semantic safety, authority boundaries. The registry is versioned; every
 * definition is validated against the policy version on construction.
 */

import type {PolicyRule} from './policy';
import {GOVERNANCE_POLICY_VERSION} from './types';
import type {GovernanceConfigSpec} from './types';

import {validatePolicyDefinition} from './policy';

function policy(
  policyId: string,
  description: string,
  evaluates: readonly string[],
  evaluate: PolicyRule['evaluate'],
): PolicyRule {
  const definition = {
    policyId, version: GOVERNANCE_POLICY_VERSION, description,
    evaluates: Object.freeze([...evaluates]),
  };
  validatePolicyDefinition(definition, GOVERNANCE_POLICY_VERSION);
  return {definition: Object.freeze(definition), evaluate};
}

export const GOVERNANCE_POLICIES: readonly PolicyRule[] = Object.freeze([
  policy('policy-evidence-sufficiency',
    'The evidence base must be sufficient to certify the decision.',
    ['evidenceGate'],
    (facts) => {
      if (facts.evidenceGate.state === 'BLOCK_INSUFFICIENT_EVIDENCE') {
        return {verdict: 'FAIL', code: 'INSUFFICIENT_EVIDENCE',
          reason: 'the evidence base is insufficient'};
      }
      if (facts.evidenceGate.state === 'PASS_WITH_LIMITATIONS') {
        return {verdict: 'LIMITATION', code: null,
          reason: facts.evidenceGate.reasons[0] ?? 'evidence carries limitations'};
      }
      return {verdict: 'PASS', code: null, reason: 'evidence is sufficient'};
    }),
  policy('policy-stale-evidence',
    'Stale evidence blocks unless an explicit analytical-only policy applies.',
    ['freshnessGate'],
    (facts, config) => {
      if (facts.freshnessGate.state === 'STALE') {
        return config.allowStaleAnalyticalOnly
          ? {verdict: 'LIMITATION', code: null,
            reason: 'stale evidence handed off analytical-only by policy'}
          : {verdict: 'FAIL', code: 'STALE_EVIDENCE',
            reason: 'evidence is stale'};
      }
      if (facts.freshnessGate.state === 'UNKNOWN') {
        return config.allowUnknownFreshnessAnalyticalOnly
          ? {verdict: 'LIMITATION', code: null,
            reason: 'unknown freshness handed off analytical-only by policy'}
          : {verdict: 'FAIL', code: 'STALE_EVIDENCE',
            reason: 'evidence freshness is unknown — never silently fresh'};
      }
      if (facts.freshnessGate.state === 'AGING') {
        return {verdict: 'LIMITATION', code: null,
          reason: 'evidence is aging'};
      }
      return {verdict: 'PASS', code: null, reason: 'evidence is fresh'};
    }),
  policy('policy-conflicted-evidence',
    'Unresolved conflicts block the handoff — conflicts are never forced to '
    + 'a winner.',
    ['evidenceGate'],
    (facts) => facts.evidenceGate.state === 'BLOCK_CONFLICTED'
      ? {verdict: 'FAIL', code: 'CONFLICTED_EVIDENCE',
        reason: 'unresolved conflicts exist in the evidence'}
      : {verdict: 'PASS', code: null,
        reason: 'no unresolved conflicts in the evidence'}),
  policy('policy-comparability',
    'Evidence must be comparable; raw cross-domain comparison never is.',
    ['comparabilityGate'],
    (facts) => {
      if (facts.comparabilityGate.state === 'NOT_COMPARABLE') {
        return {verdict: 'FAIL', code: 'NOT_COMPARABLE',
          reason: facts.comparabilityGate.reasons[0]
            ?? 'evidence is not comparable'};
      }
      if (facts.comparabilityGate.state === 'COMPARABLE_VIA_NORMALIZATION') {
        return {verdict: 'LIMITATION', code: null,
          reason: 'comparable only via explicit declared-loss normalization'};
      }
      return {verdict: 'PASS', code: null, reason: 'evidence is comparable'};
    }),
  policy('policy-stability',
    'Stability stays explicit; unstable evidence restricts or blocks.',
    ['stabilityGate'],
    (facts, config) => {
      if (facts.stabilityGate.state === 'UNSTABLE') {
        return config.unstableBlocksHandoff
          ? {verdict: 'FAIL', code: 'STABILITY_INCONSISTENCY',
            reason: 'evidence is unstable and policy blocks unstable handoffs'}
          : {verdict: 'LIMITATION', code: null,
            reason: 'evidence is unstable — explicit restrictions apply'};
      }
      if (facts.stabilityGate.state === 'MODERATELY_STABLE'
        || facts.stabilityGate.state === 'INSUFFICIENT') {
        return {verdict: 'LIMITATION', code: null,
          reason: `evidence stability is ${facts.stabilityGate.state}`};
      }
      return {verdict: 'PASS', code: null, reason: 'evidence is stable'};
    }),
  policy('policy-leakage',
    'Leakage must be counted exactly once and surfaced explicitly.',
    ['leakageShare'],
    (facts, config) => {
      if (facts.maxLeakageShare === null) {
        return {verdict: 'LIMITATION', code: null,
          reason: 'leakage unmeasurable on the evidence base'};
      }
      if (facts.maxLeakageShare >= config.leakageInvestigationShare) {
        return {verdict: 'LIMITATION', code: null,
          reason: `maximum leakage share ${facts.maxLeakageShare.toFixed(4)} `
            + 'meets the investigation threshold'};
      }
      return {verdict: 'PASS', code: null, reason: 'leakage within limits'};
    }),
  policy('policy-regime-dependency',
    'Regime dependency must be preserved and restrict the handoff.',
    ['dependencyGate'],
    (facts) => facts.dependencyGate.regimeDependency === true
      ? {verdict: 'LIMITATION', code: null,
        reason: 'regime dependency detected — handoff is regime-specific'}
      : {verdict: 'PASS', code: null,
        reason: 'no regime dependency detected'}),
  policy('policy-strategy-dependency',
    'Strategy dependency must be preserved and restrict the handoff.',
    ['dependencyGate'],
    (facts) => facts.dependencyGate.strategyDependency === true
      ? {verdict: 'LIMITATION', code: null,
        reason: 'strategy dependency detected — handoff is strategy-limited'}
      : {verdict: 'PASS', code: null,
        reason: 'no strategy dependency detected'}),
  policy('policy-venue-dependency',
    'Venue dependency must be preserved and restrict the handoff.',
    ['dependencyGate'],
    (facts) => facts.dependencyGate.venueDependency === true
      ? {verdict: 'LIMITATION', code: null,
        reason: 'venue dependency detected — handoff is venue-limited'}
      : {verdict: 'PASS', code: null,
        reason: 'no venue dependency detected'}),
  policy('policy-research-gaps',
    'Evidence gaps and heavy dependencies escalate research before handoff.',
    ['researchGaps', 'dependencyGate'],
    (facts, config) => {
      const heavyDependency = config.researchDependencyEscalation === 'ANY_DEPENDENCY'
        ? facts.dependencyGate.state !== 'INDEPENDENT'
          && facts.dependencyGate.state !== 'UNKNOWN'
        : facts.dependencyGate.state === 'MULTI_DEPENDENT';
      if (facts.evidenceGate.state === 'PASS'
        && facts.dependencyGate.state === 'UNKNOWN') {
        return {verdict: 'FAIL', code: 'INVALID_DEPENDENCY',
          reason: 'dependency evidence is incomplete — research required '
            + 'before any handoff'};
      }
      if (facts.researchGapCount >= config.researchGapThreshold
        || heavyDependency) {
        const why: string[] = [];
        if (facts.researchGapCount >= config.researchGapThreshold) {
          why.push(`${facts.researchGapCount} shared evidence gaps`);
        }
        if (heavyDependency) {
          why.push(`dependency state ${facts.dependencyGate.state}`);
        }
        return {verdict: 'FAIL', code: 'INSUFFICIENT_EVIDENCE',
          reason: `research escalation required: ${why.join(' and ')}`};
      }
      return {verdict: 'PASS', code: null,
        reason: 'no research escalation required'};
    }),
  policy('policy-semantic-safety',
    'No probability, forecast, expected return, guarantee or execution '
    + 'instruction may enter the handoff.',
    ['safetyGate'],
    (facts) => facts.safetyGate.state === 'BLOCK_UNSAFE'
      ? {verdict: 'FAIL', code: 'UNSAFE_SEMANTICS',
        reason: facts.safetyGate.reasons[0] ?? 'unsafe semantics detected'}
      : {verdict: 'PASS', code: null,
        reason: 'no forbidden semantics detected'}),
  policy('policy-authority-boundaries',
    'The handoff may inform, never impersonate, the existing authorities.',
    ['authorityCheck'],
    (facts) => facts.authorityCheck.state === 'BOUNDARY_VIOLATED'
      ? {verdict: 'FAIL', code: facts.authorityCheck.code ?? 'AUTHORITY_BYPASS',
        reason: facts.authorityCheck.reasons[0] ?? 'authority boundary violated'}
      : {verdict: 'PASS', code: null,
        reason: 'all authority boundaries respected'}),
]);

/** Validates the full registry against a config (fail closed). */
export function validatePolicyRegistry(config: GovernanceConfigSpec): void {
  const seen = new Set<string>();
  for (const rule of GOVERNANCE_POLICIES) {
    validatePolicyDefinition(rule.definition, config.policyVersion);
    if (seen.has(rule.definition.policyId)) {
      throw new Error(`decision-governance policy registry: duplicate `
        + `${rule.definition.policyId} — fail closed`);
    }
    seen.add(rule.definition.policyId);
  }
  if (GOVERNANCE_POLICIES.length !== 12) {
    throw new Error('decision-governance policy registry: exactly twelve '
      + `policies required, found ${GOVERNANCE_POLICIES.length} — fail closed`);
  }
}
