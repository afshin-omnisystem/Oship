import {
  ParameterDescriptor, ParameterSet, OptimizationMethod, ObjectiveFunction,
} from './types';
import {buildParameterSet} from './parameter-space';
import {runCorpusArm, runArmsFromPrecomputed, SimulationArmsResult, CorpusEntry} from './simulation-gate';
import {aggregateCorpus} from './metrics';
import type {ExecutionControlConfigSpec} from '../control/types';
import type {ControlConfigInput} from '../control/config';
import {applyParameterSet, validateParameterSpace, gridValues, enumerateGrid} from './parameter-space';

/**
 * Sprint 034 — the deterministic parameter optimizer.
 *
 * Two search methods, both fully deterministic:
 *   COORDINATE — sweep one parameter at a time over its grid, keep the best
 *                value, proceed to the next parameter (coordinate search).
 *   GRID       — bounded exhaustive enumeration of the full grid (refuses to
 *                run when the combination count exceeds the bound).
 *
 * Every evaluation runs BOTH arms (baseline vs candidate) of the simulation
 * gate on the identical corpus, so scores are always directly comparable.
 * No randomness, no ML, no gradient heuristics.
 */

export interface OptimizationOutcome {
  readonly method: OptimizationMethod;
  readonly objective: ObjectiveFunction;
  readonly baselineParameters: ParameterSet;
  readonly baselineScore: number;
  readonly evaluated: readonly {readonly parameters: ParameterSet; readonly score: number}[];
  readonly best: ParameterSet | null;
  readonly bestScore: number | null;
  /** The winning arms (baseline + candidate sessions) — reused by the gates. */
  readonly bestArms: SimulationArmsResult | null;
  readonly searchTrace: readonly string[];
}

/** Maximum grid combinations the exhaustive method will enumerate. */
export const MAX_GRID_COMBINATIONS = 256;

/** Read a dotted numeric path from the control configuration. */
export function getPathValue(config: ExecutionControlConfigSpec, path: string): number {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node !== null && typeof node === 'object') {
      return (node as Record<string, unknown>)[key] ?? null;
    }
    return null;
  }, config as unknown);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`parameter path ${path} does not resolve to a finite number — fail closed`);
  }
  return value;
}

/** The current (baseline) values of every descriptor, as a parameter set. */
export function baselineParameterSet(config: ExecutionControlConfigSpec, space: readonly ParameterDescriptor[]): ParameterSet {
  return buildParameterSet(space.map((d) => ({path: d.path, value: getPathValue(config, d.path)})));
}

function withValue(set: ParameterSet, path: string, value: number): ParameterSet {
  return buildParameterSet([...set.entries.filter((e) => e.path !== path), {path, value}]);
}

export function optimize(input: {
  readonly corpus: readonly CorpusEntry[];
  readonly baselineConfig: ExecutionControlConfigSpec;
  readonly space: readonly ParameterDescriptor[];
  readonly objective: ObjectiveFunction;
  readonly method: OptimizationMethod;
}): OptimizationOutcome {
  const spaceErrors = validateParameterSpace(input.space);
  if (spaceErrors.length > 0) {
    throw new Error(`invalid parameter space: ${spaceErrors.join('; ')} — fail closed`);
  }
  if (input.method === 'GRID') {
    let combos = 1;
    for (const d of input.space) combos *= gridValues(d).length;
    if (combos > MAX_GRID_COMBINATIONS) {
      throw new Error(`grid of ${combos} combinations exceeds the bounded exhaustive limit ${MAX_GRID_COMBINATIONS} — fail closed`);
    }
  }
  const baselineParameters = baselineParameterSet(input.baselineConfig, input.space);

  // The baseline arm is input-identical for every evaluation — run it ONCE
  // and reuse it (determinism is preserved: the baseline sessions do not
  // depend on the candidate parameter set).
  const baselineArm = runCorpusArm(input.corpus, input.baselineConfig, 'performance-sim-baseline');

  const evaluate = (set: ParameterSet): {score: number; arms: SimulationArmsResult} => {
    const candidateArm = runCorpusArm(input.corpus, applyParameterSet(input.baselineConfig, set), 'performance-sim-candidate');
    const arms = runArmsFromPrecomputed(input.corpus, baselineArm, candidateArm, `candidate:${set.fingerprint.slice(0, 12)}`, input.objective);
    return {score: arms.comparison.candidate.objectiveScore, arms};
  };

  const evaluated: {parameters: ParameterSet; score: number}[] = [];
  const trace: string[] = [];
  const baselineScore = aggregateCorpus(baselineArm.metrics, input.objective).objectiveScore;
  evaluated.push({parameters: baselineParameters, score: baselineScore});
  trace.push(`baseline ${baselineParameters.fingerprint.slice(0, 16)} scores ${baselineScore.toFixed(6)}`);

  let best = baselineParameters;
  let bestScore = baselineScore;
  let bestArms: SimulationArmsResult | null = null;

  if (input.method === 'GRID') {
    for (const set of enumerateGrid(input.space)) {
      if (set.fingerprint === baselineParameters.fingerprint) continue;
      const {score, arms} = evaluate(set);
      evaluated.push({parameters: set, score});
      if (score > bestScore + 1e-12) { best = set; bestScore = score; bestArms = arms; }
    }
    trace.push(`GRID enumerated ${evaluated.length} set(s); best ${bestScore.toFixed(6)}`);
  } else {
    // COORDINATE: sweep each parameter over its grid, keep improvements.
    for (const d of input.space) {
      const current = (best.entries.find((e) => e.path === d.path)?.value ?? getPathValue(input.baselineConfig, d.path));
      let localBest = current;
      let localBestScore = bestScore;
      let localBestArms: SimulationArmsResult | null = null;
      for (const v of gridValues(d)) {
        if (Math.abs(v - current) < 1e-12) continue;
        const set = withValue(best, d.path, v);
        const {score, arms} = evaluate(set);
        evaluated.push({parameters: set, score});
        if (score > localBestScore + 1e-12) { localBest = v; localBestScore = score; localBestArms = arms; }
      }
      if (Math.abs(localBest - current) >= 1e-12) {
        best = withValue(best, d.path, localBest);
        bestScore = localBestScore;
        bestArms = localBestArms;
        trace.push(`${d.path}: ${current} → ${localBest} (score ${localBestScore.toFixed(6)})`);
      } else {
        trace.push(`${d.path}: kept ${current}`);
      }
    }
    trace.push(`COORDINATE evaluated ${evaluated.length} set(s); best ${bestScore.toFixed(6)}`);
  }

  const improved = bestScore > baselineScore + 1e-12;
  return Object.freeze({
    method: input.method,
    objective: input.objective,
    baselineParameters,
    baselineScore,
    evaluated: Object.freeze(evaluated),
    best: improved ? best : null,
    bestScore: improved ? bestScore : null,
    bestArms: improved ? bestArms : null,
    searchTrace: Object.freeze(trace),
  });
}

export type {ControlConfigInput};
