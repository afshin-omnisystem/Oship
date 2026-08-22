---
ID: ADOPT-01-FIX-MMDFAM
TITLE: Mermaid Diagram Family Coverage Fixture
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

# Mermaid family coverage — Phase 4 regression fixtures

`ADOPT-OBL-01a` requires the parser to distinguish **valid**, **malformed**,
**unsupported** and **parser-limited** Mermaid. This fixture supplies one diagram per
required family so that a regression in any single grammar is caught in isolation.

Every diagram below has been checked against the reference implementation
(`mermaid@11` `mermaid.parse()` under `jsdom`). The expected verdict is stated in the
heading and asserted by `--self-test`.

## VALID — erDiagram, crow's-foot cardinality

The class `v1.0.0` wrongly rejected. `||--o{` and `}o--o{` are relationship glyphs, not
node delimiters.

```mermaid
erDiagram
    CORTEX ||--o{ DOMAIN : routes
    DOMAIN }o--o{ OWNER : owned_by
    DOMAIN ||--|| POLICY : governed_by
    DOMAIN |o--o| CACHE : may_use
```

## VALID — flowchart

```mermaid
flowchart TD
    A[Start] --> B{Authoritative engine?}
    B -->|Yes| C[mermaid.parse]
    B -->|No| D[MMD-ENGINE error]
    C --> E[Report]
    D --> E
```

## VALID — sequenceDiagram

```mermaid
sequenceDiagram
    participant Agent
    participant Validator
    participant Corpus
    Agent->>Validator: run
    Validator->>Corpus: collect diagrams
    Corpus-->>Validator: 1998 blocks
    Validator-->>Agent: FAIL 5 invalid
```

## VALID — stateDiagram-v2

```mermaid
stateDiagram-v2
    [*] --> Unparsed
    Unparsed --> Valid : mermaid.parse ok
    Unparsed --> Invalid : parse error
    Unparsed --> Unsupported : no grammar available
    Valid --> [*]
```

## INVALID — malformed erDiagram

`|X--oX` is not a cardinality token in any Mermaid version.

```mermaid
erDiagram
    CUSTOMER |X--oX ORDER : places
```

## INVALID — malformed flowchart

Mismatched node bracket: opens with `{`, closes with `]`. This is the exact defect at
`MASTER_CONTEXT_EXECUTION_MODEL.md:5123` (`ADOPT-OBL-02`).

```mermaid
flowchart TD
    A[Start] --> B{Mount]
```
