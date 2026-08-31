# OSHIP Architecture

## Sprint 015: unified runtime and discovery

OSHIP Core / SuperNova is the sole orchestration authority; AETHER is the only human gateway. AFIS and ABL use the same capability-restricted `AgentRuntime`, immutable agent identities, lifecycle state machine, heartbeats, and typed correlated events. Discovery agents only read observations and emit candidate opportunities. `DiscoveryEngine` validates, deterministically hashes, deduplicates, aggregates confidence (`1 - product(1-confidence)`), scores, and ranks candidates.

The domain-neutral Strategy contract evaluates canonical opportunities and returns decisions. Decisions are proposals only: the production boundary is **Strategy → AEGIS preflight → Unified Treasury authorization → Execution Gateway → domain adapter**. Agents have no treasury, execution, or secret permissions. Paper adapters remain the safe simulation endpoint.

All identifiers in discovery and strategy are derived from canonical serialization, timestamps are injected in replay, and audit records carry trace, correlation, causation, actor, component, result, reason, and version. Replay consumes the same observations and configuration to reproduce IDs and ranking.


## Sprint 016 — OIIN Unified Event Intelligence Fabric

OIIN is the domain-neutral canonical event plane between external connectors and AFIS/ABL consumers. It validates and normalizes source payloads, assigns SHA-256 deterministic IDs, deduplicates, causally orders, correlates, persists, publishes through an isolated in-memory bus, and supports immutable replay envelopes. Connector credentials and raw payloads remain outside agents; OIIN never authorizes Treasury or execution. Invalid events are dead-lettered with stage and trace metadata.

## Sprint 017 — Unified Market Intelligence

OIIN canonical events now feed one domain-neutral Intelligence Engine. The engine keeps observation, feature, signal, fair value, edge, evidence, confidence, regime, anomaly, and eligibility as separate contracts. Deterministic mathematical adapters provide midpoint/consensus fair value, probability normalization, bounded evidence and confidence, and threshold-based regimes/anomalies. Intelligence is informational only: Strategy remains the decision layer and AEGIS remains the authorization boundary before the unified Treasury and Execution Gateway.

```text
OIIN → Features → Signals → Fair Value → Edge → Evidence + Confidence
     → Regime + Anomaly → Intelligence → Strategy → AEGIS → Treasury → Execution
```

## Sprint 018 — Unified Portfolio, Risk and Allocation

The domain-neutral portfolio layer sits between Strategy and AEGIS. Portfolio state uses integer minor units for authoritative capital, while Position and Exposure engines maintain immutable snapshots and deterministic ledger identifiers. Risk applies versioned global, domain, position, event, correlation, drawdown, daily-loss, anomaly, and liquidity-reserve constraints. Allocation produces proposals only; it cannot mutate Treasury or call execution. The final authority chain remains Portfolio → Risk → Allocation → AEGIS → Unified Treasury → Execution.

## Sprint 019 — Execution Orchestration and Smart Routing

Execution is controlled by a deterministic orchestrator that requires complete upstream proof: Strategy, Risk, Allocation, AEGIS, Treasury, correlation, and trace context. The Smart Router scores healthy simulated routes using edge, liquidity, fees, slippage, latency, reliability, and fill probability. Multi-leg plans and partial fills produce immutable receipts. Execution and Treasury reconciliation are explicit; no router or adapter can authorize capital or bypass AEGIS.

## Sprint 020 — Execution Intelligence and Adaptive Routing

The execution control plane now evaluates expected fees, slippage, latency, fill probability, reliability, and adverse selection before route selection. `AdaptiveSmartRouter` ranks only healthy eligible candidates and records policy-versioned rejection reasons. Deterministic venue simulation supports fill ratios and explicit failure states. Execution plans still require complete Strategy, Risk, Allocation, AEGIS, Treasury, correlation, and trace proof. Execution events, position events, and reconciliation records are immutable downstream projections; neither routing nor simulation authorizes capital.

## Sprint 021 — End-to-End Orchestration

`EndToEndOrchestrator` is the canonical integration spine. It accepts canonical upstream context, validates correlation and authorization proof, advances only through explicit states, journals immutable transitions, and chains event hashes. Idempotency is keyed by correlation, opportunity, strategy, and allocation. Execution remains simulation-only and downstream of AEGIS and Treasury authorization. Reconciliation verifies journal sequence and workflow correlation; replay does not mutate canonical records.

## Sprint 022 — Executable Market Pipeline

`MarketPipeline` is the executable integration path from canonical OIIN input through ingestion, normalization, deduplication, causal ordering, storage, intelligence, opportunity derivation, strategy, portfolio/risk/allocation checks, AEGIS, simulated Treasury reservation, execution intelligence, adaptive routing, execution, position events, settlement, reconciliation, and idempotency. External venue operations remain deterministic simulation only; the internal OSHIP stages are connected through actual injected subsystem calls.
