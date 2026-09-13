/**
 * SPRINT 042 — safety validation (§5/§21).
 *
 * Requester annotations and evaluation narratives are scanned for
 * prediction, future-value, guarantee, execution, treasury, portfolio,
 * risk, allocation, authority and policy violations. Quoted spans are
 * reported speech and stay inert; clause-scoped negation is honored
 * ("this evaluation is not a probability" is legal).
 */

import {EvaluationRejectionError} from './types';

// ---------------------------------------------------------------------------
// Semantic vocabularies (deterministic, ordered by precedence)
// ---------------------------------------------------------------------------

/** Probability/prediction/forecast language. */
export const EVALUATION_PREDICTION_TERMS =
  /(probability|probabilities|forecast|prediction|predicts?|guaranteed|guarantee of|will (win|lose|rise|fall|profit)|odds of (winning|success))/i;

/** Expected future value / guaranteed outcome language. */
export const EVALUATION_FUTURE_VALUE_TERMS =
  /(expected (return|profit|roi|value|gain|yield)|guaranteed (profit|return|win|outcome)|risk-?free|riskless|sure (profit|win)|\bcertainty\b|certain to (win|profit))/i;

/** Execution instruction language. */
export const EVALUATION_EXECUTION_TERMS =
  /(place (a|an|the) (order|trade|bet)|submit (the|an|a) (order|request|bet)|execute (now|immediately|this)|buy now|sell now|back now|lay now|dispatch (the|an|a)|cancel (the|an|a) (order|trade|bet)|(back|lay|buy|sell) (this|the) [a-z ]{1,30} now)/i;

/** Treasury action language. */
export const EVALUATION_TREASURY_TERMS =
  /(transfer (the )?funds|withdraw (the )?funds|deposit (the )?funds|treasury (transfer|withdrawal|should|must)|release (the )?funds)/i;

/** Portfolio action language. */
export const EVALUATION_PORTFOLIO_TERMS =
  /(allocate (capital|funds)|allocation of capital|portfolio weight|position sizing|size the position|rebalance (the )?portfolio|open (a|an) position|close (the|a) position)/i;

/** Risk authority language. */
export const EVALUATION_RISK_TERMS =
  /(risk limit|value at risk|\bvar\b|exposure limit|set (the )?risk|override risk|adjust (the )?risk limits?)/i;

/** Allocation authority language. */
export const EVALUATION_ALLOCATION_TERMS =
  /(capital allocation|reserve (capital|funds)|commit capital|allocation (decision|engine|authority)|assign capital)/i;

/** Generic authority claims. */
export const EVALUATION_AUTHORITY_TERMS =
  /(authorize|authorization|on my behalf|approve (this|execution|the trade)|grant (access|approval)|override (governance|policy|the decision))/i;

/** Strategy-boundary language (Strategy decides, never the evaluation). */
export const EVALUATION_STRATEGY_BOUNDARY_TERMS =
  /(strategy must (use|act|execute|adopt)|activate the strategy|the intent directs strategy|execute this strategy|strategy is (now )?active)/i;

/** Governance policy override language. */
export const EVALUATION_POLICY_TERMS =
  /(bypass (governance|the policy|policies)|ignore the governance|policy override|skip (the )?governance)/i;

/** Quoted spans are reported speech, never evaluation assertions. */
const QUOTED_SPANS = /"[^"]*"/g;

/**
 * Clause-scoped negation and boundary-continuation tolerance. "Stays",
 * "remains" and "preserved" assert the continuity of an existing
 * boundary ("Aegis stays the execution authorization author") — never a
 * new grant of authority.
 */
const NEGATION_TOKEN =
  /\b(not|no|never|without|neither|nor|stays?|remains?|preserved)\b/i;

/** Split a line into clauses for negation scoping. */
function clauseOf(rawLine: string): string[] {
  const line = rawLine.replace(QUOTED_SPANS, ' ');
  return line.split(/[.;—!?]/);
}

/** A violation exists only outside negated clauses and quoted spans. */
function assertsViolation(rawLine: string, pattern: RegExp): string | null {
  for (const clause of clauseOf(rawLine)) {
    const match = pattern.exec(clause);
    if (match === null) continue;
    if (!NEGATION_TOKEN.test(clause.slice(0, match.index))) {
      return clause.trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Annotation scan — deterministic precedence, fail closed
// ---------------------------------------------------------------------------

const ANNOTATION_VOCABULARIES: readonly
  [string, RegExp, EvaluationRejectionErrorConstructor0][] = [
    ['prediction', EVALUATION_PREDICTION_TERMS,
      'SEMANTIC_PREDICTION_VIOLATION'],
    ['future value', EVALUATION_FUTURE_VALUE_TERMS,
      'FUTURE_VALUE_VIOLATION'],
    ['execution', EVALUATION_EXECUTION_TERMS,
      'EXECUTION_BOUNDARY_VIOLATION'],
    ['treasury', EVALUATION_TREASURY_TERMS,
      'TREASURY_BOUNDARY_VIOLATION'],
    ['portfolio', EVALUATION_PORTFOLIO_TERMS,
      'PORTFOLIO_BOUNDARY_VIOLATION'],
    ['risk', EVALUATION_RISK_TERMS, 'RISK_BOUNDARY_VIOLATION'],
    ['allocation', EVALUATION_ALLOCATION_TERMS,
      'ALLOCATION_BOUNDARY_VIOLATION'],
    ['strategy boundary', EVALUATION_STRATEGY_BOUNDARY_TERMS,
      'STRATEGY_BOUNDARY_VIOLATION'],
    ['authority', EVALUATION_AUTHORITY_TERMS, 'AUTHORITY_VIOLATION'],
    ['policy', EVALUATION_POLICY_TERMS, 'POLICY_VIOLATION'],
  ];

type EvaluationRejectionErrorConstructor0 = ConstructorParameters<
  typeof EvaluationRejectionError>[0];

export function scanEvaluationAnnotations(
  annotations: readonly string[],
): void {
  for (const annotation of annotations) {
    for (const [label, pattern, code]
      of ANNOTATION_VOCABULARIES) {
      const clause = assertsViolation(annotation, pattern);
      if (clause !== null) {
        throw new EvaluationRejectionError(code,
          `annotation carries ${label} semantics: "${clause}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Narrative scan — the evaluation's own generated text
// ---------------------------------------------------------------------------

/** Collect every narrative field of an evaluation draft. */
export function evaluationNarrativeOf(draft: {
  readonly classificationReasons?: readonly string[];
  readonly eligibilityReasons?: readonly string[];
  readonly dimensionDetails?: readonly string[];
  readonly restrictionReasons?: readonly string[];
  readonly researchRationales?: readonly string[];
  readonly explanationSummaries?: readonly string[];
}): readonly string[] {
  return [
    ...(draft.classificationReasons ?? []),
    ...(draft.eligibilityReasons ?? []),
    ...(draft.dimensionDetails ?? []),
    ...(draft.restrictionReasons ?? []),
    ...(draft.researchRationales ?? []),
    ...(draft.explanationSummaries ?? []),
  ];
}

/** Scan evaluation narratives for every violation family. */
export function scanEvaluationNarratives(
  narratives: readonly string[],
): void {
  for (const narrative of narratives) {
    for (const [label, pattern, code]
      of ANNOTATION_VOCABULARIES) {
      const clause = assertsViolation(narrative, pattern);
      if (clause !== null) {
        throw new EvaluationRejectionError(code,
          `evaluation narrative carries ${label} semantics: "${clause}"`);
      }
    }
  }
}
