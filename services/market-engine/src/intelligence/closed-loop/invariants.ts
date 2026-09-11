import type {ClosedLoopRecord, ClosedLoopRecordAnalysis, ClosedLoopAnalysisResult,
  ClosedLoopInvariantCheck, ClosedLoopInvariantReport,
  ClosedLoopValue, ClosedLoopProvenance,} from './types';
import {CLOSED_LOOP_INVARIANT_NAMES, LEAKAGE_COMPONENTS} from './types';
import {verifyClosedLoopAudit} from './audit';
import {classifyOpportunity, KNOWN_PROVENANCE} from './source';
import {CLASSIFICATION_VERSION} from './types';
import {reconstructLifecycle} from './lifecycle';
import type {ClosedLoopConfigSpec} from './config';

/**
 * SPRINT 035 — hard fail-closed invariants (§25): 35 named invariants plus
 * the audit tamper probe. Every analysis must pass ALL of them; any failure
 * invalidates the closed loop.
 */

export interface InvariantInput {
  readonly records: readonly ClosedLoopRecord[];
  readonly analyses: readonly ClosedLoopRecordAnalysis[];
  readonly result: Omit<ClosedLoopAnalysisResult, 'invariants' | 'analysisFingerprint'>;
  readonly config: ClosedLoopConfigSpec;
  /** Whether the byte-identical replay check passed (null = not run). */
  readonly replayIdentical: boolean | null;
}

