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

## Sprint 023 — Unified Treasury + Event-Driven State Plane

Sprint 023 converted the deterministic orchestration foundation into a genuinely *stateful* internal OSHIP financial state plane. The execution/venue layer remains deterministic simulation by design; what is now real is the internal authority and audit trail.

### Unified Treasury

`services/market-engine/src/treasury/` is a real stateful engine, not an authorization context. It uses integer minor-unit accounting (never float) and tracks `totalCapital`, `availableCapital`, `reservedCapital`, `allocatedCapital`, `settledCapital`, `realizedPnL`, `totalFees`, `sequence`, `version`, `lastEventId`, `lastHash`.

Authoritative invariant (validated before every commit, fail-closed):

```
availableCapital + reservedCapital + allocatedCapital == totalCapital
```

Lifecycle: `REQUESTED → APPROVED → RESERVED → CONSUMED → SETTLED`, with fail-closed exits `REJECTED`, `RELEASED`, `EXPIRED`. Illegal transitions (e.g. `RELEASED → CONSUMED`, `SETTLED → RESERVED`, `REJECTED → RESERVED`, `CONSUMED → RESERVED`) are rejected.

Authorization binds opportunity, intelligence, strategy, portfolio, risk, allocation, AEGIS, correlation, trace, requested capital, and policy version. No reservation proceeds without a valid approved authorization.

Reservation supports `reserve`, `release`, `expire`; consumption supports exactly-once semantics; settlement is domain-neutral (AFIS `capital + PnL − fees`, ABL stake settlement for `WIN/LOSS/VOID/HALF_WIN/HALF_LOSS`).

The ledger is append-only and hash-chained (SHA-256): each entry records sequence, eventId, authorization/reservation/execution/settlement ids, operation, previousBalance, delta, resultingBalance, previousHash, payloadHash, chainHash, timestamp. `verifyChain()` detects any tampering. Canonical events use `oship.treasury.event.v1`.

### Stateful Position Engine

`services/market-engine/src/position/` is now stateful and event-driven. It consumes canonical position events (`POSITION_OPENED`, `POSITION_INCREASED`, `POSITION_REDUCED`, `POSITION_CLOSED`, `POSITION_SETTLED`, `POSITION_CANCELLED`) and applies deterministic transitions, idempotency (`position:{positionId}:{eventId}`), an append-only position ledger, and emits a portfolio mutation event.

Position state tracks domain, asset, venue/provider reference, side (LONG/SHORT for AFIS, BACK/LAY for ABL), quantity, remainingQuantity, averageEntryPrice, currentPrice, fees, realizedPnL, unrealizedPnL, correlation/strategy/agent ids, openedAt, updatedAt. Duplicate events do not mutate twice; out-of-order events fail closed; unknown positions reject mutations.

### Stateful Portfolio

`services/market-engine/src/portfolio/` now consumes position mutation events and updates positions, allocated capital, realized PnL, fees, exposure, drawdown, and daily loss. Snapshots and ledger state are immutable; the portfolio ledger is hash-chained.

### Event-Driven State Bus

No subsystem mutates another directly. Position events → portfolio mutation events → treasury events → reconciliation. `correlationId`, `traceId`, `causationId`, `eventId`, and `sequence` are preserved throughout. Exactly-once idempotency keys are `treasury:{authorizationId}:{operation}`, `position:{positionId}:{eventId}`, `portfolio:{portfolioId}:{eventId}`, `execution:{executionId}:{eventType}`.

### State-Plane Reconciliation + Isolated Replay

`StatePlaneReconciler` validates OIIN ↔ pipeline ↔ AEGIS ↔ treasury ↔ execution ↔ position ↔ portfolio coherence, detecting missing/duplicate events, broken sequences, broken hashes, capital/reservation/consumption/settlement/position/portfolio/PnL/correlation/trace mismatch, and returns `FULLY_RECONCILED`, `RECONCILED_WITH_WARNINGS`, or `FAILED`.

`statePlaneReplay` reconstructs isolated clones (ReplayTreasury/ReplayPositionEngine/ReplayPortfolio) from a canonical event log and compares against live final state. It never mutates live state. AFIS and ABL end-to-end flows are exercised by `runAfis`/`runAbl`.

## Sprint 024 — Reliability + Recovery Plane

Sprint 024 adds the real internal **Reliability** and **Recovery** plane on top of the unified state plane. It is entirely deterministic: an injected clock, canonical SHA-256 identifiers, and no `Math.random`/`Date.now`. The recovery plane is strictly subordinate to the authority chain and can never bypass AEGIS → Unified Treasury authorization → Execution authorization → State Plane.

### Reliability (`services/market-engine/src/reliability/`)

- **Failure Detector** — turns detection signals into `FailureRecord`s; `isClean` treats an explicit `code` or a non-approved treasury lifecycle as a failure.
- **Failure Classifier** — deterministic `classifyFailure` from canonical signals to a 23-class `FailureType` taxonomy with severity (`FATAL`/`CRITICAL`/`ERROR`/`WARNING`) and retryability. `HASH_MISMATCH`/`DATA_CORRUPTION` are FATAL; `AUTHORIZATION_FAILURE`/`AEGIS_REJECTION`/`TREASURY_*`/`RECONCILIATION_FAILURE`/`OUT_OF_ORDER` are CRITICAL.
- **Health Monitor** — rolling-window health summary (`record`/`summary`/`isHealthy`).
- **Circuit Breaker** — `CLOSED`/`OPEN`/`HALF_OPEN` with injected clock, idempotent transitions, `recordSuccess`/`recordFailure`/`allows`/`getTransitions`/`snapshot`, and a canonical `breakerId`.
- **Timeout Manager** — `begin`/`check`/`isExpired`/`isAbsolutelyExpired` producing a `Deadline`.
- **Retry Policy + Retry Engine** — `RetryPolicy`/`DEFAULT_RETRY_POLICY`, jitter-free `nextRetryDelay`, `isRetryable`, and `RetryEngine.recordAttempt`/`shouldRetry` with an `AuthorizationGate`.
- **Degradation Manager** — `NORMAL`/`DEGRADED`/`RECOVERY_ONLY`/`READ_ONLY`/`HALTED` with an allowed-transition map and guards for new execution, new treasury reservation, automatic retry, automatic reroute, and inspection. Fail-closed on illegal transitions.
- **Reliability Events + Chain** — `buildReliabilityEvent`/`reliabilityChainHash`/`verifyReliabilityChain` over an append-only hash-chained `oship.reliability.event.v1` log. A single detection journals exactly one reliability event while still reflecting the new degradation mode.
- **Reliability Engine** — owns the monitor, detector, breaker registry, degradation manager, failure register (`detect`/`registerFailure`), and the hash-chained event log. It never mutates Treasury/Position/Portfolio.

### Recovery (`services/market-engine/src/recovery/`)

