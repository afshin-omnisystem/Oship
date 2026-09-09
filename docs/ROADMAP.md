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

## Sprint 023

Delivered the unified Treasury, stateful Position Engine, stateful Portfolio, event-driven state mutations, exactly-once idempotency, append-only SHA-256 hash-chained ledgers, full state-plane reconciliation, isolated deterministic replay, and executable AFIS/ABL end-to-end state-plane flows. Capital accounting is integer minor-unit only and fail-closed. The execution venue remains deterministic simulation by design; the internal OSHIP financial state plane is now real, stateful, auditable, replayable, and deterministic.

### In Scope (delivered)
- Unified, stateful, domain-neutral Treasury with authorization, reservation, consumption, settlement, ledger hash chain, and capital invariants.
- Stateful Position Engine with deterministic event application and position ledger.
- Stateful Portfolio consuming position mutation events with an immutable snapshot + portfolio ledger.
- Treasury ↔ Position ↔ Portfolio integration via events/contracts only (no cross-subsystem direct mutation).
- Exactly-once / idempotency (treasury, position, portfolio, execution).
- Full state-plane reconciliation and isolated replay (never mutates live state).
- AFIS and ABL end-to-end state-plane scenarios, 40+ new Sprint 023 tests, `pnpm demo:state-plane`, and documentation.

### Explicitly Out of Scope
- Live exchange/bookmaker APIs, provider credentials, real-money movement, direct Treasury bypass, direct execution bypass — all remain forbidden. The execution venue is deterministic simulation only.

## Sprint 024

Delivered the real internal Reliability and Recovery plane: deterministic failure detection/classification, health monitoring, circuit breakers, timeout management, retry policy/engine, degradation modes, a hash-chained reliability event log, a subordinate recovery orchestrator with a 14-state machine, deterministic recovery decision engine, exactly-once attempt store, hash-chained recovery journal/event log, recovery reconciliation, and isolated deterministic replay. AFIS/ABL recovery scenarios (timeout, venue-down, partial-fill, stale-edge, hedge, liquidity, treasury-expired, hash-mismatch, stale-odds, BACK/LAY) are covered by 50+ new tests and `pnpm demo:recovery`, which reports `SYSTEM STATUS: RECONCILED` and `Original == Replay: PASS`. Everything is deterministic (injected clock, canonical SHA-256, no `Math.random`/`Date.now`) and fails closed. The execution venue remains deterministic simulation; no live exchange/bookmaker APIs, no provider credentials, no real-money movement, and no bypass of AEGIS → Treasury → Execution → State Plane.

### In Scope (delivered)
- `src/reliability/`: types, canonical ids, failure classifier, failure detector, health monitor, circuit breaker, timeout manager, retry policy/engine, degradation manager, reliability events/chain, state, engine, failure factory.
- `src/recovery/`: recovery types, policy, decision engine, orchestrator, attempt store, journal, reconciler, state machine, flow, scenarios.
- Deterministic fault injection (`src/simulation/fault-injector.ts`).
- Recovery integration with the Sprint 023 state plane and isolated recovery replay (`recording + compare`), never mutating live state.
- 50+ new reliability + recovery tests, `pnpm demo:recovery`, architecture/roadmap/glossary/changelog updates.

### Explicitly Out of Scope
- Live exchange/bookmaker or provider APIs, provider credentials, real-money movement, and any bypass of AEGIS / Treasury authorization / Execution authorization / State Plane remain forbidden. The execution venue is deterministic simulation only.

## Sprint 025

Delivered the adaptive decision, recovery and autonomous control plane. Built a real control engine (kill-switch state machine, deterministic decision engine, exactly-once idempotency keyed `control:{correlationId}:{decisionId}:{action}`, append-only hash-chained `oship.control.event.v1` journal + event chain) over a deterministic snapshot of the whole pipeline. Added dynamic re-evaluation at sensitive boundaries, a bounded execution feedback loop, direct recovery-to-control integration, deterministic adaptive strategy selection, bounded risk-aware AEGIS-gated Treasury-authorized capital reallocation, a real kill-switch with `EMERGENCY_STOP` semantics (blocking new opportunities/allocations/execution/Treasury reservations while keeping reconciliation/audit/replay/settlement recovery available), and the project's first full global vertical-slice isolated replay. Covered by 10 control, 10 revalidation, 10 recovery-integration, 10 reallocation, 10 full-replay and a chaos/kill-switch matrix of tests plus `pnpm demo:control` (`SYSTEM STATUS: RECONCILED`). The execution venue remains deterministic simulation; no live exchange/bookmaker APIs, no provider credentials, no real-money movement, and no bypass of AEGIS -> Treasury -> Execution -> State Plane.

