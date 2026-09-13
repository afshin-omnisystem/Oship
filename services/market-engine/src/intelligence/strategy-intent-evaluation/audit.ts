/**
 * SPRINT 042 — audit (§20): oship.strategy-intent-evaluation.v1.
 *
 * Append-only, deterministically serialized, hash-chained event log over
 * the evaluation lifecycle. Mutation, tampering, reordering, payload
 * substitution, truncation, extension, foreign events, provenance
 * mismatch, classification mismatch and eligibility mismatch all fail
 * verification.
 */

import type {
  EvaluationAuditEvent, EvaluationEventType,
  EvaluationAuditIdentity, StrategyIntentEvaluationResult,
} from './types';
import {
  EVALUATION_GENESIS_HASH, EVALUATION_SCHEMA_VERSION,
  EVALUATION_EVENT_TYPES, EvaluationRejectionError,
} from './types';
import {canonicalJson, hashOf, evaluationAuditEventIdOf} from './ids';

export interface EvaluationAuditVerification {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly eventCount: number;
}

export class StrategyIntentEvaluationAuditLog {
  private readonly events: EvaluationAuditEvent[] = [];
  private previousHash: string = EVALUATION_GENESIS_HASH;

  constructor(private readonly evaluationId: string,
    private readonly timestamp: number) {}

  append(eventType: EvaluationEventType,
    payload: Readonly<Record<string, unknown>>): EvaluationAuditEvent {
    if (!(EVALUATION_EVENT_TYPES as readonly string[])
      .includes(eventType)) {
      throw new EvaluationRejectionError('AUDIT_INTEGRITY_FAILURE',
        `unknown evaluation event type "${String(eventType)}"`);
    }
    const payloadFingerprint = hashOf(payload);
    const sequence = this.events.length;
    const core: Omit<EvaluationAuditEvent, 'eventId' | 'hash'> = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      eventType,
      timestamp: this.timestamp,
      sequence,
      evaluationId: this.evaluationId,
      payload,
      payloadFingerprint,
      previousHash: this.previousHash,
    };
    const event: EvaluationAuditEvent = Object.freeze({
      ...core,
      eventId: evaluationAuditEventIdOf(core),
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

  snapshot(): readonly EvaluationAuditEvent[] {
    return Object.freeze([...this.events]);
  }
}

/** Chain verification: hashes, ordering, schema, foreign events. */
export function verifyStrategyIntentEvaluationAudit(
  events: readonly EvaluationAuditEvent[],
  expectedCount?: number,
): EvaluationAuditVerification {
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
  let previousHash: string = EVALUATION_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event === null || typeof event !== 'object') {
      return {valid: false, reason: 'audit event is malformed',
        eventCount: i};
    }
    if (event.schemaVersion !== EVALUATION_SCHEMA_VERSION) {
      return {valid: false,
        reason: `event ${String(i)} carries a foreign schema version`,
        eventCount: i + 1};
    }
    if (!(EVALUATION_EVENT_TYPES as readonly string[])
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
      !== evaluationAuditEventIdOf({
        schemaVersion: event.schemaVersion,
        eventType: event.eventType,
        timestamp: event.timestamp,
        sequence: event.sequence,
        evaluationId: event.evaluationId,
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
      evaluationId: event.evaluationId,
      payload: event.payload,
      payloadFingerprint: event.payloadFingerprint,
      previousHash: event.previousHash,
    }})) {
      return {valid: false,
        reason: `event ${String(i)} carries a forged hash`,
        eventCount: i + 1};
    }
    if (event.evaluationId !== events[0].evaluationId) {
      return {valid: false,
        reason: `event ${String(i)} belongs to a foreign evaluation`,
        eventCount: i + 1};
    }
    previousHash = event.hash;
  }
  return {valid: true, reason: null, eventCount: events.length};
}

export interface EvaluationAuditBinding {
  readonly evaluationId: string;
  readonly intentId: string;
  readonly classification: string;
  readonly eligibility: string;
}

/**
 * Binding verification (§20): the recorded classification, eligibility
 * and provenance events must match the final evaluation artifact.
 */
export function verifyEvaluationAuditBinding(
  events: readonly EvaluationAuditEvent[],
  binding: EvaluationAuditBinding,
): EvaluationAuditVerification {
  const chain = verifyStrategyIntentEvaluationAudit(events);
  if (!chain.valid) return chain;
  for (const event of events) {
    if (event.eventType === 'evaluation-started'
      || event.eventType === 'intent-verified') {
      if (event.payload.intentId !== binding.intentId) {
        return {valid: false,
          reason: 'provenance mismatch: the audit chain records a '
            + 'different intent id',
          eventCount: events.length};
      }
    }
    if (event.eventType === 'classification-assigned'
      && event.payload.classification !== binding.classification) {
      return {valid: false,
        reason: 'classification mismatch: the audit chain records a '
          + 'different classification',
        eventCount: events.length};
    }
    if (event.eventType === 'eligibility-assigned'
      && event.payload.eligibility !== binding.eligibility) {
      return {valid: false,
        reason: 'eligibility mismatch: the audit chain records a '
          + 'different eligibility',
        eventCount: events.length};
    }
    if (event.eventType === 'evaluation-built'
      && event.payload.evaluationId !== binding.evaluationId) {
      return {valid: false,
        reason: 'provenance mismatch: the audit chain records a '
          + 'different evaluation id',
        eventCount: events.length};
    }
  }
  return {valid: true, reason: null, eventCount: events.length};
}

export function evaluationAuditIdentityOf(
  evaluationId: string,
  eventCount: number,
  headHash: string,
): EvaluationAuditIdentity {
  return Object.freeze({
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    evaluationId,
    eventCount,
    headHash,
  });
}

/** The audit identity bound into a built evaluation result. */
export function evaluationAuditIdentityOfResult(
  result: StrategyIntentEvaluationResult,
): EvaluationAuditIdentity {
  return evaluationAuditIdentityOf(result.evaluationId,
    result.auditIdentity.eventCount, result.auditIdentity.headHash);
}

export function auditReportPassed(
  report: StrategyIntentEvaluationResult['invariants'],
): boolean {
  return report.passed === true;
}
