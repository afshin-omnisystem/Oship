/**
 * SPRINT 042 — UNIFIED STRATEGY-INTENT EVALUATION & PORTFOLIO DECISION
 * BRIDGE demo.
 *
 * PAPER / SIMULATION ONLY — AN ANALYTICAL DECISION BRIDGE, NOT A
 * PORTFOLIO ENGINE, NOT A RISK ENGINE, NOT AN ALLOCATOR, NOT A STRATEGY
 * REGISTRY, NOT AN EXECUTION PLANNER, NOT AN ORACLE.
 *
 * Every section drives the REAL evaluation engine over the REAL
 * Sprint 041 intent corpus (clean AFIS/ABL, restricted, aging,
 * normalized, conflicted, insufficient, stale, unstable, blocked,
 * single-flag dependency, mixed, research-escalated runs):
 *
 *   StrategyIntent → Source Validation → Intent Integrity → Evidence →
 *   Safety → Comparability → Freshness → Stability → Dependency →
 *   Restriction Analysis → Portfolio-Interface Compatibility →
 *   Evaluation Dimensions → Classification → Downstream Eligibility →
 *   Research/Feedback → Explanation → Boundary → Audit → Replay →
 *   Invariants.
 *
 * The question answered is: "Is this StrategyIntent sufficiently
 * supported, constrained, comparable, fresh, stable and structurally
 * valid to be CONSIDERED by the existing Portfolio/Risk/Allocation
 * decision plane?" Eligibility never means approved for trading,
 * betting, execution, capital allocation or strategy activation. The
 * downstream plane decides; this bridge never allocates, sizes,
 * reserves or approves anything. Nothing is mocked.
 */

import {
  StrategyIntentEvaluationEngine,
  STRATEGY_INTENT_EVALUATION_ENGINE_VERSION,
} from './intelligence/strategy-intent-evaluation/engine';
import {
  verifyStrategyIntentEvaluationAudit,
  verifyEvaluationAuditBinding,
} from './intelligence/strategy-intent-evaluation/audit';
import {verifyStrategyIntentAudit,
} from './intelligence/strategy-intent/audit';
import {
  serializeStrategyIntentEvaluationResult,
} from './intelligence/strategy-intent-evaluation/replay';
import {checkEvaluationInvariants,
} from './intelligence/strategy-intent-evaluation/invariants';
import {
  PROTECTED_DOWNSTREAM_AUTHORITIES, FORBIDDEN_EVALUATION_KEYS,
} from './intelligence/strategy-intent-evaluation/portfolio-interface';
import {EVALUATION_DISCLAIMER, ELIGIBILITY_MEANING,
  EVALUATION_CLASSIFICATIONS, EVALUATION_DIMENSION_NAMES,
  EVALUATION_REJECTION_CODES, EvaluationRejectionError,
} from './intelligence/strategy-intent-evaluation/types';
import {
  evaluationInputOf, evaluationRejectionGallery,
  expectEvaluationRejection, cleanEvaluationResult,
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
  cleanIntentResult, liqIntentResult, cleanAblIntentResult,
  ablIntentResult, frozenIntentClone, evaluationClone,
} from './intelligence/strategy-intent-evaluation/test-fixtures';

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

const engine = new StrategyIntentEvaluationEngine();
const isRejection = (code: string) => (e: unknown) =>
  e instanceof EvaluationRejectionError && e.code === code;

function evaluateClean(): ReturnType<typeof cleanEvaluationResult> {
  return engine.evaluate(evaluationInputOf(cleanIntentResult()));
}

// ---------------------------------------------------------------------------
// 1-9 — The bridge, its vocabularies and its source discipline
// ---------------------------------------------------------------------------

{
  const s = section('01 — the engine and its versions');
  s.equal(STRATEGY_INTENT_EVALUATION_ENGINE_VERSION,
    'oship.strategy-intent-evaluation.engine.v1', 'engine version');
  s.equal(engine.configuration.maxAnnotations, 16,
    'default annotation bound');
  s.check(engine.configurationFingerprint.startsWith('evcfg_'),
    'configuration fingerprint prefix');
}

{
  const s = section('02 — the decision-bridge question');
  s.check(evaluateClean().informational, 'results are informational');
  s.check(evaluateClean().downstreamDecides,
    'the downstream plane decides');
  s.equal(evaluateClean().boundary.state, 'BOUNDARY_RESPECTED',
    'the bridge boundary is respected');
}

{
  const s = section('03 — thirteen evaluation classifications');
  s.equal(EVALUATION_CLASSIFICATIONS.length, 13,
    'exactly thirteen classifications');
  s.check(EVALUATION_CLASSIFICATIONS.includes('EVALUATION_MIXED'),
    'MIXED exists');
  s.check(EVALUATION_CLASSIFICATIONS.includes(
    'EVALUATION_REGIME_DEPENDENT'), 'REGIME_DEPENDENT exists');
}

