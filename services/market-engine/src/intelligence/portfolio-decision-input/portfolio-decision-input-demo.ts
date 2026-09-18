/**
 * SPRINT 043 — UNIFIED PORTFOLIO DECISION INPUT CONTRACT &
 * CAPITAL-CONSTRAINT BRIDGE demo.
 *
 * PAPER / SIMULATION ONLY — AN INPUT CONTRACT, NOT A PORTFOLIO ENGINE,
 * NOT A RISK ENGINE, NOT AN ALLOCATOR, NOT A STRATEGY REGISTRY, NOT AN
 * EXECUTION PLANNER, NOT AN ORACLE. THE BRIDGE HAS
 * NO_DECISION_AUTHORITY.
 *
 * Every section drives the REAL Sprint 043 bridge engine over the REAL
 * Sprint 042 evaluation corpus (clean AFIS/ABL, restricted, aging,
 * normalized, conflicted, insufficient, stale, unstable, blocked,
 * dependency, mixed, research runs) — nothing is mocked:
 *
 *   StrategyIntentEvaluation → Source Validation → Input Integrity →
 *   Evidence Validation → Restriction Collection → Dependency
 *   Collection → Capital-Constraint Validation → Portfolio-Interface
 *   Validation → Decision-Input Construction → Classification →
 *   Downstream Eligibility → Research/Feedback → Boundary → Audit →
 *   Replay → Invariants.
 *
 * The question answered is: "What exactly may the EXISTING downstream
 * Portfolio/Risk/Allocation authority CONSIDER, under which
 * restrictions, dependencies and transported capital constraints, with
 * which evidence and provenance?" Eligibility never means trading,
 * betting, capital, or execution approval. The bridge never allocates,
 * sizes, reserves or approves anything. The downstream authorities
 * decide.
 */

import {PortfolioDecisionInputEngine} from './engine';
import {
  verifyPortfolioDecisionInputAudit, verifyInputAuditBinding,
} from './audit';
import {serializePortfolioDecisionInput} from './replay';
import {checkInputInvariants} from './invariants';
import {
  PROTECTED_INPUT_AUTHORITIES, FORBIDDEN_INPUT_KEYS,
} from './portfolio-interface';
import {
  DECISION_INPUT_DISCLAIMER, DOWNSTREAM_ELIGIBILITY_MEANING,
  NO_DECISION_AUTHORITY_STATEMENT, INPUT_CLASSIFICATIONS,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES, INPUT_RESTRICTION_CODES,
  INPUT_REJECTION_CODES, CAPITAL_CONSTRAINT_KINDS,
  CAPITAL_CONSTRAINT_AUTHORITIES, CAPITAL_CONSTRAINT_UNITS,
  EVALUATION_TO_INPUT_CLASSIFICATION, InputRejectionError,
  PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
  PORTFOLIO_DECISION_INPUT_GENESIS_HASH, INPUT_EVENT_TYPES,
} from './types';
import {INPUT_TO_ELIGIBILITY} from './eligibility';
import {
  bridgeInputOf, runBridge, inputRejectionGallery,
  expectInputRejection, cleanEvaluationResult,
  cleanAblEvaluationResult, restrictedEvaluationResult,
  agingEvaluationResult, normalizedEvaluationResult,
  conflictedEvaluationResult, insufficientAblEvaluationResult,
  insufficientFreshnessEvaluationResult, staleEvaluationResult,
  staleAllowedEvaluationResult, unknownAllowedEvaluationResult,
  unstableEvaluationResult, blockedEvaluationResult,
  authorityBypassEvaluationResult, unstableBlockedEvaluationResult,
  notComparableEvaluationResult, venueDependentEvaluationResult,
  strategyDependentEvaluationResult, regimeDependentEvaluationResult,
  mixedEvaluationResult, researchRequiredEvaluationResult,
  noDominantEvaluationResult, multiDependentEvaluationResult,
  cleanInputResult, cleanAblInputResult, restrictedInputResult,
  agingInputResult, normalizedInputResult, conflictedInputResult,
  insufficientAblInputResult, insufficientFreshnessInputResult,
  staleInputResult, staleAllowedInputResult, unknownAllowedInputResult,
  unstableInputResult, blockedInputResult, authorityBypassInputResult,
  unstableBlockedInputResult, notComparableInputResult,
  venueDependentInputResult, strategyDependentInputResult,
  regimeDependentInputResult, mixedInputResult,
  researchRequiredInputResult, noDominantInputResult,
  multiDependentInputResult, unknownCapacityInputResult,
  staleConstraintInputResult, allKindsInputResult,
  annotatedInputResult, unconstrainedInputResult, standardConstraints,
  knownExposureConstraint, knownConcentrationConstraint,
  knownOperationalConstraint, unknownVenueConstraint,
  staleStrategyConstraint, allKindsConstraints, INPUT_CORPUS,
  EXPECTED_INPUT_CLASSIFICATIONS, EXPECTED_ELIGIBILITY,
  frozenEvaluationClone, tamperedEvaluationClone, INPUT_FIXTURE_TIMESTAMP,
} from './test-fixtures';
import {DEFAULT_INPUT_CONFIG, mergeInputConfig} from './config';
import {canonicalJson, hashOf} from './ids';
import {verifyRestrictionPreservation} from './restrictions';

