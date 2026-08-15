---
ID: ADOPT-01-INSP-001
TITLE: ADOPT-01 Phase 1 Repository Inspection Report
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L3 Interfaces
DOMAIN: reports
AI_PRIORITY: HIGH
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: .ai/PROJECT_STATUS.md, .ai/CURRENT_CONTEXT.md, .ai/NEXT_ACTION.md, .ai/METRICS.md
RELATED: tools/docs-validate/README.md, docs/reports/ADOPT-01-VALIDATION-BASELINE.md
---

# ADOPT-01 — Phase 1 Repository Inspection Report

**Milestone**: `ADOPT-01` Documentation Validation Infrastructure
**Inspection date**: 2026-08-15
**Method**: direct filesystem inspection plus a first execution of the new checker.
Every figure below was **measured at inspection time**, not carried forward from a
document, as `VAL-VIS-1745` requires.

---

## 1. Confirmations requested

### 1.1 Current milestone

| Source | Recorded state |
| :--- | :--- |
| `.ai/PROJECT_STATUS.md` (`AI-STAT-001` v1.9.0) | Phase 0 **IN PROGRESS**, target `v0.0.1`; Phase A `READY / PLANNED` |
| `.ai/CURRENT_CONTEXT.md` (`AI-CTX-001` v2.0.0) | Active phase **Phase A — Bounded-Domain Content**; next action is `ADOPT-01`, "binding, and it is not a document" |
| `.ai/NEXT_ACTION.md` | `ADOPT-01` is **P0**, described as "the standing recommendation — highest-value action in the repository", status `PENDING` |
| `.ai/METRICS.md` (`AI-MET-001` v1.0.0) | Documentation count baseline **85**; `MET-01`…`MET-05` thresholds defined but **not computed by any tool** |

**Confirmed milestone: `ADOPT-01`.** It carries a standing subordination rule — no new
specification document and no `AOM-VIS-001` PART 07 may be opened until `ADOPT-01` is
executed or formally refused with a recorded reason (`VAL-VIS-1762`, `VAL-VIS-1771`,
worked scenario `SC-01`). This work executes it.

### 1.2 Current branch

| Item | Value |
| :--- | :--- |
| Default branch | `main` |
| Branch this work was performed on | `arena/01a003bd-oship` |
| Branched from | `c6f34574f0c29c2629f270538fdfc7802e2d70de` on `main` |
| Direct commits to `main` | **none** |

> **Deviation, disclosed.** The milestone brief asked for a branch named
> `feature/adopt-01-doc-validation`. The working session is bound to
> `arena/01a003bd-oship` and cannot create or push another branch; work on any other
> branch would be lost. The substantive constraints — *feature branch, never `main`* —
> are satisfied. Renaming, or opening the PR from a branch of the requested name, is a
> one-command operation for a maintainer with normal repository access.

### 1.3 Existing workflows

| Path | Contents | Installed? |
| :--- | :--- | :---: |
| `.github/workflows/` | **did not exist** | — |
| `.github/workflow-skeletons/` | `ai-governance.yml`, `cd.yml`, `ci.yml`, `documentation.yml`, `issue-triage.yml`, `release.yml`, `security-scan.yml`, `stale.yml` | **No** |

All eight files are **skeletons**. `documentation.yml` is representative: its only steps
are `echo "Phase 0 Skeleton: Linting markdown style…"`. They are inert by directory
placement — GitHub Actions reads `.github/workflows/`, not `.github/workflow-skeletons/`.

**Installed workflow count before this milestone: 0.** This corroborates `EVD-VIS-017`
and is the reason no `EV4` evidence has ever existed.

### 1.4 Existing validation infrastructure

| Location | Before inspection |
| :--- | :--- |
| `tools/` | a single empty `.gitkeep`. **Nothing else.** |
| `scripts/` | a single empty `.gitkeep` |
| `tests/` | a single empty `.gitkeep` |
| Executable validators | **zero** |
| Test harnesses | **zero** |
| Pre-commit hooks | **zero** |
| Metric computation | **zero** — `.ai/METRICS.md` defines `RHS`, `ARS`, `KDS` formulas and cites `.ai/MEMORY/realtime-metrics.json`, but that file does not exist and nothing writes it |

**Confirmed: no validation infrastructure of any kind existed.** Every rule in the corpus
was enforced by convention and by agent diligence alone. The `IMG-VIS-030` collision
repaired during PART 05 is the recorded proof that this is insufficient — it survived
every section-local review and was caught only by a manual whole-file sweep.

---

## 2. Directory inspection

### 2.1 `.ai/` — the control plane

Nineteen Markdown files plus five directories. The five empty directories —
`CHECKLISTS/`, `MEMORY/`, `PROMPTS/`, `RULES/`, `WORKFLOWS/` — are notable: `MEMORY/` is
where `.ai/METRICS.md` says realtime metrics land, and it is empty.

