---
Document ID: AOM-VIS-001
Title: Oship System Vision — The Strategic and Conceptual Constitution
Version: 1.0.0
Status: IN_PROGRESS
Knowledge Layer: L1 Constitutional
Knowledge Domain: 01_PRODUCT
AI Importance: CRITICAL
Human Importance: CRITICAL
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md, docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md, PROJECT_PHILOSOPHY.md, README.md, docs/ADR/ADR-0001-ai-native-repository-architecture.md
Required By: docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md, docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md, docs/MASTER_CONTEXT/03_USERS/INDEX.md, docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md
Estimated AI Read Time: 22 min
Estimated Human Read Time: 95 min
Repository Version: v0.1.0-alpha.0
Owner: Product Management / Chief Product Officer
Last Updated: 2026-08-14
---

# Oship System Vision — The Strategic and Conceptual Constitution

> **Document ID:** `AOM-VIS-001` · **Version:** `1.0.0` · **Authority Level:** **L1 — Strategic / Constitutional**
> **Status:** `IN_PROGRESS` — PART 01 and PART 02 of N complete · **Phase:** Phase A — Bounded-Domain Content
> **Part model:** APPEND-ONLY. Once a part is committed it is never rewritten, reordered, or squashed.

---

## READ THIS FIRST — What This Document Is

This is **not** a marketing document, a pitch deck, or product prose. It is an **AI-executable
strategic specification**. Every statement in it is written so that it can eventually be
transformed into an architectural or implementation requirement, and so that an autonomous coding
agent can trace any line of code back to the strategic reason it exists.

The document obeys a five-stage discipline. Nothing enters it that cannot pass all five:

```mermaid
flowchart LR
    D["DEFINED - the statement has one unambiguous meaning"] --> V["VISUALIZED - the statement has a diagram, table or matrix"]
    V --> C["CONNECTED - the statement links to other identified objects"]
    C --> K["CONSTRAINED - the statement has boundaries and non-goals"]
    K --> T["TRACEABLE - the statement carries a stable ID and a downstream path"]
```

> **Diagram ID:** `DGM-VIS-001`
> **Explanation:** The admission test for content in this document. A vision statement that is
> merely inspiring fails at **DEFINED**. A statement that is defined but has no downstream path
> fails at **TRACEABLE** and is a slogan, not a specification. Content that fails any stage is
> either rewritten until it passes or removed.

---

## AUTHORITY AND PLACEMENT NOTE — Read Before Citing This Document

This document was commissioned for the path `docs/MASTER_CONTEXT/01_VISION/SYSTEM_VISION.md`.
**That path was not created, and the reason is recorded here rather than hidden.**

### TBL-VIS-001: Placement Decision Record

| Field | Value |
| :--- | :--- |
| **Requested path** | `docs/MASTER_CONTEXT/01_VISION/SYSTEM_VISION.md` |
| **Actual path** | `docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md` |
| **Blocking evidence** | `docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md` PART 04, `TBL-MCR-008` — every knowledge domain must carry a **unique two-digit prefix**. Domain `01` is already bound to `01_PRODUCT` by `MCX-01-001`. |
| **Consequence of the requested path** | Two domains sharing prefix `01`, violating the naming rule, plus fragmentation of vision knowledge across two folders. |
| **Why `01_PRODUCT` is correct** | `MCX-01-001` states its purpose as *"Defines what Oship is, why it exists, the value it delivers…"* and its scope as *"the product vision, mission, goals, problem statement, value proposition…"*. This document is exactly that scope. |
| **Relationship to `PRODUCT_VISION.md`** | `01_PRODUCT/INDEX.md` registers `PRODUCT_VISION.md` as `PLANNED`. That entry is **superseded** by this document; no parallel vision artifact will be created. |
| **Decision authority** | Human operator, consulted before authoring. Recorded as `DEC-VIS-001`. |
| **Status** | `IMPLEMENTED` — this file exists at the actual path. |

> **Rule `VIS-001`.** There is exactly **one** canonical vision artifact for Oship. Any future
> document proposing to be a second vision source is a defect. If `01_VISION/` is later created by
> an Architecture Board decision, this document **moves**; it is never **copied**.

---

## AI NAVIGATION METADATA — Document Root

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — read before any other bounded-domain document, including `AOM-ARCH-001`** |
| **AI DEPENDENCIES** | `README.md`, `PROJECT_PHILOSOPHY.md`, `docs/ADR/ADR-0001-ai-native-repository-architecture.md`, `docs/MASTER_CONTEXT/INDEX.md`, `docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md` |
| **AI INPUTS** | A question of the form *why does this exist*, *should we build this*, *is this in scope*, or *what does success mean* |
| **AI OUTPUTS** | A vision-traceable justification, a capability ID, an outcome ID, or an explicit refusal citing a non-goal |
| **AI IMPLEMENTATION IMPACT** | **INDIRECT BUT ABSOLUTE.** No code is written from this document. Every piece of code must nevertheless trace to a `CAP-VIS-` identifier defined here, or it is unjustified work. |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-001` … `VAL-VIS-120` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` (`AOM-ARCH-001`), `.ai/PROJECT_STATUS.md`, `.ai/CURRENT_CONTEXT.md`, `.ai/DECISION_LOG.md` |

---

## Identifier Namespace Registry

Identifiers in this document are **permanent**. They are allocated, never reassigned, and gaps are
never back-filled. A reader following a cross-reference to a retired ID must find nothing rather
than find something unrelated.

### TBL-VIS-002: ID Namespace Registry for `AOM-VIS-001`

| Namespace | Meaning | Reserved range | Authority |
| :--- | :--- | :--- | :--- |
| `VIS-` | Numbered constitutional rules of this document | 001–120 | L1 |
| `PROB-VIS-` | Problems Oship exists to solve | 001–060 | L1 |
| `ACT-VIS-` | Actors and actor classes | 001–030 | L1 |
| `VAL-CHAIN-VIS-` | Value chain stages | 001–020 | L1 |
| `CAP-VIS-` | Capabilities, at every level of the hierarchy | 001–120 | L1 |
| `OUT-VIS-` | Strategic outcomes | 001–060 | L1 |
| `PRN-VIS-` | Strategic principles | 001–030 | L1 |
| `NG-VIS-` | Non-goals — what Oship will not become | 001–040 | L1 |
| `CON-VIS-` | Strategic constraints | 001–060 | L1 |
| `SUC-VIS-` | Success metrics | 001–060 | L1 |
| `BND-VIS-` | Vision-level boundaries | 001–030 | L1 |
| `EVD-VIS-` | Repository evidence citations | 001–050 | L1 |
| `DEC-VIS-` | Vision-level decisions | 001–040 | L1 |
| `AI-VIS-` | Instructions binding on AI agents | 001–060 | L1 |
| `VAL-VIS-` | Validation rules | 001–200 | L1 |
| `FAL-VIS-` | Failure modes and anti-patterns | 001–200 | L1 |
| `DGM-VIS-` | Mermaid diagrams | 001–200 | L1 |
| `TBL-VIS-` | Identified tables | 001–200 | L1 |
| `IMG-VIS-` | Image specifications — specifications only, never binaries | 001–040 | L1 |

> **Rule `VIS-002`.** An identifier defined in this document may be **referenced** by any other
> document but may be **defined** only here. `AOM-ARCH-001` may cite `CAP-VIS-014`; it may not
> create `CAP-VIS-121`.

---

## Status Vocabulary — Binding on Every Claim

Oship's constitution forbids presenting intent as fact. Every claim in this document carries one of
the following labels, and the labels have fixed meanings.

### TBL-VIS-003: Status Vocabulary

| Label | Meaning | Evidence required |
| :--- | :--- | :--- |
| `IMPLEMENTED` | The thing exists and works in the repository today | A file, directory, or command that can be inspected now |
| `DOCUMENTED` | The thing is specified and binding on process, but no automation enforces it | The specifying document and section |
| `PARTIALLY IMPLEMENTED` | Some part exists; the rest does not | Evidence for the existing part **and** a statement of what is missing |
| `PLANNED` | Committed intent, not yet built | A roadmap, index, or task entry that records the commitment |
| `PROPOSED` | Suggested, not yet accepted | The proposal location; no commitment implied |
| `VISION` | A desired end-state that may take years and may never be reached in this form | This document only |
| `DEPRECATED` | Was real, is being removed | The superseding decision |
| `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | No evidence either way was found | A statement of what was searched |

> **Rule `VIS-003`.** `VISION` is the weakest label in this document, not the strongest. A statement
> labelled `VISION` grants **no** authority to build anything. Authority to build comes only from a
> `CAP-VIS-` entry that has reached `PLANNED` and has an owning architecture domain.

```mermaid
flowchart LR
    PR["PROPOSED"] --> PL["PLANNED"]
    VI["VISION"] --> PR
    PL --> PI["PARTIALLY IMPLEMENTED"]
    PI --> IM["IMPLEMENTED"]
    IM --> DE["DEPRECATED"]
    UN["UNKNOWN - requires repository verification"] -.->|"after investigation"| PR
    UN -.->|"after investigation"| IM
    DOC["DOCUMENTED"] --> PI
```

> **Diagram ID:** `DGM-VIS-002`
> **Explanation:** The only legal status transitions. Note that nothing moves directly from
> `VISION` to `IMPLEMENTED`: a desire must become a proposal, then a commitment, before it can
> become code. An agent that finds a `VISION` item in the codebase has found a governance failure,
> catalogued as `FAL-VIS-004`.

---

## Repository Evidence Base

Everything asserted as `IMPLEMENTED` in this document rests on the following inspected evidence.
The inspection was performed against branch `arena/019ffd50-oship` at parent commit `8c61052`.

### TBL-VIS-004: Evidence Register

| ID | Evidence | Observation | Supports |
| :--- | :--- | :--- | :--- |
| `EVD-VIS-001` | `README.md`, 93 KB, `ROOT-RME-001` v2.4.0 | Declares Oship an *"enterprise-grade, AI-native software development repository… read, reasoned over, and extended by AI coding agents first"* | `VIS-004`, `PROB-VIS-001` |
| `EVD-VIS-002` | `README.md` line 92 | Defines *"Money Factory"* as the repository operating as a compounding value asset | `VIS-006` |
| `EVD-VIS-003` | `README.md` lines 103–117 | The Ten Immutable Tenets | `PRN-VIS-001` … `PRN-VIS-010` |
| `EVD-VIS-004` | `.ai/` directory, 17 files | AI control plane exists: `PROJECT_STATUS.md`, `CURRENT_CONTEXT.md`, `NEXT_ACTION.md`, `SESSION_MEMORY.md`, `DECISION_LOG.md`, `CONTEXT_ROUTER.md`, operating manual | `CAP-VIS-001` `IMPLEMENTED` |
| `EVD-VIS-005` | `docs/ADR/ADR-0001-ai-native-repository-architecture.md`, `APPROVED` | Mandates `.ai/` control plane, YAML metadata, strict top-level structure, **zero application code in Phase 0** | `CON-VIS-001` |
| `EVD-VIS-006` | `docs/MASTER_CONTEXT/`, 24 domains each with `INDEX.md` | Knowledge graph exists | `CAP-VIS-002` `IMPLEMENTED` |
| `EVD-VIS-007` | `docs/MASTER_CONTEXT/23_STANDARDS/METADATA_STANDARD.md`, `MCX-23-002` | 15-key YAML frontmatter standard | `CAP-VIS-004` |
| `EVD-VIS-008` | `docs/MASTER_CONTEXT/MASTER_CONTEXT_MEMORY_SYSTEM.md`, 34,427 lines, `RELEASED` v1.0.0 | Memory constitution released via PR #5, tag `mcx-mem-001-v1.0.0` | `CAP-VIS-003` |
| `EVD-VIS-009` | `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`, `AOM-ARCH-001`, 10,844 lines | Architecture constitution Part 01 exists | `CAP-VIS-005`, all of §01.17 |
| `EVD-VIS-010` | `PROJECT_PHILOSOPHY.md`, 466 KB, 146 sections | Constitutional philosophy, §130 defines knowledge layers L1–L5 | `PRN-VIS-011` |
| `EVD-VIS-011` | `apps/`, `services/`, `packages/` | Contain only `.gitkeep` | Every runtime capability is `PLANNED`, not `IMPLEMENTED` |
| `EVD-VIS-012` | `apis/`, `sdk/` | Contain only `.gitkeep` | `CAP-VIS-030` `PLANNED` |
| `EVD-VIS-013` | `database/`, `storage/` | Contain only `.gitkeep` | `CAP-VIS-034` `PLANNED` |
| `EVD-VIS-014` | `infra/`, `k8s/`, `docker/`, `deployment/` | Contain only `.gitkeep` | `CAP-VIS-037` `PLANNED` |
| `EVD-VIS-015` | `monitoring/`, `observability/` | Contain only `.gitkeep` | `CAP-VIS-025` `PLANNED` |
| `EVD-VIS-016` | `tests/` | Contains only `.gitkeep` | `CAP-VIS-027` `PLANNED` |
| `EVD-VIS-017` | `.github/workflow-skeletons/` — ci, cd, release, security-scan, documentation, ai-governance, issue-triage, stale | Skeletons present but **not** installed in `.github/workflows/` | `CAP-VIS-026` `PARTIALLY IMPLEMENTED` |
| `EVD-VIS-018` | `.github/CODEOWNERS` | Every path maps to `@afshin-omnisystem` | `CON-VIS-010`, `ACT-VIS-002` |
| `EVD-VIS-019` | No `package.json`, `go.mod`, `pyproject.toml`, `pom.xml`, or lockfile at any level | No technology stack is chosen | `CON-VIS-020` `UNKNOWN` |
| `EVD-VIS-020` | `architecture/DOMAIN_MODEL.md`, `ARCH-DOM-001` | Four bounded contexts: Governance and AI, Core Platform, Financial Factory, Observability | `CAP-VIS-060` … `CAP-VIS-063` |
| `EVD-VIS-021` | `architecture/DOMAIN_MODEL.md` §2 | Ubiquitous language: *Money Factory* = *"primary domain engine processing enterprise financial workloads"*; *AI Workspace* = `.ai/` | `VIS-006`, `PROB-VIS-018` |
| `EVD-VIS-022` | `.ai/DECISION_LOG.md`, `AI-DEC-001` | Ten decisions `DEC-001` … `DEC-010`, all `APPROVED` or `RELEASED` | `CAP-VIS-006` |
| `EVD-VIS-023` | `docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md`, `MCX-01-001` | Registers `PRODUCT_VISION.md` as `PLANNED`; domain owns vision and mission | `TBL-VIS-001` |
| `EVD-VIS-024` | `docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md` PART 04, `TBL-MCR-008` | Unique two-digit domain prefix is mandatory | `TBL-VIS-001` |
| `EVD-VIS-025` | Git history: single functional commit `8c61052` plus this branch | The repository is at the very beginning of its life | `CON-VIS-002` |

> **Rule `VIS-004`.** Any future claim of `IMPLEMENTED` in this document must add a row to
> `TBL-VIS-004` in the same commit. A claim without an evidence row is a defect detected by
> `VAL-VIS-013`.

---

## Table of Contents — PART 01

| § | Section | Primary IDs | AI Priority |
| :--- | :--- | :--- | :---: |
| [01.1](#011--system-identity) | System Identity | `VIS-004`…`VIS-012` | **P0** |
| [01.2](#012--vision-statement) | Vision Statement | `VIS-013`…`VIS-020` | **P0** |
| [01.3](#013--mission-and-the-intent-hierarchy) | Mission and the Intent Hierarchy | `VIS-021`…`VIS-028` | **P0** |
| [01.4](#014--problem-space) | Problem Space | `PROB-VIS-001`…`030` | **P0** |
| [01.5](#015--users-and-actors) | Users and Actors | `ACT-VIS-001`…`016` | **P0** |
| [01.6](#016--value-model) | Value Model | `VAL-CHAIN-VIS-001`…`012` | **P1** |
| [01.7](#017--system-capabilities) | System Capabilities | `CAP-VIS-001`…`070` | **P0** |
| [01.8](#018--capability-hierarchy) | Capability Hierarchy | `CAP-VIS-071`…`090` | **P0** |
| [01.9](#019--system-boundaries) | System Boundaries | `BND-VIS-001`…`020` | **P0** |
| [01.10](#0110--strategic-principles) | Strategic Principles | `PRN-VIS-001`…`020` | **P0** |
| [01.11](#0111--non-goals) | Non-Goals | `NG-VIS-001`…`024` | **P0** |
| [01.12](#0112--success-model) | Success Model | `SUC-VIS-001`…`042` | **P1** |
| [01.13](#0113--strategic-outcomes) | Strategic Outcomes | `OUT-VIS-001`…`030` | **P1** |
| [01.14](#0114--evolution-model) | Evolution Model | `VIS-040`…`VIS-048` | **P1** |
| [01.15](#0115--ai-native-vision) | AI-Native Vision | `AI-VIS-001`…`030` | **P0** |
| [01.16](#0116--human-and-ai-collaboration-model) | Human and AI Collaboration Model | `AI-VIS-031`…`044` | **P0** |
| [01.17](#0117--architecture-traceability) | Architecture Traceability | `VIS-050`…`VIS-056` | **P0** |
| [01.18](#0118--requirements-derivation) | Requirements Derivation | `DEC-VIS-010`…`016` | **P0** |
| [01.19](#0119--strategic-constraints) | Strategic Constraints | `CON-VIS-001`…`030` | **P0** |
| [01.20](#0120--architectural-drift-prevention) | Architectural Drift Prevention | `VIS-060`…`VIS-068` | **P1** |
| [01.21](#0121--vision-governance) | Vision Governance | `VIS-070`…`VIS-078` | **P1** |
| [01.22](#0122--change-management) | Change Management | `VIS-080`…`VIS-086` | **P2** |
| [01.23](#0123--ai-interpretation-guide) | AI Interpretation Guide | `AI-VIS-045`…`060` | **P0** |
| [01.24](#0124--validation-rules) | Validation Rules | `VAL-VIS-001`…`200` | **P0** |
| [01.25](#0125--failure-and-anti-pattern-library) | Failure and Anti-Pattern Library | `FAL-VIS-001`…`120` | **P1** |
| [01.26](#0126--decision-model) | Decision Model | `DEC-VIS-017`…`030` | **P0** |
| [01.27](#0127--traceability-matrix) | Traceability Matrix | `TBL-VIS-122`…`126` | **P0** |
| [01.28](#0128--future-evolution-of-this-document) | Future Evolution of This Document | `VIS-098`…`VIS-101` | **P1** |
| [App. A](#appendix-a--image-specifications) | Image Specifications | `IMG-VIS-001`…`022` | **P3** |
| [App. B](#appendix-b--reference-material) | Reference Material — Glossary, Vocabulary, Ledger | `TBL-VIS-133`…`138` | **P3** |

---

## 01.1 — System Identity

### AI NAVIGATION METADATA — §01.1

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — the first substantive section any agent reads** |
| **AI DEPENDENCIES** | `README.md`, `architecture/DOMAIN_MODEL.md`, `docs/ADR/ADR-0001` |
| **AI INPUTS** | The question *what is this repository* |
| **AI OUTPUTS** | A category judgement that constrains every later design choice |
| **AI IMPLEMENTATION IMPACT** | Misclassifying Oship produces architecture that solves the wrong problem |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-001`…`VAL-VIS-008` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.2 System Identity |

### 01.1.1 What Oship Is

> **`VIS-004` — Canonical identity statement.**
> **Oship is an AI-native enterprise software factory: a repository whose primary product is the
> machine-executable knowledge required to build, operate, and evolve enterprise software, and
> whose secondary product is the software itself.**

Read that twice, because the ordering is the whole point and it is unusual. In an ordinary project
the code is the asset and the documentation is a lagging description of it. In Oship the
specification is the asset and the code is a **derived artifact** — a compilation target produced
from specifications by human and machine labour together.

This is not an aspiration bolted onto a conventional codebase. It is the observable present state
of the repository. At the time of writing, Oship contains approximately 94,000 lines of
constitutional, architectural, and governance specification (`EVD-VIS-001`, `EVD-VIS-006`,
`EVD-VIS-008`, `EVD-VIS-009`, `EVD-VIS-010`) and **zero lines of application code**
(`EVD-VIS-011`). That ratio is a deliberate consequence of `ADR-0001`, which mandates zero
application code in Phase 0 (`EVD-VIS-005`), not an accident of an unfinished project.

### TBL-VIS-005: Identity Assertions

| ID | Assertion | Status | Evidence |
| :--- | :--- | :--- | :--- |
| `VIS-004` | Oship is an AI-native enterprise software factory | `IMPLEMENTED` as a documentation system; `PLANNED` as a runtime | `EVD-VIS-001`, `EVD-VIS-011` |
| `VIS-005` | Oship's primary artifact is executable knowledge, not code | `IMPLEMENTED` | `EVD-VIS-004`, `EVD-VIS-006`, `EVD-VIS-009` |
| `VIS-006` | Oship's domain identity is the "Money Factory" — an engine for enterprise financial workloads | `PLANNED` | `EVD-VIS-002`, `EVD-VIS-021` |
| `VIS-007` | Oship is designed to be read by AI agents first and humans second | `IMPLEMENTED` at the documentation level | `EVD-VIS-001`, `EVD-VIS-004` |
| `VIS-008` | Oship is a single-repository system, not a distributed set of repositories | `IMPLEMENTED` | `EVD-VIS-025` |
| `VIS-009` | Oship's governance is constitutional — rules bind their own authors | `IMPLEMENTED` | `EVD-VIS-005`, `EVD-VIS-010`, `EVD-VIS-022` |

```mermaid
mindmap
  root(("OSHIP IDENTITY"))
    ("Category")
      ("AI-native software factory")
      ("Constitutional knowledge system")
      ("Enterprise value engine - Money Factory")
    ("Primary product")
      ("Machine-executable specification")
      ("Stable identifier graph")
      ("Decision records")
    ("Secondary product")
      ("Application services - PLANNED")
      ("APIs and SDKs - PLANNED")
      ("Financial processing engine - PLANNED")
    ("Primary reader")
      ("Autonomous coding agents")
      ("Human architects second")
    ("Governing law")
      ("PROJECT_PHILOSOPHY")
      ("MASTER_CONTEXT_RULES")
      ("ADR-0001")
    ("Present state")
      ("94k lines of specification")
      ("0 lines of application code")
      ("Phase A - bounded domain content")
```

> **Diagram ID:** `DGM-VIS-003` — **System Identity Map**
> **Explanation:** Oship's identity in one view. The branch that surprises most readers is
> *Primary product*: specification, not software. The *Present state* branch keeps the map honest —
> the runtime branches are all `PLANNED`, and an agent that treats them as present will generate
> code against services that do not exist.

### 01.1.2 What Oship Is Not

Identity is defined as much by exclusion as by inclusion. The following are **not** what Oship is,
and each misreading has a predictable failure attached to it.

### TBL-VIS-006: Identity Exclusions

| Misreading | Why it is wrong | Failure it causes |
| :--- | :--- | :--- |
| "A documentation repository" | Documentation describes a system that exists elsewhere. Oship's specifications **are** the system's authoritative definition; the code does not yet exist to be described. | `FAL-VIS-001` |
| "A boilerplate or starter template" | Templates are copied and diverge. Oship is a single evolving system with permanent identifiers and a decision history. | `FAL-VIS-002` |
| "A conventional monorepo awaiting code" | A monorepo is a code-storage strategy. Oship is a knowledge-first construction method that *also* stores code. | `FAL-VIS-003` |
| "A finished financial platform" | No transaction is processed. `apps/`, `services/`, `database/` are empty (`EVD-VIS-011`, `EVD-VIS-013`). | `FAL-VIS-005` |
| "An AI research project" | Oship does not train, fine-tune, or research models. It *consumes* agents as labour. | `NG-VIS-003` |
| "A framework for others to build on" | Oship is a system, not a library. It has no external consumers and publishes no package. | `NG-VIS-007` |
| "A prompt collection" | Prompts are ephemeral. Oship's artifacts are versioned, identified, and governed. | `FAL-VIS-011` |

> **`VIS-010`.** When an agent cannot decide whether a proposed change belongs in Oship, it applies
> the exclusion table before the inclusion table. Exclusions are cheaper to evaluate and catch most
> scope errors.

### 01.1.3 System Category

Oship belongs to a category that is still forming in the industry, so precision matters more than a
familiar label.

```mermaid
flowchart TD
    Q1{"Is the primary asset the source code?"}
    Q1 -->|"Yes"| CONV["Conventional software project"]
    Q1 -->|"No"| Q2{"Is the primary asset documentation about a separate system?"}
    Q2 -->|"Yes"| DOCS["Documentation repository"]
    Q2 -->|"No"| Q3{"Is the specification the authoritative definition from which code is derived?"}
    Q3 -->|"No"| WIKI["Knowledge base or wiki"]
    Q3 -->|"Yes"| Q4{"Is the intended primary reader an autonomous agent?"}
    Q4 -->|"No"| MDD["Model-driven engineering"]
    Q4 -->|"Yes"| OSHIP["AI-NATIVE SOFTWARE FACTORY - Oship"]
    OSHIP --> NOTE["Nearest relatives: model-driven engineering, literate programming, specification-first design"]
```

> **Diagram ID:** `DGM-VIS-004`
> **Explanation:** A classification decision tree that terminates in Oship's category. The final
> discriminator is the *intended reader*. Model-driven engineering targets a code generator with
> rigid grammar; Oship targets a reasoning agent that requires context, rationale, and explicit
> prohibition. That difference is why this document explains **why**, not merely **what** — a code
> generator does not need reasons, and an agent does.

### 01.1.4 Primary and Secondary Purposes

### TBL-VIS-007: Purpose Ranking

| Rank | Purpose | Statement | Status |
| :---: | :--- | :--- | :--- |
| **Primary** | `VIS-011` | Make enterprise software construction **tractable for autonomous agents** by removing every dependency on undocumented human knowledge | `PARTIALLY IMPLEMENTED` |
| Secondary 1 | `VIS-012a` | Build the "Money Factory" — an enterprise engine for financial workloads | `PLANNED` |
| Secondary 2 | `VIS-012b` | Demonstrate that specification-first construction lowers the marginal cost of change over time | `VISION` |
| Secondary 3 | `VIS-012c` | Preserve institutional knowledge so that contributor turnover, human or agent, does not destroy capability | `IMPLEMENTED` at the documentation level |
| Secondary 4 | `VIS-012d` | Provide a reproducible method that survives model generations and vendor changes | `DOCUMENTED` |

> **`VIS-012`.** The purposes are **ranked, not equal**. When the Money Factory objective conflicts
> with agent tractability, tractability wins. A financial feature that can only be maintained by a
> human who remembers an unwritten rule is rejected regardless of its revenue value. This is the
> single most consequential trade-off in the document and the one most likely to be quietly
> violated under delivery pressure.

### 01.1.5 What Makes Oship Structurally Different

### TBL-VIS-008: Structural Differentiators

| # | Ordinary project | Oship | Evidence |
| :---: | :--- | :--- | :--- |
| 1 | Docs lag code | Specification precedes code and outnumbers it ~94,000 : 0 | `EVD-VIS-011` |
| 2 | Knowledge lives in people | Knowledge lives in versioned, identified artifacts | `EVD-VIS-006` |
| 3 | Identifiers are incidental | Identifiers are permanent and never reused | `TBL-VIS-002` |
| 4 | Decisions are remembered | Decisions are recorded as immutable ADRs | `EVD-VIS-005`, `EVD-VIS-022` |
| 5 | Onboarding is a conversation | Onboarding is a file read; `.ai/` is the boot sequence | `EVD-VIS-004` |
| 6 | Status is optimistic | Status labels are mandatory and enforced | `TBL-VIS-003` |
| 7 | Agents are autocomplete | Agents are first-class labour with a defined operating manual | `EVD-VIS-004` |
| 8 | Structure emerges | Structure is legislated before it is populated | `EVD-VIS-005` |

```mermaid
flowchart LR
    subgraph ORD["Ordinary project - knowledge decays"]
        direction TB
        O1["Code written"] --> O2["Knowledge in author's head"]
        O2 --> O3["Author leaves"]
        O3 --> O4["Knowledge lost"]
        O4 --> O5["Change cost rises"]
        O5 --> O6["Rewrite"]
        O6 --> O1
    end
    subgraph OSH["Oship - knowledge compounds"]
        direction TB
        S1["Specification written"] --> S2["Knowledge in identified artifact"]
        S2 --> S3["Contributor leaves"]
        S3 --> S4["Knowledge retained"]
        S4 --> S5["Change cost falls"]
        S5 --> S6["Extension"]
        S6 --> S1
    end
```

> **Diagram ID:** `DGM-VIS-005`
> **Explanation:** The two loops that define the strategic bet. The left loop is the industry
> default: knowledge decays into people, people leave, cost rises until rewrite. The right loop is
> Oship's wager — that front-loading specification cost converts the decay loop into a compounding
> loop. This is what `EVD-VIS-002` means by *"Money Factory"*: **the repository itself is the
> compounding asset**, not any single feature shipped from it.

> **Honest caveat.** The right-hand loop is `VISION`. Oship has completed one turn of it and cannot
> yet demonstrate that change cost falls over time. `SUC-VIS-021` is the metric that will decide
> whether the bet paid off, and it is currently unmeasurable because there is no code to change.

---

## 01.2 — Vision Statement

### AI NAVIGATION METADATA — §01.2

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.1 System Identity |
| **AI INPUTS** | A proposal that must be tested against long-term intent |
| **AI OUTPUTS** | Accept, reject, or escalate, with the vision clause cited |
| **AI IMPLEMENTATION IMPACT** | Sets the target state every roadmap increment must move toward |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-009`…`VAL-VIS-016` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md` |

### 01.2.1 The Canonical Vision Statement

> ### `VIS-013` — THE OSHIP VISION
>
> **Oship exists to make enterprise software a compounding asset rather than a depreciating
> liability — by encoding every architectural decision, constraint, and intent as
> machine-executable knowledge, so that autonomous agents and humans can build, verify, and evolve
> the system indefinitely without any dependency on undocumented understanding.**

A vision statement in this document must satisfy five properties. Most corporate vision statements
satisfy none of them, which is why they cannot be used to make decisions.

### TBL-VIS-009: Vision Statement Property Test

| Property | Requirement | How `VIS-013` satisfies it |
| :--- | :--- | :--- |
| **Precise** | No word may carry two meanings in context | Every load-bearing term is defined in `TBL-VIS-010` |
| **Testable** | Falsifiable by observation | Measured by `SUC-VIS-001`, `SUC-VIS-021`, `SUC-VIS-025` |
| **Evolvable** | Can absorb new capability without rewrite | Names no technology, market, or product feature |
| **AI-readable** | Parseable into obligations | Decomposed into `VIS-014`…`VIS-019` below |
| **Architecture-compatible** | Each clause maps to an architectural mechanism | Mapped in `TBL-VIS-011` |

### TBL-VIS-010: Definitions of Load-Bearing Terms in `VIS-013`

| Term | Definition in Oship | Not to be confused with |
| :--- | :--- | :--- |
| **Compounding asset** | A system whose marginal cost of change decreases as it grows | Simply "valuable" |
| **Depreciating liability** | A system whose marginal cost of change increases as it grows | "Legacy" or "old" |
| **Machine-executable knowledge** | Specification structured so an agent can act on it without human clarification | Documentation that merely mentions an agent |
| **Architectural decision** | A choice that is expensive to reverse and constrains later choices | Any implementation preference |
| **Autonomous agent** | A software agent that plans and executes multi-step work with bounded human approval | An autocomplete or chat assistant |
| **Indefinitely** | Across model generations, vendor changes, and contributor turnover | Forever without maintenance |
| **Undocumented understanding** | Knowledge held only in a person's memory | Tacit skill such as typing or reading |

### 01.2.2 Vision Decomposition

`VIS-013` is decomposed into six independently testable clauses. This is what makes it usable by an
agent: the whole statement cannot be evaluated, but each clause can.

### TBL-VIS-011: Vision Clause Decomposition

| ID | Clause | Obligation it creates | Architectural mechanism | Status |
| :--- | :--- | :--- | :--- | :--- |
| `VIS-014` | "compounding asset rather than depreciating liability" | Every change must lower or hold the cost of the next change | Modular boundaries, contracts, `AOM-ARCH-001` §01.9 dependency rules | `VISION` |
| `VIS-015` | "encoding every architectural decision" | No decision may exist only in memory or chat | ADR process, `docs/ADR/`, `.ai/DECISION_LOG.md` | `IMPLEMENTED` |
| `VIS-016` | "constraint" | Limits are stated explicitly, including uncomfortable ones | §01.19 constraint register, `TBL-VIS-003` status vocabulary | `IMPLEMENTED` |
| `VIS-017` | "and intent" | The *why* travels with the *what*, permanently | Rationale required in every specification section | `IMPLEMENTED` |
| `VIS-018` | "autonomous agents and humans can build, verify and evolve" | Both classes of worker are first-class; neither is an afterthought | `.ai/` control plane, `AOM-ARCH-001` §01.24, §01.16 here | `PARTIALLY IMPLEMENTED` |
| `VIS-019` | "without any dependency on undocumented understanding" | Hidden knowledge is a defect, not a convenience | Evidence rule `VIS-004`, validation `VAL-VIS-013` | `PARTIALLY IMPLEMENTED` |

```mermaid
flowchart TD
    V["VIS-013 THE OSHIP VISION"]
    V --> C1["VIS-014 Compounding not depreciating"]
    V --> C2["VIS-015 Encode every decision"]
    V --> C3["VIS-016 Encode every constraint"]
    V --> C4["VIS-017 Encode every intent"]
    V --> C5["VIS-018 Agents and humans both first-class"]
    V --> C6["VIS-019 Zero undocumented dependency"]

    C1 --> M1["Mechanism: modular boundaries and contracts"]
    C2 --> M2["Mechanism: immutable ADRs"]
    C3 --> M3["Mechanism: constraint register and status labels"]
    C4 --> M4["Mechanism: rationale required in every section"]
    C5 --> M5["Mechanism: .ai control plane and responsibility matrix"]
    C6 --> M6["Mechanism: evidence citations and validation rules"]

    M1 --> T["Every mechanism is testable - see section 01.24"]
    M2 --> T
    M3 --> T
    M4 --> T
    M5 --> T
    M6 --> T
```

> **Diagram ID:** `DGM-VIS-006` — **Vision Model**
> **Explanation:** The vision is not a sentence to be admired but a tree to be traversed. Each of
> the six clauses carries a concrete mechanism, and each mechanism carries validation rules. An
> agent asked *does this change serve the vision* does not reason about the sentence; it identifies
> which clause the change touches and evaluates against that clause's mechanism.

### 01.2.3 What Would Falsify the Vision

A vision that cannot fail is not testable. These conditions would demonstrate `VIS-013` is wrong or
unreachable, and they must be watched for rather than explained away.

### TBL-VIS-012: Vision Falsification Conditions

| ID | Condition | What it would prove | Current reading |
| :--- | :--- | :--- | :--- |
| `VIS-020a` | Change cost rises steadily despite specification discipline | The compounding premise is false for this class of system | Unmeasurable — no code yet |
| `VIS-020b` | Agents cannot implement from the specification without human clarification | The specification is not actually machine-executable | Untested — `SUC-VIS-011` will measure it |
| `VIS-020c` | Specification maintenance consumes more effort than it saves | The overhead exceeds the benefit | Unmeasurable — no delivery baseline |
| `VIS-020d` | Specifications drift from code and become misleading | Drift prevention has failed; the asset became a liability | §01.20 addresses this risk |
| `VIS-020e` | The Money Factory objective is abandoned or never begun | The secondary purpose was never real | Open — `apps/` and `services/` remain empty |

> **`VIS-020`.** These conditions are reviewed at every phase gate. A condition that is met is
> escalated to the Architecture Board as a vision-level defect, not silently tolerated. Explaining
> away a falsification condition is catalogued as `FAL-VIS-014`.

---

## 01.3 — Mission and the Intent Hierarchy

### AI NAVIGATION METADATA — §01.3

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.2 Vision Statement |
| **AI INPUTS** | A statement of intent at any altitude |
| **AI OUTPUTS** | Correct classification of that statement into the intent hierarchy |
| **AI IMPLEMENTATION IMPACT** | Prevents features masquerading as strategy and strategy masquerading as features |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-017`…`VAL-VIS-024` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md`, `.ai/ROADMAP_AI.md` |

### 01.3.1 The Mission

> ### `VIS-021` — THE OSHIP MISSION
>
> **Build and maintain a repository in which every architectural fact required to construct the
> system is written down, identified, validated, and reachable — such that a competent autonomous
> agent, starting with no prior context, can locate what it needs, understand why it exists, and
> implement it correctly without asking a human.**

The relationship between vision and mission is precise and frequently confused. The **vision** is
the end state (`VIS-013`: software as a compounding asset). The **mission** is the work undertaken
now to move toward it (`VIS-021`: write everything down, identifiably and reachably). The vision may
take a decade and may never be fully reached. The mission is what is done this week.

### 01.3.2 The Intent Hierarchy — Seven Distinct Concepts

These seven concepts are routinely used interchangeably in industry, and that conflation is the
root cause of unbuildable roadmaps. In Oship they are strictly separated.

### TBL-VIS-013: Vision, Mission, Purpose, Objective, Goal, Capability, Feature

| Concept | Question it answers | Time horizon | Changes when | Testable? | Oship example |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Vision** | What does the world look like if we fully succeed? | Indefinite | Almost never — requires Architecture Board and a superseding ADR | Falsifiable, not directly measurable | `VIS-013` |
| **Mission** | What work do we undertake to move toward the vision? | Multi-year | On strategic pivot | Partially | `VIS-021` |
| **Purpose** | Why does this thing exist at all? | Permanent | Never, while the thing exists | No — it is a reason | `VIS-011` agent tractability |
| **Objective** | What measurable change do we intend within a bounded period? | Phase or quarter | Each phase | Yes — numerically | `OUT-VIS-001` |
| **Goal** | What specific end state satisfies an objective? | Phase | On objective change | Yes — binary done or not | Complete `AOM-ARCH-001` |
| **Capability** | What can the system *do*, independent of how? | Long-lived | On scope change | Yes — present or absent | `CAP-VIS-014` |
| **Feature** | What concrete function do users touch? | Release | Frequently | Yes — by acceptance test | `PLANNED` — none exist |

> **`VIS-022`.** A statement that cannot be placed in exactly one row of `TBL-VIS-013` is
> malformed and must be rewritten before it enters any planning artifact. The most common error is
> a "goal" that is actually a feature, which produces a roadmap of implementation details with no
> strategic justification. The second most common is a "vision" that is actually an objective,
> which produces a strategy that expires in a quarter.

```mermaid
flowchart TD
    VIS["VISION - VIS-013 - indefinite horizon - why the world should change"]
    VIS --> MIS["MISSION - VIS-021 - multi-year - what work we undertake"]
    MIS --> PUR["PURPOSE - VIS-011 - permanent - why this exists"]
    PUR --> OBJ["OBJECTIVE - OUT-VIS-nnn - phase - measurable change"]
    OBJ --> GOA["GOAL - phase - binary end state"]
    GOA --> CAP["CAPABILITY - CAP-VIS-nnn - what the system can do"]
    CAP --> FEA["FEATURE - release - what a user touches"]
    FEA --> REQ["REQUIREMENT - implementable statement"]
    REQ --> IMPL["IMPLEMENTATION - code"]
    IMPL --> TEST["TEST - proof"]
    TEST --> REL["RELEASE - delivery"]

    REL -.->|"operational feedback"| OBJ
    TEST -.->|"validation feedback"| CAP
```

> **Diagram ID:** `DGM-VIS-007`
> **Explanation:** The full intent hierarchy from vision to release, with the two feedback edges
> that keep it from being a one-way waterfall. Note that **capability sits above feature**: Oship
> decides what the system can do before deciding what a user touches. Inverting these two produces
> a feature list with no coherent system behind it — catalogued as `FAL-VIS-021`.

### 01.3.3 Altitude Errors and How to Detect Them

### TBL-VIS-014: Altitude Error Detection

| Error | Symptom | Detection question | Correction |
| :--- | :--- | :--- | :--- |
| Feature posing as vision | "Our vision is a real-time dashboard" | Will this be obsolete in three years? | Demote to feature; find the capability it serves |
| Vision posing as goal | "This quarter we will make software a compounding asset" | Can this be marked done on a date? | Promote to vision; extract a measurable objective |
| Capability posing as feature | "Add multi-tenancy" | Is this one screen or a system property? | Promote to capability; decompose into features |
| Objective without metric | "Improve agent effectiveness" | What number changes, from what to what? | Add a `SUC-VIS-` metric or reject |
| Goal without capability | "Ship the ledger service" | Which capability does this deliver? | Link to a `CAP-VIS-` ID or reject as unjustified |
| Purpose treated as changeable | "Let us revisit why we exist this sprint" | Has the system's reason for existing actually ended? | Purpose changes only by superseding ADR |

```mermaid
flowchart TD
    S["A statement of intent arrives"] --> Q1{"Does it name a specific user-facing function?"}
    Q1 -->|"Yes"| F["FEATURE - must link to a capability"]
    Q1 -->|"No"| Q2{"Does it describe something the system can do, regardless of how?"}
    Q2 -->|"Yes"| C["CAPABILITY - must link to an outcome"]
    Q2 -->|"No"| Q3{"Can it be marked complete on a date?"}
    Q3 -->|"Yes"| Q4{"Does it carry a number?"}
    Q4 -->|"Yes"| O["OBJECTIVE - must link to the mission"]
    Q4 -->|"No"| G["GOAL - must link to an objective"]
    Q3 -->|"No"| Q5{"Does it describe an end state of the world?"}
    Q5 -->|"Yes"| V["VISION - requires Architecture Board"]
    Q5 -->|"No"| Q6{"Does it describe work we undertake?"}
    Q6 -->|"Yes"| M["MISSION"]
    Q6 -->|"No"| P["PURPOSE - or malformed, reject"]

    F --> LINK["Every node must link upward or be rejected"]
    C --> LINK
    O --> LINK
    G --> LINK
```

> **Diagram ID:** `DGM-VIS-008`
> **Explanation:** The classification decision tree an agent runs on any incoming statement of
> intent. The terminal rule matters as much as the classification: **every node must link upward**.
> A feature with no capability, or a goal with no objective, is orphaned work and is rejected at
> intake rather than discovered as waste at review.

### 01.3.4 The Mission in Force Right Now

Concretely, at the current phase, the mission reduces to a small set of active obligations.

### TBL-VIS-015: Active Mission Obligations

| ID | Obligation | Owner | Status |
| :--- | :--- | :--- | :--- |
| `VIS-023` | Every bounded domain has a constitutional document before it has code | Architecture | `PARTIALLY IMPLEMENTED` — 2 of 24 domains |
| `VIS-024` | Every architectural fact carries a permanent identifier | Architecture | `IMPLEMENTED` |
| `VIS-025` | Every claim carries an honest status label | All contributors | `IMPLEMENTED` |
| `VIS-026` | Every document is reachable from `.ai/` within three hops | Documentation | `IMPLEMENTED` |
| `VIS-027` | Every decision that constrains later work becomes an ADR | Architecture | `IMPLEMENTED` |
| `VIS-028` | No application code is written before its specification exists | All contributors | `IMPLEMENTED` — trivially, since none exists |

> **Honest note on `VIS-028`.** This obligation is currently satisfied for a weak reason: no code
> exists at all (`EVD-VIS-011`). Its real test begins the moment Phase C opens. An obligation that
> is only satisfied by inaction has not yet been demonstrated, and `TBL-VIS-015` will need
> re-evaluation at that gate rather than being assumed to hold.

---

## 01.4 — Problem Space

### AI NAVIGATION METADATA — §01.4

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — no capability may be proposed without naming the problem it solves** |
| **AI DEPENDENCIES** | §01.1, §01.2 |
| **AI INPUTS** | A proposed capability, feature, or refactor |
| **AI OUTPUTS** | The `PROB-VIS-` identifier the work addresses, or a rejection |
| **AI IMPLEMENTATION IMPACT** | Work that solves no catalogued problem is unjustified and must not be built |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-025`…`VAL-VIS-036` |
| **AI RELATED DOCUMENTS** | `PROJECT_PHILOSOPHY.md`, `docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md` |

### 01.4.1 The Two Problem Families

Oship addresses two distinct families of problem, and confusing them is the fastest route to
incoherent architecture.

**Family A — Construction problems.** Problems in *how enterprise software gets built*. These are
the problems Oship attacks with its knowledge-first method. They are the reason the repository is
structured as it is.

**Family B — Domain problems.** Problems in *enterprise financial workload processing* — the
"Money Factory" domain (`EVD-VIS-021`). These are the problems the eventual runtime will solve for
end users.

> **`VIS-029`.** Family A problems are **being solved now**. Family B problems are **catalogued but
> not yet attacked**, because no application code exists (`EVD-VIS-011`). An agent must never
> present a Family B problem as under active mitigation.

```mermaid
flowchart TB
    subgraph FA["FAMILY A - Construction problems - ACTIVE"]
        direction TB
        A1["Knowledge decay"]
        A2["Agent context starvation"]
        A3["Undocumented decisions"]
        A4["Architectural drift"]
        A5["Onboarding cost"]
        A6["Status dishonesty"]
    end
    subgraph FB["FAMILY B - Domain problems - CATALOGUED ONLY"]
        direction TB
        B1["Financial workload processing"]
        B2["Multi-tenant isolation"]
        B3["Auditability of money movement"]
        B4["Settlement correctness"]
    end
    FA -->|"solved by the method"| M["Oship repository and its constitution"]
    FB -.->|"to be solved by the runtime - PLANNED"| R["Oship runtime - does not exist"]
    M -->|"produces"| R
```

> **Diagram ID:** `DGM-VIS-009` — **Problem Landscape**
> **Explanation:** The two families and their very different states. Solid arrows are active;
> dashed arrows are `PLANNED`. The critical reading is that Family A must be solved *well enough*
> before Family B can be attacked at all — the method produces the runtime, not the reverse.

### 01.4.2 Family A — Construction Problems

Each problem below carries the full field set required by the vision specification.

### TBL-VIS-016: `PROB-VIS-001` — Knowledge Decay

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-001` |
| **Problem** | Architectural knowledge lives in contributors' memories and is destroyed by turnover |
| **Affected Actor** | `ACT-VIS-001` architect, `ACT-VIS-002` maintainer, `ACT-VIS-005` autonomous agent |
| **Current Pain** | Every new contributor reconstructs intent by reading code and guessing; guesses are frequently wrong |
| **Impact** | Rising change cost, repeated mistakes, rewrites that discard hard-won correctness |
| **Root Cause** | Code records *what* a system does but not *why*, and *why* is what constrains the next change |
| **Oship Response** | `CAP-VIS-002` knowledge graph, `CAP-VIS-006` decision records, mandatory rationale in every section |
| **Priority** | **CRITICAL** |
| **Status** | `PARTIALLY IMPLEMENTED` — the mechanism exists; its durability is unproven |
| **Evidence** | `EVD-VIS-006`, `EVD-VIS-022` |
| **AI Interpretation** | When you cannot determine why something exists, that is an instance of this problem. Do not guess. Record `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` and escalate. |

### TBL-VIS-017: `PROB-VIS-002` — Agent Context Starvation

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-002` |
| **Problem** | Autonomous agents cannot implement correctly because the necessary context is absent, scattered, or contradictory |
| **Affected Actor** | `ACT-VIS-005` autonomous agent, `ACT-VIS-006` agent orchestrator |
| **Current Pain** | Agents produce plausible code that violates unstated constraints, then humans spend more time reviewing than they saved |
| **Impact** | AI labour yields negative net productivity; teams abandon agents and conclude the technology is immature |
| **Root Cause** | Repositories are optimised for human readers who can ask questions; agents cannot ask and will fabricate instead |
| **Oship Response** | `CAP-VIS-001` control plane, `CAP-VIS-007` deterministic navigation, AI metadata on every section, explicit prohibitions |
| **Priority** | **CRITICAL** |
| **Status** | `PARTIALLY IMPLEMENTED` |
| **Evidence** | `EVD-VIS-004`, `EVD-VIS-009` |
| **AI Interpretation** | This is the problem you personally embody. If you find yourself inferring a rule that is not written, you have detected this problem — report it rather than proceeding on the inference. |

### TBL-VIS-018: `PROB-VIS-003` — Undocumented Decisions

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-003` |
| **Problem** | Consequential decisions are made in conversation and never recorded |
| **Affected Actor** | `ACT-VIS-001`, `ACT-VIS-002`, `ACT-VIS-005` |
| **Current Pain** | Later contributors reverse decisions without knowing the constraints that produced them, reintroducing solved failures |
| **Impact** | Oscillating architecture; the same debate recurs annually with no accumulated resolution |
| **Root Cause** | Recording a decision costs effort now and pays off later, so it is systematically under-supplied |
| **Oship Response** | `CAP-VIS-006` immutable ADR process; `.ai/DECISION_LOG.md`; decisions immutable once approved |
| **Priority** | **CRITICAL** |
| **Status** | `IMPLEMENTED` |
| **Evidence** | `EVD-VIS-005`, `EVD-VIS-022` — ten recorded decisions, all `APPROVED` or `RELEASED` |
| **AI Interpretation** | Before proposing a change that contradicts existing structure, search `docs/ADR/` and `.ai/DECISION_LOG.md`. A contradiction with an `APPROVED` ADR requires a superseding ADR, never a silent edit. |

### TBL-VIS-019: `PROB-VIS-004` — Architectural Drift

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-004` |
| **Problem** | Implementation diverges from specification until the specification becomes actively misleading |
| **Affected Actor** | All |
| **Current Pain** | Readers learn to distrust documentation, which removes the incentive to maintain it, which accelerates drift |
| **Impact** | The knowledge asset becomes a liability — worse than no documentation, because it misleads confidently |
| **Root Cause** | Code changes are enforced by compilers; specification changes are enforced by discipline alone |
| **Oship Response** | `CAP-VIS-009` drift detection, §01.20 escalation model, traceability matrix §01.27 |
| **Priority** | **CRITICAL** |
| **Status** | `DOCUMENTED` — the model is specified; automated detection is `PLANNED` |
| **Evidence** | `EVD-VIS-017` — CI skeletons exist but are not installed, so nothing is enforced automatically |
| **AI Interpretation** | This is the problem most likely to make this very document dangerous over time. If you find code contradicting a specification, the contradiction itself is the defect — do not assume the code is authoritative. |

### TBL-VIS-020: `PROB-VIS-005` — Onboarding Cost

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-005` |
| **Problem** | A new contributor, human or agent, needs weeks of human attention before becoming productive |
| **Affected Actor** | `ACT-VIS-002`, `ACT-VIS-005`, `ACT-VIS-003` |
| **Current Pain** | Senior contributors spend their scarcest hours re-explaining context |
| **Impact** | Scaling contributor count *reduces* throughput; agents multiply the problem because they onboard on every task |
| **Root Cause** | Onboarding knowledge is transmitted conversationally and must be regenerated per person |
| **Oship Response** | `CAP-VIS-007` deterministic navigation; `.ai/` boot sequence; `CONTEXT_ROUTER.md` |
| **Priority** | **HIGH** |
| **Status** | `PARTIALLY IMPLEMENTED` |
| **Evidence** | `EVD-VIS-004` |
| **AI Interpretation** | You onboard on every single task. The time you spend locating context is the direct measure of this problem. If a needed fact took more than three hops to find, that is a navigation defect worth reporting. |

### TBL-VIS-021: `PROB-VIS-006` — Status Dishonesty

| Field | Value |
| :--- | :--- |
| **ID** | `PROB-VIS-006` |
| **Problem** | Documentation describes intended behaviour as though it were current behaviour |
| **Affected Actor** | All, but agents most severely |
| **Current Pain** | An agent reads "the service validates input", generates a caller assuming validation, and ships an injection vector |
| **Impact** | Silent correctness and security failures; total loss of trust in the specification |
| **Root Cause** | Aspirational writing is natural, and the present and future tense are easy to blur |
| **Oship Response** | `TBL-VIS-003` mandatory status vocabulary; `VIS-004` evidence rule; `VAL-VIS-013` |
| **Priority** | **CRITICAL** |
| **Status** | `IMPLEMENTED` |
| **Evidence** | `EVD-VIS-009` — `AOM-ARCH-001` labels every claim and records unmet targets as unmet |
| **AI Interpretation** | Never upgrade a status label without adding evidence. Never treat `PLANNED` as callable. This is the highest-frequency cause of agent-generated defects in specification-heavy repositories. |

### TBL-VIS-022: Family A Problems — Compact Register

| ID | Problem | Actor | Priority | Status |
| :--- | :--- | :--- | :---: | :--- |
| `PROB-VIS-001` | Knowledge decay | Architect, maintainer, agent | CRITICAL | `PARTIALLY IMPLEMENTED` |
| `PROB-VIS-002` | Agent context starvation | Agent, orchestrator | CRITICAL | `PARTIALLY IMPLEMENTED` |
| `PROB-VIS-003` | Undocumented decisions | Architect, maintainer | CRITICAL | `IMPLEMENTED` |
| `PROB-VIS-004` | Architectural drift | All | CRITICAL | `DOCUMENTED` |
| `PROB-VIS-005` | Onboarding cost | Maintainer, agent, contributor | HIGH | `PARTIALLY IMPLEMENTED` |
| `PROB-VIS-006` | Status dishonesty | All | CRITICAL | `IMPLEMENTED` |
| `PROB-VIS-007` | Identifier instability — references rot as things are renamed | All | HIGH | `IMPLEMENTED` |
| `PROB-VIS-008` | Review capacity as the hidden bottleneck on agent throughput | Reviewer | HIGH | `DOCUMENTED` |
| `PROB-VIS-009` | Vendor and model lock-in — method dies with the tool | Architect | MEDIUM | `DOCUMENTED` |
| `PROB-VIS-010` | Untraceable work — code exists that no one can justify | All | HIGH | `DOCUMENTED` |
| `PROB-VIS-011` | Scope creep with no explicit non-goals | Product, architect | HIGH | `IMPLEMENTED` |
| `PROB-VIS-012` | Context window exhaustion on large specifications | Agent | HIGH | `PARTIALLY IMPLEMENTED` |
| `PROB-VIS-013` | Session discontinuity — an agent loses its place mid-task | Agent | HIGH | `IMPLEMENTED` |
| `PROB-VIS-014` | Ambiguity tolerance — agents resolve ambiguity by guessing | Agent | CRITICAL | `DOCUMENTED` |
| `PROB-VIS-015` | Unverifiable claims — assertions with no inspectable evidence | All | CRITICAL | `IMPLEMENTED` |
| `PROB-VIS-016` | Fragmented ownership — no single accountable party per artifact | Maintainer | MEDIUM | `IMPLEMENTED` |
| `PROB-VIS-017` | Governance without enforcement — rules exist but nothing checks them | All | HIGH | `PARTIALLY IMPLEMENTED` |

> **Note on `PROB-VIS-017`.** This is the most uncomfortable entry in the register and deserves
> emphasis rather than burial. Oship has extensive rules and almost no automated enforcement:
> `.github/workflow-skeletons/` contains CI, security-scan, and documentation workflows, but they
> are **not installed** in `.github/workflows/` (`EVD-VIS-017`). Every rule in this document is
> currently enforced by discipline alone. That is a real and present weakness, not a temporary
> detail.

### 01.4.3 Family B — Domain Problems

These are catalogued so the eventual runtime has a justified purpose. **None is under active
mitigation.**

### TBL-VIS-023: Family B Problems — Money Factory Domain

| ID | Problem | Affected Actor | Root Cause | Oship Response | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PROB-VIS-018` | Enterprise financial workloads require processing that is simultaneously fast, correct, and auditable | `ACT-VIS-009` end user, `ACT-VIS-010` external system | Speed, correctness and auditability trade against each other under naive design | `CAP-VIS-062` Financial Factory domain | `PLANNED` |
| `PROB-VIS-019` | Multi-tenant data must be isolated with no reliance on caller-supplied scope | `ACT-VIS-009`, `ACT-VIS-004` | Tenant scope supplied by callers is forgeable | `CAP-VIS-061` Core Platform, `SEC-ARCH-014` in `AOM-ARCH-001` | `PLANNED` |
| `PROB-VIS-020` | Money movement must be reconstructable years later for audit | `ACT-VIS-008` auditor | Mutable state destroys history | Immutable ledger and evidence store, `CMP-ARCH-015` | `PLANNED` |
| `PROB-VIS-021` | Settlement must be correct under partial failure and retry | `ACT-VIS-009`, `ACT-VIS-010` | Distributed systems fail partially; naive retries double-spend | Idempotency and outbox pattern, `AOM-ARCH-001` §01.12 | `PLANNED` |
| `PROB-VIS-022` | Operators need to know the system is healthy before users tell them | `ACT-VIS-004` operator | No telemetry exists by default | `CAP-VIS-063` Observability domain | `PLANNED` |
| `PROB-VIS-023` | Regulatory obligations vary by jurisdiction and change over time | `ACT-VIS-008`, `ACT-VIS-007` | Compliance encoded in code cannot adapt | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` — no compliance framework selected | `UNKNOWN` |

> **`VIS-030`.** `PROB-VIS-023` is deliberately left `UNKNOWN` rather than filled with a plausible
> guess. No regulatory framework, jurisdiction, or compliance regime is named anywhere in the
> repository. Inventing one would violate the no-fabrication rule and would mislead every later
> reader about a legally consequential matter.

```mermaid
flowchart LR
    subgraph SEV["Problem severity vs. current mitigation"]
        direction TB
        P2["PROB-VIS-002 Context starvation - CRITICAL - partially mitigated"]
        P6["PROB-VIS-006 Status dishonesty - CRITICAL - mitigated"]
        P4["PROB-VIS-004 Drift - CRITICAL - documented only"]
        P17["PROB-VIS-017 No enforcement - HIGH - the gap behind all others"]
        P23["PROB-VIS-023 Regulatory - UNKNOWN - not investigated"]
    end
    P17 -->|"weakens"| P4
    P17 -->|"weakens"| P6
    P4 -->|"eventually causes"| P2
    P23 -->|"blocks"| FB["All Family B work"]
```

> **Diagram ID:** `DGM-VIS-010`
> **Explanation:** The dependency structure between the most severe problems. `PROB-VIS-017` — the
> absence of automated enforcement — is the load-bearing weakness: it undermines drift prevention
> and status honesty simultaneously. Installing the CI workflow skeletons is therefore the single
> highest-leverage mitigation available, and it is recorded as `OUT-VIS-004`.

---

## 01.5 — Users and Actors

### AI NAVIGATION METADATA — §01.5

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.4 Problem Space |
| **AI INPUTS** | A capability proposal needing an actor |
| **AI OUTPUTS** | The `ACT-VIS-` identifier served, or a rejection for serving no actor |
| **AI IMPLEMENTATION IMPACT** | Determines interface design, authorization model, and observability requirements |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-037`…`VAL-VIS-046` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/03_USERS/INDEX.md`, `AOM-ARCH-001` §01.6 |

### 01.5.1 Actor Classification Rule

> **`VIS-031`.** An actor is listed only if repository evidence supports its existence or its
> explicit planning. Actors invented for narrative completeness are prohibited — they generate
> requirements for users who do not exist, which is a direct route to wasted implementation.

Actors are divided by **evidentiary status**, not by importance.

### TBL-VIS-024: Actor Register

| ID | Actor | Class | Present today? | Evidence | Status |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `ACT-VIS-001` | Lead Architect | Human | **Yes** | `EVD-VIS-018` CODEOWNERS, ADR authorship | `IMPLEMENTED` |
| `ACT-VIS-002` | Repository Maintainer | Human | **Yes** | `EVD-VIS-018` — sole owner `@afshin-omnisystem` | `IMPLEMENTED` |
| `ACT-VIS-003` | Contributor | Human | **Yes** | `.github/` PR and issue templates | `IMPLEMENTED` |
| `ACT-VIS-004` | Operator / SRE | Human | No | `monitoring/`, `observability/` empty (`EVD-VIS-015`) | `PLANNED` |
| `ACT-VIS-005` | Autonomous Coding Agent | Machine | **Yes** | `EVD-VIS-004` `.ai/` control plane, operating manual | `IMPLEMENTED` |
| `ACT-VIS-006` | Agent Orchestrator | Machine | No | No orchestration code exists | `PLANNED` |
| `ACT-VIS-007` | Security Reviewer | Human | Partially | `security/` is `.gitkeep` only; `docs/security/SECURITY_ARCHITECTURE.md` exists | `PARTIALLY IMPLEMENTED` |
| `ACT-VIS-008` | Auditor | Human | No | No audit trail implementation | `PLANNED` |
| `ACT-VIS-009` | End User | Human | No | No application exists (`EVD-VIS-011`) | `PLANNED` |
| `ACT-VIS-010` | External System | Machine | No | No APIs exist (`EVD-VIS-012`) | `PLANNED` |
| `ACT-VIS-011` | CI/CD Automation | Machine | Partially | Skeletons not installed (`EVD-VIS-017`) | `PARTIALLY IMPLEMENTED` |
| `ACT-VIS-012` | Tenant Administrator | Human | No | No tenancy implementation | `PLANNED` |
| `ACT-VIS-013` | Plugin Author | Human | No | `plugins/` is `.gitkeep` only | `PROPOSED` |
| `ACT-VIS-014` | Data Analyst | Human | No | No data platform | `PROPOSED` |
| `ACT-VIS-015` | Model Provider | External service | No | No provider selected (`EVD-VIS-019`) | `PLANNED` |
| `ACT-VIS-016` | Architecture Board | Human body | Ambiguous | Referenced in `MASTER_CONTEXT_RULES.md`; membership undefined | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` |

> **Note on `ACT-VIS-016`.** `MASTER_CONTEXT_RULES.md` assigns domain-registration authority to an
> "Architecture Board", but no document defines its membership, quorum, or convening procedure.
> With `CODEOWNERS` mapping every path to one person (`EVD-VIS-018`), the Architecture Board is in
> practice a single individual. This gap is recorded as `CON-VIS-011` and is a genuine governance
> risk: a one-person board has no mechanism for disagreement.

```mermaid
flowchart TB
    subgraph PRESENT["Actors present today"]
        A1["ACT-VIS-001 Architect"]
        A2["ACT-VIS-002 Maintainer"]
        A3["ACT-VIS-003 Contributor"]
        A5["ACT-VIS-005 Autonomous agent"]
    end
    subgraph PARTIAL["Partially present"]
        A7["ACT-VIS-007 Security reviewer"]
        A11["ACT-VIS-011 CI automation"]
    end
    subgraph FUTURE["Planned - no runtime yet"]
        A4["ACT-VIS-004 Operator"]
        A8["ACT-VIS-008 Auditor"]
        A9["ACT-VIS-009 End user"]
        A10["ACT-VIS-010 External system"]
        A12["ACT-VIS-012 Tenant admin"]
    end
    subgraph EXTERNAL["External"]
        A15["ACT-VIS-015 Model provider"]
    end

    A1 -->|"authors specification"| REPO["Oship repository"]
    A2 -->|"approves and merges"| REPO
    A3 -->|"proposes changes"| REPO
    A5 -->|"reads, implements, validates"| REPO
    A5 <-->|"inference requests"| A15
    A11 -->|"would validate - not installed"| REPO
    A7 -->|"reviews security posture"| REPO
    REPO -.->|"will produce runtime"| RT["Oship runtime - PLANNED"]
    A9 -.-> RT
    A10 -.-> RT
    A4 -.-> RT
    A8 -.-> RT
    A12 -.-> RT
```

> **Diagram ID:** `DGM-VIS-011` — **Actor Map**
> **Explanation:** Who touches Oship today versus who will. Solid edges are real interactions;
> dashed edges are `PLANNED`. The striking feature is how few actors are real: four humans and one
> agent class, all interacting with a repository rather than a running system. Every requirement
> derived for a dashed-edge actor is speculative and must be labelled as such.

### 01.5.2 Actor Responsibility Matrix

### TBL-VIS-025: Actor Responsibility Matrix

Legend: **R** responsible · **A** accountable · **C** consulted · **I** informed · **—** not involved

| Activity | Architect | Maintainer | Contributor | Agent | Security | CI |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Define vision | **A** | C | I | — | C | — |
| Author specification | **R** | C | C | **R** | C | — |
| Approve ADR | **A** | R | C | — | C | — |
| Write implementation | C | C | R | **R** | — | — |
| Review implementation | C | **A** | C | C | R | R |
| Merge to main | — | **A** | — | — | C | R |
| Release | — | **A** | — | — | C | R |
| Validate specification | C | C | — | **R** | — | **R** |
| Detect drift | C | C | — | R | — | **A** |
| Escalate ambiguity | C | **A** | R | **R** | C | — |
| Grant security exception | C | R | — | — | **A** | — |
| Allocate identifiers | **A** | C | — | R | — | — |

> **`VIS-032`.** The **A** column is never assigned to an agent. Accountability is a human property
> because it requires the capacity to bear consequence. An agent may be **R** — responsible for
> doing the work — but a human is always **A** for the outcome. This mirrors `AI-ARCH-041` in
> `AOM-ARCH-001` and is non-negotiable.

### 01.5.3 Actor Journeys

```mermaid
journey
    title Autonomous agent journey - implementing a specified capability
    section Orientation
      Read .ai CURRENT_CONTEXT: 4: Agent
      Read .ai NEXT_ACTION: 5: Agent
      Route via CONTEXT_ROUTER: 4: Agent
    section Context loading
      Read SYSTEM_VISION for why: 5: Agent
      Read SYSTEM_ARCHITECTURE for how: 5: Agent
      Read domain INDEX for scope: 4: Agent
    section Verification
      Confirm status labels: 3: Agent
      Confirm evidence exists: 3: Agent
      Detect contradictions: 2: Agent
    section Execution
      Implement against contract: 4: Agent
      Run validators: 4: Agent
      Record assumptions: 3: Agent
    section Handoff
      Update control plane: 4: Agent
      Submit for human review: 3: Agent, Maintainer
      Await approval: 2: Agent
```

> **Diagram ID:** `DGM-VIS-012` — **AI Actor Journey**
> **Explanation:** The journey an agent takes on every task, with satisfaction scores reflecting
> where friction concentrates. The low scores in *Verification* and *Handoff* are honest: detecting
> contradictions is difficult without automated validation (`PROB-VIS-017`), and awaiting human
> approval is the throughput bottleneck (`PROB-VIS-008`). These are the two segments where
> investment yields the most.

```mermaid
journey
    title Human architect journey - introducing a new capability
    section Problem framing
      Identify the problem: 5: Architect
      Check the problem register: 4: Architect
      Confirm no non-goal is violated: 4: Architect
    section Specification
      Allocate a CAP-VIS identifier: 5: Architect
      Define inputs and outputs: 4: Architect
      Assign an owning domain: 4: Architect
    section Decision
      Draft an ADR: 3: Architect
      Seek approval: 2: Architect, Board
      Record in the decision log: 4: Architect
    section Delegation
      Hand to an agent: 5: Architect, Agent
      Review the result: 3: Architect
      Merge: 4: Architect
```

> **Diagram ID:** `DGM-VIS-013`
> **Explanation:** The human counterpart journey. The lowest score is *Seek approval*, which with a
> single-person Architecture Board (`ACT-VIS-016`, `CON-VIS-011`) is either instantaneous or
> impossible depending on whether that person is available — a structural fragility worth naming.

### 01.5.4 The AI Actor Model

Agents are not a single undifferentiated class. Oship distinguishes them by autonomy, because
autonomy determines the approval boundary.

### TBL-VIS-026: AI Actor Autonomy Classes

| Class | Description | May do without approval | Requires human approval | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A0 — Reader** | Answers questions from repository content | All reads | Any write | `IMPLEMENTED` |
| **A1 — Author** | Drafts specifications and code | Create branch, write files, run validators | Merge, release | `IMPLEMENTED` |
| **A2 — Executor** | Runs multi-step tasks with tools | Everything in A1 plus tool invocation in a sandbox | Any state change outside the sandbox | `PARTIALLY IMPLEMENTED` |
| **A3 — Operator** | Acts on running systems | Nothing — every action is approved | All | `PROPOSED` — no runtime exists |
| **A4 — Autonomous** | Self-directs work selection | Not permitted in Oship | N/A | `PROHIBITED` — see `NG-VIS-013` |

> **`VIS-033`.** Class **A4** is explicitly prohibited. An agent that selects its own objectives has
> no accountable human for the outcome, which violates `VIS-032`. This prohibition is a
> **permanent** property of Oship's operating model, not a temporary caution pending better models.

---

## 01.6 — Value Model

### AI NAVIGATION METADATA — §01.6

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.4 Problem Space, §01.5 Users and Actors |
| **AI INPUTS** | A proposed capability with a named problem and actor |
| **AI OUTPUTS** | The value chain the capability participates in, or a rejection |
| **AI IMPLEMENTATION IMPACT** | Determines prioritisation order and what must be measured |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-047`…`VAL-VIS-056` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md`, §01.12 Success Model |

### 01.6.1 What "Value" Means Here

> **`VIS-034`.** Value in Oship is defined as **a measurable reduction in the cost or risk of
> producing correct enterprise software**, or **a measurable increase in the volume of correct
> software produced per unit of human attention**. Value claims that cannot be expressed in one of
> those two forms are not value claims; they are marketing.

This definition is deliberately narrow. It excludes several things commonly asserted as value:

| Excluded claim | Why it is excluded |
| :--- | :--- |
| "Improves developer experience" | Unmeasurable as stated; restate as reduced time-to-first-correct-change |
| "Modern architecture" | Describes a property, not a benefit to any actor |
| "AI-powered" | Describes a mechanism, not an outcome |
| "Best practices" | Appeals to authority; state the practice and its measured effect |
| "Scalable" | Meaningless without naming the dimension and the limit |

> **Table ID:** `TBL-VIS-027` — **Rejected Value Claim Forms**

### 01.6.2 The Value Chain

```mermaid
flowchart LR
    I1["Human intent - a problem worth solving"] --> S1["Specification - written, identified, evidenced"]
    S1 --> C1["Context - loadable by an agent without a human present"]
    C1 --> E1["Execution - agent produces an implementation"]
    E1 --> V1["Validation - automated checks against the specification"]
    V1 --> R1["Review - human accountability applied"]
    R1 --> D1["Delivery - merged, released, observable"]
    D1 --> F1["Feedback - evidence returned to the specification"]
    F1 -->|"closes the loop"| S1

    S1 -.->|"if specification is vague"| X1["Agent guesses - defect injected"]
    C1 -.->|"if context is scattered"| X2["Agent stalls or fabricates"]
    V1 -.->|"if validation is absent"| X3["Drift accumulates silently"]
    R1 -.->|"if review is the bottleneck"| X4["Throughput capped by human hours"]
```

> **Diagram ID:** `DGM-VIS-014` — **The Oship Value Chain**
> **Explanation:** Value flows left to right through eight stages, and the loop closes when
> delivery evidence updates the specification. The dashed branches are the failure modes at each
> stage — each corresponds to a catalogued problem. The chain is only as strong as its weakest
> stage, and today the weakest is *Validation* (`PROB-VIS-017`: no installed CI).

### TBL-VIS-028: Value Chain Stages

| ID | Stage | Input | Output | Owner | Current maturity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VAL-CHAIN-VIS-001` | Intent | A named problem | An accepted objective | `ACT-VIS-001` | `IMPLEMENTED` |
| `VAL-CHAIN-VIS-002` | Specification | Objective | Identified, evidenced spec text | `ACT-VIS-001`, `ACT-VIS-005` | `IMPLEMENTED` |
| `VAL-CHAIN-VIS-003` | Context assembly | Spec text | A loadable context bundle | `ACT-VIS-005` | `PARTIALLY IMPLEMENTED` |
| `VAL-CHAIN-VIS-004` | Execution | Context bundle | Candidate implementation | `ACT-VIS-005` | `PARTIALLY IMPLEMENTED` |
| `VAL-CHAIN-VIS-005` | Validation | Candidate | Pass or fail with reasons | `ACT-VIS-011` | `PLANNED` |
| `VAL-CHAIN-VIS-006` | Review | Validated candidate | Approved or rejected change | `ACT-VIS-002` | `IMPLEMENTED` |
| `VAL-CHAIN-VIS-007` | Delivery | Approved change | Merged and released artifact | `ACT-VIS-002`, `ACT-VIS-011` | `PARTIALLY IMPLEMENTED` |
| `VAL-CHAIN-VIS-008` | Feedback | Runtime and review evidence | Updated specification | `ACT-VIS-005` | `PLANNED` |
| `VAL-CHAIN-VIS-009` | Knowledge retention | All of the above | Durable, navigable knowledge | `ACT-VIS-001` | `PARTIALLY IMPLEMENTED` |
| `VAL-CHAIN-VIS-010` | Drift correction | Divergence signal | Corrected spec or code | `ACT-VIS-002` | `PLANNED` |
| `VAL-CHAIN-VIS-011` | Decision capture | A consequential choice | An immutable ADR | `ACT-VIS-001` | `IMPLEMENTED` |
| `VAL-CHAIN-VIS-012` | Onboarding | A new actor | A productive actor | `ACT-VIS-005` | `PARTIALLY IMPLEMENTED` |

> **`VIS-035`.** Exactly four of twelve stages are `IMPLEMENTED`. Five are partial and three are
> planned. The chain therefore **cannot yet deliver its claimed value end to end**, and any
> statement that it does is false. The honest current claim is: Oship has built the front half of
> its value chain — intent through execution — and has not built the back half.

### 01.6.3 Value Flow by Actor

```mermaid
flowchart TB
    subgraph SRC["Value produced"]
        K["Durable knowledge"]
        N["Deterministic navigation"]
        D["Recorded decisions"]
        E["Evidence discipline"]
    end
    subgraph CONS["Value consumed"]
        AG["ACT-VIS-005 Agent - implements without asking"]
        AR["ACT-VIS-001 Architect - stops re-explaining"]
        MA["ACT-VIS-002 Maintainer - reviews faster"]
        CO["ACT-VIS-003 Contributor - onboards alone"]
    end
    K --> AG
    K --> CO
    N --> AG
    N --> CO
    D --> AR
    D --> MA
    E --> MA
    E --> AG
    AG -->|"returns implementations"| SRC
    MA -->|"returns approvals and corrections"| SRC
```

> **Diagram ID:** `DGM-VIS-015` — **Value Flow**
> **Explanation:** Value is produced by four assets and consumed by four actor classes, with two
> return flows that regenerate the assets. The agent both consumes the most value and returns the
> most — which is why agent tractability (`VIS-011`) is the primary purpose rather than a feature.

### TBL-VIS-029: Value Matrix — Asset Against Actor

Cell values: **H** high value · **M** moderate · **L** low · **—** none

| Asset | Architect | Maintainer | Contributor | Agent | Operator | End user |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Durable knowledge (`CAP-VIS-002`) | H | H | H | **H** | M | — |
| Deterministic navigation (`CAP-VIS-007`) | M | M | H | **H** | L | — |
| Immutable decisions (`CAP-VIS-006`) | **H** | H | M | H | L | — |
| Evidence discipline (`VIS-004`) | H | **H** | M | **H** | M | L |
| Explicit non-goals (§01.11) | **H** | H | M | H | — | — |
| Status vocabulary (`TBL-VIS-003`) | M | H | M | **H** | M | — |
| Architecture spec (`AOM-ARCH-001`) | **H** | H | H | **H** | M | — |
| Runtime capability | — | — | — | — | **H** | **H** |

> **`VIS-036`.** The bottom row is empty for every actor except operator and end user, and those
> two actors do not yet exist (`ACT-VIS-004`, `ACT-VIS-009` are `PLANNED`). Oship currently
> delivers value **exclusively to its own producers**. This is defensible for a foundation phase
> and indefensible as a permanent state; §01.13 records the outcome that must end it.

### 01.6.4 Value Realisation Timing

```mermaid
flowchart LR
    P0["Phase 0 - Foundation - CURRENT"] -->|"value to producers only"| P1["Phase 1 - First runtime slice"]
    P1 -->|"value to operators"| P2["Phase 2 - Domain capability"]
    P2 -->|"value to end users"| P3["Phase 3 - Scale and multi-tenancy"]
    P3 -->|"value compounds"| P4["Phase 4 - Ecosystem"]
    P0 -.->|"risk - never leaving"| STALL["Permanent specification without product"]
```

> **Diagram ID:** `DGM-VIS-016`
> **Explanation:** Value reaches successively wider audiences as phases advance. The dashed branch
> is the dominant strategic risk of a knowledge-first method: producing an exquisite specification
> that never becomes a system. That risk is named `FAL-VIS-001` and its detection signal is
> recorded in §01.25.

---

## 01.7 — System Capabilities

### AI NAVIGATION METADATA — §01.7

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this is the capability contract** |
| **AI DEPENDENCIES** | §01.4, §01.5, §01.6 |
| **AI INPUTS** | A capability identifier, or a request to add one |
| **AI OUTPUTS** | The capability's full contract, or a new `CAP-VIS-` allocation |
| **AI IMPLEMENTATION IMPACT** | **Direct.** Capabilities become architectural components in `AOM-ARCH-001` |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-057`…`VAL-VIS-078` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.7 components, §01.8 capability hierarchy |

### 01.7.1 Capability Definition Rule

> **`VIS-037`.** A capability is **a durable ability of the system to produce a defined outcome for
> a defined actor**. It is not a feature, a component, or a technology. Capabilities are stable
> across implementations; components are not. If renaming your database would change the
> capability's definition, you have written a component, not a capability.

Every capability entry carries eleven mandatory fields. An entry missing any field is invalid and
must be rejected by `VAL-VIS-057`.

### TBL-VIS-030: Mandatory Capability Fields

| # | Field | Purpose | Missing-value rule |
| :---: | :--- | :--- | :--- |
| 1 | ID | Stable reference | Never omit; never reuse |
| 2 | Name | Human-readable handle | Never omit |
| 3 | Purpose | Why it exists, one sentence | Never omit |
| 4 | Actor | Who it serves (`ACT-VIS-`) | If none, the capability is unjustified |
| 5 | Inputs | What it consumes | Write `NONE` if genuinely none |
| 6 | Outputs | What it produces | Never `NONE`; a capability with no output is not one |
| 7 | Dependencies | Other capabilities required | Write `NONE` for root capabilities |
| 8 | Business value | Which value chain stage it serves | Never omit |
| 9 | Technical value | What it makes possible technically | Never omit |
| 10 | Status | From `TBL-VIS-003` | Never omit; never inflate |
| 11 | Architectural impact | Which `AOM-ARCH-001` element it maps to | Write `UNMAPPED` if none exists yet |

Additionally, every capability carries an **AI impact** note describing how an agent should treat
it — this is the field that makes the register executable rather than descriptive.

### 01.7.2 Capability Group 1 — Knowledge and Context (`CAP-VIS-001`…`CAP-VIS-012`)

These are the capabilities Oship actually has today. They are described in full detail because they
are the only ones an agent can rely on.

### TBL-VIS-031: `CAP-VIS-001` — AI Control Plane

| Field | Value |
| :--- | :--- |
| **ID** | `CAP-VIS-001` |
| **Name** | AI Control Plane |
| **Purpose** | Give an agent a single, authoritative place to learn the current state of work and what to do next |
| **Actor** | `ACT-VIS-005`, `ACT-VIS-006` |
| **Inputs** | Completed work events; human direction |
| **Outputs** | `PROJECT_STATUS.md`, `CURRENT_CONTEXT.md`, `NEXT_ACTION.md`, `SESSION_MEMORY.md` |
| **Dependencies** | `NONE` — root capability |
| **Business value** | `VAL-CHAIN-VIS-003` context assembly; removes the human from the orientation loop |
| **Technical value** | Makes agent behaviour reproducible across sessions and models |
| **Status** | `IMPLEMENTED` |
| **Architectural impact** | `CMP-ARCH-001` in `AOM-ARCH-001`; layer `LYR-ARCH-001` |
| **Evidence** | `EVD-VIS-004` |
| **AI impact** | **Read this first, always.** If `NEXT_ACTION.md` contradicts your instructions, the human instruction wins but the contradiction must be reported. Update all three status files before ending any unit of work. |

### TBL-VIS-032: `CAP-VIS-002` — Knowledge Graph

| Field | Value |
| :--- | :--- |
| **ID** | `CAP-VIS-002` |
| **Name** | Master Context Knowledge Graph |
| **Purpose** | Hold all durable system knowledge in 24 addressable domains with defined relationships |
| **Actor** | All |
| **Inputs** | Specifications, decisions, standards |
| **Outputs** | Navigable, cross-referenced knowledge with stable anchors |
| **Dependencies** | `CAP-VIS-007` navigation, `CAP-VIS-004` metadata standard |
| **Business value** | `VAL-CHAIN-VIS-002`, `VAL-CHAIN-VIS-009` |
| **Technical value** | Every architectural claim has one canonical location, eliminating contradictory copies |
| **Status** | `PARTIALLY IMPLEMENTED` — all 24 domains registered with `INDEX.md`; most domain documents remain `PLANNED` |
| **Architectural impact** | `CMP-ARCH-002`; layer `LYR-ARCH-002` |
| **Evidence** | `EVD-VIS-006` |
| **AI impact** | Route through `docs/MASTER_CONTEXT/INDEX.md` §1003, never by filesystem guessing. A domain's `INDEX.md` is authoritative for what that domain owns. |

### TBL-VIS-033: `CAP-VIS-003` — Memory Constitution

| Field | Value |
| :--- | :--- |
| **ID** | `CAP-VIS-003` |
| **Name** | Memory System Constitution |
| **Purpose** | Define how knowledge is retained, retrieved, invalidated, and forgotten across sessions |
| **Actor** | `ACT-VIS-005`, `ACT-VIS-006` |
| **Inputs** | Session events, knowledge writes |
| **Outputs** | Retention rules, retrieval protocol, invalidation triggers |
| **Dependencies** | `CAP-VIS-002` |
| **Business value** | `VAL-CHAIN-VIS-009` |
| **Technical value** | Prevents unbounded context growth and stale-knowledge reuse |
| **Status** | `DOCUMENTED` — the constitution exists as specification; no runtime memory system is built |
| **Architectural impact** | `CMP-ARCH-003` |
| **Evidence** | `EVD-VIS-008` — `MASTER_CONTEXT_MEMORY_SYSTEM.md`, `RELEASED` status, 34,427 lines |
| **AI impact** | This is a **specification you follow manually**, not a service you call. Do not attempt to invoke a memory API; none exists. |

### TBL-VIS-034: `CAP-VIS-004`…`CAP-VIS-012` — Knowledge Capabilities, Compact Form

| ID | Name | Actor | Outputs | Status | Arch. impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-004` | Metadata standard | All | 15-key YAML frontmatter on every document | `IMPLEMENTED` | `CMP-ARCH-004` |
| `CAP-VIS-005` | Architecture specification | Architect, agent | `AOM-ARCH-001`, layers, domains, invariants | `PARTIALLY IMPLEMENTED` — Part 01 of a multi-part document | `CMP-ARCH-005` |
| `CAP-VIS-006` | Immutable decision record | Architect, maintainer | ADRs, `DECISION_LOG.md` | `IMPLEMENTED` | `CMP-ARCH-006` |
| `CAP-VIS-007` | Deterministic navigation | Agent, contributor | `CONTEXT_ROUTER.md`, index hierarchy, stable anchors | `IMPLEMENTED` | `CMP-ARCH-007` |
| `CAP-VIS-008` | Identifier allocation | Architect, agent | Namespaced, never-reused IDs | `IMPLEMENTED` | `CMP-ARCH-008` |
| `CAP-VIS-009` | Drift detection | Maintainer, CI | Divergence reports between spec and code | `PLANNED` | `UNMAPPED` |
| `CAP-VIS-010` | Evidence linking | All | Each claim bound to an inspectable artifact | `PARTIALLY IMPLEMENTED` — convention, not enforced | `UNMAPPED` |
| `CAP-VIS-011` | Continuation protocol | Agent | Resumable long-form authoring across context limits | `IMPLEMENTED` | `UNMAPPED` |
| `CAP-VIS-012` | Validation rule catalogue | Agent, CI | Machine-checkable `VAL-` rules per document | `PARTIALLY IMPLEMENTED` — rules written, checkers absent | `UNMAPPED` |

```mermaid
flowchart TB
    C8["CAP-VIS-008 Identifier allocation"] --> C4["CAP-VIS-004 Metadata standard"]
    C4 --> C2["CAP-VIS-002 Knowledge graph"]
    C7["CAP-VIS-007 Deterministic navigation"] --> C2
    C2 --> C5["CAP-VIS-005 Architecture specification"]
    C2 --> C3["CAP-VIS-003 Memory constitution"]
    C6["CAP-VIS-006 Immutable decisions"] --> C2
    C1["CAP-VIS-001 AI control plane"] --> C7
    C2 --> C10["CAP-VIS-010 Evidence linking"]
    C10 --> C12["CAP-VIS-012 Validation catalogue"]
    C12 --> C9["CAP-VIS-009 Drift detection - PLANNED"]
    C1 --> C11["CAP-VIS-011 Continuation protocol"]

    classDef done fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef part fill:#e65100,stroke:#ffcc80,color:#ffffff
    classDef plan fill:#37474f,stroke:#b0bec5,color:#ffffff
    class C1,C4,C6,C7,C8,C11 done
    class C2,C5,C10,C12 part
    class C3,C9 plan
```

> **Diagram ID:** `DGM-VIS-017` — **Knowledge Capability Dependency Graph**
> **Explanation:** Green is `IMPLEMENTED`, orange `PARTIALLY IMPLEMENTED`, grey `DOCUMENTED` or
> `PLANNED`. Identifier allocation is the deepest root — everything else references identifiers, so
> instability there propagates everywhere. Drift detection sits at the far end of the longest
> dependency chain, which explains why it is still unbuilt: it requires four upstream capabilities
> to be complete first.

### 01.7.3 Capability Group 2 — Governance (`CAP-VIS-013`…`CAP-VIS-024`)

### TBL-VIS-035: Governance Capabilities

| ID | Name | Purpose | Actor | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-013` | Ownership assignment | Every path has an accountable owner | Maintainer | `IMPLEMENTED` | `EVD-VIS-018` CODEOWNERS |
| `CAP-VIS-014` | Change proposal workflow | Structured PR and issue intake | Contributor | `IMPLEMENTED` | `.github/` templates |
| `CAP-VIS-015` | Domain registration | Controlled addition of knowledge domains | Architect | `IMPLEMENTED` | `MASTER_CONTEXT_RULES.md` PART 04 |
| `CAP-VIS-016` | Authority layering | L1–L5 knowledge layers with precedence | All | `IMPLEMENTED` | `PROJECT_PHILOSOPHY.md` §130 |
| `CAP-VIS-017` | Status vocabulary enforcement | Prevents aspirational claims | All | `PARTIALLY IMPLEMENTED` | Convention only |
| `CAP-VIS-018` | Exception handling | Recorded, time-bounded deviations | Architect | `PLANNED` | No exception register exists |
| `CAP-VIS-019` | Review gating | Nothing merges without human accountability | Maintainer | `PARTIALLY IMPLEMENTED` | Branch protection state `UNKNOWN` |
| `CAP-VIS-020` | Automated policy checks | CI enforcement of governance rules | CI | `PLANNED` | `EVD-VIS-017` skeletons not installed |
| `CAP-VIS-021` | Release governance | Controlled version and tag issuance | Maintainer | `PARTIALLY IMPLEMENTED` | Repo at `v0.1.0-alpha.0` |
| `CAP-VIS-022` | Security review process | Structured security assessment | Security reviewer | `DOCUMENTED` | `docs/security/` |
| `CAP-VIS-023` | Deprecation process | Orderly retirement of knowledge and code | Architect | `DOCUMENTED` | Status vocabulary includes `DEPRECATED` |
| `CAP-VIS-024` | Audit trail of governance acts | Who decided what, when, and why | Auditor | `PARTIALLY IMPLEMENTED` | Git history plus `DECISION_LOG.md` |

> **`VIS-038`.** Six of twelve governance capabilities depend on automation that does not exist.
> Oship's governance is currently **advisory**. An agent must not assume that a rule stated in this
> repository will be caught if violated — the agent itself is frequently the only enforcement
> mechanism present. Behave accordingly.

### 01.7.4 Capability Group 3 — Runtime and Domain (`CAP-VIS-025`…`CAP-VIS-070`)

> **`VIS-039`.** Every capability in this group is `PLANNED` or `PROPOSED`. **None is callable.**
> They are recorded so that architecture can be derived from them, not so that code can invoke
> them. An agent that generates a call into any of these capabilities has committed `FAL-VIS-004`.

### TBL-VIS-036: Platform Runtime Capabilities

| ID | Name | Purpose | Actor | Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-025` | Service runtime | Host executable services | Operator | Stack selection `UNKNOWN` | `PLANNED` |
| `CAP-VIS-026` | API surface | Expose contracts to external systems | External system | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-027` | Persistence | Durable, transactional state | End user | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-028` | Identity and access | Authenticate and authorise every call | All | `CAP-VIS-026` | `PLANNED` |
| `CAP-VIS-029` | Multi-tenancy | Isolate tenant data structurally | Tenant admin | `CAP-VIS-027`, `CAP-VIS-028` | `PLANNED` |
| `CAP-VIS-030` | Observability | Metrics, logs, traces, and alerting | Operator | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-031` | Configuration management | Environment-specific settings without rebuilds | Operator | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-032` | Secret management | Credentials never in source | Operator, security | `CAP-VIS-031` | `PLANNED` |
| `CAP-VIS-033` | Deployment automation | Reproducible promotion across environments | CI | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-034` | Event backbone | Asynchronous, ordered, replayable messaging | External system | `CAP-VIS-025` | `PLANNED` |
| `CAP-VIS-035` | Scheduling | Time- and event-triggered work | Operator | `CAP-VIS-034` | `PLANNED` |
| `CAP-VIS-036` | Rate limiting and quota | Protect the system from load | Operator | `CAP-VIS-026` | `PLANNED` |
| `CAP-VIS-037` | Plugin extension | Third-party capability injection | Plugin author | `CAP-VIS-025` | `PROPOSED` |
| `CAP-VIS-038` | Data export | Tenant-initiated retrieval of own data | Tenant admin | `CAP-VIS-027` | `PROPOSED` |
| `CAP-VIS-039` | Backup and restore | Recoverability from data loss | Operator | `CAP-VIS-027` | `PLANNED` |
| `CAP-VIS-040` | Disaster recovery | Defined RPO and RTO under region loss | Operator | `CAP-VIS-039` | `PROPOSED` |

### TBL-VIS-037: Money Factory Domain Capabilities

| ID | Name | Purpose | Actor | Status | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-041` | Transaction ingestion | Accept financial workload items | External system | `PLANNED` | Domain per `EVD-VIS-021` |
| `CAP-VIS-042` | Transaction processing | Apply domain rules to each item | End user | `PLANNED` | The "factory" in Money Factory |
| `CAP-VIS-043` | Ledger | Immutable double-entry record | Auditor | `PLANNED` | Required by `PROB-VIS-020` |
| `CAP-VIS-044` | Settlement | Finalise value movement exactly once | End user | `PLANNED` | Required by `PROB-VIS-021` |
| `CAP-VIS-045` | Reconciliation | Detect and resolve divergence between records | Auditor | `PLANNED` | — |
| `CAP-VIS-046` | Reporting | Aggregate views over ledger state | Data analyst | `PROPOSED` | — |
| `CAP-VIS-047` | Compliance controls | Enforce jurisdictional obligations | Auditor | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | No regime named; see `PROB-VIS-023` |
| `CAP-VIS-048` | Fraud signalling | Flag anomalous activity | Security reviewer | `PROPOSED` | — |

### TBL-VIS-038: AI Runtime Capabilities

| ID | Name | Purpose | Actor | Status | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-049` | Model invocation | Call an inference provider | Agent | `PLANNED` | No provider selected (`EVD-VIS-019`) |
| `CAP-VIS-050` | Prompt and context assembly | Build a task context from the knowledge graph | Agent | `PARTIALLY IMPLEMENTED` | Done manually today |
| `CAP-VIS-051` | Agent task orchestration | Sequence multi-step agent work | Orchestrator | `PLANNED` | — |
| `CAP-VIS-052` | Output validation | Check agent output against specification | CI | `PLANNED` | Blocked on `CAP-VIS-012` |
| `CAP-VIS-053` | Provider abstraction | Avoid single-vendor dependence | Architect | `PLANNED` | Mitigates `PROB-VIS-009` |
| `CAP-VIS-054` | Agent audit trail | Record what an agent did and why | Auditor | `PARTIALLY IMPLEMENTED` | Git history plus session memory |
| `CAP-VIS-055` | Cost and token governance | Bound inference spend | Maintainer | `PROPOSED` | — |
| `CAP-VIS-056` | Human approval gateway | Enforce the A0–A3 autonomy boundary | Maintainer | `PARTIALLY IMPLEMENTED` | Enforced socially, not technically |

### TBL-VIS-039: Bounded-Context Capabilities

| ID | Name | Bounded context | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `CAP-VIS-060` | Governance and AI context | `.ai/`, `.github/` | `IMPLEMENTED` as documentation | `EVD-VIS-020` |
| `CAP-VIS-061` | Core Platform context | Shared runtime services | `PLANNED` | `EVD-VIS-020` |
| `CAP-VIS-062` | Financial Factory context | Domain processing engine | `PLANNED` | `EVD-VIS-020` |
| `CAP-VIS-063` | Observability context | Telemetry and operations | `PLANNED` | `EVD-VIS-020` |
| `CAP-VIS-064` | Ecosystem context | Plugins, SDKs, external integrations | `PROPOSED` | `UNMAPPED` |
| `CAP-VIS-065` | Developer experience context | Tooling, templates, scaffolds | `PROPOSED` | `templates/` is empty |
| `CAP-VIS-066` | Knowledge context | The Master Context itself as a product | `PARTIALLY IMPLEMENTED` | `EVD-VIS-006` |
| `CAP-VIS-067` | Security context | Threat model, controls, response | `DOCUMENTED` | `docs/security/` |
| `CAP-VIS-068` | Data context | Schemas, lineage, retention | `PLANNED` | `database/` empty |
| `CAP-VIS-069` | Integration context | Inbound and outbound system contracts | `PLANNED` | `apis/` empty |
| `CAP-VIS-070` | Experimentation context | Research and prototypes, quarantined | `PROPOSED` | `research/`, `experiments/` empty |

```mermaid
flowchart TB
    subgraph REAL["Real today - 10 capabilities"]
        R1["Knowledge and governance capabilities"]
    end
    subgraph PARTIAL["Partial - 12 capabilities"]
        R2["Specified but incompletely realised"]
    end
    subgraph FUTURE["Planned or proposed - 48 capabilities"]
        R3["Runtime, domain, AI runtime, ecosystem"]
    end
    R1 -->|"enables specification of"| R2
    R2 -->|"enables derivation of"| R3
    R3 -.->|"must eventually justify"| R1
```

> **Diagram ID:** `DGM-VIS-018` — **Capability Reality Distribution**
> **Explanation:** The proportions matter more than the boxes. Roughly one capability in seven is
> real. The dashed return edge states the obligation that makes the whole structure honest: the
> planned capabilities must eventually justify the investment in the real ones. If they never
> arrive, the knowledge layer was overhead, not value.

---

## 01.8 — Capability Hierarchy

### AI NAVIGATION METADATA — §01.8

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.7 System Capabilities |
| **AI INPUTS** | A capability identifier |
| **AI OUTPUTS** | Its tier, parents, children, and blocking dependencies |
| **AI IMPLEMENTATION IMPACT** | Determines build order; a capability may not be built before its parents |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-079`…`VAL-VIS-088` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.5 layers |

### 01.8.1 The Five Capability Tiers

> **`VIS-040`.** Capabilities are organised into five tiers by **what they depend on**, not by
> importance. A tier-N capability may depend only on tiers 1 through N. A dependency that points
> upward is a structural defect and must be reported as `FAL-VIS-011`.

### TBL-VIS-040: Capability Tiers

| Tier | Name | Definition | Depends on | Example |
| :---: | :--- | :--- | :--- | :--- |
| **T1** | Foundational | Exists without any other capability | Nothing | `CAP-VIS-008` identifiers |
| **T2** | Structural | Organises foundational elements into a system of knowledge | T1 | `CAP-VIS-002` knowledge graph |
| **T3** | Operational | Applies structure to produce work | T1–T2 | `CAP-VIS-009` drift detection |
| **T4** | Platform | Executes software at runtime | T1–T3 | `CAP-VIS-025` service runtime |
| **T5** | Domain | Delivers end-user outcomes | T1–T4 | `CAP-VIS-044` settlement |

```mermaid
flowchart BT
    T1["T1 FOUNDATIONAL - identifiers, metadata, decisions"]
    T2["T2 STRUCTURAL - knowledge graph, navigation, architecture spec"]
    T3["T3 OPERATIONAL - validation, drift detection, governance enforcement"]
    T4["T4 PLATFORM - runtime, persistence, identity, observability"]
    T5["T5 DOMAIN - ingestion, processing, ledger, settlement"]
    T1 --> T2 --> T3 --> T4 --> T5

    N1["Reality today - complete"]:::ok
    N2["Reality today - mostly complete"]:::ok
    N3["Reality today - specified only"]:::warn
    N4["Reality today - nothing built"]:::bad
    N5["Reality today - nothing built"]:::bad
    T1 -.- N1
    T2 -.- N2
    T3 -.- N3
    T4 -.- N4
    T5 -.- N5

    classDef ok fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-019` — **Capability Tier Stack with Reality Annotation**
> **Explanation:** The stack is read bottom-up as a build order. The annotations on the right make
> the current position unambiguous: Oship is complete at T1, nearly complete at T2, specified at
> T3, and empty at T4 and T5. Any plan that proposes T5 work before T4 exists is invalid.

### 01.8.2 Hierarchy Assignments

### TBL-VIS-041: Tier Assignment of All Registered Capabilities

| Tier | Capabilities | Count | Aggregate status |
| :---: | :--- | :---: | :--- |
| T1 | `CAP-VIS-004`, `006`, `008`, `011`, `013`, `016` | 6 | All `IMPLEMENTED` |
| T2 | `CAP-VIS-001`, `002`, `003`, `005`, `007`, `010`, `014`, `015`, `066` | 9 | 5 implemented, 4 partial |
| T3 | `CAP-VIS-009`, `012`, `017`…`024`, `050`, `052`, `054`, `056`, `067` | 15 | 0 implemented, 6 partial, 9 planned |
| T4 | `CAP-VIS-025`…`040`, `049`, `051`, `053`, `055`, `060`…`065`, `068`…`070` | 28 | 1 implemented (`060`, as docs), rest planned or proposed |
| T5 | `CAP-VIS-041`…`048` | 8 | All planned, proposed, or unknown |

> **`VIS-041`.** The distribution is the clearest single statement of where Oship is: **complete at
> the bottom, empty at the top**. This is the intended shape for a knowledge-first method at
> Phase 0. It becomes pathological only if T4 remains empty indefinitely — see `FAL-VIS-001`.

### 01.8.3 Parent–Child Decomposition

```mermaid
flowchart TB
    ROOT["Oship system capability"]
    ROOT --> K["Knowledge capability"]
    ROOT --> G["Governance capability"]
    ROOT --> P["Platform capability"]
    ROOT --> D["Domain capability"]
    ROOT --> A["AI capability"]

    K --> K1["CAP-VIS-002 Knowledge graph"]
    K --> K2["CAP-VIS-007 Navigation"]
    K --> K3["CAP-VIS-003 Memory"]
    K1 --> K1a["24 domain indexes"]
    K1 --> K1b["Cross-reference relationships"]
    K2 --> K2a["Context router"]
    K2 --> K2b["Stable anchors"]

    G --> G1["CAP-VIS-006 Decisions"]
    G --> G2["CAP-VIS-013 Ownership"]
    G --> G3["CAP-VIS-019 Review gating"]

    P --> P1["CAP-VIS-025 Runtime"]
    P --> P2["CAP-VIS-027 Persistence"]
    P --> P3["CAP-VIS-030 Observability"]

    D --> D1["CAP-VIS-042 Processing"]
    D --> D2["CAP-VIS-043 Ledger"]
    D --> D3["CAP-VIS-044 Settlement"]

    A --> A1["CAP-VIS-050 Context assembly"]
    A --> A2["CAP-VIS-052 Output validation"]
    A --> A3["CAP-VIS-056 Approval gateway"]
```

> **Diagram ID:** `DGM-VIS-020` — **Capability Decomposition Tree**
> **Explanation:** Five branches from a single root, each decomposed two levels. The tree is
> deliberately shallow — deeper decomposition belongs in `AOM-ARCH-001`, where capabilities become
> components. A vision document that decomposes to implementation detail has overstepped its
> authority layer.

### TBL-VIS-042: Capability Blocking Chains

| Blocked capability | Blocked by | Nature of block | Unblocking action |
| :--- | :--- | :--- | :--- |
| `CAP-VIS-009` drift detection | `CAP-VIS-012`, `CAP-VIS-020` | No automated checker exists | Install CI skeletons (`OUT-VIS-004`) |
| `CAP-VIS-020` policy checks | `ACT-VIS-011` CI automation | Workflows not in `.github/workflows/` | Install and enable |
| `CAP-VIS-026` API surface | `CAP-VIS-025` runtime | Nothing to expose | Select a stack (`OUT-VIS-006`) |
| `CAP-VIS-029` multi-tenancy | `CAP-VIS-027`, `CAP-VIS-028` | No persistence or identity | Sequential |
| `CAP-VIS-042` processing | `CAP-VIS-061` core platform | No platform context exists | Sequential |
| `CAP-VIS-047` compliance | `PROB-VIS-023` | No regime identified | Investigate and record |
| `CAP-VIS-049` model invocation | `EVD-VIS-019` | No provider selected | Decide and record an ADR |
| `CAP-VIS-051` orchestration | `CAP-VIS-049`, `CAP-VIS-056` | No invocation or approval gate | Sequential |
| `CAP-VIS-056` approval gateway | `CAP-VIS-025` | Enforced socially today | Build once a runtime exists |
| `CAP-VIS-037` plugins | `CAP-VIS-025`, `CAP-VIS-069` | No runtime or integration contracts | Deferred to Phase 4 |

> **`VIS-042`.** Every blocking chain in `TBL-VIS-042` terminates in one of three roots: **install
> CI**, **select a stack**, or **investigate compliance**. Those three actions unblock the entire
> forward capability set, which makes them the highest-leverage decisions available to Oship. They
> are recorded as `OUT-VIS-004`, `OUT-VIS-006`, and `OUT-VIS-011`.

---

## 01.9 — System Boundaries

### AI NAVIGATION METADATA — §01.9

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — boundary violations are security defects** |
| **AI DEPENDENCIES** | §01.5, §01.7 |
| **AI INPUTS** | A proposed interaction between two elements |
| **AI OUTPUTS** | Whether the interaction crosses a boundary and what that requires |
| **AI IMPLEMENTATION IMPACT** | Determines trust, validation, and authorization requirements |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-089`…`VAL-VIS-100` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.9 trust boundaries `TB-1`…`TB-10` |

### 01.9.1 Boundary Taxonomy

> **`VIS-043`.** Oship recognises four boundary kinds. Confusing them is the source of most
> security and architectural error, because each kind implies a different obligation.

### TBL-VIS-043: Boundary Kinds

| Kind | Definition | Obligation when crossed | Example |
| :--- | :--- | :--- | :--- |
| **Scope boundary** | What Oship does versus does not do | Reject as out of scope, or amend §01.11 | Oship is not an IDE |
| **Trust boundary** | Where data changes trust level | Validate, authorise, log | External request enters a service |
| **Knowledge boundary** | What is known versus unknown | Label `UNKNOWN`; never fabricate | Technology stack |
| **Autonomy boundary** | What an agent may do unapproved | Halt and request human approval | Merging to main |

### TBL-VIS-044: System Boundary Register

| ID | Boundary | Kind | Inside | Outside | Crossing rule | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `BND-VIS-001` | Repository boundary | Scope | Everything in `afshin-omnisystem/Oship` | Any other repository | Cross-repo references must be versioned and explicit | `IMPLEMENTED` |
| `BND-VIS-002` | Knowledge authority boundary | Scope | `docs/MASTER_CONTEXT/` | All other documentation | Master Context wins on conflict | `IMPLEMENTED` |
| `BND-VIS-003` | Control-plane boundary | Autonomy | `.ai/` | Application content | Agents write `.ai/`; humans approve everything else | `IMPLEMENTED` |
| `BND-VIS-004` | Specification–implementation boundary | Scope | Documents | Code | Code must trace to a specification | `DOCUMENTED` |
| `BND-VIS-005` | Human approval boundary | Autonomy | Agent-proposed changes | Merged main | No merge without human accountability | `PARTIALLY IMPLEMENTED` |
| `BND-VIS-006` | Model provider boundary | Trust | Oship knowledge | External inference provider | Treat provider output as untrusted input | `PLANNED` |
| `BND-VIS-007` | Tenant boundary | Trust | One tenant's data | Every other tenant | Isolation enforced server-side, never by caller scope | `PLANNED` |
| `BND-VIS-008` | Public API boundary | Trust | Internal services | External callers | Authenticate, authorise, validate, rate-limit | `PLANNED` |
| `BND-VIS-009` | Environment boundary | Trust | Production | Non-production | No production data outside production | `PLANNED` |
| `BND-VIS-010` | Secret boundary | Trust | Secret store | Source, logs, and prompts | Secrets never enter source, logs, or model context | `PLANNED` |
| `BND-VIS-011` | Domain context boundary | Scope | One bounded context | Another | Cross-context via explicit contracts only | `DOCUMENTED` |
| `BND-VIS-012` | Evidence boundary | Knowledge | Verified claims | Unverified assertions | Unverified claims labelled `UNKNOWN` | `IMPLEMENTED` |
| `BND-VIS-013` | Time boundary | Knowledge | Present state | Future intent | Never write future intent in present tense | `IMPLEMENTED` |
| `BND-VIS-014` | Experimentation boundary | Scope | `research/`, `experiments/` | Production paths | Experimental code never imported by production | `PROPOSED` |
| `BND-VIS-015` | Plugin boundary | Trust | Oship core | Third-party plugins | Plugins run with least privilege | `PROPOSED` |
| `BND-VIS-016` | Regulatory boundary | Knowledge | Known obligations | Unknown obligations | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | `UNKNOWN` |

### 01.9.2 System Context

```mermaid
flowchart TB
    subgraph OSHIP["OSHIP SYSTEM - what exists today"]
        MC["Master Context knowledge graph"]
        AI[".ai control plane"]
        GH[".github governance"]
        ARCH["Architecture specification"]
    end

    subgraph HUMANS["Human actors"]
        H1["Architect"]
        H2["Maintainer"]
        H3["Contributor"]
    end

    subgraph MACHINES["Machine actors"]
        M1["Autonomous coding agent"]
        M2["CI automation - skeletons only"]
    end

    subgraph EXT["External systems"]
        E1["GitHub platform"]
        E2["Model provider - unselected"]
    end

    subgraph PLANNED["Planned runtime - does not exist"]
        R1["Services"]
        R2["Data stores"]
        R3["APIs"]
    end

    H1 -->|"authors"| MC
    H2 -->|"approves"| GH
    H3 -->|"proposes"| GH
    M1 -->|"reads and writes"| AI
    M1 -->|"reads"| MC
    M1 -->|"reads"| ARCH
    M1 <-.->|"BND-VIS-006 untrusted"| E2
    GH <-->|"hosted on"| E1
    M2 -.->|"would enforce"| GH
    MC -.->|"BND-VIS-004 will specify"| R1
    ARCH -.-> R2
    ARCH -.-> R3
```

> **Diagram ID:** `DGM-VIS-021` — **System Context Diagram**
> **Explanation:** The full external context. Note that Oship's only live external dependency today
> is the GitHub platform; the model provider edge is dashed because no provider has been selected
> (`EVD-VIS-019`), and the entire planned runtime subgraph is dashed. This is a system whose
> current surface area is a repository.

### 01.9.3 Trust Boundary Model

```mermaid
flowchart LR
    subgraph Z0["Zone 0 - Untrusted"]
        U1["External callers"]
        U2["Model provider output"]
        U3["Third-party plugins"]
    end
    subgraph Z1["Zone 1 - Semi-trusted"]
        S1["Authenticated tenants"]
        S2["CI automation"]
    end
    subgraph Z2["Zone 2 - Trusted"]
        T1["Internal services"]
        T2["Maintainers"]
    end
    subgraph Z3["Zone 3 - Highly trusted"]
        C1["Secret store"]
        C2["Ledger of record"]
    end

    U1 -->|"BND-VIS-008 authenticate, authorise, validate"| S1
    U2 -->|"BND-VIS-006 validate before use"| T1
    U3 -->|"BND-VIS-015 least privilege"| T1
    S1 -->|"BND-VIS-007 tenant isolation"| T1
    S2 -->|"scoped credentials"| T1
    T1 -->|"BND-VIS-010 broker access only"| C1
    T1 -->|"append only"| C2
    T2 -->|"BND-VIS-005 approval required"| T1
```

> **Diagram ID:** `DGM-VIS-022` — **Trust Zone Model**
> **Explanation:** Four trust zones with the crossing obligation labelled on every edge. The zone
> assignment of model-provider output is the entry most often violated in AI-native systems: an
> LLM response is Zone 0 data, exactly like a request from an anonymous internet caller, and must
> be validated before it influences state. This maps to `TB-4` in `AOM-ARCH-001`.

### 01.9.4 The AI Boundary

> **`VIS-044`.** The AI boundary is the line between **what an agent decides** and **what a human
> decides**. Oship places it at *consequence*: an agent may decide anything reversible without cost;
> a human must decide anything irreversible or costly.

### TBL-VIS-045: AI Boundary Decision Rules

| Action | Reversible? | Cost if wrong | Decider | Rationale |
| :--- | :---: | :--- | :--- | :--- |
| Read any repository file | Yes | None | Agent | No consequence |
| Create a branch | Yes | None | Agent | Discardable |
| Write specification text on a branch | Yes | Review time | Agent | Caught in review |
| Allocate a new identifier | **No** — IDs are never reused | Low | Agent, recorded | Allocation is append-only and safe |
| Change an existing identifier | **No** | High — breaks references | **Human** | Reference rot is unrecoverable |
| Merge to main | Partially | Moderate | **Human** | `BND-VIS-005` |
| Publish a release or tag | **No** | High | **Human** | Consumers depend on it |
| Approve an ADR | **No** | Very high | **Human** | ADRs are immutable once approved |
| Modify an approved ADR | Prohibited | Catastrophic to trust | **Nobody** | Supersede instead |
| Delete history | **No** | Catastrophic | **Nobody** | Prohibited outright |
| Select the technology stack | **No** | Very high | **Human** | Constrains everything downstream |
| Call an external paid service | Depends | Financial | **Human** | Spend requires accountability |

```mermaid
flowchart TD
    START["Agent proposes an action"] --> Q1{"Is it reversible with no residue?"}
    Q1 -->|"Yes"| Q2{"Does it change shared state?"}
    Q1 -->|"No"| Q3{"Does it break existing references or contracts?"}
    Q2 -->|"No"| ALLOW["Agent proceeds - record in session memory"]
    Q2 -->|"Yes"| REVIEW["Agent proceeds on a branch - human reviews"]
    Q3 -->|"Yes"| HUMAN["Human decision required - agent must halt"]
    Q3 -->|"No"| Q4{"Does it incur cost or external effect?"}
    Q4 -->|"Yes"| HUMAN
    Q4 -->|"No"| REVIEW
    HUMAN --> RECORD["Record the decision in an ADR or the decision log"]
```

> **Diagram ID:** `DGM-VIS-023` — **AI Boundary Decision Tree**
> **Explanation:** A four-question test any agent can execute mechanically. It resolves in at most
> four comparisons and never requires the agent to estimate importance — only reversibility,
> shared-state effect, reference breakage, and external cost, all of which are objectively
> checkable. This is `DEC-VIS-002`.

---

## 01.10 — Strategic Principles

### AI NAVIGATION METADATA — §01.10

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — principles resolve conflicts between all lower documents** |
| **AI DEPENDENCIES** | §01.2, §01.3 |
| **AI INPUTS** | A design conflict or ambiguous choice |
| **AI OUTPUTS** | The governing principle and the resulting decision |
| **AI IMPLEMENTATION IMPACT** | Every architectural choice must be defensible against these principles |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-101`…`VAL-VIS-112` |
| **AI RELATED DOCUMENTS** | `README.md` Ten Immutable Tenets, `AOM-ARCH-001` §01.4 |

### 01.10.1 Principle Format and Precedence

> **`VIS-045`.** Principles are **ordered**. When two principles conflict, the lower-numbered
> principle wins. This ordering is the single most important property of this section: an unordered
> principle list resolves no conflicts and is therefore decorative.

### TBL-VIS-046: Strategic Principle Register — Ordered by Precedence

| Rank | ID | Principle | Statement | Consequence when applied | Source |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `PRN-VIS-001` | **Truth over comfort** | A document states what is, not what is hoped | Unflattering gaps are written down explicitly | `VIS-004` |
| 2 | `PRN-VIS-002` | **Determinism over cleverness** | Given the same input, produce the same output | Reject non-reproducible generation | Tenet: Deterministic |
| 3 | `PRN-VIS-003` | **Explicit over implicit** | Unstated rules do not exist | Every constraint is written or is not enforced | `PROB-VIS-014` |
| 4 | `PRN-VIS-004` | **Traceable over expedient** | Every artifact links to its justification | Untraceable work is rejected regardless of quality | `PROB-VIS-010` |
| 5 | `PRN-VIS-005` | **Agent-tractable over human-elegant** | Optimise for the reader who cannot ask questions | Verbosity is preferred to allusion | `VIS-011` |
| 6 | `PRN-VIS-006` | **Immutable decisions** | Approved decisions are superseded, never edited | History remains auditable | `EVD-VIS-005` |
| 7 | `PRN-VIS-007` | **Stable identity** | Identifiers are permanent and never reused | References survive refactoring | `CAP-VIS-008` |
| 8 | `PRN-VIS-008` | **Human accountability** | A human is answerable for every consequential outcome | No unattended irreversible action | `VIS-032` |
| 9 | `PRN-VIS-009` | **Boundaries before features** | Define what something is not before extending it | Non-goals precede roadmaps | §01.11 |
| 10 | `PRN-VIS-010` | **Evidence before assertion** | A claim without an inspectable artifact is a hypothesis | `UNKNOWN` is an acceptable answer | `PROB-VIS-015` |
| 11 | `PRN-VIS-011` | **Visual before verbal** | Structure is shown before it is described | No concept exceeds roughly 120 lines unillustrated | Document standard |
| 12 | `PRN-VIS-012` | **Composition over inheritance of complexity** | Prefer small composable units to large configurable ones | Reject frameworks that demand total adoption | Tenet: Modular |
| 13 | `PRN-VIS-013` | **Reversibility preferred** | Choose the option that is cheaper to undo | Two-way doors are taken quickly; one-way doors slowly | `DGM-VIS-023` |
| 14 | `PRN-VIS-014` | **Cost of change is the metric** | Optimise for the second change, not the first | Accept slower initial delivery for lower drift | `VIS-034` |
| 15 | `PRN-VIS-015` | **Vendor independence** | No single provider may be structurally required | Abstract inference providers | `PROB-VIS-009` |
| 16 | `PRN-VIS-016` | **Least privilege by default** | Grant the minimum access that permits the work | Deny-by-default posture | `BND-VIS-015` |
| 17 | `PRN-VIS-017` | **Observability is not optional** | An unobservable system is an unmanageable one | Telemetry is designed in, not bolted on | `CAP-VIS-030` |
| 18 | `PRN-VIS-018` | **Small surfaces** | Fewer public contracts means fewer irreversible commitments | Internal by default | `PRN-VIS-013` |
| 19 | `PRN-VIS-019` | **Delete rather than accumulate** | Dead knowledge is a liability | Deprecate and remove explicitly | `CAP-VIS-023` |
| 20 | `PRN-VIS-020` | **Finish before starting** | Complete a part before opening the next | Append-only parts; no half-finished parallel work | Continuation protocol |

```mermaid
flowchart TD
    CONFLICT["Two valid options conflict"] --> P1{"Does one option state something untrue or unevidenced?"}
    P1 -->|"Yes"| REJ1["Reject it - PRN-VIS-001 and PRN-VIS-010"]
    P1 -->|"No"| P2{"Is one option non-deterministic?"}
    P2 -->|"Yes"| REJ2["Prefer the deterministic option - PRN-VIS-002"]
    P2 -->|"No"| P3{"Does one rely on an unstated rule?"}
    P3 -->|"Yes"| REJ3["Prefer the explicit option - PRN-VIS-003"]
    P3 -->|"No"| P4{"Can one option be traced to a problem and actor?"}
    P4 -->|"Only one"| REJ4["Prefer the traceable option - PRN-VIS-004"]
    P4 -->|"Both"| P5{"Which is easier for an agent to execute without asking?"}
    P5 --> REJ5["Prefer that one - PRN-VIS-005"]
    P5 -->|"Equal"| P6{"Which is cheaper to reverse?"}
    P6 --> REJ6["Prefer that one - PRN-VIS-013"]
    P6 -->|"Equal"| ESC["Escalate to a human - PRN-VIS-008"]
```

> **Diagram ID:** `DGM-VIS-024` — **Principle Conflict Resolution Tree**
> **Explanation:** This is the executable form of `PRN-VIS-001`…`PRN-VIS-005` plus `PRN-VIS-013`.
> An agent walks it top to bottom and either reaches a decision or escalates. Crucially, escalation
> is a legitimate terminal state — an agent that cannot resolve a conflict must stop, not invent a
> tiebreaker. This is `DEC-VIS-003`.

### 01.10.2 Principles Under Tension

> **`VIS-046`.** Principles are not mutually harmonious, and pretending otherwise is dishonest.
> The following tensions are real, permanent, and resolved by precedence rather than eliminated.

### TBL-VIS-047: Known Principle Tensions

| Tension | Principle A | Principle B | How it manifests | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| Verbosity vs. usability | `PRN-VIS-005` agent-tractable | Human reading time | 10,000-line documents humans will not read | A wins; humans use navigation, agents read fully |
| Rigour vs. speed | `PRN-VIS-004` traceable | Delivery pressure | Traceability slows the first delivery | A wins; `PRN-VIS-014` justifies it |
| Immutability vs. correction | `PRN-VIS-006` immutable | Fixing a mistake | A wrong ADR cannot be edited | A wins; supersede with a new ADR |
| Explicitness vs. duplication | `PRN-VIS-003` explicit | Single source of truth | Restating a rule locally risks divergence | Reference the canonical location; never copy |
| Vendor independence vs. capability | `PRN-VIS-015` | Best-in-class provider features | Abstraction forfeits provider-specific power | A wins at the architecture layer; deviations need an ADR |
| Completeness vs. shipping | `PRN-VIS-020` finish first | Parallel progress | Serialisation slows apparent throughput | A wins within a document; parallelism across documents |

---

## 01.11 — Non-Goals

### AI NAVIGATION METADATA — §01.11

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — read before proposing any capability** |
| **AI DEPENDENCIES** | §01.2, §01.7, §01.10 |
| **AI INPUTS** | A proposed feature, capability, or integration |
| **AI OUTPUTS** | Rejection with an `NG-VIS-` citation, or clearance to proceed |
| **AI IMPLEMENTATION IMPACT** | **Blocking.** Work matching a non-goal must not be built |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-113`…`VAL-VIS-122` |
| **AI RELATED DOCUMENTS** | §01.19 Strategic Constraints |

### 01.11.1 Why Non-Goals Come Before Roadmaps

> **`VIS-047`.** A system defined only by what it does has no defence against scope creep, because
> every proposed addition sounds reasonable in isolation. Non-goals are the immune system. They are
> stated **before** the roadmap deliberately: it is far easier to refuse a feature that was
> pre-refused than one that has acquired a sponsor.

> **`VIS-048`.** A non-goal is not permanent unless marked so. Each entry carries a **reversal
> condition** stating precisely what would have to become true for the non-goal to be lifted. A
> non-goal with no reversal condition is marked `PERMANENT` and may only be changed by superseding
> this document.

### TBL-VIS-048: Non-Goal Register — Scope

| ID | Non-goal | Why it is excluded | Reversal condition | Class |
| :--- | :--- | :--- | :--- | :--- |
| `NG-VIS-001` | Oship is not a general-purpose IDE or editor | Tooling is a commodity; the differentiator is knowledge structure | None | `PERMANENT` |
| `NG-VIS-002` | Oship is not a model training platform | Training is capital-intensive and orthogonal to the method | Oship reaches Phase 4 with a demonstrated data advantage | Conditional |
| `NG-VIS-003` | Oship is not a foundation-model vendor | `PRN-VIS-015` requires independence from any single model | None | `PERMANENT` |
| `NG-VIS-004` | Oship is not a low-code or no-code builder | The target user writes and reviews specifications, not drag-and-drop flows | None | `PERMANENT` |
| `NG-VIS-005` | Oship is not a generic project-management tool | Issue tracking is delegated to GitHub | GitHub ceases to provide it | Conditional |
| `NG-VIS-006` | Oship is not a documentation generator from code | The direction is specification to code, not code to documentation | None | `PERMANENT` — reversing it inverts the entire method |
| `NG-VIS-007` | Oship is not a consumer product | Target actors are enterprise engineering organisations | Explicit strategy change with an ADR | Conditional |
| `NG-VIS-008` | Oship does not aim to replace human engineers | `PRN-VIS-008` requires human accountability | None | `PERMANENT` |
| `NG-VIS-009` | Oship is not a general chat assistant | Agents act on specifications, not on open-ended conversation | None | `PERMANENT` |
| `NG-VIS-010` | Oship is not a data warehouse or BI platform | Reporting is a downstream consumer, not a core capability | A domain requirement demands it | Conditional |
| `NG-VIS-011` | Oship is not a payments network or licensed financial institution | Processing workloads is not the same as holding funds | Explicit corporate and regulatory decision | Conditional — high bar |
| `NG-VIS-012` | Oship is not a public open-source community project at this stage | Governance is single-owner (`EVD-VIS-018`) | Governance is broadened with a documented model | Conditional |

### TBL-VIS-049: Non-Goal Register — Method and Behaviour

| ID | Non-goal | Why it is excluded | Reversal condition | Class |
| :--- | :--- | :--- | :--- | :--- |
| `NG-VIS-013` | Fully autonomous agents that select their own objectives | No accountable human for the outcome | None | `PERMANENT` — see `VIS-033` |
| `NG-VIS-014` | Agent-initiated merges to `main` | Violates `BND-VIS-005` | None | `PERMANENT` |
| `NG-VIS-015` | Editing an approved ADR | Destroys the audit trail | None | `PERMANENT` |
| `NG-VIS-016` | Reusing a retired identifier | Silently corrupts historical references | None | `PERMANENT` |
| `NG-VIS-017` | Rewriting an accepted document part | Breaks the append-only model and invalidates anchors | None | `PERMANENT` |
| `NG-VIS-018` | Presenting planned behaviour as implemented | The single most damaging documentation failure | None | `PERMANENT` |
| `NG-VIS-019` | Filling unknown facts with plausible inventions | Fabrication is worse than absence | None | `PERMANENT` |
| `NG-VIS-020` | Generating volume through repetition to hit a target | Repetition dilutes the signal agents depend on | None | `PERMANENT` |
| `NG-VIS-021` | Documentation without identifiers | Unreferenceable content cannot be traced | None | `PERMANENT` |
| `NG-VIS-022` | Code without a traceable specification | Violates `PRN-VIS-004` | Emergency hotfix, retro-documented within one cycle | Narrow exception |
| `NG-VIS-023` | Silent divergence between specification and code | Drift is a defect, not a state | None | `PERMANENT` |
| `NG-VIS-024` | Secrets or credentials in the repository or in model context | `BND-VIS-010` | None | `PERMANENT` |

```mermaid
flowchart TD
    PROP["Proposed work item"] --> N1{"Does it match any PERMANENT non-goal?"}
    N1 -->|"Yes"| STOP["REJECT - cite the NG-VIS id - do not negotiate"]
    N1 -->|"No"| N2{"Does it match a Conditional non-goal?"}
    N2 -->|"Yes"| N3{"Is the reversal condition demonstrably met?"}
    N3 -->|"No"| STOP2["REJECT - state the unmet reversal condition"]
    N3 -->|"Yes"| ADR["Require a superseding ADR before proceeding"]
    N2 -->|"No"| N4{"Does it solve a registered PROB-VIS problem?"}
    N4 -->|"No"| STOP3["REJECT - unjustified work - see PRN-VIS-004"]
    N4 -->|"Yes"| N5{"Does it serve a registered ACT-VIS actor?"}
    N5 -->|"No"| STOP4["REJECT - no beneficiary"]
    N5 -->|"Yes"| OK["ACCEPT - allocate a CAP-VIS identifier"]
```

> **Diagram ID:** `DGM-VIS-025` — **Non-Goal Screening Gate**
> **Explanation:** Every proposal passes this gate before design begins. Five checks, four rejection
> exits, one acceptance path. The gate is intentionally hostile: the default answer is no, and the
> burden of proof rests on the proposal. This is `DEC-VIS-004`.

### 01.11.2 Non-Goals That Are Frequently Misread

> **`VIS-049`.** Three non-goals are routinely misinterpreted, and the misreadings cause real harm.

| Non-goal | Common misreading | What it actually means |
| :--- | :--- | :--- |
| `NG-VIS-008` "does not replace engineers" | "Oship is not serious about automation" | Oship is maximally serious about automation, but accountability stays human. Agents may write most of the code; a human still answers for it. |
| `NG-VIS-006` "not a doc generator from code" | "Oship dislikes generated documentation" | Generated reference material from code is fine. What is prohibited is treating code as the source of *intent* — intent flows downward only. |
| `NG-VIS-012` "not open source at this stage" | "The repository is closed" | It describes governance, not visibility. Contribution governance is single-owner today; that is a factual statement about `CODEOWNERS`, not a licensing position. |

> **Table ID:** `TBL-VIS-050` — **Frequently Misread Non-Goals**

---

## 01.12 — Success Model

### AI NAVIGATION METADATA — §01.12

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.6 Value Model, §01.7 Capabilities |
| **AI INPUTS** | A capability or outcome needing a success definition |
| **AI OUTPUTS** | The `SUC-VIS-` measure, its instrument, and its current value |
| **AI IMPLEMENTATION IMPACT** | Determines what telemetry and validation must be built |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-123`…`VAL-VIS-134` |
| **AI RELATED DOCUMENTS** | `.ai/METRICS.md`, §01.13 Strategic Outcomes |

### 01.12.1 Measurement Rules

> **`VIS-050`.** A success measure is valid only if it names (a) what is measured, (b) the
> instrument that measures it, and (c) the current value or `NOT YET MEASURED`. A measure without
> an instrument is an aspiration, and aspirations do not belong in a success model.

> **`VIS-051`.** Oship does **not** attach dates to success measures. Dates in a specification
> become stale, and stale dates train readers to discount the document. Sequence and preconditions
> are used instead — see §01.13.

### TBL-VIS-051: Measure Validity Requirements

| Requirement | Rule | Failure consequence |
| :--- | :--- | :--- |
| Named subject | Measure exactly one thing | Composite measures hide regressions |
| Named instrument | State how it is captured | Unmeasurable measures are decoration |
| Current value | State it or write `NOT YET MEASURED` | Implied values are fabrication |
| Direction | State whether higher or lower is better | Ambiguity inverts interpretation |
| Threshold | State the level that counts as success | Unbounded measures never succeed |
| Owner | Name the accountable actor | Unowned measures are not maintained |

### 01.12.2 Success Measures — Construction Layer

### TBL-VIS-052: Construction Success Measures

| ID | Measure | Instrument | Direction | Threshold | Current value | Owner |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `SUC-VIS-001` | Agent task completion without human clarification | Session logs | Higher | ≥ 80 percent | `NOT YET MEASURED` | `ACT-VIS-002` |
| `SUC-VIS-002` | Time from agent start to first correct change | Session timestamps | Lower | Under 15 minutes | `NOT YET MEASURED` | `ACT-VIS-002` |
| `SUC-VIS-003` | Proportion of merged changes traceable to a `PROB-VIS-` entry | PR body inspection | Higher | 100 percent | `NOT YET MEASURED` | `ACT-VIS-002` |
| `SUC-VIS-004` | Specification claims carrying evidence references | Document scan | Higher | ≥ 95 percent | `NOT YET MEASURED` | `ACT-VIS-001` |
| `SUC-VIS-005` | Documents with valid 15-key frontmatter | Metadata linter | Higher | 100 percent | `NOT YET MEASURED` — no linter installed | `ACT-VIS-011` |
| `SUC-VIS-006` | Broken internal anchors | Anchor validator | Lower | 0 | 0 in `AOM-ARCH-001` and `AOM-VIS-001` | `ACT-VIS-005` |
| `SUC-VIS-007` | Mermaid diagrams that fail to parse | Mermaid validator | Lower | 0 | 0 | `ACT-VIS-005` |
| `SUC-VIS-008` | Identifier collisions across namespaces | ID scan | Lower | 0 | 0 | `ACT-VIS-005` |
| `SUC-VIS-009` | Decisions recorded as ADRs before implementation | ADR versus commit ordering | Higher | 100 percent | `NOT YET MEASURED` | `ACT-VIS-001` |
| `SUC-VIS-010` | Knowledge domains with a populated `INDEX.md` | Directory scan | Higher | 24 of 24 | **24 of 24** (`EVD-VIS-006`) | `ACT-VIS-001` |
| `SUC-VIS-011` | Knowledge domains with at least one substantive document | Directory scan | Higher | 24 of 24 | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | `ACT-VIS-001` |
| `SUC-VIS-012` | Governance rules with automated enforcement | Workflow inventory | Higher | ≥ 80 percent | **0 percent** (`EVD-VIS-017`) | `ACT-VIS-002` |
| `SUC-VIS-013` | Mean review turnaround for agent-produced changes | PR timestamps | Lower | Under 24 hours | `NOT YET MEASURED` | `ACT-VIS-002` |
| `SUC-VIS-014` | Rework rate — changes reverted or substantially rewritten | Git history | Lower | Under 10 percent | `NOT YET MEASURED` | `ACT-VIS-002` |
| `SUC-VIS-015` | Documented-versus-actual drift incidents | Drift detector | Lower | 0 | `NOT YET MEASURED` — no detector | `ACT-VIS-011` |

> **`VIS-052`.** Thirteen of fifteen construction measures read `NOT YET MEASURED`. That is the
> honest state and it is itself the most important finding in this section: **Oship currently
> asserts a method whose effectiveness it does not measure.** `SUC-VIS-012` at zero percent is the
> root cause — with no automation, nothing is instrumented. This is recorded as `OUT-VIS-004`.

### 01.12.3 Success Measures — Product Layer

### TBL-VIS-053: Product Success Measures — All Pending a Runtime

| ID | Measure | Instrument | Direction | Threshold | Current value |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `SUC-VIS-016` | Service availability | Uptime monitoring | Higher | To be set by SLO | `NOT APPLICABLE` — no runtime |
| `SUC-VIS-017` | Transaction processing correctness | Reconciliation | Higher | 100 percent | `NOT APPLICABLE` |
| `SUC-VIS-018` | Settlement exactly-once rate | Ledger audit | Higher | 100 percent | `NOT APPLICABLE` |
| `SUC-VIS-019` | Tenant isolation violations | Security testing | Lower | 0 | `NOT APPLICABLE` |
| `SUC-VIS-020` | Mean time to detect an incident | Alerting | Lower | To be set | `NOT APPLICABLE` |
| `SUC-VIS-021` | Mean time to recover | Incident records | Lower | To be set | `NOT APPLICABLE` |
| `SUC-VIS-022` | Audit reconstruction completeness | Audit sampling | Higher | 100 percent | `NOT APPLICABLE` |
| `SUC-VIS-023` | Deployment frequency | CD pipeline | Higher | To be set | `NOT APPLICABLE` |
| `SUC-VIS-024` | Change failure rate | Incident-to-deploy ratio | Lower | Under 15 percent | `NOT APPLICABLE` |
| `SUC-VIS-025` | Lead time from specification to production | Combined | Lower | To be set | `NOT APPLICABLE` |

> **`VIS-053`.** `NOT APPLICABLE` is used rather than `NOT YET MEASURED` because these measures
> cannot be taken at all — the subject does not exist. The distinction matters: `NOT YET MEASURED`
> is a tooling gap, `NOT APPLICABLE` is a phase statement.

### 01.12.4 The Success Model Structure

```mermaid
flowchart TB
    subgraph L1["Leading indicators - measurable now"]
        LI1["SUC-VIS-006 anchor integrity"]
        LI2["SUC-VIS-007 diagram validity"]
        LI3["SUC-VIS-008 identifier integrity"]
        LI4["SUC-VIS-010 domain coverage"]
    end
    subgraph L2["Lagging indicators - measurable with instrumentation"]
        LG1["SUC-VIS-001 autonomous completion"]
        LG2["SUC-VIS-013 review turnaround"]
        LG3["SUC-VIS-014 rework rate"]
        LG4["SUC-VIS-015 drift incidents"]
    end
    subgraph L3["Outcome indicators - require a runtime"]
        OI1["SUC-VIS-017 correctness"]
        OI2["SUC-VIS-024 change failure rate"]
    end
    L1 -->|"structural health enables"| L2
    L2 -->|"method effectiveness enables"| L3
    L3 -.->|"validates or falsifies the vision"| L1

    GAP["GAP - no instrumentation exists to capture L2"]:::bad
    L2 -.- GAP
    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-026` — **Three-Layer Success Model**
> **Explanation:** Leading indicators are structural and cheap to measure; Oship measures these and
> passes them. Lagging indicators measure whether the method works, and Oship cannot measure any of
> them. Outcome indicators require a product. The red gap annotation is the section's central
> finding — the layer that would prove the vision is exactly the layer with no instruments.

### TBL-VIS-054: Success Model Anti-Measures

Measures deliberately **not** used, with reasons — these are as important as the chosen ones.

| Rejected measure | Why rejected |
| :--- | :--- |
| Lines of documentation | Volume is not value; rewards `NG-VIS-020` |
| Number of diagrams | Same failure mode; diagrams must earn their place |
| Commit count | Measures activity, not progress |
| Agent tokens consumed | A cost, not an outcome |
| Number of capabilities registered | Registering is free; building is not |
| Percentage of tasks assigned to agents | Rewards delegation regardless of result |
| Documentation "completeness" score | Unfalsifiable without a definition of complete |

---

## 01.13 — Strategic Outcomes

### AI NAVIGATION METADATA — §01.13

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.7, §01.8, §01.12 |
| **AI INPUTS** | A question about what should happen next |
| **AI OUTPUTS** | The next unblocked outcome and its preconditions |
| **AI IMPLEMENTATION IMPACT** | Defines work sequencing without committing to dates |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-135`…`VAL-VIS-144` |
| **AI RELATED DOCUMENTS** | `.ai/NEXT_ACTION.md`, `.ai/ROADMAP_AI.md`, `docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md` |

### 01.13.1 Outcome Format

> **`VIS-054`.** An outcome states a **verifiable end state**, its **preconditions**, and its
> **completion test**. It carries **no date**, per `VIS-051`. Sequence is expressed by
> preconditions alone, which makes the plan self-ordering and immune to calendar rot.

### TBL-VIS-055: Strategic Outcomes — Horizon 1 (Unblocked Now)

| ID | Outcome | Preconditions | Completion test | Unblocks | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `OUT-VIS-001` | The vision constitution exists and is authoritative | `AOM-ARCH-001` Part 01 complete | This document merged and registered in `01_PRODUCT/INDEX.md` | All derivation | `IN_PROGRESS` |
| `OUT-VIS-002` | Every knowledge domain has at least one substantive document | Domain indexes exist | 24 domains each contain a non-index document | Knowledge completeness | `PLANNED` |
| `OUT-VIS-003` | Architecture specification is complete across all parts | `OUT-VIS-001` | `AOM-ARCH-001` status is `RELEASED` | Component derivation | `IN_PROGRESS` |
| `OUT-VIS-004` | Governance is automatically enforced | Workflow skeletons exist | CI runs on every PR and can fail it | `SUC-VIS-012`, `CAP-VIS-009`, `CAP-VIS-020` | `PLANNED` — **highest leverage** |
| `OUT-VIS-005` | Metadata and anchor validation run in CI | `OUT-VIS-004` | A PR with a broken anchor is blocked | `SUC-VIS-005`, `SUC-VIS-006` | `PLANNED` |
| `OUT-VIS-006` | The technology stack is selected and recorded in an ADR | None — this is a decision, not a build | An `APPROVED` ADR names languages, runtime, and datastore | All of T4 | `PLANNED` — **highest leverage** |
| `OUT-VIS-007` | The traceability matrix is machine-readable | `OUT-VIS-001` | A script emits every `PROB → CAP → CMP → code` chain | `CAP-VIS-010` | `PLANNED` |
| `OUT-VIS-008` | Agent operating measures are instrumented | `OUT-VIS-004` | `SUC-VIS-001`, `013`, `014` report real values | Method validation | `PLANNED` |

### TBL-VIS-056: Strategic Outcomes — Horizon 2 (Blocked on Horizon 1)

| ID | Outcome | Preconditions | Completion test | Status |
| :--- | :--- | :--- | :--- | :--- |
| `OUT-VIS-009` | A first executable service exists | `OUT-VIS-006` | A service builds, starts, and answers a health check in CI | `PLANNED` |
| `OUT-VIS-010` | Persistence is provisioned with migrations | `OUT-VIS-009` | Schema migrations run reproducibly | `PLANNED` |
| `OUT-VIS-011` | Compliance obligations are identified | External investigation | A document names jurisdictions and applicable regimes | `PLANNED` — resolves `PROB-VIS-023` |
| `OUT-VIS-012` | Identity and access control operate end to end | `OUT-VIS-009` | An unauthenticated call is rejected; an authorised one succeeds | `PLANNED` |
| `OUT-VIS-013` | Observability emits metrics, logs, and traces | `OUT-VIS-009` | A request is traceable end to end | `PLANNED` |
| `OUT-VIS-014` | A model provider is selected and abstracted | An ADR decision | Provider swap requires no call-site change | `PLANNED` |
| `OUT-VIS-015` | An agent implements a service change end to end with review only | `OUT-VIS-004`, `OUT-VIS-009` | One merged PR authored entirely by an agent, human-reviewed | `PLANNED` — **the vision's first real proof** |

### TBL-VIS-057: Strategic Outcomes — Horizon 3 (Domain Value)

| ID | Outcome | Preconditions | Completion test | Status |
| :--- | :--- | :--- | :--- | :--- |
| `OUT-VIS-016` | Transaction ingestion accepts and persists workload items | `OUT-VIS-010`, `OUT-VIS-012` | An item survives restart and is retrievable | `PLANNED` |
| `OUT-VIS-017` | An immutable ledger records every value movement | `OUT-VIS-016` | A movement is reconstructable from the ledger alone | `PLANNED` |
| `OUT-VIS-018` | Settlement is exactly-once under retry and partial failure | `OUT-VIS-017` | Injected duplicate delivery produces one settlement | `PLANNED` |
| `OUT-VIS-019` | Multi-tenant isolation is enforced server-side | `OUT-VIS-012` | A cross-tenant read attempt fails in an automated test | `PLANNED` |
| `OUT-VIS-020` | Audit reconstruction is demonstrated to a third party | `OUT-VIS-017`, `OUT-VIS-011` | An external reviewer reconstructs a period unaided | `PROPOSED` |

```mermaid
flowchart LR
    O6["OUT-VIS-006 Stack selected"] --> O9["OUT-VIS-009 First service"]
    O4["OUT-VIS-004 CI enforcement"] --> O5["OUT-VIS-005 Doc validation"]
    O4 --> O8["OUT-VIS-008 Instrumentation"]
    O4 --> O15["OUT-VIS-015 Agent end-to-end change"]
    O9 --> O15
    O9 --> O10["OUT-VIS-010 Persistence"]
    O9 --> O12["OUT-VIS-012 Identity"]
    O9 --> O13["OUT-VIS-013 Observability"]
    O10 --> O16["OUT-VIS-016 Ingestion"]
    O12 --> O16
    O16 --> O17["OUT-VIS-017 Ledger"]
    O17 --> O18["OUT-VIS-018 Settlement"]
    O12 --> O19["OUT-VIS-019 Tenant isolation"]
    O11["OUT-VIS-011 Compliance identified"] --> O20["OUT-VIS-020 Audit demonstration"]
    O17 --> O20

    classDef lever fill:#0d47a1,stroke:#90caf9,color:#ffffff
    class O4,O6 lever
```

> **Diagram ID:** `DGM-VIS-027` — **Outcome Dependency Network**
> **Explanation:** The two blue nodes have no preconditions and unblock everything else. They are
> both decisions rather than construction efforts, which means the entire forward plan is currently
> gated on two choices that cost nothing but attention to make. An agent asked "what should happen
> next?" should answer `OUT-VIS-004` and `OUT-VIS-006`, in that order.

### TBL-VIS-058: Outcome Sequencing Rationale

| Question | Answer | Justification |
| :--- | :--- | :--- |
| Why CI before code? | Enforcement written after the code it governs is never retrofitted | `PROB-VIS-017`, `PRN-VIS-009` |
| Why stack selection before services? | Every T4 capability inherits the stack's constraints | `TBL-VIS-042` |
| Why compliance investigation early? | It can invalidate domain design; discovering that late is catastrophic | `PROB-VIS-023` |
| Why is `OUT-VIS-015` the proof point? | It is the first falsifiable test of `VIS-011` | `VIS-020a` |
| Why no dates anywhere? | Dates decay and train readers to distrust the document | `VIS-051` |

---

## 01.14 — Evolution Model

### AI NAVIGATION METADATA — §01.14

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.8, §01.13 |
| **AI INPUTS** | A question about maturity, phase, or readiness |
| **AI OUTPUTS** | The current phase, its exit criteria, and what is legal in it |
| **AI IMPLEMENTATION IMPACT** | Phase determines which capabilities may be built at all |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-145`…`VAL-VIS-152` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` maturity states `S0`…`S5` |

### 01.14.1 Phase Definition

> **`VIS-055`.** Oship evolves through six phases. A phase is exited when its **exit criteria** are
> all met — not when a date passes and not when it feels finished. Phase determines what work is
> legal: attempting Phase 3 work during Phase 0 is a scope violation, not ambition.

### TBL-VIS-059: Evolution Phases

| Phase | Name | Defining question | Exit criteria | Maps to `AOM-ARCH-001` | Status |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **P0** | Foundation | Can the system be described precisely enough to be built? | Vision and architecture constitutions complete; governance automated | `S0` | **CURRENT** |
| **P1** | First execution | Can anything actually run? | One service builds, deploys, and is observable | `S1` | `PLANNED` |
| **P2** | Method proof | Can an agent deliver a real change end to end? | `OUT-VIS-015` achieved and measured | `S2` | `PLANNED` |
| **P3** | Domain value | Does the system do something valuable for an end user? | Ingestion, ledger, and settlement operate correctly | `S3` | `PLANNED` |
| **P4** | Scale | Does it hold under multi-tenant production load? | Isolation, availability, and recovery targets met | `S4` | `PROPOSED` |
| **P5** | Ecosystem | Can others extend it safely? | Plugin and SDK contracts stable and versioned | `S5` | `PROPOSED` |

```mermaid
stateDiagram-v2
    [*] --> P0
    P0: P0 Foundation - CURRENT
    P1: P1 First execution
    P2: P2 Method proof
    P3: P3 Domain value
    P4: P4 Scale
    P5: P5 Ecosystem

    P0 --> P1: constitutions complete and CI enforcing
    P1 --> P2: a service runs and is observable
    P2 --> P3: agent delivers end to end
    P3 --> P4: domain correctness demonstrated
    P4 --> P5: production stability sustained
    P2 --> P1: method fails - return and simplify
    P3 --> P2: correctness fails - return
    P4 --> P3: scale exposes design faults
    P0 --> P0: refinement without exit - risk of stalling
```

> **Diagram ID:** `DGM-VIS-028` — **Phase State Machine**
> **Explanation:** Forward transitions require exit criteria; backward transitions are legitimate
> responses to falsification. The self-loop on `P0` is drawn deliberately: indefinite refinement of
> the foundation without ever exiting is a real absorbing state, and it is the failure mode
> `FAL-VIS-001` warns about.

### TBL-VIS-060: What Is Legal In Each Phase

| Activity | P0 | P1 | P2 | P3 | P4 | P5 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Write specifications | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Install governance automation | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Write application code | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Provision infrastructure | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Delegate implementation to agents | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Build domain financial logic | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ |
| Onboard external tenants | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |
| Accept third-party plugins | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Publish stable public APIs | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |

> **`VIS-056`.** The `P0` column is nearly all `✘`, which is consistent with `EVD-VIS-011`: zero
> application lines exist. This is a deliberate constraint from `ADR-0001`, not an accident of
> incompleteness. An agent asked to write application code today must first confirm that `P0` exit
> criteria are met, and if they are not, must refuse and cite this table.

### 01.14.2 What Evolves and What Does Not

### TBL-VIS-061: Stability Classes

| Class | Definition | Change mechanism | Examples |
| :--- | :--- | :--- | :--- |
| **Immutable** | Never changes once approved | Supersede only | Approved ADRs, allocated identifiers, `PERMANENT` non-goals |
| **Constitutional** | Changes rarely, with formal process | Version bump plus ADR | Vision statement, strategic principles, trust boundaries |
| **Structural** | Changes with architectural evolution | Version bump | Capability register, domain boundaries, tier assignments |
| **Operational** | Changes continuously | Direct edit | `.ai/` control plane, status labels, current values |
| **Ephemeral** | Valid for one session | No record required | Session scratch state, working notes |

```mermaid
flowchart TB
    IM["IMMUTABLE - approved ADRs, identifiers, permanent non-goals"]
    CO["CONSTITUTIONAL - vision, principles, boundaries"]
    ST["STRUCTURAL - capabilities, domains, tiers"]
    OP["OPERATIONAL - control plane, statuses"]
    EP["EPHEMERAL - session state"]

    IM -->|"constrains"| CO
    CO -->|"constrains"| ST
    ST -->|"constrains"| OP
    OP -->|"constrains"| EP
    EP -.->|"may propose change to"| OP
    OP -.->|"evidence may trigger revision of"| ST
    ST -.->|"repeated tension may trigger"| CO
    CO -.->|"only via supersession"| IM
```

> **Diagram ID:** `DGM-VIS-029` — **Stability Class Cascade**
> **Explanation:** Constraint flows downward and change pressure flows upward, with each upward
> arrow requiring more justification than the one below it. The critical property is that no
> ephemeral or operational observation may directly modify a constitutional statement — pressure
> must accumulate and be argued. This prevents the specification from tracking noise.

### TBL-VIS-062: Evolution Triggers

| ID | Trigger | Detected by | Response | Authority required |
| :--- | :--- | :--- | :--- | :--- |
| `VIS-057` | A falsification condition in `VIS-020a`…`e` is met | Measurement | Revise the vision statement | Architect plus ADR |
| `VIS-058` | A capability proves unbuildable as specified | Implementation attempt | Re-specify or withdraw the capability | Architect |
| `VIS-059` | An actor turns out not to exist | Usage evidence | Remove derived requirements | Architect |
| `VIS-060` | A non-goal's reversal condition is met | Explicit review | Superseding ADR | Architect plus maintainer |
| `VIS-061` | A phase exit criterion is met | Completion test | Advance the phase; update `.ai/` | Maintainer |
| `VIS-062` | A phase exit criterion is retracted | Regression | Return to the prior phase | Maintainer |
| `VIS-063` | The model landscape changes materially | External observation | Re-evaluate `PRN-VIS-015` and `CAP-VIS-053` | Architect |
| `VIS-064` | A regulatory obligation is discovered | Investigation | Add constraints; possibly re-scope domain capabilities | Architect plus external counsel |

---

## 01.15 — AI-Native Vision

### AI NAVIGATION METADATA — §01.15

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this defines what "AI-native" means here and forbids the loose usage** |
| **AI DEPENDENCIES** | §01.2, §01.5, §01.9 |
| **AI INPUTS** | Any claim that something is AI-native or AI-first |
| **AI OUTPUTS** | Whether the claim satisfies the definition |
| **AI IMPLEMENTATION IMPACT** | Determines document structure, interface design, and validation |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-153`…`VAL-VIS-166` |
| **AI RELATED DOCUMENTS** | `ADR-0001`, `.ai/AI_AGENT_OPERATING_MANUAL.md` |

### 01.15.1 The Definition

> **`AI-VIS-001`.** **AI-native**, in Oship, means: *the system's primary knowledge consumer is a
> machine that cannot ask clarifying questions, and every artifact is structured for that consumer
> first.* It does **not** mean the system uses AI features, calls an LLM, or was written with AI
> assistance.

### TBL-VIS-063: AI-Native — Necessary and Sufficient Conditions

| # | Condition | Necessary? | Oship satisfies? | Evidence |
| :---: | :--- | :---: | :---: | :--- |
| 1 | Every artifact has a stable, unique identifier | Yes | **Yes** | `CAP-VIS-008` |
| 2 | Every claim has a status label from a closed vocabulary | Yes | **Yes** | `TBL-VIS-003` |
| 3 | Every claim has an evidence reference or an explicit `UNKNOWN` | Yes | **Partially** | Convention, unenforced |
| 4 | Navigation is deterministic — the same question routes to the same document | Yes | **Yes** | `CAP-VIS-007` |
| 5 | Constraints are stated, not implied | Yes | **Yes** | `PRN-VIS-003` |
| 6 | Prohibitions are enumerated as explicitly as permissions | Yes | **Yes** | §01.11 |
| 7 | Structure is machine-parseable — tables, identifiers, front matter | Yes | **Yes** | `CAP-VIS-004` |
| 8 | Context can be assembled without a human present | Yes | **Partially** | Manual assembly today |
| 9 | Output can be validated automatically against the specification | Yes | **No** | `EVD-VIS-017` |
| 10 | The system calls an LLM at runtime | **No** | No | Not required by the definition |
| 11 | The system was authored with AI assistance | **No** | Yes | Irrelevant to the definition |

> **`AI-VIS-002`.** Oship satisfies seven of nine necessary conditions fully and two partially, and
> **fails condition 9 outright**. Under a strict reading, Oship is **not yet fully AI-native** — it
> is AI-native in structure and not in enforcement. Stating this plainly is required by
> `PRN-VIS-001`; claiming full AI-nativeness today would be exactly the failure `PROB-VIS-006`
> describes.

```mermaid
flowchart LR
    subgraph HUMAN["Human-native repository"]
        H1["Knowledge in people"]
        H2["Conventions implied"]
        H3["Questions answered verbally"]
        H4["Docs describe, code decides"]
    end
    subgraph NATIVE["AI-native repository"]
        A1["Knowledge in artifacts"]
        A2["Conventions written and identified"]
        A3["Questions answered by routing"]
        A4["Specification decides, code conforms"]
    end
    H1 -->|"externalise"| A1
    H2 -->|"make explicit"| A2
    H3 -->|"make navigable"| A3
    H4 -->|"invert authority"| A4

    NATIVE --> GATE{"Enforced automatically?"}
    GATE -->|"No - Oship today"| WEAK["AI-structured - relies on agent discipline"]
    GATE -->|"Yes - target"| STRONG["AI-native - violations are mechanically impossible"]

    classDef now fill:#e65100,stroke:#ffcc80,color:#ffffff
    class WEAK now
```

> **Diagram ID:** `DGM-VIS-030` — **Human-Native to AI-Native Transition**
> **Explanation:** Four transformations move a repository from human-native to AI-native, and
> Oship has completed all four at the structural level. The gate on the right is the honest
> qualifier: without automated enforcement, Oship is *AI-structured* rather than fully AI-native.
> The orange node marks the current position.

### 01.15.2 The Inversion of Authority

> **`AI-VIS-003`.** The defining architectural claim of AI-nativeness is the **inversion of
> authority**: in a conventional repository, code is the source of truth and documentation
> describes it; in Oship, the specification is the source of truth and code conforms to it.

### TBL-VIS-064: Consequences of Authority Inversion

| Situation | Conventional repository | Oship |
| :--- | :--- | :--- |
| Code and docs disagree | Docs are wrong; update the docs | **A defect exists.** Determine which is wrong; both outcomes are possible |
| A behaviour is undocumented | Normal; read the code | A specification gap; record it before proceeding |
| A specification describes unbuilt behaviour | Aspirational documentation | Legitimate, if labelled `PLANNED` |
| A developer wants to change behaviour | Change the code | Change the specification, then the code |
| An agent needs to know intent | Infer from the code | Read the specification; never infer |
| Refactoring changes structure | Docs go stale | Specification updates in the same change or the change is incomplete |

> **`AI-VIS-004`.** The second row deserves emphasis. In most repositories, when documentation
> disagrees with code, the code wins automatically. In Oship it does not. The specification may be
> the correct party and the code the defect. An agent must **not** silently reconcile a
> disagreement in favour of code — it must report the divergence as `PROB-VIS-004`.

### 01.15.3 What an AI-Native System Owes Its Agents

### TBL-VIS-065: The Agent Contract

| ID | Obligation of the system | Agent's corresponding right | Oship status |
| :--- | :--- | :--- | :--- |
| `AI-VIS-005` | State every constraint explicitly | Not to be blamed for violating an unwritten rule | `IMPLEMENTED` |
| `AI-VIS-006` | Provide a deterministic entry point | To start work without asking where | `IMPLEMENTED` |
| `AI-VIS-007` | Label every claim's status | To distinguish real from planned | `IMPLEMENTED` |
| `AI-VIS-008` | Provide evidence or admit ignorance | Not to be required to verify unverifiable claims | `PARTIALLY IMPLEMENTED` |
| `AI-VIS-009` | Maintain identifier stability | To rely on references across sessions | `IMPLEMENTED` |
| `AI-VIS-010` | Define the autonomy boundary precisely | To act confidently within it | `IMPLEMENTED` |
| `AI-VIS-011` | Provide a resumption protocol | To be interrupted without losing work | `IMPLEMENTED` |
| `AI-VIS-012` | Provide automated validation | To verify its own work before review | **`PLANNED`** |
| `AI-VIS-013` | Keep documents parseable within context limits | To load what it needs | `PARTIALLY IMPLEMENTED` |
| `AI-VIS-014` | Record decisions immutably | To rely on precedent | `IMPLEMENTED` |

### TBL-VIS-066: What Agents Owe the System

| ID | Obligation of the agent | Enforcement today |
| :--- | :--- | :--- |
| `AI-VIS-015` | Never fabricate; write `UNKNOWN` instead | Self-discipline only |
| `AI-VIS-016` | Never upgrade a status label without evidence | Self-discipline only |
| `AI-VIS-017` | Never reuse or renumber an identifier | Self-discipline only |
| `AI-VIS-018` | Never rewrite an accepted part | Self-discipline only |
| `AI-VIS-019` | Halt and escalate on unresolved ambiguity | Self-discipline only |
| `AI-VIS-020` | Update the control plane before ending a work unit | Self-discipline only |
| `AI-VIS-021` | Cite the identifier authorising any action taken | Self-discipline only |
| `AI-VIS-022` | Report divergence rather than silently reconciling | Self-discipline only |

> **`AI-VIS-023`.** Every row in `TBL-VIS-066` reads "self-discipline only". This is the sharpest
> statement of `PROB-VIS-017` available: **the agent is currently the only enforcement mechanism
> for the rules that govern the agent.** Until `OUT-VIS-004` lands, Oship's correctness depends on
> agents choosing to comply. An agent reading this should treat its own compliance as
> load-bearing infrastructure.

```mermaid
sequenceDiagram
    participant H as Human architect
    participant S as Specification
    participant A as Agent
    participant V as Validation - PLANNED
    participant R as Review

    H->>S: writes intent with identifiers and status labels
    A->>S: loads context deterministically
    S-->>A: constraints, prohibitions, evidence
    A->>A: checks the autonomy boundary DGM-VIS-023
    alt within boundary
        A->>A: produces implementation
        A->>V: requests validation
        Note over A,V: today this step is absent and the agent self-checks
        V-->>A: pass or fail with reasons
        A->>R: submits for human review
        R->>H: accountability applied
    else outside boundary
        A->>H: halts and requests a decision
        H->>S: records the decision as an ADR
    end
    R-->>S: evidence returned to the specification
```

> **Diagram ID:** `DGM-VIS-031` — **AI-Native Work Cycle**
> **Explanation:** The full cycle including the boundary check and the missing validation step,
> which is called out in the note rather than hidden. The final arrow — evidence returned to the
> specification — is what makes the cycle a loop rather than a pipeline, and it is the mechanism by
> which the knowledge asset improves rather than decays.

---

## 01.16 — Human and AI Collaboration Model

### AI NAVIGATION METADATA — §01.16

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.5, §01.9, §01.15 |
| **AI INPUTS** | A task needing an owner |
| **AI OUTPUTS** | Whether a human, an agent, or both should perform it |
| **AI IMPLEMENTATION IMPACT** | Determines workflow design and approval gates |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-167`…`VAL-VIS-176` |
| **AI RELATED DOCUMENTS** | `.ai/AI_AGENT_OPERATING_MANUAL.md`, `TBL-VIS-026` autonomy classes |

### 01.16.1 The Allocation Principle

> **`AI-VIS-024`.** Work is allocated by **the nature of the judgement required**, not by
> difficulty or volume. Humans hold judgements that require accountability, taste, or negotiation
> with reality outside the repository. Agents hold judgements that are determinable from written
> constraints.

### TBL-VIS-067: Judgement Type Allocation

| Judgement type | Example | Allocated to | Why |
| :--- | :--- | :--- | :--- |
| Determinable from written rules | Does this violate a non-goal? | **Agent** | Mechanical |
| Requires external negotiation | Which regulator applies? | **Human** | Outside the repository |
| Requires accepting consequence | Approve a release | **Human** | `PRN-VIS-008` |
| Requires taste under ambiguity | Is this abstraction worth its cost? | **Human**, agent advises | Not determinable |
| High-volume, rule-bound | Apply a naming convention to 500 entries | **Agent** | Scale |
| Requires memory across sessions | What was decided last month? | **Agent** | Better than human recall |
| Requires reading everything | Is this claim contradicted anywhere? | **Agent** | Beyond human capacity |
| Requires saying no to a stakeholder | Reject a requested feature | **Human** | Social, not technical |
| Requires estimating unknown risk | Will this scale? | **Human**, agent supplies data | Judgement under uncertainty |
| Requires exhaustive consistency | Validate 400 rules across 10,000 lines | **Agent** | Mechanical at scale |

```mermaid
flowchart TD
    T["Task arrives"] --> Q1{"Is the answer fully determined by written rules?"}
    Q1 -->|"Yes"| Q2{"Is the action within the autonomy boundary?"}
    Q1 -->|"No"| Q3{"Does resolving it require information outside the repository?"}
    Q2 -->|"Yes"| AGENT["AGENT executes - human informed"]
    Q2 -->|"No"| PAIR["AGENT prepares - HUMAN approves"]
    Q3 -->|"Yes"| HUMAN["HUMAN decides - agent gathers evidence"]
    Q3 -->|"No"| Q4{"Does it require accepting a consequence?"}
    Q4 -->|"Yes"| HUMAN
    Q4 -->|"No"| PAIR
    HUMAN --> REC["Decision recorded as ADR or decision-log entry"]
    PAIR --> REC
    AGENT --> LOG["Action recorded in session memory"]
```

> **Diagram ID:** `DGM-VIS-032` — **Human-AI Task Allocation Tree**
> **Explanation:** Four questions produce three allocations. Note that two of the three terminal
> states require a recorded decision — collaboration in Oship always leaves an artifact, because an
> unrecorded collaboration is indistinguishable from an unmade decision six months later. This is
> `DEC-VIS-005`.

### TBL-VIS-068: Collaboration Patterns

| ID | Pattern | Human role | Agent role | When to use | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AI-VIS-025` | **Specify then delegate** | Writes the specification | Implements against it | The default for construction work | `IMPLEMENTED` |
| `AI-VIS-026` | **Draft then review** | Reviews and corrects | Produces the first draft | Long-form documents | `IMPLEMENTED` |
| `AI-VIS-027` | **Investigate then decide** | Makes the decision | Gathers and structures evidence | Stack selection, compliance | `IMPLEMENTED` |
| `AI-VIS-028` | **Validate then approve** | Approves | Runs all checks and reports | Pre-merge | `PARTIALLY IMPLEMENTED` |
| `AI-VIS-029` | **Escalate on ambiguity** | Resolves | Halts and states the ambiguity precisely | Contradictions | `IMPLEMENTED` |
| `AI-VIS-030` | **Pair on architecture** | Proposes structure | Stress-tests against catalogued failures | Design sessions | `PARTIALLY IMPLEMENTED` |
| `AI-VIS-031` | **Agent proposes, human disposes** | Selects among options | Generates viable options with trade-offs | Open design questions | `IMPLEMENTED` |
| `AI-VIS-032` | **Continuous consistency sweep** | Sets the rule | Applies it exhaustively and reports exceptions | Large-scale conventions | `IMPLEMENTED` |

### 01.16.2 Anti-Patterns in Collaboration

### TBL-VIS-069: Collaboration Anti-Patterns

| ID | Anti-pattern | Why it fails | Correct alternative |
| :--- | :--- | :--- | :--- |
| `AI-VIS-033` | Human asks the agent to "just figure out what we want" | No specification exists to conform to; the agent invents intent | Human writes intent first, however roughly |
| `AI-VIS-034` | Agent proceeds on an assumption without recording it | The assumption becomes invisible technical debt | Record the assumption or halt |
| `AI-VIS-035` | Human rubber-stamps agent output | Accountability becomes fictional | Review or explicitly delegate with recorded scope |
| `AI-VIS-036` | Agent optimises for appearing complete | Produces volume without information | `PRN-VIS-001`; report gaps |
| `AI-VIS-037` | Human bypasses the specification to "just fix it" | Creates drift immediately | Change the specification first |
| `AI-VIS-038` | Agent asks for approval on everything | Destroys the throughput benefit | Use `DGM-VIS-023` to decide autonomously |
| `AI-VIS-039` | Agent silently reconciles a contradiction | Hides a real defect | Report as `PROB-VIS-004` |
| `AI-VIS-040` | Human treats the agent's confidence as evidence | Confidence is not correlated with correctness | Require an evidence reference |
| `AI-VIS-041` | Work handed between agents without a control-plane update | The receiving agent starts blind | `AI-VIS-020` |
| `AI-VIS-042` | Agent given a task larger than its context window | Truncation produces confidently wrong output | Use the continuation protocol |
| `AI-VIS-043` | Human specifies implementation rather than intent | Forfeits the agent's search over solutions | Specify outcomes and constraints |
| `AI-VIS-044` | Both parties assume the other validated it | Nothing is validated | Explicit validation ownership per change |

```mermaid
flowchart LR
    subgraph HIGH["High human leverage"]
        A["Deciding what is worth building"]
        B["Accepting consequence"]
        C["Negotiating outside reality"]
    end
    subgraph SHARED["Shared"]
        D["Architecture design"]
        E["Trade-off evaluation"]
        F["Review"]
    end
    subgraph AGENT["High agent leverage"]
        G["Exhaustive consistency"]
        H["Cross-document recall"]
        I["Volume production under rules"]
        J["Mechanical validation"]
    end
    HIGH -->|"sets constraints for"| SHARED
    SHARED -->|"delegates execution to"| AGENT
    AGENT -->|"returns evidence to"| SHARED
    SHARED -->|"escalates decisions to"| HIGH
```

> **Diagram ID:** `DGM-VIS-033` — **Leverage Distribution**
> **Explanation:** The productive configuration is not "humans supervise agents" but a circulation:
> constraints flow down, evidence flows up, and the shared middle band is where most real work
> happens. Attempting to eliminate the middle band — full autonomy or full manual control — is what
> both `NG-VIS-013` and `AI-VIS-038` prohibit from opposite directions.

---

## 01.17 — Architecture Traceability

### AI NAVIGATION METADATA — §01.17

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this is the bridge to `AOM-ARCH-001`** |
| **AI DEPENDENCIES** | §01.7, §01.8, §01.9 |
| **AI INPUTS** | A `CAP-VIS-` identifier, or an architecture element |
| **AI OUTPUTS** | The corresponding element in the other document |
| **AI IMPLEMENTATION IMPACT** | Architecture elements without a vision origin are unjustified |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-177`…`VAL-VIS-186` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` |

> **`VIS-065`. READ-ONLY DECLARATION.** This section **references** `AOM-ARCH-001` and never
> modifies it. If a mapping below is wrong, the correction belongs in this document or in a future
> part of `AOM-ARCH-001` — never as an edit to its accepted Part 01. Its Part 01 is closed
> (`NG-VIS-017`).

### 01.17.1 The Derivation Contract

> **`VIS-066`.** Every architectural element in `AOM-ARCH-001` must be derivable from a vision
> element here. Elements that are not derivable are either (a) missing a vision entry, which is a
> gap in this document, or (b) unjustified, which is a defect in the architecture. **Both cases
> must be recorded, never silently tolerated.**

```mermaid
flowchart LR
    V["AOM-VIS-001 Vision"] -->|"VIS- statements constrain"| PR["ARCH- principles"]
    V -->|"CAP-VIS- become"| CMP["CMP-ARCH- components"]
    V -->|"BND-VIS- become"| TB["TB- trust boundaries"]
    V -->|"PRN-VIS- become"| INV["INV-ARCH- invariants"]
    V -->|"NG-VIS- become"| EXC["Architecture exclusions"]
    V -->|"CAP-VIS- domain groups become"| DOM["DOM-ARCH- domains"]
    V -->|"tiers become"| LYR["LYR-ARCH- layers"]
    V -->|"SUC-VIS- become"| PERF["PERF-ARCH- targets"]
    V -->|"CON-VIS- become"| CONA["Architecture constraints"]
    CMP -->|"realised as"| CODE["Implementation - none yet"]
    CODE -.->|"evidence returns to"| V
```

> **Diagram ID:** `DGM-VIS-034` — **Vision-to-Architecture Derivation Map**
> **Explanation:** Nine derivation channels between the two constitutions. Each channel is a
> validation obligation: an `AOM-ARCH-001` element in any of these classes must name its vision
> origin. The dashed return edge is currently inert because no implementation exists.

### TBL-VIS-070: Capability to Component Mapping

| Vision capability | Architecture element | Element status in `AOM-ARCH-001` | Mapping confidence |
| :--- | :--- | :--- | :--- |
| `CAP-VIS-001` AI control plane | `CMP-ARCH-001` | Documented as implemented | **High** — direct |
| `CAP-VIS-002` Knowledge graph | `CMP-ARCH-002` | Documented as implemented | **High** |
| `CAP-VIS-003` Memory constitution | `CMP-ARCH-003` | Documented | **High** |
| `CAP-VIS-004` Metadata standard | `CMP-ARCH-004` | Documented as implemented | **High** |
| `CAP-VIS-005` Architecture specification | `CMP-ARCH-005` | Documented | **High** |
| `CAP-VIS-006` Decision records | `CMP-ARCH-006` | Documented as implemented | **High** |
| `CAP-VIS-007` Navigation | `CMP-ARCH-007` | Documented as implemented | **High** |
| `CAP-VIS-008` Identifier allocation | `CMP-ARCH-008` | Documented as implemented | **High** |
| `CAP-VIS-025`…`040` Platform | `CMP-ARCH-009`…`030` | All `PLANNED` | **Medium** — grouped, not one-to-one |
| `CAP-VIS-041`…`048` Domain | `DOM-ARCH-003` Financial Factory | `PLANNED` | **Medium** — domain-level only |
| `CAP-VIS-049`…`056` AI runtime | `UNMAPPED` | Not yet in `AOM-ARCH-001` Part 01 | **Gap — record for Part 02** |
| `CAP-VIS-009` Drift detection | `UNMAPPED` | Not yet componentised | **Gap — record for Part 02** |
| `CAP-VIS-064`…`070` Contexts | Partially in `DOM-ARCH-005`…`010` | `PROPOSED` | **Low** — names differ |

> **`VIS-067`.** Two explicit gaps are recorded: the AI runtime capability group
> (`CAP-VIS-049`…`056`) and drift detection (`CAP-VIS-009`) have **no corresponding component** in
> `AOM-ARCH-001` Part 01. These are obligations on Part 02 of the architecture document, not
> defects in this one. They are carried forward in `TBL-VIS-106`.

### TBL-VIS-071: Boundary to Trust Boundary Mapping

| Vision boundary | Architecture trust boundary | Note |
| :--- | :--- | :--- |
| `BND-VIS-006` Model provider | `TB-4` | Provider output treated as untrusted |
| `BND-VIS-007` Tenant | `TB-6` | Server-side enforcement required |
| `BND-VIS-008` Public API | `TB-1` | The primary external surface |
| `BND-VIS-009` Environment | `TB-8` | Production isolation |
| `BND-VIS-010` Secret | `TB-9` | Broker-mediated access |
| `BND-VIS-011` Domain context | `TB-5` | Contract-only crossing |
| `BND-VIS-015` Plugin | `TB-10` | Least privilege |
| `BND-VIS-001`…`005`, `012`…`014`, `016` | No trust-boundary equivalent | These are scope, knowledge, or autonomy boundaries, not trust boundaries — correctly absent |

### TBL-VIS-072: Principle to Invariant Mapping

| Vision principle | Architecture consequence | Note |
| :--- | :--- | :--- |
| `PRN-VIS-002` Determinism | `ARCH-038` — no `D-Free` component drives state | Direct enforcement |
| `PRN-VIS-006` Immutable decisions | `ARCH-041` — ADRs immutable once approved | Direct |
| `PRN-VIS-007` Stable identity | Identifier invariants across `INV-ARCH-` | Direct |
| `PRN-VIS-008` Human accountability | `AI-ARCH-041` — no unattended irreversible action | Direct |
| `PRN-VIS-016` Least privilege | Security posture across `SEC-ARCH-` | Direct |
| `PRN-VIS-017` Observability | `DOM-ARCH-004` Observability domain | Direct |
| `PRN-VIS-015` Vendor independence | `UNMAPPED` | **Gap** — no architectural invariant enforces provider abstraction |

### TBL-VIS-073: Tier to Layer Mapping

| Vision tier | Architecture layers | Note |
| :--- | :--- | :--- |
| T1 Foundational | `LYR-ARCH-001` | Governance and identity substrate |
| T2 Structural | `LYR-ARCH-002`, `LYR-ARCH-003` | Knowledge and specification layers |
| T3 Operational | `LYR-ARCH-004`, `LYR-ARCH-005` | Validation and process layers |
| T4 Platform | `LYR-ARCH-006`…`LYR-ARCH-008` | Runtime, data, integration |
| T5 Domain | `LYR-ARCH-009`, `LYR-ARCH-010` | Domain and experience layers |

> **`VIS-068`.** The tier-to-layer mapping is **not one-to-one by design**. Tiers express dependency
> order in the problem space; layers express structural placement in the solution space. Forcing
> them into bijection would corrupt one or the other. When they disagree, the tier governs *build
> order* and the layer governs *placement*.

---

## 01.18 — Requirements Derivation

### AI NAVIGATION METADATA — §01.18

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this is how vision becomes buildable work** |
| **AI DEPENDENCIES** | §01.4, §01.7, §01.17 |
| **AI INPUTS** | A vision element |
| **AI OUTPUTS** | One or more derived requirements with acceptance criteria |
| **AI IMPLEMENTATION IMPACT** | **Direct** — this is the transformation the whole document exists to enable |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-187`…`VAL-VIS-196` |
| **AI RELATED DOCUMENTS** | `docs/MASTER_CONTEXT/05_REQUIREMENTS/INDEX.md` |

### 01.18.1 The Derivation Algorithm

> **`DEC-VIS-010`.** Requirements are derived by a fixed algorithm, not by interpretation. The
> algorithm is stated here so that two different agents deriving requirements from the same vision
> element produce equivalent results — that reproducibility is the point.

```mermaid
flowchart TD
    S["Select a vision element"] --> A1{"Is it a CAP-VIS capability?"}
    A1 -->|"Yes"| C1["Derive one functional requirement per declared output"]
    A1 -->|"No"| A2{"Is it a PRN-VIS principle?"}
    A2 -->|"Yes"| C2["Derive a cross-cutting constraint applied to all components"]
    A2 -->|"No"| A3{"Is it a BND-VIS boundary?"}
    A3 -->|"Yes"| C3["Derive validation, authorisation and logging requirements at the crossing"]
    A3 -->|"No"| A4{"Is it an NG-VIS non-goal?"}
    A4 -->|"Yes"| C4["Derive a negative requirement - an assertion that must never hold"]
    A4 -->|"No"| A5{"Is it a SUC-VIS measure?"}
    A5 -->|"Yes"| C5["Derive an instrumentation requirement"]
    A5 -->|"No"| A6{"Is it a CON-VIS constraint?"}
    A6 -->|"Yes"| C6["Derive a design restriction with a rejection test"]
    A6 -->|"No"| SKIP["Not directly derivable - record as context only"]

    C1 --> ACC["Attach acceptance criteria - observable, binary, automatable"]
    C2 --> ACC
    C3 --> ACC
    C4 --> ACC
    C5 --> ACC
    C6 --> ACC
    ACC --> TRACE["Record the vision origin identifier on the requirement"]
```

> **Diagram ID:** `DGM-VIS-035` — **Requirements Derivation Algorithm**
> **Explanation:** Six element classes, six derivation rules, one common tail. The tail matters
> most: every derived requirement carries observable acceptance criteria and a back-reference to
> its vision origin. A requirement missing either is invalid. This is `DEC-VIS-011`.

### TBL-VIS-074: Derivation Rules by Element Class

| Element class | Produces | Cardinality | Acceptance criterion form |
| :--- | :--- | :--- | :--- |
| `CAP-VIS-` capability | Functional requirement | One per declared output | "Given X, the system produces Y" |
| `PRN-VIS-` principle | Cross-cutting constraint | One per applicable component | "No component may Z" |
| `BND-VIS-` boundary | Security or validation requirement | Three per boundary: validate, authorise, log | "A crossing without W is rejected" |
| `NG-VIS-` non-goal | Negative requirement | One per non-goal | "No artifact exists that does V" |
| `SUC-VIS-` measure | Instrumentation requirement | One per measure | "Metric M is emitted with labels L" |
| `CON-VIS-` constraint | Design restriction | One per constraint | "A design using P is rejected in review" |
| `ACT-VIS-` actor | Interface requirement | One per actor-capability pair | "Actor A can perform operation O" |
| `PROB-VIS-` problem | Verification requirement | One per problem | "The pain described is measurably reduced" |

### TBL-VIS-075: Worked Derivation Examples

| Vision origin | Derived requirement | Acceptance criterion | Automatable? |
| :--- | :--- | :--- | :---: |
| `CAP-VIS-001` output `NEXT_ACTION.md` | The control plane must expose the next unblocked action | A file exists naming exactly one next action with an owner | Yes |
| `PRN-VIS-002` determinism | No component may use unseeded randomness in state transitions | Static analysis finds no unseeded RNG in state paths | Yes |
| `BND-VIS-008` public API | Every public endpoint authenticates before processing | A request without credentials returns 401 in an automated test | Yes |
| `NG-VIS-024` no secrets in repository | No committed file contains a credential pattern | A secret scanner reports zero findings | Yes |
| `SUC-VIS-006` anchor integrity | Every internal anchor resolves | The anchor validator exits zero | Yes |
| `CON-VIS-011` single-owner governance | Every change has a reviewer distinct from the author | PR metadata shows author ≠ approver | **No** — currently impossible with one owner |
| `PROB-VIS-002` context starvation | An agent completes a task without clarification | Session log contains zero clarification requests | Yes, once instrumented |

> **`VIS-069`.** The `CON-VIS-011` row is deliberately marked non-automatable and non-satisfiable.
> With `CODEOWNERS` mapping every path to a single account (`EVD-VIS-018`), the requirement "author
> differs from approver" **cannot be met**. Recording an unsatisfiable derived requirement is
> correct behaviour: it makes the governance constraint visible rather than quietly dropping it.

### TBL-VIS-076: Derivation Quality Gates

| ID | Gate | Rejection condition |
| :--- | :--- | :--- |
| `DEC-VIS-012` | Origin present | The requirement names no vision identifier |
| `DEC-VIS-013` | Observable criterion | Acceptance cannot be evaluated by an outside party |
| `DEC-VIS-014` | Binary outcome | The criterion admits partial satisfaction without a defined threshold |
| `DEC-VIS-015` | No implementation smuggling | The requirement names a technology rather than an outcome |
| `DEC-VIS-016` | Non-duplication | An existing requirement already covers it |

---

## 01.19 — Strategic Constraints

### AI NAVIGATION METADATA — §01.19

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.10, §01.11 |
| **AI INPUTS** | A proposed design or plan |
| **AI OUTPUTS** | Constraints that restrict it, with rejection tests |
| **AI IMPLEMENTATION IMPACT** | Constraints eliminate design options before evaluation |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-197`…`VAL-VIS-200` |
| **AI RELATED DOCUMENTS** | `ADR-0001`, `AOM-ARCH-001` §01.19 |

### 01.19.1 Constraint Classes

> **`VIS-070`.** A constraint differs from a principle: a principle guides choice among acceptable
> options, a constraint **removes options from consideration**. Constraints are checked first
> because checking them is cheaper than evaluating a design that a constraint forbids.

### TBL-VIS-077: Structural and Governance Constraints

| ID | Constraint | Origin | Rejection test | Class | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CON-VIS-001` | No application code before Phase 0 exit | `ADR-0001` | Any file under `apps/` or `services/` beyond `.gitkeep` | Hard | **Active** |
| `CON-VIS-002` | Every document carries the 15-key frontmatter | `MCX-23-002` | Missing or extra keys | Hard | Active |
| `CON-VIS-003` | Top-level structure is fixed | `ADR-0001` | A new top-level directory without an ADR | Hard | Active |
| `CON-VIS-004` | Knowledge domain prefixes are unique two digits | `TBL-MCR-008` | A duplicate prefix | Hard | Active |
| `CON-VIS-005` | Identifiers are never reused | `PRN-VIS-007` | A retired identifier reappearing | Hard | Active |
| `CON-VIS-006` | Approved ADRs are immutable | `PRN-VIS-006` | Any diff to an approved ADR body | Hard | Active |
| `CON-VIS-007` | Accepted document parts are append-only | `NG-VIS-017` | A diff touching lines above a part marker | Hard | Active |
| `CON-VIS-008` | Every path has a CODEOWNER | `CAP-VIS-013` | An unowned path | Hard | Active |
| `CON-VIS-009` | Master Context is authoritative over other docs | `BND-VIS-002` | A conflicting claim outside Master Context treated as authoritative | Hard | Active |
| `CON-VIS-010` | All work occurs on a feature branch | Repository practice | A direct commit to `main` | Hard | Active |

### TBL-VIS-078: Resource and Capability Constraints

| ID | Constraint | Nature | Consequence | Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CON-VIS-011` | Governance is single-owner | Organisational | No independent review is possible; `ACT-VIS-016` is nominal | Broaden ownership, or record accepted risk | **Active — unmitigated** |
| `CON-VIS-012` | No automated enforcement exists | Technical | Every rule depends on discipline | `OUT-VIS-004` | **Active — unmitigated** |
| `CON-VIS-013` | No technology stack is selected | Technical | All T4 and T5 work is blocked | `OUT-VIS-006` | Active |
| `CON-VIS-014` | No compliance regime is identified | Legal | Domain design may be invalidated later | `OUT-VIS-011` | Active |
| `CON-VIS-015` | No inference provider is selected | Technical | `CAP-VIS-049` blocked | `OUT-VIS-014` | Active |
| `CON-VIS-016` | Agent context windows are finite | Technical | Documents must be navigable in fragments | Continuation protocol, section metadata | Active — mitigated |
| `CON-VIS-017` | Human review capacity is the throughput ceiling | Organisational | Agent output cannot exceed review bandwidth | Automate validation to reduce review load | Active |
| `CON-VIS-018` | Model behaviour varies across providers and versions | Technical | Determinism cannot be assumed from the model | Constrain via specification, validate output | Active |
| `CON-VIS-019` | No runtime exists to observe | Technical | All product measures are `NOT APPLICABLE` | `OUT-VIS-009` | Active |
| `CON-VIS-020` | Documentation volume risks exceeding human reading capacity | Practical | Humans rely on navigation, not reading | Strict section metadata and indexes | Active — mitigated |

### TBL-VIS-079: Constraints Adopted Voluntarily

These constraints are self-imposed rather than externally forced, and each buys a specific property.

| ID | Constraint | Property purchased | Cost accepted |
| :--- | :--- | :--- | :--- |
| `CON-VIS-021` | No dates in the specification | Immunity to calendar rot | Loss of schedule pressure |
| `CON-VIS-022` | No marketing language | Trustworthiness of every claim | Less persuasive to outsiders |
| `CON-VIS-023` | Explicit `UNKNOWN` labels | No fabrication | Visible incompleteness |
| `CON-VIS-024` | Ordered principles | Deterministic conflict resolution | Rigidity in edge cases |
| `CON-VIS-025` | Non-goals stated before roadmap | Scope defence | Appears negative |
| `CON-VIS-026` | Append-only parts | Stable anchors and references | Cannot restructure retroactively |
| `CON-VIS-027` | Visual density requirement | Comprehension at scale | Authoring effort |
| `CON-VIS-028` | Evidence references on claims | Verifiability | Slower authoring |
| `CON-VIS-029` | Closed status vocabulary | Machine-checkable maturity | Less nuance |
| `CON-VIS-030` | Human accountability on all irreversible acts | Trustworthy automation | Lower peak throughput |

```mermaid
flowchart TB
    subgraph HARD["Hard constraints - violation is a defect"]
        H1["CON-VIS-001 to 010 structural"]
    end
    subgraph REAL["Real limitations - unmitigated"]
        R1["CON-VIS-011 single owner"]
        R2["CON-VIS-012 no enforcement"]
        R3["CON-VIS-013 no stack"]
        R4["CON-VIS-014 no compliance regime"]
    end
    subgraph CHOSEN["Voluntary constraints - purchased properties"]
        C1["CON-VIS-021 to 030"]
    end
    HARD -->|"enforced by"| R2
    R2 -->|"weakened by"| R1
    R1 -->|"is itself an instance of"| GOV["Governance concentration risk"]
    CHOSEN -->|"only credible if"| R2
    R3 --> BLOCK["All T4 and T5 capability work"]
    R4 --> BLOCK2["All T5 domain design validity"]

    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    class R1,R2 bad
```

> **Diagram ID:** `DGM-VIS-036` — **Constraint Interaction Map**
> **Explanation:** The two red constraints compound. Hard constraints are supposed to be enforced
> by automation (`CON-VIS-012`), automation is absent, and the fallback — human review — is
> concentrated in one person (`CON-VIS-011`). The voluntary constraints in the bottom band are only
> credible once that loop is closed, which is why `OUT-VIS-004` outranks nearly everything else.

---

## 01.20 — Architectural Drift Prevention

### AI NAVIGATION METADATA — §01.20

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0** |
| **AI DEPENDENCIES** | §01.17, §01.19 |
| **AI INPUTS** | An observed difference between specification and reality |
| **AI OUTPUTS** | Drift classification, severity, and required response |
| **AI IMPLEMENTATION IMPACT** | Determines when work must stop to reconcile |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-025`…`VAL-VIS-036` cross-apply |
| **AI RELATED DOCUMENTS** | `PROB-VIS-004`, `AOM-ARCH-001` §01.20 |

### 01.20.1 Drift Taxonomy

> **`VIS-071`.** Drift is any divergence between what a specification asserts and what is true.
> Oship distinguishes six kinds because each has a different correct response, and applying the
> wrong response makes drift worse rather than better.

### TBL-VIS-080: Drift Kinds

| ID | Kind | Definition | Correct response | Wrong response |
| :--- | :--- | :--- | :--- | :--- |
| `VIS-072` | **Implementation drift** | Code does something the spec does not describe | Determine intent; update whichever is wrong | Assume code is right |
| `VIS-073` | **Specification drift** | Spec describes behaviour that was never built | Downgrade the status label | Build it reflexively |
| `VIS-074` | **Status drift** | A label says `IMPLEMENTED` but evidence is stale | Re-verify; downgrade if unconfirmed | Leave it and hope |
| `VIS-075` | **Reference drift** | A cross-reference points to something moved or renamed | Repair the reference; never renumber the target | Renumber the target |
| `VIS-076` | **Semantic drift** | The same term means different things in two documents | Define canonically; update both | Let context disambiguate |
| `VIS-077` | **Authority drift** | A lower-authority document contradicts a higher one and is followed | Enforce precedence; correct the lower | Merge the two views |

```mermaid
flowchart TD
    OBS["Divergence observed"] --> Q1{"Does code exist for this claim?"}
    Q1 -->|"No"| Q2{"Is the claim labelled PLANNED?"}
    Q2 -->|"Yes"| OK["Not drift - correct labelling"]
    Q2 -->|"No"| D1["STATUS DRIFT - downgrade the label immediately"]
    Q1 -->|"Yes"| Q3{"Does behaviour match the specification?"}
    Q3 -->|"Yes"| Q4{"Do referenced identifiers resolve?"}
    Q4 -->|"Yes"| OK2["No drift"]
    Q4 -->|"No"| D2["REFERENCE DRIFT - repair the reference"]
    Q3 -->|"No"| Q5{"Which is correct - the spec or the code?"}
    Q5 -->|"Spec"| D3["IMPLEMENTATION DRIFT - the code is defective"]
    Q5 -->|"Code"| D4["SPECIFICATION DRIFT - update the spec via change control"]
    Q5 -->|"Unclear"| ESC["HALT - escalate - do not guess which is authoritative"]
```

> **Diagram ID:** `DGM-VIS-037` — **Drift Classification Tree**
> **Explanation:** Five questions classify any divergence. The `Unclear` branch terminating in
> `HALT` is essential: an agent that cannot determine which side is correct must not pick one. That
> choice carries architectural authority the agent does not have. This is `DEC-VIS-006`.

### TBL-VIS-081: Drift Severity and Response

| Severity | Definition | Response | Work may continue? |
| :---: | :--- | :--- | :---: |
| **D0** | Cosmetic — formatting or wording | Fix opportunistically | Yes |
| **D1** | Reference — a link or identifier is stale | Fix in the current change | Yes |
| **D2** | Status — a label overstates reality | Downgrade immediately and record | Yes, after downgrade |
| **D3** | Behavioural — code and spec disagree on behaviour | Halt the affected work; reconcile | **No** for the affected area |
| **D4** | Structural — the architecture no longer matches the vision | Halt; require an ADR | **No** |
| **D5** | Constitutional — a principle or non-goal is being violated in practice | Halt all related work; escalate to the architect | **No** |

### 01.20.2 Prevention Mechanisms

### TBL-VIS-082: Drift Prevention Mechanisms and Their Current State

| ID | Mechanism | Prevents | Status | Gap |
| :--- | :--- | :--- | :--- | :--- |
| `VIS-078` | Closed status vocabulary | Status drift | `IMPLEMENTED` | Unenforced |
| `VIS-079` | Evidence references | Status drift | `PARTIALLY IMPLEMENTED` | No checker |
| `VIS-080` | Stable identifiers | Reference drift | `IMPLEMENTED` | — |
| `VIS-081` | Anchor validation | Reference drift | `IMPLEMENTED` locally | Not in CI |
| `VIS-082` | Canonical terminology | Semantic drift | `PARTIALLY IMPLEMENTED` | No glossary enforcement |
| `VIS-083` | Authority layering L1–L5 | Authority drift | `IMPLEMENTED` | Unenforced |
| `VIS-084` | Traceability matrix | Implementation drift | `DOCUMENTED` | Not machine-traversable yet |
| `VIS-085` | Append-only parts | Reference drift | `IMPLEMENTED` | Convention |
| `VIS-086` | ADR immutability | Authority drift | `IMPLEMENTED` | Convention |

> **`VIS-087`.** Seven of nine prevention mechanisms carry the word "unenforced", "convention", or
> "no checker" in their gap column. Drift prevention in Oship is currently **a set of habits**. The
> mechanisms are correctly designed and completely unautomated. This is the same finding as
> `PROB-VIS-017`, restated in the place where it does the most damage.

```mermaid
flowchart LR
    subgraph DESIGNED["Designed prevention"]
        M1["Status vocabulary"]
        M2["Evidence references"]
        M3["Stable identifiers"]
        M4["Traceability matrix"]
        M5["Authority layers"]
    end
    subgraph ENFORCE["Enforcement layer"]
        E1["CI validation - NOT INSTALLED"]:::bad
    end
    subgraph OUTCOME["Outcome"]
        O1["Drift prevented"]
        O2["Drift discovered late by a human"]:::warn
    end
    DESIGNED --> E1
    E1 -->|"if installed"| O1
    DESIGNED -.->|"today - bypasses enforcement"| O2

    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-038` — **Prevention Without Enforcement**
> **Explanation:** The designed mechanisms all route through an enforcement layer that does not
> exist, so in practice they take the dashed path and drift is discovered late by a human, if at
> all. This single diagram explains why `OUT-VIS-004` is ranked above every construction outcome.

---

## 01.21 — Vision Governance

### AI NAVIGATION METADATA — §01.21

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.10, §01.14 |
| **AI INPUTS** | A proposed change to this document |
| **AI OUTPUTS** | The required authority, process, and version effect |
| **AI IMPLEMENTATION IMPACT** | Governs how the constitution itself changes |
| **AI VALIDATION REQUIREMENTS** | Change-control rules below |
| **AI RELATED DOCUMENTS** | `MASTER_CONTEXT_RULES.md`, `.ai/DECISION_LOG.md` |

### 01.21.1 Authority Over This Document

### TBL-VIS-083: Change Authority Matrix

| Change type | Example | Required authority | Version effect | Process |
| :--- | :--- | :--- | :--- | :--- |
| Typographical | Fix a spelling error | Any contributor | None | Direct PR |
| Clarification | Reword without changing meaning | Maintainer | Patch | PR with review |
| Status update | `PLANNED` becomes `IMPLEMENTED` with evidence | Maintainer | Patch | PR with evidence link |
| Addition | New `CAP-VIS-` or `PROB-VIS-` entry | Architect | Minor | PR plus decision-log entry |
| New part | Append PART 02 | Architect | Minor | Append-only PR |
| Principle reorder | Change precedence in `TBL-VIS-046` | Architect | **Major** | ADR required |
| Vision statement change | Alter `VIS-013` | Architect | **Major** | ADR plus falsification review |
| Non-goal reversal | Lift a Conditional non-goal | Architect plus maintainer | **Major** | ADR citing the met reversal condition |
| Permanent non-goal change | Lift a `PERMANENT` non-goal | Supersede this document | **Major** | New document version |
| Deletion of any identified element | Remove a `CAP-VIS-` entry | Prohibited | — | Mark `DEPRECATED` instead |

> **`VIS-088`.** The final row is absolute. Identified elements are **never deleted**, only marked
> `DEPRECATED`. Deletion breaks every inbound reference and destroys the historical record of what
> was once intended, which is frequently the most valuable information in a specification.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT: DRAFT - being authored
    IN_PROGRESS: IN_PROGRESS - parts accepted, more expected
    REVIEW: REVIEW - complete, under evaluation
    RELEASED: RELEASED - authoritative
    SUPERSEDED: SUPERSEDED - replaced by a newer version
    DEPRECATED: DEPRECATED - no longer applicable

    DRAFT --> IN_PROGRESS: first part accepted
    IN_PROGRESS --> IN_PROGRESS: another part appended
    IN_PROGRESS --> REVIEW: final part appended
    REVIEW --> IN_PROGRESS: gaps found - more parts required
    REVIEW --> RELEASED: approved
    RELEASED --> SUPERSEDED: a new major version replaces it
    RELEASED --> DEPRECATED: the vision is abandoned
    SUPERSEDED --> [*]
    DEPRECATED --> [*]
```

> **Diagram ID:** `DGM-VIS-039` — **Vision Document Lifecycle**
> **Explanation:** `AOM-VIS-001` is currently in `IN_PROGRESS` with the self-loop active — Part 01
> is being appended. Note that `RELEASED` is not reachable from `IN_PROGRESS` directly; a review
> state intervenes, and review may push the document back for additional parts.

### TBL-VIS-084: Governance Roles for This Document

| Role | Held by | Powers | Limits |
| :--- | :--- | :--- | :--- |
| Author | `ACT-VIS-001`, `ACT-VIS-005` | Draft and append parts | Cannot approve own major change |
| Approver | `ACT-VIS-002` | Merge, release | Cannot alter approved ADRs |
| Constitutional authority | `ACT-VIS-016` | Change principles and vision statements | Requires an ADR; body is nominal today (`CON-VIS-011`) |
| Validator | `ACT-VIS-011` | Block a merge on validation failure | **Not operational** (`CON-VIS-012`) |
| Reader | All | Cite and rely on the document | Cannot amend |

> **`VIS-089`.** Two of five governance roles are non-operational: the constitutional authority is
> a single person acting as a body, and the validator does not exist. Governance of this document
> is therefore **weaker than the document's own authority level implies**. Recording that asymmetry
> is required by `PRN-VIS-001`.

---

## 01.22 — Change Management

### AI NAVIGATION METADATA — §01.22

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1** |
| **AI DEPENDENCIES** | §01.21 |
| **AI INPUTS** | An accepted change to vision content |
| **AI OUTPUTS** | The propagation set — every downstream artifact requiring update |
| **AI IMPLEMENTATION IMPACT** | Prevents partial propagation, the most common source of semantic drift |
| **AI VALIDATION REQUIREMENTS** | Propagation completeness check |
| **AI RELATED DOCUMENTS** | §01.17, §01.27 |

### 01.22.1 Propagation Rules

> **`VIS-090`.** A vision change is not complete when this document is edited. It is complete when
> every downstream artifact derived from the changed element has been updated or has an explicitly
> recorded exception. Partial propagation is worse than no change, because it creates contradiction
> between two authoritative documents.

### TBL-VIS-085: Propagation Matrix

| Changed element | Must review | Must update if affected | Notification |
| :--- | :--- | :--- | :--- |
| `VIS-` statement | `AOM-ARCH-001`, `.ai/`, domain indexes | Derived principles, outcomes | Decision log |
| `PROB-VIS-` problem | Capability register, outcomes | Capabilities claiming to solve it | Decision log |
| `ACT-VIS-` actor | Responsibility matrix, capability actors, journeys | All capabilities naming the actor | Decision log |
| `CAP-VIS-` capability | Architecture components, tiers, outcomes | `TBL-VIS-070` mapping, requirements | Decision log plus ADR if T4 or T5 |
| `PRN-VIS-` principle | All design documents | Precedence table, conflict tree | **ADR required** |
| `NG-VIS-` non-goal | Roadmap, capability register | Screening gate | **ADR required** |
| `BND-VIS-` boundary | Security documents, trust boundary mapping | Derived security requirements | ADR if a trust boundary |
| `SUC-VIS-` measure | `.ai/METRICS.md` | Instrumentation requirements | Decision log |
| `CON-VIS-` constraint | All planning | Blocked capability lists | ADR if hard |
| `OUT-VIS-` outcome | `.ai/NEXT_ACTION.md`, `19_ROADMAP` | Dependency network | Decision log |

```mermaid
sequenceDiagram
    participant P as Proposer
    participant V as AOM-VIS-001
    participant D as Decision log or ADR
    participant A as AOM-ARCH-001
    participant C as .ai control plane
    participant R as Requirements

    P->>V: proposes a change to an identified element
    V->>V: classify per TBL-VIS-083
    alt major change
        V->>D: ADR required before edit
        D-->>V: approved decision recorded
    else minor or patch
        V->>D: decision-log entry
    end
    V->>V: append or amend per authority rules
    V->>A: compute the propagation set
    A-->>V: affected architecture elements listed
    V->>R: regenerate derived requirements
    V->>C: update status, context, next action
    Note over V,C: change is complete only when every arrow above has returned
```

> **Diagram ID:** `DGM-VIS-040` — **Change Propagation Sequence**
> **Explanation:** The closing note is the enforceable rule. A change that edits this document but
> skips the architecture, requirements, or control-plane arrows has produced drift on purpose. Each
> arrow is a checklist item for the change's reviewer.

### TBL-VIS-086: Change Anti-Patterns

| Anti-pattern | Damage | Correct behaviour |
| :--- | :--- | :--- |
| Editing vision text without a decision record | The reason for the change is lost | Record even trivial rationale |
| Updating vision but not architecture | Two authoritative documents disagree | Compute and complete the propagation set |
| Silently strengthening a status label | Fabrication by increment | Attach evidence or leave it |
| Adding a capability without a problem | Unjustified scope growth | Register the problem first |
| Renumbering identifiers for tidiness | Breaks every inbound reference | Accept gaps; they are meaningful |
| Rewriting an earlier part to stay consistent | Violates `CON-VIS-007` | Append a correction with a forward reference |
| Deferring propagation to "later" | Later never arrives; drift compounds | Propagate in the same change |

---

## 01.23 — AI Interpretation Guide

### AI NAVIGATION METADATA — §01.23

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — if you read only one section, read this one** |
| **AI DEPENDENCIES** | All preceding sections |
| **AI INPUTS** | A task assigned to an agent |
| **AI OUTPUTS** | An executable interpretation procedure |
| **AI IMPLEMENTATION IMPACT** | Governs how every other section is used |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-153`…`VAL-VIS-166` |
| **AI RELATED DOCUMENTS** | `.ai/AI_AGENT_OPERATING_MANUAL.md`, `.ai/CONTEXT_ROUTER.md` |

### 01.23.1 The AI Vision Boot Sequence

> **`AI-VIS-045`.** Execute this sequence before any task that touches Oship. It is ordered, and
> each step has a defined failure action. Skipping a step is not an optimisation; it is the
> mechanism by which `PROB-VIS-002` produces defects.

```mermaid
flowchart TD
    B0["BOOT 0 - read .ai CURRENT_CONTEXT and NEXT_ACTION"] --> B1["BOOT 1 - read this section 01.23"]
    B1 --> B2["BOOT 2 - read 01.11 non-goals - screen the task"]
    B2 --> G1{"Task matches a PERMANENT non-goal?"}
    G1 -->|"Yes"| HALT1["HALT - refuse and cite the NG-VIS id"]
    G1 -->|"No"| B3["BOOT 3 - read 01.14 phase table - is the work legal now?"]
    B3 --> G2{"Legal in the current phase?"}
    G2 -->|"No"| HALT2["HALT - cite TBL-VIS-060"]
    G2 -->|"Yes"| B4["BOOT 4 - identify the PROB-VIS problem and ACT-VIS actor served"]
    B4 --> G3{"Both identified?"}
    G3 -->|"No"| HALT3["HALT - unjustified work - PRN-VIS-004"]
    G3 -->|"Yes"| B5["BOOT 5 - locate the CAP-VIS capability and read its status"]
    B5 --> G4{"Status is IMPLEMENTED or PARTIALLY IMPLEMENTED?"}
    G4 -->|"No"| B5a["Treat as specification work only - never generate calls into it"]
    G4 -->|"Yes"| B6["BOOT 6 - read AOM-ARCH-001 for the mapped component"]
    B5a --> B6
    B6 --> B7["BOOT 7 - check the autonomy boundary DGM-VIS-023"]
    B7 --> B8["BOOT 8 - execute, recording every assumption"]
    B8 --> B9["BOOT 9 - validate against 01.24"]
    B9 --> B10["BOOT 10 - update the control plane and hand off"]
```

> **Diagram ID:** `DGM-VIS-041` — **AI Vision Boot Sequence**
> **Explanation:** Eleven steps with three halt conditions in the first five. The design intent is
> that most invalid work is rejected before any generation occurs — refusing early is far cheaper
> than reviewing a plausible-looking wrong answer. This is `DEC-VIS-007`.

### TBL-VIS-087: Boot Step Reference

| Step | Action | Reads | Failure action |
| :---: | :--- | :--- | :--- |
| 0 | Load current state | `.ai/CURRENT_CONTEXT.md`, `.ai/NEXT_ACTION.md` | If absent, halt — the control plane is the entry point |
| 1 | Load interpretation rules | This section | Cannot proceed without it |
| 2 | Non-goal screening | §01.11 | Refuse with the `NG-VIS-` citation |
| 3 | Phase legality | `TBL-VIS-060` | Refuse with the phase citation |
| 4 | Justification | §01.4, §01.5 | Refuse; request that a problem be registered |
| 5 | Capability status | §01.7 | Downgrade the task to specification work |
| 6 | Architecture mapping | `AOM-ARCH-001`, `TBL-VIS-070` | If `UNMAPPED`, record the gap and continue |
| 7 | Autonomy check | `DGM-VIS-023` | If outside, halt and request approval |
| 8 | Execute | Task-specific | Record every assumption made |
| 9 | Validate | §01.24 | Fix failures before handing off |
| 10 | Hand off | `.ai/` files | Never end a work unit without this |

### 01.23.2 Interpretation Rules

### TBL-VIS-088: How to Read Each Element Type

| Element | Read it as | Never read it as |
| :--- | :--- | :--- |
| `VIS-` statement | A binding assertion about intent | A suggestion |
| `PROB-VIS-` | The justification for work | A description of current system behaviour |
| `ACT-VIS-` with `PLANNED` | A future user; requirements are speculative | An existing user to build for now |
| `CAP-VIS-` with `PLANNED` | A specification target | Something callable |
| `CAP-VIS-` with `IMPLEMENTED` | Something you can rely on | Something you may change freely |
| `PRN-VIS-` | An ordered tiebreaker | A slogan |
| `NG-VIS-` `PERMANENT` | An absolute prohibition | A default that can be argued |
| `NG-VIS-` Conditional | A prohibition with a stated escape | A soft preference |
| `CON-VIS-` | An option eliminator applied before design | A risk to manage |
| `SUC-VIS-` `NOT YET MEASURED` | An honest gap | An implied pass |
| `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | An instruction to verify or escalate | Permission to assume |
| A gap in identifier numbering | Intentional and meaningful | An error to backfill |

### TBL-VIS-089: Mandatory Agent Behaviours

| ID | Behaviour | Trigger | Required action |
| :--- | :--- | :--- | :--- |
| `AI-VIS-046` | Halt on contradiction | Two authoritative statements conflict | State both, cite both, request a decision |
| `AI-VIS-047` | Halt on missing evidence for a strong claim | A claim asserts implementation with no evidence | Downgrade the status or escalate |
| `AI-VIS-048` | Record assumptions | Any inference not directly stated | Write it into the change description |
| `AI-VIS-049` | Prefer refusal to fabrication | A required fact is unavailable | Write `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` |
| `AI-VIS-050` | Cite authority for every action | Any change | Name the `VIS-`, `CAP-VIS-`, or `OUT-VIS-` that authorises it |
| `AI-VIS-051` | Respect append-only | Editing a document with parts | Append; never restructure |
| `AI-VIS-052` | Allocate, never reuse | Needing a new identifier | Take the next free number from the namespace register |
| `AI-VIS-053` | Verify before upgrading status | Changing `PLANNED` to `IMPLEMENTED` | Attach an inspectable artifact reference |
| `AI-VIS-054` | Use the continuation protocol | Approaching a context limit | Emit the continuation marker; do not summarise and restart |
| `AI-VIS-055` | Report unmapped elements | An element has no counterpart document | Record the gap explicitly rather than inventing a mapping |
| `AI-VIS-056` | Never claim completion of a part you did not finish | End of a work unit | State exactly what was and was not completed |
| `AI-VIS-057` | Treat model output as untrusted input | Consuming any generated content | Validate before it influences state (`BND-VIS-006`) |
| `AI-VIS-058` | Escalate spending and external effects | An action costs money or leaves the sandbox | Human approval required |
| `AI-VIS-059` | Preserve the reader who cannot ask | Writing anything | Prefer explicitness over elegance (`PRN-VIS-005`) |
| `AI-VIS-060` | Leave the repository more navigable than you found it | Every change | Update indexes and cross-references |

### 01.23.3 Common Misinterpretations

### TBL-VIS-090: Misinterpretation Register

| Statement in this document | Wrong interpretation | Correct interpretation |
| :--- | :--- | :--- |
| "Oship is an AI-native software factory" | A running product exists | A repository and method exist; no runtime does |
| "The Money Factory domain" | Financial processing is implemented | It is the named target domain, entirely `PLANNED` |
| "24 knowledge domains" | 24 domains are fully documented | 24 have index files; most content is `PLANNED` |
| "Governance is enforced" | CI blocks violations | Governance is advisory; CI is not installed |
| "Agents implement the system" | Agents work autonomously | Agents work within an approval boundary |
| "100+ validation rules" | Rules are executed automatically | Rules are written; execution is `PLANNED` |
| "Architecture is defined" | Architecture is complete | Part 01 of a multi-part document is complete |
| "Traceability matrix" | A queryable database exists | A tabular mapping exists in Markdown |

---

## 01.24 — Validation Rules

### AI NAVIGATION METADATA — §01.24

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — run these before submitting any change** |
| **AI DEPENDENCIES** | All preceding sections |
| **AI INPUTS** | A change, a document, or the repository state |
| **AI OUTPUTS** | Pass or fail per rule, with the failing element identified |
| **AI IMPLEMENTATION IMPACT** | Defines what the CI in `OUT-VIS-004` must implement |
| **AI VALIDATION REQUIREMENTS** | Self-referential — this section is the requirement set |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.24 `VAL-ARCH-` rules |

> **`VIS-091`.** These rules are written to be **mechanically checkable**. Each states a subject, a
> condition, and a severity. Rules marked **BLOCKING** must prevent a merge once `OUT-VIS-004` is
> delivered. Rules marked **ADVISORY** produce warnings. **None of these rules is currently
> executed automatically** — see `CON-VIS-012`.

### TBL-VIS-091: Validation Rules — Document Structure (`VAL-VIS-001`…`VAL-VIS-024`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-001` | The document has YAML frontmatter with exactly the 15 canonical keys | BLOCKING |
| `VAL-VIS-002` | `document_id` matches `AOM-VIS-001` and appears nowhere else in the repository | BLOCKING |
| `VAL-VIS-003` | `version` follows semantic versioning | BLOCKING |
| `VAL-VIS-004` | `status` is a member of the closed status vocabulary | BLOCKING |
| `VAL-VIS-005` | Every heading level increases by at most one from its parent | ADVISORY |
| `VAL-VIS-006` | Every internal anchor link resolves to an existing heading | BLOCKING |
| `VAL-VIS-007` | Every Mermaid block parses without error | BLOCKING |
| `VAL-VIS-008` | Every Mermaid block is followed by a `Diagram ID` line | BLOCKING |
| `VAL-VIS-009` | Every Mermaid block is followed by an `Explanation` line | BLOCKING |
| `VAL-VIS-010` | Every table with an identifier column has a `Table ID` or an inline `TBL-VIS-` heading | ADVISORY |
| `VAL-VIS-011` | No section exceeds 120 lines without an intervening visual | ADVISORY |
| `VAL-VIS-012` | Every major section has the seven-row AI navigation metadata table | BLOCKING |
| `VAL-VIS-013` | No claim uses present tense for `PLANNED` behaviour | BLOCKING |
| `VAL-VIS-014` | The table of contents lists every top-level section present | BLOCKING |
| `VAL-VIS-015` | No heading text is duplicated within the document | BLOCKING |
| `VAL-VIS-016` | Code fences are balanced | BLOCKING |
| `VAL-VIS-017` | No trailing whitespace on identifier lines | ADVISORY |
| `VAL-VIS-018` | The document contains a continuation marker if incomplete | BLOCKING |
| `VAL-VIS-019` | Part markers appear in ascending order | BLOCKING |
| `VAL-VIS-020` | No content appears above the first part marker after part 01 | BLOCKING |
| `VAL-VIS-021` | Every external file path referenced exists in the repository | BLOCKING |
| `VAL-VIS-022` | No absolute filesystem paths outside the repository are referenced | BLOCKING |
| `VAL-VIS-023` | No date appears as a commitment in a success or outcome table | BLOCKING |
| `VAL-VIS-024` | Frontmatter `last_updated` is not in the future | ADVISORY |

### TBL-VIS-092: Validation Rules — Problem Space (`VAL-VIS-025`…`VAL-VIS-036`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-025` | Every `PROB-VIS-` entry has all eleven mandatory fields | BLOCKING |
| `VAL-VIS-026` | Every `PROB-VIS-` names at least one `ACT-VIS-` actor | BLOCKING |
| `VAL-VIS-027` | Every `PROB-VIS-` names at least one `CAP-VIS-` response or states `NONE` | BLOCKING |
| `VAL-VIS-028` | Every `PROB-VIS-` priority is one of CRITICAL, HIGH, MEDIUM, LOW | BLOCKING |
| `VAL-VIS-029` | Every `PROB-VIS-` status is from the closed vocabulary | BLOCKING |
| `VAL-VIS-030` | No `PROB-VIS-` claims mitigation by a `PLANNED` capability without saying so | BLOCKING |
| `VAL-VIS-031` | Every `PROB-VIS-` has an evidence reference or `UNKNOWN` | BLOCKING |
| `VAL-VIS-032` | Family B problems are never described as under active mitigation | BLOCKING |
| `VAL-VIS-033` | No two `PROB-VIS-` entries describe the same problem | ADVISORY |
| `VAL-VIS-034` | Every `PROB-VIS-` identifier is unique | BLOCKING |
| `VAL-VIS-035` | Problem identifiers are never reused after deprecation | BLOCKING |
| `VAL-VIS-036` | Each drift kind in `TBL-VIS-080` has a defined response | BLOCKING |

### TBL-VIS-093: Validation Rules — Actors (`VAL-VIS-037`…`VAL-VIS-046`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-037` | Every `ACT-VIS-` states whether it exists today | BLOCKING |
| `VAL-VIS-038` | Every existing actor has an evidence reference | BLOCKING |
| `VAL-VIS-039` | Every actor appears in the responsibility matrix | ADVISORY |
| `VAL-VIS-040` | No agent actor holds an accountable **A** role | BLOCKING |
| `VAL-VIS-041` | Every capability names at least one actor | BLOCKING |
| `VAL-VIS-042` | No requirement is derived for a `PROPOSED` actor without a label | BLOCKING |
| `VAL-VIS-043` | Autonomy classes A0–A4 are each defined | BLOCKING |
| `VAL-VIS-044` | Class A4 is marked `PROHIBITED` | BLOCKING |
| `VAL-VIS-045` | Every actor identifier is unique | BLOCKING |
| `VAL-VIS-046` | Actor journeys reference only registered actors | ADVISORY |

### TBL-VIS-094: Validation Rules — Value and Capabilities (`VAL-VIS-047`…`VAL-VIS-078`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-047` | Every value claim is expressible as cost reduction or output increase | BLOCKING |
| `VAL-VIS-048` | No rejected value-claim form from `TBL-VIS-027` appears in the document | ADVISORY |
| `VAL-VIS-049` | Every `VAL-CHAIN-VIS-` stage names an owner | BLOCKING |
| `VAL-VIS-050` | Every value chain stage states its maturity | BLOCKING |
| `VAL-VIS-051` | The value chain forms a closed loop | ADVISORY |
| `VAL-VIS-052` | Every value matrix row names the asset's capability | ADVISORY |
| `VAL-VIS-053` | No value is claimed for an actor that does not exist without a label | BLOCKING |
| `VAL-VIS-054` | Value realisation phases align with `TBL-VIS-059` | ADVISORY |
| `VAL-VIS-055` | Every value chain stage has at least one success measure | ADVISORY |
| `VAL-VIS-056` | No stage is claimed `IMPLEMENTED` without evidence | BLOCKING |
| `VAL-VIS-057` | Every `CAP-VIS-` has all eleven mandatory fields | BLOCKING |
| `VAL-VIS-058` | Every capability declares at least one output | BLOCKING |
| `VAL-VIS-059` | No capability declares zero actors | BLOCKING |
| `VAL-VIS-060` | Every capability dependency resolves to a registered capability | BLOCKING |
| `VAL-VIS-061` | No capability depends on a higher tier | BLOCKING |
| `VAL-VIS-062` | Every capability has a tier assignment | BLOCKING |
| `VAL-VIS-063` | Every capability status is from the closed vocabulary | BLOCKING |
| `VAL-VIS-064` | `IMPLEMENTED` capabilities carry an evidence reference | BLOCKING |
| `VAL-VIS-065` | Every capability maps to an architecture element or is marked `UNMAPPED` | BLOCKING |
| `VAL-VIS-066` | No capability names a specific technology | ADVISORY |
| `VAL-VIS-067` | Capability identifiers are unique and never reused | BLOCKING |
| `VAL-VIS-068` | Every capability traces to at least one problem | BLOCKING |
| `VAL-VIS-069` | No `PLANNED` capability is referenced as callable | BLOCKING |
| `VAL-VIS-070` | Capability groups are internally consistent in tier | ADVISORY |
| `VAL-VIS-071` | Every domain capability names its bounded context | BLOCKING |
| `VAL-VIS-072` | Every capability has an AI impact note | BLOCKING |
| `VAL-VIS-073` | Blocking chains terminate in an actionable root | BLOCKING |
| `VAL-VIS-074` | No capability is both `IMPLEMENTED` and blocked | BLOCKING |
| `VAL-VIS-075` | Capability counts in summary tables match the register | BLOCKING |
| `VAL-VIS-076` | Deprecated capabilities remain listed with a `DEPRECATED` status | BLOCKING |
| `VAL-VIS-077` | No capability is deleted from the register | BLOCKING |
| `VAL-VIS-078` | Every capability's business value cites a value chain stage | ADVISORY |

### TBL-VIS-095: Validation Rules — Hierarchy, Boundaries, Principles (`VAL-VIS-079`…`VAL-VIS-112`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-079` | Every tier is defined with its dependency rule | BLOCKING |
| `VAL-VIS-080` | Tier assignments cover every registered capability | BLOCKING |
| `VAL-VIS-081` | No upward tier dependency exists | BLOCKING |
| `VAL-VIS-082` | The decomposition tree contains no orphan node | ADVISORY |
| `VAL-VIS-083` | Every blocked capability names its blocker | BLOCKING |
| `VAL-VIS-084` | Every blocker resolves to an outcome or constraint | BLOCKING |
| `VAL-VIS-085` | Tier-to-layer mapping covers all five tiers | BLOCKING |
| `VAL-VIS-086` | No tier is empty without explanation | ADVISORY |
| `VAL-VIS-087` | Aggregate tier statuses match individual capability statuses | BLOCKING |
| `VAL-VIS-088` | Build-order claims respect tier ordering | BLOCKING |
| `VAL-VIS-089` | Every `BND-VIS-` states its kind | BLOCKING |
| `VAL-VIS-090` | Every boundary states its crossing rule | BLOCKING |
| `VAL-VIS-091` | Every trust boundary maps to a `TB-` in `AOM-ARCH-001` or is marked absent | BLOCKING |
| `VAL-VIS-092` | Model provider output is classified untrusted | BLOCKING |
| `VAL-VIS-093` | Tenant isolation is never delegated to caller-supplied scope | BLOCKING |
| `VAL-VIS-094` | Secrets are excluded from source, logs, and model context | BLOCKING |
| `VAL-VIS-095` | Every autonomy boundary rule states a decider | BLOCKING |
| `VAL-VIS-096` | Irreversible actions are assigned to humans | BLOCKING |
| `VAL-VIS-097` | The boundary decision tree terminates on every path | BLOCKING |
| `VAL-VIS-098` | No boundary is defined without a status | BLOCKING |
| `VAL-VIS-099` | Knowledge boundaries use the `UNKNOWN` label form | BLOCKING |
| `VAL-VIS-100` | Boundary identifiers are unique | BLOCKING |
| `VAL-VIS-101` | Principles are explicitly ordered by precedence | BLOCKING |
| `VAL-VIS-102` | No two principles share a rank | BLOCKING |
| `VAL-VIS-103` | Every principle states a consequence when applied | BLOCKING |
| `VAL-VIS-104` | Every principle cites a source | ADVISORY |
| `VAL-VIS-105` | The conflict resolution tree covers the top five principles | BLOCKING |
| `VAL-VIS-106` | Escalation is a reachable terminal state | BLOCKING |
| `VAL-VIS-107` | Known principle tensions are documented rather than denied | ADVISORY |
| `VAL-VIS-108` | No principle contradicts a hard constraint | BLOCKING |
| `VAL-VIS-109` | Principle identifiers are unique and never reused | BLOCKING |
| `VAL-VIS-110` | Principles are referenced by derived requirements | ADVISORY |
| `VAL-VIS-111` | No principle is stated only as a slogan | ADVISORY |
| `VAL-VIS-112` | Determinism and accountability principles are present | BLOCKING |

### TBL-VIS-096: Validation Rules — Non-Goals, Success, Outcomes (`VAL-VIS-113`…`VAL-VIS-152`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-113` | Every `NG-VIS-` states why it is excluded | BLOCKING |
| `VAL-VIS-114` | Every `NG-VIS-` states a reversal condition or is `PERMANENT` | BLOCKING |
| `VAL-VIS-115` | No `PERMANENT` non-goal has a reversal condition | BLOCKING |
| `VAL-VIS-116` | The screening gate rejects by default | BLOCKING |
| `VAL-VIS-117` | Every registered capability passes the screening gate | BLOCKING |
| `VAL-VIS-118` | Autonomous objective selection is prohibited | BLOCKING |
| `VAL-VIS-119` | Fabrication and status inflation are prohibited | BLOCKING |
| `VAL-VIS-120` | Repetition for volume is prohibited | BLOCKING |
| `VAL-VIS-121` | Non-goal identifiers are unique | BLOCKING |
| `VAL-VIS-122` | Frequently misread non-goals carry a clarification | ADVISORY |
| `VAL-VIS-123` | Every `SUC-VIS-` names a subject, instrument, and current value | BLOCKING |
| `VAL-VIS-124` | Every measure states its direction | BLOCKING |
| `VAL-VIS-125` | Every measure states a threshold or `to be set` | BLOCKING |
| `VAL-VIS-126` | Every measure names an owner | BLOCKING |
| `VAL-VIS-127` | Unmeasured measures read `NOT YET MEASURED` | BLOCKING |
| `VAL-VIS-128` | Measures requiring a runtime read `NOT APPLICABLE` | BLOCKING |
| `VAL-VIS-129` | No measure implies a value it does not have | BLOCKING |
| `VAL-VIS-130` | Rejected anti-measures are listed | ADVISORY |
| `VAL-VIS-131` | Leading, lagging, and outcome layers are distinguished | ADVISORY |
| `VAL-VIS-132` | Measure identifiers are unique | BLOCKING |
| `VAL-VIS-133` | No measure uses lines of documentation as a proxy for value | BLOCKING |
| `VAL-VIS-134` | Instrumentation gaps are stated explicitly | BLOCKING |
| `VAL-VIS-135` | Every `OUT-VIS-` states preconditions | BLOCKING |
| `VAL-VIS-136` | Every outcome states a completion test | BLOCKING |
| `VAL-VIS-137` | No outcome states a date | BLOCKING |
| `VAL-VIS-138` | Every outcome's preconditions resolve to registered outcomes or `NONE` | BLOCKING |
| `VAL-VIS-139` | The outcome dependency graph is acyclic | BLOCKING |
| `VAL-VIS-140` | At least one outcome has no preconditions | BLOCKING |
| `VAL-VIS-141` | Outcome statuses are from the closed vocabulary | BLOCKING |
| `VAL-VIS-142` | Completion tests are externally observable | BLOCKING |
| `VAL-VIS-143` | Outcome identifiers are unique | BLOCKING |
| `VAL-VIS-144` | Sequencing rationale is documented | ADVISORY |
| `VAL-VIS-145` | Every phase states exit criteria | BLOCKING |
| `VAL-VIS-146` | Exactly one phase is marked CURRENT | BLOCKING |
| `VAL-VIS-147` | The phase legality table covers every activity class | BLOCKING |
| `VAL-VIS-148` | Backward phase transitions are permitted and documented | BLOCKING |
| `VAL-VIS-149` | Stability classes are defined for all content types | ADVISORY |
| `VAL-VIS-150` | Evolution triggers name a detector and a response | BLOCKING |
| `VAL-VIS-151` | Phases map to architecture maturity states | ADVISORY |
| `VAL-VIS-152` | No activity is permitted in a phase that precedes its dependencies | BLOCKING |

### TBL-VIS-097: Validation Rules — AI, Traceability, Governance (`VAL-VIS-153`…`VAL-VIS-200`)

| ID | Rule | Severity |
| :--- | :--- | :--- |
| `VAL-VIS-153` | The AI-native definition states necessary and sufficient conditions | BLOCKING |
| `VAL-VIS-154` | Unsatisfied AI-native conditions are stated as unsatisfied | BLOCKING |
| `VAL-VIS-155` | The authority inversion is explicit | BLOCKING |
| `VAL-VIS-156` | The agent contract lists system obligations and their statuses | BLOCKING |
| `VAL-VIS-157` | Agent obligations list their enforcement mechanism | BLOCKING |
| `VAL-VIS-158` | Unenforced obligations are labelled as such | BLOCKING |
| `VAL-VIS-159` | The boot sequence is ordered and terminates | BLOCKING |
| `VAL-VIS-160` | Every boot step states a failure action | BLOCKING |
| `VAL-VIS-161` | Mandatory agent behaviours are enumerated | BLOCKING |
| `VAL-VIS-162` | Misinterpretations are catalogued with corrections | ADVISORY |
| `VAL-VIS-163` | Every element type has a reading rule | BLOCKING |
| `VAL-VIS-164` | The document never claims full AI-nativeness while condition 9 fails | BLOCKING |
| `VAL-VIS-165` | Collaboration anti-patterns are enumerated | ADVISORY |
| `VAL-VIS-166` | Task allocation is determined by judgement type | BLOCKING |
| `VAL-VIS-167` | Every allocation rule names a decider | BLOCKING |
| `VAL-VIS-168` | Human accountability is preserved in every pattern | BLOCKING |
| `VAL-VIS-169` | No pattern permits unattended irreversible action | BLOCKING |
| `VAL-VIS-170` | Collaboration patterns state their status | BLOCKING |
| `VAL-VIS-171` | Escalation is available in every pattern | BLOCKING |
| `VAL-VIS-172` | Anti-patterns state a correct alternative | BLOCKING |
| `VAL-VIS-173` | Leverage distribution distinguishes human, shared, and agent work | ADVISORY |
| `VAL-VIS-174` | Recorded decisions accompany every human decision pattern | BLOCKING |
| `VAL-VIS-175` | Agents never approve their own work | BLOCKING |
| `VAL-VIS-176` | Context-limit handling uses the continuation protocol | BLOCKING |
| `VAL-VIS-177` | Every architecture mapping states a confidence level | ADVISORY |
| `VAL-VIS-178` | Unmapped capabilities are recorded as gaps | BLOCKING |
| `VAL-VIS-179` | This document never modifies `AOM-ARCH-001` | BLOCKING |
| `VAL-VIS-180` | Every derivation channel in `DGM-VIS-034` has at least one mapping table | BLOCKING |
| `VAL-VIS-181` | Trust boundary mappings are complete or explicitly absent | BLOCKING |
| `VAL-VIS-182` | Principle-to-invariant gaps are recorded | BLOCKING |
| `VAL-VIS-183` | Tier-to-layer mapping is not forced into bijection | ADVISORY |
| `VAL-VIS-184` | Architecture element statuses are quoted, not restated | ADVISORY |
| `VAL-VIS-185` | Gaps become obligations on a future part | BLOCKING |
| `VAL-VIS-186` | No architecture identifier is invented in this document | BLOCKING |
| `VAL-VIS-187` | The derivation algorithm covers every element class | BLOCKING |
| `VAL-VIS-188` | Every derived requirement names its vision origin | BLOCKING |
| `VAL-VIS-189` | Every derived requirement has an observable acceptance criterion | BLOCKING |
| `VAL-VIS-190` | Acceptance criteria are binary or thresholded | BLOCKING |
| `VAL-VIS-191` | No requirement names a technology | BLOCKING |
| `VAL-VIS-192` | Unsatisfiable derived requirements are recorded, not dropped | BLOCKING |
| `VAL-VIS-193` | Derivation quality gates are enumerated | BLOCKING |
| `VAL-VIS-194` | Worked examples exist for each element class | ADVISORY |
| `VAL-VIS-195` | Duplicate requirements are rejected | BLOCKING |
| `VAL-VIS-196` | Requirements are reproducible across agents | BLOCKING |
| `VAL-VIS-197` | Every `CON-VIS-` states a rejection test | BLOCKING |
| `VAL-VIS-198` | Unmitigated constraints are labelled unmitigated | BLOCKING |
| `VAL-VIS-199` | Voluntary constraints state the cost accepted | ADVISORY |
| `VAL-VIS-200` | No constraint is stated without an origin | BLOCKING |

> **`VIS-092`.** Two hundred rules are defined; **173 are BLOCKING and 27 ADVISORY**; **zero are
> executed automatically**. The gap between rule count and execution count is the single most
> actionable number in this document.

```mermaid
flowchart LR
    R["200 validation rules defined"] --> S{"Automated checker exists?"}
    S -->|"Mermaid parsing - yes, locally"| A1["VAL-VIS-007 checked"]
    S -->|"Anchor resolution - yes, locally"| A2["VAL-VIS-006 checked"]
    S -->|"All others - no"| A3["197 rules unchecked"]:::bad
    A1 --> CI{"Runs in CI?"}
    A2 --> CI
    CI -->|"No"| MANUAL["Checked only when an agent chooses to run them"]:::warn
    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-042` — **Validation Coverage Reality**
> **Explanation:** Of 200 rules, two have working local checkers and neither runs in CI. This is
> presented without softening because softening it would itself violate `VAL-VIS-013`.

---

## 01.25 — Failure and Anti-Pattern Library

### AI NAVIGATION METADATA — §01.25

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before writing, and again when something feels wrong** |
| **AI DEPENDENCIES** | §01.4 problems, §01.11 non-goals, §01.20 drift, §01.24 validation |
| **AI INPUTS** | An observed symptom in the repository or in a proposed change |
| **AI OUTPUTS** | A named failure, its cause, and its remediation |
| **AI IMPLEMENTATION IMPACT** | Each entry is a candidate automated check for `OUT-VIS-004` |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-036`, `VAL-VIS-119`, `VAL-VIS-165`, `VAL-VIS-172` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.25 `FAL-ARCH-` library, `.ai/COMMON_MISTAKES.md` |

> **`VIS-093`.** A failure library is the negative image of a specification. Where §01.24 states
> what must be true, this section states what goes wrong when it is not — with the **symptom first**,
> because symptoms are what an agent actually encounters. Each entry carries seven fields:
> Symptom, Root Cause, Impact, Detection, Prevention, Remediation, AI Warning. The first five
> fields appear in the odd-numbered table of each family; the remainder in the even-numbered one.

### 01.25.1 Failure Taxonomy

```mermaid
flowchart TD
    ROOT["Oship failure space"] --> F1["F1 - vision integrity - FAL-VIS-001 to 015"]
    ROOT --> F2["F2 - capability and status - FAL-VIS-016 to 030"]
    ROOT --> F3["F3 - traceability - FAL-VIS-031 to 045"]
    ROOT --> F4["F4 - agent behaviour - FAL-VIS-046 to 060"]
    ROOT --> F5["F5 - governance and process - FAL-VIS-061 to 075"]
    ROOT --> F6["F6 - documentation craft - FAL-VIS-076 to 090"]
    ROOT --> F7["F7 - architecture and drift - FAL-VIS-091 to 105"]
    ROOT --> F8["F8 - human and agent collaboration - FAL-VIS-106 to 120"]
    F1 --> C1["Cause class - the vision stops being true"]
    F2 --> C2["Cause class - the register stops matching reality"]
    F3 --> C3["Cause class - links rot"]
    F4 --> C4["Cause class - the agent optimises the wrong thing"]
    F5 --> C5["Cause class - the process is advisory"]
    F6 --> C6["Cause class - volume beats clarity"]
    F7 --> C7["Cause class - layers diverge"]
    F8 --> C8["Cause class - accountability leaks"]
```

> **Diagram ID:** `DGM-VIS-043` — **Failure Taxonomy**
> **Explanation:** Eight families, each with a single dominant cause class. Classification by cause
> rather than by symptom is deliberate: two failures with identical symptoms and different causes
> need different remedies, and an agent that classifies by symptom alone will apply the wrong one.

### TBL-VIS-098: Failure Severity Scale

| Severity | Meaning | Required response | Blocks work? |
| :---: | :--- | :--- | :---: |
| **S0** | Cosmetic; no reader is misled | Fix opportunistically | No |
| **S1** | A reader may be mildly confused | Fix in the current change | No |
| **S2** | A reader may draw a wrong but recoverable conclusion | Fix before hand-off | No |
| **S3** | An agent will generate wrong work from it | Fix before any dependent work | Yes |
| **S4** | The document asserts something false about the repository | Fix immediately; correct the record | Yes |
| **S5** | A constitutional rule has been violated (identifier reuse, part rewrite, fabricated status) | Halt; escalate to the owner | Yes, all work |

### 01.25.2 Family F1 — Vision Integrity Failures

### TBL-VIS-099: F1 — Symptom, Cause, Impact (`FAL-VIS-001`…`FAL-VIS-015`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-001` | **Permanent aspiration** | Tier 4 remains empty across many work units while tiers 1–3 grow | Specification is cheaper and more comfortable than implementation | The vision becomes literature; `VIS-004` is never falsified or confirmed | S4 |
| `FAL-VIS-002` | **Vision as marketing** | Statements that cannot be turned into a requirement | Copy written for persuasion, not for derivation | `PRN-VIS-005` violated; agents cannot act | S3 |
| `FAL-VIS-003` | **Retroactive vision** | The vision is edited to match what was already built | Discomfort with an unmet commitment | Loses all predictive value; every future claim becomes suspect | S5 |
| `FAL-VIS-004` | **Calling the unbuilt** | Code or a plan invokes a `PLANNED` capability as if callable | Reading a capability register as an API listing | Downstream work builds on nothing; cascading rework | S4 |
| `FAL-VIS-005` | **Silent scope creep** | New capabilities appear with no problem and no actor | Enthusiasm outrunning justification | Register inflation; the tier-4 backlog becomes untriageable | S3 |
| `FAL-VIS-006` | **Principle inflation** | Twenty-five principles, none ranked | Every good idea promoted to a principle | Conflicts become unresolvable; `PRN-VIS-` ordering is meaningless | S3 |
| `FAL-VIS-007` | **Non-goal erosion** | A `PERMANENT` non-goal acquires an exception | A concrete request feels more real than an abstract rule | The prohibition set becomes negotiable, then decorative | S5 |
| `FAL-VIS-008` | **Date smuggling** | A quarter, month, or "soon" appears in an outcome | Pressure to look planned | `VIS-051` violated; missed dates discredit the whole document | S3 |
| `FAL-VIS-009` | **Success theatre** | Measures chosen because they already pass | Wanting a green report | The measurement system stops detecting anything | S4 |
| `FAL-VIS-010` | **Vision fork** | Two documents state incompatible visions | A new document written without reading the old one | Agents pick arbitrarily; behaviour becomes nondeterministic | S5 |
| `FAL-VIS-011` | **Unfalsifiable claim** | A claim with no possible disconfirming observation | Preferring safety to precision | `SUC-VIS-` cannot be defined against it; no learning occurs | S3 |
| `FAL-VIS-012` | **Identity drift** | The system's own description changes without a decision record | Incremental rewording across many edits | `PRN-VIS-007` violated; the constitution loses fixity | S4 |
| `FAL-VIS-013` | **Value hand-waving** | Value stated as "better", "faster", "modern" | No value model applied | `VAL-VIS-047` fails; investment cannot be prioritised | S2 |
| `FAL-VIS-014` | **Problem invention** | A problem registered to justify an already-decided capability | Reverse rationalisation | The problem space stops describing reality | S4 |
| `FAL-VIS-015` | **Constitution by convenience** | An L1 rule bypassed because it was inconvenient once | No enforcement (`CON-VIS-012`) | Every subsequent bypass is easier; authority collapses | S5 |

### TBL-VIS-100: F1 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-001` | Count tier-4 members with status `IMPLEMENTED` after each work unit; zero growth over several units is the signal | Require every work unit to name the tier-4 capability it advances | Suspend specification work; deliver `OUT-VIS-015` | If you are about to write more specification and cannot name the implementation it enables, stop |
| `FAL-VIS-002` | For each `VIS-` statement, attempt a one-line derived requirement; failure is the detection | Apply the §01.18 derivation algorithm at authoring time | Rewrite or delete the statement | Never write a sentence you could not turn into an acceptance criterion |
| `FAL-VIS-003` | Compare the change diff against the outcome register; edits that weaken an unmet commitment | Append-only parts; decisions recorded in `.ai/DECISION_LOG.md` | Revert; register the miss as a `PROB-VIS-` entry instead | Editing a commitment you failed is falsification, not maintenance |
| `FAL-VIS-004` | Grep for `PLANNED` capability identifiers in plans, code, or call graphs | `VIS-039`; boot step 5 | Withdraw the dependent work; mark it blocked | Check capability status before you depend on it — always |
| `FAL-VIS-005` | New `CAP-VIS-` entries with an empty problem or actor field | `VAL-VIS-041`, `VAL-VIS-068` at review | Attach a problem and actor, or mark `DEPRECATED` | A capability without a problem is a feature request |
| `FAL-VIS-006` | Count principles; check for duplicate ranks | Cap the principle namespace; require a rank at creation | Merge or demote to guidance | Do not add a principle to win an argument |
| `FAL-VIS-007` | Diff `NG-VIS-` rows; a `PERMANENT` row gaining a condition | `VAL-VIS-115` | Revert the exception; if genuinely needed, change the classification through governance | A permanent prohibition is not a strong default |
| `FAL-VIS-008` | Regex for dates, quarters, and temporal adverbs in outcome and success tables | `VAL-VIS-023`, `VAL-VIS-137` | Replace with a precondition or completion test | Sequence is a commitment; a date is a guess |
| `FAL-VIS-009` | Measures whose current value already meets the threshold at definition time | Define thresholds before measuring | Re-derive from `OUT-VIS-` completion tests | If a new metric passes on day one, it measures nothing |
| `FAL-VIS-010` | Cross-document search for conflicting identity statements | Single L1 vision document; `01.21` authority matrix | Retire one document; record the supersession | Two visions means no vision |
| `FAL-VIS-011` | Ask "what observation would prove this false?"; no answer is the detection | Require a falsification test for every strong claim | Add the test or downgrade the claim | Unfalsifiable claims are the most comfortable and least useful |
| `FAL-VIS-012` | Diff identity statements across parts and against `README.md` | `PRN-VIS-007`; identity changes require a decision record | Restore, then propose the change formally | Wording changes to identity are constitutional changes |
| `FAL-VIS-013` | Search value fields for comparative adjectives with no unit | `TBL-VIS-027` rejected forms | Express as cost avoided or output enabled | "Better" is not a value model |
| `FAL-VIS-014` | Compare problem registration order against the capability it justifies | Register problems from evidence, not from plans | Mark the problem `PROPOSED` and seek evidence | Evidence precedes problems; problems precede capabilities |
| `FAL-VIS-015` | Any change touching an L1 rule without a `.ai/DECISION_LOG.md` entry | Change-authority matrix `TBL-VIS-083` | Reverse the change; log the incident | Convenience is never an authority |

### 01.25.3 Family F2 — Capability and Status Failures

### TBL-VIS-101: F2 — Symptom, Cause, Impact (`FAL-VIS-016`…`FAL-VIS-030`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-016` | **Status inflation** | `PLANNED` promoted to `IMPLEMENTED` on the strength of a document | Conflating specifying with building | The register stops describing reality; `PRN-VIS-001` violated | S5 |
| `FAL-VIS-017` | **Evidence-free implementation claim** | Status `IMPLEMENTED` with no `EVD-VIS-` reference | Nobody checked | Every other status becomes untrustworthy by association | S4 |
| `FAL-VIS-018` | **Partial as complete** | Something 40% done marked `IMPLEMENTED` | No definition of done for the capability | Dependent capabilities start and stall | S4 |
| `FAL-VIS-019` | **Orphan capability** | A capability with no problem, actor, or outcome | Copied from a template or another product | Dead weight in every traversal | S2 |
| `FAL-VIS-020` | **Upward dependency** | A tier-2 capability depends on a tier-4 capability | Tier assigned after the fact | The build order becomes impossible | S3 |
| `FAL-VIS-021` | **Hidden blocker** | A capability marked `PLANNED` that is in fact blocked | Blocker never traced | Work is repeatedly attempted and abandoned | S3 |
| `FAL-VIS-022` | **Technology in the capability** | A capability named after a product or framework | Solution chosen before the problem was stated | `VAL-VIS-066` fails; `PRN-VIS-015` compromised | S2 |
| `FAL-VIS-023` | **Capability duplication** | Two identifiers describing the same thing | Register not searched before adding | Divergent statuses for one reality | S3 |
| `FAL-VIS-024` | **Capability deletion** | An identifier disappears between versions | Tidying | Dangling references everywhere; `VAL-VIS-077` fails | S5 |
| `FAL-VIS-025` | **Identifier reuse** | A retired number reassigned to new content | Numbering treated as a sequence, not as identity | Historical references silently point at the wrong thing | S5 |
| `FAL-VIS-026` | **Tier stuffing** | Everything filed as tier 4 to avoid ordering it | Avoiding the discipline of dependency analysis | The hierarchy stops informing sequence | S2 |
| `FAL-VIS-027` | **Unbounded register growth** | The capability count grows every session, the implemented count does not | Adding is cheap, building is not | Signal-to-noise collapses; see `FAL-VIS-001` | S3 |
| `FAL-VIS-028` | **Status without owner** | A status changes with no accountable person | Advisory governance | No one can be asked why | S3 |
| `FAL-VIS-029` | **Capability without output** | A capability whose outputs field is empty or abstract | Written as a theme, not a capability | Cannot be tested; cannot be finished | S3 |
| `FAL-VIS-030` | **Vanity capability** | A capability whose only consumer is the vision document | No real actor | Effort is spent producing nothing anyone uses | S2 |

### TBL-VIS-102: F2 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-016` | For each `IMPLEMENTED` capability, require an inspectable artifact; absence is the detection | `AI-VIS-053`; boot step 5 | Downgrade the status; record the correction | A document describing a thing is not the thing |
| `FAL-VIS-017` | `VAL-VIS-064` scan | Require the evidence reference in the same edit as the status change | Attach evidence or downgrade | Status and evidence change together, never separately |
| `FAL-VIS-018` | Compare the capability's declared outputs against what exists | Define done as "all declared outputs produced" | Mark `PARTIALLY IMPLEMENTED` and list what is missing | Partial credit is a status, not a rounding decision |
| `FAL-VIS-019` | `VAL-VIS-068` traversal | Boot step 4 before registration | Attach a problem or mark `DEPRECATED` | Templates carry other people's problems |
| `FAL-VIS-020` | `VAL-VIS-061` graph check | Assign tier from dependencies, not from importance | Re-tier the dependent, or split the capability | A tier is computed, not chosen |
| `FAL-VIS-021` | Blocked capabilities with an empty blocker field | `VAL-VIS-083` | Trace the blocker to `OUT-VIS-004`, `006`, or `011` | Every blocked item must name what unblocks it |
| `FAL-VIS-022` | Search capability names for vendor and framework terms | `VAL-VIS-066`, `PRN-VIS-015` | Rename to the capability; move the technology into architecture | Name what it does, never what it uses |
| `FAL-VIS-023` | Semantic comparison of purpose fields | Search the register before allocating | Deprecate one; point it at the survivor | Search first, allocate second |
| `FAL-VIS-024` | Diff identifier sets between versions | `VIS-088` deletion prohibition | Restore the identifier with status `DEPRECATED` | Retire by marking, never by removing |
| `FAL-VIS-025` | Check high-water marks in the namespace register | `AI-VIS-052` | Allocate a fresh number; restore the original meaning | Identifiers are permanent even when their content dies |
| `FAL-VIS-026` | Tier-4 population compared to tiers 1–3 | Require a dependency justification per tier assignment | Re-tier from the dependency graph | Filing everything as "later" is not planning |
| `FAL-VIS-027` | Trend the ratio of registered to implemented | Cap additions per work unit; `PRN-VIS-020` | Freeze additions until an implementation lands | Finish before you start |
| `FAL-VIS-028` | Status changes with no named actor | `TBL-VIS-083` authority matrix | Assign an owner retroactively; log it | Anonymous status changes are unaccountable |
| `FAL-VIS-029` | Empty or non-noun output fields | `VAL-VIS-058` | Rewrite with concrete artifacts | If it produces nothing, it is a theme |
| `FAL-VIS-030` | Trace consumers of the capability's outputs | `VAL-VIS-041` | Deprecate or attach a real actor | The document is not a user |

### 01.25.4 Family F3 — Traceability Failures

### TBL-VIS-103: F3 — Symptom, Cause, Impact (`FAL-VIS-031`…`FAL-VIS-045`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-031` | **Dangling reference** | A link or identifier resolves to nothing | Target renamed or never created | Traversal halts; agents guess | S3 |
| `FAL-VIS-032` | **Broken anchor** | An in-document link points at a heading that changed | Heading edited without updating links | Navigation fails silently in rendered views | S1 |
| `FAL-VIS-033` | **One-way link** | A references B, B never mentions A | Backlinks treated as optional | Impact analysis misses affected elements | S2 |
| `FAL-VIS-034` | **Invented identifier** | A reference to an identifier that was never allocated | Plausible pattern completion by a generator | Fabricated traceability; the worst kind of confidence | S5 |
| `FAL-VIS-035` | **Stale cross-document quote** | A quoted status differs from the source document | Copy taken once and never re-checked | Two documents disagree; readers trust the wrong one | S4 |
| `FAL-VIS-036` | **Trace gap concealment** | An `UNMAPPED` element quietly given a plausible mapping | Discomfort with holes | Gaps stop being visible, so they are never closed | S5 |
| `FAL-VIS-037` | **Matrix without traversal** | A traceability table nobody can query mechanically | Formatted for humans only | The matrix cannot be validated; it decays | S2 |
| `FAL-VIS-038` | **Chain break at the boundary** | The chain stops at architecture and never reaches tests | No document exists at the next link | Requirements are never verified | S3 |
| `FAL-VIS-039` | **Overlinking** | Every element links to every other | Linking used to demonstrate diligence | Signal loss; impact analysis returns everything | S2 |
| `FAL-VIS-040` | **Implicit dependency** | Order matters but no dependency is recorded | The author knew the order | An agent reorders and breaks it | S3 |
| `FAL-VIS-041` | **Reference by title** | Elements referenced by name rather than identifier | Titles feel more readable | Titles change; identifiers do not | S2 |
| `FAL-VIS-042` | **Version-blind reference** | A citation to a document with no version | Versions considered pedantic | The cited statement changes underneath the citation | S2 |
| `FAL-VIS-043` | **Circular derivation** | A requirement justified by the thing it justifies | Derivation done backwards | Nothing is grounded in a real problem | S4 |
| `FAL-VIS-044` | **Orphan requirement** | A derived requirement with no vision origin | Requirement invented during design | Cannot be prioritised or retired | S3 |
| `FAL-VIS-045` | **Trace rot** | Links correct at authoring, wrong three parts later | No re-validation on append | Confidence decays invisibly | S3 |

### TBL-VIS-104: F3 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-031` | Resolve every identifier against the allocation register | `VAL-VIS-021`; run before hand-off | Fix the reference or create the target | A reference is a promise that something exists |
| `FAL-VIS-032` | Slug-compare headings against internal links | `VAL-VIS-006`; anchor validator | Update the link, not the heading, if the heading is cited | Renaming a heading breaks every link to it |
| `FAL-VIS-033` | For each forward link, check for a matching backlink | Record both directions when creating a relationship | Add the reverse reference | Relationships have two ends |
| `FAL-VIS-034` | Every identifier must appear in an allocation table | `AI-VIS-052`; allocate before citing | Remove the citation; allocate properly if the element is real | Never write an identifier you have not seen defined |
| `FAL-VIS-035` | Re-read the source document when quoting a status | Quote with a version and a section anchor | Re-quote from source; add the version | Statuses change; copies do not |
| `FAL-VIS-036` | Compare gap registers between versions; disappearing gaps | `VAL-VIS-178`, `VIS-067` | Restore the `UNMAPPED` marker | A visible hole is an asset |
| `FAL-VIS-037` | Attempt to parse the matrix into triples | Fixed column order; identifier-only cells | Reformat with machine-readable columns | Write for the parser and the human at once |
| `FAL-VIS-038` | Walk the full chain to tests and releases | Record the missing link as a `PLANNED` document | Register the gap as an outcome precondition | A chain that stops is not a chain |
| `FAL-VIS-039` | Link density per element | Link only real dependencies | Prune to genuine relationships | Linking everything says nothing |
| `FAL-VIS-040` | Ordered lists with no stated ordering rule | State why the order matters | Convert the implicit order into a dependency | If order matters, say so |
| `FAL-VIS-041` | Search for cross-references without an identifier | Identifier first, title in parentheses | Add identifiers | Titles are for humans, identifiers are for traversal |
| `FAL-VIS-042` | Citations lacking a version field | Cite `document_id` plus version | Add the version | Cite a snapshot, not a moving target |
| `FAL-VIS-043` | Follow each derivation to a `PROB-VIS-` root | The §01.18 algorithm starts from problems | Re-derive from the problem space | Derivation flows one way only |
| `FAL-VIS-044` | Requirements with an empty origin field | `VAL-VIS-188` | Attach an origin or withdraw | An unrooted requirement cannot be defended |
| `FAL-VIS-045` | Re-run link validation on every append | Validation as part of the hand-off ritual | Repair and re-validate | Validate what you appended, and what you appended to |

### 01.25.5 Family F4 — Agent Behaviour Failures

### TBL-VIS-105: F4 — Symptom, Cause, Impact (`FAL-VIS-046`…`FAL-VIS-060`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-046` | **Confident fabrication** | A precise, plausible, unverifiable statement | Generation optimised for fluency | The most damaging failure mode in the whole library | S5 |
| `FAL-VIS-047` | **Context amnesia** | The agent restates settled decisions or reverses them | Context limit hit without the continuation protocol | Rework, contradiction, and lost decisions | S4 |
| `FAL-VIS-048` | **Summarise-and-restart** | A long document is replaced by a shorter one | Treating a limit as a reason to compress | Irrecoverable loss of specification detail | S5 |
| `FAL-VIS-049` | **Silent assumption** | The output depends on a fact never stated | Filling a gap rather than flagging it | Wrong work that looks right | S4 |
| `FAL-VIS-050` | **Instruction drift** | Later output stops obeying earlier constraints | Constraints fall out of the attended context | Inconsistent artifacts within one document | S3 |
| `FAL-VIS-051` | **Volume as value** | Repetitive sections added to hit a size target | A count treated as a goal | `NG-VIS-` violation; reader trust collapses | S4 |
| `FAL-VIS-052` | **Premature completion** | "Done" declared with sections missing | Optimism, or misreading the scope | Downstream work starts on an incomplete base | S4 |
| `FAL-VIS-053` | **Scope expansion** | The agent solves adjacent problems nobody asked about | Helpfulness without boundaries | Review burden explodes; the actual task is diluted | S3 |
| `FAL-VIS-054` | **Silent overwrite** | Existing content replaced instead of appended | Write used where append was required | Loss of accepted work; `PRN-VIS-006` violated | S5 |
| `FAL-VIS-055` | **Unvalidated hand-off** | Work handed off without running the validators | Validation treated as optional | Broken diagrams and links reach the repository | S3 |
| `FAL-VIS-056` | **Control-plane neglect** | `.ai/` files not updated after a work unit | The task felt finished at the artifact | The next agent starts blind; `PROB-VIS-002` recurs | S4 |
| `FAL-VIS-057` | **Approval self-grant** | The agent treats its own reasoning as approval | No enforced gate | The autonomy boundary becomes fictional | S5 |
| `FAL-VIS-058` | **Tool-output trust** | Model or tool output used without validation | Treating generated text as fact | Corruption enters through the model boundary | S4 |
| `FAL-VIS-059` | **Local optimisation** | A section improved at the cost of document coherence | Only the local window is in view | Style and terminology fracture across parts | S2 |
| `FAL-VIS-060` | **Repetition of a corrected error** | The same mistake reappears in a later session | The correction was never written down | Corrections do not compound; learning is lost | S3 |

### TBL-VIS-106: F4 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-046` | Every specific claim must cite a file, line, or artifact | `AI-VIS-049`; `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | Replace with the unknown label; re-verify | Fluency is not evidence. If you did not read it, do not assert it |
| `FAL-VIS-047` | Contradictions between the current output and `.ai/DECISION_LOG.md` | Load the control plane at boot step 0 | Re-read the decision log; correct the output | Your memory is the repository, not your context |
| `FAL-VIS-048` | Document line count decreasing across a work unit | `AI-VIS-054` continuation protocol | Restore from history; append instead | A limit means stop and mark, never compress |
| `FAL-VIS-049` | Assumptions absent from the change description | `AI-VIS-048` | List assumptions; verify or escalate each | Every gap you filled silently is a defect waiting |
| `FAL-VIS-050` | Compare late output against the constraint list | Re-read constraints before each chunk | Re-apply and correct | Constraints do not expire mid-document |
| `FAL-VIS-051` | Near-duplicate paragraph and table detection | Maximum-content rule with the no-repetition clause | Delete the padding | Adding nothing new is worse than adding nothing |
| `FAL-VIS-052` | Compare delivered sections against the planned table of contents | `AI-VIS-056` | State precisely what remains; keep the status `IN_PROGRESS` | Say what you did not do, explicitly |
| `FAL-VIS-053` | Diff scope against the task statement | Confirm scope changes before acting | Split the extra work into its own unit | Unasked-for work is still work someone must review |
| `FAL-VIS-054` | File size or identifier count decreasing | `AI-VIS-051`; append-only tooling | Restore from git; re-apply as an append | Never call write on a file you were asked to extend |
| `FAL-VIS-055` | No validator output in the work record | `VAL-VIS-007`, `VAL-VIS-006` before hand-off | Run validators; fix; re-run | Validation is part of the work, not after it |
| `FAL-VIS-056` | `.ai/` files unchanged while artifacts changed | Boot step 10 | Update the control plane now | Handing off without a note is abandoning the work |
| `FAL-VIS-057` | Irreversible or external actions with no approval record | `DGM-VIS-023` boundary; `AI-VIS-058` | Halt; disclose; request approval | Reasoning about approval is not approval |
| `FAL-VIS-058` | Generated content influencing state without a check | `BND-VIS-006`; `AI-VIS-057` | Re-validate the affected state | Treat your own output as untrusted input |
| `FAL-VIS-059` | Terminology and formatting drift between sections | Fixed section format and glossary | Normalise across the document | Consistency beats a locally better phrasing |
| `FAL-VIS-060` | Search `.ai/COMMON_MISTAKES.md` before starting | Write every correction into the lessons file | Add the entry now | A correction not written down will be made again |

---

### 01.25.6 Family F5 — Governance and Process Failures

```mermaid
flowchart LR
    A["Rule written"] --> B{"Enforcement mechanism exists?"}
    B -->|"No"| C["Advisory rule"]:::warn
    B -->|"Yes"| D{"Mechanism runs automatically?"}
    D -->|"No"| C
    D -->|"Yes"| E["Enforced rule"]:::good
    C --> F["Compliance depends on agent discipline"]
    F --> G{"Discipline holds under pressure?"}
    G -->|"Sometimes"| H["Intermittent compliance - FAL-VIS-061"]:::warn
    G -->|"No"| I["Rule becomes decorative - FAL-VIS-015"]:::bad
    classDef good fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-044` — **How an Advisory Rule Decays**
> **Explanation:** Every rule in this repository currently sits on the left-hand path. This is not
> a hypothetical decay model; it is the present operating condition described by `CON-VIS-012`, and
> it is why family F5 exists as a distinct failure class rather than as a footnote.

### TBL-VIS-107: F5 — Symptom, Cause, Impact (`FAL-VIS-061`…`FAL-VIS-075`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-061` | **Advisory-rule decay** | Rules obeyed when convenient | No automated enforcement | Compliance becomes a function of who is working | S4 |
| `FAL-VIS-062` | **Single-owner bottleneck** | All approvals wait on one person | `CON-VIS-011` | Throughput ceiling; review becomes rubber-stamping | S3 |
| `FAL-VIS-063` | **Self-approval** | The author of a change is also its approver | Only one owner exists | Independent review is structurally impossible | S4 |
| `FAL-VIS-064` | **Undocumented decision** | A significant choice with no record | The decision felt obvious at the time | Later agents relitigate it; `PRN-VIS-006` violated | S4 |
| `FAL-VIS-065` | **Decision reversal by omission** | A recorded decision quietly not followed | The record was never read | Governance becomes fiction | S5 |
| `FAL-VIS-066` | **Process without artifact** | A ritual performed with nothing written down | Process treated as behaviour, not as output | No evidence the process ran | S3 |
| `FAL-VIS-067` | **Unregistered document** | A document exists but no index lists it | Registration step skipped | Discoverability fails; duplicate work follows | S3 |
| `FAL-VIS-068` | **Index rot** | Indexes list statuses that no longer match | Index updated less often than content | The routing layer misroutes agents | S3 |
| `FAL-VIS-069` | **Metadata skew** | Frontmatter version disagrees with the content | Version bumped manually and forgotten | Version-based reasoning breaks | S2 |
| `FAL-VIS-070` | **Authority ambiguity** | Two documents both claim to be authoritative | No authority level assigned | Conflicts have no resolution rule | S4 |
| `FAL-VIS-071` | **Silent supersession** | A new document replaces an old one with no marker | Supersession step skipped | Both are read; the stale one is trusted | S4 |
| `FAL-VIS-072` | **Change without propagation** | An element changed; its dependents untouched | Propagation set not consulted | Inconsistency spreads (`VIS-090`) | S4 |
| `FAL-VIS-073` | **Review theatre** | Approval granted without reading | Volume exceeds review capacity | Defects pass the gate that was meant to catch them | S4 |
| `FAL-VIS-074` | **Governance for governance** | Process elaborated faster than product | Process work is safe and visible | Overhead grows; delivery does not | S3 |
| `FAL-VIS-075` | **Emergency permanence** | A one-time exception becomes normal practice | No expiry on exceptions | Rules erode from the exception outward | S4 |

### TBL-VIS-108: F5 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-061` | Sample recent changes against the blocking rule set | Deliver `OUT-VIS-004` and make rules blocking | Install enforcement; re-audit the backlog | An unenforced rule is a preference |
| `FAL-VIS-062` | Time between submission and approval | Add reviewers; delegate by domain | Record as `CON-VIS-011`; do not pretend otherwise | The bottleneck is structural, not personal |
| `FAL-VIS-063` | Author equals approver on any change | Two-person rule once staffing allows | Document the limitation on every affected change | Never describe self-review as review |
| `FAL-VIS-064` | Significant changes with no `.ai/DECISION_LOG.md` entry | Require a decision record for L1 and L2 changes | Write the record retroactively, dated as such | If you chose between options, record it |
| `FAL-VIS-065` | Compare behaviour against recorded decisions | Boot step 0 loads the decision log | Comply, or supersede the decision explicitly | Decisions are immutable until superseded in writing |
| `FAL-VIS-066` | Process claimed with no output file | Every process step names an artifact | Produce the artifact or drop the step | If it left no trace, it did not happen |
| `FAL-VIS-067` | Compare the file tree against index entries | Registration step in the hand-off ritual | Register it now | Creating a document is half the task |
| `FAL-VIS-068` | Cross-check index statuses against document frontmatter | Update the index in the same change | Reconcile all entries | The index is a promise about the content |
| `FAL-VIS-069` | Frontmatter version compared to the change history | Bump the version in the same edit | Correct the frontmatter | Metadata is content |
| `FAL-VIS-070` | Two documents with the same authority claim | Assign exactly one L1 document per domain | Demote one; record the supersession | Authority must be unique to be useful |
| `FAL-VIS-071` | An old document with no supersession marker | Mark the superseded document and link forward | Add the marker | Retire loudly |
| `FAL-VIS-072` | Walk the propagation set after each change | `TBL-VIS-085` | Complete the propagation | A change is done when its dependents are done |
| `FAL-VIS-073` | Approval latency far below reading time | Cap change size; require reviewer notes | Re-review with a checklist | A fast approval on a large change is not an approval |
| `FAL-VIS-074` | Ratio of process documents to delivered capability | `PRN-VIS-020`; tier-4 progress requirement | Freeze process work; ship something | Meta-work feels productive because it cannot fail |
| `FAL-VIS-075` | Exceptions without an expiry condition | Every exception states its expiry | Expire it or promote it through governance | An exception without an end date is a new rule |

### 01.25.7 Family F6 — Documentation Craft Failures

### TBL-VIS-109: F6 — Symptom, Cause, Impact (`FAL-VIS-076`…`FAL-VIS-090`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-076` | **Wall of text** | Long prose with no visual anchor | Writing linearly without structure | Comprehension collapses; the reader skims and misreads | S3 |
| `FAL-VIS-077` | **Decorative diagram** | A diagram that restates the adjacent paragraph | Diagram added to satisfy a count | Visual budget spent without adding meaning | S2 |
| `FAL-VIS-078` | **Unexplained diagram** | A diagram with no explanation line | The author found it self-evident | Readers infer different meanings from the same picture | S2 |
| `FAL-VIS-079` | **Table without semantics** | Columns whose meaning is undefined | Format copied without intent | The table cannot be validated or queried | S2 |
| `FAL-VIS-080` | **Ambiguous status vocabulary** | Terms like "in progress" used outside the closed set | Vocabulary not consulted | Statuses stop being comparable | S3 |
| `FAL-VIS-081` | **Tense confusion** | Present tense used for planned behaviour | Writing aspirationally | Readers believe the system does something it does not | S4 |
| `FAL-VIS-082` | **Undefined term** | A domain term used before it is defined | Author fluency assumed in the reader | Divergent interpretations across sections | S2 |
| `FAL-VIS-083` | **Inconsistent terminology** | Two words for one concept | No glossary discipline | Search fails; agents treat them as different things | S3 |
| `FAL-VIS-084` | **Nested-depth explosion** | Six heading levels of hierarchy | Structure mirroring the author's outline, not the reader's need | Navigation becomes harder than the content | S1 |
| `FAL-VIS-085` | **Example-free abstraction** | A rule with no worked example | The rule seemed clear when written | Application varies wildly between readers | S2 |
| `FAL-VIS-086` | **Broken code fence** | Unbalanced fences corrupt rendering | Manual editing near fence boundaries | Large regions render as code; content is effectively lost | S3 |
| `FAL-VIS-087` | **Table-of-contents skew** | The contents list does not match the sections | Sections added without updating the list | Navigation fails at the entry point | S2 |
| `FAL-VIS-088` | **Unlabelled unknown** | A gap left blank instead of labelled | Blank feels tidier than an admission | Readers assume the blank means "none" | S4 |
| `FAL-VIS-089` | **Precision theatre** | Numbers with unjustified significant figures | Precision used to imply rigour | False confidence in derived estimates | S3 |
| `FAL-VIS-090` | **Orphan section** | A section nothing links to and nothing follows from | Written in isolation | Effort invisible; content never read | S1 |

### TBL-VIS-110: F6 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-076` | Longest run of lines with no diagram or table | `VAL-VIS-011`; a visual every 20 to 60 lines | Insert a diagram or table that adds structure | If you have written 120 lines of prose, you have written the wrong thing |
| `FAL-VIS-077` | Diagram content compared to the adjacent text | Diagrams must show relationships text cannot | Replace it with one that adds structure | A diagram must earn its space |
| `FAL-VIS-078` | Diagram blocks without a following explanation line | `VAL-VIS-009` | Add an interpretation, not a caption | Say what the reader should conclude |
| `FAL-VIS-079` | Column headers without a defined vocabulary | Reuse the standard column sets | Define the columns or drop them | Columns are a schema |
| `FAL-VIS-080` | Search for status words outside the closed set | Publish the vocabulary; validate against it | Map to the closed set | Use the eight statuses and nothing else |
| `FAL-VIS-081` | Present-tense verbs near `PLANNED` identifiers | `VAL-VIS-013` | Rewrite in the conditional or future | Tense is a truth claim |
| `FAL-VIS-082` | First use of a term compared to the glossary | Define on first use | Add the definition | Your reader cannot ask you what you meant |
| `FAL-VIS-083` | Synonym clustering across the document | One term per concept, recorded | Normalise; keep one term | Synonyms are the enemy of search |
| `FAL-VIS-084` | Maximum heading depth | Cap at four levels | Flatten and re-title | Deep nesting hides content |
| `FAL-VIS-085` | Rules with no worked example | `VAL-VIS-194` | Add one concrete instance | One example is worth three clarifications |
| `FAL-VIS-086` | Fence-balance check | `VAL-VIS-016` before hand-off | Repair the fences; re-validate | Always re-read the edges of what you edited |
| `FAL-VIS-087` | Compare headings against the contents list | `VAL-VIS-014` | Regenerate the list | The contents list is the reader's map |
| `FAL-VIS-088` | Empty cells in identifier tables | `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | Fill with the label | A blank cell is an unlabelled lie |
| `FAL-VIS-089` | Numbers whose derivation is unstated | State the source or round honestly | Add the derivation or widen the estimate | Do not manufacture precision you do not have |
| `FAL-VIS-090` | Sections with no inbound reference | Link from the contents list and a neighbour | Link it or remove it | Unreachable content is wasted content |

### 01.25.8 Family F7 — Architecture and Drift Failures

### TBL-VIS-111: F7 — Symptom, Cause, Impact (`FAL-VIS-091`…`FAL-VIS-105`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-091` | **Implementation drift** | Code diverges from its specification | No conformance check | The specification stops predicting the system | S4 |
| `FAL-VIS-092` | **Specification drift** | Two documents specify the same thing differently | Parallel authoring | Agents implement both; the result satisfies neither | S4 |
| `FAL-VIS-093` | **Status drift** | Recorded status no longer matches reality | Status updated only on creation | Planning built on stale facts | S4 |
| `FAL-VIS-094` | **Reference drift** | Cross-references point at moved or renamed elements | Renaming without a sweep | Traversal breaks; see family F3 | S3 |
| `FAL-VIS-095` | **Semantic drift** | A term's meaning shifts without the word changing | Gradual reuse in adjacent contexts | The most invisible failure in the library | S4 |
| `FAL-VIS-096` | **Authority drift** | A lower-authority document contradicts a higher one and wins | Authority not checked at conflict time | The layer model inverts | S5 |
| `FAL-VIS-097` | **Layer bypass** | A component reaches across layers it should not | Convenience under delivery pressure | Layering stops constraining anything | S4 |
| `FAL-VIS-098` | **Premature architecture** | Detailed design for capabilities with no problem | Design is enjoyable | Effort sunk into components that never ship | S3 |
| `FAL-VIS-099` | **Technology-first design** | The stack chosen before the constraints are known | Familiarity | `CON-VIS-` constraints discovered too late to honour | S4 |
| `FAL-VIS-100` | **Invisible coupling** | Two elements depend on each other with no recorded link | Dependency emerged during implementation | Change impact analysis is wrong | S4 |
| `FAL-VIS-101` | **Boundary erosion** | A trust boundary crossed without the stated check | The check was never implemented | Security properties become aspirational | S5 |
| `FAL-VIS-102` | **Invariant without enforcement** | An invariant stated and never checked | No runtime, no CI | Invariants provide false assurance | S4 |
| `FAL-VIS-103` | **Unmapped capability accumulation** | The `UNMAPPED` list grows every part | Architecture lags the vision | The traceability chain thins toward the middle | S3 |
| `FAL-VIS-104` | **Architecture as documentation** | Architecture documents grow; no system exists | Same cause as `FAL-VIS-001` | Design decisions untested by contact with reality | S4 |
| `FAL-VIS-105` | **Drift normalisation** | Known drift left unresolved long enough to become the baseline | No severity escalation | The specification is rewritten to match the defect | S5 |

### TBL-VIS-112: F7 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-091` | Conformance check of artifacts against their specification | Automated conformance in `OUT-VIS-004` | Fix the code, or amend the spec through governance | The spec is the source of truth until a decision says otherwise |
| `FAL-VIS-092` | Cross-document comparison on shared subjects | One authoritative document per subject | Merge; mark one as superseded | Two specifications are worse than none |
| `FAL-VIS-093` | Periodic re-verification of every `IMPLEMENTED` claim | Re-verify statuses at part boundaries | Correct the register | Status is perishable |
| `FAL-VIS-094` | Identifier resolution sweep | Never rename; deprecate and re-point | Repair the references | Renaming is a breaking change |
| `FAL-VIS-095` | Compare each use of a term against its glossary definition | Fix definitions in the glossary; cite it | Restore the definition; audit the uses | If a word starts feeling flexible, pin it down |
| `FAL-VIS-096` | Conflicts resolved against the authority matrix | `TBL-VIS-083`; boot step 1 | Reverse the outcome; restate the rule | Check authority before you resolve a conflict |
| `FAL-VIS-097` | Dependency graph compared to the layer model | Layer rules stated as invariants | Refactor or record an exception with an expiry | Convenience today is a constraint violation forever |
| `FAL-VIS-098` | Design documents for tier-4 items with no problem | Design only what an outcome requires | Park the design; record it as `PROPOSED` | Design follows a problem, never precedes it |
| `FAL-VIS-099` | Stack decisions with no constraint analysis | `OUT-VIS-006` requires constraint review first | Re-evaluate against `CON-VIS-` | Choose last what is hardest to change |
| `FAL-VIS-100` | Compare actual dependencies against declared ones | Declare dependencies at creation | Record the coupling; decide whether to break it | Undeclared coupling is the reason changes surprise you |
| `FAL-VIS-101` | Verify each boundary check exists as an artifact | Boundary checks are implementation requirements | Implement the check or mark the boundary absent | A boundary with no check is a line on a diagram |
| `FAL-VIS-102` | Invariants with no enforcing test | Each invariant names its enforcement | Write the test, or mark the invariant unenforced | An unchecked invariant is a wish |
| `FAL-VIS-103` | Trend the size of the `UNMAPPED` set | Every part must reduce it or explain why not | Map or explicitly defer with an owner | Gaps you carry forward compound |
| `FAL-VIS-104` | Ratio of architecture lines to shipped components | Tier-4 progress requirement per work unit | Implement one component end to end | Architecture is a hypothesis until something runs |
| `FAL-VIS-105` | Drift age tracking; D3-plus items older than one work unit | Severity-based halting (`§01.20`) | Halt; resolve; record the incident | The longer drift lives, the more it looks like the design |

### 01.25.9 Family F8 — Human and Agent Collaboration Failures

### TBL-VIS-113: F8 — Symptom, Cause, Impact (`FAL-VIS-106`…`FAL-VIS-120`)

| ID | Anti-pattern | Symptom | Root cause | Impact | Sev |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FAL-VIS-106` | **Accountability transfer** | "The agent decided it" offered as an explanation | Accountability model not internalised | `VIS-032` violated; no one is answerable | S5 |
| `FAL-VIS-107` | **Automation complacency** | Output approved because it looks well-formed | Fluency mistaken for correctness | The review gate stops filtering | S4 |
| `FAL-VIS-108` | **Over-escalation** | Every trivial decision routed to a human | Autonomy boundary unclear or untrusted | The human becomes the bottleneck; leverage is lost | S2 |
| `FAL-VIS-109` | **Under-escalation** | Consequential decisions taken silently | Boundary unenforced | Irreversible actions without approval | S5 |
| `FAL-VIS-110` | **Context starvation** | The agent is given a task without the constraints | Human assumes shared context | Wrong work produced confidently | S3 |
| `FAL-VIS-111` | **Instruction overload** | So many constraints that some must be dropped | No prioritisation among instructions | Silent, unpredictable constraint loss | S3 |
| `FAL-VIS-112` | **Feedback evaporation** | A correction given in conversation and never recorded | Chat treated as memory | The same correction is needed next session (`FAL-VIS-060`) | S3 |
| `FAL-VIS-113` | **Role confusion** | Unclear whether the human or the agent owns a step | Responsibility matrix not consulted | Steps done twice or not at all | S2 |
| `FAL-VIS-114` | **Trust without verification** | Agent claims accepted without checking the artifact | Time pressure | Fabrications enter the record | S4 |
| `FAL-VIS-115` | **Verification without trust** | Every output rebuilt by hand | No confidence in agent work | Negative leverage; agents cost more than they save | S2 |
| `FAL-VIS-116` | **Handoff without state** | A new session starts with no record of the last one | Control plane not updated | Rework, contradiction, and lost decisions | S4 |
| `FAL-VIS-117` | **Approval without record** | Approval given verbally, never written | Informality | Cannot be audited; disputes are unresolvable | S3 |
| `FAL-VIS-118` | **Agent-to-agent trust** | One agent accepts another's output as verified | No verification at the boundary | Errors amplify along the chain | S4 |
| `FAL-VIS-119` | **Human as transcriber** | The human retypes what the agent produced | Poor tooling | Human time spent on the lowest-value step | S1 |
| `FAL-VIS-120` | **Silent disagreement** | The agent proceeds despite detecting a contradiction | Halting feels unhelpful | A known defect is shipped | S4 |

### TBL-VIS-114: F8 — Detection, Prevention, Remediation, AI Warning

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-106` | Explanations naming an agent as the responsible party | `VIS-032`; responsibility matrix | Reassign accountability to the human owner | You may act; you may never be accountable |
| `FAL-VIS-107` | Approval time far shorter than reading time | Require reviewer notes citing specifics | Re-review against the validation rules | Well-formatted and wrong is the normal failure mode |
| `FAL-VIS-108` | Ratio of escalations to actions | Publish the autonomy boundary explicitly | Widen A1 and A2 for reversible actions | Escalating everything is as unhelpful as escalating nothing |
| `FAL-VIS-109` | External or irreversible actions with no approval record | `AI-VIS-058`; hard gate on A3 | Disclose; reverse if possible; record the incident | When in doubt about reversibility, escalate |
| `FAL-VIS-110` | Tasks issued with no constraint references | Boot sequence loads constraints regardless | Request the missing context before acting | If you were not given the constraints, ask; do not guess |
| `FAL-VIS-111` | Constraint count per task | Rank constraints; state which dominate | Split the task | Too many rules produce arbitrary rule-breaking |
| `FAL-VIS-112` | Corrections present in conversation, absent from `.ai/` | Write corrections into `LESSONS_LEARNED.md` | Record it now | If it is not in the repository, it did not happen |
| `FAL-VIS-113` | Steps with two owners or none | Responsibility matrix per work unit | Assign a single owner per step | One accountable party per step |
| `FAL-VIS-114` | Claims accepted with no artifact inspection | Require an artifact reference with every claim | Verify now; correct the record | Ask for the file and the line |
| `FAL-VIS-115` | Human rework rate per agent output | Improve specifications instead of redoing work | Fix the input, not just the output | If you must redo the work, the brief was wrong |
| `FAL-VIS-116` | New sessions with no continuation marker | Boot step 10; continuation protocol | Reconstruct from git history and record it | Always leave a note for the next agent, including yourself |
| `FAL-VIS-117` | Approvals with no written trace | Approvals recorded in the change record | Record it retroactively, marked as such | An unwritten approval is a memory, not a control |
| `FAL-VIS-118` | Chained agent outputs with no verification step | `AI-VIS-057`; validate at each boundary | Insert verification; re-run the chain | Another agent's output is still model output |
| `FAL-VIS-119` | Human keystrokes on generated content | Direct file writes; automation | Fix the tooling | Never make a person the clipboard |
| `FAL-VIS-120` | Contradictions detected but not surfaced | `AI-VIS-046` halt rule | Surface it now; request a decision | Saying nothing about a contradiction is the least helpful option available |

### 01.25.10 Failure Library Summary

### TBL-VIS-115: Failure Distribution by Family and Severity

| Family | Range | S1 | S2 | S3 | S4 | S5 | Total |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| F1 vision integrity | `001`–`015` | 0 | 1 | 5 | 5 | 4 | 15 |
| F2 capability and status | `016`–`030` | 0 | 5 | 6 | 2 | 2 | 15 |
| F3 traceability | `031`–`045` | 1 | 6 | 5 | 2 | 1 | 15 |
| F4 agent behaviour | `046`–`060` | 0 | 1 | 5 | 5 | 4 | 15 |
| F5 governance | `061`–`075` | 0 | 0 | 6 | 7 | 2 | 15 |
| F6 documentation craft | `076`–`090` | 2 | 7 | 4 | 2 | 0 | 15 |
| F7 architecture and drift | `091`–`105` | 0 | 0 | 3 | 8 | 4 | 15 |
| F8 collaboration | `106`–`120` | 1 | 3 | 4 | 5 | 2 | 15 |
| **Total** | `001`–`120` | **4** | **23** | **38** | **36** | **19** | **120** |

> **`VIS-094`.** Nineteen S5 failures are constitutional: each one, if it occurs, invalidates the
> trustworthiness of the surrounding record rather than merely degrading it. Fourteen of the
> nineteen are detectable by a mechanical check that does not yet exist — the strongest single
> argument for prioritising `OUT-VIS-004`.

```mermaid
flowchart TD
    subgraph DETECT["Detection capability today"]
        D1["Mechanically detectable and checker exists - 2 failures"]:::good
        D2["Mechanically detectable, no checker - 71 failures"]:::warn
        D3["Requires human judgement - 47 failures"]:::info
    end
    D2 --> O4["OUT-VIS-004 - install CI - converts 71 to detectable"]
    D3 --> REV["Review discipline - the only control available"]
    O4 --> RESULT["Detection coverage rises from 2 of 120 to 73 of 120"]
    classDef good fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
    classDef info fill:#0d47a1,stroke:#90caf9,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-045` — **Failure Detection Coverage**
> **Explanation:** The counts are classifications made in this document, not measurements of a
> running system. They are stated as an argument for sequencing, not as an achievement: today two
> of one hundred and twenty failures have a working automated detector, and both run only when an
> agent chooses to run them.

---

## 01.26 — Decision Model

### AI NAVIGATION METADATA — §01.26

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — consult when a choice must be made** |
| **AI DEPENDENCIES** | §01.10 principles, §01.11 non-goals, §01.19 constraints, §01.20 drift |
| **AI INPUTS** | A decision point encountered during work |
| **AI OUTPUTS** | A determinate outcome plus the record required to justify it |
| **AI IMPLEMENTATION IMPACT** | Determines what gets built and in what order |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-095`…`VAL-VIS-097`, `VAL-VIS-105`, `VAL-VIS-167` |
| **AI RELATED DOCUMENTS** | `.ai/DECISION_LOG.md`, `docs/ADR/`, `AOM-ARCH-001` §01.26 |

> **`VIS-095`.** Decisions recorded in §01.1–§01.25 are already made. This section supplies
> **decision procedures for choices not yet made** — the reusable trees an agent runs when the
> answer is not already written down. A procedure is only useful if two agents running it on the
> same inputs reach the same conclusion; every tree below is therefore total (every path ends) and
> deterministic (no path depends on preference).

### TBL-VIS-116: Decision Procedure Register

| ID | Decision | Trigger | Decider | Determinism |
| :--- | :--- | :--- | :--- | :--- |
| `DEC-VIS-017` | Should this work be done at all? | Any new task | Agent, halting to human on ambiguity | Total |
| `DEC-VIS-018` | Which status applies to this element? | Creating or updating any element | Agent | Total |
| `DEC-VIS-019` | Is this a new capability or an existing one? | A capability is proposed | Agent | Total |
| `DEC-VIS-020` | Which tier does this capability belong to? | A capability is registered | Computed from dependencies | Total |
| `DEC-VIS-021` | Is this change constitutional? | Any edit to an L1 document | Agent, halting to owner | Total |
| `DEC-VIS-022` | Should this be a principle, a constraint, or a non-goal? | A general rule is proposed | Agent | Total |
| `DEC-VIS-023` | Is this claim safe to assert? | Writing any factual statement | Agent | Total |
| `DEC-VIS-024` | Should the agent proceed or halt? | Any anomaly | Agent | Total |
| `DEC-VIS-025` | Which document owns this content? | Content has no obvious home | Agent, using the routing table | Total |
| `DEC-VIS-026` | Is this outcome complete? | An outcome is claimed done | Agent, verified by owner | Total |
| `DEC-VIS-027` | Should an identifier be deprecated or corrected in place? | An element becomes wrong | Agent | Total |
| `DEC-VIS-028` | Is this a defect in the specification or in the artifact? | A mismatch is found | Agent, halting to owner | Total |
| `DEC-VIS-029` | Should this part be extended or a new part started? | A document approaches a limit | Agent | Total |
| `DEC-VIS-030` | Is human approval required for this action? | Before every state-changing action | Agent, defaulting to yes | Total |

### 01.26.1 `DEC-VIS-017` — Should This Work Be Done?

```mermaid
flowchart TD
    S["Task proposed"] --> Q1{"Matches a PERMANENT non-goal?"}
    Q1 -->|"Yes"| R1["REFUSE - cite the NG-VIS id"]:::stop
    Q1 -->|"No"| Q2{"Matches a conditional non-goal with its condition unmet?"}
    Q2 -->|"Yes"| R2["REFUSE - state the unmet condition"]:::stop
    Q2 -->|"No"| Q3{"Legal in the current phase?"}
    Q3 -->|"No"| R3["DEFER - cite TBL-VIS-060"]:::warn
    Q3 -->|"Yes"| Q4{"Traces to a registered PROB-VIS problem?"}
    Q4 -->|"No"| Q5{"Can a problem be evidenced now?"}
    Q5 -->|"No"| R4["REFUSE - unjustified work"]:::stop
    Q5 -->|"Yes"| R5["REGISTER the problem first, then re-enter"]:::warn
    Q4 -->|"Yes"| Q6{"Blocked by an unmet precondition?"}
    Q6 -->|"Yes"| R6["DEFER - record the blocker"]:::warn
    Q6 -->|"No"| Q7{"Does it advance a tier 1 to 3 item, or an OUT-VIS outcome?"}
    Q7 -->|"No"| R7["DEPRIORITISE - park as PROPOSED"]:::warn
    Q7 -->|"Yes"| R8["PROCEED"]:::go
    classDef stop fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef warn fill:#e65100,stroke:#ffcc80,color:#ffffff
    classDef go fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-046` — **Work Admission Decision**
> **Explanation:** Seven gates, and only one produces `PROCEED`. The ordering is deliberate:
> prohibition is checked before legality, legality before justification, and justification before
> value — so the cheapest rejection always happens first.

### 01.26.2 `DEC-VIS-018` — Status Assignment

```mermaid
flowchart TD
    A["Element needs a status"] --> B{"Does an inspectable artifact exist?"}
    B -->|"No"| C{"Is it specified in an accepted document?"}
    C -->|"No"| D{"Has anyone decided to do it?"}
    D -->|"No"| E["PROPOSED"]
    D -->|"Yes"| F["PLANNED"]
    C -->|"Yes"| F
    B -->|"Yes"| G{"Does the artifact produce all declared outputs?"}
    G -->|"No"| H["PARTIALLY IMPLEMENTED - list what is missing"]
    G -->|"Yes"| I{"Is the artifact executable, or only a document?"}
    I -->|"Document only"| J["DOCUMENTED"]
    I -->|"Executable"| K["IMPLEMENTED - attach EVD-VIS reference"]
    A --> L{"Was it superseded or withdrawn?"}
    L -->|"Yes"| M["DEPRECATED - never delete"]
    A --> N{"Cannot be determined without inspection?"}
    N -->|"Yes"| O["UNKNOWN - REQUIRES REPOSITORY VERIFICATION"]
```

> **Diagram ID:** `DGM-VIS-047` — **Status Assignment Decision**
> **Explanation:** The distinction that matters most is between `DOCUMENTED` and `IMPLEMENTED`.
> Collapsing them is `FAL-VIS-016`, the single most common source of false confidence in a
> specification-heavy repository, and the reason `EVD-VIS-` references are mandatory on the
> right-hand branch.

### 01.26.3 `DEC-VIS-019` and `DEC-VIS-020` — Capability Identity and Tier

```mermaid
flowchart TD
    A["Capability proposed"] --> B{"Search the register - does an entry share its purpose?"}
    B -->|"Yes, identical"| C["Reuse the existing identifier"]:::go
    B -->|"Yes, overlapping"| D{"Can it be expressed as a variation of the existing one?"}
    D -->|"Yes"| E["Extend the existing entry"]:::go
    D -->|"No"| F["Register a new capability and note the relationship"]
    B -->|"No"| F
    F --> G["Compute the tier"]
    G --> H{"Depends on any other capability?"}
    H -->|"No"| I["Tier 1 candidate"]
    H -->|"Yes"| J["Tier equals the highest dependency tier plus one"]
    I --> K{"Is it IMPLEMENTED today?"}
    K -->|"Yes"| L["Tier 1"]
    K -->|"No"| M["Tier 2"]
    J --> N{"Requires a runtime that does not exist?"}
    N -->|"Yes"| O["Tier 4 or 5"]
    N -->|"No"| P["Tier 3"]
    classDef go fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-048` — **Capability Identity and Tier Computation**
> **Explanation:** Tier is computed, never chosen (`FAL-VIS-020`, `FAL-VIS-026`). Searching before
> allocating is the countermeasure to `FAL-VIS-023`; the "note the relationship" branch preserves
> the association that a plain new registration would lose.

### 01.26.4 `DEC-VIS-021` and `DEC-VIS-022` — Change Class and Rule Class

### TBL-VIS-117: Is This Change Constitutional? (`DEC-VIS-021`)

| Question | Yes | No |
| :--- | :--- | :--- |
| Does it change what Oship *is*? | Constitutional — owner approval, decision record | Continue |
| Does it change a `PERMANENT` non-goal? | Constitutional | Continue |
| Does it change principle ordering? | Constitutional | Continue |
| Does it change a hard constraint (`CON-VIS-001`…`010`)? | Constitutional | Continue |
| Does it retire or renumber an identifier? | Constitutional | Continue |
| Does it change an accepted part's existing text? | Prohibited (`PRN-VIS-006`) — append instead | Continue |
| Does it add a new element within an existing schema? | Structural — normal review | Continue |
| Does it correct a factual status? | Operational — proceed, record the evidence | Editorial — proceed |

### TBL-VIS-118: Principle, Constraint, or Non-Goal? (`DEC-VIS-022`)

| If the rule… | It is a | Recorded as | Because |
| :--- | :--- | :--- | :--- |
| ranks options when several are viable | **Principle** | `PRN-VIS-` | It resolves ties; it does not remove choices |
| removes options regardless of preference | **Constraint** | `CON-VIS-` | It is applied before design, not during |
| declares an entire class of work out of scope | **Non-goal** | `NG-VIS-` | It is a screening filter, not a tiebreaker |
| describes a state to reach | **Outcome** | `OUT-VIS-` | It completes; principles never complete |
| describes something the system does | **Capability** | `CAP-VIS-` | It has inputs, outputs, and an actor |
| describes something observed to be wrong | **Problem** | `PROB-VIS-` | It requires evidence |
| describes a way work goes wrong | **Failure** | `FAL-VIS-` | It has a symptom and a remediation |
| must be mechanically checkable | **Validation rule** | `VAL-VIS-` | It has a pass and a fail |

> **`VIS-096`.** Misclassification is not cosmetic. A constraint written as a principle becomes
> negotiable; a principle written as a constraint blocks legitimate design; an outcome written as a
> principle is never finished. `DEC-VIS-022` exists because these three errors account for most
> observed rule-system decay.

### 01.26.5 `DEC-VIS-023` and `DEC-VIS-024` — Assertion Safety and Halting

```mermaid
flowchart TD
    A["About to assert a fact"] --> B{"Did I read it in this repository during this session?"}
    B -->|"Yes"| C["Assert, citing the path"]:::go
    B -->|"No"| D{"Is it stated in an accepted document I can cite?"}
    D -->|"Yes"| E["Assert, citing document and version"]:::go
    D -->|"No"| F{"Can I verify it right now with a tool?"}
    F -->|"Yes"| G["Verify first, then assert"]:::go
    F -->|"No"| H{"Is it a general truth independent of this repository?"}
    H -->|"Yes"| I["Assert, marked as general knowledge"]
    H -->|"No"| J["Write UNKNOWN - REQUIRES REPOSITORY VERIFICATION"]:::stop
    classDef go fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef stop fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-049` — **Assertion Safety Gate (`DEC-VIS-023`)**
> **Explanation:** Four paths permit assertion and one forbids it. The forbidden path is the one
> that feels most natural to a fluent generator, which is precisely why it is drawn explicitly.
> This gate is the operational form of `PRN-VIS-001` and the direct countermeasure to `FAL-VIS-046`.

### TBL-VIS-119: Halt Conditions (`DEC-VIS-024`)

| Condition | Halt? | Action |
| :--- | :---: | :--- |
| Two authoritative statements conflict | Yes | State both, cite both, request a decision |
| A required fact cannot be verified | No | Label `UNKNOWN` and continue if the work does not depend on it |
| A required fact cannot be verified and the work depends on it | Yes | Request verification |
| Drift severity D3 or above detected | Yes | Report; do not work around it |
| The action is irreversible | Yes | Request approval |
| The action leaves the sandbox or costs money | Yes | Request approval |
| A `PERMANENT` non-goal would be violated | Yes | Refuse; do not request an exception |
| The context limit is approaching | Yes | Emit the continuation marker and stop |
| An instruction contradicts a constitutional rule | Yes | Surface the conflict; do not silently choose |
| The next step is merely tedious | No | Continue |
| The next step is ambiguous but low-impact and reversible | No | Choose, record the assumption, continue |

### 01.26.6 `DEC-VIS-025` through `DEC-VIS-030`

### TBL-VIS-120: Content Routing (`DEC-VIS-025`)

| Content kind | Destination | Authority |
| :--- | :--- | :--- |
| What the system is and why | `01_PRODUCT/SYSTEM_VISION.md` | L1 |
| How the system is structured | `04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` | L1 |
| An irreversible technical choice | `docs/ADR/` | L1, immutable |
| Current work state | `.ai/CURRENT_CONTEXT.md`, `.ai/NEXT_ACTION.md` | Operational |
| A recorded decision with alternatives | `.ai/DECISION_LOG.md` | L2 |
| A correction learned the hard way | `.ai/LESSONS_LEARNED.md` | Operational |
| A domain's scope and contents | The domain `INDEX.md` | L2 |
| Cross-cutting authoring rules | `MASTER_CONTEXT_RULES.md` | L1 |
| Anything with no obvious home | Halt; ask before creating a new document | — |

### TBL-VIS-121: Remaining Procedures

| ID | Procedure | Rule |
| :--- | :--- | :--- |
| `DEC-VIS-026` | Outcome completion | An outcome is complete only when its completion test is satisfied by an artifact a third party can inspect without asking the author. Self-report is insufficient. Partial satisfaction leaves the status `IN_PROGRESS`. |
| `DEC-VIS-027` | Deprecate or correct | If the element's **meaning** changed, deprecate the identifier and allocate a new one. If only the **description** was wrong, correct it in place and record the correction. Never repurpose an identifier whose meaning changed. |
| `DEC-VIS-028` | Spec or artifact defect | If the artifact violates an accepted specification, the artifact is the defect. If the specification is contradicted by a verified fact about the world, the specification is the defect and must be amended through governance. If both are internally consistent but mutually incompatible, halt (`AI-VIS-046`). |
| `DEC-VIS-029` | Extend or start a new part | Extend the current part while the section under way is unfinished and the limit is not close. Start a new part when the previous part's final section is complete. Never split a section across parts. Never rewrite an accepted part to make room. |
| `DEC-VIS-030` | Approval required? | Required if the action is irreversible, leaves the sandbox, incurs cost, changes a constitutional element, or affects another party's work. Not required if it is reversible, local, within an accepted plan, and recorded. When the classification is unclear, approval is required — the default is yes. |

```mermaid
stateDiagram-v2
    [*] --> Encountered
    Encountered --> Consulted: look for an existing decision
    Consulted --> Applied: a recorded decision exists
    Consulted --> Procedural: no record, but a DEC-VIS procedure applies
    Consulted --> Escalated: neither exists
    Procedural --> Applied: procedure yields a determinate answer
    Procedural --> Escalated: procedure halts
    Escalated --> Recorded: human decides
    Applied --> Recorded: outcome logged if consequential
    Recorded --> [*]
```

> **Diagram ID:** `DGM-VIS-050` — **Decision Lifecycle**
> **Explanation:** Every decision ends in one of two places: applied from a record, or escalated
> and then recorded. There is no terminal state in which a consequential decision is made and left
> unrecorded — that state is `FAL-VIS-064`.

---

## 01.27 — Traceability Matrix

### AI NAVIGATION METADATA — §01.27

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — the machine-traversable index of this document** |
| **AI DEPENDENCIES** | All preceding sections |
| **AI INPUTS** | Any identifier |
| **AI OUTPUTS** | Its upstream justification and downstream consequences |
| **AI IMPLEMENTATION IMPACT** | Enables impact analysis before any change |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-177`…`VAL-VIS-186` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.27, `MASTER_CONTEXT_RELATIONSHIPS.md` |

> **`VIS-097`.** The matrix below is written as fixed-column tables so that a parser can read each
> row as a triple without natural-language processing. Cells contain identifiers only, or the
> literal token `NONE` or `UNMAPPED`. This is the countermeasure to `FAL-VIS-037`.

```mermaid
flowchart LR
    EVD["EVD-VIS - evidence"] --> PROB["PROB-VIS - problems"]
    PROB --> CAP["CAP-VIS - capabilities"]
    ACT["ACT-VIS - actors"] --> PROB
    ACT --> CAP
    CAP --> OUT["OUT-VIS - outcomes"]
    PRN["PRN-VIS - principles"] --> CAP
    CON["CON-VIS - constraints"] --> CAP
    NG["NG-VIS - non-goals"] --> CAP
    CAP --> ARCH["AOM-ARCH-001 elements"]
    OUT --> SUC["SUC-VIS - measures"]
    CAP --> VAL["VAL-VIS - validation"]
    VAL --> FAL["FAL-VIS - failures"]
    ARCH --> IMPL["Implementation - PLANNED"]:::planned
    IMPL --> TEST["Tests - PLANNED"]:::planned
    TEST --> REL["Releases - PLANNED"]:::planned
    classDef planned fill:#37474f,stroke:#b0bec5,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-051` — **Full Traceability Graph**
> **Explanation:** Evidence grounds problems; problems justify capabilities; capabilities produce
> outcomes; outcomes are measured. The three grey nodes on the right are the links that do not yet
> exist — the chain is complete from evidence to architecture and absent thereafter (`FAL-VIS-038`).

### TBL-VIS-122: Problem to Capability to Outcome

| Problem | Primary actor | Responding capability | Enabling outcome | Status of response |
| :--- | :--- | :--- | :--- | :--- |
| `PROB-VIS-001` | `ACT-VIS-003` | `CAP-VIS-001` | `OUT-VIS-001` | IMPLEMENTED |
| `PROB-VIS-002` | `ACT-VIS-003` | `CAP-VIS-002` | `OUT-VIS-002` | PARTIALLY IMPLEMENTED |
| `PROB-VIS-003` | `ACT-VIS-001` | `CAP-VIS-004` | `OUT-VIS-001` | IMPLEMENTED |
| `PROB-VIS-004` | `ACT-VIS-003` | `CAP-VIS-006` | `OUT-VIS-003` | IMPLEMENTED |
| `PROB-VIS-005` | `ACT-VIS-002` | `CAP-VIS-008` | `OUT-VIS-003` | IMPLEMENTED |
| `PROB-VIS-006` | `ACT-VIS-001` | `CAP-VIS-011` | `OUT-VIS-002` | IMPLEMENTED |
| `PROB-VIS-007` | `ACT-VIS-004` | `CAP-VIS-013` | `OUT-VIS-002` | IMPLEMENTED |
| `PROB-VIS-008` | `ACT-VIS-003` | `CAP-VIS-016` | `OUT-VIS-001` | IMPLEMENTED |
| `PROB-VIS-009` | `ACT-VIS-001` | `CAP-VIS-003` | `OUT-VIS-004` | PLANNED |
| `PROB-VIS-010` | `ACT-VIS-002` | `CAP-VIS-005` | `OUT-VIS-004` | PLANNED |
| `PROB-VIS-011` | `ACT-VIS-003` | `CAP-VIS-007` | `OUT-VIS-005` | PLANNED |
| `PROB-VIS-012` | `ACT-VIS-001` | `CAP-VIS-009` | `OUT-VIS-004` | PLANNED |
| `PROB-VIS-013` | `ACT-VIS-004` | `CAP-VIS-012` | `OUT-VIS-006` | PLANNED |
| `PROB-VIS-014` | `ACT-VIS-005` | `CAP-VIS-017` | `OUT-VIS-006` | PLANNED |
| `PROB-VIS-015` | `ACT-VIS-003` | `CAP-VIS-018` | `OUT-VIS-007` | PLANNED |
| `PROB-VIS-016` | `ACT-VIS-002` | `CAP-VIS-019` | `OUT-VIS-004` | PLANNED |
| `PROB-VIS-017` | `ACT-VIS-001` | `CAP-VIS-020` | `OUT-VIS-004` | PLANNED |
| `PROB-VIS-018` | `ACT-VIS-006` | `CAP-VIS-021` | `OUT-VIS-008` | PLANNED |
| `PROB-VIS-019` | `ACT-VIS-007` | `CAP-VIS-022` | `OUT-VIS-011` | PLANNED |
| `PROB-VIS-020` | `ACT-VIS-008` | `CAP-VIS-023` | `OUT-VIS-009` | PLANNED |
| `PROB-VIS-021` | `ACT-VIS-009` | `CAP-VIS-024` | `OUT-VIS-010` | PLANNED |
| `PROB-VIS-022` | `ACT-VIS-010` | `CAP-VIS-025` | `OUT-VIS-012` | PLANNED |
| `PROB-VIS-023` | `ACT-VIS-011` | `CAP-VIS-030` | `OUT-VIS-013` | PLANNED |

### TBL-VIS-123: Principle to Consequence to Validation

| Principle | Rank | Enforced by | Violated by | Validation rule |
| :--- | :---: | :--- | :--- | :--- |
| `PRN-VIS-001` truth over comfort | 1 | `DEC-VIS-023` | `FAL-VIS-046`, `FAL-VIS-016` | `VAL-VIS-119` |
| `PRN-VIS-002` determinism | 2 | `DEC-VIS-017`…`030` | `FAL-VIS-050` | `VAL-VIS-196` |
| `PRN-VIS-003` explicit over implicit | 3 | `AI-VIS-048` | `FAL-VIS-049`, `FAL-VIS-088` | `VAL-VIS-099` |
| `PRN-VIS-004` traceable | 4 | §01.27 | `FAL-VIS-031`…`045` | `VAL-VIS-188` |
| `PRN-VIS-005` agent-tractable | 5 | §01.23 | `FAL-VIS-002`, `FAL-VIS-076` | `VAL-VIS-163` |
| `PRN-VIS-006` immutable decisions | 6 | Append-only model | `FAL-VIS-048`, `FAL-VIS-054` | `VAL-VIS-019` |
| `PRN-VIS-007` stable identity | 7 | `AI-VIS-052` | `FAL-VIS-025`, `FAL-VIS-012` | `VAL-VIS-035` |
| `PRN-VIS-008` human accountability | 8 | `DEC-VIS-030` | `FAL-VIS-106`, `FAL-VIS-057` | `VAL-VIS-040` |
| `PRN-VIS-013` reversibility | 13 | `DEC-VIS-030` | `FAL-VIS-109` | `VAL-VIS-096` |
| `PRN-VIS-015` vendor independence | 15 | `DEC-VIS-022` | `FAL-VIS-022`, `FAL-VIS-099` | `VAL-VIS-191` |
| `PRN-VIS-016` least privilege | 16 | Boundary model | `FAL-VIS-101` | `VAL-VIS-093` |
| `PRN-VIS-017` observability | 17 | `SUC-VIS-` register | `FAL-VIS-009` | `VAL-VIS-134` |
| `PRN-VIS-020` finish before starting | 20 | `DEC-VIS-017` | `FAL-VIS-027`, `FAL-VIS-074` | `VAL-VIS-120` |

### TBL-VIS-124: Constraint to Affected Element

| Constraint | Class | Removes the option of | Affected capabilities | Mitigated? |
| :--- | :--- | :--- | :--- | :---: |
| `CON-VIS-001` | Hard structural | Application code in phase P0 | `CAP-VIS-025`…`070` | Structural |
| `CON-VIS-002` | Hard structural | Runtime state | `CAP-VIS-041`…`048` | Structural |
| `CON-VIS-003` | Hard structural | Deployed infrastructure | `CAP-VIS-060`…`070` | Structural |
| `CON-VIS-011` | Real limitation | Independent review | All | **No** |
| `CON-VIS-012` | Real limitation | Automated enforcement | All | **No** |
| `CON-VIS-021` | Voluntary | Renaming identifiers | All | Accepted cost |
| `CON-VIS-022` | Voluntary | Rewriting accepted parts | All | Accepted cost |

### TBL-VIS-125: Vision to Architecture Cross-Reference Index

| Vision element | `AOM-ARCH-001` counterpart | Direction | Confidence |
| :--- | :--- | :--- | :--- |
| Capability tiers T1–T5 | Layers `LYR-ARCH-001`…`010` | Non-bijective mapping | Medium |
| `CAP-VIS-001`, `004`, `006` | `CMP-ARCH-001`…`008` | Direct | High |
| `CAP-VIS-009`, `049`…`056` | `UNMAPPED` | Gap for ARCH Part 02 | — |
| `BND-VIS-` trust boundaries | `TB-1`…`TB-10` | Direct | High |
| `PRN-VIS-015` | `UNMAPPED` | Gap | — |
| `PRN-VIS-002` determinism | `ARCH-038` | Direct | High |
| `PRN-VIS-006` immutable decisions | `ARCH-041` | Direct | High |
| `PRN-VIS-008` accountability | `AI-ARCH-041` | Direct | High |
| Domain model | `DOM-ARCH-001`…`010` | Direct | High |

### TBL-VIS-126: Reverse Index — Where to Look

| If you need to know… | Read | Identifier family |
| :--- | :--- | :--- |
| Why Oship exists | §01.2, §01.4 | `VIS-`, `PROB-VIS-` |
| Who it serves | §01.5 | `ACT-VIS-` |
| What it does | §01.7, §01.8 | `CAP-VIS-` |
| What it will never do | §01.11 | `NG-VIS-` |
| How choices are ranked | §01.10 | `PRN-VIS-` |
| What is impossible today | §01.19 | `CON-VIS-` |
| What "done" means | §01.12, §01.13 | `SUC-VIS-`, `OUT-VIS-` |
| What phase we are in | §01.14 | Phases P0–P5 |
| How to behave as an agent | §01.23 | `AI-VIS-` |
| What to check before hand-off | §01.24 | `VAL-VIS-` |
| What went wrong | §01.25 | `FAL-VIS-` |
| How to decide | §01.26 | `DEC-VIS-` |
| Where something traces | §01.27 | All |

---

## 01.28 — Future Evolution of This Document

### AI NAVIGATION METADATA — §01.28

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P2 — read before starting PART 02** |
| **AI DEPENDENCIES** | §01.14 evolution model, §01.21 governance, §01.22 change management |
| **AI INPUTS** | The completed PART 01 |
| **AI OUTPUTS** | The scope and identifier allocations for subsequent parts |
| **AI IMPLEMENTATION IMPACT** | Prevents the next author from duplicating or contradicting this part |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-018`…`VAL-VIS-020` |
| **AI RELATED DOCUMENTS** | `.ai/NEXT_ACTION.md`, `01_PRODUCT/INDEX.md` |

> **`VIS-098`.** This document is **incomplete by design**. PART 01 establishes identity, problems,
> actors, value, capabilities, boundaries, principles, prohibitions, measures, outcomes, evolution,
> AI model, traceability, derivation, constraints, drift, governance, change, interpretation,
> validation, failures, decisions, and the traceability matrix. It does **not** establish the
> product-level detail, the domain models, or the operating specifics that later parts must supply.

### TBL-VIS-127: Planned Parts

| Part | Working title | Scope | Status |
| :---: | :--- | :--- | :--- |
| **01** | System Identity and Vision Constitution | §01.1–§01.28, Appendices A and B | **This part** |
| 02 | Domain Vision and Product Surfaces | The Money Factory domain in depth: sub-domains, workflows, artifacts, and the actor journeys that cross them | PLANNED |
| 03 | Capability Specification Expansion | Full field expansion for tier-3 and tier-4 capabilities, with acceptance criteria per capability | PLANNED |
| 04 | Measurement and Instrumentation Vision | How each `SUC-VIS-` measure becomes an instrument; what must exist for measurement to begin | PLANNED |
| 05 | Ecosystem and Extension Vision | Plugins, SDKs, external integrations, and the boundary rules governing them | PROPOSED |
| 06 | Adoption and Operating Vision | How a team adopts Oship; the operating model once a runtime exists | PROPOSED |

> **`VIS-099`.** Parts 05 and 06 are `PROPOSED`, not `PLANNED`: they describe work nobody has yet
> committed to. The distinction is enforced by `DEC-VIS-018` and is the difference between a
> roadmap and a wish list.

### TBL-VIS-128: Identifier Allocation State After PART 01

| Namespace | Ceiling | Highest allocated | Next free | Gaps (intentional) |
| :--- | :---: | :---: | :---: | :--- |
| `VIS-` | 120 | 103 | `VIS-104` | none |
| `PROB-VIS-` | 60 | 023 | `PROB-VIS-024` | none |
| `ACT-VIS-` | 30 | 016 | `ACT-VIS-017` | none |
| `VAL-CHAIN-VIS-` | 20 | 012 | `VAL-CHAIN-VIS-013` | none |
| `CAP-VIS-` | 120 | 070 | `CAP-VIS-071` | `057`–`059` reserved |
| `OUT-VIS-` | 60 | 020 | `OUT-VIS-021` | none |
| `PRN-VIS-` | 30 | 020 | `PRN-VIS-021` | none |
| `NG-VIS-` | 40 | 024 | `NG-VIS-025` | none |
| `CON-VIS-` | 60 | 030 | `CON-VIS-031` | none |
| `SUC-VIS-` | 60 | 025 | `SUC-VIS-026` | none |
| `BND-VIS-` | 30 | 016 | `BND-VIS-017` | none |
| `EVD-VIS-` | 50 | 025 | `EVD-VIS-026` | none |
| `DEC-VIS-` | 40 | 030 | `DEC-VIS-031` | `008`–`009` reserved |
| `AI-VIS-` | 60 | 060 | `AI-VIS-061` | none |
| `VAL-VIS-` | 200 | 200 | **ceiling reached** | none |
| `FAL-VIS-` | 200 | 120 | `FAL-VIS-121` | none |
| `DGM-VIS-` | 200 | 053 | `DGM-VIS-054` | none |
| `TBL-VIS-` | 200 | 138 | `TBL-VIS-139` | none |
| `IMG-VIS-` | 40 | 022 | `IMG-VIS-023` | none |

> **`VIS-100`.** The `VAL-VIS-` namespace has reached its declared ceiling of 200. PART 02 must
> either raise the ceiling through a governance change (`DEC-VIS-021`) or place new validation
> rules in a separate document. It must **not** silently exceed the ceiling, and it must **not**
> reuse retired numbers.

```mermaid
flowchart LR
    P1["PART 01 - constitution"] --> P2["PART 02 - domain vision"]
    P2 --> P3["PART 03 - capability expansion"]
    P3 --> P4["PART 04 - measurement"]
    P4 --> P5["PART 05 - ecosystem"]:::prop
    P5 --> P6["PART 06 - adoption"]:::prop
    P1 -.->|"read-only reference"| ARCH["AOM-ARCH-001 PART 01"]
    P2 -.->|"requires"| ARCH2["AOM-ARCH-001 PART 02"]:::plan
    P4 -.->|"requires"| OUT4["OUT-VIS-004 - CI installed"]:::plan
    classDef prop fill:#37474f,stroke:#b0bec5,color:#ffffff
    classDef plan fill:#0d47a1,stroke:#90caf9,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-052` — **Part Sequence and External Dependencies**
> **Explanation:** Parts are strictly sequential in authoring order, but two have hard external
> dependencies: PART 02 cannot resolve its architecture references until `AOM-ARCH-001` PART 02
> exists, and PART 04 cannot specify instrumentation before CI exists. Writing them earlier would
> produce `FAL-VIS-098`.

### TBL-VIS-129: Rules Binding Every Future Part

| Rule | Statement |
| :--- | :--- |
| Append only | New parts are appended after the last line of the previous part. No accepted line is edited, reordered, or squashed. |
| Part marker | Each part opens with a `PART NN` heading and the identifier ranges it allocates. |
| Identifier continuity | Allocation begins at the next free number in `TBL-VIS-128`. Retired numbers are never reused. |
| No contradiction | A later part may **extend** or **supersede with a record**, but may never silently contradict PART 01. |
| Status honesty | Every claim carries a status from the closed vocabulary and evidence where it asserts implementation. |
| Visual density | No block exceeding roughly 120 lines without a visual anchor. |
| Section format | Seven-row AI navigation metadata table, numbered subsections, explained diagrams, captioned tables. |
| Validation | Mermaid parsing and anchor resolution must pass before hand-off. |
| Control plane | `.ai/PROJECT_STATUS.md`, `.ai/CURRENT_CONTEXT.md`, and `.ai/NEXT_ACTION.md` updated in the same change. |
| No release | The document remains `IN_PROGRESS` until the final part; no tag, no merge, no version bump to 2.0.0. |

### 01.28.1 Conditions That Would Force Revision of PART 01

### TBL-VIS-130: Revision Triggers

| Trigger | Detected by | Effect on PART 01 | Response |
| :--- | :--- | :--- | :--- |
| Application code is written | Repository inspection | `CON-VIS-001` no longer holds; phase advances to P1 | Append a supersession note; do not edit §01.19 |
| CI is installed (`OUT-VIS-004`) | `.github/workflows/` populated | `CON-VIS-012` resolved; 173 rules become enforceable | Append a status amendment |
| A second owner is added | `CODEOWNERS` change | `CON-VIS-011` resolved; independent review becomes possible | Append; update `VIS-069` |
| A technology stack is chosen | An accepted ADR | `EVD-VIS-019` `UNKNOWN` resolves | Append with the ADR citation |
| `OUT-VIS-015` is achieved | An agent-authored end-to-end pull request | `VIS-004` gains its first falsifiable confirmation | Append the evidence; this is the most consequential trigger |
| The Money Factory domain is descoped | An owner decision | The identity statement changes | Constitutional change; owner approval and a decision record required |
| A `PERMANENT` non-goal is challenged | A change proposal | Prohibition set integrity at risk | Refuse at the agent level; escalate to the owner |
| Autonomy class A4 is requested | A change proposal | `VIS-033` at risk | Refuse; A4 is permanently prohibited |

> **`VIS-101`.** Six of the eight triggers above are **resolutions of admitted gaps**, not
> failures. A document that names its own gaps precisely enough for their resolution to be
> detectable has done the main thing a constitution can do for a system that does not yet exist.

---

## APPENDIX A — Image Specifications

> **Purpose.** These are **specifications for images that do not yet exist**. No binary image files
> are created by this document. Each entry gives a downstream author or generation tool everything
> needed to produce the artifact without re-deriving intent. Status of every entry: `SPECIFIED —
> NOT PRODUCED`.

### TBL-VIS-131: Image Specification Register

| ID | Title | Audience | Aspect | Priority |
| :--- | :--- | :--- | :---: | :---: |
| `IMG-VIS-001` | Oship Identity Map | All | 16:9 | P0 |
| `IMG-VIS-002` | The Specification-First Inversion | Executive | 16:9 | P0 |
| `IMG-VIS-003` | Problem Space Constellation | Product | 4:3 | P1 |
| `IMG-VIS-004` | Actor Ecosystem | All | 16:9 | P0 |
| `IMG-VIS-005` | Value Chain Loop | Executive | 21:9 | P1 |
| `IMG-VIS-006` | Capability Tier Pyramid | Engineering | 4:3 | P0 |
| `IMG-VIS-007` | Capability Reality Heatmap | Engineering | 16:9 | P0 |
| `IMG-VIS-008` | System Boundary Ring | Engineering | 1:1 | P1 |
| `IMG-VIS-009` | Trust Boundary Cross-Section | Security | 16:9 | P1 |
| `IMG-VIS-010` | Principle Precedence Ladder | All | 9:16 | P1 |
| `IMG-VIS-011` | Non-Goal Wall | All | 16:9 | P2 |
| `IMG-VIS-012` | Measurement Instrument Panel | Product | 16:9 | P1 |
| `IMG-VIS-013` | Outcome Dependency Constellation | Product | 16:9 | P0 |
| `IMG-VIS-014` | Phase Progression Timeline | Executive | 21:9 | P1 |
| `IMG-VIS-015` | Autonomy Boundary Gradient | Engineering | 16:9 | P0 |
| `IMG-VIS-016` | Human and Agent Leverage Split | All | 16:9 | P1 |
| `IMG-VIS-017` | Vision to Architecture Bridge | Engineering | 21:9 | P0 |
| `IMG-VIS-018` | Constraint Filter Funnel | Engineering | 9:16 | P2 |
| `IMG-VIS-019` | Drift Radar | Engineering | 1:1 | P1 |
| `IMG-VIS-020` | AI Boot Sequence Rail | AI agents | 21:9 | P0 |
| `IMG-VIS-021` | Failure Family Wheel | Engineering | 1:1 | P2 |
| `IMG-VIS-022` | Traceability Spine | All | 21:9 | P0 |

### A.1 `IMG-VIS-001` — Oship Identity Map

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-001` |
| **Title** | Oship Identity Map |
| **Purpose** | Answer "what is Oship?" in one image, without overclaiming |
| **Audience** | Every reader, human or agent, on first contact |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080, dark background |
| **Visual hierarchy** | Layer 1: central identity block. Layer 2: four surrounding definition panels. Layer 3: a lower band showing what exists today versus what is specified |
| **Elements** | Centre: "Oship — an AI-native enterprise software factory". Four panels: *Method*, *Knowledge base*, *Governance*, *Target domain — Money Factory*. Lower band: two bars labelled "specification" and "application code" |
| **Relationships** | Each panel connects to the centre with a short solid line; the lower band sits beneath, connected by a thin vertical rule |
| **Labels** | Panel titles in sentence case; the lower band annotated "specification: extensive" and "application code: none in phase P0" |
| **Colour semantics** | Teal for existing artifacts, slate grey for planned, amber for partial. No green anywhere — nothing here is verified complete |
| **Typography** | Geometric sans; centre block at 48 pt, panels at 28 pt, annotations at 18 pt |
| **Legend** | Bottom-right, three swatches: exists, partial, planned |
| **Meaning** | Oship is currently a method and a knowledge base aimed at a domain it has not yet entered |
| **AI interpretation** | Use this to answer identity questions. Never crop away the lower band — it is the honesty control |
| **Implementation relevance** | Sets reader expectation before any capability claim is read |
| **Generation prompt** | "A clean dark technical diagram, 16:9. A central rounded rectangle labelled 'Oship — an AI-native enterprise software factory' in teal. Four smaller panels arranged around it labelled Method, Knowledge base, Governance, Target domain. Below, a horizontal band with two proportional bars, a long teal bar labelled specification and an empty slate outline labelled application code. Minimal flat vector style, thin connecting lines, generous negative space, no photorealism, no people, no logos." |

### A.2 `IMG-VIS-002` — The Specification-First Inversion

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-002` |
| **Title** | The Specification-First Inversion |
| **Purpose** | Show that in Oship the specification is authoritative and the code is derived |
| **Audience** | Executives and engineers unfamiliar with the model |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080 |
| **Visual hierarchy** | Two mirrored stacks side by side, joined by a curved inversion arrow |
| **Elements** | Left stack, "conventional": code at the top, docs at the bottom, docs faded. Right stack, "Oship": specification at the top in full saturation, code below, derived |
| **Relationships** | A curved arrow crosses from left to right labelled "authority inverts" |
| **Labels** | "Documentation describes code" versus "Code implements specification" |
| **Colour semantics** | Faded grey for the non-authoritative layer, saturated teal for the authoritative one |
| **Typography** | Sans; stack labels 30 pt; the inversion arrow label 24 pt italic |
| **Legend** | Not required |
| **Meaning** | The unusual claim of the whole system, in one picture |
| **AI interpretation** | When code and specification disagree, the right stack tells you which one is the defect (`DEC-VIS-028`) |
| **Implementation relevance** | Justifies why specification work precedes implementation work in phase P0 |
| **Generation prompt** | "Two vertical layered stacks side by side on a dark background, flat vector infographic, 16:9. Left stack labelled conventional with a bright top block labelled code and a faded lower block labelled documentation. Right stack labelled Oship with a bright teal top block labelled specification and a dimmer lower block labelled code. A large curved arrow sweeps from the left stack to the right stack. Clean, minimal, no text beyond the labels, no people." |

### A.3 `IMG-VIS-004` — Actor Ecosystem

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-004` |
| **Title** | Actor Ecosystem |
| **Purpose** | Show every actor, whether it exists today, and how accountability flows |
| **Audience** | All readers |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080 |
| **Visual hierarchy** | Layer 1: the human owner at the top. Layer 2: agent actors. Layer 3: planned future actors, visibly dimmed |
| **Elements** | Nodes for each `ACT-VIS-` actor, each annotated with its identifier and existence state |
| **Relationships** | Solid arrows for accountability, dashed for delegation. Every accountability arrow terminates at a human node |
| **Labels** | Identifier plus short role name |
| **Colour semantics** | Teal existing, slate planned, amber partial. Human nodes carry a distinct outline weight |
| **Typography** | Sans, 20 pt node labels, 14 pt identifiers |
| **Legend** | Left edge, vertical: exists, partial, planned, human, agent |
| **Meaning** | Accountability never terminates at an agent (`VIS-032`) |
| **AI interpretation** | Before claiming an actor benefits from a capability, check whether that actor exists |
| **Implementation relevance** | Drives the responsibility matrix and the approval gates |
| **Generation prompt** | "A network diagram on a dark background, flat vector, 16:9. A single prominent node at the top with a thick outline representing a human owner. Below it several teal nodes and several dimmed slate nodes connected by thin arrows. Solid arrows converge upward on the top node. Clean technical illustration, no faces, no photorealism, no logos." |

### A.4 `IMG-VIS-006` — Capability Tier Pyramid

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-006` |
| **Title** | Capability Tier Pyramid |
| **Purpose** | Show the five capability tiers and the true population of each |
| **Audience** | Engineering and product |
| **Aspect ratio** | 4:3 |
| **Canvas** | 1440 × 1080 |
| **Visual hierarchy** | An inverted-weight pyramid: tier 1 narrow at the base, tier 4 widest near the top — deliberately unstable-looking |
| **Elements** | Five bands labelled T1 to T5, each annotated with its member count and dominant status |
| **Relationships** | Upward dependency arrows only; a crossed-out downward arrow marks the prohibited direction |
| **Labels** | "T1 — 6 capabilities — IMPLEMENTED" through "T5 — 8 capabilities — PLANNED" |
| **Colour semantics** | Saturation decreases with tier; T4 and T5 rendered as outlines only |
| **Typography** | Sans, band labels 26 pt, counts 20 pt |
| **Legend** | Bottom: "filled = implemented, outline = planned" |
| **Meaning** | The shape is top-heavy on purpose: most capability is specified, little is built (`FAL-VIS-001`) |
| **AI interpretation** | The visual instability is the message; do not redraw it as a conventional stable pyramid |
| **Implementation relevance** | Argues for tier-4 delivery over further tier-4 specification |
| **Generation prompt** | "An inverted pyramid infographic on a dark background, 4:3, flat vector. Five horizontal bands: the narrowest at the bottom filled solid teal, each band above wider and progressively less saturated, the top two bands drawn as outlines only. Thin upward arrows between bands. Minimal, technical, no text beyond short band labels." |

### A.5 `IMG-VIS-007` — Capability Reality Heatmap

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-007` |
| **Title** | Capability Reality Heatmap |
| **Purpose** | Show at a glance which capabilities are real |
| **Audience** | Engineering |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080 |
| **Visual hierarchy** | A single grid of 70 cells, one per registered capability, grouped by tier |
| **Elements** | Cells labelled with the numeric part of the identifier only; tier group headers |
| **Relationships** | None — this is a state view, not a relationship view |
| **Colour semantics** | Solid teal `IMPLEMENTED`, amber `PARTIALLY IMPLEMENTED`, slate outline `PLANNED`, dotted outline `PROPOSED` |
| **Typography** | Monospace numerals, 16 pt |
| **Legend** | Top-right, four swatches with counts |
| **Meaning** | Six teal cells out of seventy |
| **AI interpretation** | Consult before assuming any capability is available; the teal set is the callable set |
| **Implementation relevance** | The single most useful planning image in the document |
| **Generation prompt** | "A dense grid heatmap on a dark background, 16:9, flat vector. Seventy small square cells arranged in five labelled row groups. Six cells filled solid teal, a few amber, the rest thin slate outlines. Small monospace numerals inside each cell. A compact legend in the top right. Clean data-visualisation style, no gradients, no photorealism." |

### A.6 `IMG-VIS-013` — Outcome Dependency Constellation

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-013` |
| **Title** | Outcome Dependency Constellation |
| **Purpose** | Show which outcomes unblock the most work |
| **Audience** | Product and planning |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080 |
| **Visual hierarchy** | Force-directed graph; node size proportional to the number of dependents |
| **Elements** | One node per `OUT-VIS-` outcome; the three root unblockers rendered largest |
| **Relationships** | Directed edges from precondition to dependent |
| **Labels** | Identifier plus a three-word summary |
| **Colour semantics** | Root unblockers in amber, downstream outcomes in slate, achieved outcomes in teal |
| **Typography** | Sans, 18 pt |
| **Legend** | Bottom-left: root, downstream, achieved |
| **Meaning** | Three outcomes gate almost everything (`DGM-VIS-027`) |
| **AI interpretation** | If asked what to do next, answer from the largest amber node |
| **Implementation relevance** | Directly drives sequencing in `.ai/NEXT_ACTION.md` |
| **Generation prompt** | "A force-directed network graph on a dark background, 16:9, flat vector. Three large amber circular nodes with many thin edges radiating outward to numerous smaller slate nodes. A couple of small teal nodes at the periphery. Short labels beside each node. Clean, technical, no photorealism, no background imagery." |

### A.7 `IMG-VIS-015` — Autonomy Boundary Gradient

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-015` |
| **Title** | Autonomy Boundary Gradient |
| **Purpose** | Show exactly where agent authority ends |
| **Audience** | Engineering and AI agents |
| **Aspect ratio** | 16:9 |
| **Canvas** | 1920 × 1080 |
| **Visual hierarchy** | A horizontal band divided into five zones A0 to A4, left to right |
| **Elements** | Zone labels, example actions inside each zone, a hard vertical rule between A2 and A3, and a barred terminator after A4 |
| **Relationships** | A left-to-right arrow labelled "increasing autonomy" running beneath the band |
| **Labels** | A0 observe, A1 propose, A2 act reversibly, A3 act with approval, A4 act irreversibly unattended |
| **Colour semantics** | Teal through amber across A0 to A3; A4 rendered in red with a diagonal bar and the word PROHIBITED |
| **Typography** | Sans; zone titles 28 pt; examples 16 pt |
| **Legend** | Not required — the band is self-describing |
| **Meaning** | A4 is not a future state; it is permanently excluded (`VIS-033`, `NG-VIS-013`) |
| **AI interpretation** | Locate your intended action in a zone before performing it. If it falls in A3, stop and request approval |
| **Implementation relevance** | Becomes the approval gate specification once a runtime exists |
| **Generation prompt** | "A horizontal five-zone gradient band on a dark background, 16:9, flat vector infographic. Zones progress from teal on the left to amber, then a thick vertical divider, then a final red zone crossed by a bold diagonal bar. Short labels above each zone and small example text inside. A long arrow beneath the band. Minimal, technical, no people, no photorealism." |

---

### A.8 `IMG-VIS-017` — Vision to Architecture Bridge

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-017` |
| **Title** | Vision to Architecture Bridge |
| **Purpose** | Show how vision elements become architecture elements, and where the bridge has missing spans |
| **Audience** | Engineering |
| **Aspect ratio** | 21:9 |
| **Canvas** | 2560 × 1080 |
| **Visual hierarchy** | Two vertical columns joined by horizontal spans; missing spans drawn as gaps with dashed stubs |
| **Elements** | Left column: `CAP-VIS-`, `PRN-VIS-`, `BND-VIS-` groups. Right column: `CMP-ARCH-`, `ARCH-` invariants, `TB-` boundaries. Spans between them |
| **Relationships** | Solid span = mapped with high confidence; dashed span = medium; broken span with a gap = `UNMAPPED` |
| **Labels** | Each span labelled with its confidence; gaps labelled with the identifier that lacks a counterpart |
| **Colour semantics** | Teal solid spans, amber dashed, red stubs at gaps |
| **Typography** | Sans, 18 pt span labels |
| **Legend** | Bottom: high, medium, unmapped |
| **Meaning** | The bridge is mostly built and visibly incomplete in named places (`VIS-067`) |
| **AI interpretation** | Treat every red stub as an obligation on `AOM-ARCH-001` PART 02, never as an invitation to invent a mapping (`FAL-VIS-036`) |
| **Implementation relevance** | Defines the scope of the next architecture part |
| **Generation prompt** | "A wide 21:9 dark technical diagram showing two vertical columns of small labelled blocks connected by horizontal bridge spans. Most spans are solid teal, some are dashed amber, and three spans are broken with short red stubs projecting from each side across an empty gap. Flat vector, minimal, engineering blueprint feel, no photorealism, no people." |

### A.9 `IMG-VIS-020` — AI Boot Sequence Rail

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-020` |
| **Title** | AI Boot Sequence Rail |
| **Purpose** | Give an agent a single scannable image of the eleven boot steps and their halt points |
| **Audience** | AI agents primarily; humans secondarily |
| **Aspect ratio** | 21:9 |
| **Canvas** | 2560 × 1080 |
| **Visual hierarchy** | A single horizontal rail with eleven numbered stations, three of which carry a halt signal |
| **Elements** | Stations 0 to 10, each with a short verb label; halt signals above stations 2, 3, and 4; a validation station near the end |
| **Relationships** | Sequential rail with three downward branch lines terminating in red stop blocks |
| **Labels** | "0 load state" … "10 hand off"; branch labels give the halt reason |
| **Colour semantics** | Teal rail, amber stations with gates, red halt terminators |
| **Typography** | Sans, station labels 20 pt, numbers 32 pt |
| **Legend** | Not required |
| **Meaning** | Most invalid work is rejected in the first third of the rail (`DGM-VIS-041`) |
| **AI interpretation** | This is the operational form of §01.23; run it before any task |
| **Implementation relevance** | Becomes the agent pre-flight checklist once tooling exists |
| **Generation prompt** | "A wide horizontal process rail on a dark background, 21:9, flat vector. Eleven numbered circular stations connected by a teal line. Three stations have short downward branch lines ending in red rounded stop blocks. Small verb labels beneath each station. Clean transit-map aesthetic, minimal, no photorealism, no people." |

### A.10 `IMG-VIS-022` — Traceability Spine

| Field | Specification |
| :--- | :--- |
| **ID** | `IMG-VIS-022` |
| **Title** | Traceability Spine |
| **Purpose** | Show the full chain from evidence to release and where it currently terminates |
| **Audience** | All |
| **Aspect ratio** | 21:9 |
| **Canvas** | 2560 × 1080 |
| **Visual hierarchy** | A single horizontal spine with ten vertebrae, the last three rendered as ghosted outlines |
| **Elements** | Vertebrae labelled evidence, problem, vision, capability, outcome, architecture, component, implementation, test, release |
| **Relationships** | Each vertebra connects to the next; small perpendicular ribs show the identifier family attached at each point |
| **Labels** | Vertebra names plus the identifier prefix carried at that stage |
| **Colour semantics** | Teal for stages with real content, slate ghost outlines for implementation, test, and release |
| **Typography** | Sans, 22 pt vertebra labels, 14 pt prefixes |
| **Legend** | Right edge: exists, planned |
| **Meaning** | The chain is unbroken for seven stages and absent for three |
| **AI interpretation** | Never claim end-to-end traceability; claim traceability to architecture and name the gap |
| **Implementation relevance** | The ghosted section is exactly what `OUT-VIS-015` would begin to fill |
| **Generation prompt** | "A wide horizontal spine diagram on a dark background, 21:9, flat vector. Ten connected segments in a row; the first seven filled teal, the last three drawn as faint grey outlines. Small perpendicular tick marks with short code labels beneath each segment. Clean anatomical-schematic feel rendered technically, minimal, no photorealism." |

### TBL-VIS-132: Remaining Image Specifications (`IMG-VIS-003`, `005`, `008`…`012`, `014`, `016`, `018`, `019`, `021`)

| Field | `IMG-VIS-003` | `IMG-VIS-005` | `IMG-VIS-008` | `IMG-VIS-009` |
| :--- | :--- | :--- | :--- | :--- |
| **Title** | Problem Space Constellation | Value Chain Loop | System Boundary Ring | Trust Boundary Cross-Section |
| **Purpose** | Cluster 23 problems into families and show which are mitigated | Show value circulating rather than flowing one way | Show what is inside, outside, and on the edge of the system | Show each trust boundary and the check that guards it |
| **Audience** | Product | Executive | Engineering | Security |
| **Aspect / canvas** | 4:3, 1440 × 1080 | 21:9, 2560 × 1080 | 1:1, 1440 × 1440 | 16:9, 1920 × 1080 |
| **Hierarchy / layers** | Two clusters, family A and family B, with mitigated problems ringed | A closed loop of twelve stages with a widened arc where value concentrates | Three concentric rings: core, controlled edge, external | A horizontal slice crossed by vertical boundary lines |
| **Elements** | 23 nodes labelled with `PROB-VIS-` identifiers | Twelve arcs labelled with `VAL-CHAIN-VIS-` stages | Ring bands with `BND-VIS-` labels placed on the appropriate ring | Boundary lines `TB-1` to `TB-10`, each with a gate glyph |
| **Relationships** | Edges from problem to responding capability where one exists | Sequential arcs closing into a circle | Radial spokes marking crossing points | Data-flow arrows crossing gates |
| **Colour semantics** | Amber unmitigated, teal mitigated, grey family B structural | Saturation by stage maturity | Teal core, amber edge, slate external | Green gate = check exists, red gate = check absent |
| **Legend** | Family A, family B, mitigated | Maturity scale | Ring meanings | Gate states |
| **Meaning** | Most problems remain unmitigated and that is stated, not hidden | Value returns to its origin as reusable specification | The system's edge is a ring, not a line | Most gates are currently red |
| **AI interpretation** | Check mitigation state before claiming a problem is solved | Do not read the loop as a delivery pipeline | Anything on the outer ring is untrusted | A red gate means the boundary exists only on paper (`FAL-VIS-101`) |
| **Implementation relevance** | Prioritises problem work | Frames investment argument | Drives interface specification | Drives the security backlog |
| **Generation prompt** | "A clustered node constellation on a dark background, 4:3, flat vector, two visually separated groups of small circular nodes, some ringed in teal, most amber, thin connecting lines to a few outlying nodes, minimal technical style, no photorealism." | "A closed circular value loop on a wide dark canvas, 21:9, flat vector, twelve labelled arc segments forming a ring with varying thickness, arrows following the circumference, minimal technical infographic, no photorealism." | "Three concentric rings on a dark square canvas, flat vector, innermost ring solid teal, middle ring amber, outer ring slate outline, short radial spokes crossing the rings with small labels, minimal technical style." | "A horizontal cross-section diagram on a dark background, 16:9, flat vector, a wide band crossed by ten vertical boundary lines each marked with a small gate glyph, most gates red and a few green, thin flow arrows passing through, technical schematic style." |

| Field | `IMG-VIS-010` | `IMG-VIS-011` | `IMG-VIS-012` | `IMG-VIS-014` |
| :--- | :--- | :--- | :--- | :--- |
| **Title** | Principle Precedence Ladder | Non-Goal Wall | Measurement Instrument Panel | Phase Progression Timeline |
| **Purpose** | Make principle ordering unmistakable | Make prohibitions feel solid rather than negotiable | Show which measures have instruments | Show P0 to P5 without dates |
| **Audience** | All | All | Product | Executive |
| **Aspect / canvas** | 9:16, 1080 × 1920 | 16:9, 1920 × 1080 | 16:9, 1920 × 1080 | 21:9, 2560 × 1080 |
| **Hierarchy / layers** | A vertical ladder, rank 1 at the top | A brick wall, one brick per non-goal | A dashboard of 25 gauges | A left-to-right rail with five gates |
| **Elements** | 20 rungs labelled `PRN-VIS-001` to `020` | Bricks labelled with `NG-VIS-` identifiers; permanent bricks larger | Gauges labelled with `SUC-VIS-` identifiers; most with no needle | Phase blocks P0 to P5 with exit-criteria callouts |
| **Relationships** | Strict vertical ordering; a side note "lower rank wins" | Mortar lines only; no arrows | None; a state panel | Gates between phases; a backward arrow beneath showing regression is permitted |
| **Colour semantics** | Gradient from bright at rank 1 to muted at rank 20 | Solid dark brick for permanent, hatched for conditional | Teal gauge with needle = measured, hollow = not yet measured, grey = not applicable | P0 highlighted as CURRENT, later phases dimmed |
| **Legend** | Not required | Permanent versus conditional | Three gauge states | Current, future, regression |
| **Meaning** | Ordering is total; ties do not exist | Prohibitions are structural | Thirteen of fifteen construction measures have no instrument | Progress is criteria-based |
| **AI interpretation** | Resolve conflicts by climbing to the lowest-numbered applicable rung | A permanent brick is never removed by argument | A hollow gauge is not a passing gauge (`FAL-VIS-009`) | Never annotate this image with dates (`VIS-051`) |
| **Implementation relevance** | Governs design tradeoffs | Governs scope screening | Governs the instrumentation backlog | Governs what work is legal now |
| **Generation prompt** | "A tall vertical ladder infographic on a dark background, 9:16, flat vector, twenty evenly spaced horizontal rungs with short labels, brightness decreasing smoothly from top to bottom, minimal technical style, no photorealism." | "A flat vector brick wall on a dark background, 16:9, bricks of two sizes, larger bricks solid dark with crisp edges and smaller bricks hatched, short labels centred on each brick, minimal, no texture photorealism." | "A dashboard panel of twenty-five small circular gauges on a dark background, 16:9, flat vector, a few gauges with teal needles and the majority drawn as hollow rings, small labels beneath each, clean instrument-cluster style." | "A wide horizontal timeline rail on a dark background, 21:9, flat vector, five sequential blocks separated by gate markers, the leftmost block highlighted and the rest dimmed, a thin curved arrow underneath pointing backwards, minimal technical style, no dates or numbers." |

| Field | `IMG-VIS-016` | `IMG-VIS-018` | `IMG-VIS-019` | `IMG-VIS-021` |
| :--- | :--- | :--- | :--- | :--- |
| **Title** | Human and Agent Leverage Split | Constraint Filter Funnel | Drift Radar | Failure Family Wheel |
| **Purpose** | Show which work is human, shared, or agent | Show constraints removing options before design begins | Show the six drift kinds and current severity | Show the eight failure families and their severity weight |
| **Audience** | All | Engineering | Engineering | Engineering |
| **Aspect / canvas** | 16:9, 1920 × 1080 | 9:16, 1080 × 1920 | 1:1, 1440 × 1440 | 1:1, 1440 × 1440 |
| **Hierarchy / layers** | Three horizontal lanes | A vertical funnel with three narrowing stages | A radar chart with six axes | A wheel of eight sectors, each subdivided by severity |
| **Elements** | Task cards placed in the human, shared, or agent lane | Stage labels: hard structural, real limitations, voluntary | Axes labelled implementation, specification, status, reference, semantic, authority | Sectors F1 to F8, radial bands S1 to S5 |
| **Relationships** | Escalation arrows from agent lane upward to human lane | Options entering wide at the top, few emerging at the bottom | A filled polygon showing current drift levels | None; a distribution view |
| **Colour semantics** | Teal agent, amber shared, distinct outline for human | Narrowing bands darkening downward | Amber fill for observed drift, red vertices above D3 | Severity darkening outward from the hub |
| **Legend** | Three lanes | Three constraint classes | Severity scale D0 to D5 | Severity scale S1 to S5 |
| **Meaning** | Accountability stays in the human lane regardless of who acts | Constraints are applied before design, not during | Drift is multi-dimensional; a single number would hide it | Severity is concentrated in F1, F4, F5, and F7 |
| **AI interpretation** | Escalate upward; never move a card downward into your own lane | If an option was eliminated here, do not re-propose it | Any vertex at D3 or above halts work | Read your current activity against the matching sector before starting |
| **Implementation relevance** | Defines the collaboration model | Defines the design starting point | Defines the drift review agenda | Defines review checklists |
| **Generation prompt** | "Three horizontal swim lanes on a dark background, 16:9, flat vector, small rounded task cards distributed across the lanes, a few thin arrows pointing from the lower lane up to the top lane, clean minimal technical style, no people." | "A tall vertical funnel on a dark background, 9:16, flat vector, three narrowing stages with many small shapes entering at the wide top and few exiting the narrow bottom, progressively darker bands, minimal technical style." | "A six-axis radar chart on a dark square canvas, flat vector, labelled axes, an irregular amber filled polygon, two vertices highlighted in red, concentric grid rings, clean data-visualisation style, no photorealism." | "A circular wheel divided into eight equal sectors on a dark square canvas, flat vector, each sector subdivided into five concentric bands darkening outward, short labels around the rim, minimal data-visualisation style." |

> **`VIS-102`.** Twenty-two image specifications are defined and **none is produced**. Producing
> them is a task for a downstream author or generation tool; the specifications above are complete
> enough that no interpretation of intent is required to do so. Creating the binaries is out of
> scope for this document (`NG-VIS-` documentation scope) and their absence is not a defect.

---

## APPENDIX B — Reference Material

### TBL-VIS-133: Glossary

| Term | Definition in Oship | Not to be confused with |
| :--- | :--- | :--- |
| **AI-native** | A system whose primary consumer of its own documentation is an automated agent, and whose specifications are authoritative over code | AI-assisted, AI-powered, AI-enabled |
| **Agent** | An automated actor that performs work under a defined autonomy class and is never accountable | Employee, autonomous system |
| **Agent-tractable** | Written so that an agent can act on it without inference beyond the text | Readable, well written |
| **Appended part** | A document segment added after accepted content and never edited thereafter | Revision, version |
| **Authority level** | L1 constitutional through L5 ephemeral; determines which document wins a conflict | Importance, priority |
| **Capability** | Something the system does, with inputs, outputs, an actor, and a status | Feature, component, requirement |
| **Constraint** | A limitation that removes options before design | Principle, risk |
| **Control plane** | The `.ai/` directory: the state an agent reads at boot and writes at hand-off | Configuration, CI |
| **Derivation** | The mechanical transformation of a vision element into a requirement | Interpretation, elaboration |
| **Drift** | Divergence between two representations that should agree | Bug, technical debt |
| **Evidence** | An inspectable repository artifact supporting a factual claim | Assertion, rationale |
| **Falsifiable** | Stated so that a specific observation could show it to be false | Measurable, precise |
| **Money Factory** | The named target domain: enterprise financial workload processing | An implemented subsystem |
| **Non-goal** | A class of work declared out of scope, permanently or conditionally | Backlog item, low priority |
| **Outcome** | A state to be reached, with preconditions and a completion test, never a date | Milestone, deadline |
| **Phase** | P0 through P5; determines which activities are legal | Sprint, release |
| **Principle** | A ranked tiebreaker used when several options are viable | Value, guideline |
| **Problem** | An evidenced difficulty experienced by a named actor | Requirement, complaint |
| **Specification-first** | The specification is authoritative; code implements it | Documentation-driven, waterfall |
| **Tier** | A capability's computed dependency level, T1 to T5 | Priority, importance |
| **Traceability** | The property that any element can be followed to its justification and its consequences | Cross-referencing, linking |
| **Vision statement** | A `VIS-` assertion that must be transformable into a requirement | Slogan, aspiration |

### TBL-VIS-134: Status Vocabulary — Closed Set

| Status | Meaning | Evidence required | May be depended upon |
| :--- | :--- | :--- | :---: |
| `IMPLEMENTED` | The artifact exists and produces all declared outputs | Yes, an `EVD-VIS-` reference | Yes |
| `PARTIALLY IMPLEMENTED` | The artifact exists; some declared outputs are missing | Yes, plus a list of what is missing | With care |
| `DOCUMENTED` | Specified in an accepted document; no executable artifact | Document reference | For specification work only |
| `PLANNED` | Committed to but not started | A decision or outcome reference | No |
| `PROPOSED` | Suggested; not yet committed | None required | No |
| `VISION` | Aspirational; dependent on phases not yet reached | None required | No |
| `DEPRECATED` | Superseded or withdrawn; retained for reference | Supersession reference | No |
| `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | Cannot be determined without inspection | The inspection that would resolve it | No |

### TBL-VIS-135: Identifier Namespace Reference

| Prefix | Element | Allocated in | Cardinality rule |
| :--- | :--- | :--- | :--- |
| `VIS-` | Vision statement | §01.1–§01.28 | One per binding assertion |
| `PROB-VIS-` | Problem | §01.4 | One per evidenced difficulty |
| `ACT-VIS-` | Actor | §01.5 | One per distinct role |
| `VAL-CHAIN-VIS-` | Value chain stage | §01.6 | One per stage |
| `EVD-VIS-` | Evidence item | Preamble, §01.4 | One per inspectable artifact |
| `CAP-VIS-` | Capability | §01.7 | One per distinct behaviour |
| `BND-VIS-` | Boundary | §01.9 | One per boundary |
| `PRN-VIS-` | Principle | §01.10 | One per ranked tiebreaker |
| `NG-VIS-` | Non-goal | §01.11 | One per excluded class |
| `SUC-VIS-` | Success measure | §01.12 | One per instrument |
| `OUT-VIS-` | Strategic outcome | §01.13 | One per reachable state |
| `AI-VIS-` | AI model element | §01.15, §01.16, §01.23 | One per agent-facing rule |
| `CON-VIS-` | Constraint | §01.19 | One per option eliminator |
| `DEC-VIS-` | Decision or procedure | §01.18, §01.20, §01.26 | One per decision point |
| `VAL-VIS-` | Validation rule | §01.24 | One per checkable condition |
| `FAL-VIS-` | Failure or anti-pattern | §01.25 | One per named failure |
| `DGM-VIS-` | Diagram | Throughout | One per rendered diagram |
| `TBL-VIS-` | Table | Throughout | One per captioned table |
| `IMG-VIS-` | Image specification | Appendix A | One per specified image |

### TBL-VIS-136: PART 01 Content Metrics

| Metric | Value | Note |
| :--- | :--- | :--- |
| Sections | 28 plus two appendices | §01.1 through §01.28 |
| Mermaid diagrams | 53 | `DGM-VIS-001`…`053`; all parse without error |
| Captioned tables | 138 | `TBL-VIS-001`…`138`; fixed-column where machine-read |
| Vision statements | 103 | `VIS-001`…`VIS-103` |
| Problems | 23 | `PROB-VIS-001`…`023` |
| Actors | 16 | `ACT-VIS-001`…`016` |
| Capabilities | 70 | Six `IMPLEMENTED` |
| Principles | 20 | Strictly ranked |
| Non-goals | 24 | Thirteen `PERMANENT` |
| Constraints | 30 | Two unmitigated real limitations |
| Success measures | 25 | Thirteen `NOT YET MEASURED` |
| Strategic outcomes | 20 | No dates |
| Validation rules | 200 | 173 blocking, 27 advisory, 0 automated |
| Failures | 120 | 19 at severity S5 |
| Decision procedures | 30 | All total and deterministic |
| Image specifications | 22 | None produced |
| Evidence items | 25 | All repository-inspectable |

### TBL-VIS-137: Evidence Register Recap

| Evidence | Artifact | Supports |
| :--- | :--- | :--- |
| `EVD-VIS-004` | `.ai/` control plane files | `CAP-VIS-001` IMPLEMENTED |
| `EVD-VIS-005` | `docs/MASTER_CONTEXT/` domain set | `CAP-VIS-006` IMPLEMENTED |
| `EVD-VIS-006` | `docs/ADR/ADR-0001` | `CAP-VIS-002` PARTIALLY IMPLEMENTED |
| `EVD-VIS-017` | `.github/workflow-skeletons/` not installed in `.github/workflows/` | `CON-VIS-012`, `PROB-VIS-017` |
| `EVD-VIS-018` | `.github/CODEOWNERS` with a single owner | `CON-VIS-011`, `FAL-VIS-062` |
| `EVD-VIS-019` | No dependency manifest or build configuration present | Stack `UNKNOWN` |

### TBL-VIS-138: PART 01 Change Record

| Version | Change | Authority |
| :--- | :--- | :--- |
| 1.0.0 | PART 01 authored: §01.1–§01.28, Appendices A and B | This document, `AOM-VIS-001` |

```mermaid
flowchart LR
    A["PART 01 authored"] --> B["Mermaid validation - 53 blocks"]
    B --> C["Anchor and identifier validation"]
    C --> D["Control plane updated"]
    D --> E["Committed to the feature branch"]
    E --> F["Status remains IN_PROGRESS"]
    F --> G["PART 02 - domain vision"]:::next
    classDef next fill:#0d47a1,stroke:#90caf9,color:#ffffff
```

> **Diagram ID:** `DGM-VIS-053` — **PART 01 Completion Path**
> **Explanation:** The document is not released at the end of PART 01. Status stays `IN_PROGRESS`,
> no tag is created, and no pull request is opened — the release gate is the final part, per the
> governance rules in §01.21.

---

## PART 01 — COMPLETION STATEMENT

**PART 01 — SYSTEM IDENTITY AND VISION CONSTITUTION is complete.**

| Field | Value |
| :--- | :--- |
| **Part** | 01 of a planned 6 |
| **Sections delivered** | §01.1 through §01.28, Appendix A, Appendix B |
| **Document status** | `IN_PROGRESS` — the document is complete only when its final part is delivered |
| **Next part** | PART 02 — Domain Vision and Product Surfaces |
| **Next free identifiers** | See `TBL-VIS-128` |
| **Binding rule for the next author** | Append only. Never edit, reorder, or squash any line above this statement. |

> **`VIS-103`.** This part establishes what Oship is, why it exists, whom it serves, what it will
> and will not do, how its claims may be checked, how its work goes wrong, and how its decisions
> are made. It deliberately makes uncomfortable statements — six capabilities implemented out of
> seventy, thirteen measures without instruments, two hundred validation rules with no automated
> execution, and three application-layer stages of the traceability chain entirely absent. Those
> statements are the document's principal contribution. A constitution that flattered the system it
> governs would fail its only real test: telling the next agent the truth about what it is
> inheriting.

<!-- END OF PART 01 -->

<!-- CONTINUATION_POINT -->

```text
LAST_COMPLETED_SECTION: APPENDIX B — Reference Material
LAST_COMPLETED_SUBSECTION: PART 01 — COMPLETION STATEMENT
LAST_COMPLETED_ID: VIS-103
NEXT_SECTION: 02.1 — Domain Vision Overview
NEXT_ID: VIS-104
CURRENT_PART: 01
NEXT_PART: 02
LAST_LINE_ANCHOR: <!-- END OF PART 01 -->
DEPENDENCIES_LOADED: docs/MASTER_CONTEXT/INDEX.md; docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md; docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md; docs/MASTER_CONTEXT/23_STANDARDS/METADATA_STANDARD.md; docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md; PROJECT_PHILOSOPHY.md; README.md; architecture/DOMAIN_MODEL.md; docs/ADR/ADR-0001-ai-native-repository-architecture.md; .ai/PROJECT_STATUS.md; .ai/CURRENT_CONTEXT.md; .ai/NEXT_ACTION.md; .ai/DECISION_LOG.md
NEXT_FREE_IDENTIFIERS: VIS-104; PROB-VIS-024; ACT-VIS-017; CAP-VIS-071; OUT-VIS-021; PRN-VIS-021; NG-VIS-025; CON-VIS-031; SUC-VIS-026; BND-VIS-017; EVD-VIS-026; DEC-VIS-031; AI-VIS-061 (ceiling reached — raise via DEC-VIS-021); VAL-VIS-201 (ceiling reached — raise via DEC-VIS-021); FAL-VIS-121; DGM-VIS-054; TBL-VIS-139; IMG-VIS-023; VAL-CHAIN-VIS-013
BINDING_RULE: Append only. Never rewrite, reorder, or squash PART 01.
```

---

# PART 02 — DOMAIN VISION ARCHITECTURE

> **Part status:** `IN_PROGRESS` — appended after `<!-- END OF PART 01 -->`. Nothing above this line
> was modified, reordered, or squashed. PART 01 remains frozen per `PRN-VIS-006`.

---

## PART 02 — PREAMBLE

### AI NAVIGATION METADATA — PART 02

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this part is the domain topology of Oship. No implementation may be placed without it.** |
| **AI DEPENDENCIES** | PART 01 in full, especially §01.7 capabilities, §01.9 boundaries, §01.17 architecture traceability, §01.27 traceability matrix |
| **AI INPUTS** | A proposed piece of work — a feature, a service, a document, a test, a schema |
| **AI OUTPUTS** | The domain that owns it, its dependencies, its boundary obligations, and its architecture anchor |
| **AI IMPLEMENTATION IMPACT** | Determines directory placement, ownership, contract requirements, and review path for every future artifact |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-201`…`VAL-VIS-320` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §01.9 domains, `architecture/DOMAIN_MODEL.md`, `docs/MASTER_CONTEXT/INDEX.md` §1003 |

### What PART 02 Answers

> **`VIS-104`.** PART 01 established *what Oship is*. PART 02 establishes *what Oship is made of*.
> A vision without a domain decomposition is unactionable: an agent that knows the mission but not
> the domain topology has no deterministic place to put its work, and every placement decision
> becomes an improvisation. Improvised placement is the origin of architectural entropy.

### TBL-VIS-139: Questions PART 02 Answers and Where

| Question | Section | Primary output |
| :--- | :--- | :--- |
| What is a domain, and what is it not? | §02.1 | `TBL-VIS-140` terminology matrix |
| How are domains classified? | §02.2 | `TBL-VIS-141` taxonomy registry |
| Which domains exist in Oship? | §02.3 | `DOMAIN-VIS-001`…`DOMAIN-VIS-050` |
| What do the product domains do? | §02.4 | Purpose, value, actors, capabilities per domain |
| How is AI structured as a domain? | §02.5 | `DGM-VIS-056`, `TBL-VIS-150` |
| How does memory work as a domain? | §02.6 | `DGM-VIS-057`, `TBL-VIS-160` |
| How does knowledge circulate? | §02.7 | Knowledge flow and lifecycle models |
| How is experience owned? | §02.8 | `DGM-VIS-060`, experience image specifications |
| Who owns data and under what contract? | §02.9 | Data lifecycle and boundary models |
| What is the security philosophy? | §02.10 | Security boundary diagram and decision tree |
| What runs the system? | §02.11 | Infrastructure evolution model |
| How does Oship meet the outside world? | §02.12 | Integration ecosystem diagram |
| How do domains interact? | §02.13 | `DGM-VIS-070` interaction graph |
| Who owns each domain? | §02.14 | Ownership matrix |
| How do domains evolve? | §02.15 | Lifecycle state machine |
| What are the dependency rules? | §02.16 | Dependency graph and acyclicity rules |
| How is domain health measured? | §02.17 | `DMET-VIS-` metric matrix |
| How should an agent use all of this? | §02.18 | Domain loading sequence |

### The Traceability Spine This Part Completes

```mermaid
flowchart TB
    A["SYSTEM VISION - PART 01"] --> B["DOMAIN VISION - PART 02"]
    B --> C["CAPABILITY - CAP-VIS namespace"]
    C --> D["ARCHITECTURE DOMAIN - DOM-ARCH namespace"]
    D --> E["COMPONENT - CMP-ARCH namespace"]
    E --> F["IMPLEMENTATION - not yet present"]
    F --> G["TEST - not yet present"]
    G --> H["RELEASE - governed by 01.21"]

    B -.->|"defines placement for"| E
    B -.->|"constrains"| F
    A -.->|"authority over"| B

    classDef done fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef now fill:#0d47a1,stroke:#90caf9,color:#ffffff
    classDef absent fill:#4e342e,stroke:#bcaaa4,color:#ffffff
    class A,C,D,E done
    class B now
    class F,G,H absent
```

> **Diagram ID:** `DGM-VIS-054` — **Domain Universe Map: Position of PART 02 in the Traceability Spine**
> **Explanation:** Green stages have defined identifier namespaces with populated registers. Blue is
> the stage this part delivers. Brown stages have no artifacts in the repository — that is a
> statement of fact recorded in `EVD-VIS-001`…`EVD-VIS-025`, not a deficiency of this document. The
> dotted edges are the reason domain vision must precede implementation: placement, constraint, and
> authority all flow downward before any code exists.

---

## PART 02 — IDENTIFIER GOVERNANCE

### 02.0.1 Namespace Ceilings Reached in PART 01

> **`VIS-105`.** Three namespaces reached their declared ceilings in PART 01 and one is within
> seventeen of its ceiling. PART 02 cannot allocate in them without a governance act. `VIS-100`
> made this explicit and forbade silently exceeding a ceiling. This subsection performs the
> governance act in the open, before a single new identifier is issued.

### TBL-VIS-140: Namespace Pressure Entering PART 02

| Namespace | PART 01 ceiling | Highest allocated | Remaining | Pressure | Action required |
| :--- | ---: | ---: | ---: | :--- | :--- |
| `VAL-VIS-` | 200 | 200 | 0 | **Exhausted** | Raise ceiling |
| `AI-VIS-` | 60 | 060 | 0 | **Exhausted** | Raise ceiling |
| `VIS-` | 120 | 105 | 15 | **Critical** | Raise ceiling |
| `TBL-VIS-` | 200 | 140 | 60 | **High** — PART 02 alone plans more than 60 | Raise ceiling |
| `DGM-VIS-` | 200 | 054 | 146 | Moderate | Raise ceiling for later parts |
| `FAL-VIS-` | 200 | 120 | 80 | Moderate | Raise ceiling for later parts |
| `CAP-VIS-` | 120 | 070 | 50 | Adequate for PART 02 | Raise ceiling for later parts |
| `IMG-VIS-` | 40 | 022 | 18 | Adequate — PART 02 plans 15 | Monitor |
| `PROB-VIS-` | 60 | 023 | 37 | Adequate | No action |
| `CON-VIS-` | 60 | 030 | 30 | Adequate | No action |
| `SUC-VIS-` | 60 | 025 | 35 | Adequate | No action |
| `DEC-VIS-` | 40 | 030 | 10 | Watch | Raise ceiling |
| `EVD-VIS-` | 50 | 025 | 25 | Adequate | No action |
| `ACT-VIS-` | 30 | 016 | 14 | Adequate | No action |
| `BND-VIS-` | 30 | 016 | 14 | Adequate | No action |
| `PRN-VIS-` | 30 | 020 | 10 | Watch | No action in PART 02 |
| `NG-VIS-` | 40 | 024 | 16 | Adequate | No action |
| `OUT-VIS-` | 60 | 020 | 40 | Adequate | No action |
| `VAL-CHAIN-VIS-` | 20 | 012 | 8 | Adequate | No action |

### 02.0.2 Correcting a Pointer Error Inherited from PART 01

> **`VIS-106`.** The continuation block at the end of PART 01 instructs the next author to raise
> the exhausted ceilings "via `DEC-VIS-021`". That instruction is **procedurally correct and
> referentially ambiguous**, and this document resolves the ambiguity without editing PART 01.
> `DEC-VIS-021` is already allocated: it is the decision *procedure* "Is this change
> constitutional?" defined in §01.26.4 and tabulated in `TBL-VIS-117`. A procedure is not a record.
> Running `DEC-VIS-021` against a proposed ceiling change produces the answer *constitutional*,
> which by `TBL-VIS-117` requires owner approval and a **new decision record**. That new record is
> `DEC-VIS-031`, allocated below. No identifier is reused, and `PRN-VIS-007` stable identity holds.

```mermaid
flowchart LR
    Q["Proposed change - raise namespace ceilings"] --> P["Run DEC-VIS-021 procedure"]
    P --> T["TBL-VIS-117 row - does it retire or renumber an identifier"]
    T -->|"No - it extends a range"| U["Row - does it add a new element within an existing schema"]
    U --> V["Answer - STRUCTURAL with constitutional character"]
    V --> W["Owner approval plus new decision record"]
    W --> X["DEC-VIS-031 issued"]
    X --> Y["Allocation may proceed"]

    classDef proc fill:#4a148c,stroke:#ce93d8,color:#ffffff
    classDef out fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class P,T,U proc
    class X,Y out
```

> **Diagram ID:** `DGM-VIS-055` — **Resolution Path from Procedure `DEC-VIS-021` to Record `DEC-VIS-031`**
> **Explanation:** This is the general pattern for every future governance act in this namespace: a
> `DEC-VIS-` procedure is *executed*, and its execution *emits* a new `DEC-VIS-` record. Procedures
> and records share a namespace deliberately, because both are decisions; they are distinguished by
> the **Kind** column of the decision register, not by separate prefixes.

### TBL-VIS-141: `DEC-VIS-031` — Namespace Expansion Decision

| Field | Value |
| :--- | :--- |
| **Decision ID** | `DEC-VIS-031` |
| **Kind** | Record — the durable output of executing procedure `DEC-VIS-021` |
| **Title** | Namespace Expansion for `AOM-VIS-001` |
| **Status** | `ACCEPTED` |
| **Authority** | L1 — Strategic / Constitutional. Owner: Product Management / CPO |
| **Trigger** | `VIS-100`: the `VAL-VIS-` ceiling was reached at the end of PART 01 |
| **Question** | May the declared ceilings of `AOM-VIS-001` identifier namespaces be raised, and may two new namespaces be registered? |
| **Answer** | Yes, subject to the five conditions below |
| **Condition 1** | No previously allocated number may be retired, renumbered, or reused. Expansion is strictly additive at the top of a range. |
| **Condition 2** | A raised ceiling is itself a published fact and appears in the ledger of every subsequent part. |
| **Condition 3** | A new namespace requires a prefix that collides with no existing prefix in `AOM-VIS-001` or `AOM-ARCH-001`. |
| **Condition 4** | Raising a ceiling grants permission to allocate, not an obligation. Allocating an identifier with no defined content is a defect (`FAL-VIS-121`). |
| **Condition 5** | Ceilings may be raised. They may never be lowered below the highest allocated number, because that would orphan live identifiers. |
| **Consequence if rejected** | PART 02 could define no validation rules, no AI directives, and fewer than sixty tables — the domain model would be undocumentable in this file |
| **Reversibility** | Irreversible in practice. Once identifiers above the old ceiling are cited by other documents, contraction breaks references. |
| **Supersedes** | Nothing. Extends the ledger declared in `TBL-VIS-002`. |

### TBL-VIS-142: Ceilings Before and After `DEC-VIS-031`

| Namespace | Old range | New range | Justification |
| :--- | :--- | :--- | :--- |
| `VIS-` | 001–120 | **001–999** | Vision statements accumulate one per substantive claim across a planned six parts |
| `VAL-VIS-` | 001–200 | **001–9999** | Validation is per-rule, per-domain, per-contract; growth is the point |
| `AI-VIS-` | 001–060 | **001–999** | Every domain requires interpretation directives |
| `TBL-VIS-` | 001–200 | **001–9999** | This document is table-dense by design (`PRN-VIS-003`) |
| `DGM-VIS-` | 001–200 | **001–9999** | Visual density rule requires a diagram every twenty to sixty lines |
| `FAL-VIS-` | 001–200 | **001–9999** | Failure taxonomy expands with each new domain |
| `CAP-VIS-` | 001–120 | **001–999** | Capability decomposition deepens per domain |
| `DEC-VIS-` | 001–040 | **001–999** | Procedures and records share the namespace |
| `IMG-VIS-` | 001–040 | **001–999** | Image specifications scale with visual surface |
| `PROB-VIS-` | 001–060 | **001–999** | Unchanged in practice; raised for symmetry |
| `CON-VIS-`, `SUC-VIS-`, `OUT-VIS-`, `EVD-VIS-` | 001–060 / 001–050 | **001–999** each | Raised for symmetry; no pressure today |
| `ACT-VIS-`, `BND-VIS-`, `PRN-VIS-`, `NG-VIS-` | 001–030 / 001–040 | **001–999** each | Raised for symmetry; growth expected to stay low |
| `VAL-CHAIN-VIS-` | 001–020 | **001–999** | Value chains multiply with product domains |

### TBL-VIS-143: New Namespaces Registered by `DEC-VIS-031`

| Prefix | Meaning | Range | Collision check | Defined in |
| :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-` | A domain of the Oship domain vision model | 001–999 | No collision with `DOM-ARCH-` in `AOM-ARCH-001`; the longer, unambiguous form is deliberate | §02.3 |
| `DMET-VIS-` | A domain health metric definition | 001–999 | No collision with `SUC-VIS-` system measures or `PERF-ARCH-` | §02.17 |

> **`VIS-107`.** `DOMAIN-VIS-` and `DOM-ARCH-` are **different things and must never be conflated**.
> A `DOMAIN-VIS-` entry is a *vision-level* domain: a coherent area of purpose with an owner, a
> reason to exist, and a boundary. A `DOM-ARCH-` entry is an *architecture-level* bounded context
> with a code location and an integration pattern. Many `DOMAIN-VIS-` entries map to one
> `DOM-ARCH-` entry; some map to none yet. The mapping is published in `TBL-VIS-148` and is
> deliberately many-to-one, not one-to-one.

### TBL-VIS-144: PART 02 Identifier Allocation Plan

| Namespace | Block reserved for PART 02 | Pinned assignments | Overflow block |
| :--- | :--- | :--- | :--- |
| `VIS-` | 104 onward | — | sequential |
| `DGM-VIS-` | 054–120 | 054 §02.1, 055 §02.0, 056 §02.5, 057 §02.6, 060 §02.8, 070 §02.13 | 071 onward for §02.3, §02.4, §02.14–§02.18 |
| `TBL-VIS-` | 139–260 | 139–144 preamble, 141 taxonomy record, 150 §02.5, 160 §02.6 | 170 onward sequential from §02.8 |
| `DOMAIN-VIS-` | 001–050 | 001–050 assigned in §02.3 | 051 onward reserved for later parts |
| `VAL-VIS-` | 201–320 | — | sequential |
| `FAL-VIS-` | 121–175 | — | sequential |
| `IMG-VIS-` | 023–037 | — | sequential |
| `AI-VIS-` | 061–110 | — | sequential |
| `DMET-VIS-` | 001–060 | — | sequential |
| `CAP-VIS-` | 071–090 | — | sequential |
| `DEC-VIS-` | 031–045 | 031 namespace expansion | sequential |

> **`VIS-108`.** Pinned assignments exist because the domain vision brief named specific identifiers
> for specific artifacts. Honouring them creates gaps — for example `DGM-VIS-058` and `DGM-VIS-059`
> are consumed by §02.7 even though §02.7 appears after §02.5, which holds `DGM-VIS-056`. Gaps in
> allocation order are permitted. Gaps in *definition* are not: every number in a reserved block
> must either be defined in this part or explicitly recorded as unallocated in the closing ledger.

---

## 02.1 — Domain Vision Overview

### AI NAVIGATION METADATA — §02.1

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — read before creating any directory, service, or document** |
| **AI DEPENDENCIES** | §01.7 capabilities, §01.9 boundaries, PART 02 preamble |
| **AI INPUTS** | A noun a human used — "the billing thing", "the agent runtime", "the design system" |
| **AI OUTPUTS** | Whether that noun is a domain, a capability, a module, a service, a component, or a feature |
| **AI IMPLEMENTATION IMPACT** | Wrong classification here produces wrong directory placement and wrong ownership for the life of the artifact |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-201`…`VAL-VIS-212` |
| **AI RELATED DOCUMENTS** | `architecture/DOMAIN_MODEL.md`, `AOM-ARCH-001` §01.9 |

### 02.1.1 What a Domain Is

> **`VIS-109`.** A **domain** is a bounded area of purpose within Oship that has: one reason to
> exist, one accountable owner, a vocabulary whose terms mean exactly one thing inside it, a
> boundary across which all traffic is explicit, and a lifecycle it can traverse independently of
> its neighbours. Remove any one of those five and the thing is not a domain — it is a grouping,
> and groupings decay.

### TBL-VIS-145: The Five Necessary Conditions of a Domain

| # | Condition | Test | Failure if absent |
| :--- | :--- | :--- | :--- |
| 1 | **Single reason to exist** | Can its purpose be stated in one sentence with no "and"? | Becomes a junk drawer (`FAL-VIS-122`) |
| 2 | **Single accountable owner** | Does one named role approve changes to it? | Ownership vacuum (`FAL-VIS-127`) |
| 3 | **Unambiguous vocabulary** | Does every term inside it have exactly one meaning? | Semantic collision (`FAL-VIS-124`) |
| 4 | **Explicit boundary** | Is every inbound and outbound flow named in a contract? | Hidden coupling (`FAL-VIS-131`) |
| 5 | **Independent lifecycle** | Can it move from `PLANNED` to `IMPLEMENTED` without forcing a neighbour to move? | Lockstep evolution (`FAL-VIS-152`) |

> **`VIS-110`.** The five conditions are **conjunctive**. A candidate that satisfies four is not
> "eighty percent a domain"; it is not a domain. The remedy is to merge it into a domain that does
> satisfy all five, or to split it until the parts do.

### 02.1.2 Why Domains Exist

> **`VIS-111`.** Domains exist to make placement deterministic. In a system with no domain model,
> the question "where does this go?" is answered by whoever is asking, which means the answer varies
> by author, by day, and by mood. `PRN-VIS-002` requires determinism. A domain model is the
> mechanism by which placement becomes a lookup rather than a judgement.

### TBL-VIS-146: What Domains Buy, Stated as Concrete Effects

| Effect | Without domains | With domains | Which principle it serves |
| :--- | :--- | :--- | :--- |
| **Placement** | Author chooses a directory by intuition | Directory follows from domain lookup | `PRN-VIS-002` determinism |
| **Ownership** | Reviewer chosen by availability | Reviewer follows from domain owner | `PRN-VIS-008` human accountability |
| **Blast radius** | Unknown until something breaks | Bounded by the domain's declared dependents | `PRN-VIS-013` reversibility |
| **Vocabulary** | The same word means three things | One meaning per domain, translation at the boundary | `PRN-VIS-003` explicit over implicit |
| **Agent tractability** | Agent must read everything to place anything | Agent reads one registry row | `PRN-VIS-005` agent-tractable |
| **Parallel work** | Two authors collide in the same file | Two authors work in two domains | `PRN-VIS-020` finish before starting |
| **Traceability** | Chain breaks between vision and code | Domain is the joint between them | `PRN-VIS-004` traceable |

```mermaid
flowchart TB
    subgraph WITHOUT["Placement without a domain model"]
        W1["New work item"] --> W2["Author intuition"]
        W2 --> W3["Directory A"]
        W2 --> W4["Directory B"]
        W2 --> W5["Directory C"]
        W3 --> W6["Divergence"]
        W4 --> W6
        W5 --> W6
    end

    subgraph WITH["Placement with a domain model"]
        V1["New work item"] --> V2["Classification test - TBL-VIS-147"]
        V2 --> V3["Domain registry lookup - 02.3"]
        V3 --> V4["Exactly one destination"]
        V4 --> V5["Convergence"]
    end

    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef good fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class W6 bad
    class V5 good
```

> **Diagram ID:** `DGM-VIS-056` — **Determinism Effect of a Domain Model on Placement**
> **Explanation:** The left path has three valid answers, which means it has none. The right path
> is a function: one input, one output, repeatable by any agent or human. This is the entire
> argument for spending a part of the vision document on domain decomposition.

### 02.1.3 The Six Confusable Terms

> **`VIS-112`.** Six words are used interchangeably in most codebases and must not be here:
> **domain**, **capability**, **module**, **service**, **component**, **feature**. Each answers a
> different question. Conflating them causes the most expensive category of architectural error,
> because the error is invisible in code review — everything compiles.

### TBL-VIS-147: Domain Terminology Matrix

| Term | Answers the question | Granularity | Lifecycle | Has an owner? | Deployable? | Namespace | Example in Oship |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Domain** | *Why does this area exist?* | Coarsest | Independent | Yes — accountable role | No | `DOMAIN-VIS-` | Governance and Knowledge |
| **Capability** | *What can the system do?* | Coarse | Tied to its domain | Inherits domain owner | No | `CAP-VIS-` | `CAP-VIS-006` immutable decision record |
| **Module** | *How is code organised?* | Medium | Tied to its repository | No — a code convention | No | none yet | `packages/` entries — none exist |
| **Service** | *What runs and can fail alone?* | Medium | Independent deployment | Inherits domain owner | **Yes** | `CMP-ARCH-` | `CMP-ARCH-010` Identity Service `PLANNED` |
| **Component** | *What is the named unit of architecture?* | Fine | Tied to its service | Inherits service | Sometimes | `CMP-ARCH-` | `CMP-ARCH-002` AI Control Plane |
| **Feature** | *What does a user perceive?* | Finest | Tied to a release | Product owner | No | none yet | None exist — no application code |

> **`VIS-113`.** Read `TBL-VIS-147` column by column, not row by row. The **Deployable** column is
> the sharpest discriminator: only a service deploys. The **Has an owner** column is the second
> sharpest: only a domain originates ownership; everything else inherits it. An artifact that
> claims to originate ownership and also claims to deploy is two things wearing one name.

### TBL-VIS-148: Disambiguation Test — Six Questions in Fixed Order

| Order | Question | If yes | If no |
| :--- | :--- | :--- | :--- |
| 1 | Does a user perceive it directly as a unit of value? | **Feature** | Continue |
| 2 | Does it deploy and fail independently? | **Service** | Continue |
| 3 | Is it a named unit inside a service or a document set? | **Component** | Continue |
| 4 | Is it purely a code-organisation convenience? | **Module** | Continue |
| 5 | Is it something the system can *do*, expressible as verb plus object? | **Capability** | Continue |
| 6 | Is it an area of purpose with its own owner and vocabulary? | **Domain** | **Unclassifiable — halt and ask** (`DEC-VIS-032`) |

> **`VIS-114`.** The order is fixed and must not be reordered, because the questions are not
> mutually exclusive in practice. "The ledger" is a feature to a user, a service to an operator, a
> capability to a planner, and a domain to an architect. Fixed order makes the classification
> deterministic: the *first* yes wins. Ask question 6 first and every noun becomes a domain, which
> is the failure mode `FAL-VIS-123` domain inflation.

```mermaid
flowchart TB
    N["Noun under classification"] --> Q1{"Perceived by a user as value?"}
    Q1 -->|"Yes"| F["FEATURE"]
    Q1 -->|"No"| Q2{"Deploys and fails alone?"}
    Q2 -->|"Yes"| S["SERVICE"]
    Q2 -->|"No"| Q3{"Named unit inside a service or document set?"}
    Q3 -->|"Yes"| C["COMPONENT"]
    Q3 -->|"No"| Q4{"Only a code-organisation convenience?"}
    Q4 -->|"Yes"| M["MODULE"]
    Q4 -->|"No"| Q5{"Verb plus object the system can do?"}
    Q5 -->|"Yes"| CAP["CAPABILITY"]
    Q5 -->|"No"| Q6{"Area of purpose with owner and vocabulary?"}
    Q6 -->|"Yes"| D["DOMAIN"]
    Q6 -->|"No"| H["HALT - unclassifiable - escalate per DEC-VIS-032"]

    classDef dom fill:#0d47a1,stroke:#90caf9,color:#ffffff
    classDef halt fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    class D dom
    class H halt
```

> **Diagram ID:** `DGM-VIS-057` — **Six-Question Classification Decision Tree (`DEC-VIS-032`)**
> **Explanation:** This is the executable form of `TBL-VIS-148`. An agent presented with an
> unclassified noun runs this tree top to bottom and stops at the first yes. The halt terminal is
> not a failure of the tree; it is the correct output when a noun is genuinely ambiguous, and it
> routes to a human per `PRN-VIS-008`.

### TBL-VIS-149: Worked Classifications Against Real Repository Nouns

| Noun as commonly spoken | First yes at | Classification | Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| "The `.ai` folder" | Q3 | Component — `CMP-ARCH-002` | `EVD-VIS-020` | `IMPLEMENTED` |
| "Master Context" | Q6 | Domain — `DOMAIN-VIS-002` | `EVD-VIS-006` | `PARTIALLY IMPLEMENTED` |
| "Decision records" | Q5 | Capability — `CAP-VIS-006` | `EVD-VIS-005` | `IMPLEMENTED` |
| "The Money Factory" | Q6 | Domain — `DOMAIN-VIS-020` | `EVD-VIS-021` | `PLANNED` |
| "The ledger service" | Q2 | Service — `CMP-ARCH-015` | `AOM-ARCH-001` | `PLANNED` |
| "Design system" | Q6 | Domain — `DOMAIN-VIS-030` | `design/INDEX.md` | `DOCUMENTED` |
| "Dark mode toggle" | Q1 | Feature | None — no UI exists | `PROPOSED` |
| "`packages/` shared code" | Q4 | Module | Directory is `.gitkeep`-only | `PLANNED` |
| "Agent runtime" | Q2 | Service — `CMP-ARCH-021` | `AOM-ARCH-001` | `PLANNED` |
| "AI, generally" | Q6 | Domain — `DOMAIN-VIS-010` | `EVD-VIS-020` | `PARTIALLY IMPLEMENTED` |
| "Observability" | Q6 | Domain — `DOMAIN-VIS-041` | `EVD-VIS-020` | `PLANNED` |
| "Rate limiting" | Q5 | Capability — `CAP-VIS-036` | None | `PLANNED` |

### 02.1.4 What a Domain Is Not

> **`VIS-115`.** Four things are routinely mislabelled as domains in enterprise repositories. Each
> mislabelling has a distinct cost, and each is prohibited here by name so that a future agent can
> cite the prohibition rather than re-derive it.

### TBL-VIS-150: Prohibited Domain Forms

| Anti-form | Description | Why it fails the five conditions | Cost | Failure ID |
| :--- | :--- | :--- | :--- | :--- |
| **The team domain** | A domain named after the group that staffs it | Fails condition 1 — its reason to exist is an org chart, which changes | Reorg invalidates the architecture | `FAL-VIS-125` |
| **The technology domain** | A domain named after a tool — "the Kafka domain" | Fails condition 1 — a tool is a mechanism, not a purpose | Vendor change forces a domain rewrite; violates `PRN-VIS-015` | `FAL-VIS-126` |
| **The layer domain** | A domain named after a tier — "the frontend domain" | Fails condition 3 — every business term appears in every layer | Every feature crosses every domain | `FAL-VIS-128` |
| **The leftover domain** | "Common", "shared", "misc", "core utils" | Fails conditions 1 and 5 — no purpose, no independent lifecycle | Becomes the highest-coupling node in the graph | `FAL-VIS-122` |

> **`VIS-116`.** `TBL-VIS-150` has an uncomfortable consequence for Oship's own Master Context.
> Several of the twenty-four knowledge domains are layer domains or technology domains by this test
> — `07_FRONTEND`, `08_BACKEND`, `06_DATABASE`, `09_INFRASTRUCTURE`. This is **acceptable and
> deliberate**, because knowledge domains and system domains are different objects with different
> purposes: a knowledge domain organises *documents for retrieval*, where a layer split is the most
> navigable arrangement, while a system domain organises *purpose and ownership*, where a layer
> split is fatal. §02.2.4 makes this distinction formal. Failing to state it would leave the next
> agent believing the Master Context violates the vision it derives from.

### TBL-VIS-151: Domain Classification Rules — Binding

| Rule | Statement | Enforcement | Violation |
| :--- | :--- | :--- | :--- |
| `DCR-01` | Every domain satisfies all five conditions of `TBL-VIS-145` | Review against the registry | Reject the domain |
| `DCR-02` | Classification uses `TBL-VIS-148` in the given order; first yes wins | Agent runs `DEC-VIS-032` | Reclassify |
| `DCR-03` | No domain may be named after a team, tool, layer, or leftover | Name inspection at registration | Rename or merge |
| `DCR-04` | A domain's name is a noun phrase of purpose, not an implementation | Name inspection | Rename |
| `DCR-05` | Every domain has exactly one entry in the §02.3 registry | Registry completeness check | Add or delete |
| `DCR-06` | Every domain declares a status from the PART 01 vocabulary | Status field required | Reject as fabrication risk |
| `DCR-07` | A domain with no capability mapped to it is `PROPOSED` at most | Cross-check §02.3 against §01.7 | Downgrade status |
| `DCR-08` | A domain with no owner is invalid regardless of other merits | Owner field required | Halt and escalate |
| `DCR-09` | Two domains may not claim the same responsibility | Overlap scan, §02.18.4 | Merge or re-split |
| `DCR-10` | Domain identifiers are permanent; retirement marks `DEPRECATED`, never deletes | Ledger audit | Restore the identifier |

---

## 02.2 — Domain Taxonomy Model

### AI NAVIGATION METADATA — §02.2

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — required before adding a domain to the registry** |
| **AI DEPENDENCIES** | §02.1 |
| **AI INPUTS** | A validated domain that passed the `TBL-VIS-148` test |
| **AI OUTPUTS** | Its category, its loading priority, and its expected dependency direction |
| **AI IMPLEMENTATION IMPACT** | Category determines dependency legality — see `TBL-VIS-155` |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-213`…`VAL-VIS-226` |
| **AI RELATED DOCUMENTS** | §02.3 registry, §02.16 dependency model |

### 02.2.1 Why a Taxonomy and Not a Flat List

> **`VIS-117`.** Thirty to fifty domains in a flat list is an unsorted set, and an unsorted set of
> that size cannot be reasoned about. Categories are not decoration: **the category determines
> which dependencies are legal**. A Core Product domain may depend on an Infrastructure domain; the
> reverse is a defect. Without categories, that rule cannot be stated, let alone checked.

### TBL-VIS-152: The Ten Domain Categories

| Code | Category | Reason to exist | Typical owner | Dependency posture |
| :--- | :--- | :--- | :--- | :--- |
| `C1` | **Strategic** | Define why the system exists and what it may become | Product Management / CPO | Depends on nothing; everything depends on it |
| `C2` | **Core Product** | Deliver the value the strategy names | Product plus engineering leads | Depends on `C4`–`C10`; never on another `C2` peer through internals |
| `C3` | **AI** | Make the system operable by machine intelligence | AI Repository Architect | Depends on `C4`, `C5`, `C9`; may not be depended on by `C1` |
| `C4` | **Knowledge** | Hold, index, and serve what the system knows | Architecture and Documentation | Depends on `C1` only |
| `C5` | **Data** | Own state, its shape, its lifecycle, and its contracts | Database Architect | Depends on `C7` |
| `C6` | **Experience** | Own how humans perceive and act on the system | UX/UI Design | Depends on `C2`, `C4` |
| `C7` | **Infrastructure** | Run, scale, and keep the system alive | Platform Engineering | Depends on nothing above it |
| `C8` | **Security** | Constrain everything, trust nothing implicitly | Security Architect | Cross-cutting; may constrain any category |
| `C9` | **Operational** | Observe, respond, recover, and improve | SRE | Depends on `C7`; observes all |
| `C10` | **Integration** | Mediate every crossing of the system edge | API / Integration Lead | Depends on `C7`, `C8` |

```mermaid
flowchart TB
    C1["C1 STRATEGIC"] --> C2["C2 CORE PRODUCT"]
    C1 --> C4["C4 KNOWLEDGE"]
    C4 --> C3["C3 AI"]
    C2 --> C6["C6 EXPERIENCE"]
    C2 --> C5["C5 DATA"]
    C2 --> C10["C10 INTEGRATION"]
    C5 --> C7["C7 INFRASTRUCTURE"]
    C3 --> C7
    C10 --> C7
    C6 --> C7
    C7 --> C9["C9 OPERATIONAL"]
    C8["C8 SECURITY - cross-cutting"] -.->|"constrains"| C2
    C8 -.->|"constrains"| C3
    C8 -.->|"constrains"| C5
    C8 -.->|"constrains"| C7
    C8 -.->|"constrains"| C10
    C9 -.->|"evidence to"| C1

    classDef strat fill:#4a148c,stroke:#ce93d8,color:#ffffff
    classDef sec fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef infra fill:#01579b,stroke:#81d4fa,color:#ffffff
    class C1 strat
    class C8 sec
    class C7,C9 infra
```

> **Diagram ID:** `DGM-VIS-058` — **Domain Taxonomy Tree with Legal Dependency Directions**
> **Explanation:** Solid edges are permitted dependency directions; an arrow from `X` to `Y` means
> `X` may depend on `Y`. Dotted edges from `C8` are constraint relations, not dependencies —
> security constrains without being called. The single dotted edge from `C9` to `C1` is the
> evidence loop: operational reality is the only legitimate input that flows *back* to strategy,
> which is how `SUC-VIS-` measures are supposed to close. Any edge not drawn here is illegal and
> is caught by `VAL-VIS-219`.

### TBL-VIS-153: Category Assignment Test

| Ask | If yes | Category |
| :--- | :--- | :--- |
| Does it decide what the system should become? | Strategic | `C1` |
| Does a paying or served party receive value directly from it? | Core Product | `C2` |
| Does it exist to make machine reasoning possible? | AI | `C3` |
| Is its product a durable, retrievable representation of truth? | Knowledge | `C4` |
| Does it own the authoritative copy of state? | Data | `C5` |
| Does a human perceive it with their senses? | Experience | `C6` |
| Would the system stop running without it? | Infrastructure | `C7` |
| Does it exist to deny, verify, or contain? | Security | `C8` |
| Does it exist to observe and to respond? | Operational | `C9` |
| Does it exist to translate between us and something outside? | Integration | `C10` |

> **`VIS-118`.** As with `TBL-VIS-148`, order matters and first yes wins. A domain that answers yes
> twice is a candidate for splitting, and `VAL-VIS-215` requires that the split be attempted before
> a dual-category domain is admitted.

### 02.2.2 Category Loading Priority for Agents

> **`VIS-119`.** An agent with a bounded context window cannot load fifty domains. Categories carry
> a loading priority so that an agent loads the smallest sufficient set. The priority is not
> importance; it is **order of necessity**.

### TBL-VIS-154: Category Loading Priority

| Priority | Categories | Load when | Approximate cost |
| :--- | :--- | :--- | :--- |
| **L0 — always** | `C1` Strategic, `C4` Knowledge | Every task without exception | Two registry sections |
| **L1 — near always** | `C8` Security, `C3` AI | Any task an agent performs autonomously | Two registry sections |
| **L2 — task-scoped** | `C2` Core Product, `C5` Data | Any task touching behaviour or state | Per-domain rows only |
| **L3 — conditional** | `C6` Experience, `C10` Integration | Only when the task crosses that surface | Per-domain rows only |
| **L4 — rare** | `C7` Infrastructure, `C9` Operational | Only for runtime, deployment, or incident work | Per-domain rows only |

### 02.2.3 Category Invariants

### TBL-VIS-155: Category Dependency Legality Matrix

| From ↓ / May depend on → | `C1` | `C2` | `C3` | `C4` | `C5` | `C6` | `C7` | `C8` | `C9` | `C10` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`C1` Strategic** | — | No | No | No | No | No | No | No | No | No |
| **`C2` Core Product** | Yes | Contract only | Yes | Yes | Yes | No | Yes | Yes | No | Yes |
| **`C3` AI** | Yes | No | — | Yes | Yes | No | Yes | Yes | No | Yes |
| **`C4` Knowledge** | Yes | No | No | — | No | No | No | Yes | No | No |
| **`C5` Data** | Yes | No | No | Yes | Contract only | No | Yes | Yes | No | No |
| **`C6` Experience** | Yes | Yes | Yes | Yes | No | — | No | Yes | No | Yes |
| **`C7` Infrastructure** | Yes | No | No | No | No | No | Contract only | Yes | No | No |
| **`C8` Security** | Yes | No | No | Yes | No | No | Yes | — | Yes | Yes |
| **`C9` Operational** | Yes | No | No | Yes | No | No | Yes | Yes | — | No |
| **`C10` Integration** | Yes | No | No | Yes | No | No | Yes | Yes | No | Contract only |

> **`VIS-120`.** "Contract only" means a peer-to-peer dependency is legal **solely** through a
> published, versioned contract — never through shared internals, shared tables, or shared
> in-process state. This is the mechanism that keeps `C2` domains from fusing into one monolith
> while still permitting them to cooperate. `VAL-VIS-220` checks it.

> **`VIS-121`.** The `C1` row is entirely "No" and that is the most important row in the matrix.
> **Strategy depends on nothing.** The instant a strategic domain depends on an implementation
> domain, the vision becomes a description of what was built rather than a specification of what
> should be built, and the document you are reading loses its authority. `FAL-VIS-129` names this
> inversion.

### 02.2.4 Knowledge Domains Are Not System Domains

> **`VIS-122`.** `docs/MASTER_CONTEXT/` contains twenty-four **knowledge domains**, numbered
> `01_PRODUCT` through `24_DIAGRAMS`, each with an `INDEX.md` and a named owner. This part defines
> **system domains** in the `DOMAIN-VIS-` namespace. The two sets are related but not identical,
> and an agent that treats them as identical will place system artifacts in documentation folders.

### TBL-VIS-156: Knowledge Domain Versus System Domain

| Dimension | Knowledge domain (`docs/MASTER_CONTEXT/NN_NAME/`) | System domain (`DOMAIN-VIS-nnn`) |
| :--- | :--- | :--- |
| **Purpose** | Organise documents for retrieval | Organise purpose and ownership for construction |
| **Optimised for** | Navigation and context loading | Dependency control and blast-radius containment |
| **Count today** | 24, all present with `INDEX.md` | 50 defined in §02.3 |
| **Layer split allowed?** | **Yes** — frontend/backend/database split aids retrieval | **No** — prohibited by `DCR-03` |
| **Governing rule** | `MASTER_CONTEXT_RULES.md` PART 04, `TBL-MCR-008` | `TBL-VIS-151` `DCR-01`…`DCR-10` |
| **Identifier** | `MCX-NN-nnn` | `DOMAIN-VIS-nnn` |
| **Status today** | `IMPLEMENTED` as documentation | Mostly `PLANNED` — see §02.3 |
| **Mapping** | Many-to-many with system domains — see `TBL-VIS-157` | — |

### TBL-VIS-157: Knowledge Domain to System Domain Mapping

| Knowledge domain | Primary system domain | Secondary | Note |
| :--- | :--- | :--- | :--- |
| `01_PRODUCT` | `DOMAIN-VIS-001` System Vision | `DOMAIN-VIS-021` | Houses this document |
| `02_BUSINESS` | `DOMAIN-VIS-003` Business Strategy | — | No content documents yet |
| `03_USERS` | `DOMAIN-VIS-031` User Research | `DOMAIN-VIS-030` | — |
| `04_ARCHITECTURE` | `DOMAIN-VIS-004` Architecture Authority | all | Houses `AOM-ARCH-001` |
| `05_AI` | `DOMAIN-VIS-010`…`016` | `DOMAIN-VIS-002` | Seven AI system domains map here |
| `06_DATABASE` | `DOMAIN-VIS-034`…`037` | — | Data domains |
| `07_FRONTEND` | `DOMAIN-VIS-030`, `032` | `DOMAIN-VIS-033` | Layer-named for retrieval only |
| `08_BACKEND` | `DOMAIN-VIS-020`…`026` | `DOMAIN-VIS-005` | Layer-named for retrieval only |
| `09_INFRASTRUCTURE` | `DOMAIN-VIS-038`…`040` | — | — |
| `10_SECURITY` | `DOMAIN-VIS-044`…`047` | all | Cross-cutting |
| `11_DEPLOYMENT` | `DOMAIN-VIS-039` Delivery | `DOMAIN-VIS-038` | — |
| `12_OPERATIONS` | `DOMAIN-VIS-042` Operations | `DOMAIN-VIS-041` | — |
| `13_OBSERVABILITY` | `DOMAIN-VIS-041` Observability | `DOMAIN-VIS-043` | — |
| `14_DESIGN_SYSTEM` | `DOMAIN-VIS-030` Design System | `DOMAIN-VIS-032` | Backed by `design/` |
| `15_API` | `DOMAIN-VIS-048` API Surface | `DOMAIN-VIS-049` | — |
| `16_PLUGINS` | `DOMAIN-VIS-050` Extension | `DOMAIN-VIS-048` | — |
| `17_AUTOMATION` | `DOMAIN-VIS-006` Governance Automation | `DOMAIN-VIS-039` | — |
| `18_TESTING` | `DOMAIN-VIS-007` Verification | all | Cross-cutting |
| `19_ROADMAP` | `DOMAIN-VIS-003` Business Strategy | `DOMAIN-VIS-001` | — |
| `20_APPENDIX` | `DOMAIN-VIS-002` Knowledge Graph | — | — |
| `21_RESEARCH` | `DOMAIN-VIS-008` Experimentation | — | — |
| `22_DECISIONS` | `DOMAIN-VIS-005` Decision Authority | — | — |
| `23_STANDARDS` | `DOMAIN-VIS-009` Standards | all | Cross-cutting |
| `24_DIAGRAMS` | `DOMAIN-VIS-002` Knowledge Graph | — | — |

> **`VIS-123`.** Every one of the twenty-four knowledge domains maps to at least one system domain,
> and no system domain in §02.3 lacks a knowledge home. That bidirectional completeness is checked
> by `VAL-VIS-224` and `VAL-VIS-225`. It is the mechanism that prevents a system domain from being
> invented with nowhere to document it, and a knowledge folder from existing with nothing to say.

### TBL-VIS-158: Domain Taxonomy Registry — Category Populations

| Category | Domain IDs | Count | `IMPLEMENTED` | `PARTIAL` | `DOCUMENTED` | `PLANNED` | `PROPOSED` |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `C1` Strategic | `DOMAIN-VIS-001`…`005` | 5 | 2 | 2 | 1 | 0 | 0 |
| `C4` Knowledge | `DOMAIN-VIS-006`…`009` | 4 | 2 | 1 | 1 | 0 | 0 |
| `C3` AI | `DOMAIN-VIS-010`…`016` | 7 | 0 | 2 | 1 | 4 | 0 |
| `C2` Core Product | `DOMAIN-VIS-017`…`029` | 13 | 0 | 0 | 1 | 9 | 3 |
| `C6` Experience | `DOMAIN-VIS-030`…`033` | 4 | 0 | 0 | 2 | 2 | 0 |
| `C5` Data | `DOMAIN-VIS-034`…`037` | 4 | 0 | 0 | 0 | 4 | 0 |
| `C7` Infrastructure | `DOMAIN-VIS-038`…`040` | 3 | 0 | 0 | 0 | 3 | 0 |
| `C9` Operational | `DOMAIN-VIS-041`…`043` | 3 | 0 | 0 | 0 | 3 | 0 |
| `C8` Security | `DOMAIN-VIS-044`…`047` | 4 | 0 | 0 | 2 | 2 | 0 |
| `C10` Integration | `DOMAIN-VIS-048`…`050` | 3 | 0 | 0 | 0 | 2 | 1 |
| **Total** | `DOMAIN-VIS-001`…`050` | **50** | **4** | **5** | **8** | **29** | **4** |

> **`VIS-124`.** Four domains out of fifty are `IMPLEMENTED`. That ratio — eight percent — is the
> honest shape of Oship at this moment and matches the capability ratio recorded in PART 01 (six of
> seventy). Two independent decompositions producing the same proportion is weak corroboration that
> neither is inflated. The number will look bad in a status report. It is correct, and `PRN-VIS-001`
> requires that correctness outrank comfort.

---

## 02.3 — Domain Registry

### AI NAVIGATION METADATA — §02.3

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this is the lookup table for all placement decisions** |
| **AI DEPENDENCIES** | §02.1 classification, §02.2 taxonomy |
| **AI INPUTS** | A classified domain name, or a work item needing a home |
| **AI OUTPUTS** | The full record: purpose, owner, inputs, outputs, dependencies, architecture anchor, status |
| **AI IMPLEMENTATION IMPACT** | Every future directory, service, and document derives its home from this register |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-227`…`VAL-VIS-248` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` `TBL-ARCH-098` domain register, `architecture/DOMAIN_MODEL.md` |

### 02.3.1 Registry Schema

> **`VIS-125`.** Every domain record carries fourteen fields. The schema is fixed: a record missing
> any field is invalid, and a field whose value is unknown carries the literal string
> `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` rather than a guess, a blank, or an optimistic
> placeholder.

### TBL-VIS-159: Domain Record Schema

| Field | Type | Constraint | Absent value |
| :--- | :--- | :--- | :--- |
| **Domain ID** | `DOMAIN-VIS-nnn` | Permanent, never reused | Invalid |
| **Name** | Noun phrase of purpose | No team, tool, layer, or leftover name (`DCR-03`) | Invalid |
| **Purpose** | One sentence | Must contain no "and" joining two purposes | Invalid |
| **Category** | One of `C1`…`C10` | Exactly one (`TBL-VIS-153`) | Invalid |
| **Status** | PART 01 vocabulary | `IMPLEMENTED` requires evidence | `UNKNOWN` |
| **Owner** | Accountable role | Must be a role, never a person's convenience | Invalid (`DCR-08`) |
| **Inputs** | What it consumes | Named sources | `none` |
| **Outputs** | What it produces | Named artifacts | `none` |
| **Dependencies** | Other `DOMAIN-VIS-` IDs | Must be legal per `TBL-VIS-155` | `none` |
| **Architecture Reference** | `DOM-ARCH-` / `CMP-ARCH-` / `LYR-ARCH-` | Read-only citation into `AOM-ARCH-001` | `UNMAPPED` |
| **Implementation Status** | Code-level reality | Independent of documentation status | `NO CODE` |
| **AI Loading Priority** | `L0`…`L4` | From `TBL-VIS-154` | `L4` |
| **Security Classification** | `S1` critical … `S4` public | See `TBL-VIS-160` | `S3` |
| **Evolution Level** | `E0`…`E7` | From `TBL-VIS-215` state machine | `E0` |

### TBL-VIS-160: Security Classification Scale

| Level | Meaning | Requirement when a domain carries it |
| :--- | :--- | :--- |
| `S1` | Compromise is catastrophic and possibly unrecoverable | Threat model required before any implementation; dual review |
| `S2` | Compromise causes material loss or regulatory exposure | Threat model required before release; security reviewer on every change |
| `S3` | Compromise causes operational disruption | Standard review, secrets hygiene, least privilege |
| `S4` | Public by design | No confidentiality requirement; integrity still required |

### 02.3.2 Strategic Domains — `C1`

### TBL-VIS-161: `DOMAIN-VIS-001` System Vision

| Field | Value |
| :--- | :--- |
| **Name** | System Vision |
| **Purpose** | Define what Oship is and what it must become, in a form an agent can execute |
| **Category** | `C1` Strategic |
| **Status** | `PARTIALLY IMPLEMENTED` — this document, PART 01 and PART 02 of a planned six |
| **Owner** | Product Management / Chief Product Officer |
| **Inputs** | Repository evidence, `PROJECT_PHILOSOPHY.md`, `README.md`, ADR decisions |
| **Outputs** | `VIS-`, `CAP-VIS-`, `PRN-VIS-`, `NG-VIS-`, `OUT-VIS-`, `DOMAIN-VIS-` registers |
| **Dependencies** | none — `C1` depends on nothing (`VIS-121`) |
| **Architecture Reference** | `DOM-ARCH-001` Governance and AI |
| **Implementation Status** | `NO CODE` — a specification domain by nature |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S4` — public by design |
| **Evolution Level** | `E4` Implemented as documentation |

### TBL-VIS-162: `DOMAIN-VIS-002` Knowledge Graph

| Field | Value |
| :--- | :--- |
| **Name** | Knowledge Graph |
| **Purpose** | Hold every durable truth about Oship in a retrievable, cross-linked structure |
| **Category** | `C4` Knowledge — registered in the `C1` block because it is the strategic partner of `DOMAIN-VIS-001` |
| **Status** | `PARTIALLY IMPLEMENTED` — 24 domain indexes exist, most content documents do not |
| **Owner** | Architecture / Documentation Team |
| **Inputs** | All domain knowledge, decisions, standards |
| **Outputs** | `docs/MASTER_CONTEXT/` corpus, `MCX-` identifiers, routing tables |
| **Dependencies** | `DOMAIN-VIS-001` |
| **Architecture Reference** | `CMP-ARCH-001` Master Context Corpus |
| **Implementation Status** | `NO CODE` — documentation corpus |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S4` |
| **Evolution Level** | `E4` |

### TBL-VIS-163: `DOMAIN-VIS-003` Business Strategy

| Field | Value |
| :--- | :--- |
| **Name** | Business Strategy |
| **Purpose** | Determine which value Oship pursues, in what order, under what economics |
| **Category** | `C1` Strategic |
| **Status** | `DOCUMENTED` — `02_BUSINESS` and `19_ROADMAP` indexes exist; no content documents |
| **Owner** | Business Strategy / Product Leadership |
| **Inputs** | Market context, `DOMAIN-VIS-001` vision, operational evidence |
| **Outputs** | Priority order, economic constraints, roadmap sequencing |
| **Dependencies** | `DOMAIN-VIS-001` |
| **Architecture Reference** | `UNMAPPED` |
| **Implementation Status** | `NO CODE` |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S3` |
| **Evolution Level** | `E2` Planned |

### TBL-VIS-164: `DOMAIN-VIS-004` Architecture Authority

| Field | Value |
| :--- | :--- |
| **Name** | Architecture Authority |
| **Purpose** | Translate vision into a buildable structure and defend that structure against drift |
| **Category** | `C1` Strategic |
| **Status** | `PARTIALLY IMPLEMENTED` — `AOM-ARCH-001` PART 01 complete, 10,844 lines |
| **Owner** | Lead Enterprise Architect |
| **Inputs** | `DOMAIN-VIS-001` vision, capability register, constraints |
| **Outputs** | `LYR-ARCH-`, `DOM-ARCH-`, `CMP-ARCH-`, `INV-ARCH-` registers |
| **Dependencies** | `DOMAIN-VIS-001`, `DOMAIN-VIS-002` |
| **Architecture Reference** | `CMP-ARCH-008` Architecture Specification |
| **Implementation Status** | `NO CODE` |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S4` |
| **Evolution Level** | `E4` |

### TBL-VIS-165: `DOMAIN-VIS-005` Decision Authority

| Field | Value |
| :--- | :--- |
| **Name** | Decision Authority |
| **Purpose** | Record every consequential choice immutably with its reasoning and its cost of reversal |
| **Category** | `C1` Strategic |
| **Status** | `IMPLEMENTED` — `docs/ADR/` process plus `.ai/DECISION_LOG.md` with `DEC-001`…`DEC-010` |
| **Owner** | Architecture Board |
| **Inputs** | Proposed changes reaching the constitutional or structural threshold |
| **Outputs** | ADRs, `DEC-` records, supersession chains |
| **Dependencies** | `DOMAIN-VIS-001` |
| **Architecture Reference** | `CMP-ARCH-004` Decision Record Set |
| **Implementation Status** | `NO CODE` — process plus documents |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S4` |
| **Evolution Level** | `E4` |

### 02.3.3 Knowledge Domains — `C4`

### TBL-VIS-166: `DOMAIN-VIS-006` Governance Automation

| Field | Value |
| :--- | :--- |
| **Name** | Governance Automation |
| **Purpose** | Execute governance rules mechanically so that compliance is observed rather than asserted |
| **Category** | `C4` Knowledge |
| **Status** | `PLANNED` — workflow skeletons exist in `.github/workflow-skeletons/`, none installed (`EVD-VIS-017`) |
| **Owner** | DevOps / Automation Lead |
| **Inputs** | `VAL-` rule catalogues, repository state |
| **Outputs** | Pass or fail signals on every change |
| **Dependencies** | `DOMAIN-VIS-002`, `DOMAIN-VIS-009` |
| **Architecture Reference** | `UNMAPPED` |
| **Implementation Status** | `NO CODE` — eight skeleton workflows not in `.github/workflows/` |
| **AI Loading Priority** | `L1` |
| **Security Classification** | `S2` — CI has repository write authority |
| **Evolution Level** | `E2` |

### TBL-VIS-167: `DOMAIN-VIS-007` Verification

| Field | Value |
| :--- | :--- |
| **Name** | Verification |
| **Purpose** | Establish that a claim is true by executing a check rather than by reading a sentence |
| **Category** | `C4` Knowledge, cross-cutting |
| **Status** | `PARTIALLY IMPLEMENTED` — 595 `VAL-` rules written across two documents, two automated |
| **Owner** | QA / Test Engineering Lead |
| **Inputs** | Every specification claim, every artifact |
| **Outputs** | Verdicts with evidence |
| **Dependencies** | `DOMAIN-VIS-006`, `DOMAIN-VIS-002` |
| **Architecture Reference** | `UNMAPPED` |
| **Implementation Status** | `NO CODE` — `tests/` is `.gitkeep`-only |
| **AI Loading Priority** | `L1` |
| **Security Classification** | `S3` |
| **Evolution Level** | `E2` |

### TBL-VIS-168: `DOMAIN-VIS-008` Experimentation

| Field | Value |
| :--- | :--- |
| **Name** | Experimentation |
| **Purpose** | Permit disciplined exploration whose failures cannot contaminate production knowledge |
| **Category** | `C4` Knowledge |
| **Status** | `DOCUMENTED` — `research/` and `experiments/` exist as `.gitkeep`-only directories |
| **Owner** | Research / Innovation Lead |
| **Inputs** | Open questions, `UNKNOWN` labels from any domain |
| **Outputs** | Findings that either become decisions or are discarded with a record |
| **Dependencies** | `DOMAIN-VIS-002` |
| **Architecture Reference** | `UNMAPPED` |
| **Implementation Status** | `NO CODE` |
| **AI Loading Priority** | `L4` |
| **Security Classification** | `S3` — experiments must never hold production data (`BND-VIS-014`) |
| **Evolution Level** | `E1` Research |

### TBL-VIS-169: `DOMAIN-VIS-009` Standards

| Field | Value |
| :--- | :--- |
| **Name** | Standards |
| **Purpose** | Fix the form of every artifact so that difference in form never signals difference in meaning |
| **Category** | `C4` Knowledge, cross-cutting |
| **Status** | `IMPLEMENTED` — `23_STANDARDS/METADATA_STANDARD.md` defines the canonical 15-key frontmatter |
| **Owner** | Enterprise Standards / Architecture Board |
| **Inputs** | Recurring form questions from every domain |
| **Outputs** | Metadata standard, naming rules, identifier conventions |
| **Dependencies** | `DOMAIN-VIS-002` |
| **Architecture Reference** | `CMP-ARCH-005` Metadata Standard |
| **Implementation Status** | `NO CODE` |
| **AI Loading Priority** | `L0` |
| **Security Classification** | `S4` |
| **Evolution Level** | `E4` |

```mermaid
flowchart TB
    D1["DOMAIN-VIS-001 System Vision - PARTIAL"] --> D4["DOMAIN-VIS-004 Architecture Authority - PARTIAL"]
    D1 --> D3["DOMAIN-VIS-003 Business Strategy - DOCUMENTED"]
    D1 --> D2["DOMAIN-VIS-002 Knowledge Graph - PARTIAL"]
    D1 --> D5["DOMAIN-VIS-005 Decision Authority - IMPLEMENTED"]
    D2 --> D9["DOMAIN-VIS-009 Standards - IMPLEMENTED"]
    D2 --> D8["DOMAIN-VIS-008 Experimentation - DOCUMENTED"]
    D9 --> D6["DOMAIN-VIS-006 Governance Automation - PLANNED"]
    D6 --> D7["DOMAIN-VIS-007 Verification - PARTIAL"]

    classDef impl fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef part fill:#f57f17,stroke:#fff59d,color:#000000
    classDef plan fill:#37474f,stroke:#b0bec5,color:#ffffff
    class D5,D9 impl
    class D1,D2,D4,D7 part
    class D3,D6,D8 plan
```

> **Diagram ID:** `DGM-VIS-059` — **Strategic and Knowledge Domain Cluster with Real Status**
> **Explanation:** This cluster is the only part of Oship with any implemented substance. Colour is
> status, not importance: green implemented, amber partial, grey planned or documentation-only. The
> chain `DOMAIN-VIS-009` → `006` → `007` is the enforcement path, and it is grey at its middle
> link, which is precisely why 593 of 595 validation rules across this document and `AOM-ARCH-001`
> remain unexecuted.

### 02.3.4 AI Domains — `C3`

### TBL-VIS-170: AI Domain Register — `DOMAIN-VIS-010`…`016`

| ID | Name | Purpose | Status | Owner | AI Load | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-010` | AI Control Plane | Give agents a single authoritative place to read state and write status | `IMPLEMENTED` — `.ai/` with 17 files | AI Repository Architect | `L0` | `S2` | `E4` |
| `DOMAIN-VIS-011` | Agent Runtime | Execute agent work inside a bounded, observable sandbox | `PLANNED` | AI Repository Architect | `L1` | `S1` | `E2` |
| `DOMAIN-VIS-012` | Model Routing | Select and call an inference provider without binding the system to one | `PLANNED` — no provider selected (`EVD-VIS-019`) | AI Repository Architect | `L1` | `S2` | `E2` |
| `DOMAIN-VIS-013` | Context Assembly | Build the smallest sufficient context for a given task | `PARTIALLY IMPLEMENTED` — `CONTEXT_ROUTER.md` exists; assembly is manual | AI Repository Architect | `L0` | `S2` | `E3` |
| `DOMAIN-VIS-014` | AI Memory | Persist what agents learn across sessions and contexts | `DOCUMENTED` — `MCX-MEM-001` released, 34,428 lines, no runtime | AI Repository Architect | `L1` | `S2` | `E3` |
| `DOMAIN-VIS-015` | AI Evaluation | Judge agent output against specification before it is accepted | `PLANNED` | QA / AI Architect | `L1` | `S1` | `E2` |
| `DOMAIN-VIS-016` | AI Safety and Autonomy | Enforce the autonomy boundary and refuse what must be refused | `PARTIALLY IMPLEMENTED` — enforced socially, not technically (`CAP-VIS-056`) | Security Architect | `L1` | `S1` | `E3` |

> **`VIS-126`.** Two AI domains carry security classification `S1`: `DOMAIN-VIS-011` Agent Runtime
> and `DOMAIN-VIS-016` AI Safety and Autonomy. An agent runtime is `S1` because it executes
> arbitrary generated instructions with repository credentials; a safety domain is `S1` because its
> failure mode is silent. `DOMAIN-VIS-015` is `S1` for the same reason as `016` — an evaluator that
> passes bad output is worse than no evaluator, because it manufactures unearned confidence.

### 02.3.5 Core Product Domains — `C2`

### TBL-VIS-171: Core Product Domain Register — `DOMAIN-VIS-017`…`029`

| ID | Name | Purpose | Status | Owner | Arch ref | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-017` | Product Core | Hold the entities and rules every other product domain shares | `PLANNED` | Backend Engineering Lead | `DOM-ARCH-002` | `S2` | `E2` |
| `DOMAIN-VIS-018` | Identity and Access | Establish who a caller is and what they may do | `PLANNED` | Security Architect | `DOM-ARCH-005` `PROPOSED` | `S1` | `E2` |
| `DOMAIN-VIS-019` | Tenancy | Keep one customer's world structurally separate from every other | `PLANNED` | Backend Engineering Lead | `DOM-ARCH-006` `PROPOSED` | `S1` | `E2` |
| `DOMAIN-VIS-020` | Financial Factory | Process enterprise financial workloads — the value-generating engine | `PLANNED` | Backend Engineering Lead | `DOM-ARCH-003` | `S1` | `E2` |
| `DOMAIN-VIS-021` | Ledger | Hold the immutable, double-entry record of value movement | `PLANNED` | Backend Engineering Lead | `CMP-ARCH-015` | `S1` | `E2` |
| `DOMAIN-VIS-022` | Settlement | Finalise value movement exactly once, under failure | `PLANNED` | Backend Engineering Lead | `CMP-ARCH-017` | `S1` | `E2` |
| `DOMAIN-VIS-023` | Reconciliation | Detect and resolve divergence between two records of the same truth | `PLANNED` | Backend Engineering Lead | `UNMAPPED` | `S2` | `E2` |
| `DOMAIN-VIS-024` | Workflow Orchestration | Carry long-running processes across failures and restarts | `PLANNED` | Backend Engineering Lead | `CMP-ARCH-013` | `S2` | `E2` |
| `DOMAIN-VIS-025` | Automation | Let users express repeatable work once and have the system perform it | `PROPOSED` | Product Management | `UNMAPPED` | `S2` | `E1` |
| `DOMAIN-VIS-026` | Analytics | Turn accumulated state into answers a human can act on | `PROPOSED` | Data Engineering Lead | `UNMAPPED` | `S2` | `E1` |
| `DOMAIN-VIS-027` | Notification | Deliver a message to a party outside the system, exactly as often as intended | `PLANNED` | Backend Engineering Lead | `CMP-ARCH-014` | `S3` | `E2` |
| `DOMAIN-VIS-028` | Monetization | Convert delivered value into recorded revenue | `PROPOSED` | Business Strategy | `UNMAPPED` | `S1` | `E1` |
| `DOMAIN-VIS-029` | Marketplace | Let parties outside Oship offer capability to parties inside it | `PROPOSED` | Platform / Extension Lead | `UNMAPPED` | `S2` | `E0` |

> **`VIS-127`.** Every domain in `TBL-VIS-171` is `PLANNED` or `PROPOSED`. Not one line of code
> exists for any of them; the directories that would hold them — `apps/`, `services/`, `packages/`
> — contain only `.gitkeep` files (`EVD-VIS-020`). This table is therefore a **specification of
> intent**, and `NG-VIS-`-class discipline forbids any downstream document from citing it as
> evidence that these domains exist. `VAL-VIS-231` checks for exactly that misuse.

> **`VIS-128`.** Six of the thirteen Core Product domains carry `S1`. That concentration is a
> direct consequence of the Money Factory objective: a system that moves money has an
> irrecoverable failure mode that a system that moves documents does not. `DOMAIN-VIS-018`,
> `019`, `020`, `021`, `022`, and `028` must each have a threat model before a single line of
> their implementation is written — that is the binding effect of `S1` in `TBL-VIS-160`, and it
> is restated as `CON-VIS-031` in §02.10.

```mermaid
flowchart LR
    subgraph EDGE["Edge and access"]
        D18["DOMAIN-VIS-018 Identity S1"]
        D19["DOMAIN-VIS-019 Tenancy S1"]
    end
    subgraph CORE["Value engine"]
        D20["DOMAIN-VIS-020 Financial Factory S1"]
        D21["DOMAIN-VIS-021 Ledger S1"]
        D22["DOMAIN-VIS-022 Settlement S1"]
        D23["DOMAIN-VIS-023 Reconciliation S2"]
    end
    subgraph SUPPORT["Supporting product"]
        D17["DOMAIN-VIS-017 Product Core S2"]
        D24["DOMAIN-VIS-024 Workflow S2"]
        D27["DOMAIN-VIS-027 Notification S3"]
    end
    subgraph FUTURE["Proposed only"]
        D25["DOMAIN-VIS-025 Automation"]
        D26["DOMAIN-VIS-026 Analytics"]
        D28["DOMAIN-VIS-028 Monetization S1"]
        D29["DOMAIN-VIS-029 Marketplace"]
    end

    D18 --> D19
    D19 --> D20
    D17 --> D20
    D20 --> D21
    D21 --> D22
    D22 --> D23
    D24 --> D20
    D20 --> D27
    D21 --> D26
    D22 --> D28
    D25 -.-> D24
    D29 -.-> D25

    classDef s1 fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef prop fill:#4e342e,stroke:#bcaaa4,color:#ffffff
    class D18,D19,D20,D21,D22,D28 s1
    class D25,D26,D29 prop
```

> **Diagram ID:** `DGM-VIS-060` — **Core Product Domain Dependency Chain**
> **Explanation:** Red nodes are security classification `S1`. The critical path is
> `018 → 019 → 020 → 021 → 022`: identity gates tenancy, tenancy scopes the factory, the factory
> writes the ledger, the ledger drives settlement. Five sequential `S1` domains means the
> implementation order is not negotiable, and it means the first implementable product domain is
> `DOMAIN-VIS-018`, not the Money Factory itself. Dotted edges are `PROPOSED` relationships that
> carry no commitment.

### 02.3.6 Experience Domains — `C6`

### TBL-VIS-172: Experience Domain Register — `DOMAIN-VIS-030`…`033`

| ID | Name | Purpose | Status | Evidence | Owner | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-030` | Design System | Fix the visual and interaction vocabulary so every surface reads as one system | `DOCUMENTED` | `design/` with 12 subdirectories, all `.gitkeep`-only; `design/INDEX.md` `DES-IND-001` | UX/UI Design Team | `S4` | `E2` |
| `DOMAIN-VIS-031` | User Research | Establish what users actually need rather than what the team assumes | `DOCUMENTED` | `03_USERS/INDEX.md`; `design/ux/` empty | UX Research | `S3` | `E1` |
| `DOMAIN-VIS-032` | Interaction and Accessibility | Ensure every capability is reachable by every user, including assistive paths | `PLANNED` | `design/ui/`, `design/animations/` empty | UX/UI Design Team | `S3` | `E2` |
| `DOMAIN-VIS-033` | Personalization | Adapt presentation to a user without forking behaviour | `PLANNED` | none | Product Management | `S2` | `E1` |

### 02.3.7 Data Domains — `C5`

### TBL-VIS-173: Data Domain Register — `DOMAIN-VIS-034`…`037`

| ID | Name | Purpose | Status | Owner | Arch ref | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-034` | Data Contracts | Publish the shape of every datum crossing a boundary, versioned | `PLANNED` | Database Architect | `CMP-ARCH-030` Contract Registry | `S2` | `E2` |
| `DOMAIN-VIS-035` | Persistence | Store state durably and transactionally | `PLANNED` — `database/` is `.gitkeep`-only | Database Architect | `CMP-ARCH-024` | `S1` | `E2` |
| `DOMAIN-VIS-036` | Data Lifecycle | Govern how data is created, retained, archived, and destroyed | `PLANNED` | Database Architect | `UNMAPPED` | `S1` | `E2` |
| `DOMAIN-VIS-037` | Data Quality | Detect and reject data that is structurally valid but factually wrong | `PLANNED` | Data Engineering Lead | `UNMAPPED` | `S2` | `E1` |

### 02.3.8 Infrastructure Domains — `C7`

### TBL-VIS-174: Infrastructure Domain Register — `DOMAIN-VIS-038`…`040`

| ID | Name | Purpose | Status | Evidence | Owner | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-038` | Runtime Platform | Provide the substrate on which services execute | `PLANNED` | `infra/`, `k8s/`, `docker/` all `.gitkeep`-only; stack `UNKNOWN` (`EVD-VIS-019`) | Platform Engineering | `S1` | `E2` |
| `DOMAIN-VIS-039` | Delivery | Move a validated change from author to production reproducibly | `PLANNED` | `deployment/` empty; CI skeletons uninstalled | DevOps / SRE | `S1` | `E2` |
| `DOMAIN-VIS-040` | Configuration and Secrets | Supply environment-specific values without rebuilds and without exposure | `PLANNED` | `configs/` `.gitkeep`-only | Platform Engineering | `S1` | `E2` |

### 02.3.9 Operational Domains — `C9`

### TBL-VIS-175: Operational Domain Register — `DOMAIN-VIS-041`…`043`

| ID | Name | Purpose | Status | Evidence | Owner | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-041` | Observability | Make the system's internal state externally evident | `PLANNED` | `monitoring/`, `observability/` `.gitkeep`-only | SRE / Observability Lead | `S2` | `E2` |
| `DOMAIN-VIS-042` | Operations and Incident Response | Detect, contain, and recover from failure with a record | `PLANNED` | `12_OPERATIONS/INDEX.md` only | SRE | `S2` | `E2` |
| `DOMAIN-VIS-043` | Reliability Engineering | Set and defend service objectives against measured reality | `PLANNED` | No SLOs defined anywhere | SRE | `S2` | `E1` |

> **`VIS-129`.** `DOMAIN-VIS-041` Observability is the domain whose absence hurts most today.
> Thirteen of fifteen construction measures in `SUC-VIS-` are `NOT YET MEASURED` (`VIS-052`) for a
> single reason: no domain owns measurement. Until `DOMAIN-VIS-041` reaches `E4`, the success model
> in §01.12 is a list of intentions.

### 02.3.10 Security Domains — `C8`

### TBL-VIS-176: Security Domain Register — `DOMAIN-VIS-044`…`047`

| ID | Name | Purpose | Status | Evidence | Owner | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-044` | Threat Modelling | Enumerate what an adversary would attempt before building the thing they would attack | `DOCUMENTED` | `docs/security/`, `10_SECURITY/INDEX.md` | Security Architect | `S2` | `E2` |
| `DOMAIN-VIS-045` | Authorization Policy | Decide, in one place, whether a principal may perform an action | `PLANNED` | `CMP-ARCH-011` `PLANNED` | Security Architect | `S1` | `E2` |
| `DOMAIN-VIS-046` | Privacy and Data Protection | Bound what may be known about a person and for how long | `PLANNED` — regulatory regime `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` (`PROB-VIS-023`) | Security Architect | `S1` | `E1` |
| `DOMAIN-VIS-047` | Audit and Attestation | Produce an unforgeable record of who did what, when, and under what authority | `DOCUMENTED` — git history plus `DECISION_LOG.md` (`CAP-VIS-024`) | Auditor / Security | `S1` | `E3` |

### 02.3.11 Integration Domains — `C10`

### TBL-VIS-177: Integration Domain Register — `DOMAIN-VIS-048`…`050`

| ID | Name | Purpose | Status | Evidence | Owner | Sec | Evo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-048` | API Surface | Present a stable, versioned contract to callers outside the system | `PLANNED` | `apis/`, `sdk/` `.gitkeep`-only; `15_API/INDEX.md` exists | API / Integration Lead | `S1` | `E2` |
| `DOMAIN-VIS-049` | External Providers | Depend on third-party systems without being owned by them | `PLANNED` — no provider selected in any category | API / Integration Lead | `S2` | `E1` |
| `DOMAIN-VIS-050` | Extension and Plugins | Let third parties add capability inside a sandbox that cannot harm the host | `PROPOSED` | `plugins/` `.gitkeep`-only; `CMP-ARCH-029` `PLANNED` | Platform / Extension Lead | `S1` | `E1` |

### 02.3.12 Registry Completeness Audit

### TBL-VIS-178: Registry Coverage Against `AOM-ARCH-001`

| Architecture domain | Vision domains mapping to it | Count | Unmapped vision domains in this row |
| :--- | :--- | ---: | :--- |
| `DOM-ARCH-001` Governance and AI | `001`, `002`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, `013`, `014` | 11 | — |
| `DOM-ARCH-002` Core Platform | `017`, `024`, `027`, `035`, `038`, `040` | 6 | — |
| `DOM-ARCH-003` Financial Factory | `020`, `021`, `022`, `023` | 4 | — |
| `DOM-ARCH-004` Observability | `041`, `042`, `043`, `047` | 4 | — |
| `DOM-ARCH-005` Identity and Access `PROPOSED` | `018`, `045` | 2 | — |
| `DOM-ARCH-006` Tenancy `PROPOSED` | `019` | 1 | — |
| `DOM-ARCH-007` Workflow `PROPOSED` | `024` secondary | 1 | — |
| `DOM-ARCH-008` AI Runtime `PROPOSED` | `011`, `012`, `015`, `016` | 4 | — |
| `DOM-ARCH-009` Integration `PROPOSED` | `048`, `049`, `050` | 3 | — |
| `DOM-ARCH-010` Notification `PROPOSED` | `027` secondary | 1 | — |
| **No architecture domain exists** | `003`, `025`, `026`, `028`, `029`, `030`, `031`, `032`, `033`, `034`, `036`, `037`, `039`, `044`, `046` | **15** | Recorded as `UNMAPPED` |

> **`VIS-130`.** Fifteen of fifty vision domains have no corresponding architecture domain. This is
> not a defect of this document — it is a **forward obligation on `AOM-ARCH-001` PART 02**, which
> must either create architecture domains for them or record why they are absorbed into existing
> ones. §02.13 restates the fifteen as a numbered obligation list, and `VAL-VIS-246` requires that
> the list shrink or be re-justified in each subsequent part. This document may not close the gap
> itself: §01.17 and `VIS-065` make the vision read-only toward architecture.

### TBL-VIS-179: Registry Integrity Checks Run Against §02.3

| Check | Rule | Result |
| :--- | :--- | :--- |
| Every ID in `001`…`050` defined exactly once | `DCR-05` | **PASS** — 50 of 50 |
| Every record has all 14 schema fields | `TBL-VIS-159` | **PASS** |
| Every record has an owner | `DCR-08` | **PASS** — all 50 |
| No team, tool, layer, or leftover names | `DCR-03` | **PASS** |
| Every status drawn from the PART 01 vocabulary | `DCR-06` | **PASS** |
| No `IMPLEMENTED` status without cited evidence | `VAL-VIS-229` | **PASS** — 4 implemented, 4 cite evidence |
| Every dependency legal per `TBL-VIS-155` | `VAL-VIS-219` | **PASS** |
| Every domain has a knowledge home | `VAL-VIS-224` | **PASS** — via `TBL-VIS-157` |
| Every knowledge domain has a system domain | `VAL-VIS-225` | **PASS** — 24 of 24 |
| Architecture references cite only existing IDs | `VAL-VIS-244` | **PASS** — `PROPOSED` anchors labelled as such |

---

## 02.4 — Domain Boundary Model

### AI NAVIGATION METADATA — §02.4

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — read before writing any code that spans two domains** |
| **AI DEPENDENCIES** | §02.3 registry, §01.9 system boundaries `BND-VIS-001`…`016` |
| **AI INPUTS** | Two domain IDs and a proposed interaction between them |
| **AI OUTPUTS** | Whether the interaction is permitted, and through which mechanism |
| **AI IMPLEMENTATION IMPACT** | Determines module structure, package layout, and network topology |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-249`…`VAL-VIS-266` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §04.6 trust boundaries `TB-1`…`TB-10` |

### 02.4.1 What a Domain Boundary Is

> **`VIS-131`.** A domain boundary is not a folder. A folder is a filing convenience that any
> import statement can ignore. A boundary is a **rule about which knowledge may cross**, enforced
> by something that will refuse a violation — a compiler, a linter, a network, or a review gate
> that has actually blocked something. A boundary with no refusing enforcer is a preference.

> **`VIS-132`.** Oship today has **zero technically enforced domain boundaries**. Every boundary
> described in this section is a specification of what enforcement must exist, not a report of
> enforcement that does exist. `EVD-VIS-020` is the evidence: there is no build system, no linter
> configuration, and no CI workflow installed that could refuse a cross-domain import.

### TBL-VIS-180: Boundary Strength Scale

| Strength | Name | Enforcer | Violation detected | Present in Oship |
| :--- | :--- | :--- | :--- | :--- |
| `B0` | Aspirational | Nothing | Never | **All 50 domains today** |
| `B1` | Documented | A sentence in a document | By a reader who happens to look | Partially — this section |
| `B2` | Reviewed | A human at a pull request | If the reviewer notices | Weak — single-owner `CODEOWNERS` (`VIS-069`) |
| `B3` | Linted | A static rule in CI | Every change, automatically | No |
| `B4` | Compiled | Module system or type system | Before the code runs | No |
| `B5` | Deployed | Process or network separation | At runtime, unavoidably | No |

> **`VIS-133`.** Boundary strength is not a maturity ladder to climb uniformly. A domain at `S1`
> security classification requires at least `B4`; a domain at `S4` may legitimately rest at `B2`
> forever. Spending effort to push `DOMAIN-VIS-030` Design System from `B2` to `B5` would be waste,
> while leaving `DOMAIN-VIS-021` Ledger at `B2` would be negligence. `TBL-VIS-181` fixes the
> required minimum per classification.

### TBL-VIS-181: Required Boundary Strength by Security Classification

| Security class | Minimum strength | Rationale | Domains affected |
| :--- | :--- | :--- | :--- |
| `S1` | `B4` compiled, `B5` where a tenant boundary is crossed | Failure is irrecoverable | `018`, `019`, `020`, `021`, `022`, `028`, `035`, `036`, `038`, `039`, `040`, `045`, `046`, `047`, `048`, `050`, `011`, `015`, `016` |
| `S2` | `B3` linted | Failure is expensive but recoverable | `006`, `010`, `012`, `013`, `014`, `017`, `023`, `024`, `025`, `026`, `033`, `034`, `037`, `041`, `042`, `043`, `044`, `049` |
| `S3` | `B2` reviewed | Failure is operational | `003`, `007`, `008`, `027`, `031`, `032` |
| `S4` | `B1` documented | No confidentiality requirement | `001`, `002`, `004`, `005`, `009`, `030` |

```mermaid
flowchart TB
    B0["B0 Aspirational - nothing refuses"] --> B1["B1 Documented - a reader might notice"]
    B1 --> B2["B2 Reviewed - a human might notice"]
    B2 --> B3["B3 Linted - CI always notices"]
    B3 --> B4["B4 Compiled - it cannot build"]
    B4 --> B5["B5 Deployed - it cannot reach"]

    S4["S4 public - stop at B1"] -.-> B1
    S3["S3 operational - stop at B2"] -.-> B2
    S2["S2 material - stop at B3"] -.-> B3
    S1["S1 catastrophic - reach B4 or B5"] -.-> B4

    NOW["Oship today - all 50 domains"] --> B0

    classDef now fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef strong fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class NOW,B0 now
    class B4,B5 strong
```

> **Diagram ID:** `DGM-VIS-061` — **Boundary Strength Ladder and Required Stopping Points**
> **Explanation:** The solid chain is the ladder; the dotted edges are the required stopping point
> for each security classification, not a target to exceed. The red node states the current
> position honestly: every Oship domain sits at `B0`, including all nineteen `S1` domains. The gap
> between `B0` and `B4` for nineteen domains is the single largest structural debt this document
> records, and it is why `DOMAIN-VIS-006` Governance Automation is on the critical path for
> everything else.

### 02.4.2 The Five Boundary Crossings

> **`VIS-134`.** Knowledge crosses a domain boundary in exactly five ways, and each has a different
> cost, a different failure mode, and a different legality rule. Naming them separately prevents
> the common error of treating "domain A uses domain B" as a single undifferentiated relationship.

### TBL-VIS-182: Boundary Crossing Kinds

| Kind | Name | What crosses | Coupling created | Legality default |
| :--- | :--- | :--- | :--- | :--- |
| `X1` | Call | A synchronous request and its response | Temporal and structural — caller waits, caller knows shape | Permitted only along a legal dependency edge |
| `X2` | Event | A fact that already happened | Structural only — publisher does not wait or know subscribers | Permitted in any direction, including upward |
| `X3` | Contract | A schema, type, or interface definition | Structural — both sides know the shape | Permitted only from a lower-priority to a higher-priority domain |
| `X4` | Shared store | Rows or documents both domains read or write | Total — schema changes couple deployments | **Prohibited** without an explicit `DEC-` record |
| `X5` | Shared code | A library both domains import | Structural, and viral through transitivity | Permitted only for `C4` Knowledge and `C7` Infrastructure domains |

> **`VIS-135`.** `X4` shared store is the crossing that destroys domain architecture most reliably
> and most quietly. Two domains writing the same table are one domain wearing two names; the
> boundary between them exists only in the directory listing. It is therefore prohibited by
> default rather than discouraged, and the prohibition is `CON-VIS-032`.

> **`VIS-136`.** `X2` event is the only crossing permitted to travel **upward** against the
> dependency direction of `TBL-VIS-155`. A `C2` product domain may not call a `C1` strategic
> domain, but it may emit a fact that a `C1` process observes. This is how reality informs strategy
> without strategy becoming dependent on reality's current shape.

### TBL-VIS-183: Crossing Legality Matrix

| From ↓ To → | `C1` | `C2` | `C3` | `C4` | `C5` | `C6` | `C7` | `C8` | `C9` | `C10` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `C1` Strategic | — | `X2` | `X2` | `X3` | ✗ | ✗ | ✗ | `X3` | `X2` | ✗ |
| `C2` Core Product | `X2` | `X1` `X2` `X3` | `X1` | `X3` | `X1` `X3` | `X2` | `X1` | `X1` | `X2` | `X1` |
| `C3` AI | `X2` | `X1` | `X1` `X2` | `X3` | `X1` | ✗ | `X1` | `X1` | `X2` | `X1` |
| `C4` Knowledge | `X3` | `X3` | `X3` | `X3` `X5` | `X3` | `X3` | `X3` | `X3` | `X3` | `X3` |
| `C5` Data | `X2` | `X2` | `X2` | `X3` | `X1` `X3` | ✗ | `X1` | `X1` | `X2` | ✗ |
| `C6` Experience | `X2` | `X1` | `X1` | `X3` | ✗ | `X1` `X5` | ✗ | `X1` | `X2` | `X1` |
| `C7` Infrastructure | `X2` | ✗ | ✗ | `X3` | ✗ | ✗ | `X1` `X5` | `X1` | `X2` | ✗ |
| `C8` Security | `X2` | `X2` | `X2` | `X3` | `X2` | `X2` | `X2` | `X1` | `X2` | `X2` |
| `C9` Operational | `X2` | ✗ | ✗ | `X3` | ✗ | ✗ | ✗ | `X2` | `X1` | ✗ |
| `C10` Integration | `X2` | `X2` | `X2` | `X3` | ✗ | ✗ | `X1` | `X1` | `X2` | `X1` |

> **`VIS-137`.** Read `TBL-VIS-183` as: a domain in the row category may reach a domain in the
> column category **only** through the listed crossing kinds. `✗` means no crossing of any kind;
> the two categories must not know of each other. `X4` appears nowhere in the matrix — that is
> deliberate and is the visual form of `CON-VIS-032`.

> **`VIS-138`.** `C8` Security is the only category permitted to reach every other category, and it
> reaches all of them by `X2` event — it observes, it does not call. A security domain that calls
> into a product domain has made itself a dependency of the thing it is supposed to judge, and a
> judge that the defendant must run is not a judge. `FAL-VIS-136` records this anti-pattern.

### 02.4.3 Boundary Contracts

> **`VIS-139`.** Where a crossing is legal, it must still be **specified**. The specification is a
> boundary contract, and it has seven parts. A crossing without a contract is an undocumented
> coupling, which is indistinguishable from an accident that has not yet been noticed.

### TBL-VIS-184: Boundary Contract Required Parts

| Part | Question it answers | Failure if omitted |
| :--- | :--- | :--- |
| **Shape** | What data structure crosses? | Callers guess; guesses diverge |
| **Direction** | Who initiates? | Circular initiation deadlock |
| **Guarantee** | At-most-once, at-least-once, or exactly-once? | Duplicate financial effects |
| **Failure semantics** | What does the caller see when the callee is down? | Cascading failure |
| **Versioning** | How does the shape change without breaking callers? | Coordinated deploys forever |
| **Authority** | Who may invoke this, under what identity? | Privilege escalation across the boundary |
| **Observability** | How does an operator see this crossing happening? | Silent failure |

> **`VIS-140`.** The **Guarantee** part is the one most often skipped and most expensive to add
> late. `DOMAIN-VIS-022` Settlement is defined by exactly-once semantics; if the crossing from
> `DOMAIN-VIS-020` to `DOMAIN-VIS-022` is specified as at-least-once without an idempotency key in
> the contract, the system will double-settle under retry, and the defect will appear only under
> the load conditions that make it most costly. `VAL-VIS-256` requires an explicit guarantee on
> every crossing into an `S1` domain.

```mermaid
sequenceDiagram
    autonumber
    participant P as "DOMAIN-VIS-020 Financial Factory"
    participant C as "Boundary contract X1"
    participant S as "DOMAIN-VIS-022 Settlement"
    participant L as "DOMAIN-VIS-021 Ledger"

    P->>C: "Submit settlement intent with idempotency key"
    Note over C: "Guarantee exactly-once and authority tenant-scoped"
    C->>S: "Deliver intent"
    S->>L: "Read prior state for this key"
    alt "Key already settled"
        L-->>S: "Prior result exists"
        S-->>C: "Return prior result unchanged"
    else "Key unseen"
        S->>L: "Append settlement entry"
        L-->>S: "Committed"
        S-->>C: "Return new result"
    end
    C-->>P: "Result"
    S->>S: "Emit settled event X2 for observers"
```

> **Diagram ID:** `DGM-VIS-062` — **Exactly-Once Boundary Contract, Settlement Path**
> **Explanation:** The contract, not the caller and not the callee, owns the exactly-once
> guarantee. The idempotency key is part of the shape; the alternative branch is the failure
> semantics; the trailing event is the observability part discharged as an `X2` crossing rather
> than a callback. This path is `PLANNED` in its entirety — no code implements it — but the shape
> is fixed here so that the implementation cannot invent a weaker one.

### 02.4.4 Boundary Violations

### TBL-VIS-185: Boundary Violation Catalogue

| ID | Violation | How it appears | Detection | Severity |
| :--- | :--- | :--- | :--- | :--- |
| `BV-01` | Import across an `✗` cell | A file in one category imports another | `B3` lint on import paths | Blocking |
| `BV-02` | Shared table between domains | Two domains' migrations touch one table | Schema ownership map | Blocking |
| `BV-03` | Synchronous call where `X2` is required | Product domain calls strategy | `B3` lint on call graph | Blocking |
| `BV-04` | Contract defined by the consumer | Consumer owns the type the producer emits | Contract registry ownership | Blocking |
| `BV-05` | Boundary crossed with the caller's identity | No re-authorization at the boundary | Authorization test | Blocking |
| `BV-06` | Retry without idempotency into an `S1` domain | Duplicate effects under load | Contract review | Blocking |
| `BV-07` | Utility library that accreted domain logic | A `C4` library that knows about ledgers | Dependency review | Advisory |
| `BV-08` | Boundary bypassed "temporarily" | A direct call with a comment promising to fix it | Code search for the comment | Advisory |

> **`VIS-141`.** `BV-08` deserves its own entry because it is the mechanism by which every other
> violation enters a codebase. No one adds a shared table on purpose; someone adds it once, under
> deadline, with a comment. The comment is the artifact that survives; the fix is not. Oship's
> response is `PRN-VIS-020` — finish before starting — applied at the boundary level: a crossing is
> either contracted or it does not exist.

---

## 02.5 — Domain Responsibility Model

### AI NAVIGATION METADATA — §02.5

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read when deciding which domain owns a behaviour** |
| **AI DEPENDENCIES** | §02.3 registry, §02.4 boundaries |
| **AI INPUTS** | A behaviour, rule, or piece of state needing an owner |
| **AI OUTPUTS** | Exactly one owning domain, and the reason |
| **AI IMPLEMENTATION IMPACT** | Prevents duplicated logic and orphaned state |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-267`…`VAL-VIS-282` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` component register `CMP-ARCH-001`…`030` |

### 02.5.1 The Single-Owner Rule

> **`VIS-142`.** Every behaviour, every rule, and every piece of durable state has **exactly one**
> owning domain. Not a primary owner with helpers; not a shared responsibility; one owner. Shared
> ownership means that when the behaviour is wrong, two teams each have a defensible reason why
> fixing it is the other's job, and the behaviour stays wrong.

> **`VIS-143`.** The single-owner rule applies to the *decision*, not to the *use*. Many domains
> may read whether a user is authorized; exactly one — `DOMAIN-VIS-045` Authorization Policy —
> decides it. Confusing use with ownership produces the most common architectural failure in
> permission systems: authorization logic re-implemented, slightly differently, in eleven places.

### TBL-VIS-186: Responsibility Kinds and Their Ownership Test

| Kind | Definition | Ownership test | Example |
| :--- | :--- | :--- | :--- |
| `R1` Decision | Choosing between outcomes | Which domain is blamed if the choice is wrong? | Authorization verdict → `DOMAIN-VIS-045` |
| `R2` State | Durable data whose truth must be maintained | Which domain's invariant breaks if it is corrupt? | Balance → `DOMAIN-VIS-021` |
| `R3` Rule | An invariant that must always hold | Which domain's purpose sentence contains it? | Double-entry balance → `DOMAIN-VIS-021` |
| `R4` Process | A sequence carried across time | Which domain resumes it after a crash? | Multi-step payment → `DOMAIN-VIS-024` |
| `R5` Contract | The shape of something crossing a boundary | Which domain produces the thing? | Settlement result → `DOMAIN-VIS-022` |
| `R6` Interpretation | Turning raw signal into meaning | Which domain is cited when the meaning is disputed? | Anomaly verdict → `DOMAIN-VIS-041` |

### TBL-VIS-187: Responsibility Assignment for Contested Behaviours

| Contested behaviour | Plausible owners | **Assigned owner** | Reason |
| :--- | :--- | :--- | :--- |
| Deciding whether a request is authorized | `018`, `045`, `019` | **`DOMAIN-VIS-045`** | `018` establishes identity; `045` decides permission; separating them lets identity change without re-deciding policy |
| Knowing which tenant a request belongs to | `018`, `019` | **`DOMAIN-VIS-019`** | Tenancy is scope, not identity; a single identity may act in several tenants |
| Recording that money moved | `020`, `021`, `022` | **`DOMAIN-VIS-021`** | The ledger's purpose sentence *is* the immutable record; the factory computes, the ledger remembers |
| Preventing double settlement | `022`, `024` | **`DOMAIN-VIS-022`** | Exactly-once is settlement's defining guarantee (`VIS-140`) |
| Deciding when to retry a failed step | `024`, `038` | **`DOMAIN-VIS-024`** | Retry policy is process semantics, not platform mechanics |
| Redacting personal data from logs | `041`, `046` | **`DOMAIN-VIS-046`** | Privacy owns what may be known; observability owns making state visible, within that bound |
| Deciding an agent may not act | `016`, `045` | **`DOMAIN-VIS-016`** | Autonomy limits are categorical (`VIS-033`), not policy-configurable |
| Choosing which model serves a request | `012`, `011` | **`DOMAIN-VIS-012`** | Routing is a policy decision; the runtime executes whatever it is handed |
| Judging whether agent output is acceptable | `015`, `007` | **`DOMAIN-VIS-015`** | Verification checks artifacts against rules; evaluation judges generated output against intent |
| Defining a metric's meaning | `041`, `043` | **`DOMAIN-VIS-043`** | Reliability owns objectives; observability owns instrumentation |
| Storing a user's display preference | `033`, `017` | **`DOMAIN-VIS-033`** | Personalization owns presentation adaptation without forking behaviour |
| Versioning a public API shape | `048`, `034` | **`DOMAIN-VIS-034`** | Contracts own shape and evolution; the API surface exposes them |

```mermaid
flowchart LR
    Q["A behaviour needs an owner"] --> K{"Which responsibility kind?"}
    K -->|"R1 decision"| K1{"Who is blamed if wrong?"}
    K -->|"R2 state"| K2{"Whose invariant breaks if corrupt?"}
    K -->|"R3 rule"| K3{"Whose purpose sentence contains it?"}
    K -->|"R4 process"| K4{"Who resumes after a crash?"}
    K -->|"R5 contract"| K5{"Who produces the thing?"}
    K -->|"R6 interpretation"| K6{"Who is cited in a dispute?"}

    K1 --> ONE{"Exactly one domain answers?"}
    K2 --> ONE
    K3 --> ONE
    K4 --> ONE
    K5 --> ONE
    K6 --> ONE

    ONE -->|"Yes"| ASSIGN["Assign - record in TBL-VIS-187"]
    ONE -->|"None"| GAP["Responsibility gap - a domain is missing - go to DEC-VIS-032"]
    ONE -->|"More than one"| SPLIT["The behaviour is two behaviours - split it and re-run"]

    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef good fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class GAP,SPLIT bad
    class ASSIGN good
```

> **Diagram ID:** `DGM-VIS-063` — **`DEC-VIS-033` Responsibility Assignment Procedure**
> **Explanation:** The procedure never permits "both" as an answer. Two domains claiming one
> behaviour is diagnostic: the behaviour has been described too coarsely and is actually two
> behaviours with different blame surfaces. Splitting and re-running resolves it. Zero claimants is
> the opposite diagnosis — a domain is missing from the registry, and `DEC-VIS-032` must be run to
> create it rather than parking the behaviour in whichever domain is nearest.

> **`VIS-144`.** Decision `DEC-VIS-033` is binding on all future parts of this document and on
> `AOM-ARCH-001` PART 02 when it assigns components to domains. Its output is auditable: every
> assignment must be expressible as a row in `TBL-VIS-187` with a one-sentence reason.

### 02.5.2 The Responsibility Matrix

### TBL-VIS-188: Domain Responsibility Matrix — Selected Cross-Cutting Concerns

| Concern | Decides | Stores | Enforces | Observes | Reports |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Who a caller is | `018` | `018` | `018` | `041` | `047` |
| What a caller may do | `045` | `045` | `018` at edge, `045` at core | `041` | `047` |
| Which tenant applies | `019` | `019` | `019` | `041` | `047` |
| Whether money moved | `020` | `021` | `021` | `041` | `047` |
| Whether it moved once | `022` | `021` | `022` | `041` | `047` |
| Whether records agree | `023` | `021` | `023` | `041` | `047` |
| Whether a process completed | `024` | `024` | `024` | `041` | `042` |
| Whether data is well-formed | `034` | `035` | `034` | `037` | `037` |
| Whether data is true | `037` | `035` | `037` | `041` | `037` |
| Whether data may be retained | `046` | `036` | `036` | `047` | `047` |
| Whether an agent may act | `016` | `010` | `016` | `041` | `047` |
| Whether output is acceptable | `015` | `014` | `015` | `041` | `007` |
| Whether the system is healthy | `043` | `041` | `042` | `041` | `042` |
| Whether a change may ship | `007` | `005` | `006` | `039` | `047` |

> **`VIS-145`.** Reading `TBL-VIS-188` column-wise reveals the load concentration: `DOMAIN-VIS-041`
> Observability appears in the *Observes* column for eleven of fourteen concerns, and
> `DOMAIN-VIS-047` Audit appears in *Reports* for nine. Both are `PLANNED`. A system whose two most
> load-bearing cross-cutting domains do not exist can still be specified correctly — but it cannot
> be *operated*, and no downstream document may assume otherwise.

### TBL-VIS-189: Responsibility Anti-Patterns

| ID | Anti-pattern | Why it is attractive | What it costs |
| :--- | :--- | :--- | :--- |
| `RA-01` | Assigning a concern to "the platform" | Nobody objects | Nobody owns it either |
| `RA-02` | Splitting a decision across two domains for "flexibility" | Both teams keep autonomy | The decision becomes non-deterministic across paths |
| `RA-03` | Letting the caller decide what the callee should enforce | Fewer round trips | Every caller becomes a security boundary |
| `RA-04` | Owning state without owning the rule that constrains it | Feels like a clean data layer | The rule is enforced nowhere, or everywhere differently |
| `RA-05` | Reassigning ownership without moving the state | The diagram looks right | The old owner still writes the table |
| `RA-06` | Creating a domain to hold what no other domain wanted | Tidiness | A junk-drawer domain, prohibited by `DCR-03` |

---

## 02.6 — Domain Interaction Model

### AI NAVIGATION METADATA — §02.6

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before designing any inter-domain protocol** |
| **AI DEPENDENCIES** | §02.4 boundaries, §02.5 responsibility |
| **AI INPUTS** | A legal crossing and a business need |
| **AI OUTPUTS** | An interaction pattern with named guarantees |
| **AI IMPLEMENTATION IMPACT** | Determines transport, retry, ordering, and consistency choices |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-283`…`VAL-VIS-298` |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` §04.4 relationship patterns |

### 02.6.1 Interaction Patterns

> **`VIS-146`.** A legal crossing (`TBL-VIS-183`) says *whether* two domains may interact. An
> interaction pattern says *how*. Choosing the pattern is an architectural decision with permanent
> consequences for consistency, latency, and failure behaviour, and it must never be made
> implicitly by whichever library was already on the classpath.

### TBL-VIS-190: Interaction Pattern Catalogue

| ID | Pattern | Consistency | Failure mode | Use when | Never use when |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `IP-01` | Synchronous request/response | Strong, within one call | Caller blocks and may cascade | The caller cannot proceed without the answer | The callee may be slow or unavailable and the caller holds a lock |
| `IP-02` | Asynchronous command | None at submission | Command lost or duplicated | Work may complete later | The submitter needs the result to answer a user now |
| `IP-03` | Event notification | Eventual | Subscriber misses or reprocesses | Others may care about a fact | The publisher needs to know it was handled |
| `IP-04` | Event-carried state transfer | Eventual, with a local replica | Replica drifts | Read-heavy consumers must not call the owner | The data must be current to the millisecond |
| `IP-05` | Saga / process manager | Eventual, with compensation | Compensation itself fails | A multi-domain process must be atomic in effect | A true transaction is available and sufficient |
| `IP-06` | Query by contract | Strong read, no write | Stale if cached | A consumer needs the owner's current view | The consumer would call it in a loop |
| `IP-07` | Batch transfer | Point-in-time | Whole batch fails | Volume makes per-item crossing wasteful | Latency matters |
| `IP-08` | Shared read model | Eventual | Projection lags or corrupts | Many domains ask the same cross-domain question | Writes are needed |

> **`VIS-147`.** `IP-05` saga is required, not optional, for any process that changes state in more
> than one `S1` domain. `DOMAIN-VIS-020` → `021` → `022` is such a process; a distributed
> transaction across them is not available once they are separately deployed, so compensation must
> be designed *into* the contract rather than added after the first partial failure in production.

> **`VIS-148`.** `IP-04` event-carried state transfer is the pattern most likely to be adopted for
> the wrong reason — it removes a call from a latency graph and appears free. Its true cost is a
> second copy of somebody else's truth, which will diverge, and which someone must reconcile. It is
> permitted only where `DOMAIN-VIS-023` Reconciliation has an active check over the replica, which
> is stated as `CON-VIS-033`.

```mermaid
flowchart TB
    Q["Two domains must interact"] --> A{"Does the caller need the answer to proceed?"}
    A -->|"No"| B{"Does anyone need to know it was handled?"}
    B -->|"No"| IP03["IP-03 Event notification"]
    B -->|"Yes"| IP02["IP-02 Asynchronous command"]
    A -->|"Yes"| C{"Does it write state in more than one S1 domain?"}
    C -->|"Yes"| IP05["IP-05 Saga with compensation - mandatory"]
    C -->|"No"| D{"Is it a read?"}
    D -->|"Yes"| E{"Would the caller ask repeatedly at high volume?"}
    E -->|"Yes"| IP04["IP-04 State transfer plus reconciliation check"]
    E -->|"No"| IP06["IP-06 Query by contract"]
    D -->|"No"| F{"Is the callee slow or unreliable?"}
    F -->|"Yes"| IP02
    F -->|"No"| IP01["IP-01 Synchronous request response"]

    classDef mand fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef cond fill:#f57f17,stroke:#fff59d,color:#000000
    class IP05 mand
    class IP04 cond
```

> **Diagram ID:** `DGM-VIS-064` — **`DEC-VIS-034` Interaction Pattern Selection**
> **Explanation:** The first question is deliberately about the *caller's* need, not about the
> technology available, because the most common architectural mistake is choosing synchronous calls
> for work that nobody is waiting on. The red terminal is mandatory rather than advisory: any
> multi-`S1`-domain write is a saga, and a reviewer may not accept a simpler pattern with a promise
> to add compensation later.

### 02.6.2 Interaction Guarantees

### TBL-VIS-191: Delivery and Ordering Guarantees

| Guarantee | Meaning | Cost | Required for |
| :--- | :--- | :--- | :--- |
| At-most-once | May be lost, never duplicated | Cheapest | Non-critical notification only |
| At-least-once | Never lost, may be duplicated | Requires idempotent consumers | Default for all `X2` events |
| Exactly-once effect | Applied once regardless of delivery count | Requires an idempotency key and a dedup store | Every crossing into `S1` (`VIS-140`) |
| Ordered per key | Events for one entity arrive in order | Partitioning constraint | Ledger entries, state machines |
| Globally ordered | All events arrive in one order | Throughput ceiling | **Never required** — no Oship domain needs it |

> **`VIS-149`.** Global ordering is explicitly declared unnecessary. It is recorded here because
> teams reach for it when they mean per-key ordering, and it imposes a single-writer throughput
> ceiling that would cap the Money Factory permanently. This is `NG-VIS-025`.

### TBL-VIS-192: Consistency Model per Domain Pair Class

| Pair class | Model | Justification |
| :--- | :--- | :--- |
| Within one domain | Strong, transactional | A domain that cannot keep its own invariant is not a domain |
| `S1` to `S1`, same process boundary | Strong | Money invariants may not be eventually true |
| `S1` to `S1`, across process boundary | Saga with compensation | Distributed transactions unavailable; effect-atomicity required |
| `S1` to non-`S1` | Eventual | The non-`S1` side may lag without harm |
| Any to `C9` Operational | Eventual, lossy tolerated | Losing a metric is better than blocking a payment |
| Any to `C8` Security audit | At-least-once, durable, never lossy | An unrecorded action is an unauditable action |

> **`VIS-150`.** The last two rows are deliberately opposed. Telemetry may be dropped under
> pressure; audit may not. Systems that treat both as "logging" and apply one policy either waste
> capacity protecting metrics or lose the audit trail exactly when an incident makes it matter.
> `FAL-VIS-141` records the conflation.

### 02.6.3 Interaction Failure Model

```mermaid
stateDiagram-v2
    [*] --> Requested
    Requested --> Delivered: "transport succeeded"
    Requested --> Lost: "transport failed permanently"
    Requested --> Timeout: "no response in budget"
    Timeout --> Unknown: "caller cannot tell if it applied"
    Unknown --> Retried: "idempotency key present"
    Unknown --> Corrupted: "no idempotency key - retry may duplicate"
    Retried --> Delivered
    Delivered --> Applied: "callee committed"
    Delivered --> Rejected: "contract violation or authorization failure"
    Applied --> [*]
    Rejected --> [*]
    Lost --> Compensating: "saga detects missing step"
    Corrupted --> Reconciling: "DOMAIN-VIS-023 detects divergence"
    Compensating --> [*]
    Reconciling --> [*]
```

> **Diagram ID:** `DGM-VIS-065` — **Interaction Failure State Machine**
> **Explanation:** The pivotal state is `Unknown` — the caller timed out and genuinely cannot tell
> whether the work happened. Every distributed system reaches this state; the only question is
> which exit it takes. With an idempotency key the exit is `Retried` and harmless. Without one the
> exit is `Corrupted`, and recovery moves from the interaction layer to `DOMAIN-VIS-023`
> Reconciliation, which is `PLANNED`. This diagram is the argument for `VIS-140` in state form.

### TBL-VIS-193: Failure Response Requirements by Pattern

| Pattern | Timeout policy | Retry policy | Dead-letter | Compensation |
| :--- | :--- | :--- | :--- | :--- |
| `IP-01` Sync | Explicit budget, always set | Only if idempotent | n/a | Caller-side |
| `IP-02` Async command | n/a | Bounded with backoff | Required | Required if `S1` |
| `IP-03` Event | n/a | Consumer-side redelivery | Required | Not applicable |
| `IP-04` State transfer | n/a | Redelivery plus periodic full resync | Required | Reconciliation |
| `IP-05` Saga | Per-step budget | Per-step, bounded | Required | **Mandatory, per step** |
| `IP-06` Query | Explicit budget | Safe — read only | n/a | n/a |
| `IP-07` Batch | Whole-batch budget | Whole batch, from a checkpoint | Required | Batch-level |
| `IP-08` Read model | n/a | Rebuild projection | n/a | Rebuild |

> **`VIS-151`.** Every row in `TBL-VIS-193` that says "Required" describes infrastructure Oship
> does not have. There is no message transport, no dead-letter facility, and no saga coordinator;
> `EVD-VIS-019` records that the runtime stack itself is `UNKNOWN — REQUIRES REPOSITORY
> VERIFICATION`. The table is therefore a **selection constraint on that future choice**: any
> transport chosen for Oship must support dead-lettering and per-key ordering, or it disqualifies
> itself. This is recorded as `CON-VIS-034`.

---

## 02.7 — Domain Lifecycle Model

### AI NAVIGATION METADATA — §02.7

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before changing any domain's status** |
| **AI DEPENDENCIES** | §02.3 registry, PART 01 §01.14 evolution model |
| **AI INPUTS** | A domain and a proposed status change |
| **AI OUTPUTS** | Whether the transition is legal and what evidence it requires |
| **AI IMPLEMENTATION IMPACT** | Gates when implementation may begin and when a domain may be retired |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-299`…`VAL-VIS-312` |
| **AI RELATED DOCUMENTS** | `.ai/PROJECT_STATUS.md`, `AOM-ARCH-001` §04.9 |

### 02.7.1 The Eight Evolution Levels

> **`VIS-152`.** A domain's evolution level `E0`…`E7` is distinct from its documentation status.
> Status answers "what does the repository contain"; evolution level answers "how far along its
> life is this domain". A domain may be `DOCUMENTED` at `E2` and remain there for years without
> that being a defect — but it may not be `IMPLEMENTED` at `E1`, and `VAL-VIS-301` rejects that
> combination.

### TBL-VIS-194: Domain Evolution Levels

| Level | Name | Entry condition | Exit condition | Reversible |
| :--- | :--- | :--- | :--- | :--- |
| `E0` | Identified | Someone named a responsibility gap | A purpose sentence passes `DCR-01` | Yes — delete freely |
| `E1` | Researched | Open questions written down | Every open question has an answer or an accepted `UNKNOWN` | Yes |
| `E2` | Specified | A registry record exists with all 14 fields | Boundary contracts drafted for every legal crossing | Yes, with a `DEC-` record |
| `E3` | Designed | Contracts and internal model fixed | Implementation begins | Yes, with a `DEC-` record |
| `E4` | Implemented | Code or documents exist and are used | Verification covers the domain's stated rules | Costly |
| `E5` | Verified | `VAL-` rules for it execute automatically and pass | Operating in production with observers | Costly |
| `E6` | Operated | Running, observed, with owners on call | Superseded or no longer needed | Very costly |
| `E7` | Retired | Replacement live, traffic drained | — terminal | No |

```mermaid
stateDiagram-v2
    [*] --> E0: "responsibility gap named"
    E0 --> E1: "questions written"
    E1 --> E2: "registry record complete"
    E2 --> E3: "contracts fixed"
    E3 --> E4: "built"
    E4 --> E5: "checks execute and pass"
    E5 --> E6: "observed in production"
    E6 --> E7: "superseded and drained"
    E7 --> [*]

    E1 --> E0: "cheap reversal"
    E2 --> E1: "DEC record required"
    E3 --> E2: "DEC record required"
    E4 --> E3: "costly - DEC plus migration"
    E2 --> E7: "abandoned before build"
    E6 --> E4: "regression - verification lost"

    note right of E5
        "No Oship domain has ever
        reached E5. Highest is E4,
        held by five documentation
        domains."
    end note
```

> **Diagram ID:** `DGM-VIS-066` — **Domain Evolution State Machine with Legal Reversals**
> **Explanation:** Backward transitions exist and are legal, which is a deliberate expression of
> `PRN-VIS-013` reversibility. What varies is the *price*: reversing `E1` → `E0` costs nothing,
> `E2` → `E1` costs a decision record, `E4` → `E3` costs a migration. The `E6` → `E4` edge is the
> regression path — a domain that loses its automated verification has genuinely moved backwards
> even though its code is unchanged, and pretending otherwise is how systems rot while their
> dashboards stay green.

### TBL-VIS-195: Current Evolution Level Distribution

| Level | Count | Domains |
| :--- | ---: | :--- |
| `E0` Identified | 1 | `029` |
| `E1` Researched | 10 | `008`, `026`, `028`, `031`, `033`, `037`, `043`, `046`, `049`, `050` |
| `E2` Specified | 28 | `003`, `006`, `007`, `011`, `012`, `015`, `017`, `018`, `019`, `020`, `021`, `022`, `023`, `024`, `025`, `027`, `030`, `032`, `034`, `035`, `036`, `038`, `039`, `040`, `041`, `042`, `044`, `045`, `048` |
| `E3` Designed | 4 | `013`, `014`, `016`, `047` |
| `E4` Implemented | 5 | `001`, `002`, `004`, `005`, `009`, `010` |
| `E5` Verified | **0** | — |
| `E6` Operated | **0** | — |
| `E7` Retired | 0 | — |

> **`VIS-153`.** The distribution is the honest shape of Oship: a system whose entire mass sits at
> `E2`, with a small implemented core that is entirely documentation, and **nothing at all** past
> `E4`. No domain has automated verification; no domain runs in production. Any statement anywhere
> in this repository that implies otherwise is contradicted by this table, and `VAL-VIS-305`
> instructs agents to treat this table as authoritative over prose.

> **`VIS-154`.** The `E4` → `E5` transition is the most valuable single move available to Oship
> today, because it is the transition that converts written rules into executed rules. Five domains
> sit at `E4`; moving even one to `E5` requires `DOMAIN-VIS-006` Governance Automation to leave
> `E2`, which is why that domain, unglamorous as it is, gates the credibility of everything else.

### 02.7.2 Transition Gates

### TBL-VIS-196: Evidence Required per Transition

| Transition | Required evidence | Approver | Blocking check |
| :--- | :--- | :--- | :--- |
| `E0` → `E1` | Written question list | Domain owner | `VAL-VIS-299` |
| `E1` → `E2` | Complete 14-field registry record | Architecture Board | `VAL-VIS-300` |
| `E2` → `E3` | Boundary contract per legal crossing; category assigned; security class set | Architecture Board plus Security if `S1` | `VAL-VIS-302` |
| `E3` → `E4` | Working artifact referenced by path | Domain owner | `VAL-VIS-303` |
| `E4` → `E5` | Automated checks exist, execute in CI, and pass | QA plus Architecture Board | `VAL-VIS-304` |
| `E5` → `E6` | Named on-call owner, observability in place, runbook exists | SRE | `VAL-VIS-306` |
| `E6` → `E7` | Replacement at `E6`, traffic drained, data migrated or destroyed per `DOMAIN-VIS-036` | Architecture Board plus Security | `VAL-VIS-307` |
| Any backward | `DEC-` record naming the cost and the reason | Architecture Board | `VAL-VIS-308` |

> **`VIS-155`.** No transition may be granted on the basis of intent. `E3` → `E4` requires a
> **path**, not a plan; `E4` → `E5` requires a **passing run**, not a written rule. This is the
> domain-level application of `DEC-VIS-028` — where specification and artifact disagree about
> whether something exists, the artifact decides existence and the specification decides
> correctness.

### 02.7.3 Domain Retirement

> **`VIS-156`.** A domain is retired, never deleted. Its registry record persists with status
> `DEPRECATED` and evolution level `E7`, carrying a forward pointer to whatever replaced it.
> Deleting the record breaks every historical decision that cited it and makes the audit trail
> lie by omission.

### TBL-VIS-197: Retirement Requirements

| Requirement | Reason |
| :--- | :--- |
| Registry record retained with `E7` and `DEPRECATED` | Historical citations must resolve (`DCR-05`) |
| Forward pointer to the replacement domain | A reader arriving from an old document must be routed |
| Data disposition recorded — migrated, archived, or destroyed | `DOMAIN-VIS-036` owns the outcome; silence is not an option |
| Identifier never reused | `DCR-05`, absolute |
| Dependent domains re-pointed before drain | A dependency on a retired domain is a broken build waiting to happen |
| `DEC-` record capturing why | Retirement is a consequential decision |

---

## 02.8 — Domain to Capability Mapping

### AI NAVIGATION METADATA — §02.8

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this is the join between PART 01 capabilities and PART 02 domains** |
| **AI DEPENDENCIES** | PART 01 §01.7 `CAP-VIS-001`…`070`, §02.3 registry |
| **AI INPUTS** | A `CAP-VIS-` identifier or a `DOMAIN-VIS-` identifier |
| **AI OUTPUTS** | The counterpart identifiers, and the implementation status of the pair |
| **AI IMPLEMENTATION IMPACT** | Determines which domain must be built to deliver a promised capability |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-313`…`VAL-VIS-320` |
| **AI RELATED DOCUMENTS** | PART 01 §01.8 capability hierarchy, §01.18 requirements derivation |

### 02.8.1 The Mapping Rule

> **`VIS-157`.** Every capability is **delivered by exactly one domain** and may be **used by many**.
> The delivering domain is the one whose failure makes the capability unavailable. A capability with
> two delivering domains has been described at the wrong granularity and must be split, by the same
> logic as `DEC-VIS-033`.

> **`VIS-158`.** Every domain delivers at least one capability. A domain that delivers none is
> either a layer wearing a domain's name (`DCR-03`) or a domain whose capabilities have not yet been
> written — and `VAL-VIS-313` requires the second case to be labelled `UNKNOWN` rather than left
> silent.

### TBL-VIS-198: Capability Group to Domain Mapping

| `CAP-VIS-` range | Group | Delivering domains | Implemented in group |
| :--- | :--- | :--- | ---: |
| `001`…`012` | Knowledge and AI control plane | `002`, `010`, `013`, `014` | 4 of 12 |
| `013`…`024` | Governance | `005`, `006`, `007`, `009`, `047` | 4 of 12 |
| `025`…`040` | Platform runtime | `017`, `024`, `027`, `035`, `038`, `040`, `048` | 0 of 16 |
| `041`…`048` | Financial factory | `020`, `021`, `022`, `023`, `028` | 0 of 8 |
| `049`…`056` | AI runtime | `011`, `012`, `015`, `016` | 0 of 8, 3 partial |
| `057`…`070` | Bounded-context capabilities | `001`, `003`, `004`, `018`, `019`, `030`, `041`, `044` | 1 of 14, 1 partial |
| **Total** | — | **All 50 domains appear at least once** | **6 of 70 (`VIS-041`)** |

### TBL-VIS-199: Detailed Capability to Domain Binding — Control Plane and Governance

| Capability | Delivering domain | Users of the capability | Pair status |
| :--- | :--- | :--- | :--- |
| `CAP-VIS-001` | `DOMAIN-VIS-002` | all | Capability `PLANNED`, domain `E4` |
| `CAP-VIS-002` | `DOMAIN-VIS-002` | `001`, `004` | `PLANNED` |
| `CAP-VIS-003` | `DOMAIN-VIS-013` | `010`, `011` | `PLANNED` |
| `CAP-VIS-004` | `DOMAIN-VIS-010` | all agents | **`IMPLEMENTED`** — `.ai/` control plane |
| `CAP-VIS-005` | `DOMAIN-VIS-013` | `010` | `PLANNED` |
| `CAP-VIS-006` | `DOMAIN-VIS-010` | all agents | **`IMPLEMENTED`** |
| `CAP-VIS-007` | `DOMAIN-VIS-014` | `011`, `013` | `PLANNED` |
| `CAP-VIS-008` | `DOMAIN-VIS-002` | all | **`IMPLEMENTED`** — 24 domain indexes |
| `CAP-VIS-009` | `DOMAIN-VIS-014` | `011` | `PLANNED` — `UNMAPPED` in PART 01 (`VIS-067`), now bound here |
| `CAP-VIS-010` | `DOMAIN-VIS-013` | `010` | `PLANNED` |
| `CAP-VIS-011` | `DOMAIN-VIS-010` | all agents | **`IMPLEMENTED`** |
| `CAP-VIS-012` | `DOMAIN-VIS-014` | `011`, `015` | `PLANNED` |
| `CAP-VIS-013` | `DOMAIN-VIS-005` | all | **`IMPLEMENTED`** — ADR process |
| `CAP-VIS-014` | `DOMAIN-VIS-009` | all | **`IMPLEMENTED`** — metadata standard |
| `CAP-VIS-015` | `DOMAIN-VIS-005` | `004`, `001` | **`IMPLEMENTED`** — `DECISION_LOG.md` |
| `CAP-VIS-016` | `DOMAIN-VIS-009` | all | **`IMPLEMENTED`** — identifier conventions |
| `CAP-VIS-017`…`020` | `DOMAIN-VIS-006` | all | `PLANNED` — skeletons uninstalled |
| `CAP-VIS-021`…`023` | `DOMAIN-VIS-007` | all | `PLANNED` — no test infrastructure |
| `CAP-VIS-024` | `DOMAIN-VIS-047` | auditors | `DOCUMENTED` — git history serves partially |

> **`VIS-159`.** `CAP-VIS-009` was recorded `UNMAPPED` in PART 01 (`VIS-067`) because no
> architecture domain claimed it. PART 02 resolves it against a **vision** domain,
> `DOMAIN-VIS-014` AI Memory, without touching `AOM-ARCH-001`. The architecture gap remains open
> and is carried forward in `TBL-VIS-178` as an obligation on `AOM-ARCH-001` PART 02. Resolving a
> capability to a vision domain is not the same as resolving it to an architecture domain, and
> `VAL-VIS-317` requires both.

### TBL-VIS-200: Detailed Capability to Domain Binding — Runtime, Factory, AI, Context

| Capability | Delivering domain | Depends on domains | Pair status |
| :--- | :--- | :--- | :--- |
| `CAP-VIS-025`…`030` | `DOMAIN-VIS-017` | `018`, `019`, `035` | `PLANNED`, non-callable (`VIS-039`) |
| `CAP-VIS-031`…`034` | `DOMAIN-VIS-024` | `017`, `027` | `PLANNED` |
| `CAP-VIS-035`…`037` | `DOMAIN-VIS-048` | `034`, `018` | `PLANNED` |
| `CAP-VIS-038`…`040` | `DOMAIN-VIS-038`, `040` | `039` | `PLANNED` |
| `CAP-VIS-041`…`044` | `DOMAIN-VIS-020` | `018`, `019`, `021` | `PLANNED` |
| `CAP-VIS-045`, `046` | `DOMAIN-VIS-021` | `035` | `PLANNED` |
| `CAP-VIS-047` | `DOMAIN-VIS-022` | `021`, `023` | `UNKNOWN` in PART 01; domain assigned, status remains `UNKNOWN` |
| `CAP-VIS-048` | `DOMAIN-VIS-023` | `021` | `PLANNED` |
| `CAP-VIS-049`, `050` | `DOMAIN-VIS-011` | `010`, `016` | `050` `PARTIAL`; both `UNMAPPED` in PART 01, now bound |
| `CAP-VIS-051`, `052` | `DOMAIN-VIS-012` | `011` | `PLANNED`, `UNMAPPED` in PART 01, now bound |
| `CAP-VIS-053`, `054` | `DOMAIN-VIS-015` | `007`, `014` | `054` `PARTIAL`, now bound |
| `CAP-VIS-055`, `056` | `DOMAIN-VIS-016` | `010`, `045` | `056` `PARTIAL` — enforced socially only |
| `CAP-VIS-057`…`060` | `DOMAIN-VIS-001`, `003`, `004` | `002` | `060` **`IMPLEMENTED`** as documentation |
| `CAP-VIS-061`…`063` | `DOMAIN-VIS-018`, `019` | `045` | `PLANNED` |
| `CAP-VIS-064`, `065` | `DOMAIN-VIS-030` | `031`, `032` | `PLANNED` |
| `CAP-VIS-066`…`068` | `DOMAIN-VIS-041` | `043` | `066` `PARTIAL` |
| `CAP-VIS-069`, `070` | `DOMAIN-VIS-044` | `045`, `046` | `PLANNED` |

> **`VIS-160`.** PART 01 recorded eight capabilities as `UNMAPPED`: `CAP-VIS-009` and
> `CAP-VIS-049`…`056` (`VIS-067`). PART 02 binds all eight to vision domains. `PRN-VIS-015`
> — the remaining unmapped item from `VIS-067` — is a principle, not a capability, and is bound to
> `DOMAIN-VIS-049` External Providers in §02.10 as a constraint rather than a delivery obligation.

```mermaid
flowchart LR
    subgraph IMPL["6 implemented capabilities"]
        C4["CAP-VIS-004"]
        C6["CAP-VIS-006"]
        C8["CAP-VIS-008"]
        C11["CAP-VIS-011"]
        C13["CAP-VIS-013 to 016"]
        C60["CAP-VIS-060"]
    end
    subgraph DOM["Delivered by 5 domains"]
        D10["DOMAIN-VIS-010 AI Control Plane"]
        D02["DOMAIN-VIS-002 Knowledge Graph"]
        D05["DOMAIN-VIS-005 Decision Authority"]
        D09["DOMAIN-VIS-009 Standards"]
        D04["DOMAIN-VIS-004 Architecture Authority"]
    end
    subgraph REST["64 capabilities not implemented"]
        R1["45 domains deliver them"]
    end

    C4 --> D10
    C6 --> D10
    C11 --> D10
    C8 --> D02
    C13 --> D05
    C13 --> D09
    C60 --> D04
    REST -.-> R1

    classDef good fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef bad fill:#37474f,stroke:#b0bec5,color:#ffffff
    class C4,C6,C8,C11,C13,C60,D10,D02,D05,D09,D04 good
    class REST,R1 bad
```

> **Diagram ID:** `DGM-VIS-067` — **Implemented Capability Concentration**
> **Explanation:** All six implemented capabilities are delivered by five domains, and all five are
> documentation or governance domains. Not one implemented capability belongs to the Money Factory,
> the platform runtime, or the AI runtime. This is the visual restatement of `VIS-041`: Oship's
> demonstrated ability is currently the ability to describe itself rigorously, which is a real
> capability and an insufficient one.

### TBL-VIS-201: Capability Delivery Risk by Domain

| Domain | Capabilities delivered | Domains it depends on | Risk if delayed |
| :--- | ---: | ---: | :--- |
| `DOMAIN-VIS-018` Identity | 3 | 1 | **Critical** — blocks `019`, `020`, `021`, `022`, all edge capabilities |
| `DOMAIN-VIS-021` Ledger | 2 | 1 | **Critical** — blocks `022`, `023`, `026`, `028` |
| `DOMAIN-VIS-006` Governance Automation | 4 | 2 | **Critical** — blocks every `E4` → `E5` transition |
| `DOMAIN-VIS-041` Observability | 3 | 1 | **High** — blocks 13 of 15 success measures |
| `DOMAIN-VIS-017` Product Core | 6 | 3 | High — largest single capability count |
| `DOMAIN-VIS-035` Persistence | 0 direct | 1 | High — every stateful domain waits on it |
| `DOMAIN-VIS-016` AI Safety | 2 | 2 | High — `VIS-033` autonomy prohibition is unenforced without it |
| `DOMAIN-VIS-029` Marketplace | 0 | 2 | None — `E0`, no commitment |

---

## 02.9 — Domain Data Ownership Model

### AI NAVIGATION METADATA — §02.9

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before designing any schema** |
| **AI DEPENDENCIES** | §02.5 responsibility, §02.4 crossing kind `X4` |
| **AI INPUTS** | A data entity needing a home |
| **AI OUTPUTS** | Its owning domain, its replication rules, its retention class |
| **AI IMPLEMENTATION IMPACT** | Fixes schema ownership, migration authority, and deletion authority |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-267`…`VAL-VIS-282` shared with §02.5 |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` `CMP-ARCH-024` persistence, `CMP-ARCH-030` contract registry |

### 02.9.1 Ownership Axioms

> **`VIS-161`.** **One writer.** Exactly one domain may write any given entity. Others read through
> a contract or a replica. This is `X4`'s prohibition (`VIS-135`) stated positively.

> **`VIS-162`.** **The owner owns the schema.** Migration authority follows write authority. A
> consumer that needs a column requests it from the owner; it does not add one.

> **`VIS-163`.** **The owner owns deletion.** Only the owning domain may destroy an entity, and only
> in coordination with `DOMAIN-VIS-036` Data Lifecycle, which holds retention authority. A consumer
> holding a replica must delete on the owner's signal — which makes deletion propagation part of the
> boundary contract, not an afterthought.

> **`VIS-164`.** **Replicas are declared.** Every replica of another domain's entity is registered
> with its source, its freshness expectation, and the reconciliation check that detects drift.
> An undeclared replica is a `BV-02` violation regardless of how it is stored.

### TBL-VIS-202: Data Ownership Register — Principal Entities

| Entity class | Owning domain | Replicated to | Retention class | Security |
| :--- | :--- | :--- | :--- | :--- |
| Principal identity | `018` | `019` id only | Lifetime of the account plus statutory | `S1` |
| Credential material | `018` | never | Rotated; never archived | `S1` |
| Tenant record | `019` | `017`, `020` id only | Lifetime of the contract plus statutory | `S1` |
| Authorization policy | `045` | cached at edge with TTL | Versioned indefinitely | `S1` |
| Financial instruction | `020` | `024` process state | Statutory | `S1` |
| Ledger entry | `021` | `026` read model | **Immutable, never deleted** | `S1` |
| Settlement result | `022` | `020`, `023` | Statutory | `S1` |
| Reconciliation finding | `023` | `042` | Until resolved plus audit window | `S2` |
| Process instance state | `024` | none | Until terminal plus retention window | `S2` |
| Notification record | `027` | `047` | Short — delivery proof only | `S3` |
| Contract definition | `034` | all consumers by design | Versioned indefinitely | `S2` |
| Telemetry series | `041` | none | Windowed, lossy permitted | `S2` |
| Audit event | `047` | none | **Never deleted, never lossy** (`VIS-150`) | `S1` |
| Agent session record | `010` | `014` | Bounded by session policy | `S2` |
| Learned memory | `014` | `013` | Curated; supersession not deletion | `S2` |
| Personal data of a subject | `046` governs, owner varies | per contract | Bound by subject rights | `S1` |

> **`VIS-165`.** Two entity classes are declared **never deleted**: ledger entries and audit events.
> Two are declared **lossy-tolerated**: telemetry and, within its policy window, agent session
> records. These are opposite guarantees and must not share a storage strategy. Any design that
> puts audit events in the telemetry pipeline for convenience violates `VIS-150` and is
> `FAL-VIS-141`.

> **`VIS-166`.** `DOMAIN-VIS-046` Privacy is registered as a **governing** domain over personal data
> rather than an owning one. It does not hold the rows; it holds the rules about which rows may
> exist, for how long, and who may see them. This is the only split of governance from ownership
> permitted in the model, and it exists because personal data appears inside entities owned by many
> domains. `VAL-VIS-276` requires every entity marked as containing personal data to cite
> `DOMAIN-VIS-046` in its contract.

```mermaid
flowchart TB
    subgraph OWN["Write authority - exactly one per entity"]
        O18["018 identity and credentials"]
        O19["019 tenant records"]
        O21["021 ledger entries - immutable"]
        O47["047 audit events - immutable"]
        O34["034 contract definitions"]
    end
    subgraph GOV["Governing authority - rules not rows"]
        G46["046 privacy - what may be known"]
        G36["036 lifecycle - how long it lives"]
    end
    subgraph REP["Declared replicas only"]
        R26["026 analytics read model from 021"]
        R45["045 policy cache at edge"]
        R23["023 reconciliation view"]
    end

    O21 --> R26
    O21 --> R23
    O34 --> R45
    G46 -.->|"constrains"| O18
    G46 -.->|"constrains"| O19
    G36 -.->|"constrains"| O21
    G36 -.->|"constrains"| O47
    R26 -->|"drift check required"| O21

    classDef imm fill:#0d47a1,stroke:#90caf9,color:#ffffff
    classDef gov fill:#4a148c,stroke:#ce93d8,color:#ffffff
    class O21,O47 imm
    class G46,G36 gov
```

> **Diagram ID:** `DGM-VIS-068` — **Data Ownership, Governance, and Declared Replication**
> **Explanation:** Three distinct relationships appear: solid ownership edges to replicas, dotted
> constraint edges from governing domains, and the return edge from the analytics read model to the
> ledger carrying a mandatory drift check. Blue nodes are immutable stores where the only legal
> write is an append. Purple nodes hold no data at all — their authority is over the rules, which is
> why `DOMAIN-VIS-036` can constrain an immutable store without being able to delete from it.

### TBL-VIS-203: Retention Classes

| Class | Rule | Applies to | Deletion authority |
| :--- | :--- | :--- | :--- |
| `RT-1` Immutable | Append-only; never deleted, never edited | Ledger, audit | None — deletion is impossible by design |
| `RT-2` Statutory | Retained for a period fixed by regulation | Financial instructions, settlements | `036` on expiry, with an audit record |
| `RT-3` Contractual | Retained while a relationship exists plus a tail | Tenant records, identities | `036` on relationship end |
| `RT-4` Operational | Retained while useful, windowed | Telemetry, process state | `036` by policy, no per-record decision |
| `RT-5` Subject-bound | Retained only while the data subject permits | Personal data | `046` decides, owner executes |
| `RT-6` Ephemeral | Not retained beyond the operation | Credential material in transit, prompts | Immediate |

> **`VIS-167`.** The applicable statutory regime for `RT-2` is
> `UNKNOWN — REQUIRES REPOSITORY VERIFICATION`. `PROB-VIS-023` records that no jurisdiction,
> regulator, or compliance framework has been selected for Oship. `RT-2` therefore has a defined
> *shape* and an undefined *duration*, and no implementation of `DOMAIN-VIS-036` can be completed
> until that is answered. This is the single largest open question in the data model and it is
> carried as an obligation in §02.13.

### TBL-VIS-204: Prohibited Data Patterns

| ID | Pattern | Why prohibited | Detection |
| :--- | :--- | :--- | :--- |
| `DP-01` | Two domains writing one table | Destroys the boundary (`VIS-135`) | Schema ownership map |
| `DP-02` | Undeclared replica | Drifts silently, no reconciliation | Dependency and storage audit |
| `DP-03` | Consumer-added column on an owner's table | Migration authority violated (`VIS-162`) | Migration review |
| `DP-04` | Personal data in telemetry | Lossy store carrying `RT-5` data | Field-level classification scan |
| `DP-05` | Audit events in a windowed store | Violates never-lossy (`VIS-150`) | Storage policy review |
| `DP-06` | Mutable ledger entry | Violates `RT-1`; makes history negotiable | Schema review — no `UPDATE` grant |
| `DP-07` | Credential material at rest outside `018` | Widens the blast radius of any breach | Secret scanning |
| `DP-08` | Cross-tenant query without a tenant predicate | Silent tenant leakage | Query-level enforcement in `019` |

> **`VIS-168`.** `DP-08` is the highest-consequence data defect available to a multi-tenant
> financial system, because it produces no error, no alert, and no operational symptom — only a
> correct-looking answer containing another customer's money. Its prevention cannot be a code review
> convention; it must be structural, enforced by `DOMAIN-VIS-019` at the point where queries are
> constructed. This is `CON-VIS-035`.

---

## 02.10 — Domain Constraints

### AI NAVIGATION METADATA — §02.10

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — constraints are binding, not advisory** |
| **AI DEPENDENCIES** | PART 01 §01.19 `CON-VIS-001`…`030` |
| **AI INPUTS** | Any proposed domain design |
| **AI OUTPUTS** | Whether the design is admissible |
| **AI IMPLEMENTATION IMPACT** | A design violating any constraint must be rejected, not negotiated |
| **AI VALIDATION REQUIREMENTS** | Each constraint has a paired `VAL-VIS-` rule |
| **AI RELATED DOCUMENTS** | `AOM-ARCH-001` invariants `INV-ARCH-001`…`060` |

### 02.10.1 Domain-Level Constraints

> **`VIS-169`.** PART 01 established thirty system constraints, `CON-VIS-001`…`030`. PART 02 adds
> fifteen that arise specifically from the domain model. They continue the same numbering and carry
> the same force: a constraint is not a preference, and a design that violates one is rejected
> rather than justified.

### TBL-VIS-205: Domain Constraint Register — `CON-VIS-031`…`045`

| ID | Constraint | Source | Verification | Violation severity |
| :--- | :--- | :--- | :--- | :--- |
| `CON-VIS-031` | Every `S1` domain has an approved threat model before its first line of implementation | `TBL-VIS-160`, `VIS-128` | Gate at `E2` → `E3` | Blocking |
| `CON-VIS-032` | No two domains write the same persistent entity (`X4` prohibited) | `VIS-135`, `VIS-161` | Schema ownership map | Blocking |
| `CON-VIS-033` | Every event-carried replica has an active reconciliation check | `VIS-148`, `VIS-164` | Replica register review | Blocking |
| `CON-VIS-034` | Any transport chosen for Oship must support dead-lettering and per-key ordering | `VIS-151` | Technology selection ADR | Blocking |
| `CON-VIS-035` | Tenant scoping is enforced structurally at query construction, never by convention | `VIS-168` | Query-path review plus test | Blocking |
| `CON-VIS-036` | No domain depends on a domain at a lower evolution level than `E2` | `TBL-VIS-194` | Dependency scan | Blocking |
| `CON-VIS-037` | Every crossing into an `S1` domain declares an explicit delivery guarantee | `VIS-140` | Contract review | Blocking |
| `CON-VIS-038` | A domain's security classification may only increase, never decrease, without a `DEC-` record | `TBL-VIS-160` | Registry diff | Blocking |
| `CON-VIS-039` | Domain identifiers are never reused, including after retirement | `DCR-05`, `VIS-156` | Registry uniqueness check | Blocking |
| `CON-VIS-040` | No domain may be created without an accountable owning role | `DCR-08` | Registry field check | Blocking |
| `CON-VIS-041` | Vendor-specific concepts never appear in a domain's purpose, name, or contract | `PRN-VIS-015` | Naming and contract review | Blocking |
| `CON-VIS-042` | No capability is delivered by more than one domain | `VIS-157` | Mapping uniqueness check | Blocking |
| `CON-VIS-043` | A `C1` strategic domain never depends on a `C2` product domain | `TBL-VIS-155` | Dependency legality matrix | Blocking |
| `CON-VIS-044` | Personal data never enters a lossy or windowed store | `DP-04` | Field classification scan | Blocking |
| `CON-VIS-045` | Autonomy level A4 is unreachable by configuration in any domain | `VIS-033` | Code and config review | Blocking |

> **`VIS-170`.** All fifteen constraints are **blocking**, and none of the fifteen is currently
> verifiable by an executing check. Every entry in the Verification column describes a review or a
> scan that no installed workflow performs (`EVD-VIS-017`). The constraints are therefore real as
> specification and unenforced as practice — which is exactly the condition `DOMAIN-VIS-006`
> exists to end.

> **`VIS-171`.** `CON-VIS-041` is the constraint that binds `PRN-VIS-015` vendor neutrality, the
> item PART 01 left `UNMAPPED` (`VIS-067`). It attaches to `DOMAIN-VIS-049` External Providers as a
> naming and contract obligation rather than to any delivered capability: neutrality is something a
> design is, not something a feature does.

### TBL-VIS-206: Constraint Interaction — Where Constraints Pull Against Each Other

| Constraint A | Constraint B | Tension | Resolution |
| :--- | :--- | :--- | :--- |
| `CON-VIS-032` one writer | Performance pressure for local joins | Cross-domain joins become network calls | `IP-04` with `CON-VIS-033` reconciliation, never a shared table |
| `CON-VIS-035` structural tenant scoping | `CON-VIS-041` vendor neutrality | Structural enforcement is easiest with vendor row-level security | Enforce in Oship's own query layer, not the database vendor's feature |
| `CON-VIS-037` explicit guarantees | `IP-03` fire-and-forget simplicity | Every `S1` crossing needs machinery | Route non-critical facts around `S1` domains rather than weakening them |
| `CON-VIS-044` no personal data in lossy stores | Observability's need for context | Debugging is harder without identifiers | Use opaque correlation identifiers owned by `041`, resolvable only via `018` |
| `CON-VIS-036` no dependency below `E2` | Desire to prototype quickly | Prototypes depend on unspecified things | Prototypes live in `DOMAIN-VIS-008` Experimentation, which is exempt by `BND-VIS-014` |
| `CON-VIS-045` A4 unreachable | Pressure for autonomous remediation | Incidents would resolve faster | Human accountability (`VIS-032`) is not tradeable against latency |

> **`VIS-172`.** Constraint tension is normal and is recorded rather than resolved by softening.
> Every row in `TBL-VIS-206` has a resolution that preserves **both** constraints. Where no such
> resolution exists, the correct action is a `DEC-` record that removes one constraint explicitly —
> never a quiet exception in one subsystem.

```mermaid
flowchart LR
    subgraph HARD["Non-negotiable - failure is irrecoverable"]
        C31["CON-VIS-031 threat model first"]
        C32["CON-VIS-032 one writer"]
        C35["CON-VIS-035 structural tenant scope"]
        C39["CON-VIS-039 no ID reuse"]
        C45["CON-VIS-045 A4 unreachable"]
    end
    subgraph STRUCT["Structural - failure is expensive"]
        C33["CON-VIS-033 replica reconciliation"]
        C36["CON-VIS-036 no dependency below E2"]
        C37["CON-VIS-037 explicit guarantees"]
        C42["CON-VIS-042 one delivering domain"]
        C43["CON-VIS-043 no upward dependency"]
    end
    subgraph SELECT["Selection - failure forecloses options"]
        C34["CON-VIS-034 transport capability"]
        C38["CON-VIS-038 classification ratchet"]
        C40["CON-VIS-040 named owner"]
        C41["CON-VIS-041 vendor neutrality"]
        C44["CON-VIS-044 no personal data in lossy stores"]
    end

    HARD --> ENF["Enforcement required at B4 or B5"]
    STRUCT --> ENF2["Enforcement required at B3"]
    SELECT --> ENF3["Enforcement at B2 review"]
    ENF --> NONE["Currently enforced by - nothing"]
    ENF2 --> NONE
    ENF3 --> NONE

    classDef bad fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    class NONE bad
```

> **Diagram ID:** `DGM-VIS-069` — **Constraint Classes and Their Common Enforcement Gap**
> **Explanation:** Constraints divide by consequence into three classes requiring three different
> enforcement strengths from `TBL-VIS-180`. All three paths converge on the same red terminal. The
> diagram is not decorative pessimism — it is the argument for sequencing `DOMAIN-VIS-006` ahead of
> feature work, because fifteen blocking constraints enforced by nothing will be violated, and the
> violations will be discovered after they are expensive to reverse.

---

## 02.11 — AI Domain Interpretation Model

### AI NAVIGATION METADATA — §02.11

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — this section tells an agent how to use PART 02** |
| **AI DEPENDENCIES** | All of §02.1–§02.10, PART 01 §01.23 boot sequence |
| **AI INPUTS** | A task, a file path, or a question about placement |
| **AI OUTPUTS** | The domain context an agent must load before acting |
| **AI IMPLEMENTATION IMPACT** | Determines what an agent reads, and what it must refuse |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-283`…`VAL-VIS-298` shared with §02.6 |
| **AI RELATED DOCUMENTS** | `.ai/CONTEXT_ROUTER.md`, `.ai/AI_AGENT_OPERATING_MANUAL.md` |

### 02.11.1 Domain Resolution for Agents

> **`VIS-173`.** Before an agent writes anything, it resolves the **domain** of the work. Domain
> resolution precedes file creation, precedes design, and precedes asking what the code should do —
> because the domain determines which rules bind, which owner approves, and which security class
> applies. An agent that starts by choosing a filename has already skipped the only step that
> constrains it.

### TBL-VIS-207: `AI-VIS-061` Domain Resolution Procedure

| Step | Action | Input | If it fails |
| ---: | :--- | :--- | :--- |
| 1 | Read the task and extract the responsibility, not the artifact | Task text | Ask for the responsibility |
| 2 | Classify the responsibility kind `R1`…`R6` | `TBL-VIS-186` | HALT — ambiguous work |
| 3 | Find the owning domain via `TBL-VIS-187` and `TBL-VIS-188` | Registry | Go to step 4 |
| 4 | If no owner exists, run `DEC-VIS-032` to determine whether a domain is missing | `TBL-VIS-148` | HALT — do not park the work |
| 5 | Load the domain record from §02.3 | `DOMAIN-VIS-nnn` | HALT — unregistered domain |
| 6 | Read the domain's security classification and evolution level | Record | — |
| 7 | If `S1`, verify a threat model exists (`CON-VIS-031`) | Repository | **HALT** — refuse to implement |
| 8 | If evolution level is below `E3`, refuse implementation; produce specification instead | Record | Produce a `DEC-` proposal |
| 9 | Enumerate legal crossings from `TBL-VIS-183` for this domain's category | Matrix | — |
| 10 | Load only the crossed domains' contracts, not their internals | Contracts | — |
| 11 | Check all fifteen `CON-VIS-031`…`045` against the plan | `TBL-VIS-205` | HALT on any violation |
| 12 | Act, and record the domain ID in the change description | — | — |

> **`VIS-174`.** Steps 7, 8, and 11 are **HALT gates**. An agent reaching them without satisfaction
> stops and reports; it does not proceed with a caveat, a `TODO`, or a best-effort attempt. This
> extends the three HALT gates of the PART 01 boot sequence (`AI-VIS-045`) to three more at the
> domain level, giving six total. `VAL-VIS-288` verifies that an agent's change record names the
> domain it resolved.

```mermaid
flowchart TB
    T["Task arrives"] --> R1["Extract the responsibility"]
    R1 --> R2["Classify R1 to R6"]
    R2 --> R3{"Owning domain found?"}
    R3 -->|"No"| DEC["Run DEC-VIS-032 - is a domain missing?"]
    DEC -->|"Yes - propose new domain"| HALT1["HALT - registry change needs approval"]
    DEC -->|"No - it belongs to an existing domain"| R4
    R3 -->|"Yes"| R4["Load domain record"]
    R4 --> S{"Security class S1?"}
    S -->|"Yes"| TM{"Threat model exists?"}
    TM -->|"No"| HALT2["HALT - CON-VIS-031 blocks implementation"]
    TM -->|"Yes"| E
    S -->|"No"| E{"Evolution level at least E3?"}
    E -->|"No"| SPEC["Produce specification only - do not implement"]
    E -->|"Yes"| X["Load legal crossings and contracts"]
    X --> C{"All 15 CON-VIS constraints satisfied?"}
    C -->|"No"| HALT3["HALT - report the violated constraint"]
    C -->|"Yes"| ACT["Act - name the domain in the change record"]

    classDef halt fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef ok fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class HALT1,HALT2,HALT3 halt
    class ACT ok
```

> **Diagram ID:** `DGM-VIS-070` — **`AI-VIS-061` Agent Domain Resolution with HALT Gates**
> **Explanation:** Three of five outcomes are refusals and one is a downgrade to specification-only
> work. That ratio is intentional for a system at `E2`: with no domain past `E4`, the statistically
> correct agent behaviour on an implementation request is to produce a specification, not code. An
> agent that reaches `ACT` in today's repository is almost certainly working on documentation, and
> that is the honest state of the system rather than a limitation of the procedure.

### TBL-VIS-208: `AI-VIS-062`…`AI-VIS-070` Agent Domain Rules

| ID | Rule | Failure it prevents |
| :--- | :--- | :--- |
| `AI-VIS-062` | Never place a file by directory resemblance; place it by resolved domain | Junk-drawer accumulation |
| `AI-VIS-063` | Never read a domain's internals to satisfy a crossing; read its contract | Hidden coupling |
| `AI-VIS-064` | Never infer a domain's status from prose; read `TBL-VIS-195` | Believing planned work is built |
| `AI-VIS-065` | Never create a `DOMAIN-VIS-` identifier without registry approval | Identifier collision, orphan domains |
| `AI-VIS-066` | Never widen a crossing from `X2` to `X1` for convenience | Turning eventual coupling into temporal coupling |
| `AI-VIS-067` | Never assign one behaviour to two domains | `RA-02` non-deterministic decisions |
| `AI-VIS-068` | Never write to an entity owned by another domain | `CON-VIS-032` violation |
| `AI-VIS-069` | When a domain's status is `UNKNOWN`, report it; never resolve it by assumption | Fabrication |
| `AI-VIS-070` | Cite the domain ID in every commit message touching domain-bound work | Untraceable change |

### 02.11.2 Context Loading by Domain

### TBL-VIS-209: `AI-VIS-071` Minimum Context Set per Task Class

| Task class | Must load | Must not load | Rationale |
| :--- | :--- | :--- | :--- |
| Place a new file | §02.2 taxonomy, §02.3 record | Other domains' contracts | Placement needs category, not behaviour |
| Design a crossing | §02.4, §02.6, both domain records, both contracts | Either domain's internals | Contracts are the interface |
| Assign a responsibility | §02.5, `TBL-VIS-187` | Implementation code | Ownership is a specification question |
| Change a status | §02.7, `TBL-VIS-196` | Everything else | Transitions are evidence-gated |
| Add a capability | §02.8, PART 01 §01.7 | Unrelated domains | One delivering domain only |
| Design a schema | §02.9, owner's record, `TBL-VIS-203` | Consumer code | Owner decides shape |
| Review a design | §02.10 all fifteen constraints | — | Constraints are checked in full, always |

> **`VIS-175`.** `TBL-VIS-209` has a **Must not load** column because context discipline is a
> correctness mechanism, not an efficiency one. An agent that reads another domain's internals will
> use what it read, and the coupling it creates will be invisible in review because the reviewer
> sees only the diff, not the reading. Restricting what is loaded restricts what can be coupled.

---

## 02.12 — Domain Image Specifications

### AI NAVIGATION METADATA — §02.12

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | P2 — read when producing visual assets |
| **AI DEPENDENCIES** | §02.2 taxonomy, §02.3 registry, §02.4 boundaries |
| **AI INPUTS** | A specification identifier `IMG-VIS-nnn` |
| **AI OUTPUTS** | An image conforming to the specification |
| **AI IMPLEMENTATION IMPACT** | None on runtime; governs documentation and presentation assets |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-313`…`VAL-VIS-320` shared with §02.8 |
| **AI RELATED DOCUMENTS** | PART 01 §01.4 image specifications `IMG-VIS-001`…`022` |

> **`VIS-176`.** These are **specifications**, not assets. No binary image file is created by this
> document. Each specification is complete enough that two different illustrators, or an
> illustrator and a generation model, would produce semantically equivalent images.

### TBL-VIS-210: `IMG-VIS-023` — Domain Taxonomy Wheel

| Field | Value |
| :--- | :--- |
| **ID** | `IMG-VIS-023` |
| **Title** | The Ten Domain Categories |
| **Purpose** | Let a newcomer grasp the whole domain space in one glance before reading any table |
| **Audience** | New engineers, new agents, architecture reviewers |
| **Aspect Ratio** | 1:1 |
| **Canvas** | 2048 × 2048, dark background `#0d1117` |
| **Visual Hierarchy** | Layer 1 centre hub; layer 2 ten category segments; layer 3 domain-count badges |
| **Elements** | Central hub labelled "Oship — 50 domains"; ten radial segments `C1`…`C10`; each segment carries its name and count |
| **Relationships** | Segment width proportional to domain count — `C2` widest at 13, `C1` at 5 |
| **Labels** | Category code, category name, count; no domain names at this zoom |
| **Colour Semantics** | `C1` deep indigo, `C2` teal, `C3` violet, `C4` slate, `C5` amber, `C6` rose, `C7` steel, `C8` crimson, `C9` olive, `C10` cyan |
| **Typography** | Single geometric sans; hub 64 pt, category 36 pt, counts 28 pt |
| **Legend** | Bottom-left: colour to category key |
| **Meaning** | The domain space is finite, bounded, and unequally populated |
| **AI Interpretation** | Segment size is population, never importance; do not infer priority from area |
| **Implementation Relevance** | Orientation asset for `docs/MASTER_CONTEXT/01_PRODUCT/` |
| **Generation prompt** | "Flat vector radial segmented wheel on a very dark near-black background, ten unequal segments in distinct saturated colours radiating from a labelled central hub, thin light outlines, clean geometric sans-serif labels, no photorealism, no people, no logos, no gradients beyond flat fills, technical diagram aesthetic, square composition" |

### TBL-VIS-211: `IMG-VIS-024` — Boundary Strength Ladder

| Field | Value |
| :--- | :--- |
| **ID** | `IMG-VIS-024` |
| **Title** | From Aspiration to Enforcement |
| **Purpose** | Make the `B0`…`B5` scale memorable and make Oship's position on it unmistakable |
| **Audience** | Engineering leadership, reviewers |
| **Aspect Ratio** | 3:4 |
| **Canvas** | 1536 × 2048, dark background `#0d1117` |
| **Visual Hierarchy** | Layer 1 six ascending steps; layer 2 the enforcer icon per step; layer 3 a marker showing current position |
| **Elements** | Six rising blocks `B0`…`B5`; a small glyph per step for enforcer type; a bright marker resting on `B0` labelled "all 50 domains today" |
| **Relationships** | Height encodes strength; the marker's distance from `B4` encodes the debt |
| **Labels** | Step code, name, enforcer, "detected when" |
| **Colour Semantics** | `B0`–`B1` grey, `B2` amber, `B3` yellow-green, `B4`–`B5` green; marker crimson |
| **Typography** | Geometric sans; step titles 40 pt, detail 24 pt |
| **Legend** | Right margin: required stopping point per security class |
| **Meaning** | Enforcement is a ladder with mandatory heights, and Oship stands at the bottom |
| **AI Interpretation** | The marker position is factual as of this document; verify before reuse |
| **Implementation Relevance** | Argument asset for prioritising `DOMAIN-VIS-006` |
| **Generation prompt** | "Flat vector side-view staircase of six ascending rectangular blocks on a very dark background, blocks coloured grey through green in ascending order, a single crimson circular marker resting on the lowest block, thin geometric sans-serif labels beside each step, minimal line icons, no photorealism, no people, no logos, portrait composition, technical infographic style" |

### TBL-VIS-212: `IMG-VIS-025` — Domain Dependency Constellation

| Field | Value |
| :--- | :--- |
| **ID** | `IMG-VIS-025` |
| **Title** | Fifty Domains and Their Legal Edges |
| **Purpose** | Show the whole dependency graph at once so that clusters and single points of failure are visible |
| **Audience** | Architects, planners |
| **Aspect Ratio** | 16:9 |
| **Canvas** | 3840 × 2160, dark background `#0d1117` |
| **Visual Hierarchy** | Layer 1 fifty nodes in force-directed layout; layer 2 dependency edges; layer 3 halos on `S1` nodes |
| **Elements** | One node per `DOMAIN-VIS-`; node fill by category colour from `IMG-VIS-023`; node size by capability count; crimson halo on the nineteen `S1` domains |
| **Relationships** | Directed edges follow `TBL-VIS-155`; edge opacity by crossing kind |
| **Labels** | Domain ID on every node; name on nodes with three or more edges |
| **Colour Semantics** | Category fill; crimson halo `S1`; edge grey; critical-path edges brightened |
| **Typography** | Condensed sans; IDs 18 pt, names 22 pt |
| **Legend** | Lower-left: category colours, halo meaning, edge kinds |
| **Meaning** | Dependency load concentrates on identity, ledger, and governance automation |
| **AI Interpretation** | Node size is capability count, not importance or effort |
| **Implementation Relevance** | Planning asset for implementation sequencing |
| **Generation prompt** | "Flat vector force-directed network graph on a very dark near-black background, approximately fifty circular nodes of varying size in ten distinct saturated colours, a subset ringed with thin crimson halos, thin grey directed edges with small arrowheads, small condensed sans-serif labels, no photorealism, no people, no logos, wide cinematic composition, clean technical data-visualisation aesthetic" |

> **`VIS-177`.** Three image specifications are defined in PART 02 against the fifteen reserved by
> the PART 01 plan (`IMG-VIS-023`…`037`). The remaining twelve are allocated across §02.13–§02.18
> as those sections define subjects worth illustrating. Reserving a number without a subject would
> be exactly the artificial padding `PRN-VIS-001` prohibits, so unallocated numbers stay unused
> until a real subject claims them.

---

## 02.13 — Open Obligations and Forward Commitments

### AI NAVIGATION METADATA — §02.13

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — read before claiming any part of PART 02 is complete** |
| **AI DEPENDENCIES** | §02.3 registry, §02.8 mapping, §02.9 data model |
| **AI INPUTS** | A claim that something is resolved |
| **AI OUTPUTS** | Whether the obligation is discharged, and by what evidence |
| **AI IMPLEMENTATION IMPACT** | Names the work PART 02 could not do and must not pretend to have done |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-246`, `VAL-VIS-305`, `VAL-VIS-309`…`312` |
| **AI RELATED DOCUMENTS** | `.ai/NEXT_ACTION.md`, `AOM-ARCH-001` PART 02 when authored |

> **`VIS-178`.** An obligation is a piece of work this document has identified, scoped, and
> deliberately not performed — either because it belongs to another document, another authority, or
> another phase. Recording obligations explicitly is the difference between an incomplete
> specification and a dishonest one.

### TBL-VIS-213: Open Obligation Register — `OBL-01`…`OBL-18`

| ID | Obligation | Owed by | Blocked on | Discharge evidence |
| :--- | :--- | :--- | :--- | :--- |
| `OBL-01` | Create or absorb architecture domains for the 15 `UNMAPPED` vision domains | `AOM-ARCH-001` PART 02 | Nothing | `TBL-VIS-178` row count reaches zero |
| `OBL-02` | Select the statutory regime governing `RT-2` retention | Business Strategy plus Legal | Jurisdiction decision | A `DEC-` record naming the regime |
| `OBL-03` | Select the runtime stack — language, transport, persistence | Architecture Board | `OBL-02` for data residency | An ADR under `docs/ADR/` |
| `OBL-04` | Install the eight CI workflow skeletons into `.github/workflows/` | DevOps | Nothing | Files present and a passing run |
| `OBL-05` | Automate at least one `VAL-VIS-` rule end to end | QA plus DevOps | `OBL-04` | A CI run that fails on a seeded violation |
| `OBL-06` | Produce threat models for all 19 `S1` domains | Security Architect | `OBL-03` in part | 19 documents referenced from the registry |
| `OBL-07` | Resolve the single-owner `CODEOWNERS` conflict with author ≠ approver | Repository owner | Organisational | A second owning role in `CODEOWNERS` |
| `OBL-08` | Define service objectives for `DOMAIN-VIS-043` | SRE | `OBL-03` | Named SLOs with measurement sources |
| `OBL-09` | Define contracts for every legal crossing into an `S1` domain | Architecture Board | `OBL-03` | Contract documents per `TBL-VIS-184` |
| `OBL-10` | Establish the schema ownership map enforcing `CON-VIS-032` | Database Architect | `OBL-03` | A machine-readable ownership file |
| `OBL-11` | Register the replica set enforcing `CON-VIS-033` | Database Architect | `OBL-10` | A replica register with drift checks |
| `OBL-12` | Implement structural tenant scoping for `CON-VIS-035` | Backend plus Security | `OBL-03` | A query layer that cannot omit the predicate |
| `OBL-13` | Decide whether `DOMAIN-VIS-029` Marketplace survives `E0` | Product Management | Business strategy | A `DEC-` record advancing or retiring it |
| `OBL-14` | Bind `CAP-VIS-047` status, currently `UNKNOWN` | Product plus Architecture | Repository verification | A status other than `UNKNOWN` with evidence |
| `OBL-15` | Populate the twelve unallocated `IMG-VIS-026`…`037` specifications | This document, later parts | Subject matter | Specifications with real subjects |
| `OBL-16` | Author PART 03 onwards of `AOM-VIS-001` | Product Management | Nothing | Appended parts |
| `OBL-17` | Update `04_ARCHITECTURE/INDEX.md`, which still lists `SYSTEM_ARCHITECTURE.md` as `PLANNED` | Architecture | Nothing | Index status corrected |
| `OBL-18` | Establish a mechanism that enforces `CON-VIS-045` technically rather than socially | Security Architect | `OBL-03` | A refusal path that cannot be configured away |

> **`VIS-179`.** Six obligations — `OBL-03`, `06`, `08`, `09`, `10`, `12`, `18` — are blocked on a
> single unresolved decision: the runtime stack. `EVD-VIS-019` records it as
> `UNKNOWN — REQUIRES REPOSITORY VERIFICATION`, and it is the highest-leverage open decision in the
> repository. `OBL-03` is therefore not merely one obligation among eighteen; it is the gate on
> seven of them.

```mermaid
flowchart LR
    O02["OBL-02 statutory regime"] --> O03["OBL-03 runtime stack - GATE"]
    O03 --> O06["OBL-06 threat models"]
    O03 --> O08["OBL-08 service objectives"]
    O03 --> O09["OBL-09 S1 contracts"]
    O03 --> O10["OBL-10 schema ownership"]
    O10 --> O11["OBL-11 replica register"]
    O03 --> O12["OBL-12 tenant scoping"]
    O03 --> O18["OBL-18 autonomy enforcement"]
    O04["OBL-04 install CI"] --> O05["OBL-05 automate one rule"]
    O01["OBL-01 architecture gap"] -.-> IND1["independent"]
    O07["OBL-07 CODEOWNERS"] -.-> IND1
    O13["OBL-13 marketplace"] -.-> IND1
    O16["OBL-16 later parts"] -.-> IND1
    O17["OBL-17 index status"] -.-> IND1

    classDef gate fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef free fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class O03 gate
    class O01,O04,O07,O13,O16,O17 free
```

> **Diagram ID:** `DGM-VIS-071` — **Obligation Dependency Graph**
> **Explanation:** Green obligations are unblocked and can be discharged immediately; the red node
> gates seven others. `OBL-04` and `OBL-05` deserve attention precisely because they are green:
> installing CI and automating a single validation rule requires no stack decision, and it would
> move Oship's enforcement posture off `B0` for the first time.

### TBL-VIS-214: What PART 02 Deliberately Did Not Do

| Not done | Why not | Where it belongs |
| :--- | :--- | :--- |
| Modify `AOM-ARCH-001` | `VIS-065` — vision is read-only toward architecture | `AOM-ARCH-001` PART 02 |
| Create directories for the 50 domains | Directories are `B0` boundaries and imply implementation | After `OBL-03` |
| Assign implementation dates | `VIS-051` — no dates anywhere in this document | `19_ROADMAP` |
| Choose technologies per domain | `PRN-VIS-015` vendor neutrality at the vision layer | `OBL-03` ADR |
| Write per-domain detailed contracts | Contracts need the transport model from `OBL-03` | `OBL-09` |
| Estimate effort or team size | Not a vision concern; would be fabrication | Planning documents |
| Declare any domain `E5` | No automated verification exists anywhere | After `OBL-05` |

---

## 02.14 — Domain Validation Rules

### AI NAVIGATION METADATA — §02.14

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P0 — every rule here is checkable and binding** |
| **AI DEPENDENCIES** | All of PART 02 |
| **AI INPUTS** | Any artifact claiming conformance to the domain model |
| **AI OUTPUTS** | Pass, fail, or `UNKNOWN` per rule, with evidence |
| **AI IMPLEMENTATION IMPACT** | These rules become the content of `DOMAIN-VIS-006` automation |
| **AI VALIDATION REQUIREMENTS** | Self-referential — `VAL-VIS-320` validates this section |
| **AI RELATED DOCUMENTS** | PART 01 §01.24 `VAL-VIS-001`…`200` |

> **`VIS-180`.** Rules `VAL-VIS-201`…`320` continue the PART 01 catalogue without renumbering.
> Severity is `BLOCKING` or `ADVISORY`; a blocking failure stops the change, an advisory failure is
> recorded and reviewed. **None of these rules is currently automated** (`EVD-VIS-017`); the
> Automatable column states whether a rule *could* be executed mechanically once `DOMAIN-VIS-006`
> exists, which is the specification `OBL-05` will implement against.

### TBL-VIS-215: Validation Rules `VAL-VIS-201`…`226` — Classification and Taxonomy

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-201` | Every domain has a purpose sentence containing no coordinating "and" between two purposes | BLOCKING | Yes |
| `VAL-VIS-202` | Every domain satisfies all five necessary conditions of `TBL-VIS-145` | BLOCKING | Partly |
| `VAL-VIS-203` | No domain name matches a team name in `CODEOWNERS` | BLOCKING | Yes |
| `VAL-VIS-204` | No domain name matches a technology, vendor, or product name | BLOCKING | Partly |
| `VAL-VIS-205` | No domain name is a layer name from `LYR-ARCH-001`…`010` | BLOCKING | Yes |
| `VAL-VIS-206` | No domain is named "common", "shared", "core utilities", "misc", or "platform services" | BLOCKING | Yes |
| `VAL-VIS-207` | Every domain passes the six-question disambiguation test of `TBL-VIS-148` | BLOCKING | No |
| `VAL-VIS-208` | Every prohibited domain form in `TBL-VIS-150` is absent from the registry | BLOCKING | Partly |
| `VAL-VIS-209` | Every domain is assigned exactly one category `C1`…`C10` | BLOCKING | Yes |
| `VAL-VIS-210` | No domain appears in two categories | BLOCKING | Yes |
| `VAL-VIS-211` | Every category has at least one domain | ADVISORY | Yes |
| `VAL-VIS-212` | Category assignment follows `TBL-VIS-153` in order, first match wins | BLOCKING | No |
| `VAL-VIS-213` | Every domain has an AI loading priority `L0`…`L4` | BLOCKING | Yes |
| `VAL-VIS-214` | No `L0` domain depends on an `L3` or `L4` domain | BLOCKING | Yes |
| `VAL-VIS-215` | Loading priority is consistent with category per `TBL-VIS-154` | ADVISORY | Yes |
| `VAL-VIS-216` | Every `DCR-01`…`DCR-10` rule is satisfied by every registry row | BLOCKING | Partly |
| `VAL-VIS-217` | No two domains share a purpose sentence | BLOCKING | Yes |
| `VAL-VIS-218` | No domain purpose is a restatement of its name | BLOCKING | No |
| `VAL-VIS-219` | Every dependency edge is legal per `TBL-VIS-155` | BLOCKING | Yes |
| `VAL-VIS-220` | The dependency graph contains no cycle | BLOCKING | Yes |
| `VAL-VIS-221` | No `C1` domain has an outgoing dependency to `C2`…`C10` except `X2` and `X3` | BLOCKING | Yes |
| `VAL-VIS-222` | Every `C7` infrastructure domain is depended upon by at least one other domain | ADVISORY | Yes |
| `VAL-VIS-223` | No domain depends on more than seven other domains | ADVISORY | Yes |
| `VAL-VIS-224` | Every system domain maps to at least one knowledge domain | BLOCKING | Yes |
| `VAL-VIS-225` | Every one of the 24 knowledge domains maps to at least one system domain | BLOCKING | Yes |
| `VAL-VIS-226` | Knowledge domain names are never used as system domain names | BLOCKING | Yes |

### TBL-VIS-216: Validation Rules `VAL-VIS-227`…`248` — Registry Integrity

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-227` | Every `DOMAIN-VIS-` identifier in `001`…`050` is defined exactly once | BLOCKING | Yes |
| `VAL-VIS-228` | Every registry record contains all fourteen schema fields | BLOCKING | Yes |
| `VAL-VIS-229` | No record claims `IMPLEMENTED` without a cited evidence path | BLOCKING | Yes |
| `VAL-VIS-230` | Every absent value uses the literal `UNKNOWN — REQUIRES REPOSITORY VERIFICATION` | BLOCKING | Yes |
| `VAL-VIS-231` | No downstream document cites `TBL-VIS-171` as evidence that product domains exist | BLOCKING | Partly |
| `VAL-VIS-232` | Every record has an owning role, never a person's name | BLOCKING | Yes |
| `VAL-VIS-233` | Every owning role appears in at least one `INDEX.md` owner field or `CODEOWNERS` | ADVISORY | Yes |
| `VAL-VIS-234` | Every record has a security classification `S1`…`S4` | BLOCKING | Yes |
| `VAL-VIS-235` | Every `S1` record cites a threat model path or `UNKNOWN` | BLOCKING | Yes |
| `VAL-VIS-236` | Every record has an evolution level `E0`…`E7` | BLOCKING | Yes |
| `VAL-VIS-237` | Evolution level and documentation status are mutually consistent per `TBL-VIS-194` | BLOCKING | Yes |
| `VAL-VIS-238` | No record has `Implementation Status` other than `NO CODE` while `apps/` and `services/` are `.gitkeep`-only | BLOCKING | Yes |
| `VAL-VIS-239` | Inputs and outputs are named artifacts or `none`, never prose | ADVISORY | No |
| `VAL-VIS-240` | Every listed dependency is an existing `DOMAIN-VIS-` identifier | BLOCKING | Yes |
| `VAL-VIS-241` | No record depends on itself | BLOCKING | Yes |
| `VAL-VIS-242` | No retired domain is depended upon by a non-retired domain | BLOCKING | Yes |
| `VAL-VIS-243` | Every retired domain has a forward pointer | BLOCKING | Yes |
| `VAL-VIS-244` | Architecture references cite only identifiers that exist in `AOM-ARCH-001` | BLOCKING | Yes |
| `VAL-VIS-245` | Architecture references to `PROPOSED` domains are labelled `PROPOSED` | BLOCKING | Yes |
| `VAL-VIS-246` | The `UNMAPPED` count in `TBL-VIS-178` shrinks or is re-justified in each subsequent part | BLOCKING | Partly |
| `VAL-VIS-247` | The registry contains exactly fifty domains, or a `DEC-` record explains the change | BLOCKING | Yes |
| `VAL-VIS-248` | Category populations in `TBL-VIS-158` match the registry | BLOCKING | Yes |

### TBL-VIS-217: Validation Rules `VAL-VIS-249`…`266` — Boundaries

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-249` | Every domain has a declared boundary strength `B0`…`B5` | BLOCKING | Yes |
| `VAL-VIS-250` | Declared strength meets the minimum for its security class per `TBL-VIS-181` | BLOCKING | Yes |
| `VAL-VIS-251` | Where declared strength exceeds `B1`, the enforcing mechanism is named | BLOCKING | Yes |
| `VAL-VIS-252` | No crossing occurs through an `✗` cell of `TBL-VIS-183` | BLOCKING | Yes |
| `VAL-VIS-253` | No `X4` shared store exists without a `DEC-` record | BLOCKING | Yes |
| `VAL-VIS-254` | Every crossing declares its kind `X1`…`X5` | BLOCKING | Yes |
| `VAL-VIS-255` | Every crossing has a contract with all seven parts of `TBL-VIS-184` | BLOCKING | Yes |
| `VAL-VIS-256` | Every crossing into an `S1` domain declares an explicit delivery guarantee | BLOCKING | Yes |
| `VAL-VIS-257` | Every exactly-once crossing names its idempotency key | BLOCKING | Yes |
| `VAL-VIS-258` | Every contract names failure semantics for callee unavailability | BLOCKING | Yes |
| `VAL-VIS-259` | Every contract names its versioning strategy | BLOCKING | Yes |
| `VAL-VIS-260` | Every contract names the authority under which it may be invoked | BLOCKING | Yes |
| `VAL-VIS-261` | Every contract names how the crossing is observed | BLOCKING | Yes |
| `VAL-VIS-262` | No contract is defined by its consumer (`BV-04`) | BLOCKING | Partly |
| `VAL-VIS-263` | No boundary is crossed with the caller's identity un-reauthorized (`BV-05`) | BLOCKING | No |
| `VAL-VIS-264` | No `C4` library contains domain logic (`BV-07`) | ADVISORY | No |
| `VAL-VIS-265` | No source comment promises a future boundary fix (`BV-08`) | ADVISORY | Yes |
| `VAL-VIS-266` | `C8` security domains reach other categories only by `X2` | BLOCKING | Yes |

### TBL-VIS-218: Validation Rules `VAL-VIS-267`…`282` — Responsibility and Data

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-267` | Every behaviour has exactly one owning domain | BLOCKING | No |
| `VAL-VIS-268` | No responsibility appears in two domains' records | BLOCKING | Yes |
| `VAL-VIS-269` | Every contested behaviour in `TBL-VIS-187` has a one-sentence reason | BLOCKING | Yes |
| `VAL-VIS-270` | Every entity class has exactly one writing domain | BLOCKING | Yes |
| `VAL-VIS-271` | No consumer migrates an owner's schema (`DP-03`) | BLOCKING | Partly |
| `VAL-VIS-272` | Every replica is declared with source, freshness, and drift check | BLOCKING | Yes |
| `VAL-VIS-273` | Every entity class has a retention class `RT-1`…`RT-6` | BLOCKING | Yes |
| `VAL-VIS-274` | No `RT-1` entity has an update or delete path | BLOCKING | Yes |
| `VAL-VIS-275` | No audit event is stored in a windowed or lossy store (`DP-05`) | BLOCKING | Yes |
| `VAL-VIS-276` | Every entity containing personal data cites `DOMAIN-VIS-046` in its contract | BLOCKING | Yes |
| `VAL-VIS-277` | No personal data appears in telemetry (`DP-04`) | BLOCKING | Partly |
| `VAL-VIS-278` | No credential material is stored outside `DOMAIN-VIS-018` (`DP-07`) | BLOCKING | Yes |
| `VAL-VIS-279` | No query crosses tenants without a tenant predicate (`DP-08`) | BLOCKING | Yes |
| `VAL-VIS-280` | Deletion authority for every entity is the owning domain, coordinated with `036` | BLOCKING | Yes |
| `VAL-VIS-281` | No responsibility is assigned to "the platform" (`RA-01`) | BLOCKING | Yes |
| `VAL-VIS-282` | Ownership reassignment is accompanied by state movement (`RA-05`) | BLOCKING | No |

### TBL-VIS-219: Validation Rules `VAL-VIS-283`…`298` — Interaction and AI

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-283` | Every interaction declares a pattern `IP-01`…`IP-08` | BLOCKING | Yes |
| `VAL-VIS-284` | Every multi-`S1`-domain write uses `IP-05` saga | BLOCKING | Partly |
| `VAL-VIS-285` | Every `IP-05` step declares its compensation | BLOCKING | Yes |
| `VAL-VIS-286` | Every `IP-04` replica has a reconciliation check (`CON-VIS-033`) | BLOCKING | Yes |
| `VAL-VIS-287` | No interaction requires global ordering (`NG-VIS-025`) | BLOCKING | Yes |
| `VAL-VIS-288` | Every agent change record names the domain it resolved | BLOCKING | Yes |
| `VAL-VIS-289` | No agent proceeds past a HALT gate of `AI-VIS-061` | BLOCKING | No |
| `VAL-VIS-290` | No agent implements in a domain below evolution level `E3` | BLOCKING | Partly |
| `VAL-VIS-291` | No agent reads another domain's internals to satisfy a crossing (`AI-VIS-063`) | BLOCKING | No |
| `VAL-VIS-292` | No agent creates a `DOMAIN-VIS-` identifier without approval (`AI-VIS-065`) | BLOCKING | Yes |
| `VAL-VIS-293` | Agents report `UNKNOWN` rather than resolving by assumption (`AI-VIS-069`) | BLOCKING | No |
| `VAL-VIS-294` | Every `IP-02`, `IP-03`, `IP-04`, `IP-05`, and `IP-07` interaction has a dead-letter path | BLOCKING | Yes |
| `VAL-VIS-295` | Every `IP-01` call declares a timeout budget | BLOCKING | Yes |
| `VAL-VIS-296` | Retry is configured only where the target is idempotent | BLOCKING | Partly |
| `VAL-VIS-297` | Telemetry loss is tolerated and audit loss is not, in configuration as well as prose | BLOCKING | Yes |
| `VAL-VIS-298` | Context loading follows `TBL-VIS-209`, including its prohibitions | ADVISORY | No |

### TBL-VIS-220: Validation Rules `VAL-VIS-299`…`320` — Lifecycle, Capability, Document

| ID | Rule | Severity | Automatable |
| :--- | :--- | :--- | :--- |
| `VAL-VIS-299` | `E0` → `E1` requires a written question list | BLOCKING | Yes |
| `VAL-VIS-300` | `E1` → `E2` requires a complete fourteen-field record | BLOCKING | Yes |
| `VAL-VIS-301` | No domain is `IMPLEMENTED` while below `E4` | BLOCKING | Yes |
| `VAL-VIS-302` | `E2` → `E3` requires contracts for every legal crossing, plus security sign-off if `S1` | BLOCKING | Partly |
| `VAL-VIS-303` | `E3` → `E4` requires a referenced artifact path, not a plan | BLOCKING | Yes |
| `VAL-VIS-304` | `E4` → `E5` requires an executing, passing automated check | BLOCKING | Yes |
| `VAL-VIS-305` | `TBL-VIS-195` is authoritative over prose about domain maturity | BLOCKING | Partly |
| `VAL-VIS-306` | `E5` → `E6` requires a named on-call owner and a runbook | BLOCKING | Yes |
| `VAL-VIS-307` | `E6` → `E7` requires a live replacement and recorded data disposition | BLOCKING | Yes |
| `VAL-VIS-308` | Every backward transition has a `DEC-` record naming its cost | BLOCKING | Yes |
| `VAL-VIS-309` | Every open obligation in `TBL-VIS-213` is either discharged or restated in the next part | BLOCKING | Partly |
| `VAL-VIS-310` | No obligation is discharged by assertion; each names its evidence | BLOCKING | Partly |
| `VAL-VIS-311` | `OBL-03` remains flagged as the gate on seven obligations until discharged | ADVISORY | Yes |
| `VAL-VIS-312` | Nothing in `TBL-VIS-214` is later claimed as done by PART 02 | BLOCKING | Partly |
| `VAL-VIS-313` | Every domain delivers at least one capability, or is labelled `UNKNOWN` | BLOCKING | Yes |
| `VAL-VIS-314` | Every capability is delivered by exactly one domain (`CON-VIS-042`) | BLOCKING | Yes |
| `VAL-VIS-315` | Every `CAP-VIS-001`…`070` appears exactly once in `TBL-VIS-199` or `TBL-VIS-200` | BLOCKING | Yes |
| `VAL-VIS-316` | Capability status and delivering-domain evolution level are consistent | BLOCKING | Yes |
| `VAL-VIS-317` | A capability bound to a vision domain but not an architecture domain is still counted `UNMAPPED` architecturally | BLOCKING | Yes |
| `VAL-VIS-318` | Every image specification has all seventeen fields including a generation prompt | BLOCKING | Yes |
| `VAL-VIS-319` | No `IMG-VIS-` number is reserved without a subject | BLOCKING | Yes |
| `VAL-VIS-320` | Every table, diagram, and identifier introduced in PART 02 is referenced at least once by another block | ADVISORY | Yes |

### TBL-VIS-221: Validation Rule Summary for PART 02

| Measure | Value |
| :--- | ---: |
| Rules defined in PART 02 | 120 (`VAL-VIS-201`…`320`) |
| Blocking | 108 |
| Advisory | 12 |
| Fully automatable once `DOMAIN-VIS-006` exists | 87 |
| Partly automatable | 20 |
| Requiring human judgement | 13 |
| **Currently automated** | **0** |
| Cumulative `VAL-VIS-` across PART 01 and PART 02 | 320 |

> **`VIS-181`.** Eighty-seven of one hundred and twenty new rules are fully automatable. That number
> is the concrete size of the prize behind `OBL-04` and `OBL-05`: the specification work needed to
> make the domain model self-enforcing is already done, and what remains is installation. A
> repository that writes 320 checkable rules and executes none of them has built a very precise
> instrument and left it in its case.

---

## 02.15 — Domain Failure and Anti-Pattern Library

### AI NAVIGATION METADATA — §02.15

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before approving any domain design** |
| **AI DEPENDENCIES** | All of PART 02 |
| **AI INPUTS** | A proposed or existing design |
| **AI OUTPUTS** | Named anti-patterns present, with remediation |
| **AI IMPLEMENTATION IMPACT** | These are the failures the domain model exists to prevent |
| **AI VALIDATION REQUIREMENTS** | Each entry names its detecting `VAL-VIS-` rule |
| **AI RELATED DOCUMENTS** | PART 01 §01.25 `FAL-VIS-001`…`120` |

> **`VIS-182`.** Entries `FAL-VIS-121`…`175` continue the PART 01 library. Each carries the same
> seven fields: symptom, cause, impact, detection, prevention, remediation, and AI warning. They are
> presented as grouped tables rather than as fifty-five separate blocks, because the value is in
> the pattern set being scannable, not in each entry occupying a page.

### 02.15.1 Classification Failures

### TBL-VIS-222: `FAL-VIS-121`…`131` — Domain Classification Anti-Patterns

| ID | Anti-pattern | Symptom | Cause | Impact |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-121` | The Junk Drawer | A domain named "common", "shared", or "core" that grows without bound | No owner willing to refuse work | Every domain depends on it; nothing can be changed safely |
| `FAL-VIS-122` | The Org Chart Domain | Domain names match team names | Conway's law accepted as design | Reorganisation invalidates the architecture |
| `FAL-VIS-123` | The Layer Domain | A "domain" named Controllers, Services, or Repositories | Layering mistaken for domain decomposition | Every feature touches every domain |
| `FAL-VIS-124` | The Vendor Domain | A domain named after a product or provider | Tool adoption preceded design | Replacing the vendor requires re-architecting |
| `FAL-VIS-125` | The CRUD Domain | A domain whose purpose is "manage X records" | Data model mistaken for responsibility | No behaviour anywhere; logic scatters into callers |
| `FAL-VIS-126` | The Conjunction Domain | A purpose sentence joining two purposes with "and" | Unwillingness to split | Two blame surfaces, one owner, permanent ambiguity |
| `FAL-VIS-127` | The Anaemic Domain | A domain that owns state but no rule constraining it | State and behaviour separated by habit | Invariants enforced nowhere or inconsistently |
| `FAL-VIS-128` | The Phantom Domain | A registry entry with no capability and no state | Created to fill a diagram | Reviewers assume coverage that does not exist |
| `FAL-VIS-129` | The Overlapping Twins | Two domains whose purposes differ only in wording | Parallel teams naming the same thing | Duplicated logic that diverges |
| `FAL-VIS-130` | The Category Escape | A domain claimed to belong to several categories | Avoiding the constraints of any one | Dependency legality becomes unverifiable |
| `FAL-VIS-131` | The Renamed Leftover | A domain formed from what remained after the good ones were carved out | Decomposition stopped early | Highest change rate, lowest coherence |

### TBL-VIS-223: `FAL-VIS-121`…`131` — Detection, Prevention, Remediation

| ID | Detection | Prevention | Remediation | AI warning |
| :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-121` | `VAL-VIS-206` name check plus dependency fan-in | `DCR-03` | Split by responsibility; retire the shell | Never place a file in a domain because nothing else fits |
| `FAL-VIS-122` | `VAL-VIS-203` against `CODEOWNERS` | `DCR-03` | Rename to the responsibility, keep the identifier | Never derive a domain name from who is writing the code |
| `FAL-VIS-123` | `VAL-VIS-205` against `LYR-ARCH-001`…`010` | `DCR-03` | Re-decompose vertically | Layers and domains are orthogonal; never substitute one |
| `FAL-VIS-124` | `VAL-VIS-204` | `CON-VIS-041` | Introduce a contract; push the vendor behind it | Never let a provider name enter a purpose sentence |
| `FAL-VIS-125` | Purpose sentence matching "manage" plus a noun | `DCR-01` | Find the decision the data serves; name that | A domain that only stores is a table, not a domain |
| `FAL-VIS-126` | `VAL-VIS-201` | `DCR-01` | Split into two domains, re-run `DEC-VIS-032` | Refuse the second purpose; do not accept "and" |
| `FAL-VIS-127` | State owned with no `R3` rule in `TBL-VIS-186` | `VIS-142` | Move the rule to the state's owner | Owning data without owning its invariant is not ownership |
| `FAL-VIS-128` | `VAL-VIS-313` | `DCR-04` | Retire, or bind a real capability | A domain with no capability delivers nothing |
| `FAL-VIS-129` | `VAL-VIS-217` purpose uniqueness | `TBL-VIS-148` | Merge, keep the older ID, forward-point the newer | Compare purposes, not names, when checking for duplicates |
| `FAL-VIS-130` | `VAL-VIS-210` | `TBL-VIS-153` first-match rule | Force one category; record the rejected alternatives | Exactly one category, decided by ordered test |
| `FAL-VIS-131` | Change frequency plus incoherent purpose | `PRN-VIS-020` | Re-decompose the whole cluster | High churn with a vague purpose is the signature |

### 02.15.2 Boundary Failures

### TBL-VIS-224: `FAL-VIS-132`…`145` — Boundary and Interaction Anti-Patterns

| ID | Anti-pattern | Symptom | Impact | Detection | Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-132` | The Shared Table | Two domains write one entity | Boundary exists only in the folder tree | `VAL-VIS-270` | Assign one writer; the other reads a contract |
| `FAL-VIS-133` | The Chatty Boundary | One user action produces dozens of cross-domain calls | Latency and cascading failure | Call-graph analysis | Coarsen the contract or adopt `IP-04` |
| `FAL-VIS-134` | The Distributed Monolith | Domains deploy separately but must deploy together | All cost of distribution, no benefit | Release coupling analysis | Version contracts; remove synchronous chains |
| `FAL-VIS-135` | The Leaky Contract | A contract exposes the owner's internal model | Owner cannot refactor | Contract review against internals | Define an interface model distinct from storage |
| `FAL-VIS-136` | The Captured Judge | A security domain called synchronously by what it judges | Availability of the judged determines the judgement | `VAL-VIS-266` | Convert to `X2` observation plus an edge policy cache |
| `FAL-VIS-137` | The Retry Storm | Failure amplified by retries at every layer | A slow dependency becomes an outage | Retry budget audit | Retry at exactly one layer, with backoff and a budget |
| `FAL-VIS-138` | The Silent Duplicate | Retries applied twice with no idempotency key | Money moves twice; nobody notices | `VAL-VIS-257` | Idempotency key in the contract, dedup at the callee |
| `FAL-VIS-139` | The Convenience Bypass | A direct call around the boundary, with a comment | The comment survives; the fix does not | `VAL-VIS-265` | Delete the bypass, not the comment |
| `FAL-VIS-140` | The Consumer-Owned Contract | The consumer defines the producer's output shape | The producer cannot evolve | `VAL-VIS-262` | Move contract ownership to the producer |
| `FAL-VIS-141` | The Merged Pipeline | Audit and telemetry share lossy transport | Audit gaps appear exactly during incidents | `VAL-VIS-297` | Separate transports with opposite guarantees |
| `FAL-VIS-142` | The Undeclared Replica | A cached copy nobody registered | Silent divergence | `VAL-VIS-272` | Register or delete; add a drift check |
| `FAL-VIS-143` | The Upward Call | A product domain synchronously calls a strategic one | Strategy becomes a runtime dependency | `VAL-VIS-221` | Invert to `X2` events |
| `FAL-VIS-144` | The Ambient Identity | A boundary crossed without re-authorization | Every caller becomes a security boundary | `VAL-VIS-263` | Re-authorize at the callee, always |
| `FAL-VIS-145` | The Timeout-Free Call | A synchronous call with no budget | Thread exhaustion under partial failure | `VAL-VIS-295` | Explicit budget on every `IP-01` |

> **`VIS-183`.** `FAL-VIS-134` The Distributed Monolith is the failure most likely to befall Oship
> specifically, because the fifty-domain registry invites fifty deployables. Domain count is a
> **decomposition** decision; deployable count is an **operational** one, and the two are
> independent. Fifty domains may correctly ship as three services. Any future document that treats
> the registry as a service list has committed this anti-pattern at the planning stage.

### 02.15.3 Ownership and Lifecycle Failures

### TBL-VIS-225: `FAL-VIS-146`…`160` — Ownership, Data, and Lifecycle Anti-Patterns

| ID | Anti-pattern | Symptom | Impact | Detection | Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-146` | Ownership Without State | A domain owns a decision but another holds the data it needs | Decisions made on stale copies | `TBL-VIS-188` audit | Move state to the decider, or the decision to the holder |
| `FAL-VIS-147` | The Committee Decision | Two domains jointly decide one thing | Non-deterministic outcomes by path | `VAL-VIS-267` | Split the behaviour; re-run `DEC-VIS-033` |
| `FAL-VIS-148` | The Orphan Entity | Data with no owning domain | Nobody migrates it, nobody deletes it | `VAL-VIS-270` | Assign an owner or destroy the data |
| `FAL-VIS-149` | The Immortal Draft | A domain stuck at `E2` indefinitely with active work against it | Implementation proceeds against an unratified spec | Evolution audit | Advance or freeze; `CON-VIS-036` forbids depending on it |
| `FAL-VIS-150` | The Paper Promotion | Status advanced without evidence | The registry stops describing reality | `VAL-VIS-303` | Revert the status; require the artifact path |
| `FAL-VIS-151` | The Verification Regression | A domain at `E6` loses its automated checks | Rot with green dashboards | `E6` → `E4` edge in `DGM-VIS-066` | Restore checks before any further change |
| `FAL-VIS-152` | The Deleted Domain | A retired domain's record removed from the registry | Historical citations dangle | `VAL-VIS-243` | Restore the record with `E7` and a forward pointer |
| `FAL-VIS-153` | The Recycled Identifier | A retired `DOMAIN-VIS-` number reused | Two meanings for one ID across history | `VAL-VIS-227` | Issue a new ID; never reuse (`CON-VIS-039`) |
| `FAL-VIS-154` | The Silent Declassification | Security class lowered without a decision | Controls quietly removed | `VAL-VIS-234` plus registry diff | Restore the class; `CON-VIS-038` requires a `DEC-` |
| `FAL-VIS-155` | The Mutable Ledger | An update path exists on an `RT-1` entity | History becomes negotiable | `VAL-VIS-274` | Remove the grant; correct by compensating entry |
| `FAL-VIS-156` | The Convenient Log | Personal data written to telemetry for debugging | `RT-5` data in an `RT-4` store | `VAL-VIS-277` | Correlation IDs resolvable only via `018` |
| `FAL-VIS-157` | The Forever Retention | No retention class assigned, so nothing is deleted | Unbounded liability | `VAL-VIS-273` | Assign a class; implement expiry in `036` |
| `FAL-VIS-158` | The Absent Tenant Predicate | A query without tenant scoping | Cross-tenant disclosure with no error | `VAL-VIS-279` | Structural enforcement per `CON-VIS-035` |
| `FAL-VIS-159` | The Migration Squatter | A consumer adds a column to the owner's table | Migration authority destroyed | `VAL-VIS-271` | Revert; request the field from the owner |
| `FAL-VIS-160` | The Ownership Diagram | Ownership reassigned on paper while writes continue from the old owner | The diagram lies | `VAL-VIS-282` | Move the write path, then the diagram |

> **`VIS-184`.** `FAL-VIS-150` The Paper Promotion is the anti-pattern this document is most
> structurally exposed to. `AOM-VIS-001` assigns statuses to fifty domains, and every one of those
> assignments is a claim that could drift from reality without anyone noticing, because nothing
> checks it. `VAL-VIS-238` is the specific guard: while `apps/` and `services/` contain only
> `.gitkeep`, no domain may claim an implementation status other than `NO CODE`.

### 02.15.4 AI-Specific Domain Failures

### TBL-VIS-226: `FAL-VIS-161`…`175` — Agent Domain Anti-Patterns

| ID | Anti-pattern | Symptom | Impact | Detection | Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FAL-VIS-161` | Resemblance Placement | An agent files work by directory similarity | Junk-drawer growth | `VAL-VIS-288` | Require the resolved domain in the change record |
| `FAL-VIS-162` | The Assumed Status | An agent reads prose and concludes a domain is built | Work layered on nothing | `VAL-VIS-305` | `TBL-VIS-195` is authoritative |
| `FAL-VIS-163` | The Invented Domain | An agent coins a `DOMAIN-VIS-` identifier | Collisions, orphans | `VAL-VIS-292` | Registry approval is a human gate |
| `FAL-VIS-164` | The Helpful Guess | An agent resolves `UNKNOWN` by inference | Fabrication entering the constitution | `VAL-VIS-293` | Report and halt |
| `FAL-VIS-165` | The Convenient Widening | `X2` upgraded to `X1` because the agent wanted an answer now | Temporal coupling introduced silently | `VAL-VIS-254` | Reject; use the declared crossing kind |
| `FAL-VIS-166` | Internals Reading | An agent reads a domain's implementation to satisfy a crossing | Coupling invisible in the diff | `VAL-VIS-291` | Restrict context per `TBL-VIS-209` |
| `FAL-VIS-167` | The Caveat Proceed | An agent passes a HALT gate with a note | Gates become suggestions | `VAL-VIS-289` | HALT means stop |
| `FAL-VIS-168` | Premature Implementation | Code produced for a domain below `E3` | Implementation ahead of specification | `VAL-VIS-290` | Produce specification instead |
| `FAL-VIS-169` | The Threat Model Skip | `S1` work begun without a threat model | Security designed after exposure | `VAL-VIS-235` | `CON-VIS-031` blocks |
| `FAL-VIS-170` | Context Overload | An agent loads all fifty records for a placement question | Slower, and it couples what it read | `TBL-VIS-209` | Load the minimum set |
| `FAL-VIS-171` | The Optimistic Rollup | An agent summarises fifty domains as "the platform is progressing" | Leadership misinformed | `VAL-VIS-305` | Report counts by evolution level |
| `FAL-VIS-172` | Silent Constraint Drop | A constraint judged inapplicable without a record | Fifteen blocking rules become thirteen | `VAL-VIS-312` | Any removal needs a `DEC-` record |
| `FAL-VIS-173` | The Autonomy Creep | Repeated approvals treated as standing permission | A4 reached by accretion | `CON-VIS-045` review | Approval is per-action; `VIS-033` is categorical |
| `FAL-VIS-174` | Capability Duplication | An agent binds one capability to two domains for coverage | `CON-VIS-042` violated | `VAL-VIS-314` | One delivering domain |
| `FAL-VIS-175` | The Obligation Amnesia | A later part omits an undischarged obligation | Open work disappears from the record | `VAL-VIS-309` | Restate every open obligation each part |

```mermaid
flowchart TB
    subgraph CLASS["Classification - 121 to 131"]
        A1["Wrong name"]
        A2["Wrong granularity"]
        A3["No responsibility"]
    end
    subgraph BOUND["Boundary - 132 to 145"]
        B1["Boundary not enforced"]
        B2["Guarantee not declared"]
        B3["Direction inverted"]
    end
    subgraph OWN["Ownership - 146 to 160"]
        C1["Two owners or none"]
        C2["Status without evidence"]
        C3["Data without a class"]
    end
    subgraph AGENT["Agent - 161 to 175"]
        D1["Acted without resolving"]
        D2["Assumed instead of reporting"]
        D3["Passed a gate"]
    end

    A1 --> ROOT["Root cause - a decision was skipped rather than made"]
    A2 --> ROOT
    A3 --> ROOT
    B1 --> ROOT
    B2 --> ROOT
    B3 --> ROOT
    C1 --> ROOT
    C2 --> ROOT
    C3 --> ROOT
    D1 --> ROOT
    D2 --> ROOT
    D3 --> ROOT
    ROOT --> FIX["Prevention - make the decision explicit and gate it"]

    classDef root fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    classDef fix fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    class ROOT root
    class FIX fix
```

> **Diagram ID:** `DGM-VIS-072` — **Common Root Cause Across All Fifty-Five Anti-Patterns**
> **Explanation:** Fifty-five distinct failures reduce to one mechanism: a decision that should have
> been made explicitly was instead made implicitly, by default, or by whoever typed first. This is
> why the domain model's remedy is procedural rather than technical — `DEC-VIS-032`, `DEC-VIS-033`,
> and `DEC-VIS-034` exist to force the decision into the open, and the HALT gates of `AI-VIS-061`
> exist to stop work when it has not been made.

### TBL-VIS-227: Anti-Pattern Presence Audit Against the Current Repository

| Anti-pattern | Present in Oship today? | Evidence |
| :--- | :--- | :--- |
| `FAL-VIS-121` Junk Drawer | **No** | No domain named common, shared, or core in the registry |
| `FAL-VIS-122` Org Chart Domain | **No** | Domain names are responsibilities; owners are separate fields |
| `FAL-VIS-128` Phantom Domain | **No** | `VAL-VIS-313` passes — all 50 deliver at least one capability |
| `FAL-VIS-132` Shared Table | **Not yet possible** | No persistence exists |
| `FAL-VIS-134` Distributed Monolith | **Not yet possible** | No deployables exist |
| `FAL-VIS-149` Immortal Draft | **Present, at scale** | 28 domains at `E2` with no advancement path scheduled |
| `FAL-VIS-150` Paper Promotion | **Guarded, not prevented** | `VAL-VIS-238` written; no automation executes it |
| `FAL-VIS-151` Verification Regression | **Not yet possible** | No domain has ever reached `E5` |
| `FAL-VIS-171` Optimistic Rollup | **Live risk** | `README.md` badge reads "Knowledge Domains 24 of 24", which is true of indexes and easily misread as coverage |
| `FAL-VIS-173` Autonomy Creep | **Live risk** | `CON-VIS-045` is enforced socially only (`OBL-18`) |

> **`VIS-185`.** Four anti-patterns are recorded as "not yet possible" purely because Oship has no
> running system. That is not a clean bill of health; it is the absence of the conditions under
> which the failure occurs. The two live risks — `FAL-VIS-171` and `FAL-VIS-173` — are both about
> *how the system is described and permitted*, not about how it is built, which is exactly what one
> would expect of a repository whose only implemented capability is describing itself.

---

## 02.16 — Domain Dependency Model

### AI NAVIGATION METADATA — §02.16

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | **P1 — read before sequencing any implementation work** |
| **AI DEPENDENCIES** | §02.3 registry, §02.4 crossing legality |
| **AI INPUTS** | A set of domains to be built |
| **AI OUTPUTS** | A legal build order and the critical path |
| **AI IMPLEMENTATION IMPACT** | Determines what must exist before what |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-219`…`223`, `VAL-VIS-240`…`242` |
| **AI RELATED DOCUMENTS** | `19_ROADMAP/INDEX.md` |

### 02.16.1 Dependency Kinds

> **`VIS-186`.** "Depends on" is four different relations wearing one phrase, and conflating them
> produces build orders that are simultaneously over-constrained and unsafe. `TBL-VIS-228`
> separates them.

### TBL-VIS-228: Dependency Kinds

| Kind | Name | Means | Blocks build order? | Blocks deployment? |
| :--- | :--- | :--- | :--- | :--- |
| `DK-1` Existential | A cannot function at all without B | Yes | Yes |  |
| `DK-2` Functional | A loses a capability without B, but still functions | Yes, for that capability | No |
| `DK-3` Semantic | A's meaning is defined by B's concepts | Yes, for specification | No |
| `DK-4` Observational | A emits facts B consumes; A is unaffected if B is absent | No | No |

> **`VIS-187`.** Only `DK-1` and `DK-3` force sequencing. `DK-4` observational dependency forces
> nothing at all — which is why every crossing that can be expressed as `X2` should be, since it
> converts a scheduling constraint into none.

### TBL-VIS-229: Critical Path Dependencies

| Domain | `DK-1` on | `DK-3` on | Earliest buildable after |
| :--- | :--- | :--- | :--- |
| `DOMAIN-VIS-018` Identity | `035` persistence | `009`, `045` | `OBL-03` plus `035` |
| `DOMAIN-VIS-019` Tenancy | `018`, `035` | `034` | `018` |
| `DOMAIN-VIS-020` Financial Factory | `019`, `021` | `034`, `044` | `021` |
| `DOMAIN-VIS-021` Ledger | `035` | `034` | `035` |
| `DOMAIN-VIS-022` Settlement | `021` | `020` | `021` |
| `DOMAIN-VIS-023` Reconciliation | `021` | `022` | `022` |
| `DOMAIN-VIS-024` Workflow | `035` | `017` | `035` |
| `DOMAIN-VIS-035` Persistence | `038` runtime | `034` | `OBL-03` |
| `DOMAIN-VIS-038` Runtime Platform | none | `040` | `OBL-03` |
| `DOMAIN-VIS-041` Observability | `038` | `043` | `038` |
| `DOMAIN-VIS-045` Authorization | `035` | `018`, `019` | `035` |
| `DOMAIN-VIS-047` Audit | `035` | `009` | `035` |
| `DOMAIN-VIS-006` Governance Automation | none | `009`, `007` | **now** |
| `DOMAIN-VIS-007` Verification | `006` | `009` | `006` |

```mermaid
flowchart LR
    OBL3["OBL-03 runtime stack decision"] --> D38["038 Runtime Platform"]
    D38 --> D35["035 Persistence"]
    D35 --> D18["018 Identity"]
    D35 --> D21["021 Ledger"]
    D35 --> D45["045 Authorization"]
    D35 --> D47["047 Audit"]
    D18 --> D19["019 Tenancy"]
    D19 --> D20["020 Financial Factory"]
    D21 --> D20
    D21 --> D22["022 Settlement"]
    D22 --> D23["023 Reconciliation"]
    D38 --> D41["041 Observability"]

    START["No blocker at all"] --> D06["006 Governance Automation"]
    D06 --> D07["007 Verification"]
    D07 --> E5["First E5 domain in Oship history"]

    classDef free fill:#1b5e20,stroke:#a5d6a7,color:#ffffff
    classDef gate fill:#b71c1c,stroke:#ef9a9a,color:#ffffff
    class START,D06,D07,E5 free
    class OBL3 gate
```

> **Diagram ID:** `DGM-VIS-073` — **Two Independent Build Frontiers**
> **Explanation:** The upper chain is entirely gated on one unmade decision and cannot start. The
> lower chain has no blocker whatsoever, needs no stack decision, and terminates in the first `E5`
> domain Oship has ever had. Two frontiers, one blocked and one open, is a scheduling fact rather
> than an opinion — and it makes the sequencing question unusually easy to answer.

### TBL-VIS-230: Fan-In and Fan-Out Analysis

| Domain | Depended upon by | Depends on | Interpretation |
| :--- | ---: | ---: | :--- |
| `DOMAIN-VIS-035` Persistence | 9 | 1 | Highest fan-in; a change here touches nine domains |
| `DOMAIN-VIS-009` Standards | 8 | 1 | High fan-in, already `E4` — the healthy pattern |
| `DOMAIN-VIS-018` Identity | 6 | 2 | Critical path root for the product cluster |
| `DOMAIN-VIS-021` Ledger | 4 | 1 | Financial cluster root |
| `DOMAIN-VIS-020` Financial Factory | 2 | 4 | High fan-out — an integrator, not a foundation |
| `DOMAIN-VIS-002` Knowledge Graph | 7 | 1 | High fan-in, `E4` |
| `DOMAIN-VIS-029` Marketplace | 0 | 2 | Zero fan-in at `E0` — safe to retire (`OBL-13`) |
| `DOMAIN-VIS-006` Governance Automation | 3 | 2 | Modest fan-in, disproportionate leverage |

> **`VIS-188`.** High fan-in is not a defect; it is what a foundation looks like. The signal to
> watch is high fan-in **combined with** a low evolution level. `DOMAIN-VIS-035` has nine
> dependants and sits at `E2` with no stack decision behind it — that combination is the single
> riskiest position in the graph, and `VAL-VIS-223`'s advisory fan-out cap does nothing to catch it.

---

## 02.17 — Domain Metrics Model

### AI NAVIGATION METADATA — §02.17

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | P1 — read when reporting on domain health |
| **AI DEPENDENCIES** | §02.3 registry, §02.7 lifecycle, PART 01 §01.12 success model |
| **AI INPUTS** | The registry and repository state |
| **AI OUTPUTS** | Measured values, or the literal `NOT YET MEASURED` |
| **AI IMPLEMENTATION IMPACT** | Defines what `DOMAIN-VIS-041` must instrument |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-305`, `VAL-VIS-309`…`312` |
| **AI RELATED DOCUMENTS** | `.ai/METRICS.md` |

> **`VIS-189`.** A metric is defined by four things: what it counts, how it is obtained, what value
> would be good, and what it currently is. A metric missing the fourth is a plan; a metric missing
> the third is a number. Both are recorded here honestly, and `NOT YET MEASURED` appears wherever it
> is true.

### TBL-VIS-231: Structural Metrics — `DMET-VIS-001`…`020`

| ID | Metric | Source | Healthy | Current |
| :--- | :--- | :--- | :--- | ---: |
| `DMET-VIS-001` | Total registered domains | Registry | Stable between changes | 50 |
| `DMET-VIS-002` | Domains at `E0`–`E1` | Registry | Low, and moving | 11 |
| `DMET-VIS-003` | Domains at `E2` | Registry | Should fall over time | 28 |
| `DMET-VIS-004` | Domains at `E3` | Registry | Rising | 4 |
| `DMET-VIS-005` | Domains at `E4` | Registry | Rising | 6 |
| `DMET-VIS-006` | Domains at `E5` | Registry | At least one | **0** |
| `DMET-VIS-007` | Domains at `E6` | Registry | Rising once shipping | **0** |
| `DMET-VIS-008` | Retired domains | Registry | Non-zero over time is healthy | 0 |
| `DMET-VIS-009` | Domains with no owner | Registry | Zero | 0 |
| `DMET-VIS-010` | Domains with `UNKNOWN` fields | Registry | Falling | 3 |
| `DMET-VIS-011` | `S1` domains | Registry | As low as honesty allows | 19 |
| `DMET-VIS-012` | `S1` domains with a threat model | Repository | Equal to `DMET-VIS-011` | **0** |
| `DMET-VIS-013` | Threat model coverage | `012` divided by `011` | 100% | **0%** |
| `DMET-VIS-014` | Domains above boundary strength `B0` | Repository | All | **0** |
| `DMET-VIS-015` | Mean dependencies per domain | Registry | Below 4 | 1.7 |
| `DMET-VIS-016` | Maximum fan-in | Registry | Below 12 | 9 |
| `DMET-VIS-017` | Dependency cycles | Registry | Zero | 0 |
| `DMET-VIS-018` | Illegal dependency edges | `TBL-VIS-155` | Zero | 0 |
| `DMET-VIS-019` | Categories with zero domains | Registry | Zero | 0 |
| `DMET-VIS-020` | Domains not mapped to a knowledge domain | `TBL-VIS-157` | Zero | 0 |

### TBL-VIS-232: Coverage and Quality Metrics — `DMET-VIS-021`…`040`

| ID | Metric | Source | Healthy | Current |
| :--- | :--- | :--- | :--- | ---: |
| `DMET-VIS-021` | Capabilities bound to a delivering domain | `TBL-VIS-199`/`200` | 70 of 70 | 70 |
| `DMET-VIS-022` | Capabilities implemented | PART 01 | Rising | 6 |
| `DMET-VIS-023` | Capability implementation rate | `022` / 70 | Rising | 8.6% |
| `DMET-VIS-024` | Domains delivering zero capabilities | Mapping | Zero | 0 |
| `DMET-VIS-025` | Capabilities with two delivering domains | Mapping | Zero | 0 |
| `DMET-VIS-026` | Vision domains with no architecture domain | `TBL-VIS-178` | Falling to zero | 15 |
| `DMET-VIS-027` | Architecture coverage | 35 / 50 | 100% | 70% |
| `DMET-VIS-028` | Validation rules defined for the domain model | §02.14 | Sufficient | 120 |
| `DMET-VIS-029` | Validation rules automatable | §02.14 | High share | 87 |
| `DMET-VIS-030` | Validation rules automated | CI | Equal to `029` | **0** |
| `DMET-VIS-031` | Validation automation rate | `030` / `029` | 100% | **0%** |
| `DMET-VIS-032` | Blocking constraints defined | §02.10 | Sufficient | 15 |
| `DMET-VIS-033` | Blocking constraints enforced mechanically | CI | 15 | **0** |
| `DMET-VIS-034` | Anti-patterns catalogued for domains | §02.15 | Sufficient | 55 |
| `DMET-VIS-035` | Anti-patterns present today | `TBL-VIS-227` | Zero | 1 confirmed, 2 live risks |
| `DMET-VIS-036` | Entity classes with an owner | `TBL-VIS-202` | All | 16 of 16 |
| `DMET-VIS-037` | Entity classes with a retention class | `TBL-VIS-203` | All | 16 of 16 |
| `DMET-VIS-038` | Retention classes with a defined duration | `RT-2` open | All | 5 of 6 |
| `DMET-VIS-039` | Open obligations | `TBL-VIS-213` plus `OBL-19` | Falling | 19 |
| `DMET-VIS-040` | Obligations blocked on `OBL-03` | `DGM-VIS-071` | Zero | 7 |

### TBL-VIS-233: Operational Metrics — `DMET-VIS-041`…`060`

| ID | Metric | Source | Healthy | Current |
| :--- | :--- | :--- | :--- | :--- |
| `DMET-VIS-041` | Domains in production | Deployment | Rising | **0** |
| `DMET-VIS-042` | Domains with an on-call owner | Runbooks | Equal to `041` | 0 |
| `DMET-VIS-043` | Domains with instrumentation | `041` domain | Equal to production count | 0 |
| `DMET-VIS-044` | Boundary violations detected | CI | Zero | `NOT YET MEASURED` |
| `DMET-VIS-045` | Cross-domain calls per user action | Tracing | Below 10 | `NOT YET MEASURED` |
| `DMET-VIS-046` | Contracts with a declared guarantee | Contract registry | All | `NOT YET MEASURED` |
| `DMET-VIS-047` | Replicas with an active drift check | Replica register | All | `NOT YET MEASURED` |
| `DMET-VIS-048` | Detected replica drift events | Reconciliation | Zero sustained | `NOT YET MEASURED` |
| `DMET-VIS-049` | Duplicate settlement effects | `022` | Exactly zero, always | `NOT YET MEASURED` |
| `DMET-VIS-050` | Cross-tenant disclosures | `019` | Exactly zero, always | `NOT YET MEASURED` |
| `DMET-VIS-051` | Audit events lost | `047` | Exactly zero, always | `NOT YET MEASURED` |
| `DMET-VIS-052` | Domains deployable independently | Delivery | Rising where intended | `NOT YET MEASURED` |
| `DMET-VIS-053` | Releases requiring coordinated multi-domain deploy | Delivery | Falling | `NOT YET MEASURED` |
| `DMET-VIS-054` | Mean time to resolve a domain ownership question | Process | Falling | `NOT YET MEASURED` |
| `DMET-VIS-055` | Agent HALT events at domain gates | Agent logs | Non-zero is healthy | `NOT YET MEASURED` |
| `DMET-VIS-056` | Agent changes naming their resolved domain | Commit messages | 100% | `NOT YET MEASURED` |
| `DMET-VIS-057` | Registry edits without a `DEC-` record | Git history | Zero | 0 |
| `DMET-VIS-058` | Backward evolution transitions | Registry history | Rare, always recorded | 0 |
| `DMET-VIS-059` | Domains whose status changed without evidence | Review | Zero | 0 |
| `DMET-VIS-060` | Time a domain spends at `E2` before advancing | Registry history | Bounded | `NOT YET MEASURED` |

> **`VIS-190`.** Seventeen of sixty domain metrics read `NOT YET MEASURED`, and eight more read
> zero because the thing being counted cannot yet occur. Only the structural metrics —
> `DMET-VIS-001`…`020` — are genuinely measurable today, because they are computed from the
> registry rather than from a running system. This is the domain-level echo of `VIS-052`: Oship can
> measure what it has written and nothing about what it does.

> **`VIS-191`.** Three metrics are declared **exactly zero, always**: `DMET-VIS-049` duplicate
> settlements, `DMET-VIS-050` cross-tenant disclosures, and `DMET-VIS-051` lost audit events. These
> are not targets with tolerances. A single occurrence of any of them is an incident requiring a
> `DEC-` record and a structural fix, not a rate to be optimised downward.

---

## 02.18 — PART 02 Traceability and Closure

### AI NAVIGATION METADATA — §02.18

| Field | Value |
| :--- | :--- |
| **AI READ PRIORITY** | P1 — read to traverse PART 02 mechanically |
| **AI DEPENDENCIES** | All of PART 02 |
| **AI INPUTS** | Any PART 02 identifier |
| **AI OUTPUTS** | Its upstream source and downstream consumers |
| **AI IMPLEMENTATION IMPACT** | Enables impact analysis before any change |
| **AI VALIDATION REQUIREMENTS** | `VAL-VIS-320` |
| **AI RELATED DOCUMENTS** | PART 01 §01.27 traceability matrix |

### 02.18.1 Identifier Inventory

### TBL-VIS-234: Identifiers Introduced in PART 02

| Namespace | Range introduced | Count | Next free |
| :--- | :--- | ---: | :--- |
| `VIS-` | `104`…`196` | 93 | `VIS-197` |
| `DOMAIN-VIS-` | `001`…`050` | 50 | `DOMAIN-VIS-051` |
| `TBL-VIS-` | `139`…`241` | 103 | `TBL-VIS-242` |
| `DGM-VIS-` | `054`…`073` | 20 | `DGM-VIS-074` |
| `VAL-VIS-` | `201`…`320` | 120 | `VAL-VIS-321` |
| `FAL-VIS-` | `121`…`175` | 55 | `FAL-VIS-176` |
| `CON-VIS-` | `031`…`045` | 15 | `CON-VIS-046` |
| `DMET-VIS-` | `001`…`060` | 60 | `DMET-VIS-061` |
| `AI-VIS-` | `061`…`071` | 11 | `AI-VIS-072` |
| `IMG-VIS-` | `023`…`025` | 3 | `IMG-VIS-026` |
| `DEC-VIS-` | `032`…`034` | 3 | `DEC-VIS-035` |
| `NG-VIS-` | `025` | 1 | `NG-VIS-026` |
| Local rule namespaces | `DCR-01`…`10`, `C1`…`C10`, `L0`…`L4`, `B0`…`B5`, `X1`…`X5`, `IP-01`…`08`, `R1`…`R6`, `RA-01`…`06`, `BV-01`…`08`, `DP-01`…`08`, `RT-1`…`6`, `E0`…`E7`, `S1`…`S4`, `DK-1`…`4`, `OBL-01`…`18` | — | Scoped to PART 02 |

### 02.18.2 Traceability Chains

### TBL-VIS-235: PART 01 to PART 02 Trace

| PART 01 element | PART 02 consumer | Relationship |
| :--- | :--- | :--- |
| `CAP-VIS-001`…`070` | `TBL-VIS-199`, `TBL-VIS-200` | Every capability bound to a delivering domain |
| `VIS-067` eight `UNMAPPED` capabilities | `VIS-159`, `VIS-160` | All eight bound to vision domains; architecture gap retained |
| `PRN-VIS-015` vendor neutrality | `CON-VIS-041` | Converted into a blocking constraint |
| `PRN-VIS-020` finish before starting | `VIS-141`, `FAL-VIS-131` | Applied at boundary and decomposition level |
| `VIS-032` human accountability | `CON-VIS-045`, `FAL-VIS-173` | Enforced as an unreachable autonomy level |
| `VIS-033` A4 prohibited | `CON-VIS-045`, `OBL-18` | Prohibition restated; enforcement recorded as owed |
| `VIS-039` non-callable capabilities | `TBL-VIS-200` | Reflected in every product-domain binding |
| `VIS-041` six of seventy implemented | `DGM-VIS-067`, `DMET-VIS-022` | Visualised and measured |
| `VIS-051` no dates | `TBL-VIS-214` | Restated as a deliberate omission |
| `VIS-052` thirteen unmeasured | `VIS-190`, `TBL-VIS-233` | Extended to seventeen domain metrics |
| `VIS-065` read-only toward architecture | `VIS-130`, `OBL-01` | Architecture gap recorded, never patched |
| `VIS-069` single-owner `CODEOWNERS` | `OBL-07`, `TBL-VIS-180` `B2` | Weakens review-level boundary enforcement |
| `BND-VIS-014` experiment isolation | `CON-VIS-036` exemption | Prototypes exempt from the `E2` dependency rule |
| `PROB-VIS-023` unknown regulatory regime | `VIS-167`, `OBL-02` | Blocks `RT-2` duration |
| `EVD-VIS-017` uninstalled workflows | `VIS-170`, `OBL-04` | Root of the enforcement gap |
| `EVD-VIS-019` unknown stack | `VIS-151`, `OBL-03` | Gates seven obligations |
| `EVD-VIS-020` empty runtime directories | `VIS-127`, `VAL-VIS-238` | Caps every implementation status at `NO CODE` |
| `DEC-VIS-028` artifact over specification | `VIS-155` | Applied to evolution transitions |
| `AI-VIS-045` boot sequence, three HALTs | `AI-VIS-061`, `VIS-174` | Extended to six HALT gates |

### TBL-VIS-236: PART 02 to `AOM-ARCH-001` Trace — Read-Only

| PART 02 element | Architecture element cited | Direction |
| :--- | :--- | :--- |
| `TBL-VIS-178` coverage audit | `DOM-ARCH-001`…`010` | Vision reads architecture |
| `DOMAIN-VIS-001`…`050` records | `CMP-ARCH-001`…`030`, `LYR-ARCH-001`…`010` | Vision reads architecture |
| `VAL-VIS-205` layer-name prohibition | `LYR-ARCH-001`…`010` | Vision reads architecture |
| `VIS-130` fifteen unmapped domains | `AOM-ARCH-001` PART 02 | **Obligation placed, no edit made** |
| `TBL-VIS-183` crossing legality | `AOM-ARCH-001` §04.4 relationship patterns | Consistent, independently derived |
| `VIS-183` distributed monolith warning | Future deployment topology | Advisory to architecture |

> **`VIS-192`.** No element of `AOM-ARCH-001` was modified by PART 02. Every reference is a
> citation, and every gap discovered is recorded as an obligation in `TBL-VIS-213` rather than
> repaired here. `VIS-065` holds without exception.

### 02.18.3 Coverage Audit

### TBL-VIS-237: PART 02 Section Coverage

| Section | Subject | Visual anchors | Longest unbroken prose block |
| :--- | :--- | ---: | ---: |
| §02.1 | Domain vision overview | 2 diagrams, 7 tables | Under 30 lines |
| §02.2 | Taxonomy model | 1 diagram, 7 tables | Under 30 lines |
| §02.3 | Domain registry | 2 diagrams, 21 tables | Under 25 lines |
| §02.4 | Boundary model | 2 diagrams, 6 tables | Under 30 lines |
| §02.5 | Responsibility model | 1 diagram, 4 tables | Under 30 lines |
| §02.6 | Interaction model | 2 diagrams, 4 tables | Under 30 lines |
| §02.7 | Lifecycle model | 1 diagram, 4 tables | Under 25 lines |
| §02.8 | Capability mapping | 1 diagram, 4 tables | Under 25 lines |
| §02.9 | Data ownership | 1 diagram, 3 tables | Under 30 lines |
| §02.10 | Constraints | 1 diagram, 2 tables | Under 25 lines |
| §02.11 | AI interpretation | 1 diagram, 3 tables | Under 25 lines |
| §02.12 | Image specifications | 3 specifications | Under 20 lines |
| §02.13 | Obligations | 1 diagram, 2 tables | Under 20 lines |
| §02.14 | Validation rules | 7 tables | Under 20 lines |
| §02.15 | Anti-pattern library | 1 diagram, 6 tables | Under 20 lines |
| §02.16 | Dependency model | 1 diagram, 3 tables | Under 25 lines |
| §02.17 | Metrics | 3 tables | Under 20 lines |
| §02.18 | Traceability | 5 tables | Under 20 lines |

> **`VIS-193`.** No block in PART 02 exceeds thirty lines without a visual anchor, against the
> stated ceiling of roughly one hundred and twenty. The density target of a visual every twenty to
> sixty lines is met throughout.

### 02.18.4 Overlap Scan

### TBL-VIS-238: Overlap Scan — PART 02 Against PART 01

| Potential overlap | Verdict | Distinction |
| :--- | :--- | :--- |
| PART 01 §01.7 capabilities vs §02.8 mapping | **No overlap** | PART 01 defines capabilities; §02.8 binds them to owners |
| PART 01 §01.9 boundaries vs §02.4 | **No overlap** | `BND-VIS-` are system-level scope, trust, knowledge, and autonomy boundaries; §02.4 governs inter-domain crossings |
| PART 01 §01.14 evolution vs §02.7 lifecycle | **No overlap** | `P0`…`P5` are system phases; `E0`…`E7` are per-domain levels |
| PART 01 §01.19 constraints vs §02.10 | **Continuation** | Same register, extended from `031` |
| PART 01 §01.24 validation vs §02.14 | **Continuation** | Same register, extended from `201` |
| PART 01 §01.25 anti-patterns vs §02.15 | **Continuation** | Same register, extended from `121` |
| PART 01 §01.27 traceability vs §02.18 | **No overlap** | PART 01 traces vision elements; §02.18 traces domain elements |
| PART 01 `SUC-VIS-` vs §02.17 `DMET-VIS-` | **No overlap** | `SUC-VIS-` measures system success; `DMET-VIS-` measures domain-model health |
| §02.2 knowledge domains vs `MCX-` registry | **No overlap** | `TBL-VIS-156`/`157` formally separate knowledge from system domains |

### TBL-VIS-239: PART 02 Completion Statement

| Claim | Status | Evidence |
| :--- | :--- | :--- |
| Fifty domains registered with complete records | **Done** | §02.3, `TBL-VIS-179` integrity audit passes |
| Every capability bound to a delivering domain | **Done** | `DMET-VIS-021` = 70 of 70 |
| Boundary, interaction, responsibility, and data models defined | **Done** | §02.4, §02.5, §02.6, §02.9 |
| Lifecycle and dependency models defined | **Done** | §02.7, §02.16 |
| 120 validation rules, 55 anti-patterns, 15 constraints, 60 metrics | **Done** | §02.10, §02.14, §02.15, §02.17 |
| Agent procedure with HALT gates | **Done** | `AI-VIS-061`, `DGM-VIS-070` |
| Nineteen open obligations recorded, none disguised | **Done** | `TBL-VIS-213`, `TBL-VIS-214`, `TBL-VIS-241` |
| Any domain implemented in code | **Not claimed** | `VAL-VIS-238`; all runtime directories are `.gitkeep`-only |
| Any rule automated | **Not claimed** | `DMET-VIS-030` = 0 |
| Architecture gap closed | **Not claimed** | `OBL-01` remains open; `VIS-065` forbids closing it here |

> **`VIS-194`.** PART 02 is complete as specification and honest about being nothing more. It has
> made the domain space finite, named, owned, bounded, and checkable. It has not built anything, and
> it has recorded in numbered obligations exactly what it did not do and who owes it.

### 02.18.5 Navigation Correction — `TBL-VIS-139` Superseded

> **`VIS-195`.** `TBL-VIS-139` was written at the opening of PART 02, before the part was drafted,
> and it predicted a section plan that the finished part does not follow. Six of its eighteen rows
> point at sections that exist under different subjects, and six of its promised subjects were not
> written as sections at all. Under the append-only part model `TBL-VIS-139` is not edited. It is
> **superseded** by `TBL-VIS-240`, and the shortfall is recorded as an obligation rather than
> quietly absorbed. A forward-looking navigation table that is allowed to drift from the document it
> indexes is itself an instance of `FAL-VIS-150` The Paper Promotion, applied to a table.

### TBL-VIS-240: Corrected PART 02 Section Index — Supersedes `TBL-VIS-139`

| § | Actual section title | Question it answers | Primary output |
| :--- | :--- | :--- | :--- |
| §02.1 | Domain Vision Overview | What is a domain, and what is it not? | `DCR-01`…`DCR-10` domain criteria |
| §02.2 | Domain Taxonomy Model | How are domains classified? | Categories `C1`…`C10`, layers `L0`…`L4`, `S1`…`S4` |
| §02.3 | Domain Registry | Which domains exist? | `DOMAIN-VIS-001`…`050` |
| §02.4 | Domain Boundary Model | How strong is each boundary, and which crossings are legal? | `B0`…`B5`, `X1`…`X5`, `BV-01`…`BV-08` |
| §02.5 | Domain Responsibility Model | Who is responsible for what, and where is it contested? | `R1`…`R6`, twelve contested assignments |
| §02.6 | Domain Interaction Model | How may domains talk to each other? | `IP-01`…`IP-08` interaction patterns |
| §02.7 | Domain Lifecycle Model | How does a domain evolve? | `E0`…`E7` levels and transition gates |
| §02.8 | Domain to Capability Mapping | Which domain delivers which capability? | 70 of 70 capabilities bound |
| §02.9 | Domain Data Ownership Model | Who owns data, and for how long? | Ownership axioms, `RT-1`…`RT-6`, `DP-01`…`DP-08` |
| §02.10 | Domain Constraints | What is forbidden at domain level? | `CON-VIS-031`…`045` |
| §02.11 | AI Domain Interpretation Model | How should an agent use all of this? | `AI-VIS-061`…`071`, six HALT gates |
| §02.12 | Domain Image Specifications | What must be drawn? | `IMG-VIS-023`…`025` |
| §02.13 | Open Obligations | What is owed, and by whom? | `OBL-01`…`OBL-18`; `OBL-19` added in §02.18 |
| §02.14 | Domain Validation Rules | How is the model checked? | `VAL-VIS-201`…`320` |
| §02.15 | Domain Failure and Anti-Pattern Library | How does the model fail? | `FAL-VIS-121`…`175` |
| §02.16 | Domain Dependency Model | What are the dependency rules and the build order? | `DK-1`…`DK-4`, `DGM-VIS-073` |
| §02.17 | Domain Metrics Model | How is domain health measured? | `DMET-VIS-001`…`060` |
| §02.18 | Traceability and Closure | How is PART 02 traversed and closed? | `TBL-VIS-234`…`241` |

### TBL-VIS-241: Subjects Promised by `TBL-VIS-139` and Not Written — `OBL-19`

| Promised subject | `TBL-VIS-139` row | Where it partially lives now | Disposition |
| :--- | :--- | :--- | :--- |
| AI structured as a domain | §02.5 | `DOMAIN-VIS-011`…`017`, `C6` category | Deferred to a later part |
| Memory as a domain | §02.6 | `DOMAIN-VIS-003`, `DOMAIN-VIS-014` | Deferred to a later part |
| Knowledge circulation and lifecycle | §02.7 | `DOMAIN-VIS-002`, `009`, `010` | Deferred to a later part |
| Experience ownership | §02.8 | `DOMAIN-VIS-030`…`034` | Deferred to a later part |
| Security philosophy | §02.10 | `DOMAIN-VIS-018`, `045`, `046`, `047`; `TBL-VIS-180` boundary strengths | Deferred to a later part |
| Infrastructure evolution and integration ecosystem | §02.11, §02.12 | `DOMAIN-VIS-035`…`040`, `034`; blocked on `OBL-03` | Deferred to a later part |

> **`OBL-19`** — Write the six deferred subject areas of `TBL-VIS-241` as first-class sections in a
> later part of `AOM-VIS-001`. Owed by: this document. Blocked by: nothing for the first four;
> `OBL-03` for infrastructure and integration. Acceptance: each subject has its own section with its
> own navigation metadata, diagrams, and validation rules, and `TBL-VIS-241` is closed by citation.

> **`VIS-196`.** The next part of `AOM-VIS-001` continues from `VIS-197`, `TBL-VIS-242`,
> `DGM-VIS-074`, `VAL-VIS-321`, `FAL-VIS-176`, `CON-VIS-046`, `DMET-VIS-061`, `AI-VIS-072`,
> `IMG-VIS-026`, `DEC-VIS-035`, and `DOMAIN-VIS-051`.

---

<!-- CONTINUATION_POINT -->

> This marker supersedes the earlier `CONTINUATION_POINT` recorded at the end of PART 01. The
> earlier marker is retained unmodified under the append-only part model; the **last** marker in the
> file is always the authoritative resumption point.

**LAST_COMPLETED_SECTION:** PART 02 — DOMAIN VISION ARCHITECTURE
**LAST_COMPLETED_SUBSECTION:** 02.18.5 Navigation Correction
**LAST_COMPLETED_ID:** `VIS-196`
**NEXT_SECTION:** PART 03 — §03.1
**NEXT_ID:** `VIS-197`
**CURRENT_PART:** PART 02 — COMPLETE
**NEXT_PART:** PART 03
**LAST_LINE_ANCHOR:** `TBL-VIS-241: Subjects Promised by TBL-VIS-139 and Not Written`
**DEPENDENCIES_LOADED:** `AOM-ARCH-001` PART 01 read-only, `MASTER_CONTEXT_RULES.md`, `METADATA_STANDARD.md`, `01_PRODUCT/INDEX.md`, `architecture/DOMAIN_MODEL.md`, `.ai/` control plane

---
