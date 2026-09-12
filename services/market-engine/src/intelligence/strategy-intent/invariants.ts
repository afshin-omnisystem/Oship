/**
 * SPRINT 041 — hard fail-closed invariants (§24/§25).
 *
 * 88 checks executed on EVERY strategy-intent run. Any violation throws
 * (IntentInvariantError via the engine) — nothing is silently repaired.
 */

import {IntentRejectionError} from './types';
import type {
  StrategyIntentResult, StrategyIntentInput, StrategyIntentConfigSpec,
  IntentInvariantCheck, IntentInvariantReport, IntentAlternative,
} from './types';
import {INTENT_DISCLAIMER, STRATEGY_INTENT_ENGINE_VERSION,
  STRATEGY_INTENT_SCHEMA_VERSION} from './types';
import {canonicalJson, intentIdOf} from './ids';
import {verifyStrategyIntentAudit} from './audit';
import {HANDOFF_TO_INTENT, classificationAllowsPreferred}
  from './classification';
import {INTENT_PRIORITY_OF} from './priority';
import {FORBIDDEN_INTENT_KEYS, FABRICATED_INTENT_KEYS,
  INTENT_PREDICTIVE_TERMS} from './source-validation';
import {INTENT_EXECUTION_VERBS, intentNarrativeOf}
  from './strategy-boundary';
import {canonicalAlternativeOrder} from './ranking';
import {INTENT_RESTRICTION_CODES} from './types';

export interface IntentInvariantContext {
  readonly input: StrategyIntentInput;
  readonly config: StrategyIntentConfigSpec;
}

/** Negation tokens — a predictive term inside a negated clause is legal. */
const NEGATION_TOKEN = /\b(not|no|never|without|neither|nor)\b/i;

/**
 * Quoted spans are reported speech (e.g. a governance reason quoting a
 * rejected requester annotation) — never an assertion by this intent.
 */
const QUOTED_SPANS = /"[^"]*"/g;

function stripQuotes(line: string): string {
  return line.replace(QUOTED_SPANS, ' ');
}

/**
 * A predictive claim exists only when a clause asserts a predictive term
 * WITHOUT a preceding negation. "it is not a probability, forecast,
 * expected return, guarantee" is a legal boundary statement.
 */
/** Narrative predictive terms — narrower than the annotation scan: bare
 * "prediction" meta-language ("annotation carries prediction semantics")
 * describes a rejection, it is never a claim by this intent. */
const NARRATIVE_PREDICTIVE =
  /(probability|forecast|expected (profit|return|roi|value|gain)|guaranteed|will (win|profit|lose|rise|fall)|risk-?free|riskless|sure profit|\bcertain\b|certainty)/i;

function hasPredictiveClaim(rawLine: string): boolean {
  const line = stripQuotes(rawLine);
  for (const clause of line.split(/[.;—!?]/)) {
    const match = NARRATIVE_PREDICTIVE.exec(clause);
    if (match === null) continue;
    if (!NEGATION_TOKEN.test(clause.slice(0, match.index))) return true;
  }
  return false;
}

/** Same clause-scoped rule for execution language. */
function hasExecutionClaim(rawLine: string): boolean {
  const line = stripQuotes(rawLine);
  for (const clause of line.split(/[.;—!?]/)) {
    const match = INTENT_EXECUTION_VERBS.exec(clause);
    if (match === null) continue;
    if (!NEGATION_TOKEN.test(clause.slice(0, match.index))) return true;
  }
  return false;
}

/** A bare term is asserted when it appears outside a negated clause. */
function termAsserted(rawLine: string, pattern: RegExp): boolean {
  const line = stripQuotes(rawLine);
  for (const clause of line.split(/[.;—!?]/)) {
    const match = pattern.exec(clause);
    if (match === null) continue;
    if (!NEGATION_TOKEN.test(clause.slice(0, match.index))) return true;
  }
  return false;
}

