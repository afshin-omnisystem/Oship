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

## Sprint 023 — State Plane Glossary

- **Unified Treasury** — the single stateful internal authority over capital reservation, consumption, and settlement; integer minor-unit, domain-neutral (AFIS + ABL).
- **Treasury Authorization** — the binding that joins opportunity, intelligence, strategy, portfolio, risk, allocation, AEGIS, correlation, trace, requested capital, and policy version; no reservation without a valid approved authorization.
- **Treasury Reservation** — holds capital in the reserved bucket until consumed/released/expired.
- **Treasury Consumption** — converts reserved capital into allocated (in-flight) capital bound to an execution/plan.
- **Treasury Settlement** — returns net capital (AFIS: capital + PnL − fees; ABL: stake settlement for WIN/LOSS/VOID/HALF_WIN/HALF_LOSS).
- **Capital Invariant** — `availableCapital + reservedCapital + allocatedCapital == totalCapital`, with every bucket non-negative, checked before every commit.
- **Treasury Ledger** — append-only immutable SHA-256 hash-chained record of every treasury operation.
- **Position Engine** — stateful event-driven holder of open/increased/partially-reduced/closed/settled/cancelled positions; emits portfolio mutation events.
- **Position Ledger** — append-only hash-chained record of position state transitions.
- **Portfolio Engine** — stateful consumer of position mutation events; tracks positions, allocated capital, realized/unrealized PnL, fees, exposure, drawdown, and daily loss with immutable snapshots.
- **Portfolio Ledger** — append-only hash-chained record of portfolio mutations.
- **Exactly-Once / Idempotency** — deterministic keys (`treasury:{authorizationId}:{operation}`, `position:{positionId}:{eventId}`, `portfolio:{portfolioId}:{eventId}`, `execution:{executionId}:{eventType}`) ensure a duplicate command/event neither mutates state again nor breaks ledger sequence.
- **State-Plane Reconciliation** — cross-subsystem validation returning `FULLY_RECONCILED`, `RECONCILED_WITH_WARNINGS`, or `FAILED`.
- **Isolated Replay** — reconstructs Treasury/Positions/Portfolio from a canonical event log into fresh clones and compares final states without mutating live state.
- **AEGIS** — the authorization boundary before Treasury reservation; it cannot be bypassed.

## Sprint 024 — Reliability & Recovery Glossary

- **Failure Record** — immutable canonical description of a detected failure with a deterministic `failureId`, type, severity, component, operation, correlation/trace, and retryability/recoverability.
- **Failure Type** — one of 23 canonical classes (TIMEOUT, NETWORK, VENUE_UNAVAILABLE, PARTIAL_FILL, STALE_EDGE, HASH_MISMATCH, DATA_CORRUPTION, AEGIS_REJECTION, TREASURY_EXPIRED, ...).
- **Severity** — `FATAL`/`CRITICAL`/`ERROR`/`WARNING`, driving degradation.
- **Circuit Breaker** — `CLOSED`/`OPEN`/`HALF_OPEN` guard scoped by venue or globally; trips on a failure threshold and half-opens after cooldown.
- **Health Monitor** — rolling-window component health summary and unhealthy-ratio computations.
- **Timeout Manager** — injected-clock deadline tracking with relative and absolute expiry.
- **Retry Policy / Retry Engine** — jitter-free backoff, `isRetryable`, max attempts, and an authorization gate that fails closed on missing treasury/AEGIS/circuit approval.
- **Degradation Mode** — `NORMAL`/`DEGRADED`/`RECOVERY_ONLY`/`READ_ONLY`/`HALTED`; fail-closed on illegal transitions and blocks new execution / treasury reservation / automatic retry / automatic reroute / inspection as appropriate.
- **Reliability Event** — append-only hash-chained `oship.reliability.event.v1` log entries (FAILURE_DETECTED, DEGRADATION_ENTERED, etc.).
- **Recovery Decision** — deterministic selected action (RETRY/REVALIDATE/REROUTE/HEDGE/CANCEL/ABORT/HALT) plus reasons, rejected actions, route, hedge plan, and hash.
- **Recovery Orchestrator** — 14-state subordinate state machine and exactly-once attempt store; journals and emits recovery events; never mutates Treasury/Position/Portfolio.
- **Recovery Journal** — append-only hash-chained `oship.recovery.event.v1` trail of every recovery transition and completion.
- **Recovery Reconciler** — validates journal/event chains, retry count, route/hedge history, circuit state, and degradation state.
- **Partial Fill Action / Stale Edge Action** — policy-determined behavior (`REROUTE_REMAINDER`, `HEDGE`, `CANCEL_REMAINDER`, `REEVALUATE`, `ABORT`).
- **Hedge Plan** — infeasible/feasible hedge with required and authorized notional, computed deterministically; infeasible when availability, quantity, policy limit, or risk is missing.
- **Fault Injector** — deterministic scenario-driven fault injection with `injectionId` and `faultToFailureType` mapping.
- **Recovery Replay** — reconstructs fresh Reliability/Recovery/State-Plane clones from a canonical command log and compares failure IDs, recovery IDs, retry counts, circuit/degradation state, journal chains, and treasury/position/portfolio state without mutating live state.

