import type {
  ClosedLoopAnalysisResult, ComparisonResult, EvidenceEvaluation, IntelligenceFeedback,
  MemoryRecord, ResearchConfigInput, ResearchConfigSpec, ResearchFinding, ResearchInput,
  ResearchInvariantReport, ResearchPattern, ResearchQuery, ResearchResult, Hypothesis,
  MemoryCorrection, ResearchRecommendation, NormalizedRecord,
} from './types';
import {mergeResearchConfig} from './config';
import {ResearchAuditLog, verifyResearchAudit} from './audit';
import {buildMemory} from './memory';
import {buildMemoryIndex} from './memory-index';
import {buildEntities} from './knowledge';
import {buildKnowledgeIndex, entitiesOfKind} from './knowledge-index';
import {buildGraph} from './graph';
import {buildResearchLineage} from './lineage';
import {runQuery, leakageTotals} from './query';
import {comparePopulations, compareVenueEntities} from './comparison';
import {detectPatterns, detectRejectionPatterns, strategyCompletionDivergence, consistentOutperformance} from './pattern';
import {evaluateHypothesis} from './hypothesis';
import type {HypothesisDraft} from './hypothesis';
import {evaluateEvidence} from './evidence';
import {buildFinding} from './finding';
import {rankEntities, rankPatterns, rankFindings, rankHypotheses} from './ranking';
import {
  buildFeedback, strategyCandidateSignal, venueQualitySignal, policyWarning,
  opportunityClassQualitySignal, leakageWarning, failureRiskSignal, researchPriority,
} from './feedback';
import {underSampledRecommendations, comparabilityRecommendations, buildRecommendation} from './recommendation';
import {checkResearchInvariants, ResearchInvariantError} from './invariants';
import {analysisFingerprintOf, canonicalJson, researchAnalysisId, researchHash} from './ids';
import {groupBy} from './knowledge';

/**
 * SPRINT 036 — the Historical Intelligence & Research Engine.
 *
 * One deterministic pass: Historical Records → Normalization → Intelligence
 * Memory → Knowledge Graph → Research Queries → Pattern Detection →
 * Comparative Analysis → Hypothesis Generation → Evidence Evaluation →
 * Research Findings → Intelligence Feedback.
 *
 * ANALYTICAL / RESEARCH LAYER ONLY — NOT AN AUTHORITY. It never mutates
 * Treasury, Portfolio, Risk, AEGIS, Execution, the Strategy Registry or
 * active Execution Policies. Every output is informational.
 */

export class ResearchEngine {
  readonly config: ResearchConfigSpec;
  private readonly configFingerprint: string;

  constructor(input: ResearchConfigInput = {}) {
    this.config = mergeResearchConfig(input);
    this.configFingerprint = researchHash(this.config);
  }

  analyze(input: ResearchInput): ResearchResult {
    if (!Number.isFinite(input.timestamp) || input.timestamp <= 0) {
      throw new Error('research: invalid analysis timestamp — fail closed');
    }
    if (input.analyses.length === 0) {
      throw new Error('research: no historical analyses — fail closed');
    }
    for (const analysis of input.analyses) {
      if (!analysis.invariants || analysis.invariants.passed !== true) {
        throw new Error(`research: upstream analysis ${analysis.analysisId} failed its own invariants — batch untrusted, fail closed`);
      }
    }
    // Ordering independence: canonical batch order.
    const analyses = [...input.analyses].sort((a, b) =>
      a.timestamp - b.timestamp || a.analysisId.localeCompare(b.analysisId));
    const core1 = this.runCore(analyses, input);
    const core2 = this.runCore(analyses, input);
    const identical = canonicalJson(core1) === canonicalJson(core2);
    if (!identical) {
      throw new Error('research: internal replay is not byte-identical — fail closed');
    }
    const audit = new ResearchAuditLog(core1.analysisId, input.timestamp);
    for (const event of core1.auditEvents) {
      audit.append(event.eventType, event.payload);
    }
    audit.append('replay-completed', {identical: true, fingerprint: core1.analysisFingerprint});
    const analysisFingerprint = analysisFingerprintOf({
      core: core1.analysisFingerprint, replayIdentical: identical,
      auditEvents: audit.length,
    });
    const result: ResearchResult = Object.freeze({
      ...core1,
      auditEvents: audit.snapshot(),
      analysisFingerprint,
      replay: Object.freeze({identical, fingerprint: core1.analysisFingerprint}),
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
    });
    const context = {normalized: [], replayJson: canonicalJson(core2)};
    const invariants = checkResearchInvariants(result,
      {...context, minSampleSize: this.config.minSampleSize});
    if (!invariants.passed) {
      throw new ResearchInvariantError(invariants);
    }
    return Object.freeze({...result, invariants});
  }

