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

## Sprint 033 — Autonomous Execution Control Plane (`services/market-engine/src/execution/control/`)

Added the deterministic, paper-only **Autonomous Execution Control Plane** — one control engine over the Sprint 030–032 execution stack. Each control cycle runs the full loop: simulate the current plan (Sprint 031), observe telemetry/signals/quality/venue health (Sprint 032), move through a 12-state control machine, resolve a precedence-ordered control decision, validate it through the narrow Risk/AEGIS bridges, apply the chosen action as a plan revision through the ONE Execution authority, checkpoint the session, and feed the result into the next cycle — until COMPLETED, ABORTED or EXHAUSTED.

**THE CONTROL PLANE IS NOT AN AUTHORITY. PAPER ONLY.** It may observe, evaluate, request validation/authorization, submit execution revisions and receive results. It may NOT mutate Treasury or Portfolio, override Risk, bypass AEGIS, execute directly, or call provider APIs. The authority bridge exposes exactly three surfaces — `risk`, `aegis`, `execution` — with literal `treasuryMutation: false` / `portfolioMutation: false` markers enforced by invariant.

```text
Execution Plan → Simulation → Telemetry → Execution Intelligence → Control Cycle
  → Decision (precedence: EMERGENCY_STOP > HARD_RISK_VIOLATION > AEGIS_REJECTION
    > ABORT > REPLAN > REROUTE > REPRICE/RESLICE > WAIT > CONTINUE > COMPLETE)
  → Risk/AEGIS validation (fail closed on anything ≠ APPROVED)
  → Action applied through the Execution authority (budgeted, deduped, lineaged)
  → Checkpoint → Feedback (current vs previous vs baseline) → next cycle
  → COMPLETED / ABORTED / EXHAUSTED
```

### Control Machine (`state.ts`, `transition.ts`)
Twelve canonical states — INITIALIZED, OBSERVING, EVALUATING, DECIDING, VALIDATING, EXECUTING, WAITING_FEEDBACK, REASSESSING, REPLANNING, COMPLETED, ABORTED, EXHAUSTED — with an explicit adjacency table and `canTransition` validation. Every applied transition is validated (illegal transitions throw, fail closed), recorded immutably on the tracker history, and emitted to the hash-chained audit log. Cycles pass OBSERVING → EVALUATING → DECIDING → VALIDATING and then either EXECUTING/REPLANNING → WAITING_FEEDBACK (a revision was applied), WAITING_FEEDBACK directly (CONTINUE/WAIT/rejected action — the no-op path), or a terminal state. WAITING_FEEDBACK → REASSESSING → OBSERVING carries the next cycle; WAITING_FEEDBACK → EXHAUSTED is the canonical edge for "budget ran out with work left". No semantically-required state is ever skipped.

### Control Cycle (`telemetry.ts`, `controller.ts`, `types.ts`)
`ExecutionControlCycle` carries cycleId, executionPlanId, parentCycleId, cycleNumber, startedAt/completedAt, state, telemetry, signals, quality, decision, action, result, configurationFingerprint, inputFingerprint and outputFingerprint. Cycles are frozen on completion (immutability is an invariant) and never re-applied after recovery.

### Budgets & Limits (`budget.ts`, `limits.ts`, `scheduler.ts`)
Per-action budgets (maxCycles/maxReprices/maxReslices/maxReroutes/maxReplans/maxFailures/maxExecutionTimeMs) with current/max/remaining accounting and deterministic rejection reasons; hard limits (maxSlippageBps, maxImpactNotional, maxLatencyMs) feed abort verdicts. An unaffordable want becomes an explicit WAIT(ACTION_UNAFFORDABLE); exhausted budgets terminate the session EXHAUSTED (or ABORTED/BUDGET_EXHAUSTED for the failure budget) — never a silent continue. Counters are monotonic and ceiling-bound (invariants).

### Decision (`decision.ts`, `safety.ts`)
`decideControl` collects every candidate verdict and resolves by the canonical precedence — safety can never be overridden by an optimization. Emergency stop dominates everything; Risk/AEGIS validation that is not APPROVED (rejected *or* pending) aborts fail-closed; oscillation protection outranks ordinary adaptations; with work outstanding the Sprint 032 policy suite maps onto control actions (REPLAN/REROUTE/REPRICE/RESLICE); WAIT is a deliberate deferral (same-action cooldown, venue-recovery hysteresis, improving-trend, unaffordable action); CONTINUE maps from KEEP; COMPLETE only when the completion engine's conditions all hold, and optimization verdicts are suppressed entirely once no work remains.

### Multi-Cycle Feedback, Oscillation, Hysteresis (`multi-cycle feedback via controller`, `decision.ts`)
Feedback compares current vs previous vs baseline quality: improving/degrading trends, oscillation, repeated failures, repeated reroutes/reprices, diminishing improvement and recovery. `detectOscillation` catches venue flip-flops (reroute A→B→A), repeated identical actions and action ping-pong, deterministic and windowed; on detection the configured policy fires (ABORT, or REPLAN). Quality bands and venue health use hysteresis with recovery thresholds distinct from degradation thresholds, so bands never flap around a boundary.

