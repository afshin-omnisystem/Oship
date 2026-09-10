import {sha256} from '../../oiin/ids';
import type {ClosedLoopInput, ClosedLoopRecord, ClosedLoopRecordAnalysis, ClosedLoopAnalysisResult, ClosedLoopValue,} from './types';
import {closedLoopAnalysisId} from './ids';
import {ClosedLoopConfigInput, mergeClosedLoopConfig, closedLoopConfigFingerprint} from './config';
import type {ClosedLoopConfigSpec} from './config';
import {ingestOpportunityIdentity} from './opportunity';
import {reconstructLifecycle} from './lifecycle';
import {theoreticalValueModel, realizedComponents} from './value';
import {edgePreservation} from './edge';
import {strategyAttribution} from './strategy';
import {capitalAttribution} from './capital-attribution';
import {riskAttribution} from './risk';
import {executionAttribution} from './execution';
import {controlAttribution} from './control';
import {venueAttribution} from './venue-attribution';
import {policyAttribution} from './policy-attribution';
import {leakageDecomposition} from './leakage';
import {realizedOpportunityValue} from './realized';
import {preservationScore} from './score';
import {buildStrategyScorecards} from './strategy-attribution';
import {buildDomainScorecards, buildComparableGroups} from './aggregation';
import {buildClosedLoopRanking} from './opportunity-ranking';
import {buildRecommendations} from './intelligence';
import {buildClosedLoopLineage} from './lineage';
import {ClosedLoopAuditLog} from './audit';
import {checkClosedLoopInvariants} from './invariants';

/**
 * SPRINT 035 — the closed-loop intelligence engine.
 *
 * Runs the canonical loop over complete opportunity lifecycles:
 *
 *   OIIN → Opportunity → Strategy → Allocation → Risk → Execution Plan →
 *   Control Session → Performance → Attribution → Realized Opportunity
 *   Value → Closed-Loop Intelligence (scorecards, comparable groups, ranking,
 *   recommendations).
 *
 * AN INTELLIGENCE LAYER ONLY — not an authority. Deterministic, replayable,
 * fail-closed on structurally broken lifecycles. One engine serves AFIS and
 * ABL.
 */
export class ClosedLoopIntelligenceEngine {
  readonly config: ClosedLoopConfigSpec;

  constructor(configInput: ClosedLoopConfigInput = {}) {
    this.config = mergeClosedLoopConfig(configInput);
  }

