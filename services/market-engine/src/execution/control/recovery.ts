import {
  ExecutionControlRunInput, ExecutionControlSession, ControlCheckpoint,
} from './types';
import {ExecutionControlEngine} from './engine';
import {verifyControlCheckpoint} from './ids';

/**
 * Sprint 033 — deterministic checkpoint recovery.
 *
 * Recovery restores EVERY piece of cross-cycle state from a verified
 * checkpoint and resumes at checkpoint.cycleNumber + 1, so no action is ever
 * re-applied. The contract (tested): a recovered run is byte-identical to the
 * uninterrupted run — same cycles, same fingerprints, same final state.
 */
export function recoverControlSession(
  engine: ExecutionControlEngine,
  input: ExecutionControlRunInput,
  checkpoint: ControlCheckpoint,
): ExecutionControlSession {
  if (!verifyControlCheckpoint(checkpoint)) {
    throw new Error('recovery refused: checkpoint fingerprint does not verify — fail closed');
  }
  if (checkpoint.auditEvents.some((e) => e.schemaVersion !== 'oship.execution-control.v1')) {
    throw new Error('recovery refused: foreign audit schema in checkpoint — fail closed');
  }
  return engine.run(input, {resumeFrom: checkpoint});
}

/** Whether two sessions are byte-equivalent (recovery determinism check). */
export function sessionsEquivalent(a: ExecutionControlSession, b: ExecutionControlSession): {
  equivalent: boolean;
  differences: readonly string[];
} {
  const differences: string[] = [];
  if (a.sessionFingerprint !== b.sessionFingerprint) differences.push('sessionFingerprint');
  if (a.currentState !== b.currentState) differences.push('currentState');
  if (a.cycles.length !== b.cycles.length) {
    differences.push(`cycles (${a.cycles.length} vs ${b.cycles.length})`);
  } else {
    for (let i = 0; i < a.cycles.length; i++) {
      if (a.cycles[i].outputFingerprint !== b.cycles[i].outputFingerprint) {
        differences.push(`cycle ${i} outputFingerprint`);
      }
    }
  }
  if (a.auditEvents.length !== b.auditEvents.length) {
    differences.push(`auditEvents (${a.auditEvents.length} vs ${b.auditEvents.length})`);
  } else {
    for (let i = 0; i < a.auditEvents.length; i++) {
      if (a.auditEvents[i].hash !== b.auditEvents[i].hash) differences.push(`audit event ${i} hash`);
    }
  }
  if (JSON.stringify(a.finalResult) !== JSON.stringify(b.finalResult)) differences.push('finalResult');
  return Object.freeze({equivalent: differences.length === 0, differences: Object.freeze(differences)});
}
