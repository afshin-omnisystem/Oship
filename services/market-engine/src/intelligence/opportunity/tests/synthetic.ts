/**
 * SPRINT 038 — synthetic learning contexts for controlled tests.
 *
 * The primary fixtures always use the REAL Sprint 037 learning result. These
 * helpers build minimal, structurally valid LearningResult variants (frozen,
 * self-consistent) so classification, dependency, score and cross-domain
 * branches can be exercised precisely — e.g. venue-spread scenarios the real
 * corpus does not contain. Synthetic contexts are test-only: nothing in the
 * engine trusts them beyond its own fail-closed validation.
 */

import type {
  LearningResult, LearningObservation, RegimeAssessment, FeatureVector,
  StrategyLearning, VenueLearning, OpportunityLearning, StabilityAssessment,
  DriftAssessment, LearningBaseline, LearningSubject,
} from '../../learning/types';
import {LEAKAGE_COMPONENTS} from '../../closed-loop/types';
import type {LeakageComponentName} from '../../closed-loop/types';
import {opportunityLearning} from '../test-fixtures';
import type {OpportunityCandidate} from '../types';

export interface SyntheticObservationSpec {
  readonly observationId: string;
  readonly domain: 'AFIS' | 'ABL';
  readonly opportunityClass: string;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly era: number;
  readonly timestamp: number;
  readonly theoreticalNet: number;
  readonly realizedNet: number;
  readonly totalLeakage: number;
  readonly preservationRatio: number | null;
  readonly executionQuality: number | null;
  readonly side?: string;
}

export const SYNTHETIC_BASE_TIME = 1714435150000;

export function syntheticObservation(spec: SyntheticObservationSpec): LearningObservation {
  return Object.freeze({
    observationId: spec.observationId,
    sourceMemoryId: 'mem-' + spec.observationId,
    sourceType: 'research.memory.v1' as const,
    sourceFingerprint: 'sfp-' + spec.observationId,
    domain: spec.domain,
    opportunityId: 'opp-' + spec.observationId,
    opportunityClass: spec.opportunityClass as LearningObservation['opportunityClass'],
    strategyId: spec.strategyId,
    venues: Object.freeze([...spec.venues]),
    policyId: 'policy-execution',
    policyVersion: 'v1',
    semanticSide: spec.side ?? 'BUY',
    timestamp: spec.timestamp,
    timeBucket: 'tb_s' + spec.era,
    era: spec.era,
    provenance: 'MEASURED' as never,
    schemaVersion: 'learning.observation.v1' as const,
    configurationFingerprint: 'synthetic',
    contentFingerprint: 'lcfp_' + spec.observationId,
    lineage: Object.freeze({
      researchAnalysisId: 'res_s', memoryId: 'mem-' + spec.observationId,
      batchId: 'b1', findingIds: Object.freeze([]),
      patternIds: Object.freeze([]), hypothesisIds: Object.freeze([]),
    }),
    evidenceState: 'STRONG',
    evidenceConfidence: 0.9,
    values: Object.freeze({
      theoreticalGross: spec.theoreticalNet,
      theoreticalNet: spec.theoreticalNet,
      realizedGross: spec.realizedNet + spec.totalLeakage,
      realizedCosts: spec.totalLeakage,
      realizedNet: spec.realizedNet,
      preservationRatio: spec.preservationRatio,
      preservationGrade: 'A',
      totalLeakage: spec.totalLeakage,
      leakageByComponent: Object.freeze(Object.fromEntries(
        LEAKAGE_COMPONENTS.map((component: LeakageComponentName) =>
          [component, component === 'FEES' ? spec.totalLeakage : 0]),
      ) as Record<LeakageComponentName, number>),
      unavailableComponents: Object.freeze([]),
      topLeakageComponent: 'FEES',
      executionQuality: spec.executionQuality,
      outcome: 'COMPLETED',
      failureClass: null,
      capitalScale: 1,
      deployedCapital: 100,
      approvedCapital: 100,
      adaptiveActions: 0,
      rerouteCount: 0,
      repriceCount: 0,
      resliceCount: 0,
      freshness: 0.9,
      confidence: 0.9,
      riskImpact: 'NO_CONSTRAINT',
      provenance: 'MEASURED',
    }),
    venueLegs: Object.freeze(spec.venues.map((venue, index) => Object.freeze({
      venue,
      side: spec.side ?? (index === 0 ? 'BUY' : 'SELL'),
      leakage: spec.totalLeakage / spec.venues.length,
      venueResult: 1,
      fillEfficiency: 0.9,
    }))),
  });
}

const EMPTY_PROVENANCE = Object.freeze({
  causalStatus: 'ASSOCIATIONAL_ONLY',
  observedAt: 0,
  source: 'synthetic',
  notes: Object.freeze([]),
}) as never;

