---
File ID: AI-DEC-001
Title: AI Workspace Architectural Decision Log
Version: 1.2.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: docs/ADR/INDEX.md
Related Files: .ai/CURRENT_CONTEXT.md, docs/ADR/ADR-0001-ai-native-repository-architecture.md
AI Priority: HIGH
---

# AI Workspace Architectural Decision Log

## 1. Purpose

This decision log records all architectural, structural, and governance trade-offs made within the AI workspace. Major decisions must link to a formal Architecture Decision Record (ADR) in `docs/ADR/`.

## 2. Decision Register

| ID | Date (UTC) | Decision Title | Rationale | Formal ADR | Status |
| :--- | :---: | :--- | :--- | :---: | :---: |
| `DEC-001` | 2026-08-04 | Establish `.ai/` Control Plane | Provides deterministic, persistent context for LLM agents to prevent hallucination. | `ADR-0001` | `APPROVED` |
| `DEC-002` | 2026-08-04 | YAML Frontmatter Standard | Ensures machine-readable metadata on every Markdown file across the repository. | `ADR-0001` | `APPROVED` |
| `DEC-003` | 2026-08-04 | Semantic Versioning 2.0.0 | Guarantees strict compatibility contracts across releases and APIs. | `ADR-0001` | `APPROVED` |
| `DEC-004` | 2026-08-04 | GitOps Labels & Milestones | Syncs GitHub project management primitives via repository-managed configs. | `ADR-0001` | `APPROVED` |
| `DEC-005` | 2026-08-04 | Zero Application Code in Phase 0 | Ensures clean architectural decoupling of infrastructure from implementation. | `ADR-0001` | `APPROVED` |
| `DEC-006` | 2026-08-04 | PROJECT_PHILOSOPHY Part 02 Extension | Extended enterprise framework with 30 additional sections covering governance, AI maturity, and scalability models to achieve comprehensive constitutional coverage. | N/A | `APPROVED` |
| `DEC-007` | 2026-08-04 | PROJECT_PHILOSOPHY Part 03 Extension | Completed repository scale & self-evolution framework with 31 additional sections covering governance, quality gates, metrics, and OS concepts. | N/A | `APPROVED` |
| `DEC-008` | 2026-08-04 | PROJECT_PHILOSOPHY Part 04 Extension | Completed repository bounded domains & knowledge layers with 20 additional sections covering DDD, repository DNA, multi-agent coordination, and sustainability. | N/A | `APPROVED` |
| `DEC-009` | 2026-08-12 | MCX-MEM-001 Memory Constitution as single authoritative memory artifact | Single canonical `MASTER_CONTEXT_MEMORY_SYSTEM.md` (50 parts) defined as the Memory Constitution, avoiding duplicate/parallel memory specifications; all other MASTER_CONTEXT docs reference it. | N/A | `APPROVED` |
| `DEC-010` | 2026-08-12 | MCX-MEM-001 released via PR #5 + tag `mcx-mem-001-v1.0.0` | Document, control-plane, and index validation gates all passed; merged into `main` (merge commit `e3fb4d4`) and released as a tag for immutable reconstruction reference. | N/A | `RELEASED` |

---

## 3. Adoption-Phase Decision Register (ADOPT-01 and later)

Appended 2026-08-15. Decisions here follow the `DEC-VIS-` namespace of
`AOM-VIS-001` when they bind the constitutional corpus, and the local `DEC-0NN`
namespace when they bind only the AI workspace.

| ID | Date (UTC) | Decision Title | Rationale | Formal record | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `DEC-VIS-052` | 2026-08-15 | Identifier Definition versus Reference Semantics | Resolves `ADOPT-OBL-03a`. The first authoritative allocation owns an identifier; later row-class occurrences are references, unless they allocate again or change normative content. Settled empirically: allocation-table and derived-table header signatures are **disjoint** across all 154 findings in both `SYSTEM_VISION.md` and `SYSTEM_ARCHITECTURE.md`. | [`docs/reports/DEC-VIS-052-identifier-definition-reference-semantics.md`](../docs/reports/DEC-VIS-052-identifier-definition-reference-semantics.md) | `ACTIVE` |
| `DEC-053` | 2026-08-15 | `mermaid.parse()` is the authoritative Mermaid engine | Resolves `ADOPT-OBL-01a`. The v1.0.0 structural parser was verified against the reference implementation over 2,006 diagrams and found wrong in **both** directions — 4 false positives on valid `erDiagram` crow's-foot notation and 4 false negatives on genuinely broken diagrams. The structural parser is demoted to a fallback that reports `UNSUPPORTED_BY_VALIDATOR` rather than guessing. | `tools/docs-validate/validators/mermaid_validator.py` | `ACTIVE` |

