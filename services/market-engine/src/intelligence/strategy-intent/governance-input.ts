/**
 * SPRINT 041 — governance-input extraction (§1).
 *
 * Extracts and validates the governed facts the intent synthesis consumes
 * from a validated Sprint-040 result. Read-only; nothing is re-derived or
 * second-guessed — Governance stays the Governance authority.
 */

import type {
  GovernanceResult, HandoffClassification, HandoffRestriction,
  HandoffRestrictionCode, ResearchEscalationKind,
} from '../governance/types';
import type {IntentRejectionCode} from './types';
import {IntentRejectionError} from './types';

/** The eight Sprint-040 handoff classifications (§4 of Sprint 040). */
const HANDOFF_CLASSIFICATIONS: readonly HandoffClassification[] =
  Object.freeze([
    'HANDOFF_ALLOWED', 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
    'HANDOFF_REQUIRES_RESEARCH', 'HANDOFF_BLOCKED',
    'HANDOFF_NOT_COMPARABLE', 'HANDOFF_CONFLICTED', 'HANDOFF_STALE',
    'HANDOFF_INSUFFICIENT_EVIDENCE',
  ]);

const GOVERNANCE_RESEARCH_KINDS: readonly ResearchEscalationKind[] =
  Object.freeze([
    'RESEARCH_REQUIRED', 'EVIDENCE_REFRESH_REQUIRED',
    'REGIME_COVERAGE_REQUIRED', 'STRATEGY_COVERAGE_REQUIRED',
    'VENUE_COVERAGE_REQUIRED', 'COMPARABILITY_REQUIRED',
    'LEAKAGE_INVESTIGATION_REQUIRED',
  ]);

export interface GovernanceFacts {
  readonly governanceId: string;
  readonly classification: HandoffClassification;
  readonly classificationReasons: readonly string[];
  readonly restrictions: readonly HandoffRestriction[];
  readonly restrictionCodes: readonly HandoffRestrictionCode[];
  readonly researchEscalations: readonly {
    readonly kind: ResearchEscalationKind;
    readonly rationale: string;
    readonly escalationId: string;
  }[];
  readonly recommendedAlternativeId: string | null;
  readonly dependencyState: GovernanceResult['dependencyGate']['state'];
  readonly stabilityState: GovernanceResult['handoffPackage']['stabilityStatus'];
  readonly freshnessState: GovernanceResult['handoffPackage']['freshnessStatus'];
  readonly comparabilityStatus:
    GovernanceResult['handoffPackage']['comparabilityStatus'];
  readonly dependencyGate: GovernanceResult['dependencyGate'];
  readonly evidenceLimitations:
    GovernanceResult['handoffPackage']['evidenceLimitations'];
  readonly strategyInputId: string;
  readonly handoffId: string;
  readonly governanceContextId: string;
}

