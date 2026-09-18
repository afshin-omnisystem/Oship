/**
 * SPRINT 043 — the capital-constraint contract (§5/§9/§10).
 *
 * The bridge TRANSPORTS and VALIDATES constraints supplied by EXISTING
 * authorities (Risk, Portfolio, Allocation, Treasury, Governance). It
 * never calculates, authorizes, relaxes or invents a limit. Unknown
 * constraints stay UNKNOWN — never zero, never unlimited. Conflicted
 * constraints fail closed. Stale constraints are restricted or rejected
 * according to the explicit deterministic policy.
 */

import type {SuppliedCapitalConstraint, CapitalConstraintRecord,
  CapitalConstraintKind, CapitalConstraintUnit,
  CapitalConstraintAuthority, PortfolioDecisionInputConfigSpec,
  EffectiveConstraintStatus,
} from './types';
import {InputRejectionError, CAPITAL_CONSTRAINT_KINDS,
  CAPITAL_CONSTRAINT_AUTHORITIES, CAPITAL_CONSTRAINT_UNITS,
  CAPITAL_CONSTRAINT_KIND_UNITS, EFFECTIVE_CONSTRAINT_STATUSES,
} from './types';
import {inputConstraintIdOf, canonicalJson} from './ids';

/** The kind → allowed-units lookup (fail closed on mismatch). */
const KIND_UNITS = new Map<string, readonly string[]>(
  CAPITAL_CONSTRAINT_KIND_UNITS.map(([kind, units]) =>
    [kind, units]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value);
}

/**
 * §6 lifecycle — capital constraint validation. Returns the immutable,
 * deterministically ordered transported records.
 */
