import {PolicyLineage, PolicyLineageNode, PolicyCandidate} from './types';
import {policyLineageFingerprint} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — policy lineage.
 *
 *   Policy v1 → Candidate v1.1 → Candidate v1.2 → Approved v2 → …
 *
 * Every candidate preserves its parent; historical policies stay immutable;
 * replay reconstructs the exact same lineage. The lineage is derived from the
 * ROOT policy and the candidate chain — it is never mutated in place.
 */

export interface PolicyLineageInput {
  readonly policyId: string;
  readonly rootVersion: string;
  readonly candidates: readonly PolicyCandidate[];
}

/** Build the canonical policy lineage: ROOT → candidates → approvals. */
export function buildPolicyLineage(input: PolicyLineageInput): PolicyLineage {
  const nodes: PolicyLineageNode[] = [];
  const rootBody = {
    policyId: input.policyId,
    version: input.rootVersion,
    kind: 'ROOT' as const,
    parentPolicyId: null,
    parentVersion: null,
  };
  nodes.push(Object.freeze({...rootBody, fingerprint: `pfln_${sha256(rootBody)}`}));

  // Candidates in deterministic creation order (candidateVersion sort).
  const ordered = [...input.candidates].sort((a, b) =>
    a.candidateVersion.localeCompare(b.candidateVersion) || a.candidateId.localeCompare(b.candidateId));
  for (const c of ordered) {
    const body = {
      policyId: input.policyId,
      version: c.candidateVersion,
      kind: 'CANDIDATE' as const,
      parentPolicyId: c.parentPolicyId,
      parentVersion: c.parentPolicyVersion,
      candidateFingerprint: c.fingerprint,
    };
    nodes.push(Object.freeze({...body, fingerprint: `pfln_${sha256(body)}`}));
    if (c.promotionState === 'APPROVED_CANDIDATE') {
      const approvedBody = {
        policyId: input.policyId,
        version: nextMajor(c.candidateVersion),
        kind: 'APPROVED' as const,
        parentPolicyId: input.policyId,
        parentVersion: c.candidateVersion,
        approvedFrom: c.candidateId,
      };
      nodes.push(Object.freeze({...approvedBody, fingerprint: `pfln_${sha256(approvedBody)}`}));
    }
  }

  const body = {nodes: Object.freeze(nodes)};
  return Object.freeze({...body, fingerprint: policyLineageFingerprint(body)});
}

/** v1.3 → v2; v2 → v3. */
function nextMajor(version: string): string {
  const major = parseInt(version.split('.')[0]!.replace(/^v/, ''), 10);
  if (!Number.isFinite(major)) throw new Error(`unparseable version ${version} — fail closed`);
  return `v${major + 1}`;
}

/**
 * Validate a lineage: starts at ROOT, every node's parent is an EARLIER node
 * (sibling candidates share a parent), versions strictly increase, and
 * APPROVED nodes descend from the candidate they approved.
 */
export function validatePolicyLineage(lineage: PolicyLineage): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (lineage.nodes.length === 0) violations.push('empty lineage');
  const root = lineage.nodes[0];
  if (root && root.kind !== 'ROOT') violations.push('lineage does not start at a ROOT node');
  for (let i = 1; i < lineage.nodes.length; i++) {
    const node = lineage.nodes[i];
    const earlier = lineage.nodes.slice(0, i);
    if (node.parentVersion === null || !earlier.some((n) => n.version === node.parentVersion)) {
      violations.push(`${node.version} parent ${node.parentVersion} is not an earlier lineage node`);
    }
    if (earlier.some((n) => n.version >= node.version)) {
      violations.push(`version not monotonic at ${node.version}`);
    }
  }
  return Object.freeze({valid: violations.length === 0, violations: Object.freeze(violations)});
}

/** The latest version in a lineage (deterministic max). */
export function latestVersion(lineage: PolicyLineage): string {
  return lineage.nodes[lineage.nodes.length - 1]?.version ?? 'v0';
}
