---
ID: ADOPT-01-DELTA-001
TITLE: ADOPT-01 Baseline Delta — Before and After DEC-VIS-052 and ADOPT-OBL-01a
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L3 Interfaces
DOMAIN: reports
AI_PRIORITY: HIGH
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: docs/reports/DEC-VIS-052-identifier-definition-reference-semantics.md, tools/docs-validate/reports/baseline-summary.json
RELATED: docs/reports/ADOPT-01-VALIDATION-BASELINE.md
---

# ADOPT-01 Baseline Delta — 2026-08-15

Compares the committed baseline of validator **v1.0.0** against **v1.1.0**, after
`DEC-VIS-052` (identifier semantics) and `ADOPT-OBL-01a` (Mermaid engine).

Historical evidence is **not overwritten**. `reports/BASELINE-2026-08-15.md` remains as
the v1.0.0 record; the v1.1.0 set is written alongside it, per `ADOPT-R3`.

---

## 1. Headline

| Measure | BEFORE (v1.0.0) | AFTER (v1.1.0) | Δ |
| :--- | ---: | ---: | ---: |
| **Errors** | **165** | **13** | **−152** |
| **Warnings** | **441** | **441** | 0 |
| Overall | `FAIL` | `FAIL` | unchanged — **correctly still red** |

> **No error was silenced to achieve this.** 152 of the 165 were **false positives** —
> the checker was wrong, not the corpus. In the same change the checker gained **five
> defect classes it previously could not see**, and four genuinely broken diagrams that
> v1.0.0 passed are now caught. Detection capability went **up**.

---

## 2. Corpus measurements

| Metric | BEFORE | AFTER | Why it changed |
| :--- | ---: | ---: | :--- |
| Markdown files | 90 | **92** | +2: `DEC-VIS-052` record and the identifier-semantics fixtures' second file. **Validator-only** — no corpus document was added or edited. |
| Total lines | 140,351 | **140,668** | +317, entirely from the two new files above. |
| Total words | 831,477 | **834,191** | +2,714, same cause. |
| Mermaid diagrams | 1,998 | **1,998** | Unchanged. Fixtures are excluded from corpus scope. |
| Tables | 3,728 | **3,738** | +10, from the new decision record. |
| `VAL-` rules | 2,427 | **2,427** | Unchanged. |
| `FAL-` modes | 758 | **758** | Unchanged. |
| Identifier occurrences | 7,587 | **7,588** | +1: `DEC-VIS-052` itself. |
| Metadata conformance | 96.3 % | **96.3 %** | Unchanged. |
| Broken anchors | 8 | **8** | Unchanged. |

**Every corpus metric that could reveal a real change is flat.** The frozen documents were
not touched: `git diff main -- docs/MASTER_CONTEXT/ PROJECT_PHILOSOPHY.md README.md`
returns empty.

---

## 3. Error delta, itemised

| Class | BEFORE | AFTER | Δ | Real or validator-only |
| :--- | ---: | ---: | ---: | :--- |
| Identifier duplicates (undifferentiated) | 154 | — | −154 | **Validator-only.** Reclassified per `DEC-VIS-052`. |
| → of which `REPUBLICATION` (now `INFO`) | — | 156 | +156 | Benign. Evidence retained with definition sites named. |
| → of which `SEMANTIC_DUPLICATE` (`ERROR`) | — | **3** | +3 | **REAL — newly detectable.** |
| → of which `DOUBLE_ALLOCATION` (`ERROR`) | — | 0 | 0 | None present. |
| → of which `CROSS_FILE_DUPLICATE` (`ERROR`) | — | 0 | 0 | None present. |
| Identifier contiguity | 5 | 5 | 0 | Real; unchanged. |
| Mermaid | 6 | **5** | −1 | See §4 — composition changed substantially. |
| **Total** | **165** | **13** | **−152** | |

### 3.1 The three semantic duplicates — real defects, previously invisible

**`VAL-VIS-381`** — definition at `SYSTEM_VISION.md:12017` governs sub-capability
maturity relative to its parent. The restatement at `:13679` instead requires that every
published figure name its method. **Unambiguous defect:** two unrelated rules under one
identifier, and the restated text appears nowhere else in the corpus, so it is not a
mis-citation of a neighbouring rule — it is a rule with no home.

**`VAL-VIS-437`** — definition at `:12166` makes a retention decision citing an undefined
class a HALT. The restatement at `:13674` instead requires that every capability handling
data declare a retention class. Related subject, materially different obligation.

**`VAL-VIS-456`** — definition at `:12207` requires the word "creator" to resolve to one
of the readings `R1`, `R2`, `R3` at every use site. The restatement at `:13676` requires
it to resolve to exactly one defined actor. Close paraphrase; flagged for human
adjudication.

> Rule text above is **described rather than tabulated**. An earlier draft of this
> document reproduced the statements in a two-column table, and the checker correctly
> flagged it as three `CROSS_FILE_DUPLICATE` definitions — a report about identifier
> semantics had itself redefined three identifiers. The finding was a true positive and
> the document was changed, not the rule.

All three sit in `TBL-VIS-394`, the `VAL-VIS-470` release-gate table. Under v1.0.0 they
were buried among 154 identical-looking findings and were, in practice, undiscoverable.

