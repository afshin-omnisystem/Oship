import {Opportunity} from '../../opportunity';
import {StrategySelection, StrategyCandidate, StrategyEvaluation} from './types';
import {StrategyDiscoveryEngine} from './engine';
import {SelectionContext} from './selection';
import {StrategyRegistry} from './registry';

/**
 * Deterministic strategy replay. Given identical (opportunity, portfolio, risk,
 * configuration, registry) it reproduces the exact candidate set, evaluations,
 * ranking, selection, rejection reasons and decision id. Replay runs in a fresh
 * isolated engine and never mutates live state.
 */

export interface StrategyReplayInput {
  readonly opportunity: Opportunity;
  readonly portfolioContext: import('./portfolio-awareness').PortfolioAwarenessContext;
  readonly availableCapital: number;
  readonly totalCapital: number;
  readonly config?: import('./engine').StrategyEngineConfig;
  readonly registry?: import('./registry').StrategyRegistry;
  readonly context?: Pick<SelectionContext, 'correlationId' | 'traceId' | 'timestamp'>;
}

export interface StrategyReplaySnapshot {
  readonly candidates: readonly StrategyCandidate[];
  readonly evaluations: readonly StrategyEvaluation[];
  readonly selection: StrategySelection;
}

export interface StrategyReplayComparison {
  readonly match: boolean;
  readonly candidatesMatch: boolean;
  readonly evaluationsMatch: boolean;
  readonly rankingMatch: boolean;
  readonly selectionMatch: boolean;
  readonly decisionIdMatch: boolean;
  readonly mismatches: readonly string[];
}

function canonical(v: unknown): string {
  return JSON.stringify(sortValue(v));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce((acc, k) => {
      acc[k] = sortValue(o[k]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return v;
}

export class StrategyReplayEngine {
  runLive(input: StrategyReplayInput): StrategyReplaySnapshot {
    return this.run(input);
  }

  runReplay(input: StrategyReplayInput): StrategyReplaySnapshot {
    // Fresh isolated engine + registry so no live state leaks in.
    const freshRegistry = input.registry ?? new StrategyRegistry();
    const engine = freshRegistry.engine(input.config);
    return this.runFromEngine(engine, input);
  }

  private run(input: StrategyReplayInput): StrategyReplaySnapshot {
    const registry = input.registry ?? new StrategyRegistry();
    const engine = registry.engine(input.config);
    return this.runFromEngine(engine, input);
  }

  private runFromEngine(engine: StrategyDiscoveryEngine, input: StrategyReplayInput): StrategyReplaySnapshot {
    const result = engine.discover({
      opportunity: input.opportunity,
      portfolioContext: input.portfolioContext,
      availableCapital: input.availableCapital,
      totalCapital: input.totalCapital,
      correlationId: input.context?.correlationId ?? 'replay',
      traceId: input.context?.traceId ?? 'replay-trace',
      timestamp: input.context?.timestamp ?? input.opportunity.observedAt,
    });
    return Object.freeze({
      candidates: result.candidates,
      evaluations: result.evaluated,
      selection: result.selection,
    });
  }
}

export class StrategyReplay {
  constructor(private readonly engine = new StrategyReplayEngine()) {}

  runLive(input: StrategyReplayInput): StrategyReplaySnapshot {
    return this.engine.runLive(input);
  }

  runReplay(input: StrategyReplayInput): StrategyReplaySnapshot {
    return this.engine.runReplay(input);
  }

  compare(live: StrategyReplaySnapshot, replay: StrategyReplaySnapshot): StrategyReplayComparison {
    const mismatches: string[] = [];

    const candidatesMatch = canonical(live.candidates) === canonical(replay.candidates);
    if (!candidatesMatch) mismatches.push('CANDIDATES_DIVERGED');

    const evaluationsMatch = canonical(live.evaluations) === canonical(replay.evaluations);
    if (!evaluationsMatch) mismatches.push('EVALUATIONS_DIVERGED');

    const rankingMatch = canonical(live.selection.ranking) === canonical(replay.selection.ranking);
    if (!rankingMatch) mismatches.push('RANKING_DIVERGED');

    const selectionMatch = canonical(live.selection) === canonical(replay.selection);
    if (!selectionMatch) mismatches.push('SELECTION_DIVERGED');

    const decisionIdMatch = live.selection.decisionId === replay.selection.decisionId;
    if (!decisionIdMatch) mismatches.push('DECISION_ID_DIVERGED');

    return Object.freeze({
      match: mismatches.length === 0,
      candidatesMatch,
      evaluationsMatch,
      rankingMatch,
      selectionMatch,
      decisionIdMatch,
      mismatches,
    });
  }
}
