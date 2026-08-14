---
File ID: AI-CTX-001
Title: Current Repository Architectural Context
Version: 1.7.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
Related Files: .ai/PROJECT_STATUS.md, .ai/NEXT_ACTION.md, .ai/AI_AGENT_OPERATING_MANUAL.md
AI Priority: CRITICAL
---

# Current Repository Architectural Context

## 1. Current Phase & Operational State

- **Active Lifecycle Phase**: **Phase A — Bounded-Domain Content** (Phase 0 foundation concluded)
- **Semantic Version Target**: `v0.1.0-alpha.0` (Pre-release foundation)
- **Primary Operational Goal**: Transform `afshin-omnisystem/Oship` into an enterprise-grade, world-class AI-Native Software Development Repository without writing application code.
- **Active Work In Progress (1 of 2)**: `docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md` (`AOM-VIS-001`, v1.0.0, `IN_PROGRESS`, Authority **L1 — Strategic / Constitutional**, knowledge domain `01_PRODUCT`). **PART 01 — System Identity and Vision Constitution, PART 02 — Domain Vision Architecture, and PART 03 — Capability Vision Model are all complete and frozen.** Cumulative actual metrics: **13,749 lines · 153,281 words · 107 Mermaid diagrams (all parse clean) · 394 identified tables · 375 vision statements · 167 capabilities defined (3 permanently reserved) · 50 sub-capabilities · 50 system domains · 470 validation rules · 250 failure modes · 60 constraints · 60 domain metrics · 50 capability metrics · 45 image specifications (none produced) · 100 AI directives · 70 AI navigation metadata blocks · 33 open obligations.** PART 03 (§03.1–§03.21, 5,386 lines) delivers: the capability definition and discrimination test, the nine-category taxonomy on two orthogonal axes, the **100-entry capability registry `CAP-VIS-071`…`170`** with 50 sub-capabilities `SCAP-VIS-001`…`050`, the `C0`…`C7` capability maturity ladder, the memory capability model answering when an agent should remember, forget, and compress against `MCX-MEM-001`, the actor and `A0`…`A4` autonomy model, capability contracts, the capability visual model, the commercial / security / data / experience / infrastructure capability families, the dependency rules (no hidden dependencies, no circular chains, explicit contracts), the critical path, the ten sequencing waves `W1`…`W10`, validation rules `VAL-VIS-321`…`470`, failure modes `FAL-VIS-176`…`250`, AI interpretation `AI-VIS-072`…`100`, image specifications `IMG-VIS-031`…`045`, and the §03.21 traceability, reconciliation and closure record. Load-bearing honest findings: a full recount gives **14 `IMPLEMENTED` · 21 `PARTIALLY IMPLEMENTED` · 11 `DOCUMENTED` · 102 `PLANNED` · 17 `PROPOSED` · 1 `VISION` · 1 `UNKNOWN`**, which contradicts the earlier published distribution — the discrepancy is printed in `TBL-VIS-390` rather than silently corrected (`OBL-33`); **every `IMPLEMENTED` label refers to a documentation artifact and zero application code exists**; **165 of 167 capabilities have no contract**; **no capability exceeds maturity `C4`** and `CON-VIS-049` caps them there until CI is installed; the dependency graph recount finds **148 distinct edges, not the published 214**, with 9 roots, max fan-in 10 at `CAP-VIS-092`, and **0 cycles**; only **19 of 30 `CMP-ARCH-` architecture components** have a vision-side referrer (`OBL-30`); six capabilities carry conflicting status declarations (`TBL-VIS-391`). **The entire product critical path `OBL-03` → `CAP-VIS-132` → `133` → `111` → `123` → `124` → `125` is blocked on one unmade persistence decision, and the only fully unblocked chain in the repository is `CAP-VIS-072` → `075` → `077` → `104`** — per `VIS-374`, that chain is the single place real work can begin today. **Release gate FAILS**: four HALT-grade rules (`VAL-VIS-437`, `443`, `456`, `470`) do not pass, three of them blocked on `OBL-03`; the document therefore stays `IN_PROGRESS`. Unmet targets are reported, not engineered around: 13,749 of 20,000+ cumulative lines (6,251 short) and 107 of 150+ cumulative diagrams (43 short); tables (394 of 300+), image specifications (45 of 20+) and capability maps (32 of 20+) are met. `FAL-VIS-` has reached its ceiling of 250 and `IMG-VIS-` was closed at 045 — PART 04 must reopen either namespace explicitly by decision record. It cross-references `AOM-ARCH-001` **read-only** throughout and modified nothing in it. **NOT RELEASED** — append-only continuation to PART 04; the **last** `<!-- CONTINUATION_POINT -->` in the file is authoritative (`NEXT_SECTION: §04.1`, `NEXT_ID: VIS-376`; next free `TBL-VIS-396` · `DGM-VIS-108` · `CAP-VIS-171` · `SCAP-VIS-051` · `VAL-VIS-471` · `CON-VIS-061` · `CMET-VIS-051` · `AI-VIS-101` · `DEC-VIS-036` · `OBL-34`); no PR, merge, or tag (`aom-vis-001-v1.0.0`) before the final part.
- **Active Work In Progress (2 of 2)**: `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` (`AOM-ARCH-001`, v1.0.0, `IN_PROGRESS`, Authority L2 — Architectural). **PART 01 — System Architecture Constitution is complete**: §01.1 Architectural Purpose through §01.30 AI Interpretation Guide, plus Appendix A (image specification registry) and Appendix B (identifier allocation ledger, coverage record, repository reality snapshot, completion statement). 10,844 lines · 152 Mermaid diagrams · 263 tables · 28 image specifications · 395 validation rules · 267 failure modes · 60 invariants · 21 principles. The document is an **AI-executable architecture specification**: every section carries AI navigation metadata, every claim carries an honest status label (`IMPLEMENTED` / `DOCUMENTED` / `PARTIALLY IMPLEMENTED` / `PLANNED` / `PROPOSED` / `UNKNOWN — REQUIRES REPOSITORY VERIFICATION`), and identifiers are permanent and never reused. **NOT RELEASED** — the append-only part model continues in PART 02, and no PR, merge, or tag (`aom-arch-001-v1.0.0`) occurs before the final part. Continuation state is recorded at the literal `<!-- CONTINUATION_POINT -->` marker at the end of the file; the next execution reads that marker and resumes from `NEXT_SECTION` without summarising or restarting.
- **Recent Completion**: MASTER_CONTEXT_MEMORY_SYSTEM.md (MCX-MEM-001, EPIC-2 Sprint B7) **RELEASED v1.0.0** — the cognitive memory architecture of Oship (~34,428 lines, 50 parts). Merged via PR #5 into `main` (merge commit `e3fb4d4`), tagged `mcx-mem-001-v1.0.0`. PROJECT_PHILOSOPHY.md (Constitutional Document) PART 01–04 completed (146 sections, 12,600+ lines). Phase 0 constitutional alignment concluded; foundation established for Phase A execution.
- **Knowledge Infrastructure**: `docs/MASTER_CONTEXT/` knowledge graph established with 24 canonical knowledge domains, each with a metadata-compliant `INDEX.md`, a global knowledge graph root index, AI context routing (`.ai/CONTEXT_ROUTER.md`), and repository metrics (`.ai/METRICS.md`).
- **README Landing Page**: `README.md` is a complete, production-hardened AI-native repository landing page (EPIC-1, Sprint A1, README-06 final audit), ~1990 lines (v2.4.0). All sections present (Hero → Footer) plus deep routing, governance, and operational content. 31 Mermaid diagrams, 18 image specs, 68 verified links, 180 tables, max visual gap 96 lines. All audit gates PASSED. README remains a navigation hub — all detailed knowledge lives in MASTER_CONTEXT.