export function extractGovernanceFacts(
  governance: GovernanceResult,
): GovernanceFacts {
  if (!HANDOFF_CLASSIFICATIONS.includes(governance.classification)) {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      `unknown handoff classification `
      + `${String(governance.classification)}`);
  }
  for (const restriction of governance.restrictions) {
    if (typeof restriction.code !== 'string'
      || restriction.code.length === 0) {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        'governance restriction carries no code');
    }
  }
  for (const escalation of governance.research.escalations) {
    if (!GOVERNANCE_RESEARCH_KINDS.includes(escalation.kind)) {
      throw new IntentRejectionError('INVALID_RESEARCH_CONTEXT',
        `unknown governance research kind ${String(escalation.kind)}`);
    }
    if (typeof escalation.rationale !== 'string'
      || escalation.rationale.length === 0
      || typeof escalation.escalationId !== 'string') {
      throw new IntentRejectionError('INVALID_RESEARCH_CONTEXT',
        'governance research escalation is malformed');
    }
  }

  // Classification ↔ evidence consistency (§23): a classification must be
  // supported by its own evidence gates — an allowed handoff never carries
  // blocked evidence, and a blocked family never lacks its cause.
  const evidenceState = governance.context.evidenceState;
  const blockedEvidence = evidenceState === 'CONFLICTED'
    || evidenceState === 'INSUFFICIENT'
    || evidenceState === 'NOT_COMPARABLE';
  const allowedClassification = governance.classification
    === 'HANDOFF_ALLOWED'
    || governance.classification === 'HANDOFF_ALLOWED_WITH_LIMITATIONS';
  if (allowedClassification && blockedEvidence) {
    throw new IntentRejectionError(
      evidenceState === 'CONFLICTED' ? 'CONFLICTED_EVIDENCE'
        : evidenceState === 'INSUFFICIENT' ? 'INSUFFICIENT_EVIDENCE'
          : 'NOT_COMPARABLE',
      `governance classified the handoff `
        + `${governance.classification} but the evidence state is `
        + `${evidenceState} — fail closed`);
  }
  if (governance.classification === 'HANDOFF_CONFLICTED'
    && evidenceState !== 'CONFLICTED') {
    throw new IntentRejectionError('CONFLICTED_EVIDENCE',
      'HANDOFF_CONFLICTED requires a conflicted evidence state');
  }
  if (governance.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE'
    && evidenceState !== 'INSUFFICIENT'
    && governance.handoffPackage.freshnessStatus !== 'UNKNOWN') {
    throw new IntentRejectionError('INSUFFICIENT_EVIDENCE',
      'HANDOFF_INSUFFICIENT_EVIDENCE requires an insufficient '
      + 'evidence state or unknown freshness');
  }
  if (governance.classification === 'HANDOFF_STALE'
    && governance.handoffPackage.freshnessStatus !== 'STALE') {
    throw new IntentRejectionError('STALE_EVIDENCE',
      'HANDOFF_STALE requires a stale freshness status');
  }
  if (governance.classification === 'HANDOFF_NOT_COMPARABLE'
    && governance.handoffPackage.comparabilityStatus
      !== 'NOT_COMPARABLE') {
    throw new IntentRejectionError('NOT_COMPARABLE',
      'HANDOFF_NOT_COMPARABLE requires a not-comparable status');
  }
  // §10 — normalization must be declared consistently: the restriction
  // and the comparability status must agree, never inferred.
  const declaresNormalization = governance.restrictions.some(
    (restriction) => restriction.code === 'NORMALIZED_COMPARISON_ONLY');
  const statusNormalized = governance.handoffPackage.comparabilityStatus
    === 'COMPARABLE_VIA_NORMALIZATION';
  if (declaresNormalization !== statusNormalized) {
    throw new IntentRejectionError('NOT_COMPARABLE',
      'normalized comparison must be declared consistently — the '
      + 'NORMALIZED_COMPARISON_ONLY restriction and the '
      + 'COMPARABLE_VIA_NORMALIZATION status must agree');
  }

  return Object.freeze({
    governanceId: governance.governanceId,
    classification: governance.classification,
    classificationReasons: governance.classificationReasons,
    restrictions: governance.restrictions,
    restrictionCodes:
      governance.restrictions.map((restriction) => restriction.code),
    researchEscalations: governance.research.escalations.map(
      (escalation) => Object.freeze({
        kind: escalation.kind,
        rationale: escalation.rationale,
        escalationId: escalation.escalationId,
      })),
    recommendedAlternativeId:
      governance.strategyInput.recommendedAlternativeId,
    dependencyState: governance.dependencyGate.state,
    stabilityState: governance.handoffPackage.stabilityStatus,
    freshnessState: governance.handoffPackage.freshnessStatus,
    comparabilityStatus: governance.handoffPackage.comparabilityStatus,
    dependencyGate: governance.dependencyGate,
    evidenceLimitations: governance.handoffPackage.evidenceLimitations,
    strategyInputId: governance.strategyInput.strategyInputId,
    handoffId: governance.handoffPackage.handoffId,
    governanceContextId: governance.context.contextId,
  });
}

/** Classification-independent reason codes a blocked family carries. */
export function blockedFamilyOf(
  classification: HandoffClassification,
): readonly IntentRejectionCode[] {
  switch (classification) {
    case 'HANDOFF_CONFLICTED':
      return ['CONFLICTED_EVIDENCE'];
    case 'HANDOFF_INSUFFICIENT_EVIDENCE':
      return ['INSUFFICIENT_EVIDENCE'];
    case 'HANDOFF_STALE':
      return ['STALE_EVIDENCE'];
    case 'HANDOFF_NOT_COMPARABLE':
      return ['NOT_COMPARABLE'];
    default:
      return [];
  }
}
