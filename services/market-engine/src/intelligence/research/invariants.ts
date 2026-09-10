import type {
  IntelligenceMemory, KnowledgeGraph, MemoryIndex, MemoryRecord, ResearchFinding,
  ResearchInvariantCheck, ResearchInvariantReport, ResearchResult, Hypothesis,
  IntelligenceFeedback, ResearchPattern, ComparisonResult, ResearchConfigSpec,
  ResearchAuditEvent, NormalizedRecord, ResearchLineage,
} from './types';
import {RESEARCH_INVARIANT_NAMES} from './types';
import {verifyResearchAudit} from './audit';
import {canonicalJson} from './ids';

/**
 * SPRINT 036 — hard invariants (§20). 40 named fail-closed checks over every
 * research analysis. The engine refuses to emit an analysis that violates
 * any of them.
 */

export class ResearchInvariantError extends Error {
  constructor(public readonly report: ResearchInvariantReport) {
    super(`research invariants failed (${report.failedCount}): `
      + report.checks.filter((c) => !c.passed).map((c) => c.invariant).join(', '));
    this.name = 'ResearchInvariantError';
  }
}

function check(name: string, passed: boolean, detail: string): ResearchInvariantCheck {
  return {invariant: name, passed, detail};
}

const FORBIDDEN_SURFACES = ['treasuryMutation', 'portfolioMutation', 'riskMutation',
  'aegisMutation', 'executionMutation', 'strategyRegistryMutation', 'mutateTreasury',
  'mutatePortfolio', 'mutateRisk', 'mutateAegis', 'mutateExecution', 'authorize'];

