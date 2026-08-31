# Roadmap

## Sprint 015 — Unified Discovery Engine + Agent Runtime

Delivered the domain-neutral runtime, lifecycle and permission boundaries, AFIS/ABL deterministic discovery agents, opportunity scoring/deduplication, strategy contract and engine, audit foundations, and replay seams. Live exchange/bookmaker execution, secret handling, autonomous retraining, and independent domain treasuries remain explicitly out of scope.


## Sprint 016 — OIIN Unified Event Intelligence Fabric

OIIN is the domain-neutral canonical event plane between external connectors and AFIS/ABL consumers. It validates and normalizes source payloads, assigns SHA-256 deterministic IDs, deduplicates, causally orders, correlates, persists, publishes through an isolated in-memory bus, and supports immutable replay envelopes. Connector credentials and raw payloads remain outside agents; OIIN never authorizes Treasury or execution. Invalid events are dead-lettered with stage and trace metadata.

## Sprint 017

Added the deterministic Market Intelligence Layer: feature extraction, signals, fair value, edge, evidence, confidence, regime and anomaly analysis, eligibility, registry, replay, and AFIS/ABL-compatible public contracts.

## Sprint 018

Added the unified portfolio, position, exposure, risk policy, deterministic allocation, liquidity reserve, drawdown, and reconciliation foundation. AFIS and ABL share one capital/risk budget.

## Sprint 019

Added execution lifecycle orchestration, authorization-proof validation, multi-leg plans, smart route scoring, partial-fill receipts, and Treasury/execution reconciliation foundations using deterministic simulation.

## Sprint 020

Added execution intelligence, adaptive deterministic routing, simulated microstructure/fill behavior, canonical execution and position events, recovery/reconciliation seams, and replayable execution quality scoring. Live provider integration remains future work.

## Sprint 021

Added the end-to-end orchestration spine, explicit workflow state machine, immutable hash-chained journal, deterministic idempotency, orchestration reconciliation, and AFIS/ABL simulation flows.

## Sprint 022

Connected the canonical OIIN-to-execution simulation path and added deterministic pipeline idempotency, orchestration context, stage journaling, settlement/reconciliation output, and AFIS/ABL pipeline demos.
