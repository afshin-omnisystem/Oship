import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  opportunityAnalysisIdOf, similarityIdOf, featureProfileIdOf, regimeMatchIdOf,
  strategyHistoryIdOf, venueHistoryIdOf, leakageRiskIdOf, evidenceIdOf,
  stabilityIntegrationIdOf, distributionIdOf, scoreIdOf, dependenciesIdOf,
  classificationIdOf, profileIdOf, explanationIdOf, researchContextIdOf,
  feedbackIdOf, reconciliationIdOf, rankingIdOf, auditEventIdOf,
  contentFingerprintOf, analysisFingerprintOf, learningHash, canonicalJson,
} from '../ids';

/**
 * SPRINT 038 — identity tests: every artifact id is content-derived,
 * prefix-tagged and canonical-key-order independent.
 */

test('analysis ids carry the oai prefix', () => {
  const id = opportunityAnalysisIdOf({candidates: ['a', 'b'], timestamp: 1});
  assert.ok(id.startsWith('oai_'));
  assert.equal(id.length, 4 + 24);
});

test('every prefix family produces distinct prefixed ids', () => {
  const input = {candidateId: 'c1'};
  const ids = [similarityIdOf(input), featureProfileIdOf(input),
    regimeMatchIdOf(input), strategyHistoryIdOf(input), venueHistoryIdOf(input),
    leakageRiskIdOf(input), evidenceIdOf(input), stabilityIntegrationIdOf(input),
    distributionIdOf(input), scoreIdOf(input), dependenciesIdOf(input),
    classificationIdOf(input), profileIdOf(input), explanationIdOf(input),
    researchContextIdOf(input), feedbackIdOf(input), reconciliationIdOf(input),
    rankingIdOf(input), auditEventIdOf(input)];
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, 19);
  const prefixes = ['osm', 'ofp', 'orm', 'ost', 'ovh', 'olk', 'oev', 'osi',
    'odb', 'osc', 'odp', 'ocl', 'opr', 'oex', 'orc', 'ofb', 'orb', 'orn', 'oea'];
  for (let i = 0; i < ids.length; i++) {
    assert.ok(ids[i].startsWith(prefixes[i] + '_'),
      `${ids[i]} should start with ${prefixes[i]}_`);
  }
});

test('content fingerprints carry the ocfp prefix', () => {
  assert.ok(contentFingerprintOf({a: 1}).startsWith('ocfp_'));
});

test('analysis fingerprints carry the ofp2 prefix', () => {
  assert.ok(analysisFingerprintOf({a: 1}).startsWith('ofp2_'));
});

test('ids are deterministic for identical input', () => {
  assert.equal(profileIdOf({candidateId: 'x', domain: 'AFIS'}),
    profileIdOf({candidateId: 'x', domain: 'AFIS'}));
});

test('ids differ for different content', () => {
  assert.notEqual(profileIdOf({candidateId: 'x'}),
    profileIdOf({candidateId: 'y'}));
});

test('ids are key-order independent (canonical JSON)', () => {
  const a = scoreIdOf({candidateId: 'c', score: 0.5, dims: ['a', 'b']});
  const b = scoreIdOf({dims: ['a', 'b'], score: 0.5, candidateId: 'c'});
  assert.equal(a, b);
});

test('nested key order is also irrelevant', () => {
  const a = evidenceIdOf({meta: {x: 1, y: 2}, n: 1});
  const b = evidenceIdOf({n: 1, meta: {y: 2, x: 1}});
  assert.equal(a, b);
});

test('learningHash is a 64-character hex string', () => {
  const hash = learningHash({any: 'content'});
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('learningHash is re-exported from the learning plane unchanged', () => {
  const learningIds = require('../../learning/ids') as {
    learningHash: (input: unknown) => string;
  };
  assert.equal(learningHash('same'), learningIds.learningHash('same'));
});

test('canonicalJson sorts object keys deterministically', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}');
});

test('canonicalJson sorts nested keys too', () => {
  assert.equal(
    canonicalJson({z: {b: 1, a: 2}, a: [3, 2]}),
    '{"a":[3,2],"z":{"a":2,"b":1}}');
});

test('canonicalJson round-trips values', () => {
  const value = {x: 1.5, y: null, z: 'text', w: [1, 2], v: {deep: true}};
  assert.deepEqual(JSON.parse(canonicalJson(value)), value);
});

test('audit event ids differ per sequence', () => {
  const a = auditEventIdOf({analysisId: 'an', sequence: 0, eventType: 'x'});
  const b = auditEventIdOf({analysisId: 'an', sequence: 1, eventType: 'x'});
  assert.notEqual(a, b);
});

test('feedback and reconciliation ids separate the two feedback families', () => {
  const f = feedbackIdOf({profileId: 'p'});
  const r = reconciliationIdOf({profileId: 'p'});
  assert.ok(f.startsWith('ofb_'));
  assert.ok(r.startsWith('orb_'));
  assert.notEqual(f, r);
});

test('ids never depend on array element order being pre-sorted', () => {
  // Different content → different ids: order matters and is part of content.
  const a = distributionIdOf({bands: [1, 2, 3]});
  const b = distributionIdOf({bands: [3, 2, 1]});
  assert.notEqual(a, b);
});

test('the id namespace never collides across prefixes for equal content', () => {
  const content = {candidateId: 'same'};
  const ids = new Set([similarityIdOf(content), evidenceIdOf(content),
    scoreIdOf(content), profileIdOf(content)]);
  assert.equal(ids.size, 4);
});
