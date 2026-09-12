import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkAuthorityBoundary, AUTHORITY_VERBS,
  FORBIDDEN_PACKAGE_KEYS, PROTECTED_AUTHORITIES} from '../authority-check';
import {
  liqDominantDecisionResult, AUTHORITY_BYPASS_ANNOTATIONS,
  CLEAN_ANNOTATIONS, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — authority check tests: Strategy/AEGIS/Treasury/Execution/
 * Portfolio/Risk/Allocation boundaries and bypass rejection.
 */

test('a clean decision result respects every boundary', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  assert.equal(check.state, 'BOUNDARY_RESPECTED');
  assert.equal(check.code, null);
  assert.equal(check.reasons.length, 0);
});

test('clean annotations keep the boundary respected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    CLEAN_ANNOTATIONS);
  assert.equal(check.state, 'BOUNDARY_RESPECTED');
});

test('every authority-bypass annotation violates the boundary', () => {
  for (const annotation of AUTHORITY_BYPASS_ANNOTATIONS) {
    const check = checkAuthorityBoundary(liqDominantDecisionResult(),
      [annotation]);
    assert.equal(check.state, 'BOUNDARY_VIOLATED',
      `annotation "${annotation}" did not violate`);
    assert.equal(check.code, 'AUTHORITY_BYPASS');
  }
});

test('authorize-execution annotations are rejected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['authorize execution on venue-a']);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
  assert.match(check.reasons.join(' '), /authority action/);
});

test('approve annotations are rejected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['approve the capital release']);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
});

test('allocate annotations are rejected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['allocate 5000 to this opportunity']);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
});

test('transfer/withdraw annotations are rejected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['transfer funds to the exchange', 'withdraw profits after the trade']);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
  assert.ok(check.reasons.length >= 2);
});

test('bypass-AEGIS annotations are rejected', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['bypass AEGIS for this handoff']);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
});

test('a decision result with an order key violates the boundary', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.recommendation as unknown as Record<string, unknown>).order
      = {venue: 'venue-a', qty: 5};
  });
  const check = checkAuthorityBoundary(mutated, []);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
  assert.equal(check.code, 'INVALID_STRATEGY_BOUNDARY');
});

test('a decision result with credentials violates the boundary', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.context as unknown as Record<string, unknown>).apiKey
      = 'super-secret';
  });
  const check = checkAuthorityBoundary(mutated, []);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
});

test('the check protects exactly the seven authorities', () => {
  assert.deepEqual([...PROTECTED_AUTHORITIES], ['Strategy Registry',
    'AEGIS', 'Treasury', 'Execution', 'Portfolio', 'Risk', 'Allocation']);
});

test('the check runs four explicit checks', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  assert.equal(check.checks.length, 4);
  for (const entry of check.checks) {
    assert.equal(entry.passed, true, entry.detail);
  }
});

test('a non-informational decision violates the boundary', () => {
  const mutated = governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.recommendation as {informational?: boolean}).informational
      = false;
  });
  const check = checkAuthorityBoundary(mutated, []);
  assert.equal(check.state, 'BOUNDARY_VIOLATED');
});

test('the check result is immutable with content-derived ids', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  assert.ok(Object.isFrozen(check));
  assert.ok(check.authorityCheckId.startsWith('gaut_'));
  assert.ok(check.contentFingerprint.startsWith('gcfp_'));
});

test('identical inputs yield identical authority checks', () => {
  const a = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  const b = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  assert.equal(a.authorityCheckId, b.authorityCheckId);
});

test('AUTHORITY_VERBS matches authority language', () => {
  assert.ok(AUTHORITY_VERBS.test('authorize it'));
  assert.ok(AUTHORITY_VERBS.test('approve this'));
  assert.ok(AUTHORITY_VERBS.test('execute now'));
  assert.ok(AUTHORITY_VERBS.test('withdraw funds'));
  assert.ok(!AUTHORITY_VERBS.test('evidence review requested'));
  assert.ok(!AUTHORITY_VERBS.test('strategy review scheduled'));
});

test('FORBIDDEN_PACKAGE_KEYS matches command and credential keys', () => {
  assert.ok(FORBIDDEN_PACKAGE_KEYS.test('{"order":{"a":1}}'));
  assert.ok(FORBIDDEN_PACKAGE_KEYS.test('{"instruction":"x"}'));
  assert.ok(FORBIDDEN_PACKAGE_KEYS.test('{"apiKey":"k"}'));
  assert.ok(FORBIDDEN_PACKAGE_KEYS.test('{"treasuryCommand":{}}'));
  assert.ok(!FORBIDDEN_PACKAGE_KEYS.test('{"ranking":[]}'));
  assert.ok(!FORBIDDEN_PACKAGE_KEYS.test('{"restrictions":[]}'));
});

test('the real decision result carries no forbidden keys', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(), []);
  const keyCheck = check.checks.find(
    (c) => c.check === 'no-command-or-credential-keys');
  assert.ok(keyCheck?.passed);
});

test('blocked boundaries carry explicit reasons', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['authorize execution now']);
  assert.ok(check.reasons.length > 0);
  assert.match(check.reasons[0], /authority action/);
});

test('the authority check never returns a generic reason', () => {
  const check = checkAuthorityBoundary(liqDominantDecisionResult(),
    ['halt the strategy on conflict']);
  assert.ok(check.reasons.length > 0);
  assert.ok(!check.reasons[0].includes('not recommended'));
});