### Completion & Abort (`completion.ts`, `abort.ts`)
COMPLETED requires: target filled, all atomic legs satisfied, risk valid, AEGIS valid, reconciliation valid, and no unresolved mandatory actions; partial completion is distinguishable. Twelve canonical abort reasons (EMERGENCY_STOP, RISK_LIMIT, AEGIS_REJECTED, BUDGET_EXHAUSTED, EXCESSIVE_SLIPPAGE, EXCESSIVE_IMPACT, EXCESSIVE_LATENCY, VENUE_UNAVAILABLE, OSCILLATION_DETECTED, STALE_MARKET, UNRECOVERABLE_PLAN, INVARIANT_FAILURE). An abort preserves the full history, telemetry, audit chain, lineage, filled + remaining quantity and final state, and records a terminal ABORT revision in lineage (through the Execution authority) before the session terminates. An atomic plan that ends partially filled on a non-aborted session is converted to a fail-closed UNRECOVERABLE_PLAN abort.

### Checkpoints, Recovery, Replay (`checkpoint.ts`, `recovery.ts`, `replay.ts`)
Every cycle records a checkpoint carrying the full recovery journal (completed cycles, prior checkpoints, next sequence, budget, lineage, venue/quality/risk/aegis state, applied-action keys, audit events) with a verifiable fingerprint. `recoverControlSession` refuses unverified or foreign checkpoints (fail closed), resumes at checkpoint.cycleNumber + 1 and never re-applies an action; a recovered session is byte-identical to the uninterrupted run. `replayControlSession` re-runs the same input and proves identical cycles, decisions, audit chain, final result and session fingerprint — two replays are byte-identical to each other. `verifyAuditStream` independently re-derives every hash from the genesis.

### Audit & Invariants (`audit.ts`, `invariants.ts`)
`oship.execution-control.v1` hash-chained audit log (12 lifecycle event types: SESSION_STARTED, STATE_CHANGED, CYCLE_COMPLETED, CONTROL_DECISION, ACTION_APPLIED, ACTION_REJECTED, CHECKPOINT_RECORDED, SESSION_RECOVERED, SESSION_COMPLETED, SESSION_ABORTED, SESSION_EXHAUSTED, REPLAY_COMPLETED). `checkControlInvariants` enforces 24 hard invariants — deterministic transitions and decisions, immutable cycles and plans, lineage chain, quantity preservation at every revision boundary, budget monotonicity and ceilings, no duplicate actions/fills, ES dominance, fail-closed semantics, authority boundaries (no Treasury/Portfolio surface), checkpoint/recovery consistency, replay equivalence, atomic integrity, AFIS/ABL domain + semantic-side compatibility, and no live execution — any violation fails closed.

### Config (`config.ts`)
Versioned, validated, deep-mergeable configuration (budgets, limits, oscillation, hysteresis, adaptive thresholds) whose canonical form participates in the configuration fingerprint; two engines with the same config produce the same fingerprints.

### Demo (`execution-control-demo.ts`)
`demo:execution-control` drives the real control plane through 23 assertion-backed sections — CONTINUE, REPRICE, RESLICE, REROUTE, REPLAN, WAIT, COMPLETE, ABORT, MULTI-CYCLE, VENUE FAILURE, VENUE RECOVERY, OSCILLATION (venue + action), HYSTERESIS, BUDGET, EMERGENCY STOP, CHECKPOINT, RECOVERY, REPLAY, AUDIT, INVARIANTS, AFIS, ABL, AUTHORITY — ending `SYSTEM STATUS: RECONCILED`. One control engine serves AFIS and ABL; BACK maps to BUY/long and LAY to SELL/short with ABL semantic sides preserved across every lineage revision.

## Sprint 034 — Execution Performance Intelligence & Policy Optimization (`services/market-engine/src/execution/performance/`)

**PERFORMANCE INTELLIGENCE AND POLICY OPTIMIZATION ARE NOT AUTHORITIES. PAPER / SIMULATION ONLY.** The layer observes Sprint 033 control-session history and produces *recommendations* — an auditable policy candidate that a human/explicit process may approve. It never mutates the active policy, never deploys anything (ELIGIBLE ≠ ACTIVE), never touches Treasury/Portfolio, never duplicates Risk/AEGIS/Execution, and never calls live APIs.

### Canonical Loop
`Execution Control Sessions → Observations → Attribution → Benchmarks → Quality → Venue/Strategy/Domain Intelligence → Policy Evaluation → Deterministic Parameter Optimization → Policy Candidate → Simulation Gate → Regression Gate → Promotion Gate → auditable candidate`. One `ExecutionPerformanceEngine.analyze()` pass runs the whole loop; `replayPerformanceAnalysis` proves byte-identical reproduction of every fingerprint (metrics, ranking, candidate, lineage, audit chain).

