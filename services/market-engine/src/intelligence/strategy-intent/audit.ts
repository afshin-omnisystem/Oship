/**
 * SPRINT 041 — audit (§22): oship.strategy-intent.v1.
 *
 * Append-only, deterministically serialized, hash-chained event log over
 * the intent lifecycle. Tampering, reordering, payload substitution,
 * truncation, extension and foreign events all fail verification.
 */

import type {
  IntentAuditEvent, IntentEventType, IntentInvariantReport,
} from './types';
import {
  STRATEGY_INTENT_GENESIS_HASH, STRATEGY_INTENT_SCHEMA_VERSION,
  STRATEGY_INTENT_EVENT_TYPES, IntentRejectionError,
} from './types';
import {canonicalJson, hashOf, intentAuditEventIdOf} from './ids';

export interface IntentAuditVerification {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly eventCount: number;
}

export class StrategyIntentAuditLog {
  private readonly events: IntentAuditEvent[] = [];
  private previousHash: string = STRATEGY_INTENT_GENESIS_HASH;

  constructor(private readonly intentId: string,
    private readonly timestamp: number) {}

  append(eventType: IntentEventType,
    payload: Readonly<Record<string, unknown>>): IntentAuditEvent {
    if (!(STRATEGY_INTENT_EVENT_TYPES as readonly string[])
      .includes(eventType)) {
      throw new IntentRejectionError('AUDIT_INTEGRITY_FAILURE',
        `unknown event type "${String(eventType)}"`);
    }
    const payloadFingerprint = hashOf(payload);
    const sequence = this.events.length;
    const core: Omit<IntentAuditEvent, 'eventId' | 'hash'> = {
      schemaVersion: STRATEGY_INTENT_SCHEMA_VERSION,
      eventType,
      timestamp: this.timestamp,
      sequence,
      intentId: this.intentId,
      payload,
      payloadFingerprint,
      previousHash: this.previousHash,
    };
    const event: IntentAuditEvent = Object.freeze<IntentAuditEvent>({
      ...core,
      eventId: intentAuditEventIdOf(core),
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

  snapshot(): readonly IntentAuditEvent[] {
    return Object.freeze([...this.events]);
  }
}

export function verifyStrategyIntentAudit(
  events: readonly IntentAuditEvent[],
  expectedCount?: number,
): IntentAuditVerification {
  if (!Array.isArray(events) || events.length === 0) {
    return {valid: false, reason: 'audit chain is empty', eventCount: 0};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false, reason: `audit chain length ${String(
      events.length)} does not match the expected ${String(expectedCount)}`
      + ' — truncation or extension detected',
    eventCount: events.length};
  }
  let previousHash = STRATEGY_INTENT_GENESIS_HASH;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (event === null || typeof event !== 'object') {
      return {valid: false, reason: `event ${String(index)} is malformed`,
        eventCount: events.length};
    }
    if (event.schemaVersion !== STRATEGY_INTENT_SCHEMA_VERSION) {
      return {valid: false, reason: `event ${String(index)} carries a `
        + 'foreign schema version', eventCount: events.length};
    }
    if (!(STRATEGY_INTENT_EVENT_TYPES as readonly string[])
      .includes(event.eventType)) {
      return {valid: false, reason: `event ${String(index)} is a foreign `
        + `event type "${String(event.eventType)}"`,
      eventCount: events.length};
    }
    if (event.sequence !== index) {
      return {valid: false, reason: `event ${String(index)} carries an `
        + 'inconsistent sequence — reordering detected',
      eventCount: events.length};
    }
    if (event.previousHash !== previousHash) {
      return {valid: false, reason: `event ${String(index)} breaks the `
        + 'hash chain — reordering or tampering detected',
      eventCount: events.length};
    }
    const recomputedPayload = hashOf(event.payload);
    if (recomputedPayload !== event.payloadFingerprint) {
      return {valid: false, reason: `event ${String(index)} payload does `
        + 'not match its fingerprint — substitution detected',
      eventCount: events.length};
    }
    const recomputedHash = hashOf({core: {
      schemaVersion: event.schemaVersion,
      eventType: event.eventType,
      timestamp: event.timestamp,
      sequence: event.sequence,
      intentId: event.intentId,
      payload: event.payload,
      payloadFingerprint: event.payloadFingerprint,
      previousHash: event.previousHash,
    }});
    if (recomputedHash !== event.hash) {
      return {valid: false, reason: `event ${String(index)} hash does not `
        + 'match its content — tampering detected',
      eventCount: events.length};
    }
    previousHash = event.hash;
  }
  return {valid: true, reason: null, eventCount: events.length};
}

/** Audit identity anchored into the intent artifact. */
export function intentAuditIdentityOf(
  intentId: string,
  eventCount: number,
  headHash: string,
): {schemaVersion: 'oship.strategy-intent.v1'; intentId: string;
  eventCount: number; headHash: string} {
  return Object.freeze({
    schemaVersion: STRATEGY_INTENT_SCHEMA_VERSION,
    intentId,
    eventCount,
    headHash,
  });
}

/** Type guard used by invariants: a validated audit report. */
export function auditReportPassed(
  report: IntentInvariantReport,
): boolean {
  return report.passed === true;
}