## Sprint 025 — Adaptive Control Plane Glossary

- **Control Context** — deterministic, serializable snapshot of the whole pipeline (market, intelligence freshness, edge, confidence, risk, allocation, AEGIS, treasury, execution quality, fill state, venue health, reliability, recovery) that the control engine decides over. It never holds live engines.
- **Control Action** — `CONTINUE`/`REVALIDATE`/`REPRICE`/`RESIZE`/`REROUTE`/`RETRY`/`HEDGE`/`PAUSE`/`ABORT`/`HALT`.
- **Control State (Kill-Switch)** — `ACTIVE`/`DEGRADED`/`PAUSED`/`HALTED`/`EMERGENCY_STOP`. `EMERGENCY_STOP` blocks new opportunities, allocations, execution and Treasury reservations but keeps reconciliation, audit, replay and settlement recovery available.
- **Control Idempotency Key** — `control:{correlationId}:{decisionId}:{action}`; same input + same state + same decision => same output, no duplicate Treasury/execution/hedge/position mutation.
- **Control Event Chain** — append-only hash-chained `oship.control.event.v1` (CONTROL_STARTED/REVALIDATED/CONTINUED/REPRICED/RESIZED/REROUTED/RETRIED/HEDGED/PAUSED/ABORTED/HALTED/RESUMED/COMPLETED).
- **Revalidation Record** — immutable re-check at a sensitive boundary with deterministic ID, previous/current intelligence references, edge/confidence deltas, and a control decision.
- **Execution Feedback Loop** — folds execution metrics into the next control context, bounded by `maxReevaluationDepth`/`maxRecoveryAttempts`/`maxReroutes`/`maxHedges`.
- **Recovery-to-Control Integration** — maps Sprint 024 failures to control decisions (STALE_EDGE -> REVALIDATE/ABORT, PARTIAL_FILL -> REROUTE/HEDGE, VENUE_FAILURE -> REROUTE, TIMEOUT -> RETRY/REROUTE, DATA_CORRUPTION -> PAUSE/ABORT, TREASURY_MISMATCH -> ABORT, POSITION_MISMATCH -> PAUSE, RECONCILIATION_FAILURE -> HALT, CRITICAL_ANOMALY -> HALT, PROVIDER_DEGRADATION -> PAUSE/REROUTE); always through AEGIS -> Treasury -> Execution.
- **Adaptive Strategy Selection** — deterministic score over expected edge, confidence, risk, liquidity, execution cost, latency, venue reliability, historical execution quality and regime; no non-reproducible ML.
- **Capital Reallocation** — bounded, deterministic, risk-aware, AEGIS-gated and Treasury-authorized revised allocation after partial execution; never mutates Treasury/Position/Portfolio directly.
- **Global Vertical-Slice Replay** — reconstructs the full pipeline (OIIN -> ... -> Reconciliation) on an isolated clone; `LIVE STATE != REPLAY STATE` and replay never mutates live state.

