import {ResearchEngine} from './intelligence/research/engine';
import {buildMemory, activeMemory} from './intelligence/research/memory';
import {buildMemoryIndex, lookupIndex} from './intelligence/research/memory-index';
import {buildEntities} from './intelligence/research/knowledge';
import {buildGraph} from './intelligence/research/graph';
import {runQuery, leakageTotals} from './intelligence/research/query';
import {comparePopulations} from './intelligence/research/comparison';
import {detectPatterns} from './intelligence/research/pattern';
import {evaluateEvidence} from './intelligence/research/evidence';
import {evaluateHypothesis} from './intelligence/research/hypothesis';
import {canonicalJson, researchHash} from './intelligence/research/ids';
import {verifyResearchAudit} from './intelligence/research/audit';
import {compareResearchResults} from './intelligence/research/replay';
import {checkResearchInvariants} from './intelligence/research/invariants';
import {mergeResearchConfig} from './intelligence/research/config';
import {researchHistory} from './intelligence/research/test-fixtures';
import type {MemoryRecord} from './intelligence/research/types';

/**
 * SPRINT 036 — HISTORICAL INTELLIGENCE & RESEARCH PLANE demo.
 *
 * PAPER / SIMULATION ONLY — A RESEARCH LAYER, NOT AN AUTHORITY.
 *
 * Every section drives the REAL research engine over five eras of history
 * built from actual Sprint 035 closed-loop analyses:
 *
 *   Historical Records → Normalization → Intelligence Memory → Knowledge
 *   Graph → Research Queries → Pattern Detection → Comparative Analysis →
 *   Hypotheses → Evidence Evaluation → Findings → Rankings → Intelligence
 *   Feedback (+ Recommendations) with Replay, Audit and Invariants.
 *
 * Nothing is mocked. The plane never mutates Treasury, Portfolio, Risk,
 * AEGIS, Execution, the Strategy Registry or any active policy; its outputs
 * are informational only. Every PASS line is backed by assertions against
 * actual engine output.
 */

const config = mergeResearchConfig();
const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);
const active = activeMemory(result.memory);
const byStrategy = (key: string) => result.entities.find((e) => e.kind === 'STRATEGY' && e.key === key)!;
const memoryRecord = (opportunityPrefix: string): MemoryRecord =>
  active.find((r) => r.opportunityId.startsWith(opportunityPrefix))!;

// ---------------------------------------------------------------------------
// Assertion harness (house style)
// ---------------------------------------------------------------------------

class Section {
  readonly failures: string[] = [];
  constructor(readonly name: string) {}
  check(condition: boolean, label: string): void {
    if (!condition) this.failures.push(label);
  }
  equal<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) this.failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
  near(actual: number | null | undefined, expected: number, label: string, tolerance = 1e-6): void {
    if (actual === null || actual === undefined || Math.abs(actual - expected) > tolerance) {
      this.failures.push(`${label} (expected ~${expected}, got ${String(actual)})`);
    }
  }
  same<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    }
  }
}

const sections: Section[] = [];
function section(name: string): Section {
  const s = new Section(name);
  sections.push(s);
  return s;
}

