---
ID: ADOPT-01-BASE-001
TITLE: ADOPT-01 Validation Baseline and Obligation Register
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L3 Interfaces
DOMAIN: reports
AI_PRIORITY: HIGH
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/run-validator.py, tools/docs-validate/reports/BASELINE-2026-08-15.md
RELATED: docs/reports/ADOPT-01-INSPECTION-REPORT.md, .ai/NEXT_ACTION.md
---

# ADOPT-01 — Validation Baseline and Obligation Register

**First run**: 2026-08-15 · **Result**: `FAIL` · **165 errors · 441 warnings**

> **Scope note.** The Phase 1 inspection measured the pre-`ADOPT-01` corpus at **87**
> Markdown files. The committed baseline was taken after this milestone's own three
> documents entered the corpus and therefore counts **90**. Error and warning counts are
> **identical** in both — the artefact introduced no defects into the corpus it
> validates. Compare **87** against `.ai/METRICS.md`; use **90** for future baselines.

This document exists because the checker fails, and because `VAL-VIS-1746` and worked
scenario `SC-04` rule that the correct response to that failure is **to record it**, not
to soften the checker.

> **Standing prohibition.** No threshold in `configs/validation-rules.yaml` may be
> loosened, no path added to `exclude_paths`, no check deleted, and no
> `continue-on-error` added to `.github/workflows/docs-validate.yml` for the purpose of
> turning this report green. The only admissible route to green is discharging the
> obligations below. A checker tuned until it passes measures nothing (`VIS-728`).

---

## 1. Baseline summary

| Validator | Status | Errors | Warnings |
| :--- | :---: | ---: | ---: |
| Markdown Structural | **PASS** | 0 | 424 |
| Mermaid Diagram | **FAIL** | 6 | 0 |
| Identifier Namespace | **FAIL** | 159 | 3 |
| Anchor and Cross-Reference | **PASS** | 0 | 12 |
| Frontmatter Metadata | **PASS** | 0 | 2 |
| Documentation Metrics | **PASS** | 0 | 0 |

Every check, with its measured count and the rule it enforces, is in
[`tools/docs-validate/reports/BASELINE-2026-08-15.md`](../../tools/docs-validate/reports/BASELINE-2026-08-15.md).

---

## 2. Obligation register

Discharging an obligation means **repairing the corpus**. Each row names the defect
class, its size, the rule it violates, and the condition under which it closes.

| ID | Obligation | Count | Rule | Severity | Discharge condition |
| :--- | :--- | ---: | :--- | :---: | :--- |
| `ADOPT-OBL-01` | Repair 5 Mermaid diagrams with unbalanced or mismatched brackets | 5 | `VAL-VIS-MERMAID-NODE` | **BLOCKING** | `MMD-NODES` reports 0 errors |
| `ADOPT-OBL-02` | Repair 1 Mermaid diagram with an unbalanced double quote | 1 | `VAL-VIS-MERMAID-PARSE` | **BLOCKING** | `MMD-SYNTAX` reports 0 errors |
| `ADOPT-OBL-03` | Resolve 131 duplicate `FAL-VIS-` definitions | 131 | `TBL-VIS-689` | **BLOCKING** | see §3.2 — likely a pattern decision, not 131 repairs |
| `ADOPT-OBL-04` | Resolve 12 duplicate `VAL-ARCH-` definitions | 12 | `TBL-VIS-689` | **BLOCKING** | see §3.2 |
| `ADOPT-OBL-05` | Resolve 11 duplicate `VAL-VIS-` definitions | 11 | `TBL-VIS-689` | **BLOCKING** | see §3.2 |
| `ADOPT-OBL-06` | Adjudicate 5 identifier-contiguity gaps | 5 | `VAL-VIS-ID-CONTIG` | **BLOCKING** | each gap is either filled or added to the permanent-gap allowlist with a recorded reason |
| `ADOPT-OBL-07` | Correct the documentation count in `.ai/METRICS.md` from 85 to the measured 87 | 1 | `AI-MET-001` | warning | `.ai/METRICS.md` cites the checker as its source |
| `ADOPT-OBL-08` | Repair 8 broken internal / table-of-contents anchors | 8 | `MET-05` | warning | `ANC-TOC` and `ANC-INTERNAL` report 0 |
| `ADOPT-OBL-09` | Disambiguate 4 duplicate H2 slugs | 4 | `DOC-STD-ANCHOR` | warning | `ANC-DUPLICATE` reports 0 |
| `ADOPT-OBL-10` | Reconcile 2 out-of-vocabulary `STATUS` values (`APPROVED`, `IN_PROGRESS`) | 2 | `MCX-23-002` | warning | either the documents adopt the vocabulary or `METADATA_STANDARD.md` is amended to admit them |
| `ADOPT-OBL-11` | Triage 424 relative links whose targets do not exist on disk | 424 | `MET-05` | warning | each is classified as a planned artefact or a genuine break; genuine breaks repaired |
| `ADOPT-OBL-12` | Decide whether frontmatter conformance becomes blocking | 1 | `VAL-VIS-001` | decision | `fail_on_missing_fields: true` in the config, or a recorded refusal |

