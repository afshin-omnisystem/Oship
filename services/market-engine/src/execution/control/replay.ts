import {
  ExecutionControlRunInput, ExecutionControlSession, ControlAuditEvent,
} from './types';
import {ExecutionControlEngine} from './engine';
import {buildControlAuditEvent, CONTROL_GENESIS_HASH} from './audit';

/**
 * Sprint 033 — deterministic session replay.
 *
 * Re-running the SAME control input reproduces the SAME session
 * byte-for-byte: identical cycles, identical audit chain, identical
 * sessionFingerprint. Two replays of the same input are byte-identical to
 * each other. The replay verifier re-derives every audit event hash and
 * compares the full event stream.
 */
export interface ReplayVerification {
  readonly equivalent: boolean;
  readonly differences: readonly string[];
  readonly replayedSessionFingerprint: string;
}

export function replayControlSession(
  engine: ExecutionControlEngine,
  input: ExecutionControlRunInput,
  original?: ExecutionControlSession,
): {session: ExecutionControlSession; verification: ReplayVerification} {
  const session = engine.run(input);
  const differences: string[] = [];

  if (original) {
    if (session.sessionFingerprint !== original.sessionFingerprint) differences.push('sessionFingerprint');
    if (session.cycles.length !== original.cycles.length) {
      differences.push(`cycles (${session.cycles.length} vs ${original.cycles.length})`);
    } else {
      for (let i = 0; i < session.cycles.length; i++) {
        if (session.cycles[i].outputFingerprint !== original.cycles[i].outputFingerprint) {
          differences.push(`cycle ${i} outputFingerprint`);
        }
      }
    }
    if (session.auditEvents.length !== original.auditEvents.length) {
      differences.push(`auditEvents (${session.auditEvents.length} vs ${original.auditEvents.length})`);
    } else {
      for (let i = 0; i < session.auditEvents.length; i++) {
        if (session.auditEvents[i].hash !== original.auditEvents[i].hash) differences.push(`audit event ${i} hash`);
      }
    }
    if (JSON.stringify(session.finalResult) !== JSON.stringify(original.finalResult)) differences.push('finalResult');
  }

  return {
    session,
    verification: Object.freeze({
      equivalent: differences.length === 0,
      differences: Object.freeze(differences),
      replayedSessionFingerprint: session.sessionFingerprint,
    }),
  };
}

/**
 * Verify an audit event stream independently: re-derive every hash from the
 * genesis and compare. Tamper-evident and deterministic.
 */
export function verifyAuditStream(events: readonly ControlAuditEvent[]): boolean {
  let prev = CONTROL_GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
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
