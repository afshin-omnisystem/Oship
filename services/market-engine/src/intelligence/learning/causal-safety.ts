import type {CausalStatus} from './types';

/**
 * SPRINT 037 — causal-safety layer (§15).
 *
 * Protection against false causal claims. The learning plane may state
 * correlation, association, historically-higher/lower and co-occurrence. It
 * must NOT state caused / guarantees / will produce / proves future
 * performance unless an explicit causal basis is documented — which this
 * analytical layer never has. Default causal status: ASSOCIATIONAL_ONLY.
 */

export const CAUSAL_FORBIDDEN_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bcauses?\b/i,
  /\bcaused\b/i,
  /\bcausation\b/i,
  /\bguarantees?\b/i,
  /\bguaranteed\b/i,
  /\bwill produce\b/i,
  /\bwill yield\b/i,
  /\bwill generate\b/i,
  /\bproves\b/i,
  /\bproven\b/i,
  /\bensures?\b/i,
  /\bdefinitely\b/i,
  /\bprovably\b/i,
  /\binevitably\b/i,
]);

/** Vocabulary the learning plane MAY use — associational, never causal. */
export const CAUSALLY_SAFE_TERMS: readonly string[] = Object.freeze([
  'correlated', 'associated', 'historically higher', 'historically lower',
  'observed alongside', 'co-occurred', 'measured delta', 'observed',
]);

export const DEFAULT_CAUSAL_STATUS: CausalStatus = 'ASSOCIATIONAL_ONLY';

export interface CausalVerdict {
  readonly status: CausalStatus;
  readonly safe: boolean;
  readonly violations: readonly string[];
}

export function causalVerdictOf(statement: string): CausalVerdict {
  const violations = CAUSAL_FORBIDDEN_PATTERNS
    .filter((pattern) => pattern.test(statement))
    .map((pattern) => pattern.source);
  return Object.freeze({
    status: DEFAULT_CAUSAL_STATUS,
    safe: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

/** Fail-closed assertion used on EVERY generated learning statement. */
export function assertCausalSafety(statement: string, context: string): void {
  const verdict = causalVerdictOf(statement);
  if (!verdict.safe) {
    throw new Error(
      `learning causal-safety: forbidden causal language in ${context}: `
      + `${verdict.violations.join(', ')} — fail closed (status is ${DEFAULT_CAUSAL_STATUS})`);
  }
}

/** Prefix every learning statement carries conceptually — historical framing. */
export const HISTORICAL_FRAMING = 'historically';