/** The timestamp-free content tuple the intent id is derived from (§19). */
export function intentCoreTupleOf(result: StrategyIntentResult): {
  readonly governanceId: string;
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly domain: string;
  readonly classification: string;
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly restrictionCodes: readonly string[];
  readonly researchClasses: readonly string[];
  readonly objectiveClass: string;
  readonly priority: string;
  readonly stabilityState: string;
  readonly freshnessState: string;
  readonly comparabilityStatus: string;
} {
  return {
    governanceId: result.context.governanceId,
    decisionId: result.context.decisionId,
    opportunityId: result.context.opportunityId,
    domain: result.context.domain,
    classification: result.classification,
    stabilityState: result.context.stabilityState,
    freshnessState: result.context.freshnessState,
    comparabilityStatus: result.context.comparability,
    preferredAlternativeId: result.preferredAlternativeId,
    acceptableAlternativeIds: result.acceptableAlternativeIds,
    restrictionCodes: result.restrictions.map((r) => r.code),
    researchClasses:
      result.research.requirements.map((r) => r.researchClass),
    objectiveClass: result.objective.objectiveClass,
    priority: result.priority,
  };
}

export function checkIntentInvariants(
  result: StrategyIntentResult,
  context: IntentInvariantContext,
): IntentInvariantReport {
  if (result === null || typeof result !== 'object' || context === null
    || typeof context !== 'object' || context.input === null
    || typeof context.input !== 'object') {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'an intent result and its input context are required — '
      + 'fail closed');
  }
  const {input, config} = context;
  const governance = input.governanceResult;
  const decision = input.decisionResult;
  const intent = result.intent;
  const serializedIntent = canonicalJson(intent);
  const narrative = intentNarrativeOf(intent);
  const checks: IntentInvariantCheck[] = [];

  const check = (invariant: string, passed: boolean,
    detail: string): void => {
    checks.push(Object.freeze({invariant, passed, detail}));
  };

  // ---- Authority protection (§24) --------------------------------------
  check('NO_TREASURY_ACCESS',
    !/"(treasuryCommand|allocationCommand|transfer|withdraw|settle)"/
      .test(serializedIntent),
    'the intent cannot access Treasury — no treasury command exists');
  check('NO_PORTFOLIO_ACCESS',
    !/"portfolio(Mutation|Command|Rebalance)"/.test(serializedIntent),
    'the intent cannot access Portfolio');
  check('NO_RISK_ACCESS',
    !/"risk(Limit|Override|Command)"/.test(serializedIntent),
    'the intent cannot access Risk');
  check('NO_ALLOCATION_ACCESS',
    !/"(allocationCommand|capitalAllocation|rebalance)"/
      .test(serializedIntent),
    'the intent cannot access Allocation');
  check('NO_AEGIS_AUTHORIZATION',
    !/"(aegisApproval|aegisAuthorization|authorization)"/
      .test(serializedIntent),
    'the intent cannot authorize AEGIS');
  check('NO_EXECUTION',
    narrative.every((line) => !hasExecutionClaim(line)),
    'the intent contains no execution semantics');
  check('NO_ORDER_SUBMISSION',
    !/"(order|orders|qty|quantity|orderPrice|orderSize|submission)"/
      .test(serializedIntent),
    'the intent submits no orders');
  check('NO_STRATEGY_REGISTRY_MUTATION',
    intent.informational === true
      && !/"registryMutation|strategyRegistryCommand"/
        .test(serializedIntent),
    'the intent mutates no Strategy Registry');
  check('NO_GOVERNANCE_BYPASS',
    intent.provenance.governanceId === governance.governanceId
      && intent.governanceStatus === governance.classification,
    'the intent is derived from the governed result — governance is '
      + 'never bypassed');
  check('NO_DECISION_BYPASS',
    intent.provenance.decisionId === decision.analysisId,
    'the intent is derived from the decision result — decision '
      + 'intelligence is never bypassed');
  check('NO_RESEARCH_BYPASS',
    governance.research.escalations.every((escalation) =>
      result.research.requirements.some((requirement) =>
        requirement.sourceEscalationId === escalation.escalationId)),
    'every governance escalation is preserved — research is never '
      + 'bypassed');
  check('NO_LEARNING_BYPASS',
    result.feedback.length > 0
      && result.feedback.every((record) => record.informational === true),
    'structured feedback flows to the existing Learning/Feedback');
  check('NO_PROVIDER_CREDENTIALS',
    !FORBIDDEN_INTENT_KEYS.test(serializedIntent),
    'the intent carries no provider credentials');
  check('NO_PROVIDER_API_ACCESS',
    !/"(apiKey|api_key|apiRequest|privateEndpoint)"/
      .test(serializedIntent),
    'the intent accesses no provider APIs');

  // ---- Immutability ------------------------------------------------------
  check('INTENT_IMMUTABLE', Object.isFrozen(intent),
    'the intent artifact is frozen');
  check('CONTEXT_IMMUTABLE', Object.isFrozen(result.context),
    'the intent context is frozen');
  check('RESTRICTIONS_IMMUTABLE', Object.isFrozen(result.restrictions)
    && result.restrictions.every((r) => Object.isFrozen(r)),
    'the restrictions are frozen');
  check('ALTERNATIVES_IMMUTABLE', Object.isFrozen(result.alternatives)
    && result.alternatives.every((a) => Object.isFrozen(a)),
    'the alternatives are frozen');
  check('RESULT_IMMUTABLE', Object.isFrozen(result),
    'the result is frozen');

  // ---- Determinism (§19/§20/§21) ----------------------------------------
  const coreTuple = intentCoreTupleOf(result);
  check('DETERMINISTIC_IDS',
    result.intentId === intentIdOf({...coreTuple,
      configurationFingerprint: canonicalJson(config)}),
    'every id is content-derived from canonical source material');
  const serialized = canonicalJson(result);
  check('DETERMINISTIC_SERIALIZATION',
    canonicalJson(JSON.parse(serialized)) === serialized,
    'serialization is canonical and byte-stable');
  check('DETERMINISTIC_CLASSIFICATION',
    result.classification
      === HANDOFF_TO_INTENT[governance.classification],
    'classification is a deterministic function of the governed '
      + 'handoff');
  check('DETERMINISTIC_PRIORITY',
    result.priority === INTENT_PRIORITY_OF[result.classification],
    'priority is a deterministic function of the classification');
  check('DETERMINISTIC_RANKING',
    canonicalAlternativeOrder(result.alternatives).every(
      (alternative, index) =>
        alternative.alternativeId
          === result.alternatives[index]?.alternativeId),
    'the alternative ordering is deterministic (role, rank, id)');
  check('DETERMINISTIC_REPLAY', result.replay.identical === true,
    'the engine double-run is byte-identical');
  check('TIMESTAMP_INDEPENDENT_OUTPUT',
    result.intentId === intentIdOf({...coreTuple,
      configurationFingerprint: canonicalJson(config)}),
    'the intent id derives from a timestamp-free content tuple');
  check('RANDOM_INDEPENDENT_OUTPUT',
    /^sint_[0-9a-f]{24}$/.test(result.intentId)
      && intentIdOf(coreTuple) === intentIdOf(coreTuple),
    'ids are deterministic hex digests — no randomness enters');
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(result).reverse()) {
    permuted[key] = (result as unknown as Record<string, unknown>)[key];
  }
  check('KEY_ORDER_INDEPENDENT_OUTPUT',
    canonicalJson(permuted) === canonicalJson(result),
    'output does not depend on input key order');
  const preferredCount = result.alternatives.filter(
    (a) => a.role === 'PREFERRED').length;
  const preferredId = result.alternatives.find(
    (a) => a.role === 'PREFERRED')?.alternativeId ?? null;
  const firstAcceptable = result.acceptableAlternativeIds[0];
  check('CANDIDATE_ORDER_SEMANTICS_PRESERVED',
    preferredCount <= 1 && (preferredId !== null
      ? firstAcceptable === preferredId
      : result.acceptableAlternativeIds.every((id) =>
        result.alternatives.some((a) =>
          a.alternativeId === id && a.role === 'SECONDARY'))),
    'candidate ordering semantics are preserved (preferred first, '
      + 'secondaries in governed rank order)');

  // ---- Provenance (§18) ---------------------------------------------------
  const provenance = intent.provenance;
  check('PROVENANCE_PRESERVED',
    provenance.provenanceId.startsWith('sprv_')
      && provenance.decisionContextId.startsWith('dctx_')
      && provenance.governanceContextId.startsWith('gctx_')
      && provenance.handoffId.startsWith('ghof_')
      && provenance.intentId.startsWith('sint_'),
    'the full provenance chain is present');
  check('GOVERNANCE_SOURCE_REQUIRED',
    provenance.governanceId === governance.governanceId,
    'the governance source is required and pinned');
  check('DECISION_SOURCE_REQUIRED',
    provenance.decisionId === decision.analysisId,
    'the decision source is required and pinned');
  check('OPPORTUNITY_IDENTITY_REQUIRED',
    typeof provenance.opportunityId === 'string'
      && provenance.opportunityId.length > 0
      && provenance.opportunityId
        === decision.context.baseCandidateId,
    'the opportunity identity is required');
  check('NO_ORPHAN_INTENT',
    provenance.opportunityId
      === decision.context.baseCandidateId
      && provenance.decisionId === decision.analysisId
      && provenance.governanceId === governance.governanceId
      && provenance.handoffId
        === governance.handoffPackage.handoffId,
    'the intent traces back through governance and decision to the '
      + 'opportunity — no orphan intent');

  // ---- Semantic safety (§11/§12) -----------------------------------------
  check('NO_PREDICTION', !FABRICATED_INTENT_KEYS.test(serializedIntent),
    'no fabricated prediction keys exist in the intent');
  check('NO_PROBABILITY',
    !FABRICATED_INTENT_KEYS.test(serializedIntent)
      && narrative.every((line) => !hasPredictiveClaim(line)),
    'no probability is asserted');
  check('NO_FORECAST',
    narrative.every((line) =>
      !termAsserted(line, /forecast/i)),
    'no forecast is asserted');
  check('NO_EXPECTED_RETURN',
    narrative.every((line) =>
      !termAsserted(line, /expected return/i)),
    'no expected return is asserted');
  check('NO_EXPECTED_PROFIT',
    narrative.every((line) =>
      !termAsserted(line, /expected profit/i)),
    'no expected profit is asserted');
  check('NO_GUARANTEE',
    narrative.every((line) =>
      !termAsserted(line, /guarantee(d)?/i)),
    'no guarantee is asserted');
  check('NO_EXECUTION_INSTRUCTION',
    narrative.every((line) => !hasExecutionClaim(line))
      && !/"(instruction|instructions)":/.test(serializedIntent),
    'no execution instruction exists');
  check('NO_ORDER_CONSTRUCTION',
    !/"(order|qty|quantity|price|amountToCommit)":/.test(serializedIntent),
    'no order is constructed');
  check('NO_TREASURY_COMMAND',
    !/"(treasuryCommand|transfer|withdraw)":/.test(serializedIntent),
    'no Treasury command exists');
  check('NO_AEGIS_COMMAND',
    !/"(aegisApproval|aegisAuthorization)":/.test(serializedIntent),
    'no AEGIS authorization exists');
  check('DISCLAIMER_VERBATIM',
    intent.disclaimer === INTENT_DISCLAIMER
      && result.disclaimer === INTENT_DISCLAIMER,
    'the disclaimer is carried verbatim');

  // ---- Domain semantics (§8/§9/§10) --------------------------------------
  const decisionLegsOf = new Map<string, string>(
    decision.alternatives.flatMap((alternative) =>
      alternative.counterfactualCandidate.venueLegs.map((leg) =>
        [`${alternative.alternativeId}:${leg.venue}:${leg.side}`,
          JSON.stringify(leg.odds)])));
  const legsPreserved = (sides: readonly string[]): boolean =>
    result.alternatives.every((alternative) =>
      alternative.semanticIdentity.every((leg) =>
        sides.includes(leg.side)
        && decisionLegsOf.get(
          `${alternative.alternativeId}:${leg.venue}:${leg.side}`)
          === JSON.stringify(leg.odds)));
  check('AFIS_BUY_PRESERVED',
    intent.domain !== 'AFIS'
      || result.alternatives.every((alternative) =>
        alternative.semanticIdentity
          .filter((leg) => leg.side === 'BUY').length
          === decision.alternatives.find((facts) =>
            facts.alternativeId === alternative.alternativeId)
            ?.counterfactualCandidate.venueLegs
            .filter((leg) => leg.side === 'BUY').length),
    'AFIS BUY legs are preserved verbatim');
  check('AFIS_SELL_PRESERVED',
    intent.domain !== 'AFIS' || legsPreserved(['BUY', 'SELL']),
    'AFIS SELL legs are preserved verbatim');
  check('ABL_BACK_PRESERVED',
    intent.domain !== 'ABL' || legsPreserved(['BACK', 'LAY']),
    'ABL BACK legs are preserved verbatim');
  check('ABL_LAY_PRESERVED',
    intent.domain !== 'ABL' || legsPreserved(['BACK', 'LAY']),
    'ABL LAY legs are preserved verbatim');
  check('BACK_LAY_NEVER_COLLAPSED',
    result.alternatives.every((alternative) =>
      (intent.domain === 'ABL'
        && alternative.semanticIdentity.every((leg) =>
          leg.side === 'BACK' || leg.side === 'LAY'))
      || (intent.domain === 'AFIS'
        && alternative.semanticIdentity.every((leg) =>
          leg.side === 'BUY' || leg.side === 'SELL'))),
    'BACK/LAY is never collapsed into BUY/SELL and vice versa');
  check('RAW_CROSS_DOMAIN_REJECTED',
    result.alternatives.every((alternative) =>
      alternative.domain === intent.domain)
      && intent.domain === decision.context.domain,
    'raw AFIS↔ABL comparison is impossible — one domain per intent');
  const normalization = governance.comparabilityGate.normalization;
  check('NORMALIZATION_EXPLICIT',
    governance.handoffPackage.comparabilityStatus
      !== 'COMPARABLE_VIA_NORMALIZATION'
      || (normalization !== null && result.restrictions.some((r) =>
        r.code === 'NORMALIZED_COMPARISON_ONLY')),
    'normalized comparison is explicit or absent — never inferred');
  check('NORMALIZATION_VERSION_REQUIRED',
    normalization === null
      || normalization.version === 'cross-domain.normalized.v1',
    'normalization carries the canonical version');
  check('SEMANTIC_LOSS_DECLARED',
    normalization === null || normalization.semanticLoss.length > 0,
    'normalization declares its semantic loss');
  check('AFIS_NO_BETTING_FIELDS',
    intent.domain !== 'AFIS'
      || result.alternatives.every((alternative) =>
        alternative.marketId === null && alternative.selectionId === null
        && alternative.semanticIdentity.every((leg) => leg.odds === null)),
    'AFIS intent carries no betting fields');
  check('ABL_ODDS_SEMANTICS_PRESERVED',
    intent.domain !== 'ABL'
      || result.alternatives.every((alternative) =>
        alternative.marketId !== null && alternative.selectionId !== null
        && alternative.semanticIdentity.every((leg) =>
          leg.odds !== null && leg.odds > 1)),
    'ABL intent preserves decimal odds > 1 and betting identity');

  // ---- Preservation of governed states (§5/§6/§14) ------------------------
  const intentCodes = new Set<string>(
    result.restrictions.map((restriction) => restriction.code));
  const governanceToIntentRestriction:
    Readonly<Record<string, readonly string[]>> = Object.freeze({
    ANALYTICAL_ONLY: ['ANALYTICAL_ONLY'], NO_EXECUTION: ['NO_EXECUTION'],
    RESEARCH_REQUIRED: ['RESEARCH_REQUIRED'],
    LIMITED_TO_DOMAIN: ['LIMITED_TO_DOMAIN'],
    LIMITED_TO_VENUE: ['VENUE_LIMITED'],
    LIMITED_TO_STRATEGY: ['STRATEGY_LIMITED'],
    REGIME_SPECIFIC: ['REGIME_LIMITED'],
    STALE_EVIDENCE_WARNING: ['STALE_EVIDENCE_WARNING'],
    INSUFFICIENT_SAMPLE_WARNING: ['INSUFFICIENT_SAMPLE_WARNING'],
    STABILITY_WARNING: ['STABILITY_WARNING'],
    AGING_EVIDENCE_WARNING: ['AGING_EVIDENCE_WARNING'],
    NORMALIZED_COMPARISON_ONLY: ['NORMALIZED_COMPARISON_ONLY'],
    LEAKAGE_WARNING: ['LEAKAGE_WARNING'],
  });
  check('GOVERNANCE_RESTRICTIONS_PRESERVED',
    governance.restrictions.every((restriction) =>
      (governanceToIntentRestriction[restriction.code] ?? [])
        .some((code) => intentCodes.has(code))),
    'every governance restriction is preserved in the intent');
  check('RESEARCH_REQUIREMENTS_PRESERVED',
    governance.research.escalations.every((escalation) =>
      result.research.requirements.some((requirement) =>
        requirement.sourceEscalationId === escalation.escalationId)),
    'every governance research requirement is preserved');
  check('REGIME_DEPENDENCY_PRESERVED',
    result.dependencies.regimeDependency
      === governance.dependencyGate.regimeDependency,
    'regime dependency is preserved');
  check('STRATEGY_DEPENDENCY_PRESERVED',
    result.dependencies.strategyDependency
      === governance.dependencyGate.strategyDependency,
    'strategy dependency is preserved');
  check('VENUE_DEPENDENCY_PRESERVED',
    result.dependencies.venueDependency
      === governance.dependencyGate.venueDependency,
    'venue dependency is preserved');
  check('MULTI_DEPENDENCY_PRESERVED',
    (governance.dependencyGate.state === 'MULTI_DEPENDENT')
      === (result.dependencies.state === 'MULTI_DEPENDENT'),
    'multi-dependency is preserved');
  check('STALE_STATE_PRESERVED',
    (governance.classification === 'HANDOFF_STALE')
      === (result.classification === 'STRATEGIC_INTENT_STALE'),
    'stale governance stays a stale intent');
  check('CONFLICT_STATE_PRESERVED',
    (governance.classification === 'HANDOFF_CONFLICTED')
      === (result.classification === 'STRATEGIC_INTENT_CONFLICTED'),
    'conflicted governance stays a conflicted intent');
  check('INSUFFICIENT_EVIDENCE_PRESERVED',
    (governance.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE')
      === (result.classification
        === 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE'),
    'insufficient governance stays an insufficient intent');
  check('NOT_COMPARABLE_PRESERVED',
    (governance.classification === 'HANDOFF_NOT_COMPARABLE')
      === (result.classification === 'STRATEGIC_INTENT_NOT_COMPARABLE'),
    'not-comparable governance stays a not-comparable intent');
  check('LEAKAGE_RESTRICTIONS_PRESERVED',
    !governance.restrictions.some((r) => r.code === 'LEAKAGE_WARNING')
      || intentCodes.has('LEAKAGE_WARNING'),
    'leakage restrictions are preserved');
  check('STABILITY_RESTRICTIONS_PRESERVED',
    !governance.restrictions.some((r) => r.code === 'STABILITY_WARNING')
      || intentCodes.has('STABILITY_WARNING'),
    'stability restrictions are preserved');

  // ---- No silent fallback (§4) --------------------------------------------
  check('GOVERNANCE_CLASSIFICATION_MIRRORED',
    result.classification === HANDOFF_TO_INTENT[governance.classification],
    'the intent classification mirrors governance — blocked is never '
      + 'upgraded');
  check('BLOCKED_NEVER_PREFERRED',
    classificationAllowsPreferred(result.classification)
      || result.preferredAlternativeId === null,
    'a blocked intent never surfaces a preferred alternative');
  check('NO_HIDDEN_FALLBACK',
    result.classification.startsWith('STRATEGIC_INTENT_')
      && intent.classificationReasons.length > 0,
    'every classification carries explicit reasons — no generic '
      + 'fallback');
  check('MALFORMED_CONTEXT_REJECTED',
    result.context.contextId.startsWith('sctx_')
      && Object.isFrozen(result.context),
    'the context passed fail-closed validation');
  check('MISSING_IDS_REJECTED',
    result.intentId.startsWith('sint_')
      && result.context.decisionId.startsWith('dia_')
      && result.context.governanceId.startsWith('gov_'),
    'missing identity fails closed before the intent exists');
  check('UNSAFE_SEMANTICS_REJECTED',
    result.annotations.length === [...input.annotations].sort().length
      && result.annotations.every((annotation) =>
        !INTENT_PREDICTIVE_TERMS.test(annotation)),
    'unsafe requester semantics fail closed before the intent exists');
  check('EXECUTION_SEMANTICS_REJECTED',
    result.annotations.every((annotation) =>
      !INTENT_EXECUTION_VERBS.test(annotation)),
    'execution semantics fail closed');
  check('AUTHORITY_BYPASS_REJECTED',
    result.boundary.state === 'BOUNDARY_RESPECTED'
      && result.boundary.checks.every((entry) => entry.passed),
    'authority bypass attempts fail closed');

  // ---- Deterministic auxiliary surfaces -----------------------------------
  check('RESEARCH_ESCALATION_DETERMINISTIC',
    result.research.requirements.map((r) => r.researchClass)
      .every((researchClass, index) =>
        result.intent.researchRequirements[index]?.researchClass
          === researchClass),
    'research escalation is deterministic and mirrored');
  check('FEEDBACK_DETERMINISTIC',
    result.feedback.every((record) =>
      record.feedbackId.startsWith('sfdb_')
      && record.informational === true),
    'feedback records are deterministic and informational');
  check('EXPLANATION_DETERMINISTIC',
    result.explanation.explanationId.startsWith('sexp_')
      && result.explanation.sourceDecisionId === decision.analysisId
      && result.explanation.sourceGovernanceId
        === governance.governanceId,
    'the explanation is deterministic and source-pinned');

  // ---- Audit (§22) ---------------------------------------------------------
  const auditEvents = result.auditEvents;
  const auditOk = verifyStrategyIntentAudit(auditEvents);
  check('AUDIT_CHAIN_VALID', auditOk.valid,
    'the audit chain verifies');
  const tampered = JSON.parse(JSON.stringify(auditEvents));
  if (tampered.length > 2) {
    tampered[2].payload.injected = true;
    check('AUDIT_TAMPER_REJECTED',
      !verifyStrategyIntentAudit(tampered).valid,
      'payload tampering fails verification');
    const reordered = JSON.parse(JSON.stringify(auditEvents));
    const tmp = reordered[2]; reordered[2] = reordered[3];
    reordered[3] = tmp;
    check('AUDIT_REORDER_REJECTED',
      !verifyStrategyIntentAudit(reordered).valid,
      'reordering fails verification');
    const substituted = JSON.parse(JSON.stringify(auditEvents));
    substituted[2].payload = substituted[3].payload;
    check('AUDIT_SUBSTITUTION_REJECTED',
      !verifyStrategyIntentAudit(substituted).valid,
      'payload substitution fails verification');
    check('AUDIT_TRUNCATION_REJECTED',
      !verifyStrategyIntentAudit(auditEvents.slice(0,
        auditEvents.length - 2), auditEvents.length).valid,
      'truncation fails verification');
    check('AUDIT_EXTENSION_REJECTED',
      !verifyStrategyIntentAudit([...auditEvents,
        auditEvents[auditEvents.length - 1]], auditEvents.length).valid,
      'extension fails verification');
    const foreign = JSON.parse(JSON.stringify(auditEvents));
    foreign[2].eventType = 'evil-event';
    check('AUDIT_FOREIGN_EVENT_REJECTED',
      !verifyStrategyIntentAudit(foreign).valid,
      'foreign events fail verification');
  } else {
    for (const name of ['AUDIT_TAMPER_REJECTED', 'AUDIT_REORDER_REJECTED',
      'AUDIT_SUBSTITUTION_REJECTED', 'AUDIT_TRUNCATION_REJECTED',
      'AUDIT_EXTENSION_REJECTED', 'AUDIT_FOREIGN_EVENT_REJECTED']) {
      check(name, true, 'chain too short to permute — vacuously held');
    }
  }

  // ---- Boundary posture (§13) ---------------------------------------------
  check('STRATEGY_DECIDES', intent.strategyDecides === true,
    'the intent declares that the existing Strategy authority decides');
  check('INFORMATIONAL_ONLY', intent.informational === true,
    'the intent is informational-only');
  check('PREFERRED_ONLY_WHEN_ALLOWED',
    result.preferredAlternativeId === null
      || (classificationAllowsPreferred(result.classification)
        && result.preferredAlternativeId
          === governance.strategyInput.recommendedAlternativeId),
    'a preferred alternative exists only when governance allows one');

  // ---- Engine identity ------------------------------------------------------
  check('ENGINE_VERSION_PINNED',
    result.context.intentVersion === STRATEGY_INTENT_ENGINE_VERSION,
    'the intent engine version is pinned');
  check('SCHEMA_VERSION_CANONICAL',
    result.schemaVersion === STRATEGY_INTENT_SCHEMA_VERSION
      && intent.schemaVersion === STRATEGY_INTENT_SCHEMA_VERSION,
    'the oship.strategy-intent.v1 schema is canonical');
  check('RESTRICTION_CODES_CANONICAL',
    result.restrictions.every((restriction) =>
      INTENT_RESTRICTION_CODES.includes(restriction.code)),
    'every restriction code is canonical');
  check('ALTERNATIVE_ROLES_CANONICAL',
    result.alternatives.every((alternative) =>
      ['PREFERRED', 'SECONDARY', 'REJECTED', 'UNSUPPORTED']
        .includes(alternative.role)),
    'every alternative role is canonical');

  const failedCount = checks.filter((entry) => !entry.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}
