import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, hashOf, fingerprintOf, inputIdOf, inputContextIdOf,
  inputConstraintIdOf, inputEvidenceIdOf, inputDependencyIdOf,
  inputRestrictionIdOf, inputResearchIdOf, inputResearchContextIdOf,
  inputFeedbackIdOf, inputProvenanceIdOf, inputExplanationIdOf,
  inputBoundaryIdOf, inputAuditEventIdOf, inputFingerprintOf,
  inputConfigFingerprint,
} from '../ids';
import {validateInputConfig, mergeInputConfig, DEFAULT_INPUT_CONFIG,
  INPUT_CONFIG_KEYS,
} from '../config';
import {assertInputRejects} from '../test-fixtures';

/** SPRINT 043 — deterministic identity and configuration (§17/§18). */

test('ids: canonicalJson sorts object keys recursively', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}');
  assert.equal(canonicalJson({z: {d: 1, c: 2}, a: [3, 1]}),
    '{"a":[3,1],"z":{"c":2,"d":1}}');
});

test('ids: canonicalJson is key-order independent', () => {
  const a = {x: 1, y: {b: 2, a: 3}};
  const b = {y: {a: 3, b: 2}, x: 1};
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('ids: canonicalJson preserves array order (arrays are ordered)', () => {
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test('ids: canonicalJson drops undefined values', () => {
  assert.equal(canonicalJson({a: undefined, b: 1}), '{"b":1}');
});

test('ids: canonicalJson serializes null and primitives', () => {
  assert.equal(canonicalJson(null), 'null');
  assert.equal(canonicalJson(42), '42');
  assert.equal(canonicalJson('x'), '"x"');
  assert.equal(canonicalJson(true), 'true');
});

test('ids: hashOf is a stable SHA-256 hex digest', () => {
  assert.equal(hashOf({a: 1, b: 2}), hashOf({b: 2, a: 1}));
  assert.match(hashOf({a: 1}), /^[0-9a-f]{64}$/);
  assert.notEqual(hashOf({a: 1}), hashOf({a: 2}));
});

test('ids: fingerprintOf prefixes and truncates to 24 hex chars', () => {
  const fingerprint = fingerprintOf('pdi', {a: 1});
  assert.match(fingerprint, /^pdi_[0-9a-f]{24}$/);
  assert.equal(fingerprint, fingerprintOf('pdi', {a: 1}));
});

test('ids: every id helper carries its own namespace prefix', () => {
  assert.match(inputIdOf({a: 1}), /^pdi_/);
  assert.match(inputContextIdOf({a: 1}), /^pdctx_/);
  assert.match(inputConstraintIdOf({a: 1}), /^pdcon_/);
  assert.match(inputEvidenceIdOf({a: 1}), /^pdev_/);
  assert.match(inputDependencyIdOf({a: 1}), /^pddp_/);
  assert.match(inputRestrictionIdOf({a: 1}), /^pdres_/);
  assert.match(inputResearchIdOf({a: 1}), /^pdrsc_/);
  assert.match(inputResearchContextIdOf({a: 1}), /^pdrcx_/);
  assert.match(inputFeedbackIdOf({a: 1}), /^pdfdb_/);
  assert.match(inputProvenanceIdOf({a: 1}), /^pdprv_/);
  assert.match(inputExplanationIdOf({a: 1}), /^pdexp_/);
  assert.match(inputBoundaryIdOf({a: 1}), /^pdbnd_/);
  assert.match(inputAuditEventIdOf({a: 1}), /^pdea_/);
  assert.match(inputFingerprintOf({a: 1}), /^pdfp_/);
  assert.match(inputConfigFingerprint({a: 1}), /^pdcfg_/);
});

test('ids: identical content produces identical ids', () => {
  assert.equal(inputIdOf({a: [1, 2], b: 'x'}),
    inputIdOf({b: 'x', a: [1, 2]}));
});

test('ids: different content produces different ids', () => {
  assert.notEqual(inputIdOf({a: 1}), inputIdOf({a: 2}));
  assert.notEqual(inputConstraintIdOf({scope: 'x'}),
    inputConstraintIdOf({scope: 'y'}));
});

test('ids: numeric serialization is canonical', () => {
  assert.equal(canonicalJson({n: 0.5}), '{"n":0.5}');
  assert.equal(canonicalJson({n: 1e21}), '{"n":1e+21}');
});

test('config: the default config is frozen and versioned', () => {
  assert.equal(Object.isFrozen(DEFAULT_INPUT_CONFIG), true);
  assert.equal(DEFAULT_INPUT_CONFIG.schemaVersion,
    'portfolio-decision-input.config.v1');
  assert.equal(DEFAULT_INPUT_CONFIG.maxAnnotations, 16);
  assert.equal(DEFAULT_INPUT_CONFIG.maxCapitalConstraints, 32);
  assert.equal(DEFAULT_INPUT_CONFIG.maxConstraintAgeMs, 3_600_000);
  assert.equal(DEFAULT_INPUT_CONFIG.staleConstraintPolicy, 'RESTRICT');
});

test('config: INPUT_CONFIG_KEYS lists the tunable keys', () => {
  assert.deepEqual([...INPUT_CONFIG_KEYS], ['maxAnnotations',
    'maxCapitalConstraints', 'maxConstraintAgeMs',
    'staleConstraintPolicy']);
});

test('config: validateInputConfig accepts the defaults', () => {
  assert.doesNotThrow(() => validateInputConfig(DEFAULT_INPUT_CONFIG));
});

test('config: validateInputConfig rejects a null config', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputConfig(null));
});

test('config: validateInputConfig rejects an array config', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputConfig([1, 2, 3]));
});

