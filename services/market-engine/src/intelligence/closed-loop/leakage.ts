import type {ClosedLoopRecord, LeakageDecomposition, LeakageComponent, LeakageComponentName,} from './types';
import {LEAKAGE_COMPONENTS} from './types';
import {leakageFingerprint, measured, derived, estimated, unavailable} from './ids';
import type {ClosedLoopProvenance} from './types';
import type {ClosedLoopConfigSpec} from './config';
import {theoreticalValueModel, realizedComponents} from './value';
import {riskAttribution} from './risk';
import {recordSessionView} from './performance';
import {strategyAttribution} from './strategy';
import {venueAttribution} from './venue-attribution';

/**
 * SPRINT 035 — canonical value leakage decomposition (§15).
 *
 * totalLeakage = theoreticalNetEdge(at scale) − realizedNetValue, decomposed
 * into 17 canonical components. Every component carries provenance; the sum
 * reconciles exactly by construction (RESIDUAL_UNATTRIBUTED is the explicitly
 * reported remainder). Unavailable inputs produce UNAVAILABLE components —
 * never fabricated values.
 */

export function leakageDecomposition(
  record: ClosedLoopRecord, config: ClosedLoopConfigSpec,
): LeakageDecomposition {
  const o = record.opportunity;
  const theoretical = theoreticalValueModel(record);
  const realized = realizedComponents(record);
  const view = recordSessionView(record);
  const risk = riskAttribution(record);
  const strategy = strategyAttribution(record);
  const venue = venueAttribution(record);

  const theoreticalNet = theoretical.theoreticalNetEdge.value;
  const realizedNet = realized.realizedNetValue.value;
  const attribution = view.attribution;

  const component = (name: string): {value: number; available: boolean} => {
    const c = attribution?.components.find((x) => x.component === name);
    return {value: c && c.available ? c.value : 0, available: !!c && c.available};
  };

  const components: LeakageComponent[] = [];
  const add = (
    name: LeakageComponentName, value: number, provenance: ClosedLoopProvenance,
    source: string, available: boolean, detail: string,
  ): void => {
    components.push(Object.freeze({
      component: name,
      value,
      provenance: available ? provenance : 'UNAVAILABLE',
      source,
      available,
      detail: available ? detail : `${detail} — UNAVAILABLE (never fabricated)`,
      fingerprint: `${name}:${value}:${provenance}`,
    }));
  };

  // 1. Opportunity decay: value lost between observation and execution start,
  //    proxied deterministically by discovery freshness.
  const freshness = o.freshness;
  const grossAtScale = theoretical.theoreticalGrossEdge.value;
  const decayAvailable = grossAtScale !== null;
  add('OPPORTUNITY_DECAY',
    decayAvailable ? Math.max(0, grossAtScale * (1 - freshness)) : 0,
    'DERIVED', 'grossEdgeAtScale × (1 − freshness)',
    decayAvailable, `freshness ${freshness.toFixed(4)}`);

  // 2. Stale information: extra flag when freshness is below the stale band.
  const stale = freshness < config.staleFreshnessThreshold;
  add('STALE_INFORMATION',
    decayAvailable && stale ? grossAtScale * 0.01 : 0,
    'ESTIMATED', 'stale-data penalty (1% of gross at scale when below stale band)',
    decayAvailable, stale ? 'freshness below stale threshold' : 'freshness acceptable');

  // 3. Strategy leakage: value the strategy left on the table at decision time.
  add('STRATEGY_LEAKAGE',
    strategy.strategyLeakage.value ?? 0, 'DERIVED',
    'theoreticalNetAtScale − strategyExpectedValue',
    strategy.strategyLeakage.value !== null, `strategy ${strategy.strategyId}`);

  // 4. Allocation leakage: theoretical edge not deployable due to capital shortfall.
  const scale = theoretical.capitalScale.value;
  add('ALLOCATION_LEAKAGE',
    scale !== null ? Math.max(0, o.grossEdge * (1 - scale)) : 0,
    'DERIVED', 'grossEdge × (1 − capitalScale)',
    scale !== null, scale !== null ? `capitalScale ${scale.toFixed(4)}` : 'capital scale unavailable');

  // 5. Risk constraint: value constrained by the Risk boundary (protective).
  add('RISK_CONSTRAINT',
    risk.constrainedValue, 'DERIVED',
    'value constrained by reduced risk approval (protective, not a mistake)',
    risk.riskInducedLeakage.value !== null, `impact kind ${risk.impactKind}`);

  // 6. Venue leakage: shortfall vs the best observed venue.
  add('VENUE_LEAKAGE',
    venue.totalVenueLeakage.value ?? 0, 'DERIVED',
    'Σ shortfall vs best observed venue',
    venue.totalVenueLeakage.value !== null, `benchmark venue ${venue.benchmarkVenue ?? 'n/a'}`);

  // 7–12. Execution cost components from Sprint 034 attribution.
  const execNames: readonly [LeakageComponentName, string][] = [
    ['SPREAD_COST', 'SPREAD_COST'],
    ['FEES', 'FEES'],
    ['SLIPPAGE', 'SLIPPAGE'],
    ['MARKET_IMPACT', 'MARKET_IMPACT'],
    ['LATENCY_COST', 'LATENCY_COST'],
    ['PARTIAL_FILL_LEAKAGE', 'PARTIAL_FILL_COST'],
  ];
  for (const [leakName, perfName] of execNames) {
    const c = component(perfName);
    // The FEES leakage component reports the COST OVERRUN vs the estimate —
    // estimated fees were already subtracted inside theoreticalNetEdge.
    if (leakName === 'FEES') {
      const scaleKnown = scale;
      const estimatedFees = scaleKnown !== null
        ? (o.estimatedCosts.fees + o.estimatedCosts.latencyPenalty) * scaleKnown
        : null;
      const realizedFees = record.session.session.cycles.reduce((s, c2) => s + c2.telemetry.fees, 0);
      add('FEES',
        estimatedFees !== null ? Math.max(0, realizedFees - estimatedFees) : 0,
        'MEASURED', 'realized fees − estimated fees (at scale)',
        estimatedFees !== null, `realized ${realizedFees.toFixed(4)} vs estimated ${(estimatedFees ?? 0).toFixed(4)}`);
    } else if (leakName === 'PARTIAL_FILL_LEAKAGE') {
      // Sprint 034's PARTIAL_FILL_COST is the NOTIONAL of the unfilled
      // quantity (remaining × benchmark) — not an edge-dollar cost. The
      // honest edge-unit leakage is the gross edge at scale that was never
      // delivered: grossEdgeAtScale × (1 − fillCompletion).
      const completion = realized.fillCompletion;
      add('PARTIAL_FILL_LEAKAGE',
        decayAvailable ? Math.max(0, (grossAtScale ?? 0) * (1 - completion)) : 0,
        'DERIVED', 'grossEdgeAtScale × (1 − fillCompletion)',
        decayAvailable,
        `fillCompletion ${completion.toFixed(4)}${c.available ? `; Sprint 034 unfilled notional ${c.value} (notional, not edge cost)` : ''}`);
    } else if (leakName === 'MARKET_IMPACT') {
      // Sprint 034's MARKET_IMPACT is an impact NOTIONAL that overlaps the
      // slippage component by construction; its dollar effect is already
      // embedded in the realized prices counted inside realizedNetValue.
      // Copying it here would double-count a notional-scale figure as
      // edge-dollar leakage — so it is documented, never summed.
      add('MARKET_IMPACT', 0, 'DERIVED',
        '0 by construction — impact dollar effect is embedded in realized prices (overlaps SLIPPAGE)',
        true, `Sprint 034 impact notional ${c.value} documented, not double-counted`);
    } else {
      add(leakName, c.value, 'MEASURED', `Sprint 034 attribution ${perfName}`,
        c.available, c.available ? 'measured execution cost' : 'no Sprint 034 attribution');
    }
  }

  // 13. Adaptive action cost (reroute + reslice + reprice).
  const reroute = component('REROUTE_COST');
  const reslice = component('RESLICE_COST');
  const reprice = component('REPRICE_COST');
  const adaptiveAvailable = reroute.available || reslice.available || reprice.available;
  add('ADAPTIVE_ACTION_COST',
    reroute.value + reslice.value + reprice.value, 'MEASURED',
    'Sprint 034 attribution REROUTE+RESLICE+REPRICE costs',
    adaptiveAvailable, `${reroute.available ? '' : 'no '}reroute, ${reslice.available ? '' : 'no '}reslice, ${reprice.available ? '' : 'no '}reprice data`);

  // 14. Replan cost.
  const replan = component('REPLAN_COST');
  add('REPLAN_COST', replan.value, 'MEASURED', 'Sprint 034 attribution REPLAN_COST',
    replan.available, replan.available ? 'measured replan cost' : 'no replan data');

  // 15. Failure / recovery cost.
  const failure = component('FAILURE_RECOVERY_COST');
  add('FAILURE_RECOVERY_COST', failure.value, 'MEASURED',
    'Sprint 034 attribution FAILURE_RECOVERY_COST',
    failure.available, failure.available ? 'measured failure/recovery cost' : 'no failure data');

  // 16. Completion delay: deterministic penalty when execution outlasted the
  //     plan's time horizon (opportunity decayed while working).
  const cycles = record.session.session.cycles;
  const completionMs = cycles.length > 0
    ? Math.max(0, cycles[cycles.length - 1].completedAt - cycles[0].startedAt)
    : 0;
  const horizon = record.plan.timeHorizonMs > 0 ? record.plan.timeHorizonMs : null;
  const delayAvailable = horizon !== null && grossAtScale !== null;
  const delayOverHorizon = delayAvailable ? Math.max(0, completionMs - horizon!) / horizon! : 0;
  add('COMPLETION_DELAY',
    delayAvailable ? grossAtScale! * config.completionDelayPenalty * delayOverHorizon : 0,
    'ESTIMATED', 'grossAtScale × delayPenalty × (overrun ÷ horizon)',
    delayAvailable, `completion ${completionMs}ms vs horizon ${horizon ?? 'n/a'}ms`);

  // ---- total & residual ----------------------------------------------------
  const bothAvailable = theoreticalNet !== null && realizedNet !== null;
  const totalLeakage = bothAvailable ? theoreticalNet - realizedNet : 0;
  const named = LEAKAGE_COMPONENTS.filter((n) => n !== 'RESIDUAL_UNATTRIBUTED');
  const namedSum = components
    .filter((c) => c.component !== 'RESIDUAL_UNATTRIBUTED')
    .reduce((s, c) => s + c.value, 0);
  const residual = bothAvailable ? totalLeakage - namedSum : 0;

  add('RESIDUAL_UNATTRIBUTED', residual,
    bothAvailable ? 'DERIVED' : 'UNAVAILABLE',
    'totalLeakage − Σ named components (explicitly reported remainder)',
    bothAvailable, bothAvailable
      ? 'explicit remainder — kept visible, never hidden'
      : 'theoretical or realized net unavailable');

  const attributableTotal = components
    .filter((c) => c.available && c.component !== 'RESIDUAL_UNATTRIBUTED')
    .reduce((s, c) => s + c.value, 0);
  const unavailableList = components.filter((c) => !c.available).map((c) => c.component);
  // Reconciles when the available components plus the explicitly reported
  // residual explain the total leakage exactly. Unavailable components are
  // excluded from the attributable sum and land in the residual — reported,
  // never hidden, never fabricated.
  const reconciles = bothAvailable
    && Math.abs((attributableTotal + residual) - totalLeakage) <= Math.max(
      config.reconciliationTolerance, config.reconciliationTolerance * Math.max(1, Math.abs(totalLeakage)));

  return Object.freeze({
    opportunityId: o.opportunityId,
    components: Object.freeze(components),
    totalLeakage,
    attributableTotal,
    residual,
    reconciles,
    unavailable: Object.freeze(unavailableList),
    fingerprint: leakageFingerprint({
      id: o.opportunityId,
      components: components.map((c) => [c.component, c.value, c.provenance]),
      total: totalLeakage, residual,
    }),
  });
}

export {measured, derived, estimated, unavailable};
