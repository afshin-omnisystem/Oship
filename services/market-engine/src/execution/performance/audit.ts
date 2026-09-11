import {PerformanceAuditEvent, PerformanceEventType, PERFORMANCE_EVENT_TYPES} from './types';
import {performanceAuditEventId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — Execution Performance audit log (`oship.execution-performance.v1`).
 *
 * Structured, immutable, hash-chained events for every observable act of the
 * performance intelligence layer: observations, attributions, benchmarks,
 * quality, policy evaluations, optimization, candidates and gate results.
 * The same tamper-evident pattern as the Sprint 032/033 audit logs.
 */

export const EXECUTION_PERFORMANCE_SCHEMA = 'oship.execution-performance.v1' as const;

export interface PerformanceAuditEventInput {
  readonly eventType: PerformanceEventType;
  readonly analysisId: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
}

export const PERFORMANCE_GENESIS_HASH = '0'.repeat(64);

export function buildPerformanceAuditEvent(input: PerformanceAuditEventInput): PerformanceAuditEvent {
  const payloadFingerprint = sha256(input.payload);
  const eventId = performanceAuditEventId({
    type: input.eventType,
    analysisId: input.analysisId,
    sequence: input.sequence,
    payloadFingerprint,
    timestamp: input.timestamp,
  });
  const hash = sha256({previousHash: input.previousHash, eventId, payloadFingerprint});
  return Object.freeze({
    eventId,
    schemaVersion: EXECUTION_PERFORMANCE_SCHEMA,
    eventType: input.eventType,
    timestamp: input.timestamp,
    sequence: input.sequence,
    analysisId: input.analysisId,
    payload: input.payload,
    payloadFingerprint,
    previousHash: input.previousHash,
    hash,
  });
}

/** Append-only audit log with an independently re-derivable chain. */
export class PerformanceAuditLog {
  private readonly events: PerformanceAuditEvent[] = [];
  private previousHash = PERFORMANCE_GENESIS_HASH;

  constructor(private readonly analysisId: string, private readonly timestamp: number) {}

  record(eventType: PerformanceEventType, payload: Readonly<Record<string, unknown>>): PerformanceAuditEvent {
    if (!PERFORMANCE_EVENT_TYPES.includes(eventType)) {
      throw new Error(`unknown performance audit event type ${String(eventType)} — fail closed`);
    }
    const event = buildPerformanceAuditEvent({
      eventType,
      analysisId: this.analysisId,
      timestamp: this.timestamp,
      sequence: this.events.length,
      payload,
      previousHash: this.previousHash,
    });
    this.events.push(event);
    this.previousHash = event.hash;
    return event;
  }

  get eventsView(): readonly PerformanceAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  get head(): string {
    return this.previousHash;
  }
}

/** Independently verify a performance audit stream: re-derive every hash. */
export function verifyPerformanceAuditStream(events: readonly PerformanceAuditEvent[]): boolean {
  let prev = PERFORMANCE_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.sequence !== i) return false;
    if (e.previousHash !== prev) return false;
    if (e.schemaVersion !== EXECUTION_PERFORMANCE_SCHEMA) return false;
    const expected = buildPerformanceAuditEvent({
      eventType: e.eventType,
      analysisId: e.analysisId,
      timestamp: e.timestamp,
      sequence: e.sequence,
      payload: e.payload,
      previousHash: prev,
    });
    if (expected.eventId !== e.eventId) return false;
    if (expected.hash !== e.hash) return false;
    if (expected.payloadFingerprint !== e.payloadFingerprint) return false;
    prev = e.hash;
  }
  return true;
}
