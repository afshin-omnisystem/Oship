/**
 * SPRINT 041 — fail-closed source validation (§1/§23).
 *
 * The engine consumes ONLY governed Sprint-040 outputs. Every malformed,
 * unaudited, tampered, nondeterministic or semantically unsafe input is
 * rejected with an explicit code — no generic hidden fallback.
 */

import type {
  StrategyIntentInput, GovernanceResult, DecisionIntelligenceResult,
  OpportunityDomain, IntentRejectionCode,
} from './types';
import {IntentRejectionError} from './types';
import type {StrategyIntentConfigSpec} from './types';
import {verifyGovernanceAudit} from '../governance/audit';
import {GOVERNANCE_EVENT_TYPES} from '../governance/types';

// ---------------------------------------------------------------------------
// Semantic-safety vocabulary (annotations are scanned fail closed)
// ---------------------------------------------------------------------------

/** AEGIS authorization language — rejected with AEGIS_SEMANTICS. */
export const INTENT_AEGIS_TERMS =
  /(aegis|authoriz|approval|approve|pre-?clear|clearance|on behalf of)/i;

/** Treasury / capital language — rejected with TREASURY_SEMANTICS. */
export const INTENT_TREASURY_TERMS =
  /(treasury|transfer|withdraw|release funds|move funds|allocate capital|capital allocation|settle funds)/i;

/** Execution / order language — rejected with EXECUTION_SEMANTICS. */
export const INTENT_EXECUTION_TERMS =
  /(execute|execution|place (a|an|the)? ?(trade|bet|order)|submit|buy now|sell now|back now|lay now|dispatch|fire the|\border(s)?\b|fill)/i;

/** Predictive language — rejected with PREDICTIVE_SEMANTICS. */
export const INTENT_PREDICTIVE_TERMS =
  /(probability|forecast|expected (profit|return|roi|value|gain)|predicted|prediction|guaranteed|will (win|profit|lose|rise|fall)|risk-?free|riskless|sure profit|\bcertain\b|certainty)/i;

/** Credential / signing material — rejected with UNSAFE_SEMANTICS. */
export const INTENT_UNSAFE_TERMS =
  /(api ?key|credential|password|secret|private ?key|signing|signature|\btoken\b|\bcert\b|access ?key)/i;

/** Fabricated output keys — forbidden as property names anywhere. */
export const FABRICATED_INTENT_KEYS =
  /"(probability|expectedReturn|expected_return|expectedValue|expectedProfit|expectedRoi|roi|winRate|pWin|winProbability|probabilityOfSuccess|successOdds|futurePrice|futureOdds|forecast|forecastedProfit|guaranteedProfit|guaranteedReturn|guaranteedExecution|certainty|orderQuantity|orderPrice|orderSize|qty|amountToCommit|instruction|treasuryCommand|allocationCommand|aegisApproval|apiKey|api_key|credential|password|secret|privateKey)":/;

/** Command, order and credential keys — impossible in a StrategyIntent. */
export const FORBIDDEN_INTENT_KEYS =
  /"(order|orders|orderQuantity|orderPrice|orderType|limitPrice|stopPrice|qty|quantity|quantityToCommit|notional|units|amountToCommit|price|instruction|instructions|command|commands|authorization|authorize|apiKey|api_key|credential|credentials|password|token|secret|privateKey|treasuryCommand|allocationCommand|aegisApproval|submission|signature)":/;

/** The domains Strategy Intent understands. */
export const INTENT_DOMAINS: readonly OpportunityDomain[] =
  Object.freeze(['AFIS', 'ABL']);

/** Precedence for annotation semantic rejections (most specific first). */
const ANNOTATION_SCANS: readonly {code: IntentRejectionCode;
  pattern: RegExp; label: string}[] = Object.freeze([
  {code: 'AEGIS_SEMANTICS', pattern: INTENT_AEGIS_TERMS,
    label: 'AEGIS authorization language'},
  {code: 'TREASURY_SEMANTICS', pattern: INTENT_TREASURY_TERMS,
    label: 'Treasury/capital language'},
  {code: 'EXECUTION_SEMANTICS', pattern: INTENT_EXECUTION_TERMS,
    label: 'execution/order language'},
  {code: 'PREDICTIVE_SEMANTICS', pattern: INTENT_PREDICTIVE_TERMS,
    label: 'predictive language'},
  {code: 'UNSAFE_SEMANTICS', pattern: INTENT_UNSAFE_TERMS,
    label: 'credential/signing material'},
]);

// ---------------------------------------------------------------------------
// Non-finite recursive scan (NaN/Infinity never enter the engine)
// ---------------------------------------------------------------------------

export function containsNonFinite(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsNonFinite(entry));
  }
  return Object.values(value as Record<string, unknown>)
    .some((entry) => containsNonFinite(entry));
}

// ---------------------------------------------------------------------------
// Envelope validation (§1)
// ---------------------------------------------------------------------------

export interface ValidatedIntentEnvelope {
  readonly annotations: readonly string[];
}