## 2. Technical Boundaries & Architectural Invariants

1. **No Application Code**: During Phase 0, no source code implementations (e.g., `.js`, `.py`, `.go`, `.java`) are permitted. Only governance, docs, YAML configurations, and skeleton templates exist.
2. **UTF-8 Determinism**: Every file must be encoded in UTF-8 without BOM.
3. **Markdown-Only Documentation**: All narrative documentation must be written in Markdown (`.md`) using standard English.
4. **Metadata Header Standard**: Every `.md` file must begin with the YAML frontmatter block defined in `docs/MASTER_CONTEXT/23_STANDARDS/METADATA_STANDARD.md`.
5. **Directory Integrity**: Empty directories must contain a `.gitkeep` file to ensure Git preservation.

## 3. Active Repository Topology

```
Oship/
├── .github/          # GitHub governance, templates, CODEOWNERS, and CI/CD workflow skeletons
├── .ai/              # AI control plane, session memory, roadmap, execution context, standards, manual
├── docs/             # Comprehensive enterprise documentation, ADRs, diagrams, and wiki
│   └── MASTER_CONTEXT/  # 24 knowledge domains, each with INDEX.md
├── architecture/     # High-level architectural models, domain boundaries, and blueprints
├── design/           # Brand, UX/UI specifications, color systems, and wireframes
├── assets/           # Static enterprise assets
├── configs/          # Shared platform and tooling configurations
├── scripts/          # Automation and DevOps utilities
├── tools/            # Developer and AI assistant toolchains
├── tests/            # Test harness architecture and integration plans
├── examples/         # Canonical usage examples and reference implementations
├── packages/         # Modular library components (Phase C+)
├── apps/             # Deployable end-user applications (Phase C+)
├── services/         # Microservices and backend daemons (Phase C+)
├── infra/            # Infrastructure-as-Code (Terraform, Bicep, Pulumi)
├── deployment/       # Release manifests and deployment strategies
├── docker/           # Containerization definitions and base images
├── k8s/              # Kubernetes manifests, Helm charts, and Kustomize overlays
├── monitoring/       # Application Performance Monitoring (APM) and telemetry policies
├── observability/    # Metrics, logging, and tracing definitions
├── security/         # Threat models, security policies, and vulnerability management
├── database/         # Data schemas, migrations, and storage architecture
├── storage/          # Object storage, caching, and persistence guidelines
├── apis/             # Open API specifications, GraphQL schemas, and contracts
├── sdk/              # Client SDK distributions and language bindings
├── plugins/          # Extension points and third-party plugin integrations
├── templates/        # Reusable scaffolding templates
├── experiments/      # Sandboxed prototype experiments
├── research/         # R&D documentation and competitive analysis
└── archive/          # Deprecated models and historical records
```