  // -------------------------------------------------------------------------
  // The deterministic core (run twice; outputs must be byte-identical)
  // -------------------------------------------------------------------------

  private runCore(analyses: readonly ClosedLoopAnalysisResult[], input: ResearchInput): Omit<ResearchResult, 'invariants'> {
    const config = this.config;
    const timestamp = input.timestamp;
    // Canonical record order inside every batch — replay must not depend on
    // how the upstream analysis happened to order its records.
    const canonicalAnalyses = analyses.map((a) => ({
      ...a,
      records: [...a.records].sort((x, y) =>
        x.identity.observedAt - y.identity.observedAt
        || x.identity.opportunityId.localeCompare(y.identity.opportunityId)),
    }));
    analyses = canonicalAnalyses;
    const analysisId = researchAnalysisId({
      timestamp, batches: canonicalAnalyses.map((a) => [a.analysisId, a.analysisFingerprint]),
      config: this.configFingerprint,
    });
    const audit = new ResearchAuditLog(analysisId, timestamp);
    const corrections: readonly MemoryCorrection[] = input.corrections ?? [];

    // History → memory.
    const memoryBuild = buildMemory(analyses, corrections, config, timestamp, audit);
    const active = memoryBuild.memory.records.filter((r) => r.status === 'ACTIVE');
    audit.append('normalization-completed', {
      batches: analyses.length, accepted: active.length,
      rejected: memoryBuild.memory.rejected.length, duplicates: memoryBuild.memory.duplicatesIgnored,
    });

    // Memory → index + knowledge.
    const index = buildMemoryIndex(memoryBuild.memory.records);
    const entities = buildEntities(memoryBuild.memory.records, config);
    const knowledgeIndex = buildKnowledgeIndex(entities);

    // Research queries (deterministic, named).
    const queries = NAMED_QUERIES.map((query) => runQuery(query, memoryBuild.memory.records, index, config));
    for (const query of queries) {
      audit.append('query-executed', {name: query.name, matched: query.sampleSize});
    }

    // Comparative analysis.
    const comparisons = this.buildComparisons(active, knowledgeIndex, config);
    for (const comparison of comparisons) {
      audit.append('comparison-completed', {
        a: comparison.subjectA, b: comparison.subjectB,
        comparable: comparison.comparable, winner: comparison.winner,
      });
    }

    // Pattern detection.
    const rejectionPatterns = detectRejectionPatterns(
      memoryBuild.memory.rejected.filter((r) => r.kind === 'MALFORMED_HISTORY').length,
      memoryBuild.memory.rejected.filter((r) => r.kind === 'CONTRADICTORY_DUPLICATE').length,
      config,
    );
    const patterns = [...detectPatterns(memoryBuild.memory.records, config), ...rejectionPatterns];
    const links: {patternId: string; hypothesisId: string}[] = [];

    // Strategy era-wise outperformance + completion divergence.
    const strategyComparison = comparisons.find((c) => c.kind === 'STRATEGY' && c.comparable);
    if (strategyComparison) {
      const byBucket = groupBy(
        active.filter((r) => r.strategyId === strategyComparison.subjectA
          || r.strategyId === strategyComparison.subjectB),
        (r) => r.timeBucket,
      );
      let wins = 0;
      const eras = [...byBucket.keys()].sort();
      const winnerKey = strategyComparison.winner === 'A'
        ? strategyComparison.subjectA : strategyComparison.subjectB;
      for (const bucket of eras) {
        const records = byBucket.get(bucket)!;
        const meanOf = (key: string) => {
          const ratios = records.filter((r) => r.strategyId === key)
            .map((r) => r.values.preservationRatio).filter((v): v is number => v !== null);
          return ratios.length === 0 ? null : ratios.reduce((s, v) => s + v, 0) / ratios.length;
        };
        const a = meanOf(strategyComparison.subjectA);
        const b = meanOf(strategyComparison.subjectB);
        if (a !== null && b !== null && a !== b) {
          if ((a > b ? strategyComparison.subjectA : strategyComparison.subjectB) === winnerKey) wins++;
        }
      }
      const outperformance = consistentOutperformance(winnerKey, wins, eras.length,
        active.filter((r) => r.strategyId === winnerKey), config);
      if (outperformance) patterns.push(outperformance);
      const loserKey = strategyComparison.winner === 'A'
        ? strategyComparison.subjectB : strategyComparison.subjectA;
      const divergence = strategyCompletionDivergence(
        {key: loserKey,
          completionRate: meanCompletion(active.filter((r) => r.strategyId === loserKey)),
          meanPreservation: meanPreservationOf(active.filter((r) => r.strategyId === loserKey))},
        {key: winnerKey,
          completionRate: meanCompletion(active.filter((r) => r.strategyId === winnerKey)),
          meanPreservation: meanPreservationOf(active.filter((r) => r.strategyId === winnerKey))},
        active.filter((r) => r.strategyId === loserKey || r.strategyId === winnerKey), config,
      );
      if (divergence) patterns.push(divergence);
    }
    patterns.sort((a, b) => a.patternId.localeCompare(b.patternId));
    for (const p of patterns) {
      audit.append('pattern-detected', {patternId: p.patternId, kind: p.kind,
        subject: p.subject.key, sampleSize: p.sampleSize});
    }

    // Hypotheses + evidence.
    const {hypotheses, evaluations} = this.buildHypotheses(active, comparisons, patterns, config, links);
    for (const evaluation of evaluations) {
      audit.append('evidence-evaluated', {subject: evaluation.subject, state: evaluation.state});
    }
    for (const hypothesis of hypotheses) {
      audit.append('hypothesis-created', {hypothesisId: hypothesis.hypothesisId,
        status: hypothesis.status, statement: hypothesis.statement});
    }

    // Findings.
    const findings = queries.map((query) => {
      const supporting = active.filter((r) => query.matched.includes(r.memoryId));
      const evidence = evaluateEvidence({
        subject: query.name, supporting, contradicting: [], metric: 'preservation',
      }, config);
      const patternIds = patterns.filter((p) =>
        query.name.includes('policy') && p.kind === 'POLICY_IMPROVEMENT_NOT_END_TO_END'
        || query.name.includes('venue') && p.kind === 'VENUE_SPECIFIC_LEAKAGE'
        || query.name.includes('failure') && p.family === 'FAILURE'
        || query.name.includes('strategy') && p.kind === 'CONSISTENT_OUTPERFORMANCE').map((p) => p.patternId);
      const batchIds = [...new Set(query.matched
        .map((id) => active.find((r) => r.memoryId === id)?.lineage.batchId)
        .filter((b): b is string => b !== undefined))].sort();
      return buildFinding(query, evidence, config, timestamp, patternIds, [], batchIds);
    });
    for (const finding of findings) {
      audit.append('finding-created', {findingId: finding.findingId, query: finding.query});
    }

    // Rankings.
    const rankings = [
      rankEntities('STRATEGY', entitiesOfKind(knowledgeIndex, 'STRATEGY'), config),
      rankEntities('VENUE', entitiesOfKind(knowledgeIndex, 'VENUE'), config),
      rankEntities('CLASS', entitiesOfKind(knowledgeIndex, 'OPPORTUNITY_CLASS'), config),
      rankEntities('POLICY', entitiesOfKind(knowledgeIndex, 'POLICY'), config),
      rankPatterns(patterns, config),
      rankFindings(findings),
      rankHypotheses(hypotheses),
    ];

    // Intelligence feedback + research recommendations.
    const {feedback, recommendations} = this.buildFeedbackAndRecommendations(
      active, comparisons, patterns, queries, knowledgeIndex, config);
    for (const item of feedback) {
      audit.append('feedback-created', {feedbackId: item.feedbackId, kind: item.kind, subject: item.subject});
    }

    // Knowledge graph (after all artifacts exist).
    const graph = buildGraph(memoryBuild.memory.records, entities, comparisons, patterns,
      hypotheses, findings, {patternToHypothesis: links});
    audit.append('graph-built', {nodes: graph.nodeCount, edges: graph.edgeCount});

    const lineage = buildResearchLineage(memoryBuild.memory, patterns, hypotheses, findings, feedback);
    const verification = verifyResearchAudit(audit.snapshot(), audit.length);
    if (!verification.valid) {
      throw new Error(`research: audit chain invalid during analysis (${verification.reason}) — fail closed`);
    }

    return Object.freeze({
      analysisId, timestamp,
      schemaVersion: 'research.v1',
      configurationFingerprint: this.configFingerprint,
      analysisFingerprint: analysisFingerprintOf({
        memory: memoryBuild.memory.fingerprint, graph: graph.fingerprint,
        queries: queries.map((q) => q.fingerprint), patterns: patterns.map((p) => p.patternId),
        hypotheses: hypotheses.map((h) => h.hypothesisId), findings: findings.map((f) => f.findingId),
      }),
      batches: Object.freeze(memoryBuild.batchSummaries),
      memory: memoryBuild.memory,
      index, graph, entities,
      queries: Object.freeze(queries),
      comparisons: Object.freeze(comparisons),
      patterns: Object.freeze(patterns),
      hypotheses: Object.freeze(hypotheses),
      evidence: Object.freeze(evaluations),
      findings: Object.freeze(findings),
      rankings: Object.freeze(rankings),
      feedback: Object.freeze(feedback),
      recommendations: Object.freeze(recommendations),
      lineage,
      auditEvents: audit.snapshot(),
      replay: Object.freeze({identical: false, fingerprint: ''}),
    });
  }