### Layers
- **Observation (`normalization.ts`, `observation.ts`)** — immutable fingerprinted observations (one per cycle×venue) with sourced planned/execution/benchmark prices (`SourcedValue`: MEASURED/DERIVED/SIMULATED/UNAVAILABLE — unavailable metrics never carry values). Fail-closed telemetry validation (finite fields, non-negative quantities, filled+remaining=planned, fillRatio∈[0,1]); invalid telemetry throws rather than fabricates. Outcome mapping: COMPLETED; ABORTED; EXHAUSTED→PARTIAL when partially filled.
- **Attribution (`attribution.ts`)** — 12 canonical components (FEES, SPREAD_COST, SLIPPAGE, MARKET_IMPACT, LATENCY_COST, ADVERSE_SELECTION, PARTIAL_FILL_COST, REROUTE/REPRICE/RESLICE/REPLAN_COST, FAILURE_RECOVERY_COST), each with value/bps/provenance/source/availability/status/detail/fingerprint. Measured total cost (|price cost| + fees) reconciles against FEES+SLIPPAGE within tolerance; unavailable components are marked, never invented.
- **Benchmarks (`benchmark.ts`)** — six kinds: ARRIVAL_PRICE (first cycle benchmark, MEASURED), DECISION_PRICE (plan reference, MEASURED), VWAP (fill-weighted, DERIVED), BEST_OBSERVED_VENUE (min-average-slippage venue, alphabetical tiebreak, DERIVED), SIMULATED_REFERENCE and POLICY_BASELINE (available only with explicit inputs — never fabricated; provenance never mixed).
- **Metrics & Objective (`metrics.ts`, `config.ts`)** — `sessionRunMetrics` (fill rate, cost bps, slippage bps, impact bps of filled notional, latency, quality, adaptations, failures) and `aggregateCorpus`. The canonical weighted objective **Quality − Cost − Slippage − Impact − Latency − Failure − Adaptation − Incompletion** is versioned + fingerprinted; failure and incompletion penalties guarantee an aborting session can never outscore a completing one on cost savings alone.
- **Quality (`quality.ts`)** — 9 deterministic dimensions (FILL/PRICE/FEE/LATENCY/IMPACT/ROUTING/RECOVERY/POLICY efficiency + OVERALL), grades A≥.9/B≥.8/C≥.65/D≥.5/F. No ML anywhere.
- **Intelligence (`venue-score.ts`, `strategy-score.ts`, `domain-score.ts`)** — venue scorecards (fill rate, partial-fill frequency, slippage, impact, latency, failure/reroute/reprice frequency, recovery success, confidence growing with samples; statuses INSUFFICIENT_SAMPLE/NORMAL/DEGRADED/IMPROVING/STABLE/HIGH_QUALITY; under-sampled venues are isolated with zero confidence — no overfitting); strategy-level scores grouped by strategyId+domain+policyVersion without touching the Strategy Registry; domain scores with one identical rule set for AFIS and ABL (domain adapters only).
- **Policy Evaluation (`policy-evaluation.ts`)** — groups history by policyId+version; success rate, execution quality, costs, slippage, latency, adaptations, failures, recovery rate, benchmark delta, deterministic score, sample sufficiency (`minPolicySessions`).
- **Parameter Space (`parameter-space.ts`)** — 11 bounded gridded descriptors (reprice/reslice/reroute/replan thresholds, latency/order-age signal thresholds, same-action cooldown, quality-high band, reslice/reprice budgets, cycle budget). Six PROTECTED safety paths (`limits.*`, `abortOnAllVenuesStale`, `oscillation.onDetection/detectionWindow`) can never be optimized; validation rejects protected, unknown, off-grid and out-of-bounds entries. `applyParameterSet` clones the full control spec (immune to the wholesale-`adaptive` merge pitfall).
- **Optimizer (`optimizer.ts`)** — deterministic search only: COORDINATE (sweep one parameter at a time, keep improvements) and GRID (bounded exhaustive; refuses spaces beyond `MAX_GRID_COMBINATIONS` — fail closed). Every evaluation runs the candidate arm of the simulation gate on the identical corpus; the baseline arm runs once and is reused. No randomness, no ML, no heuristics.
- **Candidate (`candidate.ts`, `candidate-validation.ts`)** — immutable versioned `PolicyCandidate` (parent vN → candidate vN.M) carrying parameters, scores, expected improvement, observed sample size, gate statuses, promotion state and full lineage. `withGateResults` produces NEW candidates (originals immutable); `approveCandidate` is the ONLY path to APPROVED_CANDIDATE and requires ELIGIBLE.
- **Simulation Gate (`simulation-gate.ts`)** — baseline vs candidate arms re-run the REAL Sprint 033 `ExecutionControlEngine` on identical deterministic inputs (same plans, cycles, market replay, start times); produces per-arm corpus aggregates plus 9 deltas (quality/cost/slippage/impact/latency/completion/failure/objective/fillRate).
- **Regression Gate (`regression-gate.ts`)** — 12 protected conditions: quantity reconciliation, execution correctness, fail-closed behavior, risk boundary, AEGIS boundary, emergency-stop preservation (ES probe re-run under the candidate), budget limits, deterministic replay (arm reproduction probe), lineage integrity, audit integrity (Sprint 033 chain verification), AFIS/ABL semantics — plus protected-parameter refusal. Missing probes fail closed. Safety is never traded for performance.
- **Promotion Gate (`promotion-gate.ts`)** — deterministic state machine INSUFFICIENT_DATA → REJECTED → SIMULATION_FAILED → REGRESSION_FAILED → IMPROVEMENT_INSUFFICIENT → ELIGIBLE (→ APPROVED_CANDIDATE only via explicit approval). Improvement requires both relative (≥ `minImprovement`) and absolute (≥ `minAbsoluteImprovement`) gains.
- **Lineage (`lineage.ts`)** — policy v1 → candidate v1.1 → v1.2 → approved v2 with frozen nodes, earlier-node parent links, strict version monotonicity and byte-identical reconstruction.
- **Audit (`audit.ts`)** — hash-chained `oship.execution-performance.v1` log (GENESIS `0`×64) over 12 event types (OBSERVATION_CREATED, ATTRIBUTION_CALCULATED, BENCHMARK_CALCULATED, QUALITY_CALCULATED, POLICY_EVALUATED, OPTIMIZATION_STARTED, CANDIDATE_GENERATED, SIMULATION_COMPLETED, REGRESSION_GATE_RESULT, PROMOTION_GATE_RESULT, CANDIDATE_ACCEPTED, CANDIDATE_REJECTED); tamper/reorder/truncation fail verification.
- **Invariants (`invariants.ts`)** — 27 hard fail-closed checks over every analysis: immutability (observations/attributions/historical sessions/lineage), quantity/fill/attribution reconciliation, no unavailable fabrication, insufficient-data isolation, deterministic quality grading, AFIS/ABL semantic preservation, deterministic optimization, no protected-parameter mutation, version monotonicity, no treasury/portfolio/risk/AEGIS surfaces, no autonomous promotion, regression-gate enforcement, ES preservation, simulation input equivalence, audit hash-chain validity, deterministic replay.

