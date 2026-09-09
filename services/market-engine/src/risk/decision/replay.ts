import {AllocationCandidate, AllocationDecision} from '../../allocation/optimizer';
import {PortfolioRiskContext, RiskDecision, RiskDecisionResult, RiskBudget} from './types';
import {RiskConfig} from './config';
import {buildRiskDecision} from './decision';
import {RiskAssessorEngine} from './engine';
import {riskCanonical} from './ids';

/**
 * Deterministic risk replay. Given identical (allocation input, portfolio
 * snapshot, risk config, stress config, control state) it reproduces the exact
 * decisionId, risk score, approved capital, risk state, stress results and
 * fingerprint. Replay runs in a fresh isolated engine and never mutates live
 * state.
 */

export interface RiskReplayInput {
  readonly decisions: readonly AllocationDecision[];
  readonly candidates: Readonly<Record<string, AllocationCandidate>>;
  readonly portfolio: PortfolioRiskContext;
  readonly budget?: RiskBudget;
  readonly config?: RiskConfig;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly controlState?: string;
}

export interface RiskReplayComparison {
  readonly match: boolean;
  readonly decisionIdsMatch: boolean;
  readonly fingerprintsMatch: boolean;
  readonly scoresMatch: boolean;
  readonly approvedMatch: boolean;
  readonly statesMatch: boolean;
  readonly stressMatch: boolean;
  readonly mismatches: readonly string[];
}

export class RiskReplay {
  runLive(input: RiskReplayInput): RiskDecisionResult {
    return this.engine().assess(input);
  }

  runReplay(input: RiskReplayInput): RiskDecisionResult {
    // Fresh isolated engine; no live mutable state leaks in.
    return this.engine().assess(input);
  }

  compare(live: RiskDecisionResult, replay: RiskDecisionResult): RiskReplayComparison {
    const mismatches: string[] = [];
    const decisionIdsMatch = riskCanonical(live.decisions.map((d) => d.riskDecisionId)) === riskCanonical(replay.decisions.map((d) => d.riskDecisionId));
    if (!decisionIdsMatch) mismatches.push('DECISION_IDS_DIVERGED');
    const fingerprintsMatch = riskCanonical(live.decisions.map((d) => d.fingerprint)) === riskCanonical(replay.decisions.map((d) => d.fingerprint));
    if (!fingerprintsMatch) mismatches.push('FINGERPRINTS_DIVERGED');
    const scoresMatch = riskCanonical(live.decisions.map((d) => d.riskScore)) === riskCanonical(replay.decisions.map((d) => d.riskScore));
    if (!scoresMatch) mismatches.push('SCORES_DIVERGED');
    const approvedMatch = riskCanonical(live.decisions.map((d) => d.approvedCapital)) === riskCanonical(replay.decisions.map((d) => d.approvedCapital));
    if (!approvedMatch) mismatches.push('APPROVED_DIVERGED');
    const statesMatch = riskCanonical(live.decisions.map((d) => d.state)) === riskCanonical(replay.decisions.map((d) => d.state));
    if (!statesMatch) mismatches.push('STATES_DIVERGED');
    const stressMatch = riskCanonical(live.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`)) === riskCanonical(replay.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`));
    if (!stressMatch) mismatches.push('STRESS_DIVERGED');

    return Object.freeze({
      match: mismatches.length === 0,
      decisionIdsMatch,
      fingerprintsMatch,
      scoresMatch,
      approvedMatch,
      statesMatch,
      stressMatch,
      mismatches,
    });
  }

  private engine(): RiskAssessorEngine {
    return new RiskAssessorEngine();
  }
}