---

## 4. Mermaid — the claim was verified, and was half wrong

The previous session asserted that 4 of 6 Mermaid errors were checker over-strictness
about `erDiagram` crow's-foot notation. Per the mission brief this was **not trusted**. All
2,006 diagram blocks were parsed with the reference implementation — `mermaid` v11
`mermaid.parse()` under `jsdom`.

| | v1.0.0 structural | `mermaid.parse()` ground truth |
| :--- | ---: | ---: |
| Reported invalid (real corpus) | 6 | **5** |
| False positives | **4** | 0 |
| False negatives | **4** | 0 |
| Genuinely correct findings | 2 | 5 |

**The v1.0.0 parser was wrong in both directions.** It rejected valid ER cardinality
(`||--o{`, `}o--o{`) because it counted braces as node delimiters, *and* it passed four
genuinely broken diagrams.

### 4.1 Defects v1.0.0 MISSED — now caught

| Location | Defect |
| :--- | :--- |
| `.ai/AI_AGENT_OPERATING_MANUAL.md:188` | unescaped `(` inside a node label: `S6[Read domain INDEX (task-specific)]` |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md:365` | four nodes declared on one line with no separator |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md:9120` | `requirementDiagram` — `Expecting token of type ':' but found 'db'` |
| `docs/MASTER_CONTEXT/MASTER_CONTEXT_SCHEMA.md:9132` | malformed trailing block |

### 4.2 Diagrams v1.0.0 wrongly rejected — now correctly valid

`docs/MASTER_CONTEXT/INDEX.md:6251` · `MASTER_CONTEXT_RELATIONSHIPS.md:307` ·
`MASTER_CONTEXT_RELATIONSHIPS.md:3487` · `MASTER_CONTEXT_SCHEMA.md:9052` — all valid
`erDiagram` crow's-foot notation.

Only `MASTER_CONTEXT_EXECUTION_MODEL.md:5123` (`F{Mount]`) was correctly identified by
both engines.

### 4.3 `UNSUPPORTED_BY_VALIDATOR`

Per the brief, the structural fallback no longer reports `INVALID` for constructs it
cannot model. Only `graph`/`flowchart` are decidable without a grammar; everything else
returns `UNSUPPORTED_BY_VALIDATOR` at `WARNING`.

| Engine | Invalid | Unsupported | False positives |
| :--- | ---: | ---: | ---: |
| `mermaid.parse` (active) | 5 | 0 | **0** |
| structural fallback | 4 | 612 | **0** |

The fallback abstains on 612 diagrams rather than guessing. Both engines are now free of
false positives on the real corpus.

---

## 5. Warnings — unchanged at 441

| Class | Count | Note |
| :--- | ---: | :--- |
| `MD-LINK-SYNTAX` relative targets not on disk | 424 | `ADOPT-OBL-11`; mostly links to planned artefacts |
| `ANC-TOC` / `ANC-INTERNAL` broken anchors | 8 | `ADOPT-OBL-08` |
| `ANC-DUPLICATE` duplicate H2 slugs | 4 | `ADOPT-OBL-09` |
| `META-VALUES` out-of-vocabulary `STATUS` | 2 | `ADOPT-OBL-10` |
| `ID-CONTIGUITY` non-strict namespaces | 3 | informational |

No warning class was reclassified, suppressed, or promoted.

---

## 6. Rules changed

| Rule / check | Change | Authority |
| :--- | :--- | :--- |
| `ID-UNIQUE` (`TBL-VIS-689`) | Occurrence classification: definition vs reference | `DEC-VIS-052` |
| `MMD-PARSE` (`VAL-VIS-MERMAID-PARSE`) | Engine replaced with `mermaid.parse()`; fallback narrowed | `ADOPT-OBL-01a` |
| `MMD-COVERAGE` (`VAL-VIS-MERMAID-COVER`) | **New** — reports undecidable diagrams | `ADOPT-OBL-01a` |
| `MMD-NODES` | Removed; superseded by `MMD-PARSE` under a real grammar | `ADOPT-OBL-01a` |

`max_duplicate_ids` remains `0`. No path was excluded. No threshold was loosened.

---

## 7. Files changed

| File | Change |
| :--- | :--- |
| `tools/docs-validate/validators/id_validator.py` | occurrence classification |
| `tools/docs-validate/validators/mermaid_validator.py` | rewritten, three engines |
| `tools/docs-validate/run-validator.py` | `--reports-dir`; 17 new self-test cases |
| `tools/docs-validate/configs/validation-rules.yaml` | `republication_policy`, engine options |
| `tools/docs-validate/fixtures/` | 4 new fixture files |
| `docs/reports/DEC-VIS-052-*.md` | new decision record |

**No file under `docs/MASTER_CONTEXT/` was modified.**

---

## 8. Reversibility

```yaml
validation:
  identifiers:
    republication_policy: strict   # restores the v1.0.0 165-error baseline
  mermaid:
    engine: structural             # restores the fallback-only parser
```

Both switches are committed, documented, and exercised. The decision can be audited by
re-running under `strict` and diffing against this document.
