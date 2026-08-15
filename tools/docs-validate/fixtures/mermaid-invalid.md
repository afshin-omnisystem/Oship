---
ID: ADOPT-01-FIX-MMDBAD
TITLE: Malformed Mermaid Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: MEDIUM
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/validators/mermaid_validator.py
RELATED: tools/docs-validate/fixtures/mermaid-valid.md
---

# Malformed Mermaid — must be reported INVALID

Deliberately broken. Do not repair.

## Malformed erDiagram — bad cardinality token

```mermaid
erDiagram
    CUSTOMER |X--oX ORDER : places
```

## Unescaped parenthesis inside a node label

Regression for the class the v1.0.0 structural parser MISSED at
`.ai/AI_AGENT_OPERATING_MANUAL.md:188`.

```mermaid
flowchart TD
    S5 --> S6[Read domain INDEX (task-specific)]
```

## Several nodes on one line without a separator

Regression for the class MISSED at `MASTER_CONTEXT_SCHEMA.md:365`.

```mermaid
flowchart TD
    subgraph CONTAINER[Container]
        C1[Project] C2[Workspace] C3[Repository]
    end
```

## Mismatched node bracket

```mermaid
flowchart TD
    A[Start] --> B{Mount]
```
