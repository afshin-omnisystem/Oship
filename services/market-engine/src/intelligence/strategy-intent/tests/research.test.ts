import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveResearchRequirements, buildIntentResearchContext,
} from '../research';
import {IntentRejectionError, INTENT_RESEARCH_CLASSES}
  from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, notComparableIntentResult,
  venueDependentIntentResult, unknownFreshnessIntentResult,
  agingIntentResult, preserveDependenciesOf, liqGovernanceResult,
  afisGovernanceResult, venueDependentGovernanceResult,
} from '../test-fixtures';
import {extractGovernanceFacts} from '../governance-input';

/** SPRINT 041 — research escalation tests (§14). */

test('eight research classes are enumerated', () => {
  assert.equal(INTENT_RESEARCH_CLASSES.length, 8);
});

test('governance escalations map to intent research classes', () => {
  const result = liqIntentResult();
  assert.deepEqual(result.research.requirements.map(
    (r) => r.researchClass), ['LEAKAGE_RESEARCH', 'STABILITY_RESEARCH']);
  assert.equal(result.research.requirements[0].provenance,
    'GOVERNANCE_ESCALATION');
  assert.equal(result.research.requirements[1].provenance,
    'INTENT_DERIVED');
});

test('the venue-dependent intent escalates coverage research', () => {
  const classes = venueDependentIntentResult().research.requirements
    .map((r) => r.researchClass);
  assert.ok(classes.includes('REGIME_RESEARCH'));
  assert.ok(classes.includes('STRATEGY_RESEARCH'));
  assert.ok(classes.includes('VENUE_RESEARCH'));
});

test('the conflicted intent escalates regime and strategy research', () => {
  const classes = afisIntentResult().research.requirements
    .map((r) => r.researchClass);
  assert.ok(classes.includes('REGIME_RESEARCH'));
  assert.ok(classes.includes('STRATEGY_RESEARCH'));
});

test('the insufficient intent escalates alternative research', () => {
  assert.ok(ablIntentResult().research.requirements.some(
    (r) => r.researchClass === 'ALTERNATIVE_RESEARCH'));
});

test('the stale intent escalates evidence refresh', () => {
  assert.ok(staleIntentResult().research.requirements.some(
    (r) => r.researchClass === 'EVIDENCE_REFRESH'));
});

test('the not-comparable intent escalates comparability research', () => {
  assert.ok(notComparableIntentResult().research.requirements.some(
    (r) => r.researchClass === 'COMPARABILITY_RESEARCH'));
});

test('unstable-below-stable evidence escalates stability research', () => {
  assert.ok(liqIntentResult().research.requirements.some(
    (r) => r.researchClass === 'STABILITY_RESEARCH'));
});

test('a clean stable intent escalates nothing', () => {
  assert.equal(cleanIntentResult().research.requirements.length, 0);
});

test('inherited requirements carry their source escalation id', () => {
  for (const requirement of afisIntentResult().research.requirements) {
    if (requirement.provenance === 'GOVERNANCE_ESCALATION') {
      assert.ok(requirement.sourceEscalationId !== null);
    } else {
      assert.equal(requirement.sourceEscalationId, null);
    }
  }
});

test('requirements carry rationales and ids', () => {
  for (const requirement of venueDependentIntentResult()
    .research.requirements) {
    assert.ok(requirement.researchId.startsWith('srsc_'));
    assert.ok(requirement.rationale.length > 10);
  }
});

test('requirements are canonically ordered', () => {
  const classes = venueDependentIntentResult().research.requirements
    .map((r) => r.researchClass);
  const ranks = classes.map((c) => INTENT_RESEARCH_CLASSES.indexOf(c));
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] < ranks[i], 'research out of order');
  }
});

test('the research context is informational with its schema', () => {
  const research = liqIntentResult().research;
  assert.equal(research.informational, true);
  assert.equal(research.schemaVersion, 'strategy-intent.research.v1');
  assert.ok(research.researchContextId.startsWith('srcx_'));
});

test('the research context counts governance escalations', () => {
  const research = venueDependentIntentResult().research;
  assert.ok(research.governanceEscalationCount > 0);
  assert.ok(research.decisionResearchQuestionCount >= 0);
});

test('derivation is deterministic', () => {
  type ResearchInput = Parameters<typeof deriveResearchRequirements>[0];
  const input: ResearchInput = {
    classification: 'STRATEGIC_INTENT_RESEARCH_REQUIRED',
    governanceFacts: extractGovernanceFacts(
      venueDependentGovernanceResult()),
    dependencies: preserveDependenciesOf(
      venueDependentGovernanceResult()),
    decisionResearchQuestionCount: 3,
    escalateStabilityResearch: true,
  };
  assert.deepEqual(deriveResearchRequirements(input),
    deriveResearchRequirements(input));
});

test('the research context builder validates classes', () => {
  assert.throws(() => buildIntentResearchContext('sint_x',
    [{researchId: 'srsc_x', researchClass: 'EVIL' as never,
      rationale: 'x', sourceEscalationId: null,
      provenance: 'INTENT_DERIVED'}], 0, 0),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_RESEARCH_CONTEXT');
});

test('the research context builder rejects empty rationales', () => {
  assert.throws(() => buildIntentResearchContext('sint_x',
    [{researchId: 'srsc_x', researchClass: 'LEAKAGE_RESEARCH',
      rationale: '', sourceEscalationId: null,
      provenance: 'INTENT_DERIVED'}], 0, 0),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_RESEARCH_CONTEXT');
});

test('stability escalation can be disabled by configuration', () => {
  const requirements = deriveResearchRequirements({
    classification: 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    governanceFacts: extractGovernanceFacts(liqGovernanceResult()),
    dependencies: preserveDependenciesOf(liqGovernanceResult()),
    decisionResearchQuestionCount: 0,
    escalateStabilityResearch: false,
  });
  assert.ok(!requirements.some(
    (r) => r.researchClass === 'STABILITY_RESEARCH'));
});

test('the aging intent keeps its stability research', () => {
  assert.ok(agingIntentResult().research.requirements.some(
    (r) => r.researchClass === 'STABILITY_RESEARCH'));
});

test('the unknown-freshness intent escalates alternative research', () => {
  assert.ok(unknownFreshnessIntentResult().research.requirements.some(
    (r) => r.researchClass === 'ALTERNATIVE_RESEARCH'));
});
