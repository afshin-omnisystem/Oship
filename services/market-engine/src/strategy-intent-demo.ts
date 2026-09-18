/**
 * SPRINT 041 — UNIFIED STRATEGY DECISION SYNTHESIS & AEGIS-READY INTENT
 * ENGINE demo.
 *
 * PAPER / SIMULATION ONLY — AN INTENT SYNTHESIS LAYER, NOT A STRATEGY
 * ENGINE, NOT AN EXECUTION ENGINE, NOT A CAPITAL ALLOCATOR, NOT AN ORACLE.
 *
 * Every section drives the REAL strategy-intent engine over the REAL
 * Sprint 040 governance results (AFIS CVA, AFIS liquidity imbalance, ABL
 * surebet, no-dominant, multi/venue-dependent, clean, stale, aging,
 * unknown-freshness, unstable, not-comparable, normalized, blocked runs):
 *
 *   Governed Governance Result + Decision Result → Source Validation →
 *   Intent Context → Governance/Decision Facts → Classification →
 *   Priority → Objective → Alternatives → Ranking → Dependencies →
 *   Restrictions → Research → Evidence → Explanation → Feedback →
 *   Boundary → Audit → Invariants → Replay.
 *
 * The question answered is: "Given a governed Decision Intelligence
 * handoff, what structured strategic intent should the existing Strategy
 * authority receive?" Nothing is mocked. Nothing authorizes trades, bets,
 * capital, risk, policy or execution; the intent is an INPUT to the
 * existing Strategy authority, which decides whether and how to use it.
 * Every PASS line is backed by assertions against actual engine output.
 */

import {StrategyIntentEngine} from './intelligence/strategy-intent/engine';
import {validateIntentEnvelope, scanIntentAnnotations,
  INTENT_DOMAINS} from './intelligence/strategy-intent/source-validation';
import {extractGovernanceFacts} from './intelligence/strategy-intent/governance-input';
import {extractDecisionFacts} from './intelligence/strategy-intent/decision-input';
import {classifyIntent, HANDOFF_TO_INTENT,
  classificationAllowsPreferred} from './intelligence/strategy-intent/classification';
import {assignIntentPriority, INTENT_PRIORITY_OF}
  from './intelligence/strategy-intent/priority';
import {buildIntentObjective, objectiveClassOf}
  from './intelligence/strategy-intent/objective';
import {assessAlternatives} from './intelligence/strategy-intent/alternatives';
import {preserveDependencies, dependencySummaryLines}
  from './intelligence/strategy-intent/dependencies';
import {deriveIntentRestrictions, restrictionCodesOf}
  from './intelligence/strategy-intent/restrictions';
import {deriveResearchRequirements}
  from './intelligence/strategy-intent/research';
import {buildEvidenceBundle} from './intelligence/strategy-intent/evidence';
import {buildIntentExplanation} from './intelligence/strategy-intent/explanation';
import {buildIntentFeedback} from './intelligence/strategy-intent/feedback';
import {serializeStrategyIntentResult, serializeStrategyIntent,
  compareStrategyIntentResults} from './intelligence/strategy-intent/replay';
import {verifyStrategyIntentAudit, StrategyIntentAuditLog,
  intentAuditIdentityOf} from './intelligence/strategy-intent/audit';
import {checkIntentInvariants} from './intelligence/strategy-intent/invariants';
import {checkStrategyBoundary, PROTECTED_INTENT_AUTHORITIES,
  intentNarrativeOf} from './intelligence/strategy-intent/strategy-boundary';
import {canonicalJson} from './intelligence/strategy-intent/ids';
import {DEFAULT_STRATEGY_INTENT_CONFIG, mergeStrategyIntentConfig}
  from './intelligence/strategy-intent/config';
import {INTENT_DISCLAIMER, INTENT_CLASSIFICATIONS,
  INTENT_PRIORITIES, INTENT_OBJECTIVE_CLASSES,
  INTENT_RESTRICTION_CODES, INTENT_DEPENDENCY_STATES,
  INTENT_RESEARCH_CLASSES, INTENT_FEEDBACK_KINDS,
  IntentRejectionError} from './intelligence/strategy-intent/types';
import {
  multiDependentGovernanceResult,
  afisIntentInput, ablIntentInput, liqIntentInput, cleanIntentInput,
  staleIntentInput, staleAllowedIntentInput, agingIntentInput,
  unknownFreshnessIntentInput, unknownAllowedIntentInput,
  unstableIntentInput, unstableBlockedIntentInput,
  notComparableIntentInput, normalizedIntentInput,
  multiDependentIntentInput, venueDependentIntentInput,
  noDominantIntentInput, governanceBlockedIntentInput,
  authorityBypassIntentInput, afisIntentResult, ablIntentResult,
  liqIntentResult, cleanIntentResult, staleIntentResult,
  staleAllowedIntentResult, agingIntentResult,
  unknownFreshnessIntentResult, unknownAllowedIntentResult,
  unstableIntentResult, unstableBlockedIntentResult,
  notComparableIntentResult, normalizedIntentResult,
  multiDependentIntentResult, venueDependentIntentResult,
  noDominantIntentResult, governanceBlockedIntentResult,
  authorityBypassIntentResult, liqGovernanceResult,
  afisGovernanceResult, ablGovernanceResult,
  intentRejectionGallery, intentClone, frozenGovernanceClone,
  governanceInputOf, runGovernance, liqDominantDecisionResult,
  afisDecisionResult, ablDecisionResult, cleanDecisionResult,
  staleDecisionResult, validNormalization, preserveDependenciesOf,
  extractGovernanceFactsOf, INTENT_CORRELATION_ID, INTENT_TRACE_ID,
} from './intelligence/strategy-intent/test-fixtures';