### Demo (`execution-performance-demo.ts`)
`demo:execution-performance` drives the real loop through 36 assertion-backed sections — OBSERVATIONS, OUTCOMES, ATTRIBUTION, ATTRIBUTION-HONESTY, BENCHMARKS, BENCHMARK-HONESTY, METRICS, OBJECTIVE, INCOMPLETION-PENALTY, QUALITY, VENUE-SCORECARDS, VENUE-DEGRADATION, STRATEGY-SCORES, DOMAIN-SCORES, POLICY-EVALUATION, PARAMETER-SPACE, PROTECTED-PATHS, OPTIMIZER-COORDINATE, OPTIMIZER-GRID, SIMULATION-GATE, REGRESSION-GATE, REGRESSION-REJECTION (better quality but protected-path violation → REJECTED), PROMOTION-GATE, CANDIDATE, APPROVAL, LINEAGE, AUDIT, AUDIT-TAMPER, REPLAY, INVARIANTS, ENGINE-E2E (genuinely better candidate → ELIGIBLE), ADVERSE-EXECUTION, PARTIAL-FILLS, REPEATED-ACTIONS, AFIS-ABL, NO-AUTHORITY — ending `SYSTEM STATUS: RECONCILED`.

## Sprint 035 — Market-to-Execution Closed-Loop Intelligence & Attribution (`services/market-engine/src/intelligence/closed-loop/`)

**THE CLOSED-LOOP INTELLIGENCE LAYER IS NOT AN AUTHORITY. PAPER / SIMULATION ONLY.** The layer reconstructs complete opportunity lifecycles and answers, deterministically and with explicit provenance: *did the opportunity exist, what was the theoretical edge, which strategy was selected, how much capital was allocated, what did Risk constrain, what was the plan, how did execution adapt, what did it cost, did the edge survive, where did value leak, what was the realized net value, and which strategies/venues/policies preserve the most value.* It never mutates Treasury/Portfolio/Risk/AEGIS/Execution, never approves Risk, never authorizes AEGIS, never executes orders, never modifies active Strategy Registry entries or active Execution Policies, never calls live APIs and never accesses provider credentials. The single shared Treasury model is preserved — the closed loop reads the same allocation facts everyone else reads.

### Canonical Loop
`OIIN → Opportunity → Strategy → Allocation → Risk → Execution Plan → Execution Control (Sprint 033) → Execution Performance (Sprint 034) → Attribution → Realized Opportunity Value → Closed-Loop Intelligence`. One `ClosedLoopIntelligenceEngine.analyze()` pass runs the whole loop; `replayClosedLoopAnalysis` proves byte-identical reproduction of every fingerprint (lifecycle, attribution, leakage, realized value, ranking, audit chain).