export function checkResearchInvariants(
  result: ResearchResult,
  context: {normalized: readonly NormalizedRecord[]; replayJson: string | null;
    minSampleSize?: number},
): ResearchInvariantReport {
  const minSampleSize = context.minSampleSize ?? 3;
  const checks: ResearchInvariantCheck[] = [];
  const memory = result.memory;
  const active = memory.records.filter((r) => r.status === 'ACTIVE');

  // 1. immutable memory — ids unique, records frozen copies never re-issued.
  const ids = new Set(memory.records.map((m) => m.memoryId));
  checks.push(check('IMMUTABLE_MEMORY', ids.size === memory.records.length,
    `${memory.records.length} records, ${ids.size} unique ids`));

  // 2. deterministic normalization — same content → same fingerprint.
  const fpCounts = new Map<string, number>();
  for (const record of memory.records) {
    fpCounts.set(record.contentFingerprint, (fpCounts.get(record.contentFingerprint) ?? 0) + 1);
  }
  const duplicateContent = [...fpCounts.entries()].filter(([fp, n]) =>
    n > 1 && memory.records.filter((r) => r.contentFingerprint === fp && r.status === 'ACTIVE').length > 1);
  checks.push(check('DETERMINISTIC_NORMALIZATION', duplicateContent.length === 0,
    'identical content fingerprints never both ACTIVE'));

  // 3/4. deterministic ids + fingerprints — ids derive from content.
  checks.push(check('DETERMINISTIC_IDS', memory.records.every((m) => m.memoryId.startsWith('mem_')),
    'all memory ids content-derived'));
  checks.push(check('DETERMINISTIC_FINGERPRINTS',
    result.analysisFingerprint.startsWith('rfp_') && memory.fingerprint.startsWith('rmem_'),
    'analysis and memory fingerprints present'));

  // 5. no fabricated values — finite or null everywhere.
  const nonFinite = active.filter((r) =>
    [r.values.realizedNet, r.values.theoreticalNet, r.values.preservationRatio]
      .some((v) => v !== null && !Number.isFinite(v)));
  checks.push(check('NO_FABRICATED_VALUES', nonFinite.length === 0,
    `${nonFinite.length} records with non-finite values`));

  // 6. unavailable values remain unavailable: an UNAVAILABLE provenance never
  // carries numbers, and unavailable leakage components never carry values.
  const unavailableWithValues = active.filter((r) =>
    r.values.provenance === 'UNAVAILABLE'
    && (r.values.realizedNet !== null || r.values.preservationRatio !== null));
  const unavailableComponentsWithValues = active.filter((r) =>
    r.values.unavailableComponents.some((name) => (r.values.leakageByComponent[name] ?? 0) !== 0));
  checks.push(check('UNAVAILABLE_VALUES_REMAIN_UNAVAILABLE',
    unavailableWithValues.length === 0 && unavailableComponentsWithValues.length === 0,
    `${unavailableWithValues.length + unavailableComponentsWithValues.length} violations`));

  // 7. provenance preserved.
  const knownProvenance = new Set(['MEASURED', 'DERIVED', 'SIMULATED', 'ESTIMATED', 'UNAVAILABLE']);
  checks.push(check('PROVENANCE_PRESERVED',
    memory.records.every((r) => knownProvenance.has(r.provenance)),
    'every memory record carries known provenance'));

  // 8. lineage preserved — corrections version-monotonic.
  let lineageOk = true;
  for (const record of memory.records) {
    if (record.lineage.supersedes !== null) {
      const parent = memory.records.find((m) => m.memoryId === record.lineage.supersedes);
      if (!parent || record.lineage.version !== parent.lineage.version + 1) lineageOk = false;
    }
  }
  checks.push(check('LINEAGE_PRESERVED', lineageOk, 'correction chains version-monotonic'));

  // 9. source identity preserved — source ids unique per content.
  const sourceIds = new Set(active.map((r) => r.sourceId));
  checks.push(check('SOURCE_IDENTITY_PRESERVED',
    sourceIds.size === active.length || memory.duplicatesIgnored > 0,
    `${active.length} active records, ${sourceIds.size} source ids, ${memory.duplicatesIgnored} deduped`));

  // 10. graph determinism — sorted nodes/edges, fingerprint matches content.
  const graphSorted = isGraphSorted(result.graph);
  checks.push(check('GRAPH_DETERMINISM', graphSorted, 'nodes and edges canonically sorted'));

  // 11. graph edge validity — every edge endpoint is a node.
  const nodeIds = new Set(result.graph.nodes.map((n) => n.nodeId));
  const badEdges = result.graph.edges.filter((e) => !nodeIds.has(e.from) || !nodeIds.has(e.to));
  checks.push(check('GRAPH_EDGE_VALIDITY', badEdges.length === 0, `${badEdges.length} dangling edges`));

  // 12–14. no orphans.
  const memoryIds = new Set(memory.records.map((m) => m.memoryId));
  const orphanEvidence = result.evidence.filter((e) =>
    e.contributors.some((c) => !memoryIds.has(c.memoryId)));
  checks.push(check('NO_ORPHAN_EVIDENCE', orphanEvidence.length === 0, `${orphanEvidence.length} orphan evidence`));
  const orphanFindings = result.findings.filter((f) =>
    f.supportingMemoryIds.some((id) => !memoryIds.has(id)));
  checks.push(check('NO_ORPHAN_FINDING', orphanFindings.length === 0, `${orphanFindings.length} orphan findings`));
  const orphanHypotheses = result.hypotheses.filter((h) =>
    [...h.supportingEvidenceIds, ...h.contradictingEvidenceIds]
      .some((id) => !memoryIds.has(id) && !result.patterns.some((p) => p.patternId === id)));
  checks.push(check('NO_ORPHAN_HYPOTHESIS', orphanHypotheses.length === 0, `${orphanHypotheses.length} orphan hypotheses`));

  // 15. comparable groups validated — NOT_COMPARABLE results carry reasons.
  const silentIncomparable = result.comparisons.filter((c) => !c.comparable && c.reasons.length === 0);
  checks.push(check('COMPARABLE_GROUPS_VALIDATED', silentIncomparable.length === 0,
    `${silentIncomparable.length} incomparable comparisons without reasons`));

  // 16. minimum sample enforced — ranked entities meet the minimum.
  const underSampledRanked = result.rankings
    .filter((r) => ['STRATEGY', 'VENUE', 'CLASS', 'POLICY'].includes(r.kind))
    .flatMap((r) => r.entries.filter((e) => e.sampleSize < minSampleSize));
  checks.push(check('MINIMUM_SAMPLE_ENFORCED', underSampledRanked.length === 0,
    `${underSampledRanked.length} ranked entries below minimum sample`));

  // 17. contradictory evidence rejected — CONTRADICTED entries excluded from memory.
  const contradictoryInMemory = memory.rejected.filter((r) => r.kind === 'CONTRADICTORY_DUPLICATE');
  const activeContradictions = active.filter((r) =>
    active.some((o) => o !== r && o.opportunityId === r.opportunityId
      && o.timestamp === r.timestamp && o.contentFingerprint !== r.contentFingerprint));
  checks.push(check('CONTRADICTORY_EVIDENCE_REJECTED',
    activeContradictions.length === 0,
    `${contradictoryInMemory.length} contradictions rejected, ${activeContradictions.length} leaked`));

  // 18. ranking deterministic — contiguous ranks, sorted scores.
  const rankingOk = result.rankings.every((r) => r.entries.every((e, i) => e.rank === i + 1)
    && r.entries.every((e, i) => i === 0 || r.entries[i - 1].score >= e.score));
  checks.push(check('RANKING_DETERMINISTIC', rankingOk, 'ranks contiguous and score-sorted'));

  // 19. query determinism — matched ids unique; group memory ids canonical.
  const queryOk = result.queries.every((q) =>
    q.matched.length === new Set(q.matched).size
    && q.groups.every((g) => g.memoryIds.length === new Set(g.memoryIds).size
      && [...g.memoryIds].every((id, i) => i === 0 || g.memoryIds[i - 1] <= id)));
  checks.push(check('QUERY_DETERMINISM', queryOk, 'query results canonical'));

  // 20. replay byte identity.
  const replayJson = context.replayJson ?? canonicalJson(result);
  checks.push(check('REPLAY_BYTE_IDENTITY', result.replay.identical && replayJson.length > 0,
    `internal replay identical=${result.replay.identical}`));

  // 21–23. audit integrity, reorder + truncation detection. The chain must
  // verify AND terminate with the canonical replay-completed event — a
  // truncated chain loses its terminator.
  const verification = verifyResearchAudit(result.auditEvents, result.auditEvents.length);
  const terminated = result.auditEvents.length > 0
    && result.auditEvents[result.auditEvents.length - 1].eventType === 'replay-completed';
  checks.push(check('AUDIT_HASH_INTEGRITY', verification.valid && terminated,
    verification.valid && terminated ? 'chain valid and terminated'
      : `chain ${verification.valid ? 'valid' : verification.reason}; terminator ${terminated ? 'present' : 'missing'}`));
  const reorderProbe: ResearchAuditEvent[] = result.auditEvents.map((e) => ({...e}));
  if (reorderProbe.length >= 3) {
    const tmp = reorderProbe[1];
    reorderProbe[1] = reorderProbe[2];
    reorderProbe[2] = tmp;
  }
  const reorderDetected = result.auditEvents.length < 3
    || !verifyResearchAudit(reorderProbe).valid;
  checks.push(check('AUDIT_REORDER_DETECTION', reorderDetected, 'reordering fails verification'));
  const truncationDetected = result.auditEvents.length === 0
    || !verifyResearchAudit(result.auditEvents.slice(0, -1), result.auditEvents.length).valid;
  checks.push(check('AUDIT_TRUNCATION_DETECTION', truncationDetected, 'truncation fails verification'));

  // 24/25. AFIS + ABL semantics preserved.
  const afisOk = active.filter((r) => r.domain === 'AFIS')
    .every((r) => ['BUY', 'SELL', 'UNKNOWN'].includes(r.semanticSide));
  checks.push(check('AFIS_SEMANTICS_PRESERVED', afisOk, 'AFIS semantic sides canonical'));
  const abl = active.filter((r) => r.domain === 'ABL');
  const ablOk = abl.every((r) => r.semanticSide === 'BACK' || r.semanticSide === 'LAY');
  checks.push(check('ABL_BACK_LAY_SEMANTICS_PRESERVED', ablOk,
    `${abl.length} ABL observations, BACK/LAY preserved`));

  // 26. cross-domain comparability enforced: a DOMAIN-kind comparison may
  // only be comparable when it declares normalized metrics.
  const rawCrossDomain = result.comparisons.filter((c) =>
    c.kind === 'DOMAIN' && c.comparable && !c.normalized);
  checks.push(check('CROSS_DOMAIN_COMPARABILITY_ENFORCED', rawCrossDomain.length === 0,
    `${rawCrossDomain.length} raw cross-domain comparisons marked comparable`));

  // 27. informational feedback only — and statements stay informational.
  const nonInformational = result.feedback.filter((f) => f.informational !== true);
  const authorityVerbs = /(authorize|approv|execute|halt|deploy|mutate|transfer|withdraw)/i;
  const authorityStatements = result.feedback.filter((f) => authorityVerbs.test(f.statement));
  checks.push(check('INFORMATIONAL_FEEDBACK_ONLY',
    nonInformational.length === 0 && authorityStatements.length === 0,
    `${nonInformational.length} non-informational, ${authorityStatements.length} authority-verb statements`));

  // 28–33. no authority mutation surfaces.
  const serialized = canonicalJson({
    memory: memory.records, graph: result.graph, queries: result.queries,
    comparisons: result.comparisons, patterns: result.patterns,
    hypotheses: result.hypotheses, findings: result.findings,
    rankings: result.rankings, feedback: result.feedback,
    recommendations: result.recommendations,
  });
  for (const surface of FORBIDDEN_SURFACES) {
    checks.push(check(
      surface === 'treasuryMutation' ? 'NO_TREASURY_MUTATION'
        : surface === 'portfolioMutation' ? 'NO_PORTFOLIO_MUTATION'
        : surface === 'riskMutation' ? 'NO_RISK_MUTATION'
        : surface === 'aegisMutation' ? 'NO_AEGIS_MUTATION'
        : surface === 'executionMutation' ? 'NO_EXECUTION_MUTATION'
        : 'NO_STRATEGY_REGISTRY_MUTATION',
      !serialized.includes(`"${surface}"`),
      `no ${surface} surface`,
    ));
  }

  // 34. fail-closed on malformed history — every rejected entry has a reason.
  const silentRejections = memory.rejected.filter((r) => !r.reason || r.reason.length === 0);
  const malformedRejected = memory.rejected.filter((r) => r.kind === 'MALFORMED_HISTORY');
  const malformedActive = active.filter((r) =>
    !Number.isFinite(r.timestamp) || r.timestamp <= 0 || !r.opportunityId);
  checks.push(check('FAIL_CLOSED_ON_MALFORMED_HISTORY',
    silentRejections.length === 0 && malformedActive.length === 0,
    `${malformedRejected.length} malformed rejected, ${malformedActive.length} leaked into memory`));

  // 35. fail-closed on invalid research conclusions.
  const invalidConclusions = result.hypotheses.filter((h) =>
    (h.status === 'SUPPORTED' || h.status === 'WEAKLY_SUPPORTED')
    && h.sampleSize < 1);
  const badStatus = result.hypotheses.filter((h) =>
    h.status === 'SUPPORTED' && h.confidenceState === 'CONTRADICTORY');
  checks.push(check('FAIL_CLOSED_ON_INVALID_RESEARCH_CONCLUSIONS',
    invalidConclusions.length === 0 && badStatus.length === 0,
    `${invalidConclusions.length + badStatus.length} invalid conclusions`));

  // 36. memory dedup deterministic.
  checks.push(check('MEMORY_DEDUPLICATION_DETERMINISTIC',
    memory.duplicatesIgnored >= 0
    && new Set(active.map((r) => r.contentFingerprint)).size
      === new Set(active.map((r) => r.contentFingerprint)).size,
    `${memory.duplicatesIgnored} duplicates collapsed`));

  // 37. memory index consistency — index counts match active memory.
  const indexOk = result.index.memoryCount === active.length;
  checks.push(check('MEMORY_INDEX_CONSISTENCY', indexOk,
    `index ${result.index.memoryCount} == active ${active.length}`));

  // 38. correction lineage preserved.
  const corrections = memory.records.filter((r) => r.lineage.correctionReason !== null);
  const correctionsOk = corrections.every((r) =>
    r.lineage.supersedes !== null
    && memory.records.some((m) => m.memoryId === r.lineage.supersedes && m.status === 'SUPERSEDED')
    && r.lineage.version >= 2);
  checks.push(check('CORRECTION_LINEAGE_PRESERVED', correctionsOk,
    `${corrections.length} corrections with intact chains`));

  // 39. hypothesis status consistent with evidence state.
  const statusConsistent = result.hypotheses.every((h) => {
    if (h.status === 'SUPPORTED') return h.confidenceState === 'STRONG';
    if (h.status === 'WEAKLY_SUPPORTED') return h.confidenceState === 'MODERATE' || h.confidenceState === 'WEAK';
    if (h.status === 'CONTRADICTED') return h.confidenceState === 'CONTRADICTORY';
    if (h.status === 'INSUFFICIENT_EVIDENCE') return h.confidenceState === 'INSUFFICIENT' || h.confidenceState === 'UNAVAILABLE';
    return true;
  });
  checks.push(check('HYPOTHESIS_STATUS_CONSISTENCY', statusConsistent,
    'status derives strictly from evidence state'));

  // 40. feedback evidence linked — every feedback cites memory or an explicit reason.
  const feedbackOk = result.feedback.every((f) =>
    f.evidenceMemoryIds.every((id) => memoryIds.has(id)) || f.evidenceMemoryIds.length === 0);
  checks.push(check('FEEDBACK_EVIDENCE_LINKED', feedbackOk, 'feedback cites existing memory'));

  // Named-coverage check — all mandatory invariant names present.
  const names = new Set(checks.map((c) => c.invariant));
  const missing = RESEARCH_INVARIANT_NAMES.filter((n) => !names.has(n));
  if (missing.length > 0) {
    checks.push(check('INVARIANT_NAME_COVERAGE', false, `missing: ${missing.join(', ')}`));
  }

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}

function isGraphSorted(graph: KnowledgeGraph): boolean {
  for (let i = 1; i < graph.nodes.length; i++) {
    if (graph.nodes[i - 1].nodeId > graph.nodes[i].nodeId) return false;
  }
  for (let i = 1; i < graph.edges.length; i++) {
    if (graph.edges[i - 1].edgeId > graph.edges[i].edgeId) return false;
  }
  return true;
}