  private buildComparisons(
    active: readonly MemoryRecord[], knowledge: ReturnType<typeof buildKnowledgeIndex>,
    config: ResearchConfigSpec,
  ): ComparisonResult[] {
    const comparisons: ComparisonResult[] = [];
    const afis = active.filter((r) => r.domain === 'AFIS');
    const strategies = entitiesOfKind(knowledge, 'STRATEGY').filter((e) => e.domain !== 'MIXED');
    if (strategies.length >= 2) {
      const [a, b] = strategies.slice(0, 2).map((e) => e.key).sort();
      const scopedA = afis.filter((r) => r.strategyId === a && r.opportunityClass === 'cross-venue-arbitrage');
      const scopedB = afis.filter((r) => r.strategyId === b && r.opportunityClass === 'cross-venue-arbitrage');
      if (scopedA.length > 0 && scopedB.length > 0) {
        comparisons.push(comparePopulations({
          kind: 'STRATEGY', subjectA: a, subjectB: b,
          recordsA: scopedA, recordsB: scopedB,
          scopeClass: 'cross-venue-arbitrage', normalized: false, metric: 'preservation',
        }, config));
      }
    }
    // Venue comparison (entity-level, leg leakage).
    const venues = entitiesOfKind(knowledge, 'VENUE');
    if (venues.length >= 2) {
      const [a, b] = venues.slice(0, 2).map((e) => e.key).sort();
      comparisons.push(compareVenueEntities(
        venueView(active, a), venueView(active, b), config));
    }
    // Policy comparison: baseline vs candidate.
    const baseline = active.filter((r) => r.policyVersion === 'v1' && r.opportunityClass === 'cross-venue-arbitrage');
    const candidate = active.filter((r) => r.policyVersion.startsWith('v1.'));
    if (baseline.length > 0 && candidate.length > 0) {
      comparisons.push(comparePopulations({
        kind: 'POLICY', subjectA: 'policy-execution@v1', subjectB: 'policy-execution@v1.1',
        recordsA: baseline, recordsB: candidate,
        scopeClass: 'cross-venue-arbitrage', normalized: false, metric: 'preservation',
      }, config));
    }
    // Class comparison (AFIS, comparable classes only by sample).
    const liquidity = afis.filter((r) => r.opportunityClass === 'liquidity-imbalance');
    const crossVenue = afis.filter((r) => r.opportunityClass === 'cross-venue-arbitrage');
    if (liquidity.length >= config.minComparativeSample && crossVenue.length >= config.minComparativeSample) {
      comparisons.push(comparePopulations({
        kind: 'CLASS', subjectA: 'cross-venue-arbitrage', subjectB: 'liquidity-imbalance',
        recordsA: crossVenue, recordsB: liquidity,
        scopeClass: null, normalized: false, metric: 'preservation', requireClassOverlap: false,
      }, config));
    }
    // Cross-domain: raw comparison is invalid by definition; normalized allowed.
    const afisRecords = active.filter((r) => r.domain === 'AFIS');
    const ablRecords = active.filter((r) => r.domain === 'ABL');
    if (afisRecords.length >= config.minComparativeSample
      && ablRecords.length >= config.minComparativeSample) {
      comparisons.push(comparePopulations({
        kind: 'DOMAIN', subjectA: 'AFIS', subjectB: 'ABL',
        recordsA: afisRecords, recordsB: ablRecords,
        scopeClass: null, normalized: false, metric: 'preservation',
      }, config));
      comparisons.push(comparePopulations({
        kind: 'DOMAIN', subjectA: 'AFIS', subjectB: 'ABL',
        recordsA: afisRecords, recordsB: ablRecords,
        scopeClass: null, normalized: true, metric: 'preservation', requireClassOverlap: false,
      }, config));
    }
    return comparisons;
  }