### Layers
- **Source (`source.ts`)** — explicit provenance discipline at the boundary: MEASURED/SIMULATED/DERIVED/ESTIMATED/UNAVAILABLE, each with an exact derivation source string. Unknown provenance fails closed; unavailable values never carry numbers; confidence is blended, never invented.
- **Identity & Lifecycle (`opportunity.ts`, `lifecycle.ts`, `ids.ts`)** — immutable opportunity identity (id, domain, class, semantic side, fingerprint over source evidence) ingested from the ACTUAL discovery contracts; deterministic versioned classification for AFIS (cross-venue-arbitrage, triangular, funding, basis, market-making, liquidity-imbalance) and ABL (surebet, back-lay, plus-ev, hedge, middle) through ONE engine. Lifecycle reconstruction rebuilds the immutable nine-stage chain OIIN → OPPORTUNITY → STRATEGY → ALLOCATION → RISK → PLAN → EXECUTION → CONTROL → RESULT with parent lineage, version monotonicity and fail-closed contradiction checks (every cross-reference must agree; impossible orderings throw).
- **Value, Edge & Leakage (`value.ts`, `edge.ts`, `leakage.ts`, `realized.ts`)** — the theoretical value model (gross edge, estimated costs, net edge at the capital scale Risk actually approved); realized components from Sprint 034 observations (fill completion, per-venue VWAP deltas vs plan reference, measured fees + measured adaptive costs); edge preservation (preserved value, preservation ratio with explicit availability); a 17-component canonical leakage decomposition (SPREAD, SLIPPAGE, FEES, LATENCY, PARTIAL_FILL, ADVERSE_MOVEMENT, STALE_INFORMATION, OPPORTUNITY_DECAY, EXECUTION_FAILURE, REROUTE/REPRICE/RESLICE/REPLAN, VENUE_SELECTION, POLICY, CONTROL, MARKET_IMPACT) that sums exactly to theoreticalNet − realizedNet on every record; and the immutable fingerprinted RealizedOpportunityValue record.
- **Attribution (`strategy.ts`, `allocation.ts`, `capital-attribution.ts`, `risk.ts`, `execution.ts`, `control.ts`, `venue-attribution.ts`, `policy-attribution.ts`)** — one attribution per question. Strategy attribution (original vs realized value, execution success, strategy leakage). Capital attribution (requested/allocated/approved/deployed/unused capital, utilization, value per unit capital — deployed never exceeds Risk approval). Risk attribution distinguishing PROTECTIVE_CONSTRAINT from OPPORTUNITY_REJECTED, EXECUTION_LOSS, MARKET_MOVEMENT and DATA_UNCERTAINTY — Risk is never scored by realized profit; the preserved boundary is explicit. Execution attribution consuming Sprint 034 quality and quantifying execution leakage (undelivered gross). Control attribution consuming Sprint 033 sessions (adaptive-action occurrences with pre/post quality, improving vs degrading, reroute storms, oscillation-guard aborts). Venue attribution (per-venue leakage vs the best-priced benchmark venue; BACK/LAY sides preserved for ABL). Policy attribution (baseline vs candidate policy delta, end-to-end preservation — a candidate can improve execution quality while destroying end-to-end value, and both facts are recorded).
- **Intelligence & Aggregation (`opportunity-ranking.ts`, `strategy-attribution.ts`, `aggregation.ts`, `intelligence.ts`)** — strategy scorecards (preservation ratio, leakage, quality, capital efficiency, confidence) without touching the Strategy Registry; domain scorecards with one identical rule set for AFIS and ABL; **comparable analysis groups** keyed by (class, domain, strategyId, venue, policyVersion, liquidityBand, freshnessBand, riskBand) — incomparable opportunities are never silently mixed, insufficient groups carry an explicit reason; and the deterministic analytical ranking (value-per-risk weighted score, ties broken by opportunityId) that is **intelligence, never authorization** — it does not replace the existing Opportunity ranking authority.
- **Recommendations (`intelligence.ts`)** — informational only: STRATEGY_PRESERVES_MORE, VENUE_LOWER_LEAKAGE, POLICY_CANDIDATE_NOT_END_TO_END, RISK_PROTECTS_DOWNSIDE, REPRICE_IMPROVES_PRESERVATION, RESLICE_COMPLETION_VS_COST, CLASS_LOSES_VALUE, INSUFFICIENT_DATA (all carry `informational: true`; none mutates anything).
- **Lineage, Replay, Audit, Invariants (`lineage.ts`, `replay.ts`, `audit.ts`, `invariants.ts`)** — per-record lineage nodes in lifecycle order; byte-identical analysis replay (`compareClosedLoopResults` compares canonical JSON fingerprints); a hash-chained `oship.closed-loop-intelligence.v1` audit log over exactly 15 event types (GENESIS-rooted, `replay-completed` terminal) where tampering, reordering, payload substitution and truncation all fail verification; and **35 hard fail-closed invariants** (immutability, identity uniqueness, lifecycle chain integrity, quantity reconciliation, leakage reconciliation, no unavailable fabrication, capital never exceeding approval, risk-boundary preservation, emergency-stop preservation, AFIS/ABL semantic preservation, deterministic ranking, audit-chain validity, deterministic replay, no authority surfaces).
- **Engine (`engine.ts`, `config.ts`)** — one pass over the corpus with versioned, validated, deep-mergeable configuration (band thresholds, tolerances, weights, minimum sample sizes) whose canonical form participates in the configuration fingerprint; two engines with the same config produce identical fingerprints. Fail-closed on: missing opportunity identity, contradictory lifecycle records, missing allocation information, missing execution lineage, invalid quantity reconciliation, invalid timestamps, inconsistent financial values, unknown provenance — never a partial analysis.

### Demo (`closed-loop-intelligence-demo.ts`)
`demo:closed-loop-intelligence` drives the real loop through 37 assertion-backed sections — AFIS-INGESTION, ABL-INGESTION, OPPORTUNITY-IDENTITY, LIFECYCLE, STRATEGY-ATTRIBUTION, ALLOCATION-ATTRIBUTION, RISK-ATTRIBUTION, EXECUTION-ATTRIBUTION, CONTROL-ATTRIBUTION, PERFORMANCE-INGESTION, THEORETICAL-EDGE, REALIZED-VALUE, EDGE-PRESERVATION, LEAKAGE, VENUE-ATTRIBUTION, POLICY-ATTRIBUTION, CAPITAL-EFFICIENCY, STRATEGY-SCORE, AFIS-SCORE, ABL-SCORE, CROSS-DOMAIN, COMPARABLE, RANKING, INSUFFICIENT-DATA, UNAVAILABLE-PROVENANCE, FAIL-CLOSED, REPLAY, AUDIT, AUDIT-TAMPER, END-TO-END, HIGH-EDGE-POOR-EXEC, RISK-CONSTRAINED, VENUE-INDUCED-LEAKAGE, ADAPTIVE-ACTIONS, POLICY-CANDIDATE, SUPERIOR-STRATEGY, NO-AUTHORITY — ending `SYSTEM STATUS: RECONCILED`.

