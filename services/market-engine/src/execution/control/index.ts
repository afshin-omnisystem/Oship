/**
 * Sprint 033 — Unified Autonomous Execution Control Plane.
 *
 * One deterministic control engine over the execution stack:
 *   - 12-state control machine with explicit, audited transitions
 *   - per-action budgets + hard limits (explicit exhaustion, never silent)
 *   - precedence-resolved control decisions (safety can never be overridden)
 *   - multi-cycle feedback, oscillation detection, hysteresis
 *   - completion + abort engines (12 canonical abort reasons)
 *   - narrow authority bridges (Risk / AEGIS / Execution — no Treasury,
 *     no Portfolio, no second authority)
 *   - checkpoints, deterministic recovery, byte-equivalent replay
 *   - hash-chained audit + 24 hard invariants, all fail closed
 *
 * Paper/simulation only: there is no exchange, broker or bookmaker
 * connection anywhere in this plane.
 */

export * from './types';
export * from './ids';
export * from './config';
export * from './state';
export * from './budget';
export * from './limits';
export * from './telemetry';
export * from './decision';
export * from './actions';
export * from './safety';
export * from './risk-gate';
export * from './aegis-gate';
export * from './authority-bridge';
export * from './completion';
export * from './abort';
export * from './lineage';
export * from './audit';
export * from './transition';
export * from './controller';
export * from './scheduler';
export * from './checkpoint';
export * from './engine';
export * from './recovery';
export * from './replay';
export * from './invariants';
export * from './test-fixtures';