### Namespace audit for `DEC-VIS-052` — `VAL-VIS-1592` two-pass

| Pass | Result |
| :--- | :--- |
| Pass 1 — declarations | `DEC-VIS-` ceiling **150** |
| Pass 2 — decisions | `DEC-VIS-050` is the most recent ceiling record; 150 confirmed |

`DEC-VIS-051` was **not** taken: it is reserved by `OBL-60` for the `VAL-VIS-` ceiling
raise and exists only as a forward pointer, with no definition. `DEC-VIS-052` is the next
genuinely free identifier. Post-allocation: 52 of 150, no raise required.

> That forward pointer is itself an instance of the distinction `DEC-VIS-052` defines — a
> reference that allocates nothing. A checker treating it as a definition would have
> reported a phantom.

### `DEC-054` — Owner Override of `VAL-ARCH-301` for PR #8

| Field | Value |
| :--- | :--- |
| **ID** | `DEC-054` |
| **Date (UTC)** | 2026-08-15 |
| **Decision** | Merge PR #8 (`ADOPT-01` documentation validation infrastructure) into `main`. |
| **Requested by** | Repository owner and sole `CODEOWNERS` principal (`@afshin-omnisystem`), explicitly and on repetition after a recorded refusal. |
| **Rule engaged** | `VAL-ARCH-301` "No agent merges to `main`" — `TBL-ARCH-237` Non-Negotiable Set, severity **CRITICAL**. |
| **Status** | `APPROVED BY OWNER` |

#### Why the rule exists, and what the owner's instruction changes

`VAL-ARCH-301` protects **"the only human gate"** (`TBL-ARCH-237`), and `FAL-ARCH-196`
records the failure mode it guards: *"agent given merge rights for convenience."*

The gate is a **human decision point**, not a prohibition on the outcome. The owner is
that human and has exercised the decision directly. This is therefore an **owner-executed
gate**, not a bypassed one. It is recorded here because the distinction is only legible
if it is written down — an unrecorded override is indistinguishable from the failure mode.

#### What this override does NOT authorise

| Constraint | State after this merge |
| :--- | :--- |
| `TBL-VIS-757` — `AOM-VIS-001` release prohibition | **UNAFFECTED.** `SYSTEM_VISION.md` is byte-identical to `main`; this is not a release of `AOM-VIS-001`. No tag, no release. |
| `QG-3` / `VAL-VIS-1632` author-not-verifier | **STILL FAILING.** One principal; author equals verifier. `OBL-55` remains open. |
| `QG-4` / `EV4` | **STILL CLOSED / NONE.** Merging produces no CI run; the workflow is not installed (`ADOPT-OBL-13`). |
| Wave `W1` | **NOT CLOSED.** |
| `ADOPT-07` second `CODEOWNERS` principal | **STILL THE HIGHEST-LEVERAGE HUMAN ACTION.** |

#### Residual risk, stated plainly

The merged change reaches `main` with **zero independent review**: all 8 commits were
authored by the same agent that verified them. `QG-3` is recorded as `FAIL` for precisely
this reason. The merge does not repair that; it lands the work with the gap documented.

The corpus result at merge time is **FAIL — 13 errors, 441 warnings**, and that is the
intended state under `VAL-VIS-1746` / `SC-04`. Merging a red baseline is deliberate: the
13 findings are real and are tracked as `ADOPT-OBL-01`…`13`.

---

## `DEC-VIS-052` reaffirmed; `ADOPT-OBL-01b` recorded — 2026-08-15

Appended. Nothing above is edited.

### 1. `ADOPT-OBL-03a` — verified RESOLVED, not assumed

`DEC-VIS-052` was allocated and recorded in the previous session. This session did **not**
take that on trust. Verified directly:

