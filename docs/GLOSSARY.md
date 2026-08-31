# Glossary

- **OSHIP Core / SuperNova** — central authority for agent, opportunity, strategy, authorization and execution orchestration.
- **AETHER** — sole human interaction gateway.
- **Agent Runtime** — lifecycle, capability, dispatch, health and workload boundary for untrusted agents.
- **Canonical Opportunity** — deduplicated opportunity identified without agent identity.
- **AEGIS** — first authorization boundary before the unified treasury.
- **Unified Treasury** — one shared capital authority for AFIS and ABL.
- **OIIN** — observation/event input boundary.


## Sprint 016 — OIIN Unified Event Intelligence Fabric

OIIN is the domain-neutral canonical event plane between external connectors and AFIS/ABL consumers. It validates and normalizes source payloads, assigns SHA-256 deterministic IDs, deduplicates, causally orders, correlates, persists, publishes through an isolated in-memory bus, and supports immutable replay envelopes. Connector credentials and raw payloads remain outside agents; OIIN never authorizes Treasury or execution. Invalid events are dead-lettered with stage and trace metadata.

- **Intelligence Record** — evidence-backed informational output from canonical OIIN events; it is not authority.
- **Feature** — deterministic numeric measurement extracted from an observation.
- **Signal** — bounded directional interpretation of features.
- **Fair Value** — deterministic reference or consensus estimate, distinct from market price.
- **Edge** — quantified difference between fair value and market value.
- **Eligibility** — fail-closed check for freshness, evidence, anomalies, and correlation before Strategy consumption.

- **Portfolio Engine** — immutable accounting context for one unified capital pool.
- **Exposure Engine** — multi-dimensional view of capital concentration.
- **Risk Evaluation** — versioned fail-closed constraint result before allocation.
- **Allocation Proposal** — advisory capital sizing output; not Treasury authorization.
- **Liquidity Reserve** — portfolio-level minimum capital that allocations must preserve.

- **Execution Orchestrator** — the controlled downstream coordinator after AEGIS and Treasury authorization.
- **Smart Router** — deterministic selector of eligible venue/bookmaker routes.
- **Execution Receipt** — immutable per-leg record of requested and filled quantity.
- **Multi-leg Plan** — explicit coordinated execution plan with a declared execution mode.

- **Execution Intelligence** — deterministic pre-route assessment of expected execution quality and net value.
- **Adaptive Smart Router** — policy-constrained route scorer responsive to current simulated venue state.
- **Execution Receipt** — immutable record of requested, filled, fee, slippage, and timing data for a leg.
- **Execution Reconciliation** — explicit validation that authorization, capital, fills, and downstream projections agree.

- **EndToEndOrchestrator** — canonical coordinator joining OIIN, intelligence, strategy, risk, allocation, authorization, execution, position, and reconciliation context.
- **Orchestration Journal** — append-only, monotonic, hash-chained transition history.
- **Idempotency** — deterministic duplicate-request protection using workflow identity.

- **MarketPipeline** — the executable Sprint 022 coordinator for canonical OIIN events through the complete simulated authorization and execution path.
- **Pipeline Context** — immutable-at-boundary collection of stage outputs and correlation metadata.
- **Pipeline Idempotency** — duplicate event protection preventing repeated processing and execution.