  private buildHypotheses(
    active: readonly MemoryRecord[], comparisons: readonly ComparisonResult[],
    patterns: readonly ResearchPattern[], config: ResearchConfigSpec,
    links: {patternId: string; hypothesisId: string}[],
  ): {hypotheses: Hypothesis[]; evaluations: EvidenceEvaluation[]} {
    const hypotheses: Hypothesis[] = [];
    const evaluations: EvidenceEvaluation[] = [];
    const afis = active.filter((r) => r.domain === 'AFIS');
    const strategyComparison = comparisons.find((c) => c.kind === 'STRATEGY');
    if (strategyComparison) {
      const {subjectA, subjectB} = strategyComparison;
      const populationA = afis.filter((r) => r.strategyId === subjectA && r.opportunityClass === 'cross-venue-arbitrage');
      const populationB = afis.filter((r) => r.strategyId === subjectB && r.opportunityClass === 'cross-venue-arbitrage');
      const meanA = meanPreservationOf(populationA);
      const drafts: HypothesisDraft[] = [
        {
          statement: `${subjectA} preserves more realized edge than ${subjectB} under comparable AFIS cross-venue conditions.`,
          scope: {domains: ['AFIS'], classes: ['cross-venue-arbitrage'], strategies: [subjectA, subjectB]},
          supporting: populationA,
          contradicting: populationB,
          provenance: 'DERIVED', invalidBasisReason: null,
        },
        {
          statement: `${subjectB} preserves more realized edge than ${subjectA} under comparable AFIS cross-venue conditions.`,
          scope: {domains: ['AFIS'], classes: ['cross-venue-arbitrage'], strategies: [subjectA, subjectB]},
          supporting: populationB,
          contradicting: populationA,
          provenance: 'DERIVED', invalidBasisReason: null,
        },
      ];
      for (const draft of drafts) {
        const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
          contradicting: draft.contradicting, metric: 'preservation'}, config);
        const hypothesis = evaluateHypothesis(draft, evidence);
        hypotheses.push(hypothesis);
        evaluations.push(evidence);
        const outperformance = patterns.find((p) => p.kind === 'CONSISTENT_OUTPERFORMANCE');
        if (outperformance) links.push({patternId: outperformance.patternId, hypothesisId: hypothesis.hypothesisId});
      }
    }
    // Venue hypothesis: leakage-direction evidence over records that touch
    // BOTH venues (comparable execution conditions for the pair).
    const venueComparison = comparisons.find((c) => c.kind === 'VENUE');
    if (venueComparison) {
      const bothVenues = active.filter((r) =>
        r.venueLegs.some((l) => l.venue === venueComparison.subjectA)
        && r.venueLegs.some((l) => l.venue === venueComparison.subjectB));
      // Per-venue execution penalty = venue-specific leakage plus the adverse
      // part of the side-normalized realized venue result (positive badness).
      const venuePenalty = (r: MemoryRecord, venue: string) => {
        const leg = r.venueLegs.find((l) => l.venue === venue);
        if (!leg) return null;
        return (leg.leakage ?? 0) + Math.max(0, -(leg.venueResult ?? 0));
      };
      const draft: HypothesisDraft = {
        statement: `${venueComparison.subjectB} produces lower execution leakage than ${venueComparison.subjectA} for comparable opportunity classes.`,
        scope: {domains: ['AFIS', 'ABL'], classes: ['cross-venue-arbitrage'], venues: [venueComparison.subjectA, venueComparison.subjectB]},
        supporting: bothVenues.filter((r) => {
          const a = venuePenalty(r, venueComparison.subjectA);
          const b = venuePenalty(r, venueComparison.subjectB);
          return a !== null && b !== null && a > b;
        }),
        contradicting: bothVenues.filter((r) => {
          const a = venuePenalty(r, venueComparison.subjectA);
          const b = venuePenalty(r, venueComparison.subjectB);
          return a !== null && b !== null && b > a;
        }),
        provenance: 'DERIVED', invalidBasisReason: null,
      };
      const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
        contradicting: draft.contradicting, metric: 'leakage'}, config);
      hypotheses.push(evaluateHypothesis(draft, evidence));
      evaluations.push(evidence);
    }
    // Policy hypothesis (candidate improves execution, not end-to-end).
    const policyPattern = patterns.find((p) => p.kind === 'POLICY_IMPROVEMENT_NOT_END_TO_END');
    if (policyPattern) {
      const draft: HypothesisDraft = {
        statement: 'The v1.1 execution-policy candidate improves execution quality but does not improve end-to-end opportunity preservation.',
        scope: {domains: ['AFIS'], classes: ['cross-venue-arbitrage']},
        supporting: active.filter((r) => r.policyVersion === 'v1.1'),
        contradicting: [],
        provenance: 'DERIVED', invalidBasisReason: null,
      };
      const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
        contradicting: draft.contradicting, metric: 'preservation'}, config);
      const hypothesis = evaluateHypothesis(draft, evidence);
      hypotheses.push(hypothesis);
      evaluations.push(evidence);
      links.push({patternId: policyPattern.patternId, hypothesisId: hypothesis.hypothesisId});
    }
    // Under-sampled class hypotheses — INSUFFICIENT_EVIDENCE honesty.
    for (const cls of ['market-making', 'funding'] as const) {
      const records = active.filter((r) => r.opportunityClass === cls);
      const draft: HypothesisDraft = {
        statement: `${cls} opportunities preserve theoretical value across history.`,
        scope: {domains: ['AFIS'], classes: [cls]},
        supporting: records, contradicting: [],
        provenance: 'DERIVED', invalidBasisReason: null,
      };
      const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
        contradicting: draft.contradicting, metric: 'preservation'}, config);
      hypotheses.push(evaluateHypothesis(draft, evidence));
      evaluations.push(evidence);
    }
    // Invalid-basis hypotheses — REJECTED honesty.
    const hedgeRecords = active.filter((r) => r.opportunityClass === 'hedge');
    const surebetRecords = active.filter((r) => r.opportunityClass === 'surebet');
    if (hedgeRecords.length < config.minComparativeSample) {
      const draft: HypothesisDraft = {
        statement: 'Hedge-class opportunities outperform surebet-class opportunities on preserved value.',
        scope: {domains: ['ABL'], classes: ['hedge', 'surebet']},
        supporting: hedgeRecords, contradicting: surebetRecords,
        provenance: 'DERIVED',
        invalidBasisReason: `hedge class has ${hedgeRecords.length} observations — below the comparative minimum ${config.minComparativeSample}`,
      };
      const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
        contradicting: draft.contradicting, metric: 'preservation'}, config);
      hypotheses.push(evaluateHypothesis(draft, evidence));
      evaluations.push(evidence);
    }
    const rawDomain = comparisons.find((c) => c.kind === 'DOMAIN' && !c.normalized);
    if (rawDomain) {
      const draft: HypothesisDraft = {
        statement: 'AFIS opportunities realize more absolute value than ABL opportunities.',
        scope: {domains: ['AFIS', 'ABL'], classes: []},
        supporting: afis, contradicting: active.filter((r) => r.domain === 'ABL'),
        provenance: 'DERIVED',
        invalidBasisReason: 'raw cross-domain value comparison — AFIS and ABL economics are not directly comparable',
      };
      const evidence = evaluateEvidence({subject: draft.statement, supporting: draft.supporting,
        contradicting: draft.contradicting, metric: 'realizedNet'}, config);
      hypotheses.push(evaluateHypothesis(draft, evidence));
      evaluations.push(evidence);
    }
    hypotheses.sort((a, b) => a.hypothesisId.localeCompare(b.hypothesisId));
    evaluations.sort((a, b) => a.evaluationId.localeCompare(b.evaluationId));
    return {hypotheses, evaluations};
  }

  private buildFeedbackAndRecommendations(
    active: readonly MemoryRecord[], comparisons: readonly ComparisonResult[],
    patterns: readonly ResearchPattern[], queries: readonly import('./types').QueryResult[],
    knowledge: ReturnType<typeof buildKnowledgeIndex>,
    config: ResearchConfigSpec,
  ): {feedback: IntelligenceFeedback[]; recommendations: ResearchRecommendation[]} {
    const feedback: IntelligenceFeedback[] = [];
    const strategyComparison = comparisons.find((c) => c.kind === 'STRATEGY' && c.comparable);
    if (strategyComparison && strategyComparison.winner !== 'NONE') {
      const winnerKey = strategyComparison.winner === 'A'
        ? strategyComparison.subjectA : strategyComparison.subjectB;
      feedback.push(strategyCandidateSignal(strategyComparison, winnerKey));
    }
    const venueEntities = entitiesOfKind(knowledge, 'VENUE');
    if (venueEntities.length >= 2) {
      const ranked = [...venueEntities].sort((a, b) => (a.totalLeakage ?? 0) - (b.totalLeakage ?? 0)
        || a.key.localeCompare(b.key));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      feedback.push(venueQualitySignal(best.key, best.meanExecutionQuality, best.totalLeakage, best.memoryIds));
      if (worst.key !== best.key) {
        feedback.push(venueQualitySignal(worst.key, worst.meanExecutionQuality, worst.totalLeakage, worst.memoryIds));
      }
    }
    const policyPattern = patterns.find((p) => p.kind === 'POLICY_IMPROVEMENT_NOT_END_TO_END');
    if (policyPattern) {
      const policyRecords = active.filter((r) => policyPattern.evidenceMemoryIds.includes(r.memoryId));
      feedback.push(policyWarning(policyPattern.subject.key,
        policyRecords.reduce((s, r) => s + (r.values.realizedNet ?? 0), 0),
        policyPattern.evidenceMemoryIds));
    }
    const classQuery = queries.find((q) => q.name === 'afis-class-preservation');
    if (classQuery) {
      const best = [...classQuery.groups].filter((g) => g.sampleSize >= config.minSampleSize && g.meanPreservation !== null)
        .sort((a, b) => (b.meanPreservation ?? 0) - (a.meanPreservation ?? 0) || a.key.localeCompare(b.key))[0];
      if (best) {
        feedback.push(opportunityClassQualitySignal(best.key, best.meanPreservation, best.sampleSize, best.memoryIds));
      }
    }
    // Leakage warning — dominant attributable component.
    const totals = leakageTotals(active);
    const attributable = Object.entries(totals).filter(([name]) => name !== 'RESIDUAL_UNATTRIBUTED')
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (attributable.length > 0 && attributable[0][1] > 0) {
      const totalAttributable = attributable.reduce((s, [, v]) => s + v, 0);
      const [component, total] = attributable[0];
      const evidence = active.filter((r) => (r.values.leakageByComponent[component as 'SLIPPAGE'] ?? 0) > 1e-9);
      feedback.push(leakageWarning(component, total, totalAttributable > 0 ? total / totalAttributable : 0,
        evidence.map((r) => r.memoryId)));
    }
    const failurePattern = patterns.filter((p) => p.family === 'FAILURE')
      .sort((a, b) => b.sampleSize - a.sampleSize || a.patternId.localeCompare(b.patternId))[0];
    if (failurePattern) feedback.push(failureRiskSignal(failurePattern));
    // Research priority: the most under-sampled domain class.
    const classEntities = entitiesOfKind(knowledge, 'OPPORTUNITY_CLASS');
    const underSampled = classEntities
      .filter((e) => e.observationCount < config.minSampleSize)
      .sort((a, b) => a.observationCount - b.observationCount || a.key.localeCompare(b.key));
    if (underSampled.length > 0) {
      feedback.push(researchPriority(underSampled[0].key,
        `${underSampled[0].observationCount} observations`,
        `Prioritize collecting historical evidence for ${underSampled[0].key} opportunities`));
    }
    feedback.sort((a, b) => a.feedbackId.localeCompare(b.feedbackId));

    const recommendations = [
      ...underSampledRecommendations(classEntities.map((e) => ({
        key: e.key, sampleSize: e.observationCount, minimum: config.minSampleSize,
      }))),
      ...comparabilityRecommendations(comparisons.filter((c) => !c.comparable).map((c) => ({
        a: c.subjectA, b: c.subjectB, reasons: c.reasons,
      }))),
    ];
    if (attributable.length > 0 && attributable[0][1] > 0) {
      recommendations.push(buildRecommendation('RESEARCH_PRIORITY', attributable[0][0],
        `Investigate the dominant recurring leakage source: ${attributable[0][0]}`,
        `${attributable[0][1].toFixed(2)} aggregate dollars leaked`));
    }
    recommendations.sort((a, b) => a.recommendationId.localeCompare(b.recommendationId));
    return {feedback, recommendations};
  }
}

