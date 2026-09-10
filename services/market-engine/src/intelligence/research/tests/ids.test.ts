import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  researchHash, researchAnalysisId, memoryIdOf, observationSourceId, queryIdOf,
  comparisonIdOf, patternIdOf, hypothesisIdOf, evidenceIdOf, findingIdOf, rankingIdOf,
  feedbackIdOf, recommendationIdOf, nodeIdOf, edgeIdOf, auditEventIdOf,
  contentFingerprintOf, graphFingerprintOf, memoryFingerprintOf, indexFingerprintOf,
} from '../ids';

/**
 * SPRINT 036 — deterministic identity tests: every artifact id is
 * content-derived, prefix-tagged and stable across key orderings.
 */

test('researchHash is stable for identical content', () => {
  assert.equal(researchHash({a: 1, b: 2}), researchHash({a: 1, b: 2}));
});

test('researchHash is order-independent over object keys', () => {
  assert.equal(researchHash({a: 1, b: {x: 1, y: 2}}), researchHash({b: {y: 2, x: 1}, a: 1}));
});

test('researchHash distinguishes different content', () => {
  assert.notEqual(researchHash({a: 1}), researchHash({a: 2}));
  assert.notEqual(researchHash({a: 1}), researchHash({b: 1}));
});

test('every artifact family carries its canonical prefix', () => {
  assert.ok(researchAnalysisId({x: 1}).startsWith('res_'));
  assert.ok(memoryIdOf({x: 1}).startsWith('mem_'));
  assert.equal(observationSourceId('batch_1', 'opp_1'), 'batch_1:opp_1');
  assert.ok(queryIdOf({x: 1}).startsWith('rqy_'));
  assert.ok(comparisonIdOf({x: 1}).startsWith('cmp_'));
  assert.ok(patternIdOf({x: 1}).startsWith('pat_'));
  assert.ok(hypothesisIdOf({x: 1}).startsWith('hyp_'));
  assert.ok(evidenceIdOf({x: 1}).startsWith('evd_'));
  assert.ok(findingIdOf({x: 1}).startsWith('fnd_'));
  assert.ok(rankingIdOf({x: 1}).startsWith('rnk_'));
  assert.ok(feedbackIdOf({x: 1}).startsWith('fbk_'));
  assert.ok(recommendationIdOf({x: 1}).startsWith('rec_'));
  assert.ok(nodeIdOf({x: 1}).startsWith('node_'));
  assert.ok(edgeIdOf({x: 1}).startsWith('edge_'));
  assert.ok(auditEventIdOf({x: 1}).startsWith('revt_'));
  assert.ok(contentFingerprintOf({x: 1}).startsWith('rcfp_'));
  assert.ok(graphFingerprintOf({x: 1}).startsWith('rgrp_'));
  assert.ok(memoryFingerprintOf({x: 1}).startsWith('rmem_'));
  assert.ok(indexFingerprintOf({x: 1}).startsWith('ridx_'));
});

test('ids are pure functions of content — no randomness', () => {
  for (let i = 0; i < 3; i++) {
    assert.equal(memoryIdOf({sourceId: 's', version: 1}), memoryIdOf({sourceId: 's', version: 1}));
    assert.equal(patternIdOf({kind: 'K', subject: 'x'}), patternIdOf({kind: 'K', subject: 'x'}));
  }
});

test('observation source ids compose batch and opportunity deterministically', () => {
  const a = observationSourceId('batchA', 'opp_1');
  const b = observationSourceId('batchB', 'opp_1');
  const c = observationSourceId('batchA', 'opp_2');
  assert.equal(a, 'batchA:opp_1');
  assert.equal(a, observationSourceId('batchA', 'opp_1'));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('content fingerprinting separates content from identity', () => {
  const fp1 = contentFingerprintOf({values: [1, 2, 3]});
  const fp2 = contentFingerprintOf({values: [1, 2, 4]});
  assert.notEqual(fp1, fp2);
  assert.equal(fp1, contentFingerprintOf({values: [1, 2, 3]}));
});

test('sealing an id with a marker changes it deterministically', () => {
  const base = {subject: 'x', entries: [1, 2]};
  assert.notEqual(rankingIdOf(base), rankingIdOf({...base, seal: true}));
  assert.equal(rankingIdOf({...base, seal: true}), rankingIdOf({...base, seal: true}));
});

test('array order is significant for ids (ordering is canonicalized upstream)', () => {
  assert.notEqual(findingIdOf({ids: ['a', 'b']}), findingIdOf({ids: ['b', 'a']}));
});

test('ids embed truncated sha-256 digests of the content', () => {
  const id = hypothesisIdOf({statement: 's'});
  const digest = id.slice('hyp_'.length);
  assert.match(digest, /^[0-9a-f]{24}$/);
  const long = researchHash({statement: 's'});
  assert.equal(digest, long.slice(0, 24));
});

test('graph fingerprints depend on nodes and edges', () => {
  const g1 = graphFingerprintOf({nodes: ['n1'], edges: ['e1']});
  const g2 = graphFingerprintOf({nodes: ['n1'], edges: ['e1', 'e2']});
  assert.notEqual(g1, g2);
  assert.equal(g1, graphFingerprintOf({nodes: ['n1'], edges: ['e1']}));
});

test('memory and index fingerprints are distinct families', () => {
  assert.notEqual(memoryFingerprintOf({x: 1}), indexFingerprintOf({x: 1}));
});
