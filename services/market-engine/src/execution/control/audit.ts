import {ControlAuditEvent, ControlEventType} from './types';
import {controlAuditEventId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 033 — Execution Control Audit.
 *
 * Structured audit events (`oship.execution-control.v1`) for every observable
 * act of the autonomous control plane: session lifecycle, state transitions,
 * cycle completions, decisions, applied/rejected actions, checkpoints,
 * recovery, terminal states and replays. Events are immutable and
 * hash-chained (each event's hash covers the previous event's hash) — the
 * same tamper-evident pattern as the Sprint 032 intelligence audit.
 */

export const EXECUTION_CONTROL_SCHEMA = 'oship.execution-control.v1' as const;

export interface ControlAuditEventInput {
  readonly eventType: ControlEventType;
  readonly sessionId: string;
  readonly executionPlanId: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
}

export const CONTROL_GENESIS_HASH = '0'.repeat(64);

/** Build one immutable control audit event (hash-chained). */
export function buildControlAuditEvent(input: ControlAuditEventInput): ControlAuditEvent {
  const payloadFingerprint = sha256(input.payload);
  const eventId = controlAuditEventId({
    type: input.eventType,
    sessionId: input.sessionId,
    sequence: input.sequence,
    payloadFingerprint,
    timestamp: input.timestamp,
  });
  const hash = sha256({previousHash: input.previousHash, eventId, payloadFingerprint});
  return Object.freeze({
    eventId,
    schemaVersion: EXECUTION_CONTROL_SCHEMA,
    eventType: input.eventType,
    timestamp: input.timestamp,
    sequence: input.sequence,
    executionPlanId: input.executionPlanId,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
    traceId: input.traceId,
    payload: Object.freeze({...input.payload}),
    payloadFingerprint,
    previousHash: input.previousHash,
    hash,
  });
}

/**
 * Append-only, hash-chained control audit log for one control session.
 * `restore` resumes the chain from a checkpoint (recovery) without breaking
 * the hash chain or the sequence numbering.
 */
export class ControlAuditLog {
  private readonly eventList: ControlAuditEvent[] = [];
  private previousHash: string;
  private sequence: number;

  constructor(
    private readonly sessionId: string,
    private readonly correlationId: string,
    private readonly traceId: string,
    restore?: {events: readonly ControlAuditEvent[]},
  ) {
    if (restore && restore.events.length > 0) {
      for (const e of restore.events) this.eventList.push(e);
      this.previousHash = restore.events[restore.events.length - 1].hash;
      this.sequence = restore.events.length;
    } else {
      this.previousHash = CONTROL_GENESIS_HASH;
      this.sequence = 0;
    }
  }

  record(
    eventType: ControlEventType,
    executionPlanId: string,
    timestamp: number,
    payload: Readonly<Record<string, unknown>>,
  ): ControlAuditEvent {
    const event = buildControlAuditEvent({
      eventType,
      sessionId: this.sessionId,
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

  get events(): readonly ControlAuditEvent[] {
    return Object.freeze([...this.eventList]);
  }

  get lastHash(): string {
    return this.previousHash;
  }

  /** Verify the whole chain is intact (no tampering, no reordering). */
  verify(): boolean {
    let prev = CONTROL_GENESIS_HASH;
    for (let i = 0; i < this.eventList.length; i++) {
      const e = this.eventList[i];
      if (e.sequence !== i) return false;
      if (e.previousHash !== prev) return false;
      const expected = buildControlAuditEvent({
        eventType: e.eventType,
        sessionId: e.sessionId,
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