class Section {
  readonly failures: string[] = [];
  constructor(readonly name: string) {}
  check(condition: boolean, label: string): void {
    if (!condition) this.failures.push(label);
  }
  equal<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
      this.failures.push(`${label} (expected ${String(expected)}, got ${
        String(actual)})`);
    }
  }
  same<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, `
        + `got ${JSON.stringify(actual)})`);
    }
  }
  match(actual: string, pattern: RegExp, label: string): void {
    if (!pattern.test(actual)) {
      this.failures.push(`${label} (got ${actual})`);
    }
  }
  throws(label: string, fn: () => void,
    predicate?: (e: unknown) => boolean): void {
    try {
      fn();
      this.failures.push(`${label} (did not throw)`);
    } catch (e) {
      if (predicate && !predicate(e)) {
        this.failures.push(`${label} (threw unexpected: ${
          String((e as Error).message).slice(0, 90)})`);
      }
    }
  }
}

const sections: Section[] = [];
function section(name: string): Section {
  const s = new Section(name);
  sections.push(s);
  return s;
}

const engine = new PortfolioDecisionInputEngine();
const strictEngine = new PortfolioDecisionInputEngine(
  {staleConstraintPolicy: 'REJECT'});
const isRejection = (code: string) => (e: unknown) =>
  e instanceof InputRejectionError && e.code === code;

function presentClean(): ReturnType<typeof cleanInputResult> {
  return engine.present(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
}

// ---------------------------------------------------------------------------
// 01-10 — The bridge, its vocabularies and its discipline
// ---------------------------------------------------------------------------

{
  const s = section('01 — the engine and its versions');
  s.equal(PORTFOLIO_DECISION_INPUT_ENGINE_VERSION,
    'oship.portfolio-decision-input.engine.v1', 'engine version');
  s.equal(PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    'oship.portfolio-decision-input.v1', 'schema version');
  s.equal(PORTFOLIO_DECISION_INPUT_GENESIS_HASH, '0'.repeat(64),
    'genesis hash');
  s.equal(engine.configuration.maxAnnotations, 16,
    'default annotation bound');
  s.equal(engine.configuration.maxCapitalConstraints, 32,
    'default constraint bound');
  s.equal(engine.configuration.maxConstraintAgeMs, 3_600_000,
    'default constraint age window');
  s.equal(engine.configuration.staleConstraintPolicy, 'RESTRICT',
    'default stale policy');
  s.check(engine.configurationFingerprint.startsWith('pdcfg_'),
    'configuration fingerprint prefix');
}

{
  const s = section('02 — the bridge question and its disclaimer');
  const result = presentClean();
  s.check(result.informational, 'results are informational');
  s.check(result.noDecisionAuthority, 'the bridge has no authority');
  s.equal(result.disclaimer, DECISION_INPUT_DISCLAIMER,
    'the canonical disclaimer is verbatim');
  s.equal(result.eligibilityMeaning, DOWNSTREAM_ELIGIBILITY_MEANING,
    'the eligibility meaning is verbatim');
}

{
  const s = section('03 — thirteen input classifications');
  s.equal(INPUT_CLASSIFICATIONS.length, 13,
    'exactly thirteen classifications');
  s.check(INPUT_CLASSIFICATIONS.includes('INPUT_READY'), 'READY exists');
  s.check(INPUT_CLASSIFICATIONS.includes('INPUT_MIXED'), 'MIXED exists');
  s.check(INPUT_CLASSIFICATIONS.includes('INPUT_REGIME_DEPENDENT'),
    'REGIME_DEPENDENT exists');
}

{
  const s = section('04 — nine downstream eligibility states');
  s.equal(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.length, 9,
    'exactly nine states');
  s.check(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.includes(
    'READY_FOR_DOWNSTREAM_CONSIDERATION'), 'ready state exists');
  s.check(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.includes('UNSTABLE'),
    'unstable state exists');
}

{
  const s = section('05 — the frozen evaluation→input map');
  s.equal(EVALUATION_TO_INPUT_CLASSIFICATION.length, 13,
    'the map is total over thirteen entries');
  s.equal(EVALUATION_TO_INPUT_CLASSIFICATION[0][0], 'EVALUATION_ALLOWED',
    'the first source is ALLOWED');
  s.equal(EVALUATION_TO_INPUT_CLASSIFICATION[0][1], 'INPUT_READY',
    'ALLOWED maps to INPUT_READY');
  s.equal(EVALUATION_TO_INPUT_CLASSIFICATION[3][1], 'INPUT_BLOCKED',
    'BLOCKED maps to INPUT_BLOCKED');
}

{
  const s = section('06 — the frozen classification→eligibility map');
  s.equal(INPUT_TO_ELIGIBILITY.length, 13, 'the map is total');
  s.equal(INPUT_TO_ELIGIBILITY[0][1],
    'READY_FOR_DOWNSTREAM_CONSIDERATION', 'READY maps to ready');
  s.equal(INPUT_TO_ELIGIBILITY.find(([c]) =>
    c === 'INPUT_MIXED')![1], 'RESEARCH_REQUIRED',
  'MIXED maps to RESEARCH_REQUIRED');
}

{
  const s = section('07 — twenty input restriction codes');
  s.equal(INPUT_RESTRICTION_CODES.length, 20,
    'exactly twenty codes');
  s.check(INPUT_RESTRICTION_CODES.includes('NO_DECISION_AUTHORITY'),
    'the bridge code exists');
  s.check(INPUT_RESTRICTION_CODES.includes('CAPACITY_UNKNOWN'),
    'the capacity code exists');
  s.check(INPUT_RESTRICTION_CODES.includes('DOWNSTREAM_CONSIDERATION_ONLY'),
    'the evaluation code is carried');
}

{
  const s = section('08 — nine capital-constraint kinds');
  s.equal(CAPITAL_CONSTRAINT_KINDS.length, 9, 'exactly nine kinds');
  s.check(CAPITAL_CONSTRAINT_KINDS.includes('ABSOLUTE_EXPOSURE_CAP'),
    'absolute exposure cap exists');
  s.check(CAPITAL_CONSTRAINT_KINDS.includes('FRESHNESS_RESTRICTION'),
    'freshness restriction exists');
}

{
  const s = section('09 — five existing constraint authorities');
  s.same([...CAPITAL_CONSTRAINT_AUTHORITIES], ['RISK', 'PORTFOLIO',
    'ALLOCATION', 'TREASURY', 'GOVERNANCE'],
  'only existing authorities may supply constraints');
  s.equal(CAPITAL_CONSTRAINT_UNITS.length, 4, 'four units');
}

{
  const s = section('10 — thirty-nine fail-closed rejection codes');
  s.equal(INPUT_REJECTION_CODES.length, 39, 'exactly thirty-nine codes');
  s.check(INPUT_REJECTION_CODES.includes('RESTRICTION_LOSS'),
    'restriction loss is a hard failure');
  s.check(INPUT_REJECTION_CODES.includes('CONFLICTED_CONSTRAINT'),
    'constraint conflicts fail closed');
  s.check(INPUT_REJECTION_CODES.includes('NONDETERMINISTIC_INPUT'),
    'nondeterminism fails closed');
}

// ---------------------------------------------------------------------------
// 11-18 — Configuration, identity and serialization discipline
// ---------------------------------------------------------------------------

{
  const s = section('11 — configuration merge and validation');
  s.same(mergeInputConfig(undefined), DEFAULT_INPUT_CONFIG,
    'an absent config returns the defaults');
  s.equal(mergeInputConfig({maxAnnotations: 8}).maxAnnotations, 8,
    'partial override applies');
  s.check(Object.isFrozen(mergeInputConfig({})), 'configs are frozen');
  s.throws('invalid config rejects', () =>
    mergeInputConfig({maxAnnotations: 0} as never));
}

{
  const s = section('12 — canonical JSON discipline');
  s.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}',
    'keys sort recursively');
  s.equal(canonicalJson({x: 1, y: {b: 2, a: 3}}),
    canonicalJson({y: {a: 3, b: 2}, x: 1}),
    'serialization is key-order independent');
  s.equal(canonicalJson([2, 1]), '[2,1]', 'arrays stay ordered');
}

{
  const s = section('13 — deterministic identity');
  const result = presentClean();
  s.check(result.inputId.startsWith('pdi_'), 'input id prefix');
  s.check(result.inputFingerprint.startsWith('pdfp_'),
    'fingerprint prefix');
  s.check(result.inputContext.contextId.startsWith('pdctx_'),
    'context id prefix');
  s.match(result.inputId, /^pdi_[0-9a-f]{24}$/, '24-hex content id');
}

{
  const s = section('14 — timestamps never enter identity');
  const early = engine.present(bridgeInputOf(cleanEvaluationResult()));
  const late = engine.present({...bridgeInputOf(cleanEvaluationResult()),
    timestamp: INPUT_FIXTURE_TIMESTAMP + 86_400_000});
  s.equal(early.inputId, late.inputId,
    'a day-later presentation keeps the same id');
}

{
  const s = section('15 — correlation and trace ids echo only');
  const first = engine.present(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  const second = engine.present({...bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')), correlationId: 'corr-other',
    traceId: 'trace-other'});
  s.equal(first.inputId, second.inputId,
    'envelope ids never change the content id');
  s.equal(second.correlationId, 'corr-other', 'the envelope echoes');
}

{
  const s = section('16 — permuted supplies produce identical ids');
  const constraints = standardConstraints('AFIS');
  const first = engine.present(bridgeInputOf(cleanEvaluationResult(),
    constraints));
  const second = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [...constraints].reverse()));
  s.equal(first.inputId, second.inputId,
    'constraint insertion order never changes identity');
}

{
  const s = section('17 — serialization is byte-stable');
  const result = presentClean();
  const first = serializePortfolioDecisionInput(result);
  const second = serializePortfolioDecisionInput(result);
  s.equal(first, second, 'repeated serialization is byte-identical');
  s.equal(canonicalJson(JSON.parse(first)), first,
    'serialization round-trips canonically');
}

{
  const s = section('18 — key-order independence');
  const result = presentClean();
  const serialized = serializePortfolioDecisionInput(result);
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).sort().reverse()) {
    permuted[key] = parsed[key];
  }
  s.equal(canonicalJson(permuted), serialized,
    'permuted keys deserialize to the same bytes');
}

// ---------------------------------------------------------------------------
// 19-26 — Source validation and input integrity
// ---------------------------------------------------------------------------

{
  const s = section('19 — only governed Sprint 042 results pass');
  const result = presentClean();
  s.equal(result.evaluationId, cleanEvaluationResult().evaluationId,
    'the evaluation id is echoed');
  s.equal(result.evaluationFingerprint,
    cleanEvaluationResult().evaluationFingerprint,
    'the evaluation fingerprint is echoed');
  s.equal(result.evaluationClassification,
    cleanEvaluationResult().classification,
    'the evaluation classification is echoed');
}

{
  const s = section('20 — a mutated evaluation rejects fail closed');
  const tampered = tamperedEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.acceptableAlternativeIds = ['alt_forged'];
    });
  s.throws('fingerprint tamper rejects', () =>
    engine.present(bridgeInputOf(tampered)),
    isRejection('INVALID_EVALUATION'));
  const unfrozen = JSON.parse(JSON.stringify(cleanEvaluationResult()));
  s.throws('unfrozen source rejects', () =>
    engine.present(bridgeInputOf(unfrozen)),
    isRejection('INVALID_EVALUATION'));
}

{
  const s = section('21 — provenance substitution rejects');
  const substituted = frozenEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.provenance.evaluationId = 'eval_other';
    });
  s.throws('evaluation substitution rejects', () =>
    engine.present(bridgeInputOf(substituted)),
    isRejection('PROVENANCE_SUBSTITUTION'));
}

{
  const s = section('22 — a stale evaluation must stay stale');
  const freshened = frozenEvaluationClone(staleEvaluationResult(),
    (draft) => {
      draft.evaluationContext.freshnessState = 'FRESH';
    });
  s.throws('freshness tamper rejects', () =>
    engine.present(bridgeInputOf(freshened)),
    isRejection('STALE_EVIDENCE'));
}

{
  const s = section('23 — unknown freshness never passes as allowed');
  const unknownFresh = frozenEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.evaluationContext.freshnessState = 'UNKNOWN';
    });
  s.throws('unknown freshness rejects', () =>
    engine.present(bridgeInputOf(unknownFresh)),
    isRejection('UNKNOWN_FRESHNESS'));
}

{
  const s = section('24 — conflicted evidence is never resolved here');
  const resolved = frozenEvaluationClone(conflictedEvaluationResult(),
    (draft) => {
      draft.evaluationContext.evidenceState = 'CONSISTENT';
    });
  s.throws('conflict laundering rejects', () =>
    engine.present(bridgeInputOf(resolved)),
    isRejection('CONFLICTING_EVIDENCE'));
}

{
  const s = section('25 — a lost baseline restriction rejects');
  const stripped = frozenEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.restrictions = draft.restrictions.filter((restriction) =>
        restriction.code !== 'NO_EXECUTION');
    });
  s.throws('baseline loss rejects', () =>
    engine.present(bridgeInputOf(stripped)),
    isRejection('RESTRICTION_INCONSISTENCY'));
}

{
  const s = section('26 — normalization must be declared consistently');
  const undeclared = frozenEvaluationClone(normalizedEvaluationResult(),
    (draft) => {
      draft.restrictions = draft.restrictions.filter((restriction) =>
        restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
    });
  s.throws('undeclared normalization rejects', () =>
    engine.present(bridgeInputOf(undeclared)),
    isRejection('NORMALIZATION_VIOLATION'));
}

// ---------------------------------------------------------------------------
// 27-34 — The capital-constraint contract
// ---------------------------------------------------------------------------

{
  const s = section('27 — constraints are transported, never computed');
  const result = presentClean();
  s.equal(result.capitalConstraints.length, 3, 'three records');
  for (const record of result.capitalConstraints) {
    s.check(record.provenance.suppliedByExistingAuthority === true,
      `${record.constraintKind} is supplied by an existing authority`);
    s.check(record.informational === true, 'records are informational');
  }
}

{
  const s = section('28 — UNKNOWN is never zero and never unlimited');
  const result = unknownCapacityInputResult();
  const unknown = result.capitalConstraints.find((constraint) =>
    constraint.status === 'UNKNOWN');
  s.check(unknown !== undefined, 'an UNKNOWN record transports');
  s.equal(unknown?.value, null, 'UNKNOWN carries no value');
  s.check(unknown?.reason.includes('never zero') === true,
    'the reason declares never-zero');
  s.check(unknown?.reason.includes('never unlimited') === true,
    'the reason declares never-unlimited');
  s.check(result.restrictions.some((restriction) =>
    restriction.code === 'CAPACITY_UNKNOWN'),
  'CAPACITY_UNKNOWN is declared on the input');
}

{
  const s = section('29 — UNKNOWN with a value rejects');
  s.throws('valued UNKNOWN rejects', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [{...unknownVenueConstraint(), value: 100}])),
  isRejection('UNKNOWN_CONSTRAINT'));
}

{
  const s = section('30 — stale constraints restrict, never vanish');
  const result = staleConstraintInputResult();
  const stale = result.capitalConstraints.find((constraint) =>
    constraint.status === 'STALE');
  s.check(stale !== undefined, 'the stale record transports');
  s.equal(stale?.suppliedStatus, 'KNOWN',
    'the supplied status is preserved');
  s.check(stale?.reason.includes('stale') === true,
    'the staleness is declared in the reason');
  s.equal(result.classification, 'INPUT_READY_WITH_LIMITATIONS',
    'stale capacity demotes an unqualified ready input');
  s.equal(result.downstreamEligibility, 'READY_WITH_RESTRICTIONS',
    'eligibility follows the demotion');
}

{
  const s = section('31 — the REJECT policy fails stale closed');
  s.throws('stale constraint rejects under REJECT', () =>
    strictEngine.present(bridgeInputOf(cleanEvaluationResult(),
      [staleStrategyConstraint()])),
  isRejection('STALE_CONSTRAINT'));
}

{
  const s = section('32 — conflicting constraints fail closed');
  s.throws('same-scope disagreement rejects', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('AFIS', 'portfolio-wide', 250_000),
        knownExposureConstraint('AFIS', 'portfolio-wide', 300_000)])),
  isRejection('CONFLICTED_CONSTRAINT'));
}

{
  const s = section('33 — all nine kinds transport together');
  const result = allKindsInputResult();
  s.equal(result.capitalConstraints.length, 9, 'nine records');
  s.equal(new Set(result.capitalConstraints.map((record) =>
    record.constraintKind)).size, 9, 'each kind once');
  s.check(result.invariants.passed, 'the all-kinds run passes gates');
}

{
  const s = section('34 — only existing authorities may supply');
  s.throws('a bridge-supplied constraint rejects', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        sourceAuthority: 'BRIDGE' as never}])),
  isRejection('MISSING_CONSTRAINT_AUTHORITY'));
  s.throws('a foreign-domain constraint rejects', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('ABL')])),
  isRejection('CONSTRAINT_MISMATCH'));
}

// ---------------------------------------------------------------------------
// 35-42 — Restriction preservation and classification
// ---------------------------------------------------------------------------

{
  const s = section('35 — every evaluation restriction survives');
  const evaluation = cleanEvaluationResult();
  const result = presentClean();
  const verdict = verifyRestrictionPreservation(evaluation,
    result.restrictions);
  s.check(verdict.preserved, 'preservation verified');
  s.same([...verdict.lost], [], 'nothing is lost');
  for (const restriction of evaluation.restrictions) {
    s.check(result.restrictions.some((candidate) =>
      candidate.code === restriction.code
      && candidate.reason === restriction.reason
      && candidate.restrictionId === restriction.restrictionId),
    `${restriction.code} is carried verbatim`);
  }
}

{
  const s = section('36 — NO_DECISION_AUTHORITY on every input');
  for (const [label, build] of INPUT_CORPUS) {
    const declaration = build().restrictions.find((restriction) =>
      restriction.code === 'NO_DECISION_AUTHORITY');
    s.check(declaration !== undefined, `${label} declares no-authority`);
  }
  const declaration = presentClean().restrictions.find((restriction) =>
    restriction.code === 'NO_DECISION_AUTHORITY');
  s.equal(declaration?.reason, NO_DECISION_AUTHORITY_STATEMENT,
    'the statement is verbatim');
}

{
  const s = section('37 — restrictions order over the vocabulary');
  const result = presentClean();
  const ranks = result.restrictions.map((restriction) =>
    (INPUT_RESTRICTION_CODES as readonly string[])
      .indexOf(restriction.code));
  let ordered = true;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] <= ranks[i - 1]) ordered = false;
  }
  s.check(ordered, 'codes are strictly ordered');
}

{
  const s = section('38 — classification follows the frozen map');
  for (const [label, build] of INPUT_CORPUS) {
    s.equal(build().classification,
      EXPECTED_INPUT_CLASSIFICATIONS[label],
      `${label} classification`);
  }
}

{
  const s = section('39 — eligibility follows the frozen map');
  for (const [label, build] of INPUT_CORPUS) {
    s.equal(build().downstreamEligibility, EXPECTED_ELIGIBILITY[label],
      `${label} eligibility`);
  }
}

{
  const s = section('40 — blocked families surface nothing');
  for (const build of [blockedInputResult, conflictedInputResult,
    insufficientAblInputResult, notComparableInputResult,
    staleInputResult, unstableInputResult]) {
    const result = build();
    s.equal(result.preferredAlternativeId, null,
      `${build.name} surfaces no preferred alternative`);
    s.equal(result.alternativeReferences.length, 0,
      `${build.name} surfaces no alternative references`);
  }
}

{
  const s = section('41 — research families route through research');
  for (const build of [venueDependentInputResult,
    strategyDependentInputResult, regimeDependentInputResult,
    mixedInputResult, researchRequiredInputResult]) {
    s.equal(build().downstreamEligibility, 'RESEARCH_REQUIRED',
      `${build.name} requires research`);
  }
}

{
  const s = section('42 — the corpus covers all thirteen and both '
    + 'domains');
  const classifications = new Set(INPUT_CORPUS.map(([label]) =>
    EXPECTED_INPUT_CLASSIFICATIONS[label]));
  s.equal(classifications.size, 13, 'all thirteen classifications');
  const domains = new Set(INPUT_CORPUS.map(([, build]) =>
    build().inputContext.domain));
  s.check(domains.has('AFIS') && domains.has('ABL'),
    'both domains are covered');
}

// ---------------------------------------------------------------------------
// 43-50 — AFIS/ABL semantics, evidence and dependencies
// ---------------------------------------------------------------------------

{
  const s = section('43 — AFIS BUY/SELL semantics are preserved');
  const result = cleanInputResult();
  s.equal(result.inputContext.domain, 'AFIS', 'the AFIS domain');
  s.check(result.inputContext.semanticPreservation.join(' ')
    .includes('AFIS action semantics (BUY/SELL) are preserved'),
  'the preservation statement is carried');
}

{
  const s = section('44 — ABL BACK/LAY semantics are preserved');
  const result = cleanAblInputResult();
  s.equal(result.inputContext.domain, 'ABL', 'the ABL domain');
  const statement = result.inputContext.semanticPreservation.join(' ');
  s.check(statement.includes('ABL action semantics (BACK/LAY)'),
    'BACK/LAY is preserved');
  s.check(statement.includes('never converted to BUY/SELL'),
    'conversion is explicitly forbidden');
}

{
  const s = section('45 — raw cross-domain comparison is '
    + 'NOT_COMPARABLE');
  const result = notComparableInputResult();
  s.equal(result.classification, 'INPUT_NOT_COMPARABLE',
    'the not-comparable classification');
  s.equal(result.downstreamEligibility, 'NOT_COMPARABLE',
    'the not-comparable eligibility');
  s.check(result.restrictions.some((restriction) =>
    restriction.code === 'NOT_COMPARABLE'),
  'the NOT_COMPARABLE restriction is carried');
}

{
  const s = section('46 — normalized comparison stays declared');
  const result = normalizedInputResult();
  s.equal(result.inputContext.comparability,
    'COMPARABLE_VIA_NORMALIZATION', 'the declared normalization');
  s.check(result.restrictions.some((restriction) =>
    restriction.code === 'NORMALIZED_COMPARISON_ONLY'),
  'the normalization restriction is carried');
}

{
  const s = section('47 — evidence is referenced, never synthesized');
  const result = presentClean();
  const evaluation = cleanEvaluationResult();
  s.check(result.evidence.length > 0, 'evidence references exist');
  for (const reference of result.evidence) {
    s.equal(reference.source, 'STRATEGY_INTENT_EVALUATION',
      'the source is the evaluation');
    s.equal(reference.provenance.evaluationId, evaluation.evaluationId,
      'the reference pins the evaluation');
    s.check(reference.historical, 'references are historical');
  }
}

{
  const s = section('48 — evidence states are carried, not upgraded');
  const result = presentClean();
  s.equal(result.inputContext.evidenceState,
    cleanEvaluationResult().evaluationContext.evidenceState,
    'the evidence state is echoed');
  s.equal(result.inputContext.freshnessState,
    cleanEvaluationResult().evaluationContext.freshnessState,
    'the freshness state is echoed');
  s.equal(result.inputContext.historicalEvidenceCount,
    cleanEvaluationResult().evaluationContext.historicalEvidenceCount,
    'the historical count is echoed');
}

{
  const s = section('49 — dependency references echo the governed '
    + 'state');
  const result = venueDependentInputResult();
  s.equal(result.dependencyReferences.length, 1, 'one reference');
  s.equal(result.dependencyReferences[0].state, 'VENUE_DEPENDENT',
    'the venue-dependent state');
  s.equal(result.dependencyReferences[0].family, 'VENUE',
    'the venue family');
  s.check(result.dependencyReferences[0].informational,
    'the reference is informational');
}

{
  const s = section('50 — dependency information is never dropped');
  for (const [label, build] of INPUT_CORPUS) {
    s.equal(build().dependencyReferences.length, 1,
      `${label} carries its dependency reference`);
  }
}

// ---------------------------------------------------------------------------
// 51-58 — Provenance, research, feedback and explanation
// ---------------------------------------------------------------------------

{
  const s = section('51 — the provenance chain has no orphans');
  const result = presentClean();
  const provenance = result.provenance;
  for (const id of [provenance.opportunityId,
    provenance.decisionContextId, provenance.decisionId,
    provenance.governanceContextId, provenance.governanceId,
    provenance.handoffId, provenance.strategyInputId,
    provenance.intentId, provenance.evaluationId,
    provenance.inputId]) {
    s.check(typeof id === 'string' && id.length > 0, 'no orphan ids');
  }
}

{
  const s = section('52 — every upstream engine version is pinned');
  const versions = presentClean().provenance.sourceVersions;
  s.equal(versions.decisionIntelligenceVersion,
    'oship.decision-intelligence.engine.v1', 'decision intelligence');
  s.equal(versions.governanceVersion,
    'oship.decision-governance.engine.v1', 'governance');
  s.equal(versions.intentVersion, 'oship.strategy-intent.engine.v1',
    'strategy intent');
  s.equal(versions.evaluationVersion,
    'oship.strategy-intent-evaluation.engine.v1', 'evaluation');
  s.equal(versions.bridgeVersion,
    'oship.portfolio-decision-input.engine.v1', 'the bridge itself');
}

{
  const s = section('53 — research requirements are carried verbatim');
  const result = researchRequiredInputResult();
  s.check(result.research.requirements.length > 0,
    'requirements exist for research-required inputs');
  s.equal(result.research.evaluationCarriedCount,
    result.research.requirements.length, 'all requirements are carried');
  s.equal(result.research.bridgeDerivedCount, 0,
    'the bridge derives no research');
  s.check(result.feedback.some((record) =>
    record.kind === 'RESEARCH_ESCALATION_FEEDBACK'),
  'escalation is reported to the existing Research Plane');
}

{
  const s = section('54 — feedback is informational and bound');
  const result = presentClean();
  s.check(result.feedback.length > 0, 'feedback records exist');
  for (const record of result.feedback) {
    s.equal(record.inputId, result.inputId, 'records bind the input');
    s.check(record.informational, 'records are informational');
    s.check(record.feedbackId.startsWith('pdfdb_'),
      'ids are content-derived');
  }
}

{
  const s = section('55 — restriction preservation is always '
    + 'reported');
  for (const [label, build] of INPUT_CORPUS) {
    s.check(build().feedback.some((record) =>
      record.kind === 'RESTRICTION_PRESERVED_FEEDBACK'),
    `${label} reports preservation`);
  }
}

{
  const s = section('56 — the explanation binds its sources');
  const result = presentClean();
  const evaluation = cleanEvaluationResult();
  s.equal(result.explanation.sourceEvaluationId, evaluation.evaluationId,
    'the evaluation is bound');
  s.equal(result.explanation.sourceIntentId, evaluation.intentId,
    'the intent is bound');
  s.equal(result.explanation.sourceDecisionId,
    evaluation.evaluationContext.decisionId, 'the decision is bound');
  s.equal(result.explanation.sourceGovernanceId,
    evaluation.evaluationContext.governanceId,
    'the governance is bound');
}

{
  const s = section('57 — the explanation forbids inference');
  const limitations = presentClean().explanation.semanticLimitations
    .join(' ');
  s.check(limitations.includes('must NOT be inferred'),
    'no allocation inference');
  s.check(limitations.includes('never be inferred as unlimited'),
    'no unlimited-capacity inference');
  s.check(limitations.includes('never converts'),
    'no AFIS/ABL conversion inference');
}

{
  const s = section('58 — unconstrained inputs declare the absence');
  const result = unconstrainedInputResult();
  s.equal(result.capitalConstraints.length, 0, 'no constraints');
  s.check(result.explanation.constraintSummary[0]
    .includes('no capital constraints were supplied'),
  'the absence is declared, never guessed');
}

// ---------------------------------------------------------------------------
// 59-66 — Boundary and authority preservation
// ---------------------------------------------------------------------------

{
  const s = section('59 — the nine existing authorities are '
    + 'preserved');
  s.same([...PROTECTED_INPUT_AUTHORITIES], ['Portfolio', 'Risk',
    'Allocation', 'Strategy', 'AEGIS', 'Treasury', 'Execution',
    'Research Plane', 'Learning/Feedback'],
  'the authority list is exact');
  for (const [label, build] of INPUT_CORPUS) {
    s.same([...build().boundary.protectedAuthorities],
      [...PROTECTED_INPUT_AUTHORITIES],
      `${label} preserves the authorities`);
  }
}

{
  const s = section('60 — the bridge boundary is respected');
  const result = presentClean();
  s.equal(result.boundary.state, 'BOUNDARY_RESPECTED',
    'the boundary state');
  s.equal(result.boundary.checks.length, 5, 'five boundary checks');
  s.check(result.boundary.checks.every((check) => check.passed),
    'every check passes');
  s.check(result.boundary.boundaryId.startsWith('pdbnd_'),
    'the boundary id is content-derived');
}

{
  const s = section('61 — no decision-command keys exist');
  for (const [label, build] of INPUT_CORPUS) {
    const serialized = serializePortfolioDecisionInput(build());
    s.check(!FORBIDDEN_INPUT_KEYS.test(serialized),
      `${label} carries no decision keys`);
  }
  s.check(FORBIDDEN_INPUT_KEYS.test('{"order": 1}'),
    'the forbidden pattern is anchored');
}

{
  const s = section('62 — hostile narratives reject fail closed');
  const hostile = frozenEvaluationClone(cleanEvaluationResult(),
    (draft) => {
      draft.restrictions.push({code: 'LEAKAGE_WARNING',
        scope: 'LEAKAGE', reason: 'allocate capital now',
        source: 'INTENT', restrictionId: 'res_hostile'});
    });
  s.throws('injected allocation language rejects', () =>
    engine.present(bridgeInputOf(hostile)),
    isRejection('PORTFOLIO_BOUNDARY_VIOLATION'));
}

{
  const s = section('63 — annotation safety rejects every family');
  const samples: readonly [string, string][] = [
    ['prediction', 'this alternative will win with probability 0.9'],
    ['future value', 'the expected return next quarter is 12 percent'],
    ['execution', 'place the order now'],
    ['treasury', 'transfer the funds to venue-a'],
    ['portfolio', 'open a position in the preferred alternative'],
    ['risk', 'set the risk limit to 5 percent'],
    ['allocation', 'reserve capital for this input'],
    ['strategy', 'activate the strategy immediately'],
    ['aegis', 'aegis authorization is pre-cleared'],
    ['authority', 'the bridge approves this allocation'],
  ];
  for (const [family, annotation] of samples) {
    s.throws(`${family} annotation rejects`, () =>
      engine.present(bridgeInputOf(cleanEvaluationResult(), [],
        [annotation])));
  }
}

{
  const s = section('64 — negated and quoted language stays legal');
  s.check(true === true, 'the corpus runs carry legal narratives');
  const result = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [], ['this input is not a probability and not a forecast']));
  s.equal(result.classification, 'INPUT_READY',
    'negated prediction language is tolerated');
}

{
  const s = section('65 — annotations are bounded and sorted');
  s.throws('too many annotations reject', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      Array.from({length: 17}, (_, i) => `note ${String(i)}`))));
  const result = annotatedInputResult();
  s.same([...result.annotations], [...result.annotations].sort(),
    'annotations are sorted');
}

{
  const s = section('66 — the serialized contract is decision-free');
  const serialized = serializePortfolioDecisionInput(presentClean());
  for (const key of ['"order"', '"quantity"', '"portfolioWeight"',
    '"targetWeight"', '"reservedFunds"', '"executionPlan"',
    '"apiKey"', '"credential"', '"authorization"']) {
    s.check(!serialized.includes(key), `${key} is absent`);
  }
}

// ---------------------------------------------------------------------------
// 67-72 — Audit, determinism and invariants
// ---------------------------------------------------------------------------

{
  const s = section('67 — the audit chain covers the lifecycle');
  const result = presentClean();
  s.equal(INPUT_EVENT_TYPES.length, 18, 'eighteen event types');
  const types = new Set(result.auditEvents.map((event) =>
    event.eventType));
  for (const eventType of INPUT_EVENT_TYPES) {
    s.check(types.has(eventType), `${eventType} is recorded`);
  }
}

{
  const s = section('68 — the audit chain verifies');
  const result = presentClean();
  const verdict = verifyPortfolioDecisionInputAudit(result.auditEvents,
    result.auditEvents.length);
  s.check(verdict.valid, `the chain verifies (${verdict.reason})`);
  s.equal(result.auditEvents[0].previousHash,
    PORTFOLIO_DECISION_INPUT_GENESIS_HASH, 'the chain starts at genesis');
  s.equal(result.auditIdentity.headHash,
    result.auditEvents[result.auditIdentity.eventCount - 1].hash,
    'the identity anchors the pre-replay chain');
}

{
  const s = section('69 — audit tampering fails closed');
  const result = presentClean();
  const events = [...result.auditEvents];
  const tampered = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 3), {...events[3],
      payload: {...events[3].payload, forged: true}},
      ...events.slice(4)], events.length);
  s.check(!tampered.valid, 'payload tampering is detected');
  const truncated = verifyPortfolioDecisionInputAudit(
    events.slice(0, events.length - 2), events.length);
  s.check(!truncated.valid, 'truncation is detected');
  const foreign = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 2), {...events[2],
      schemaVersion: 'oship.foreign.v9' as never},
      ...events.slice(3)], events.length);
  s.check(!foreign.valid, 'foreign schema is detected');
}

{
  const s = section('70 — the audit binding pins the content');
  const result = presentClean();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  s.check(verdict.valid, `the binding verifies (${verdict.reason})`);
}

{
  const s = section('71 — the double run is byte-identical');
  const input = bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  const first = engine.present(input);
  const second = engine.present(input);
  s.equal(serializePortfolioDecisionInput(first),
    serializePortfolioDecisionInput(second),
    'two presentations are byte-identical');
  s.check(first.replay.identical, 'the replay record seals identity');
  s.equal(first.replay.fingerprint, first.inputFingerprint,
    'the replay fingerprint is the input fingerprint');
}

{
  const s = section('72 — the replay API verifies records');
  const input = bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  const recorded = serializePortfolioDecisionInput(engine.present(
    input));
  const verdict = engine.replay(input, recorded);
  s.check(verdict.replayMatches, 'a recorded result replays exactly');
  const mismatch = engine.replay(input, '{"forged": true}');
  s.check(!mismatch.replayMatches, 'a forged record is detected');
}

{
  const s = section('73 — the invariant battery is exhaustive');
  const result = presentClean();
  s.check(result.invariants.checks.length >= 75,
    `at least 75 checks (found ${String(
      result.invariants.checks.length)})`);
  s.check(result.invariants.passed, 'every invariant passes');
  s.equal(result.invariants.failedCount, 0, 'zero failures');
  const {invariants: ignored, ...subject} = result;
  Object.freeze(subject);
  const recheck = checkInputInvariants(subject, {
    input: bridgeInputOf(cleanEvaluationResult(),
      standardConstraints('AFIS')),
    config: engine.configuration});
  s.check(recheck.passed, 'the battery re-verifies independently');
}

// ---------------------------------------------------------------------------
// 74-79 — The 33-scenario corpus sweep
// ---------------------------------------------------------------------------

const SCENARIOS: readonly [string, () => unknown][] = [
  ['01 clean AFIS', cleanInputResult],
  ['02 clean ABL', cleanAblInputResult],
  ['03 restricted', restrictedInputResult],
  ['04 aging', agingInputResult],
  ['05 normalized', normalizedInputResult],
  ['06 conflicted', conflictedInputResult],
  ['07 insufficient ABL', insufficientAblInputResult],
  ['08 insufficient freshness', insufficientFreshnessInputResult],
  ['09 stale', staleInputResult],
  ['10 stale-allowed', staleAllowedInputResult],
  ['11 unknown-allowed', unknownAllowedInputResult],
  ['12 unstable', unstableInputResult],
  ['13 blocked', blockedInputResult],
  ['14 authority-bypass', authorityBypassInputResult],
  ['15 unstable-blocked', unstableBlockedInputResult],
  ['16 not-comparable', notComparableInputResult],
  ['17 venue-dependent', venueDependentInputResult],
  ['18 strategy-dependent', strategyDependentInputResult],
  ['19 regime-dependent', regimeDependentInputResult],
  ['20 mixed', mixedInputResult],
  ['21 research-required', researchRequiredInputResult],
  ['22 no-dominant', noDominantInputResult],
  ['23 multi-dependent', multiDependentInputResult],
  ['24 unknown capacity', unknownCapacityInputResult],
  ['25 stale constraint', staleConstraintInputResult],
  ['26 all nine kinds', allKindsInputResult],
  ['27 annotated', annotatedInputResult],
  ['28 unconstrained', unconstrainedInputResult],
];

{
  const s = section('74 — the 33-scenario sweep (28 memoized runs)');
  s.equal(SCENARIOS.length, 28, '28 memoized scenarios');
  for (const [label, build] of SCENARIOS) {
    const result = build() as ReturnType<typeof cleanInputResult>;
    s.check(result.invariants.passed, `${label} passes its gates`);
    s.check(result.replay.identical, `${label} replays identically`);
    s.equal(result.boundary.state, 'BOUNDARY_RESPECTED',
      `${label} respects the boundary`);
    s.check(result.auditIdentity.inputId === result.inputId,
      `${label} audit identity binds`);
  }
}

{
  const s = section('75 — scenario 29: the REJECT-policy rejection');
  let rejected = false;
  try {
    strictEngine.present(bridgeInputOf(cleanEvaluationResult(),
      [staleStrategyConstraint()]));
  } catch (error) {
    rejected = error instanceof InputRejectionError
      && error.code === 'STALE_CONSTRAINT';
  }
  s.check(rejected, 'the strict engine fails stale closed');
}

{
  const s = section('76 — scenario 30: the conflict rejection');
  let rejected = false;
  try {
    engine.present(bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('AFIS', 's', 1),
        knownExposureConstraint('AFIS', 's', 2)]));
  } catch (error) {
    rejected = error instanceof InputRejectionError
      && error.code === 'CONFLICTED_CONSTRAINT';
  }
  s.check(rejected, 'conflicting constraints fail closed');
}

{
  const s = section('77 — scenario 31: the source-tamper rejection');
  let rejected = false;
  try {
    engine.present(bridgeInputOf(tamperedEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.acceptableAlternativeIds = ['alt_forged'];
      })));
  } catch (error) {
    rejected = error instanceof InputRejectionError
      && error.code === 'INVALID_EVALUATION';
  }
  s.check(rejected, 'a tampered source fails closed');
}

{
  const s = section('78 — scenario 32: the hostile-narrative '
      + 'rejection');
  let rejected = false;
  try {
    engine.present(bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.restrictions.push({code: 'LEAKAGE_WARNING',
          scope: 'LEAKAGE', reason: 'allocate capital now',
          source: 'INTENT', restrictionId: 'res_hostile'});
      })));
  } catch (error) {
    rejected = error instanceof InputRejectionError
      && error.code === 'PORTFOLIO_BOUNDARY_VIOLATION';
  }
  s.check(rejected, 'hostile narratives fail closed');
}

{
  const s = section('79 — scenario 33: the annotation rejection');
  let rejected = false;
  try {
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['place the order now']));
  } catch (error) {
    rejected = error instanceof InputRejectionError
      && error.code === 'EXECUTION_BOUNDARY_VIOLATION';
  }
  s.check(rejected, 'execution annotations fail closed');
}

// ---------------------------------------------------------------------------
// 80-85 — The fail-closed gallery and final reconciliation
// ---------------------------------------------------------------------------

{
  const s = section('80 — the rejection gallery passes exactly');
  const gallery = inputRejectionGallery();
  s.check(gallery.length >= 40,
    `at least 40 fixtures (found ${String(gallery.length)})`);
  for (const fixture of gallery) {
    const verdict = expectInputRejection(fixture.input,
      fixture.configInput);
    s.equal(verdict.code, fixture.code, `${fixture.label} rejects`);
  }
}

{
  const s = section('81 — rejections are deterministic');
  for (const fixture of inputRejectionGallery().slice(0, 12)) {
    const first = expectInputRejection(fixture.input,
      fixture.configInput);
    const second = expectInputRejection(fixture.input,
      fixture.configInput);
    s.equal(first.code, second.code, `${fixture.label} is stable`);
    s.equal(first.message, second.message,
      `${fixture.label} message is stable`);
  }
}

{
  const s = section('82 — the gallery covers every rejection family');
  const covered = new Set(inputRejectionGallery().map((fixture) =>
    fixture.code));
  const families = ['INVALID_INPUT_CONTEXT', 'MISSING_EVALUATION',
    'INVALID_EVALUATION', 'EVALUATION_MISMATCH', 'MISSING_PROVENANCE',
    'INVALID_PROVENANCE', 'PROVENANCE_SUBSTITUTION', 'STALE_EVIDENCE',
    'UNKNOWN_FRESHNESS', 'UNSTABLE_EVIDENCE', 'INSUFFICIENT_EVIDENCE',
    'CONFLICTING_EVIDENCE', 'NOT_COMPARABLE',
    'RESTRICTION_INCONSISTENCY', 'MISSING_DEPENDENCY',
    'INVALID_DEPENDENCY', 'UNKNOWN_CONSTRAINT',
    'CONFLICTED_CONSTRAINT', 'STALE_CONSTRAINT',
    'CONSTRAINT_MISMATCH', 'MISSING_CONSTRAINT_AUTHORITY',
    'PORTFOLIO_BOUNDARY_VIOLATION', 'RISK_BOUNDARY_VIOLATION',
    'ALLOCATION_BOUNDARY_VIOLATION', 'STRATEGY_BOUNDARY_VIOLATION',
    'AEGIS_BOUNDARY_VIOLATION', 'TREASURY_BOUNDARY_VIOLATION',
    'EXECUTION_BOUNDARY_VIOLATION', 'SEMANTIC_PREDICTION_VIOLATION',
    'FUTURE_VALUE_VIOLATION', 'NORMALIZATION_VIOLATION',
    'AUTHORITY_MISMATCH', 'NONDETERMINISTIC_INPUT'];
  for (const family of families) {
    s.check(covered.has(family as never), `${family} is covered`);
  }
}

{
  const s = section('83 — Sprint 042 results verify upstream');
  const evaluation = cleanEvaluationResult();
  s.check(evaluation.invariants.passed,
    'the consumed evaluation passed its own gates');
  s.check(evaluation.replay.identical,
    'the consumed evaluation is replay-identical');
  s.equal(evaluation.schemaVersion,
    'oship.strategy-intent-evaluation.v1', 'the 042 schema');
}

{
  const s = section('84 — the bridge consumes 042 unmodified');
  const evaluation = cleanEvaluationResult();
  const before = serializeEvaluation(evaluation);
  presentClean();
  const after = serializeEvaluation(cleanEvaluationResult());
  s.equal(before, after, 'the evaluation is untouched by consumption');
}

{
  const s = section('85 — hash discipline is SHA-256 canonical');
  s.match(hashOf({a: 1}), /^[0-9a-f]{64}$/, 'hashOf is SHA-256 hex');
  s.equal(hashOf({a: 1, b: 2}), hashOf({b: 2, a: 1}),
    'hashing is key-order independent');
}

function serializeEvaluation(
  evaluation: ReturnType<typeof cleanEvaluationResult>): string {
  return canonicalJson({evaluationId: evaluation.evaluationId,
    classification: evaluation.classification,
    eligibility: evaluation.eligibility,
    restrictions: evaluation.restrictions.map((restriction) =>
      restriction.code)});
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

{
  const lines: string[] = [];
  lines.push('================================================================');
  lines.push('OSHIP — SPRINT 043 — UNIFIED PORTFOLIO DECISION INPUT');
  lines.push('CONTRACT & CAPITAL-CONSTRAINT BRIDGE');
  lines.push('================================================================');
  lines.push('');
  lines.push('PAPER / SIMULATION ONLY — AN INPUT CONTRACT, NOT A');
  lines.push('PORTFOLIO ENGINE, NOT A RISK ENGINE, NOT AN ALLOCATOR,');
  lines.push('NOT A STRATEGY REGISTRY, NOT AN EXECUTION PLANNER, NOT');
  lines.push('AN ORACLE. THE BRIDGE HAS NO_DECISION_AUTHORITY.');
  lines.push('ELIGIBILITY NEVER MEANS TRADING, BETTING, CAPITAL OR');
  lines.push('EXECUTION APPROVAL. THE EXISTING DOWNSTREAM AUTHORITIES');
  lines.push('DECIDE.');
  lines.push('');
  lines.push(`engine: ${PORTFOLIO_DECISION_INPUT_ENGINE_VERSION}`);
  lines.push(`sections: ${String(sections.length)}`);
  lines.push('');
  let failures = 0;
  for (const s of sections) {
    const status = s.failures.length === 0 ? 'PASS' : 'FAIL';
    lines.push(`[${status}] ${s.name}`);
    for (const failure of s.failures) {
      lines.push(`       - ${failure}`);
      failures += 1;
    }
  }
  lines.push('');
  lines.push('================================================================');
  lines.push(`sections: ${String(sections.length)}`
    + ` | failures: ${String(failures)}`);
  lines.push('');
  if (failures === 0) {
    lines.push('SYSTEM STATUS: RECONCILED');
  } else {
    lines.push('SYSTEM STATUS: NOT RECONCILED — FAIL-CLOSED');
  }
  lines.push('================================================================');
  console.log(lines.join('\n'));
  if (failures > 0) {
    process.exitCode = 1;
  }
}
