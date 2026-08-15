---
File ID: AI-ACT-001
Title: Deterministic Next Action Queue
Version: 1.9.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/CURRENT_CONTEXT.md
Related Files: .ai/PROJECT_STATUS.md
AI Priority: HIGH
---

# Deterministic Next Action Queue

## 1. Operational Protocol

This queue defines the deterministic sequence of tasks required to transition from **Phase 0** into **Phase A**. AI agents must execute tasks in top-down priority order.

### 1.1 Mandatory Session Opening Sequence

`TBL-VIS-777` of `AOM-VIS-001` PART 06 defines an eight-step opening sequence that is **mandatory for every agent session** touching this repository. It is reproduced here because this file is the documented entry point:

1. Read this file and the closure record at the end of `docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md`.
2. Verify local `HEAD` against the remote before writing anything.
3. Recount the five load-bearing measurements — application source files, installed workflows, `CODEOWNERS` principals, `.gitkeep` scaffolds, markdown files. **Never carry a documented number forward as fact** (`VAL-VIS-1745`).
4. Compute `S` specification volume, `A` implementation volume, `E` evidence count, and the drift ratio `DR = S / max(A,1)`.
5. Classify the adoption failure mode `AF-1`…`AF-7` from the result.
6. Consult the adoption decision table `TBL-VIS-713` for the admissible action set.
7. Check the twenty adoption anti-patterns in `TBL-VIS-772` against the action you intend to take.
8. Act, or escalate using the worked escalation contract in `TBL-VIS-764` / `TBL-VIS-765`.

**Standing constraint on this queue.** `AOM-VIS-001` is `COMPLETE` at 27,193 lines with **zero** implementation artefacts behind it. The corpus is classified `K4` PURE DRIFT and the failure mode is `AF-1` STALL, whose defining trap is that the intuitive response to a stall — writing more specification — deepens it. Therefore **specification tasks in this queue are subordinate to `ADOPT-01`**: an agent must not open a new specification document, or a PART 07 of an existing one, until `ADOPT-01` has been executed or formally refused with a recorded reason (`VAL-VIS-1762`, `VAL-VIS-1771`, worked scenario `SC-01`).

## 2. Immediate Task Queue (Phase 0 Completion)

