import {
  ExecutionIntelligenceAuditEvent,
  ExecutionIntelligenceEventType,
} from './types';
import {auditEventId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 032 — Execution Intelligence Audit.
 *
 * Structured audit events (`oship.execution-intelligence.v1`) for every
 * observable act of the adaptive execution intelligence layer: telemetry,
 * signals, quality, decisions, proposals, rejections, applications, aborts and
 * replays. Events are immutable and hash-chained: each event's hash covers the
 * previous event's hash, so tampering is detectable and the log is replayable.
 */

export const EXECUTION_INTELLIGENCE_SCHEMA = 'oship.execution-intelligence.v1' as const;

export interface AuditEventInput {
  readonly eventType: ExecutionIntelligenceEventType;
  readonly executionPlanId: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
}

/** Build one immutable audit event (hash-chained). */
export function buildAuditEvent(input: AuditEventInput): ExecutionIntelligenceAuditEvent {
  const payloadFingerprint = sha256(input.payload);
  const eventId = auditEventId({type: input.eventType, planId: input.executionPlanId, sequence: input.sequence, payloadFingerprint, timestamp: input.timestamp});
  const hash = sha256({previousHash: input.previousHash, eventId, payloadFingerprint});
  return Object.freeze({
    eventId,
    schemaVersion: EXECUTION_INTELLIGENCE_SCHEMA,
    eventType: input.eventType,
    timestamp: input.timestamp,
    sequence: input.sequence,
    executionPlanId: input.executionPlanId,
    correlationId: input.correlationId,
    traceId: input.traceId,
    payload: Object.freeze({...input.payload}),
    payloadFingerprint,
    previousHash: input.previousHash,
    hash,
  });
}

export const GENESIS_HASH = '0'.repeat(64);

/** Append-only, hash-chained audit log for one intelligence run. */
export class IntelligenceAuditLog {
  private readonly eventList: ExecutionIntelligenceAuditEvent[] = [];
  private previousHash = GENESIS_HASH;
  private sequence = 0;

  constructor(
    private readonly correlationId: string,
    private readonly traceId: string,
  ) {}

  record(eventType: ExecutionIntelligenceEventType, executionPlanId: string, timestamp: number, payload: Readonly<Record<string, unknown>>): ExecutionIntelligenceAuditEvent {
    const event = buildAuditEvent({
      eventType,
      executionPlanId,
      timestamp,
      sequence: this.sequence,
      correlationId: this.correlationId,
      traceId: this.traceId,
      payload,
      previousHash: this.previousHash,
    });
    this.eventList.push(event);
    this.previousHash = event.hash;
    this.sequence += 1;
    return event;
  }

  get events(): readonly ExecutionIntelligenceAuditEvent[] {
    return Object.freeze([...this.eventList]);
  }

  get lastHash(): string {
    return this.previousHash;
  }

  /** Verify the whole chain is intact (no tampering, no reordering). */
  verify(): boolean {
    let prev = GENESIS_HASH;
    for (let i = 0; i < this.eventList.length; i++) {
      const e = this.eventList[i];
      if (e.sequence !== i) return false;
      if (e.previousHash !== prev) return false;
      const expected = buildAuditEvent({
        eventType: e.eventType,
        executionPlanId: e.executionPlanId,
        timestamp: e.timestamp,
        sequence: e.sequence,
        correlationId: e.correlationId,
        traceId: e.traceId,
        payload: e.payload,
        previousHash: prev,
      });
      if (expected.hash !== e.hash || expected.eventId !== e.eventId) return false;
      prev = e.hash;
    }
    return true;
  }
}

/** Event type for a proposal action (audit naming). */
export function proposalEventType(action: 'REPRICE' | 'RESLICE' | 'REROUTE' | 'REPLAN'): ExecutionIntelligenceEventType {
  switch (action) {
    case 'REPRICE': return 'REPRICE_PROPOSED';
    case 'RESLICE': return 'RESLICE_PROPOSED';
    case 'REROUTE': return 'REROUTE_PROPOSED';
    case 'REPLAN': return 'REPLAN_PROPOSED';
  }
}