  analyze(input: ClosedLoopInput): ClosedLoopAnalysisResult {
    if (input.records.length === 0) {
      throw new Error('closed-loop analysis refused: no records — fail closed');
    }
    if (!Number.isFinite(input.timestamp) || input.timestamp <= 0) {
      throw new Error('closed-loop analysis refused: invalid timestamp — fail closed');
    }

    const analysisId = closedLoopAnalysisId({
      timestamp: input.timestamp,
      correlationId: input.correlationId,
      records: input.records.map((r) => r.opportunity.fingerprint),
    });
    const audit = new ClosedLoopAuditLog(analysisId, input.timestamp);

    // ---- 1. per-record analysis -------------------------------------------
    const recordsById = new Map<string, ClosedLoopRecord>();
    const analyses: ClosedLoopRecordAnalysis[] = [];
    for (const record of input.records) {
      const identity = ingestOpportunityIdentity(record);
      recordsById.set(identity.opportunityId, record);
      audit.record('opportunity-ingested', {
        opportunityId: identity.opportunityId,
        domain: identity.domain, class: identity.opportunityClass,
        theoreticalNetEdge: identity.theoreticalNetEdge,
        confidence: identity.confidence, freshness: identity.freshness,
      });

      const lifecycle = reconstructLifecycle(record);
      audit.record('lifecycle-reconstructed', {
        opportunityId: identity.opportunityId,
        stages: lifecycle.stages.map((s) => s.stage),
        anomalies: lifecycle.anomalies.length, valid: lifecycle.valid,
      });

      const theoretical = theoreticalValueModel(record);
      const realized = realizedOpportunityValue(record, this.config);
      const edge = edgePreservation(record);
      const leakage = leakageDecomposition(record, this.config);
      const strategy = strategyAttribution(record);
      const capital = capitalAttribution(record);
      const risk = riskAttribution(record);
      const execution = executionAttribution(record);
      const control = controlAttribution(record);
      const venue = venueAttribution(record);
      const policy = policyAttribution(record);
      const score = preservationScore(record, this.config);

      audit.record('strategy-attributed', {opportunityId: identity.opportunityId,
        strategyId: strategy.strategyId, expected: strategy.strategyExpectedValue,
        realized: strategy.strategyRealizedValue.value});
      audit.record('allocation-attributed', {opportunityId: identity.opportunityId,
        requested: capital.requestedCapital, allocated: capital.allocatedCapital,
        deployed: capital.deployedCapital, utilization: capital.capitalUtilization.value});
      audit.record('risk-attributed', {opportunityId: identity.opportunityId,
        impactKind: risk.impactKind, constrainedValue: risk.constrainedValue,
        protective: risk.impactKind === 'PROTECTIVE_CONSTRAINT'});
      audit.record('execution-attributed', {opportunityId: identity.opportunityId,
        sessionId: execution.sessionId, finalState: execution.finalState,
        quality: execution.executionQuality, leakage: execution.executionLeakage.value});
      audit.record('control-attributed', {opportunityId: identity.opportunityId,
        cycles: control.cyclesExecuted, finalState: control.finalState,
        improvements: control.adaptiveActionImprovements, degradations: control.adaptiveActionDegradations});
      audit.record('venue-attributed', {opportunityId: identity.opportunityId,
        venues: venue.venues.map((v) => v.venue), benchmark: venue.benchmarkVenue,
        totalLeakage: venue.totalVenueLeakage.value});
      audit.record('policy-attributed', {opportunityId: identity.opportunityId,
        policyVersion: policy.policyVersion, baseline: policy.baselinePolicyVersion,
        objective: policy.objective.value});
      audit.record('leakage-calculated', {opportunityId: identity.opportunityId,
        total: leakage.totalLeakage, reconciles: leakage.reconciles,
        unavailable: leakage.unavailable.length});
      audit.record('realized-value-calculated', {opportunityId: identity.opportunityId,
        theoreticalNet: realized.theoreticalNetEdge.value,
        realizedNet: realized.realizedNetValue.value,
        preservation: realized.preservationRatio.value});
      audit.record('score-calculated', {opportunityId: identity.opportunityId,
        score: score.preservationScore.value, grade: score.grade});

      const analysis: ClosedLoopRecordAnalysis = Object.freeze({
        label: record.label,
        identity, lifecycle, theoretical, realized, edge, leakage,
        strategy, capital, risk, execution, control, venue, policy, score,
        fingerprint: sha256([identity.fingerprint, lifecycle.fingerprint, theoretical.fingerprint,
          realized.fingerprint, edge.fingerprint, leakage.fingerprint, strategy.fingerprint,
          capital.fingerprint, risk.fingerprint, execution.fingerprint, control.fingerprint,
          venue.fingerprint, policy.fingerprint, score.fingerprint]),
      });
      analyses.push(analysis);
    }

    // ---- 2. aggregates -------------------------------------------------------
    const strategyScorecards = buildStrategyScorecards(analyses);
    const domainScorecards = buildDomainScorecards(analyses);
    const comparableGroups = buildComparableGroups(analyses, this.config);
    const ranking = buildClosedLoopRanking(analyses, this.config);
    audit.record('ranking-calculated', {
      ranked: ranking.length,
      top: ranking.length > 0 ? ranking[0].opportunityId : null,
    });
    const recommendations = buildRecommendations({
      analyses, strategyScorecards, domainScorecards, comparableGroups, config: this.config,
    });
    for (const rec of recommendations) {
      audit.record('recommendation-generated', {
        recommendationId: rec.recommendationId, kind: rec.kind, statement: rec.statement,
      });
    }
    const lineage = buildClosedLoopLineage(analyses);

    // ---- 3. determinism replay (internal, byte-identical) -------------------
    const mainProjection = {analyses, strategyScorecards, domainScorecards,
      comparableGroups, ranking, recommendations, lineage};
    const replayRun = this.runPipeline(input);
    const replayRun2 = this.runPipeline(input);
    const replayIdentical = canonicalJson(replayRun) === canonicalJson(replayRun2)
      && canonicalJson(replayRun) === canonicalJson(mainProjection);
    audit.record('replay-completed', {
      identical: replayIdentical, records: input.records.length, analysisId,
    });

    const configurationFingerprint = closedLoopConfigFingerprint(this.config);
    const core = {
      analysisId, timestamp: input.timestamp, records: analyses,
      strategyScorecards, domainScorecards, comparableGroups, ranking,
      recommendations, lineage, auditEvents: audit.all(),
      configurationFingerprint,
    };

    const invariants = checkClosedLoopInvariants({
      records: input.records,
      analyses,
      result: core,
      config: this.config,
      replayIdentical,
    });

    const analysisFingerprint = `clfp_${sha256({
      records: analyses.map((a) => a.fingerprint),
      scorecards: strategyScorecards.map((s) => s.fingerprint),
      domains: domainScorecards.map((d) => d.fingerprint),
      ranking: ranking.map((r) => r.fingerprint),
      recommendations: recommendations.map((r) => r.fingerprint),
      lineage: lineage.fingerprint,
      auditHead: audit.headHash,
      config: configurationFingerprint,
    })}`;

    return Object.freeze({
      ...core,
      invariants,
      analysisFingerprint,
    });
  }

