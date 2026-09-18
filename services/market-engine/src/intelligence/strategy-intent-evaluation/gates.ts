/**
 * SPRINT 042 — state gates (§4 lifecycle, §12–§15).
 *
 * Evidence, comparability, freshness, stability and dependency gates over
 * the validated Sprint 041 intent. Every gate outcome is explicit,
 * deterministic and informational — a DEFICIENT gate restricts or blocks
 * eligibility, never silently upgrades it.
 */

import type {StrategyIntentResult, EvaluationGateResult}
  from './types';
import {EvaluationRejectionError} from './types';

// ---------------------------------------------------------------------------
// Evidence gate (§13) — quality, historical support, realization, sample
// ---------------------------------------------------------------------------

export function evaluateEvidenceGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const context = intentResult.context;
  const reasons: string[] = [];
  const evidenceState = context.evidenceState;
  let state: EvaluationGateResult['state'];
  if (evidenceState === 'STRONG') {
    state = 'PASS';
    reasons.push('evidence state is STRONG');
  } else if (evidenceState === 'WEAK' || evidenceState === 'MODERATE') {
    state = 'PASS_WITH_LIMITATIONS';
    reasons.push(`evidence state is ${String(evidenceState)} — carried `
      + 'as an explicit limitation');
  } else if (evidenceState === null) {
    state = 'DEFICIENT';
    reasons.push('the intent carries no evidence state');
  } else {
    state = 'DEFICIENT';
    reasons.push(`evidence state is ${String(evidenceState)}`);
  }

  const historical = context.historicalEvidenceCount;
  if (historical === 0) {
    reasons.push('no historical observations back the intent');
    if (state === 'PASS') state = 'PASS_WITH_LIMITATIONS';
  } else {
    reasons.push(`${String(historical)} historical observations back `
      + 'the intent — explicitly historical, never a future claim');
  }

  const scored = intentResult.alternatives.filter(
    (alternative) => alternative.tradeOffScore !== null).length;
  if (scored === 0) {
    reasons.push('no alternative carries a governed trade-off score');
    if (state === 'PASS_WITH_LIMITATIONS') state = 'DEFICIENT';
  } else {
    reasons.push(`${String(scored)} alternatives carry governed `
      + 'trade-off scores');
  }

  const adequacy = context.sampleAdequacy;
  if (adequacy === 'INSUFFICIENT') {
    reasons.push('sample adequacy is INSUFFICIENT');
    state = 'DEFICIENT';
  } else if (adequacy === 'LIMITED') {
    reasons.push('sample adequacy is LIMITED');
    if (state === 'PASS') state = 'PASS_WITH_LIMITATIONS';
  }

  if (context.unresolvedConflicts.length > 0) {
    reasons.push(`${String(context.unresolvedConflicts.length)} `
      + 'unresolved conflicts are carried');
    state = 'DEFICIENT';
  }

  return Object.freeze({
    gate: 'evidence' as const,
    state,
    detail: 'evidence quality, historical support, realization quality '
      + 'and sample adequacy evaluated over the governed intent states',
    reasons: Object.freeze(reasons),
  });
}

// ---------------------------------------------------------------------------
// Comparability gate (§12) — raw cross-domain stays NOT_COMPARABLE
// ---------------------------------------------------------------------------

export function evaluateComparabilityGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const context = intentResult.context;
  const reasons: string[] = [];
  let state: EvaluationGateResult['state'];
  if (context.comparability === 'COMPARABLE') {
    state = 'PASS';
    reasons.push('the intent is comparable inside its domain');
  } else if (context.comparability
    === 'COMPARABLE_VIA_NORMALIZATION') {
    state = 'PASS_WITH_LIMITATIONS';
    reasons.push('comparison is valid only through the explicit, '
      + 'versioned, loss-declared normalization — never inferred');
  } else {
    state = 'DEFICIENT';
    reasons.push('the intent is not comparable — raw cross-domain '
      + 'comparison is structurally impossible');
  }

  // A single intent must never mix AFIS and ABL alternatives.
  const domains = new Set(intentResult.alternatives.map(
    (alternative) => alternative.domain));
  if (domains.size > 1) {
    throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
      'one intent carries alternatives from multiple domains — raw '
        + 'cross-domain structures reject fail closed');
  }
  reasons.push(`all alternatives stay inside the `
    + `${intentResult.context.domain} domain`);

  // AFIS legs carry no betting identity; ABL legs carry BACK/LAY + odds.
  for (const alternative of intentResult.alternatives) {
    for (const leg of alternative.semanticIdentity) {
      if (alternative.domain === 'AFIS'
        && (leg.side === 'BACK' || leg.side === 'LAY')) {
        throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
          `AFIS alternative ${alternative.alternativeId} carries a `
            + `betting side ${String(leg.side)}`);
      }
      if (alternative.domain === 'ABL'
        && (leg.side === 'BUY' || leg.side === 'SELL')) {
        throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
          `ABL alternative ${alternative.alternativeId} carries a `
            + `financial side ${String(leg.side)}`);
      }
      if (alternative.domain === 'AFIS' && leg.odds !== null) {
        throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
          `AFIS alternative ${alternative.alternativeId} carries `
            + 'betting odds');
      }
      if (alternative.domain === 'ABL'
        && (leg.odds === null || leg.odds <= 1)) {
        throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
          `ABL alternative ${alternative.alternativeId} must carry `
            + 'decimal odds above one');
      }
    }
  }

  return Object.freeze({
    gate: 'comparability' as const,
    state,
    detail: 'domain isolation and comparability verified — AFIS BUY/SELL '
      + 'and ABL BACK/LAY stay distinct, raw cross-domain is never '
      + 'comparable',
    reasons: Object.freeze(reasons),
  });
}