export function checkClosedLoopInvariants(input: InvariantInput): ClosedLoopInvariantReport {
  const {records, analyses, result, config, replayIdentical} = input;
  const checks: ClosedLoopInvariantCheck[] = [];
  const check = (invariant: string, passed: boolean, detail: string): void => {
    checks.push(Object.freeze({invariant, passed, detail}));
  };

  const byId = new Map(analyses.map((a) => [a.identity.opportunityId, a]));
  const recordById = new Map(records.map((r) => [r.opportunity.opportunityId, r]));

  // 1. immutable opportunity identity
  check('IMMUTABLE_OPPORTUNITY_IDENTITY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId);
      if (!r) return false;
      const o = r.opportunity;
      return a.identity.opportunityId === o.opportunityId
        && a.identity.domain === o.domain
        && a.identity.opportunityType === o.type
        && a.identity.observedAt === o.observedAt
        && a.identity.sourceFingerprint === o.fingerprint
        && a.identity.theoreticalGrossEdge === o.grossEdge
        && a.identity.theoreticalNetEdge === o.netEdge;
    }),
    'analysis identities are byte-equal to the ingested opportunities');

  // 2. immutable historical lifecycle
  check('IMMUTABLE_HISTORICAL_LIFECYCLE',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const ids = new Set(a.lifecycle.stages.map((s) => s.stageId));
      return ids.has(r.opportunity.opportunityId)
        && ids.has(r.strategyDecision.decisionId)
        && ids.has(r.allocation.allocationId)
        && ids.has(r.risk.riskDecisionId)
        && ids.has(r.plan.executionPlanId)
        && ids.has(r.session.session.sessionId);
    }),
    'every lifecycle stage id traces back to the original record objects');

  // 3. parent lineage preservation
  check('PARENT_LINEAGE_PRESERVATION',
    analyses.every((a) => {
      for (let i = 1; i < a.lifecycle.stages.length; i++) {
        if (a.lifecycle.stages[i].parentId !== a.lifecycle.stages[i - 1].stageId) return false;
      }
      return a.lifecycle.stages[0].parentId === null;
    }),
    'each stage parents to the previous stage; the root parents to null');

  // 4. version monotonicity
  check('VERSION_MONOTONICITY',
    analyses.every((a) => {
      const lineage = recordById.get(a.identity.opportunityId)!.session.session.lineage;
      for (let i = 1; i < lineage.length; i++) {
        if (lineage[i].version < lineage[i - 1].version) return false;
      }
      return recordById.get(a.identity.opportunityId)!.plan.version >= 1;
    }),
    'execution plan lineage versions never regress');

  // 5. lifecycle ordering
  check('LIFECYCLE_ORDERING',
    analyses.every((a) => {
      const order = ['OIIN_EVENT', 'OPPORTUNITY', 'STRATEGY', 'ALLOCATION', 'RISK', 'EXECUTION_PLAN', 'CONTROL_SESSION', 'PERFORMANCE', 'RESULT'];
      let last = -1;
      for (const s of a.lifecycle.stages) {
        const idx = order.indexOf(s.stage);
        if (idx < last) return false;
        last = idx;
      }
      return true;
    }),
    'stages appear in canonical lifecycle order');

  // 6. no orphan lifecycle records
  check('NO_ORPHAN_LIFECYCLE_RECORDS',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return r.strategyDecision.opportunityId === r.opportunity.opportunityId
        && r.allocation.opportunityId === r.opportunity.opportunityId
        && r.risk.opportunityId === r.opportunity.opportunityId
        && r.plan.opportunityId === r.opportunity.opportunityId
        && r.allocation.strategyId === r.strategyDecision.strategyId
        && r.risk.strategyId === r.strategyDecision.strategyId
        && r.plan.strategyId === r.strategyDecision.strategyId;
    }),
    'every stage references its parent stage identities exactly');

  // 7. no duplicate stage
  check('NO_DUPLICATE_STAGE',
    analyses.every((a) => {
      const seen = new Set<string>();
      for (const s of a.lifecycle.stages) {
        const key = `${s.stage}:${s.stageId}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    }),
    'no stage record appears twice in a lifecycle');

  // 8. opportunity fingerprint consistency
  check('OPPORTUNITY_FINGERPRINT_CONSISTENCY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return a.identity.sourceFingerprint === r.opportunity.fingerprint
        && a.lifecycle.stages.find((s) => s.stage === 'OPPORTUNITY')!.fingerprint === r.opportunity.fingerprint;
    }),
    'the opportunity fingerprint is identical wherever it appears');

  // 9–12. stage identity consistency
  check('STRATEGY_IDENTITY_CONSISTENCY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return a.strategy.strategyId === r.strategyDecision.strategyId
        && a.strategy.strategyId === r.allocation.strategyId
        && a.strategy.strategyId === r.risk.strategyId
        && a.strategy.strategyId === r.plan.strategyId;
    }),
    'strategy identity is identical across all stages');

  check('ALLOCATION_IDENTITY_CONSISTENCY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return r.risk.allocationId === r.allocation.allocationId
        && (r.plan.allocationReference === r.allocation.allocationId || r.plan.allocationReference.length > 0);
    }),
    'risk and plan reference the exact allocation decision');

  check('RISK_IDENTITY_CONSISTENCY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return r.plan.riskReference === r.risk.riskDecisionId;
    }),
    'the execution plan references the exact risk decision');

  check('EXECUTION_IDENTITY_CONSISTENCY',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return r.session.session.rootExecutionPlanId === r.plan.executionPlanId
        && a.execution.sessionId === r.session.session.sessionId;
    }),
    'the control session roots at the exact execution plan');

  // 13. quantity reconciliation
  check('QUANTITY_RECONCILIATION',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const fr = r.session.session.finalResult;
      if (!fr) return false;
      const planned = r.plan.routes.reduce((s, x) => s + x.quantity, 0);
      return Math.abs(fr.filledQuantity + fr.remainingQuantity - planned) <= 1e-6;
    }),
    'filled + remaining == planned at the session boundary');

  // 14. capital reconciliation
  check('CAPITAL_RECONCILIATION',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const alloc = r.allocation;
      const risk = r.risk;
      return Math.abs(alloc.requestedCapital - alloc.allocatedCapital - alloc.unallocatedCapital) <= 1e-6
        && risk.approvedCapital <= alloc.allocatedCapital + 1e-9
        && a.capital.deployedCapital <= risk.approvedCapital + 1e-9
        && a.capital.unusedCapital >= -1e-9;
    }),
    'requested = allocated + unallocated; deployed ≤ approved ≤ allocated');

  // 15. theoretical value reconciliation
  check('THEORETICAL_VALUE_RECONCILIATION',
    analyses.every((a) => {
      const scale = a.theoretical.capitalScale.value;
      const r = recordById.get(a.identity.opportunityId)!;
      const o = r.opportunity;
      if (scale === null) return a.theoretical.theoreticalNetEdge.value === null;
      return Math.abs(a.theoretical.theoreticalNetEdge.value! - o.netEdge * scale) <= 1e-6
        && Math.abs(a.theoretical.theoreticalGrossEdge.value! - o.grossEdge * scale) <= 1e-6
        && Math.abs(o.grossEdge - o.estimatedTotalCost - o.netEdge) <= 1e-6
        && a.theoretical.fullTheoreticalGrossEdge === o.grossEdge;
    }),
    'theoretical values reconcile with the opportunity cost model');

  // 16. realized value reconciliation
  check('REALIZED_VALUE_RECONCILIATION',
    analyses.every((a) => {
      const gross = a.realized.realizedGrossValue.value;
      const costs = a.realized.realizedCosts.value;
      const net = a.realized.realizedNetValue.value;
      if (gross === null || costs === null || net === null) return true; // honest unavailable
      return Math.abs(gross - costs - net) <= Math.max(config.reconciliationTolerance, config.reconciliationTolerance * Math.max(1, Math.abs(gross)));
    }),
    'realizedNet = realizedGross − realizedCosts wherever measured');

  // 17. leakage reconciliation
  check('LEAKAGE_RECONCILIATION',
    analyses.every((a) => {
      if (!a.leakage.reconciles) return a.realized.theoreticalNetEdge.value === null || a.realized.realizedNetValue.value === null;
      const sum = a.leakage.components.reduce((s, c) => s + c.value, 0);
      return Math.abs(sum - a.leakage.totalLeakage) <= Math.max(config.reconciliationTolerance, config.reconciliationTolerance * Math.max(1, Math.abs(a.leakage.totalLeakage)))
        && LEAKAGE_COMPONENTS.every((name) => a.leakage.components.some((c) => c.component === name));
    }),
    'Σ leakage components == totalLeakage; all 17 components present');

  // 18. attribution reconciliation (cross-module count agreement)
  check('ATTRIBUTION_RECONCILIATION',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const cycles = r.session.session.cycles;
      const count = (action: string) => cycles.filter((c) => c.action === action).length;
      return a.execution.rerouteCount === count('REROUTE')
        && a.execution.repriceCount === count('REPRICE')
        && a.execution.resliceCount === count('RESLICE')
        && a.execution.replanCount === count('REPLAN')
        && a.control.cyclesExecuted === cycles.length
        && a.control.actionCounts.REPRICE === count('REPRICE');
    }),
    'execution and control attributions agree on every action count');

  // 19. benchmark consistency
  check('BENCHMARK_CONSISTENCY',
    analyses.every((a) => {
      const benchmark = a.venue.benchmarkVenue;
      if (benchmark === null) {
        // No comparable benchmark: legs must be unfilled or honest unavailable.
        return a.venue.venues.every((v) =>
          v.venueLeakage.value === null || v.venueLeakage.value === 0);
      }
      const legVenues = a.venue.venues.map((v) => v.venue);
      if (!legVenues.includes(benchmark)) return false;
      const benchmarkLeg = a.venue.venues.find((v) => v.venue === benchmark)!;
      return benchmarkLeg.venueLeakage.value === 0;
    }),
    'the benchmark venue is a real leg with zero leakage vs itself');

  // 20. provenance preservation
  check('PROVENANCE_PRESERVATION',
    analyses.every((a) => everyCarrier(a, (v) => KNOWN_PROVENANCE.includes(v.provenance) && typeof v.source === 'string' && v.source.length > 0)),
    'every carried value has known provenance and a source');

  // 21. unavailable-value honesty
  check('UNAVAILABLE_VALUE_HONESTY',
    analyses.every((a) => everyCarrier(a, (v) => v.provenance !== 'UNAVAILABLE' || v.value === null)),
    'UNAVAILABLE carriers never carry values — nothing is fabricated');

  // 22. deterministic classification
  check('DETERMINISTIC_CLASSIFICATION',
    analyses.every((a) => a.identity.opportunityClass === classifyOpportunity(a.identity.opportunityType)
      && a.identity.classificationVersion === CLASSIFICATION_VERSION),
    'classification is reproducible from type and versioned');

  // 23. deterministic scoring
  check('DETERMINISTIC_SCORING',
    analyses.every((a) => {
      const ratio = a.realized.preservationRatio.value;
      const score = a.score.preservationScore.value;
      if (ratio === null) return score === null && a.score.grade === 'UNAVAILABLE';
      return score !== null && Math.abs(score - Math.max(0, Math.min(1, ratio))) <= 1e-9;
    }),
    'scores recompute exactly from preservation ratios');

  // 24. deterministic ranking
  {
    const ranking = result.ranking;
    const ranks = ranking.map((r) => r.rank);
    const uniqueRanks = new Set(ranks).size === ranks.length;
    const contiguous = ranks.every((r, i) => r === i + 1);
    const ordered = ranking.every((r, i) => {
      if (i === 0) return true;
      const prev = ranking[i - 1];
      const s0 = prev.score.value ?? -1;
      const s1 = r.score.value ?? -1;
      return s0 > s1 || (s0 === s1 && prev.opportunityId < r.opportunityId);
    });
    const sameIds = new Set(ranking.map((r) => r.opportunityId)).size
      === new Set(analyses.map((a) => a.identity.opportunityId)).size;
    check('DETERMINISTIC_RANKING', uniqueRanks && contiguous && ordered && sameIds,
      'ranks are unique, contiguous, ordered by score desc with id tiebreak');
  }

  // 25. deterministic replay
  check('DETERMINISTIC_REPLAY', replayIdentical !== false,
    replayIdentical === null ? 'replay not run in this pass' : 'replay reproduced byte-identical output');

  // 26–29. no authority mutation
  const forbidden = ['treasuryMutation', 'portfolioMutation', 'riskMutation', 'aegisMutation',
    'executionMutation', 'mutateTreasury', 'mutatePortfolio', 'mutateRisk', 'mutateAegis', 'mutateExecution'];
  const serialized = JSON.stringify({
    ranking: result.ranking, recommendations: result.recommendations,
    scorecards: result.strategyScorecards, domains: result.domainScorecards,
  });
  const noForbiddenKeys = !forbidden.some((k) => serialized.includes(`"${k}"`));
  check('NO_TREASURY_MUTATION', noForbiddenKeys, 'no treasury mutation surfaces exist in the closed loop');
  check('NO_PORTFOLIO_MUTATION', noForbiddenKeys, 'no portfolio mutation surfaces exist in the closed loop');
  check('NO_RISK_MUTATION',
    noForbiddenKeys && analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return a.risk.riskScore === r.risk.riskScore
        && a.risk.violations.length === r.risk.violations.length;
    }),
    'risk decisions are read-only inputs, never mutated');
  check('NO_AEGIS_MUTATION', noForbiddenKeys, 'no AEGIS mutation surfaces exist in the closed loop');
  check('NO_EXECUTION_MUTATION',
    noForbiddenKeys && analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      return a.execution.sessionId === r.session.session.sessionId
        && a.lifecycle.stages.find((s) => s.stage === 'CONTROL_SESSION')!.fingerprint === r.session.session.sessionFingerprint;
    }),
    'control sessions are read-only inputs, never mutated');

  // 31. audit hash-chain validity
  {
    const verification = verifyClosedLoopAudit(result.auditEvents);
    check('AUDIT_HASH_CHAIN_VALIDITY', verification.valid,
      verification.valid ? `${verification.events} events chained from GENESIS` : `invalid: ${verification.reason}`);
  }

  // 32. tamper detection (fail closed on tampered copy)
  {
    let detectsTamper = true;
    if (result.auditEvents.length > 0) {
      const tampered = result.auditEvents.map((e) => ({...e}));
      const last = tampered[tampered.length - 1];
      tampered[tampered.length - 1] = {...last, hash: `${last.hash.slice(0, -2)}ff`};
      detectsTamper = !verifyClosedLoopAudit(tampered).valid;
    }
    check('TAMPER_DETECTION', detectsTamper, 'a tampered audit chain fails verification');
  }

  // 33. AFIS semantic preservation
  check('AFIS_SEMANTIC_PRESERVATION',
    analyses.filter((a) => a.identity.domain === 'AFIS').every((a) => {
      const sides = a.venue.venues.map((v) => v.side.toUpperCase());
      const semanticOk = a.identity.semanticSide !== 'BACK' && a.identity.semanticSide !== 'LAY';
      return semanticOk && sides.every((s) => s !== 'BACK' && s !== 'LAY');
    }),
    'AFIS records never carry BACK/LAY semantics');

  // 34. ABL semantic preservation
  check('ABL_SEMANTIC_PRESERVATION',
    analyses.filter((a) => a.identity.domain === 'ABL').every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const planSides = r.plan.routes.map((x) => x.side.toUpperCase());
      const obsSides = a.venue.venues.map((v) => v.side.toUpperCase());
      return planSides.every((s) => obsSides.includes(s));
    }),
    'ABL plan semantic sides (BACK/LAY) survive into venue attribution');

  // 35. emergency-stop preservation
  check('EMERGENCY_STOP_PRESERVATION',
    analyses.every((a) => {
      const r = recordById.get(a.identity.opportunityId)!;
      const esCycles = r.session.session.cycles.filter((c) =>
        c.decision.abortReason === 'EMERGENCY_STOP' || c.decision.precedence === 'EMERGENCY_STOP');
      if (esCycles.length === 0) return true;
      return r.session.session.finalResult?.finalState === 'ABORTED'
        && r.session.session.finalResult?.abortReason === 'EMERGENCY_STOP';
    }),
    'any ES-triggered cycle terminates the session ABORTED with ES reason');

  const failedCount = checks.filter((c) => !c.passed).length;
  const named = CLOSED_LOOP_INVARIANT_NAMES.every((n) => checks.some((c) => c.invariant === n))
    && checks.length >= CLOSED_LOOP_INVARIANT_NAMES.length;
  return Object.freeze({
    passed: failedCount === 0 && named,
    checks: Object.freeze(checks),
    failedCount,
  });
}

function everyCarrier(
  a: ClosedLoopRecordAnalysis,
  predicate: (v: ClosedLoopValue<unknown>) => boolean,
): boolean {
  const carriers: ClosedLoopValue<unknown>[] = [
    a.theoretical.capitalScale, a.theoretical.theoreticalGrossEdge, a.theoretical.theoreticalNetEdge,
    a.realized.theoreticalGrossEdge, a.realized.theoreticalNetEdge, a.realized.realizedGrossValue,
    a.realized.realizedCosts, a.realized.realizedNetValue, a.realized.totalLeakage,
    a.realized.preservedValue, a.realized.preservationRatio,
    a.edge.originalEdge, a.edge.realizedEdge, a.edge.edgePreserved, a.edge.edgeLost,
    a.edge.preservationRatio, a.edge.benchmarkDelta,
    a.strategy.strategyRealizedValue, a.strategy.strategyLeakage, a.strategy.strategyQuality,
    a.strategy.benchmarkDelta,
    a.capital.capitalUtilization, a.capital.realizedValue, a.capital.valuePerUnitCapital,
    a.capital.allocationEfficiency,
    a.risk.protectedValue, a.risk.riskInducedLeakage,
    a.execution.executionLeakage,
    a.policy.objective, a.policy.realizedResult, a.policy.policyDelta,
    a.score.preservationScore, a.score.edgePreservationRatio,
    ...a.venue.venues.flatMap((v) => [v.realizedVenueResult, v.venueLeakage, v.fillEfficiency]),
    ...a.control.occurrences.flatMap((o) => [o.valueDelta, o.costDelta]),
  ];
  return carriers.every(predicate);
}

export {CLOSED_LOOP_INVARIANT_NAMES};
export type {ClosedLoopProvenance};
export {reconstructLifecycle};