## 4. Documentation Completion Standard (EPIC-1 Sprint A2)

- **Created**: `.ai/DOCUMENTATION_COMPLETION_STANDARD.md` — the permanent quality contract for every documentation artifact.
- **Scope**: 11 sections (Philosophy, Definition of Done, Metadata Contract, Visual Knowledge Rules, AI Optimization Rules, Documentation Type Standards, Quality Scoring Framework, Lifecycle State Machine, Change Management Protocol, AI Agent Reading Protocol, Future Evolution Model).
- **Contents**: 20 Mermaid diagrams (`DGM-DOC-001`→`020`), 30 tables, 11 image specifications (`IMG-DOC-001`→`010`).
- **Enforcement**: Every future documentation artifact must satisfy the DoD checklist and DQS ≥ 75 to be considered complete.
- **Version**: `AI-DOC-STD-001` v1.0.0, registered in `.ai/INDEX.md`.

## 5. AI Agent Operating Manual (EPIC-1 Sprint A3)


- **Created**: `.ai/AI_AGENT_OPERATING_MANUAL.md` — the permanent operational constitution for every AI agent.
- **Scope**: 11 sections (Agent Identity, Startup Sequence, Context Loading, Decision Framework, Coding Rules, Multi-Agent Collaboration, Memory System, Error Handling, Repository Safety, Git Workflow, Autonomous Improvement Loop).
- **Contents**: 30 Mermaid diagrams (`DGM-AIM-001`→`030`), 55 tables, 19 image specifications (`IMG-AIM-001`→`019`), ~1580 lines.
- **Enforcement**: Every AI agent must execute the boot sequence, obey the decision/commit/safety gates, and run the improvement loop.
- **Version**: `AI-AOM-001` v1.0.0, registered in `.ai/INDEX.md`.

## 6. MASTER_CONTEXT Operating Rules (EPIC-2 Sprint B1.5)

