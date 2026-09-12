/**
 * SPRINT 040 — hash-chained audit log `oship.decision-governance.v1` (§18).
 *
 * Exactly the 16 canonical event types; GENESIS-rooted SHA-256 chaining;
 * append-only; tampering, payload substitution, reordering, truncation
 * (with expected count) and extension all fail verification.
 */

import {createHash} from 'node:crypto';
import {GOVERNANCE_EVENT_TYPES, GOVERNANCE_GENESIS_HASH} from './types';
import type {GovernanceAuditEvent, GovernanceEventType} from './types';
import {governanceAuditEventIdOf, canonicalJson, learningHash} from './ids';

export class GovernanceAuditLog {
  private readonly events: GovernanceAuditEvent[] = [];
  private previousHash = GOVERNANCE_GENESIS_HASH;

  constructor(
    private readonly governanceId: string,
    private readonly timestamp: number,
  ) {}

  append(
    eventType: GovernanceEventType,
    payload: Readonly<Record<string, unknown>>,
  ): GovernanceAuditEvent {
    if (!GOVERNANCE_EVENT_TYPES.includes(eventType)) {
      throw new Error(`decision-governance audit: unknown event type `
        + `"${eventType}" — fail closed`);
    }
    const sequence = this.events.length;
    const eventId = governanceAuditEventIdOf({
      governanceId: this.governanceId, sequence, eventType, payload});
    const payloadFingerprint = learningHash(payload);
    const event: GovernanceAuditEvent = Object.freeze({
      schemaVersion: 'oship.decision-governance.v1',
      eventId,
      eventType,
      timestamp: this.timestamp,
      sequence,
      governanceId: this.governanceId,
      payload,
      payloadFingerprint,
      previousHash: this.previousHash,
      hash: '',
    });
    const hash = createHash('sha256').update(canonicalJson({
      schemaVersion: event.schemaVersion, eventId, eventType: event.eventType,
      timestamp: event.timestamp, sequence, governanceId: event.governanceId,
      payload, payloadFingerprint, previousHash: event.previousHash,
    })).digest('hex');
    const sealed = Object.freeze({...event, hash});
    this.events.push(sealed);
    this.previousHash = hash;
    return sealed;
  }

  snapshot(): readonly GovernanceAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  get length(): number {
    return this.events.length;
  }

  get headHash(): string {
    return this.events.length === 0 ? GOVERNANCE_GENESIS_HASH
      : this.events[this.events.length - 1].hash;
  }
}

export interface GovernanceAuditVerification {
  readonly valid: boolean;
  readonly events: number;
  readonly reason: string | null;
}

export function verifyGovernanceAudit(
  events: readonly GovernanceAuditEvent[],
  expectedCount?: number,
): GovernanceAuditVerification {
  if (events.length === 0) {
    return {valid: false, events: 0,
      reason: 'decision-governance audit chain is empty'};
  }
  if (expectedCount !== undefined && events.length !== expectedCount) {
    return {valid: false, events: events.length,
      reason: `decision-governance audit chain has ${events.length} events — `
        + `expected ${expectedCount} (truncation or extension)`};
  }
  let previousHash = GOVERNANCE_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.schemaVersion !== 'oship.decision-governance.v1') {
      return {valid: false, events: events.length,
        reason: `event ${i} has schema ${String(e.schemaVersion)} — foreign `
          + 'event detected'};
    }
    if (e.sequence !== i) {
      return {valid: false, events: events.length,
        reason: `event ${i} has sequence ${String(e.sequence)} — reordering `
          + 'detected'};
    }
    if (e.previousHash !== previousHash) {
      return {valid: false, events: events.length,
        reason: `event ${i} breaks the hash chain — tampering detected`};
    }
    const expectedFingerprint = learningHash(e.payload);
    if (e.payloadFingerprint !== expectedFingerprint) {
      return {valid: false, events: events.length,
        reason: `event ${i} payload fingerprint mismatch — substitution `
          + 'detected'};
    }
    const expectedHash = createHash('sha256').update(canonicalJson({
      schemaVersion: e.schemaVersion, eventId: e.eventId,
      eventType: e.eventType, timestamp: e.timestamp, sequence: e.sequence,
      governanceId: e.governanceId, payload: e.payload,
      payloadFingerprint: e.payloadFingerprint, previousHash: e.previousHash,
    })).digest('hex');
    if (e.hash !== expectedHash) {
      return {valid: false, events: events.length,
        reason: `event ${i} hash mismatch — tampering detected`};
    }
    previousHash = e.hash;
  }
  return {valid: true, events: events.length, reason: null};
}