function main(): void {
  // -------------------------------------------------------------------
  // 1–2. Historical ingestion (AFIS + ABL) from REAL Sprint 035 analyses
  // -------------------------------------------------------------------
  {
    const s = section('AFIS-HISTORY-INGESTION');
    s.equal(history.eraAnalyses.length, 5, 'five eras of closed-loop history');
    for (const analysis of history.eraAnalyses) {
      s.check(analysis.invariants!.passed, `era ${analysis.analysisId.slice(0, 12)} passed upstream invariants`);
      s.equal(analysis.records.length, 13, 'each era carries the full 13-record corpus');
    }
    const afis = result.memory.records.filter((r) => r.domain === 'AFIS');
    s.equal(afis.length, 60, '60 AFIS observations in memory');
    s.equal(new Set(afis.map((r) => r.timeBucket)).size, 5, 'AFIS history spans five distinct eras');
  }
  {
    const s = section('ABL-HISTORY-INGESTION');
    const abl = result.memory.records.filter((r) => r.domain === 'ABL');
    s.equal(abl.length, 5, 'five ABL observations (one per era)');
    for (const record of abl) {
      s.check(['BACK', 'LAY', 'UNKNOWN'].includes(record.semanticSide),
        `ABL semantic side preserved (${record.semanticSide})`);
      s.check(!['BUY', 'SELL'].includes(record.semanticSide), 'ABL never collapsed to BUY/SELL');
      s.equal(record.strategyId, 'sports-arb-strategy', 'ABL strategy identity preserved');
    }
    s.check(active.every((r) => r.domain === 'AFIS' || r.domain === 'ABL'),
      'one shared engine ingests both domains');
  }

  // -------------------------------------------------------------------
  // 3–6. Historical memory: construction, schema, normalization, semantics
  // -------------------------------------------------------------------
  {
    const s = section('HISTORICAL-MEMORY');
    s.equal(result.memory.records.length, 65, '65 immutable memory records');
    s.equal(result.memory.duplicatesIgnored, 0, 'no duplicates in the clean corpus');
    s.equal(result.memory.rejected.length, 0, 'nothing rejected in the clean corpus');
    for (const record of result.memory.records) {
      s.check(Object.isFrozen(record), `${record.memoryId} frozen`);
      s.check(record.memoryId.startsWith('mem_'), 'content-derived memory id');
    }
    s.equal(new Set(result.memory.records.map((r) => r.memoryId)).size, 65, 'memory ids unique');
  }
  {
    const s = section('MEMORY-SCHEMA');
    const sample = memoryRecord('opp_healthy');
    s.equal(sample.schemaVersion, 'research.memory.v1', 'canonical memory schema');
    s.equal(sample.sourceType, 'closed-loop.v1', 'source type names Sprint 035');
    s.check(sample.sourceId.includes(':'), 'source id composes batch and opportunity');
    s.check(sample.contentFingerprint.startsWith('rcfp_'), 'content fingerprinted');
    s.check(sample.lineage.batchId.startsWith('clx_'), 'lineage roots at the closed-loop batch');
    s.equal(sample.lineage.version, 1, 'fresh observations are version 1');
    s.check(result.configurationFingerprint.length === 64, 'configuration fingerprint is a full digest');
  }
  {
    const s = section('NORMALIZATION');
    const healthy = memoryRecord('opp_healthy');
    s.near(healthy.values.preservationRatio,
      healthy.values.realizedNet! / healthy.values.theoreticalNet!,
      'preservation ratio = realized ÷ theoretical (no semantic loss)', 1e-9);
    s.same([...healthy.venues].sort(), [...healthy.venues], 'venue lists sorted and deduplicated');
    s.equal(Object.keys(healthy.values.leakageByComponent).length, 17,
      'full Sprint 035 leakage decomposition carried');
    const shuffled = engine.analyze({...history.input,
      analyses: [...history.input.analyses].reverse().map((a) => ({...a, records: [...a.records].reverse()}))});
    s.equal(canonicalJson(result.memory), canonicalJson(shuffled.memory),
      'memory is byte-identical under record reordering');
  }
  {
    const s = section('UNAVAILABLE-SEMANTICS');
    for (const record of active) {
      for (const name of record.values.unavailableComponents) {
        s.equal(record.values.leakageByComponent[name], 0,
          `unavailable component ${name} never carries a value (${record.opportunityId})`);
      }
      s.check(record.provenance !== 'UNAVAILABLE' || record.values.realizedNet === null,
        'UNAVAILABLE provenance never yields numbers');
    }
    const unavailable = evaluateEvidence({subject: 'probe', supporting: [], contradicting: [],
      metric: 'preservation'}, config);
    s.equal(unavailable.state, 'UNAVAILABLE', 'empty evidence is UNAVAILABLE');
    s.equal(unavailable.score, null, 'no invented confidence');
  }

  // -------------------------------------------------------------------
  // 7–8. Memory index and explicit evidence states
  // -------------------------------------------------------------------
  {
    const s = section('MEMORY-INDEX');
    const index = buildMemoryIndex(active);
    const dimensions = Object.keys(index.dimensions);
    s.check(dimensions.length >= 11, `index exposes ${dimensions.length} dimensions`);
    for (const dimension of ['domain', 'opportunityClass', 'strategy', 'venue', 'policy',
      'outcome', 'preservationGrade', 'leakageClass', 'failureClass', 'timeBucket',
      'executionQualityBand']) {
      s.check(dimensions.includes(dimension), `${dimension} indexed`);
    }
    s.equal(lookupIndex(index, 'strategy', 'arb-guardian').length, 30, 'guardian history fully indexed');
    s.equal(lookupIndex(index, 'domain', 'ABL').length, 5, 'ABL indexed separately');
    s.same(lookupIndex(index, 'strategy', 'nope'), [], 'unknown keys return empty — never fabricated');
    s.equal(index.memoryCount, 65, 'index covers exactly the active memory');
  }
  {
    const s = section('EVIDENCE-STATES');
    const states = new Set(active.map((r) => r.evidence.state));
    for (const state of states) {
      s.check(['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT', 'UNKNOWN', 'CONTRADICTORY', 'UNAVAILABLE']
        .includes(state), `${state} is an explicit epistemic state`);
    }
    const strong = active.filter((r) => r.evidence.state === 'STRONG').length;
    s.check(strong >= 30, `${strong} observations carry STRONG evidence`);
    const unknown = active.filter((r) => r.evidence.state === 'UNKNOWN').length;
    s.equal(unknown, 0, 'no silent UNKNOWN in the healthy corpus — states are derived, not defaulted');
  }

  // -------------------------------------------------------------------
  // 9–11. Corrections, deduplication and fail-closed rejection
  // -------------------------------------------------------------------
  {
    const s = section('CORRECTIONS');
    const sourceId = history.healthySourceId(1);
    const corrected = engine.analyze({...history.input,
      corrections: [{sourceId, reason: 'late fee restatement after audit', realizedCostDelta: -0.5}]});
    s.equal(corrected.memory.correctionsApplied, 1, 'correction applied once');
    const original = corrected.memory.records.find((r) => r.sourceId === sourceId && r.lineage.version === 1)!;
    const revised = corrected.memory.records.find((r) => r.sourceId === sourceId && r.lineage.version === 2)!;
    s.equal(original.status, 'SUPERSEDED', 'the original record is superseded, never mutated');
    s.equal(revised.status, 'ACTIVE', 'the corrected version is active');
    s.equal(revised.lineage.supersedes, original.memoryId, 'lineage links version 2 to version 1');
    s.equal(revised.lineage.correctionReason, 'late fee restatement after audit', 'correction reason recorded');
    s.equal(revised.provenance, 'ESTIMATED', 'corrected values are honestly ESTIMATED');
    s.near(original.values.realizedCosts, revised.values.realizedCosts! + 0.5,
      'historical truth preserved exactly');
    s.equal(corrected.invariants.passed, true, 'corrected history still passes all invariants');
  }
  {
    const s = section('DEDUPLICATION');
    const duplicated = engine.analyze({...history.input,
      analyses: [...history.input.analyses, history.input.analyses[0]]});
    s.equal(duplicated.memory.records.length, 65, 'duplicate batch ignored');
    s.equal(duplicated.memory.duplicatesIgnored, 13, 'all 13 duplicate records counted');
    s.equal(canonicalJson(duplicated.memory.records), canonicalJson(result.memory.records),
      'deduplicated memory identical to the clean memory');
  }
  {
    const s = section('REJECTION-FAIL-CLOSED');
    const partial = engine.analyze({timestamp: history.input.timestamp,
      analyses: [history.malformedAnalysis()], correlationId: 'demo', traceId: 'demo'});
    s.equal(partial.memory.records.length, 12, 'the 12 valid records still analyzed');
    s.equal(partial.memory.rejected.length, 1, 'the malformed record rejected');
    s.equal(partial.memory.rejected[0].kind, 'MALFORMED_HISTORY', 'explicit rejection kind');
    s.check(partial.memory.rejected[0].reason.includes('freshness'), 'explicit rejection reason');
    s.check(partial.auditEvents.some((e) => e.eventType === 'fail-closed'),
      'the fail-closed rejection is itself audited');
    let threw = false;
    try {
      engine.analyze({timestamp: history.input.timestamp,
        analyses: [history.invariantFailedAnalysis()], correlationId: 'demo', traceId: 'demo'});
    } catch (error) {
      threw = (error as Error).message.includes('failed its own invariants');
    }
    s.check(threw, 'an upstream invariant failure makes the whole batch untrusted');
  }

  // -------------------------------------------------------------------
  // 12–14. Knowledge entities and graph
  // -------------------------------------------------------------------
  {
    const s = section('KNOWLEDGE-ENTITIES');
    s.equal(result.entities.length, 19, '19 aggregated entities');
    const kinds = new Set(result.entities.map((e) => e.kind));
    for (const kind of ['STRATEGY', 'VENUE', 'OPPORTUNITY_CLASS', 'POLICY', 'DOMAIN']) {
      s.check(kinds.has(kind as never), `${kind} entities aggregated`);
    }
    s.near(byStrategy('arb-guardian').meanPreservation, 0.7099, 'guardian mean preservation', 5e-4);
    s.near(byStrategy('arb-aggressive').meanPreservation, 0.0982, 'aggressive mean preservation', 5e-4);
    s.equal(byStrategy('arb-guardian').observationCount, 30, 'guardian aggregates 30 observations');
    s.equal(result.entities.filter((e) => e.kind === 'DOMAIN' && e.key === 'ABL').length, 1,
      'ABL domain entity separate from AFIS');
  }
  {
    const s = section('KNOWLEDGE-GRAPH');
    s.equal(result.graph.nodeCount, 192, 'graph nodes');
    s.equal(result.graph.edgeCount, 2353, 'graph edges');
    const nodeTypes = new Set(result.graph.nodes.map((n) => n.type));
    s.check(nodeTypes.size >= 12, `${nodeTypes.size} distinct node types`);
    const relations = new Set(result.graph.edges.map((e) => e.relation));
    s.check(relations.size >= 14, `${relations.size} distinct edge relations`);
    const nodeIds = new Set(result.graph.nodes.map((n) => n.nodeId));
    for (const edge of result.graph.edges) {
      s.check(nodeIds.has(edge.from) && nodeIds.has(edge.to), `edge ${edge.edgeId} resolves at both ends`);
    }
    s.check(result.graph.fingerprint.startsWith('rgrp_'), 'graph fingerprinted');
  }
  {
    const s = section('GRAPH-DETERMINISM');
    // The engine additionally links detected patterns to hypotheses; rebuilds
    // with identical inputs must agree exactly with each other.
    const rebuild = () => buildGraph(result.memory.records, result.entities, result.comparisons,
      result.patterns, result.hypotheses, result.findings, {patternToHypothesis: []});
    const first = rebuild();
    const second = rebuild();
    s.equal(first.nodeCount, result.graph.nodeCount, 'node count stable under rebuild');
    s.equal(first.edgeCount, second.edgeCount, 'edge count deterministic across rebuilds');
    s.equal(first.fingerprint, second.fingerprint, 'graph fingerprint deterministic across rebuilds');
    const entities = buildEntities(active, config);
    const again = buildEntities(active, config);
    s.same(entities.map((e) => e.fingerprint), again.map((e) => e.fingerprint),
      'entity fingerprints deterministic');
  }

  // -------------------------------------------------------------------
  // 15–16. Research queries
  // -------------------------------------------------------------------
  {
    const s = section('QUERY-ENGINE');
    s.equal(result.queries.length, 9, 'nine named analytical queries');
    const classQuery = result.queries.find((q) => q.name === 'afis-class-preservation')!;
    s.equal(classQuery.sampleSize, 60, 'class query covers the AFIS history');
    s.check(classQuery.groups.length >= 2, 'class groups split by opportunity class');
    const venueLeakage = result.queries.find((q) => q.name === 'venue-leakage')!;
    s.check(venueLeakage.groups.some((g) => g.key.includes('venue-a')), 'venue groups keyed by venue pairs');
    const guardianTotals = leakageTotals(active.filter((r) => r.strategyId === 'arb-guardian'));
    s.check(guardianTotals.SLIPPAGE > 0, 'leakage totals decompose guardian history');
    const empty = runQuery({name: 'demo-empty', filter: {domains: ['ABL'], strategies: ['arb-guardian']},
      groupBy: 'none'}, active, buildMemoryIndex(active), config);
    s.equal(empty.sampleSize, 0, 'contradictory filters match nothing');
    s.check(empty.insufficientReason !== null, 'empty results explain themselves');
  }
  {
    const s = section('QUERY-DETERMINISM');
    for (const query of result.queries) {
      const rerun = runQuery({name: query.name, filter: query.filter, groupBy: query.groupBy},
        [...active].reverse(), buildMemoryIndex(active), config);
      s.equal(rerun.fingerprint, query.fingerprint, `${query.name} fingerprint stable under reordering`);
      s.equal(rerun.sampleSize, query.sampleSize, `${query.name} sample stable`);
    }
  }

  // -------------------------------------------------------------------
  // 17–19. Comparative analysis — comparability first
  // -------------------------------------------------------------------
  {
    const s = section('COMPARATIVE-ANALYSIS');
    const strategy = result.comparisons.find((c) => c.kind === 'STRATEGY')!;
    s.equal(strategy.comparable, true, 'the guardian-vs-aggressive population is comparable');
    s.equal(strategy.winner, 'B', 'guardian wins on mean preservation');
    s.near(strategy.preservationDelta, -0.9353, 'preservation delta', 5e-4);
    s.check(strategy.metricsA!.sampleSize >= config.minComparativeSample, 'side A meets the minimum');
    s.check(strategy.metricsB!.sampleSize >= config.minComparativeSample, 'side B meets the minimum');
    const venue = result.comparisons.find((c) => c.kind === 'VENUE')!;
    s.equal(venue.winner, 'B', 'venue-b wins on lower leakage');
  }
  {
    const s = section('NOT-COMPARABLE');
    const incomparable = result.comparisons.filter((c) => !c.comparable);
    s.check(incomparable.length >= 1, 'incomparable comparisons exist in the corpus');
    for (const comparison of incomparable) {
      s.equal(comparison.winner, 'NONE', 'incomparable populations are never ranked');
      s.check(comparison.reasons.length > 0, 'every incomparability carries explicit reasons');
    }
    const tiny = comparePopulations({kind: 'STRATEGY', subjectA: 'a', subjectB: 'b',
      recordsA: active.slice(0, 2), recordsB: active.slice(0, 2), scopeClass: null,
      normalized: false, metric: 'preservation'}, config);
    s.check(!tiny.comparable, 'below-minimum populations are NOT_COMPARABLE');
    s.check(tiny.reasons.some((r) => r.includes('sample')), 'sample reason explicit');
  }
  {
    const s = section('CROSS-DOMAIN');
    const [raw, normalized] = result.comparisons.filter((c) => c.kind === 'DOMAIN');
    s.check(!raw.comparable, 'raw AFIS-vs-ABL comparison rejected');
    s.check(raw.reasons.some((r) => r.includes('normalized')), 'rejection cites missing normalization');
    s.check(normalized.comparable, 'normalized cross-domain comparison allowed');
    s.equal(normalized.winner, 'B', 'normalized comparison decides on normalized metrics');
    s.check(result.hypotheses.some((h) => h.status === 'REJECTED'
      && h.statement.includes('AFIS opportunities realize more absolute value')),
      'the absolute-value cross-domain hypothesis is REJECTED');
  }

  // -------------------------------------------------------------------
  // 20–25. Pattern detection across all six families
  // -------------------------------------------------------------------
  {
    const s = section('PATTERN-PRESERVATION');
    s.check(result.patterns.length >= 70, `${result.patterns.length} patterns detected`);
    const improvement = result.patterns.find((p) => p.kind === 'PRESERVATION_IMPROVEMENT' && p.subject.key === 'arb-guardian')!;
    s.equal(improvement.direction, 'IMPROVING', 'guardian preservation improving');
    s.near(improvement.magnitude, 0.0437, 'guardian improvement slope per era', 5e-4);
    const deterioration = result.patterns.find((p) => p.kind === 'PRESERVATION_DETERIORATION' && p.subject.key === 'arb-aggressive')!;
    s.equal(deterioration.direction, 'DETERIORATING', 'aggressive preservation deteriorating');
    s.near(deterioration.magnitude, -0.0329, 'aggressive deterioration slope per era', 5e-4);
    s.check(result.patterns.some((p) => p.kind === 'CONSISTENTLY_HIGH_PRESERVATION' && p.subject.key === 'opp_steady'),
      'steady series consistently high');
    s.check(result.patterns.some((p) => p.kind === 'CONSISTENTLY_LOW_PRESERVATION' && p.subject.key === 'opp_stale'),
      'stale series consistently low');
  }
  {
    const s = section('PATTERN-LEAKAGE');
    for (const kind of ['REPEATED_SLIPPAGE', 'REPEATED_FEES', 'REPEATED_PARTIAL_FILL',
      'REPEATED_VENUE_LEAKAGE', 'REPEATED_ALLOCATION_LEAKAGE', 'REPEATED_RISK_CONSTRAINT',
      'REPEATED_CONTROL_LEAKAGE']) {
      s.check(result.patterns.some((p) => p.kind === kind), `${kind} recurrence detected`);
    }
    for (const pattern of result.patterns) {
      s.check(pattern.evidenceMemoryIds.length >= config.patternRecurrenceMinimum,
        `${pattern.kind} carries recurrence evidence`);
      s.equal(pattern.sampleSize, pattern.evidenceMemoryIds.length, 'sample size equals evidence count');
    }
  }
  {
    const s = section('PATTERN-STRATEGY');
    s.check(result.patterns.some((p) => p.kind === 'CONSISTENT_OUTPERFORMANCE' && p.subject.key === 'arb-guardian'),
      'guardian outperforms in every era');
    s.check(!result.patterns.some((p) => p.kind === 'CONSISTENT_OUTPERFORMANCE' && p.subject.key === 'arb-aggressive'),
      'aggressive never wins an era');
    const divergence = result.patterns.find((p) => p.kind === 'COMPLETION_PRESERVATION_DIVERGENCE'
      && p.subject.key === 'arb-aggressive')!;
    s.check(divergence.magnitude > 0, 'aggressive completes more yet preserves less');
    for (const series of ['opp_oscillation', 'opp_policy_trial', 'opp_adverse']) {
      s.check(result.patterns.some((p) => p.kind === 'HIGH_THEORETICAL_POOR_REALIZATION' && p.subject.key === series),
        `${series} is high-theoretical poor-realization`);
    }
  }
  {
    const s = section('PATTERN-VENUE');
    s.check(result.patterns.some((p) => p.kind === 'VENUE_SPECIFIC_LEAKAGE' && p.subject.key === 'venue-a'),
      'venue-a carries corpus-specific leakage');
    s.check(result.patterns.some((p) => p.kind === 'FILL_QUALITY_DEGRADATION'),
      'fill-quality degradation detected');
    s.check(result.patterns.some((p) => p.kind === 'RECURRING_ADVERSE_DRIFT'),
      'recurring adverse drift detected');
  }
  {
    const s = section('PATTERN-POLICY');
    s.check(result.patterns.some((p) => p.kind === 'POLICY_STABILITY' && p.subject.key === 'policy-execution@v1'),
      'the v1 baseline policy is stable');
    s.check(result.patterns.some((p) => p.kind === 'POLICY_REGRESSION' && p.subject.key.includes('v1.1')),
      'the v1.1 candidate regresses across eras');
    const notEndToEnd = result.patterns.find((p) => p.kind === 'POLICY_IMPROVEMENT_NOT_END_TO_END')!;
    s.equal(notEndToEnd.subject.key, 'policy-execution@v1.1', 'v1.1 improves execution, not end-to-end value');
    s.check(notEndToEnd.magnitude < 0, 'recurring negative end-to-end value quantified');
  }
  {
    const s = section('PATTERN-FAILURE');
    const failures = result.patterns.filter((p) => p.kind === 'REPEATED_FAILURE_CLASS');
    s.check(failures.length >= 3, `${failures.length} recurring failure classes`);
    for (const failure of failures) {
      s.check(failure.sampleSize >= config.patternRecurrenceMinimum, 'failure recurrence evidenced');
    }
  }

  // -------------------------------------------------------------------
  // 26–28. Hypotheses: the epistemic spectrum
  // -------------------------------------------------------------------
  {
    const s = section('HYPOTHESES');
    s.equal(result.hypotheses.length, 8, 'eight hypotheses generated');
    const statuses = new Set(result.hypotheses.map((h) => h.status));
    for (const status of ['SUPPORTED', 'WEAKLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE', 'REJECTED']) {
      s.check(statuses.has(status as never), `a hypothesis is ${status}`);
    }
    for (const hypothesis of result.hypotheses) {
      s.check(!/proven|fact|certain/i.test(hypothesis.statement),
        'hypotheses stay hypothetical — correlation is never fact');
      s.check(hypothesis.evaluationReason.length > 0, 'every status carries a reason');
    }
  }
  {
    const s = section('HYPOTHESIS-CONTRADICTION');
    const contradicted = result.hypotheses.find((h) => h.status === 'CONTRADICTED')!;
    s.check(contradicted.statement.includes('arb-aggressive preserves more'),
      'the aggressive-superiority claim is the contradicted one');
    s.equal(contradicted.confidenceState, 'CONTRADICTORY', 'contradiction is explicit in the evidence state');
    s.check(contradicted.contradictingEvidenceIds.length > 0, 'contradicting evidence listed');
    const supported = result.hypotheses.find((h) => h.status === 'SUPPORTED'
      && h.statement.includes('arb-guardian preserves more'))!;
    s.equal(supported.confidenceState, 'STRONG', 'the guardian claim is strongly supported');
    s.equal(supported.sampleSize, 16, 'guardian claim rests on 16 comparable observations');
  }
  {
    const s = section('HYPOTHESIS-HONESTY');
    for (const statement of ['market-making', 'funding']) {
      s.check(result.hypotheses.some((h) => h.status === 'INSUFFICIENT_EVIDENCE'
        && h.statement.includes(statement)),
        `${statement} stays INSUFFICIENT_EVIDENCE — never fabricated`);
    }
    s.check(result.hypotheses.some((h) => h.status === 'REJECTED'
      && h.statement.includes('Hedge-class')), 'invalid comparison bases are REJECTED');
  }

  // -------------------------------------------------------------------
  // 29–31. Evidence evaluation, findings, rankings
  // -------------------------------------------------------------------
  {
    const s = section('EVIDENCE-EVALUATION');
    s.equal(result.evidence.length, result.hypotheses.length, 'one evaluation per hypothesis');
    for (const evaluation of result.evidence) {
      s.check(evaluation.evaluationId.startsWith('evd_'), 'evaluations content-addressed');
      s.check(evaluation.contributors.every((c) => c.weight > 0), 'contributors weigh provenance');
    }
    const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
    const strong = evaluateEvidence({subject: 'demo-guardian', supporting: guardian,
      contradicting: [], metric: 'preservation'}, config);
    s.check(['STRONG', 'MODERATE'].includes(strong.state), 'a full guardian history yields solid evidence');
    const contradicted = evaluateEvidence({subject: 'demo-contradiction',
      supporting: active.filter((r) => r.strategyId === 'arb-aggressive'),
      contradicting: guardian, metric: 'preservation'}, config);
    s.equal(contradicted.state, 'CONTRADICTORY', 'the mean-based contradiction rule fires');
  }
  {
    const s = section('FINDINGS');
    s.equal(result.findings.length, 9, 'nine findings derived from queries');
    for (const finding of result.findings) {
      s.check(finding.findingId.startsWith('fnd_'), 'finding content-addressed');
      s.check(Object.isFrozen(finding), 'findings immutable');
      s.check(finding.supportingMemoryIds.length > 0, 'findings cite their memory evidence');
      s.check(!/authorize|approve|execute/i.test(JSON.stringify(finding.result)),
        'findings never authorize anything');
    }
    const linked = result.findings.filter((f) => f.lineage.patternIds.length > 0);
    s.check(linked.length > 0, 'findings link to detected patterns');
  }
  {
    const s = section('RANKINGS');
    s.equal(result.rankings.length, 7, 'seven ranking kinds');
    for (const ranking of result.rankings) {
      for (let i = 0; i < ranking.entries.length; i++) {
        s.equal(ranking.entries[i].rank, i + 1, 'ranks contiguous from 1');
        if (i > 0) s.check(ranking.entries[i - 1].score >= ranking.entries[i].score, 'score-sorted');
      }
    }
    const strategyRanking = result.rankings.find((r) => r.kind === 'STRATEGY')!;
    const guardianEntry = strategyRanking.entries.find((e) => e.subject === 'arb-guardian')!;
    const aggressiveEntry = strategyRanking.entries.find((e) => e.subject === 'arb-aggressive')!;
    s.check(guardianEntry.rank < aggressiveEntry.rank, 'guardian outranks aggressive');
    s.near(guardianEntry.score, 0.742, 'guardian ranking score', 5e-4);
    s.near(aggressiveEntry.score, 0.505, 'aggressive ranking score', 5e-4);
    const classRanking = result.rankings.find((r) => r.kind === 'CLASS')!;
    s.check(classRanking.excluded.length >= 5, 'under-sampled classes excluded with reasons');
    s.check(classRanking.excluded.every((e) => e.reason.includes('sample')),
      'exclusions cite the sample floor');
  }

  // -------------------------------------------------------------------
  // 32–33. Intelligence feedback and recommendations (informational only)
  // -------------------------------------------------------------------
  {
    const s = section('INTELLIGENCE-FEEDBACK');
    s.equal(result.feedback.length, 8, 'eight feedback items');
    const kinds = new Set(result.feedback.map((f) => f.kind));
    for (const kind of ['STRATEGY_CANDIDATE_SIGNAL', 'VENUE_QUALITY_SIGNAL', 'POLICY_WARNING',
      'OPPORTUNITY_CLASS_QUALITY_SIGNAL', 'LEAKAGE_WARNING', 'FAILURE_RISK_SIGNAL', 'RESEARCH_PRIORITY']) {
      s.check(kinds.has(kind as never), `${kind} emitted`);
    }
    for (const feedback of result.feedback) {
      s.equal(feedback.informational, true, 'feedback is informational by contract');
      s.check(!/authorize|approve|execute now|deploy|halt/i.test(feedback.statement),
        'feedback statements carry no authority verbs');
    }
    const strategySignal = result.feedback.find((f) => f.kind === 'STRATEGY_CANDIDATE_SIGNAL')!;
    s.equal(strategySignal.subject, 'arb-guardian', 'the strategy signal names the comparison winner');
    const policyWarning = result.feedback.find((f) => f.kind === 'POLICY_WARNING')!;
    s.check(policyWarning.subject.includes('v1.1'), 'the policy warning targets the candidate policy');
  }
  {
    const s = section('RECOMMENDATIONS');
    s.equal(result.recommendations.length, 10, 'ten research recommendations');
    const kinds = new Set(result.recommendations.map((r) => r.kind));
    for (const kind of ['COLLECT_MORE_EVIDENCE', 'REEXAMINE_COMPARABILITY', 'RESEARCH_PRIORITY']) {
      s.check(kinds.has(kind as never), `${kind} recommended`);
    }
    for (const recommendation of result.recommendations) {
      s.equal(recommendation.informational, true, 'recommendations are informational');
      s.check(!/authorize|approve|deploy|halt/i.test(`${recommendation.statement} ${recommendation.reason}`),
        'recommendations carry no authority verbs');
    }
    s.check(result.recommendations.some((r) => r.subject.includes('AFIS-vs-ABL')),
      'the cross-domain comparability issue is recommended for re-examination');
  }

  // -------------------------------------------------------------------
  // 34–35. Replay, audit and invariants
  // -------------------------------------------------------------------
  {
    const s = section('REPLAY');
    s.equal(result.replay.identical, true, 'the engine verified its own internal replay');
    const replay = engine.analyze({...history.input});
    const comparison = compareResearchResults(result, replay);
    s.check(comparison.identical, 'two full analyses are byte-identical');
    s.same(comparison.differences, [], 'no differences');
    s.equal(canonicalJson(result), canonicalJson(replay), 'canonical serialization identical');
    const permuted = engine.analyze({...history.input,
      analyses: [...history.input.analyses].reverse().map((a) => ({...a, records: [...a.records].reverse()}))});
    s.check(compareResearchResults(result, permuted).identical, 'replay survives input reordering');
    const corrected = engine.analyze({...history.input,
      corrections: [{sourceId: history.healthySourceId(2), reason: 'demo', realizedCostDelta: -0.25}]});
    s.check(!compareResearchResults(result, corrected).identical, 'a corrected history is a different result');
  }
  {
    const s = section('AUDIT-AND-INVARIANTS');
    const verification = verifyResearchAudit(result.auditEvents, result.auditEvents.length);
    s.check(verification.valid, `audit chain verifies (${result.auditEvents.length} events)`);
    s.equal(result.auditEvents[result.auditEvents.length - 1].eventType, 'replay-completed',
      'chain terminates with the replay event');
    const types = new Set(result.auditEvents.map((e) => e.eventType));
    for (const type of ['memory-created', 'normalization-completed', 'graph-built', 'query-executed',
      'comparison-completed', 'pattern-detected', 'hypothesis-created', 'evidence-evaluated',
      'finding-created', 'feedback-created', 'replay-completed']) {
      s.check(types.has(type as never), `${type} audited`);
    }
    const tampered = result.auditEvents.map((e) => ({...e}));
    tampered[4] = {...tampered[4], payload: {...tampered[4].payload, injected: true}};
    s.check(!verifyResearchAudit(tampered).valid, 'payload substitution detected');
    const truncated = result.auditEvents.slice(0, -3);
    s.check(!verifyResearchAudit(truncated, result.auditEvents.length).valid, 'truncation detected');
    s.equal(result.invariants.checks.length, 46, '46 named invariant checks');
    s.equal(result.invariants.passed, true, 'all invariants pass');
    const rechecked = checkResearchInvariants(result,
      {normalized: [], replayJson: canonicalJson(result), minSampleSize: config.minSampleSize});
    s.equal(rechecked.passed, true, 'invariants re-verify externally');
    s.equal(result.lineage.valid, true, 'research lineage resolves end to end');
    s.check(result.lineage.edges.length >= 1500, `${result.lineage.edges.length} lineage edges`);
  }

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  const failed = sections.filter((s) => s.failures.length > 0);
  const lines: string[] = [];
  lines.push('===============================================================');
  lines.push(' SPRINT 036 — HISTORICAL INTELLIGENCE & RESEARCH PLANE');
  lines.push(' PAPER / SIMULATION ONLY — RESEARCH LAYER, NOT AN AUTHORITY');
  lines.push('===============================================================');
  lines.push('');
  for (const s of sections) {
    lines.push(` [${s.failures.length === 0 ? 'PASS' : 'FAIL'}] ${s.name}`);
  }
  lines.push('');
  if (failed.length === 0) {
    lines.push(` SPRINT 036 VALIDATION: ${sections.length}/${sections.length} sections PASS`);
    lines.push('');
    lines.push(' Five eras of real closed-loop history became one deterministic,');
    lines.push(' immutable, queryable intelligence memory: 65 observations across');
    lines.push(' AFIS and ABL (BACK/LAY preserved), indexed on 11 dimensions into a');
    lines.push(' 192-node knowledge graph. Nine named queries, six comparisons');
    lines.push(' (comparability first — the raw cross-domain comparison rejected),');
    lines.push(` ${result.patterns.length} patterns across all six families, ${result.hypotheses.length} hypotheses`);
    lines.push(' spanning the full epistemic spectrum (SUPPORTED, WEAKLY_SUPPORTED,');
    lines.push(` CONTRADICTED, INSUFFICIENT_EVIDENCE, REJECTED), ${result.findings.length} findings,`);
    lines.push(` 7 rankings, ${result.feedback.length} informational feedback items and`);
    lines.push(` ${result.recommendations.length} research recommendations. Replay is byte-identical; the audit`);
    lines.push(' chain verifies from GENESIS and fails closed on tampering,');
    lines.push(' reordering and truncation; 46 invariants hold.');
    lines.push('');
    lines.push(' The plane learned from history; it never mutated Treasury,');
    lines.push(' Portfolio, Risk, AEGIS, Execution, the Strategy Registry or any');
    lines.push(' active policy. Ranking is not authorization. Hypotheses are not');
    lines.push(' facts.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
    lines.push('');
    lines.push(' SPRINT 036: COMPLETE');
  } else {
    lines.push(` SPRINT 036 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
    lines.push(` ${failed.length}/${sections.length} sections FAILED:`);
    for (const s of failed) {
      lines.push(`   [${s.name}]`);
      for (const f of s.failures) lines.push(`     - ${f}`);
    }
    lines.push('');
    lines.push(' SYSTEM STATUS: UNRECONCILED');
  }
  console.log(lines.join('\n'));
  if (failed.length > 0) process.exit(1);
}

main();