{
  const s = section('04 — nine downstream eligibility states');
  const result = evaluateClean();
  s.check(['ELIGIBLE_FOR_CONSIDERATION',
    'ELIGIBLE_WITH_RESTRICTIONS', 'RESEARCH_REQUIRED', 'BLOCKED',
    'NOT_COMPARABLE', 'INSUFFICIENT_EVIDENCE', 'STALE', 'UNSTABLE',
    'CONFLICTED'].includes(result.eligibility),
  'eligibility is one of the nine states');
  s.check(result.eligibilityReasons.includes(ELIGIBILITY_MEANING),
    'the eligibility meaning is verbatim');
}

{
  const s = section('05 — eighteen explicit dimensions, no hidden scoring');
  const result = evaluateClean();
  s.equal(result.dimensions.length, 18, 'exactly eighteen dimensions');
  s.same(result.dimensions.map((d) => d.dimension),
    [...EVALUATION_DIMENSION_NAMES], 'the canonical battery in order');
}

{
  const s = section('06 — eight lifecycle gates');
  const result = evaluateClean();
  s.same(result.gates.map((gate) => gate.gate), [
    'integrity', 'evidence', 'safety', 'comparability', 'freshness',
    'stability', 'dependency', 'portfolio-interface',
  ], 'the eight gates in lifecycle order');
}

{
  const s = section('07 — only governed Sprint 041 results pass');
  const unfrozen = evaluationClone(cleanIntentResult());
  s.throws('an unfrozen intent rejects',
    () => engine.evaluate(evaluationInputOf(
      unfrozen as never)), isRejection('INVALID_INTENT_SOURCE'));
  const wrongSchema = frozenIntentClone(cleanIntentResult(),
    (draft) => {
      (draft as {schemaVersion: string}).schemaVersion
        = 'oship.evil.v1';
    });
  s.throws('a foreign schema rejects',
    () => engine.evaluate(evaluationInputOf(wrongSchema)),
    isRejection('INVALID_INTENT_SOURCE'));
}

{
  const s = section('08 — the sealed intent fingerprint verifies');
  const forged = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intentFingerprint = 'sfp2_forged';
  });
  s.throws('a forged fingerprint rejects',
    () => engine.evaluate(evaluationInputOf(forged)),
    isRejection('INVALID_INTENT_SOURCE'));
  const relabeled = frozenIntentClone(cleanIntentResult(), (draft) => {
    (draft as {classification: string}).classification
      = 'MAGIC_INTENT';
  });
  s.throws('sealed classification tampering rejects',
    () => engine.evaluate(evaluationInputOf(relabeled)),
    isRejection('INVALID_INTENT_SOURCE'));
}

{
  const s = section('09 — the consumed intent audit chain verifies');
  const intent = cleanIntentResult();
  const verdict = verifyStrategyIntentAudit(intent.auditEvents,
    intent.auditEvents.length);
  s.check(verdict.valid, 'the Sprint 041 audit chain verifies');
  s.equal(intent.invariants.passed, true,
    'the intent passed its own invariants');
  s.equal(intent.replay.identical, true,
    'the intent is replay-identical');
}

// ---------------------------------------------------------------------------
// 10-21 — AFIS corpus: the informational evaluation ladder
// ---------------------------------------------------------------------------

{
  const s = section('10 — clean AFIS intent evaluates ALLOWED');
  const result = cleanEvaluationResult();
  s.equal(result.classification, 'EVALUATION_ALLOWED',
    'clean classification');
  s.equal(result.eligibility, 'ELIGIBLE_FOR_CONSIDERATION',
    'clean eligibility');
}

{
  const s = section('11 — clean AFIS gates');
  const result = cleanEvaluationResult();
  s.equal(result.gates[0].state, 'PASS', 'integrity gate');
  s.check(result.gates.every((gate) =>
    gate.state.startsWith('PASS')), 'every gate passes or limits');
  s.check(result.gates.every((gate) => gate.detail.length > 0),
    'every gate explains itself');
}

{
  const s = section('12 — clean AFIS dimensions');
  const result = cleanEvaluationResult();
  const byName = new Map(result.dimensions.map((d) =>
    [d.dimension, d.state]));
  s.equal(byName.get('intent-integrity'), 'SATISFIED', 'integrity');
  s.equal(byName.get('freshness'), 'SATISFIED', 'freshness');
  s.equal(byName.get('stability'), 'SATISFIED', 'stability');
  s.equal(byName.get('authority-compliance'), 'SATISFIED',
    'authority compliance');
}

{
  const s = section('13 — eligibility means consideration, never approval');
  const result = cleanEvaluationResult();
  s.check(result.eligibilityReasons.some((reason) =>
    reason.includes('never approved for trading, betting, execution, '
      + 'capital allocation or strategy activation')),
  'the meaning is stated verbatim');
  s.equal(result.disclaimer, EVALUATION_DISCLAIMER,
    'the disclaimer is verbatim');
}

