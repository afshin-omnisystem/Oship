---
ID: ADOPT-01-TOOL-001
TITLE: Oship Documentation Validation Infrastructure
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: HIGH
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md, docs/MASTER_CONTEXT/23_STANDARDS/METADATA_STANDARD.md, .ai/METRICS.md
RELATED: .github/workflows/docs-validate.yml, .ai/NEXT_ACTION.md, .ai/PROJECT_STATUS.md
---

# Oship Documentation Validation Infrastructure

**Milestone**: `ADOPT-01` · **Specification**: `TBL-VIS-730` · **Acceptance**: `TBL-VIS-732` (`FA-01`…`FA-12`)

This is the **first executable artefact in Oship's history**. Before it, the repository
was documentation only: 87 Markdown files, ~139 500 lines, and zero installed workflows.
`AOM-VIS-001` PART 06 derived the same conclusion six independent times — that the
highest-value action available to this repository is not another specification document
but a checker that makes the existing corpus verify itself.

---

## 1. Language note — this is a tooling choice, not a `W2` decision

> **Binding, per `FA-08` and `FAL-VIS-341`.**
>
> This checker is written in **Python**. That is a **tooling** choice, made because Python
> is present on every GitHub Actions runner and requires no build step. It is **not** the
> product implementation language, it does **not** pre-empt Wave `W2`, and it **must never
> be cited** — in an ADR, a status document, a PR description, or an agent's reasoning — as
> a de facto decision about what Oship is built in.
>
> The `W2` language decision remains **open** and requires a human principal.

---

## 2. What it checks

| Validator | Module | Checks | Enforces |
| :--- | :--- | :--- | :--- |
| **Markdown** | `validators/markdown_validator.py` | fence balance, empty headings, heading form, fence info strings, link syntax, embedded YAML, embedded JSON, table shape | `VAL-VIS-1592-FENCE`, `DOC-STD-HEADING`, `DOC-STD-FENCE`, `MET-05`, `DOC-STD-TABLE` |
| **Mermaid** | `validators/mermaid_validator.py` | every ` ```mermaid ` block: non-empty, recognised type, balanced quotes and brackets, closed subgraphs, no dangling edges | `VAL-VIS-MERMAID-*` |
| **Identifiers** | `validators/id_validator.py` | `DGM-` `TBL-` `VAL-` `FAL-` `IMG-` `DEC-` `ADR-` `OBL-` — format, uniqueness, contiguity | `TBL-VIS-689`, `VAL-VIS-949`, `VAL-VIS-ID-*` |
| **Anchors** | `validators/anchor_validator.py` | internal anchors, table-of-contents links, cross-file references, duplicate H2 slugs | `MET-05`, `DOC-STD-ANCHOR` |
| **Metadata** | `validators/metadata_validator.py` | frontmatter presence, YAML validity, required canonical fields, enumerations, dates, SemVer | `VAL-VIS-001`, `MCX-23-002` |
| **Metrics** | `validators/metrics_validator.py` | documentation metrics report, visual-density ceiling, two-pass ceiling audit | `AI-MET-001`, `VAL-VIS-1592` |

Every check **names the rule it enforces** in its own output. This is binding under
`VAL-VIS-1639`: a check that does not cite its rule cannot move an artefact to `AS-6`.

---

## 3. Layout

```
tools/docs-validate/
├── README.md                      this file
├── run-validator.py               entry point and report renderer
├── validators/
│   ├── __init__.py
│   ├── base.py                    shared primitives: fences, traversal, results
│   ├── markdown_validator.py
│   ├── mermaid_validator.py
│   ├── id_validator.py
│   ├── anchor_validator.py
│   ├── metadata_validator.py
│   └── metrics_validator.py
├── configs/
│   └── validation-rules.yaml      switches, thresholds, permanent-gap allowlist
├── schemas/
│   └── metadata-schema.yaml       canonical metadata contract and header aliases
├── fixtures/                      deliberate defects, used only by --self-test
└── reports/                       generated output (git-ignored except the baseline)
```

---

## 4. Usage

```bash
# whole repository, human-readable
python3 tools/docs-validate/run-validator.py

# regression fixtures for the acceptance criteria
python3 tools/docs-validate/run-validator.py --self-test

# one validator
python3 tools/docs-validate/run-validator.py --only mermaid

# machine-readable, for CI
python3 tools/docs-validate/run-validator.py --format json

# write both report formats
python3 tools/docs-validate/run-validator.py \
  --report tools/docs-validate/reports/validation-report.json \
  --markdown-report tools/docs-validate/reports/validation-report.md

