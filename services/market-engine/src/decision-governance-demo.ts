/**
 * SPRINT 040 — UNIFIED DECISION GOVERNANCE & STRATEGY HANDOFF ENGINE demo.
 *
 * PAPER / SIMULATION ONLY — A GOVERNANCE AND HANDOFF LAYER, NOT A STRATEGY
 * ENGINE, NOT AN EXECUTION ENGINE, NOT A CAPITAL ALLOCATOR, NOT AN ORACLE.
 *
 * Every section drives the REAL governance engine over the REAL Sprint 039
 * decision-intelligence results (AFIS CVA, AFIS liquidity imbalance, ABL
 * surebet, ABL thin cohorts, plus venue-dependent / dominant / no-dominant
 * runs):
 *
 *   Decision Result → Governance Context → Policy Validation → Evidence
 *   Gate → Safety Gate → Comparability Gate → Freshness Gate → Stability
 *   Gate → Dependency Gate → Handoff Classification → Strategy Handoff
 *   Package → Research / Feedback.
 *
 * The question answered is: "Is this decision result sufficiently valid,
 * comparable, fresh, stable and policy-compliant to hand to Strategy, and
 * what information and limitations must accompany the handoff?" Nothing is
 * mocked. Nothing authorizes trades, bets, capital, risk, policy or
 * execution; Strategy, AEGIS, Treasury and Execution stay authoritative.
 * Every PASS line is backed by assertions against actual engine output.
 */

import {GovernanceEngine} from './intelligence/governance/engine';
import {createGovernanceContext, aggregateSampleAdequacy,
  governanceStabilityStateOf, worstConfidenceRank} from './intelligence/governance/context';
import {evaluateEvidenceGate, worstConfidenceOf,
  isLimitingConfidence} from './intelligence/governance/evidence-gate';
import {evaluateSafetyGate, containsCertaintyClaim, narrativeOf,
  disclaimerFieldsOf, FABRICATED_KEYS, PREDICTION_TERMS,
  EXECUTION_INSTRUCTIONS} from './intelligence/governance/safety-gate';
import {evaluateComparabilityGate, validateNormalization,
  rawDomainsComparable} from './intelligence/governance/comparability-gate';
import {evaluateFreshnessGate, aggregateFreshness} from './intelligence/governance/freshness-gate';
import {evaluateStabilityGate, aggregateStability} from './intelligence/governance/stability-gate';
import {evaluateDependencyGate} from './intelligence/governance/dependency-gate';
import {checkAuthorityBoundary, PROTECTED_AUTHORITIES} from './intelligence/governance/authority-check';
import {GOVERNANCE_POLICIES, validatePolicyRegistry} from './intelligence/governance/policy-registry';
import {validatePolicyDefinition, evaluatePolicy}
  from './intelligence/governance/policy';
import {classifyHandoff} from './intelligence/governance/handoff-classification';
import {deriveRestrictions, restrictionOf, validateRestrictions,
  HANDOFF_RESTRICTION_CODES} from './intelligence/governance/handoff-restrictions';
import {buildStrategyHandoffPackage} from './intelligence/governance/handoff';
import {buildStrategyInput} from './intelligence/governance/strategy-input';
import {deriveResearchEscalations,
  buildGovernanceResearchContext} from './intelligence/governance/research-context';
import {buildGovernanceFeedback} from './intelligence/governance/feedback';
import {serializeGovernanceResult,
  compareGovernanceResults} from './intelligence/governance/replay';
import {GovernanceAuditLog, verifyGovernanceAudit} from './intelligence/governance/audit';
import {checkGovernanceInvariants} from './intelligence/governance/invariants';
import {DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig,
  validateGovernanceConfig} from './intelligence/governance/config';
import {canonicalJson} from './intelligence/governance/ids';
import {GOVERNANCE_DISCLAIMER, GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_GENESIS_HASH, GOVERNANCE_ENGINE_VERSION,
  GOVERNANCE_POLICY_VERSION, GOVERNANCE_NORMALIZATION_VERSION,
  GovernanceRejectionError} from './intelligence/governance/types';
import {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  noDominantGovernanceResult, multiDependentGovernanceResult,
  venueDependentGovernanceResult, afisGovernanceInput, ablGovernanceInput,
  liqGovernanceInput, governanceInputOf, runGovernance,
  liqDominantDecisionResult, afisDecisionResult, ablDecisionResult,
  ablThinDecisionResult, cleanDecisionResult, staleDecisionResult,
  agingDecisionResult, unknownFreshnessDecisionResult, unstableDecisionResult,
  notComparableDecisionResult, crossDomainDecisionResult, afisBackLegDecisionResult,
  ablBuyLegDecisionResult, ablBadOddsDecisionResult, ablNoIdentityDecisionResult,
  leakageInconsistentDecisionResult, stabilityInconsistentDecisionResult,
  fabricatedKeyDecisionResult, nondeterministicUpstreamResult,
  missingDecisionIdResult, missingOpportunityIdResult, missingDomainResult,
  unsupportedDomainResult, failedInvariantsResult,
  UNSAFE_ANNOTATIONS, AUTHORITY_BYPASS_ANNOTATIONS, CLEAN_ANNOTATIONS,
  validNormalization, versionMismatchNormalization, backEqualsBuyNormalization,
  missingLossNormalization, missingPolicyNormalization,
  governanceRejectionGallery, governanceClone, GOVERNANCE_FIXTURE_TIMESTAMP,
} from './intelligence/governance/test-fixtures';

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

function rejectionOf(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof GovernanceRejectionError
    && e.code === code;
}