## Sprint 027 — Unified Strategy Intelligence & Autonomous Strategy Selection

- **Strategy Candidate** — deterministic proposal for exploiting an opportunity, generated only for compatible templates.
- **Strategy Template** — versioned, immutable definition with explicit limits, capabilities, correlation group/factor and modifiers.
- **Strategy Economics** — reusable model: expected return − fees − slippage − latency − execution failure − liquidity − capital − risk = risk-adjusted expected return.
- **Strategy Limits** — explicit per-strategy bounds: max capital/position/exposure/legs/latency, min edge/confidence/liquidity, max slippage.
- **Strategy Ranking** — configurable composite score (never raw return) over risk-adjusted return, capital efficiency, confidence, execution probability, liquidity, latency, risk, correlation, freshness and time horizon.
- **Strategy Selection** — deterministic pick of the best admissible strategy, or `NO_ADMISSIBLE_STRATEGY`.
- **Strategy Lifecycle** — PROPOSED→EVALUATED→RANKED→SELECTED→ALLOCATED→AUTHORIZED→EXECUTING→COMPLETED, plus REJECTED/EXPIRED/STALE/RISK_BLOCKED/AEGIS_BLOCKED/TREASURY_BLOCKED/EXECUTION_FAILED/CANCELLED.
- **Strategy Registry** — canonical register/unregister/enable/disable/lookup/compatibility/versioning/health for strategy templates.
- **Strategy Fingerprint** — canonical SHA-256 over opportunity + strategy + configuration + portfolio/risk context; drives deterministic replay.
- **Adaptive Strategy Advisory** — suggests an action (CONTINUE/REVALIDATE/RESIZE/REROUTE/ABORT/HEDGE/PAUSE/HALT) to the existing Control Engine; it never decides.

## Sprint 028 — Unified Capital Allocation & Portfolio Optimization Engine