### In Scope (delivered)
- `src/control/`: types, ids, control-state, control-policy, control-transition, control-decision, control-journal, control-engine, control-reconciler, control-replay, control-feedback, control-recovery-integration, control-scenarios, index.
- `src/revalidation/`: deterministic dynamic re-evaluation.
- `src/strategy/adaptive/`: deterministic adaptive strategy selection (AFIS + ABL).
- `src/reallocation/`: bounded, risk-aware, AEGIS-gated, Treasury-authorized capital reallocation.
- `src/replay/control-vertical-replay.ts`: full vertical-slice isolated replay (live state never mutated).
- 50+ new Sprint 025 tests (control/revalidation/recovery-integration/reallocation/full-replay/chaos matrix), `pnpm demo:control`, and updated documentation.

### Explicitly Out of Scope
- Live exchange/bookmaker or provider APIs, provider credentials, real-money movement, and any bypass of AEGIS / Treasury authorization / Execution authorization / State Plane remain forbidden. The execution venue is deterministic simulation only. No non-reproducible/ML adaptive selection.

## Sprint 027

Delivered the real deterministic Strategy layer on top of the canonical Sprint 026 opportunity engine. `services/market-engine/src/strategy/intelligence/` maps a validated/ranked Opportunity to one or more deterministic strategy candidates, evaluates each against a reusable unified economics model, enforces explicit per-strategy limits (max capital/position/exposure/legs/latency, min edge/confidence/liquidity, max slippage), performs portfolio-aware concentration/correlation/capital checks, ranks admissible strategies with a configurable composite score (risk-adjusted return, capital efficiency, confidence, execution probability, liquidity, latency, risk, correlation, freshness, horizon), and deterministically selects the best admissible strategy or reports `NO_ADMISSIBLE_STRATEGY`. AFIS cross-venue/triangular/funding/basis/market-making/liquidity-imbalance and ABL surebet/back-lay/+EV/hedge templates share one canonical contract; AFIS and ABL compete for the single unified Treasury in one ranking. Strategy is proposal-only and never mutates Portfolio / Risk / Allocation / AEGIS / Treasury / Execution. Includes a deterministic registry (register/unregister/enable/disable/lookup/compatibility/versioning/health), strategy lifecycle state machine, control-plane advisory (CONTINUE/REVALIDATE/RESIZE/REROUTE/ABORT/HEDGE/PAUSE/HALT) that leaves the existing Control Engine as decision-maker, structured strategy audit records, and isolated deterministic replay. Covered by 91 new tests, `pnpm demo:strategy-engine` (`SYSTEM STATUS: RECONCILED`, replay PASS), and updated docs.

### In Scope (delivered)
- `src/strategy/intelligence/`: types, ids, limits, templates, compatibility, economics, portfolio-awareness, evaluator, ranking, selection, registry, engine, replay, lifecycle, generator; `afis/` + `abl/` strategy template views.
- Strategy candidate generation, compatibility engine, evaluation engine, reusable economics model, ranking engine, selection engine, correlation groups, limits, versioning/fingerprinting, replay, audit, control-plane advisory, portfolio-aware evaluation, cross-domain competition.
- 91 new Sprint 027 tests, `pnpm demo:strategy-engine`, and updated architecture/roadmap/glossary/changelog documentation.

### Explicitly Out of Scope
- Live exchange/bookmaker or provider APIs, provider credentials, real-money movement, and any bypass of AEGIS / Treasury authorization / Execution authorization / State Plane remain forbidden. Strategy is proposal-only; the execution venue is deterministic simulation only. No non-reproducible/ML components.

## Sprint 028

