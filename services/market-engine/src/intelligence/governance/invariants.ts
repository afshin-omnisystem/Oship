/**
 * SPRINT 040 — governance invariants (§25).
 *
 * The hard fail-closed contract of the governance engine: 74 invariants
 * covering authority boundaries, semantic safety, AFIS/ABL isolation,
 * cross-domain normalization, freshness/stability/dependency explicitness,
 * determinism, audit integrity, immutability and the strategy boundary.
 * The engine runs the full check set on EVERY governance result and throws
 * GovernanceInvariantError when any check fails — no silent degradation.
 */

import type {
  GovernanceResult, GovernanceInvariantCheck, GovernanceInvariantReport,
  GovernanceConfigSpec, GovernanceInput, PolicyEvaluation,
  HandoffRestrictionCode,
} from './types';
import {GOVERNANCE_DISCLAIMER, GOVERNANCE_ENGINE_VERSION,
  GOVERNANCE_POLICY_VERSION, GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_NORMALIZATION_VERSION} from './types';
import {canonicalJson, learningHash} from './ids';
import {verifyGovernanceAudit} from './audit';
import {FABRICATED_KEYS, containsCertaintyClaim, narrativeOf} from './safety-gate';
import {FORBIDDEN_PACKAGE_KEYS} from './authority-check';
import {HANDOFF_RESTRICTION_CODES} from './handoff-restrictions';

function check(invariant: string, passed: boolean, detail: string):
    GovernanceInvariantCheck {
  return {invariant, passed, detail};
}

const TREASURY_KEYS = /"(treasury|treasuryCommand|capitalRelease|fundsRelease)":/
const PORTFOLIO_KEYS = /"(portfolio|portfolioCommand|rebalance)":/
const RISK_KEYS = /"(riskLimit|riskCommand|riskApproval)":/
const ALLOCATION_KEYS = /"(allocation|allocationCommand|sizing|positionSize)":/
const AEGIS_KEYS = /"(aegis|aegisApproval|aegisAuthorization)":/
const EXECUTION_KEYS = /"(order|orders|executionPlan|executionCommand|instruction|instructions)":/
const CREDENTIAL_KEYS = /"(credential|credentials|apiKey|api_key|password|token|secret|privateKey)":/

export interface GovernanceInvariantContext {
  readonly input: GovernanceInput;
  readonly config: GovernanceConfigSpec;
}

