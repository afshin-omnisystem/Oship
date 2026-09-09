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