export function validateIntentEnvelope(
  input: StrategyIntentInput,
  config: StrategyIntentConfigSpec,
): ValidatedIntentEnvelope {
  if (input === null || typeof input !== 'object') {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'intent input required');
  }
  if (input.governanceResult === null
    || typeof input.governanceResult !== 'object') {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'governanceResult (Sprint 040 output) is required');
  }
  if (input.decisionResult === null
    || typeof input.decisionResult !== 'object') {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'decisionResult (Sprint 039 output) is required');
  }
  if (!Array.isArray(input.annotations)) {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'annotations must be an array of strings');
  }
  if (input.annotations.length > config.maxAnnotations) {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      `at most ${String(config.maxAnnotations)} annotations allowed, got `
      + `${String(input.annotations.length)}`);
  }
  for (const annotation of input.annotations) {
    if (typeof annotation !== 'string' || annotation.length === 0) {
      throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
        'annotations must be non-empty strings');
    }
  }
  if (typeof input.timestamp !== 'number'
    || !Number.isFinite(input.timestamp)) {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'timestamp must be a finite number');
  }
  if (typeof input.correlationId !== 'string'
    || input.correlationId.length === 0) {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'correlationId required');
  }
  if (typeof input.traceId !== 'string' || input.traceId.length === 0) {
    throw new IntentRejectionError('INVALID_INTENT_CONTEXT',
      'traceId required');
  }
  const annotations = [...input.annotations].sort();
  scanIntentAnnotations(annotations);
  return {annotations};
}