{
  const s = section('14 — clean AFIS surfaces its alternatives');
  const result = cleanEvaluationResult();
  const intent = cleanIntentResult();
  s.same(result.acceptableAlternativeIds,
    intent.acceptableAlternativeIds,
    'the governed acceptable set is echoed');
  s.equal(result.preferredAlternativeId,
    intent.preferredAlternativeId, 'the preference is echoed');
}

{
  const s = section('15 — restricted intent evaluates WITH LIMITATIONS');
  const result = restrictedEvaluationResult();
  s.equal(result.classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS', 'restricted classification');
  s.equal(result.eligibility, 'ELIGIBLE_WITH_RESTRICTIONS',
    'restricted eligibility');
}

{
  const s = section('16 — restrictions carry verbatim and grow');
  const result = restrictedEvaluationResult();
  const intent = liqIntentResult();
  for (const restriction of intent.restrictions) {
    s.check(result.restrictions.some((carried) =>
      carried.code === restriction.code
        && carried.reason === restriction.reason),
    `carried verbatim: ${restriction.code}`);
  }
  s.check(result.restrictions.some((carried) =>
    carried.code === 'DOWNSTREAM_CONSIDERATION_ONLY'),
  'the derived downstream boundary is added');
  s.check(result.restrictions.length > intent.restrictions.length,
    'restrictions grow, never shrink');
}

{
  const s = section('17 — aging evidence evaluates with limitations');
  s.equal(agingEvaluationResult().classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS', 'aging classification');
  s.check(agingEvaluationResult().restrictions.some((r) =>
    r.code === 'AGING_EVIDENCE_WARNING'), 'the aging warning carries');
}

{
  const s = section('18 — normalized comparison evaluates explicitly');
  const result = normalizedEvaluationResult();
  s.equal(result.classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS', 'normalized classification');
  s.check(result.restrictions.some((r) =>
    r.code === 'NORMALIZED_COMPARISON_ONLY'),
  'the normalization declaration is explicit');
}

{
  const s = section('19 — normalization declares its semantic loss');
  const result = normalizedEvaluationResult();
  s.check(result.explanation.semanticLimitations.some((line) =>
    line.includes('normalization')),
  'the explanation declares the normalization loss');
  s.check(result.gates[3].state === 'PASS_WITH_LIMITATIONS',
    'the comparability gate limits, not passes');
}

{
  const s = section('20 — conflicted evidence never resolves silently');
  const result = conflictedEvaluationResult();
  s.equal(result.classification, 'EVALUATION_CONFLICTED',
    'conflicted classification');
  s.equal(result.eligibility, 'CONFLICTED', 'conflicted eligibility');
}

{
  const s = section('21 — blocked families surface nothing');
  const result = conflictedEvaluationResult();
  s.equal(result.preferredAlternativeId, null, 'no preference');
  s.equal(result.acceptableAlternativeIds.length, 0,
    'no acceptable alternatives');
}

// ---------------------------------------------------------------------------
// 22-31 — Insufficient, stale, unstable, blocked
// ---------------------------------------------------------------------------

{
  const s = section('22 — insufficient ABL evidence blocks');
  const result = insufficientAblEvaluationResult();
  s.equal(result.classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'insufficient classification');
  s.equal(result.eligibility, 'INSUFFICIENT_EVIDENCE',
    'insufficient eligibility');
}

{
  const s = section('23 — missing evidence is never inferred');
  const result = insufficientAblEvaluationResult();
  s.equal(result.acceptableAlternativeIds.length, 0,
    'no alternatives are surfaced');
  s.check(result.explanation.semanticLimitations.length >= 2,
    'the semantic limitations are stated');
}

{
  const s = section('24 — unknown freshness fails closed');
  s.equal(insufficientFreshnessEvaluationResult().classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE',
    'unknown freshness surfaces the harder state');
}

{
  const s = section('25 — stale evidence evaluates STALE');
  const result = staleEvaluationResult();
  s.equal(result.classification, 'EVALUATION_STALE',
    'stale classification');
  s.equal(result.eligibility, 'STALE', 'stale eligibility');
}

{
  const s = section('26 — allowStale policy does not refresh evidence');
  s.equal(staleAllowedEvaluationResult().classification,
    'EVALUATION_STALE', 'policy cannot make stale evidence fresh');
}

{
  const s = section('27 — unknown under analytical-only still degrades');
  s.equal(unknownAllowedEvaluationResult().classification,
    'EVALUATION_STALE', 'unknown freshness degrades to the stale family');
}

{
  const s = section('28 — unstable evidence evaluates UNSTABLE');
  const result = unstableEvaluationResult();
  s.equal(result.classification, 'EVALUATION_UNSTABLE',
    'unstable classification');
  s.equal(result.eligibility, 'UNSTABLE', 'unstable eligibility');
}

{
  const s = section('29 — an unstable blocked source stays blocked');
  s.equal(unstableBlockedEvaluationResult().classification,
    'EVALUATION_BLOCKED', 'blocked sources are never un-blocked');
  s.equal(unstableEvaluationResult().classification,
    'EVALUATION_UNSTABLE', 'unallowed unstable degrades to UNSTABLE');
}

{
  const s = section('30 — governance-blocked intents evaluate BLOCKED');
  s.equal(blockedEvaluationResult().classification,
    'EVALUATION_BLOCKED', 'governance block carries through');
  s.equal(blockedEvaluationResult().eligibility, 'BLOCKED',
    'blocked eligibility');
}

{
  const s = section('31 — authority bypass carries its block forward');
  s.equal(authorityBypassEvaluationResult().classification,
    'EVALUATION_BLOCKED', 'authority bypass stays blocked');
}

// ---------------------------------------------------------------------------
// 32-38 — Dependency families
// ---------------------------------------------------------------------------

{
  const s = section('32 — strategy-dependent AFIS');
  const result = strategyDependentEvaluationResult();
  s.equal(result.classification,
    'EVALUATION_STRATEGY_DEPENDENT', 'strategy classification');
  s.equal(result.eligibility, 'RESEARCH_REQUIRED',
    'dependency families require research first');
}

{
  const s = section('33 — venue-dependent AFIS');
  const result = venueDependentEvaluationResult();
  s.equal(result.classification, 'EVALUATION_VENUE_DEPENDENT',
    'venue classification');
  s.check(result.restrictions.some((r) =>
    r.code === 'VENUE_LIMITED'), 'the venue restriction carries');
}

{
  const s = section('34 — regime-dependent AFIS');
  const result = regimeDependentEvaluationResult();
  s.equal(result.classification, 'EVALUATION_REGIME_DEPENDENT',
    'regime classification');
}

{
  const s = section('35 — single-flag dependencies stay actionable');
  const result = venueDependentEvaluationResult();
  s.check(result.acceptableAlternativeIds.length > 0,
    'the alternatives stay visible for research');
  s.check(result.research.requirements.some((r) =>
    r.researchClass === 'VENUE_RESEARCH'),
  'the venue research requirement carries');
}

{
  const s = section('36 — mixed dependencies evaluate MIXED');
  const result = mixedEvaluationResult();
  s.equal(result.classification, 'EVALUATION_MIXED', 'mixed classification');
  s.check(result.research.requirements.some((r) =>
    r.researchClass === 'REGIME_RESEARCH'), 'regime research');
  s.check(result.research.requirements.some((r) =>
    r.researchClass === 'STRATEGY_RESEARCH'), 'strategy research');
  s.check(result.research.requirements.some((r) =>
    r.researchClass === 'VENUE_RESEARCH'), 'venue research');
}

{
  const s = section('37 — governance escalates single flags to research');
  const result = researchRequiredEvaluationResult();
  s.equal(result.classification, 'EVALUATION_REQUIRES_RESEARCH',
    'escalated classification');
  s.equal(result.eligibility, 'RESEARCH_REQUIRED',
    'escalated eligibility');
}

{
  const s = section('38 — the frozen eligibility map');
  s.equal(venueDependentEvaluationResult().eligibility,
    'RESEARCH_REQUIRED', 'venue → research');
  s.equal(strategyDependentEvaluationResult().eligibility,
    'RESEARCH_REQUIRED', 'strategy → research');
  s.equal(regimeDependentEvaluationResult().eligibility,
    'RESEARCH_REQUIRED', 'regime → research');
  s.equal(mixedEvaluationResult().eligibility,
    'RESEARCH_REQUIRED', 'mixed → research');
}

// ---------------------------------------------------------------------------
// 39-47 — ABL semantics: BACK/LAY preserved verbatim
// ---------------------------------------------------------------------------

{
  const s = section('39 — clean ABL intent evaluates ALLOWED');
  const result = cleanAblEvaluationResult();
  s.equal(result.classification, 'EVALUATION_ALLOWED',
    'clean ABL classification');
  s.equal(result.eligibility, 'ELIGIBLE_FOR_CONSIDERATION',
    'clean ABL eligibility');
  s.equal(result.evaluationContext.domain, 'ABL', 'the ABL domain');
}

{
  const s = section('40 — BACK and LAY are preserved verbatim');
  const intent = cleanAblIntentResult();
  const sides = intent.alternatives.flatMap((alternative) =>
    alternative.semanticIdentity.map((leg) => leg.side));
  s.check(sides.includes('BACK'), 'BACK survives');
  s.check(sides.includes('LAY'), 'LAY survives');
  s.check(!sides.includes('BUY'), 'no BUY conversion');
  s.check(!sides.includes('SELL'), 'no SELL conversion');
}

{
  const s = section('41 — market and selection identity preserved');
  for (const alternative of cleanAblIntentResult().alternatives) {
    s.check(alternative.marketId !== null,
      `${alternative.alternativeId} keeps its market`);
    s.check(alternative.selectionId !== null,
      `${alternative.alternativeId} keeps its selection`);
  }
}

{
  const s = section('42 — ABL odds stay decimal and above one');
  for (const alternative of cleanAblIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      s.check(leg.odds !== null && leg.odds > 1,
        `${alternative.alternativeId} keeps decimal odds`);
    }
  }
}

{
  const s = section('43 — the clean ABL evaluation surfaces all four');
  const result = cleanAblEvaluationResult();
  s.equal(result.acceptableAlternativeIds.length, 4,
    'all four alternatives are eligible');
  s.equal(result.preferredAlternativeId,
    'baseline-dec-abl-surebet-base', 'the baseline is preferred');
}

{
  const s = section('44 — insufficient ABL (thin corpus) fails closed');
  const result = insufficientAblEvaluationResult();
  s.equal(result.classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'thin ABL classification');
  s.check(ablIntentResult().alternatives.every((alternative) =>
    alternative.tradeOffScore === null),
  'the corpus carries no honest scores');
}

{
  const s = section('45 — AFIS BUY/SELL preserved verbatim');
  for (const alternative of cleanIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      s.check(leg.side === 'BUY' || leg.side === 'SELL',
        `${alternative.alternativeId} keeps financial sides`);
    }
  }
}

{
  const s = section('46 — AFIS carries no betting identity');
  for (const alternative of cleanIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      s.equal(leg.odds, null,
        `${alternative.alternativeId} carries no odds`);
    }
    s.equal(alternative.marketId, null,
      `${alternative.alternativeId} carries no market id`);
  }
}

