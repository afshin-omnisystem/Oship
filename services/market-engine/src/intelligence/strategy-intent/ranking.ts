/**
 * SPRINT 041 — deterministic acceptable-alternative ranking (§7/§20).
 *
 * Preferred first, then secondary alternatives in governed rank order
 * with canonical id tie-breaks. Byte-identical for identical inputs.
 */

import type {IntentAlternative} from './types';

export interface IntentRanking {
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly secondaryCount: number;
}

export function rankAcceptableAlternatives(
  alternatives: readonly IntentAlternative[],
  secondaryLimit: number,
): IntentRanking {
  const preferred = alternatives.filter(
    (alternative) => alternative.role === 'PREFERRED');
  if (preferred.length > 1) {
    throw new Error('strategy-intent ranking: at most one preferred '
      + 'alternative — fail closed');
  }
  const secondary = alternatives
    .filter((alternative) => alternative.role === 'SECONDARY')
    .sort(compareByRankThenId)
    .slice(0, secondaryLimit);
  return Object.freeze({
    preferredAlternativeId: preferred.length === 1
      ? preferred[0].alternativeId : null,
    acceptableAlternativeIds: Object.freeze(
      [...preferred, ...secondary].map(
        (alternative) => alternative.alternativeId)),
    secondaryCount: secondary.length,
  });
}

function compareByRankThenId(a: IntentAlternative,
  b: IntentAlternative): number {
  const aRank = a.rank ?? Number.MAX_SAFE_INTEGER;
  const bRank = b.rank ?? Number.MAX_SAFE_INTEGER;
  if (aRank !== bRank) return aRank - bRank;
  return a.alternativeId < b.alternativeId ? -1 : 1;
}

/** Deterministic ordering used across serialization (§20). */
export function canonicalAlternativeOrder(
  alternatives: readonly IntentAlternative[],
): readonly IntentAlternative[] {
  const roleRank: Readonly<Record<string, number>> = Object.freeze({
    PREFERRED: 0, SECONDARY: 1, REJECTED: 2, UNSUPPORTED: 3,
  });
  return Object.freeze([...alternatives].sort((a, b) => {
    const byRole = (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9);
    if (byRole !== 0) return byRole;
    const aRank = a.rank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.alternativeId < b.alternativeId ? -1 : 1;
  }));
}
