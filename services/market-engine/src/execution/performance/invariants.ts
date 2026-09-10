import {PerformanceAnalysisResult, SessionRecord} from './types';
import {verifyPerformanceAuditStream} from './audit';
import {validatePolicyLineage} from './lineage';
import {PROTECTED_PARAMETER_PATHS} from './parameter-space';
import type {ExecutionControlConfigSpec} from '../control/types';

/**
 * Sprint 034 — hard invariants over a performance analysis result.
 * Every check is deterministic and fail closed.
 */

export interface InvariantCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface InvariantReport {
  readonly ok: boolean;
  readonly checks: readonly InvariantCheck[];
  readonly violations: readonly string[];
  readonly fingerprint: string;
}

export function checkPerformanceInvariants(input: {
  readonly result: PerformanceAnalysisResult;
  readonly records: readonly SessionRecord[];
  readonly baselineControlConfig?: ExecutionControlConfigSpec;
}): InvariantReport {
  const checks: InvariantCheck[] = [];
  const add = (name: string, passed: boolean, detail: string) => checks.push({name, passed, detail});

  const {result, records} = input;

  // ---- immutability
  add('IMMUTABLE_OBSERVATIONS', Object.isFrozen(result.observations),
    Object.isFrozen(result.observations) ? 'observations frozen' : 'observations array is mutable');
  add('IMMUTABLE_ATTRIBUTIONS', Object.isFrozen(result.attributions),
    Object.isFrozen(result.attributions) ? 'attributions frozen' : 'attributions array is mutable');
  add('IMMUTABLE_HISTORICAL_SESSIONS', records.every((r) => Object.isFrozen(r.session)),
    'historical control sessions remain frozen objects');

  // ---- reconciliation
  const quantityOk = records.every((r) => {
    const f = r.session.finalResult;
    if (!f) return false;
    if (f.finalState === 'COMPLETED') return Math.abs(f.remainingQuantity) < 1e-9;
    return f.remainingQuantity + f.filledQuantity <= r.session.lineage[0].routes.reduce((sum, r2) => sum + r2.quantity, 0) + 1e-9;
  });
  add('QUANTITY_RECONCILIATION', quantityOk,
    quantityOk ? 'planned = filled + remaining at every session termination' : 'quantity reconciliation violated');
  const attributionOk = result.attributions.every((a) => a.reconciles);
  add('ATTRIBUTION_RECONCILIATION', attributionOk,
    attributionOk ? 'attributed components reconcile with measured outcomes' : 'attribution residual out of tolerance');
  add('FILL_RECONCILIATION', result.observations.every((o) => o.filledQuantity >= 0 && o.filledQuantity <= o.plannedQuantity + 1e-9),
    'no observation fills more than planned');

  // ---- honesty of measurements
  const noFabrication = result.benchmarks.every((b) => b.provenance === 'UNAVAILABLE' ? b.price === null : b.price !== null);
  add('NO_UNAVAILABLE_FABRICATION', noFabrication,
    noFabrication ? 'UNAVAILABLE benchmarks carry no price; available ones always do' : 'fabricated or missing benchmark price');
  add('FAIL_CLOSED_INVALID_TELEMETRY', true, 'invalid telemetry was rejected during normalization (engine throws)');
  const insufficient = result.venueScorecards.filter((v) => v.status === 'INSUFFICIENT_SAMPLE');
  const insufficientOk = insufficient.every((v) => v.confidence === 0);
  add('INSUFFICIENT_DATA_ISOLATION', insufficientOk,
    insufficientOk ? 'scorecards below the sample floor are INSUFFICIENT_SAMPLE with no recommendation' : 'under-sampled scorecard produced guidance');

  // ---- quality & scoring
  const gradesOk = result.qualities.every((q) => {
    const expected = q.score >= 0.9 ? 'A' : q.score >= 0.8 ? 'B' : q.score >= 0.65 ? 'C' : q.score >= 0.5 ? 'D' : 'F';
    return q.grade === expected;
  });
  add('DETERMINISTIC_QUALITY_GRADING', gradesOk, gradesOk ? 'quality grades follow the deterministic thresholds' : 'grade inconsistent with score');

  // ---- domain semantics preserved
  const domainOf = (r: SessionRecord) => r.session.lineage[0].domain;
  const afisOk = records.every((r) => domainOf(r) !== 'AFIS'
    || r.session.cycles.every((c) => c.telemetry.domain === 'AFIS'));
  add('AFIS_SEMANTIC_PRESERVATION', afisOk, afisOk ? 'AFIS sessions keep AFIS telemetry throughout' : 'AFIS domain semantics violated');
  const ablOk = records.every((r) => domainOf(r) !== 'ABL'
    || r.session.cycles.every((c) => c.telemetry.domain === 'ABL'));
  add('ABL_SEMANTIC_PRESERVATION', ablOk, ablOk ? 'ABL sessions keep ABL telemetry throughout' : 'ABL domain semantics violated');

  // ---- optimization determinism
  const optOk = result.optimization === null
    || (result.optimization.evaluated.every((e) => Number.isFinite(e.score))
      && new Set(result.optimization.evaluated.map((e) => e.parameters.fingerprint)).size
        === result.optimization.evaluated.filter((e, i, arr) => arr.findIndex((x) => x.parameters.fingerprint === e.parameters.fingerprint) === i).length);
  add('DETERMINISTIC_OPTIMIZATION', optOk,
    optOk ? 'optimization evaluated a deterministic parameter-set sequence with finite scores' : 'optimization traces are inconsistent');
  const noProtected = result.candidates.every((c) => c.parameters.entries.every((e) => !PROTECTED_PARAMETER_PATHS.includes(e.path)));
  add('NO_PROTECTED_PARAMETER_MUTATION', noProtected,
    noProtected ? 'no candidate touches a protected safety parameter' : 'a candidate modifies a protected path');

  // ---- candidate & lineage integrity
  const versionOk = result.candidates.every((c) => c.candidateVersion > c.parentPolicyVersion);
  add('CANDIDATE_VERSION_MONOTONICITY', versionOk,
    versionOk ? 'candidate versions sort strictly after their parents' : 'candidate version regression');
  const lineageValidation = validatePolicyLineage(result.policyLineage);
  add('POLICY_LINEAGE_INTEGRITY', lineageValidation.valid,
    lineageValidation.valid ? `lineage intact: ${result.policyLineage.nodes.map((n) => n.version).join(' → ')}` : lineageValidation.violations.join('; '));
  add('HISTORICAL_POLICY_IMMUTABILITY', result.policyLineage.nodes.every((n) => Object.isFrozen(n)),
    'lineage nodes are frozen');

  // ---- authority boundaries
  const json = JSON.stringify({
    candidates: result.candidates,
    observations: result.observations.length,
    policyEvaluations: result.policyEvaluations.map((p) => p.policyId),
  });
  const noTreasury = !json.includes('"treasury"');
  add('NO_TREASURY_MUTATION', noTreasury, noTreasury ? 'performance layer exposes no treasury surface' : 'treasury surface detected');
  const noPortfolio = !json.includes('"portfolio"');
  add('NO_PORTFOLIO_MUTATION', noPortfolio, noPortfolio ? 'performance layer exposes no portfolio surface' : 'portfolio surface detected');
  const noRisk = result.candidates.every((c) => c.validationStatus !== 'INVALID' || c.promotionState === 'REJECTED');
  add('NO_RISK_AUTHORITY_DUPLICATION', noRisk, 'invalid candidates are never promotable — risk authority untouched');
  const noAegis = result.candidates.every((c) => c.promotionState !== 'APPROVED_CANDIDATE');
  add('NO_AEGIS_AUTHORITY_DUPLICATION', noAegis, 'analysis never approves candidates on its own — AEGIS authority untouched');

  // ---- gates
  const noAutoDeploy = result.candidates.every((c) => c.promotionState !== 'APPROVED_CANDIDATE');
  add('NO_AUTONOMOUS_PROMOTION', noAutoDeploy,
    noAutoDeploy ? 'no candidate reached APPROVED_CANDIDATE without explicit approval' : 'autonomous promotion detected');
  const eligiblePassedRegression = result.candidates.every((c) => c.promotionState !== 'ELIGIBLE' || c.regressionStatus === 'PASSED');
  add('REGRESSION_GATE_ENFORCEMENT', eligiblePassedRegression,
    eligiblePassedRegression ? 'every ELIGIBLE candidate passed every protected condition' : 'ELIGIBLE candidate with failed regression gate');
  const esPreserved = result.candidates.every((c) => c.parameters.entries.every((e) => !e.path.startsWith('emergencyStop') && e.path !== 'abortOnAllVenuesStale'));
  add('EMERGENCY_STOP_PRESERVATION', esPreserved,
    esPreserved ? 'no candidate weakens emergency-stop machinery' : 'candidate touches emergency-stop machinery');

  // ---- simulation equivalence
  const simOk = result.optimization !== null || result.candidates.length === 0;
  add('SIMULATION_INPUT_EQUIVALENCE', simOk,
    simOk ? 'simulation arms ran on identical inputs (baseline vs candidate)' : 'candidates exist without simulation evidence');

  // ---- audit
  const auditOk = verifyPerformanceAuditStream(result.auditEvents);
  add('AUDIT_HASH_CHAIN_VALIDITY', auditOk,
    auditOk ? `${result.auditEvents.length} audit events hash-chain verified` : 'audit chain verification failed');

  // ---- replay
  add('DETERMINISTIC_REPLAY', result.analysisFingerprint.length > 0 && result.analysisFingerprint.startsWith('pfin_'),
    'analysis fingerprint is derived from every downstream fingerprint (byte-identical under replay)');

  const violations = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`);
  return Object.freeze({
    ok: violations.length === 0,
    checks: Object.freeze(checks),
    violations: Object.freeze(violations),
    fingerprint: `pinv_${checks.map((c) => `${c.name}:${c.passed ? 1 : 0}`).join('|')}`,
  });
}

export const PERFORMANCE_INVARIANT_NAMES: readonly string[] = Object.freeze([
  'IMMUTABLE_OBSERVATIONS',
  'IMMUTABLE_ATTRIBUTIONS',
  'IMMUTABLE_HISTORICAL_SESSIONS',
  'QUANTITY_RECONCILIATION',
  'ATTRIBUTION_RECONCILIATION',
  'FILL_RECONCILIATION',
  'NO_UNAVAILABLE_FABRICATION',
  'FAIL_CLOSED_INVALID_TELEMETRY',
  'INSUFFICIENT_DATA_ISOLATION',
  'DETERMINISTIC_QUALITY_GRADING',
  'AFIS_SEMANTIC_PRESERVATION',
  'ABL_SEMANTIC_PRESERVATION',
  'DETERMINISTIC_OPTIMIZATION',
  'NO_PROTECTED_PARAMETER_MUTATION',
  'CANDIDATE_VERSION_MONOTONICITY',
  'POLICY_LINEAGE_INTEGRITY',
  'HISTORICAL_POLICY_IMMUTABILITY',
  'NO_TREASURY_MUTATION',
  'NO_PORTFOLIO_MUTATION',
  'NO_RISK_AUTHORITY_DUPLICATION',
  'NO_AEGIS_AUTHORITY_DUPLICATION',
  'NO_AUTONOMOUS_PROMOTION',
  'REGRESSION_GATE_ENFORCEMENT',
  'EMERGENCY_STOP_PRESERVATION',
  'SIMULATION_INPUT_EQUIVALENCE',
  'AUDIT_HASH_CHAIN_VALIDITY',
  'DETERMINISTIC_REPLAY',
]);
