/**
 * SPRINT 042 — invariants (§22): the hard fail-closed contract.
 *
 * 85 checks executed on every evaluation: immutability, determinism,
 * provenance, sources, semantic safety, boundaries, AFIS/ABL semantics,
 * cross-domain rules, restrictions, classification/eligibility gating,
 * research/feedback/explanation, audit integrity and the dimension
 * battery. Any failure rejects the evaluation fail closed.
 */

import type {
  StrategyIntentEvaluationResult, StrategyIntentEvaluationInput,
  EvaluationConfigSpec, EvaluationInvariantReport,
  EvaluationInvariantCheck, EvaluationInvariantSubject,
} from './types';
import {EvaluationRejectionError, EVALUATION_DISCLAIMER,
  ELIGIBILITY_MEANING, EVALUATION_CLASSIFICATIONS,
  EVALUATION_DIMENSION_NAMES, EVALUATION_RESTRICTION_CODES,
  DOWNSTREAM_ELIGIBILITY_STATES, INTENT_DISCLAIMER} from './types';
import {
  EVALUATION_PREDICTION_TERMS, EVALUATION_FUTURE_VALUE_TERMS,
  EVALUATION_EXECUTION_TERMS, EVALUATION_TREASURY_TERMS,
  EVALUATION_PORTFOLIO_TERMS, EVALUATION_RISK_TERMS,
  EVALUATION_ALLOCATION_TERMS, EVALUATION_STRATEGY_BOUNDARY_TERMS,
  EVALUATION_AUTHORITY_TERMS,
} from './safety-validation';
import {FORBIDDEN_EVALUATION_KEYS} from './portfolio-interface';
import {classifyEvaluation} from './classification';
import {assignDownstreamEligibility, EVALUATION_TO_ELIGIBILITY,
  eligibilityAllowsAlternatives} from './eligibility';
import {analyzeRestrictions} from './restriction-analysis';
import {evaluateDimensions} from './dimensions';
import {checkPortfolioInterfaceCompatibility} from './portfolio-interface';
import {verifyStrategyIntentEvaluationAudit,
  verifyEvaluationAuditBinding} from './audit';
import {canonicalJson, evaluationIdOf, evaluationConfigFingerprint,
  evaluationProvenanceIdOf, evaluationExplanationIdOf} from './ids';

export interface EvaluationInvariantContext {
  readonly input: StrategyIntentEvaluationInput;
  readonly config: EvaluationConfigSpec;
}

/** The content tuple the evaluation id is derived from (§19). */
export function evaluationCoreTupleOf(
  result: EvaluationInvariantSubject,
): Record<string, unknown> {
  return {
    intentId: result.intentId,
    intentFingerprint: result.intentFingerprint,
    intentClassification: result.intentClassification,
    evaluationClassification: result.classification,
    eligibility: result.eligibility,
    preferredAlternativeId: result.preferredAlternativeId,
    acceptableAlternativeIds: result.acceptableAlternativeIds,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    researchClasses: result.research.requirements.map((requirement) =>
      requirement.researchClass),
    gateStates: result.gates.map((gate) => gate.state),
  };
}

/** Every narrative line the evaluation itself generated or carried. */
export function evaluationNarrativesOf(
  result: EvaluationInvariantSubject,
): readonly string[] {
  return [
    ...result.classificationReasons,
    ...result.eligibilityReasons,
    ...result.gates.map((gate) => gate.detail),
    ...result.gates.flatMap((gate) => gate.reasons),
    ...result.dimensions.map((d) => d.detail),
    ...result.restrictions.map((r) => r.reason),
    ...result.research.requirements.map((r) => r.rationale),
    ...result.explanation.classificationSummary,
    ...result.explanation.dimensionSummary,
    ...result.explanation.restrictionSummary,
    ...result.explanation.researchSummary,
    ...result.explanation.eligibilityRationale,
    ...result.explanation.semanticLimitations,
  ];
}

const QUOTED_SPANS = /"[^"]*"/g;
const NEGATION_TOKEN =
  /\b(not|no|never|without|neither|nor|stays?|remains?|preserved)\b/i;

