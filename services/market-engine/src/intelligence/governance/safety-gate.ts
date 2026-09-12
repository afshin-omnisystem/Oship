/**
 * SPRINT 040 — safety gate (§4).
 *
 * Rejects or restricts any decision result or requester annotation that
 * attempts to introduce probability, forecast, expected profit, expected
 * ROI, guaranteed return, guaranteed execution, certainty claims or
 * execution instructions. The system stays evidence-bound: the canonical
 * disclaimer must be present verbatim on every governed result. Violations
 * are never sanitized — they block, with the explicit UNSAFE_SEMANTICS code.
 */

import type {
  DecisionIntelligenceResult, SafetyGateResult, GovernanceGateCheck,
} from './types';
import {GOVERNANCE_DISCLAIMER} from './types';
import {RECOMMENDATION_DISCLAIMER} from '../decision/types';
import {safetyGateIdOf, contentFingerprintOf, canonicalJson} from './ids';

/** Fabricated output keys — forbidden as property names anywhere. */
export const FABRICATED_KEYS =
  /"(probability|expectedReturn|expected_return|expectedValue|expectedProfit|expectedRoi|roi|winRate|pWin|winProbability|probabilityOfSuccess|successOdds|futurePrice|futureOdds|forecast|forecastedProfit|guaranteedProfit|guaranteedReturn|guaranteedExecution|certainty)":/;

/** Certainty claims — forbidden in narrative (disclaimers excluded). */
export const CERTAINTY_CLAIMS =
  /(guaranteed|will (win|profit|lose|rise|fall)|cannot lose|risk-free|riskless|sure profit|definitely|\bcertain\b|certainty|certainly)/i;

/** Negated certainty mentions — legitimate boundary statements. */
const NEGATED_CERTAINTY =
  /(not a|no|never|without|neither|nor|is not|are not|not)\s+(a\s+)?(certainty|certain|guarantee[ds]?)/gi;

/** True when text asserts certainty AFTER negated mentions are removed. */
export function containsCertaintyClaim(text: string): boolean {
  const stripped = text.replace(NEGATED_CERTAINTY, ' ');
  return CERTAINTY_CLAIMS.test(stripped);
}

/** Prediction terms — forbidden in requester annotations. */
export const PREDICTION_TERMS =
  /(probability|forecast|expected (profit|return|roi|value|gain)|predicted|prediction|guaranteed (profit|return|execution|win)|certainty of|will (win|profit|rise|fall))/i;

/** Execution-instruction terms — forbidden in requester annotations. */
export const EXECUTION_INSTRUCTIONS =
  /(execute (now|immediately|this|the)|place (a|an|the) (trade|bet|order)|submit (a|an|the) (order|request)|buy now|sell now|back now|lay now|dispatch (the|an|a)|fire (the|it))/i;

/** The narrative fields scanned for certainty claims (never disclaimers). */
export function narrativeOf(result: DecisionIntelligenceResult): string[] {
  return [
    result.explanation.summary,
    ...result.explanation.acceptanceDecisions,
    ...result.explanation.recommendationRationale,
    ...result.recommendation.supportingEvidence,
    ...result.recommendation.opposingEvidence,
    ...result.recommendation.dependencyState,
    ...result.explanation.regimeEffects,
    ...result.explanation.strategyEffects,
    ...result.explanation.venueEffects,
    ...result.explanation.leakageEffects,
    ...result.explanation.stabilityEffects,
    ...result.researchContext.recommendedPriorities.map((q) => q.question),
    result.context.evidenceQualitySummary,
    result.context.regimeSummary,
  ];
}

/** The disclaimer-bearing fields excluded from narrative scans. */
export function disclaimerFieldsOf(result: DecisionIntelligenceResult): string[] {
  return [
    result.recommendation.disclaimer,
    ...result.alternatives.map((a) =>
      a.profile.outcomeDistribution.disclaimer),
    result.context.similaritySummary,
  ];
}