| Priority | Task ID | Description | Assigned To | Status |
| :---: | :--- | :--- | :--- | :---: |
| **P0** | `INFRA-01` | Verify all 30+ enterprise root directories exist and contain `.gitkeep` where empty. | AI Agent Mode | `COMPLETED` |
| **P0** | `DOCS-01` | Establish standard Documentation Metadata Standard headers on all Markdown files. | AI Agent Mode | `COMPLETED` |
| **P0** | `GH-01` | Ensure GitHub Issue Forms (`.yml`) and PR templates are deployed in `.github/`. | AI Agent Mode | `COMPLETED` |
| **P0** | `GH-02` | Document GitHub Labels, Milestones, and Project Boards GitOps alignment. | AI Agent Mode | `COMPLETED` |
| **P1** | `GH-03` | Prepare workflow skeletons in `.github/workflows/` (`ci.yml`, `cd.yml`, etc.). | AI Agent Mode | `COMPLETED` |
| **P1** | `DOCS-02` | Document Semantic Versioning release strategy in `docs/deployment/RELEASE_STRATEGY.md`. | AI Agent Mode | `COMPLETED` |
| **P1** | `DOCS-03` | Document enterprise Branch Strategy in `docs/development/BRANCH_STRATEGY.md`. | AI Agent Mode | `COMPLETED` |
| **P0** | `PHIL-01` | Create PROJECT_PHILOSOPHY.md constitutional document. | AI Agent Mode | `COMPLETED` |
| **P1** | `PHIL-02` | Expand PROJECT_PHILOSOPHY.md with Part 02 extended enterprise framework (Sections 66-95). | AI Agent Mode | `COMPLETED` |
| **P1** | `PHIL-03` | Expand PROJECT_PHILOSOPHY.md with Part 03 scale & self-evolution framework (Sections 96-126). | AI Agent Mode | `COMPLETED` |
| **P1** | `PHIL-04` | Expand PROJECT_PHILOSOPHY.md with Part 04 bounded domains & knowledge layers (Sections 127-146). | AI Agent Mode | `COMPLETED` |
| **P0** | `MCX-00` | Create the MASTER_CONTEXT knowledge infrastructure (24 knowledge domains, each with an INDEX.md, global knowledge graph, routing, and metrics). | AI Agent Mode | `COMPLETED` |
| **P0** | `README-01` | Author README repository landing page Part 01 (hero → technology stack), linking every topic to MASTER_CONTEXT. | AI Agent Mode | `COMPLETED` |
| **P0** | `README-02` | Author README Part 02: Project Modules, Development Workflow, Documentation Portal, Human Entry Point, Quick Start, Repository Health, Quality Standards, Contribution Overview, Security Overview, Roadmap Preview, Release Strategy, License & Acknowledgements, Footer. | AI Agent Mode | `COMPLETED` |
| **P1** | `README-03` | Enrich README to EXTREME knowledge density: routing decision tree, task routing table, per-audience map, per-domain doc inventory, ADR decision tree, metadata header template, contribution flow, repo zone map. | AI Agent Mode | `COMPLETED` |
| **P1** | `README-04` | Continued README density pass: code-ownership map, lifecycle phase gates, knowledge-layer responsibilities, knowledge dependency table, engineering decision areas, git branching model, conventional commits, SemVer rules, environment matrix, health metric definitions, security responsibilities, doc taxonomy, C4 preview, AI-tool compatibility. | AI Agent Mode | `COMPLETED` |
| **P1** | `README-05` | Extended README to 1700–2200 line target: GitHub-native governance, repository operating model, document lifecycle, core invariants, how-to-add-document/domain guides, observability & testing preview, module responsibility matrix, request lifecycle, compound routing, release flow. | AI Agent Mode | `COMPLETED` |
| **P0** | `README-06` | Final Enterprise Audit Pass: AI boot journey, AI confusion prevention matrix, knowledge-layer navigation graph, visual identifier registry (DGM/TBL/IMG-RME), persona routing, future expansion readiness. | AI Agent Mode | `COMPLETED` |
| **P0** | `README-07` | (Next) Author Phase A bounded-domain content documents (e.g., 04_ARCHITECTURE SYSTEM_ARCHITECTURE.md, 15_API API_STANDARDS.md) and validate link integrity across MASTER_CONTEXT. | AI Agent Mode | `PENDING` |
| **P0** | `DOC-STD-01` | Create the permanent documentation quality contract (`.ai/DOCUMENTATION_COMPLETION_STANDARD.md`) with DoD, metadata, visual rules, scoring, lifecycle, change management, and AI reading protocols. | AI Agent Mode | `COMPLETED` |
| **P0** | `AOM-01` | Create the AI Agent Operating Manual (`.ai/AI_AGENT_OPERATING_MANUAL.md`) — the permanent operational constitution for every AI agent (identity, startup, context, decisions, coding, collaboration, memory, errors, safety, git, improvement). | AI Agent Mode | `COMPLETED` |
| **P1** | `AOM-02` | (Next) Author Phase A bounded-domain content documents under MASTER_CONTEXT and validate link integrity; apply the AI Agent Operating Manual to all agent workflows. | AI Agent Mode | `PENDING` |
| **P0** | `MCX-RULES-01` | Create the MASTER_CONTEXT operating rules (`.docs/MASTER_CONTEXT/MASTER_CONTEXT_RULES.md`) — the constitutional law of the cognitive OS (constitution, governance, architecture, domain registration, knowledge objects, routing, evolution, AI sync, quality, security, entropy prevention, long-term evolution, self-improvement). | AI Agent Mode | `COMPLETED` |
| **P0** | `MCX-SCHEMA-01` | Create the MASTER_CONTEXT enterprise knowledge schema (`docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md`) — the DNA of Oship defining how every piece of knowledge is represented (object model, graphs, context, prompts, memory, routing, validation, workflows, AI, events, DSL, libraries). | AI Agent Mode | `COMPLETED` |
| **P0** | `MCX-REL-01` | Create the MASTER_CONTEXT relationship model (`docs/MASTER_CONTEXT/MASTER_CONTEXT_RELATIONSHIPS.md`) — the complete relationship graph of Oship enabling full self-reconstruction. | AI Agent Mode | `COMPLETED` |
| **P0** | `MCX-EXEC-01` | Create the MASTER_CONTEXT execution model (`docs/MASTER_CONTEXT/MASTER_CONTEXT_EXECUTION_MODEL.md`) — the runtime operating system of Oship enabling full runtime reconstruction. | AI Agent Mode | `COMPLETED` |
| **P0** | `MCX-MEM-01` | Create the MASTER_CONTEXT memory system (`docs/MASTER_CONTEXT/MASTER_CONTEXT_MEMORY_SYSTEM.md`) — the cognitive memory architecture of Oship enabling full memory reconstruction (50 parts, 34,428 lines, 784 mermaid, 620 tables, 448 JSON, 420 YAML, 264 DSL, 56 image specs). | AI Agent Mode | `RELEASED` (PR #5, tag `mcx-mem-001-v1.0.0`) |
| **P0** | `ARCH-01` | Author `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` (`AOM-ARCH-001`) **PART 01 — System Architecture Constitution**: §01.1–§01.30 plus Appendix A image registry and Appendix B identifier ledger. | AI Agent Mode | `COMPLETED` (10,844 lines · 152 Mermaid · 263 tables · 395 validation rules · 267 failure modes; Mermaid and anchor validation GREEN) |
| **P0** | `ARCH-02` | (Next) Author `AOM-ARCH-001` **PART 02**, appended after the `<!-- CONTINUATION_POINT -->` marker. Resume from the recorded `NEXT_SECTION` and `NEXT_ID` values; never rewrite, reorder, or squash Part 01. Discharge the forward obligations in `TBL-ARCH-262` — reach the line-density target and add the three outstanding decision trees. | AI Agent Mode | `PENDING` |
| **P1** | `ARCH-03` | (Blocked by final part) Full-document validation, then PR → review → merge to `main` → release tag `aom-arch-001-v1.0.0`. No release before the FINAL part. | AI Agent Mode | `BLOCKED` |
| **P1** | `ARCH-04` | (Next after `AOM-ARCH-001`) Update `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md` to move `SYSTEM_ARCHITECTURE.md` from `PLANNED` to its real status and recompute domain completeness. | AI Agent Mode | `PENDING` |
| **P0** | `VIS-01` | Author `docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md` (`AOM-VIS-001`) **PART 01 — System Identity and Vision Constitution**: §01.1–§01.28 plus Appendix A (image specifications) and Appendix B (glossary, status vocabulary, identifier ledger, metrics, evidence, change record). | AI Agent Mode | `COMPLETED` (5,095 lines · 53 Mermaid · 138 tables · 200 validation rules · 120 failure modes · 70 capabilities; Mermaid and anchor validation GREEN) |
| **P0** | `VIS-02` | Author `AOM-VIS-001` **PART 02 — Domain Vision Architecture**, appended after the Part 01 continuation point: §02.1–§02.18, the 50-entry domain registry `DOMAIN-VIS-001`…`050`, boundary/responsibility/interaction/lifecycle/ownership/dependency models, `CON-VIS-031`…`045`, `VAL-VIS-201`…`320`, `FAL-VIS-121`…`175`, `DMET-VIS-001`…`060`, and obligations `OBL-01`…`OBL-19`. | AI Agent Mode | `COMPLETED` (3,264 lines · 20 Mermaid · 103 tables · 50 domains · 120 validation rules · 55 failure modes · 60 metrics; Mermaid 73/73 and anchor validation GREEN; namespace ceilings raised additively by `DEC-VIS-031`) |
| **P0** | `VIS-02b` | Author `AOM-VIS-001` **PART 03 — Capability Vision Model**, appended after the last `<!-- CONTINUATION_POINT -->`: §03.1–§03.21, the 100-entry capability registry `CAP-VIS-071`…`170`, sub-capabilities `SCAP-VIS-001`…`050`, the `C0`…`C7` maturity ladder, the memory capability model against `MCX-MEM-001`, capability contracts, dependency rules, the critical path, waves `W1`…`W10`, `CON-VIS-046`…`060`, `VAL-VIS-321`…`470`, `FAL-VIS-176`…`250`, `CMET-VIS-001`…`050`, `AI-VIS-072`…`100`, `IMG-VIS-031`…`045`, and the §03.21 closure record. `OBL-19` discharged — all six deferred subject areas written as first-class sections. | AI Agent Mode | `COMPLETED` (5,386 lines · 34 Mermaid · 153 tables · 100 capabilities · 150 validation rules · 75 failure modes · 50 metrics · 20 image specs; Mermaid 107/107 GREEN, ID uniqueness GREEN, anchors GREEN, cross-references GREEN, metadata 70/70 GREEN, visual density GREEN at max 44 prose lines) |
| **P0** | `VIS-02c` | Author `AOM-VIS-001` **PART 04 — Measurement, Evidence and System Observability Vision**, appended after the last `<!-- CONTINUATION_POINT -->`: §04.0–§04.31, the `EV0`…`EV6` evidence ladder, preconditions `MPC-01`…`032`, metric taxonomy `MCAT-01`…`015`, the 21-field metric contract with `MET-VIS-001`…`050`, the metric lifecycle, data quality `DQR-001`…`052`, the five observability planes, `AIO-001`…`052`, the trace contract `TRC-001`…`024`, quality gates `QG-0`…`QG-8`, anti-patterns `FAL-VIS-251`…`290`, the correction lifecycle `CORR-1`…`7`, dashboards `DSH-01`…`08`, security classes `MSC-1`…`6`, the audit chain, the reproducibility contract, the loading sequence `AI-VIS-101`…`115`, `VAL-VIS-471`…`944`, `DEC-VIS-036`…`042`, `IMG-VIS-046`…`052`, and obligations `OBL-34`…`OBL-43`. | AI Agent Mode | `COMPLETED` (5,513 lines · 60,804 words · 24 Mermaid · 162 tables · 474 validation rules · 40 failure modes · 50 metrics · 7 image specs; ten-check closure gate **9 PASS / 1 FAIL** — Mermaid 131/131 GREEN, diagram annotation 131/131 GREEN, ID uniqueness GREEN, `VAL-VIS-` contiguity GREEN after the §04.31.2 repair of 198 unenumerated rules, `FAL-VIS-` allocation GREEN, append-only integrity GREEN against `e87d3c8`, prose density GREEN at max 43 lines, aggregate recount GREEN, fabrication audit GREEN; the single FAIL is release gate `VAL-VIS-470`, which is the intended outcome) |
| **P0** | `VIS-02d` | Author `AOM-VIS-001` **PART 05 — System Knowledge Architecture**, appended after the last `<!-- CONTINUATION_POINT -->`: §05.0–§05.22 plus Appendix §05.A — the Knowledge Evolution Pyramid and `K-L0`…`K-L7` ladder, 30 principles `KPP-01`…`030`, ten knowledge universes with registry `KND-001`…`050`, the Enterprise Knowledge Graph `KGN-01`…`011` and `KGE-01`…`008`, the Semantic Layer `SEM-01`…`024` with `AMB-001`, the Ontology with 50 rules `ONT-001`…`050`, the faceted Taxonomy `TAX-01`…`010`, the Ingestion Pipeline `KIN-01`…`020`, the `K0`…`K6` trust model with 100 trust rules, provenance `KPR-01`…`018`, versioning, knowledge-versus-memory, the retrieval flow, the access matrix, conflict resolution, decay, the quality index `KQI-1`…`7`, security `KSC-1`…`6`, governance, the AI creation pipeline, the Knowledge API `KAPI-01`…`018`, 55 anti-patterns `KAP-01`…`055`, the interpretation guide, `VAL-VIS-945`…`1589`, `FAL-VIS-291`…`328`, `DEC-VIS-043`…`047`, and obligations `OBL-44`…`OBL-51`. | AI Agent Mode | `COMPLETED` (4,492 lines · 49,457 words · 21 Mermaid · 124 tables · 645 validation rules · 38 failure modes · 55 anti-patterns · 50 ontology rules · 50 knowledge domains; **Mermaid 152/152 GREEN** across the whole document, ID uniqueness GREEN after the pre-commit sweep caught and repaired an `IMG-VIS-030` re-use from PART 03, `VAL-VIS-001`…`1589` contiguity GREEN with zero gaps, anchors GREEN with zero duplicate H2 headings, cross-references GREEN with all 6 unresolved references accounted for, metadata GREEN at 15 keys, visual density GREEN at max 44 prose lines, JSON 7/7 GREEN, YAML 3/3 GREEN, append-only integrity GREEN against `844347f`) |
| **P0** | `VIS-02e` | Author `AOM-VIS-001` **PART 06 — System Evolution and Adoption Architecture**, §06.0–§06.19 plus Appendix §06.A and the document closure record, appended after the last `<!-- CONTINUATION_POINT -->`: the `AS-0`…`AS-7` adoption state machine, waves `W0`…`W5`, the adoption critical path, wave entry/exit criteria, the `M0`…`M6` maturity model, activation classes `AC-1`…`AC-5`, the first executable artefact specification, the drift model, the completion claim contract `CC-1`…`CC-5`, amendment mechanisms `AM-1`…`AM-4`, deprecation `DP-0`…`DP-5`, the release gate architecture `QG-0`…`QG-6`, the risk register `ARK-01`…`ARK-12`, the human dependency and escalation contract, failure modes `AF-1`…`AF-7`, anti-patterns `AAP-01`…`AAP-20`, the AI execution contract `AI-VIS-123`…`146`, the closure inventory, scenarios `SC-01`…`SC-06`, `VAL-VIS-1590`…`2004`, `FAL-VIS-329`…`360`, `DEC-VIS-048`…`050`, and obligations `OBL-52`…`OBL-60`. | AI Agent Mode | `COMPLETED` (3,438 lines · 40,645 words · 17 Mermaid · 117 tables · 415 validation rules · 32 failure modes; cumulative **27,193 lines · 169 Mermaid, 0 parse failures · 795 captions**; ID uniqueness GREEN, `VAL-VIS-0001`…`2004` contiguity GREEN, `FAL-VIS-001`…`360` contiguity GREEN, anchors GREEN with zero duplicate H2, cross-references GREEN with all 71 unresolved accounted for, metadata GREEN at 15 keys, visual density GREEN at max 32 lines in PART 06, JSON 7/7 GREEN, YAML 3/3 GREEN, append-only integrity GREEN against `1b80a62`. **`AOM-VIS-001` is now `COMPLETE` — 6 of 6 parts. `CC-1` AUTHORED only; NOT released and release is prohibited by `TBL-VIS-757`.**) |
| **P0** | `ADOPT-01` | **THE STANDING RECOMMENDATION — highest-value action in the repository.** Build and install the documentation integrity check specified in `TBL-VIS-730`: `tools/docs-validate/` (Mermaid parse, identifier uniqueness, identifier contiguity, anchor resolution, frontmatter key conformance, caption/diagram annotation) plus `.github/workflows/docs-validate.yml`. Acceptance criteria `FA-01`…`FA-12`. **Requires no human decision and has no prerequisites.** Derived independently six times inside PART 06. Effects: maturity `M1`→`M2`, the **first `EV4` evidence in repository history**, `QG-4` opens, wave `W1` closes, three `W0` criteria mechanise, and the drift denominator becomes non-zero for the first time. On first run it is **expected to fail** on the existing corpus (frontmatter conformance on 51 of 87 files); per `VAL-VIS-1746` and worked scenario `SC-04`, keep it failing and record obligations — do **not** relax checks or exclude files to reach green. | AI Agent Mode | **`EXECUTED` 2026-08-15** — `tools/docs-validate/` built and committed on branch `arena/01a003bd-oship`. The workflow is authored and YAML-validated at `tools/docs-validate/ci/docs-validate.yml` but **NOT yet installed** to `.github/workflows/`: the delivering credential lacks the GitHub `workflows` permission. One copy command by any principal completes it (`ADOPT-OBL-13`). Self-test **11/11 PASS**. First full-corpus run: **FAIL, 165 errors · 441 warnings**, which is the intended outcome under `VAL-VIS-1746` / `SC-04`. `FA-01`, `FA-02`, `FA-04`, `FA-06`…`FA-12` **MET**; `FA-03` on first CI run; `FA-05` **deliberately not met**. Findings recorded as `ADOPT-OBL-01`…`12` in `docs/reports/ADOPT-01-VALIDATION-BASELINE.md`. |
| **P0** | `ADOPT-02` | Do **not** open `AOM-VIS-001` PART 07 or begin any new specification document before `ADOPT-01` is executed or formally refused. Worked scenario `SC-01` and `VAL-VIS-1762` both require that a `PURE DRIFT` classification be escalated before further specification is written. If `ADOPT-01` cannot be done, escalate `OBL-03` using the worked escalation in `TBL-VIS-765` and **report blocked** (`AI-VIS-144`) rather than producing substitute output. | AI Agent Mode | **`RELEASED` 2026-08-15** — the subordination rule is satisfied because `ADOPT-01` was executed, not refused. Specification work may resume, subject to `ADOPT-03` (`VAL-VIS-` ceiling) and to the new standing rule below. |
| **P0** | `ADOPT-03` | Discharge `OBL-60`: `VAL-VIS-` stands at **2,004 of its 2,200 ceiling (90 percent)** and `IMG-VIS-` at **053 of 060 (88 percent)**. Any future part of comparable rule density will exhaust `VAL-VIS-`. Per `VAL-VIS-1592`, perform the two-pass ceiling audit in the first chunk of any new part and raise the ceiling by `DEC-VIS-051` **before** allocating a single new rule. | AI Agent Mode | `PENDING` |
| **P1** | `ADOPT-04` | Discharge `OBL-58`: `README.md` carries completion-claim non-conformances against the `CC-1`…`CC-5` contract — the "Knowledge Domains 24 of 24" badge (`FAL-VIS-171`, which is why `README.md` must not be loaded as agent context) and the "The Enterprise Money Factory AI-First Ecosystem" identity claim, both stated in the present indicative for things that do not exist. Restate them at `CC-1` per `TBL-VIS-741`. | AI Agent Mode | `PENDING` |
| **P1** | `ADOPT-05` | Discharge `OBL-59` mechanically once `ADOPT-01` exists: the PART 06 table of contents publishes **forecast** `TBL-VIS-` ranges that actual allocation undershot from §06.7 onward. `ERR-02` in `TBL-VIS-798` records the correct reading — the caption line is the sole allocation record (`VAL-VIS-1820`) and the closure record supersedes the ToC for citation. A checker should flag any future ToC range that diverges from actual allocation. | AI Agent Mode | `PENDING` — **now mechanisable.** `tools/docs-validate/` exists and `ID-CONTIGUITY` already reports actual per-namespace allocation ranges. The ToC-versus-actual comparison is a small addition to `id_validator.py`, no longer a from-scratch build. |
| **P1** | `ADOPT-06` | Discharge `OBL-56`: `ACT-VIS-004` is unfilled, leaving one link of the adoption critical path with no assigned actor. All 16 `ACT-VIS-` roles currently resolve to a single person, which makes every separation-of-duty control in the corpus inoperative. Requires `ACT-VIS-001`. | Human Architect | `PENDING` |
| **P0** | `ADOPT-07` | **Single highest-leverage human action in the repository: add a second `CODEOWNERS` principal.** One line plus a person. It is the only route to `EV2` evidence, knowledge trust `K4`, quality gate `QG-3`, maturity `M4`/`M5`, and completion claim `CC-2`, all of which are currently **structurally unreachable** rather than merely unmet. On completion, recompute the entire `DGM-VIS-168` cascade and close `OBL-55`; per `VAL-VIS-1795` no prior claim may be upgraded retroactively — documents authored under one principal stay `K3` until re-reviewed. | Human Architect | `PENDING` |
| **P1** | `VIS-25` | **Release of `AOM-VIS-001` is PROHIBITED, not deferred.** `TBL-VIS-757` is a standing prohibition with no documentation-only exemption. An agent asked to tag, open a PR, merge or release `AOM-VIS-001` must **refuse** and cite it (`AI-VIS-129`, worked scenario `SC-06`). `QG-4` and `QG-5` fail; a version tag would imply `CC-3` VALIDATED, which the repository cannot earn until CI is installed. The prohibition lifts only when the gates open — executing `ADOPT-01` is the first step. | AI Agent Mode | `BLOCKED` |
| **P1** | `VIS-20` | Discharge `OBL-46`, the **keystone obligation opened by PART 05**: no provenance block schema is implemented anywhere in Oship, and 12 of the 18 `KPR-` fields are absent corpus-wide. Trust levels, decay windows and five of the seven quality dimensions all rest on provenance blocks that do not exist, which is why the Knowledge Quality Index composite is `NOT YET MEASURED` rather than a number. `TBL-VIS-673` and the appendix YAML/JSON schemas give the target shape. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-21` | Discharge `OBL-44`: widen every identifier audit regex from `[0-9]{3}` to `[0-9]{3,4}`. `DEC-VIS-044` raised the `VAL-VIS-` ceiling to 1600 and four-digit identifiers now silently escape three-digit patterns, so any audit written before PART 05 under-reports by 645 rules. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-22` | Discharge `OBL-51` and thereby finish clearing `VAL-VIS-456`: annotate each existing use of "creator" in PARTS 01–04 with the sense intended, using the three replacement terms registered in `TBL-VIS-674` — originating principal, authoring agent, content owner. The annotation must be **appended at the current end of the document**, never edited into the frozen parts. This is the last documentation-only step on the only HALT-grade release rule that does not depend on `OBL-03`; it supersedes and completes task `VIS-14`. | AI Agent Mode | `PENDING` |
| **P2** | `VIS-23` | Discharge `OBL-49`: governance instrument precedence is undefined. ADRs, `.ai/DECISION_LOG.md` `DEC-` records, in-document `DEC-VIS-` records and `MASTER_CONTEXT_RULES.md` have overlapping jurisdictions and no rule states which prevails on conflict. It has not yet mattered, which is exactly when it is cheapest to fix. Recorded in PART 05 as an instance of anti-pattern `KAP-43`. | AI Agent Mode | `PENDING` |
| **P2** | `VIS-24` | Discharge `OBL-45` and `OBL-48`: there is no per-claim decay override and no mechanism to embed a live measurement in a document, so every `D4` measured figure is formally stale on the very commit that records it — including PART 05's own file counts. Both are recorded honestly in `TBL-VIS-643` rather than smoothed over. | AI Agent Mode | `PENDING` |
| **P0** | `VIS-15` | **Highest-value single action identified by PART 04.** Install one CI workflow that runs the Mermaid validator over `docs/` and records its output as a run artifact. This lifts `MET-VIS-011` from `EV3` to `EV4`, closes reproducibility condition 6 (§04.27), opens quality gate `QG-4`, and repairs the continuity link in the audit evidence chain (§04.26). One file; no persistence decision required. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-16` | Discharge `OBL-39`, `OBL-41` and `OBL-42`: build the traceability parser, the declarativeness parser, and the upward evidence index. All three are single scripts, none requires CI or a runtime, and together they move the `MCAT-05` metric family from unmeasured to `EV3`. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-17` | Discharge `OBL-40` and `OBL-43`: add YAML frontmatter to the 10 markdown files that lack it (raising `MET-VIS-` frontmatter coverage from 0.885), and perform the validator negative test — feed a deliberately malformed Mermaid block through the validator and record that it fails. Until that test exists, the validator's own reliability is `EV1`. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-18` | Discharge `OBL-36` and `OBL-38`: attach a `MET-VIS-` identifier to every quantitative claim in the `.ai/` status files, and retrofit the 111 `DMET-`/`CMET-` metrics defined in PARTS 02 and 03 to the 21-field canonical contract of `TBL-VIS-421`. Identifiers are not changed by the retrofit (`VAL-VIS-599`). | AI Agent Mode | `PENDING` |
| **P1** | `VIS-19` | Add a second `CODEOWNERS` principal. **PART 05 raises the stake decisively: this is the only action in existence that makes knowledge trust level `K4` Trusted reachable at all.** `K4` requires a verifier principal distinct from the author; with one principal every check is a self-check, so the entire corpus is permanently capped at `K3`, `OBL-47` cannot be discharged, and anti-pattern `KAP-21` self-verification is present by structural necessity rather than by negligence. With one principal every verification in the repository is a self-verification, which caps the whole document at `EV3` (§04.2), keeps 12 measurement anti-patterns in the PRESENT column, blocks quality gate `QG-6`, breaks the independence link of the audit chain, and — via the minimum-cohort rule of §04.25 — means **no `MSC-4` metric may be placed on any dashboard**. | Human Architect | `PENDING` |
| **P1** | `VIS-10` | Discharge `OBL-33`: tighten the definition of the `DOCUMENTED` status so that a registry row alone does not qualify a capability as documented. A full recount under the loose definition produced **14 `IMPLEMENTED` · 21 `PARTIALLY IMPLEMENTED` · 11 `DOCUMENTED` · 102 `PLANNED` · 17 `PROPOSED` · 1 `VISION` · 1 `UNKNOWN`**, against the published `TBL-VIS-278` figures; the divergence is printed in `TBL-VIS-390` and must be resolved by definition, not by re-labelling rows. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-11` | Discharge `OBL-30`, `OBL-31` and `OBL-32`: add vision-side referrers for the **11 of 30 `CMP-ARCH-` components** with none; supply the missing `AI Pri.` field on registry rows `CAP-VIS-167`…`170`; and correct the `DOMAIN-VIS-045` ↔ `CAP-VIS-109` binding, which is a genuine error rather than an empty-domain artifact. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-12` | Extend `VAL-VIS-435` to forbid a bare `Status` column header outside the capability registry. Six capabilities (`CAP-VIS-005`, `007`, `010`, `012`, `024`, `048`) carry conflicting status declarations recorded in `TBL-VIS-391`; the root cause is a mis-named "pair status" column, and the registry is authoritative in every case. | AI Agent Mode | `PENDING` |
| **P0** | `VIS-13` | Start the only fully unblocked capability chain in the repository: `CAP-VIS-072` → `CAP-VIS-075` → `CAP-VIS-077` → `CAP-VIS-104`. `VIS-374` names it as the single place real work can begin while `OBL-03` remains open; 31 of 167 capabilities are hard-blocked and no capability may exceed maturity `C4` until CI is installed (`CON-VIS-049`, wave `W1`). | AI Agent Mode | `PENDING` |
| **P1** | `VIS-14` | **Superseded by `VIS-22`** — PART 05 supplied the binding definitions in `TBL-VIS-674`; only the PARTS 01–04 annotation remains. Clear `VAL-VIS-456`, the **only** one of the four failing HALT-grade release rules that is unblocked by `OBL-03`: the term "creator" resolves three different ways across the document (`OBL-27`), and a single binding definition discharges it by documentation alone. `VAL-VIS-437` and `VAL-VIS-443` remain blocked on the persistence decision, and `VAL-VIS-470` fails while any of them do. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-03` | **Superseded by `VIS-25`.** The final part is now authored, so "blocked by final part" no longer describes the situation: release is blocked by four failing HALT rules and a standing prohibition, not by remaining content. Full-document validation was run at `28daa48` and is recorded in the PART 06 Completion Register — 169 Mermaid / 0 failures, ID uniqueness and contiguity GREEN, anchors GREEN, metadata GREEN, JSON 7/7, YAML 3/3, append-only integrity GREEN. **No PR, no merge, no tag.** | AI Agent Mode | `BLOCKED` |
| **P1** | `VIS-04` | Close the traceability gaps recorded in Part 01: map the `UNMAPPED` set (`CAP-VIS-009`, `CAP-VIS-049`…`056`, `PRN-VIS-015`) onto architecture anchors in `AOM-ARCH-001` Part 02, and instrument the 13 success measures currently `NOT YET MEASURED`. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-06` | Discharge `OBL-01`: `AOM-ARCH-001` PART 02 must add `DOM-ARCH-` counterparts for the 15 vision domains that currently have none (`TBL-VIS-178`). This is owed **by the architecture document**; `AOM-VIS-001` is read-only toward it (`VIS-065`) and must never patch the mapping itself. | AI Agent Mode | `PENDING` |
| **P1** | `VIS-07` | Discharge `OBL-03`: record the runtime technology-stack decision as an ADR. It gates 7 of the 19 open obligations and the whole product critical path `DOMAIN-VIS-018 → 019 → 020 → 021 → 022`. Until it exists, `DOMAIN-VIS-035` Persistence — 9 dependants at evolution level `E2` — is the riskiest position in the dependency graph. | Human Architect | `PENDING` |
| **P1** | `VIS-08` | Take the **unblocked** build frontier: advance `DOMAIN-VIS-006` Governance Automation → `DOMAIN-VIS-007` Verification. It has no dependency on `OBL-03`, and completing it yields the first `E5` domain in the repository's history, converting `DMET-VIS-006` from 0. | AI Agent Mode | `PENDING` |
| **P2** | `VIS-09` | Resolve the two live anti-pattern risks named in `TBL-VIS-227`: the README "Knowledge Domains 24 of 24" badge (`FAL-VIS-171`) and `CON-VIS-045` autonomy level A4 being socially rather than mechanically enforced (`FAL-VIS-173`, `OBL-18`). | AI Agent Mode | `PENDING` |
| **P2** | `VIS-05` | Automate the validation rules: `VAL-VIS-006` (anchors) and `VAL-VIS-007` (Mermaid) already have local checkers; promote them into `.github/workflow-skeletons/documentation` and install the workflow so validation is executed rather than asserted. Part 02 raises the stake — **87 of the 120 new domain rules are automatable and 0 are automated** (`DMET-VIS-031` = 0%), and installing the workflow also discharges `OBL-04` and `OBL-05`. | AI Agent Mode | `PENDING` |

## 3. Transition Criteria for Phase A

Once all `P0` and `P1` tasks above are verified:
1. Submit a PR from `arena/019fcbef-oship` to `main`.
2. Upon approval, update `CURRENT_CONTEXT.md` to indicate **Phase A** is active.
3. Populate `NEXT_ACTION.md` with Phase A bounded domain definition tasks.

---

## ADOPT-01 Execution Record — 2026-08-15

`ADOPT-01` is **EXECUTED**. This is the first entry in this queue that records the
delivery of an executable artefact rather than a document.

### Delivered

| Path | Description |
| :--- | :--- |
| `tools/docs-validate/run-validator.py` | entry point; six validators; text, JSON and Markdown reports; `--self-test` |
| `tools/docs-validate/validators/` | `base`, `markdown_validator`, `mermaid_validator`, `id_validator`, `anchor_validator`, `metadata_validator`, `metrics_validator` |
| `tools/docs-validate/configs/validation-rules.yaml` | switches, thresholds, permanent-gap allowlist, rule-citation register |
| `tools/docs-validate/schemas/metadata-schema.yaml` | canonical metadata contract with header-dialect aliases |
| `tools/docs-validate/fixtures/` | regression fixtures for `FA-04`, `FA-09`, `FA-10`, `FA-11` |
| `tools/docs-validate/reports/BASELINE-2026-08-15.md` | committed first-run baseline |
| `tools/docs-validate/ci/docs-validate.yml` | the workflow required by `FA-01`/`FA-02`, YAML-validated. **Staged, not installed** — the delivering credential lacks the GitHub `workflows` permission. Copy to `.github/workflows/` to complete (`ADOPT-OBL-13`). |
| `docs/reports/ADOPT-01-INSPECTION-REPORT.md` | Phase 1 inspection findings |
| `docs/reports/ADOPT-01-VALIDATION-BASELINE.md` | the 165 findings as discharge-tracked obligations |

### Measured first run

**87 files · 139,529 lines · 825,137 words · 1,998 Mermaid diagrams · 3,704 tables ·
2,427 `VAL-` rules · 758 `FAL-` modes · 7,587 identifier definitions.**
Result **FAIL — 165 errors, 441 warnings**. Self-test **11 of 11 PASS**.

Per `VAL-VIS-1745`, these figures were recounted at execution time. The corpus is
**87** Markdown files; `.ai/METRICS.md` records **85**. That discrepancy is
`ADOPT-OBL-07` and is the first defect an automated metric ever caught here.

### Acceptance against `TBL-VIS-732`

`FA-01`, `FA-02`, `FA-04`, `FA-06`, `FA-07`, `FA-08`, `FA-09`, `FA-10`, `FA-11`, `FA-12`
— **MET**. `FA-03` — satisfied on the first CI execution. `FA-05` — **deliberately not
met**: 165 real defects are outstanding, and `SC-04` requires the run stay red until the
corpus is repaired.

### New standing rules

| ID | Rule |
| :--- | :--- |
| `ADOPT-R1` | **The validator must not be weakened to reach green.** No threshold loosened, no path excluded, no check deleted, no `continue-on-error`, for the purpose of passing. The only admissible route to green is discharging `ADOPT-OBL-01`…`12`. |
| `ADOPT-R2` | **Every new check needs a fixture.** A check with no regression fixture in `tools/docs-validate/fixtures/` and no case in `--self-test` cannot be trusted to still work, and must not be relied on for an `AS-6` claim. |
| `ADOPT-R3` | **Baselines are append-only.** Commit each new `reports/BASELINE-<date>.md` alongside its predecessors. Never edit a historical baseline. |
| `ADOPT-R4` | **Python is a tooling choice.** `FAL-VIS-341` and `FA-08`: the validator's language must never be cited as a de facto Wave `W2` product-language decision. That decision remains open and requires a human principal. |

### Immediately next

| Priority | Task | Note |
| :---: | :--- | :--- |
| **P0** | `ADOPT-OBL-01a` — teach `mermaid_validator` the `erDiagram` crow's-foot grammar, then re-baseline | 4 of the 6 Mermaid errors are checker over-strictness, disclosed rather than silently patched |
| **P0** | `ADOPT-OBL-03a` — **human decision**: how `TBL-VIS-689` should treat a rule identifier republished as a row in a second table | 154 of the 159 identifier errors turn on this one reading; recommendation is Option A in the baseline report §3.2 |
| **P0** | `ADOPT-OBL-02` — repair `MASTER_CONTEXT_EXECUTION_MODEL.md:5123`, `F{Mount]` | unambiguous typo; Mermaid will not render it |
| **P1** | `ADOPT-OBL-07` — correct `.ai/METRICS.md` from 85 to 87 and cite the checker as the source | ends hand-maintained metrics |
| **P0** | `ADOPT-07` — add a second `CODEOWNERS` principal | unchanged, and still the highest-leverage **human** action; `ADOPT-01` did not and could not touch it |

`ARCH-02` (`AOM-ARCH-001` PART 02) is **unblocked**: the `ADOPT-02` subordination rule is
discharged because `ADOPT-01` was executed rather than refused.

---

## Queue update — 2026-08-15, validator v1.2.0

Appended. Nothing above is edited.

| Priority | Task ID | Description | Owner | Status |
| :---: | :--- | :--- | :--- | :---: |
| **P0** | `ADOPT-OBL-03a` | Formalise identifier definition-vs-reference semantics (`DEC-VIS-052`) and encode them in the validator | AI Agent Mode | **`RESOLVED`** — verified this session, not assumed: record `ACTIVE`, 11 terms defined, encoded, 12 regression cases passing, reversible |
| **P0** | `ADOPT-OBL-01b` | Mermaid engine fail-open: `NODE_PATH` is ignored by the ESM resolver, so the authoritative parser never loaded and the fallback was used **silently** | AI Agent Mode | **`RESOLVED`** — `createRequire()` resolution; `MMD-ENGINE` fails closed; diagnostics published; CI provisions and asserts the engine |
| **P0** | `ADOPT-OBL-13` | Install `.github/workflows/docs-validate.yml` | **Human principal with `workflows` scope** | **`OPEN` — BLOCKED.** Re-tested by real `git push` this session and rejected. Actions API confirms 0 documentation workflows and 0 runs. |
| **P0** | `ADOPT-OBL-02` | Repair the 5 real Mermaid parse failures | AI Agent Mode | `OPEN` — all 5 confirmed by `mermaid.parse()`; small and mechanical |
| **P0** | `ADOPT-OBL-03b` | Adjudicate the 3 `SEMANTIC_DUPLICATE` findings in `TBL-VIS-394` | **Human Architect** | `OPEN` — re-verified real this session |
| **P1** | `ADOPT-OBL-06` | 5 identifier contiguity gaps | AI Agent Mode | `OPEN` |
| **P1** | `ADOPT-OBL-07` | Correct `.ai/METRICS.md` §4 Documentation Count | AI Agent Mode | `OPEN` — measured **93**, §4 still asserts 85; §7 records the measurement without editing §4 |
| **P1** | `ADOPT-OBL-08`…`11` | 8 broken anchors, 4 duplicate slugs, 2 metadata values, 426 unresolved relative links | AI Agent Mode | `OPEN` |
| **P0** | `ADOPT-07` | Add a second `CODEOWNERS` principal | **Human principal** | `OPEN` — unchanged, still the highest-leverage human action |

### The exact next action

`ADOPT-OBL-13`. Everything else in this queue is either agent work that does not unblock a
gate, or human adjudication. **Workflow installation is the only step that produces `EV4`**,
and `EV4` gates `QG-4` and Wave `W1`.

```bash
mkdir -p .github/workflows
cp tools/docs-validate/ci/docs-validate.yml .github/workflows/docs-validate.yml
git add .github/workflows/docs-validate.yml
git commit -m "ci: install documentation integrity check (ADOPT-OBL-13)"
git push
```

Requires a credential with the **`workflows`** permission. The current GitHub App
credential does not have it; this was confirmed by executing the push, not by assumption.

**Expected first run: RED.** `FAIL — 13 errors, 443 warnings`. That is the intended and
correct outcome under `VAL-VIS-1746` / `SC-04`. Do not weaken a check to green it. The run
being retrievable — not the run being green — is what constitutes `EV4`.

### Standing prohibition, still in force

`ADOPT-02` blocks new specification work — including PART 07 of any document — until the
`ADOPT-01` obligations are discharged. **No specification work was performed this session.**
`git diff` against `main` for `docs/MASTER_CONTEXT/`, `PROJECT_PHILOSOPHY.md` and
`README.md` is empty.