Delivered the real deterministic Allocation layer on top of the Sprint 026 opportunity engine + Sprint 027 strategy engine. `services/market-engine/src/allocation/optimizer/` answers HOW MUCH of the ONE unified OSHIP Treasury should be committed to each eligible (Opportunity + selected Strategy) candidate. It introduces a canonical allocation model (allocation_id, opportunity_id, strategy_id, domain, requested/allocated/unallocated capital, allocation_ratio, expected gross/net/risk-adjusted return, capital_efficiency, confidence, liquidity, correlation_group + correlation_exposure, portfolio_exposure, risk_score, time_horizon, capital_duration, capital_turnover, reason, policy_version, configuration_version, timestamp, fingerprint), a deterministic lifecycle (PROPOSED→EVALUATED→OPTIMIZED→RISK_APPROVED→AEGIS_APPROVED→TREASURY_AUTHORIZED→ALLOCATED plus terminal REJECTED/RISK_BLOCKED/CAPITAL_BLOCKED/AEGIS_BLOCKED/TREASURY_BLOCKED/EXPIRED/STALE/CANCELLED), a validated candidate builder (re-checked expiry/freshness, required/maximum/minimum capital, gross/net/risk-adjusted return, edge, confidence, liquidity, execution probability, correlation-group, time horizon, all-or-nothing vs partial mode from the strategy type), a transparent composite scoring policy (Fixed / Confidence Weighted / Edge Weighted / Capital Efficiency Weighted / Risk Adjusted / Liquidity Constrained / Correlation Adjusted / Hybrid), and explicit capital constraints (total/domain/strategy/position/event/correlation exposure, per-candidate cap, minimum viable allocation, liquidity reserve). The core is a deterministic, bounded greedy constrained-capital optimizer: filter invalid/stale → score → sort with stable tie-breakers → clamp partial candidates to the binding capital/exposure/liquidity budget → enforce all-or-nothing and minimum-viable-allocation → verify invariants (never over-allocate; available+reserved+allocated = total; exposure ≤ limits; allocation ≤ executable liquidity) → fail closed to ALLOCATION_BLOCKED. It is cross-domain (AFIS + ABL compete for ONE Treasury in a single optimization; no separate pools), portfolio-aware, correlation-aware, supports partial and all-or-nothing, dynamic reallocation with per-candidate delta, integrates Control (REVALIDATE/REPRICE/RESIZE and EMERGENCY_STOP/HALTED → NO_NEW_ALLOCATION while keeping reconciliation/audit/replay), AEGIS (must approve, cannot override), Treasury (proposal only), and revalidation; plus canonical SHA-256 fingerprinting, isolated deterministic replay, and a structured audit record. Covered by 115+ new tests (84 core + 24 cross-domain/AFIS/ABL/scenario), `pnpm demo:allocation-engine` (`RECONCILED`, shared capital, candidates, optimization, final allocation, unallocated capital, invariants PASS, Allocation→AEGIS→Treasury→paper execution→position→reconciliation), and updated docs.

### In Scope (delivered)
- `src/allocation/optimizer/`: types, lifecycle, ids, constraints, candidate-builder, scoring, portfolio-context, optimizer, reallocation, boundaries, revalidation, replay, engine, index.
- Canonical allocation model, candidate builder, policy engine (8 policies), economics, capital constraint, liquidity integration, correlation-aware, portfolio-aware, cross-domain optimizer, partial, all-or-nothing, ranking, selection, dynamic reallocation, delta, control integration, revalidation, AEGIS boundary, Treasury boundary, replay, audit, AFIS/ABL/cross-domain scenarios.
- 115+ new Sprint 028 tests, `pnpm demo:allocation-engine`, and updated architecture/roadmap/glossary/changelog documentation.

### Explicitly Out of Scope
- Live exchange/bookmaker or provider APIs, provider credentials, real-money movement, and any bypass of AEGIS / Treasury authorization / Execution authorization / State Plane remain forbidden. Allocation is proposal-only and never mutates Treasury / Portfolio / Risk / AEGIS / Execution; the execution venue is deterministic simulation only. Deterministic greedy optimizer only — no ML / quadratic / linear programming this sprint (the contract is replaceable by QP/LP/CVaR/mean-variance/RL later).
