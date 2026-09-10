import {PerformanceAnalysisResult} from './types';
import {ExecutionPerformanceEngine, PerformanceAnalysisInput} from './engine';
import {verifyPerformanceAuditStream} from './audit';

/**
 * Sprint 034 — deterministic replay.
 *
 * Re-running the same analysis on the same inputs must reproduce every
 * fingerprint byte-identically: observations, metrics, optimization ranking,
 * candidate, lineage and the audit chain.
 */

export interface ReplayComparison {
  readonly equivalent: boolean;
  readonly differences: readonly string[];
  readonly replay: PerformanceAnalysisResult;
}

/** Run the same analysis twice and compare every deterministic surface. */
export function replayPerformanceAnalysis(
  input: PerformanceAnalysisInput,
  configInput: Parameters<ExecutionPerformanceEngine['analyze']> extends never ? never : import('./config').ExecutionPerformanceConfigInput = {},
): ReplayComparison {
  const first = new ExecutionPerformanceEngine(configInput).analyze(input);
  const second = new ExecutionPerformanceEngine(configInput).analyze(input);
  return compareAnalysisResults(first, second);
}

export function compareAnalysisResults(first: PerformanceAnalysisResult, second: PerformanceAnalysisResult): ReplayComparison {
  const differences: string[] = [];
  if (first.analysisId !== second.analysisId) differences.push(`analysisId ${first.analysisId} ≠ ${second.analysisId}`);
  if (first.analysisFingerprint !== second.analysisFingerprint) differences.push('analysisFingerprint differs');
  if (first.configurationFingerprint !== second.configurationFingerprint) differences.push('configurationFingerprint differs');
  if (first.observations.length !== second.observations.length
    || first.observations.some((o, i) => o.fingerprint !== second.observations[i]?.fingerprint)) {
    differences.push('observations differ');
  }
  if (first.attributions.length !== second.attributions.length
    || first.attributions.some((a, i) => a.fingerprint !== second.attributions[i]?.fingerprint)) {
    differences.push('attributions differ');
  }
  if (first.benchmarks.length !== second.benchmarks.length
    || first.benchmarks.some((b, i) => b.fingerprint !== second.benchmarks[i]?.fingerprint)) {
    differences.push('benchmarks differ');
  }
  if (first.qualities.length !== second.qualities.length
    || first.qualities.some((q, i) => q.fingerprint !== second.qualities[i]?.fingerprint)) {
    differences.push('qualities differ');
  }
  if (first.venueScorecards.length !== second.venueScorecards.length
    || first.venueScorecards.some((v, i) => v.fingerprint !== second.venueScorecards[i]?.fingerprint)) {
    differences.push('venue scorecards differ');
  }
  if (first.strategyScores.length !== second.strategyScores.length
    || first.strategyScores.some((s, i) => s.fingerprint !== second.strategyScores[i]?.fingerprint)) {
    differences.push('strategy scores differ');
  }
  if (first.domainScores.length !== second.domainScores.length
    || first.domainScores.some((d, i) => d.fingerprint !== second.domainScores[i]?.fingerprint)) {
    differences.push('domain scores differ');
  }
  if (first.policyEvaluations.length !== second.policyEvaluations.length
    || first.policyEvaluations.some((p, i) => p.fingerprint !== second.policyEvaluations[i]?.fingerprint)) {
    differences.push('policy evaluations differ');
  }
  if ((first.optimization?.baselineScore ?? null) !== (second.optimization?.baselineScore ?? null)) {
    differences.push('optimization baseline score differs');
  }
  const rankA = (first.optimization?.evaluated ?? []).map((e) => `${e.parameters.fingerprint}:${e.score}`).join('|');
  const rankB = (second.optimization?.evaluated ?? []).map((e) => `${e.parameters.fingerprint}:${e.score}`).join('|');
  if (rankA !== rankB) differences.push('optimization ranking differs');
  if (first.candidates.length !== second.candidates.length
    || first.candidates.some((c, i) => c.fingerprint !== second.candidates[i]?.fingerprint)) {
    differences.push('candidates differ');
  }
  if (first.policyLineage.fingerprint !== second.policyLineage.fingerprint) differences.push('policy lineage differs');
  const auditA = first.auditEvents.map((e) => e.hash).join('|');
  const auditB = second.auditEvents.map((e) => e.hash).join('|');
  if (auditA !== auditB) differences.push('audit chains differ');
  if (!verifyPerformanceAuditStream(first.auditEvents) || !verifyPerformanceAuditStream(second.auditEvents)) {
    differences.push('an audit stream failed verification');
  }
  return Object.freeze({
    equivalent: differences.length === 0,
    differences: Object.freeze(differences),
    replay: second,
  });
}
