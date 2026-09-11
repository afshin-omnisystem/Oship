import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import * as researchIndex from '../index';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import {canonicalJson} from '../ids';

/**
 * SPRINT 036 — architecture boundary tests: the research plane is a
 * query/analysis layer over Sprint 035 results. It never imports execution,
 * treasury, portfolio, risk, AEGIS or strategy-registry modules, never
 * mutates authority state, and keeps AFIS/ABL semantics separate.
 */

// Tests execute from dist/, so resolve the source tree explicitly.
function resolveResearchSrc(): string {
  const candidates = [
    join(__dirname, '..'),                                         // running from src
    join(__dirname, '..', '..', '..', '..', 'src', 'intelligence', 'research'), // running from dist
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'engine.ts'))) return candidate;
  }
  throw new Error('cannot locate the research source directory');
}
const RESEARCH_DIR = resolveResearchSrc();

function researchModules(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(RESEARCH_DIR, {withFileTypes: true})) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entry.name);
    }
  }
  return files.sort();
}

// Authority modules — never imported (not even for types) by the research
// plane. Analytical contracts (Sprint 034/035 types) remain legal imports.
const FORBIDDEN_IMPORTS = [
  '../../treasury', '../treasury', '../../portfolio', '../portfolio',
  '../../risk', '../risk', '../../aegis', '../aegis',
  '../../strategy-registry', '../strategy-registry', '../../allocation', '../allocation',
  '../../discovery', '../discovery', '../../providers', '../providers',
  '../../execution/control', '../execution/control', '../../execution/planning', '../execution/planning',
];

test('the research plane imports no authority modules', () => {
  const modules = researchModules();
  assert.ok(modules.length >= 27, `expected the full module set (got ${modules.length})`);
  for (const module of modules) {
    if (module.includes('.test.') || module === 'test-fixtures.ts') continue;
    const source = readFileSync(join(RESEARCH_DIR, module), 'utf8');
    for (const forbidden of FORBIDDEN_IMPORTS) {
      assert.ok(!source.includes(`from '${forbidden}`),
        `${module} must not import ${forbidden} — the research plane is not an authority`);
    }
    // The fixtures may reference Sprint 034/035 analytical contracts by TYPE
    // only; runtime dependencies stay inside the intelligence plane.
    if (module === 'test-fixtures.ts') continue;
  }
});

test('the research plane consumes the closed-loop contracts, not duplicates of them', () => {
  const types = readFileSync(join(RESEARCH_DIR, 'types.ts'), 'utf8');
  assert.ok(types.includes("from '../closed-loop/types'"),
    'Sprint 035 types must be imported from their canonical module');
  assert.ok(/export type \{[^}]*ClosedLoopAnalysisResult/.test(types),
    'closed-loop contracts must be re-exported, not redefined');
});

test('the public index re-exports the full plane', () => {
  const names = Object.keys(researchIndex);
  for (const expected of ['ResearchEngine', 'researchHistory', 'researchInput',
    'buildMemory', 'buildEntities', 'buildGraph', 'runQuery', 'comparePopulations',
    'detectPatterns', 'evaluateHypothesis', 'evaluateEvidence', 'buildFinding',
    'rankEntities', 'buildFeedback', 'checkResearchInvariants', 'verifyResearchAudit',
    'compareResearchResults', 'buildResearchLineage', 'normalizeRecord']) {
    assert.ok(names.includes(expected), `${expected} must be exported from the plane index`);
  }
});

test('one engine serves both domains — AFIS and ABL history in one analysis', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  const domains = new Set(result.memory.records.map((r) => r.domain));
  assert.deepEqual([...domains].sort(), ['ABL', 'AFIS']);
  const ablStrategies = new Set(result.memory.records.filter((r) => r.domain === 'ABL').map((r) => r.strategyId));
  assert.deepEqual([...ablStrategies], ['sports-arb-strategy']);
});

test('ABL BACK/LAY semantics survive the whole pipeline', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  for (const record of result.memory.records.filter((r) => r.domain === 'ABL')) {
    assert.ok(['BACK', 'LAY', 'UNKNOWN'].includes(record.semanticSide));
    assert.ok(!['BUY', 'SELL'].includes(record.semanticSide),
      'ABL sides must never be collapsed into exchange buy/sell');
  }
});

test('AFIS and ABL economics are never assumed identical — raw comparison rejected', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  const raw = result.comparisons.find((c) => c.kind === 'DOMAIN' && !c.normalized)!;
  assert.equal(raw.comparable, false);
  assert.ok(raw.reasons.some((r) => r.includes('normalized')));
  const normalized = result.comparisons.find((c) => c.kind === 'DOMAIN' && c.normalized)!;
  assert.equal(normalized.comparable, true);
});

test('the engine result contains no live-trading or money-movement surface', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  const serialized = canonicalJson(result);
  for (const forbidden of ['placeOrder', 'cancelOrder', 'transfer', 'withdraw',
    'deposit', 'apiKey', 'secret', 'credentials', 'live-connection']) {
    assert.ok(!serialized.includes(forbidden), `${forbidden} must never appear in research output`);
  }
});

test('feedback and recommendations are informational — never mutations', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  assert.ok(result.feedback.length > 0);
  assert.ok(result.recommendations.length > 0);
  for (const feedback of result.feedback) assert.equal(feedback.informational, true);
  for (const recommendation of result.recommendations) assert.equal(recommendation.informational, true);
});

test('the research plane is fully deterministic — two full analyses byte-identical', () => {
  const engine = new ResearchEngine();
  const a = engine.analyze(researchHistory().input);
  const b = engine.analyze(researchHistory().input);
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('findings never authorize: statements stay analytical', () => {
  const result = new ResearchEngine().analyze(researchHistory().input);
  for (const finding of result.findings) {
    const text = JSON.stringify(finding.result);
    assert.ok(!/authorize|approve|execute|deploy|halt/i.test(text));
  }
});