/** Fail-closed semantic scan of requester annotations. */
export function scanIntentAnnotations(
  annotations: readonly string[],
): void {
  for (const annotation of annotations) {
    for (const scan of ANNOTATION_SCANS) {
      if (scan.pattern.test(annotation)) {
        throw new IntentRejectionError(scan.code,
          `annotation carries ${scan.label}: "${annotation}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Governance source validation (§1, §23)
// ---------------------------------------------------------------------------

export function validateGovernanceSource(
  governance: GovernanceResult,
): void {
  if (governance === null || typeof governance !== 'object') {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      'governance result required');
  }
  if (typeof governance.governanceId !== 'string'
    || governance.governanceId.length === 0) {
    throw new IntentRejectionError('MISSING_GOVERNANCE_ID',
      'governance result carries no governance id');
  }
  if (governance.schemaVersion !== 'oship.decision-governance.v1') {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      `unknown governance schema version `
      + `${String(governance.schemaVersion)}`);
  }
  if (!Object.isFrozen(governance)) {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      'governance result must be frozen (immutable)');
  }
  if (governance.invariants === null
    || governance.invariants.passed !== true) {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      'governance invariants did not pass — refusing ungoverned input');
  }
  if (governance.replay === null || governance.replay.identical !== true) {
    throw new IntentRejectionError('NONDETERMINISTIC_INPUT',
      'governance result is not replay-identical');
  }
  if (!Array.isArray(governance.restrictions)) {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      'governance restrictions missing');
  }
  for (const restriction of governance.restrictions) {
    if (restriction === null || typeof restriction !== 'object'
      || typeof restriction.code !== 'string'
      || typeof restriction.restrictionId !== 'string') {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        'governance restriction is malformed');
    }
  }
  if (!Array.isArray(governance.auditEvents)
    || governance.auditEvents.length === 0) {
    throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
      'governance result carries no audit chain');
  }
  const verification = verifyGovernanceAudit(governance.auditEvents,
    governance.auditEvents.length);
  if (!verification.valid) {
    throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
      `governance audit chain rejected: ${verification.reason ?? 'unknown'}`);
  }
  const identity = governance.handoffPackage?.auditIdentity;
  if (identity !== null && identity !== undefined
    && identity.eventCount !== governance.auditEvents.length) {
    // The governance audit identity anchors the pre-seal chain; the sealed
    // chain may add the replay event. Any other count is tampering.
    if (governance.auditEvents.length !== identity.eventCount
      && governance.auditEvents[governance.auditEvents.length - 1]
        ?.eventType !== 'replay-completed') {
      throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
        'governance audit identity does not match the event chain');
    }
  }
  if (identity !== null && identity !== undefined
    && typeof identity.headHash === 'string') {
    // The recorded head must bind the anchored chain prefix.
    const anchored = governance.auditEvents[
      Math.min(identity.eventCount, governance.auditEvents.length) - 1];
    if (anchored === undefined || anchored.hash !== identity.headHash) {
      throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
        'governance audit identity head does not match the event chain');
    }
  }
  if (governance.context === null || typeof governance.context !== 'object'
    || typeof governance.context.decisionId !== 'string'
    || governance.context.decisionId.length === 0) {
    throw new IntentRejectionError('INVALID_GOVERNANCE_INPUT',
      'governance context is malformed');
  }
  if (!Array.isArray(governance.auditEvents)
    || !governance.auditEvents.every((event) =>
      (GOVERNANCE_EVENT_TYPES as readonly string[])
        .includes(event.eventType))) {
    throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
      'governance audit chain contains foreign events');
  }
}

// ---------------------------------------------------------------------------
// Decision source validation (§1, §7–§9, §18, §23)
// ---------------------------------------------------------------------------

export function validateDecisionSource(
  decision: DecisionIntelligenceResult,
  governance: GovernanceResult,
): void {
  if (decision === null || typeof decision !== 'object') {
    throw new IntentRejectionError('INVALID_DECISION_INPUT',
      'decision result required');
  }
  if (typeof decision.analysisId !== 'string'
    || decision.analysisId.length === 0) {
    throw new IntentRejectionError('MISSING_DECISION_ID',
      'decision result carries no analysis id');
  }
  if (decision.context === null || typeof decision.context !== 'object'
    || typeof decision.context.baseCandidateId !== 'string'
    || decision.context.baseCandidateId.length === 0) {
    throw new IntentRejectionError('MISSING_OPPORTUNITY_ID',
      'decision result carries no opportunity identity');
  }
  if (decision.schemaVersion !== 'oship.decision-intelligence.v1') {
    throw new IntentRejectionError('INVALID_DECISION_INPUT',
      `unknown decision schema version ${String(decision.schemaVersion)}`);
  }
  if (!INTENT_DOMAINS.includes(decision.context.domain)) {
    throw new IntentRejectionError('INVALID_DECISION_INPUT',
      `unsupported domain ${String(decision.context?.domain)}`);
  }
  if (decision.invariants === null
    || decision.invariants.passed !== true) {
    throw new IntentRejectionError('INVALID_DECISION_INPUT',
      'decision invariants did not pass — refusing raw input');
  }
  if (decision.replay === null || decision.replay.identical !== true) {
    throw new IntentRejectionError('NONDETERMINISTIC_INPUT',
      'decision result is not replay-identical');
  }
  if (containsNonFinite(decision)) {
    throw new IntentRejectionError('NONDETERMINISTIC_INPUT',
      'decision result contains NaN or Infinity');
  }
  if (FABRICATED_INTENT_KEYS.test(JSON.stringify(decision))) {
    throw new IntentRejectionError('PREDICTIVE_SEMANTICS',
      'decision result carries fabricated predictive keys');
  }
  validateDecisionSemantics(decision);

  // ---- Provenance cross-checks (§18) — no orphan intent ----
  if (decision.analysisId !== governance.context.decisionId) {
    throw new IntentRejectionError('INVALID_PROVENANCE',
      `decision ${decision.analysisId} is not the decision governed by `
      + `${governance.governanceId}`);
  }
  if (decision.context.baseCandidateId
    !== governance.context.opportunityId) {
    throw new IntentRejectionError('INVALID_PROVENANCE',
      'opportunity identity mismatch between decision and governance');
  }
  if (decision.context.domain !== governance.context.domain) {
    throw new IntentRejectionError('INVALID_PROVENANCE',
      'domain mismatch between decision and governance');
  }
  const sourceDecisionId
    = governance.handoffPackage?.sourceVersions?.decisionAnalysisId;
  if (sourceDecisionId !== undefined
    && sourceDecisionId !== decision.analysisId) {
    throw new IntentRejectionError('INVALID_PROVENANCE',
      'governance source versions do not pin this decision result');
  }
}

/** Domain-semantic validation of every alternative's legs (§8/§9). */
export function validateDecisionSemantics(
  decision: DecisionIntelligenceResult,
): void {
  const domain = decision.context.domain;
  for (const alternative of decision.alternatives) {
    const candidate = alternative.counterfactualCandidate;
    if (candidate.domain !== domain) {
      throw new IntentRejectionError('INVALID_PROVENANCE',
        `alternative ${alternative.alternativeId} domain `
        + `${String(candidate.domain)} differs from decision domain `
        + `${String(domain)}`);
    }
    for (const leg of candidate.venueLegs) {
      if (domain === 'AFIS') {
        if (leg.side === 'BACK' || leg.side === 'LAY') {
          throw new IntentRejectionError('INVALID_AFIS_SEMANTICS',
            `alternative ${alternative.alternativeId} carries ${leg.side} `
            + 'on an AFIS leg — BACK/LAY is not BUY/SELL');
        }
        if (leg.odds !== null) {
          throw new IntentRejectionError('INVALID_AFIS_SEMANTICS',
            `alternative ${alternative.alternativeId} carries decimal `
            + 'odds on an AFIS leg');
        }
      } else {
        if (leg.side === 'BUY' || leg.side === 'SELL') {
          throw new IntentRejectionError('INVALID_BACK_LAY_SEMANTICS',
            `alternative ${alternative.alternativeId} carries ${leg.side} `
            + 'on an ABL leg — BUY/SELL is not BACK/LAY');
        }
        if (typeof leg.odds !== 'number' || !(leg.odds > 1)) {
          throw new IntentRejectionError('INVALID_ABL_SEMANTICS',
            `alternative ${alternative.alternativeId} carries odds `
            + `${String(leg.odds)} — decimal odds must exceed 1`);
        }
      }
    }
    if (domain === 'ABL') {
      if (candidate.marketId === null
        || candidate.selectionId === null) {
        throw new IntentRejectionError('INVALID_ABL_SEMANTICS',
          `alternative ${alternative.alternativeId} lacks market/selection `
          + 'identity');
      }
    }
  }
}