function main(): void {
  const config = DEFAULT_GOVERNANCE_CONFIG;
  const engine = new GovernanceEngine({});
  const afis = afisGovernanceResult();
  const abl = ablGovernanceResult();
  const liq = liqGovernanceResult();
  const noDom = noDominantGovernanceResult();
  const multiDep = multiDependentGovernanceResult();
  const venueDep = venueDependentGovernanceResult();
  const clean = runGovernance(governanceInputOf(cleanDecisionResult()));
  const stale = runGovernance(governanceInputOf(staleDecisionResult()));
  const aging = runGovernance(governanceInputOf(agingDecisionResult()));
  const unknownF = runGovernance(
    governanceInputOf(unknownFreshnessDecisionResult()));
  const unstable = runGovernance(
    governanceInputOf(unstableDecisionResult()));
  const unstableBlocked = runGovernance(
    governanceInputOf(unstableDecisionResult()),
    {unstableBlocksHandoff: true});
  const notComparable = runGovernance(
    governanceInputOf(notComparableDecisionResult()));
  const staleAllowed = runGovernance(
    governanceInputOf(staleDecisionResult()),
    {allowStaleAnalyticalOnly: true});
  const unknownAllowed = runGovernance(
    governanceInputOf(unknownFreshnessDecisionResult()),
    {allowUnknownFreshnessAnalyticalOnly: true});
  const normalized = runGovernance(
    governanceInputOf(cleanDecisionResult(), [], validNormalization()));

  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push(' OSHIP — SPRINT 040 — UNIFIED DECISION GOVERNANCE & STRATEGY HANDOFF');
  lines.push(' ENGINE — DETERMINISTIC DEMONSTRATION');
  lines.push('================================================================================');
  lines.push('');
  lines.push(' DECISION RESULT → GOVERNANCE → EVIDENCE-BOUND HANDOFF (never execution)');
  lines.push(' Human → AETHER → OSHIP Core → Intelligence → Strategy → AEGIS →');
  lines.push(' Treasury → Execution — Sprint 040 sits inside Intelligence only.');
  lines.push('');

  // -------------------------------------------------------------------
  // 1 — Governance context
  // -------------------------------------------------------------------
  {
    const s = section('01 governance context — canonical, immutable, informational');
    s.equal(liq.context.domain, 'AFIS', 'domain preserved');
    s.equal(liq.context.informational, true, 'informational only');
    s.equal(liq.context.governanceVersion, GOVERNANCE_ENGINE_VERSION,
      'engine version');
    s.check(liq.context.contextId.startsWith('gctx_'), 'context id prefixed');
    s.check(liq.context.decisionId.startsWith('dia_'), 'decision id preserved');
    s.equal(liq.context.opportunityId, 'dec-afis-liq-base', 'opportunity id');
    s.check(Object.isFrozen(liq.context), 'context frozen');
  }

  // -------------------------------------------------------------------
  // 2 — Context mirrors Sprint 039 states verbatim
  // -------------------------------------------------------------------
  {
    const s = section('02 context mirrors Sprint 039 recommendation, evidence and dominance');
    s.equal(afis.context.recommendationState, 'CONFLICTED', 'AFIS conflicted');
    s.equal(abl.context.recommendationState, 'INSUFFICIENT_EVIDENCE', 'ABL insufficient');
    s.equal(liq.context.recommendationState, 'PREFERRED_BY_EVIDENCE', 'LIQ preferred');
    s.equal(afis.context.dominanceState, 'CONFLICTED', 'AFIS dominance');
    s.equal(liq.context.dominanceState, 'DOMINANT_BY_EVIDENCE', 'LIQ dominance');
    s.equal(liq.context.evidenceState, 'WEAK', 'LIQ evidence state weak');
    s.equal(liq.dependencyGate.regimeDependency, false, 'LIQ regime independent');
    s.equal(afis.dependencyGate.regimeDependency, true, 'AFIS regime dependent');
  }

  // -------------------------------------------------------------------
  // 3 — Policy registry
  // -------------------------------------------------------------------
  {
    const s = section('03 policy registry — twelve explicit deterministic policies');
    s.equal(GOVERNANCE_POLICIES.length, 12, 'twelve policies');
    s.same(GOVERNANCE_POLICIES.map((p) => p.definition.policyId),
      ['policy-evidence-sufficiency', 'policy-stale-evidence',
        'policy-conflicted-evidence', 'policy-comparability',
        'policy-stability', 'policy-leakage', 'policy-regime-dependency',
        'policy-strategy-dependency', 'policy-venue-dependency',
        'policy-research-gaps', 'policy-semantic-safety',
        'policy-authority-boundaries'], 'canonical policy ids');
    try {
      validatePolicyRegistry(config);
      s.check(true, 'registry validates');
    } catch (e) {
      s.failures.push(`registry validates (${String((e as Error).message).slice(0, 60)})`);
    }
    s.equal(liq.policies.length, 12, 'every policy evaluated per run');
  }

  // -------------------------------------------------------------------
  // 4 — Policy validation machinery
  // -------------------------------------------------------------------
  {
    const s = section('04 policy validation — definitions are validated, not trusted');
    s.throws('invalid policy definition rejected', () =>
      validatePolicyDefinition({
        policyId: 'policy-bad', version: '', description: '',
        evaluates: 'not-an-array' as never,
      }, GOVERNANCE_POLICY_VERSION));
    s.check(GOVERNANCE_POLICIES.every(
      (rule) => rule.definition.policyId.startsWith('policy-')),
      'policy ids canonical');
    const verdict = evaluatePolicy(GOVERNANCE_POLICIES[0], {
      evidenceGate: liq.evidenceGate, safetyGate: liq.safetyGate,
      comparabilityGate: liq.comparabilityGate,
      freshnessGate: liq.freshnessGate, stabilityGate: liq.stabilityGate,
      dependencyGate: liq.dependencyGate, authorityCheck: liq.authorityCheck,
      maxLeakageShare: liq.handoffPackage.leakageStatus.maxLeakageShare,
      researchGapCount: 0, researchQuestionCount:
        liq.research.decisionResearchQuestionCount,
    }, config);
    s.check(verdict.verdict === 'PASS' || verdict.verdict === 'LIMITATION'
      || verdict.verdict === 'FAIL', 'policy evaluation produces a verdict');
    s.equal(GOVERNANCE_POLICY_VERSION, liq.policies[0].version,
      'policy version recorded');
  }

  // -------------------------------------------------------------------
  // 5 — Evidence gate (LIQ)
  // -------------------------------------------------------------------
  {
    const s = section('05 evidence gate — liquidity run passes with limitations');
    s.equal(liq.evidenceGate.state, 'PASS_WITH_LIMITATIONS', 'LIQ limited');
    s.equal(liq.evidenceGate.worstConfidence, 'WEAK', 'worst confidence WEAK');
    s.equal(worstConfidenceOf(['WEAK', 'MODERATE', 'STRONG']), 'WEAK',
      'worst-of helper');
    s.check(isLimitingConfidence('WEAK'), 'WEAK is limiting');
    s.check(liq.evidenceGate.evidenceGateId.startsWith('gevg_'),
      'gate identity recorded');
  }

  // -------------------------------------------------------------------
  // 6 — Evidence gate (AFIS / ABL)
  // -------------------------------------------------------------------
  {
    const s = section('06 evidence gate — conflicts and insufficiency block explicitly');
    s.equal(afis.evidenceGate.state, 'BLOCK_CONFLICTED', 'AFIS conflicted');
    s.equal(abl.evidenceGate.state, 'BLOCK_INSUFFICIENT_EVIDENCE', 'ABL insufficient');
    s.equal(afis.evidenceGate.code, 'CONFLICTED_EVIDENCE', 'conflict code');
    s.equal(abl.evidenceGate.code, 'INSUFFICIENT_EVIDENCE', 'insufficient code');
    s.check(afis.evidenceGate.reasons.length > 0, 'conflict reasons explicit');
  }

  // -------------------------------------------------------------------
  // 7 — Evidence gate precedence
  // -------------------------------------------------------------------
  {
    const s = section('07 evidence gate precedence — the block family is ordered');
    s.equal(evaluateEvidenceGate(
      notComparableDecisionResult(), config).state,
      'BLOCK_NOT_COMPARABLE', 'not-comparable outranks the rest');
    s.equal(evaluateEvidenceGate(
      afisDecisionResult(), config).state,
      'BLOCK_CONFLICTED', 'conflict outranks insufficiency');
    s.equal(evaluateEvidenceGate(
      ablThinDecisionResult(), config).state,
      'BLOCK_INSUFFICIENT_EVIDENCE', 'insufficiency outranks staleness');
  }

  // -------------------------------------------------------------------
  // 8 — Safety gate, clean narratives
  // -------------------------------------------------------------------
  {
    const s = section('08 safety gate — real Sprint 039 narratives stay legal');
    s.equal(liq.safetyGate.state, 'SAFE', 'LIQ narrative safe');
    s.equal(afis.safetyGate.state, 'SAFE', 'AFIS narrative safe');
    s.equal(abl.safetyGate.state, 'SAFE', 'ABL narrative safe');
    s.check(narrativeOf(liqDominantDecisionResult()).length > 0,
      'narrative fields identified');
    s.equal(containsCertaintyClaim(
      'the support is strong, but support is not certainty'), false,
      'negated certainty is legal');
    s.equal(containsCertaintyClaim('this outcome is certain'), true,
      'asserted certainty is illegal');
  }

  // -------------------------------------------------------------------
  // 9 — Safety gate, prediction and certainty claims
  // -------------------------------------------------------------------
  {
    const s = section('09 safety gate — probability and certainty claims rejected');
    const probability = runGovernance(governanceInputOf(
      liqDominantDecisionResult(), ['the probability of profit is 0.9']));
    s.equal(probability.classification, 'HANDOFF_BLOCKED', 'probability blocks');
    s.equal(probability.safetyGate.code, 'UNSAFE_SEMANTICS', 'unsafe code');
    const forecast = runGovernance(governanceInputOf(
      liqDominantDecisionResult(), ['the forecast shows a rise tomorrow']));
    s.equal(forecast.classification, 'HANDOFF_BLOCKED', 'forecast blocks');
    s.check(PREDICTION_TERMS.test('expected profit is high'),
      'expected profit flagged');
    s.check(FABRICATED_KEYS.test('"probabilityOfSuccess":0.9'),
      'fabricated keys flagged');
  }

  // -------------------------------------------------------------------
  // 10 — Safety gate, execution instructions
  // -------------------------------------------------------------------
  {
    const s = section('10 safety gate — execution instructions rejected');
    const instruction = runGovernance(governanceInputOf(
      liqDominantDecisionResult(), ['execute now at venue-a']));
    s.equal(instruction.classification, 'HANDOFF_BLOCKED', 'execute now blocks');
    s.check(EXECUTION_INSTRUCTIONS.test('place the order immediately'),
      'order instruction flagged');
    const fabricated = runGovernance(
      governanceInputOf(fabricatedKeyDecisionResult()));
    s.equal(fabricated.classification, 'HANDOFF_BLOCKED',
      'fabricated probability keys block');
    s.equal(fabricated.safetyGate.code, 'UNSAFE_SEMANTICS',
      'fabricated keys are unsafe semantics');
  }

  // -------------------------------------------------------------------
  // 11 — Safety gate, disclaimer verbatim
  // -------------------------------------------------------------------
  {
    const s = section('11 safety gate — disclaimer is verbatim and excluded from scans');
    s.equal(GOVERNANCE_DISCLAIMER,
      'This is an evidence-bound analytical recommendation, not a '
      + 'probability, forecast, expected return, guarantee, or execution '
      + 'instruction.', 'disclaimer wording exact');
    const disclaimers = disclaimerFieldsOf(liqDominantDecisionResult());
    s.equal(disclaimers[0], GOVERNANCE_DISCLAIMER,
      'primary disclaimer first');
    s.check(disclaimers.length >= 1, 'disclaimer carried');
    s.equal(liq.disclaimer, GOVERNANCE_DISCLAIMER, 'result carries it');
    s.equal(liq.handoffPackage.disclaimer, GOVERNANCE_DISCLAIMER,
      'package carries it');
  }

  // -------------------------------------------------------------------
  // 12 — Comparability gate, AFIS
  // -------------------------------------------------------------------
  {
    const s = section('12 comparability gate — AFIS BUY/SELL semantics verified');
    s.equal(liq.comparabilityGate.state, 'COMPARABLE', 'LIQ comparable');
    s.equal(liq.comparabilityGate.afisSemanticsVerified, true, 'AFIS verified');
    s.equal(liq.comparabilityGate.ablSemanticsVerified, false, 'no ABL legs');
    s.equal(rawDomainsComparable('AFIS', 'ABL'), false, 'raw cross-domain incomparable');
    s.equal(rawDomainsComparable('ABL', 'AFIS'), false, 'symmetric');
  }

  // -------------------------------------------------------------------
  // 13 — Comparability gate, ABL BACK/LAY
  // -------------------------------------------------------------------
  {
    const s = section('13 comparability gate — ABL BACK/LAY semantics verified');
    s.equal(abl.comparabilityGate.state, 'COMPARABLE', 'ABL comparable');
    s.equal(abl.comparabilityGate.ablSemanticsVerified, true, 'ABL verified');
    s.throws('BUY on an ABL leg rejects fail closed', () =>
      runGovernance(governanceInputOf(ablBuyLegDecisionResult())),
      rejectionOf('INVALID_BACK_LAY_SEMANTICS'));
    s.throws('BACK on an AFIS leg rejects fail closed', () =>
      runGovernance(governanceInputOf(afisBackLegDecisionResult())),
      rejectionOf('INVALID_AFIS_SEMANTICS'));
    s.throws('odds below 1 reject fail closed', () =>
      runGovernance(governanceInputOf(ablBadOddsDecisionResult())),
      rejectionOf('INVALID_ABL_SEMANTICS'));
    s.throws('missing market/selection identity rejects', () =>
      runGovernance(governanceInputOf(ablNoIdentityDecisionResult())),
      rejectionOf('INVALID_ABL_SEMANTICS'));
  }

  // -------------------------------------------------------------------
  // 14 — Comparability gate, not comparable
  // -------------------------------------------------------------------
  {
    const s = section('14 comparability gate — incomparability is explicit');
    s.equal(notComparable.comparabilityGate.state, 'NOT_COMPARABLE',
      'NOT_COMPARABLE state');
    s.equal(notComparable.classification, 'HANDOFF_NOT_COMPARABLE',
      'classification mirrors gate');
    s.check(notComparable.comparabilityGate.reasons.length > 0,
      'reasons explicit');
  }

  // -------------------------------------------------------------------
  // 15 — Normalization, explicit and validated
  // -------------------------------------------------------------------
  {
    const s = section('15 normalization — explicit, versioned, loss-declared only');
    const normalization = validateNormalization(validNormalization(), config);
    s.check(normalization !== null, 'valid normalization accepted');
    s.equal(normalization?.version, GOVERNANCE_NORMALIZATION_VERSION,
      'version checked');
    s.equal(normalization?.domains.includes('AFIS'), true, 'AFIS covered');
    s.equal(normalization?.semanticLoss.length, 3, 'semantic loss declared');
  }

  // -------------------------------------------------------------------
  // 16 — Normalization, invalid variants fail closed
  // -------------------------------------------------------------------
  {
    const s = section('16 normalization — invalid variants fail closed');
    s.throws('version mismatch rejects', () =>
      validateNormalization(versionMismatchNormalization(), config));
    s.throws('BACK==BUY equation rejects', () =>
      validateNormalization(backEqualsBuyNormalization(), config));
    s.throws('undeclared loss rejects', () =>
      validateNormalization(missingLossNormalization(), config));
    s.throws('missing policy attestation rejects', () =>
      validateNormalization(missingPolicyNormalization(), config));
    s.equal(normalized.comparabilityGate.state,
      'COMPARABLE_VIA_NORMALIZATION', 'valid path only');
    s.check(normalized.restrictions.some(
      (r) => r.code === 'NORMALIZED_COMPARISON_ONLY'),
      'normalized comparison restricted');
  }

  // -------------------------------------------------------------------
  // 17 — Freshness gate
  // -------------------------------------------------------------------
  {
    const s = section('17 freshness gate — FRESH / AGING / STALE / UNKNOWN');
    s.equal(liq.freshnessGate.state, 'FRESH', 'LIQ fresh');
    s.equal(aging.freshnessGate.state, 'AGING', 'aging detected');
    s.equal(stale.freshnessGate.state, 'STALE', 'stale detected');
    s.equal(unknownF.freshnessGate.state, 'UNKNOWN', 'unknown detected');
    s.equal(aggregateFreshness([345600000, 345600000], ['FRESH', 'FRESH'],
      ['MODERATE', 'MODERATE'], config), 'AGING', 'worst-of aging');
    s.equal(aggregateFreshness([null, null], ['FRESH', 'FRESH'],
      ['MODERATE', 'MODERATE'], config), 'UNKNOWN', 'worst-of unknown');
    s.equal(aging.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'aging passes with limitations');
  }

  // -------------------------------------------------------------------
  // 18 — Freshness policies
  // -------------------------------------------------------------------
  {
    const s = section('18 freshness policies — stale and unknown never silently pass');
    s.equal(stale.classification, 'HANDOFF_STALE', 'stale blocks by default');
    s.equal(staleAllowed.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'stale analytical-only policy');
    s.check(staleAllowed.restrictions.some(
      (r) => r.code === 'STALE_EVIDENCE_WARNING'), 'stale warning attached');
    s.equal(unknownF.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE',
      'unknown blocks by default');
    s.equal(unknownAllowed.classification,
      'HANDOFF_ALLOWED_WITH_LIMITATIONS', 'unknown analytical-only policy');
  }

  // -------------------------------------------------------------------
  // 19 — Stability gate
  // -------------------------------------------------------------------
  {
    const s = section('19 stability gate — states are explicit, never probabilities');
    s.equal(liq.stabilityGate.state, 'MODERATELY_STABLE', 'LIQ moderately stable');
    s.equal(clean.stabilityGate.state, 'STABLE', 'clean run stable');
    s.equal(unstable.stabilityGate.state, 'UNSTABLE', 'unstable detected');
    s.equal(unstable.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'unstable limited by default');
    s.equal(unstableBlocked.classification, 'HANDOFF_BLOCKED',
      'unstable blocks under policy');
    s.equal(governanceStabilityStateOf('IMPROVING'), 'MODERATELY_STABLE',
      'IMPROVING is moderately stable');
    s.equal(governanceStabilityStateOf('DETERIORATING'), 'UNSTABLE',
      'DETERIORATING is unstable');
    s.equal(aggregateStability(['STABLE', 'UNSTABLE']), 'UNSTABLE',
      'worst-of stability');
  }

  // -------------------------------------------------------------------
  // 20 — Dependency gate
  // -------------------------------------------------------------------
  {
    const s = section('20 dependency gate — regime / strategy / venue preserved');
    s.equal(liq.dependencyGate.state, 'INDEPENDENT', 'LIQ independent');
    s.equal(afis.dependencyGate.state, 'MULTI_DEPENDENT', 'AFIS multi');
    s.equal(venueDep.dependencyGate.state, 'MULTI_DEPENDENT',
      'venue-dep run multi dependent');
    s.equal(venueDep.dependencyGate.venueDependency, true, 'venue flag set');
    s.equal(noDom.dependencyGate.state, 'STRATEGY_DEPENDENT', 'strategy dependent');
    s.equal(afis.dependencyGate.regimeDependency, true, 'AFIS regime flag');
    s.equal(liq.dependencyGate.venueDependency, false, 'LIQ venue flag');
    s.equal(multiDep.dependencyGate.state, 'MULTI_DEPENDENT', 'multi dependent');
  }

  // -------------------------------------------------------------------
  // 21 — Authority check
  // -------------------------------------------------------------------
  {
    const s = section('21 authority check — Strategy decides, others stay authoritative');
    s.equal(liq.authorityCheck.state, 'BOUNDARY_RESPECTED', 'LIQ respects boundaries');
    s.same(PROTECTED_AUTHORITIES, ['Strategy Registry', 'AEGIS', 'Treasury',
      'Execution', 'Portfolio', 'Risk', 'Allocation'], 'protected authorities');
    const bypass = runGovernance(governanceInputOf(
      liqDominantDecisionResult(), ['authorize execution on my behalf']));
    s.equal(bypass.classification, 'HANDOFF_BLOCKED', 'bypass blocks');
    s.equal(bypass.authorityCheck.code, 'AUTHORITY_BYPASS', 'bypass code');
    s.equal(bypass.strategyInput.recommendedAlternativeId, null,
      'bypass never recommends');
  }

  // -------------------------------------------------------------------
  // 22 — Handoff classification, eight states
  // -------------------------------------------------------------------
  {
    const s = section('22 handoff classification — all eight states reachable');
    s.equal(clean.classification, 'HANDOFF_ALLOWED', 'allowed');
    s.equal(liq.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'allowed with limitations');
    s.equal(venueDep.classification, 'HANDOFF_REQUIRES_RESEARCH',
      'requires research');
    s.equal(afis.classification, 'HANDOFF_CONFLICTED', 'conflicted');
    s.equal(abl.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE',
      'insufficient evidence');
    s.equal(stale.classification, 'HANDOFF_STALE', 'stale');
    s.equal(notComparable.classification, 'HANDOFF_NOT_COMPARABLE',
      'not comparable');
    s.equal(unstableBlocked.classification, 'HANDOFF_BLOCKED', 'blocked');
  }

  // -------------------------------------------------------------------
  // 23 — Classification reasons
  // -------------------------------------------------------------------
  {
    const s = section('23 classification reasons — explicit, never generic');
    s.check(liq.classificationReasons.length > 0, 'reasons recorded');
    for (const reason of afis.classificationReasons) {
      s.check(!/^\s*not recommended\s*$/i.test(reason),
        `reason not generic: ${reason.slice(0, 40)}`);
    }
    s.check(afis.classificationReasons.some((r) => r.includes('conflict')),
      'conflict reason named');
    s.check(abl.classificationReasons.some(
      (r) => r.includes('insufficient')), 'insufficiency reason named');
    s.check(Object.isFrozen(liq.classificationReasons), 'reasons frozen');
  }

  // -------------------------------------------------------------------
  // 24 — Restrictions, baseline and derived
  // -------------------------------------------------------------------
  {
    const s = section('24 restrictions — machine-readable, deterministic');
    const codes: readonly string[] = liq.restrictions.map((r) => r.code);
    s.same(codes, [...codes].sort(), 'restrictions canonically ordered');
    for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
      'LIMITED_TO_DOMAIN']) {
      s.check(codes.includes(baseline), `baseline present: ${baseline}`);
    }
    s.check(liq.restrictions.length > 3, 'LIQ adds derived restrictions');
    s.equal(HANDOFF_RESTRICTION_CODES.length, 13, 'thirteen canonical codes');
    s.check(liq.restrictions.every((r) =>
      HANDOFF_RESTRICTION_CODES.includes(r.code)), 'codes canonical');
    try {
      validateRestrictions(liq.restrictions);
      s.check(true, 'restrictions validate');
    } catch (e) {
      s.failures.push(`restrictions validate (${String((e as Error).message).slice(0, 60)})`);
    }
    s.check(restrictionOf('ANALYTICAL_ONLY', 'analytical only',
      'policy-semantic-safety').code === 'ANALYTICAL_ONLY',
      'restriction factory validates codes');
  }

  // -------------------------------------------------------------------
  // 25 — Restriction machinery
  // -------------------------------------------------------------------
  {
    const s = section('25 restriction machinery — scopes and validation');
    s.throws('non-canonical code rejects', () =>
      restrictionOf('NOT_A_CODE' as never, 'x', 'policy-x'));
    const derived = deriveRestrictions({
      classification: liq.classification,
      evidenceGate: liq.evidenceGate,
      freshnessGate: liq.freshnessGate,
      stabilityGate: liq.stabilityGate,
      dependencyGate: liq.dependencyGate,
      comparabilityGate: liq.comparabilityGate,
      policies: liq.policies,
      maxLeakageShare:
        liq.handoffPackage.leakageStatus.maxLeakageShare,
      config,
    });
    s.check(derived.length >= 3, 'derivation produces the baseline');
    s.same(derived.map((r) => r.code), liq.restrictions.map((r) => r.code),
      'derivation replays the engine restrictions');
    s.check(derived.every((r) => r.restrictionId.startsWith('gres_')),
      'ids prefixed');
  }

  // -------------------------------------------------------------------
  // 26 — LIQ handoff package
  // -------------------------------------------------------------------
  {
    const s = section('26 handoff package — LIQ run, full evidence-bound framing');
    const pkg = liq.handoffPackage;
    s.check(pkg.handoffId.startsWith('ghof_'), 'package id prefixed');
    s.equal(pkg.schemaVersion, 'decision-governance.handoff.v1', 'schema');
    s.equal(pkg.domain, 'AFIS', 'domain');
    s.equal(pkg.recommendation.status, 'PREFERRED_BY_EVIDENCE',
      'recommendation status preserved');
    s.equal(pkg.alternativeRanking.length,
      liqDominantDecisionResult().ranking.entries.length, 'ranking mirrored');
    s.equal(pkg.sourceVersions.decisionAnalysisId, liq.context.decisionId,
      'decision version pinned');
    s.check(pkg.evidenceSummary.sampleAdequacy !== null, 'adequacy recorded');
    s.check(pkg.tradeOffs.length > 0, 'trade-offs carried');
  }

  // -------------------------------------------------------------------
  // 27 — AFIS / ABL handoff packages stay blocked
  // -------------------------------------------------------------------
  {
    const s = section('27 handoff packages — blocked runs stay fully framed');
    s.equal(afis.handoffPackage.recommendation.status, 'CONFLICTED',
      'AFIS conflicted status preserved');
    s.equal(abl.handoffPackage.recommendation.status, 'INSUFFICIENT_EVIDENCE',
      'ABL insufficient status preserved');
    s.check(afis.handoffPackage.evidenceLimitations.length > 0,
      'AFIS limitations explicit');
    s.check(abl.handoffPackage.evidenceLimitations.length > 0,
      'ABL limitations explicit');
    s.equal(afis.handoffPackage.governanceResult.classification,
      'HANDOFF_CONFLICTED', 'governance result embedded');
  }

  // -------------------------------------------------------------------
  // 28 — Package boundaries
  // -------------------------------------------------------------------
  {
    const s = section('28 package boundaries — no orders, no credentials, no commands');
    const serialized = JSON.stringify(liq.handoffPackage);
    for (const forbidden of ['"order"', '"qty"', '"amountToCommit"',
      '"instruction"', '"command"', '"authorization"', '"apiKey"',
      '"credential"', '"privateKey"', '"treasuryCommand"',
      '"allocationCommand"', '"aegisApproval"']) {
      s.check(!serialized.includes(forbidden), `absent: ${forbidden}`);
    }
    s.equal(liq.handoffPackage.informational, true, 'package informational');
    s.check(Object.isFrozen(liq.handoffPackage), 'package frozen');
  }

  // -------------------------------------------------------------------
  // 29 — Package audit identity
  // -------------------------------------------------------------------
  {
    const s = section('29 package audit identity — anchored to the hash chain');
    const identity = liq.handoffPackage.auditIdentity;
    s.equal(identity.governanceId, liq.governanceId, 'governance id');
    s.equal(identity.schemaVersion, 'oship.decision-governance.v1', 'schema');
    s.check(identity.eventCount <= liq.auditEvents.length,
      'event count anchors the pre-seal chain');
    s.check(identity.headHash.length > 0, 'head hash anchored');
  }

  // -------------------------------------------------------------------
  // 30 — Strategy input
  // -------------------------------------------------------------------
  {
    const s = section('30 strategy input — informational view for Strategy');
    const view = liq.strategyInput;
    s.check(view.strategyInputId.startsWith('gstr_'), 'id prefixed');
    s.equal(view.strategyDecides, true, 'Strategy decides');
    s.equal(view.informational, true, 'view informational');
    s.equal(view.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'classification carried');
    s.equal(view.recommendedAlternativeId, 'alt-venue-a',
      'LIQ recommends the dominant alternative');
    s.check(view.restrictionCodes.includes('ANALYTICAL_ONLY'),
      'restrictions carried');
    s.equal(view.schemaVersion, 'decision-governance.strategy-input.v1',
      'schema');
    s.check(Object.isFrozen(view), 'view frozen');
  }

  // -------------------------------------------------------------------
  // 31 — Strategy input for blocked handoffs
  // -------------------------------------------------------------------
  {
    const s = section('31 strategy input — blocked handoffs recommend nothing');
    s.equal(afis.strategyInput.recommendedAlternativeId, null, 'AFIS null');
    s.equal(abl.strategyInput.recommendedAlternativeId, null, 'ABL null');
    s.equal(stale.strategyInput.recommendedAlternativeId, null, 'stale null');
    s.equal(notComparable.strategyInput.recommendedAlternativeId, null,
      'not-comparable null');
    s.equal(unstableBlocked.strategyInput.recommendedAlternativeId, null,
      'blocked null');
    s.equal(clean.strategyInput.recommendedAlternativeId, 'alt-venue-a',
      'clean still recommends');
  }

  // -------------------------------------------------------------------
  // 32 — Research escalations
  // -------------------------------------------------------------------
  {
    const s = section('32 research escalations — seven kinds to the Research Plane');
    s.equal(liq.research.escalations.some(
      (e) => e.kind === 'LEAKAGE_INVESTIGATION_REQUIRED'), true,
      'LIQ leakage investigation');
    s.equal(venueDep.research.escalations.some(
      (e) => e.kind === 'VENUE_COVERAGE_REQUIRED'), true, 'venue coverage');
    s.equal(venueDep.research.escalations.some(
      (e) => e.kind === 'RESEARCH_REQUIRED'), true, 'research required');
    s.equal(notComparable.research.escalations.some(
      (e) => e.kind === 'COMPARABILITY_REQUIRED'), true, 'comparability');
    s.equal(stale.research.escalations.some(
      (e) => e.kind === 'EVIDENCE_REFRESH_REQUIRED'), true, 'evidence refresh');
    s.equal(afis.research.escalations.some(
      (e) => e.kind === 'REGIME_COVERAGE_REQUIRED'), true, 'regime coverage');
    s.equal(abl.research.escalations.some(
      (e) => e.kind === 'RESEARCH_REQUIRED'), true, 'insufficiency research');
    s.equal(liq.research.informational, true, 'research informational');
    s.check(liq.research.escalations.every(
      (e) => e.escalationId.startsWith('grsc_')), 'ids prefixed');
  }

  // -------------------------------------------------------------------
  // 33 — Research context builder
  // -------------------------------------------------------------------
  {
    const s = section('33 research context — deterministic, question-aware');
    const research = liq.research;
    s.check(research.researchContextId.startsWith('grcx_'), 'id prefixed');
    s.check(research.decisionResearchQuestionCount >= 0,
      'Sprint 039 questions counted');
    s.equal(research.domain, 'AFIS', 'domain carried');
    const rebuilt = buildGovernanceResearchContext(liq.governanceId,
      liqDominantDecisionResult(), research.escalations);
    s.equal(rebuilt.researchContextId, research.researchContextId,
      'rebuild is byte-identical');
    s.equal(deriveResearchEscalations({
      classification: venueDep.classification,
      evidenceGate: venueDep.evidenceGate,
      freshnessGate: venueDep.freshnessGate,
      dependencyGate: venueDep.dependencyGate,
      comparabilityGate: venueDep.comparabilityGate,
      maxLeakageShare: null,
      config,
    }).length, venueDep.research.escalations.length, 'derivation replays');
  }

  // -------------------------------------------------------------------
  // 34 — Feedback records
  // -------------------------------------------------------------------
  {
    const s = section('34 feedback — structured records for Learning/Feedback');
    s.check(liq.feedback.some(
      (f) => f.kind === 'GOVERNANCE_ALLOWED_WITH_LIMITATIONS'),
      'LIQ limitation record');
    s.check(afis.feedback.some(
      (f) => f.kind === 'CONFLICT_FEEDBACK'), 'AFIS conflict record');
    s.check(abl.feedback.some(
      (f) => f.kind === 'GOVERNANCE_BLOCKED_DECISION'), 'ABL blocked record');
    s.check(liq.feedback.some(
      (f) => f.kind === 'RECOMMENDATION_WEAKENED'), 'weakened record');
    s.check(clean.feedback.some(
      (f) => f.kind === 'RECOMMENDATION_PRESERVED'), 'preserved record');
    s.check(aging.feedback.some(
      (f) => f.kind === 'STALE_EVIDENCE_FEEDBACK'), 'stale-evidence record');
    s.check(liq.feedback.every(
      (f) => f.schemaVersion === 'decision-governance.feedback.v1'),
      'feedback schema');
    s.check(liq.feedback.every((f) => f.informational), 'informational');
    s.check(liq.feedback.every(
      (f) => f.feedbackId.startsWith('gfdb_')), 'ids prefixed');
  }

  // -------------------------------------------------------------------
  // 35 — Replay, byte-identical
  // -------------------------------------------------------------------
  {
    const s = section('35 replay — repeated execution is byte-identical');
    const first = serializeGovernanceResult(runGovernance(liqGovernanceInput()));
    const second = serializeGovernanceResult(runGovernance(liqGovernanceInput()));
    s.equal(first, second, 'LIQ replay identical');
    s.equal(serializeGovernanceResult(runGovernance(afisGovernanceInput())),
      serializeGovernanceResult(runGovernance(afisGovernanceInput())),
      'AFIS replay identical');
    s.equal(serializeGovernanceResult(runGovernance(ablGovernanceInput())),
      serializeGovernanceResult(runGovernance(ablGovernanceInput())),
      'ABL replay identical');
    s.equal(liq.replay.identical, true, 'engine double-run identical');
    s.equal(compareGovernanceResults(liq, liq), true, 'compare helper');
    s.equal(compareGovernanceResults(liq, afis), false, 'compare detects');
  }

  // -------------------------------------------------------------------
  // 36 — Replay, permutation and serialization
  // -------------------------------------------------------------------
  {
    const s = section('36 replay — key order never matters');
    const decision = liqDominantDecisionResult();
    const permuted = JSON.parse(`{"normalization":null,"annotations":`
      + `["requesting governed handoff for the liquidity-imbalance decision"],`
      + `"decisionResult":${canonicalJson(decision)},`
      + `"traceId":"trace-governance-AFIS",`
      + `"correlationId":"corr-governance-AFIS",`
      + `"timestamp":${String(GOVERNANCE_FIXTURE_TIMESTAMP)}}`);
    s.equal(serializeGovernanceResult(engine.govern(permuted)),
      serializeGovernanceResult(liq), 'permuted input identical');
    const reparsed = JSON.parse(serializeGovernanceResult(liq));
    s.equal(canonicalJson(reparsed), serializeGovernanceResult(liq),
      'serialization round-trips');
  }

  // -------------------------------------------------------------------
  // 37 — Audit chain, valid
  // -------------------------------------------------------------------
  {
    const s = section('37 audit — append-only hash chain over the lifecycle');
    const verification = verifyGovernanceAudit(liq.auditEvents,
      liq.auditEvents.length);
    s.equal(verification.valid, true, 'chain valid');
    s.equal(liq.auditEvents[0].previousHash, GOVERNANCE_GENESIS_HASH,
      'rooted at GENESIS');
    s.equal(liq.auditEvents[0].eventType, 'context-created', 'first event');
    s.equal(liq.auditEvents[liq.auditEvents.length - 1].eventType,
      'replay-completed', 'sealed by replay');
    s.equal(GOVERNANCE_EVENT_TYPES.length, 16, 'sixteen event types');
    s.check(liq.auditEvents.every((e) => e.eventId.startsWith('gea_')),
      'event ids prefixed');
  }

  // -------------------------------------------------------------------
  // 38 — Audit violations fail closed
  // -------------------------------------------------------------------
  {
    const s = section('38 audit — tamper, reorder, substitution, truncation, extension');
    const events = liq.auditEvents;
    const tampered = JSON.parse(JSON.stringify(events));
    tampered[5].payload.injected = true;
    s.equal(verifyGovernanceAudit(tampered).valid, false, 'tamper detected');
    const reordered = JSON.parse(JSON.stringify(events));
    const tmp = reordered[5]; reordered[5] = reordered[6]; reordered[6] = tmp;
    s.equal(verifyGovernanceAudit(reordered).valid, false, 'reorder detected');
    const truncated = events.slice(0, events.length - 4);
    s.equal(verifyGovernanceAudit(truncated, events.length).valid, false,
      'truncation detected');
    const extended = [...events, events[events.length - 1]];
    s.equal(verifyGovernanceAudit(extended, events.length).valid, false,
      'extension detected');
    const substituted = JSON.parse(JSON.stringify(events));
    substituted[8].payload = substituted[9].payload;
    s.equal(verifyGovernanceAudit(substituted).valid, false,
      'substitution detected');
  }

  // -------------------------------------------------------------------
  // 39 — Audit log class
  // -------------------------------------------------------------------
  {
    const s = section('39 audit log — append-only class rejects foreign events');
    const log = new GovernanceAuditLog('gov_demo', 1);
    const first = log.append('context-created', {a: 1});
    const second = log.append('evidence-gate', {b: 2});
    s.equal(first.sequence, 0, 'first sequence');
    s.equal(second.previousHash, first.hash, 'hash chained');
    s.equal(log.headHash, second.hash, 'head hash');
    s.throws('unknown event type rejected', () =>
      log.append('evil-event' as never, {}));
    s.equal(log.snapshot().length, 2, 'snapshot length');
  }

  // -------------------------------------------------------------------
  // 40 — Invariants
  // -------------------------------------------------------------------
  {
    const s = section('40 invariants — 77 checks on every governance run');
    s.equal(liq.invariants.checks.length, 77, 'exactly 77');
    s.equal(liq.invariants.passed, true, 'LIQ passes');
    s.equal(afis.invariants.passed, true, 'AFIS passes');
    s.equal(abl.invariants.passed, true, 'ABL passes');
    s.equal(stale.invariants.passed, true, 'stale run passes');
    s.equal(unstableBlocked.invariants.passed, true, 'blocked run passes');
    s.check(Object.isFrozen(liq.invariants), 'report frozen');
    const recomputed = checkGovernanceInvariants(liq, {
      input: liqGovernanceInput(), config});
    s.equal(recomputed.passed, true, 'independent recompute agrees');
  }

  // -------------------------------------------------------------------
  // 41 — Invariant coverage
  // -------------------------------------------------------------------
  {
    const s = section('41 invariants — authority, safety, honesty, determinism');
    const names = new Set(liq.invariants.checks.map((c) => c.invariant));
    for (const required of ['NO_TREASURY_AUTHORITY', 'NO_AEGIS_AUTHORITY',
      'NO_EXECUTION_AUTHORITY', 'NO_PORTFOLIO_AUTHORITY', 'NO_RISK_AUTHORITY',
      'NO_ALLOCATION_AUTHORITY', 'NO_PROBABILITY', 'NO_GUARANTEE',
      'AFIS_BUY_SELL_PRESERVED', 'ABL_BACK_LAY_PRESERVED',
      'RAW_CROSS_DOMAIN_REJECTED', 'NORMALIZATION_EXPLICIT',
      'UNKNOWN_FRESHNESS_NEVER_FRESH', 'UNSTABLE_NEVER_SILENTLY_STABLE',
      'DETERMINISTIC_REPLAY', 'AUDIT_INTEGRITY', 'TAMPERING_FAILS_CLOSED',
      'HANDOFF_PACKAGE_IMMUTABLE', 'STRATEGY_BOUNDARY_PRESERVED',
      'BLOCKED_NEVER_RECOMMENDS', 'NO_CREDENTIAL_PROPAGATION']) {
      s.check(names.has(required), `present: ${required}`);
    }
  }

  // -------------------------------------------------------------------
  // 42 — Configuration
  // -------------------------------------------------------------------
  {
    const s = section('42 configuration — explicit, frozen, fingerprinted');
    s.equal(config.freshnessAgingThresholdMs, 259200000, 'aging 3d');
    s.equal(config.freshnessStaleThresholdMs, 604800000, 'stale 7d');
    s.equal(config.leakageInvestigationShare, 0.5, 'leakage share 0.5');
    s.equal(config.maxAnnotations, 16, 'max annotations 16');
    s.equal(config.allowStaleAnalyticalOnly, false, 'stale blocked by default');
    try {
      validateGovernanceConfig(config);
      s.check(true, 'defaults validate');
    } catch (e) {
      s.failures.push(`defaults validate (${String((e as Error).message).slice(0, 60)})`);
    }
    const merged = mergeGovernanceConfig({unstableBlocksHandoff: true});
    s.equal(merged.unstableBlocksHandoff, true, 'merge applies');
    s.equal(merged.freshnessStaleThresholdMs, 604800000, 'merge preserves');
    s.check(Object.isFrozen(merged), 'merged config frozen');
  }

  // -------------------------------------------------------------------
  // 43 — Deterministic ids
  // -------------------------------------------------------------------
  {
    const s = section('43 ids — every identity is content-derived');
    const a = runGovernance(liqGovernanceInput());
    const b = runGovernance(liqGovernanceInput());
    s.equal(a.governanceId, b.governanceId, 'governance id stable');
    s.equal(a.governanceFingerprint, b.governanceFingerprint,
      'fingerprint stable');
    s.check(a.governanceId.startsWith('gov_'), 'gov_ prefix');
    s.check(a.governanceFingerprint.startsWith('gfp2_'), 'gfp2_ prefix');
    s.check(a.evidenceGate.evidenceGateId.startsWith('gevg_')
      && a.safetyGate.safetyGateId.startsWith('gsfg_')
      && a.freshnessGate.freshnessGateId.startsWith('gfsh_')
      && a.stabilityGate.stabilityGateId.startsWith('gstb_')
      && a.dependencyGate.dependencyGateId.startsWith('gdep_')
      && a.comparabilityGate.comparabilityGateId.startsWith('gcmp_')
      && a.authorityCheck.authorityCheckId.startsWith('gaut_'),
      'gate id prefixes');
    s.check(a.handoffPackage.handoffId.startsWith('ghof_'), 'package prefix');
    s.check(a.strategyInput.strategyInputId.startsWith('gstr_'), 'view prefix');
    s.check(a.restrictions.every(
      (r) => r.restrictionId.startsWith('gres_')), 'restriction prefix');
  }

  // -------------------------------------------------------------------
  // 44 — Engine determinism across instances
  // -------------------------------------------------------------------
  {
    const s = section('44 engine — deterministic across instances and configs');
    const other = new GovernanceEngine({});
    s.equal(serializeGovernanceResult(
      other.govern(liqGovernanceInput())),
      serializeGovernanceResult(liq), 'cross-instance identical');
    s.equal(engine.configurationFingerprint,
      other.configurationFingerprint, 'config fingerprints equal');
    const tuned = new GovernanceEngine({unstableBlocksHandoff: true});
    s.check(tuned.configurationFingerprint
      !== engine.configurationFingerprint, 'config change re-fingerprints');
    s.check(Object.isFrozen(engine.configuration), 'config frozen');
  }

  // -------------------------------------------------------------------
  // 45 — Fail-closed rejection gallery
  // -------------------------------------------------------------------
  {
    const s = section('45 fail-closed — every gallery rejection is explicit');
    const gallery = governanceRejectionGallery();
    s.check(gallery.length >= 20, `${gallery.length} gallery entries`);
    let rejected = 0;
    for (const fixture of gallery) {
      try {
        new GovernanceEngine().govern(
          fixture.input as Parameters<GovernanceEngine['govern']>[0]);
        s.failures.push(`${fixture.label} did not reject`);
      } catch (e) {
        if (e instanceof GovernanceRejectionError
          && e.code === fixture.code) rejected++;
        else s.failures.push(`${fixture.label} wrong rejection`);
      }
    }
    s.equal(rejected, gallery.length, 'all rejections exact');
  }

  // -------------------------------------------------------------------
  // 46 — Fail-closed, input validation
  // -------------------------------------------------------------------
  {
    const s = section('46 fail-closed — malformed inputs never reach the gates');
    s.throws('missing decision id rejects', () =>
      runGovernance(governanceInputOf(missingDecisionIdResult())),
      rejectionOf('MISSING_DECISION_ID'));
    s.throws('missing opportunity id rejects', () =>
      runGovernance(governanceInputOf(missingOpportunityIdResult())),
      rejectionOf('MISSING_OPPORTUNITY_ID'));
    s.throws('missing domain rejects', () =>
      runGovernance(governanceInputOf(missingDomainResult())),
      rejectionOf('MISSING_DOMAIN'));
    s.throws('unsupported domain rejects', () =>
      runGovernance(governanceInputOf(unsupportedDomainResult())),
      rejectionOf('UNSUPPORTED_DOMAIN'));
    s.throws('null input rejects', () =>
      new GovernanceEngine().govern(null as never),
      rejectionOf('INVALID_GOVERNANCE_CONTEXT'));
  }

  // -------------------------------------------------------------------
  // 47 — Fail-closed, upstream integrity
  // -------------------------------------------------------------------
  {
    const s = section('47 fail-closed — upstream integrity is verified, not trusted');
    s.throws('failed upstream invariants reject', () =>
      runGovernance(governanceInputOf(failedInvariantsResult())),
      rejectionOf('INVALID_DECISION_RESULT'));
    s.throws('nondeterministic upstream rejects', () =>
      runGovernance(governanceInputOf(nondeterministicUpstreamResult())),
      rejectionOf('NONDETERMINISTIC_INPUT'));
    s.throws('leakage inconsistency rejects', () =>
      runGovernance(governanceInputOf(leakageInconsistentDecisionResult())),
      rejectionOf('LEAKAGE_INCONSISTENCY'));
    s.throws('stability inconsistency rejects', () =>
      runGovernance(governanceInputOf(stabilityInconsistentDecisionResult())),
      rejectionOf('STABILITY_INCONSISTENCY'));
  }

  // -------------------------------------------------------------------
  // 48 — AFIS domain validation
  // -------------------------------------------------------------------
  {
    const s = section('48 AFIS validation — BUY/SELL, venue identity, no odds');
    const decision = afisDecisionResult();
    for (const alt of decision.alternatives) {
      for (const leg of alt.counterfactualCandidate.venueLegs) {
        s.check(leg.side === 'BUY' || leg.side === 'SELL',
          `AFIS side ${leg.side} legal`);
        s.equal(leg.odds, null, 'AFIS legs carry no odds');
      }
      s.equal(alt.counterfactualCandidate.marketId, null, 'no market id');
      s.equal(alt.counterfactualCandidate.selectionId, null,
        'no selection id');
    }
    s.equal(afis.context.domain, 'AFIS', 'AFIS domain');
    s.equal(afis.classification, 'HANDOFF_CONFLICTED',
      'AFIS blocked as conflicted');
  }

  // -------------------------------------------------------------------
  // 49 — ABL domain validation
  // -------------------------------------------------------------------
  {
    const s = section('49 ABL validation — BACK/LAY, identity, odds > 1');
    const decision = ablDecisionResult();
    let sawBack = false; let sawLay = false;
    for (const alt of decision.alternatives) {
      for (const leg of alt.counterfactualCandidate.venueLegs) {
        s.check(leg.side === 'BACK' || leg.side === 'LAY',
          `ABL side ${leg.side} legal`);
        if (leg.side === 'BACK') sawBack = true;
        if (leg.side === 'LAY') sawLay = true;
        s.check(leg.odds !== null && leg.odds > 1, 'decimal odds > 1');
      }
      s.check(alt.counterfactualCandidate.marketId !== null, 'market id');
      s.check(alt.counterfactualCandidate.selectionId !== null,
        'selection id');
    }
    s.check(sawBack && sawLay, 'both BACK and LAY present');
    s.equal(abl.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE',
      'ABL blocked as insufficient');
    s.check(abl.research.escalations.length > 0, 'ABL escalates research');
  }

  // -------------------------------------------------------------------
  // 50 — Cross-domain isolation
  // -------------------------------------------------------------------
  {
    const s = section('50 cross-domain — raw AFIS↔ABL never compared');
    s.throws('domain-spanning alternative set rejects', () =>
      runGovernance(governanceInputOf(crossDomainDecisionResult())),
      rejectionOf('UNSUPPORTED_DOMAIN'));
    s.equal(normalized.comparabilityGate.state,
      'COMPARABLE_VIA_NORMALIZATION', 'explicit normalization only');
    s.check(normalized.comparabilityGate.normalization !== null,
      'normalization carried in gate');
    s.check(normalized.invariants.checks.find(
      (c) => c.invariant === 'RAW_CROSS_DOMAIN_REJECTED')!.passed,
      'isolation invariant holds under normalization');
  }

  // -------------------------------------------------------------------
  // 51 — Clean handoff
  // -------------------------------------------------------------------
  {
    const s = section('51 clean handoff — ALLOWED with baseline restrictions only');
    s.equal(clean.classification, 'HANDOFF_ALLOWED', 'allowed');
    s.same(clean.restrictions.map((r) => r.code),
      ['ANALYTICAL_ONLY', 'LIMITED_TO_DOMAIN', 'NO_EXECUTION'],
      'baseline restrictions only, canonically ordered');
    s.equal(clean.strategyInput.recommendedAlternativeId, 'alt-venue-a',
      'recommends the evidence-dominant alternative');
    s.equal(clean.evidenceGate.state, 'PASS', 'evidence passes');
    s.check(clean.policies.every((p) => p.verdict === 'PASS'),
      'all twelve policies pass');
    s.equal(clean.research.escalations.length, 0, 'no research escalation');
  }

  // -------------------------------------------------------------------
  // 52 — Corpus outcomes
  // -------------------------------------------------------------------
  {
    const s = section('52 corpus outcomes — every run governed in full');
    s.equal(liq.restrictions.length, 5, 'LIQ five restrictions');
    s.equal(afis.restrictions.length, 7, 'AFIS seven restrictions');
    s.equal(venueDep.restrictions.length, 8, 'venue-dep eight restrictions');
    s.check(liq.auditEvents.length > 25, 'LIQ audit chain long');
    s.equal(liq.handoffPackage.leakageStatus.countedOnce, true,
      'leakage counted once');
    s.equal(liq.handoffPackage.stabilityStatus, 'MODERATELY_STABLE',
      'stability status carried');
    s.equal(venueDep.handoffPackage.dependencies.state, 'MULTI_DEPENDENT',
      'dependency carried');
    s.equal(noDom.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
      'no-dominant limited');
  }

  // -------------------------------------------------------------------
  // 53 — Immutability
  // -------------------------------------------------------------------
  {
    const s = section('53 immutability — results are frozen end to end');
    s.check(Object.isFrozen(liq), 'result frozen');
    s.check(Object.isFrozen(liq.restrictions), 'restrictions frozen');
    s.check(Object.isFrozen(liq.handoffPackage), 'package frozen');
    s.check(Object.isFrozen(liq.strategyInput), 'strategy input frozen');
    s.check(Object.isFrozen(liq.classificationReasons), 'reasons frozen');
    s.throws('mutation of frozen result throws', () => {
      (liq as unknown as Record<string, unknown>).classification = 'X';
    });
  }

  // -------------------------------------------------------------------
  // 54 — Boundary summary
  // -------------------------------------------------------------------
  {
    const s = section('54 boundary — governance only, never a strategy');
    s.equal(liq.strategyInput.strategyDecides, true, 'Strategy decides');
    s.equal(liq.handoffPackage.informational, true, 'package informational');
    s.equal(liq.research.informational, true, 'research informational');
    const serialized = serializeGovernanceResult(liq);
    for (const forbidden of ['"treasuryCommand"', '"aegisApproval"',
      '"executionCommand"', '"allocationCommand"', '"apiKey"',
      '"order"', '"sizing"']) {
      s.check(!serialized.includes(forbidden), `absent: ${forbidden}`);
    }
    s.equal(GOVERNANCE_ENGINE_VERSION, 'oship.decision-governance.engine.v1',
      'engine version canonical');
  }

  // -------------------------------------------------------------------
  // Reconciliation
  // -------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  lines.push(` Governance runs: LIQ (${liq.classification}), AFIS `
    + `(${afis.classification}), ABL (${abl.classification}), no-dominant `
    + `(${noDom.classification}), venue-dependent `
    + `(${venueDep.classification}), clean (${clean.classification}), plus `
    + `stale, aging, unknown-freshness, unstable, not-comparable and `
    + `normalized runs.`);
  lines.push(` Invariant checks per run: ${liq.invariants.checks.length}. `
    + `Audit events per run: ${liq.auditEvents.length}. Policies: 12. `
    + `Restriction codes: ${HANDOFF_RESTRICTION_CODES.length}.`);
  lines.push('');
  lines.push(' The handoff package is NOT a probability, forecast, expected');
  lines.push(' return, guarantee or execution instruction. Blocked results');
  lines.push(' are never silently converted into alternatives. AFIS and ABL');
  lines.push(' stayed isolated; BUY/SELL and BACK/LAY semantics were');
  lines.push(' preserved exactly; normalization is explicit or absent; the');
  lines.push(' audit chain is append-only and tamper-evident; replay is');
  lines.push(' byte-identical; Strategy, AEGIS, Treasury and Execution stay');
  lines.push(' authoritative.');
  lines.push('');
  lines.push(` SPRINT 040 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
  if (failed.length === 0) {
    lines.push('');
    lines.push(` All ${sections.length} sections passed. Every governance output`);
    lines.push(' is informational and evidence-bound; rejections are explicit');
    lines.push(' and fail closed; the Strategy handoff carries its limitations');
    lines.push(' with it; the Research Plane and Learning/Feedback receive');
    lines.push(' structured escalations and records without any new authority.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 040: COMPLETE');
  } else {
    lines.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const s of failed) {
      lines.push(`   [${s.name}]`);
      for (const f of s.failures) lines.push(`     - ${f}`);
    }
    lines.push('');
    lines.push(' SYSTEM STATUS: UNRECONCILED');
  }
  console.log(lines.join('\n'));
  if (failed.length > 0) process.exit(1);
}

main();
