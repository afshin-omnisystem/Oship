import {createHash} from 'node:crypto';
import {
  RESEARCH_EVENT_TYPES, RESEARCH_GENESIS_HASH,
} from './types';
import type {ResearchAuditEvent, ResearchEventType, AuditVerification} from './types';
import {auditEventIdOf, canonicalJson, researchHash} from './ids';

/**
 * SPRINT 036 — hash-chained audit log `oship.historical-research.v1`.
 *
 * Exactly the 14 canonical event types; GENESIS-rooted SHA-256 chaining;
 * tampering, reordering, payload substitution and truncation all fail
 * verification.
 */

export class ResearchAuditLog {
  private readonly events: ResearchAuditEvent[] = [];
  private previousHash = RESEARCH_GENESIS_HASH;

  constructor(private readonly analysisId: string, private readonly timestamp: number) {}

  append(eventType: ResearchEventType, payload: Readonly<Record<string, unknown>>): ResearchAuditEvent {
    if (!RESEARCH_EVENT_TYPES.includes(eventType)) {
      throw new Error(`research audit: unknown event type "${eventType}" — fail closed`);
    }
    const sequence = this.events.length;
    const eventId = auditEventIdOf({analysisId: this.analysisId, sequence, eventType, payload});
    const payloadFingerprint = researchHash(payload);
    const event: ResearchAuditEvent = Object.freeze({
      schemaVersion: 'oship.historical-research.v1',
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

  snapshot(): readonly ResearchAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  get length(): number {
    return this.events.length;
  }

  /** Hash of the most recently appended event (GENESIS when empty). */
  get headHash(): string {
    return this.events.length === 0 ? RESEARCH_GENESIS_HASH : this.events[this.events.length - 1].hash;
  }
}

export function verifyResearchAudit(
  events: readonly ResearchAuditEvent[], expectedCount?: number,
): AuditVerification {
  if (events.length === 0) {
    return {valid: false, events: 0, reason: 'research audit chain is empty'};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false, events: events.length,
      reason: `research audit chain has ${events.length} events — expected ${expectedCount} (truncation or extension)`};
  }
  let previousHash = RESEARCH_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.sequence !== i) {
      return {valid: false, events: events.length, reason: `event ${i} has sequence ${e.sequence} — reordering detected`};
    }
    if (e.previousHash !== previousHash) {
      return {valid: false, events: events.length, reason: `event ${i} breaks the hash chain — tampering detected`};
    }
    const expectedFingerprint = researchHash(e.payload);
    if (e.payloadFingerprint !== expectedFingerprint) {
      return {valid: false, events: events.length, reason: `event ${i} payload fingerprint mismatch — substitution detected`};
    }
    const expectedHash = createHash('sha256').update(canonicalJson({
      schemaVersion: e.schemaVersion, eventId: e.eventId, eventType: e.eventType,
      timestamp: e.timestamp, sequence: e.sequence, analysisId: e.analysisId,
      payload: e.payload, payloadFingerprint: e.payloadFingerprint, previousHash: e.previousHash,
    })).digest('hex');
    if (e.hash !== expectedHash) {
      return {valid: false, events: events.length, reason: `event ${i} hash mismatch — tampering detected`};
    }
    previousHash = e.hash;
  }
  return {valid: true, events: events.length, reason: null};
}
