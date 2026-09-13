/**
 * SPRINT 042 — evaluation dimensions (§7).
 *
 * Eighteen explicit, deterministic dimensions. Every dimension has
 * explicit semantics — no hidden scoring, no opaque ML model, no
 * dimension is ever inferred from another.
 */

import type {
  StrategyIntentResult, EvaluationDimension,
  EvaluationDimensionState, EvaluationConfigSpec,
} from './types';
import {EVALUATION_DIMENSION_NAMES} from './types';
import {evaluationDimensionIdOf} from './ids';

export interface DimensionInput {
  readonly intentResult: StrategyIntentResult;
  readonly config: EvaluationConfigSpec;
  readonly evaluationId: string;
  readonly portfolioCompatible: boolean;
  readonly normalizationRequired: boolean;
}

export function evaluateDimensions(
  input: DimensionInput,
): readonly EvaluationDimension[] {
  const {intentResult, config} = input;
  const context = intentResult.context;
  const intent = intentResult.intent;
  const dimensions: EvaluationDimension[] = [];
  const push = (dimension: string, state: EvaluationDimensionState,
    detail: string): void => {
    const core = {evaluationId: input.evaluationId, dimension,
      state, detail};
    dimensions.push(Object.freeze({
      ...core,
      dimensionId: evaluationDimensionIdOf(core),
    }));
  };

  // 1. intent-integrity — verified by the integrity gate.
  push('intent-integrity', 'SATISFIED',
    'the intent artifact is structurally valid, frozen and internally '
      + 'consistent — its classification, restrictions, normalization '
      + 'and dependencies agree with its governed states');

  // 2. provenance-completeness — the full chain is present.
  push('provenance-completeness', 'SATISFIED',
    `provenance chains Opportunity → Intelligence → Decision → `
      + `Governance → StrategyIntent → Evaluation with every upstream `
      + `engine version pinned (${intent.provenance.governanceId})`);

  // 3. evidence-quality — the governed evidence state.
  {
    const evidence = context.evidenceState;
    if (evidence === 'STRONG') {
      push('evidence-quality', 'SATISFIED',
        'the governed evidence state is STRONG');
    } else if (evidence === 'WEAK' || evidence === 'MODERATE') {
      push('evidence-quality', 'LIMITED',
        `the governed evidence state is ${String(evidence)} — carried `
          + 'as an explicit limitation, never upgraded');
    } else {
      push('evidence-quality', 'DEFICIENT',
        `the governed evidence state is ${String(evidence)}`);
    }
  }

  // 4. historical-support — explicitly historical observations.
  {
    const count = context.historicalEvidenceCount;
    if (count >= config.historicalSupportThreshold) {
      push('historical-support', 'SATISFIED',
        `${String(count)} historical observations support the intent — `
          + 'explicitly historical, never a future claim');
    } else if (count > 0) {
      push('historical-support', 'LIMITED',
        `${String(count)} historical observations support the intent `
          + `(below the threshold of `
          + `${String(config.historicalSupportThreshold)})`);
    } else {
      push('historical-support', 'DEFICIENT',
        'no historical observations support the intent');
    }
  }

  // 5. historical-realization-quality — governed realization outcomes.
  {
    const scored = intentResult.alternatives.filter(
      (a) => a.tradeOffScore !== null);
    const preferredScored = intentResult.preferredAlternativeId !== null
      && intentResult.alternatives.some((a) =>
        a.alternativeId === intentResult.preferredAlternativeId
        && a.tradeOffScore !== null);
    if (preferredScored) {
      push('historical-realization-quality', 'SATISFIED',
        'the preferred alternative carries a governed historical '
          + 'trade-off decomposition — realization quality stays '
          + 'historical');
    } else if (scored.length > 0) {
      push('historical-realization-quality', 'LIMITED',
        `${String(scored.length)} alternatives carry governed `
          + 'historical trade-off decompositions but no preferred '
          + 'alternative is scored');
    } else {
      push('historical-realization-quality', 'DEFICIENT',
        'no alternative carries a governed realization decomposition');
    }
  }

  // 6. stability — explicit, never probability.
  {
    const stability = context.stabilityState;
    if (stability === 'STABLE') {
      push('stability', 'SATISFIED',
        'governed stability is STABLE — explicit information, never a '
          + 'persistence claim');
    } else if (stability === 'MODERATELY_STABLE') {
      push('stability', 'LIMITED',
        'governed stability is MODERATELY_STABLE — carried as an '
          + 'explicit limitation');
    } else {
      push('stability', 'DEFICIENT',
        `governed stability is ${String(stability)} — no future `
          + 'persistence is invented');
    }
  }

  // 7. freshness — explicit, unknown never fresh.
  {
    const freshness = context.freshnessState;
    if (freshness === 'FRESH') {
      push('freshness', 'SATISFIED',
        'governed freshness is FRESH');
    } else if (freshness === 'AGING') {
      push('freshness', 'LIMITED',
        'governed freshness is AGING — carried as an explicit '
          + 'limitation');
    } else {
      push('freshness', 'DEFICIENT',
        `governed freshness is ${String(freshness)} — unknown is `
          + 'never silently fresh and stale follows the governed '
          + 'policy');
    }
  }

  // 8–10. regime/strategy/venue compatibility.
  {
    const dependencies = intentResult.dependencies;
    push('regime-compatibility',
      dependencies.regimeDependency === true ? 'LIMITED'
        : dependencies.regimeDependency === null ? 'DEFICIENT'
          : 'SATISFIED',
      dependencies.regimeDependency === true
        ? `the intent is regime-dependent — evaluation is valid only `
          + `inside the applicable regimes `
          + `(${dependencies.applicableRegimes.join(', ')})`
        : 'no regime dependency is identified');
    push('strategy-compatibility',
      dependencies.strategyDependency === true ? 'LIMITED'
        : dependencies.strategyDependency === null ? 'DEFICIENT'
          : 'SATISFIED',
      dependencies.strategyDependency === true
        ? `the intent is strategy-dependent — evaluation is valid only `
          + `for the applicable strategies `
          + `(${dependencies.applicableStrategies.join(', ')})`
        : 'no strategy dependency is identified');
    push('venue-compatibility',
      dependencies.venueDependency === true ? 'LIMITED'
        : dependencies.venueDependency === null ? 'DEFICIENT'
          : 'SATISFIED',
      dependencies.venueDependency === true
        ? `the intent is venue-dependent — evaluation is valid only at `
          + `the applicable venues `
          + `(${dependencies.applicableVenues.join(', ')})`
        : 'no venue dependency is identified');
  }

  // 11. leakage-exposure — leakage stays visible, never hidden.
  {
    const leakage = intentResult.restrictions.some((r) =>
      r.code === 'LEAKAGE_WARNING');
    push('leakage-exposure', leakage ? 'LIMITED' : 'SATISFIED',
      leakage
        ? 'the intent carries an explicit LEAKAGE_WARNING — apparent '
          + 'and leakage-adjusted quality stay distinct'
        : 'no leakage warning is carried by the intent');
  }

  // 12. sample-adequacy.
  {
    const adequacy = context.sampleAdequacy;
    if (adequacy === 'SUFFICIENT') {
      push('sample-adequacy', 'SATISFIED',
        'the governed sample adequacy is SUFFICIENT');
    } else if (adequacy === 'LIMITED') {
      push('sample-adequacy', 'LIMITED',
        'the governed sample adequacy is LIMITED');
    } else {
      push('sample-adequacy', 'DEFICIENT',
        `the governed sample adequacy is ${String(adequacy)}`);
    }
  }

  // 13. comparability.
  {
    const comparability = context.comparability;
    if (comparability === 'COMPARABLE') {
      push('comparability', 'SATISFIED',
        'the intent is comparable inside its domain');
    } else if (comparability === 'COMPARABLE_VIA_NORMALIZATION') {
      push('comparability', 'LIMITED',
        'comparison is valid only through the explicit, versioned, '
          + 'loss-declared normalization — never inferred');
    } else {
      push('comparability', 'DEFICIENT',
        'the intent is not comparable — raw cross-domain comparison is '
          + 'structurally impossible');
    }
  }

  // 14. restriction-burden.
  {
    const nonBaseline = intentResult.restrictions.filter((r) =>
      !['ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
        'NO_AEGIS_AUTHORIZATION', 'LIMITED_TO_DOMAIN']
        .includes(r.code)).length;
    const state: EvaluationDimensionState = nonBaseline === 0
      ? 'SATISFIED'
      : nonBaseline < config.heavyRestrictionThreshold
        ? 'LIMITED' : 'DEFICIENT';
    push('restriction-burden', state,
      `${String(intentResult.restrictions.length)} restrictions are `
        + `carried verbatim (${String(nonBaseline)} beyond the `
        + 'informational baseline) — never weakened, every code '
        + 'visible to the downstream consumer');
  }

  // 15. dependency-completeness.
  {
    const dependencies = intentResult.dependencies;
    if (dependencies.state === 'NONE') {
      push('dependency-completeness', 'SATISFIED',
        'the intent is independent — historical evidence, governance '
          + 'policy and provenance dependencies are all identified');
    } else if (dependencies.state === 'UNKNOWN') {
      push('dependency-completeness', 'DEFICIENT',
        'the dependency state is UNKNOWN — missing dependency '
          + 'information');
    } else {
      push('dependency-completeness', 'LIMITED',
        `dependency state ${dependencies.state} is preserved with its `
          + 'applicable contexts — historical evidence, governance '
          + 'policy and provenance dependencies are identified');
    }
  }

  // 16. policy-compatibility.
  push('policy-compatibility', 'SATISFIED',
    `the intent was produced under the governed policies `
      + `(governance ${intent.provenance.sourceVersions
        .governancePolicyVersion}, intent `
      + `policy versions pinned in provenance) — this evaluation adds `
      + `no policy and overrides nothing`);

  // 17. portfolio-interface-compatibility.
  push('portfolio-interface-compatibility',
    input.portfolioCompatible ? 'SATISFIED' : 'DEFICIENT',
    input.portfolioCompatible
      ? `structurally compatible with the existing downstream `
        + `${String(context.domain)} decision plane — the plane `
        + 'decides, this bridge never allocates'
      : 'not structurally compatible with the downstream plane');

  // 18. authority-compliance.
  push('authority-compliance', 'SATISFIED',
    'the evaluation mutates no Portfolio, Risk, Allocation, Strategy, '
      + 'AEGIS, Treasury, Execution, OIIN, Research or Learning state '
      + 'and accesses no provider credentials — the analytical bridge '
      + 'boundary is respected');

  // Exactly eighteen dimensions, canonical order, no duplicates.
  const names = dimensions.map((dimension) => dimension.dimension);
  if (names.length !== 18
    || names.join('|') !== EVALUATION_DIMENSION_NAMES.join('|')) {
    throw new Error('strategy-intent-evaluation: dimension battery is '
      + 'not the canonical eighteen — fail closed');
  }
  return Object.freeze(dimensions);
}