{
  const s = section('47 — one intent never spans both domains');
  const mixed = frozenIntentClone(cleanAblIntentResult(), (draft) => {
    draft.alternatives.push(evaluationClone(draft.alternatives[0],
      (alternative) => {
        alternative.alternativeId = 'alt-foreign-afis';
        alternative.domain = 'AFIS';
      }));
  });
  s.throws('a mixed-domain intent rejects',
    () => engine.evaluate(evaluationInputOf(mixed)),
    isRejection('NON_COMPARABLE_DOMAIN'));
}

// ---------------------------------------------------------------------------
// 48-51 — Cross-domain rules (§12)
// ---------------------------------------------------------------------------

{
  const s = section('48 — raw cross-domain is never comparable');
  const result = notComparableEvaluationResult();
  s.equal(result.classification, 'EVALUATION_NOT_COMPARABLE',
    'raw cross-domain classification');
  s.equal(result.eligibility, 'NOT_COMPARABLE',
    'raw cross-domain eligibility');
}

{
  const s = section('49 — invalid normalization rejects fail closed');
  const forged = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.comparability = 'COMPARABLE_VIA_NORMALIZATION';
  });
  s.throws('a normalized status without its declaration rejects',
    () => engine.evaluate(evaluationInputOf(forged)),
    isRejection('NORMALIZATION_VIOLATION'));
}