/** A term is asserted only outside negated clauses and quoted spans. */
function termAsserted(line: string, pattern: RegExp): boolean {
  const stripped = line.replace(QUOTED_SPANS, ' ');
  for (const clause of stripped.split(/[.;—!?]/)) {
    const match = pattern.exec(clause);
    if (match === null) continue;
    if (!NEGATION_TOKEN.test(clause.slice(0, match.index))) return true;
  }
  return false;
}

export function checkEvaluationInvariants(
  result: EvaluationInvariantSubject,
  context: EvaluationInvariantContext,
): EvaluationInvariantReport {
  if (result === null || typeof result !== 'object' || context === null
    || typeof context !== 'object' || context.input === null
    || typeof context.input !== 'object') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'an evaluation result and its input context are required — '
        + 'fail closed');
  }
  const {input, config} = context;
  const intentResult = input.intentResult;
  const checks: EvaluationInvariantCheck[] = [];
  const check = (invariant: string, passed: boolean, detail: string):
    void => {
    checks.push(Object.freeze({invariant, passed, detail}));
  };

  const serialized = canonicalJson(result);
  const narratives = evaluationNarrativesOf(result);

  // --- Immutability (8) ----------------------------------------------------
  check('RESULT_IMMUTABLE', Object.isFrozen(result),
    'the evaluation result is frozen');
  check('CONTEXT_IMMUTABLE', Object.isFrozen(result.evaluationContext),
    'the evaluation context is frozen');
  check('DIMENSIONS_IMMUTABLE', Object.isFrozen(result.dimensions)
    && result.dimensions.every((d) => Object.isFrozen(d)),
    'every dimension is frozen');
  check('RESTRICTIONS_IMMUTABLE', Object.isFrozen(result.restrictions)
    && result.restrictions.every((r) => Object.isFrozen(r)),
    'every restriction is frozen');
  check('FEEDBACK_IMMUTABLE', Object.isFrozen(result.feedback)
    && result.feedback.every((f) => Object.isFrozen(f)),
    'every feedback record is frozen');
  check('GATES_IMMUTABLE', Object.isFrozen(result.gates)
    && result.gates.every((g) => Object.isFrozen(g)),
    'every gate result is frozen');
  check('AUDIT_EVENTS_IMMUTABLE', Object.isFrozen(result.auditEvents)
    && result.auditEvents.every((e) => Object.isFrozen(e)),
    'every audit event is frozen');
  check('EXPLANATION_IMMUTABLE', Object.isFrozen(result.explanation),
    'the explanation is frozen');

  // --- Determinism (8) ------------------------------------------------------
  check('DETERMINISTIC_IDS',
    result.evaluationId === evaluationIdOf({
      ...evaluationCoreTupleOf(result),
      configurationFingerprint: canonicalJson(config),
    }),
    'the evaluation id is content-derived from canonical source '
      + 'material');
  check('DETERMINISTIC_SERIALIZATION',
    canonicalJson(JSON.parse(serialized)) === serialized,
    'serialization is canonical and byte-stable');
  {
    const recomputed = classifyEvaluation(intentResult, result.gates);
    check('DETERMINISTIC_CLASSIFICATION',
      recomputed.classification === result.classification,
      'the classification is a deterministic function of the intent '
        + 'and its gates');
  }
  {
    const recomputed = assignDownstreamEligibility(result.classification);
    check('DETERMINISTIC_ELIGIBILITY',
      recomputed.eligibility === result.eligibility,
      'eligibility is a deterministic function of the classification');
  }
  {
    const compatibility = checkPortfolioInterfaceCompatibility(
      intentResult);
    const recomputed = evaluateDimensions({intentResult, config,
      evaluationId: result.evaluationId,
      portfolioCompatible: compatibility.compatible,
      normalizationRequired: compatibility.normalizationRequired});
    check('DETERMINISTIC_DIMENSIONS',
      canonicalJson(recomputed.map((d) => d.dimensionId))
        === canonicalJson(result.dimensions.map((d) => d.dimensionId)),
      'the dimension battery is deterministic');
  }
  {
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    const permuted: Record<string, unknown> = {};
    for (const key of Object.keys(parsed).sort().reverse()) {
      permuted[key] = parsed[key];
    }
    check('KEY_ORDER_INDEPENDENT_SERIALIZATION',
      canonicalJson(permuted) === serialized,
      'serialization is independent of key insertion order');
  }
  check('TIMESTAMP_FREE_IDS',
    !Object.keys(evaluationCoreTupleOf(result)).includes('timestamp'),
    'the id tuple carries no timestamp, randomness or machine identity');
  check('SERIALIZATION_STABLE',
    canonicalJson(result) === serialized,
    'repeated serialization is byte-identical');

  // --- Provenance (5) --------------------------------------------------------
  {
    const provenance = result.provenance;
    check('PROVENANCE_COMPLETE',
      [provenance.opportunityId, provenance.decisionContextId,
        provenance.decisionId, provenance.governanceContextId,
        provenance.governanceId, provenance.handoffId,
        provenance.strategyInputId, provenance.intentId,
        provenance.evaluationId].every((id) =>
        typeof id === 'string' && id.length > 0),
      'the full provenance chain is present');
    check('PROVENANCE_CHAINS_INTENT',
      provenance.intentId === result.intentId
        && provenance.intentId === intentResult.intentId,
      'provenance binds the evaluated intent');
    check('PROVENANCE_VERSIONS_PINNED',
      provenance.sourceVersions.decisionIntelligenceVersion
        === 'oship.decision-intelligence.engine.v1'
        && provenance.sourceVersions.governanceVersion
        === 'oship.decision-governance.engine.v1'
        && provenance.sourceVersions.intentVersion
        === 'oship.strategy-intent.engine.v1'
        && provenance.sourceVersions.evaluationEngineVersion
        === 'oship.strategy-intent-evaluation.engine.v1',
      'every upstream engine version is pinned');
    check('NO_ORPHAN_EVALUATION',
      provenance.decisionId === intentResult.context.decisionId
        && provenance.governanceId === intentResult.context.governanceId
        && provenance.opportunityId
          === intentResult.context.opportunityId,
      'the evaluation traces to its intent, governance and decision');
    check('PROVENANCE_ID_DETERMINISTIC',
      provenance.provenanceId === evaluationProvenanceIdOf({
        opportunityId: provenance.opportunityId,
        decisionContextId: provenance.decisionContextId,
        decisionId: provenance.decisionId,
        governanceContextId: provenance.governanceContextId,
        governanceId: provenance.governanceId,
        handoffId: provenance.handoffId,
        strategyInputId: provenance.strategyInputId,
        intentId: provenance.intentId,
        evaluationId: provenance.evaluationId,
        sourceVersions: provenance.sourceVersions,
        informational: true,
      }),
      'the provenance id is content-derived');
  }

  // --- Sources (3) -------------------------------------------------------------
  check('SOURCES_REQUIRED',
    intentResult !== null && typeof intentResult === 'object'
      && intentResult.intentId === result.intentId,
    'the governed Sprint 041 result is the only source');
  check('INTENT_FINGERPRINT_ECHOED',
    result.intentFingerprint === intentResult.intentFingerprint,
    'the intent fingerprint is echoed verbatim');
  check('INTENT_CLASSIFICATION_ECHOED',
    result.intentClassification === intentResult.classification,
    'the intent classification is echoed verbatim');

  // --- Semantic safety (14) -----------------------------------------------------
  check('NO_PROBABILITY', !narratives.some((line) =>
    termAsserted(line, /probability|probabilities/i)),
    'no narrative asserts a probability');
  check('NO_FORECAST', !narratives.some((line) =>
    termAsserted(line, /forecast/i)),
    'no narrative asserts a forecast');
  check('NO_EXPECTED_RETURN', !narratives.some((line) =>
    termAsserted(line,
      /expected (return|profit|roi|value|gain|yield)/i)),
    'no narrative asserts an expected return, profit or ROI');
  check('NO_GUARANTEE', !narratives.some((line) =>
    termAsserted(line, /guaranteed|guarantee of/i)),
    'no narrative asserts a guaranteed outcome');
  check('NO_CERTAINTY', !narratives.some((line) =>
    termAsserted(line, /\bcertainty\b|certain to/i)),
    'no narrative asserts certainty');
  check('NO_EXECUTION_INSTRUCTION', !narratives.some((line) =>
    termAsserted(line, EVALUATION_EXECUTION_TERMS)),
    'no narrative carries an execution instruction');
  check('NO_ORDER_KEYS', !FORBIDDEN_EVALUATION_KEYS.test(serialized),
    'no order, sizing, allocation, credential or authorization keys '
      + 'exist in the evaluation');
  check('NO_TREASURY_ACTION', !narratives.some((line) =>
    termAsserted(line, EVALUATION_TREASURY_TERMS)),
    'no narrative requests a Treasury action');
  check('NO_AEGIS_AUTHORIZATION', !narratives.some((line) =>
    termAsserted(line, /aegis (approval|authorization)|authorize aegis/i)),
    'no narrative requests AEGIS authorization');
  check('NO_CREDENTIALS', !/"(apiKey|api_key|secret|password|privateKey|token|credential|credentials)"/
    .test(serialized), 'no credentials exist in the evaluation');
  check('NO_API_REQUESTS', !/"(apiRequest|endpoint|url|webhook)"/
    .test(serialized), 'no API requests exist in the evaluation');
  check('NO_ALLOCATION_LANGUAGE', !narratives.some((line) =>
    termAsserted(line, EVALUATION_ALLOCATION_TERMS)),
    'no narrative allocates or reserves capital');
  check('NO_RISK_AUTHORITY', !narratives.some((line) =>
    termAsserted(line, EVALUATION_RISK_TERMS)),
    'no narrative sets or overrides risk limits');
  check('DISCLAIMER_VERBATIM', result.disclaimer === EVALUATION_DISCLAIMER
    && result.eligibilityMeaning === ELIGIBILITY_MEANING
    && intentResult.intent.disclaimer === INTENT_DISCLAIMER,
    'the evaluation and eligibility disclaimers are verbatim');

  // --- Boundaries (7) -------------------------------------------------------------
  check('NO_PORTFOLIO_MUTATION',
    !/"(portfolioWeight|allocationWeight|positionSize|rebalance)"/
      .test(serialized),
    'the evaluation computes no portfolio weights or positions');
  check('NO_RISK_MUTATION', !/"(riskLimit|varLimit|exposureLimit)"/
    .test(serialized),
    'the evaluation sets no risk limits');
  check('NO_ALLOCATION_MUTATION',
    !/"(capitalAllocation|reserveAmount|allocatedCapital)"/
      .test(serialized),
    'the evaluation allocates no capital');
  check('NO_STRATEGY_REGISTRY_MUTATION',
    !/"(registryWrite|registerAlternative|upsertStrategy|deleteStrategy)"/
      .test(serialized),
    'the evaluation mutates no Strategy Registry entry');
  check('NO_OIIN_MUTATION',
    !/"(publishEvent|injectEvent|deadLetter)"/.test(serialized),
    'the evaluation injects no OIIN events');
  check('BOUNDARY_RESPECTED',
    result.boundary.state === 'BOUNDARY_RESPECTED'
      && result.boundary.checks.every((c) => c.passed),
    'the portfolio bridge boundary is respected');
  check('DOWNSTREAM_DECIDES',
    result.downstreamDecides === true && result.informational === true,
    'the evaluation is informational and the downstream plane decides');

  // --- AFIS/ABL semantics (§10/§11) ---------------------------------------------------
  {
    const domain = result.evaluationContext.domain;
    const alternatives = intentResult.alternatives;
    const afis = alternatives.filter((a) => a.domain === 'AFIS');
    const abl = alternatives.filter((a) => a.domain === 'ABL');
    check('DOMAIN_PRESERVED', domain === intentResult.context.domain,
      'the evaluation domain mirrors the intent domain');
    check('AFIS_SIDES_PRESERVED',
      afis.every((a) => a.semanticIdentity.every((leg) =>
        leg.side === 'BUY' || leg.side === 'SELL'))
        && afis.every((a) => a.marketId === null
          && a.selectionId === null
          && a.semanticIdentity.every((leg) => leg.odds === null)),
      'AFIS alternatives keep BUY/SELL with no betting identity');
    check('ABL_SIDES_PRESERVED',
      abl.every((a) => a.semanticIdentity.every((leg) =>
        leg.side === 'BACK' || leg.side === 'LAY'))
        && abl.every((a) => a.marketId !== null
          && a.selectionId !== null
          && a.semanticIdentity.every((leg) =>
            leg.odds !== null && leg.odds > 1)),
      'ABL alternatives keep BACK/LAY with market, selection and '
        + 'decimal odds');
    check('BACK_LAY_NEVER_COLLAPSED',
      alternatives.every((a) => {
        const sides = a.semanticIdentity.map((leg) => leg.side);
        const afisSides = sides.every((side) =>
          side === 'BUY' || side === 'SELL');
        const ablSides = sides.every((side) =>
          side === 'BACK' || side === 'LAY');
        return afisSides || ablSides;
      }),
      'no alternative mixes or converts BUY/SELL with BACK/LAY');
    check('NO_CROSS_DOMAIN_ALTERNATIVES',
      new Set(alternatives.map((a) => a.domain)).size <= 1,
      'one evaluation never spans both domains');
  }

  // --- Cross-domain (§12) ---------------------------------------------------------------
  {
    const comparability = intentResult.context.comparability;
    const codes = result.restrictions.map((r) => r.code);
    check('RAW_CROSS_DOMAIN_NOT_COMPARABLE',
      comparability !== 'NOT_COMPARABLE'
        || result.eligibility === 'NOT_COMPARABLE',
      'raw cross-domain intents are never eligible');
    check('NORMALIZATION_EXPLICIT',
      comparability !== 'COMPARABLE_VIA_NORMALIZATION'
        || codes.includes('NORMALIZED_COMPARISON_ONLY'),
      'normalized comparison requires the explicit restriction');
    check('INTENT_RESTRICTIONS_CARRIED',
      !config.preserveAllIntentRestrictions
        || intentResult.restrictions.every((restriction) =>
          codes.includes(restriction.code)),
      'every Sprint 041 restriction is carried — nothing weakened');
    check('NORMALIZATION_LOSS_DECLARED',
      comparability !== 'COMPARABLE_VIA_NORMALIZATION'
        || result.explanation.semanticLimitations.some((line) =>
          line.includes('normalization')),
      'the declared semantic loss of normalization is preserved');
  }

  // --- Restrictions (§16) -------------------------------------------------------------------
  {
    const codes = result.restrictions.map((r) => r.code);
    check('RESTRICTIONS_NOT_WEAKENED',
      intentResult.restrictions.every((restriction) =>
        codes.includes(restriction.code)),
      'the intent restriction set is never weakened');
    check('BASELINE_PRESENT',
      ['ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
        'NO_AEGIS_AUTHORIZATION'].every((code) =>
        codes.includes(code as never)),
      'the informational baseline is present');
    check('DOWNSTREAM_BOUNDARY_PRESENT',
      codes.includes('DOWNSTREAM_CONSIDERATION_ONLY'),
      'the downstream consideration boundary is present');
    const ranks = codes.map((code) =>
      (EVALUATION_RESTRICTION_CODES as readonly string[]).indexOf(code));
    check('RESTRICTIONS_CANONICALLY_ORDERED',
      ranks.every((rank, index) =>
        index === 0 || ranks[index - 1] < rank),
      'restrictions are canonically ordered');
    check('RESTRICTIONS_UNIQUE',
      new Set(codes).size === codes.length,
      'restriction codes are unique');
    check('RESTRICTION_REASONS_PRESENT',
      result.restrictions.every((r) => r.reason.length > 0),
      'every restriction carries its reason — the downstream consumer '
        + 'sees exactly why the intent is restricted');
  }

  // --- Classification / eligibility (§8/§9) ---------------------------------------------------
  {
    const blockedFamily = new Set(['EVALUATION_BLOCKED',
      'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
      'EVALUATION_CONFLICTED', 'EVALUATION_STALE',
      'EVALUATION_UNSTABLE']);
    check('CLASSIFICATION_IN_VOCABULARY',
      EVALUATION_CLASSIFICATIONS.includes(result.classification),
      'the classification is one of the thirteen states');
    check('BLOCKED_FAMILIES_SURFACE_NOTHING',
      !blockedFamily.has(result.classification)
        || (result.preferredAlternativeId === null
          && result.acceptableAlternativeIds.length === 0),
      'blocked families surface no alternatives downstream');
    const surfaces = eligibilityAllowsAlternatives(result.eligibility);
    check('ALTERNATIVES_GATED_BY_ELIGIBILITY',
      surfaces
        ? canonicalJson(result.acceptableAlternativeIds)
          === canonicalJson(intentResult.acceptableAlternativeIds)
          && result.preferredAlternativeId
            === intentResult.preferredAlternativeId
        : result.acceptableAlternativeIds.length === 0
          && result.preferredAlternativeId === null,
      'alternatives are surfaced exactly when eligibility allows');
    check('ELIGIBILITY_MAPPING_DETERMINISTIC',
      EVALUATION_TO_ELIGIBILITY.find(([candidate]) =>
        candidate === result.classification)?.[1] === result.eligibility,
      'eligibility follows the frozen classification mapping');
    check('ELIGIBILITY_MEANING_VERBATIM',
      result.eligibilityReasons.includes(ELIGIBILITY_MEANING),
      'the eligibility meaning is stated verbatim');
    check('BLOCKED_NEVER_ELIGIBLE',
      !blockedFamily.has(result.classification)
        || !['ELIGIBLE_FOR_CONSIDERATION',
          'ELIGIBLE_WITH_RESTRICTIONS'].includes(result.eligibility),
      'blocked families are never eligible');
    check('GATES_RECORDED',
      result.gates.length === 8
        && canonicalJson(result.gates.map((g) => g.gate))
          === canonicalJson(['integrity', 'evidence', 'safety',
            'comparability', 'freshness', 'stability', 'dependency',
            'portfolio-interface']),
      'all eight lifecycle gates are recorded in order');
    check('GATE_STATES_VALID',
      result.gates.every((g) => ['PASS', 'PASS_WITH_LIMITATIONS',
        'DEFICIENT', 'BLOCKED'].includes(g.state)),
      'every gate state is explicit');
  }

  // --- Research / feedback / explanation ---------------------------------------------------------
  {
    const intentClasses = intentResult.research.requirements.map(
      (r) => r.researchClass);
    const evalClasses = result.research.requirements.map(
      (r) => r.researchClass);
    check('INTENT_RESEARCH_CARRIED',
      intentClasses.every((researchClass) =>
        evalClasses.includes(researchClass)),
      'every Sprint 041 research requirement is carried verbatim');
    check('RESEARCH_PROVENANCE_EXPLICIT',
      result.research.requirements.every((r) =>
        (r.provenance === 'INTENT_CARRIED')
          === (r.sourceRequirementId !== null)),
      'research provenance is explicit');
    check('FEEDBACK_KINDS_VALID',
      result.feedback.length > 0
        && result.feedback.every((f) =>
          ['INTENT_EVALUATED', 'EVALUATION_RESTRICTED',
            'EVALUATION_BLOCKED', 'EVIDENCE_GAP_FEEDBACK',
            'DEPENDENCY_DETECTED_FEEDBACK',
            'RESEARCH_ESCALATION_FEEDBACK',
            'RESTRICTION_AGGREGATED_FEEDBACK',
            'ALTERNATIVE_PRESERVED_FEEDBACK'].includes(f.kind))
        && result.feedback.some((f) => f.kind === 'INTENT_EVALUATED'),
      'feedback records are valid and always include INTENT_EVALUATED');
    check('EXPLANATION_PINS_SOURCES',
      result.explanation.sourceIntentId === result.intentId
        && result.explanation.sourceDecisionId
          === intentResult.context.decisionId
        && result.explanation.sourceGovernanceId
          === intentResult.context.governanceId,
      'the explanation pins its source ids');
    check('EXPLANATION_WELL_FORMED',
      result.explanation.explanationId.startsWith('evexp_')
        && result.explanation.classificationSummary.length > 0
        && result.explanation.eligibilityRationale.length > 0
        && result.explanation.semanticLimitations.length >= 2,
      'the explanation is well-formed');
  }

  // --- Audit (§20) ----------------------------------------------------------------------------------
  {
    const events = result.auditEvents;
    check('AUDIT_SCHEMA',
      events.every((e) =>
        e.schemaVersion === 'oship.strategy-intent-evaluation.v1'),
      'every audit event carries the evaluation schema');
    check('AUDIT_CHAIN_VALID',
      verifyStrategyIntentEvaluationAudit(events, events.length).valid,
      'the hash chain verifies with no truncation or extension');
    const identity = result.auditIdentity;
    check('AUDIT_IDENTITY_BOUND',
      identity.evaluationId === result.evaluationId
        && identity.eventCount <= events.length
        && events[identity.eventCount - 1] !== undefined
        && events[identity.eventCount - 1].hash === identity.headHash,
      'the audit identity binds the anchored chain prefix');
    check('AUDIT_BINDING_VALID',
      verifyEvaluationAuditBinding(events, {
        evaluationId: result.evaluationId,
        intentId: result.intentId,
        classification: result.classification,
        eligibility: result.eligibility,
      }).valid,
      'provenance, classification and eligibility match the chain');
    const types = new Set(events.map((e) => e.eventType));
    check('AUDIT_LIFECYCLE_COVERED',
      ['evaluation-started', 'intent-verified', 'integrity-validated',
        'evidence-validated', 'safety-validated',
        'comparability-validated', 'freshness-validated',
        'stability-validated', 'dependencies-validated',
        'restrictions-analyzed', 'portfolio-interface-checked',
        'dimensions-evaluated', 'classification-assigned',
        'eligibility-assigned', 'research-escalated',
        'feedback-recorded', 'explanation-built', 'evaluation-built',
        'replay-completed'].every((t) => types.has(t as never)),
      'the audit covers the full evaluation lifecycle');
    check('AUDIT_REPLAY_LAST',
      events[events.length - 1] !== undefined
        && events[events.length - 1].eventType === 'replay-completed',
      'replay-completed is the final event');
    const ids = events.map((e) => e.eventId);
    check('AUDIT_EVENT_IDS_UNIQUE',
      new Set(ids).size === ids.length,
      'audit event ids are unique');
    check('AUDIT_SEQUENCES_CONTIGUOUS',
      events.every((e, index) => e.sequence === index),
      'audit sequences are contiguous from zero');
  }

  // --- Dimensions (§7) -------------------------------------------------------------------------------
  {
    const dimensions = result.dimensions;
    check('DIMENSION_COUNT_EIGHTEEN', dimensions.length === 18,
      'exactly eighteen dimensions are evaluated');
    check('DIMENSION_NAMES_CANONICAL',
      dimensions.map((d) => d.dimension).join('|')
        === EVALUATION_DIMENSION_NAMES.join('|'),
      'the dimension battery is the canonical eighteen in order');
    check('DIMENSION_STATES_VALID',
      dimensions.every((d) => ['SATISFIED', 'LIMITED', 'DEFICIENT',
        'NOT_APPLICABLE'].includes(d.state)),
      'every dimension state is explicit');
    check('DIMENSION_DETAILS_PRESENT',
      dimensions.every((d) => d.detail.length > 0
        && d.dimensionId.startsWith('evdim_')),
      'every dimension carries its detail and id');
    const ids = dimensions.map((d) => d.dimensionId);
    check('DIMENSION_IDS_UNIQUE', new Set(ids).size === ids.length,
      'dimension ids are unique');
  }

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}