- **Recovery Decision Engine** — deterministic `decide` over `DecisionInput`; authority/authorization checks always win, then stale-edge, partial-fill, and hedge-feasibility handling, then policy default action.
- **Recovery Policy** — `RecoveryPolicy`/`DEFAULT_RECOVERY_POLICY`, `allowedRecoveryActions`, `defaultRecoveryAction`, partial-fill and stale-edge actions, max reroute/hedge settings.
- **Recovery Orchestrator** — owns a 14-state recovery state machine, deterministic decision engine, exactly-once attempt store, and an append-only hash-chained recovery journal/event log (`oship.recovery.event.v1`). `onFailure` registers the canonical failure in the reliability engine (preserving its `failureId`), classifies, evaluates, and transitions. It never directly mutates Treasury/Position/Portfolio.
- **Recovery Attempts** — `recoveryIdFor`, `buildRecoveryAttempt`, `RecoveryAttemptStore`/`InMemoryRecoveryAttemptStore`.
- **Recovery Journal** — `buildRecoveryJournalEntry`/`verifyRecoveryJournal` and `buildRecoveryEvent`/`verifyRecoveryEvents`, all hash-chained.
- **Recovery Reconciler** — `reconcileRecoveryPlan` validates the recovery journal/event chains, retry count, route/hedge history, circuit state, and degradation state, returning `FULLY_RECONCILED`/`RECONCILED_WITH_WARNINGS`/`FAILED`.
- **Recovery Flow** — `recoverFromFailure` exposes deterministic `makeFailure`, `authorizationGate`, `shouldRetry`, `recordRetry`/`recordReroute`/`recordHedge`.
- **Recovery Scenarios** — `RecoveryScenarioRunner` runs the AFIS/ABL recovery scenarios (timeout retry, venue down reroute, partial-fill reroute, stale-edge abort, partial-fill hedge, liquidity reroute, treasury-expired abort, hash-mismatch halt, stale-odds revalidate, BACK/LAY hedge) with optional replay verification.

### Fault Injection + Replay

- `services/market-engine/src/simulation/fault-injector.ts` — deterministic `FaultInjector`/`FaultScenario`/`InjectedFault` with `faultToFailureType`.
- `services/market-engine/src/replay/replay-state.ts` — `createStatePlane` providing the isolated state plane used by recovery replay.
- `services/market-engine/src/replay/recovery-replay.ts` — `recoveryReplay` reconstructs fresh relief/recovery/state-plane clones from a canonical command log and `compareRecoveryReplay` compares failure IDs, recovery IDs, retry counts, circuit/degradation state, journal chains, and treasury/position/portfolio state. Replay never mutates live state.
- `services/market-engine/src/reconciliation/recovery-reconciler.ts` — `reconcileRecoveryStatePlane` combines recovery-plan reconciliation with the Sprint 023 state-plane reconciliation.

### Authority Chain

```text
Detection → Classification → Recovery Policy → Recovery Action
  → AEGIS → Treasury Authorization → Execution Authorization → State Plane
  → Reconcile → Replay (isolated, never mutates live state)
```

Executed via `pnpm demo:recovery`, which reports `SYSTEM STATUS: RECONCILED` and `Original == Replay: PASS`, plus `pnpm test` (reliability + recovery suites).

## Sprint 025 — Adaptive Decision, Recovery & Autonomous Control Plane

Sprint 025 turns the executable pipeline into an adaptive end-to-end control plane. It is entirely deterministic (injected clock, canonical SHA-256, no `Math.random`/`Date.now`) and strictly subordinate to the authority chain: a control decision can never mutate Treasury, Position, Portfolio or Execution directly, and recovery never creates new authority. The loop is bounded by `maxReevaluationDepth`, `maxRecoveryAttempts`, `maxReroutes` and `maxHedges`, so it can never run forever.

### Control Engine (`services/market-engine/src/control/`)

- **types / ids** — `ControlContext` (a deterministic, serializable snapshot of market, intelligence, opportunity, risk, allocation, AEGIS, treasury, execution, reliability and recovery state), `ControlAction` (`CONTINUE`,`REVALIDATE`,`REPRICE`,`RESIZE`,`REROUTE`,`RETRY`,`HEDGE`,`PAUSE`,`ABORT`,`HALT`), `ControlState` (`ACTIVE`,`DEGRADED`,`PAUSED`,`HALTED`,`EMERGENCY_STOP`), `ControlDecision`, `ControlJournalEntry`, `ControlMetrics`, canonical `controlDecisionId`/`controlEventId`/`controlIdempotencyKey`.
- **ControlDecisionEngine** — deterministic `decide(ControlContext)`: kill-switch conditions win first, then authority/authorization checks, then stale-intelligence/edge/confidence/fill/venue handling, then bounded-loop guards, then policy default. Produces a `ControlDecision` with an idempotency key `control:{correlationId}:{decisionId}:{action}`.
- **ControlEngine** — owns the kill-switch state machine (`ACTIVE`/`DEGRADED`/`PAUSED`/`HALTED`/`EMERGENCY_STOP`), an exactly-once idempotency registry, and an append-only hash-chained control journal + global event chain (`oship.control.event.v1`). `emergencyStop` trips `EMERGENCY_STOP`; while stopped, new opportunities / allocations / execution / Treasury reservations are blocked but reconciliation, audit, replay and settlement recovery remain available.
- **ControlReconciler** — validates control journal/event chains, decision/metric counts and kill-switch state coherence.
- **ControlReplay** — reconstructs a fresh ControlEngine from a deterministic command log and compares LIVE vs REPLAY (state, decisions, metrics, journal/event chains). Replay never mutates live state.
- **control-feedback** — the execution feedback loop; folds execution metrics into the next `ControlContext` (bounded by depth).
- **control-recovery-integration** — maps the Sprint 024 recovery plane into control decisions (STALE_EDGE -> REVALIDATE/ABORT, PARTIAL_FILL -> REROUTE/HEDGE, VENUE_FAILURE -> REROUTE, TIMEOUT -> RETRY/REROUTE, DATA_CORRUPTION -> PAUSE/ABORT, TREASURY_MISMATCH -> ABORT, POSITION_MISMATCH -> PAUSE, RECONCILIATION_FAILURE -> HALT, CRITICAL_ANOMALY -> HALT, PROVIDER_DEGRADATION -> PAUSE/REROUTE), always through AEGIS -> Treasury -> Execution.
- **control-scenarios** — 10 deterministic AFIS/ABL end-to-end scenarios (successful arbitrage, ABL value bet, stale edge, partial fill, venue failure, timeout, hedge, treasury mismatch, systemic failure, full replay).

### Dynamic Re-evaluation (`services/market-engine/src/revalidation/`)

`RevalidationEngine.revalidate` re-checks an opportunity at sensitive boundaries (`before-allocation`,`before-aegis`,`before-treasury`,`before-route`,`before-execution`,`after-partial-fill`,`after-retry`,`after-reroute`,`before-settlement`) and emits an immutable `RevalidationRecord` with deterministic ID, timestamp, correlation/trace, policy version, previous/current intelligence references, previous/current edge+confidence, deltas, and control decision. Edge collapse aborts; confidence collapse revalidates.

### Adaptive Strategy Selection (`services/market-engine/src/strategy/adaptive/`)

