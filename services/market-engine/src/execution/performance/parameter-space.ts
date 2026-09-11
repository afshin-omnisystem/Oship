import {ParameterDescriptor, ParameterSet} from './types';
import {parameterSetFingerprint} from './ids';
import type {ExecutionControlConfigSpec} from '../control/types';
import type {ControlConfigInput} from '../control/config';

/**
 * Sprint 034 — the deterministic optimization parameter space.
 *
 * Parameters are dotted paths into the Sprint 033 control configuration
 * (thresholds, budgets, hysteresis bands, quality thresholds). Safety-critical
 * paths (hard abort limits, fail-closed toggles, oscillation policy) are
 * PROTECTED: candidates may never modify them — the optimizer will not
 * generate them and candidate validation rejects them.
 *
 * Search methods are deterministic only: bounded grid enumeration and
 * coordinate search. No randomness, no ML.
 */

/**
 * Paths a candidate may NEVER touch: they encode fail-closed safety guards.
 * Trading them for performance is a regression-gate violation by definition.
 */
export const PROTECTED_PARAMETER_PATHS: readonly string[] = Object.freeze([
  'limits.maxSlippageBps',
  'limits.maxImpactNotional',
  'limits.maxLatencyMs',
  'abortOnAllVenuesStale',
  'oscillation.onDetection',
  'oscillation.detectionWindow',
]);

/** The canonical optimizable parameter space (bounded, gridded). */
export const DEFAULT_PARAMETER_SPACE: readonly ParameterDescriptor[] = Object.freeze([
  {path: 'adaptive.thresholds.repriceThresholdBps', name: 'price deviation threshold', kind: 'THRESHOLD', min: 5, max: 30, step: 5, unit: 'bps'},
  {path: 'adaptive.thresholds.resliceThreshold', name: 'reslice threshold', kind: 'THRESHOLD', min: 0.5, max: 0.9, step: 0.1, unit: 'fillRatio'},
  {path: 'adaptive.thresholds.rerouteThreshold', name: 'reroute advantage threshold', kind: 'THRESHOLD', min: 0.05, max: 0.25, step: 0.05, unit: 'score'},
  {path: 'adaptive.thresholds.replanThreshold', name: 'replan quality threshold', kind: 'THRESHOLD', min: 0.25, max: 0.55, step: 0.1, unit: 'score'},
  {path: 'adaptive.thresholds.maxLatencyMs', name: 'latency signal threshold', kind: 'THRESHOLD', min: 250, max: 1_250, step: 250, unit: 'ms'},
  {path: 'adaptive.thresholds.maxOrderAgeMs', name: 'aging threshold', kind: 'THRESHOLD', min: 3_000, max: 15_000, step: 3_000, unit: 'ms'},
  {path: 'hysteresis.sameActionCooldownCycles', name: 'same-action cooldown', kind: 'HYSTERESIS', min: 0, max: 2, step: 1, unit: 'cycles'},
  {path: 'hysteresis.qualityHighThreshold', name: 'high-quality band threshold', kind: 'HYSTERESIS', min: 0.8, max: 0.95, step: 0.05, unit: 'score'},
  {path: 'budgets.maxReslices', name: 'reslice action budget', kind: 'BUDGET', min: 1, max: 4, step: 1, unit: 'count'},
  {path: 'budgets.maxReprices', name: 'reprice action budget', kind: 'BUDGET', min: 1, max: 4, step: 1, unit: 'count'},
  {path: 'budgets.maxCycles', name: 'cycle budget', kind: 'BUDGET', min: 4, max: 12, step: 2, unit: 'cycles'},
]);

/** Validate a parameter space (bounds, step, no protected paths). */
export function validateParameterSpace(space: readonly ParameterDescriptor[]): readonly string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const d of space) {
    if (seen.has(d.path)) errs.push(`duplicate parameter path ${d.path}`);
    seen.add(d.path);
    if (!(d.min <= d.max)) errs.push(`${d.path}: min ${d.min} > max ${d.max}`);
    if (!(d.step > 0)) errs.push(`${d.path}: step must be > 0`);
    if (PROTECTED_PARAMETER_PATHS.includes(d.path)) errs.push(`${d.path} is protected and may not be optimized`);
  }
  return Object.freeze(errs);
}