// ---------------------------------------------------------------------------
// Assertion harness (house style)
// ---------------------------------------------------------------------------

class Section {
  readonly failures: string[] = [];
  constructor(readonly name: string) {}
  check(condition: boolean, label: string): void {
    if (!condition) this.failures.push(label);
  }
  equal<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
      this.failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
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
        this.failures.push(`${label} (threw unexpected: ${String((e as Error).message).slice(0, 80)})`);
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

const isCode = (code: string) => (e: unknown): boolean =>
  e instanceof IntentRejectionError && e.code === code;

// ---------------------------------------------------------------------------
// Demo body
// ---------------------------------------------------------------------------

export function main(): void {
  const engine = new StrategyIntentEngine();
  const lines: string[] = [];
  lines.push('================================================================');
  lines.push(' SPRINT 041 — STRATEGY DECISION SYNTHESIS & INTENT ENGINE');
  lines.push('================================================================');
  lines.push('');
  lines.push(' PAPER / SIMULATION ONLY. This layer synthesizes an evidence-');
  lines.push(' bound strategic INTENT from a governed Sprint 040 handoff.');
  lines.push(' It is an input to the existing Strategy authority — never a');
  lines.push(' strategy, never an execution order, never an authorization.');
  lines.push('');

  // -- The corpus --------------------------------------------------------
  const afis = afisIntentResult();
  const abl = ablIntentResult();
  const liq = liqIntentResult();
  const nodom = noDominantIntentResult();
  const multidep = multiDependentIntentResult();
  const venuedep = venueDependentIntentResult();
  const clean = cleanIntentResult();
  const stale = staleIntentResult();
  const staleAllowed = staleAllowedIntentResult();
  const aging = agingIntentResult();
  const unknown = unknownFreshnessIntentResult();
  const unknownAllowed = unknownAllowedIntentResult();
  const unstable = unstableIntentResult();
  const unstableBlocked = unstableBlockedIntentResult();
  const notComparable = notComparableIntentResult();
  const normalized = normalizedIntentResult();
  const govBlocked = governanceBlockedIntentResult();
  const bypass = authorityBypassIntentResult();

  // 01 — engine identity --------------------------------------------------
  let s = section('01 — engine identity and versions');
  s.equal(clean.intent.schemaVersion, 'oship.strategy-intent.v1',
    'schema version');
  s.equal(clean.intent.sourceVersions.intentVersion,
    'oship.strategy-intent.engine.v1', 'engine version');
  s.equal(clean.intent.sourceVersions.governanceVersion,
    'oship.decision-governance.engine.v1', 'governance version');
  s.check(engine.configurationFingerprint.length > 0,
    'configuration fingerprint');

  // 02 — input contract ---------------------------------------------------
  s = section('02 — governed input contract (§1)');
  s.check(Object.isFrozen(liqGovernanceResult()),
    'only frozen governed outputs accepted');
  s.throws('unfrozen governance rejected',
    () => engine.synthesize(intentClone(liqIntentInput())),
    isCode('INVALID_GOVERNANCE_INPUT'));
  s.throws('null input rejected',
    () => engine.synthesize(null as never),
    isCode('INVALID_INTENT_CONTEXT'));

  // 03 — source validation ------------------------------------------------
  s = section('03 — source validation is fail closed');
  s.throws('mismatched pair rejected',
    () => engine.synthesize({...afisIntentInput(),
      governanceResult: liqGovernanceResult()}),
    isCode('INVALID_PROVENANCE'));
  s.throws('missing governance id rejected',
    () => engine.synthesize({...afisIntentInput(),
      governanceResult: frozenGovernanceClone(afisGovernanceResult(),
        (draft) => {
          draft.governanceId = '';
        })}),
    isCode('MISSING_GOVERNANCE_ID'));
  s.throws('missing decision id rejected',
    () => engine.synthesize({...afisIntentInput(),
      decisionResult: intentClone(afisDecisionResult(), (draft) => {
        draft.analysisId = '';
      })}),
    isCode('MISSING_DECISION_ID'));

  // 04 — annotation safety scan -------------------------------------------
  s = section('04 — annotation semantic safety scan');
  s.throws('probability annotation rejected', () =>
    scanIntentAnnotations(['probability of profit is 0.9']),
    isCode('PREDICTIVE_SEMANTICS'));
  s.throws('execution annotation rejected', () =>
    scanIntentAnnotations(['place the order now']),
    isCode('EXECUTION_SEMANTICS'));
  s.throws('treasury annotation rejected', () =>
    scanIntentAnnotations(['transfer the funds']),
    isCode('TREASURY_SEMANTICS'));
  s.throws('aegis annotation rejected', () =>
    scanIntentAnnotations(['aegis approval required']),
    isCode('AEGIS_SEMANTICS'));
  s.throws('credential annotation rejected', () =>
    scanIntentAnnotations(['use my apiKey']),
    isCode('UNSAFE_SEMANTICS'));

  // 05 — intent context ----------------------------------------------------
  s = section('05 — intent context mirrors the governed identity');
  s.equal(liq.context.decisionId,
    liqDominantDecisionResult().analysisId, 'decision id');
  s.equal(liq.context.governanceId,
    liqGovernanceResult().governanceId, 'governance id');
  s.equal(liq.context.opportunityId, 'dec-afis-liq-base',
    'opportunity id');
  s.equal(liq.context.governanceClassification,
    'HANDOFF_ALLOWED_WITH_LIMITATIONS', 'governance classification');
  s.check(Object.isFrozen(liq.context), 'context frozen');

  // 06 — governed statuses mirrored ---------------------------------------
  s = section('06 — governed statuses are mirrored, never re-derived');
  s.equal(liq.context.stabilityState, 'MODERATELY_STABLE', 'stability');
  s.equal(stale.context.freshnessState, 'STALE', 'stale freshness');
  s.equal(aging.context.freshnessState, 'AGING', 'aging freshness');
  s.equal(unknown.context.freshnessState, 'UNKNOWN', 'unknown freshness');
  s.equal(notComparable.context.comparability, 'NOT_COMPARABLE',
    'not comparable');
  s.equal(normalized.context.comparability,
    'COMPARABLE_VIA_NORMALIZATION', 'normalized');

  // 07 — classification enumeration ---------------------------------------
  s = section('07 — eight classification states (§4)');
  s.equal(INTENT_CLASSIFICATIONS.length, 8, 'eight states');
  s.equal(new Set(Object.values(HANDOFF_TO_INTENT)).size, 8,
    '1:1 handoff mapping');

  // 08 — classification corpus --------------------------------------------
  s = section('08 — classification mirrors governance exactly');
  s.equal(liq.classification, 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    'liq');
  s.equal(clean.classification, 'STRATEGIC_INTENT_READY', 'clean');
  s.equal(afis.classification, 'STRATEGIC_INTENT_CONFLICTED', 'afis');
  s.equal(abl.classification, 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
    'abl');
  s.equal(stale.classification, 'STRATEGIC_INTENT_STALE', 'stale');
  s.equal(venuedep.classification, 'STRATEGIC_INTENT_RESEARCH_REQUIRED',
    'venue-dependent');
  s.equal(unstableBlocked.classification, 'STRATEGIC_INTENT_BLOCKED',
    'unstable-blocked');
  s.equal(notComparable.classification,
    'STRATEGIC_INTENT_NOT_COMPARABLE', 'not-comparable');

  // 09 — no silent fallback ------------------------------------------------
  s = section('09 — no silent fallback: blocked stays blocked');
  s.equal(govBlocked.classification, 'STRATEGIC_INTENT_BLOCKED',
    'governance-blocked');
  s.equal(bypass.classification, 'STRATEGIC_INTENT_BLOCKED',
    'authority-bypass');
  s.equal(govBlocked.preferredAlternativeId, null, 'no preferred');
  s.same(govBlocked.acceptableAlternativeIds, [], 'no acceptable set');

  // 10 — priority enumeration ---------------------------------------------
  s = section('10 — six priority levels (§16)');
  s.equal(INTENT_PRIORITIES.length, 6, 'six levels');
  s.equal(new Set(Object.values(INTENT_PRIORITY_OF)).size, 6,
    'every classification mapped');

  // 11 — priority corpus ---------------------------------------------------
  s = section('11 — priority is deterministic, not urgency');
  s.equal(clean.priority, 'NORMAL_STRATEGY_INPUT', 'ready');
  s.equal(liq.priority, 'LIMITED_STRATEGY_INPUT', 'limited');
  s.equal(venuedep.priority, 'HIGH_RESEARCH_PRIORITY', 'research');
  s.equal(stale.priority, 'RESEARCH_ONLY', 'stale');
  s.equal(abl.priority, 'RESEARCH_ONLY', 'insufficient');
  s.equal(afis.priority, 'CRITICAL_GOVERNANCE_REVIEW', 'conflicted');
  s.equal(unstableBlocked.priority, 'BLOCKED', 'blocked');

  // 12 — priority disclaims execution urgency ------------------------------
  s = section('12 — priority never implies profitability');
  for (const reason of liq.priorityReasons) {
    const hit = /profitab|expected return|roi/i.exec(reason);
    if (hit !== null) {
      s.check(/never|not|no\b/.test(reason.slice(0, hit.index)),
        `negated clause: ${reason}`);
    }
  }

  // 13 — objective enumeration ---------------------------------------------
  s = section('13 — six analytical objective classes (§3)');
  s.equal(INTENT_OBJECTIVE_CLASSES.length, 6, 'six classes');

  // 14 — objective corpus ---------------------------------------------------
  s = section('14 — objective follows classification and stability');
  s.equal(clean.objective.objectiveClass,
    'PRESERVE_EVIDENCE_SUPPORTED_EDGE', 'clean');
  s.equal(liq.objective.objectiveClass, 'PREFER_STABLE_ALTERNATIVE',
    'liq stability-limited');
  s.equal(afis.objective.objectiveClass, 'MINIMIZE_EVIDENCE_CONFLICT',
    'afis');
  s.equal(abl.objective.objectiveClass, 'REQUIRE_MORE_RESEARCH', 'abl');
  s.equal(unstableBlocked.objective.objectiveClass,
    'NO_ACTIONABLE_INTENT', 'blocked');

  // 15 — objectives stay analytical ----------------------------------------
  s = section('15 — objectives are analytical, never expected-return');
  for (const objectiveClass of INTENT_OBJECTIVE_CLASSES) {
    s.check(!/expected return|roi|probability/i.test(objectiveClass),
      `${objectiveClass} is analytical`);
  }
  s.check(liq.objective.informational, 'objective is informational');

  // 16 — alternative set ----------------------------------------------------
  s = section('16 — alternatives preserve canonical identity (§7)');
  s.equal(liq.alternatives.length, 2, 'liq alternatives');
  s.equal(liq.preferredAlternativeId, 'alt-venue-a', 'preferred');
  s.equal(liq.alternatives[0].role, 'PREFERRED', 'preferred role');
  s.equal(liq.alternatives[1].role, 'SECONDARY', 'secondary role');
  for (const alternative of liq.alternatives) {
    s.check(alternative.alternativeId.length > 0, 'canonical id');
    s.check(alternative.assessmentId.startsWith('salt_'),
      'assessment id');
    s.check(Object.isFrozen(alternative), 'alternative frozen');
  }

  // 17 — AFIS semantics ------------------------------------------------------
  s = section('17 — AFIS alternatives carry BUY/SELL only (§8)');
  for (const alternative of afis.alternatives) {
    s.equal(alternative.marketId, null, 'no market id on AFIS');
    s.equal(alternative.selectionId, null, 'no selection id on AFIS');
    for (const leg of alternative.semanticIdentity) {
      s.check(leg.side === 'BUY' || leg.side === 'SELL',
        `AFIS side ${String(leg.side)}`);
      s.equal(leg.odds, null, 'no odds on AFIS');
    }
  }

  // 18 — ABL semantics --------------------------------------------------------
  s = section('18 — ABL alternatives carry BACK/LAY + odds (§9)');
  for (const alternative of abl.alternatives) {
    s.equal(alternative.marketId, 'mkt-derby-winner', 'market id');
    s.check(alternative.selectionId !== null, 'selection id');
    for (const leg of alternative.semanticIdentity) {
      s.check(leg.side === 'BACK' || leg.side === 'LAY',
        `ABL side ${String(leg.side)}`);
      s.check(leg.odds !== null && leg.odds > 1, 'decimal odds');
    }
  }

  // 19 — never collapsed -------------------------------------------------------
  s = section('19 — BUY never becomes BACK, BACK never becomes BUY');
  const afisSides = afis.alternatives.flatMap((a) =>
    a.semanticIdentity.map((leg) => leg.side));
  const ablSides = abl.alternatives.flatMap((a) =>
    a.semanticIdentity.map((leg) => leg.side));
  s.check(!afisSides.includes('BACK') && !afisSides.includes('LAY'),
    'AFIS sides clean');
  s.check(!ablSides.includes('BUY') && !ablSides.includes('SELL'),
    'ABL sides clean');

  // 20 — unsupported alternatives ------------------------------------------------
  s = section('20 — thin-cohort alternatives stay unsupported');
  for (const alternative of abl.alternatives) {
    s.equal(alternative.role, 'UNSUPPORTED', 'role');
    s.equal(alternative.evidenceState, 'INSUFFICIENT', 'evidence');
    s.check(alternative.rejectionReasons.length > 0, 'explicit reasons');
  }

  // 21 — blocked families surface nothing ------------------------------------------
  s = section('21 — blocked families surface no acceptable set');
  for (const result of [afis, abl, stale, unknown, unstableBlocked,
    notComparable, multidep, venuedep, govBlocked, bypass]) {
    s.equal(result.preferredAlternativeId, null,
      `${result.classification} preferred`);
    s.same(result.acceptableAlternativeIds, [],
      `${result.classification} acceptable`);
  }

  // 22 — no-dominant secondaries ------------------------------------------------
  s = section('22 — no-dominant corpus preserves secondaries');
  s.equal(nodom.preferredAlternativeId, null, 'no preferred');
  s.check(nodom.acceptableAlternativeIds.length > 0,
    'secondaries preserved');
  for (const id of nodom.acceptableAlternativeIds) {
    const alternative = nodom.alternatives.find(
      (a) => a.alternativeId === id);
    s.check(alternative !== undefined
      && alternative.role === 'SECONDARY', `secondary ${id}`);
  }

  // 23 — ranking determinism ------------------------------------------------------
  s = section('23 — ranking is deterministic (role, rank, id)');
  s.same(rankOf(liq), ['alt-venue-a', 'baseline-dec-afis-liq-base'],
    'liq acceptable order');
  const twice = new StrategyIntentEngine().synthesize(liqIntentInput());
  s.same(twice.acceptableAlternativeIds,
    liq.acceptableAlternativeIds, 'repeat run identical');

  // 24 — dependency enumeration -----------------------------------------------------
  s = section('24 — six dependency states (§6)');
  s.equal(INTENT_DEPENDENCY_STATES.length, 6, 'six states');
  s.equal(liq.dependencies.state, 'NONE', 'independent → NONE');

  // 25 — dependencies preserved -------------------------------------------------------
  s = section('25 — dependencies are preserved, never removed');
  s.equal(venuedep.dependencies.state, 'MULTI_DEPENDENT', 'multi');
  s.equal(venuedep.dependencies.venueDependency, true, 'venue flag');
  s.equal(multidep.dependencies.state, 'MULTI_DEPENDENT', 'multidep');
  s.equal(nodom.dependencies.state, 'STRATEGY_DEPENDENT', 'strategy');
  s.check(dependencySummaryLines(afis.dependencies).some((line) =>
    line.includes('never removed')), 'summary states preservation');

  // 26 — dependency contradictions fail closed ------------------------------------------
  s = section('26 — dependency contradictions fail closed');
  s.throws('NONE with true flags rejected', () => engine.synthesize(
    {...multiDependentIntentInput(), governanceResult:
      frozenGovernanceClone(multiDependentGovernanceResult(),
        (draft) => {
          (draft.dependencyGate as {state: string}).state = 'NONE';
        })}),
  isCode('INVALID_DEPENDENCY'));

  // 27 — restriction enumeration ------------------------------------------------------------
  s = section('27 — restriction vocabulary (§5)');
  s.check(INTENT_RESTRICTION_CODES.length >= 12,
    'twelve canonical restrictions');
  for (const required of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED',
    'REGIME_LIMITED', 'STRATEGY_LIMITED', 'VENUE_LIMITED',
    'STALE_EVIDENCE_WARNING', 'INSUFFICIENT_SAMPLE_WARNING',
    'CONFLICT_WARNING', 'NOT_COMPARABLE']) {
    s.check((INTENT_RESTRICTION_CODES as readonly string[])
      .includes(required), `${required} present`);
  }