export function evaluateSafetyGate(
  decisionResult: DecisionIntelligenceResult,
  annotations: readonly string[],
): SafetyGateResult {
  const checks: GovernanceGateCheck[] = [];
  const reasons: string[] = [];

  // 1. The canonical disclaimer must be present verbatim.
  const disclaimerVerified =
    decisionResult.recommendation.disclaimer === RECOMMENDATION_DISCLAIMER
    && RECOMMENDATION_DISCLAIMER === GOVERNANCE_DISCLAIMER;
  checks.push({check: 'canonical-disclaimer', passed: disclaimerVerified,
    detail: 'the exact evidence-bound disclaimer is present on the '
      + 'recommendation'});

  // 2. Informational and associational flags.
  const informationalOk = decisionResult.recommendation.informational === true
    && decisionResult.context.informational === true
    && decisionResult.causalPolicy === 'ASSOCIATIONAL_ONLY';
  checks.push({check: 'informational-associational', passed: informationalOk,
    detail: 'informational flags and ASSOCIATIONAL_ONLY causal policy'});

  // 3. Counterfactuals stay counterfactual.
  const counterfactualOk = decisionResult.alternatives.every(
    (a) => a.counterfactualOnly === true);
  checks.push({check: 'counterfactual-only', passed: counterfactualOk,
    detail: 'every alternative is marked counterfactualOnly'});

  // 4. Historical distributions stay historical.
  const historicalOk = decisionResult.alternatives.every(
    (a) => a.profile.outcomeDistribution.historicalOnly === true);
  checks.push({check: 'historical-only', passed: historicalOk,
    detail: 'every historical outcome distribution is historicalOnly'});

  // 5. No fabricated keys anywhere in the serialized result.
  const serialized = canonicalJson(decisionResult);
  const noFabricatedKeys = !FABRICATED_KEYS.test(serialized);
  checks.push({check: 'no-fabricated-keys', passed: noFabricatedKeys,
    detail: 'no probability/forecast/expected-return/guarantee keys exist'});

  // 6. No certainty claims in the narrative (disclaimers excluded).
  const narrative = narrativeOf(decisionResult);
  const certaintyViolations = narrative.filter((line) =>
    containsCertaintyClaim(line));
  const narrativeClean = certaintyViolations.length === 0;
  checks.push({check: 'no-certainty-claims', passed: narrativeClean,
    detail: certaintyViolations.length === 0
      ? 'no certainty claims in narrative'
      : `certainty claims in: ${certaintyViolations[0]}`});

  // 7. Annotations carry no prediction semantics.
  const annotationViolations = annotations.filter((note) =>
    PREDICTION_TERMS.test(note) || containsCertaintyClaim(note));
  const annotationsClean = annotationViolations.length === 0;
  checks.push({check: 'annotations-prediction-free', passed: annotationsClean,
    detail: annotationsClean ? 'annotations carry no prediction semantics'
      : `prediction semantics in: ${annotationViolations[0]}`});

  // 8. Annotations carry no execution instructions.
  const executionViolations = annotations.filter((note) =>
    EXECUTION_INSTRUCTIONS.test(note));
  const executionClean = executionViolations.length === 0;
  checks.push({check: 'annotations-instruction-free', passed: executionClean,
    detail: executionClean ? 'annotations carry no execution instructions'
      : `execution instruction in: ${executionViolations[0]}`});

  const structuralFailures = [
    !disclaimerVerified && 'the canonical disclaimer is absent or altered',
    !informationalOk && 'informational/associational flags missing',
    !counterfactualOk && 'an alternative is not counterfactualOnly',
    !historicalOk && 'a historical distribution is not historicalOnly',
    !noFabricatedKeys && 'fabricated keys present in the decision result',
    !narrativeClean && 'certainty claims present in the narrative',
  ].filter((reason): reason is string => reason !== false);
  const annotationFailures = [
    ...annotationViolations.map((note) =>
      `annotation carries prediction semantics: "${note}"`),
    ...executionViolations.map((note) =>
      `annotation carries an execution instruction: "${note}"`),
  ];
  reasons.push(...structuralFailures, ...annotationFailures);

  let state: SafetyGateResult['state'];
  if (structuralFailures.length > 0 || annotationFailures.length > 0) {
    state = 'BLOCK_UNSAFE';
  } else {
    state = 'SAFE';
  }

  const core = {
    state,
    code: state === 'BLOCK_UNSAFE' ? 'UNSAFE_SEMANTICS' as const : null,
    reasons: Object.freeze(reasons),
    checks: Object.freeze(checks),
    disclaimerVerified,
    safetyGateId: safetyGateIdOf({state, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
