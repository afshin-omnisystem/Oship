import {
  ClosedLoopIntelligenceEngine, canonicalJson,
} from './intelligence/closed-loop/engine';
import {replayClosedLoopAnalysis, compareClosedLoopResults} from './intelligence/closed-loop/replay';
import {verifyClosedLoopAudit} from './intelligence/closed-loop/audit';
import {ingestOpportunityIdentity} from './intelligence/closed-loop/opportunity';
import {reconstructLifecycle} from './intelligence/closed-loop/lifecycle';
import {theoreticalValueModel, realizedComponents} from './intelligence/closed-loop/value';
import {edgePreservation} from './intelligence/closed-loop/edge';
import {leakageDecomposition} from './intelligence/closed-loop/leakage';
import {realizedOpportunityValue} from './intelligence/closed-loop/realized';
import {strategyAttribution} from './intelligence/closed-loop/strategy';
import {capitalAttribution} from './intelligence/closed-loop/capital-attribution';
import {riskAttribution} from './intelligence/closed-loop/risk';
import {executionAttribution} from './intelligence/closed-loop/execution';
import {controlAttribution} from './intelligence/closed-loop/control';
import {venueAttribution} from './intelligence/closed-loop/venue-attribution';
import {policyAttribution} from './intelligence/closed-loop/policy-attribution';
import {recordSessionView} from './intelligence/closed-loop/performance';
import {compareDomains, comparableGroupKeyOf} from './intelligence/closed-loop/aggregation';
import {compareStrategiesByPreservation} from './intelligence/closed-loop/strategy-attribution';
import {closedLoopCorpus, discoveredAfisOpportunity, discoveredAblOpportunity, CAP} from './intelligence/closed-loop/test-fixtures';
import {mergeClosedLoopConfig} from './intelligence/closed-loop/config';
import {CLOSED_LOOP_EVENT_TYPES, CLOSED_LOOP_INVARIANT_NAMES, LEAKAGE_COMPONENTS} from './intelligence/closed-loop/types';
import type {ClosedLoopRecord} from './intelligence/closed-loop/types';

/**
 * SPRINT 035 — MARKET-TO-EXECUTION CLOSED-LOOP INTELLIGENCE demo.
 *
 * PAPER / SIMULATION ONLY — AN INTELLIGENCE LAYER, NOT AN AUTHORITY.
 *
 * Every section drives the REAL closed loop over complete opportunity
 * lifecycles assembled from the canonical repository contracts:
 *
 *   OIIN → Opportunity → Strategy → Allocation → Risk → Execution Plan
 *   → Execution Control (Sprint 033) → Execution Performance (Sprint 034)
 *   → Attribution → Realized Opportunity Value → Closed-Loop Intelligence
 *
 * Nothing is mocked. The layer never mutates Treasury, Portfolio, Risk,
 * AEGIS or Execution, never touches the Strategy Registry, never activates a
 * policy and never calls live APIs. Every PASS line is backed by assertions
 * against actual engine output.
 */

const config = mergeClosedLoopConfig();
const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

const byLabel = (label: string): ClosedLoopRecord =>
  corpus.records.find((r) => r.label === label)!;
