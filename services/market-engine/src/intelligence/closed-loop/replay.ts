import type {ClosedLoopInput, ClosedLoopAnalysisResult} from './types';
import {ClosedLoopIntelligenceEngine, canonicalJson} from './engine';
import type {ClosedLoopConfigInput} from './config';

/**
 * SPRINT 035 — deterministic replay (§23).
 *
 * Replaying the identical historical chain (Opportunity → Strategy →
 * Allocation → Risk → Execution → Control → Performance → Attribution)
 * reproduces identical lifecycle reconstruction, attribution, leakage,
 * realized value, ranking, fingerprints and audit chain — byte-identical.
 */

export interface ReplayComparison {
  readonly identical: boolean;
  readonly originalFingerprint: string;
  readonly replayFingerprint: string;
  readonly originalJson: string;
  readonly replayJson: string;
}

export function replayClosedLoopAnalysis(
  input: ClosedLoopInput, configInput: ClosedLoopConfigInput = {},
): {readonly result: ClosedLoopAnalysisResult; readonly comparison: ReplayComparison} {
  const engine = new ClosedLoopIntelligenceEngine(configInput);
  const original = engine.analyze(input);
  const replay = engine.analyze(input);
  const originalJson = canonicalJson(original);
  const replayJson = canonicalJson(replay);
  return {
    result: replay,
    comparison: {
      identical: originalJson === replayJson,
      originalFingerprint: original.analysisFingerprint,
      replayFingerprint: replay.analysisFingerprint,
      originalJson,
      replayJson,
    },
  };
}

export function compareClosedLoopResults(
  a: ClosedLoopAnalysisResult, b: ClosedLoopAnalysisResult,
): ReplayComparison {
  const originalJson = canonicalJson(a);
  const replayJson = canonicalJson(b);
  return {
    identical: originalJson === replayJson,
    originalFingerprint: a.analysisFingerprint,
    replayFingerprint: b.analysisFingerprint,
    originalJson,
    replayJson,
  };
}
