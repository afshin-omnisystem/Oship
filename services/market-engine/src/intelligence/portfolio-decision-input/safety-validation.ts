/**
 * SPRINT 043 — semantic safety validation (§20, §4).
 *
 * Requester annotations and bridge narratives are scanned against the
 * prediction, future-value, execution, treasury, portfolio, risk,
 * allocation, strategy-boundary, AEGIS and authority vocabularies.
 * Clause-scoped negation and quoted spans are tolerated; boundary
 * continuation ("Aegis remains the authorization authority") is inert.
 */

import {InputRejectionError} from './types';

/** Prediction language. */
export const INPUT_PREDICTION_TERMS =
  /(probability|probabilities|forecast|prediction|predicts?|guaranteed|guarantee of|will (win|lose|rise|fall|profit)|odds of (winning|success))/i;

/** Expected future value language. */
export const INPUT_FUTURE_VALUE_TERMS =
  /(expected (return|profit|roi|value|gain|yield)|future (profit|value|return))/i;

/** Execution instruction language. */
export const INPUT_EXECUTION_TERMS =
  /(place (a|an|the) (order|trade|bet)|submit (the|an|a) (order|request|bet)|execute (now|immediately|this)|buy now|sell now|back now|lay now|dispatch (the|an|a)|cancel (the|an|a) (order|trade|bet)|(back|lay|buy|sell) (this|the) [a-z ]{1,30} now)/i;

/** Treasury action language. */
export const INPUT_TREASURY_TERMS =
  /(transfer (the )?funds|withdraw (the )?funds|deposit (the )?funds|treasury (transfer|withdrawal|should|must)|release (the )?funds)/i;

/** Portfolio action language. */
export const INPUT_PORTFOLIO_TERMS =
  /(allocate (capital|funds)|allocation of capital|portfolio weight|position sizing|size the position|rebalance (the )?portfolio|open (a|an) position|close (the|a) position)/i;

/** Risk authority language. */
export const INPUT_RISK_TERMS =
  /(risk limit|value at risk|\bvar\b|exposure limit|set (the )?risk|override risk|adjust (the )?risk limits?)/i;

/** Allocation authority language. */
export const INPUT_ALLOCATION_TERMS =
  /(capital allocation|reserve (capital|funds)|commit capital|allocation (decision|engine|authority)|assign capital)/i;

/** Strategy-boundary language. */
export const INPUT_STRATEGY_BOUNDARY_TERMS =
  /(strategy must (use|act|execute|adopt)|activate the strategy|the intent directs strategy|execute this strategy|strategy is (now )?active)/i;

/** AEGIS authorization language. */
export const INPUT_AEGIS_TERMS =
  /(aegis (approval|authorization)|authorize aegis|on behalf of aegis|bypass aegis)/i;

/** Authority claims — the bridge has NO_DECISION_AUTHORITY. */
export const INPUT_AUTHORITY_TERMS =
  /(authorize|authorization|on my behalf|on behalf of (the )?(portfolio|risk|allocation)|approve (this|execution|the trade|the allocation)|grant (access|approval)|override (governance|policy|the decision)|the bridge (approves|decides|authorizes))/i;

/** Governance policy override language. */
export const INPUT_POLICY_TERMS =
  /(bypass (governance|the policy|policies)|ignore the governance|policy override|skip (the )?governance)/i;

/** Quoted spans are reported speech, never bridge assertions. */
const QUOTED_SPANS = /"[^"]*"/g;

