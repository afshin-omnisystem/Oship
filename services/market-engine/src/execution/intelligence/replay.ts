import {
  IntelligenceRunResult,
} from './types';
import {ExecutionIntelligenceEngine, IntelligenceRunInput} from './engine';
import {replayFingerprintOf} from './ids';

/**
 * Sprint 032 — Deterministic Replay.
 *
 * Given the execution plan, simulation configuration, market events (the
 * per-cycle venue/market worlds), execution telemetry and controller
 * configuration, the replay reproduces — bit for bit — the signals, quality
 * scores, adaptive decisions, replans, execution lineage and final state of
 * the original run. Replay runs in a fresh isolated engine instance and never
 * mutates any live state. The replay output carries its own deterministic
 * fingerprint.
 */

export interface IntelligenceReplayResult {
  readonly replayFingerprint: string;
  readonly identical: boolean;
  readonly mismatches: readonly string[];
  readonly original: IntelligenceRunResult;
  readonly replay: IntelligenceRunResult;
}

export interface ReplayComparison {
  readonly identical: boolean;
  readonly mismatches: readonly string[];
}

/** Replay an intelligence run in a fresh isolated engine. */
export function replayIntelligence(input: IntelligenceRunInput): IntelligenceReplayResult {
  const original = new ExecutionIntelligenceEngine(
    input.config ?? {},
    input.simConfig ?? {},
  ).run(input);

  const replay = new ExecutionIntelligenceEngine(
    input.config ?? {},
    input.simConfig ?? {},
  ).run(input);

  const comparison = compareIntelligenceRuns(original, replay);
  return Object.freeze({
    replayFingerprint: replayFingerprintOf({
      originalFingerprint: original.fingerprint,
      replayFingerprint: replay.fingerprint,
      identical: comparison.identical,
      mismatches: comparison.mismatches,
    }),
    identical: comparison.identical,
    mismatches: comparison.mismatches,
    original,
    replay,
  });
}

/** Compare two intelligence runs for full equivalence. */
export function compareIntelligenceRuns(a: IntelligenceRunResult, b: IntelligenceRunResult): ReplayComparison {
  const mismatches: string[] = [];
  if (a.intelligenceRunId !== b.intelligenceRunId) mismatches.push('runId differs');
  if (a.fingerprint !== b.fingerprint) mismatches.push('fingerprint differs');
  if (a.finalPlanId !== b.finalPlanId) mismatches.push('finalPlanId differs');
  if (a.finalState !== b.finalState) mismatches.push('finalState differs');
  if (a.finalAction !== b.finalAction) mismatches.push('finalAction differs');
  if (a.finalQualityScore !== b.finalQualityScore) mismatches.push('finalQualityScore differs');
  if (a.reconciled !== b.reconciled) mismatches.push('reconciled differs');
  if (a.invariantsSatisfied !== b.invariantsSatisfied) mismatches.push('invariantsSatisfied differs');
  if (a.cycles.length !== b.cycles.length) {
    mismatches.push(`cycle count differs (${a.cycles.length} vs ${b.cycles.length})`);
  } else {
    for (let i = 0; i < a.cycles.length; i++) {
      const ca = a.cycles[i];
      const cb = b.cycles[i];
      if (ca.feedback.fingerprint !== cb.feedback.fingerprint) mismatches.push(`cycle ${i} feedback fingerprint differs`);
      if (ca.feedback.telemetry.fingerprint !== cb.feedback.telemetry.fingerprint) mismatches.push(`cycle ${i} telemetry fingerprint differs`);
      if (ca.feedback.quality.fingerprint !== cb.feedback.quality.fingerprint) mismatches.push(`cycle ${i} quality fingerprint differs`);
      if (ca.controller.decision.decisionFingerprint !== cb.controller.decision.decisionFingerprint) mismatches.push(`cycle ${i} decision fingerprint differs`);
      if (ca.controller.decision.action !== cb.controller.decision.action) mismatches.push(`cycle ${i} action differs`);
      if (ca.controller.fingerprint !== cb.controller.fingerprint) mismatches.push(`cycle ${i} controller fingerprint differs`);
      if (ca.simulation.fingerprint !== cb.simulation.fingerprint) mismatches.push(`cycle ${i} simulation fingerprint differs`);
      if (JSON.stringify(ca.feedback.signals) !== JSON.stringify(cb.feedback.signals)) mismatches.push(`cycle ${i} signals differ`);
    }
  }
  if (a.decisions.length !== b.decisions.length) mismatches.push('decision count differs');
  else {
    for (let i = 0; i < a.decisions.length; i++) {
      if (a.decisions[i].decisionFingerprint !== b.decisions[i].decisionFingerprint) mismatches.push(`decision ${i} fingerprint differs`);
    }
  }
  if (a.appliedActions.length !== b.appliedActions.length) mismatches.push('applied action count differs');
  else {
    for (let i = 0; i < a.appliedActions.length; i++) {
      if (a.appliedActions[i].actionId !== b.appliedActions[i].actionId) mismatches.push(`applied action ${i} differs`);
    }
  }
  if (a.lineage.length !== b.lineage.length) mismatches.push('lineage length differs');
  else {
    for (let i = 0; i < a.lineage.length; i++) {
      if (a.lineage[i].executionPlanId !== b.lineage[i].executionPlanId) mismatches.push(`lineage ${i} plan id differs`);
      if (a.lineage[i].fingerprint !== b.lineage[i].fingerprint) mismatches.push(`lineage ${i} plan fingerprint differs`);
    }
  }
  if (a.auditEvents.length !== b.auditEvents.length) mismatches.push('audit event count differs');

  return Object.freeze({
    identical: mismatches.length === 0,
    mismatches: Object.freeze(mismatches),
  });
}

/** Convenience: run once, replay once, assert equivalence (demo/tests). */
export function assertReplayDeterminism(input: IntelligenceRunInput): IntelligenceReplayResult {
  const result = replayIntelligence(input);
  if (!result.identical) {
    throw new Error(`execution-intelligence replay is not deterministic: ${result.mismatches.join('; ')}`);
  }
  return result;
}