## Sprint 036 — Historical Intelligence & Research Plane (`services/market-engine/src/intelligence/research/`)

**THE RESEARCH PLANE IS NOT AN AUTHORITY. PAPER / SIMULATION ONLY.** The plane turns validated Sprint 035 closed-loop analyses into a deterministic, immutable, queryable historical intelligence: *what happened over time, which patterns recur, what is comparable to what, which explanations survive evidence, and what the system should study next.* It never mutates Treasury/Portfolio/Risk/AEGIS/Execution, never modifies the Strategy Registry or active policies, never calls live APIs, never accesses provider credentials. Its outputs are informational research artifacts: feedback carries `informational: true`, ranking is never authorization, and hypotheses are never facts.

### Canonical Loop
`Historical Records → Normalization → Intelligence Memory → Knowledge Graph → Research Queries → Pattern Detection → Comparative Analysis → Hypotheses → Evidence Evaluation → Findings → Rankings → Intelligence Feedback`. One `ResearchEngine.analyze()` pass runs the whole loop twice internally and refuses to emit anything unless the two passes are byte-identical (`replay.identical` is part of the result and the audit).

### Layers
- **Contracts (`types.ts`)** — re-exports the ACTUAL Sprint 035 contracts (ClosedLoopAnalysisResult, ClosedLoopProvenance, OpportunityClass/Domain, LeakageComponentName, PreservationGrade…) — never duplicates them. Explicit epistemic states everywhere: STRONG/MODERATE/WEAK/INSUFFICIENT/UNKNOWN/CONTRADICTORY/UNAVAILABLE; rejection kinds MALFORMED_HISTORY/CONTRADICTORY_DUPLICATE/INVARIANT_FAILURE; 23 pattern kinds across 6 families; 6 hypothesis statuses; 7 informational feedback kinds; 14 canonical audit event types.
- **Configuration (`config.ts`)** — versioned, validated, deep-mergeable (partial ranking-weight overrides renormalize to the simplex); the full configuration participates in every fingerprint via a content digest.
- **Identity (`ids.ts`)** — every artifact id is content-derived and prefix-tagged (res_/mem_/rqy_/cmp_/pat_/hyp_/evd_/fnd_/rnk_/fbk_/rec_/node_/edge_/revt_/rcfp_/rgrp_/rmem_/ridx_); canonical JSON makes key order irrelevant.
- **Normalization (`normalization.ts`)** — order-independent, no semantic loss: identity, domain, class, semantic side, strategy, venues (sorted, deduplicated legs), policy version, timestamps + era buckets, the full 17-component leakage decomposition, honest per-value provenance plus the explicit list of unavailable components (they never carry values). Malformed history (missing identity, unknown domain/class, invalid timestamps, non-finite freshness, no venue legs) is rejected with explicit entries.
- **Memory (`observation.ts`, `memory.ts`, `memory-index.ts`)** — immutable content-fingerprinted memory records stamped `research.memory.v1` with lineage (batch, version, supersedes, correction reason); duplicates ignored deterministically; contradictory duplicates rejected; **corrections create NEW versions** (ESTIMATED provenance, reduced evidence state, supersedes link, recorded reason) — history is never edited in place. An 11-dimension deterministic index serves analytical lookup; unknown keys return empty, never fabrications.
- **Knowledge (`knowledge.ts`, `knowledge-index.ts`, `graph.ts`, `lineage.ts`)** — aggregated entities (strategies, venues, classes, policies, domains — 19 in the reference corpus) with honest evidence states; a deterministic fingerprinted knowledge graph (13 node types, 15 edge relations, weighted aggregated edges, no orphans, no duplicates); research lineage linking every finding/pattern/hypothesis/feedback back to the memory batches it came from (dangling references invalidate the lineage).
- **Research (`query.ts`, `comparison.ts`)** — combinable-filter queries (domains, classes, strategies, venues, policies, outcomes, ranges, time windows, evidence floors) with canonical grouping and explicit insufficiency — no natural language, no LLM. Comparability-first comparisons: minimum samples per side, identical configuration fingerprints, capital-scale bounds, provenance compatibility, class overlap (waivable only where the comparison is the point — class and normalized-domain); NOT_COMPARABLE with explicit reasons; the raw cross-domain comparison is rejected by definition.
- **Intelligence (`pattern.ts`, `evidence.ts`, `hypothesis.ts`, `finding.ts`, `ranking.ts`, `feedback.ts`, `recommendation.ts`)** — pattern detection across preservation (improvement/deterioration/consistently-high/low with per-era slopes), leakage recurrence (all components), strategy (consistent outperformance requires winning EVERY era; completion-preservation divergence; high-theoretical-poor-realization), venue (venue-specific leakage, fill degradation, adverse drift), policy (baseline stability, candidate regression, improvement-without-end-to-end) and failure recurrence — each with evidence counts and confidence. Provenance-weighted evidence evaluation: UNAVAILABLE never contributes, contradiction is decided by opposing-population means with a minimum sample and half-weight floor, and partial contradictions drag confidence only insofar as they actually lean against the claim. Hypotheses carry full structure and honest statuses (an invalid comparison basis is REJECTED regardless of evidence). Findings are immutable, evidence-backed query results that never authorize anything. Seven rankings with sample-floor exclusions and contiguous score-sorted ranks; seven informational feedback kinds; three research-recommendation kinds (collect evidence, re-examine comparability, research priority).
- **Replay, Audit, Invariants (`replay.ts`, `audit.ts`, `invariants.ts`)** — byte-identical replay (`compareResearchResults` diffs by key); a hash-chained `oship.historical-research.v1` audit over 14 event types (GENESIS-rooted, `replay-completed` terminator enforced — tampering, reordering, payload substitution, truncation and extension all fail verification); and **46 hard fail-closed invariants** including the forbidden-authority-surface scan, AFIS/ABL semantics, cross-domain comparability enforcement, hypothesis-status ↔ evidence consistency and correction-lineage preservation.