export function checkGovernanceInvariants(
  result: GovernanceResult,
  context: GovernanceInvariantContext,
): GovernanceInvariantReport {
  const checks: GovernanceInvariantCheck[] = [];
  const serializedResult = canonicalJson(result);
  const serializedPackage = canonicalJson(result.handoffPackage);
  const decisionResult = context.input.decisionResult;

  // ------------------------------------------------------------------
  // Authority boundaries (1–10)
  // ------------------------------------------------------------------
  checks.push(check('NO_TREASURY_AUTHORITY',
    !TREASURY_KEYS.test(serializedPackage),
    'no treasury surface exists in the handoff package'));
  checks.push(check('NO_PORTFOLIO_AUTHORITY',
    !PORTFOLIO_KEYS.test(serializedPackage),
    'no portfolio surface exists in the handoff package'));
  checks.push(check('NO_RISK_AUTHORITY',
    !RISK_KEYS.test(serializedPackage),
    'no risk surface exists in the handoff package'));
  checks.push(check('NO_ALLOCATION_AUTHORITY',
    !ALLOCATION_KEYS.test(serializedPackage),
    'no allocation/sizing surface exists in the handoff package'));
  checks.push(check('NO_AEGIS_AUTHORITY',
    !AEGIS_KEYS.test(serializedPackage),
    'no AEGIS surface exists in the handoff package — AEGIS alone '
      + 'authorizes execution'));
  checks.push(check('NO_EXECUTION_AUTHORITY',
    !EXECUTION_KEYS.test(serializedPackage),
    'no execution surface exists in the handoff package — Execution alone '
      + 'executes'));
  checks.push(check('NO_STRATEGY_REGISTRY_DUPLICATION',
    result.strategyInput.strategyDecides === true
      && result.strategyInput.informational === true,
    'the strategy id is an informational reference; the Strategy Registry '
      + 'stays authoritative for strategy identity and behavior'));
  checks.push(check('NO_OIIN_DUPLICATION',
    typeof result.context.decisionId === 'string'
      && result.context.decisionId.startsWith('dia_'),
    'the governance layer consumes the existing intelligence outputs — it '
      + 'never re-derives them'));
  checks.push(check('NO_RESEARCH_DUPLICATION',
    result.research.informational === true
      && result.research.schemaVersion === 'decision-governance.research.v1',
    'research requests flow to the existing Research Plane — no second '
      + 'research authority'));
  checks.push(check('NO_LEARNING_DUPLICATION',
    result.feedback.every((f) => f.informational === true
      && f.schemaVersion === 'decision-governance.feedback.v1'),
    'feedback flows to the existing Learning/Feedback architecture — no '
      + 'second learning authority'));

  // ------------------------------------------------------------------
  // Semantic safety (11–15)
  // ------------------------------------------------------------------
  checks.push(check('NO_PROBABILITY',
    !FABRICATED_KEYS.test(serializedResult),
    'no probability key exists anywhere in the governance result'));
  checks.push(check('NO_FORECAST',
    !/"(forecast|forecastedProfit)":/.test(serializedResult),
    'no forecast key exists anywhere in the governance result'));
  checks.push(check('NO_EXPECTED_RETURN',
    !/"(expectedReturn|expected_return|expectedProfit|expectedRoi|expectedValue|roi)":/
      .test(serializedResult),
    'no expected-return/ROI key exists anywhere in the governance result'));
  checks.push(check('NO_GUARANTEE',
    result.safetyGate.state === 'BLOCK_UNSAFE'
      ? result.classification === 'HANDOFF_BLOCKED'
      : (!containsCertaintyClaim(narrativeOf(decisionResult).join(' '))
        && !containsCertaintyClaim(result.annotations.join(' '))
        && !containsCertaintyClaim(
          result.handoffPackage.evidenceLimitations.join(' '))),
    'no guarantee or certainty claim survives into an allowed handoff — '
      + 'forbidden claims force the BLOCKED classification instead'));
  checks.push(check('NO_EXECUTION_INSTRUCTION',
    !EXECUTION_KEYS.test(serializedPackage),
    'the handoff package carries no execution instruction of any form'));

  // ------------------------------------------------------------------
  // Domain semantics (16–20)
  // ------------------------------------------------------------------
  const domain = result.context.domain;
  if (domain === 'AFIS') {
    checks.push(check('AFIS_BUY_SELL_PRESERVED',
      decisionResult.alternatives.every((a) =>
        a.counterfactualCandidate.venueLegs.every((leg) =>
          leg.side === 'BUY' || leg.side === 'SELL')),
      'every AFIS leg is BUY or SELL'));
    checks.push(check('ABL_BACK_LAY_PRESERVED',
      true,
      'not applicable in AFIS domain — no ABL semantics present by '
        + 'construction'));
  } else {
    checks.push(check('AFIS_BUY_SELL_PRESERVED',
      true,
      'not applicable in ABL domain — no AFIS semantics present by '
        + 'construction'));
    checks.push(check('ABL_BACK_LAY_PRESERVED',
      decisionResult.alternatives.every((a) =>
        a.counterfactualCandidate.venueLegs.every((leg) =>
          leg.side === 'BACK' || leg.side === 'LAY')
        && typeof a.counterfactualCandidate.marketId === 'string'
        && typeof a.counterfactualCandidate.selectionId === 'string'),
      'every ABL leg is BACK or LAY with market/selection identity; BACK is '
        + 'never reinterpreted as BUY and LAY never as SELL'));
  }
  checks.push(check('RAW_CROSS_DOMAIN_REJECTED',
    decisionResult.alternatives.every((a) =>
      a.counterfactualCandidate.domain === domain),
    'no accepted alternative crosses the domain boundary — raw AFIS↔ABL '
      + 'comparison is structurally impossible'));
  const normalization = result.comparabilityGate.normalization;
  checks.push(check('NORMALIZATION_EXPLICIT',
    (result.comparabilityGate.state === 'COMPARABLE_VIA_NORMALIZATION')
      === (normalization !== null),
    'normalized comparison exists only when an explicit normalization was '
      + 'declared and validated'));
  checks.push(check('NORMALIZATION_VERSION_CHECKED',
    normalization === null
      || normalization.version === GOVERNANCE_NORMALIZATION_VERSION,
    'every accepted normalization carries the required version'));

  // ------------------------------------------------------------------
  // Explicit evidence dimensions (21–28)
  // ------------------------------------------------------------------
  checks.push(check('LEAKAGE_COUNTED_ONCE',
    result.handoffPackage.leakageStatus.countedOnce === true,
    'leakage is surfaced exactly once per alternative through the Sprint '
      + '039 semantics'));
  checks.push(check('STABILITY_EXPLICIT',
    ['STABLE', 'MODERATELY_STABLE', 'UNSTABLE', 'INSUFFICIENT']
      .includes(result.stabilityGate.state),
    'stability is an explicit governance state, never a probability'));
  checks.push(check('FRESHNESS_EXPLICIT',
    ['FRESH', 'AGING', 'STALE', 'UNKNOWN']
      .includes(result.freshnessGate.state),
    'freshness is an explicit governance state'));
  checks.push(check('SAMPLE_ADEQUACY_EXPLICIT',
    result.evidenceGate.sampleAdequacy === null
      || ['SUFFICIENT', 'LIMITED', 'INSUFFICIENT']
        .includes(result.evidenceGate.sampleAdequacy),
    'sample adequacy is explicit'));
  checks.push(check('COMPARABILITY_EXPLICIT',
    ['COMPARABLE', 'NOT_COMPARABLE', 'COMPARABLE_VIA_NORMALIZATION']
      .includes(result.comparabilityGate.state),
    'comparability is an explicit governance state'));
  checks.push(check('REGIME_DEPENDENCY_EXPLICIT',
    result.dependencyGate.regimeDependency === null
      || typeof result.dependencyGate.regimeDependency === 'boolean',
    'regime dependency is explicitly detected, not detected, or explicitly '
      + 'unresolvable — never guessed'));
  checks.push(check('STRATEGY_DEPENDENCY_EXPLICIT',
    result.dependencyGate.strategyDependency === null
      || typeof result.dependencyGate.strategyDependency === 'boolean',
    'strategy dependency is explicitly detected, not detected, or '
      + 'explicitly unresolvable — never guessed'));
  checks.push(check('VENUE_DEPENDENCY_EXPLICIT',
    result.dependencyGate.venueDependency === null
      || typeof result.dependencyGate.venueDependency === 'boolean',
    'venue dependency is explicitly detected, not detected, or explicitly '
      + 'unresolvable — never guessed'));

  // ------------------------------------------------------------------
  // Explicit failure states (29–36)
  // ------------------------------------------------------------------
  checks.push(check('UNSUPPORTED_COMBINATION_REJECTED',
    result.classification !== 'HANDOFF_ALLOWED'
      || (result.evidenceGate.state === 'PASS'
        && result.safetyGate.state !== 'BLOCK_UNSAFE'
        && result.authorityCheck.state === 'BOUNDARY_RESPECTED'
        && result.dependencyGate.state !== 'UNKNOWN'),
    'HANDOFF_ALLOWED implies every gate passed and every combination is '
      + 'supported'));
  checks.push(check('MALFORMED_CONTEXT_REJECTED',
    result.context.contextId.startsWith('gctx_')
      && result.context.informational === true,
    'only a fully validated context can produce a governance result'));
  checks.push(check('MISSING_DECISION_IDENTITY_REJECTED',
    result.context.decisionId.startsWith('dia_'),
    'every governed result carries the upstream decision identity'));
  checks.push(check('MISSING_OPPORTUNITY_IDENTITY_REJECTED',
    typeof result.context.opportunityId === 'string'
      && result.context.opportunityId.length > 0,
    'every governed result carries the opportunity identity'));
  const blockedFamily = ['HANDOFF_BLOCKED', 'HANDOFF_NOT_COMPARABLE',
    'HANDOFF_CONFLICTED', 'HANDOFF_STALE', 'HANDOFF_INSUFFICIENT_EVIDENCE'];
  checks.push(check('STALE_EVIDENCE_EXPLICIT',
    result.freshnessGate.state !== 'STALE'
      || blockedFamily.includes(result.classification)
      || result.freshnessGate.outcome === 'PASS_WITH_LIMITATIONS',
    'stale evidence always maps to an explicit blocked or policy-limited '
      + 'state — never to an allowed handoff'));
  checks.push(check('CONFLICTED_EVIDENCE_EXPLICIT',
    result.evidenceGate.state !== 'BLOCK_CONFLICTED'
      || result.classification === 'HANDOFF_CONFLICTED'
      || result.classification === 'HANDOFF_BLOCKED',
    'conflicted evidence always maps to an explicit blocked state — '
      + 'safety/authority blocks take precedence'));
  checks.push(check('INSUFFICIENT_EVIDENCE_EXPLICIT',
    result.evidenceGate.state !== 'BLOCK_INSUFFICIENT_EVIDENCE'
      || result.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE'
      || result.classification === 'HANDOFF_BLOCKED',
    'insufficient evidence always maps to an explicit blocked state — '
      + 'safety/authority blocks take precedence'));
  checks.push(check('NO_HIDDEN_FALLBACK',
    result.classificationReasons.length > 0,
    'every classification carries at least one explicit reason — never a '
      + 'generic "not recommended"'));

  // ------------------------------------------------------------------
  // Determinism (37–41)
  // ------------------------------------------------------------------
  checks.push(check('DETERMINISTIC_CLASSIFICATION',
    result.policies.length === 12
      && result.governanceFingerprint.startsWith('gfp2_'),
    'classification derives deterministically from the twelve policies'));
  checks.push(check('DETERMINISTIC_RESTRICTIONS',
    restrictionCodesSortedUnique(result),
    'restrictions are canonically ordered with unique codes'));
  checks.push(check('DETERMINISTIC_SERIALIZATION',
    canonicalJson(JSON.parse(canonicalJson(result))) === canonicalJson(result),
    'the result serializes canonically and re-parses identically'));
  checks.push(check('DETERMINISTIC_IDS',
    result.governanceId.startsWith('gov_')
      && result.context.contextId.startsWith('gctx_')
      && result.handoffPackage.handoffId.startsWith('ghof_')
      && result.strategyInput.strategyInputId.startsWith('gstr_'),
    'every artifact id is content-derived and prefix-tagged'));
  checks.push(check('DETERMINISTIC_REPLAY',
    result.replay.identical === true
      && result.replay.fingerprint === result.governanceFingerprint,
    'the engine double-run is byte-identical with matching fingerprint'));

  // ------------------------------------------------------------------
  // Audit integrity (42–47)
  // ------------------------------------------------------------------
  const auditVerification = verifyGovernanceAudit(result.auditEvents);
  checks.push(check('AUDIT_INTEGRITY',
    auditVerification.valid,
    auditVerification.valid
      ? `hash chain of ${result.auditEvents.length} events verifies`
      : `audit verification failed: ${String(auditVerification.reason)}`));
  checks.push(check('TAMPERING_FAILS_CLOSED',
    result.auditEvents.every((e, i) => e.hash === learningHash({
      schemaVersion: e.schemaVersion, eventId: e.eventId,
      eventType: e.eventType, timestamp: e.timestamp, sequence: i,
      governanceId: e.governanceId, payload: e.payload,
      payloadFingerprint: e.payloadFingerprint,
      previousHash: e.previousHash,
    })),
    'every event hash is recomputable — any tamper fails verification'));
  checks.push(check('REORDER_FAILS_CLOSED',
    result.auditEvents.every((e, i) => e.sequence === i),
    'sequences are contiguous from zero — reordering fails verification'));
  checks.push(check('SUBSTITUTION_FAILS_CLOSED',
    result.auditEvents.every((e) => e.payloadFingerprint
      === learningHash(e.payload)),
    'payload fingerprints are recomputable — substitution fails '
      + 'verification'));
  checks.push(check('TRUNCATION_FAILS_CLOSED',
    auditVerification.events === result.auditEvents.length
      && verifyGovernanceAudit(result.auditEvents,
        result.auditEvents.length).valid,
    'the chain length is exactly the expected count — truncation fails '
      + 'verification'));
  checks.push(check('EXTENSION_FAILS_CLOSED',
    result.auditEvents[result.auditEvents.length - 1].eventType
      === 'replay-completed',
    'the chain ends with the sealed replay event — extension fails '
      + 'verification'));
  checks.push(check('AUDIT_SCHEMA_CANONICAL',
    result.auditEvents.every((e) =>
      e.schemaVersion === 'oship.decision-governance.v1'
      && GOVERNANCE_EVENT_TYPES.includes(e.eventType)),
    'every audit event uses the canonical schema and event vocabulary'));

  // ------------------------------------------------------------------
  // Immutability (48–50)
  // ------------------------------------------------------------------
  checks.push(check('HANDOFF_PACKAGE_IMMUTABLE',
    Object.isFrozen(result.handoffPackage),
    'the handoff package is frozen at construction'));
  checks.push(check('GOVERNANCE_RESULT_IMMUTABLE',
    Object.isFrozen(result),
    'the governance result is frozen at construction'));
  checks.push(check('RESTRICTIONS_IMMUTABLE',
    Object.isFrozen(result.restrictions)
      && result.restrictions.every((r) => Object.isFrozen(r)),
    'every restriction is frozen at construction'));

  // ------------------------------------------------------------------
  // Strategy boundary (51, 63–65)
  // ------------------------------------------------------------------
  checks.push(check('STRATEGY_BOUNDARY_PRESERVED',
    !FORBIDDEN_PACKAGE_KEYS.test(serializedPackage),
    'the package contains no order, instruction, command, authorization or '
      + 'credential key — Strategy decides everything downstream'));
  checks.push(check('NO_TREASURY_COMMAND_GENERATION',
    !TREASURY_KEYS.test(serializedResult),
    'no treasury command is generated anywhere in the governance result'));
  checks.push(check('NO_EXECUTION_COMMAND_GENERATION',
    !EXECUTION_KEYS.test(serializedPackage)
      && (result.strategyInput.recommendedAlternativeId === null
        || result.strategyInput.classification === 'HANDOFF_ALLOWED'
        || result.strategyInput.classification
          === 'HANDOFF_ALLOWED_WITH_LIMITATIONS'),
    'no execution command is generated and blocked handoffs surface no '
      + 'recommended alternative'));

  // ------------------------------------------------------------------
  // Escalation, feedback, gates (52–55)
  // ------------------------------------------------------------------
  checks.push(check('RESEARCH_ESCALATION_EXPLICIT',
    result.research.escalations.some((e) => e.kind === 'RESEARCH_REQUIRED')
      === (result.classification === 'HANDOFF_REQUIRES_RESEARCH'
        || result.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE'
        || result.classification === 'HANDOFF_CONFLICTED'),
    'research escalation is explicit exactly when the classification '
      + 'demands it'));
  checks.push(check('FEEDBACK_DETERMINISTIC',
    feedbackSortedUnique(result),
    'feedback records are canonically ordered with unique ids'));
  checks.push(check('AUTHORITY_BYPASS_REJECTED',
    result.authorityCheck.state !== 'BOUNDARY_VIOLATED'
      || result.classification === 'HANDOFF_BLOCKED',
    'any authority violation forces the BLOCKED classification'));
  checks.push(check('UNSAFE_SEMANTICS_REJECTED',
    result.safetyGate.state !== 'BLOCK_UNSAFE'
      || result.classification === 'HANDOFF_BLOCKED',
    'any unsafe semantics force the BLOCKED classification'));

  // ------------------------------------------------------------------
  // Freshness/stability honesty (56–57)
  // ------------------------------------------------------------------
  checks.push(check('UNKNOWN_FRESHNESS_NEVER_FRESH',
    !result.freshnessGate.perAlternative.some((p) => p.freshness === 'UNKNOWN')
      || result.freshnessGate.state !== 'FRESH',
    'any per-alternative UNKNOWN freshness prevents an aggregate FRESH'));
  checks.push(check('UNSTABLE_NEVER_SILENTLY_STABLE',
    !result.stabilityGate.perAlternative.some(
      (p) => p.governanceState === 'UNSTABLE')
      || result.stabilityGate.state !== 'STABLE',
    'any per-alternative UNSTABLE mapping prevents an aggregate STABLE'));

  // ------------------------------------------------------------------
  // Normalization, timestamps, randomness (58–60)
  // ------------------------------------------------------------------
  checks.push(check('CROSS_DOMAIN_NORMALIZATION_NEVER_IMPLICIT',
    result.comparabilityGate.state !== 'COMPARABLE_VIA_NORMALIZATION'
      || result.comparabilityGate.normalization !== null,
    'COMPARABLE_VIA_NORMALIZATION only exists with an explicit validated '
      + 'normalization'));
  checks.push(check('NO_TIMESTAMP_DEPENDENT_DECISION',
    !canonicalJson(result.classificationReasons)
      .includes(String(result.timestamp))
      && !canonicalJson(result.restrictions.map((r) => r.code))
        .includes(String(result.timestamp)),
    'classification and restrictions do not reference the timestamp'));
  checks.push(check('NO_RANDOM_DECISION',
    result.replay.identical === true,
    'the double-run replay proves the absence of randomness'));

  // ------------------------------------------------------------------
  // Credential & provider safety (61–62)
  // ------------------------------------------------------------------
  checks.push(check('NO_CREDENTIAL_PROPAGATION',
    !CREDENTIAL_KEYS.test(serializedResult),
    'no credential surface exists anywhere in the governance result'));
  checks.push(check('NO_RAW_PROVIDER_API_PROPAGATION',
    !CREDENTIAL_KEYS.test(serializedPackage),
    'no provider API surface exists in the handoff package'));
  checks.push(check('NO_AEGIS_AUTHORIZATION_GENERATION',
    !AEGIS_KEYS.test(serializedResult),
    'no AEGIS authorization is generated anywhere'));

  // ------------------------------------------------------------------
  // Additional hard guarantees (66–74)
  // ------------------------------------------------------------------
  checks.push(check('GOVERNANCE_DISCLAIMER_CANONICAL',
    result.disclaimer === GOVERNANCE_DISCLAIMER
      && result.handoffPackage.disclaimer === GOVERNANCE_DISCLAIMER,
    'the exact canonical disclaimer is present on result and package'));
  checks.push(check('POLICY_REGISTRY_COMPLETE',
    policyIdsComplete(result.policies),
    'all twelve canonical policies were evaluated'));
  checks.push(check('POLICY_VERSION_RECORDED',
    result.context.policyVersion === GOVERNANCE_POLICY_VERSION
      && result.policies.every((p) => p.version === GOVERNANCE_POLICY_VERSION),
    'the policy set version is recorded and uniform'));
  checks.push(check('BASELINE_RESTRICTIONS_ALWAYS_PRESENT',
    result.handoffPackage.governanceRestrictions.includes('ANALYTICAL_ONLY')
      && result.handoffPackage.governanceRestrictions
        .includes('NO_EXECUTION')
      && result.handoffPackage.governanceRestrictions
        .includes('LIMITED_TO_DOMAIN'),
    'every handoff carries ANALYTICAL_ONLY, NO_EXECUTION and '
      + 'LIMITED_TO_DOMAIN'));
  checks.push(check('BLOCKED_NEVER_RECOMMENDS',
    result.strategyInput.classification === 'HANDOFF_ALLOWED'
      || result.strategyInput.classification
        === 'HANDOFF_ALLOWED_WITH_LIMITATIONS'
      || result.strategyInput.recommendedAlternativeId === null,
    'a blocked or research-gated handoff never surfaces a recommended '
      + 'alternative to Strategy'));
  checks.push(check('ANNOTATIONS_ORDER_INDEPENDENT',
    arraysEqual(result.annotations, [...result.annotations].sort()),
    'annotations are stored in canonical sorted order'));
  checks.push(check('INFORMATIONAL_ONLY',
    result.informational === true
      && result.context.informational === true
      && result.research.informational === true,
    'the governance result, context and research context are informational'));
  checks.push(check('GATE_PRECEDENCE_CONSISTENT',
    gatePrecedenceConsistent(result),
    'classification respects the deterministic gate precedence'));
  checks.push(check('RESTRICTION_CODES_LEGAL',
    result.restrictions.every((r) =>
      HANDOFF_RESTRICTION_CODES.includes(r.code)),
    'every restriction code is part of the canonical vocabulary'));
  checks.push(check('ENGINE_VERSION_RECORDED',
    result.context.governanceVersion === GOVERNANCE_ENGINE_VERSION,
    `the deterministic engine version ${GOVERNANCE_ENGINE_VERSION} is `
      + 'recorded in the context'));
  checks.push(check('CONFIG_FINGERPRINT_STABLE',
    canonicalJson(context.config).length > 0
      && context.config.schemaVersion === 'decision-governance.config.v1',
    'the governance configuration is versioned and serializable'));

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}

