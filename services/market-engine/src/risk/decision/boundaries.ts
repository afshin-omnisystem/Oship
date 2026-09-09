import {RiskDecision, RiskBoundaryResult} from './types';
import {sha256} from '../../oiin/ids';

/**
 * AEGIS / Treasury / Emergency-stop boundary for a risk decision.
 *
 * The risk engine produces a recommendation/decision only. AEGIS still
 * authorizes; Treasury still decides availability. The risk engine never
 * executes, never mutates Treasury, never calls a provider, and never bypasses
 * AEGIS.
 */

export function evaluateRiskAegis(decision: RiskDecision, aegisAllowed: boolean): RiskBoundaryResult {
  const approvedAmount = decision.approvedCapital;
  const scale = decision.scale;
  const blocked = decision.state === 'BLOCKED' || decision.state === 'RISK_BLOCKED' ||
    decision.state === 'LIQUIDITY_BLOCKED' || decision.state === 'CORRELATION_BLOCKED' ||
    decision.state === 'CONCENTRATION_BLOCKED' || decision.state === 'CAPITAL_BLOCKED';

  let status: RiskBoundaryResult['aegisStatus'];
  if (!aegisAllowed) status = 'BLOCKED';
  else if (blocked) status = 'BLOCKED';
  else if (scale === 'PARTIAL_APPROVAL' || scale === 'REDUCED') status = 'PARTIALLY_APPROVED';
  else status = 'APPROVED';

  const authorized = status !== 'BLOCKED';
  const tie = sha256({
    riskDecisionId: decision.riskDecisionId,
    status,
    approvedAmount,
    aegisAllowed,
  }).slice(0, 16);

  return Object.freeze({
    aegisStatus: status,
    treasuryAuthorizable: authorized,
    authorizedAmount: authorized ? approvedAmount : 0,
    reason: `${status}:${tie}`,
  });
}

export interface TreasuryAvailabilityInput {
  readonly authorizedAmount: number;
  readonly treasuryAvailable: number;
  readonly reserved: number;
}

/**
 * Treasury-authorization gate. The risk engine only reports whether the
 * proposed amount is coverable; Treasury remains authoritative and is never
 * touched here.
 */
export function riskTreasuryGate(input: TreasuryAvailabilityInput): {authorized: boolean; reason: string} {
  const spendable = Math.max(0, input.treasuryAvailable - input.reserved);
  if (input.authorizedAmount > spendable) return {authorized: false, reason: 'TREASURY_BLOCKED'};
  return {authorized: true, reason: 'authorized'};
}

/** Emergency-stop gate: EMERGENCY_STOP / HALTED => no approval can be issued. */
export function riskEmergencyGate(controlState: string): {canApprove: boolean; reason: string} {
  if (controlState === 'EMERGENCY_STOP' || controlState === 'HALTED') {
    return {canApprove: false, reason: 'EMERGENCY_STOP_ACTIVE'};
  }
  return {canApprove: true, reason: 'control_active'};
}
