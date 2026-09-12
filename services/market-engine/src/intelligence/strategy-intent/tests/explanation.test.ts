import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildIntentExplanation} from '../explanation';
import {
  liqIntentResult, afisIntentResult, ablIntentResult,
  cleanIntentResult, liqGovernanceResult, afisGovernanceResult,
  extractDecisionFactsOf, extractGovernanceFactsOf,
  preserveDependenciesOf, liqIntentInput,
} from '../test-fixtures';

/** SPRINT 041 — explanation tests (§17). */

test('the explanation pins the source decision id', () => {
  const explanation = liqIntentResult().explanation;
  assert.ok(explanation.sourceDecisionId.startsWith('dia_'));
  assert.equal(explanation.sourceDecisionId,
    liqIntentResult().context.decisionId);
});

test('the explanation pins the source governance id', () => {
  const explanation = liqIntentResult().explanation;
  assert.ok(explanation.sourceGovernanceId.startsWith('gov_'));
  assert.equal(explanation.sourceGovernanceId,
    liqGovernanceResult().governanceId);
});

test('the explanation names the preferred alternative', () => {
  assert.equal(liqIntentResult().explanation.preferredAlternativeId,
    'alt-venue-a');
  assert.equal(afisIntentResult().explanation.preferredAlternativeId,
    null);
});

test('the explanation carries supporting evidence', () => {
  assert.ok(liqIntentResult().explanation.supportingEvidence.length
    > 0);
});

test('the explanation carries conflicting evidence for conflicts', () => {
  assert.ok(afisIntentResult().explanation.conflictingEvidence.length
    > 0);
});

test('the explanation summarizes dependencies', () => {
  const summary = afisIntentResult().explanation.dependencySummary;
  assert.ok(summary.some((line) =>
    line.includes('MULTI_DEPENDENT')));
});

test('the explanation summarizes restrictions', () => {
  const summary = liqIntentResult().explanation.restrictionSummary;
  assert.ok(summary.some((line) =>
    line.startsWith('ANALYTICAL_ONLY:')));
});

test('the explanation summarizes research requirements', () => {
  const summary = liqIntentResult().explanation.researchSummary;
  assert.ok(summary.some((line) =>
    line.startsWith('LEAKAGE_RESEARCH:')));
});

test('the explanation states why the intent is limited', () => {
  const rationale = liqIntentResult().explanation.statusRationale;
  assert.ok(rationale.some((line) =>
    line.includes('STRATEGIC_INTENT_READY_WITH_LIMITATIONS')));
});

test('the explanation states why blocked intents surface nothing', () => {
  const rationale = afisIntentResult().explanation.statusRationale;
  assert.ok(rationale.some((line) =>
    line.includes('does not allow a preferred alternative')));
});

test('the explanation carries semantic limitations', () => {
  assert.ok(liqIntentResult().explanation.semanticLimitations.length
    > 0);
});

test('the explanation is informational with an id', () => {
  const explanation = liqIntentResult().explanation;
  assert.ok(explanation.explanationId.startsWith('sexp_'));
  assert.equal(explanation.informational, true);
});

test('the explanation is deterministic', () => {
  const result = liqIntentResult();
  const rebuilt = buildIntentExplanation({
    decisionId: result.context.decisionId,
    governanceId: result.context.governanceId,
    preferredAlternativeId: result.preferredAlternativeId,
    classification: result.classification,
    evidence: {
      rationale: result.intent.rationale,
      historicalSupport: result.intent.historicalSupport,
      supportingEvidence: result.explanation.supportingEvidence,
      conflictingEvidence: result.explanation.conflictingEvidence,
      semanticLimitations: result.intent.semanticLimitations,
    },
    dependencies: result.dependencies,
    restrictions: result.restrictions,
    researchRequirements: result.research.requirements,
    governanceFacts: extractGovernanceFactsOf(liqGovernanceResult()),
  });
  assert.equal(rebuilt.explanationId,
    result.explanation.explanationId);
});

test('the explanation mirrors the classification reasons', () => {
  const rationale = ablIntentResult().explanation.statusRationale;
  assert.ok(rationale.some((line) =>
    line.includes('HANDOFF_INSUFFICIENT_EVIDENCE')));
});

test('the clean explanation is reconstructible from the intent', () => {
  const result = cleanIntentResult();
  assert.ok(result.explanation.sourceDecisionId
    === result.intent.provenance.decisionId);
  assert.ok(result.explanation.sourceGovernanceId
    === result.intent.provenance.governanceId);
});

test('the explanation is frozen', () => {
  assert.ok(Object.isFrozen(liqIntentResult().explanation));
});
