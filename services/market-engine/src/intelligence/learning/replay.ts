import type {LearningResult} from './types';
import {canonicalJson} from './ids';

/**
 * SPRINT 037 — deterministic replay (§22).
 *
 * The complete pipeline (historical memory → research → learning → signals →
 * drift → regime → stability → research priorities) reproduces byte-identically
 * under identical inputs, including input ordering permutations.
 */

export interface LearningReplay {
  readonly result: LearningResult;
  readonly comparison: {
    readonly identical: boolean;
    readonly originalFingerprint: string;
    readonly replayFingerprint: string;
    readonly differences: readonly string[];
  };
}

export function compareLearningResults(a: LearningResult, b: LearningResult): {
  identical: boolean; differences: readonly string[];
} {
  const aJson = canonicalJson(a);
  const bJson = canonicalJson(b);
  if (aJson === bJson) return {identical: true, differences: []};
  const differences: string[] = [];
  const keys: readonly (keyof LearningResult)[] = [
    'analysisId', 'timestamp', 'schemaVersion', 'correlationId', 'traceId',
    'configurationFingerprint', 'analysisFingerprint', 'causalPolicy', 'source',
    'observations', 'features', 'featureVectors', 'cohorts', 'baselines', 'regimes',
    'strategyLearning', 'opportunityLearning', 'venueLearning', 'policyLearning',
    'leakageLearning', 'drift', 'stability', 'confidence', 'signals', 'priorities',
    'recommendations', 'feedback', 'lineage', 'auditEvents', 'invariants', 'replay',
  ];
  for (const key of keys) {
    if (canonicalJson(a[key]) !== canonicalJson(b[key])) differences.push(String(key));
  }
  return {identical: false, differences};
}
