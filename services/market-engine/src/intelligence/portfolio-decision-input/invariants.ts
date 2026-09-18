/**
 * SPRINT 043 — invariants (§22): the hard fail-closed contract.
 *
 * Checks executed on every input: immutability, determinism, provenance,
 * source echo, restriction preservation, classification/eligibility
 * gating, capital-constraint transport, evidence references, dependency
 * references, research/feedback/explanation, bridge boundary and
 * authority preservation, semantic safety, audit integrity and replay
 * identity. Any failure rejects the input fail closed.
 */

import type {
  PortfolioDecisionInput, PortfolioDecisionInputInput,
  PortfolioDecisionInputConfigSpec, InputInvariantReport,
  InputInvariantCheck, InputInvariantSubject, InputClassification,
  DownstreamInputEligibility,
} from './types';
import {
  InputRejectionError, DECISION_INPUT_DISCLAIMER,
  DOWNSTREAM_ELIGIBILITY_MEANING, NO_DECISION_AUTHORITY_STATEMENT,
  INPUT_CLASSIFICATIONS, EVALUATION_TO_INPUT_CLASSIFICATION,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES, INPUT_RESTRICTION_CODES,
  CAPITAL_CONSTRAINT_KINDS, CAPITAL_CONSTRAINT_AUTHORITIES,
  CAPITAL_CONSTRAINT_UNITS, CAPITAL_CONSTRAINT_KIND_UNITS,
  INPUT_FEEDBACK_KINDS, INPUT_EVENT_TYPES,
  PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
} from './types';
import {
  INPUT_PREDICTION_TERMS, INPUT_FUTURE_VALUE_TERMS,
  INPUT_EXECUTION_TERMS, INPUT_TREASURY_TERMS,
  INPUT_PORTFOLIO_TERMS, INPUT_RISK_TERMS, INPUT_ALLOCATION_TERMS,
  INPUT_STRATEGY_BOUNDARY_TERMS, INPUT_AEGIS_TERMS,
} from './safety-validation';
import {
  FORBIDDEN_INPUT_KEYS, INPUT_EXECUTION_VERBS,
  PROTECTED_INPUT_AUTHORITIES,
} from './portfolio-interface';
import {classifyDecisionInput, inputBlockedFamilyOf} from './classification';
import {assignDownstreamEligibility, INPUT_TO_ELIGIBILITY,
  eligibilityAllowsAlternatives} from './eligibility';
import {collectInputRestrictions, verifyRestrictionPreservation}
  from './restrictions';
import {validateCapitalConstraints, constraintSafetyOf} from './constraints';
import {verifyInputProvenance} from './provenance';
import {verifyPortfolioDecisionInputAudit, verifyInputAuditBinding}
  from './audit';
import {canonicalJson, inputIdOf, inputFingerprintOf,
  inputConfigFingerprint, inputProvenanceIdOf, inputExplanationIdOf,
  inputContextIdOf,
} from './ids';

export interface InputInvariantContext {
  readonly input: PortfolioDecisionInputInput;
  readonly config: PortfolioDecisionInputConfigSpec;
}

/**
 * The content tuple the input id is derived from (§17) — no timestamp,
 * no randomness, no machine identity, no insertion order.
 */
export function inputCoreTupleOf(
  result: InputInvariantSubject,
  config: PortfolioDecisionInputConfigSpec,
): Record<string, unknown> {
  return {
    evaluationId: result.evaluationId,
    evaluationFingerprint: result.evaluationFingerprint,
    evaluationClassification: result.evaluationClassification,
    inputClassification: result.classification,
    eligibility: result.downstreamEligibility,
    preferredAlternativeId: result.preferredAlternativeId,
    acceptableAlternativeIds: result.acceptableAlternativeIds,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
    researchClasses: result.research.requirements.map((requirement) =>
      requirement.researchClass),
    evidenceCount: result.evidence.length,
    annotations: result.annotations,
    configurationFingerprint: inputConfigFingerprint(config),
  };
}

/** The seal tuple the input fingerprint is derived from (§18). */
export function inputSealTupleOf(
  result: Pick<InputInvariantSubject, 'inputId' | 'classification'
    | 'downstreamEligibility' | 'restrictions' | 'capitalConstraints'
    | 'evidence' | 'dependencyReferences' | 'research' | 'annotations'>,
): Record<string, unknown> {
  return {
    inputId: result.inputId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
    evidenceIds: result.evidence.map((reference) =>
      reference.evidenceId),
    dependencyIds: result.dependencyReferences.map((reference) =>
      reference.dependencyId),
    researchClasses: result.research.requirements.map((requirement) =>
      requirement.researchClass),
    annotations: result.annotations,
  };
}

