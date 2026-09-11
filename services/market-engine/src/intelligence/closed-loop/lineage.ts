import type {
  ClosedLoopRecordAnalysis, ClosedLoopLineage, ClosedLoopLineageNode, LifecycleStageKind,
} from './types';
import {lifecycleFingerprint} from './ids';
import {deterministicSort} from './source';

/**
 * SPRINT 035 — closed-loop lineage.
 *
 * The immutable record-level lineage of every analyzed opportunity run:
 * which record descended from which lifecycle stage chain, in analysis order.
 * Historical lineage is never rewritten.
 */

export function buildClosedLoopLineage(
  analyses: readonly ClosedLoopRecordAnalysis[],
): ClosedLoopLineage {
  const nodes: ClosedLoopLineageNode[] = analyses.map((a) => Object.freeze({
    opportunityId: a.identity.opportunityId,
    parentOpportunityId: null,
    stage: terminalStageOf(a),
    recordFingerprint: a.fingerprint,
    timestamp: a.lifecycle.stages[a.lifecycle.stages.length - 1]?.timestamp ?? 0,
  }));

  const ordered = deterministicSort(
    nodes,
    (n) => [n.timestamp, n.opportunityId],
    (n) => n.opportunityId,
  );

  const valid = ordered.every((n) => n.recordFingerprint.length > 0)
    && new Set(ordered.map((n) => n.opportunityId)).size === ordered.length;

  return Object.freeze({
    nodes: Object.freeze(ordered),
    depth: ordered.length,
    valid,
    fingerprint: lifecycleFingerprint(ordered.map((n) => [n.opportunityId, n.recordFingerprint, n.timestamp])),
  });
}

function terminalStageOf(a: ClosedLoopRecordAnalysis): LifecycleStageKind {
  return a.lifecycle.stages[a.lifecycle.stages.length - 1]?.stage ?? 'RESULT';
}

export function validateClosedLoopLineage(lineage: ClosedLoopLineage): boolean {
  if (!lineage.valid) return false;
  const ids = new Set<string>();
  for (const node of lineage.nodes) {
    if (ids.has(node.opportunityId)) return false;
    ids.add(node.opportunityId);
    if (node.parentOpportunityId !== null && !ids.has(node.parentOpportunityId)) return false;
  }
  return true;
}