- **Allocation Candidate** — proposal for how much capital to commit to an (Opportunity + selected Strategy), exposing required/max/min capital, gross/net/risk-adjusted return, edge, capital efficiency, confidence, liquidity, execution probability, risk, correlation group/factor, time horizon, duration and turnover, and allocation mode.
- **Allocation Mode** — PARTIAL_ALLOWED (clamp to the binding constraint; market-making / sports +EV / surebet) vs ALL_OR_NOTHING (full required capital or reject; triangular / funding / basis), derived from the strategy type.
- **Allocation Policy** — deterministic scoring recipe: Fixed, Confidence Weighted, Edge Weighted, Capital Efficiency Weighted, Risk Adjusted, Liquidity Constrained, Correlation Adjusted, Hybrid; every factor observable.
- **Allocation Score** — transparent configurable composite over edge, confidence, execution, liquidity, capital efficiency, duration, risk penalty and correlation penalty; never raw return.
- **Capital Constraints** — total/domain/strategy/position/event/correlation exposure, per-candidate cap, minimum viable allocation, liquidity reserve; never over-allocate.
- **Allocation Invariants** — sum(allocations) ≤ allocatable; available+reserved+allocated = total; exposure ≤ limits; allocation ≤ executable liquidity; fail closed → ALLOCATION_BLOCKED.
- **Allocation Lifecycle** — PROPOSED→EVALUATED→OPTIMIZED→RISK_APPROVED→AEGIS_APPROVED→TREASURY_AUTHORIZED→ALLOCATED, plus REJECTED/RISK_BLOCKED/CAPITAL_BLOCKED/AEGIS_BLOCKED/TREASURY_BLOCKED/EXPIRED/STALE/CANCELLED.
- **Unified Capital Optimization** — one cross-domain optimizer over ONE Treasury; AFIS and ABL compete, never separate pools.
- **Capital Efficiency** — risk-adjusted expected return / allocated capital; deterministic, guarded against zero/negative/invalid.
- **Capital Turnover** — deterministic metric from the horizon (short arb recycles capital faster than long value), exposed with time_horizon and capital_duration.
- **Dynamic Reallocation** — controlled REALLOCATE that computes previous/new/delta per candidate and re-verifies constraints; never mutates Treasury.
- **Allocation Revalidation** — deterministic re-check of Opportunity/Strategy/Portfolio/Risk/Liquidity/Correlation/Capital using the Control vocabulary (CONTINUE/REVALIDATE/REJECT/EXPIRED/STALE).
- **Allocation→AEGIS→Treasury** — Allocation proposes; AEGIS authorizes (unoverrideable); Treasury decides availability/reservation; Allocation never mutates Treasury.
- **Portfolio Risk Authority** — the single Risk Decision layer (`risk/decision/`) that decides whether a proposed Allocation is safe against the Portfolio, Risk Budget, Exposure, Correlation and AFIS/ABL limits, before AEGIS/Treasury. One authority total; no department-specific Risk Authority.
- **Risk Decision** — the deterministic outcome for a candidate: a scale (FULL_APPROVAL/PARTIAL_APPROVAL/REDUCED/BLOCKED), approved/blocked capital, risk state, risk-safe capital, priority-sorted violations, risk score, reason and fingerprint.
- **Risk-Safe Capital** — the largest amount satisfying all exposure/concentration/liquidity/drawdown/budget limits; drives PARTIAL/REDUCED scaling.
- **Risk Budget** — a versioned, unified budget (total → domain → strategy → candidate) shared by AFIS and ABL with no preferential treatment.
- **Risk Scaling** — the non-binary decision: expose violations scale the approved capital to risk-safe (PARTIAL_APPROVAL/REDUCED), while fatal violations (emergency-stop/stale/expired/all-or-nothing-block) block outright.
- **Stress Scenario** — NORMAL/ADVERSE/SEVERE/EXTREME; deterministic portfolio/candidate/domain loss, budget utilization and remaining budget.
- **Projected Portfolio** — existing portfolio + existing allocations + the new allocation; risk is always computed on this projected basis.
- **Risk Invariant** — fail-closed checks: allocated ≥ 0, approved ≤ requested, approved ≤ risk-safe, exposure ≤ limits, stress loss ≤ limit, budget utilization ≤ 100%, blocked not approved, emergency stop not bypassed, all-or-nothing no sub-minimum.
- **Risk Revalidation** — deterministic re-check (CONTINUE/REVALIDATE/REJECT/EXPIRED/STALE) after allocation/opportunity staleness or risk-config change, before approval.
- **Risk→AEGIS→Treasury** — Risk Decision proposes a scale; AEGIS authorizes (unoverrideable); Treasury decides availability/reservation. Risk never bypasses AEGIS and never mutates Treasury.
- **Risk Budget Utilization** — the share of the unified risk budget consumed (used/total), constrained to ≤ 100%.
- **Capital at Risk (CaR)** — project deterministic capital-at-risk for a candidate under the configured risk model.

## Sprint 030 — Unified Execution Planning & Smart Routing Engine