`AdaptiveStrategyEngine.select` deterministically scores candidate strategies (AFIS arbitrage/funding arb/cross-venue/market-making/liquidity/hedge; ABL betting arbitrage/sports value/odds discrepancy/hedge) over expected edge, confidence, risk, liquidity, execution cost, latency, venue reliability, historical execution quality and regime. Fully replayable; no non-reproducible ML.

### Capital Reallocation (`services/market-engine/src/reallocation/`)

`ReallocationEngine.reallocate` computes a bounded, risk-aware, AEGIS-gated and Treasury-authorized revised allocation for the flow allocation -> partial execution -> released capital -> remaining capital -> revised opportunity/risk/allocation. It never mutates Treasury/Position/Portfolio.

### Global Replay (`services/market-engine/src/replay/control-vertical-replay.ts`)

`runControlVerticalSlice` / `verticalReplay` reconstruct the full pipeline path (OIIN -> Intelligence -> Opportunity -> Strategy -> Risk -> Allocation -> AEGIS -> Treasury -> Execution Intelligence -> Routing -> Execution -> Position -> Settlement -> Reliability -> Recovery -> Control -> Reconciliation) on an isolated clone. Replay runs on a full separate state; `LIVE STATE != REPLAY STATE`, and replay never mutates live state.

### Authority Chain

```text
Recovery → Control Decision → AEGIS → Treasury → Execution
Control never mutates Treasury/Execution; Recovery never creates authority.
```

Executed via `pnpm demo:control` (`SYSTEM STATUS: RECONCILED`, all stages PASS, Live State Untouched PASS), plus `pnpm test`.

## Sprint 027 — Unified Strategy Intelligence (`services/market-engine/src/strategy/intelligence/`)

The strategy layer answers HOW to exploit an opportunity. It is proposal-only and strictly subordinate to Portfolio / Risk / Allocation / AEGIS / Treasury / Execution.

### Canonical Strategy Model
`types.ts` defines the canonical `StrategyDefinition` (id, version, domain, type, opportunity compatibility, required capabilities/venues, explicit limits, correlation group/factor, enabled), the deterministic lifecycle (`StrategyStatus`: PROPOSED→EVALUATED→RANKED→SELECTED→ALLOCATED→AUTHORIZED→EXECUTING→COMPLETED plus REJECTED/EXPIRED/STALE/RISK_BLOCKED/AEGIS_BLOCKED/TREASURY_BLOCKED/EXECUTION_FAILED/CANCELLED), and the evaluation/selection/audit records. `lifecycle.ts` provides the explicit transition graph and terminal-state helpers.

### Identity & Versioning (`ids.ts`)
All IDs are canonical SHA-256 over (opportunity, strategy, configuration, portfolio context, risk context). `strategyFingerprint`, `candidateId`, `evaluationId`, `decisionId`, `replayId` are stable across processes and replay; no wall-clock identity, no process-local counters.

### Templates (`templates.ts`, `afis/`, `abl/`)
A single immutable, versioned catalog of 25 strategy templates. AFIS: cross-venue (direct/conservative/latency-aware/capital-efficient), triangular (base/liquidity-constrained), funding (carry/basis+funding/hedged), basis (convergence/market-neutral), market-making (passive/inventory-aware/adaptive-spread), liquidity (momentum/mean-reversion). ABL: surebet (equalized/risk-minimized/capital-efficient), back/lay (balanced/profit-lock/min-liability), +EV (flat/confidence-weighted/edge-weighted), hedge (balanced/asymmetric/capital-minimized). Each declares explicit limits and modifiers; `afis/strategies.ts` and `abl/strategies.ts` export scoped views.

### Candidate Generation (`generator.ts`)
`generateStrategyCandidates` enumerates every compatible template for the opportunity type, verifies compatibility, and emits canonical `StrategyCandidate`s in deterministic order. It never evaluates, ranks, or mutates downstream systems.

### Compatibility (`compatibility.ts`)
`checkCompatibility` rejects a strategy when the opportunity type is incompatible, data/capabilities are missing, a required venue is unavailable, liquidity is absent, capital is invalid/zero/negative, the strategy is disabled, or the opportunity is stale.

### Economics & Evaluation (`economics.ts`, `evaluator.ts`)
`computeStrategyEconomics` applies the reusable cost stack (expected return − fees − slippage − latency − execution failure − liquidity − capital − risk = risk-adjusted expected return) with per-leg validity gating (a multi-leg strategy is only profitable when every leg is economically valid). `evaluateStrategy` folds in limit enforcement, portfolio awareness, capital availability and timeframe, and emits a single deterministic `StrategyEvaluation`.

### Portfolio Awareness (`portfolio-awareness.ts`)
`assessPortfolio` reads the existing portfolio state to compute resulting exposure and to detect portfolio/domain/instrument/correlation/position/capital conflicts BEFORE allocation.

### Ranking & Selection (`ranking.ts`, `selection.ts`)
`rankStrategies` scores admissible strategies by a configurable composite policy; `selectStrategy` picks the highest-scoring admissible strategy or returns `NO_ADMISSIBLE_STRATEGY`, recording every rejected alternative and a deterministic decision id.

### Registry (`registry.ts`)
`StrategyRegistry` extends the strategy registry concept with register/unregister/enable/disable/lookup/compatibility/versioning/health. A disabled or incompatible strategy is never selected.

### Engine & Control Advisory (`engine.ts`)
`StrategyDiscoveryEngine.discover` runs generate → evaluate → rank → select → audit in one deterministic pass. `advisory` maps market changes to the existing `ControlAction` vocabulary (CONTINUE/REVALIDATE/RESIZE/REROUTE/ABORT/HEDGE/PAUSE/HALT) but only suggests an action — the existing Control Engine remains the decision-maker.

### Replay & Audit (`replay.ts`)
`StrategyReplay` / `StrategyReplayEngine` reproduce the exact candidate set, evaluations, ranking, selection and decision id for identical inputs in a fresh isolated engine; `compare` reports divergence. `engine.discover` emits a structured `StrategyAuditRecord` (`oship.strategy.v1`).

### Authority Chain
```text
Opportunity → Strategy (proposal) → Portfolio → Risk → Allocation → AEGIS → Treasury → Execution
```
Strategy NEVER mutates Portfolio / Risk / Allocation / AEGIS / Treasury / Execution; no real-money execution.

## Sprint 028 — Unified Capital Allocation & Portfolio Optimization (`services/market-engine/src/allocation/optimizer/`)

The allocation layer answers HOW MUCH of the single unified OSHIP Treasury should be committed to each eligible (Opportunity + selected Strategy). It is proposal-only and strictly subordinate to Portfolio / Risk / AEGIS / Treasury / Execution.

### Authority Chain (partial pipeline)
```text
OIIN → Intelligence → Opportunity Discovery → Strategy Selection → Portfolio Context
     → Risk Evaluation → Capital Optimization → Allocation → AEGIS → Treasury → Execution
```
Allocation answers HOW MUCH; AEGIS answers IS AUTHORIZED; Treasury answers IS CAPITAL AVAILABLE/RESERVED. No role is collapsed; no authority is bypassed. Allocation NEVER mutates Treasury / Portfolio / Risk / AEGIS / Execution.