{
  const s = section('50 — dropping the sealed declaration is tampering');
  const forged = frozenIntentClone(normalizedResultForDemo(),
    (draft) => {
      draft.restrictions = draft.restrictions.filter((restriction) =>
        restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
    });
  s.throws('the sealed restriction list cannot be edited',
    () => engine.evaluate(evaluationInputOf(forged)),
    isRejection('INVALID_INTENT_SOURCE'));
}

{
  const s = section('51 — a not-comparable preference is impossible');
  const forged = frozenIntentClone(
    notComparableResultForDemo(), (draft) => {
      draft.preferredAlternativeId
        = draft.alternatives[0].alternativeId;
    });
  s.throws('surfacing a preference on not-comparable rejects',
    () => engine.evaluate(evaluationInputOf(forged)),
    isRejection('NORMALIZATION_VIOLATION'));
}

function normalizedResultForDemo(): ReturnType<
    typeof cleanIntentResult> {
  const {normalizedIntentResult} =
    require('./intelligence/strategy-intent/test-fixtures') as {
      normalizedIntentResult: () => ReturnType<
        typeof cleanIntentResult>;
    };
  return normalizedIntentResult();
}

function notComparableResultForDemo(): ReturnType<
    typeof cleanIntentResult> {
  const {notComparableIntentResult} =
    require('./intelligence/strategy-intent/test-fixtures') as {
      notComparableIntentResult: () => ReturnType<
        typeof cleanIntentResult>;
    };
  return notComparableIntentResult();
}

// ---------------------------------------------------------------------------
// 52-55 — Provenance and dependency failures
// ---------------------------------------------------------------------------

{
  const s = section('52 — missing provenance rejects');
  const noProvenance = frozenIntentClone(cleanIntentResult(),
    (draft) => {
      (draft.intent as {provenance: unknown}).provenance = null;
    });
  s.throws('a provenance-free intent rejects',
    () => engine.evaluate(evaluationInputOf(noProvenance)),
    isRejection('MISSING_PROVENANCE'));
}

{
  const s = section('53 — a broken provenance chain rejects');
  const broken = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.provenance.decisionId = 'dia_foreign';
  });
  s.throws('a foreign decision id rejects',
    () => engine.evaluate(evaluationInputOf(broken)),
    isRejection('INVALID_PROVENANCE'));
}