  /** The pure analysis pipeline (no audit side-channel) — used by replay. */
  private runPipeline(input: ClosedLoopInput): unknown {
    const analyses: ClosedLoopRecordAnalysis[] = input.records.map((record) => {
      const identity = ingestOpportunityIdentity(record);
      const lifecycle = reconstructLifecycle(record);
      const theoretical = theoreticalValueModel(record);
      const realized = realizedOpportunityValue(record, this.config);
      const edge = edgePreservation(record);
      const leakage = leakageDecomposition(record, this.config);
      const strategy = strategyAttribution(record);
      const capital = capitalAttribution(record);
      const risk = riskAttribution(record);
      const execution = executionAttribution(record);
      const control = controlAttribution(record);
      const venue = venueAttribution(record);
      const policy = policyAttribution(record);
      const score = preservationScore(record, this.config);
      return Object.freeze({
        label: record.label, identity, lifecycle, theoretical, realized, edge, leakage,
        strategy, capital, risk, execution, control, venue, policy, score,
        fingerprint: sha256([identity.fingerprint, lifecycle.fingerprint, theoretical.fingerprint,
          realized.fingerprint, edge.fingerprint, leakage.fingerprint, strategy.fingerprint,
          capital.fingerprint, risk.fingerprint, execution.fingerprint, control.fingerprint,
          venue.fingerprint, policy.fingerprint, score.fingerprint]),
      });
    });
    const strategyScorecards = buildStrategyScorecards(analyses);
    const domainScorecards = buildDomainScorecards(analyses);
    const comparableGroups = buildComparableGroups(analyses, this.config);
    const ranking = buildClosedLoopRanking(analyses, this.config);
    const recommendations = buildRecommendations({
      analyses, strategyScorecards, domainScorecards, comparableGroups, config: this.config,
    });
    const lineage = buildClosedLoopLineage(analyses);
    return {analyses, strategyScorecards, domainScorecards, comparableGroups,
      ranking, recommendations, lineage};
  }
}

/** Canonical JSON: sorted object keys, deterministic number formatting. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortKeysDeep(v);
    return out;
  }
  return value;
}

export type {ClosedLoopValue};