/** A minimal but structurally valid learning result over given observations. */
export function syntheticLearning(
  observations: readonly LearningObservation[],
  overrides?: {
    readonly strategyLearning?: readonly StrategyLearning[];
    readonly venueLearning?: readonly VenueLearning[];
    readonly opportunityLearning?: readonly OpportunityLearning[];
    readonly stability?: readonly StabilityAssessment[];
    readonly drift?: readonly DriftAssessment[];
    readonly featureVectors?: readonly FeatureVector[];
  },
): LearningResult {
  const domain = observations[0]?.domain ?? 'AFIS';
  const regimes: RegimeAssessment[] = observations.length > 0
    ? [Object.freeze({
      regimeId: 'reg_s1', timeBucket: 'tb_s1', era: 1,
      from: SYNTHETIC_BASE_TIME, to: SYNTHETIC_BASE_TIME,
      sampleSize: observations.length,
      dimensions: Object.freeze([
        Object.freeze({dimension: 'VOLATILITY', classification: 'NORMAL',
          metric: 'dispersion/mean', value: 1.1, rule: 'synthetic'}),
        Object.freeze({dimension: 'LIQUIDITY', classification: 'NORMAL',
          metric: 'fill efficiency', value: 0.9, rule: 'synthetic'}),
        Object.freeze({dimension: 'EXECUTION_QUALITY', classification: 'NORMAL',
          metric: 'exec quality', value: 0.9, rule: 'synthetic'}),
      ]),
      evidenceState: 'STRONG',
      provenance: EMPTY_PROVENANCE,
      schemaVersion: 'learning.regime.v1' as never,
      configurationFingerprint: 'synthetic',
      contentFingerprint: 'synthetic',
      memoryIds: Object.freeze([]),
    })]
    : [];
  const emptyBaseline: LearningBaseline = Object.freeze({
    baselineId: 'base_s', kind: 'HISTORICAL', subject: null, scopeDomain: domain,
    metric: 'preservation', meanValue: 0.5, sampleSize: 10, evidenceState: 'STRONG',
    provenance: EMPTY_PROVENANCE, schemaVersion: 'learning.baseline.v1' as never,
    configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
    memoryIds: Object.freeze([]),
  });
  const strategies = [...new Set(observations.map((o) => o.strategyId))].map(
    (strategyId) => Object.freeze({
      learningId: 'sl_s_' + strategyId, strategyId,
      domain: observations.find((o) => o.strategyId === strategyId)?.domain ?? domain,
      sampleSize: observations.filter((o) => o.strategyId === strategyId).length,
      metrics: Object.freeze({
        preservation: 0.7, realizedValue: 5, completion: 1, leakage: 1,
        consistency: 0.8, trend: 0, sampleSize: 10, evidenceQuality: 0.9,
      }),
      stability: 'STABLE',
      classification: 'STABLE' as const,
      reasons: Object.freeze(['synthetic']),
      baseline: emptyBaseline, baselineDelta: 0,
      completionIsNotPreservation: true as const,
      evidenceState: 'STRONG' as const,
      provenance: EMPTY_PROVENANCE,
      schemaVersion: 'learning.strategy.v1' as never,
      configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
      memoryIds: Object.freeze([]),
    }));
  const venues = [...new Set(observations.flatMap((o) => o.venues))].map(
    (venue) => Object.freeze({
      learningId: 'vl_s_' + venue, venue,
      domains: Object.freeze([domain]),
      semanticSides: Object.freeze(['BUY', 'SELL']),
      sampleSize: observations.filter((o) => o.venues.includes(venue)).length,
      metrics: Object.freeze({
        fillEfficiency: 0.9, slippage: 0.1, leakage: 0.5, latency: 10,
        adverseDrift: 0, failureRate: 0, preservationContribution: 0.7,
        evidenceQuality: 0.9, stability: 'STABLE' as never,
      }),
      classification: 'CONSISTENTLY_STRONG' as const,
      reasons: Object.freeze(['synthetic']),
      baseline: emptyBaseline, baselineDelta: 0,
      evidenceState: 'STRONG' as const,
      provenance: EMPTY_PROVENANCE,
      schemaVersion: 'learning.venue.v1' as never,
      configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
      memoryIds: Object.freeze([]),
    }));
  const classes = [...new Set(observations.map((o) => o.opportunityClass))].map(
    (opportunityClass) => Object.freeze({
      learningId: 'ol_s_' + opportunityClass,
      opportunityClass: opportunityClass as never,
      domain,
      sampleSize: observations.filter((o) => o.opportunityClass === opportunityClass).length,
      meanPreservation: 0.7, trend: 0,
      classification: 'STABLE' as const,
      reasons: Object.freeze(['synthetic']),
      recurringLeakage: Object.freeze([]),
      recurringFailures: Object.freeze([]),
      highQualityConditions: Object.freeze([]),
      evidenceState: 'STRONG' as const,
      provenance: EMPTY_PROVENANCE,
      schemaVersion: 'learning.opportunity.v1' as never,
      configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
      memoryIds: Object.freeze([]),
    }));
  const stabilitySubjects: readonly LearningSubject[] = [
    ...strategies.map((s) => ({kind: 'STRATEGY' as const, key: s.strategyId})),
    ...classes.map((c) => ({kind: 'OPPORTUNITY_CLASS' as const,
      key: c.opportunityClass as string})),
    ...venues.map((v) => ({kind: 'VENUE' as const, key: v.venue})),
  ];
  const stability = stabilitySubjects.map((subject) => Object.freeze({
    stabilityId: 'st_s_' + subject.kind + '_' + subject.key,
    subject: Object.freeze(subject),
    metric: 'preservation',
    sampleSize: 10, eraConsistency: 0.9, dispersion: 0.1, regimeConsistency: 0.9,
    classification: 'STABLE' as const,
    reasons: Object.freeze(['synthetic']),
    evidenceState: 'STRONG' as const,
    schemaVersion: 'learning.stability.v1' as never,
    configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
  }));
  const drift = strategies.map((s) => Object.freeze({
    driftId: 'dr_s_' + s.strategyId,
    subject: Object.freeze({kind: 'STRATEGY' as const, key: s.strategyId}),
    metric: 'STRATEGY_PRESERVATION' as const,
    baseline: emptyBaseline,
    comparisonWindow: Object.freeze({
      from: SYNTHETIC_BASE_TIME, to: SYNTHETIC_BASE_TIME,
      buckets: Object.freeze(['tb_s1']), sampleSize: 10,
    }),
    baselineSampleSize: 10, observedDelta: 0,
    classification: 'NO_DRIFT' as const,
    evidenceState: 'STRONG' as const,
    provenance: EMPTY_PROVENANCE,
    schemaVersion: 'learning.drift.v1' as never,
    configurationFingerprint: 'synthetic', contentFingerprint: 'synthetic',
  }));
  return Object.freeze({
    analysisId: 'lres_synthetic',
    timestamp: SYNTHETIC_BASE_TIME,
    schemaVersion: 'learning.v1',
    correlationId: 'corr-synthetic',
    traceId: 'trace-synthetic',
    configurationFingerprint: 'synthetic',
    analysisFingerprint: 'lafp_synthetic',
    causalPolicy: 'ASSOCIATIONAL_ONLY',
    source: Object.freeze({
      researchAnalysisId: 'res_s', researchFingerprint: 'rfp_s',
      memoryRecords: observations.length,
      batches: Object.freeze([Object.freeze({
        batchId: 'b1', records: observations.length,
        accepted: observations.length, rejected: 0, failClosed: false,
        reason: null,
      })]),
      findings: 0, patterns: 0, hypotheses: 0,
    }),
    observations: Object.freeze(observations),
    features: Object.freeze([]),
    featureVectors: Object.freeze(overrides?.featureVectors ?? []),
    cohorts: Object.freeze([]),
    baselines: Object.freeze([emptyBaseline]),
    regimes: Object.freeze(regimes),
    strategyLearning: Object.freeze(overrides?.strategyLearning ?? strategies),
    opportunityLearning: Object.freeze(overrides?.opportunityLearning ?? classes),
    venueLearning: Object.freeze(overrides?.venueLearning ?? venues),
    policyLearning: Object.freeze([]),
    leakageLearning: Object.freeze([]),
    drift: Object.freeze(overrides?.drift ?? drift),
    stability: Object.freeze(overrides?.stability ?? stability),
    confidence: Object.freeze([]),
    signals: Object.freeze([]),
    priorities: Object.freeze([]),
    recommendations: Object.freeze([]),
    feedback: Object.freeze([]),
    lineage: Object.freeze({}) as never,
    auditEvents: Object.freeze([]),
    invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
    replay: Object.freeze({identical: true, fingerprint: 'lafp_synthetic'}),
  });
}

