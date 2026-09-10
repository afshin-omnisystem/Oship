import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph, edgesAtNode} from '../graph';
import {buildEntities} from '../knowledge';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — knowledge graph tests (§6): deterministic, fingerprinted,
 * aggregated edges; node types and relations cover the full analytical chain.
 */

const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_graph_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const active = activeMemory(memory);

test('the graph is built and fingerprinted deterministically', () => {
  assert.ok(result.graph.nodeCount > 0);
  assert.ok(result.graph.edgeCount > 0);
  assert.ok(result.graph.fingerprint.startsWith('rgrp_'));
  const rebuilt = buildGraph(result.memory.records, result.entities, result.comparisons,
    result.patterns, result.hypotheses, result.findings,
    {patternToHypothesis: []});
  // Same nodes/edge count (links add PATTERN_SUPPORTS edges only).
  assert.equal(rebuilt.nodeCount, result.graph.nodeCount);
});

test('nodes carry at least the 12 canonical types', () => {
  const types = new Set(result.graph.nodes.map((n) => n.type));
  for (const type of ['OPPORTUNITY', 'OPPORTUNITY_CLASS', 'STRATEGY', 'VENUE', 'POLICY',
    'OUTCOME', 'LEAKAGE_TYPE', 'FINDING', 'HYPOTHESIS', 'DOMAIN', 'PATTERN']) {
    assert.ok(types.has(type as never), `${type} nodes must exist`);
  }
  assert.ok(types.size >= 12);
});

test('every node id is content-derived and unique', () => {
  const ids = result.graph.nodes.map((n) => n.nodeId);
  assert.equal(new Set(ids).size, ids.length);
  for (const node of result.graph.nodes) {
    assert.ok(node.nodeId.startsWith('node_'));
    assert.ok(node.fingerprint.length > 0);
    assert.ok(typeof node.key === 'string' && node.key.length > 0);
  }
});

test('edges are aggregated — no duplicate (from, to, relation) pairs', () => {
  const seen = new Set<string>();
  for (const edge of result.graph.edges) {
    const key = `${edge.from}|${edge.to}|${edge.relation}`;
    assert.ok(!seen.has(key), `duplicate edge ${key}`);
    seen.add(key);
  }
});

test('edges carry canonical relations with weights', () => {
  const relations = new Set(result.graph.edges.map((e) => e.relation));
  for (const relation of ['OPPORTUNITY_USED_STRATEGY', 'OPPORTUNITY_EXECUTED_AT',
    'OPPORTUNITY_RESULTED_IN', 'OPPORTUNITY_LEAKED_BY', 'STRATEGY_PERFORMED_ON',
    'VENUE_PERFORMED_ON', 'POLICY_PERFORMED_ON']) {
    assert.ok(relations.has(relation as never), `${relation} edges must exist`);
  }
  assert.ok(relations.size >= 12);
  for (const edge of result.graph.edges) {
    assert.ok(edge.edgeId.startsWith('edge_'));
    assert.ok(Number.isFinite(edge.weight));
    assert.ok(edge.weight >= 1, 'aggregated edges carry occurrence weights');
  }
});

test('every edge endpoint resolves to a real node — no orphans', () => {
  const ids = new Set(result.graph.nodes.map((n) => n.nodeId));
  for (const edge of result.graph.edges) {
    assert.ok(ids.has(edge.from), `edge from ${edge.from} must resolve`);
    assert.ok(ids.has(edge.to), `edge to ${edge.to} must resolve`);
  }
});

test('edgesAtNode returns the adjacency of a node deterministically', () => {
  const guardianNode = result.graph.nodes.find((n) => n.type === 'STRATEGY' && n.key === 'arb-guardian')!;
  const at = edgesAtNode(result.graph, guardianNode.nodeId);
  assert.ok(at.length > 0);
  const again = edgesAtNode(result.graph, guardianNode.nodeId);
  assert.deepEqual(at.map((e) => e.edgeId), again.map((e) => e.edgeId));
});

test('the graph is stable under record re-ordering', () => {
  const shuffled = [...result.memory.records].reverse();
  const rebuilt = buildGraph(shuffled, result.entities, result.comparisons,
    result.patterns, result.hypotheses, result.findings, {patternToHypothesis: []});
  assert.equal(rebuilt.fingerprint, buildGraph(result.memory.records, result.entities,
    result.comparisons, result.patterns, result.hypotheses, result.findings,
    {patternToHypothesis: []}).fingerprint);
});

test('pattern→hypothesis links create PATTERN_SUPPORTS edges', () => {
  const links = result.patterns.slice(0, 3).map((p) => ({
    patternId: p.patternId, hypothesisId: result.hypotheses[0].hypothesisId,
  }));
  const withLinks = buildGraph(result.memory.records, result.entities, result.comparisons,
    result.patterns, result.hypotheses, result.findings, {patternToHypothesis: links});
  const withoutLinks = buildGraph(result.memory.records, result.entities, result.comparisons,
    result.patterns, result.hypotheses, result.findings, {patternToHypothesis: []});
  const explicit = withLinks.edges.filter((e) => e.relation === 'PATTERN_SUPPORTS').length
    - withoutLinks.edges.filter((e) => e.relation === 'PATTERN_SUPPORTS').length;
  assert.equal(explicit, 3);
});

test('opportunity nodes exist for every memory record', () => {
  const opportunityNodes = result.graph.nodes.filter((n) => n.type === 'OPPORTUNITY');
  assert.equal(opportunityNodes.length, 65);
});

test('leakage-type nodes reflect the leakage taxonomy', () => {
  const leakageNodes = result.graph.nodes.filter((n) => n.type === 'LEAKAGE_TYPE').map((n) => n.key);
  for (const kind of ['SLIPPAGE', 'FEES', 'VENUE_LEAKAGE', 'PARTIAL_FILL_LEAKAGE']) {
    assert.ok(leakageNodes.includes(kind), `${kind} must be a leakage node`);
  }
});

test('an empty graph builds cleanly with zero nodes and edges', () => {
  const empty = buildGraph([], [], [], [], [], [], {patternToHypothesis: []});
  assert.equal(empty.nodeCount, 0);
  assert.equal(empty.edgeCount, 0);
  assert.ok(empty.fingerprint.startsWith('rgrp_'));
});

test('the full-corpus graph is deterministic across rebuilds', () => {
  const g1 = buildGraph(active, buildEntities(active, config), [], [], [], [], {patternToHypothesis: []});
  const g2 = buildGraph(active, buildEntities(active, config), [], [], [], [], {patternToHypothesis: []});
  assert.equal(g1.fingerprint, g2.fingerprint);
});
