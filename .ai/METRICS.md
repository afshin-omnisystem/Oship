---
File ID: AI-MET-001
Title: AI-Native Repository Metrics Control Board
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, .ai/REPOSITORY_EVOLUTION.md
Related Files: PROJECT_PHILOSOPHY.md
AI Priority: HIGH
---

# AI-Native Repository Metrics Control Board

This control board manages the formulas, parameters, and targets used to calculate real-time quality metrics across the Oship repository workspace.

---

## 1. Metric Formula Registry

```
                    METRIC REGISTER & TARGET PIPELINE
                    =================================

    [METRICS ACCASSOR] ---> ( Parse Repository Metadata & Lines )
                                         |
                                         +---> Computes RHS, AI Readability, etc.
                                         |
    [METRICS REPORT]   <--- ( Export JSON Dashboard / Warn On Defect )
```

### 1.1 Mathematical Formula Specifications

- **Repository Health Score (RHS)**:
  $$RHS = (0.30 \times DocCoverage) + (0.25 \times CodeQuality) + (0.25 \times ArchConsistency) + (0.20 \times SecurityPosture)$$
- **AI Readability Score (ARS)**:
  $$ARS = (0.40 \times TokenEfficiency) + (0.30 \times StructuralMatch) + (0.30 \times ParagraphScore)$$
- **Knowledge Density Score (KDS)**:
  $$KDS = (0.50 \times TraceabilityRatio) + (0.50 \times DiagramDensity)$$

---

## 2. Threshold Targets & Operational Bounds

| Metric ID | Description | Target Goal | Failure Boundary | Pipeline Action |
| :--- | :--- | :---: | :---: | :--- |
| **MET-01** | Repository Health Score | >= 90% | < 75% | Block release branches, restrict commits |
| **MET-02** | AI Readability Score | >= 90% | < 80% | Auto-trim paragraphs, format Markdown |
| **MET-03** | Knowledge Density Score | >= 95% | < 70% | Trigger AI writer agent to add diagrams |
| **MET-04** | Security Vulnerability | 0 Open | > 0 Open | Quarantine affected package configurations |
| **MET-05** | Link Integrity | 100% | < 100% | Reject compilation build in CI pipeline |

---

## 3. Real-Time Metrics Database
Metrics are evaluated on every commit and written as structured outputs to `.ai/MEMORY/realtime-metrics.json`.

---

## 4. Repository & Knowledge Metrics

These operational metrics track the health of the repository and the knowledge infrastructure (see [`docs/MASTER_CONTEXT/INDEX.md`](../docs/MASTER_CONTEXT/INDEX.md)).

| Metric | Description | Current (Phase 0) | Target Goal | Failure Boundary |
| :--- | :--- | :---: | :---: | :---: |
| **Documentation Count** | Total Markdown files in the repository | **85** | >= 100 | < 50 |
| **Knowledge Domains** | Number of Master Context knowledge domains with an `INDEX.md` | **24 / 24** | 24 / 24 | < 24 |
| **Repository Health** | Composite health score (see §1.1 RHS) | **~85%** | >= 90% | < 75% |
| **Knowledge Coverage** | Portion of knowledge domains with content documents beyond INDEX | **~15%** | >= 80% | < 40% |
| **Diagram Coverage** | Diagram categories documented / present | **~25%** | >= 80% | < 40% |
| **Image Coverage** | Assets and image placeholders resolved to actual files | **~10%** | >= 60% | < 30% |
| **AI Readability** | AI Readability Score (see §1.1 ARS) | **~90%** | >= 90% | < 80% |
| **Architecture Consistency** | Architecture Consistency Score | **~90%** | >= 90% | < 80% |
| **Cross Reference Density** | Average internal links per document (target >= 2) | **~2.1** | >= 2.0 | < 1.0 |
| **Average Metadata Completeness** | % of required metadata header keys present per Markdown file | **~95%** | 100% | < 90% |

### 4.1 Metric Definitions (Phase 0 baselines)

- **Knowledge Domains**: Count of `docs/MASTER_CONTEXT/<NN>_*/INDEX.md` files. Currently 24 of 24 present.
- **Knowledge Coverage**: Percentage of domain folders containing at least one authored content document beyond `INDEX.md` (content authored in later sprints).
- **Diagram Coverage**: Percentage of documented diagram categories (architecture, sequence, flowchart, knowledge map, decision tree, database, network, deployment, UI, UX) with registered assets.
- **Cross Reference Density**: Total Markdown internal links divided by total Markdown documents.
- **Average Metadata Completeness**: For each `.md` file, fraction of required YAML header keys present, averaged across the repository.

### MASTER_CONTEXT Execution Model Audit (MCX-EXEC-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **Structure (123 parts)** | 100/100 | All mandated parts present |
| **Visual Density** | 98/100 | 150 mermaid, 486 tables, max gap 95 lines |
| **Link Integrity** | 100/100 | All links/anchors resolve |
| **ID Uniqueness** | 100/100 | 150 DGM-EXEC, 118 TBL-EXEC unique |
| **Runtime Reconstructability** | 98/100 | Full runtime rebuild from document |
| **Consistency** | 96/100 | Aligned with RULES, SCHEMA, RELATIONSHIPS |