### Demo (`historical-research-demo.ts`)
`demo:historical-research` drives the real plane through 35 assertion-backed sections — AFIS-HISTORY-INGESTION, ABL-HISTORY-INGESTION, HISTORICAL-MEMORY, MEMORY-SCHEMA, NORMALIZATION, UNAVAILABLE-SEMANTICS, MEMORY-INDEX, EVIDENCE-STATES, CORRECTIONS, DEDUPLICATION, REJECTION-FAIL-CLOSED, KNOWLEDGE-ENTITIES, KNOWLEDGE-GRAPH, GRAPH-DETERMINISM, QUERY-ENGINE, QUERY-DETERMINISM, COMPARATIVE-ANALYSIS, NOT-COMPARABLE, CROSS-DOMAIN, PATTERN-PRESERVATION, PATTERN-LEAKAGE, PATTERN-STRATEGY, PATTERN-VENUE, PATTERN-POLICY, PATTERN-FAILURE, HYPOTHESES, HYPOTHESIS-CONTRADICTION, HYPOTHESIS-HONESTY, EVIDENCE-EVALUATION, FINDINGS, RANKINGS, INTELLIGENCE-FEEDBACK, RECOMMENDATIONS, REPLAY, AUDIT-AND-INVARIANTS — ending `SYSTEM STATUS: RECONCILED`.

## Sprint 037 — Unified Intelligence Learning & Feedback Engine (`services/market-engine/src/intelligence/learning/`)

**THE LEARNING PLANE IS NOT AN AUTHORITY. PAPER / SIMULATION ONLY.** The engine turns a validated Sprint 036 research result into persistent, comparable, causal-safe learning: *what the history actually taught — which strategies, venues, classes, policies and leakage components preserve value, which deteriorate, in which regimes, with how much confidence, and what the system should study next.* It never authorizes trades, bets, capital, risk, policy or execution; never mutates Treasury/Portfolio/Risk/AEGIS/Execution, the Strategy Registry or any active policy; never calls live APIs or touches provider credentials. Every learning output carries `informational: true`; ranking is never authorization; a policy candidate never becomes ACTIVE here (promotion is `OUTSIDE_ENGINE` by construction).

### Canonical Loop
`Findings → Learning Signals → Opportunity/Strategy Intelligence → Future Research Priorities → Intelligence Feedback`. One `LearningEngine.analyze()` consumes the read-only Sprint 036 `ResearchResult`, runs the whole pipeline twice internally, and refuses to emit anything unless the two passes are byte-identical (`replay.identical` is part of the result, the audit and the invariants).