| File | ID | Role |
| :--- | :--- | :--- |
| `PROJECT_STATUS.md` | `AI-STAT-001` | phase and milestone matrix |
| `CURRENT_CONTEXT.md` | `AI-CTX-001` | live architectural context |
| `NEXT_ACTION.md` | — | the P0 task queue |
| `METRICS.md` | `AI-MET-001` | metric formulas and thresholds |
| `AI_AGENT_OPERATING_MANUAL.md` | `AOM-01` | agent operational constitution |
| `DOCUMENTATION_COMPLETION_STANDARD.md` | `DOC-STD-01` | documentation quality contract |
| plus 13 further control documents | | |

### 2.2 `docs/` — the corpus

25 directories. `docs/MASTER_CONTEXT/` holds 24 knowledge domains, each with an
`INDEX.md`, of which only two carry authored content beyond the index:
`01_PRODUCT/SYSTEM_VISION.md` and `04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`.
`docs/ADR/` holds two records plus an index.

### 2.3 `.github/`

Complete community-health and GitOps surface: `CODEOWNERS` (one principal), 12 issue
forms, 5 discussion templates, PR template, `dependabot.yml`, `labels.yml`,
`milestones.yml`, `projects.yml`. All governance-as-documentation; none of it executes.

### 2.4 `tools/`

Empty but for `.gitkeep`. This milestone is its first content.

---

## 3. Measured corpus state at inspection

Measured by the new checker over the whole tree.

| Measurement | Value |
| :--- | ---: |
| Markdown files | **87** |
| Total lines | **139,529** |
| Total words | **825,137** |
| Total bytes | **5,398,598** |
| Mermaid diagrams | **1,998** |
| Diagram identifiers (`DGM-`) | **1,922** |
| Tables | **3,704** |
| Captioned tables (`TBL-`) | **2,368** |
| Code blocks | **4,106** |
| Headings | **10,322** |
| Validation rules (`VAL-`) | **2,427** |
| Failure modes (`FAL-`) | **758** |
| Identifier definitions, all namespaces | **7,587** |
| Application source files | **0** |
| Installed workflows (before) | **0** |

`.ai/METRICS.md` records a documentation count of **85**; the measured figure is **87**.
The drift is small but it is drift, and it is the first thing an automated metric would
have caught. Recorded as `ADOPT-OBL-07`.

---

## 4. Findings

| # | Finding | Consequence |
| :--- | :--- | :--- |
| `F-01` | Zero executable artefacts existed against ~139.5k lines of specification | The `K4` PURE DRIFT classification was accurate; the drift denominator `A` was literally zero |
| `F-02` | Eight workflow files exist but none is installed | `EVD-VIS-017` confirmed; no `EV4` evidence was reachable |
| `F-03` | `.ai/METRICS.md` defines formulas that nothing computes | `MET-01`…`MET-05` were unenforceable; every published metric was hand-asserted |
| `F-04` | `.ai/MEMORY/realtime-metrics.json` is referenced but absent | A documented data flow with no producer |
| `F-05` | Documentation count is 87, recorded as 85 | Hand-maintained metrics drift the moment they are written |
| `F-06` | Two frontmatter dialects coexist (`Document ID:` and `File ID:`) | The metadata schema had to model both to measure conformance honestly rather than declare 38% of files non-conformant on a technicality |
| `F-07` | The corpus contains 165 real defects the checker found on first run | Confirms `VIS-728`: convention alone did not hold |

---

## 5. Phase 1 conclusion

The repository is exactly what `AOM-VIS-001` PART 06 said it was: a large, internally
consistent, well-governed **specification** with **no mechanism of its own**. Every
precondition for `ADOPT-01` holds — no human decision is required, there are no
prerequisites, and `tools/` is empty and unclaimed.

**Phase 1 gate: PASSED.** Proceed to Phase 2.

---

## 6. What Phases 2–4 delivered

| Path | Purpose |
| :--- | :--- |
| `tools/docs-validate/run-validator.py` | entry point, six validators, three report formats, self-test |
| `tools/docs-validate/validators/` | `base` + markdown, mermaid, id, anchor, metadata, metrics validators |
| `tools/docs-validate/configs/validation-rules.yaml` | switches, thresholds, permanent-gap allowlist, rule-citation register |
| `tools/docs-validate/schemas/metadata-schema.yaml` | canonical metadata contract with header-dialect aliases |
| `tools/docs-validate/fixtures/` | regression fixtures for `FA-04`, `FA-09`, `FA-10`, `FA-11` |
| `tools/docs-validate/reports/BASELINE-2026-08-15.md` | the committed first-run baseline |
| `tools/docs-validate/ci/docs-validate.yml` | the workflow required by `FA-01`/`FA-02`, YAML-validated. **Staged, not installed** — see `ADOPT-OBL-13`. |
| `docs/reports/ADOPT-01-VALIDATION-BASELINE.md` | the 165 findings, itemised as discharge-tracked obligations |

Nothing under `docs/MASTER_CONTEXT/` was modified. No frozen content was touched. No
previous `AOM-VIS-001` part was rewritten. Every change is an addition, except for the
`.ai/` control-plane status updates that those documents exist to receive.