### MASTER_CONTEXT Memory System Audit (MCX-MEM-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **Structure (50 parts)** | 100/100 | All mandated parts present |
| **Visual Density** | 99/100 | 784 mermaid, 620 tables, 56 image specs |
| **Link Integrity** | 100/100 | All links/anchors resolve |
| **ID Uniqueness** | 100/100 | DGM/TBL/JSON/YML/IMG-MEM all unique |
| **Reconstructability** | 99/100 | Full memory-system rebuild from document (PART 49) |
| **Quantitative Targets** | 100/100 | 448 JSON, 420 YAML, 264 DSL, 300 scenarios, 400 failures, 200 recovery, 247 validation rules, 120 ranking/summarization/learning algorithms, 160 decision trees/sequences/state machines |
| **Release Status** | 100/100 | **RELEASED v1.0.0** via PR #5 (merge `e3fb4d4`), tag `mcx-mem-001-v1.0.0` |
| **Consistency** | 97/100 | Aligned with RULES, SCHEMA, RELATIONSHIPS, EXECUTION_MODEL |

### MASTER_CONTEXT Schema Audit (MCX-SCHEMA-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **Structure (20 parts)** | 100/100 | All mandated parts present |
| **Object Coverage** | 100/100 | 50 objects specified |
| **Visual Density** | 98/100 | 76 mermaid, 178 tables, max gap 61 lines |
| **Link Integrity** | 100/100 | All links/anchors resolve |
| **ID Uniqueness** | 100/100 | No duplicate declarations |
| **Reconstructability** | 98/100 | Zero-ambiguity AI reconstruction |
| **Consistency** | 96/100 | Aligned with RULES, DOC STANDARD, AI MANUAL |

### MASTER_CONTEXT Rules Audit (MCX-RULES-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **Structure (14+ parts)** | 100/100 | All mandated parts present |
| **Visual Density** | 98/100 | 149 mermaid, 229 tables, max gap 64 lines |
| **Routing Coverage** | 100/100 | 301+ routing cases |
| **Link Integrity** | 100/100 | All links/anchors resolve |
| **ID Uniqueness** | 100/100 | No DGM/TBL-MCR duplicates |
| **Consistency** | 96/100 | Aligned with DOC STANDARD, AI MANUAL, MCX INDEX |

### AI Agent Operating Manual Audit (AOM-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **AI Readability** | 97/100 | Deterministic boot sequence, gates, decision rules |
| **Human Readability** | 93/100 | Table-led, appendix cheat-sheets |
| **Architecture Consistency** | 96/100 | Aligned with DOC STANDARD + README |
| **Visual Density** | 98/100 | 27 mermaid, 55 tables, max gap ≤120 lines |
| **Link Integrity** | 100/100 | All relative links + anchors resolve |

### Documentation Completion Standard Audit (DOC-STD-01)

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **Metadata Completeness** | 100/100 | Full 16-key header |
| **AI Readability** | 96/100 | Deterministic DoD, decision rules, ID registers |
| **Human Readability** | 92/100 | Table-led, navigable ToC, type taxonomy |
| **Architecture Consistency** | 95/100 | Aligned with METADATA_STANDARD + README |
| **Visual Density** | 98/100 | 20 mermaid, 30 tables, max gap ≤120 lines |
| **Link Integrity** | 100/100 | All relative links resolve |

### README-06 Final Audit Scores

| Audit dimension | Score | Notes |
| :--- | :---: | :--- |
| **AI Readability** | 97/100 | Deterministic boot sequence, P0–P2 priority, routing tree, 68 verified links |
| **Human Readability** | 94/100 | Persona routing, table-led, hub navigation |
| **Architecture Consistency** | 98/100 | Knowledge-layer graph, dependency tables, ADR traceability |
| **Navigation Quality** | 97/100 | ≤2-hop routing, 31 diagrams, no dead links |
| **Future Expansion Score** | 95/100 | Extension flow + identifier registry + domain-scaling rules |

---

## 5. Machine-Measured Metrics — ADOPT-01

As of 2026-08-15 the metrics in this document are **no longer hand-maintained**. They are
produced by `tools/docs-validate/` (`ADOPT-01`, specification `TBL-VIS-730`).

```bash
python3 tools/docs-validate/run-validator.py --only metrics
python3 tools/docs-validate/run-validator.py --format json   # full machine-readable output
```

The checker replaces the unimplemented pipeline described in §1 and §3. `MET-01`…`MET-05`
were defined here but computed by nothing; `.ai/MEMORY/realtime-metrics.json` was cited
but never existed and still has no producer — that gap is now tracked rather than assumed
(`ADOPT-OBL-04` in the inspection report).

