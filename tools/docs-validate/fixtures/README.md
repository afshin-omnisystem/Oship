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

> **Do not repair these files.** `VIS-728` records that the defects discovered while
> authoring PARTS 01–06 are the specification's test fixtures. A checker that stops
> detecting them has regressed.