### Canonical Allocation Model (`types.ts`)
`AllocationCandidate` exposes required/maximum/minimum capital, gross/net/risk-adjusted expected return, edge, capital efficiency, confidence, liquidity, execution probability, risk, correlation group/factor, time horizon, capital duration and capital turnover, allocation mode (PARTIAL_ALLOWED / ALL_OR_NOTHING), and a validity fingerprint. `AllocationDecision` carries the allocation_id, opportunity_id, strategy_id, domain, requested/allocated/unallocated capital, allocation_ratio, capital efficiency, expected/risk-adjusted return, confidence, liquidity, risk score, correlation_exposure, portfolio_exposure, time horizon, duration, turnover, status, reason, policy/config version, timestamp and fingerprint. `AllocationResult` exposes input/reserved/available capital, total/scheduled/unallocated capital, decisions, rankings, rejections, scores, constraints, policy/config version, invariant violations and a fail-closed decision.

### Lifecycle (`lifecycle.ts`)
Deterministic state machine PROPOSED→EVALUATED→OPTIMIZED→RISK_APPROVED→AEGIS_APPROVED→TREASURY_AUTHORIZED→ALLOCATED, plus terminal REJECTED/RISK_BLOCKED/CAPITAL_BLOCKED/AEGIS_BLOCKED/TREASURY_BLOCKED/EXPIRED/STALE/CANCELLED. `assertAllocationTransition` guards illegal transitions; blocks map to the correct rejected status.

### Candidate Builder (`candidate-builder.ts`)
`buildAllocationCandidate` maps an Opportunity + selected Strategy (+ definition) into a validated candidate, deriving allocation mode from the strategy type (triangular/funding/basis → ALL_OR_NOTHING; market-making/sports +EV/surebet → PARTIAL_ALLOWED), computing capital efficiency = risk-adjusted return / required capital, capital duration and turnover from the horizon, and re-checking opportunity expiry/freshness at evaluation time. Invalid candidates (missing capital, non-finite economics, below min edge/confidence, stale/expired) are rejected before optimization.

### Scoring (`scoring.ts`)
`scoreCandidate` produces a transparent composite (edge, confidence, execution, liquidity, capital efficiency, duration bonus, risk penalty, correlation penalty). Eight policies (Fixed, Confidence Weighted, Edge Weighted, Capital Efficiency Weighted, Risk Adjusted, Liquidity Constrained, Correlation Adjusted, Hybrid) re-weight the same observable factors; every factor is surfaced in `CandidateScore.factors`.

### Constraints (`constraints.ts`)
`checkCandidateConstraints` verifies total/domain/strategy/position/event/correlation exposure, per-candidate cap, liquidity reserve, minimum viable allocation and executable-liquidity bounds. `allocationInvariantCheck` verifies cross-cutting invariants (sum(allocations) ≤ allocatable budget; available+reserved+allocated = total; exposure ≤ limits; allocation ≤ executable liquidity) and fails closed to ALLOCATION_BLOCKED.

### Optimizer (`optimizer.ts`)
`CapitalOptimizer.optimize` is a deterministic, bounded greedy constrained-capital optimizer: filter invalid/stale → score → sort with stable tie-breakers (risk-adjusted return, capital efficiency, confidence, opportunity id, strategy id) → clamp partial candidates to the binding capital/exposure/liquidity budget → enforce all-or-nothing (full required capital or reject) and minimum viable allocation → verify every invariant. It is cross-domain (AFIS + ABL compete for ONE Treasury), portfolio-aware (uses existing portfolio exposure), correlation-aware (respects correlation-group budget), liquidity-aware, and deterministic across identical inputs.

### Reallocation (`reallocation.ts`)
`computeReallocation` derives per-candidate delta (previous/new/delta) for a controlled REALLOCATE and re-verifies every constraint; it never mutates Treasury.

### Boundaries (`boundaries.ts`)
`evaluateAllocationAegis` marks an allocation AEGIS-approved (unoverrideable). `buildTreasuryProposal` only proposes (amount/purpose/strategy/opportunity/risk context) — Treasury remains authoritative. `allocationAuthorizationGate` and `allocationEmergencyGate` enforce fail-closed treasury-cover and EMERGENCY_STOP/HALTED → NO_NEW_ALLOCATION.

### Revalidation (`revalidation.ts`)
`revalidateAllocation` re-checks Opportunity/Strategy/Portfolio/Risk/Liquidity/Correlation/Capital and reports a deterministic ControlAction (CONTINUE / REVALIDATE / REJECT / EXPIRED / STALE) with explicit material changes, reusing the existing Control vocabulary.

### Replay & Audit (`replay.ts`)
`AllocationReplay.runLive`/`runReplay` reproduce the exact candidate filtering, scores, ranking, allocations, rejections and ids in fresh isolated optimizers; `compare` reports divergence. `buildAllocationAudit` emits `oship.allocation.v1` with optimization_id, candidate_ids, strategy_ids, input/reserved/available capital, scores, ranking, allocations, rejections, constraints, decision and reason.

### Engine (`engine.ts`)
`UnifiedAllocationEngine.allocate` runs candidate build → optimize → AEGIS → Treasury proposal → audit → revalidation in one deterministic pass, returning a rich output and a replay key. EMERGENCY_STOP/HALTED blocks new allocation while reconciliation/audit/replay remain available.

## Sprint 029 — Unified Portfolio Risk Decision & Risk Budget (`services/market-engine/src/risk/decision/`)

The risk decision layer answers **IS THE ALLOCATION SAFE**. It is a decision/assessment authority: it never mutates Treasury / Portfolio / Risk / Execution, never executes, never calls a provider, and never bypasses AEGIS.

### Authority Chain (partial pipeline)
```text
OIIN → Intelligence → Opportunity → Strategy → Allocation → RISK DECISION → AEGIS → Treasury → Execution
```
Allocation answers HOW MUCH; Risk Decision answers IS IT SAFE; AEGIS answers IS AUTHORIZED; Treasury answers IS CAPITAL AVAILABLE/RESERVED. OSHIP has ONE Portfolio, ONE Risk Authority, and ONE Treasury; AFIS and ABL are assessed together in a single unified risk budget with no preferential treatment.

### Canonical Risk Decision Model (`types.ts`)
`RiskAssessmentMetrics` exposes per-candidate projected total/domain/strategy/opportunity/position/event/correlation/instrument exposure, liquidity exposure, capital-at-risk, max loss, expected loss, risk-adjusted return, concentration, utilization, risk budget remaining, available capital after, stress loss, worst-case portfolio impact, confidence, freshness, expiry, time horizon, allocation mode and minimum viable. `RiskDecision` carries the risk_decision_id, allocation_id, candidate_id, domain, requested/approved/blocked capital, risk-safe capital, scale, state, violations (priority-sorted), metrics, risk score, reason, config/policy/budget version, configuration fingerprint, timestamp and fingerprint.

### Lifecycle (`lifecycle.ts`)
PROPOSED→ASSESSED→RISK_CHECKED→RISK_APPROVED, plus terminal REJECTED / RISK_BLOCKED / CAPITAL_BLOCKED / LIQUIDITY_BLOCKED / CORRELATION_BLOCKED / CONCENTRATION_BLOCKED / STALE / EXPIRED / CANCELLED. `riskBlockStateFor` maps a primary violation to its terminal state.