// ---------------------------------------------------------------------------
// Freshness gate (§14) — FRESH/AGING/STALE/UNKNOWN, never silently fresh
// ---------------------------------------------------------------------------

export function evaluateFreshnessGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const freshness = intentResult.context.freshnessState;
  const reasons: string[] = [];
  let state: EvaluationGateResult['state'];
  switch (freshness) {
    case 'FRESH':
      state = 'PASS';
      reasons.push('evidence freshness is FRESH');
      break;
    case 'AGING':
      state = 'PASS_WITH_LIMITATIONS';
      reasons.push('evidence freshness is AGING — carried as an '
        + 'explicit limitation');
      break;
    case 'STALE':
      state = 'DEFICIENT';
      reasons.push('evidence freshness is STALE — the governed policy '
        + 'decides block-or-restrict, never silent acceptance');
      break;
    default:
      state = 'DEFICIENT';
      reasons.push('evidence freshness is UNKNOWN — never silently '
        + 'treated as fresh');
      break;
  }
  return Object.freeze({
    gate: 'freshness' as const,
    state,
    detail: 'freshness is explicit: FRESH, AGING, STALE or UNKNOWN — '
      + 'unknown never becomes fresh and stale follows the governed '
      + 'policy',
    reasons: Object.freeze(reasons),
  });
}

// ---------------------------------------------------------------------------
// Stability gate (§15) — never converted into probability
// ---------------------------------------------------------------------------

export function evaluateStabilityGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const stability = intentResult.context.stabilityState;
  const reasons: string[] = [];
  let state: EvaluationGateResult['state'];
  switch (stability) {
    case 'STABLE':
      state = 'PASS';
      reasons.push('evidence stability is STABLE — explicit '
        + 'information, never a persistence claim');
      break;
    case 'MODERATELY_STABLE':
      state = 'PASS_WITH_LIMITATIONS';
      reasons.push('evidence stability is MODERATELY_STABLE — carried '
        + 'as an explicit limitation');
      break;
    case 'UNSTABLE':
      state = 'DEFICIENT';
      reasons.push('evidence stability is UNSTABLE — no future '
          + 'persistence is invented');
      break;
    default:
      state = 'DEFICIENT';
      reasons.push(`evidence stability is ${String(stability)} — `
        + 'insufficient observations for a stability statement');
      break;
  }
  const carriesWarning = intentResult.restrictions.some((r) =>
    r.code === 'STABILITY_WARNING');
  if (carriesWarning && state === 'PASS') {
    state = 'PASS_WITH_LIMITATIONS';
    reasons.push('the intent carries an explicit STABILITY_WARNING');
  }
  return Object.freeze({
    gate: 'stability' as const,
    state,
    detail: 'stability is explicit trade-off information — stable, '
      + 'unstable, insufficient or conflicted — never converted into '
      + 'probability',
    reasons: Object.freeze(reasons),
  });
}

// ---------------------------------------------------------------------------
// Dependency gate (§17) — every dependency identified or fail closed
// ---------------------------------------------------------------------------

export function evaluateDependencyGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const dependencies = intentResult.dependencies;
  const reasons: string[] = [];
  let state: EvaluationGateResult['state'];
  if (dependencies.state === 'NONE') {
    state = 'PASS';
    reasons.push('the intent is independent — no dependency context '
      + 'is required');
  } else if (dependencies.state === 'UNKNOWN') {
    state = 'DEFICIENT';
    reasons.push('the dependency state is UNKNOWN — missing dependency '
      + 'information fails closed for actionable intents');
  } else {
    state = 'PASS_WITH_LIMITATIONS';
    reasons.push(`dependency state ${dependencies.state} is preserved — `
      + 'dependencies are never removed because a preferred '
      + 'alternative exists');
  }
  if (dependencies.regimeDependency === true) {
    reasons.push(`regime context required: `
      + `${dependencies.applicableRegimes.join(', ')}`);
  }
  if (dependencies.strategyDependency === true) {
    reasons.push(`strategy context required: `
      + `${dependencies.applicableStrategies.join(', ')}`);
  }
  if (dependencies.venueDependency === true) {
    reasons.push(`venue context required: `
      + `${dependencies.applicableVenues.join(', ')}`);
  }
  return Object.freeze({
    gate: 'dependency' as const,
    state,
    detail: 'every dependency the downstream plane must respect is '
      + 'identified — historical evidence, venue, strategy, regime, '
      + 'normalized representation, governance policy and provenance',
    reasons: Object.freeze(reasons),
  });
}
