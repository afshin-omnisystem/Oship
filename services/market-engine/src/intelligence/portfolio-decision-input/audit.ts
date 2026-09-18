/**
 * SPRINT 043 — audit (§19): oship.portfolio-decision-input.v1.
 *
 * Append-only, deterministically serialized, hash-chained event log over
 * the bridge lifecycle. Mutation, tampering, reordering, payload
 * substitution, truncation, extension, foreign events, provenance
 * mismatch, restriction mismatch, classification mismatch, eligibility
 * mismatch and constraint mismatch all fail verification — FAIL CLOSED.
 */

import type {
  InputAuditEvent, InputEventType, InputAuditIdentity,
  PortfolioDecisionInput,
} from './types';
import {
  PORTFOLIO_DECISION_INPUT_GENESIS_HASH,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
  INPUT_EVENT_TYPES, InputRejectionError,
} from './types';
import {canonicalJson, hashOf, inputAuditEventIdOf} from './ids';

export interface InputAuditVerification {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly eventCount: number;
}

export class PortfolioDecisionInputAuditLog {
  private readonly events: InputAuditEvent[] = [];
  private previousHash: string = PORTFOLIO_DECISION_INPUT_GENESIS_HASH;

  constructor(private readonly inputId: string,
    private readonly timestamp: number) {}

  append(eventType: InputEventType,
    payload: Readonly<Record<string, unknown>>): InputAuditEvent {
    if (!(INPUT_EVENT_TYPES as readonly string[])
      .includes(eventType)) {
      throw new InputRejectionError('AUDIT_VIOLATION',
        `unknown input event type "${String(eventType)}"`);
    }
    const payloadFingerprint = hashOf(payload);
    const sequence = this.events.length;
    const core: Omit<InputAuditEvent, 'eventId' | 'hash'> = {
      schemaVersion: PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
      eventType,
      timestamp: this.timestamp,
      sequence,
      inputId: this.inputId,
      payload,
      payloadFingerprint,
      previousHash: this.previousHash,
    };
    const event: InputAuditEvent = Object.freeze({
      ...core,
      eventId: inputAuditEventIdOf(core),
      hash: hashOf({core}),
    });
    this.events.push(event);
    this.previousHash = event.hash;
    return event;
  }

  get headHash(): string {
    return this.previousHash;
  }

  get length(): number {
    return this.events.length;
  }

  snapshot(): readonly InputAuditEvent[] {
    return Object.freeze([...this.events]);
  }
}

/** Chain verification: hashes, ordering, schema, foreign events. */
export function verifyPortfolioDecisionInputAudit(
  events: readonly InputAuditEvent[],
  expectedCount?: number,
): InputAuditVerification {
  if (!Array.isArray(events) || events.length === 0) {
    return {valid: false, reason: 'audit chain is empty', eventCount: 0};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false,
      reason: `audit chain truncated or extended: `
        + `${String(events.length)} events, expected `
        + `${String(expectedCount)}`,
      eventCount: events.length};
  }
  let previousHash: string = PORTFOLIO_DECISION_INPUT_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event === null || typeof event !== 'object') {
      return {valid: false, reason: 'audit event is malformed',
        eventCount: i};
    }
    if (event.schemaVersion
      !== PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION) {
      return {valid: false,
        reason: `event ${String(i)} carries a foreign schema version`,
        eventCount: i + 1};
    }
    if (!(INPUT_EVENT_TYPES as readonly string[])
      .includes(event.eventType)) {
      return {valid: false,
        reason: `event ${String(i)} is a foreign event type`,
        eventCount: i + 1};
    }
    if (event.sequence !== i) {
      return {valid: false,
        reason: `event ${String(i)} is out of order or reordered`,
        eventCount: i + 1};
    }
    if (event.previousHash !== previousHash) {
      return {valid: false,
        reason: `event ${String(i)} breaks the hash chain`,
        eventCount: i + 1};
    }
    if (event.payloadFingerprint !== hashOf(event.payload)) {
      return {valid: false,
        reason: `event ${String(i)} carries a tampered payload`,
        eventCount: i + 1};
    }
    if (event.eventId
      !== inputAuditEventIdOf({
        schemaVersion: event.schemaVersion,
        eventType: event.eventType,
        timestamp: event.timestamp,
        sequence: event.sequence,
        inputId: event.inputId,
        payload: event.payload,
        payloadFingerprint: event.payloadFingerprint,
        previousHash: event.previousHash,
      })) {
      return {valid: false,
        reason: `event ${String(i)} carries a substituted event id`,
        eventCount: i + 1};
    }
    if (event.hash !== hashOf({core: {
      schemaVersion: event.schemaVersion,
      eventType: event.eventType,
      timestamp: event.timestamp,
      sequence: event.sequence,
      inputId: event.inputId,
      payload: event.payload,
      payloadFingerprint: event.payloadFingerprint,
      previousHash: event.previousHash,
    }})) {
      return {valid: false,
        reason: `event ${String(i)} carries a forged hash`,
        eventCount: i + 1};
    }
    if (event.inputId !== events[0].inputId) {
      return {valid: false,
        reason: `event ${String(i)} belongs to a foreign input`,
        eventCount: i + 1};
    }
    previousHash = event.hash;
  }
  return {valid: true, reason: null, eventCount: events.length};
}

