---
File ID: DOC-IND-001
Title: Enterprise Documentation Master Index
Version: 1.0.0
Status: ACTIVE
Owner: Technical Writing Team / Enterprise Software Architect
Review Date: 2026-11-04
Dependencies: README.md
Related Files: .ai/INDEX.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
AI Priority: CRITICAL
---

# Enterprise Documentation Master Index

Welcome to the canonical documentation library for `afshin-omnisystem/Oship`. Our documentation is structured as a self-documenting hierarchy designed for fast traversal by both human engineers and AI coding agents.

```
                      +----------------------------------+
                      |         docs/INDEX.md            |
                      |   (Master Documentation Portal)  |
                      +-----------------+----------------+
                                        |
      +---------------------------------+---------------------------------+
      |                                 |                                 |
      v                                 v                                 v
+------------------------+    +-----------------------+    +--------------------------+
|  MASTER_CONTEXT/       |    |      ADR/             |    |     development/         |
|  * Standard Header     |    | * ADR-0001 Arch Init  |    | * BRANCH_STRATEGY.md     |
|  * Active Boundaries   |    | * Architecture Record |    | * LABELS.md              |
+------------------------+    +-----------------------+    +--------------------------+
      |                                 |                                 |
      +---------------------------------+---------------------------------+
                                        |
                                        v
                    +---------------------------------------+
                    |        roadmap/ & deployment/         |
                    | * MILESTONES.md  * PROJECT_BOARDS.md  |
                    | * RELEASE_STRATEGY.md                 |
                    +---------------------------------------+
```

## Documentation Taxonomy & Navigation

| Directory / File | Purpose | AI Priority |
| :--- | :--- | :--- |
| [`MASTER_CONTEXT/`](./MASTER_CONTEXT/INDEX.md) | Canonical repository architecture context and YAML header specification. | `CRITICAL` |
| [`ADR/`](./ADR/INDEX.md) | Architecture Decision Records (ADRs) and formal technical trade-off register. | `CRITICAL` |
| [`architecture/`](./architecture/INDEX.md) | System architecture overview, service boundaries, and domain designs. | `HIGH` |
| [`development/`](./development/INDEX.md) | Branching strategy, git etiquette, and GitHub label definitions. | `CRITICAL` |
| [`deployment/`](./deployment/INDEX.md) | Semantic Versioning release strategy and deployment guidelines. | `HIGH` |
| [`roadmap/`](./roadmap/INDEX.md) | Milestones (Phase 0–F, v0.1–v1.0) and Project Board GitOps definitions. | `HIGH` |
| [`security/`](./security/INDEX.md) | Security threat models, zero-trust policies, and SAST/SCA governance. | `HIGH` |
| [`ai/`](./ai/INDEX.md) | AI agent guidelines, prompt libraries, and execution invariants. | `CRITICAL` |
| [`diagrams/`](./diagrams/INDEX.md) | Comprehensive C4, sequence, ER, network, and architecture diagrams. | `MEDIUM` |
| [`wiki/`](./wiki/INDEX.md) | Complete enterprise Wiki structure and operational onboarding guides. | `MEDIUM` |
| [`community/`](./community/INDEX.md) | GitHub Discussions categories, governance, and interaction models. | `MEDIUM` |
| [`glossary/`](./glossary/INDEX.md) | Enterprise glossary of architectural and domain terminology. | `LOW` |
