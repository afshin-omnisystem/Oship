import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ingestOpportunityIdentity, capitalScaleOf, deployedCapitalOf} from '../opportunity';
import {closedLoopCorpus, clOpportunity} from '../test-fixtures';
import type {ClosedLoopRecord} from '../types';

/**
 * SPRINT 035 — opportunity identity tests (§4): immutable, fingerprinted,
 * AFIS + ABL through the SAME ingestion, fail closed on missing identity.
 */

const corpus = closedLoopCorpus();

test('identity preserves the canonical opportunity fields', () => {
  const record = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const identity = ingestOpportunityIdentity(record);
  assert.equal(identity.opportunityId, record.opportunity.opportunityId);
  assert.equal(identity.domain, 'AFIS');
  assert.equal(identity.opportunityType, 'CROSS_VENUE_SPOT_ARBITRAGE');
  assert.equal(identity.opportunityClass, 'cross-venue-arbitrage');
  assert.deepEqual([...identity.venues], ['venue-a', 'venue-b']);
  assert.equal(identity.observedAt, record.opportunity.observedAt);
  assert.equal(identity.expiresAt, record.opportunity.expiresAt);
  assert.equal(identity.freshness, record.opportunity.freshness);
  assert.equal(identity.confidence, record.opportunity.confidence);
  assert.equal(identity.sourceFingerprint, record.opportunity.fingerprint);
  assert.equal(identity.theoreticalGrossEdge, record.opportunity.grossEdge);
  assert.equal(identity.theoreticalCostEstimate, record.opportunity.estimatedTotalCost);
  assert.equal(identity.theoreticalNetEdge, record.opportunity.netEdge);
  assert.equal(identity.evidenceCount, record.opportunity.evidence.length);
});

test('identity is fingerprinted deterministically — same input, same fingerprint', () => {
  const record = corpus.records[0];
  assert.equal(ingestOpportunityIdentity(record).fingerprint, ingestOpportunityIdentity(record).fingerprint);
});

test('identity fingerprints differ across different opportunities', () => {
  const fingerprints = new Set(corpus.records.map((r) => ingestOpportunityIdentity(r).fingerprint));
  assert.equal(fingerprints.size, corpus.records.length);
});

test('AFIS and ABL flow through the SAME ingestion path', () => {
  const afis = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const abl = corpus.records.find((r) => r.label === 'abl-surebet')!;
  const afisIdentity = ingestOpportunityIdentity(afis);
  const ablIdentity = ingestOpportunityIdentity(abl);
  assert.equal(afisIdentity.domain, 'AFIS');
  assert.equal(ablIdentity.domain, 'ABL');
  assert.equal(ablIdentity.opportunityClass, 'surebet');
  assert.equal(afisIdentity.classificationVersion, ablIdentity.classificationVersion);
});

test('classification is versioned', () => {
  const identity = ingestOpportunityIdentity(corpus.records[0]);
  assert.equal(identity.classificationVersion, 'closed-loop.classification.v1');
});

test('identity fails closed on missing opportunity id', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, opportunityId: ''}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /missing opportunity identity/);
});

test('identity fails closed on invalid domain', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, domain: 'FOREX' as never}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /invalid opportunity domain/);
});

test('identity fails closed on missing type', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, type: undefined as never}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /missing opportunity type/);
});

test('identity fails closed on invalid observedAt', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, observedAt: 0}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /invalid observedAt/);
});

test('identity fails closed when expiresAt precedes observedAt', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, expiresAt: record.opportunity.observedAt - 1}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /invalid expiresAt/);
});

test('identity fails closed on non-finite gross edge', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, grossEdge: Number.NaN}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /grossEdge/);
});

test('identity fails closed on negative estimated costs', () => {
  const record = corpus.records[0];
  const broken = {...record, opportunity: {...record.opportunity, estimatedTotalCost: -1}} as ClosedLoopRecord;
  assert.throws(() => ingestOpportunityIdentity(broken), /estimatedTotalCost/);
});

test('capitalScaleOf reflects allocation and risk approval', () => {
  const full = corpus.records.find((r) => r.label === 'healthy-execution')!;
  const throttled = corpus.records.find((r) => r.label === 'risk-throttled')!;
  assert.equal(capitalScaleOf(full), 1);
  assert.equal(capitalScaleOf(throttled), 0.4);
});

test('capitalScaleOf returns null when required capital is zero', () => {
  const record = corpus.records[0];
  const zero = {...record, opportunity: {...record.opportunity, requiredCapital: 0}} as ClosedLoopRecord;
  assert.equal(capitalScaleOf(zero), null);
});

test('deployedCapital never exceeds risk approval', () => {
  for (const record of corpus.records) {
    const deployed = deployedCapitalOf(record);
    assert.ok(deployed !== null);
    assert.ok(deployed <= record.risk.approvedCapital + 1e-9, `${record.label} deployed ≤ approved`);
  }
});

test('the corpus carries every demo scenario', () => {
  const labels = corpus.records.map((r) => r.label);
  for (const expected of ['healthy-execution', 'steady-single', 'high-edge-poor-exec', 'adverse-venue-drift',
    'risk-throttled', 'partial-completion', 'adaptive-recovery', 'venue-leakage', 'emergency-stop',
    'abl-surebet', 'stale-intel', 'oscillation-abort', 'policy-v1.1-trial']) {
    assert.ok(labels.includes(expected), `missing fixture ${expected}`);
  }
  assert.equal(corpus.records.length, 13);
});

test('stale opportunity keeps its low freshness honestly', () => {
  const stale = corpus.records.find((r) => r.label === 'stale-intel')!;
  const identity = ingestOpportunityIdentity(stale);
  assert.equal(identity.freshness, 0.2);
  assert.equal(identity.semanticSide, 'UNKNOWN');
});