### Layers
- **Contracts (`types.ts`)** — re-exports the ACTUAL Sprint 036 contracts (ResearchResult, OpportunityDomain/Class, LeakageComponentName, PreservationGrade…) — never duplicates them. Explicit classifications everywhere: strategy IMPROVING/STABLE/DETERIORATING/CONSISTENT_OUTPERFORMER/CONSISTENT_UNDERPERFORMER/HIGH_THEORETICAL_LOW_REALIZATION/INSUFFICIENT_EVIDENCE/NOT_COMPARABLE; venue CONSISTENTLY_STRONG/CONSISTENTLY_WEAK/DETERIORATING/IMPROVING/INSUFFICIENT_EVIDENCE; policy STABLE_BASELINE/CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END/CANDIDATE_REGRESSION/CANDIDATE_IMPROVES_END_TO_END/INSUFFICIENT_EVIDENCE; drift NO_DRIFT/IMPROVING/DETERIORATING/STRUCTURAL_SHIFT/INSUFFICIENT_EVIDENCE; stability STABLE/FRAGILE/REGIME_DEPENDENT/CONTRADICTORY/INSUFFICIENT_EVIDENCE; 8 learning-signal kinds; 8 research-priority kinds; 3 feedback kinds; 19 canonical audit event types.
- **Configuration (`config.ts`)** — versioned, validated, deep-mergeable; partial priority-weight overrides renormalize to the simplex; canonical key order so the configuration fingerprint never depends on how overrides arrived.
- **Identity (`ids.ts`)** — content-derived prefix-tagged ids (lres/lob/lft/lfv/lch/lbs/lrg/ldr/lst/lcn/lsg/lpr/lrc/lfb/lsd/lop/lvn/lpl/lkg/lev/lcfp/llnk/lfp); canonical JSON makes key order irrelevant.
- **Observations (`sample.ts`)** — ACTIVE-only memory records normalized into immutable, fingerprinted `learning.observation.v1` records preserving source identity, provenance, lineage (research analysis, batch, findings, patterns, hypotheses), config + content fingerprints and evidence state; canonically ordered by observationId so every downstream aggregation is byte-identical under caller input permutations.
- **Features (`feature.ts`, `feature-vector.ts`)** — per-observation feature sets and per-subject feature vectors (strategy, execution, control metrics + per-era breakdowns) with honest provenance and 3-decimal honesty rounding.
- **Cohorts (`cohort.ts`)** — deterministic cohorts across 9 dimensions (domain, class, strategy, venue, policy, execution mode, time period, evidence quality, regime); invalid mixtures are NOT_COMPARABLE with explicit reasons; raw cross-domain economics are never comparable (the canonical `raw-mixed` cohort proves it); empty cohorts fail closed.
- **Baselines (`baseline.ts`)** — HISTORICAL/STRATEGY/VENUE/POLICY/CLASS/DOMAIN_NORMALIZED baselines, versioned and fingerprinted; a baseline below the sample floor is INSUFFICIENT and unusable — nothing is ever measured against an undefined baseline; the DOMAIN_NORMALIZED path is the only legal cross-domain average.
- **Learning (`strategy-learning.ts`, `opportunity-learning.ts`, `venue-learning.ts`, `policy-learning.ts`, `leakage-learning.ts`)** — strategy classification with honest precedence (high-theoretical/low-realization first; consistent outperformance requires beating the domain baseline in EVERY era with a half-rounding-unit epsilon so rounded-equal values never claim outperformance; completion is NEVER preservation); opportunity-class learning with recurring leakage/failure facts and historically-stated high-quality conditions; venue learning from leg-level fill/leakage semantics with BUY/SELL (AFIS) and BACK/LAY (ABL) kept distinct; policy learning on comparable same-strategy/same-class peer cohorts under a different version, detecting the Sprint 034 class (execution-quality improvement ≠ end-to-end preservation) — candidates are flagged, never promoted; per-component leakage recurrence (occurrences, total value, recurrence rate, trend, dominant subjects — zero-occurrence components stay explicit and INSUFFICIENT).
- **Regimes, Drift, Stability (`regime.ts`, `drift.ts`, `stability.ts`)** — explainable 6-dimension regimes (volatility, liquidity, opportunity density, execution quality, venue conditions, preservation trend) with metric, value and deterministic rule — no ML, no hidden labels; drift against an explicit baseline window and comparison window with sample sizes and observed delta (INSUFFICIENT drifts carry null deltas, never numbers); stability from era consistency and dispersion — never stable from one observation; contradicted research surfaces as CONTRADICTORY.
- **Confidence & Causal Safety (`confidence.ts`, `causal-safety.ts`)** — confidence only from actual evidence factors (sample, provenance, consistency, comparability, contradiction, stability, freshness), at most 3 decimals, null when not honestly computable; the default causal status is ASSOCIATIONAL_ONLY and a pattern list forbids caused/guarantees/will produce/proves/ensures at build time — statements may say correlated/associated/historically higher/observed alongside, never causation.
- **Signals, Priorities, Recommendations, Feedback (`learning-signal.ts`, `priority.ts`, `recommendation.ts`, `feedback.ts`)** — immutable signals (8 kinds) with full lineage, evidence references and causal-safety enforcement (no supporting evidence → fail closed); research priorities ranked by expected information value (impact magnitude, recurrence, uncertainty, evidence gap, instability, sample insufficiency) with contiguous deterministic ranks — informational only; informational recommendations (monitor, collect evidence, research investigation, re-examine comparability) deduplicated by identity; feedback closes the loop finding → signal → priority → proposed future research query with explicit lineage — Sprint 036 findings are never overwritten, feedback items are brand-new immutable records.
- **Replay, Audit, Invariants (`replay.ts`, `audit.ts`, `invariants.ts`)** — byte-identical replay (`compareLearningResults` diffs by key) including input-order permutations; a hash-chained `oship.intelligence-learning.v1` audit over 19 event types (GENESIS-rooted; tampering, reordering, payload substitution, truncation and extension all fail verification); **47 hard fail-closed invariants** including per-stage determinism, no-fabrication scans, AFIS/ABL semantics, cross-domain comparability, the seven no-authority-mutation checks and POLICY_CANDIDATE_NEVER_ACTIVE.

### Demo (`intelligence-learning-demo.ts`)
`demo:intelligence-learning` drives the real engine through 44 assertion-backed sections — historical input, observations, features, feature vectors, cohorts, baselines, all five learnings (guardian CONSISTENT_OUTPERFORMER, aggressive HIGH_THEORETICAL_LOW_REALIZATION, sports-arb honest STABLE, cross-venue-arbitrage DETERIORATING, liquidity-imbalance IMPROVING, venue-a weak/venue-b strong, policy v1.1 divergence), regimes, drift, stability, confidence, causal safety, signals, lineage, priorities, recommendations, feedback, AFIS, ABL, BACK/LAY, normalized cross-domain, NOT_COMPARABLE raw, insufficient, contradictory, fragile, regime-dependent, deterioration, policy divergence, replay, order determinism, audit, tamper/reorder/truncation, invariants, authority boundary — ending `SYSTEM STATUS: RECONCILED`.
