import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildKnowledgeIndex, getEntity, entitiesOfKind} from '../knowledge-index';
import {buildEntities} from '../knowledge';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — knowledge index tests: deterministic lookup over the aggregated
 * analytical entities; missing entities return null, never a fabrication.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_ki_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const entities = buildEntities(activeMemory(memory), config);
const index = buildKnowledgeIndex(entities);

test('the index counts every entity exactly once', () => {
  assert.equal(index.entityCount, entities.length);
  assert.ok(Object.isFrozen(index));
});

test('entities are retrievable by kind and key', () => {
  const guardian = getEntity(index, 'STRATEGY', 'arb-guardian');
  assert.ok(guardian);
  assert.equal(guardian!.observationCount, 30);
  const afis = getEntity(index, 'DOMAIN', 'AFIS');
  assert.equal(afis!.observationCount, 60);
});

test('missing entities return null — never invented', () => {
  assert.equal(getEntity(index, 'STRATEGY', 'no-such-strategy'), null);
  assert.equal(getEntity(index, 'VENUE', 'venue-z'), null);
});

test('entitiesOfKind returns complete canonical lists', () => {
  const strategies = entitiesOfKind(index, 'STRATEGY');
  assert.ok(strategies.length >= 3);
  assert.deepEqual(strategies.map((e) => e.key), [...strategies.map((e) => e.key)].sort());
  const domains = entitiesOfKind(index, 'DOMAIN');
  assert.deepEqual(domains.map((e) => e.key).sort(), ['ABL', 'AFIS']);
});

test('kinds with no entities return an empty list', () => {
  const empty = buildKnowledgeIndex([]);
  assert.equal(empty.entityCount, 0);
  assert.deepEqual(entitiesOfKind(empty, 'STRATEGY'), []);
  assert.equal(getEntity(empty, 'STRATEGY', 'arb-guardian'), null);
});

test('the index is deterministic', () => {
  const again = buildKnowledgeIndex(buildEntities(activeMemory(memory), config));
  assert.deepEqual(index.byKind, again.byKind);
});

test('indexed entities are the same frozen objects', () => {
  const guardian = getEntity(index, 'STRATEGY', 'arb-guardian')!;
  assert.ok(Object.isFrozen(guardian));
  assert.equal(guardian, entities.find((e) => e.kind === 'STRATEGY' && e.key === 'arb-guardian'));
});

test('venue entities include both corpus venues', () => {
  const venues = entitiesOfKind(index, 'VENUE').map((e) => e.key);
  assert.ok(venues.includes('venue-a'));
  assert.ok(venues.includes('venue-b'));
});

test('policy entities keep versioned keys distinct', () => {
  const v1 = getEntity(index, 'POLICY', 'policy-execution@v1')!;
  const v11 = getEntity(index, 'POLICY', 'policy-execution@v1.1')!;
  assert.notEqual(v1.fingerprint, v11.fingerprint);
  assert.equal(v1.key, 'policy-execution@v1');
  assert.equal(v11.key, 'policy-execution@v1.1');
});

test('class entities cover the rotated corpus classes', () => {
  const classes = entitiesOfKind(index, 'OPPORTUNITY_CLASS').map((e) => e.key);
  for (const expected of ['cross-venue-arbitrage', 'liquidity-imbalance', 'funding',
    'basis', 'triangular-arbitrage', 'surebet']) {
    assert.ok(classes.includes(expected), `${expected} must be indexed`);
  }
});

test('every entity kind is populated by the corpus', () => {
  for (const kind of ['STRATEGY', 'VENUE', 'OPPORTUNITY_CLASS', 'POLICY', 'DOMAIN'] as const) {
    assert.ok(entitiesOfKind(index, kind).length > 0, `${kind} must be populated`);
  }
});