const analysisOf = (label: string) =>
  result.records.find((a) => a.label === label)!;

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
  near(actual: number | null, expected: number, label: string, tolerance = 1e-6): void {
    if (actual === null || Math.abs(actual - expected) > tolerance) {
      this.failures.push(`${label} (expected ~${expected}, got ${String(actual)})`);
    }
  }
  same<T>(actual: T, expected: T, label: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failures.push(`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    }
  }
  deepEqual<T>(actual: T, expected: T, label: string): void {
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
  // 1–2. Opportunity ingestion (AFIS + ABL) through REAL discovery
  // -------------------------------------------------------------------
  {
    const s = section('AFIS-INGESTION');
    const discovered = discoveredAfisOpportunity();
    const identity = ingestOpportunityIdentity(analysisOf('healthy-execution') === null ? byLabel('healthy-execution') : byLabel('healthy-execution'));
    s.check(discovered.opportunity.domain === 'AFIS', 'real discovery produced an AFIS opportunity');
    s.equal(discovered.opportunity.type, 'CROSS_VENUE_SPOT_ARBITRAGE', 'discovered type');
    s.check(discovered.opportunity.netEdge > 0, 'ranked opportunity carries a positive net edge');
    s.equal(identity.domain, 'AFIS', 'corpus identity domain');
    s.equal(identity.opportunityClass, 'cross-venue-arbitrage', 'deterministic class');
    s.check(identity.fingerprint.length > 0, 'identity fingerprinted');
  }
  {
    const s = section('ABL-INGESTION');
    const discovered = discoveredAblOpportunity();
    const identity = ingestOpportunityIdentity(byLabel('abl-surebet'));
    s.equal(discovered.opportunity.domain, 'ABL', 'real discovery produced an ABL opportunity');
    s.equal(discovered.opportunity.type, 'ODDS_ARBITRAGE_2WAY', 'discovered type');
    s.equal(identity.opportunityClass, 'surebet', 'ABL class');
    s.equal(identity.semanticSide, 'BACK', 'BACK/LAY semantics preserved');
    s.equal(identity.domain, 'ABL', 'corpus identity domain');
  }

  // -------------------------------------------------------------------
  // 3. Opportunity identity
  // -------------------------------------------------------------------
  {
    const s = section('OPPORTUNITY-IDENTITY');
    for (const record of corpus.records) {
      const identity = ingestOpportunityIdentity(record);
      s.equal(identity.opportunityId, record.opportunity.opportunityId, `id preserved (${record.label})`);
      s.equal(identity.sourceFingerprint, record.opportunity.fingerprint, `source fingerprint preserved (${record.label})`);
      s.equal(identity.theoreticalNetEdge, record.opportunity.netEdge, `theoretical net preserved (${record.label})`);
      s.equal(identity.evidenceCount, record.opportunity.evidence.length, `evidence preserved (${record.label})`);
    }
    const fingerprints = new Set(corpus.records.map((r) => ingestOpportunityIdentity(r).fingerprint));
    s.equal(fingerprints.size, corpus.records.length, 'identities unique per opportunity');
  }

  // -------------------------------------------------------------------
  // 4. Lifecycle reconstruction
  // -------------------------------------------------------------------
  {
    const s = section('LIFECYCLE');
    const healthy = reconstructLifecycle(byLabel('healthy-execution'));
    s.equal(healthy.stages.length, 9, 'all nine stages reconstructed');
    s.equal(healthy.stages[0].stage, 'OIIN_EVENT', 'chain starts at the OIIN event');
    s.equal(healthy.stages[8].stage, 'RESULT', 'chain ends at the result');
    s.equal(healthy.stages[0].parentId, null, 'root parents to null');
    for (let i = 1; i < healthy.stages.length; i++) {
      s.equal(healthy.stages[i].parentId, healthy.stages[i - 1].stageId, `stage ${i} parents to predecessor`);
    }
    s.check(healthy.valid, 'healthy lifecycle valid');
    for (const record of corpus.records) {
      const lifecycle = reconstructLifecycle(record);
      s.check(lifecycle.valid, `${record.label} lifecycle valid`);
    }
  }

  // -------------------------------------------------------------------
  // 5. Strategy attribution
  // -------------------------------------------------------------------
  {
    const s = section('STRATEGY-ATTRIBUTION');
    const attr = strategyAttribution(byLabel('healthy-execution'));
    s.equal(attr.strategyId, 'arb-guardian', 'strategy identity');
    s.near(attr.originalOpportunityValue, 6.4, 'original opportunity value (net edge)');
    s.near(attr.strategyRealizedValue.value, 5.9, 'strategy realized value');
    s.equal(attr.executionSuccess, true, 'healthy session completed');
    s.equal(attr.strategyLeakage.value, 0, 'guardian left nothing on the table');
    const trial = strategyAttribution(byLabel('policy-v1.1-trial'));
    s.equal(trial.executionSuccess, true, 'trial completed execution');
    s.check(trial.strategyRealizedValue.value! < 0, 'but destroyed value end-to-end');
  }

  // -------------------------------------------------------------------
  // 6. Allocation attribution
  // -------------------------------------------------------------------
  {
    const s = section('ALLOCATION-ATTRIBUTION');
    const capital = capitalAttribution(byLabel('risk-throttled'));
    s.equal(capital.requestedCapital, 10_000, 'requested capital');
    s.equal(capital.allocatedCapital, 10_000, 'allocated capital');
    s.equal(capital.approvedCapital, 4_000, 'risk-approved capital');
    s.equal(capital.deployedCapital, 4_000, 'deployed capital');
    s.equal(capital.unusedCapital, 6_000, 'unused capital blocked by risk');
    s.near(capital.capitalUtilization.value, 0.4, 'capital utilization 40%');
    s.check(capital.deployedCapital <= capital.approvedCapital, 'deployed never exceeds approval');
  }

  // -------------------------------------------------------------------
  // 7. Risk attribution (protective, never judged by realized profit)
  // -------------------------------------------------------------------
  {
    const s = section('RISK-ATTRIBUTION');
    const throttled = riskAttribution(byLabel('risk-throttled'));
    s.equal(throttled.impactKind, 'PROTECTIVE_CONSTRAINT', 'impact classified protective');
    s.near(throttled.theoreticalValueBeforeRisk, 8.4, 'value before risk');
    s.near(throttled.theoreticalValueAfterRisk, 3.36, 'value after risk (40% approval)');
    s.check(throttled.protectedValue.value! > 0, 'protected value quantified');
    s.deepEqual(throttled.violations, ['MAX_OPPORTUNITY_EXPOSURE'], 'violations carried verbatim');
    s.equal(throttled.riskPreservedBoundary, true, 'boundary preserved');
    const healthy = riskAttribution(byLabel('healthy-execution'));
    s.equal(healthy.impactKind, 'NO_CONSTRAINT', 'healthy record unconstrained');
  }

  // -------------------------------------------------------------------
  // 8. Execution attribution (consumes Sprint 034)
  // -------------------------------------------------------------------
  {
    const s = section('EXECUTION-ATTRIBUTION');
    const adverse = executionAttribution(byLabel('adverse-venue-drift'));
    s.equal(adverse.finalState, 'COMPLETED', 'final state');
    s.check(adverse.executionQuality !== null && adverse.executionQuality < 0.9, 'Sprint 034 quality consumed');
    s.near(adverse.executionLeakage.value, 10.5, 'execution leakage = undelivered gross (BUY 101 vs 100, SELL 99.95 vs 100)');
    s.check(adverse.attributionId.startsWith('patt_'), 'Sprint 034 attribution id carried');
    const steady = executionAttribution(byLabel('steady-single'));
    s.equal(steady.executionLeakage.value, 0, 'perfect execution delivers everything');
  }

  // -------------------------------------------------------------------
  // 9. Control attribution (consumes Sprint 033 sessions)
  // -------------------------------------------------------------------
  {
    const s = section('CONTROL-ATTRIBUTION');
    const recovery = controlAttribution(byLabel('adaptive-recovery'));
    s.equal(recovery.cyclesExecuted, 3, 'three control cycles');
    s.equal(recovery.actionCounts.RESLICE, 2, 'two reslices');
    s.equal(recovery.actionCounts.REPRICE, 1, 'one reprice');
    s.check(recovery.adaptiveActionImprovements >= 2, 'adaptive actions improved quality');
    s.equal(recovery.adaptiveActionDegradations, 0, 'none degraded');
    const reprice = recovery.occurrences.find((o) => o.action === 'REPRICE')!;
    s.check(reprice.preActionQuality !== null && reprice.postActionQuality !== null, 'pre/post quality tracked');
    s.check(reprice.postActionQuality !== null && reprice.preActionQuality !== null
      && reprice.postActionQuality > reprice.preActionQuality, 'reprice improved quality');
    const oscillation = controlAttribution(byLabel('oscillation-abort'));
    s.equal(oscillation.actionCounts.REROUTE, 3, 'reroute storm counted');
    s.equal(oscillation.finalState, 'ABORTED', 'oscillation guard aborted');
  }

  // -------------------------------------------------------------------
  // 10. Performance ingestion (Sprint 034 results consumed)
  // -------------------------------------------------------------------
  {
    const s = section('PERFORMANCE-INGESTION');
    for (const record of corpus.records) {
      const view = recordSessionView(record);
      s.check(view.observations.length > 0, `${record.label} observations resolved from Sprint 034`);
      s.check(view.attribution !== null, `${record.label} Sprint 034 attribution resolved`);
      s.check(view.quality !== null, `${record.label} Sprint 034 quality resolved`);
    }
    const policyRecord = byLabel('policy-v1.1-trial');
    s.check(policyRecord.performance!.candidates.length > 0, 'Sprint 034 policy candidates consumed');
    s.equal(policyRecord.performance!.candidates[0].promotionState, 'ELIGIBLE', 'candidate is ELIGIBLE (never ACTIVE)');
  }

  // -------------------------------------------------------------------
  // 11. Theoretical edge
  // -------------------------------------------------------------------
  {
    const s = section('THEORETICAL-EDGE');
    const healthy = theoreticalValueModel(byLabel('healthy-execution'));
    s.near(healthy.fullTheoreticalGrossEdge, 8.0, 'full gross edge');
    s.near(healthy.fullEstimatedCosts, 1.6, 'estimated costs');
    s.near(healthy.fullTheoreticalNetEdge, 6.4, 'gross − costs = net');
    s.equal(healthy.capitalScale.value, 1, 'full capital deployed');
    const throttled = theoreticalValueModel(byLabel('risk-throttled'));
    s.near(throttled.capitalScale.value, 0.4, 'throttled capital scale');
    s.near(throttled.theoreticalNetEdge.value, 3.36, 'net edge scales with deployment');
  }

  // -------------------------------------------------------------------
  // 12. Realized value
  // -------------------------------------------------------------------
  {
    const s = section('REALIZED-VALUE');
    for (const record of corpus.records) {
      const value = realizedOpportunityValue(record, config);
      const gross = value.realizedGrossValue.value;
      const costs = value.realizedCosts.value;
      const net = value.realizedNetValue.value;
      if (gross !== null && costs !== null && net !== null) {
        s.check(Math.abs(gross - costs - net) < 1e-9, `${record.label}: net = gross − costs`);
      }
    }
    s.near(realizedOpportunityValue(byLabel('healthy-execution'), config).realizedNetValue.value, 5.9, 'healthy realized net 5.9');
    s.near(realizedOpportunityValue(byLabel('steady-single'), config).realizedNetValue.value, 1.2, 'steady realized net 1.2');
    s.near(realizedOpportunityValue(byLabel('stale-intel'), config).realizedNetValue.value, 0, 'stale abort realized zero');
    s.check(realizedOpportunityValue(byLabel('policy-v1.1-trial'), config).realizedNetValue.value! < 0, 'value destruction reported honestly');
  }

  // -------------------------------------------------------------------
  // 13. Edge preservation
  // -------------------------------------------------------------------
  {
    const s = section('EDGE-PRESERVATION');
    const healthy = edgePreservation(byLabel('healthy-execution'));
    s.near(healthy.preservationRatio.value, 5.9 / 6.4, 'healthy preservation 92.2%');
    s.equal(healthy.availability, 'AVAILABLE', 'ratio available');
    const steady = edgePreservation(byLabel('steady-single'));
    s.near(steady.preservationRatio.value, 1, 'steady preserves 100%');
    const stale = edgePreservation(byLabel('stale-intel'));
    s.equal(stale.preservationRatio.value, 0, 'stale preserves nothing');
    // High edge with poor execution vs lower edge with superior preservation.
    const highEdge = edgePreservation(byLabel('high-edge-poor-exec'));
    s.check(steady.originalEdge.value! < highEdge.originalEdge.value!, 'steady edge is LOWER');
    s.check(steady.preservationRatio.value! > highEdge.preservationRatio.value!, 'steady preservation is HIGHER');
  }

  // -------------------------------------------------------------------
  // 14. Leakage decomposition
  // -------------------------------------------------------------------
  {
    const s = section('LEAKAGE');
    for (const record of corpus.records) {
      const leakage = leakageDecomposition(record, config);
      s.equal(leakage.components.length, 17, `${record.label}: 17 components`);
      const names = leakage.components.map((c) => c.component);
      for (const expected of LEAKAGE_COMPONENTS) {
        s.check(names.includes(expected), `${record.label}: component ${expected} present`);
      }
      const sum = leakage.components.reduce((acc, c) => acc + c.value, 0);
      s.check(Math.abs(sum - leakage.totalLeakage) < 1e-6, `${record.label}: Σ components = total leakage`);
      s.check(leakage.reconciles, `${record.label}: reconciles`);
      for (const component of leakage.components) {
        if (!component.available) {
          s.equal(component.value, 0, `${record.label}/${component.component}: unavailable carries no value`);
        }
      }
    }
    const adverse = leakageDecomposition(byLabel('adverse-venue-drift'), config);
    s.check(adverse.components.find((c) => c.component === 'SLIPPAGE')!.value > 0, 'adverse drift slippage leakage');
    const partial = leakageDecomposition(byLabel('partial-completion'), config);
    s.check(partial.components.find((c) => c.component === 'PARTIAL_FILL_LEAKAGE')!.value > 0, 'partial-fill leakage');
    const stale = leakageDecomposition(byLabel('stale-intel'), config);
    s.check(stale.components.find((c) => c.component === 'STALE_INFORMATION')!.value > 0, 'stale-information leakage');
    s.check(stale.components.find((c) => c.component === 'OPPORTUNITY_DECAY')!.value > 0, 'opportunity decay leakage');
  }

  // -------------------------------------------------------------------
  // 15. Venue attribution (venue-induced leakage)
  // -------------------------------------------------------------------
  {
    const s = section('VENUE-ATTRIBUTION');
    const leak = venueAttribution(byLabel('venue-leakage'));
    s.equal(leak.benchmarkVenue, 'venue-b', 'benchmark venue is the cheaper one');
    const venueA = leak.venues.find((v) => v.venue === 'venue-a')!;
    s.near(venueA.venueLeakage.value, 5, 'venue-a leakage (paid 100.5 vs best 100.0 × 10)');
    s.near(leak.totalVenueLeakage.value, 5, 'total venue leakage');
    const benchmarkLeg = leak.venues.find((v) => v.venue === leak.benchmarkVenue)!;
    s.equal(benchmarkLeg.venueLeakage.value, 0, 'benchmark venue has zero leakage vs itself');
    const abl = venueAttribution(byLabel('abl-surebet'));
    s.deepEqual(abl.venues.map((v) => v.side).sort(), ['BACK', 'LAY'], 'ABL venue sides preserved');
  }

  // -------------------------------------------------------------------
  // 16. Policy attribution
  // -------------------------------------------------------------------
  {
    const s = section('POLICY-ATTRIBUTION');
    const trial = policyAttribution(byLabel('policy-v1.1-trial'));
    s.equal(trial.policyVersion, 'v1.1', 'trial ran the candidate policy');
    s.equal(trial.baselinePolicyVersion, 'v1', 'baseline identified');
    s.equal(trial.candidatePolicyVersion, 'v1.1', 'candidate identified');
    s.check(trial.policyDelta.value! > 0, 'policy score IMPROVED vs baseline');
    s.check(trial.realizedResult.value! < 0, 'but end-to-end value was destroyed');
    s.equal(trial.preservedEndToEndValue, false, 'candidate did NOT preserve end-to-end value');
    const baseline = policyAttribution(byLabel('healthy-execution'));
    s.near(baseline.policyDelta.value, 0, 'baseline delta is zero');
  }

  // -------------------------------------------------------------------
  // 17. Capital efficiency
  // -------------------------------------------------------------------
  {
    const s = section('CAPITAL-EFFICIENCY');
    const steady = capitalAttribution(byLabel('steady-single'));
    s.near(steady.valuePerUnitCapital.value, 1.2 / 10_000, 'value per unit capital');
    s.near(steady.allocationEfficiency.value, 1, 'delivered exactly the risk-adjusted promise');
    const trial = capitalAttribution(byLabel('policy-v1.1-trial'));
    s.check(trial.valuePerUnitCapital.value! < 0, 'value destruction per unit capital');
    for (const record of corpus.records) {
      const capital = capitalAttribution(record);
      s.check(capital.deployedCapital <= capital.approvedCapital + 1e-9, `${record.label}: deployed ≤ approved`);
    }
  }

  // -------------------------------------------------------------------
  // 18. Strategy score (genuinely superior strategy)
  // -------------------------------------------------------------------
  {
    const s = section('STRATEGY-SCORE');
    const guardian = result.strategyScorecards.find((x) => x.strategyId === 'arb-guardian')!;
    const aggressive = result.strategyScorecards.find((x) => x.strategyId === 'arb-aggressive')!;
    s.equal(guardian.opportunityCount, 6, 'guardian ran 6 opportunities');
    s.equal(aggressive.opportunityCount, 6, 'aggressive ran 6 opportunities');
    s.check(guardian.preservationRatio.value! > aggressive.preservationRatio.value!, 'guardian preserves more edge');
    s.equal(guardian.completedCount, 3, 'guardian completed 3 of 6');
    s.equal(aggressive.completedCount, 4, 'aggressive completed 4 of 6');
    s.check(aggressive.completedCount > guardian.completedCount
      && guardian.preservationRatio.value! > aggressive.preservationRatio.value!,
      'aggressive completes MORE yet preserves FAR LESS — completion is not preservation');
    const ranked = compareStrategiesByPreservation(result.strategyScorecards.filter((x) => x.domain === 'AFIS'));
    s.equal(ranked[0].strategyId, 'arb-guardian', 'guardian ranks first in AFIS');
  }

  // -------------------------------------------------------------------
  // 19–20. AFIS / ABL domain scores
  // -------------------------------------------------------------------
  {
    const s = section('AFIS-SCORE');
    const afis = result.domainScorecards.find((d) => d.domain === 'AFIS')!;
    s.equal(afis.opportunityVolume, 12, '12 AFIS opportunities');
    s.check(afis.theoreticalValue > 0, 'theoretical value aggregated');
    s.check(afis.preservation.value !== null, 'preservation measured');
    s.check(afis.leakage.value! > 0, 'adverse AFIS records leak measurably');
  }
  {
    const s = section('ABL-SCORE');
    const abl = result.domainScorecards.find((d) => d.domain === 'ABL')!;
    s.equal(abl.opportunityVolume, 1, '1 ABL opportunity');
    s.near(abl.theoreticalValue, 4.4, 'ABL theoretical value');
    s.near(abl.preservation.value, 3.9 / 4.4, 'ABL preservation 88.6%');
    s.check(abl.executionSuccess.value! > 0.5, 'ABL surebet completed');
  }

  // -------------------------------------------------------------------
  // 21. Cross-domain aggregation (one engine)
  // -------------------------------------------------------------------
  {
    const s = section('CROSS-DOMAIN');
    const comparison = compareDomains(result.domainScorecards);
    s.check(comparison.afis !== null && comparison.abl !== null, 'both domains present');
    s.equal(comparison.higherPreservation, 'ABL', 'ABL preserved more (single perfect record)');
    const domains = new Set(result.records.map((a) => a.identity.domain));
    s.same([...domains].sort(), ['ABL', 'AFIS'], 'one engine, both domains');
    const afis = result.records.find((a) => a.identity.domain === 'AFIS')!;
    const abl = result.records.find((a) => a.identity.domain === 'ABL')!;
    s.same(Object.keys(afis.realized), Object.keys(abl.realized), 'identical analysis shapes across domains');
  }

  // -------------------------------------------------------------------
  // 22. Comparable opportunities
  // -------------------------------------------------------------------
  {
    const s = section('COMPARABLE');
    const total = result.comparableGroups.reduce((acc, g) => acc + g.opportunityIds.length, 0);
    s.equal(total, corpus.records.length, 'groups partition the corpus');
    const staleKey = comparableGroupKeyOf(analysisOf('stale-intel'), config);
    s.equal(staleKey.freshnessBand, 'STALE', 'stale record isolated in its freshness band');
    const healthyKey = comparableGroupKeyOf(analysisOf('healthy-execution'), config);
    s.equal(healthyKey.freshnessBand, 'VERY_FRESH', 'healthy record in the fresh band');
    const comparable = result.comparableGroups.filter((g) => g.comparable);
    s.check(comparable.length > 0, 'at least one comparable group exists');
    for (const group of result.comparableGroups.filter((g) => !g.comparable)) {
      s.check(group.insufficientDataReason !== null, 'insufficient groups carry an explicit reason');
    }
  }

  // -------------------------------------------------------------------
  // 23. Deterministic ranking (analytical, never authorization)
  // -------------------------------------------------------------------
  {
    const s = section('RANKING');
    s.equal(result.ranking.length, corpus.records.length, 'every opportunity ranked');
    s.same(result.ranking.map((r) => r.rank), result.ranking.map((_, i) => i + 1), 'ranks contiguous from 1');
    for (let i = 1; i < result.ranking.length; i++) {
      const prev = result.ranking[i - 1];
      const cur = result.ranking[i];
      s.check(prev.score.value! > cur.score.value!
        || (prev.score.value === cur.score.value && prev.opportunityId < cur.opportunityId), 'sorted by score desc, id tiebreak');
    }
    const serialized = JSON.stringify(result.ranking);
    s.check(!serialized.includes('"authorized"'), 'ranking never authorizes');
  }

  // -------------------------------------------------------------------
  // 24. Insufficient data
  // -------------------------------------------------------------------
  {
    const s = section('INSUFFICIENT-DATA');
    const strict = new ClosedLoopIntelligenceEngine({minSampleRecords: 99});
    const strictResult = strict.analyze(corpus.input);
    const strategyRec = strictResult.recommendations.find((r) => r.kind === 'STRATEGY_PRESERVES_MORE');
    s.check(strategyRec === undefined, 'strategy comparison suppressed without enough samples');
    const insufficientGroups = result.comparableGroups.filter((g) => !g.comparable);
    s.check(insufficientGroups.length > 0, 'insufficient groups excluded from comparison');
    s.check(result.recommendations.some((r) => r.kind === 'INSUFFICIENT_DATA'), 'insufficient-data recommendation emitted');
  }

  // -------------------------------------------------------------------
  // 25. Unavailable provenance (honesty)
  // -------------------------------------------------------------------
  {
    const s = section('UNAVAILABLE-PROVENANCE');
    const bare = {...byLabel('healthy-execution'), performance: null};
    const bareResult = new ClosedLoopIntelligenceEngine().analyze({
      records: [bare], timestamp: corpus.input.timestamp, correlationId: 'bare', traceId: 'bare-trace',
    });
    const analysis = bareResult.records[0];
    s.equal(analysis.strategy.strategyQuality.value, null, 'quality UNAVAILABLE without Sprint 034');
    s.equal(analysis.strategy.strategyQuality.provenance, 'UNAVAILABLE', 'provenance explicit');
    s.equal(analysis.policy.objective.value, null, 'policy objective UNAVAILABLE');
    s.equal(analysis.execution.attributionId, 'unavailable', 'attribution id honest');
    const view = recordSessionView(bare);
    s.equal(view.observations.length, 0, 'no observations fabricated');
    s.equal(analysis.realized.provenance, 'UNAVAILABLE', 'roll-up provenance degrades to UNAVAILABLE');
    s.equal(analysis.realized.realizedGrossValue.value, 0, 'unobserved fills are never credited');
    s.equal(realizedComponents(bare).fillCompletion, 0, 'fill completion is zero without Sprint 034');
    const netValue = analysis.realized.realizedNetValue;
    if (netValue.provenance === 'UNAVAILABLE') {
      s.equal(netValue.value, null, 'an UNAVAILABLE value never carries a number');
    } else {
      s.check(netValue.source !== undefined && netValue.source.length > 0, 'any carried value states its exact source');
    }
  }

  // -------------------------------------------------------------------
  // 26. Contradictory lifecycle fails closed
  // -------------------------------------------------------------------
  {
    const s = section('FAIL-CLOSED');
    const broken: ClosedLoopRecord = {...byLabel('healthy-execution'),
      plan: {...byLabel('healthy-execution').plan, opportunityId: 'opp_MISMATCH'}};
    let refused = false;
    try {
      engine.analyze({...corpus.input, records: [broken]});
    } catch {
      refused = true;
    }
    s.check(refused, 'contradictory lifecycle record refused — fail closed');
    const orphan: ClosedLoopRecord = {...byLabel('healthy-execution'),
      allocation: {...byLabel('healthy-execution').allocation, opportunityId: 'opp_ORPHAN'}};
    let orphanRefused = false;
    try {
      engine.analyze({...corpus.input, records: [orphan]});
    } catch {
      orphanRefused = true;
    }
    s.check(orphanRefused, 'orphan allocation refused — fail closed');
    const quantityBreak: ClosedLoopRecord = {...byLabel('healthy-execution'),
      session: {...byLabel('healthy-execution').session, session: {...byLabel('healthy-execution').session.session,
        finalResult: {...byLabel('healthy-execution').session.session.finalResult!, filledQuantity: 999}}}};
    let quantityRefused = false;
    try {
      engine.analyze({...corpus.input, records: [quantityBreak]});
    } catch {
      quantityRefused = true;
    }
    s.check(quantityRefused, 'quantity contradiction refused — fail closed');
  }

  // -------------------------------------------------------------------
  // 27. Replay determinism (byte-identical)
  // -------------------------------------------------------------------
  {
    const s = section('REPLAY');
    const {comparison} = replayClosedLoopAnalysis(corpus.input);
    s.check(comparison.identical, 'replay is byte-identical');
    s.equal(comparison.originalFingerprint, comparison.replayFingerprint, 'fingerprints identical');
    const second = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
    s.equal(canonicalJson(second), canonicalJson(result), 'full result canonical JSON identical');
    const replayEvent = result.auditEvents[result.auditEvents.length - 1];
    s.equal(replayEvent.eventType, 'replay-completed', 'replay-completed is the terminal audit event');
    s.equal(replayEvent.payload.identical, true, 'internal replay recorded as identical');
  }

  // -------------------------------------------------------------------
  // 28. Audit verification
  // -------------------------------------------------------------------
  {
    const s = section('AUDIT');
    const verification = verifyClosedLoopAudit(result.auditEvents, result.auditEvents.length);
    s.check(verification.valid, 'audit chain verifies');
    s.equal(result.auditEvents[0].previousHash, '0'.repeat(64), 'chain roots at GENESIS');
    const emitted = new Set(result.auditEvents.map((e) => e.eventType));
    for (const expected of CLOSED_LOOP_EVENT_TYPES) {
      s.check(emitted.has(expected), `audit event ${expected} emitted`);
    }
    s.equal(result.auditEvents[result.auditEvents.length - 1].eventType, 'replay-completed', 'terminal event');
    for (let i = 1; i < result.auditEvents.length; i++) {
      s.equal(result.auditEvents[i].previousHash, result.auditEvents[i - 1].hash, `event ${i} chained`);
    }
  }

  // -------------------------------------------------------------------
  // 29. Tamper detection
  // -------------------------------------------------------------------
  {
    const s = section('AUDIT-TAMPER');
    const tamperedHash = result.auditEvents.map((e) => ({...e}));
    tamperedHash[5] = {...tamperedHash[5], hash: 'f'.repeat(64)};
    s.check(!verifyClosedLoopAudit(tamperedHash, tamperedHash.length).valid, 'hash tampering detected');
    const tamperedPayload = result.auditEvents.map((e) => ({...e}));
    tamperedPayload[5] = {...tamperedPayload[5], payloadFingerprint: '0'.repeat(64)};
    s.check(!verifyClosedLoopAudit(tamperedPayload, tamperedPayload.length).valid, 'payload tampering detected');
    const truncated = result.auditEvents.slice(0, -5);
    s.check(!verifyClosedLoopAudit(truncated, result.auditEvents.length).valid, 'truncation detected');
    const reordered = [...result.auditEvents];
    [reordered[2], reordered[3]] = [reordered[3], reordered[2]];
    s.check(!verifyClosedLoopAudit(reordered, reordered.length).valid, 'reordering detected');
  }

  // -------------------------------------------------------------------
  // 30. End-to-end reconciliation
  // -------------------------------------------------------------------
  {
    const s = section('END-TO-END');
    s.check(result.invariants!.passed, 'all invariants pass');
    s.equal(result.invariants!.checks.length, 35, '35 invariant checks');
    for (const name of CLOSED_LOOP_INVARIANT_NAMES) {
      const check = result.invariants!.checks.find((c) => c.invariant === name);
      s.check(check !== undefined && check.passed, `invariant ${name}`);
    }
    const realized = realizedComponents(byLabel('healthy-execution'));
    s.equal(realized.totalFilled, 20, 'healthy session filled both legs');
    s.near(realized.fillCompletion, 1, 'completion 100%');
    const comparison = compareClosedLoopResults(result, new ClosedLoopIntelligenceEngine().analyze(corpus.input));
    s.check(comparison.identical, 'end-to-end byte identity');
  }

  // -------------------------------------------------------------------
  // Scenario: high edge with poor execution vs lower edge superior preservation
  // -------------------------------------------------------------------
  {
    const s = section('HIGH-EDGE-POOR-EXEC');
    const highEdge = analysisOf('high-edge-poor-exec');
    s.near(highEdge.theoretical.theoreticalNetEdge.value, 11.2, 'high theoretical net edge');
    s.equal(highEdge.score.grade, 'C', 'poor execution degrades the grade');
    s.near(highEdge.realized.preservationRatio.value, 8.2 / 11.2, '73.2% preserved');
    const steady = analysisOf('steady-single');
    s.check(steady.theoretical.theoreticalNetEdge.value! < highEdge.theoretical.theoreticalNetEdge.value!, 'lower theoretical edge');
    s.equal(steady.score.grade, 'A', 'superior preservation grade');
    s.check(steady.realized.preservationRatio.value! > highEdge.realized.preservationRatio.value!, 'preserves more');
  }

  // -------------------------------------------------------------------
  // Scenario: risk-constrained opportunity
  // -------------------------------------------------------------------
  {
    const s = section('RISK-CONSTRAINED');
    const throttled = analysisOf('risk-throttled');
    s.equal(throttled.risk.impactKind, 'PROTECTIVE_CONSTRAINT', 'protective classification');
    s.near(throttled.theoretical.theoreticalNetEdge.value, 3.36, 'theoretical net at 40% scale');
    s.check(throttled.risk.protectedValue.value! > 0, 'protected value quantified');
    s.check(result.recommendations.some((r) => r.kind === 'RISK_PROTECTS_DOWNSIDE'), 'protective recommendation emitted');
  }

  // -------------------------------------------------------------------
  // Scenario: venue-induced leakage
  // -------------------------------------------------------------------
  {
    const s = section('VENUE-INDUCED-LEAKAGE');
    const leak = analysisOf('venue-leakage');
    s.near(leak.venue.totalVenueLeakage.value, 5, '5.0 dollars of venue leakage');
    s.check(result.recommendations.some((r) => r.kind === 'VENUE_LOWER_LEAKAGE'), 'venue recommendation emitted');
    const venueB = leak.venue.venues.find((v) => v.venue === 'venue-b')!;
    s.near(venueB.fillEfficiency.value, 1, 'benchmark venue filled completely');
  }

  // -------------------------------------------------------------------
  // Scenario: adaptive action improving / degrading outcomes
  // -------------------------------------------------------------------
  {
    const s = section('ADAPTIVE-ACTIONS');
    const recovery = analysisOf('adaptive-recovery');
    const reprice = recovery.control.occurrences.find((o) => o.action === 'REPRICE')!;
    s.check(reprice.improved === true, 'reprice improved quality');
    s.check(result.recommendations.some((r) => r.kind === 'REPRICE_IMPROVES_PRESERVATION'), 'reprice recommendation emitted');
    s.check(result.recommendations.some((r) => r.kind === 'RESLICE_COMPLETION_VS_COST'), 'reslice trade-off recommendation emitted');
    const oscillation = analysisOf('oscillation-abort');
    s.equal(oscillation.control.finalState, 'ABORTED', 'reroute oscillation degraded the outcome');
    s.equal(oscillation.control.actionCounts.REROUTE, 3, 'three reroutes before the guard fired');
    const healthyTwin = analysisOf('healthy-execution');
    s.check(oscillation.realized.preservationRatio.value! < healthyTwin.realized.preservationRatio.value!,
      'the reroute storm destroyed what its healthy twin preserved');
    s.check(recovery.realized.realizedNetValue.value! < 0
      && recovery.control.adaptiveActionImprovements >= 2,
      'recovery: every adaptive action improved quality, yet the honest accounting still nets negative');
  }

  // -------------------------------------------------------------------
  // Scenario: policy candidate improves execution but not end-to-end value
  // -------------------------------------------------------------------
  {
    const s = section('POLICY-CANDIDATE');
    const trial = analysisOf('policy-v1.1-trial');
    s.check(trial.policy.policyDelta.value! > 0, 'policy score improved vs baseline');
    s.check(trial.realized.realizedNetValue.value! < 0, 'end-to-end value destroyed');
    s.check(result.recommendations.some((r) => r.kind === 'POLICY_CANDIDATE_NOT_END_TO_END'), 'recommendation emitted');
    s.equal(trial.policy.candidatePolicyVersion, 'v1.1', 'candidate identified');
    s.check(trial.policy.candidatePolicyVersion !== null
      && corpus.records.every((r) => r.session.policyVersion !== 'ACTIVE'), 'no policy was ever activated');
  }

  // -------------------------------------------------------------------
  // Scenario: genuinely superior strategy preserves more edge
  // -------------------------------------------------------------------
  {
    const s = section('SUPERIOR-STRATEGY');
    const guardian = result.strategyScorecards.find((x) => x.strategyId === 'arb-guardian')!;
    const aggressive = result.strategyScorecards.find((x) => x.strategyId === 'arb-aggressive')!;
    s.check(guardian.preservationRatio.value! > aggressive.preservationRatio.value! + 0.3, 'guardian preserves 30+ points more');
    s.check(result.recommendations.some((r) => r.kind === 'STRATEGY_PRESERVES_MORE'), 'strategy recommendation emitted');
    s.check(result.recommendations.some((r) => r.kind === 'CLASS_LOSES_VALUE'), 'class-loss recommendation emitted');
  }

  // -------------------------------------------------------------------
  // No-authority guarantee
  // -------------------------------------------------------------------
  {
    const s = section('NO-AUTHORITY');
    const serialized = JSON.stringify({
      records: result.records.map((a) => [a.strategy, a.capital, a.risk, a.execution, a.policy]),
      ranking: result.ranking, recommendations: result.recommendations,
      scorecards: result.strategyScorecards, domains: result.domainScorecards,
    });
    for (const forbidden of ['treasuryMutation', 'portfolioMutation', 'riskMutation', 'aegisMutation',
      'executionMutation', 'mutateTreasury', 'mutatePortfolio', 'mutateRisk', 'mutateAegis', 'mutateExecution']) {
      s.check(!serialized.includes(`"${forbidden}"`), `no ${forbidden} surface`);
    }
    for (const rec of result.recommendations) {
      s.equal(rec.informational, true, 'recommendations are informational only');
    }
  }

  // -------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------
  const failed = sections.filter((x) => x.failures.length > 0);
  const lines: string[] = [];
  lines.push('==============================================================================');
  lines.push(' SPRINT 035 — MARKET-TO-EXECUTION CLOSED-LOOP INTELLIGENCE (PAPER / SIMULATION)');
  lines.push('==============================================================================');
  for (const record of result.records) {
    lines.push(`  ${record.label.padEnd(22)} ${record.identity.domain}  edge=${record.theoretical.theoreticalNetEdge.value?.toFixed(2)}`
      + `  realized=${record.realized.realizedNetValue.value?.toFixed(2)}`
      + `  preserved=${(record.realized.preservationRatio.value ?? 0).toFixed(3)}  grade=${record.score.grade}`);
  }
  lines.push('');
  lines.push(`  Strategies: ${result.strategyScorecards.map((x) => `${x.strategyId}=${(x.preservationRatio.value ?? 0).toFixed(3)}(${x.opportunityCount})`).join('  ')}`);
  lines.push(`  Domains:    ${result.domainScorecards.map((x) => `${x.domain} preservation=${(x.preservation.value ?? 0).toFixed(3)} volume=${x.opportunityVolume}`).join('  ')}`);
  lines.push(`  Top ranked: ${result.ranking.slice(0, 3).map((r) => `#${r.rank} ${r.opportunityId}`).join('  ')}`);
  lines.push(`  Recommendations: ${result.recommendations.length} (all informational)`);
  lines.push(`  Audit events: ${result.auditEvents.length}  Invariants: ${result.invariants!.checks.length}/${result.invariants!.checks.length} pass`);
  lines.push('');
  lines.push('==============================================================================');
  if (failed.length === 0) {
    lines.push(` SPRINT 035 VALIDATION: ${sections.length}/${sections.length} sections PASS`);
    lines.push('');
    lines.push(' The complete opportunity lifecycle was reconstructed and attributed:');
    lines.push(' OIIN → Opportunity → Strategy → Allocation → Risk → Execution Plan →');
    lines.push(' Control → Performance → Attribution → Realized Opportunity Value →');
    lines.push(' Closed-Loop Intelligence. Edge preservation, value leakage and realized');
    lines.push(' value reconcile exactly on every record. AFIS and ABL run through one');
    lines.push(' engine with BACK/LAY semantics preserved. Replay is byte-identical;');
    lines.push(' the audit chain verifies from GENESIS and fails closed on tampering.');
    lines.push(' 35 hard invariants hold.');
    lines.push('');
    lines.push(' The closed loop recommended; it never mutated Treasury, Portfolio,');
    lines.push(' Risk, AEGIS, Execution, the Strategy Registry or any active policy.');
    lines.push('');
    lines.push(' SYSTEM STATUS: RECONCILED');
  } else {
    lines.push(` SPRINT 035 VALIDATION: ${sections.length - failed.length}/${sections.length} sections PASS`);
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