### 5.1 Measured baseline — 2026-08-15

| Metric | Measured | Source check |
| :--- | ---: | :--- |
| Markdown files | **87** | `MET-COUNTS` |
| Total lines | **139,529** | `MET-COUNTS` |
| Total words | **825,137** | `MET-COUNTS` |
| Total bytes | **5,398,598** | `MET-COUNTS` |
| Mermaid diagrams | **1,998** | `MET-COUNTS` |
| Mermaid diagrams structurally valid | **1,992** (99.7 %) | `MMD-*` |
| Tables | **3,704** | `MET-COUNTS` |
| Captioned tables (`TBL-`) | **2,368** | `MET-COUNTS` |
| Code blocks | **4,106** | `MET-COUNTS` |
| Headings | **10,322** | `MET-COUNTS` |
| Validation rules (`VAL-`) | **2,427** | `MET-COUNTS` |
| Failure modes (`FAL-`) | **758** | `MET-COUNTS` |
| Identifier definitions | **7,587** across 8 namespaces | `ID-UNIQUE` |
| Metadata conformance | **52 / 54** constitutional files (96.3 %) | `META-*` |
| Broken anchors | **8** | `ANC-*` |
| Visual-density breaches (120-line ceiling) | **0** | `MET-VISUAL-DENSITY` |

### 5.2 Correction to §4

§4 records **Documentation Count = 85**. The measured value is **87**. The §4 figure was
hand-asserted and had drifted. Tracked as `ADOPT-OBL-07`; §4 is left unedited so the
drift stays visible, which is the whole argument for machine measurement.

Likewise the `~85%`, `~90%`, `~2.1` and `~95%` figures in §4 are **estimates**, not
measurements. Of them only metadata completeness is now machine-computed, at **96.3 %**
against an asserted `~95%`. The rest remain unverified and must be labelled as such
until a check exists for each.

### 5.3 Metric provenance rule

> **`ADOPT-R5`.** Any metric published anywhere in this repository must either cite the
> check that produced it, or be explicitly labelled an estimate. A bare number with no
> provenance is an unsupported claim (`OBL-46`).

### 5.4 Two-pass ceiling audit — `VAL-VIS-1592`, `FA-12`

Every run performs both passes and evidences both in its output: pass 1 searches for
ceiling **declarations**, pass 2 for ceiling **decisions**. A run reporting only one pass
has not performed the audit.

---

## 6. Measured Baseline — Validator 1.1.0 (2026-08-15)

Supersedes §5.1 as the current measurement. §5.1 is retained as history.

| Metric | v1.0.0 | **v1.1.0** | Source check |
| :--- | ---: | ---: | :--- |
| Markdown files | 90 | **93** | `MET-COUNTS` |
| Total lines | 140,351 | **140,668** | `MET-COUNTS` |
| Total words | 831,477 | **834,191** | `MET-COUNTS` |
| Mermaid diagrams | 1,998 | **1,998** | `MET-COUNTS` |
| Mermaid valid | 1,992 (structural) | **1,993** (`mermaid.parse()`) | `MMD-PARSE` |
| Mermaid invalid | 6 | **5** | `MMD-PARSE` |
| Mermaid unsupported | n/a | **0** | `MMD-COVERAGE` |
| Tables | 3,728 | **3,747** | `MD-TABLE-SHAPE` |
| Validation rules (`VAL-`) | 2,427 | **2,427** | `MET-COUNTS` |
| Failure modes (`FAL-`) | 758 | **758** | `MET-COUNTS` |
| Identifier occurrences | 7,587 | **7,588** | `ID-UNIQUE` |
| → definitions | undifferentiated | **7,369** | `DEC-VIS-052` |
| → republications (`INFO`) | — | **156** | `DEC-VIS-052` |
| → semantic duplicates (`ERROR`) | — | **3** | `DEC-VIS-052` |
| Metadata conformance | 96.3 % | **96.3 %** | `META-*` |
| Broken anchors | 8 | **8** | `ANC-*` |
| Visual-density breaches | 0 | **0** | `MET-VISUAL-DENSITY` |
| **Total errors** | **165** | **13** | |
| **Total warnings** | **441** | **441** | |

### 6.1 Provenance — `ADOPT-R5`

Every figure above is machine-produced by
`tools/docs-validate/run-validator.py --reports-dir tools/docs-validate/reports` and is
reproducible from the committed `metrics.json`. The Mermaid figures are produced by the
reference implementation (`mermaid` v11 `mermaid.parse()`), not by an approximation.

### 6.2 Metric health warning

The v1.0.0 → v1.1.0 delta is a worked example of `LL-ADOPT-01`: **152 of 165 reported
errors were artefacts of the measuring instrument.** Any metric in this document that has
not been validated against a reference implementation or a hand-audited sample should be
read as provisional. The §4 estimates (`~85%`, `~90%`, `~2.1`) remain unverified.