- **Execution Plan** — the deterministic answer to WHAT / WHERE / WHEN / HOW for a Risk-approved Allocation: execution_plan_id, allocation_id, opportunity_id, strategy_id, domain, status, requested/approved/planned/unplanned capital, venue/route/order/leg counts, execution_mode, routing_policy, slicing_policy, estimated slippage/fees/latency, expected_fill_ratio, liquidity_utilization, time_horizon, deadline, freshness, risk/allocation/aegis/treasury reference, config/policy version, timestamp and fingerprint. **Planning ≠ Execution.**
- **Execution Lifecycle** — PROPOSED→VALIDATED→ROUTED→SLICED→READY→AEGIS_APPROVED→TREASURY_AUTHORIZED→PAPER_EXECUTED→RECONCILED, plus terminal BLOCKED/STALE/EXPIRED/CANCELLED/FAILED/PARTIALLY_EXECUTED; explicit deterministic transitions.
- **Execution Mode** — SINGLE_VENUE, MULTI_VENUE, SEQUENTIAL, PARALLEL, HEDGE_FIRST, LEG_FIRST; legality is decided by strategy semantics (cross-venue BUY A + SELL B, triangular A→B→C→A, market-making, ABL BACK/LAY/HEDGE/MIDDLE/SUREBET).
- **Smart Router** — deterministic routing over VenueState/Liquidity/Fees/Slippage/Latency/Freshness; route score = net economics → fill probability → liquidity → slippage → fees → latency → venue ID; stable tie-breaking; no ML/randomness.
- **Route** — a deterministic ExecutionRoute: venue/provider/instrument/event/side/quantity/price/fee/slippage/latency/liquidity/score/priority.
- **Multi-Venue Allocation** — sum(route capital) ≤ approved capital; route capital ≤ executable liquidity; no route exceeds venue limits; remainder is unplanned.
- **Order Slice** — FIXED_SIZE, PERCENTAGE, LIQUIDITY_PROPORTIONAL, VWAP_STYLE, TWAP_STYLE; each slice has slice_id, sequence, venue, quantity, notional, estimated price/fee/slippage, deadline.
- **Partial Fill** — FULL / PARTIAL / UNFILLED; strategy action REMAIN_ON_VENUE / REROUTE / RESIZE / CANCEL / REPLAN. Atomic groups never partial-execute.
- **Coordinated / Atomic Leg** — leg_id, sequence, dependency_ids, atomic_group_id, side, venue, quantity, planned_price. Triangular/funding/basis/hedge/surebet are atomic; never silently split; unavailable mandatory leg → BLOCKED.
- **Slippage / Fee Model** — deterministic: slippage from spread/depth/order_notional/liquidity/volatility → bps/price/cost; fees maker/taker/fixed/provider/routing; net = gross − fees − slippage.
- **Freshness / Expiry** — opportunity/strategy/allocation/risk/venue snapshot staleness; STALE/EXPIRED; a stale or expired plan never reaches AEGIS. Venue failure → deterministic reroute if legal, BLOCKED otherwise; atomic mandatory leg unavailable ⇒ BLOCKED.
- **AEGIS Boundary** — `evaluateExecutionAegis` decides APPROVED/BLOCKED; the planner never self-authorizes. **AEGIS is unoverrideable.**
- **Treasury Boundary** — `buildExecutionTreasuryProposal` produces a **recommendation-only** Treasury Authorization Proposal; Treasury remains authoritative and is never mutated by the planner.
- **Emergency Stop** — EMERGENCY_STOP/HALTED ⇒ BLOCKED; no override; no other risk reduction may precede it.
- **All-or-Nothing** — triangular/funding/basis/atomic strategies: if required legs cannot be planned consistently → BLOCKED; never partial-execute an atomic group.
- **Replan** — deterministic trigger (venue unavailable, liquidity reduced, price moved, stale opportunity, risk changed, allocation changed, partial fill, deadline approaching) → REPLAN_REQUIRED or a new version with execution_plan_version, parent_plan_id, replan_reason; history preserved.
- **Execution Replay** — same input → identical plan ID, routes, slices, ordering, costs, decision and fingerprint.
- **oship.execution-plan.v1** — audit record with execution_plan_id, allocation_id, risk_decision_id, strategy_id, route_ids, slice_ids, status, planned_capital, estimated cost/slippage, routing/slicing_policy, replan_reference, aegis/treasury_reference, timestamp, fingerprint.
- **Execution Planning ≠ Execution Authority** — the planner is proposal-only: it never calls a live exchange/bookmaker, never mutates Treasury / Portfolio / Risk, never touches credentials, and never bypasses AEGIS. It introduces no second Portfolio / Risk / Execution authority.