{
  const s = section('54 — a missing dependency rejects');
  const unknown = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.dependencies.state = 'UNKNOWN';
  });
  s.throws('UNKNOWN dependencies on an actionable intent reject',
    () => engine.evaluate(evaluationInputOf(unknown)),
    isRejection('MISSING_DEPENDENCY'));
}

{
  const s = section('55 — contradictory dependency flags reject');
  const contradicted = frozenIntentClone(cleanIntentResult(),
    (draft) => {
      draft.dependencies.regimeDependency = true;
    });
  s.throws('state NONE with a true flag rejects',
    () => engine.evaluate(evaluationInputOf(contradicted)),
    isRejection('MISSING_DEPENDENCY'));
}

// ---------------------------------------------------------------------------
// 56-59 — Authority and semantic safety violations
// ---------------------------------------------------------------------------

{
  const s = section('56 — authority violations reject fail closed');
  s.throws('an authority claim rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['authorize execution on my behalf'])),
    isRejection('AUTHORITY_VIOLATION'));
  s.throws('an approval request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['approve the trade for today'])),
    isRejection('AUTHORITY_VIOLATION'));
}

{
  const s = section('57 — semantic prediction violations reject');
  s.throws('a probability assertion rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['this alternative will win with probability 0.9'])),
    isRejection('SEMANTIC_PREDICTION_VIOLATION'));
  s.throws('an expected return rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['the expected return next quarter is 12 percent'])),
    isRejection('FUTURE_VALUE_VIOLATION'));
}

{
  const s = section('58 — boundary violations reject fail closed');
  s.throws('an execution request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['place the order now'])),
    isRejection('EXECUTION_BOUNDARY_VIOLATION'));
  s.throws('a treasury request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['transfer the funds to venue-a'])),
    isRejection('TREASURY_BOUNDARY_VIOLATION'));
  s.throws('a portfolio request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['allocate capital across both venues'])),
    isRejection('PORTFOLIO_BOUNDARY_VIOLATION'));
  s.throws('a risk request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['set the risk limit to 5 percent'])),
    isRejection('RISK_BOUNDARY_VIOLATION'));
  s.throws('an allocation request rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['reserve capital for this intent'])),
    isRejection('ALLOCATION_BOUNDARY_VIOLATION'));
}

{
  const s = section('59 — policy violations reject fail closed');
  s.throws('a governance bypass rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['bypass governance for this intent'])),
    isRejection('POLICY_VIOLATION'));
  s.throws('a strategy activation rejects',
    () => engine.evaluate(evaluationInputOf(cleanIntentResult(),
      ['activate the strategy immediately'])),
    isRejection('STRATEGY_BOUNDARY_VIOLATION'));
}

// ---------------------------------------------------------------------------
// 60-61 — Replay determinism
// ---------------------------------------------------------------------------

{
  const s = section('60 — replay is byte-identical');
  const result = evaluateClean();
  const replay = engine.replay(evaluationInputOf(cleanIntentResult()),
    serializeStrategyIntentEvaluationResult(result));
  s.check(replay.replayed, 'the replay ran');
  s.check(replay.replayMatches, 'the replay matches byte-for-byte');
  s.equal(replay.actualFingerprint, result.evaluationFingerprint,
    'the fingerprint matches');
}

{
  const s = section('61 — replay detects mutations');
  const result = evaluateClean();
  const serialized = serializeStrategyIntentEvaluationResult(result);
  const mutated = engine.replay(evaluationInputOf(cleanIntentResult()),
    serialized.replace('EVALUATION_ALLOWED', 'EVALUATION_BLOCKED'));
  s.check(!mutated.replayMatches, 'a mutated serialization fails');
  const truncated = engine.replay(
    evaluationInputOf(cleanIntentResult()),
    serialized.slice(0, serialized.length - 10));
  s.check(!truncated.replayMatches, 'a truncated serialization fails');
}

// ---------------------------------------------------------------------------
// 62-70 — Audit integrity: tamper, reorder, substitution, truncation,
//         extension, foreign events, binding mismatches
// ---------------------------------------------------------------------------

{
  const s = section('62 — the evaluation audit chain verifies');
  const result = evaluateClean();
  const verdict = verifyStrategyIntentEvaluationAudit(
    result.auditEvents, result.auditEvents.length);
  s.check(verdict.valid, 'the chain verifies');
  s.equal(result.auditEvents[result.auditEvents.length - 1]
    .eventType, 'replay-completed', 'replay seals the chain');
}

