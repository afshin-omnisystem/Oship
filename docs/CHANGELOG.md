# Changelog

## Sprint 015

Added a deterministic unified agent runtime, AFIS and ABL discovery agents, opportunity scoring and deduplication, confidence evidence aggregation, strategy contracts/evaluation, audit records, heartbeat monitoring, and replay/demo infrastructure. Agents cannot directly access credentials, Treasury, or execution.


## Sprint 016 — OIIN Unified Event Intelligence Fabric

OIIN is the domain-neutral canonical event plane between external connectors and AFIS/ABL consumers. It validates and normalizes source payloads, assigns SHA-256 deterministic IDs, deduplicates, causally orders, correlates, persists, publishes through an isolated in-memory bus, and supports immutable replay envelopes. Connector credentials and raw payloads remain outside agents; OIIN never authorizes Treasury or execution. Invalid events are dead-lettered with stage and trace metadata.

## Sprint 017

Added the unified deterministic Market Intelligence Engine with features, signals, fair value, edge, evidence, confidence calibration, regimes, anomaly detection, eligibility, replay, and public APIs. Intelligence cannot authorize Treasury or execution.

## Sprint 018

Added unified portfolio, position, exposure, risk, allocation, deterministic integer-unit accounting, risk constraints, liquidity reserve, drawdown protection, and cross-domain capital competition foundations.

## Sprint 019

Added execution orchestration, smart routing, authorization validation, multi-leg execution plans, partial fills, immutable receipts, and reconciliation boundaries.

## Sprint 020

Added execution intelligence, adaptive smart routing, deterministic multi-venue simulation, execution/position event contracts, partial-fill behavior, and full reconciliation foundations.

## Sprint 021

Added the end-to-end orchestration spine, explicit state transitions, deterministic journal/hash chain, idempotency protection, and orchestration reconciliation/replay foundations.

## Sprint 022

Added the executable OIIN-to-execution market pipeline with real subsystem calls, end-to-end stage context, idempotency, position/settlement outputs, reconciliation, and AFIS/ABL deterministic scenarios.
