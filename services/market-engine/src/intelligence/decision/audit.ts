/**
 * SPRINT 039 — hash-chained audit log `oship.decision-intelligence.v1` (§26).
 *
 * Exactly the 14 canonical event types; GENESIS-rooted SHA-256 chaining;
 * append-only; tampering, payload substitution, reordering, truncation and
 * extension all fail verification.
 */

import {createHash} from 'node:crypto';
import {DECISION_EVENT_TYPES, DECISION_GENESIS_HASH} from './types';
import type {DecisionAuditEvent, DecisionEventType} from './types';
import {decisionAuditEventIdOf, canonicalJson, learningHash} from './ids';

export class DecisionAuditLog {
  private readonly events: DecisionAuditEvent[] = [];
  private previousHash = DECISION_GENESIS_HASH;

  constructor(
    private readonly analysisId: string,
    private readonly timestamp: number,
  ) {}

  append(
    eventType: DecisionEventType,
    payload: Readonly<Record<string, unknown>>,
  ): DecisionAuditEvent {
    if (!DECISION_EVENT_TYPES.includes(eventType)) {
      throw new Error(`decision-intelligence audit: unknown event type `
        + `"${eventType}" — fail closed`);
    }
    const sequence = this.events.length;
    const eventId = decisionAuditEventIdOf({
      analysisId: this.analysisId, sequence, eventType, payload});
    const payloadFingerprint = learningHash(payload);
    const event: DecisionAuditEvent = Object.freeze({
      schemaVersion: 'oship.decision-intelligence.v1',
      eventId,
      eventType,
      timestamp: this.timestamp,
      sequence,
      analysisId: this.analysisId,
      payload,
      payloadFingerprint,
      previousHash: this.previousHash,
      hash: '',
    });
    const hash = createHash('sha256').update(canonicalJson({
      schemaVersion: event.schemaVersion, eventId, eventType: event.eventType,
      timestamp: event.timestamp, sequence, analysisId: event.analysisId,
      payload, payloadFingerprint, previousHash: event.previousHash,
    })).digest('hex');
    const sealed = Object.freeze({...event, hash});
    this.events.push(sealed);
    this.previousHash = hash;
    return sealed;
  }

  snapshot(): readonly DecisionAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  get length(): number {
    return this.events.length;
  }

  get headHash(): string {
    return this.events.length === 0 ? DECISION_GENESIS_HASH
      : this.events[this.events.length - 1].hash;
  }
}

export interface DecisionAuditVerification {
  readonly valid: boolean;
  readonly events: number;
  readonly reason: string | null;
}

export function verifyDecisionAudit(
  events: readonly DecisionAuditEvent[], expectedCount?: number,
): DecisionAuditVerification {
  if (events.length === 0) {
    return {valid: false, events: 0, reason: 'decision-intelligence audit chain is empty'};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false, events: events.length,
      reason: `decision-intelligence audit chain has ${events.length} events — `
        + `expected ${expectedCount} (truncation or extension)`};
  }
  let previousHash = DECISION_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.schemaVersion !== 'oship.decision-intelligence.v1') {
      return {valid: false, events: events.length,
        reason: `event ${i} has schema ${e.schemaVersion} — foreign event detected`};
    }
    if (e.sequence !== i) {
      return {valid: false, events: events.length,
        reason: `event ${i} has sequence ${e.sequence} — reordering detected`};
    }
    if (e.previousHash !== previousHash) {
      return {valid: false, events: events.length,
        reason: `event ${i} breaks the hash chain — tampering detected`};
    }
    const expectedFingerprint = learningHash(e.payload);
    if (e.payloadFingerprint !== expectedFingerprint) {
      return {valid: false, events: events.length,
        reason: `event ${i} payload fingerprint mismatch — substitution detected`};
    }
    const expectedHash = createHash('sha256').update(canonicalJson({
      schemaVersion: e.schemaVersion, eventId: e.eventId, eventType: e.eventType,
      timestamp: e.timestamp, sequence: e.sequence, analysisId: e.analysisId,
      payload: e.payload, payloadFingerprint: e.payloadFingerprint,
      previousHash: e.previousHash,
    })).digest('hex');
    if (e.hash !== expectedHash) {
      return {valid: false, events: events.length,
        reason: `event ${i} hash mismatch — tampering detected`};
    }
    previousHash = e.hash;
  }
  return {valid: true, events: events.length, reason: null};
}