### Config (`config.ts`)
Versioned `RiskConfig` (version / policyVersion / budgetVersion), `RiskLimits` (total/domain/strategy/opportunity/position/event/correlation/instrument exposure, concentration, min confidence, liquidity reserve, capital-at-risk, expected-loss, max-loss, stress-loss, drawdown), `RiskBudget` (total → domain → strategy, used/remaining/utilization), and `StressConfig` (NORMAL/ADVERSE/SEVERE/EXTREME with multiplier + loss factors). All validated; `riskConfigurationFingerprint` makes a run's config fully observable.

### Exposure (`exposure.ts`)
`projectExposureForCandidate` / `aggregateProjectedExposure` fold the portfolio snapshot + the candidate's proposed capital into the resulting exposure per dimension. The Portfolio remains authoritative; this is a pure value computation used to decide risk.

### Concentration / Correlation / Liquidity / Drawdown
`concentrationMetrics` measures share-of-total-capital on instrument/opportunity/strategy/event/correlation. `correlationMetrics` computes the projected correlation-group exposure and factor-adjusted exposure. `liquidityMetrics` ensures risk never allocates beyond real executable liquidity and preserves the reserve. `drawdownMetrics` derives drawdown from peak vs projected equity; `riskBudgetMetrics` computes utilization and remaining budget.

### Stress (`stress.ts`)
Deterministic stress engine. For each scenario (NORMAL/ADVERSE/SEVERE/EXTREME) it computes portfolio loss, candidate loss, domain loss, risk-budget utilization and remaining budget from the configured loss factors. `runStress` returns the full ordered scenario set, worst-case scenario/loss, and a max-scenario-loss-exceeded flag.

### Scoring (`scoring.ts`)
Deterministic composite risk score over observable bounded factors (exposure, concentration, correlation, liquidity, drawdown, stress loss, capital-at-risk, freshness, confidence). `scoreToScale` maps a score to FULL/PARTIAL/REDUCED/BLOCKED. Higher = riskier; no ML.

### Assessor (`assessor.ts`)
`assessCandidate` projects the portfolio, evaluates every dimension, computes the risk-safe capital (the largest amount satisfying all limits), and derives a deterministic scale. It exposes a running (sequential) budget so the shared available capital + exposure are enforced across the batch (AFIS + ABL together). Fatal violations (emergency-stop/stale/expired/all-or-nothing-block) block outright; scalable exposure/concentration/liquidity/drawdown/stress violations scale the approved capital down to the risk-safe amount. Final metrics are computed from the APPROVED capital (never the full request).

### Engine (`engine.ts`)
`RiskAssessorEngine.assess` consumes Allocation Decisions + candidates + portfolio, processes them sequentially against a running portfolio snapshot (enforcing the unified budget), aggregates violations (priority-sorted), runs the aggregate stress, checks invariants (fail-closed), performs revalidation, and returns a `RiskDecisionResult` plus a deterministic fingerprint.

### Revalidation (`revalidation.ts`)
Re-checks freshness before approval: opportunity expired / strategy stale / allocation stale / risk config changed → REVALIDATE / REJECT / EXPIRED / STALE, using the existing Control vocabulary.

### Boundaries (`boundaries.ts`)
`evaluateRiskAegis` maps a risk scale to AEGIS APPROVED / PARTIALLY_APPROVED / BLOCKED (risk never bypasses AEGIS). `riskTreasuryGate` only reports whether the proposed amount is coverable — Treasury remains authoritative and is never touched here. `riskEmergencyGate` enforces EMERGENCY_STOP/HALTED → no approval.

### Replay & Audit (`replay.ts`, `audit.ts`)
`RiskReplay.runLive`/`runReplay` reproduce the exact decision ids, risk scores, approved capital, states, stress results and fingerprints in fresh isolated engines. `buildRiskAudit` emits `oship.risk.v1` with risk_decision_id, allocation_id, portfolio_id, config/policy version, state, decision, approved/blocked capital, risk score, budget utilization, stress summary, reason, fingerprint, timestamp.

## Sprint 030 — Unified Execution Planning & Smart Routing (`services/market-engine/src/execution/planning/`)

Added the deterministic Execution Planning & Smart Routing Engine on top of the Sprint 029 Risk Decision layer. `execution/planning/` answers **WHAT / WHERE / WHEN / HOW** to convert a Risk-approved Allocation Decision into an auditable, replayable, deterministic **Execution Plan** — but it never executes. **Planning ≠ Execution.** The planner is proposal-only: it never calls a live exchange/bookmaker, never mutates Treasury / Portfolio / Risk, never touches credentials, and never bypasses AEGIS. Paper execution reuses the existing deterministic paper pipeline.

```text
Opportunity → Strategy → Allocation → RISK DECISION → Execution Plan
       → Smart Routing (multi-venue) → Slicing → AEGIS → Treasury Authorization
       → PAPER EXECUTION → Position → Reconciliation → Replay
```

### Canonical Execution Plan (`types.ts`)
`ExecutionPlan` carries execution_plan_id, allocation_id, opportunity_id, strategy_id, domain, status, requested/approved/planned/unplanned capital, venue/route/order/leg counts, execution_mode, routing_policy, slicing_policy, estimated slippage/fees/latency, expected_fill_ratio, liquidity_utilization, time_horizon, deadline, freshness, risk/allocation/aegis/treasury reference, config/policy version, timestamp, correlation/trace and fingerprint. All IDs and fingerprints are deterministic SHA-256 over canonical serialization.

### Lifecycle (`lifecycle.ts`)
PROPOSED → VALIDATED → ROUTED → SLICED → READY → AEGIS_APPROVED → TREASURY_AUTHORIZED → PAPER_EXECUTED → RECONCILED, plus terminal BLOCKED / STALE / EXPIRED / CANCELLED / FAILED / PARTIALLY_EXECUTED. Transitions are explicit and deterministic; the engine advances READY → AEGIS_APPROVED → TREASURY_AUTHORIZED only when AEGIS approves and Treasury can cover the planned capital.

### Execution Modes (`legs.ts`)
SINGLE_VENUE, MULTI_VENUE, SEQUENTIAL, PARALLEL, HEDGE_FIRST, LEG_FIRST. Strategy semantics decide legality: cross-venue arbitrage BUY A + SELL B coordinated; triangular A→B→C→A leg-ordering (LEG_FIRST); market making ENTRY/QUOTE/REQUOTE/EXIT (SEQUENTIAL); ABL BACK/LAY/HEDGE/MIDDLE/SUREBET (HEDGE_FIRST / PARALLEL). `modeForStrategy` returns the legal mode and `modeLegalForStrategy` validates it.

