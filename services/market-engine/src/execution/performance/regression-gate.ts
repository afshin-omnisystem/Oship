import {
  RegressionGateResult, ProtectedCheckResult, ProtectedCondition,
  PROTECTED_CONDITIONS, ParameterSet, ExecutionControlSession,
} from './types';
import {checkControlInvariants} from '../control/invariants';
import {verifyAuditStream} from '../control/replay';
import {ExecutionControlEngine} from '../control/engine';
import type {ControlConfigInput} from '../control/config';
import type {ExecutionPlan, ControlCycleSpec} from '../control/types';
import {regressionGateFingerprint} from './ids';
import {PROTECTED_PARAMETER_PATHS} from './parameter-space';

/**
 * Sprint 034 — the regression gate.
 *
 * A candidate that improves one metric while violating a protected condition
 * is REJECTED. Optimization may never trade safety for performance. Protected
 * conditions: quantity reconciliation, execution correctness, fail-closed
 * behavior, risk/AEGIS boundaries, emergency-stop preservation, budget
 * limits, deterministic replay, lineage + audit integrity and AFIS/ABL
 * semantics — reusing the Sprint 033 invariant suite plus explicit protected
 * probes (emergency stop, all-stale market, deterministic re-run).
 */

export interface RegressionGateInput {
  readonly candidateParameters: ParameterSet;
  readonly candidateSessions: readonly ExecutionControlSession[];
  readonly initialPlans: readonly {readonly plan: ExecutionPlan; readonly session: ExecutionControlSession}[];
  /** Probe inputs (identical for every candidate) run under the candidate config. */
  readonly probes: {
    readonly emergencyStop: {readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[]} | null;
    readonly staleMarket: {readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[]} | null;
    readonly replay: {readonly plan: ExecutionPlan; readonly cycles: readonly ControlCycleSpec[]} | null;
  };
  readonly candidateConfig: ControlConfigInput;
}

