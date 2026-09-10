import {sha256} from '../../oiin/ids';
import type {ClosedLoopAuditEvent, ClosedLoopEventType} from './types';
import {GENESIS_HASH, CLOSED_LOOP_EVENT_TYPES} from './types';
import {auditEventId} from './ids';

/**
 * SPRINT 035 — hash-chained audit log `oship.closed-loop-intelligence.v1`.
 *
 * GENESIS-linked SHA-256 chain. Tampering, reordering or truncation fails
 * verification — the closed loop never reports on a broken audit chain.
 */

export class ClosedLoopAuditLog {
  private readonly events: ClosedLoopAuditEvent[] = [];
  private lastHash = GENESIS_HASH;

  constructor(
    private readonly analysisId: string,
    private readonly timestamp: number,
  ) {}

  record(eventType: ClosedLoopEventType, payload: Readonly<Record<string, unknown>>): ClosedLoopAuditEvent {
    if (!CLOSED_LOOP_EVENT_TYPES.includes(eventType)) {
      throw new Error(`closed-loop audit refused: unknown event type "${eventType}" — fail closed`);
    }
    const sequence = this.events.length;
    const payloadFingerprint = sha256(payload);
    const eventId = auditEventId({analysisId: this.analysisId, sequence, eventType, payloadFingerprint});
    const event: ClosedLoopAuditEvent = Object.freeze({
      schemaVersion: 'oship.closed-loop-intelligence.v1',
      eventId,
      eventType,
      timestamp: this.timestamp,
      sequence,
      analysisId: this.analysisId,
      payload: Object.freeze({...payload}),
      payloadFingerprint,
      previousHash: this.lastHash,
      hash: '',
    });
    const hash = sha256({
      eventId, eventType, timestamp: this.timestamp, sequence,
      analysisId: this.analysisId, payloadFingerprint, previousHash: this.lastHash,
    });
    this.lastHash = hash;
    const sealed = Object.freeze({...event, hash});
    this.events.push(sealed);
    return sealed;
  }

  all(): readonly ClosedLoopAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  get headHash(): string {
    return this.lastHash;
  }
}

export interface AuditVerification {
  readonly valid: boolean;
  readonly events: number;
  readonly reason: string | null;
}

export function verifyClosedLoopAudit(
  events: readonly ClosedLoopAuditEvent[], expectedCount?: number,
): AuditVerification {
  if (events.length === 0) {
    return {valid: false, events: 0, reason: 'audit chain is empty'};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false, events: events.length,
      reason: `audit chain has ${events.length} events — expected ${expectedCount} (truncation or extension)`};
  }
  let previousHash = GENESIS_HASH;
  let expectedSequence = 0;
  for (const event of events) {
    if (event.schemaVersion !== 'oship.closed-loop-intelligence.v1') {
      return {valid: false, events: events.length, reason: `event ${event.eventId} has wrong schema version`};
    }
    if (event.sequence !== expectedSequence) {
      return {valid: false, events: events.length,
        reason: `event ${event.eventId} sequence ${event.sequence} ≠ expected ${expectedSequence}`};
    }
    if (event.previousHash !== previousHash) {
      return {valid: false, events: events.length,
        reason: `event ${event.eventId} previousHash mismatch (reordering or truncation)`};
    }
    const expectedHash = sha256({
      eventId: event.eventId, eventType: event.eventType, timestamp: event.timestamp,
      sequence: event.sequence, analysisId: event.analysisId,
      payloadFingerprint: event.payloadFingerprint, previousHash: event.previousHash,
    });
    if (event.hash !== expectedHash) {
      return {valid: false, events: events.length, reason: `event ${event.eventId} hash mismatch (tampering)`};
    }
    previousHash = event.hash;
    expectedSequence += 1;
  }
  return {valid: true, events: events.length, reason: null};
}