- **Created**: `docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md` — the constitutional law of the MASTER_CONTEXT (MCX-RULES-001 v1.0.0, ~5600 lines).
- **Scope**: 14+ parts — Constitution, Knowledge Governance, Architecture, Domain Registration, Knowledge Objects, Context Routing, Knowledge Evolution, AI Synchronization, Quality Framework, Security, Entropy Prevention, Long-Term Evolution, Self-Improvement, Image Registry.
- **Contents**: 149 Mermaid diagrams (`DGM-MCR`), 229 tables (`TBL-MCR`), 25 image specifications (`IMG-MCR`), 301+ routing cases.
- **Enforcement**: Every domain, agent, and maintainer of MASTER_CONTEXT obeys these operating rules.
- **Version**: `MCX-RULES-001` v1.0.0, registered in `docs/MASTER_CONTEXT/INDEX.md`.

## 7. MASTER_CONTEXT Enterprise Schema (EPIC-2 Sprint B2)

- **Created**: `docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md` — the DNA of Oship, the definitive enterprise knowledge schema (MCX-SCHEMA-001, ~14500 lines).
- **Scope**: 37 parts — Schema Philosophy, Knowledge Object Model, Complete Object Schemas (50 objects), Repository Graph, Context Schema, Prompt Schema, Memory Schema, Knowledge Routing, Validation Schema, Workflow Schema, AI Schema, Event Schema, DSL, JSON/YAML/Mermaid libraries, Anti Patterns, Best Practices, AI Interpretation, Future Evolution, Cross-Reference Registry, Decision Tree Library, Validation Rule Library, Metadata & AI Prompt Examples, Markdown & Directory Tree Examples, Expanded Example Library, Edge Cases, Expanded Decision Trees, Expanded JSON/YAML, Validation Deep Library, AI Prompt Deep Library, Comprehensive Example Library, Scenario Library, AI Prompt Library, Additional Examples, Additional Decision Trees, Expanded Cross-References.
- **Contents**: 136 Mermaid diagrams (DGM-MCS), 706 tables (TBL-MCS), 16 image specs (IMG-MCS), 210+ JSON examples, 216+ YAML examples, 125 decision trees, 224 validation rules, 40+ AI prompts, all links/anchors resolve.
- **Enforcement**: Nothing in Oship may exist without conforming to this schema.
- **Version**: `MCX-SCHEMA-001` v1.0.0, registered in `docs/MASTER_CONTEXT/INDEX.md`.

## 8. MASTER_CONTEXT Relationship Model (EPIC-2 Sprint B3)

- **Created**: `docs/MASTER_CONTEXT/MASTER_CONTEXT_RELATIONSHIPS.md` — the complete relationship graph of Oship (MCX-REL-001, ~8040 lines).
- **Scope**: 80 parts — relationship philosophy, knowledge/document/domain/bounded-context/module/service/component/API/data/runtime/deployment/monitoring/workflow/decision/memory/prompt/AI relationships, knowledge flow, navigation/dependency/impact graphs, validation, DSL, RQL, JSON/YAML/Mermaid/matrix libraries, anti-patterns, best practices, failure propagation, recovery, evolution, cross-repo, multi-agent, AI interpretation, future evolution, plus deep libraries (decision trees, edge cases, ASCII, directory trees, AI prompts, scenarios, implementation, testing, governance, security, performance, capacity, observability, reliability, audit, documentation, standards, self-reconstruction).
- **Contents**: 126 Mermaid diagrams (DGM-REL), 539 tables (TBL-REL), 66 JSON examples, 64 YAML examples, all links/anchors resolve, max visual gap 54 lines.
- **Enforcement**: Every relationship in Oship conforms to this model; it enables full self-reconstruction.

## 9. MASTER_CONTEXT Execution Model (EPIC-2 Sprint B4)