export function evaluateRegressionGate(input: RegressionGateInput): RegressionGateResult {
  const checks: ProtectedCheckResult[] = [];
  const add = (condition: ProtectedCondition, passed: boolean, detail: string) =>
    checks.push(Object.freeze({condition, passed, detail}));

  // ---- Sprint 033 invariant suite over every candidate simulation session
  const invariantFailures: string[] = [];
  for (const {plan, session} of input.initialPlans) {
    const report = checkControlInvariants({initialPlan: plan, session});
    if (!report.ok) invariantFailures.push(`${session.sessionId}: ${report.violations.join('; ')}`);
  }
  const quantityViolations = invariantFailures.filter((f) => f.includes('QUANTITY_PRESERVATION'));
  add('QUANTITY_RECONCILIATION', quantityViolations.length === 0,
    quantityViolations.length === 0
      ? 'quantity preserved at every revision boundary in every candidate session'
      : `quantity preservation violated: ${quantityViolations.join(' | ')}`);
  add('EXECUTION_CORRECTNESS',
    input.candidateSessions.every((s) => s.finalResult !== null) && invariantFailures.filter((f) => f.includes('DETERMINISTIC_TRANSITIONS')).length === 0,
    'every candidate session terminated explicitly with legal transitions');
  add('LINEAGE_INTEGRITY', invariantFailures.filter((f) => f.includes('LINEAGE') || f.includes('IMMUTABLE_PLANS')).length === 0,
    invariantFailures.filter((f) => f.includes('LINEAGE') || f.includes('IMMUTABLE_PLANS')).length === 0
      ? 'lineage chains intact, parents immutable'
      : 'lineage integrity violated');
  add('BUDGET_LIMITS', invariantFailures.filter((f) => f.includes('BUDGET')).length === 0,
    invariantFailures.filter((f) => f.includes('BUDGET')).length === 0
      ? 'action budget ceilings respected'
      : 'budget limits violated');
  add('RISK_BOUNDARY', invariantFailures.filter((f) => f.includes('RISK_VALIDATION') || f.includes('AUTHORITY')).length === 0,
    invariantFailures.filter((f) => f.includes('RISK_VALIDATION') || f.includes('AUTHORITY')).length === 0
      ? 'risk validation present, no authority bypass'
      : 'risk/authority boundary violated');
  add('AEGIS_BOUNDARY', invariantFailures.filter((f) => f.includes('AEGIS')).length === 0,
    invariantFailures.filter((f) => f.includes('AEGIS')).length === 0
      ? 'AEGIS validation present on every cycle'
      : 'AEGIS boundary violated');
  add('AFIS_SEMANTICS', afisSemanticsHold(input.candidateSessions), 'AFIS domain + semantic sides preserved');
  add('ABL_SEMANTICS', ablSemanticsHold(input.candidateSessions), 'ABL domain + BACK/LAY semantic sides preserved');

  // ---- audit integrity: every candidate session's audit chain verifies
  const auditOk = input.candidateSessions.every((s) => verifyAuditStream(s.auditEvents));
  add('AUDIT_INTEGRITY', auditOk, auditOk ? 'every candidate audit chain verifies' : 'a candidate audit chain failed verification');

  // ---- deterministic replay: re-run one input under the candidate config
  if (input.probes.replay) {
    // Reproduce the simulation ARM run exactly (same correlation/trace ids as
    // the candidate arm) — a differing id would change the session fingerprint
    // for reasons unrelated to determinism.
    const reRun = new ExecutionControlEngine(input.candidateConfig).run({
      plan: input.probes.replay.plan,
      cycles: input.probes.replay.cycles,
      startTime: 1_704_067_200_000,
      correlationId: 'performance-sim-candidate',
      traceId: 'performance-sim-candidate',
    });
    const original = input.candidateSessions[0];
    const same = original !== undefined && reRun.sessionFingerprint === original.sessionFingerprint;
    add('DETERMINISTIC_REPLAY', same, same
      ? 're-run reproduces the candidate session fingerprint byte-identically'
      : 'candidate session is not deterministic under re-run');
  } else {
    add('DETERMINISTIC_REPLAY', false, 'no replay probe provided — fail closed');
  }

  // ---- emergency stop preservation
  if (input.probes.emergencyStop) {
    const es = new ExecutionControlEngine(input.candidateConfig).run({
      plan: input.probes.emergencyStop.plan,
      cycles: input.probes.emergencyStop.cycles,
      startTime: 1_704_067_200_000,
      correlationId: 'performance-regression-es',
      traceId: 'performance-regression-es',
    });
    const ok = es.finalResult?.finalState === 'ABORTED' && es.finalResult?.abortReason === 'EMERGENCY_STOP';
    add('EMERGENCY_STOP_PRESERVATION', ok, ok
      ? 'emergency stop still dominates every candidate action'
      : `emergency stop failed under the candidate policy (${es.finalResult?.finalState}/${es.finalResult?.abortReason ?? 'none'})`);
  } else {
    add('EMERGENCY_STOP_PRESERVATION', false, 'no emergency-stop probe provided — fail closed');
  }

  // ---- protected parameters may never be touched
  const touched = input.candidateParameters.entries.filter((e) => PROTECTED_PARAMETER_PATHS.includes(e.path));
  const touchedDetail = touched.length > 0
    ? `candidate modifies protected safety path(s): ${touched.map((t) => t.path).join(', ')}`
    : null;

  // ---- fail-closed behavior: an all-stale market must never complete silently
  if (input.probes.staleMarket) {
    const stale = new ExecutionControlEngine(input.candidateConfig).run({
      plan: input.probes.staleMarket.plan,
      cycles: input.probes.staleMarket.cycles,
      startTime: 1_704_067_200_000,
      correlationId: 'performance-regression-stale',
      traceId: 'performance-regression-stale',
    });
    const ok = stale.finalResult?.finalState !== 'COMPLETED' && touchedDetail === null;
    add('FAIL_CLOSED_BEHAVIOR', ok, !ok
      ? (touchedDetail ?? 'all-stale market COMPLETED under the candidate policy — fail-closed behavior traded away')
      : `all-stale probe failed closed (${stale.finalResult?.finalState}/${stale.finalResult?.abortReason ?? 'exhausted'}) — never a silent completion`);
  } else {
    add('FAIL_CLOSED_BEHAVIOR', false, touchedDetail ?? 'no stale-market probe provided — fail closed');
  }

  const ordered = PROTECTED_CONDITIONS.map((c) => checks.find((x) => x.condition === c) ?? Object.freeze({condition: c, passed: false, detail: 'not evaluated — fail closed'}));
  const violations = ordered.filter((c) => !c.passed).map((c) => `${c.condition}: ${c.detail}`);
  const body = {checks: ordered, violations};
  return Object.freeze({
    passed: violations.length === 0,
    checks: ordered,
    violations,
    fingerprint: regressionGateFingerprint(body),
  });
}

function afisSemanticsHold(sessions: readonly ExecutionControlSession[]): boolean {
  return sessions.every((s) => {
    const root = s.lineage[0];
    if (!root || root.domain !== 'AFIS') return true; // not an AFIS session
    return root.routes.every((r) => r.side === 'BUY' || r.side === 'SELL')
      && s.cycles.every((c) => c.telemetry.domain === 'AFIS');
  });
}

function ablSemanticsHold(sessions: readonly ExecutionControlSession[]): boolean {
  return sessions.every((s) => {
    const root = s.lineage[0];
    if (!root || root.domain !== 'ABL') return true; // not an ABL session
    return root.routes.every((r) => r.side === 'BACK' || r.side === 'LAY')
      && s.cycles.every((c) => c.telemetry.domain === 'ABL');
  });
}
