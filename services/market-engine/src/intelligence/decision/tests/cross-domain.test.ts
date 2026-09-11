import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAlternativeSpec, applyOverrides} from '../alternative';
import {evaluateCompatibility} from '../compatibility';
import {compareAlternatives} from '../historical-comparison';
import {rankAlternatives} from '../ranking';
import {
  afisCvaBase, ablSurebetBase, opportunityLearning, runDecision,
  afisDecisionInput,
} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — cross-domain isolation tests: raw AFIS vs ABL alternatives
 * are NOT_COMPARABLE; no implicit normalization; no accidental mixed-domain
 * ranking; normalized comparison only when explicitly legal (never here).
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('an ABL strategy on an AFIS base is rejected as a raw cross-domain comparison', () => {
  const base = afisCvaBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x-domain', label: 'ABL strategy on AFIS', kind: 'STRATEGY',
      baseCandidateId: base.candidateId, strategyId: 'sports-arb-strategy',
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'cross-domain'},
    base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'CROSS_DOMAIN_COMPARISON');
});

test('an AFIS strategy on an ABL base is rejected as a raw cross-domain comparison', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x-domain', label: 'AFIS strategy on ABL', kind: 'STRATEGY',
      baseCandidateId: base.candidateId, strategyId: 'arb-guardian',
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'cross-domain'},
    base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'CROSS_DOMAIN_COMPARISON');
});

test('BUY sides cannot enter ABL alternatives', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x-side', label: 'BUY in ABL', kind: 'SIDE',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_SIDE_SEMANTICS');
});

test('BACK sides cannot enter AFIS alternatives', () => {
  const base = afisCvaBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x-side', label: 'BACK in AFIS', kind: 'SIDE',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_SIDE_SEMANTICS');
});

test('betting identity cannot enter AFIS alternatives', () => {
  const base = afisCvaBase();
  const marketId = validateAlternativeSpec(
    {alternativeId: 'x-mid', label: 'marketId on AFIS', kind: 'HANDLING',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: null, marketId: 'm', selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!marketId.ok);
  assert.equal(marketId.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
  const selectionId = validateAlternativeSpec(
    {alternativeId: 'x-sid', label: 'selectionId on AFIS', kind: 'HANDLING',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: null, marketId: null, selectionId: 's', marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!selectionId.ok);
  assert.equal(selectionId.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});

test('AFIS and ABL counterfactuals never compare in the same matrix', () => {
  const afisMatrix = afisDecisionResult().scenarioMatrix;
  const ablMatrix = ablDecisionResult().scenarioMatrix;
  assert.equal(afisMatrix.domain, 'AFIS');
  assert.equal(ablMatrix.domain, 'ABL');
});

test('pairwise comparison of cross-domain counterfactuals is not comparable', () => {
  const afis = evaluateCounterfactual(
    {alternativeId: 'afis-1', label: 'afis', kind: 'BASELINE',
      baseCandidateId: afisCvaBase().candidateId, strategyId: null,
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'x'},
    afisCvaBase(), opportunityLearning(), config);
  const abl = evaluateCounterfactual(
    {alternativeId: 'abl-1', label: 'abl', kind: 'BASELINE',
      baseCandidateId: ablSurebetBase().candidateId, strategyId: null,
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'x'},
    ablSurebetBase(), opportunityLearning(), config);
  const comparison = compareAlternatives(afis, abl);
  assert.equal(comparison.comparable, false);
});

test('rankings cannot mix domains — foreign alternatives never enter', () => {
  const afis = afisDecisionResult();
  // Inject a foreign alternative object into the ranking input: the
  // domain guard must exclude it.
  const foreign = {...afis.alternatives[0],
    alternativeId: 'foreign-abl'};
  (foreign as {profile: {domain: string}}).profile =
    {...afis.alternatives[0].profile, domain: 'ABL'};
  const ranking = rankAlternatives([...afis.alternatives, foreign], afis.tradeoff);
  assert.ok(ranking.excluded.some((e) => e.alternativeId === 'foreign-abl'));
  assert.ok(!ranking.entries.some((e) => e.alternativeId === 'foreign-abl'));
});

test('the learning corpus keeps AFIS and ABL observations separate', () => {
  const learning = opportunityLearning();
  for (const observation of learning.observations) {
    assert.ok(['AFIS', 'ABL'].includes(observation.domain));
  }
  const domains = new Set(learning.observations.map((o) => o.domain));
  assert.ok(domains.has('AFIS') && domains.has('ABL'));
});

test('engine results never contain a mixed-domain alternative set', () => {
  for (const result of [afisDecisionResult(), ablDecisionResult()]) {
    const domains = new Set(result.alternatives.map((a) => a.profile.domain));
    assert.equal(domains.size, 1);
  }
});

test('no implicit normalization exists anywhere in the pipeline', () => {
  // The only domain bridge would be an alternative changing domain —
  // applyOverrides never touches the domain field.
  const base = afisCvaBase();
  const candidate = applyOverrides(base,
    {alternativeId: 'y', label: 'y', kind: 'HANDLING',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: {liquidityIndex: 0.5}, rationale: 'x'});
  assert.equal(candidate.domain, 'AFIS');
});

test('a cross-domain alternative is audited with its rejection code', () => {
  const base = afisCvaBase();
  const result = runDecision({...afisDecisionInput(), baseCandidate: base,
    alternatives: [{alternativeId: 'xd', label: 'cross-domain', kind: 'STRATEGY',
      baseCandidateId: base.candidateId, strategyId: 'sports-arb-strategy',
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'x'}]});
  const rejection = result.rejectedAlternatives.find((r) => r.alternativeId === 'xd');
  assert.ok(rejection);
  assert.equal(rejection.code, 'CROSS_DOMAIN_COMPARISON');
  assert.ok(result.auditEvents.some((e) =>
    e.eventType === 'alternative-rejected' && e.payload.code === 'CROSS_DOMAIN_COMPARISON'));
});

test('compatibility re-verifies domain coherence defensively', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    {alternativeId: 'defensive', label: 'defensive', kind: 'STRATEGY',
      baseCandidateId: base.candidateId, strategyId: 'sports-arb-strategy',
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'x'} as never,
    base, opportunityLearning());
  assert.equal(assessment.state, 'NOT_COMPARABLE');
});

test('normalized comparison is only accepted when explicitly legal — never implicitly', () => {
  // There is no legal normalized cross-domain representation in Sprint 039;
  // the engine structurally cannot produce one.
  const learning = opportunityLearning();
  const afisStrategies = learning.strategyLearning
    .filter((s) => s.domain === 'AFIS').map((s) => s.strategyId);
  const ablStrategies = learning.strategyLearning
    .filter((s) => s.domain === 'ABL').map((s) => s.strategyId);
  const shared = afisStrategies.filter((s) => ablStrategies.includes(s));
  assert.equal(shared.length, 0,
    'no strategy may be shared across domains (no implicit bridge)');
});