### Smart Router (`routing.ts`, `routing-score.ts`)
Deterministic. Inputs: AllocationDecision / Opportunity / Strategy / VenueState / Liquidity / Fees / Slippage / Latency / Freshness / Risk limits. Outputs `ExecutionRoute[]` (venue/provider/instrument/event/side/quantity/price/fee/slippage/latency/liquidity/score/priority). Routes scored by net economics → fill probability → liquidity → slippage → fees → latency → venue ID, with stable tie-breaking (by venue id). No ML, no randomness. A leg with no healthy venue is **skippable** (non-mandatory) → non-blocking `LIQUIDITY_INSUFFICIENT`; a mandatory/atomic leg with no healthy venue → blocking `VENUE_UNAVAILABLE`. If **no route at all** forms, the engine emits a blocking `NO_LEGIBLE_ROUTE`.

### Multi-Venue Allocation
sum(route capital) ≤ approved capital; each route capital ≤ executable liquidity; no route exceeds a venue limit; planned capital = min(sum(routes), approved), with the remainder unplanned.

### Slicing (`slicing.ts`)
FIXED_SIZE, PERCENTAGE, LIQUIDITY_PROPORTIONAL, VWAP_STYLE, TWAP_STYLE. Each slice carries slice_id, sequence, venue, quantity, notional, estimated_price/fee/slippage and deadline; slices are deterministic and sum to the route notional.

### Partial Fill (`partial-fill.ts`)
FULL / PARTIAL / UNFILLED; per-strategy action REMAIN_ON_VENUE / REROUTE / RESIZE / CANCEL / REPLAN. All-or-nothing (atomic) strategies never partial-execute; an incomplete atomic group triggers REPLAN.

### Atomic & Coordinated Legs (`legs.ts`)
leg_id, sequence, dependency_ids, atomic_group_id, side, venue, quantity, planned_price. Triangular / funding / basis / hedge / surebet are coordinated; their atomic groups are never silently split. A required leg that cannot be planned consistently → BLOCKED.

### Freshness & Expiry (`freshness.ts`)
Re-checks opportunity / strategy / allocation / risk / venue snapshot staleness. STALE → STALE, EXPIRED → EXPIRED; a stale/expired plan never reaches AEGIS.

### Boundaries (`boundaries.ts`)
`evaluateExecutionAegis` decides APPROVED / BLOCKED (never self-authorize). `buildExecutionTreasuryProposal` produces a **recommendation only** Treasury Authorization Proposal; Treasury stays authoritative and is never mutated. `executionEmergencyGate` enforces EMERGENCY_STOP/HALTED → BLOCKED with no override.

### Invariants (`invariants.ts`)
Fail-closed: planned ≥ 0; planned ≤ approved; sum(routes) ≤ planned; sum(slices) ≤ route allocation; slice quantity ≥ 0; route capital ≤ executable liquidity; no duplicate atomic leg; atomic group coordinated; all required legs present; expired not READY; stale cannot reach AEGIS; blocked cannot execute; emergency stop not bypassed; AEGIS/Treasury required; same input → same plan; replan preserves parent history.

### Replan (`replan.ts`)
Deterministic triggers (venue unavailable, liquidity reduced, price moved, stale opportunity, risk changed, allocation changed, partial fill, deadline approaching) → REPLAN_REQUIRED or a new version. Versioning preserves history; `execution_plan_version`, `parent_plan_id`, `replan_reason`; fingerprints change when the plan changes.

### Replay (`replay.ts`) & Audit (`audit.ts`)
Same input → identical plan id, routes, slices, ordering, costs, decision and fingerprint. `buildExecutionAudit` emits `oship.execution-plan.v1` with execution_plan_id, allocation_id, risk_decision_id, strategy_id, route_ids, slice_ids, status, planned_capital, estimated cost/slippage, routing/slicing_policy, replan_reference, aegis/treasury_reference, timestamp and fingerprint.

### Demo (`execution-planning-demo.ts`)
`demo:execution-planning` wires Allocation → Risk → Planning → Routing → Slicing → AEGIS → Treasury → Paper → Position → Reconcile and shows FULL / PARTIAL / BLOCKED / REROUTED / REPLAN plans, with AFIS + ABL unified. Paper only; no real-money / provider creds.

## Sprint 031 — Deterministic Market Microstructure & Execution Simulation (`services/market-engine/src/simulation/execution/`)

Added the deterministic, paper-only Market Microstructure & Execution Simulation Engine on top of the Sprint 030 Execution Plan layer. It consumes an already-authorized **Execution Plan** and simulates its execution against a deterministic market model down to canonical fills, positions, metrics, quality, reconciliation, replay and an audit record.

**SIMULATION ≠ EXECUTION AUTHORITY. SIMULATION ≠ LIVE TRADING. PAPER ONLY.** This engine is an execution *implementation*, not a new authority. It never calls a live exchange/bookmaker, never mutates Treasury / Portfolio / Risk, never touches credentials, and never bypasses AEGIS. It introduces **no second Execution / Risk / Portfolio / Treasury authority and no second AEGIS**. Positions flow through the existing Position subsystem; reconciliation through the existing reconciliation layer. A single shared simulation infrastructure serves both AFIS and ABL strategies — there is **no ABL-specific simulator**.

```text
Opportunity → Strategy → Allocation → Risk Decision → AEGIS → Treasury Authorization
       → Execution Plan → SIMULATION MARKET → ORDERS → MATCHING ENGINE → FILLS
       → POSITION → RECONCILIATION → REPLAY
```

### Canonical Model (`types.ts`, `ids.ts`)
Deterministic `SimulationMarket` (market_id, venue_id, instrument_id, timestamp, sequence, bid/ask levels with price/quantity/sequence, last_price, spread, depth, trade_flow, status), `MarketEvent` (BOOK_SNAPSHOT / BOOK_UPDATE / TRADE / QUOTE / MARKET_STATUS / VENUE_STATUS / LATENCY with event_id/timestamp/sequence/venue_id/instrument_id/fingerprint, monotonic sequences), `VenueModel` (venue_id, health HEALTHY/DEGRADED/UNAVAILABLE, latency, fees, liquidity, capacity, order book), `Order` (order_id, plan_id, route_id, slice_id, venue_id, instrument_id, side, order_type, quantity, remaining_quantity, limit_price, status, time_in_force, created_at, sequence, fingerprint), `Fill`, `ExecutionSlice`, `AtomicGroupState`, `ExecutionMetrics`, `ExecutionQualityScore`, `ReconciliationResult`, `PositionResult` and `ExecutionSimAuditRecord`. All IDs and fingerprints are canonical SHA-256 over canonical serialization; no `Date.now` / `Math.random` / random UUID.

### Deterministic Clock (`clock.ts`)
Injected `simulation_start_time`, monotonic `event_time`, monotonic `sequence`. Zero wall-clock. `tick(deltaMs, step)` advances time by a deterministic delta and sequence by a step; used to build events and order sequences.

### Versioned Config (`config.ts`)
`simulation_config_version`, `matching_policy_version`, `fee_policy_version`, `latency_policy_version`, `slippage_policy_version`, `market_impact_policy_version`. All models (fee / latency / slippage / market-impact) are explicit and validated; the versioned fields participate in `simulationConfigurationFingerprint` and therefore in the final simulation fingerprint, so every replay reports exactly which policies produced a result.

### Simulation Market & Events (`market.ts`, `events.ts`)
Per-venue books built from explicit levels (bids best-first, asks best-first; no hidden liquidity). `buildMarket` produces a deterministic market_id from venue+instrument+book identity. `buildMarketEvent` emits monotonic `MarketEvent`s with a canonical fingerprint.