/** All grid values of one descriptor, in deterministic ascending order. */
export function gridValues(d: ParameterDescriptor): readonly number[] {
  const values: number[] = [];
  for (let v = d.min; v <= d.max + 1e-9; v += d.step) {
    values.push(Math.round(v * 1e8) / 1e8);
  }
  return Object.freeze(values);
}

/** Deterministically enumerate the full (bounded) grid of a space. */
export function enumerateGrid(space: readonly ParameterDescriptor[]): readonly ParameterSet[] {
  if (space.length === 0) return Object.freeze([]);
  let sets: {path: string; value: number}[][] = [[]];
  for (const d of space) {
    const next: {path: string; value: number}[][] = [];
    for (const base of sets) {
      for (const v of gridValues(d)) next.push([...base, {path: d.path, value: v}]);
    }
    sets = next;
  }
  return Object.freeze(sets.map((entries) => buildParameterSet(entries)));
}

/** Build an immutable, fingerprinted parameter set. */
export function buildParameterSet(entries: readonly {path: string; value: number}[]): ParameterSet {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const unique = new Map<string, number>();
  for (const e of sorted) unique.set(e.path, e.value);
  const canonical = [...unique.entries()].map(([path, value]) => Object.freeze({path, value}));
  return Object.freeze({
    entries: Object.freeze(canonical),
    fingerprint: parameterSetFingerprint(canonical),
  });
}

/** Whether a parameter set only touches known, unprotected paths in-range. */
export function parameterSetIsValid(space: readonly ParameterDescriptor[], set: ParameterSet): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  const byPath = new Map(space.map((d) => [d.path, d]));
  for (const e of set.entries) {
    const d = byPath.get(e.path);
    if (PROTECTED_PARAMETER_PATHS.includes(e.path)) {
      violations.push(`${e.path} is a protected safety path — candidates may never modify it`);
      continue;
    }
    if (!d) {
      violations.push(`${e.path} is not part of the declared parameter space`);
      continue;
    }
    if (e.value < d.min - 1e-9 || e.value > d.max + 1e-9) {
      violations.push(`${e.path}=${e.value} outside bounds [${d.min}, ${d.max}]`);
    }
    const onGrid = gridValues(d).some((v) => Math.abs(v - e.value) < 1e-9);
    if (!onGrid) violations.push(`${e.path}=${e.value} is not on the deterministic grid (step ${d.step})`);
  }
  return Object.freeze({valid: violations.length === 0, violations: Object.freeze(violations)});
}

/**
 * Apply a parameter set to a control configuration, producing the candidate's
 * ControlConfigInput. Mechanical (works on any path — protection is enforced
 * by validation, not by this function).
 */
export function applyParameterSet(base: ExecutionControlConfigSpec, set: ParameterSet): ControlConfigInput {
  let config: Record<string, unknown> = deepClonePlain(base);
  for (const e of set.entries) {
    config = setPath(config, e.path.split('.'), e.value);
  }
  return config as ControlConfigInput;
}

/** The control configuration fingerprint changes iff parameters change. */
export function parameterSetChangesConfig(base: ExecutionControlConfigSpec, set: ParameterSet, fingerprintOf: (c: unknown) => string): boolean {
  return fingerprintOf(applyParameterSet(base, set)) !== fingerprintOf(base);
}

function deepClonePlain(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function setPath(target: Record<string, unknown>, path: readonly string[], value: number): Record<string, unknown> {
  const [head, ...rest] = path;
  const clone: Record<string, unknown> = {...target};
  if (rest.length === 0) {
    clone[head] = value;
    return clone;
  }
  const child = (typeof clone[head] === 'object' && clone[head] !== null ? clone[head] : {}) as Record<string, unknown>;
  clone[head] = setPath(child, rest, value);
  return clone;
}