function venueView(active: readonly MemoryRecord[], venue: string):
  {key: string; legs: number; totalLeakage: number; fillEfficiency: number | null; memoryIds: string[]} {
  const legs = active.flatMap((r) => r.venueLegs.filter((l) => l.venue === venue));
  const fillKnown = legs.filter((l) => l.fillEfficiency !== null);
  const memoryIds = [...new Set(active
    .filter((r) => r.venueLegs.some((l) => l.venue === venue))
    .map((r) => r.memoryId))].sort();
  return {
    key: venue, legs: legs.length,
    totalLeakage: legs.reduce((s, l) => s + (l.leakage ?? 0), 0),
    fillEfficiency: fillKnown.length > 0
      ? fillKnown.reduce((s, l) => s + (l.fillEfficiency ?? 0), 0) / fillKnown.length : null,
    memoryIds,
  };
}

function meanCompletion(records: readonly MemoryRecord[]): number | null {
  if (records.length === 0) return null;
  return records.filter((r) => r.values.outcome === 'COMPLETED').length / records.length;
}

function meanPreservationOf(records: readonly MemoryRecord[]): number | null {
  const ratios = records.map((r) => r.values.preservationRatio).filter((v): v is number => v !== null);
  if (ratios.length === 0) return null;
  return ratios.reduce((s, v) => s + v, 0) / ratios.length;
}

const NAMED_QUERIES: readonly Omit<ResearchQuery, 'queryId'>[] = Object.freeze([
  {name: 'afis-class-preservation', filter: {domains: ['AFIS']}, groupBy: 'class'},
  {name: 'abl-strategy-preservation', filter: {domains: ['ABL']}, groupBy: 'strategy'},
  {name: 'cross-domain-normalized', filter: {}, groupBy: 'domain'},
  {name: 'venue-leakage', filter: {}, groupBy: 'venue'},
  {name: 'policy-end-to-end', filter: {}, groupBy: 'policy'},
  {name: 'value-disappearance', filter: {}, groupBy: 'none'},
  {name: 'failure-recurrence', filter: {}, groupBy: 'outcome'},
  {name: 'high-theoretical-poor-realization', filter: {minTheoreticalNet: 8, maxPreservation: 0.35}, groupBy: 'strategy'},
  {name: 'strategy-preservation-era-trend', filter: {domains: ['AFIS'], strategies: ['arb-guardian', 'arb-aggressive']}, groupBy: 'timeBucket'},
]);