function restrictionCodesSortedUnique(result: GovernanceResult): boolean {
  const codes = result.handoffPackage.governanceRestrictions;
  const restrictionCodes = result.restrictions.map((r) => r.code);
  return arraysEqual(codes, [...codes].sort())
    && new Set(codes).size === codes.length
    && arraysEqual(restrictionCodes, [...restrictionCodes].sort())
    && arraysEqual(codes, [...new Set(restrictionCodes)].sort());
}

function feedbackSortedUnique(result: GovernanceResult): boolean {
  const keys = result.feedback.map((f) => f.feedbackId);
  return new Set(keys).size === keys.length
    && arraysEqual(result.feedback.map((f) => f.kind),
      [...result.feedback.map((f) => f.kind)].sort());
}

function policyIdsComplete(policies: readonly PolicyEvaluation[]): boolean {
  const expected = [
    'policy-evidence-sufficiency', 'policy-stale-evidence',
    'policy-conflicted-evidence', 'policy-comparability', 'policy-stability',
    'policy-leakage', 'policy-regime-dependency',
    'policy-strategy-dependency', 'policy-venue-dependency',
    'policy-research-gaps', 'policy-semantic-safety',
    'policy-authority-boundaries',
  ];
  const ids = policies.map((p) => p.policyId);
  return arraysEqual([...ids].sort(), [...expected].sort());
}

function gatePrecedenceConsistent(result: GovernanceResult): boolean {
  if (result.safetyGate.state === 'BLOCK_UNSAFE') {
    return result.classification === 'HANDOFF_BLOCKED';
  }
  if (result.authorityCheck.state === 'BOUNDARY_VIOLATED') {
    return result.classification === 'HANDOFF_BLOCKED';
  }
  if (result.evidenceGate.state === 'BLOCK_NOT_COMPARABLE') {
    return result.classification === 'HANDOFF_NOT_COMPARABLE'
      || result.classification === 'HANDOFF_BLOCKED';
  }
  if (result.evidenceGate.state === 'BLOCK_CONFLICTED') {
    return result.classification === 'HANDOFF_CONFLICTED'
      || result.classification === 'HANDOFF_BLOCKED';
  }
  if (result.evidenceGate.state === 'BLOCK_INSUFFICIENT_EVIDENCE') {
    return result.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE'
      || result.classification === 'HANDOFF_BLOCKED';
  }
  return true;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