export interface InputAuditBinding {
  readonly inputId: string;
  readonly evaluationId: string;
  readonly intentId: string;
  readonly classification: string;
  readonly eligibility: string;
  readonly restrictionCodes: readonly string[];
  readonly constraintIds: readonly string[];
}

/**
 * Binding verification (§19): the recorded evaluation, classification,
 * eligibility, restriction and constraint events must match the final
 * input artifact — substitution anywhere fails closed.
 */
export function verifyInputAuditBinding(
  events: readonly InputAuditEvent[],
  binding: InputAuditBinding,
): InputAuditVerification {
  const chain = verifyPortfolioDecisionInputAudit(events);
  if (!chain.valid) return chain;
  for (const event of events) {
    if (event.eventType === 'input-received'
      || event.eventType === 'evaluation-verified') {
      if (event.payload.evaluationId !== binding.evaluationId) {
        return {valid: false,
          reason: 'provenance mismatch: the audit chain records a '
            + 'different evaluation id',
          eventCount: events.length};
      }
      if (event.payload.intentId !== undefined
        && event.payload.intentId !== binding.intentId) {
        return {valid: false,
          reason: 'provenance mismatch: the audit chain records a '
            + 'different intent id',
          eventCount: events.length};
      }
    }
    if (event.eventType === 'restrictions-collected'
      && canonicalJson(event.payload.codes ?? [])
        !== canonicalJson([...binding.restrictionCodes])) {
      return {valid: false,
        reason: 'restriction mismatch: the audit chain records '
          + 'different restriction codes',
        eventCount: events.length};
    }
    if (event.eventType === 'constraints-validated'
      && canonicalJson(event.payload.constraintIds ?? [])
        !== canonicalJson([...binding.constraintIds])) {
      return {valid: false,
        reason: 'constraint mismatch: the audit chain records '
          + 'different constraint ids',
        eventCount: events.length};
    }
    if (event.eventType === 'input-classified'
      && event.payload.classification !== binding.classification) {
      return {valid: false,
        reason: 'classification mismatch: the audit chain records a '
          + 'different classification',
        eventCount: events.length};
    }
    if (event.eventType === 'downstream-eligibility-assigned'
      && event.payload.eligibility !== binding.eligibility) {
      return {valid: false,
        reason: 'eligibility mismatch: the audit chain records a '
          + 'different eligibility',
        eventCount: events.length};
    }
    if (event.eventType === 'input-built'
      && event.payload.inputId !== binding.inputId) {
      return {valid: false,
        reason: 'provenance mismatch: the audit chain records a '
          + 'different input id',
        eventCount: events.length};
    }
  }
  return {valid: true, reason: null, eventCount: events.length};
}

export function inputAuditIdentityOf(
  inputId: string,
  eventCount: number,
  headHash: string,
): InputAuditIdentity {
  return Object.freeze({
    schemaVersion: PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    inputId,
    eventCount,
    headHash,
  });
}

/** The audit identity bound into a built input result. */
export function inputAuditIdentityOfResult(
  result: PortfolioDecisionInput,
): InputAuditIdentity {
  return inputAuditIdentityOf(result.inputId,
    result.auditIdentity.eventCount, result.auditIdentity.headHash);
}