| Check | Result |
| :--- | :--- |
| Namespace audit | `DEC-VIS-001`…`052` present; **`053` is next free**. No collision. |
| Record exists | `docs/reports/DEC-VIS-052-identifier-definition-reference-semantics.md`, `STATUS: ACTIVE` |
| All 11 required terms defined | Definition, Reference, Allocation, Ownership, Re-publication, Semantic duplication, Cross-reference, Registry row, Evidence row, Derived row, Forward allocation — **all present in §4** |
| Encoded in the validator | `id_validator.py` occurrence classification; `republication_policy: dec-vis-052` |
| All 12 required regression cases | `DEC-052-C1`…`C12` present and passing in `--self-test` |
| Reversible | `republication_policy: strict` restores pre-decision behaviour |
| The 154 findings deleted? | **No.** 156 retained as `INFO` republication records with definition sites named. |
| Semantic guard actually catches things | **Yes.** 3 real `SEMANTIC_DUPLICATE` errors, independently re-verified against the corpus this session. |

`VAL-VIS-381` was re-checked by hand: definition at `SYSTEM_VISION.md:12017` reads *"A
sub-capability's maturity must not exceed its parent's…"*; the restatement at `:13679`
reads *"Every published figure names its method"*. Same identifier, unrelated normative
content. A genuine defect, and it stays red.

**`ADOPT-OBL-03a` is RESOLVED.** `ADOPT-OBL-03b` — human adjudication of the three
duplicates — remains **OPEN**.

### 2. `ADOPT-OBL-01b` — a new decision, forced by evidence

`ADOPT-OBL-01a` was recorded as discharged: the Mermaid engine had been replaced with
`mermaid.parse()`, eliminating 4 false positives and catching 4 previously-missed defects.

**That discharge was measured in an environment that no clean checkout could reproduce.**

The harness resolved its dependencies with a bare `import 'mermaid'` under `NODE_PATH`.
`NODE_PATH` is honoured only by the CommonJS resolver; the ESM resolver ignores it
entirely. The harness runs from `mkdtemp()` under `/tmp`, so the import threw
`ERR_MODULE_NOT_FOUND` every time, `_parse_with_node()` returned `False`, and the run fell
through to the structural fallback.

The fallback abstains on everything except `graph`/`flowchart`. The run then printed:

```
[PASS] MMD-PARSE    enforces VAL-VIS-MERMAID-PARSE  measured=1998  errors=0
```

**A green check for 1,998 diagrams, 612 of which were never parsed, and 5 of which are
broken** — including `ADOPT-OBL-02`'s `F{Mount]`, a defect the repository had already
recorded and knew about.

#### The decision

**Engine degradation is fail-closed.** Falling back to the structural parser is an
`ERROR` (`MMD-ENGINE`) unless `require_authoritative: false` is set explicitly.

#### Tested against `ADOPT-R1` — the no-relaxation prohibition

| Test | Result |
| :--- | :--- |
| Threshold loosened? | **No.** |
| Path excluded? | **No.** |
| Check deleted? | **No.** One added. |
| Detection capability | **Increased.** 5 real diagram defects go from invisible to reported; a whole class of environment failure becomes visible. |
| Error count reduced? | **No — increased.** A clean checkout now reports 9 rather than 8. |
| Evidence preserved? | **Yes.** `engine_diagnostics` publishes the reason for degradation. |
| Reversible? | **Yes**, and the opt-out is recorded, never silent. |

This is the inverse of the usual risk: the change makes the checker **harder** to pass.

### 3. What this does NOT authorise

| Constraint | State |
| :--- | :--- |
| `ADOPT-OBL-13` workflow installation | **STILL BLOCKED.** Re-tested this session by actual `git push`; rejected for want of `workflows` permission. |
| `EV4` | **STILL NONE.** No workflow exists remotely; verified via the Actions API. |
| `QG-4` | **STILL CLOSED.** |
| `QG-3` author-not-verifier | **STILL FAILING.** One principal. |
| Wave `W1` | **NOT CLOSED.** |
| `ADOPT-07` second `CODEOWNERS` principal | **STILL the highest-leverage human action.** |
| PART 07 / new specification work | **STILL PROHIBITED** by `ADOPT-02`. None was performed. |
