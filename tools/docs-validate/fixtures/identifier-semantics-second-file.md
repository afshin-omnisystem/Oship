---
ID: ADOPT-01-FIX-IDSEM2
TITLE: Identifier Cross-File Duplicate Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: MEDIUM
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/fixtures/identifier-semantics.md
RELATED: tools/docs-validate/validators/id_validator.py
---

# Cross-File Duplicate — Case 11

`DGM-FIX-001` is defined here **and** in `identifier-semantics.md`. Two definitions of one
identifier in two files is always a collision (`DEC-VIS-052` §5.6). This is the
`IMG-VIS-030` defect class and must never be excused.

> **Diagram ID:** `DGM-FIX-001`

```mermaid
graph LR
  X[Alpha] --> Y[Beta]
```

A legitimate cross-file **reference** — must not fire:

The rule `VAL-FIX-001` is defined in `identifier-semantics.md` and merely cited here.

| ID | Owner |
| :--- | :--- |
| `VAL-FIX-001` | Architecture Team |