  // 28 — baseline restrictions --------------------------------------------------------------
  s = section('28 — every intent carries the informational baseline');
  for (const result of [afis, abl, liq, clean, unstableBlocked]) {
    const codes = restrictionCodesOf(result.restrictions);
    for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
      'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION']) {
      s.check(codes.includes(baseline as never),
        `${baseline} on ${result.classification}`);
    }
  }

  // 29 — governance restrictions mapped --------------------------------------------------------
  s = section('29 — governance restrictions map one to one');
  s.check(restrictionCodesOf(liq.restrictions)
    .includes('LEAKAGE_WARNING' as never), 'leakage warning');
  s.check(restrictionCodesOf(liq.restrictions)
    .includes('STABILITY_WARNING' as never), 'stability warning');
  s.check(restrictionCodesOf(liq.restrictions)
    .includes('LIMITED_TO_DOMAIN' as never), 'domain limit');
  s.check(restrictionCodesOf(venuedep.restrictions)
    .includes('VENUE_LIMITED' as never), 'venue limit');

  // 30 — restriction serialization survives replay -----------------------------------------------
  s = section('30 — restrictions survive serialization and replay');
  const rehydrated = JSON.parse(
    JSON.stringify(liq.restrictions)) as typeof liq.restrictions;
  s.same(rehydrated.map((r) => r.code),
    restrictionCodesOf(liq.restrictions), 'codes survive');

  // 31 — research enumeration -----------------------------------------------------------------------
  s = section('31 — research escalation classes (§14)');
  s.equal(INTENT_RESEARCH_CLASSES.length, 8, 'eight classes');

  // 32 — research corpus ------------------------------------------------------------------------------
  s = section('32 — research escalations flow to the Research Plane');
  s.same(liq.research.requirements.map((r) => r.researchClass),
    ['LEAKAGE_RESEARCH', 'STABILITY_RESEARCH'], 'liq research');
  s.check(stale.research.requirements.some((r) =>
    r.researchClass === 'EVIDENCE_REFRESH'), 'stale refresh');
  s.check(notComparable.research.requirements.some((r) =>
    r.researchClass === 'COMPARABILITY_RESEARCH'), 'comparability');
  s.check(abl.research.requirements.some((r) =>
    r.researchClass === 'ALTERNATIVE_RESEARCH'), 'alternative');
  s.equal(clean.research.requirements.length, 0, 'clean escalates none');

  // 33 — research provenance -----------------------------------------------------------------------------
  s = section('33 — research provenance is explicit');
  s.equal(liq.research.requirements[0].provenance,
    'GOVERNANCE_ESCALATION', 'governance provenance');
  s.equal(liq.research.requirements[1].provenance,
    'INTENT_DERIVED', 'intent-derived provenance');
  s.check(liq.research.requirements[0].sourceEscalationId !== null,
    'source escalation id');

  // 34 — evidence bundle -----------------------------------------------------------------------------------
  s = section('34 — evidence-backed rationale (§2)');
  s.check(liq.intent.rationale.some((line) =>
    line.includes('alt-venue-a')), 'preferred named');
  s.check(liq.intent.rationale.some((line) =>
    line.startsWith('governance reason:')), 'governance reasons quoted');
  s.check(liq.intent.historicalSupport.some((line) =>
    line.includes('never a future claim')), 'historical support bounded');

  // 35 — semantic limitations --------------------------------------------------------------------------------
  s = section('35 — semantic limitations are explicit');
  s.check(liq.intent.semanticLimitations.some((line) =>
    line.includes('evidence-bound and associational')), 'boundary line');
  s.check(normalized.intent.semanticLimitations.some((line) =>
    line.includes('normalization')), 'normalization loss declared');

  // 36 — the disclaimer -----------------------------------------------------------------------------------------
  s = section('36 — the disclaimer is verbatim (§11)');
  s.equal(liq.intent.disclaimer, INTENT_DISCLAIMER, 'verbatim');
  s.equal(INTENT_DISCLAIMER,
    'This is an evidence-bound strategic intent, not a probability, '
    + 'forecast, expected return, guarantee, or execution instruction.',
  'canonical text');

  // 37 — no predictive semantics -----------------------------------------------------------------------------------
  s = section('37 — no probability, forecast or expected return');
  const serialized = serializeStrategyIntentResult(liq);
  s.check(!/"(probability|forecast|expectedReturn|expectedProfit|roi)":/
    .test(serialized), 'no fabricated keys');
  s.check(serializeStrategyIntentResult(clean)
    .includes('not a probability'), 'disclaimer present');

  // 38 — no execution leakage (§12) -----------------------------------------------------------------------------------
  s = section('38 — no execution leakage');
  s.check(!/"(orderQuantity|orderPrice|limitPrice|qty|size|instruction|command|apiRequest)":/
    .test(serialized), 'no order or command keys');
  s.check(!/"(apiKey|secret|password|privateKey|token|credential)":/
    .test(serialized), 'no credentials');
  s.check(!/"(transfer|withdrawal|allocation|capitalCommit)":/
    .test(serialized), 'no treasury actions');
  s.check(!/"(authorization|approval|approved)":/.test(serialized),
    'no AEGIS authorization');

  // 39 — strategy boundary (§13) ---------------------------------------------------------------------------------------
  s = section('39 — Strategy decides, the intent is an input');
  s.equal(liq.intent.strategyDecides, true, 'strategy decides');
  s.equal(liq.intent.informational, true, 'informational');
  s.equal(liq.boundary.state, 'BOUNDARY_RESPECTED', 'boundary respected');
  s.same(liq.boundary.checks.map((c) => c.check),
    ['no-order-or-command-keys', 'no-execution-verbs',
      'intent-informational', 'strategy-decides'], 'four checks');

  // 40 — protected authorities (§24) --------------------------------------------------------------------------------------
  s = section('40 — protected authorities are enumerated');
  for (const authority of PROTECTED_INTENT_AUTHORITIES) {
    s.check(liq.boundary.protectedAuthorities.includes(authority),
      `${authority} protected`);
  }
  s.check(intentNarrativeOf(liq.intent).length > 10,
    'narrative fields collected');

  // 41 — explanation (§17) ---------------------------------------------------------------------------------------------------
  s = section('41 — deterministic explanation');
  s.equal(liq.explanation.sourceDecisionId,
    liq.context.decisionId, 'decision id pinned');
  s.equal(liq.explanation.sourceGovernanceId,
    liq.context.governanceId, 'governance id pinned');
  s.check(liq.explanation.supportingEvidence.length > 0,
    'supporting evidence');
  s.check(afis.explanation.conflictingEvidence.length > 0,
    'conflicting evidence on conflicts');
  s.check(liq.explanation.restrictionSummary.some((line) =>
    line.startsWith('ANALYTICAL_ONLY:')), 'restrictions summarized');
  s.check(liq.explanation.researchSummary.some((line) =>
    line.startsWith('LEAKAGE_RESEARCH:')), 'research summarized');

  // 42 — feedback (§15) --------------------------------------------------------------------------------------------------------
  s = section('42 — feedback to existing Learning (§15)');
  s.equal(INTENT_FEEDBACK_KINDS.length, 8, 'eight kinds');
  s.check(clean.feedback.some((f) => f.kind === 'INTENT_ACCEPTED'),
    'accepted');
  s.check(liq.feedback.some((f) => f.kind === 'INTENT_RESTRICTED'),
    'restricted');
  s.check(afis.feedback.some((f) => f.kind === 'INTENT_BLOCKED'),
    'blocked');
  s.check(abl.feedback.some((f) => f.kind === 'EVIDENCE_GAP_FEEDBACK'),
    'evidence gap');
  s.check(afis.feedback.some(
    (f) => f.kind === 'DEPENDENCY_DETECTED_FEEDBACK'), 'dependency');
  s.check(liq.feedback.some(
    (f) => f.kind === 'RESEARCH_ESCALATION_FEEDBACK'), 'research');
  s.check(afis.feedback.some(
    (f) => f.kind === 'ALTERNATIVE_REJECTED_FEEDBACK'), 'rejected alt');
  s.check(liq.feedback.some(
    (f) => f.kind === 'ALTERNATIVE_PRESERVED_FEEDBACK'), 'preserved alt');

  // 43 — provenance (§18) ---------------------------------------------------------------------------------------------------------
  s = section('43 — provenance chain has no orphans');
  const provenance = liq.intent.provenance;
  s.check(provenance.provenanceId.startsWith('sprv_'), 'provenance id');
  s.equal(provenance.governanceId, liqGovernanceResult().governanceId,
    'governance id');
  s.equal(provenance.decisionId,
    liqDominantDecisionResult().analysisId, 'decision id');
  s.equal(provenance.handoffId,
    liqGovernanceResult().handoffPackage.handoffId, 'handoff id');
  s.equal(provenance.strategyInputId,
    liqGovernanceResult().strategyInput.strategyInputId,
    'strategy-input id');
  s.equal(provenance.intentId, liq.intentId, 'intent id');

  // 44 — source versions ------------------------------------------------------------------------------------------------------------
  s = section('44 — source versions pin every upstream engine');
  s.equal(provenance.sourceVersions.decisionIntelligenceVersion,
    'oship.decision-intelligence.engine.v1', 'decision engine');
  s.equal(provenance.sourceVersions.governanceVersion,
    'oship.decision-governance.engine.v1', 'governance engine');
  s.equal(provenance.sourceVersions.governancePolicyVersion,
    'decision-governance.policy.v1', 'governance policy');
  s.equal(provenance.sourceVersions.intentVersion,
    'oship.strategy-intent.engine.v1', 'intent engine');

  // 45 — deterministic ids (§19) ------------------------------------------------------------------------------------------------------
  s = section('45 — ids are content-derived (§19)');
  s.check(liq.intentId.startsWith('sint_'), 'prefix');
  s.equal(new StrategyIntentEngine().synthesize(liqIntentInput())
    .intentId, liq.intentId, 'stable across engines');
  const shifted = {...liqIntentInput(), timestamp: 999999999};
  s.equal(engine.synthesize(shifted).intentId, liq.intentId,
    'timestamp-independent');
  s.equal(engine.synthesize({...liqIntentInput(),
    correlationId: 'other', traceId: 'other'}).intentId,
  liq.intentId, 'correlation-independent');

  // 46 — canonical serialization (§20) --------------------------------------------------------------------------------------------------
  s = section('46 — canonical serialization (§20)');
  const first = serializeStrategyIntentResult(liq);
  s.equal(serializeStrategyIntentResult(liq), first, 'byte-identical');
  const parsed = JSON.parse(first) as Record<string, unknown>;
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).reverse()) {
    permuted[key] = parsed[key];
  }
  s.equal(serializeStrategyIntentResult(permuted as never), first,
    'key-order independent');

  // 47 — replay (§21) ----------------------------------------------------------------------------------------------------------------------
  s = section('47 — replay is byte-identical (§21)');
  s.equal(liq.replay.identical, true, 'double-run identical');
  const replay = engine.replay(liqIntentInput(), first);
  s.equal(replay.replayed, true, 'replay executed');
  s.equal(replay.replayMatches, true, 'replay matches');
  const tampered = JSON.stringify({...parsed,
    intentFingerprint: 'sfp2_tampered'});
  s.equal(engine.replay(liqIntentInput(), tampered).replayMatches,
    false, 'tampered payload detected');

  // 48 — audit schema (§22) -------------------------------------------------------------------------------------------------------------------
  s = section('48 — audit schema oship.strategy-intent.v1 (§22)');
  for (const event of liq.auditEvents) {
    s.equal(event.schemaVersion, 'oship.strategy-intent.v1',
      'schema on every event');
    s.check(event.eventId.startsWith('sea_'), 'event id');
  }
  s.equal(liq.auditEvents[liq.auditEvents.length - 1].eventType,
    'replay-completed', 'replay last');

  // 49 — audit chain verification ----------------------------------------------------------------------------------------------------------------
  s = section('49 — audit chain verifies and detects tampering');
  const verification = verifyStrategyIntentAudit(liq.auditEvents);
  s.equal(verification.valid, true, 'clean chain valid');
  s.equal(verifyStrategyIntentAudit(liq.auditEvents.slice(0, 5),
    liq.auditEvents.length).valid, false, 'truncation detected');
  const tamperedEvents = [...liq.auditEvents];
  tamperedEvents[3] = {...tamperedEvents[3],
    payload: {...tamperedEvents[3].payload, evil: true}};
  s.equal(verifyStrategyIntentAudit(tamperedEvents).valid, false,
    'payload substitution detected');

  // 50 — audit identity binds the chain --------------------------------------------------------------------------------------------------------------
  s = section('50 — audit identity binds the anchored prefix');
  const {eventCount, headHash} = liq.intent.auditIdentity;
  s.check(eventCount <= liq.auditEvents.length, 'count within chain');
  s.equal(headHash, liq.auditEvents[eventCount - 1].hash, 'head bound');
  s.equal(intentAuditIdentityOf(liq.intentId, eventCount, headHash)
    .schemaVersion, 'oship.strategy-intent.v1', 'identity schema');

  // 51 — invariants (§25) -----------------------------------------------------------------------------------------------
  s = section('51 — invariant battery (§25)');
  s.equal(liq.invariants.checks.length, 93, '93 checks');
  s.equal(liq.invariants.passed, true, 'all pass');
  for (const result of [afis, abl, clean, stale, notComparable,
    normalized, govBlocked, bypass]) {
    s.equal(result.invariants.passed, true,
      `${result.classification} invariants`);
  }

  // 52 — immutability -----------------------------------------------------------------------------------------------------
  s = section('52 — outputs are deeply frozen');
  for (const result of [liq, afis, clean]) {
    s.check(Object.isFrozen(result), 'result frozen');
    s.check(Object.isFrozen(result.intent), 'intent frozen');
    s.check(Object.isFrozen(result.alternatives), 'alternatives frozen');
    s.check(Object.isFrozen(result.restrictions), 'restrictions frozen');
  }

  // 53 — configuration ------------------------------------------------------------------------------------------------------
  s = section('53 — configuration is validated and frozen');
  s.check(Object.isFrozen(DEFAULT_STRATEGY_INTENT_CONFIG), 'defaults');
  s.equal(mergeStrategyIntentConfig({maxAnnotations: 8})
    .maxAnnotations, 8, 'merge overrides');
  s.throws('invalid config rejected',
    () => new StrategyIntentEngine({maxAnnotations: 0}));

  // 54 — cross-domain isolation (§10) ------------------------------------------------------------------------------------------
  s = section('54 — raw AFIS↔ABL stays NOT_COMPARABLE (§10)');
  s.equal(notComparable.classification,
    'STRATEGIC_INTENT_NOT_COMPARABLE', 'classification');
  s.equal(notComparable.context.comparability, 'NOT_COMPARABLE',
    'comparability');
  s.check(notComparable.restrictions.some((r) =>
    r.code === 'NOT_COMPARABLE'), 'restriction');
  s.check(notComparable.research.requirements.some((r) =>
    r.researchClass === 'COMPARABILITY_RESEARCH'), 'research');

  // 55 — normalization is explicit or absent ---------------------------------------------------------------------------------------
  s = section('55 — normalization is explicit, versioned, governed');
  s.equal(normalized.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS', 'normalized ready');
  s.check(normalized.restrictions.some((r) =>
    r.code === 'NORMALIZED_COMPARISON_ONLY'), 'restriction');
  s.check(normalized.intent.semanticLimitations.some((line) =>
    line.includes('semantic loss')), 'loss declared');
  s.throws('inconsistent declaration rejected', () => engine.synthesize(
    intentClone(normalizedIntentInput(), (draft) => {
      draft.governanceResult = frozenGovernanceClone(
        draft.governanceResult, (g) => {
          (g.handoffPackage as {comparabilityStatus: string})
            .comparabilityStatus = 'COMPARABLE';
        }) as never;
    })),
  isCode('NOT_COMPARABLE'));

  // 56 — classification/evidence consistency -----------------------------------------------------------------------------------------
  s = section('56 — classifications must match their evidence');
  s.throws('allowed-with-conflict rejected', () => engine.synthesize(
    {...afisIntentInput(), governanceResult: frozenGovernanceClone(
      afisGovernanceResult(), (draft) => {
        (draft as {classification: string}).classification
          = 'HANDOFF_ALLOWED';
      })}),
  isCode('CONFLICTED_EVIDENCE'));
  s.throws('insufficient-without-basis rejected', () => engine.synthesize(
    {...ablIntentInput(), governanceResult: frozenGovernanceClone(
      ablGovernanceResult(), (draft) => {
        (draft.context as {evidenceState: string}).evidenceState
          = 'WEAK';
      })}),
  isCode('INSUFFICIENT_EVIDENCE'));

  // 57 — the fail-closed gallery (§23) ---------------------------------------------------------------------------------------------------
  s = section('57 — the rejection gallery (§23)');
  const gallery = intentRejectionGallery();
  const galleryInputs = gallery.map((entry) => ({
    input: entry.input as Parameters<typeof engine.synthesize>[0],
    code: entry.code}));
  s.check(gallery.length >= 50, '50+ scenarios');
  let galleryOk = 0;
  for (const entry of galleryInputs) {
    try {
      engine.synthesize(entry.input);
    } catch (e) {
      if (e instanceof IntentRejectionError && e.code === entry.code) {
        galleryOk++;
      }
    }
  }
  s.equal(galleryOk, gallery.length, 'every entry rejects exactly');
  s.check(new Set(gallery.map((e) => e.code)).size >= 24,
    '24+ distinct codes');

  // 58 — quoted speech is inert ------------------------------------------------------------------------------------------------------------
  s = section('58 — quoted requester speech is inert');
  s.equal(govBlocked.classification, 'STRATEGIC_INTENT_BLOCKED',
    'blocked, not confused');
  for (const reason of govBlocked.classificationReasons) {
    s.check(!/probability of profit/
      .test(reason.replace(/"[^"]*"/g, ' ')),
    'quoted span stripped');
  }

  // 59 — corpus classification coverage ------------------------------------------------------------------------------------------------------
  s = section('59 — the corpus covers all eight states');
  const states = new Set([afis, abl, liq, nodom, multidep, venuedep,
    clean, stale, staleAllowed, aging, unknown, unknownAllowed,
    unstable, unstableBlocked, notComparable, normalized, govBlocked,
    bypass].map((result) => result.classification));
  s.equal(states.size, 8, 'eight states');
  const priorities = new Set([afis, liq, clean, venuedep, stale, abl,
    unstableBlocked].map((result) => result.priority));
  s.equal(priorities.size, 6, 'six priorities');
  const objectives = new Set([afis, abl, liq, clean, stale, govBlocked,
    normalized].map((result) => result.objective.objectiveClass));
  s.equal(objectives.size, 6, 'six objective classes');

  // 60 — reconciliation ------------------------------------------------------------------------------------------------------------------------
  s = section('60 — intent ids distinguish governed content');
  s.check(new Set([liq.intentId, clean.intentId, stale.intentId,
    abl.intentId, afis.intentId]).size === 5, 'corpus ids distinct');
  s.check(liq.intentId !== unstable.intentId,
    'stability state differentiates');

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  lines.push(` Intent runs: LIQ (${liq.classification}), AFIS `
    + `(${afis.classification}), ABL (${abl.classification}), `
    + `no-dominant (${nodom.classification}), venue-dependent `
    + `(${venuedep.classification}), clean (${clean.classification}), `
    + `plus stale, aging, unknown-freshness, unstable, not-comparable, `
    + `normalized, governance-blocked and authority-bypass runs.`);
  lines.push(` Invariant checks per run: ${liq.invariants.checks.length}. `
    + `Audit events per run: ${liq.auditEvents.length}. Rejection `
    + `gallery: ${String(gallery.length)} scenarios, `
    + `${String(new Set(gallery.map((e) => e.code)).size)} codes.`);
  lines.push('');
  lines.push(' The strategy intent is NOT a probability, forecast, expected');
  lines.push(' return, guarantee or execution instruction. Blocked and');
  lines.push(' conflicted handoffs are never silently upgraded; AFIS and');
  lines.push(' ABL semantics are preserved verbatim; normalization is');
  lines.push(' explicit or absent; the audit chain is append-only and');
  lines.push(' tamper-evident; replay is byte-identical; the existing');
  lines.push(' Strategy authority decides, and AEGIS, Treasury and');
  lines.push(' Execution remain untouched.');
  lines.push('');
  lines.push(` SPRINT 041 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  if (failed.length === 0) {
    lines.push('');
    lines.push(` All ${sections.length} sections passed. Every intent is`);
    lines.push(' informational and evidence-bound; rejections are');
    lines.push(' explicit and fail closed; restrictions, dependencies and');
    lines.push(' research requirements survive serialization and replay;');
    lines.push(' the Research Plane and Learning receive structured');
    lines.push(' escalations and feedback without any new authority.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 041: COMPLETE');
  } else {
    lines.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const x of failed) {
      lines.push(`   [${x.name}]`);
      for (const failure of x.failures.slice(0, 6)) {
        lines.push(`     - ${failure}`);
      }
    }
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILIATION FAILED');
  }
  lines.push('');
  lines.push('================================================================');
  console.log(lines.join('\n'));

  function rankOf(result: typeof liq): readonly string[] {
    return result.acceptableAlternativeIds;
  }
}

if (require.main === module) {
  main();
}