export function validateCapitalConstraints(
  supplied: readonly unknown[],
  inputDomain: 'AFIS' | 'ABL',
  inputTimestamp: number,
  config: PortfolioDecisionInputConfigSpec,
): readonly CapitalConstraintRecord[] {
  const records: CapitalConstraintRecord[] = [];

  for (const raw of supplied) {
    if (!isRecord(raw)) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        'every capital constraint must be an object');
    }
    const constraint = raw as Partial<SuppliedCapitalConstraint>;

    // --- Kind -----------------------------------------------------------
    if (typeof constraint.constraintKind !== 'string'
      || !(CAPITAL_CONSTRAINT_KINDS as readonly string[])
        .includes(constraint.constraintKind)) {
      throw new InputRejectionError('UNKNOWN_CONSTRAINT',
        `unknown capital constraint kind `
          + `${String(constraint.constraintKind)}`);
    }
    const kind = constraint.constraintKind as CapitalConstraintKind;

    // --- Source authority (existing authorities only) --------------------
    if (typeof constraint.sourceAuthority !== 'string'
      || constraint.sourceAuthority.length === 0) {
      throw new InputRejectionError('MISSING_CONSTRAINT_AUTHORITY',
        `constraint ${kind} carries no source authority`);
    }
    if (!(CAPITAL_CONSTRAINT_AUTHORITIES as readonly string[])
      .includes(constraint.sourceAuthority)) {
      throw new InputRejectionError('MISSING_CONSTRAINT_AUTHORITY',
        `constraint ${kind} claims a non-existing authority `
          + `${String(constraint.sourceAuthority)} — only existing `
          + 'authorities may supply constraints');
    }
    const authority =
      constraint.sourceAuthority as CapitalConstraintAuthority;

    // --- Domain and scope -------------------------------------------------
    if (constraint.domain !== 'AFIS' && constraint.domain !== 'ABL'
      && constraint.domain !== 'BOTH') {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} carries an unknown domain `
          + `${String(constraint.domain)}`);
    }
    if (constraint.domain !== 'BOTH'
      && constraint.domain !== inputDomain) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} is scoped to domain `
          + `${String(constraint.domain)} but the input is `
          + `${inputDomain}`);
    }
    if (typeof constraint.scope !== 'string'
      || constraint.scope.length === 0) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} carries no scope`);
    }

    // --- Unit --------------------------------------------------------------
    if (typeof constraint.unit !== 'string'
      || !(CAPITAL_CONSTRAINT_UNITS as readonly string[])
        .includes(constraint.unit)) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} carries an unknown unit `
          + `${String(constraint.unit)}`);
    }
    const unit = constraint.unit as CapitalConstraintUnit;
    const allowedUnits = KIND_UNITS.get(kind) ?? [];
    if (!allowedUnits.includes(unit)) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} cannot carry unit ${unit}`);
    }

    // --- Status and value (§10 — unknown is never zero/unlimited) ----------
    if (constraint.status !== 'KNOWN'
      && constraint.status !== 'UNKNOWN'
      && constraint.status !== 'NOT_APPLICABLE') {
      throw new InputRejectionError('UNKNOWN_CONSTRAINT',
        `constraint ${kind} carries an unknown supplied status `
          + `${String(constraint.status)}`);
    }
    const suppliedStatus = constraint.status;
    const value = constraint.value ?? null;
    if (suppliedStatus === 'KNOWN') {
      if (unit === 'NONE') {
        if (value !== null) {
          throw new InputRejectionError('CONSTRAINT_MISMATCH',
            `constraint ${kind} carries unit NONE but a value — `
              + 'declarative restrictions carry no numeric value');
        }
      } else {
        if (typeof value !== 'number' || !Number.isFinite(value)
          || value < 0) {
          throw new InputRejectionError('CONSTRAINT_MISMATCH',
            `constraint ${kind} is KNOWN but carries no finite `
              + 'non-negative value');
        }
        if (unit === 'FRACTION' && value > 1) {
          throw new InputRejectionError('CONSTRAINT_MISMATCH',
            `constraint ${kind} carries a fraction above 1`);
        }
      }
    } else if (suppliedStatus === 'UNKNOWN') {
      if (value !== null) {
        throw new InputRejectionError('UNKNOWN_CONSTRAINT',
          `constraint ${kind} is UNKNOWN but carries a value — `
            + 'unknown capacity is never zero, never a number');
      }
    } else {
      if (value !== null) {
        throw new InputRejectionError('CONSTRAINT_MISMATCH',
          `constraint ${kind} is NOT_APPLICABLE but carries a value`);
      }
    }

    // --- Context and reason -------------------------------------------------
    if (typeof constraint.contextTimestamp !== 'number'
      || !Number.isFinite(constraint.contextTimestamp)) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} carries no finite context timestamp`);
    }
    if (typeof constraint.reason !== 'string'
      || constraint.reason.length === 0) {
      throw new InputRejectionError('CONSTRAINT_MISMATCH',
        `constraint ${kind} carries no reason`);
    }

    records.push(buildRecord(constraint as SuppliedCapitalConstraint,
      inputTimestamp, config));
  }

  // --- Conflict detection (same kind + scope, different content) ----------
  const groups = new Map<string, CapitalConstraintRecord[]>();
  for (const record of records) {
    const key = `${record.constraintKind}|${record.scope}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  for (const [, group] of [...groups.entries()].sort(([a], [b]) =>
    a < b ? -1 : 1)) {
    if (group.length < 2) continue;
    const signatures = new Set(group.map((record) =>
      canonicalJson({unit: record.unit, value: record.value,
        status: record.suppliedStatus})));
    if (signatures.size > 1) {
      throw new InputRejectionError('CONFLICTED_CONSTRAINT',
        `constraints for ${group[0].constraintKind} scope `
          + `${group[0].scope} disagree — fail closed`);
    }
  }

  // --- Deterministic canonical order ----------------------------------------
  return Object.freeze(records
    .map((record, index) => ({record, index}))
    .sort((a, b) => {
      const keyA = `${a.record.constraintKind}|${a.record.domain}|${
        a.record.scope}|${a.record.constraintId}`;
      const keyB = `${b.record.constraintKind}|${b.record.domain}|${
        b.record.scope}|${b.record.constraintId}`;
      if (keyA === keyB) return a.index - b.index;
      return keyA < keyB ? -1 : 1;
    })
    .map((entry) => entry.record));
}

function buildRecord(supplied: SuppliedCapitalConstraint,
  inputTimestamp: number,
  config: PortfolioDecisionInputConfigSpec,
): CapitalConstraintRecord {
  let status: EffectiveConstraintStatus = supplied.status;
  const reasonExtensions: string[] = [];
  if (supplied.status === 'UNKNOWN') {
    reasonExtensions.push('capacity is unknown — never zero, never '
      + 'unlimited; the downstream authority must supply or deny it');
  }
  if (supplied.status === 'NOT_APPLICABLE') {
    reasonExtensions.push('the constraint does not apply to this '
      + 'input by its authority\'s declaration');
  }
  const stale = supplied.contextTimestamp + config.maxConstraintAgeMs
    < inputTimestamp;
  if (stale) {
    if (config.staleConstraintPolicy === 'REJECT') {
      throw new InputRejectionError('STALE_CONSTRAINT',
        `constraint ${supplied.constraintKind} scope `
          + `${supplied.scope} is stale (context `
          + `${String(supplied.contextTimestamp)} vs input `
          + `${String(inputTimestamp)}) — policy REJECT fails closed`);
    }
    status = 'STALE';
    reasonExtensions.push('the constraint context is stale — carried '
      + 'as a restriction, never as fresh capacity');
  }
  const record: CapitalConstraintRecord = {
    constraintId: inputConstraintIdOf({
      constraintKind: supplied.constraintKind,
      sourceAuthority: supplied.sourceAuthority,
      domain: supplied.domain,
      scope: supplied.scope,
      value: supplied.value,
      unit: supplied.unit,
      status: supplied.status,
      contextTimestamp: supplied.contextTimestamp,
      reason: supplied.reason,
    }),
    constraintKind: supplied.constraintKind,
    sourceAuthority: supplied.sourceAuthority,
    domain: supplied.domain,
    scope: supplied.scope,
    value: supplied.value,
    unit: supplied.unit,
    suppliedStatus: supplied.status,
    status,
    provenance: {
      sourceAuthority: supplied.sourceAuthority,
      contextTimestamp: supplied.contextTimestamp,
      suppliedByExistingAuthority: true,
    },
    reason: Object.freeze([supplied.reason, ...reasonExtensions]
      .join(' — ')),
    restrictions: Object.freeze(status === 'STALE'
      ? ['DOWNSTREAM_CONSIDERATION_ONLY', 'NO_DECISION_AUTHORITY']
      : supplied.status === 'UNKNOWN'
        ? ['DOWNSTREAM_CONSIDERATION_ONLY', 'CAPACITY_UNKNOWN']
        : ['DOWNSTREAM_CONSIDERATION_ONLY']),
    informational: true,
  };
  if (!(EFFECTIVE_CONSTRAINT_STATUSES as readonly string[])
    .includes(record.status)) {
    throw new InputRejectionError('CONSTRAINT_MISMATCH',
      `constraint ${record.constraintKind} computed an invalid `
        + `effective status ${String(record.status)}`);
  }
  return Object.freeze(record);
}

/** The audit-facing constraint summary (§19 — constraint mismatch). */
export function constraintSummaryOf(
  records: readonly CapitalConstraintRecord[],
): readonly {constraintId: string; kind: string; status: string;
  value: number | null}[] {
  return Object.freeze(records.map((record) => Object.freeze({
    constraintId: record.constraintId,
    kind: record.constraintKind,
    status: record.status,
    value: record.value,
  })));
}

/** §10 — safety summaries over the transported set. */
export function constraintSafetyOf(
  records: readonly CapitalConstraintRecord[],
): {readonly unknownCount: number; readonly staleCount: number;
  readonly knownCount: number; readonly notApplicableCount: number} {
  let unknownCount = 0;
  let staleCount = 0;
  let knownCount = 0;
  let notApplicableCount = 0;
  for (const record of records) {
    if (record.status === 'UNKNOWN') unknownCount += 1;
    else if (record.status === 'STALE') staleCount += 1;
    else if (record.status === 'KNOWN') knownCount += 1;
    else if (record.status === 'NOT_APPLICABLE') notApplicableCount += 1;
  }
  return {unknownCount, staleCount, knownCount, notApplicableCount};
}