/** The real learning result with selected strategy learnings replaced. */
export function learningWithStrategyStability(
  strategyId: string, stability: string,
): LearningResult {
  const base = opportunityLearning();
  return Object.freeze({
    ...base,
    strategyLearning: Object.freeze(base.strategyLearning.map(
      (s) => s.strategyId === strategyId
        ? Object.freeze({...s, stability: stability as never}) : s)),
  });
}

/** A default synthetic candidate for engine-free stage tests. */
export function syntheticCandidate(
  overrides?: Partial<OpportunityCandidate>,
): OpportunityCandidate {
  return Object.freeze({
    candidateId: 'cand-synthetic',
    receivedAt: SYNTHETIC_BASE_TIME + 1000,
    domain: 'AFIS',
    opportunityClass: 'cross-venue-arbitrage',
    strategyId: 'synthetic-strategy',
    venues: Object.freeze(['venue-a', 'venue-b']),
    venueLegs: Object.freeze([
      Object.freeze({venue: 'venue-a', side: 'SELL', odds: null}),
      Object.freeze({venue: 'venue-b', side: 'BUY', odds: null}),
    ]),
    market: Object.freeze({
      theoreticalEdge: 10, spreadBps: 5, liquidityIndex: 0.9,
      imbalanceIndex: 0.2, volatilityIndex: 0.9, executionQualityIndex: 0.9,
    }),
    marketId: null,
    selectionId: null,
    ...overrides,
  });
}
