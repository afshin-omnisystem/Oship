import type {ClosedLoopRecord, RiskAttribution, RiskImpactKind} from './types';
import {riskAttributionId, derived, unavailable, measured} from './ids';
import {safeDivide} from './source';

/**
 * SPRINT 035 — risk attribution (§10).
 *
 * Risk decisions can constrain or protect opportunity value. Risk-induced
 * leakage does NOT mean Risk was wrong: the attribution distinguishes
 * protective constraints, opportunity rejections, execution losses, market
 * movement and data uncertainty. Risk is NEVER scored solely by realized
 * profit.
 */

export function riskAttribution(record: ClosedLoopRecord): RiskAttribution {
  const o = record.opportunity;
  const alloc = record.allocation;
  const risk = record.risk;

  const scale = alloc.allocatedCapital > 0 && o.requiredCapital > 0
    ? Math.min(1, alloc.allocatedCapital / o.requiredCapital)
    : null;

  const theoreticalValueBeforeRisk = scale !== null
    ? o.netEdge * scale
    : o.netEdge;

  const approvedScale = alloc.allocatedCapital > 0
    ? Math.min(1, risk.approvedCapital / alloc.allocatedCapital)
    : 0;
  const theoreticalValueAfterRisk = theoreticalValueBeforeRisk * approvedScale;

  // Value shielded by Risk constraints from being put at risk.
  const protectedValue = derived(
    o.grossEdge * (scale ?? 1) * (1 - approvedScale),
    'grossEdge×scale×(1 − approved÷allocated) — value Risk kept out of harm',
  );

  const constrainedValue = Math.max(0, theoreticalValueBeforeRisk - theoreticalValueAfterRisk);
  const rejectedValue = risk.scale === 'BLOCKED' ? theoreticalValueBeforeRisk : 0;

  // Classify the risk impact honestly.
  let impactKind: RiskImpactKind;
  if (risk.scale === 'BLOCKED') {
    impactKind = 'OPPORTUNITY_REJECTION';
  } else if (risk.approvedCapital < alloc.allocatedCapital) {
    impactKind = 'PROTECTIVE_CONSTRAINT';
  } else if (risk.violations.some((v) => v.code === 'LOW_CONFIDENCE' || v.code === 'LIQUIDITY_INSUFFICIENT')) {
    impactKind = 'DATA_UNCERTAINTY';
  } else {
    impactKind = 'NO_CONSTRAINT';
  }

  const riskInducedLeakage = impactKind === 'OPPORTUNITY_REJECTION'
    ? measured(constrainedValue, 'risk blocked the opportunity entirely')
    : impactKind === 'PROTECTIVE_CONSTRAINT'
      ? derived(constrainedValue, 'value constrained by reduced approval — protective, not a mistake')
      : unavailable<number>('risk.leakage', 'no risk-induced value change detected');

  // The boundary is preserved when the risk decision never exceeded the
  // allocation and never silently approved more than requested.
  const riskPreservedBoundary =
    risk.approvedCapital <= alloc.allocatedCapital + 1e-9 &&
    risk.approvedCapital <= risk.requestedCapital + 1e-9 &&
    risk.blockedCapital >= 0;

  return Object.freeze({
    opportunityId: o.opportunityId,
    theoreticalValueBeforeRisk,
    theoreticalValueAfterRisk,
    protectedValue,
    constrainedValue,
    rejectedValue,
    riskInducedLeakage,
    impactKind,
    riskPreservedBoundary,
    riskScore: risk.riskScore,
    violations: risk.violations.map((v) => v.code),
    fingerprint: riskAttributionId({
      id: o.opportunityId,
      before: theoreticalValueBeforeRisk,
      after: theoreticalValueAfterRisk,
      scale: risk.scale,
      impactKind,
      approved: risk.approvedCapital,
      allocated: alloc.allocatedCapital,
      riskScore: risk.riskScore,
      violations: risk.violations.map((v) => v.code),
    }),
  });
}

export {safeDivide};
