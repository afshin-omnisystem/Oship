import type {
  ClosedLoopRecord, LifecycleStage, LifecycleReconstruction, LifecycleAnomaly,
  LifecycleAnomalyKind, LifecycleStageKind,
} from './types';
import {LIFECYCLE_STAGE_ORDER} from './types';
import {lifecycleFingerprint} from './ids';
import {parseTimestamp} from './source';

/**
 * SPRINT 035 — lifecycle reconstruction (§7).
 *
 * Reconstructs OIIN event → Opportunity → Strategy → Allocation → Risk →
 * Execution Plan → Control Session → Performance → Result with parent
 * identifiers, timestamps, versions, fingerprints, sources and states.
 *
 * Structural contradictions fail closed (throw) — the closed loop never
 * analyzes a broken history. Missing OIIN provenance degrades gracefully
 * (recorded as an anomaly) because OIIN events are provenance, not identity.
 */

export class LifecycleReconstructionError extends Error {
  constructor(message: string) {
    super(`closed-loop lifecycle refused: ${message} — fail closed`);
    this.name = 'LifecycleReconstructionError';
  }
}

export function reconstructLifecycle(record: ClosedLoopRecord): LifecycleReconstruction {
  const o = record.opportunity;
  const anomalies: LifecycleAnomaly[] = [];
  const push = (kind: LifecycleAnomalyKind, stage: LifecycleStageKind | null, detail: string): void => {
    anomalies.push(Object.freeze({kind, stage, detail}));
  };

  if (!record.session || !record.session.session) {
    throw new LifecycleReconstructionError(`${o.opportunityId}: missing execution lineage (control session)`);
  }
  if (record.session.session.rootExecutionPlanId !== record.plan.executionPlanId) {
    throw new LifecycleReconstructionError(
      `${o.opportunityId}: execution lineage break — session root plan ${record.session.session.rootExecutionPlanId} ≠ plan ${record.plan.executionPlanId}`);
  }

  const strategyTs = parseTimestamp(record.strategyDecision.timestamp, `${o.opportunityId}.strategy.timestamp`);
  const allocationTs = record.allocation.timestamp;
  const riskTs = record.risk.timestamp;
  const planTs = record.plan.timestamp;
  const sessionStart = record.session.session.cycles.length > 0
    ? record.session.session.cycles[0].startedAt
    : planTs;

  const stages: LifecycleStage[] = [];
  if (record.oiinEvent) {
    stages.push(stage('OIIN_EVENT', record.oiinEvent.id, null, record.oiinEvent.timestamp, null,
      `oiin:${record.oiinEvent.eventType}`, record.oiinEvent.schemaVersion, record.oiinEvent.correlationId));
  } else {
    push('MISSING_STAGE', 'OIIN_EVENT', 'no OIIN event attached — provenance degraded, not fatal');
  }

  stages.push(stage('OPPORTUNITY', o.opportunityId, record.oiinEvent ? record.oiinEvent.id : null,
    o.observedAt, null, 'discovery', o.status, o.fingerprint));
  stages.push(stage('STRATEGY', record.strategyDecision.decisionId, o.opportunityId,
    strategyTs, null, `strategy:${record.strategyDecision.strategyId}`, record.strategyDecision.action, record.strategyDecision.correlationId));
  stages.push(stage('ALLOCATION', record.allocation.allocationId, record.strategyDecision.decisionId,
    allocationTs, null, `allocation:${record.allocation.policyVersion}`, record.allocation.status, record.allocation.fingerprint));
  stages.push(stage('RISK', record.risk.riskDecisionId, record.allocation.allocationId,
    riskTs, null, `risk:${record.risk.riskPolicyVersion}`, record.risk.state, record.risk.fingerprint));
  stages.push(stage('EXECUTION_PLAN', record.plan.executionPlanId, record.risk.riskDecisionId,
    planTs, record.plan.version, `planning:${record.plan.policyVersion}`, record.plan.status, record.plan.fingerprint));
  stages.push(stage('CONTROL_SESSION', record.session.session.sessionId, record.plan.executionPlanId,
    sessionStart, null, `control:${record.session.policyId}@${record.session.policyVersion}`,
    record.session.session.finalResult ? record.session.session.finalResult.finalState : record.session.session.currentState,
    record.session.session.sessionFingerprint));
  stages.push(stage('PERFORMANCE', performanceStageId(record), record.session.session.sessionId,
    record.session.session.cycles.length > 0
      ? record.session.session.cycles[record.session.session.cycles.length - 1].completedAt ?? sessionStart
      : sessionStart,
    null, 'performance', record.performance ? 'ANALYZED' : 'NOT_ANALYZED',
    record.performance ? record.performance.analysisFingerprint : 'unavailable'));
  stages.push(stage('RESULT', `${o.opportunityId}:result`, performanceStageId(record),
    resultTimestamp(record), null, 'closed-loop',
    record.session.session.finalResult ? record.session.session.finalResult.finalState : 'UNKNOWN',
    record.session.session.sessionFingerprint));

  // ---- identity chain (orphans) -------------------------------------------
  if (record.strategyDecision.opportunityId !== o.opportunityId) {
    throw new LifecycleReconstructionError(
      `strategy decision ${record.strategyDecision.decisionId} references opportunity ${record.strategyDecision.opportunityId} ≠ ${o.opportunityId}`);
  }
  if (record.allocation.opportunityId !== o.opportunityId) {
    throw new LifecycleReconstructionError(
      `allocation ${record.allocation.allocationId} references opportunity ${record.allocation.opportunityId} ≠ ${o.opportunityId}`);
  }
  if (record.risk.opportunityId !== o.opportunityId) {
    throw new LifecycleReconstructionError(
      `risk decision ${record.risk.riskDecisionId} references opportunity ${record.risk.opportunityId} ≠ ${o.opportunityId}`);
  }
  if (record.plan.opportunityId !== o.opportunityId) {
    throw new LifecycleReconstructionError(
      `execution plan ${record.plan.executionPlanId} references opportunity ${record.plan.opportunityId} ≠ ${o.opportunityId}`);
  }
  if (record.allocation.strategyId !== record.strategyDecision.strategyId) {
    throw new LifecycleReconstructionError(
      `allocation ${record.allocation.allocationId} strategy ${record.allocation.strategyId} ≠ strategy decision ${record.strategyDecision.strategyId}`);
  }
  if (record.risk.strategyId !== record.strategyDecision.strategyId) {
    throw new LifecycleReconstructionError(
      `risk decision ${record.risk.riskDecisionId} strategy ${record.risk.strategyId} ≠ strategy decision ${record.strategyDecision.strategyId}`);
  }
  if (record.plan.strategyId !== record.strategyDecision.strategyId) {
    throw new LifecycleReconstructionError(
      `execution plan ${record.plan.executionPlanId} strategy ${record.plan.strategyId} ≠ strategy decision ${record.strategyDecision.strategyId}`);
  }
  if (record.risk.allocationId !== record.allocation.allocationId) {
    throw new LifecycleReconstructionError(
      `risk decision ${record.risk.riskDecisionId} references allocation ${record.risk.allocationId} ≠ ${record.allocation.allocationId}`);
  }
  if (record.plan.riskReference !== record.risk.riskDecisionId) {
    throw new LifecycleReconstructionError(
      `execution plan ${record.plan.executionPlanId} riskReference ${record.plan.riskReference} ≠ risk decision ${record.risk.riskDecisionId}`);
  }
  if (record.plan.allocationReference !== record.allocation.allocationId) {
    throw new LifecycleReconstructionError(
      `execution plan ${record.plan.executionPlanId} allocationReference ${record.plan.allocationReference} ≠ allocation ${record.allocation.allocationId}`);
  }
  const finalResult = record.session.session.finalResult;
  if (finalResult) {
    const plannedQuantity = record.plan.routes.reduce((sum, r) => sum + r.quantity, 0);
    if (Math.abs(finalResult.filledQuantity + finalResult.remainingQuantity - plannedQuantity) > 1e-6) {
      throw new LifecycleReconstructionError(
        `${o.opportunityId}: invalid quantity reconciliation — filled ${finalResult.filledQuantity} + remaining ${finalResult.remainingQuantity} ≠ planned ${plannedQuantity}`);
    }
  }

  // ---- duplicates ----------------------------------------------------------
  const seen = new Set<string>();
  for (const s of stages) {
    const key = `${s.stage}:${s.stageId}`;
    if (seen.has(key)) {
      push('DUPLICATE_STAGE', s.stage, `duplicate stage record ${key}`);
    }
    seen.add(key);
  }

  // ---- ordering ------------------------------------------------------------
  const ordered = LIFECYCLE_STAGE_ORDER;
  let lastOrderedIdx = -1;
  for (const s of stages) {
    const idx = ordered.indexOf(s.stage);
    if (idx < lastOrderedIdx) {
      push('IMPOSSIBLE_ORDERING', s.stage, `stage ${s.stage} appears after a later lifecycle stage`);
    }
    lastOrderedIdx = Math.max(lastOrderedIdx, idx);
  }
  // Timestamps must be non-decreasing along the chain (OIIN may be absent).
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].timestamp < stages[i - 1].timestamp) {
      throw new LifecycleReconstructionError(
        `${o.opportunityId}: impossible ordering — ${stages[i].stage} at ${stages[i].timestamp} precedes ${stages[i - 1].stage} at ${stages[i - 1].timestamp}`);
    }
  }

  // ---- version regression --------------------------------------------------
  const lineagePlans = record.session.session.lineage;
  for (let i = 1; i < lineagePlans.length; i++) {
    if (lineagePlans[i].version < lineagePlans[i - 1].version) {
      push('VERSION_REGRESSION', 'CONTROL_SESSION',
        `plan lineage version regressed: v${lineagePlans[i].version} after v${lineagePlans[i - 1].version}`);
    }
  }
  if (record.plan.version < 1) {
    push('VERSION_REGRESSION', 'EXECUTION_PLAN', `plan version ${record.plan.version} < 1`);
  }

  // ---- fingerprint conflicts ----------------------------------------------
  if (record.plan.fingerprint !== record.session.session.lineage[0]?.fingerprint) {
    push('CONFLICTING_FINGERPRINT', 'EXECUTION_PLAN',
      'root plan fingerprint differs from session lineage root fingerprint');
  }

  const valid = anomalies.every((a) => a.kind === 'MISSING_STAGE' && a.stage === 'OIIN_EVENT');
  const spanMs = stages.length > 0 ? stages[stages.length - 1].timestamp - stages[0].timestamp : 0;

  return Object.freeze({
    opportunityId: o.opportunityId,
    stages: Object.freeze(stages),
    anomalies: Object.freeze(anomalies),
    valid,
    spanMs,
    fingerprint: lifecycleFingerprint(stages.map((s) => [s.stage, s.stageId, s.parentId, s.timestamp, s.version, s.fingerprint, s.state])),
  });
}

function stage(
  kind: LifecycleStageKind, stageId: string, parentId: string | null, timestamp: number,
  version: number | null, source: string, state: string, fingerprint: string,
): LifecycleStage {
  return Object.freeze({stage: kind, stageId, parentId, timestamp, version, source, state, fingerprint});
}

function performanceStageId(record: ClosedLoopRecord): string {
  return record.performance
    ? record.performance.analysisId
    : `unanalyzed:${record.session.session.sessionId}`;
}

function resultTimestamp(record: ClosedLoopRecord): number {
  const cycles = record.session.session.cycles;
  if (cycles.length === 0) return record.plan.timestamp;
  const last = cycles[cycles.length - 1];
  return last.completedAt ?? last.startedAt;
}
