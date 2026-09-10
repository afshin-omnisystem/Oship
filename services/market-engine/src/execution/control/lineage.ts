import {ExecutionPlan} from './types';

/**
 * Sprint 033 — execution plan lineage.
 *
 * Parent plans are immutable: every revision creates a NEW plan (v1 → v2 →
 * v3 …) linked to its parent. Execution history is never overwritten or
 * dropped — the lineage is an append-only chain from the root plan.
 */

export interface LineageView {
  readonly plans: readonly ExecutionPlan[];
  readonly versions: readonly {executionPlanId: string; version: number; parentPlanId: string | null}[];
  /** plan-v1 → plan-v2 → plan-v3 … */
  readonly chain: string;
}

export function initialLineage(root: ExecutionPlan): LineageView {
  return Object.freeze({
    plans: Object.freeze([root]),
    versions: Object.freeze([Object.freeze({
      executionPlanId: root.executionPlanId,
      version: root.version,
      parentPlanId: root.parentPlanId ?? null,
    })]),
    chain: `${root.executionPlanId}`,
  });
}

/**
 * Append a revised plan to the lineage. Fails closed if the revision breaks
 * the chain (wrong parent, duplicate id, or version not increasing).
 */
export function appendLineage(lineage: LineageView, revised: ExecutionPlan): LineageView {
  const head = lineage.plans[lineage.plans.length - 1];
  if (head.executionPlanId === revised.executionPlanId) {
    throw new Error(`lineage violation: revision reuses plan id ${revised.executionPlanId}`);
  }
  if (revised.parentPlanId !== null && revised.parentPlanId !== head.executionPlanId) {
    throw new Error(`lineage violation: revision parent ${revised.parentPlanId} is not the current head ${head.executionPlanId}`);
  }
  if (revised.version <= head.version) {
    throw new Error(`lineage violation: version ${revised.version} does not increase past ${head.version}`);
  }
  const totalBefore = totalQuantity(head);
  const totalAfter = totalQuantity(revised);
  // Total target quantity is never silently altered by a revision: the sum of
  // route quantities may only shrink by exactly the filled amount (checked by
  // the caller against telemetry; here we assert the plan-level invariant that
  // a revision never INCREASES the planned total).
  if (totalAfter > totalBefore + 1e-6) {
    throw new Error(`lineage violation: planned quantity increased ${totalBefore} → ${totalAfter}`);
  }
  return Object.freeze({
    plans: Object.freeze([...lineage.plans, revised]),
    versions: Object.freeze([...lineage.versions, Object.freeze({
      executionPlanId: revised.executionPlanId,
      version: revised.version,
      parentPlanId: revised.parentPlanId ?? null,
    })]),
    chain: `${lineage.chain} → ${revised.executionPlanId}`,
  });
}

export function totalQuantity(plan: ExecutionPlan): number {
  return plan.routes.reduce((s, r) => s + r.quantity, 0);
}

/** The current head of the lineage (the active plan). */
export function lineageHead(lineage: LineageView): ExecutionPlan {
  return lineage.plans[lineage.plans.length - 1];
}

/**
 * Quantity preservation across the lineage: for every revision,
 *   planned(parent) == filled(revision boundary) + planned(child).
 */
export function quantityPreservedAcrossRevisions(
  lineage: LineageView,
  filledAtRevision: readonly number[],
): {ok: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  for (let i = 0; i < lineage.plans.length - 1; i++) {
    const parent = lineage.plans[i];
    const child = lineage.plans[i + 1];
    const filled = filledAtRevision[i] ?? 0;
    const expected = Math.max(0, round8(totalQuantity(parent) - filled));
    const actual = totalQuantity(child);
    if (Math.abs(actual - expected) > 1e-6) {
      violations.push(
        `revision ${i + 1}: parent planned ${totalQuantity(parent)}, filled ${filled}, child planned ${actual} (expected ${expected})`,
      );
    }
  }
  return Object.freeze({ok: violations.length === 0, violations: Object.freeze(violations)});
}

function round8(x: number): number {
  return Math.round(x * 1e8) / 1e8;
}