- **Created**: `docs/MASTER_CONTEXT/MASTER_CONTEXT_EXECUTION_MODEL.md` — the runtime operating system of Oship (MCX-EXEC-001, ~8070 lines).
- **Scope**: 123 parts — execution philosophy, architecture, runtime layers, lifecycles (execution/agent/context/knowledge/task), workflow execution, scheduler model, queue system, priorities, dependency resolution, execution graph, pipeline engine, parallel/sequential/distributed execution, state machine, interrupt handling, pause/resume, rollback, recovery, retry policies, checkpoint system, transaction model, context mounting/switching, memory loading/eviction, cache, prompt/decision/reasoning/planning/tool/plugin/GitHub/documentation/validation/testing/deployment/monitoring/logging execution, telemetry, metrics, tracing, observability, performance/scalability/concurrency/synchronization/locking/deadlock-prevention/consistency/conflict models, security/permission/policy/audit engines, AI runtime, agent cooperation, multi-agent scheduling, failure propagation, recovery graph, disaster recovery, simulation, dry-run/production/safe/maintenance modes, emergency procedures, anti-patterns, best practices, examples, walkthroughs, scenarios, DSL, JSON/YAML/Mermaid libraries, validation, metrics, optimization, evolution, AI interpretation, cross-references, appendices, plus deep libraries (decision trees, edge cases, state machines, flowcharts, sequences, classes, timelines, mindmaps, Gantt) and self-reconstruction handbook.
- **Contents**: 150 Mermaid diagrams (DGM-EXEC), 486 tables (TBL-EXEC), 65+ JSON examples, 70+ YAML examples, all links/anchors resolve, max visual gap 95 lines.
- **Enforcement**: This document enables full runtime reconstruction even if all source code is lost.

## 10. MASTER_CONTEXT Memory System (EPIC-2 Sprint B7)

- **Created**: `docs/MASTER_CONTEXT/MASTER_CONTEXT_MEMORY_SYSTEM.md` — the cognitive memory architecture of Oship (MCX-MEM-001 v1.0.0, ~34,427 lines).
- **Scope**: 50 parts — memory philosophy, architecture, taxonomy (38 memory types), memory object model, lifecycle, storage, retrieval, context reconstruction, knowledge distillation, summarization engine, embedding strategy, vector memory, graph memory, knowledge graph, memory routing, session memory, persistent memory, memory ranking, confidence model, conflict resolution, memory synchronization, multi-agent shared memory, memory security, permissions, validation rules, optimization, garbage collection, knowledge evolution, learning engine, reflection engine, self evaluation, experience replay, pattern extraction, knowledge promotion, knowledge deprecation, memory metrics, telemetry, monitoring, failure library, recovery library, scenario library, JSON library, YAML library, DSL library, mermaid library, best practices, anti-patterns, AI interpretation guide, self reconstruction guide, enterprise reference appendix (table library, validation/ranking/summarization/learning algorithm catalogs, decision-tree/sequence/state-machine libraries, image specification library).
- **Contents**: 784 Mermaid diagrams (DGM-MEM), 620 tables (TBL-MEM), 448 JSON examples, 420 YAML examples, 268 DSL examples, 300 memory scenarios, 400 failure scenarios, 200 recovery scenarios, 240 validation rules, 120 ranking algorithms, 120 summarization algorithms, 120 learning algorithms, 160 decision trees, 160 sequence diagrams, 160 state machines, 56 image specifications (IMG-MEM). All IDs globally unique.
- **Enforcement**: This document is the Memory Constitution — it enables full memory-system reconstruction even if every implementation file is lost.
- **Release Status**: **RELEASED v1.0.0** — merged via PR #5 (`e3fb4d4`) into `main`, tagged `mcx-mem-001-v1.0.0`. Release notes record actual metrics (34,428 lines, 784 Mermaid, 620 tables, 448 JSON, 420 YAML, 264 DSL, 56 image specs).

## 11. Immediate Architectural Constraints for Agents

- Always verify branch protection policies defined in `docs/development/BRANCH_STRATEGY.md`.
- Never delete existing milestone or label definitions.
- Ensure all GitHub issue forms in `.github/ISSUE_TEMPLATE/` conform to modern GitHub YAML syntax.
- Every AI agent must follow the boot sequence and gates defined in `.ai/AI_AGENT_OPERATING_MANUAL.md`.
- Every documentation artifact must satisfy the DoD in `.ai/DOCUMENTATION_COMPLETION_STANDARD.md`.
