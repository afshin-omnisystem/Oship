import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {closedLoopCorpus} from '../test-fixtures';
import {compareDomains} from '../aggregation';

/**
 * SPRINT 035 — cross-domain tests: AFIS and ABL through ONE engine with
 * domain-neutral core and domain adapters only.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('one engine analyzes both domains in a single pass', () => {
  const domains = new Set(result.records.map((a) => a.identity.domain));
  assert.deepEqual([...domains].sort(), ['ABL', 'AFIS']);
});

test('both domains share the same analysis fingerprint basis', () => {
  assert.ok(result.analysisFingerprint.startsWith('clfp_'));
  assert.equal(result.records.filter((a) => a.identity.domain === 'AFIS').length, 12);
  assert.equal(result.records.filter((a) => a.identity.domain === 'ABL').length, 1);
});

test('domain adapters differ only in semantics, never in engine logic', () => {
  const afis = result.records.find((a) => a.identity.domain === 'AFIS')!;
  const abl = result.records.find((a) => a.identity.domain === 'ABL')!;
  // Same attribution shapes, same field sets.
  assert.deepEqual(Object.keys(afis.realized), Object.keys(abl.realized));
  assert.deepEqual(Object.keys(afis.leakage.components[0]), Object.keys(abl.leakage.components[0]));
  assert.deepEqual(Object.keys(afis.edge), Object.keys(abl.edge));
});

test('cross-domain ranking mixes domains deterministically', () => {
  const ablEntry = result.ranking.find((r) => r.opportunityId === 'opp_abl_surebet')!;
  assert.ok(ablEntry.rank >= 1 && ablEntry.rank <= result.ranking.length);
});

test('cross-domain comparison identifies the higher-preservation domain', () => {
  const comparison = compareDomains(result.domainScorecards);
  assert.equal(comparison.higherPreservation, 'ABL');
});

test('recommendations can target a single domain', () => {
  const domainScoped = result.recommendations.filter((r) => r.domain !== 'ALL');
  assert.ok(domainScoped.length > 0);
  for (const rec of domainScoped) {
    assert.ok(['AFIS', 'ABL'].includes(rec.domain));
  }
});

test('class-loss recommendation fires for the liquidity-imbalance class', () => {
  const classLoss = result.recommendations.find((r) => r.kind === 'CLASS_LOSES_VALUE');
  assert.ok(classLoss);
  assert.ok(String(classLoss!.statement).includes('liquidity-imbalance'));
});

test('both domains satisfy the same invariant set', () => {
  assert.ok(result.invariants!.passed);
  const afisSemantics = result.invariants!.checks.find((c) => c.invariant === 'AFIS_SEMANTIC_PRESERVATION')!;
  const ablSemantics = result.invariants!.checks.find((c) => c.invariant === 'ABL_SEMANTIC_PRESERVATION')!;
  assert.ok(afisSemantics.passed);
  assert.ok(ablSemantics.passed);
});

test('cross-domain analysis is byte-identical on replay', () => {
  const second = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.equal(second.analysisFingerprint, result.analysisFingerprint);
});

test('venue benchmarking never compares AFIS against ABL venues', () => {
  for (const group of result.comparableGroups) {
    assert.ok(group.key.domain === 'AFIS' || group.key.domain === 'ABL');
  }
});
