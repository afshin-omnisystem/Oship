# Oship Documentation Validation Report

- **Artefact**: `ADOPT-01` — specification `TBL-VIS-730`, acceptance `TBL-VIS-732`
- **Run at**: 2026-08-15T08:15:32Z
- **Scope**: `<whole repository>` (FA-07 whole-tree)
- **Validator version**: 1.2.0
- **Overall**: **FAIL**

> Language note (FA-08): Python is a tooling choice for repository self-validation, not a Wave `W2` product language decision (`FAL-VIS-341`).

## Summary

| Validator | Status | Errors | Warnings |
| :--- | :---: | ---: | ---: |
| Markdown Structural Validator | **PASS** | 0 | 426 |
| Mermaid Diagram Validator | **FAIL** | 5 | 0 |
| Identifier Namespace Validator | **FAIL** | 8 | 3 |
| Anchor and Cross-Reference Validator | **PASS** | 0 | 12 |
| Frontmatter Metadata Validator | **PASS** | 0 | 2 |
| Documentation Metrics Validator | **PASS** | 0 | 0 |

## Checks

| Check | Enforces | Status | Measured | Errors | Warnings |
| :--- | :--- | :---: | ---: | ---: | ---: |
| `MD-FENCE-BALANCE` | `VAL-VIS-1592-FENCE` | PASS | 4113 | 0 | 0 |
| `MD-EMPTY-HEADING` | `DOC-STD-HEADING` | PASS | 10439 | 0 | 0 |
| `MD-HEADING-FORM` | `DOC-STD-HEADING` | PASS | 10439 | 0 | 0 |
| `MD-CODE-FENCE` | `DOC-STD-FENCE` | PASS | 4113 | 0 | 0 |
| `MD-LINK-SYNTAX` | `MET-05` | PASS | 650 | 0 | 426 |
| `MD-EMBEDDED-YAML` | `TBL-VIS-730-YAML` | PASS | 779 | 0 | 0 |
| `MD-EMBEDDED-JSON` | `TBL-VIS-730-JSON` | PASS | 798 | 0 | 0 |
| `MD-TABLE-SHAPE` | `DOC-STD-TABLE` | PASS | 3758 | 0 | 0 |
| `MMD-NONEMPTY` | `VAL-VIS-MERMAID-EMPTY` | PASS | 1998 | 0 | 0 |
| `MMD-TYPE` | `VAL-VIS-MERMAID-TYPE` | PASS | 1998 | 0 | 0 |
| `MMD-PARSE` | `VAL-VIS-MERMAID-PARSE` | FAIL | 1998 | 5 | 0 |
| `MMD-COVERAGE` | `VAL-VIS-MERMAID-COVER` | PASS | 1998 | 0 | 0 |
| `MMD-ENGINE` | `VAL-VIS-MERMAID-PARSE` | PASS | 1998 | 0 | 0 |
| `ID-FORMAT` | `VAL-VIS-ID-FORMAT` | PASS | 13217 | 0 | 0 |
| `ID-UNIQUE` | `TBL-VIS-689` | FAIL | 7588 | 3 | 0 |
| `ID-CONTIGUITY` | `VAL-VIS-ID-CONTIG` | FAIL | 7411 | 5 | 3 |
| `ANC-INTERNAL` | `MET-05` | PASS | 294 | 0 | 0 |
| `ANC-TOC` | `MET-05` | PASS | 292 | 0 | 8 |
| `ANC-CROSSFILE` | `MET-05` | PASS | 0 | 0 | 0 |
| `ANC-DUPLICATE` | `DOC-STD-ANCHOR` | PASS | 3868 | 0 | 4 |
| `META-PRESENT` | `VAL-VIS-001` | PASS | 93 | 0 | 0 |
| `META-PARSE` | `VAL-VIS-001` | PASS | 93 | 0 | 0 |
| `META-REQUIRED` | `MCX-23-002` | PASS | 270 | 0 | 0 |
| `META-VALUES` | `MCX-23-002` | PASS | 186 | 0 | 2 |
| `META-DATES` | `MCX-23-002` | PASS | 99 | 0 | 0 |
| `META-SEMVER` | `MCX-23-002` | PASS | 93 | 0 | 0 |
| `MET-COUNTS` | `AI-MET-001` | PASS | 93 | 0 | 0 |
| `MET-VISUAL-DENSITY` | `VAL-VIS-1592` | PASS | 93 | 0 | 0 |
| `MET-DOC-COUNT` | `AI-MET-001` | PASS | 93 | 0 | 0 |

## Documentation Metrics (`AI-MET-001`)

| Metric | Value |
| :--- | ---: |
| Markdown files | 93 |
| Total lines | 141218 |
| Total words | 838230 |
| Mermaid diagrams | 1998 |
| Tables | 3758 |
| Captioned tables | 2368 |
| Validation rules | 2427 |
| Failure modes | 758 |
