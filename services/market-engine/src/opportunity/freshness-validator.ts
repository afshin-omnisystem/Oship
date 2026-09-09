/**
 * Deterministic freshness/expiration validator. An opportunity is fresh if its
 * most recent evidence observation is within the freshness window at the given
 * `now`. The returned freshness is a 0..1 score.
 */
export interface FreshnessResult {
  readonly fresh: boolean;
  readonly freshness: number;
  readonly ageMs: number;
  readonly reason?: string;
  readonly expired: boolean;
}

export function validateFreshness(input: {
  observedAt: number;
  now: number;
  freshnessWindowMs: number;
}): FreshnessResult {
  const ageMs = Math.max(0, input.now - input.observedAt);
  const expired = ageMs > input.freshnessWindowMs;
  const freshness = Math.max(0, Math.min(1, 1 - ageMs / input.freshnessWindowMs));
  return {
    fresh: !expired,
    freshness,
    ageMs,
    reason: expired ? 'STALE_EVIDENCE' : undefined,
    expired,
  };
}
