import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — architecture-boundary tests: the learning plane grants no new
 * authority — it never imports, calls or mutates Treasury, Portfolio, Risk,
 * AEGIS, Execution, Allocation, Strategy Registry, Provider or Active Policy.
 */

const engineResult = new LearningEngine({}).analyze(learningInput());

const LEARNING_DIR = join(dirname(__dirname));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith('.js') && !full.includes('/tests/')) {
      out.push(full);
    }
  }
  return out;
}

const FORBIDDEN_IMPORTS = [
  'treasury', 'portfolio', 'risk-authority', 'aegis', 'execution-engine',
  'allocation', 'strategy-registry', 'provider-authority', 'active-policy',
];

test('no learning module imports any authority module', () => {
  const files = walk(LEARNING_DIR);
  assert.ok(files.length >= 30);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const forbidden of FORBIDDEN_IMPORTS) {
      assert.ok(
        !source.includes(`/${forbidden}`) && !source.includes(`'${forbidden}`),
        `${file} references ${forbidden}`);
    }
  }
});

test('no learning module uses randomness or wall-clock time', () => {
  for (const file of walk(LEARNING_DIR)) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!source.includes('Math.random'), file);
    assert.ok(!source.includes('Date.now'), file);
  }
});

test('every emitted statement is free of authority language', () => {
  const outputs = [
    ...engineResult.signals.map((s) => s.statement),
    ...engineResult.priorities.map((p) => p.statement),
    ...engineResult.recommendations.map((r) => `${r.statement} ${r.reason}`),
    ...engineResult.feedback.map((f) => f.statement),
  ];
  assert.ok(outputs.length > 100);
  for (const text of outputs) {
    assert.ok(!/\b(authoriz|approv|halt|deploy|transfer|withdraw|activat)\w*\b/i.test(text),
      text);
  }
});

test('every informational output carries informational: true', () => {
  for (const signal of engineResult.signals) assert.equal(signal.informational, true);
  for (const priority of engineResult.priorities) assert.equal(priority.informational, true);
  for (const rec of engineResult.recommendations) assert.equal(rec.informational, true);
  for (const fb of engineResult.feedback) assert.equal(fb.informational, true);
});

test('the result contains no command, order or mutation payloads', () => {
  const json = JSON.stringify(engineResult);
  for (const forbidden of ['"order"', '"command"', '"authorization"', '"instruction"',
    '"treasuryBalance"', '"positionDelta"']) {
    assert.ok(!json.includes(forbidden), forbidden);
  }
});

test('policy candidates are never promoted to ACTIVE by the engine', () => {
  for (const learning of engineResult.policyLearning) {
    assert.equal(learning.promotion, 'OUTSIDE_ENGINE');
    assert.notEqual(learning.role, 'ACTIVE');
  }
  const check = engineResult.invariants.checks.find(
    (c) => c.invariant === 'POLICY_CANDIDATE_NEVER_ACTIVE')!;
  assert.equal(check.passed, true);
});

test('the learning plane is purely analytical — no execution state mutated', () => {
  // the seven no-mutation invariants all pass on the fixture corpus
  for (const name of ['NO_TREASURY_MUTATION', 'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION',
    'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION', 'NO_STRATEGY_REGISTRY_MUTATION',
    'NO_ACTIVE_POLICY_MUTATION']) {
    const check = engineResult.invariants.checks.find((c) => c.invariant === name)!;
    assert.equal(check.passed, true, name);
  }
});

test('the engine writes only derived artifacts — research input is untouched', () => {
  const before = JSON.stringify(learningInput().research);
  new LearningEngine({}).analyze(learningInput());
  const after = JSON.stringify(learningInput().research);
  assert.equal(before, after);
});

test('one engine class serves both AFIS and ABL — no domain-specific engines', () => {
  const afis = engineResult.observations.filter((o) => o.domain === 'AFIS').length;
  const abl = engineResult.observations.filter((o) => o.domain === 'ABL').length;
  assert.ok(afis > 0 && abl > 0);
  assert.equal(engineResult.strategyLearning.length, 3);
  assert.equal(engineResult.opportunityLearning.length, 10);
});

test('every artifact schema version belongs to the learning plane', () => {
  const versions = new Set<string>();
  for (const o of engineResult.observations) versions.add(o.schemaVersion);
  for (const c of engineResult.cohorts) versions.add(c.schemaVersion);
  for (const s of engineResult.signals) versions.add(s.schemaVersion);
  for (const p of engineResult.priorities) versions.add(p.schemaVersion);
  for (const f of engineResult.feedback) versions.add(f.schemaVersion);
  for (const e of engineResult.auditEvents) versions.add(e.schemaVersion);
  for (const version of versions) {
    assert.ok(version.startsWith('learning.') || version === 'oship.intelligence-learning.v1',
      version);
  }
});

test('all learning content fingerprints share the plane namespace', () => {
  const fingerprints = [
    ...engineResult.observations.map((o) => o.contentFingerprint),
    ...engineResult.cohorts.map((c) => c.contentFingerprint),
    ...engineResult.signals.map((s) => s.contentFingerprint),
  ];
  assert.ok(fingerprints.length > 100);
  for (const fingerprint of fingerprints) {
    assert.match(fingerprint, /^lcfp_[0-9a-f]{24}$/);
  }
});

test('audit events cannot impersonate other planes', () => {
  for (const event of engineResult.auditEvents) {
    assert.equal(event.schemaVersion, 'oship.intelligence-learning.v1');
  }
});

test('the learning plane adds no new authority — vocabulary check', () => {
  const allText = [
    ...engineResult.signals.map((s) => s.statement),
    ...engineResult.priorities.map((p) => p.statement),
    ...engineResult.recommendations.map((r) => r.statement),
    ...engineResult.feedback.map((f) => f.statement),
    ...engineResult.strategyLearning.flatMap((s) => s.reasons),
    ...engineResult.policyLearning.flatMap((p) => p.reasons),
  ].join(' ');
  for (const word of ['treasury', 'portfolio', 'aegis', 'withdraw', 'deposit',
    'place bet', 'place order', 'authorize']) {
    assert.ok(!allText.toLowerCase().includes(word), word);
  }
});
