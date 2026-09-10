import type {
  ClosedLoopRecord, ControlAttribution, ActionOccurrence, ClosedLoopAction,
} from './types';
import {controlAttributionId, derived, unavailable} from './ids';
import {CLOSED_LOOP_ACTIONS} from './types';

/**
 * SPRINT 035 — control attribution (§12).
 *
 * Consumes Sprint 033 Control Sessions: for each adaptive action — CONTINUE,
 * WAIT, REPRICE, RESLICE, REROUTE, REPLAN, ABORT, COMPLETE — occurrence
 * count, trigger, pre/post-action quality, value/cost deltas, completion
 * impact and whether the action improved or degraded the outcome. The
 * Control Plane itself is never changed.
 */

const CONTROL_ACTION_SET: readonly string[] = Object.freeze([
  'CONTINUE', 'WAIT', 'REPRICE', 'RESLICE', 'REROUTE', 'REPLAN', 'ABORT', 'COMPLETE',
]);

export function controlAttribution(record: ClosedLoopRecord): ControlAttribution {
  const o = record.opportunity;
  const session = record.session.session;
  const cycles = [...session.cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);

  const occurrences: ActionOccurrence[] = [];
  const counts = {} as Record<ClosedLoopAction, number>;
  for (const a of CLOSED_LOOP_ACTIONS) counts[a] = 0;

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    const action = cycle.action as ClosedLoopAction;
    if (!CONTROL_ACTION_SET.includes(action)) continue;
    counts[action] += 1;

    const pre = i > 0 ? cycles[i - 1].quality.score : null;
    const post = cycle.quality.score;
    const qualityDelta = pre !== null ? post - pre : null;

    // Monetary deltas are only honest at the cycle-resolution the telemetry
    // provides: cycle fees as cost delta, and price-based value movement as a
    // DERIVED quality-proportional estimate — never fabricated precision.
    const costDelta = derived(cycle.telemetry.fees, `cycle ${cycle.cycleNumber} fees (measured)`);
    const valueDelta = pre !== null
      ? derived(qualityDelta!, 'post−pre quality delta (quality-resolution value proxy)', true)
      : unavailable<number>('control.valueDelta', 'no prior cycle for baseline');

    const next = cycles[i + 1] ?? null;
    const completionImpact = action === 'COMPLETE' ? 1
      : action === 'ABORT' ? -1
        : next && next.action === 'COMPLETE' ? 1
          : 0;
    const improved = qualityDelta === null ? null : qualityDelta >= 0;

    occurrences.push(Object.freeze({
      action,
      cycleNumber: cycle.cycleNumber,
      cycleId: cycle.cycleId,
      trigger: cycle.decision.reason,
      preActionQuality: pre,
      postActionQuality: post,
      qualityDelta,
      valueDelta,
      costDelta,
      completionImpact,
      improved,
    }));
  }

  const adaptive = occurrences.filter((occ) =>
    occ.action === 'REPRICE' || occ.action === 'RESLICE' || occ.action === 'REROUTE' || occ.action === 'REPLAN');
  const adaptiveActionImprovements = adaptive.filter((occ) => occ.improved === true).length;
  const adaptiveActionDegradations = adaptive.filter((occ) => occ.improved === false).length;

  const fr = session.finalResult;
  return Object.freeze({
    opportunityId: o.opportunityId,
    sessionId: session.sessionId,
    occurrences: Object.freeze(occurrences),
    actionCounts: Object.freeze({...counts}),
    cyclesExecuted: cycles.length,
    finalState: fr ? fr.finalState : 'UNKNOWN',
    adaptiveActionImprovements,
    adaptiveActionDegradations,
    fingerprint: controlAttributionId({
      id: o.opportunityId,
      session: session.sessionId,
      counts: occurrences.map((occ) => [occ.action, occ.cycleNumber]),
      finalState: fr ? fr.finalState : 'UNKNOWN',
    }),
  });
}