# show warnings too, and treat them as errors
python3 tools/docs-validate/run-validator.py --show-warnings --strict
```

### Exit codes

| Code | Meaning |
| :---: | :--- |
| `0` | every enabled validator passed |
| `1` | at least one validator reported an `ERROR` |
| `2` | configuration or invocation error |

### Dependencies

**None required.** `PyYAML` is used when importable and a deterministic built-in reader
is used otherwise, so the checker runs on a bare Python 3.8+ interpreter. Install
`mermaid-cli` (`mmdc`) to upgrade Mermaid checking from the structural parser to an
authoritative `mermaid.parse()`; the checker detects it automatically.

---

## 5. Honest failure is the design — do not chase green

> **Binding, per `VAL-VIS-1746` and worked scenario `SC-04`.**
>
> On the existing corpus this checker is **expected to fail**, and it does. `AOM-VIS-001`
> anticipated exactly this and ruled in advance on the response: **keep it failing and
> record obligations.** Do **not** relax a threshold, widen an exclusion, delete a check,
> or add `continue-on-error` to the workflow in order to reach green. A checker that has
> been tuned until it passes measures nothing, and trains its readers to ignore it — which
> is strictly worse than having no checker at all (`VIS-728`).

The permitted way to reach green is to **repair the corpus**, one recorded obligation at
a time, and let the number fall on its own.

### Baseline at installation — 2026-08-15

| Validator | Status | Errors | Warnings |
| :--- | :---: | ---: | ---: |
| Markdown | **PASS** | 0 | 422 |
| Mermaid | **FAIL** | 6 | 0 |
| Identifiers | **FAIL** | 159 | 3 |
| Anchors | **PASS** | 0 | 12 |
| Metadata | **PASS** | 0 | 2 |
| Metrics | **PASS** | 0 | 0 |

The full baseline is committed at `reports/BASELINE-2026-08-15.md`. The findings behind it
are itemised, with an owner and a discharge condition, in
[`docs/reports/ADOPT-01-VALIDATION-BASELINE.md`](../../docs/reports/ADOPT-01-VALIDATION-BASELINE.md).

---

## 6. Acceptance criteria — `TBL-VIS-732`

| ID | Criterion | State | Where it is satisfied |
| :--- | :--- | :---: | :--- |
| `FA-01` | `.github/workflows/docs-validate.yml` exists and is syntactically valid | **MET** | the workflow file |
| `FA-02` | The workflow triggers on push and pull request | **MET** | `on.push.branches: ["**"]`, `on.pull_request` |
| `FA-03` | A run log is retrievable for at least one execution | **PENDING CI** | `upload-artifact` step + job summary; satisfied on first run |
| `FA-04` | The checker exits non-zero when a Mermaid block fails to parse | **MET** | `fixtures/broken-mermaid.md`, asserted by `--self-test` |
| `FA-05` | The checker exits zero on the current corpus | **NOT MET — intentionally** | 165 real defects found; see §5 and `VAL-VIS-1746` |
| `FA-06` | Each check names the `VAL-` rule it enforces in its output | **MET** | `CheckResult.rule`, asserted by `--self-test` |
| `FA-07` | The checker runs against the whole `docs/` tree, not one file | **MET** | `iter_markdown_files`, scope printed in every report header |
| `FA-08` | Its README states that its language is a tooling choice, not a `W2` decision | **MET** | §1 above |
| `FA-09` | Duplicate detection reproduces the known `IMG-VIS-030` class of defect on a fixture | **MET** | `fixtures/duplicate-ids.md`, asserted by `--self-test` |
| `FA-10` | The permanent gaps of `TBL-VIS-689` are not reported as errors | **MET** | `permanent_gaps` allowlist, asserted by `--self-test` |
| `FA-11` | The two legacy caption forms `TBL-VIS-027` and `TBL-VIS-050` are recognised | **MET** | second `TBL` definition pattern, asserted by `--self-test` |
| `FA-12` | Ceiling compliance runs both passes of `VAL-VIS-1592` | **MET** | `_ceiling_audit`; both passes evidenced in every report |

`FA-05` is the one criterion deliberately left unmet. Under `SC-04` that is the correct
state: the checker is installed, it is honest, and the corpus has work to do.

---

## 7. What installing this changes — `TBL-VIS-731`

| Metric | Before | After |
| :--- | :---: | :---: |
| Installed workflows | 0 | **1** |
| `EV4` evidence items | 0 | **≥1 per push** |
| Highest evidence class | `EV3` | **`EV4`** |
| Artefacts at `AS-4` | 0 | **2** |
| Quality gates open | `QG-0`, `QG-1`, `QG-2` | **+ `QG-4`** |
| Maturity level | `M1` SPECIFIED | **`M2` SELF-CHECKING** |
| Waves closed | 0 | **`W1`** |
| Drift denominator `A` | **0** | **non-zero for the first time** |

The drift ratio `DR = S / max(A,1)` has a real denominator for the first time, which means
the `K4` PURE DRIFT classification can finally be recomputed rather than asserted.

---

## 8. Extending it

1. Add `validators/<name>_validator.py` exposing `VALIDATOR_NAME`, `TITLE`, and
   `run(root, config) -> ValidatorResult`.
2. Every `CheckResult` **must** pass a `rule=` citation (`VAL-VIS-1639`).
3. Register the module in `VALIDATORS` in `run-validator.py`.
4. Add a switch under `validation:` in `configs/validation-rules.yaml`.
5. Add a fixture under `fixtures/` and a case to `self_test()` — a check with no
   regression fixture cannot be trusted to still work.

Deferred to **v2** by `TBL-VIS-730`: full cross-reference resolution, visual-density
scoring beyond the line ceiling, and placeholder consistency. Anchor cross-references are
already implemented at `WARNING` severity so that installing v1 cannot be mistaken for
widening its scope.
