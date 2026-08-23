---
ID: ADOPT-01-FIX-001
TITLE: Documentation Validator Regression Fixtures
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: MEDIUM
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/run-validator.py
RELATED: tools/docs-validate/README.md
---

# Documentation Validator Regression Fixtures

These files contain **deliberate defects**. They are excluded from the corpus scan by
`global.exclude_paths` in `configs/validation-rules.yaml` and are read only by
`run-validator.py --self-test`.

| Fixture | Acceptance criterion | Asserts |
| :--- | :--- | :--- |
| `broken-mermaid.md` | `FA-04` | the checker exits non-zero when a Mermaid block fails to parse |
| `duplicate-ids.md` | `FA-09` | duplicate detection reproduces the `IMG-VIS-030` class of defect |
| `benign-gaps-and-legacy-captions.md` | `FA-10`, `FA-11` | permanent gaps are not errors; both legacy caption forms are recognised |
| `broken-markdown.md` | `MD-01` | unclosed fences, empty headings and empty link targets are detected |
| `mermaid-valid.md` | `ADOPT-OBL-01a` | 8 valid diagrams, incl. erDiagram crow's-foot, are never `INVALID` |
| `mermaid-invalid.md` | `ADOPT-OBL-01a` | 4 malformed diagrams are `INVALID`, incl. the 2 classes v1.0.0 missed |
| `mermaid-families.md` | `ADOPT-OBL-01a`, `ADOPT-OBL-01b` | per-family verdicts: valid erDiagram / flowchart / sequenceDiagram / stateDiagram, and malformed erDiagram / flowchart |
| `identifier-semantics.md` | `DEC-VIS-052` | cases 1–10 and 12 of the definition-vs-reference model |
| `identifier-semantics-second-file.md` | `DEC-VIS-052` | case 11, cross-file duplicate definition |

## Environment-dependent cases

`mermaid-families.md` is checked by the reference implementation (`mermaid@11`
`mermaid.parse()` under `jsdom`) when it is installed, and its per-family verdicts are
asserted exactly. When it is **not** installed those cases report
`UNSUPPORTED_BY_VALIDATOR` rather than passing vacuously, and `MMD-ENGINE-CLOSED` asserts
that a corpus run in that environment **fails closed** (`ADOPT-OBL-01b`).

```bash
npm install --no-save --no-audit --no-fund mermaid@11 jsdom
python3 tools/docs-validate/run-validator.py --self-test
```

With the engine: 33 executed, 33 passing, 0 unsupported.
Without it: 33 executed, 33 passing, 3 unsupported.

> **Do not repair these files.** `VIS-728` records that the defects discovered while
> authoring PARTS 01–06 are the specification's test fixtures. A checker that stops
> detecting them has regressed.