/** Every narrative line the bridge itself generated or carried. */
export function inputNarrativesOf(
  result: InputInvariantSubject,
): readonly string[] {
  return [
    ...result.classificationReasons,
    ...result.eligibilityReasons,
    ...result.capitalConstraints.map((constraint) => constraint.reason),
    ...result.restrictions.map((restriction) => restriction.reason),
    ...result.evidence.map((reference) => reference.observation),
    ...result.dependencyReferences.map((reference) => reference.scope),
    ...result.explanation.presentationSummary,
    ...result.explanation.constraintSummary,
    ...result.explanation.restrictionSummary,
    ...result.explanation.evidenceSummary,
    ...result.explanation.eligibilityRationale,
    ...result.explanation.semanticLimitations,
    ...result.feedback.map((record) => record.detail),
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

export function checkInputInvariants(
  result: InputInvariantSubject,
  context: InputInvariantContext,
): InputInvariantReport {
  if (result === null || typeof result !== 'object' || context === null
    || typeof context !== 'object' || context.input === null
    || typeof context.input !== 'object') {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'an input result and its input context are required — fail '
        + 'closed');
  }
  const {input, config} = context;
  const evaluation = input.evaluationResult;
  const checks: InputInvariantCheck[] = [];
  const check = (invariant: string, passed: boolean, detail: string):
    void => {
    checks.push(Object.freeze({invariant, passed, detail}));
  };

  const serialized = canonicalJson(result);
  const narratives = inputNarrativesOf(result);
  const domain = evaluation.evaluationContext.domain;

  // --- Immutability (12) ---------------------------------------------------
  check('RESULT_IMMUTABLE', Object.isFrozen(result),
    'the input result is frozen');
  check('INPUT_CONTEXT_IMMUTABLE',
    Object.isFrozen(result.inputContext),
    'the input context is frozen');
  check('RESTRICTIONS_IMMUTABLE',
    Object.isFrozen(result.restrictions)
      && result.restrictions.every((r) => Object.isFrozen(r)),
    'every restriction is frozen');
  check('EVIDENCE_IMMUTABLE', Object.isFrozen(result.evidence)
    && result.evidence.every((e) => Object.isFrozen(e)),
    'every evidence reference is frozen');
  check('CONSTRAINTS_IMMUTABLE',
    Object.isFrozen(result.capitalConstraints)
      && result.capitalConstraints.every((c) => Object.isFrozen(c)),
    'every transported constraint is frozen');
  check('DEPENDENCIES_IMMUTABLE',
    Object.isFrozen(result.dependencyReferences)
      && result.dependencyReferences.every((d) => Object.isFrozen(d)),
    'every dependency reference is frozen');
  check('RESEARCH_IMMUTABLE', Object.isFrozen(result.research)
    && Object.isFrozen(result.research.requirements)
    && result.research.requirements.every((r) => Object.isFrozen(r)),
    'the research context is frozen');
  check('FEEDBACK_IMMUTABLE', Object.isFrozen(result.feedback)
    && result.feedback.every((f) => Object.isFrozen(f)),
    'every feedback record is frozen');
  check('EXPLANATION_IMMUTABLE', Object.isFrozen(result.explanation),
    'the explanation is frozen');
  check('PROVENANCE_IMMUTABLE', Object.isFrozen(result.provenance),
    'the provenance is frozen');
  check('BOUNDARY_IMMUTABLE', Object.isFrozen(result.boundary),
    'the boundary result is frozen');
  check('AUDIT_EVENTS_IMMUTABLE',
    Object.isFrozen(result.auditEvents)
      && result.auditEvents.every((e) => Object.isFrozen(e)),
    'every audit event is frozen');

  // --- Determinism (10) ------------------------------------------------------
  check('DETERMINISTIC_IDS',
    result.inputId === inputIdOf(inputCoreTupleOf(result, config)),
    'the input id is content-derived from canonical source material');
  check('DETERMINISTIC_FINGERPRINT',
    result.inputFingerprint
      === inputFingerprintOf(inputSealTupleOf(result)),
    'the input fingerprint seals the input content');
  check('DETERMINISTIC_SERIALIZATION',
    canonicalJson(JSON.parse(serialized)) === serialized,
    'serialization is canonical and byte-stable');
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
    !Object.keys(inputCoreTupleOf(result, config)).includes('timestamp'),
    'the id tuple carries no timestamp, randomness or machine '
      + 'identity');
  check('SERIALIZATION_STABLE', canonicalJson(result) === serialized,
    'repeated serialization is byte-identical');
  {
    const recomputed = classifyDecisionInput(evaluation,
      result.capitalConstraints);
    check('DETERMINISTIC_CLASSIFICATION',
      recomputed.classification === result.classification,
      'the classification is a deterministic function of the '
        + 'evaluation and its constraints');
  }
  {
    const recomputed = assignDownstreamEligibility(
      result.classification);
    check('DETERMINISTIC_ELIGIBILITY',
      recomputed.eligibility === result.downstreamEligibility,
      'eligibility is a deterministic function of the classification');
  }
  {
    const recomputed = validateCapitalConstraints(
      input.capitalConstraints, domain, input.timestamp, config);
    check('DETERMINISTIC_CONSTRAINTS',
      canonicalJson(recomputed.map((c) => c.constraintId))
        === canonicalJson(result.capitalConstraints.map(
          (c) => c.constraintId)),
      'the transported constraint set is deterministic');
  }
  {
    const recomputed = collectInputRestrictions(evaluation,
      result.capitalConstraints);
    check('DETERMINISTIC_RESTRICTIONS',
      canonicalJson(recomputed.map((r) => r.restrictionId))
        === canonicalJson(result.restrictions.map(
          (r) => r.restrictionId)),
      'the restriction collection is deterministic');
  }

  // --- Source echo (8) -------------------------------------------------------
  check('EVALUATION_ID_ECHOED',
    result.evaluationId === evaluation.evaluationId,
    'the consumed evaluation id is echoed exactly');
  check('EVALUATION_FINGERPRINT_ECHOED',
    result.evaluationFingerprint === evaluation.evaluationFingerprint,
    'the consumed evaluation fingerprint is echoed exactly');
  check('EVALUATION_CLASSIFICATION_ECHOED',
    result.evaluationClassification === evaluation.classification,
    'the consumed evaluation classification is echoed exactly');
  check('INPUT_SCHEMA_VERSION',
    result.schemaVersion === PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    'the input carries the canonical schema version');
  check('ENVELOPE_ECHOED',
    result.timestamp === input.timestamp
      && result.correlationId === input.correlationId
      && result.traceId === input.traceId,
    'timestamp, correlation id and trace id echo the request');
  check('ANNOTATIONS_SORTED_AND_BOUNDED',
    canonicalJson(result.annotations)
      === canonicalJson([...result.annotations].sort())
      && result.annotations.length <= config.maxAnnotations,
    'annotations are sorted and within the configured bound');
  check('INPUT_CONTEXT_BINDS',
    result.inputContext.inputId === result.inputId
      && result.inputContext.evaluationId === evaluation.evaluationId
      && result.inputContext.intentId === evaluation.intentId
      && result.inputContext.domain === domain,
    'the input context binds the input to its evaluation');
  check('INPUT_CONTEXT_ID_DERIVED',
    result.inputContext.contextId === inputContextIdOf({
      inputId: result.inputId,
      evaluationId: evaluation.evaluationId,
      domain,
      classification: result.classification,
    }),
    'the input context id is content-derived');

  // --- Restriction preservation (8) ------------------------------------------
  {
    const preservation = verifyRestrictionPreservation(evaluation,
      result.restrictions);
    check('EVALUATION_RESTRICTIONS_PRESERVED', preservation.preserved,
      `every evaluation restriction survives transport unchanged `
        + `(lost: ${preservation.lost.join(', ') || 'none'})`);
  }
  check('NO_DECISION_AUTHORITY_DECLARED',
    result.restrictions.some((restriction) =>
      restriction.code === 'NO_DECISION_AUTHORITY'),
    'the bridge declares NO_DECISION_AUTHORITY on every input');
  {
    const safety = constraintSafetyOf(result.capitalConstraints);
    check('CAPACITY_UNKNOWN_DECLARED_IFF_UNKNOWN',
      result.restrictions.some((restriction) =>
        restriction.code === 'CAPACITY_UNKNOWN')
        === (safety.unknownCount > 0),
      'CAPACITY_UNKNOWN is declared exactly when an unknown '
        + 'constraint is transported');
  }
  check('RESTRICTION_VOCABULARY',
    result.restrictions.every((restriction) =>
      (INPUT_RESTRICTION_CODES as readonly string[])
        .includes(restriction.code)),
    'every restriction code belongs to the input vocabulary');
  check('RESTRICTIONS_UNIQUE',
    new Set(result.restrictions.map((r) => r.code)).size
      === result.restrictions.length,
    'no restriction code is duplicated');
  check('RESTRICTIONS_ORDERED',
    canonicalJson(result.restrictions.map((r) => r.code))
      === canonicalJson([...result.restrictions]
        .sort((a, b) =>
          (INPUT_RESTRICTION_CODES as readonly string[])
            .indexOf(a.code)
          - (INPUT_RESTRICTION_CODES as readonly string[])
            .indexOf(b.code))
        .map((r) => r.code)),
    'restrictions are ordered over the canonical vocabulary');
  check('RESTRICTION_REASONS_PRESENT',
    result.restrictions.every((restriction) =>
      restriction.reason.length > 0),
    'every restriction carries a reason');
  check('RESTRICTION_SOURCES_VALID',
    result.restrictions.every((restriction) =>
      restriction.source === 'EVALUATION_CARRIED'
      || restriction.source === 'BRIDGE'),
    'every restriction is either carried or bridge-derived');

  // --- Classification and eligibility (9) ---------------------------------------
  check('CLASSIFICATION_VOCABULARY',
    (INPUT_CLASSIFICATIONS as readonly string[])
      .includes(result.classification),
    'the classification belongs to the thirteen-state vocabulary');
  check('ELIGIBILITY_VOCABULARY',
    (DOWNSTREAM_INPUT_ELIGIBILITY_STATES as readonly string[])
      .includes(result.downstreamEligibility),
    'the eligibility belongs to the nine-state vocabulary');
  {
    const mapped = EVALUATION_TO_INPUT_CLASSIFICATION.find(([candidate]) =>
      candidate === evaluation.classification)?.[1];
    const staleDemoted = mapped === 'INPUT_READY'
      && result.classification === 'INPUT_READY_WITH_LIMITATIONS'
      && result.capitalConstraints.some((constraint) =>
        constraint.status === 'STALE');
    check('CLASSIFICATION_MAPS_FROM_EVALUATION',
      mapped === result.classification || staleDemoted,
      'the classification is the frozen image of the evaluation '
        + 'classification (or its explicit stale-constraint demotion)');
  }
  check('ELIGIBILITY_MAPS_FROM_CLASSIFICATION',
    INPUT_TO_ELIGIBILITY.find(([candidate]) =>
      candidate === result.classification)?.[1]
      === result.downstreamEligibility,
    'the eligibility is the frozen image of the classification');
  check('STALE_DEMOTION_RULE',
    !(result.classification === 'INPUT_READY'
      && result.capitalConstraints.some((constraint) =>
        constraint.status === 'STALE')),
    'an unqualified INPUT_READY never coexists with stale '
      + 'constraints');
  check('BLOCKED_FAMILY_SURFACES_NOTHING',
    inputBlockedFamilyOf(result.classification)
      ? result.preferredAlternativeId === null
        && result.acceptableAlternativeIds.length === 0
      : true,
    'blocked input families surface no alternatives downstream');
  check('ALTERNATIVES_ELIGIBILITY_CONSISTENT',
    eligibilityAllowsAlternatives(result.downstreamEligibility)
      || (result.preferredAlternativeId === null
        && result.acceptableAlternativeIds.length === 0),
    'alternatives surface only under an alternatives-eligible '
      + 'eligibility');
  check('PREFERRED_WITHIN_ACCEPTABLE',
    result.preferredAlternativeId === null
      || result.acceptableAlternativeIds.includes(
        result.preferredAlternativeId),
    'the preferred alternative is among the acceptable alternatives');
  check('ALTERNATIVE_REFERENCES_COMPLETE',
    result.alternativeReferences.length
      === result.acceptableAlternativeIds.length
      && result.alternativeReferences.every((reference) =>
        reference.domain === domain && reference.informational === true),
    'every surfaced alternative is referenced informationally in the '
      + 'input domain');

  // --- Capital-constraint transport (12) ----------------------------------------
  check('CONSTRAINT_KINDS_VALID',
    result.capitalConstraints.every((constraint) =>
      (CAPITAL_CONSTRAINT_KINDS as readonly string[])
        .includes(constraint.constraintKind)),
    'every constraint kind belongs to the nine-kind vocabulary');
  check('CONSTRAINT_AUTHORITIES_EXISTING',
    result.capitalConstraints.every((constraint) =>
      (CAPITAL_CONSTRAINT_AUTHORITIES as readonly string[])
        .includes(constraint.sourceAuthority)),
    'every constraint is supplied by an existing authority only');
  check('CONSTRAINT_UNITS_VALID',
    result.capitalConstraints.every((constraint) =>
      (CAPITAL_CONSTRAINT_UNITS as readonly string[])
        .includes(constraint.unit)),
    'every constraint unit belongs to the unit vocabulary');
  check('CONSTRAINT_KIND_UNITS_COMPATIBLE',
    result.capitalConstraints.every((constraint) =>
      (CAPITAL_CONSTRAINT_KIND_UNITS.find(([kind]) =>
        kind === constraint.constraintKind)?.[1] ?? [])
        .includes(constraint.unit)),
    'every constraint unit is compatible with its kind');
  check('KNOWN_CONSTRAINTS_CARRY_VALUES',
    result.capitalConstraints.every((constraint) =>
      constraint.status !== 'KNOWN'
      || (constraint.unit === 'NONE'
        ? constraint.value === null
        : typeof constraint.value === 'number'
          && Number.isFinite(constraint.value)
          && constraint.value >= 0)),
    'KNOWN constraints carry finite non-negative values (or none for '
      + 'declarative kinds)');
  check('FRACTION_CONSTRAINTS_BOUNDED',
    result.capitalConstraints.every((constraint) =>
      constraint.unit !== 'FRACTION'
      || (constraint.value !== null && constraint.value <= 1)),
    'FRACTION constraints never exceed 1');
  check('UNKNOWN_CONSTRAINTS_CARRY_NO_VALUE',
    result.capitalConstraints.every((constraint) =>
      constraint.suppliedStatus !== 'UNKNOWN'
      || constraint.value === null),
    'UNKNOWN capacity is never a number — never zero, never '
      + 'unlimited');
  check('EFFECTIVE_STATUSES_VALID',
    result.capitalConstraints.every((constraint) =>
      ['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'CONFLICTED', 'STALE']
        .includes(constraint.status)),
    'every effective constraint status belongs to the vocabulary');
  check('SUPPLIED_STATUS_PRESERVED',
    result.capitalConstraints.every((constraint) =>
      constraint.suppliedStatus === 'KNOWN'
      || constraint.suppliedStatus === 'UNKNOWN'
      || constraint.suppliedStatus === 'NOT_APPLICABLE'),
    'the supplied status is preserved on every transported record');
  check('CONSTRAINTS_TRANSPORTED_NOT_COMPUTED',
    result.capitalConstraints.every((constraint) =>
      constraint.provenance.suppliedByExistingAuthority === true
      && constraint.provenance.sourceAuthority
        === constraint.sourceAuthority),
    'the bridge transports constraints — it never computes them');
  check('CONSTRAINTS_DETERMINISTICALLY_ORDERED',
    canonicalJson(result.capitalConstraints.map(
      (c) => `${c.constraintKind}|${c.domain}|${c.scope}|${c.constraintId}`))
      === canonicalJson([...result.capitalConstraints]
        .map((c) =>
          `${c.constraintKind}|${c.domain}|${c.scope}|${c.constraintId}`)
        .sort()),
    'constraints are transported in deterministic canonical order');
  check('CONSTRAINT_COUNT_BOUNDED',
    result.capitalConstraints.length <= config.maxCapitalConstraints,
    'the transported constraint set is within the configured bound');

  // --- Evidence references (6) ----------------------------------------------------
  check('EVIDENCE_REFERENCED_NOT_SYNTHESIZED',
    result.evidence.every((reference) =>
      reference.source === 'STRATEGY_INTENT_EVALUATION'
      && reference.provenance.evaluationId === evaluation.evaluationId
      && reference.provenance.contextId
        === evaluation.evaluationContext.contextId),
    'every evidence reference points at the consumed evaluation');
  check('EVIDENCE_HISTORICAL',
    result.evidence.every((reference) =>
      reference.historical === true
      && reference.historicalTimestamp === evaluation.timestamp),
    'every evidence reference is explicitly historical');
  check('EVIDENCE_INFORMATIONAL',
    result.evidence.every((reference) =>
      reference.informational === true),
    'every evidence reference is informational');
  check('EVIDENCE_DOMAIN_PRESERVED',
    result.evidence.every((reference) => reference.domain === domain),
    'every evidence reference carries the evaluation domain');
  check('EVIDENCE_IDS_DERIVED',
    result.evidence.every((reference) =>
      reference.evidenceId.startsWith('pdev_')),
    'every evidence id is a content-derived pdev_ fingerprint');
  check('EVIDENCE_PRESENT',
    result.evidence.length > 0,
    'the input references the governed evidence of its evaluation');

  // --- Dependency references (4) ----------------------------------------------------
  check('DEPENDENCY_STATE_ECHOED',
    result.dependencyReferences.length === 1
      && result.dependencyReferences[0].state
        === evaluation.evaluationContext.dependencyState,
    'the dependency reference echoes the governed dependency state');
  check('DEPENDENCY_INFORMATIONAL',
    result.dependencyReferences.every((reference) =>
      reference.informational === true
      && reference.source === 'EVALUATION_CONTEXT'),
    'dependency references are informational and source-pinned');
  check('DEPENDENCY_IDS_DERIVED',
    result.dependencyReferences.every((reference) =>
      reference.dependencyId.startsWith('pddp_')),
    'every dependency id is a content-derived pddp_ fingerprint');
  check('DEPENDENCY_RESEARCH_LINKED',
    result.dependencyReferences.every((reference) =>
      reference.linkedResearchClasses.every((researchClass) =>
        result.research.requirements.some((requirement) =>
          requirement.researchClass === researchClass))),
    'linked research classes exist in the research context');

  // --- Research, feedback and explanation (7) -----------------------------------------
  check('RESEARCH_CARRIED_VERBATIM',
    canonicalJson(result.research.requirements.map((requirement) =>
      requirement.researchClass))
      === canonicalJson(evaluation.research.requirements.map(
        (requirement) => requirement.researchClass)),
    'the evaluation research requirements are carried verbatim');
  check('RESEARCH_COUNTS_CONSISTENT',
    result.research.evaluationCarriedCount
      + result.research.bridgeDerivedCount
      === result.research.requirements.length,
    'the research provenance counts add up');
  check('RESEARCH_INFORMATIONAL',
    result.research.informational === true,
    'the research context is informational');
  check('FEEDBACK_KINDS_VALID',
    result.feedback.every((record) =>
      (INPUT_FEEDBACK_KINDS as readonly string[])
        .includes(record.kind)),
    'every feedback kind belongs to the vocabulary');
  check('FEEDBACK_BINDS_INPUT',
    result.feedback.every((record) =>
      record.inputId === result.inputId
      && record.evaluationId === evaluation.evaluationId
      && record.informational === true),
    'every feedback record binds the input and its evaluation');
  check('EXPLANATION_SOURCES_BIND',
    result.explanation.sourceEvaluationId === evaluation.evaluationId
      && result.explanation.sourceIntentId === evaluation.intentId
      && result.explanation.sourceDecisionId
        === evaluation.evaluationContext.decisionId
      && result.explanation.sourceGovernanceId
        === evaluation.evaluationContext.governanceId,
    'the explanation binds its evaluation, intent, decision and '
      + 'governance sources');
  check('EXPLANATION_ID_DERIVED',
    result.explanation.explanationId === inputExplanationIdOf({
      inputId: result.inputId,
      classification: result.classification,
      eligibility: result.downstreamEligibility,
      restrictionCodes: result.restrictions.map((r) => r.code),
      constraintIds: result.capitalConstraints.map(
        (c) => c.constraintId),
    }),
    'the explanation id is content-derived');

  // --- Provenance (6) ---------------------------------------------------------------
  {
    const verdict = verifyInputProvenance(result.provenance, evaluation);
    check('PROVENANCE_BINDS_EVALUATION', verdict.verified,
      `the provenance chain binds the consumed evaluation `
        + `(${verdict.reason ?? 'verified'})`);
  }
  check('PROVENANCE_NO_SUBSTITUTION',
    result.provenance.evaluationId === evaluation.evaluationId
      && result.provenance.intentId === evaluation.intentId
      && result.provenance.decisionId
        === evaluation.evaluationContext.decisionId
      && result.provenance.governanceId
        === evaluation.evaluationContext.governanceId
      && result.provenance.opportunityId
        === evaluation.evaluationContext.opportunityId,
    'no provenance id was substituted in transport');
  check('PROVENANCE_NO_ORPHANS',
    [result.provenance.opportunityId,
      result.provenance.decisionContextId,
      result.provenance.decisionId,
      result.provenance.governanceContextId,
      result.provenance.governanceId,
      result.provenance.handoffId,
      result.provenance.strategyInputId,
      result.provenance.intentId,
      result.provenance.evaluationId,
      result.provenance.inputId].every((id) =>
      typeof id === 'string' && id.length > 0),
    'the provenance chain has no orphan steps');
  check('PROVENANCE_VERSIONS_PINNED',
    result.provenance.sourceVersions.decisionIntelligenceVersion
      === 'oship.decision-intelligence.engine.v1'
      && result.provenance.sourceVersions.governanceVersion
        === 'oship.decision-governance.engine.v1'
      && result.provenance.sourceVersions.intentVersion
        === 'oship.strategy-intent.engine.v1'
      && result.provenance.sourceVersions.evaluationVersion
        === 'oship.strategy-intent-evaluation.engine.v1',
    'every upstream engine version is pinned');
  check('PROVENANCE_BRIDGE_VERSION_PINNED',
    result.provenance.sourceVersions.bridgeVersion
      === PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
    'the bridge engine version is pinned');
  check('PROVENANCE_ID_DERIVED',
    result.provenance.provenanceId === inputProvenanceIdOf({
      opportunityId: result.provenance.opportunityId,
      decisionContextId: result.provenance.decisionContextId,
      decisionId: result.provenance.decisionId,
      governanceContextId: result.provenance.governanceContextId,
      governanceId: result.provenance.governanceId,
      handoffId: result.provenance.handoffId,
      strategyInputId: result.provenance.strategyInputId,
      intentId: result.provenance.intentId,
      evaluationId: result.provenance.evaluationId,
      inputId: result.provenance.inputId,
    }),
    'the provenance id is content-derived');

  // --- Boundary and authority preservation (10) ----------------------------------------
  check('BOUNDARY_RESPECTED',
    result.boundary.state === 'BOUNDARY_RESPECTED',
    'the bridge boundary is respected');
  check('BOUNDARY_NO_DECISION_AUTHORITY',
    result.boundary.noDecisionAuthority === true
      && result.noDecisionAuthority === true,
    'the bridge has NO_DECISION_AUTHORITY');
  check('BOUNDARY_INFORMATIONAL',
    result.boundary.informational === true
      && result.informational === true,
    'the contract is informational only');
  check('BOUNDARY_CHECKS_PASSED',
    result.boundary.checks.length >= 5
      && result.boundary.checks.every((check_) =>
        check_.passed === true),
    'every boundary check passed');
  check('AUTHORITIES_PRESERVED',
    canonicalJson(result.boundary.protectedAuthorities)
      === canonicalJson(PROTECTED_INPUT_AUTHORITIES),
    'the existing authorities remain exactly where they are');
  check('NO_DECISION_COMMAND_KEYS',
    !FORBIDDEN_INPUT_KEYS.test(serialized),
    'no order, sizing, allocation, weight, position, credential or '
      + 'authorization keys exist in the contract');
  check('NO_EXECUTION_VERBS_IN_NARRATIVE',
    !narratives.some((line) =>
      INPUT_EXECUTION_VERBS.test(line.replace(QUOTED_SPANS, ' '))),
    'no execution or allocation verbs appear in bridge narratives');
  check('DISCLAIMER_VERBATIM',
    result.disclaimer === DECISION_INPUT_DISCLAIMER,
    'the canonical decision-input disclaimer is verbatim');
  check('ELIGIBILITY_MEANING_VERBATIM',
    result.eligibilityMeaning === DOWNSTREAM_ELIGIBILITY_MEANING,
    'the canonical eligibility meaning is verbatim');
  check('AUTHORITY_STATEMENT_CARRIED',
    result.restrictions.find((restriction) =>
      restriction.code === 'NO_DECISION_AUTHORITY')?.reason
      === NO_DECISION_AUTHORITY_STATEMENT,
    'the NO_DECISION_AUTHORITY statement is carried verbatim');

  // --- Semantic safety (7) --------------------------------------------------------------
  check('NO_PREDICTION_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_PREDICTION_TERMS)),
    'no narrative asserts a probability, forecast or guarantee');
  check('NO_FUTURE_VALUE_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_FUTURE_VALUE_TERMS)),
    'no narrative asserts an expected future value');
  check('NO_EXECUTION_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_EXECUTION_TERMS)),
    'no narrative carries an execution instruction');
  check('NO_TREASURY_OR_PORTFOLIO_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_TREASURY_TERMS)
      || termAsserted(line, INPUT_PORTFOLIO_TERMS)),
    'no narrative carries a treasury or portfolio instruction');
  check('NO_RISK_OR_ALLOCATION_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_RISK_TERMS)
      || termAsserted(line, INPUT_ALLOCATION_TERMS)),
    'no narrative carries a risk or allocation instruction');
  check('NO_STRATEGY_OR_AEGIS_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line, INPUT_STRATEGY_BOUNDARY_TERMS)
      || termAsserted(line, INPUT_AEGIS_TERMS)),
    'no narrative carries a strategy or AEGIS instruction');
  check('NO_AUTHORITY_CLAIM_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line,
        /the bridge (approves|decides|authorizes)|on my behalf|on behalf of (the )?(portfolio|risk|allocation)|grant (access|approval)|override (governance|policy|the decision)|authorize (execution|aegis|allocation)|approve (execution|aegis|the trade|the allocation)/i)),
    'no narrative claims bridge authority or grants approval');
  check('NO_POLICY_OVERRIDE_LANGUAGE',
    !narratives.some((line) =>
      termAsserted(line,
        /bypass (governance|the policy|policies)|ignore the governance|policy override|skip (the )?governance/i)),
    'no narrative bypasses or overrides governance policy');

  // --- Audit integrity (7) ----------------------------------------------------------------
  {
    const chain = verifyPortfolioDecisionInputAudit(result.auditEvents,
      result.auditEvents.length);
    check('AUDIT_CHAIN_VALID', chain.valid,
      `the audit chain verifies (${chain.reason ?? 'valid'})`);
  }
  check('AUDIT_IDENTITY_BINDS',
    result.auditIdentity.inputId === result.inputId
      && result.auditIdentity.schemaVersion
        === PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    'the audit identity binds the input');
  check('AUDIT_HEAD_HASH_MATCHES',
    result.auditIdentity.eventCount <= result.auditEvents.length
      && result.auditEvents[result.auditIdentity.eventCount - 1]?.hash
        === result.auditIdentity.headHash,
    'the audit identity head anchors the pre-replay chain');
  check('AUDIT_LIFECYCLE_COVERED',
    INPUT_EVENT_TYPES.every((eventType) =>
      eventType === 'replay-completed'
      || result.auditEvents.some((event) =>
        event.eventType === eventType)),
    'every lifecycle event type is recorded');
  {
    const binding = verifyInputAuditBinding(result.auditEvents, {
      inputId: result.inputId,
      evaluationId: evaluation.evaluationId,
      intentId: evaluation.intentId,
      classification: result.classification,
      eligibility: result.downstreamEligibility,
      restrictionCodes: result.restrictions.map((r) => r.code),
      constraintIds: result.capitalConstraints.map(
        (c) => c.constraintId),
    });
    check('AUDIT_BINDING_VALID', binding.valid,
      `the audit chain binds the input content `
        + `(${binding.reason ?? 'valid'})`);
  }
  check('AUDIT_FIRST_EVENT_RECEIVED',
    result.auditEvents[0]?.eventType === 'input-received',
    'the audit chain starts at input-received');
  check('AUDIT_SCHEMA_VERSION',
    result.auditEvents.every((event) =>
      event.schemaVersion === PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION),
    'every audit event carries the canonical schema version');

  // --- Replay identity (3) ------------------------------------------------------------------
  check('REPLAY_IDENTICAL', result.replay.identical === true,
    'the input is byte-identical across a double run');
  check('REPLAY_FINGERPRINT_SEALED',
    result.replay.fingerprint === result.inputFingerprint,
    'the replay record seals the input fingerprint');
  check('REPLAY_EVENT_LAST',
    result.auditEvents[result.auditEvents.length - 1]?.eventType
      === 'replay-completed',
    'the audit chain ends at replay-completed');

  const failedCount = checks.filter((invariantCheck) =>
    !invariantCheck.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}

/** Count of executed invariant checks (used by tests and the demo). */
export function inputInvariantCountOf(
  report: InputInvariantReport,
): number {
  return report.checks.length;
}

/** Classification helpers re-exported for the demo. */
export {inputBlockedFamilyOf};
export type {InputClassification, DownstreamInputEligibility};
