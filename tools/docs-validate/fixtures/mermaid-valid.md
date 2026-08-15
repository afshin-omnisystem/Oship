---
ID: ADOPT-01-FIX-MMDOK
TITLE: Valid Mermaid Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: MEDIUM
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/validators/mermaid_validator.py
RELATED: tools/docs-validate/fixtures/broken-mermaid.md
---

# Valid Mermaid — must never be reported INVALID

Every diagram here is valid. `ADOPT-OBL-01a` exists because v1.0.0 wrongly rejected
the erDiagram cases below.

## Valid erDiagram with crow's-foot cardinality

```mermaid
erDiagram
    CORTEX ||--o{ DOMAIN : routes
    DOMAIN ||--o{ DOCUMENT : contains
    DOMAIN }o--o{ DOMAIN : depends
    DOMAIN }o--o{ OWNER : owned_by
```

## Valid erDiagram with attributes

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER {
        int orderNumber
        string deliveryAddress
    }
```

## Valid flowchart

```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do the thing]
    B -->|No| D[Stop]
    C --> D
```

## Valid flowchart with subgraphs

```mermaid
flowchart LR
    subgraph Alpha
        A1[One] --> A2[Two]
    end
    subgraph Beta
        B1[Three]
    end
    A2 --> B1
```

## Valid sequenceDiagram

```mermaid
sequenceDiagram
    participant Agent
    participant Repo
    Agent->>Repo: read NEXT_ACTION.md
    Repo-->>Agent: ADOPT-01
    Note right of Agent: builds the checker
```

## Valid stateDiagram-v2

```mermaid
stateDiagram-v2
    [*] --> AS0
    AS0 --> AS1 : specified
    AS1 --> AS2 : authored
    AS2 --> [*]
```

## Valid classDiagram

```mermaid
classDiagram
    class Validator {
        +String name
        +run() Result
    }
    Validator <|-- MermaidValidator
```

## Valid pie

```mermaid
pie title Findings
    "Republication" : 156
    "Semantic" : 3
```