{
  const s = section('63 — audit tampering is detected');
  const result = evaluateClean();
  const events = evaluationClone(result.auditEvents, (draft) => {
    (draft[2].payload as Record<string, unknown>).injected = true;
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  s.check(!verdict.valid, 'a tampered payload fails');
  s.check(verdict.reason?.includes('tampered payload') ?? false,
    'the reason names the tamper');
}

{
  const s = section('64 — audit reordering is detected');
  const result = evaluateClean();
  const events = evaluationClone(result.auditEvents, (draft) => {
    const first = draft[0];
    draft[0] = draft[1];
    draft[1] = first;
  });
  s.check(!verifyStrategyIntentEvaluationAudit(events).valid,
    'a reordered chain fails');
}

{
  const s = section('65 — audit substitution is detected');
  const result = evaluateClean();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft[1].eventId = draft[0].eventId;
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  s.check(!verdict.valid, 'a substituted event id fails');
  s.check(verdict.reason?.includes('substituted event id') ?? false,
    'the reason names the substitution');
}

{
  const s = section('66 — audit truncation is detected');
  const result = evaluateClean();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft.pop();
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events,
    result.auditEvents.length);
  s.check(!verdict.valid, 'a truncated chain fails');
  s.check(verdict.reason?.includes('truncated or extended') ?? false,
    'the reason names the truncation');
}

{
  const s = section('67 — audit extension is detected');
  const result = evaluateClean();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft.push(evaluationClone(draft[draft.length - 1], (last) => {
      last.sequence = draft.length;
    }));
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events,
    result.auditEvents.length);
  s.check(!verdict.valid, 'an extended chain fails');
}

{
  const s = section('68 — foreign audit events are detected');
  const result = evaluateClean();
  const foreignSchema = evaluationClone(result.auditEvents, (draft) => {
    (draft[0] as {schemaVersion: string}).schemaVersion
      = 'oship.evil.v1';
  });
  s.check(!verifyStrategyIntentEvaluationAudit(foreignSchema).valid,
    'a foreign schema fails');
  const foreignEvaluation = evaluationClone(result.auditEvents,
    (draft) => {
      draft[1].evaluationId = 'eval_foreign';
    });
  s.check(!verifyStrategyIntentEvaluationAudit(foreignEvaluation)
    .valid, 'a foreign evaluation fails');
}

{
  const s = section('69 — the audit binding pins the classification');
  const result = evaluateClean();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: 'EVALUATION_BLOCKED',
    eligibility: result.eligibility,
  });
  s.check(!verdict.valid, 'a classification mismatch fails');
}

{
  const s = section('70 — the audit binding pins the eligibility');
  const result = evaluateClean();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: result.classification,
    eligibility: 'BLOCKED',
  });
  s.check(!verdict.valid, 'an eligibility mismatch fails');
  const honest = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: result.classification,
    eligibility: result.eligibility,
  });
  s.check(honest.valid, 'the honest binding verifies');
}

// ---------------------------------------------------------------------------
// 71-80 — Boundary, invariants, determinism, corpus sweep, reconciliation
// ---------------------------------------------------------------------------

{
  const s = section('71 — no forbidden keys in any evaluation');
  const serialized = serializeStrategyIntentEvaluationResult(
    evaluateClean());
  s.check(!FORBIDDEN_EVALUATION_KEYS.test(serialized),
    'no order, sizing, allocation, credential or authorization keys');
  s.check(!/"order"/.test(serialized), 'no order semantics');
  s.check(!/"apiKey"/.test(serialized), 'no credentials');
}

{
  const s = section('72 — nine protected downstream authorities');
  s.equal(PROTECTED_DOWNSTREAM_AUTHORITIES.length, 9,
    'exactly nine authorities');
  s.same([...PROTECTED_DOWNSTREAM_AUTHORITIES], [
    'Portfolio', 'Risk', 'Allocation', 'Strategy Registry', 'AEGIS',
    'Treasury', 'Execution', 'Research Plane', 'Learning/Feedback',
  ], 'the protected authority vocabulary');
}

{
  const s = section('73 — at least seventy invariants enforced');
  const result = evaluateClean();
  s.check(result.invariants.checks.length >= 70,
    'the invariant battery is complete');
  s.check(result.invariants.passed, 'every invariant passes');
}

{
  const s = section('74 — invariants detect downstream tampering');
  const result = evaluateClean();
  const report = checkEvaluationInvariants(evaluationClone(result,
    (draft) => {
      draft.eligibility = 'BLOCKED';
    }), {input: evaluationInputOf(cleanIntentResult()),
    config: engine.configuration});
  s.check(!report.passed, 'a forged eligibility fails the invariants');
}