test('config: validateInputConfig rejects a foreign schema version',
  () => {
    assertInputRejects('INVALID_INPUT_CONTEXT', () =>
      validateInputConfig({...DEFAULT_INPUT_CONFIG,
        schemaVersion: 'foreign.v9'}));
  });

test('config: maxAnnotations must be an integer within bounds', () => {
  for (const bad of [0, -1, 1.5, 65, Number.NaN]) {
    assertInputRejects('INVALID_INPUT_CONTEXT', () =>
      validateInputConfig({...DEFAULT_INPUT_CONFIG,
        maxAnnotations: bad}));
  }
  assert.doesNotThrow(() =>
    validateInputConfig({...DEFAULT_INPUT_CONFIG, maxAnnotations: 1}));
  assert.doesNotThrow(() =>
    validateInputConfig({...DEFAULT_INPUT_CONFIG, maxAnnotations: 64}));
});

test('config: maxCapitalConstraints must be an integer within bounds',
  () => {
    for (const bad of [0, -1, 2.5, 257]) {
      assertInputRejects('INVALID_INPUT_CONTEXT', () =>
        validateInputConfig({...DEFAULT_INPUT_CONFIG,
          maxCapitalConstraints: bad}));
    }
    assert.doesNotThrow(() =>
      validateInputConfig({...DEFAULT_INPUT_CONFIG,
        maxCapitalConstraints: 256}));
  });

test('config: maxConstraintAgeMs must be a positive integer', () => {
  for (const bad of [0, -5, 1.5]) {
    assertInputRejects('INVALID_INPUT_CONTEXT', () =>
      validateInputConfig({...DEFAULT_INPUT_CONFIG,
        maxConstraintAgeMs: bad}));
  }
  assert.doesNotThrow(() =>
    validateInputConfig({...DEFAULT_INPUT_CONFIG,
      maxConstraintAgeMs: 1}));
});

test('config: staleConstraintPolicy must be RESTRICT or REJECT', () => {
  assertInputRejects('INVALID_INPUT_CONTEXT', () =>
    validateInputConfig({...DEFAULT_INPUT_CONFIG,
      staleConstraintPolicy: 'IGNORE'}));
  assert.doesNotThrow(() =>
    validateInputConfig({...DEFAULT_INPUT_CONFIG,
      staleConstraintPolicy: 'REJECT'}));
});

test('config: mergeInputConfig re-stamps the schema version', () => {
  const merged = mergeInputConfig({schemaVersion: 'foreign.v9',
    maxAnnotations: 4} as never);
  assert.equal(merged.schemaVersion,
    'portfolio-decision-input.config.v1');
  assert.equal(merged.maxAnnotations, 4);
});

test('config: mergeInputConfig ignores unknown keys', () => {
  const merged = mergeInputConfig({unexpected: true as never} as never);
  assert.deepEqual(merged, DEFAULT_INPUT_CONFIG);
});

test('config: mergeInputConfig returns a frozen config', () => {
  assert.equal(Object.isFrozen(mergeInputConfig({})), true);
});

test('config: merged configs are deterministic', () => {
  assert.deepEqual(mergeInputConfig({maxAnnotations: 2}),
    mergeInputConfig({maxAnnotations: 2}));
});