### Fees, Latency, Slippage, Market Impact (`fees.ts`, `latency.ts`, `slippage.ts`)
Deterministic, versioned. Maker/taker/fixed fee stack → gross_notional, fee, net_notional. Latency is composable (network + venue + matching + ack), no randomness. Market impact / slippage is a replaceable deterministic policy (order_size, available_depth, spread, liquidity, volatility_proxy → price_impact, execution_cost) with VWAP and realized slippage_bps; no synthetic improvement.

### Orders & Order Types (`orders.ts`, `order-types.ts`)
MARKET / LIMIT / IOC / FOK / POST_ONLY with TIF GTC / IOC / FOK / DAY. `consumeBook` (PRICE_TIME: better price first, earlier sequence first) consumes asks best→worst for BUY and bids best→worst for SELL. LIMIT matches only executable levels (buy ≤ limit, sell ≥ limit). IOC executes available then cancels remainder (no residual live order). FOK is atomic (full quantity or nothing — no partial). POST_ONLY never crosses; if marketable it is REJECTED.

### Matching Engine (`matching.ts`)
`consumeBook` / `executeOrderType` implement price-time matching, partial fills (quantity conservation: requested 100 / available 63 → filled 63, remaining 37, PARTIALLY_FILLED), VWAP / average_execution_price / realized slippage_bps. `marketSide` normalizes ABL `BACK`→BUY (consumes asks) and `LAY`→SELL (consumes bids); fills carry the original side.

### Slicing (`slicing.ts`)
`buildExecutionSlices` decomposes a plan into `ExecutionSlice`s (slice_id, plan/route/venue/instrument, planned/submitted/filled/remaining/cancelled/rejected quantity, status, sequence, fingerprint). Deterministic `defaultSubmittedFn` maps an unavailable/halted venue to submitted 0; sum(slice planned) = planned.

### Venue Health (`venue.ts`)
UNAVAILABLE venues accept no new orders (fail closed); DEGRADED venues are flagged. `canPlaceOrder` / `isDegraded` gate order placement.

### Atomic Groups (`atomic.ts`)
`isAtomicStrategy` = Sprint 030 coordinated strategies ∪ `CROSS_VENUE_ARBITRAGE`. `groupForPlan` builds the group; `evaluateGroup` returns COMPLETE / PARTIAL / FAILED with a deterministic `recoveryAction` (CANCEL_REMAINDER / HEDGE / REROUTE / REPRICE / REPLAN / ABORT). The engine executes the configured policy; it never invents strategy.

### Position & Reconciliation (`position.ts`, `reconciliation.ts`)
Position delta = net fills (BUY/BACK long, SELL/LAY short); integrate with the existing Position subsystem (no parallel position engine, no per-venue position authority). `reconcile` balances planned/submitted/filled/cancelled/remaining quantity and capital / fees / slippage / position_delta, fail-closed on any imbalance.

### Metrics & Quality (`metrics.ts`, `quality.ts`)
`fill_ratio`, `completion_ratio`, `average_price`, `vwap`, `slippage_bps`, `fees`, `gross_cost`, `net_cost`, `latency_ms`, `market_impact`, `cancel_ratio`, `reject_ratio`. `computeQuality` produces an explainable, deterministic Execution Quality Score (fill_ratio, slippage, fees, latency, market_impact, completion_ratio) with per-factor weight/value/contribution — no ML.

### Recovery & Replay (`recovery.ts`, `replay.ts`)
Deterministic `chooseRecovery` maps a `FailureClass` (venue unavailable/degraded, partial fill, thin liquidity, empty book, price moved, market halt, atomic incomplete, order rejected, latency spike) to one recovery action, always respecting Plan / Risk / AEGIS / Treasury boundaries. `compareExecutionReplay` verifies identical orders, fills, VWAP, fees, latency, positions, reconciliation and fingerprint for identical inputs.

### Audit (`audit.ts`)
`buildExecutionSimAudit` emits `oship.execution-sim.v1` (simulation_id, plan_id, order ids, fill ids, venue ids, metrics, fees, slippage, latency, market_impact, status, config_versions, timestamp, fingerprint).

### Engine (`engine.ts`)
`ExecutionSimulationEngine.simulate` runs the full pipeline: validate config → AEGIS/Treasury authorization gate → build slices → build orders → per-venue execution → derive slice state → position → metrics → atomic evaluation → quality → reconciliation → invariants (fail-closed) → configuration fingerprint + simulation fingerprint. `validateAuthorization` blocks any run that is not AEGIS- and Treasury-authorised.

### Invariants (`invariants.ts`)
Fail-closed: filled ≤ submitted; remaining ≥ 0; filled + remaining + cancelled (+ rejected) = submitted; FOK never partial; IOC never live remainder; POST_ONLY never TAKER-filled; fee ≥ 0; slippage ≥ 0; cancelled orders cannot fill; unknown venues cannot fill; position delta = net fills; atomic groups obey policy (incomplete WITH recovery); reconciliation balances.

### Demo (`execution-simulation-demo.ts`)
`demo:execution-simulation` shows FULL FILL, PARTIAL FILL, SLIPPAGE+FEES, IOC, FOK, POST_ONLY, MULTI-VENUE, VENUE FAILURE, ATOMIC FAILURE, LATENCY, REPLAY, RECONCILIATION+AUDIT, ending with `SYSTEM STATUS: RECONCILED / REPLAY: PASS / INVARIANTS: PASS`.

## Sprint 032 — Adaptive Execution Intelligence (`services/market-engine/src/execution/intelligence/`)

Added the deterministic, paper-only **Adaptive Execution Intelligence** layer on top of the Sprint 031 Execution Simulation engine. It closes the control loop around an executing plan: observe what the simulation produced, measure it against thresholds, score quality, generate signals, decide an adaptive action through six deterministic policies, propose the action, validate it fail-closed, apply it as an explicit plan revision with lineage, and record everything in a hash-chained audit log — then re-simulate the revised plan in the next cycle.

**ADAPTIVE INTELLIGENCE ≠ AUTHORITY. PAPER ONLY.** The controller is *proposal-only*: every proposal carries `requiresExecutionAuthorization: true` and `treasuryMutation/riskMutation/portfolioMutation: false` (literal types); application goes exclusively through deterministic plan revisions (`reviseExecutionPlan`); the original plan is immutable and every revision creates plan-v(n+1) with an explicit parent link. Revised plans require Risk and AEGIS revalidation (PENDING). No second Treasury/Risk/Portfolio/Execution authority, no second AEGIS, no live exchange/bookmaker APIs, no provider credentials, no ML.

```text
Execution Plan → Simulation Result → Telemetry → Thresholds → Signals → Quality
  → Adaptive Decision (6 policies, dominance order) → Proposal → Validation
  → Apply (plan revision v1→v2→v3, lineage preserved) → Record (hash-chained audit)
  → next cycle re-simulates the revised plan … COMPLETED / ABORTED / BLOCKED / EXHAUSTED
```