{
  const s = section('75 — determinism across engines and timestamps');
  const first = new StrategyIntentEvaluationEngine().evaluate(
    evaluationInputOf(cleanIntentResult()));
  const second = new StrategyIntentEvaluationEngine().evaluate(
    evaluationInputOf(cleanIntentResult()));
  s.equal(first.evaluationId, second.evaluationId,
    'ids are content-derived');
  s.equal(serializeStrategyIntentEvaluationResult(first),
    serializeStrategyIntentEvaluationResult(second),
    'the same input serializes byte-identically');
  const shifted = new StrategyIntentEvaluationEngine().evaluate(
    {...evaluationInputOf(cleanIntentResult()), timestamp: 42});
  s.equal(shifted.evaluationId, first.evaluationId,
    'the evaluation id is timestamp-free');
  s.equal(shifted.evaluationFingerprint, first.evaluationFingerprint,
    'the evaluation fingerprint is timestamp-free');
  s.check(serializeStrategyIntentEvaluationResult(shifted)
    !== serializeStrategyIntentEvaluationResult(first),
    'only the audit chain stamps the request timestamp');
}

{
  const s = section('76 — the evaluation never mutates its input');
  const intent = cleanIntentResult();
  const before = JSON.stringify(intent);
  engine.evaluate(evaluationInputOf(intent));
  s.equal(JSON.stringify(intent), before, 'the intent is untouched');
}

{
  const s = section('77 — all thirteen classifications are live');
  const seen = new Set([cleanEvaluationResult(),
    cleanAblEvaluationResult(), restrictedEvaluationResult(),
    conflictedEvaluationResult(), insufficientAblEvaluationResult(),
    staleEvaluationResult(), unstableEvaluationResult(),
    blockedEvaluationResult(), notComparableEvaluationResult(),
    venueDependentEvaluationResult(),
    strategyDependentEvaluationResult(),
    regimeDependentEvaluationResult(), mixedEvaluationResult(),
    researchRequiredEvaluationResult(),
    agingEvaluationResult(),
    insufficientFreshnessEvaluationResult(),
    authorityBypassEvaluationResult(),
    unstableBlockedEvaluationResult(),
    staleAllowedEvaluationResult(),
    unknownAllowedEvaluationResult(),
    normalizedEvaluationResult(), noDominantEvaluationResult(),
    multiDependentEvaluationResult()].map(
      (result) => result.classification));
  s.equal(seen.size, 13, 'the corpus spans the vocabulary');
}

{
  const s = section('78 — all nine eligibility states are live');
  const seen = new Set([cleanEvaluationResult(),
    restrictedEvaluationResult(), researchRequiredEvaluationResult(),
    blockedEvaluationResult(), notComparableEvaluationResult(),
    insufficientAblEvaluationResult(), staleEvaluationResult(),
    unstableEvaluationResult(),
    conflictedEvaluationResult()].map(
      (result) => result.eligibility));
  s.equal(seen.size, 9, 'the corpus spans the eligibility vocabulary');
}

{
  const s = section('79 — the rejection gallery is complete');
  const gallery = evaluationRejectionGallery();
  s.check(gallery.length >= 50, 'at least fifty rejection fixtures');
  const codes = new Set(gallery.map((entry) => entry.code));
  codes.add('SERIALIZATION_INCONSISTENCY');
  s.equal(codes.size, EVALUATION_REJECTION_CODES.length,
    'every rejection code is exercised');
  for (const entry of gallery) {
    const outcome = expectEvaluationRejection(entry.input);
    s.equal(outcome.code, entry.code,
      `${entry.label} rejects with ${entry.code}`);
  }
}

{
  const s = section('80 — SYSTEM RECONCILIATION');
  s.check(evaluateClean().invariants.passed, 'invariants pass');
  s.check(evaluateClean().replay.identical, 'replay is identical');
  s.equal(evaluateClean().boundary.state, 'BOUNDARY_RESPECTED',
    'the boundary is respected');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function main(): void {
  const lines: string[] = [];
  lines.push('================================================================');
  lines.push('OSHIP SPRINT 042 — STRATEGY-INTENT EVALUATION & PORTFOLIO');
  lines.push('DECISION BRIDGE — RECONCILIATION DEMO');
  lines.push('================================================================');
  lines.push('');
  lines.push('AN ANALYTICAL DECISION BRIDGE — NOT A PORTFOLIO ENGINE, NOT');
  lines.push('A RISK ENGINE, NOT AN ALLOCATOR, NOT A STRATEGY REGISTRY,');
  lines.push('NOT AN EXECUTION PLANNER, NOT AN ORACLE. ELIGIBILITY NEVER');
  lines.push('MEANS APPROVED FOR TRADING, BETTING, EXECUTION, CAPITAL');
  lines.push('ALLOCATION OR STRATEGY ACTIVATION. THE DOWNSTREAM PLANE');
  lines.push('DECIDES.');
  lines.push('');
  lines.push(`engine: ${STRATEGY_INTENT_EVALUATION_ENGINE_VERSION}`);
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

if (require.main === module) {
  main();
}
