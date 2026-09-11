/**
 * SPRINT 038 — stability integration (§11).
 *
 * Maps Sprint 037 stability classifications (class + strategy subjects,
 * metric 'preservation') and preservation drift onto a single interpretation
 * for the candidate. Stability affects interpretation and is surfaced in the
 * profile; it never silently overrides another signal — when it lowers the
 * score, the effect is explicit in the score decomposition.
 *
 * Sprint 037 vocabulary → Sprint 038 interpretation:
 *   STABLE → STABLE, FRAGILE → UNSTABLE, REGIME_DEPENDENT → REGIME_SENSITIVE,
 *   CONTRADICTORY → UNSTABLE (stability evidence itself conflicts),
 *   INSUFFICIENT_EVIDENCE / absent → INSUFFICIENT_HISTORY.
 * Drift refines the interpretation when stability itself is solid:
 *   IMPROVING → IMPROVING, DETERIORATING/STRUCTURAL_SHIFT → DETERIORATING.
 */

import type {
  OpportunityCandidate, StabilityInterpretation,
  StabilityIntegration, OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult} from '../learning/types';
import {stabilityIntegrationIdOf, contentFingerprintOf} from './ids';

function stabilityOfClass(
  learning: LearningResult, kind: string, key: string,
): string | null {
  const found = learning.stability.find(
    (s) => s.subject.kind === kind && s.subject.key === key);
  return found?.classification ?? null;
}

function preservationDriftOf(
  learning: LearningResult, strategyId: string, opportunityClass: string,
): string | null {
  const strategyDrift = learning.drift.find(
    (d) => d.subject.kind === 'STRATEGY' && d.subject.key === strategyId
      && d.metric === 'STRATEGY_PRESERVATION');
  if (strategyDrift) return strategyDrift.classification;
  const classDrift = learning.drift.find(
    (d) => d.subject.kind === 'OPPORTUNITY_CLASS'
      && d.subject.key === opportunityClass
      && d.metric === 'OPPORTUNITY_QUALITY');
  return classDrift?.classification ?? null;
}

export function interpretationOf(
  classStability: string | null,
  strategyStability: string | null,
  preservationDrift: string | null,
): StabilityInterpretation {
  const stabilities = [classStability, strategyStability].filter(
    (s): s is string => s !== null);
  if (stabilities.length === 0) return 'INSUFFICIENT_HISTORY';
  if (stabilities.every((s) => s === 'INSUFFICIENT_EVIDENCE')) {
    return 'INSUFFICIENT_HISTORY';
  }
  const firm = stabilities.filter((s) => s !== 'INSUFFICIENT_EVIDENCE');
  if (firm.some((s) => s === 'REGIME_DEPENDENT')) return 'REGIME_SENSITIVE';
  if (firm.some((s) => s === 'FRAGILE' || s === 'CONTRADICTORY')) return 'UNSTABLE';
  if (firm.every((s) => s === 'STABLE')) {
    if (preservationDrift === 'IMPROVING') return 'IMPROVING';
    if (preservationDrift === 'DETERIORATING' || preservationDrift === 'STRUCTURAL_SHIFT') {
      return 'DETERIORATING';
    }
    return 'STABLE';
  }
  return 'INSUFFICIENT_HISTORY';
}

/** Stability factor in [0,1] (1 = no stability concern), null when insufficient. */
export function stabilityFactorOf(
  interpretation: StabilityInterpretation,
): number | null {
  if (interpretation === 'STABLE') return 1;
  if (interpretation === 'IMPROVING') return 0.85;
  if (interpretation === 'REGIME_SENSITIVE') return 0.6;
  if (interpretation === 'DETERIORATING') return 0.5;
  if (interpretation === 'UNSTABLE') return 0.3;
  return null; // INSUFFICIENT_HISTORY
}

export function assessStability(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): StabilityIntegration {
  const classStability = stabilityOfClass(
    learning, 'OPPORTUNITY_CLASS', candidate.opportunityClass);
  const strategyStability = stabilityOfClass(
    learning, 'STRATEGY', candidate.strategyId);
  const preservationDrift = preservationDriftOf(
    learning, candidate.strategyId, candidate.opportunityClass);
  const interpretation = interpretationOf(
    classStability, strategyStability, preservationDrift);
  const stabilityFactor = stabilityFactorOf(interpretation);
  return Object.freeze({
    candidateId: candidate.candidateId,
    strategyStability,
    classStability,
    preservationDrift,
    interpretation,
    stabilityFactor,
    stabilityIntegrationId: stabilityIntegrationIdOf({
      candidateId: candidate.candidateId, interpretation,
      classStability, strategyStability, preservationDrift,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, interpretation, classStability,
      strategyStability, preservationDrift, stabilityFactor,
    }),
  });
}
