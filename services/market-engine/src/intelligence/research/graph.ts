import type {
  ComparisonResult, KnowledgeEdge, KnowledgeEntity, KnowledgeGraph, KnowledgeNode,
  KnowledgeNodeType, KnowledgeRelation, MemoryRecord, ResearchPattern,
  ResearchFinding, Hypothesis,
} from './types';
import {LEAKAGE_COMPONENTS} from '../closed-loop/types';
import {edgeIdOf, graphFingerprintOf, nodeIdOf} from './ids';

/**
 * SPRINT 036 — deterministic analytical knowledge graph (§6).
 *
 * Construction is a pure function of (memory, entities, comparisons,
 * patterns, hypotheses, findings): identical inputs yield an identical,
 * fingerprinted graph. Edges are aggregated (same relation + endpoints →
 * one edge, weight = observation count).
 */

export interface GraphIntelligenceLinks {
  readonly patternToHypothesis: readonly {readonly patternId: string; readonly hypothesisId: string}[];
}

function nodeKey(type: KnowledgeNodeType, key: string): string {
  return nodeIdOf({type, key});
}

export function buildGraph(
  records: readonly MemoryRecord[],
  entities: readonly KnowledgeEntity[],
  comparisons: readonly ComparisonResult[],
  patterns: readonly ResearchPattern[],
  hypotheses: readonly Hypothesis[],
  findings: readonly ResearchFinding[],
  links: GraphIntelligenceLinks,
): KnowledgeGraph {
  const nodes = new Map<string, KnowledgeNode>();
  const edges = new Map<string, KnowledgeEdge>();

  const addNode = (type: KnowledgeNodeType, key: string): string => {
    const nodeId = nodeKey(type, key);
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, Object.freeze({nodeId, type, key, fingerprint: nodeIdOf({type, key, node: true})}));
    }
    return nodeId;
  };
  const addEdge = (from: string, to: string, relation: KnowledgeRelation): void => {
    const edgeId = edgeIdOf({from, to, relation});
    const existing = edges.get(edgeId);
    if (existing) {
      edges.set(edgeId, Object.freeze({...existing, weight: existing.weight + 1}));
    } else {
      edges.set(edgeId, Object.freeze({edgeId, from, to, relation, weight: 1,
        fingerprint: edgeIdOf({from, to, relation, edge: true})}));
    }
  };

  const active = records.filter((r) => r.status === 'ACTIVE');

  // Domain + entity nodes.
  for (const entity of entities) {
    const type: KnowledgeNodeType = entity.kind === 'STRATEGY' ? 'STRATEGY'
      : entity.kind === 'VENUE' ? 'VENUE'
      : entity.kind === 'OPPORTUNITY_CLASS' ? 'OPPORTUNITY_CLASS'
      : entity.kind === 'POLICY' ? 'POLICY' : 'DOMAIN';
    addNode(type, entity.key);
  }

  for (const record of active) {
    const opportunityNode = addNode('OPPORTUNITY', record.opportunityId);
    addNode('DOMAIN', record.domain);
    const strategyNode = addNode('STRATEGY', record.strategyId);
    const policyNode = addNode('POLICY', `${record.policyId}@${record.policyVersion}`);
    const classNode = addNode('OPPORTUNITY_CLASS', record.opportunityClass);
    const outcomeNode = addNode('OUTCOME', record.values.outcome);
    addEdge(opportunityNode, strategyNode, 'OPPORTUNITY_USED_STRATEGY');
    addEdge(opportunityNode, policyNode, 'OPPORTUNITY_USED_POLICY');
    addEdge(opportunityNode, outcomeNode, 'OPPORTUNITY_RESULTED_IN');
    addEdge(strategyNode, classNode, 'STRATEGY_PERFORMED_ON');
    addEdge(policyNode, classNode, 'POLICY_PERFORMED_ON');
    for (const venue of record.venues) {
      const venueNode = addNode('VENUE', venue);
      addEdge(opportunityNode, venueNode, 'OPPORTUNITY_EXECUTED_AT');
      addEdge(venueNode, classNode, 'VENUE_PERFORMED_ON');
    }
    if (record.values.riskImpact !== 'NO_CONSTRAINT') {
      const riskNode = addNode('RISK_PROFILE', record.values.riskImpact);
      addEdge(opportunityNode, riskNode, 'OPPORTUNITY_CONSTRAINED_BY');
    }
    // Leakage edges: the dominant leakage components of this observation.
    const components = LEAKAGE_COMPONENTS
      .map((name) => ({name, value: record.values.leakageByComponent[name] ?? 0}))
      .filter((c) => c.value > 1e-9)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, 3);
    for (const component of components) {
      const leakNode = addNode('LEAKAGE_TYPE', component.name);
      addEdge(opportunityNode, leakNode, 'OPPORTUNITY_LEAKED_BY');
    }
  }

  // Comparison-derived dominance edges.
  for (const comparison of comparisons) {
    if (!comparison.comparable || comparison.winner === 'NONE') continue;
    const winnerKey = comparison.winner === 'A' ? comparison.subjectA : comparison.subjectB;
    const loserKey = comparison.winner === 'A' ? comparison.subjectB : comparison.subjectA;
    if (comparison.kind === 'STRATEGY') {
      addEdge(addNode('STRATEGY', winnerKey), addNode('STRATEGY', loserKey), 'STRATEGY_OUTPERFORMED');
    } else if (comparison.kind === 'VENUE') {
      addEdge(addNode('VENUE', winnerKey), addNode('VENUE', loserKey), 'VENUE_OUTPERFORMED');
    }
  }

  // Pattern nodes.
  for (const pattern of patterns) {
    const patternNode = addNode('PATTERN', pattern.patternId);
    for (const memoryId of pattern.evidenceMemoryIds) {
      const source = active.find((r) => r.memoryId === memoryId);
      if (source) addEdge(addNode('OPPORTUNITY', source.opportunityId), patternNode, 'PATTERN_SUPPORTS');
    }
  }

  // Hypothesis + evidence edges.
  for (const hypothesis of hypotheses) {
    const hypothesisNode = addNode('HYPOTHESIS', hypothesis.hypothesisId);
    for (const memoryId of [...hypothesis.supportingEvidenceIds, ...hypothesis.contradictingEvidenceIds]) {
      const source = active.find((r) => r.memoryId === memoryId);
      if (source) addEdge(hypothesisNode, addNode('OPPORTUNITY', source.opportunityId), 'HYPOTHESIS_SUPPORTED_BY');
    }
  }
  for (const link of links.patternToHypothesis) {
    const from = nodes.get(nodeKey('PATTERN', link.patternId));
    const to = nodes.get(nodeKey('HYPOTHESIS', link.hypothesisId));
    if (from && to) addEdge(from.nodeId, to.nodeId, 'PATTERN_SUPPORTS');
  }

  // Finding + evidence edges.
  for (const finding of findings) {
    const findingNode = addNode('FINDING', finding.findingId);
    for (const memoryId of finding.supportingMemoryIds) {
      const source = active.find((r) => r.memoryId === memoryId);
      if (source) {
        addEdge(findingNode, addNode('OPPORTUNITY', source.opportunityId), 'FINDING_DERIVED_FROM');
        addEdge(addNode('OPPORTUNITY', source.opportunityId), findingNode, 'EVIDENCE_SUPPORTS');
      }
    }
  }

  const nodeList = [...nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const edgeList = [...edges.values()].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  return Object.freeze({
    nodes: Object.freeze(nodeList),
    edges: Object.freeze(edgeList),
    nodeCount: nodeList.length,
    edgeCount: edgeList.length,
    fingerprint: graphFingerprintOf({
      nodes: nodeList.map((n) => [n.nodeId, n.type, n.key]),
      edges: edgeList.map((e) => [e.edgeId, e.from, e.to, e.relation, e.weight]),
    }),
  });
}

/** All edges at a node (analytical adjacency). */
export function edgesAtNode(graph: KnowledgeGraph, nodeId: string): readonly KnowledgeEdge[] {
  return graph.edges.filter((e) => e.from === nodeId || e.to === nodeId)
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId));
}