### Observation Layer (`telemetry.ts`, `order-aging.ts`, `venue-health.ts`)
Immutable `ExecutionTelemetry` per cycle: planned/submitted/filled/remaining, fill + completion ratio, quantity-weighted side-aware slippage (bps) against per-route arrival references, fees/cost, latency (per venue + aggregate), impact, per-order and per-venue rollups, rejection/cancellation/partial-fill state, atomic-group state. `assessOrderAging` flags WARNING/CRITICAL aged orders. `assessVenueHealth` computes deterministic HEALTHY/DEGRADED/UNAVAILABLE/RECOVERING states from latency, rejection rate, fill quality, liquidity, stale market data and simulation failures, with recovery **hysteresis** (DEGRADED → RECOVERING → HEALTHY, never instant) and routing multipliers (1 / 0.85 / 0.5 / 0).

### Measurement Layer (`thresholds.ts`, `signals.ts`, `quality.ts`)
12 deterministic threshold evaluations (max/min directions, breached flag, severity with a critical multiplier). 13 canonical signal types — FILL_RATE_LOW, SLIPPAGE_HIGH, LATENCY_HIGH, LIQUIDITY_DETERIORATION, VENUE_DEGRADED, VENUE_FAILED, ORDER_AGING, PRICE_DRIFT, PARTIAL_FILL, ATOMIC_RISK, EXECUTION_COST_HIGH, EXECUTION_QUALITY_DEGRADED, EXECUTION_QUALITY_RECOVERING — each with evidence and a canonical fingerprint. `evaluateQuality` scores 7 normalized weighted dimensions (FILL, PRICE, LATENCY, LIQUIDITY, COST, VENUE, COMPLETION) into a composite with fixed A–F grades and BASELINE/IMPROVING/DEGRADING trend detection.

### Decision Layer (`policies.ts`, `decision.ts`)
Six deterministic policies, all always evaluated, with a strict dominance order **ABORT(0) > REPLAN(1) > REROUTE(2) > RESLICE(3) > REPRICE(4) > KEEP(5)**; the best applicable policy wins, KEEP is the always-applicable fallback. Emergency stop always forces ABORT. Unrecoverable atomic risk (no alternative venue) ABORTs; recoverable atomic risk REPLANs. Reslice is suppressed for atomic groups (all-or-nothing semantics never silently split) and yields to reprice when the price is actively drifting (a price problem is not a size problem). `decide` produces the immutable decision with action, confidence, severity, reason, evidence, constraints and input/configuration/decision fingerprints (tamper-evident).

### Proposal Engines (`reprice.ts`, `reslice.ts`, `reroute.ts`, `replan.ts`, `abort.ts`)
REPRICE: one tick through the current mid, tick-aligned, clamped to the price-limit band, null beyond the hard max-reprice band (fail closed — escalate instead of overpaying). RESLICE: deterministic slice plan covering exactly the remaining quantity per venue with remaining work (equal slices, remainder first, deterministic inter-slice delay); null when nothing remains or the plan is atomic. REROUTE: 8-factor deterministic venue scoring (liquidity, spread, fees, slippage, latency, venue health, fill probability, execution quality) with UNAVAILABLE/zero-liquidity exclusion and a deterministic advantage threshold; moves only the remaining quantity. REPLAN: deterministic re-routing of the remaining work preserving atomic leg identity (routeId/legId), per-venue liquidity caps and total quantity; **returns null when the eligible candidates cannot cover the remainder** (fail closed). ABORT: full cancellation of all outstanding work. All proposals are authority-marked (Execution authorization required; Treasury/Risk/Portfolio never mutated).

### Controller (`controller.ts`)
`AdaptiveExecutionController.process` runs the 9-stage lifecycle OBSERVE → MEASURE → SCORE → SIGNAL → DECIDE → PROPOSE → VALIDATE → APPLY → RECORD with per-stage traces. VALIDATE is fail-closed: tick/band/quantity/coverage checks per action type, plan-identity check, and one-applied-action-per-(plan, cycle) dedupe. Invalid or unconstructable proposals are rejected and audited (`ADAPTIVE_ACTION_REJECTED`) — nothing executes. APPLY produces the revised plan (v1→v2→v3) through `reviseExecutionPlan`; the controller tracks decisions, applied actions, lineage, quality-score trend, venue-health hysteresis state and a hash-chained audit log with `verify()`.

### Closed Loop (`engine.ts`, `feedback.ts`)
`ExecutionIntelligenceEngine.run` drives the loop: per-cycle **AEGIS + Treasury authorization gates** (any unauthorized cycle → BLOCKED, nothing simulated), simulation of the *current* plan, telemetry → signals → quality → unified `ExecutionFeedback` (immutable, fingerprinted) → controller. Terminal states: COMPLETED (nothing remaining), ABORTED (abort applied — terminal, fail closed), BLOCKED (authorization), EXHAUSTED (cycle budget ended with quantity outstanding — remainder never silently reduced). Venue health carries across cycles for hysteresis. `maxAdaptiveCycles` / `maxConsecutiveKeeps` bound the loop.

### Replay, Audit, Invariants (`replay.ts`, `audit.ts`, `invariants.ts`)
`replayIntelligence` re-runs the same inputs in an isolated engine and compares signals, quality, decisions, proposals, lineage, final state and fingerprints — identical inputs must produce identical outputs. `buildAuditEvent`/`IntelligenceAuditLog` emit `oship.execution-intelligence.v1` (12 event types: TELEMETRY_RECORDED, SIGNAL_GENERATED, QUALITY_EVALUATED, ADAPTIVE_DECISION, REPRICE/RESLICE/REROUTE/REPLAN_PROPOSED, ADAPTIVE_ACTION_REJECTED, ADAPTIVE_ACTION_APPLIED, EXECUTION_ABORTED, REPLAY_COMPLETED) as a GENESIS-linked SHA-256 hash chain with tamper-evident `verify()`. `checkIntelligenceInvariants` enforces the hard invariants fail-closed: immutable initial plan, valid lineage (start, versions, parents, no orphans), total quantity preservation across revisions, authority markers on every proposal, AEGIS + Treasury authorization every cycle, emergency-stop dominance, no duplicate applied actions, atomic integrity (including ABL BACK/LAY semantic sides), domain consistency, no credential-like fields, decision fingerprint verification and replay equivalence.

### Demo (`execution-intelligence-demo.ts`)
`demo:execution-intelligence` drives the real closed loop through every action and condition — KEEP, REPRICE (30bps drift, remainder repriced one tick), RESLICE (40% fill, remainder re-sliced, total preserved), REROUTE (partially-filled venue loses to a superior alternative; **the remaining 6 units move, not the original 10**), REPLAN (atomic venue failure, legs preserved), ABORT (emergency stop, full cancellation), VENUE DEGRADATION (DEGRADED → RECOVERING hysteresis), VENUE FAILURE (no alternative → fail-closed ABORT), PARTIAL FILL, HIGH LATENCY, HIGH SLIPPAGE, FAIL-CLOSED REPLAN (uncoverable candidates → null proposal, rejected + audited, remainder intact), REPLAY (identical), AUDIT (hash chain verified), INVARIANTS — ending with `SYSTEM STATUS: RECONCILED`.