/**
 * Clause-scoped negation and boundary-continuation tolerance. "Stays",
 * "remains" and "preserved" assert the continuity of an existing
 * boundary — never a new grant of authority.
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

const ANNOTATION_VOCABULARIES: readonly
  [string, RegExp, InputRejectionCode0][] = [
    ['prediction', INPUT_PREDICTION_TERMS,
      'SEMANTIC_PREDICTION_VIOLATION'],
    ['future value', INPUT_FUTURE_VALUE_TERMS,
      'FUTURE_VALUE_VIOLATION'],
    ['execution', INPUT_EXECUTION_TERMS,
      'EXECUTION_BOUNDARY_VIOLATION'],
    ['treasury', INPUT_TREASURY_TERMS,
      'TREASURY_BOUNDARY_VIOLATION'],
    ['portfolio', INPUT_PORTFOLIO_TERMS,
      'PORTFOLIO_BOUNDARY_VIOLATION'],
    ['risk', INPUT_RISK_TERMS, 'RISK_BOUNDARY_VIOLATION'],
    ['allocation', INPUT_ALLOCATION_TERMS,
      'ALLOCATION_BOUNDARY_VIOLATION'],
    ['strategy boundary', INPUT_STRATEGY_BOUNDARY_TERMS,
      'STRATEGY_BOUNDARY_VIOLATION'],
    ['aegis', INPUT_AEGIS_TERMS, 'AEGIS_BOUNDARY_VIOLATION'],
    ['authority', INPUT_AUTHORITY_TERMS, 'AUTHORITY_MISMATCH'],
    ['policy', INPUT_POLICY_TERMS, 'AUTHORITY_MISMATCH'],
  ];

type InputRejectionCode0 = ConstructorParameters<
  typeof InputRejectionError>[0];

/** §6 lifecycle — annotation scan, deterministic precedence, fail closed. */
export function scanInputAnnotations(
  annotations: readonly string[],
): void {
  for (const annotation of annotations) {
    for (const [label, pattern, code] of ANNOTATION_VOCABULARIES) {
      const clause = assertsViolation(annotation, pattern);
      if (clause !== null) {
        throw new InputRejectionError(code,
          `requester annotation carries ${label} semantics: `
            + `"${clause}" — fail closed`);
      }
    }
  }
}

/** The narrative lines the bridge itself generates. */
export interface InputNarrative {
  readonly classificationReasons?: readonly string[];
  readonly eligibilityReasons?: readonly string[];
  readonly constraintReasons?: readonly string[];
  readonly restrictionReasons?: readonly string[];
  readonly evidenceObservations?: readonly string[];
  readonly explanationSummaries?: readonly string[];
}

export function inputNarrativeOf(
  narrative: InputNarrative,
): readonly string[] {
  return [
    ...(narrative.classificationReasons ?? []),
    ...(narrative.eligibilityReasons ?? []),
    ...(narrative.constraintReasons ?? []),
    ...(narrative.restrictionReasons ?? []),
    ...(narrative.evidenceObservations ?? []),
    ...(narrative.explanationSummaries ?? []),
  ];
}

/** Narrative scan over the bridge's own generated text. */
export function scanInputNarratives(
  narrative: InputNarrative,
): void {
  const lines = inputNarrativeOf(narrative);
  const narrativeVocabularies: readonly
    [string, RegExp, InputRejectionCode0][] = [
    ['prediction', INPUT_PREDICTION_TERMS,
      'SEMANTIC_PREDICTION_VIOLATION'],
    ['future value', INPUT_FUTURE_VALUE_TERMS,
      'FUTURE_VALUE_VIOLATION'],
    ['execution', INPUT_EXECUTION_TERMS,
      'EXECUTION_BOUNDARY_VIOLATION'],
    ['treasury', INPUT_TREASURY_TERMS,
      'TREASURY_BOUNDARY_VIOLATION'],
    ['portfolio', INPUT_PORTFOLIO_TERMS,
      'PORTFOLIO_BOUNDARY_VIOLATION'],
    ['risk', INPUT_RISK_TERMS, 'RISK_BOUNDARY_VIOLATION'],
    ['allocation', INPUT_ALLOCATION_TERMS,
      'ALLOCATION_BOUNDARY_VIOLATION'],
  ];
  for (const line of lines) {
    for (const [label, pattern, code] of narrativeVocabularies) {
      const clause = assertsViolation(line, pattern);
      if (clause !== null) {
        throw new InputRejectionError(code,
          `bridge narrative carries ${label} semantics: `
            + `"${clause}" — fail closed`);
      }
    }
  }
}
