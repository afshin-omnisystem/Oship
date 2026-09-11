import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  learningHash, canonicalJson, observationIdOf, signalIdOf, priorityIdOf,
  feedbackIdOf, contentFingerprintOf, analysisFingerprintOf, learningAnalysisIdOf,
} from '../ids';

/**
 * SPRINT 037 — identifier tests: content-derived, deterministic, order-free.
 */

test('learningHash is a stable 64-hex sha256 over canonical JSON', () => {
  const hash = learningHash({b: 2, a: 1});
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, learningHash({a: 1, b: 2}));
});

test('canonicalJson makes key order irrelevant', () => {
  assert.equal(canonicalJson({x: 1, y: {b: 2, a: 1}}), canonicalJson({y: {a: 1, b: 2}, x: 1}));
});

test('observation ids use the lob_ prefix and are content-derived', () => {
  const id = observationIdOf({memoryId: 'mem_x'});
  assert.match(id, /^lob_[0-9a-f]{24}$/);
  assert.equal(id, observationIdOf({memoryId: 'mem_x'}));
  assert.notEqual(id, observationIdOf({memoryId: 'mem_y'}));
});

test('signal ids use the lsg_ prefix', () => {
  assert.match(signalIdOf({subject: 'a'}), /^lsg_[0-9a-f]{24}$/);
});

test('priority ids use the lpr_ prefix', () => {
  assert.match(priorityIdOf({subject: 'a'}), /^lpr_[0-9a-f]{24}$/);
});

test('feedback ids use the lfb_ prefix', () => {
  assert.match(feedbackIdOf({subject: 'a'}), /^lfb_[0-9a-f]{24}$/);
});

test('content fingerprints use the lcfp_ prefix', () => {
  assert.match(contentFingerprintOf({x: 1}), /^lcfp_[0-9a-f]{24}$/);
});

test('analysis fingerprints use the lfp_ prefix', () => {
  assert.match(analysisFingerprintOf({x: 1}), /^lfp_[0-9a-f]{24}$/);
});

test('learning analysis ids use the lres_ prefix', () => {
  assert.match(learningAnalysisIdOf({x: 1}), /^lres_[0-9a-f]{24}$/);
});

test('identical content under different key order yields identical ids', () => {
  const a = signalIdOf({subject: 's', evidence: ['e1', 'e2'], meta: {b: 1, a: 2}});
  const b = signalIdOf({meta: {a: 2, b: 1}, evidence: ['e1', 'e2'], subject: 's'});
  assert.equal(a, b);
});

test('nested arrays keep their order in canonical JSON (order matters where it should)', () => {
  const a = learningHash({list: ['x', 'y']});
  const b = learningHash({list: ['y', 'x']});
  assert.notEqual(a, b);
});

test('different prefixes separate the id namespaces', () => {
  const content = {same: 'content'};
  const ids = [observationIdOf(content), signalIdOf(content), priorityIdOf(content),
    feedbackIdOf(content), contentFingerprintOf(content)];
  assert.equal(new Set(ids).size, ids.length);
});