`ADOPT-OBL-01`…`06` are the 165 blocking errors. `ADOPT-OBL-07`…`11` are the warnings.
`ADOPT-OBL-12` is a governance decision, not a repair.

---

## 3. Notes on the two largest classes

### 3.1 Mermaid — 6 diagrams of 1,998 (99.7 % pass)

| File | Line | Defect |
| :--- | ---: | :--- |
| `docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md` | 6740 | unbalanced `"` inside a `note right of` block |
| `docs/MASTER_CONTEXT/INDEX.md` | 6251 | unclosed `{` — `erDiagram` crow's-foot notation |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_EXECUTION_MODEL.md` | 5123 | `F{Mount]` — a genuine typo, `{` closed by `]` |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_RELATIONSHIPS.md` | 307 | unclosed `{` — `erDiagram` |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_RELATIONSHIPS.md` | 3487 | unclosed `{` — `erDiagram` |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md` | 9052 | unclosed `{` — `erDiagram` |

`MASTER_CONTEXT_EXECUTION_MODEL.md:5123` is unambiguously a defect: `F{Mount]` opens a
rhombus and closes a rectangle, and Mermaid will not render it.

The four `erDiagram` findings arise from crow's-foot cardinality (`||--o{`, `}o--o{`),
where `{` and `}` are relationship glyphs rather than node delimiters. **This is a
checker refinement, not a corpus repair**, and it is recorded here rather than silently
patched so that the count in this baseline stays auditable. Tracked as
`ADOPT-OBL-01a`: teach `mermaid_validator` the `erDiagram` cardinality grammar, then
re-baseline. Until that lands the four findings stand — an over-strict checker that is
disclosed is preferable to a lenient one that is not.

### 3.2 Identifiers — 154 duplicate definitions

All 154 come from the **row-class** definition pattern of `TBL-VIS-689`
(`^\| \`NS-nnn\` \|`). The corpus legitimately republishes a rule or failure-mode
identifier as the first cell of a *second* table — for example `TBL-VIS-099` states
`FAL-VIS-001`'s symptom and cause, and `TBL-VIS-100` then states the same identifier's
detection and remediation. Both rows match the pattern; only one is the allocation.

Three readings are available, and choosing between them is a **human decision**:

| Option | Effect | Cost |
| :--- | :--- | :--- |
| **A** — first occurrence is the definition, later rows are restatements | 154 findings clear; matches authoring intent | weakens the sweep: a real re-allocation later in a file becomes invisible |
| **B** — the corpus adopts a distinct continuation marker for restatement rows | preserves full sweep strength | edits to frozen content — **prohibited** under the append-only rule for `AOM-VIS-001` |
| **C** — allocation tables are declared authoritative and only they are scanned | precise | requires each document to designate its allocation tables |

**No option is applied.** `TBL-VIS-689` states the pass criterion as zero duplicate
definitions and names the row class as a definition pattern; narrowing that unilaterally
would be exactly the relaxation `VAL-VIS-1746` forbids. Escalated to the human decision
queue as `ADOPT-OBL-03a`, with **Option A** as the recommendation, since it is the only
option that neither edits frozen content nor requires a corpus-wide convention change.

Note also that the checker already fixes one real false-positive class: a `DEC-` record
whose `### DEC-VIS-nnn` heading and `**Decision ID**` field both matched were counted
twice. That was a checker bug and was corrected before this baseline; it is not a
relaxation, because no corpus defect was excused by it.

---

## 4. What is already clean

Worth recording, because it is evidence and not merely absence of failure:

- **4,106 code fences** — every one balanced.
- **10,322 headings** — none empty, none malformed.
- **798 embedded JSON blocks** — every one parses.
- **3,704 tables** — every one has a delimiter row.
- **13,005 identifier occurrences** — every one correctly formatted.
- **1,992 of 1,998 Mermaid diagrams** — structurally valid.
- **87 of 87 files** — carry parseable YAML frontmatter.
- **52 of 54 constitutional files** — fully metadata-conformant (96.3 %).
- **Zero** visual-density ceiling breaches against the 120-line limit of `VAL-VIS-1592`.

The corpus is in far better condition than "165 errors" suggests. The failures are
concentrated in two narrow classes, and one of those is a checker refinement.

---

## 5. Re-baselining protocol

1. Discharge one obligation.
2. Re-run `python3 tools/docs-validate/run-validator.py --report … --markdown-report …`.
3. Commit the new `reports/BASELINE-<date>.md` **alongside** the previous one — baselines
   are append-only, so the trend is auditable.
4. Update the row's discharge state in §2 here.
5. Never edit a historical baseline.

When §2 reaches zero blocking rows, flip `FA-05` to **MET** in
`tools/docs-validate/README.md` §6 and record the transition in `.ai/PROJECT_STATUS.md`.
