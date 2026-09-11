import type {ResearchConfigSpec, ResearchInput, ResearchResult} from './types';
import {canonicalJson} from './ids';

/**
 * SPRINT 036 — deterministic replay (§18): the complete pipeline
 * (history → memory → graph → queries → patterns → hypotheses → evidence →
 * findings → feedback) reproduces byte-identically.
 */

export interface ResearchReplay {
  readonly result: ResearchResult;
  readonly comparison: {
    readonly identical: boolean;
    readonly originalFingerprint: string;
    readonly replayFingerprint: string;
    readonly differences: readonly string[];
  };
}

export function compareResearchResults(a: ResearchResult, b: ResearchResult): {
  identical: boolean; differences: readonly string[];
} {
  const aJson = canonicalJson(a);
  const bJson = canonicalJson(b);
  if (aJson === bJson) return {identical: true, differences: []};
  const differences: string[] = [];
  const keys: readonly (keyof ResearchResult)[] = [
    'analysisId', 'timestamp', 'configurationFingerprint', 'analysisFingerprint',
    'batches', 'memory', 'index', 'graph', 'entities', 'queries', 'comparisons',
    'patterns', 'hypotheses', 'evidence', 'findings', 'rankings', 'feedback',
    'recommendations', 'lineage', 'auditEvents', 'invariants', 'replay',
  ];
  for (const key of keys) {
    if (canonicalJson(a[key]) !== canonicalJson(b[key])) differences.push(String(key));
  }
  return {identical: false, differences};
}
