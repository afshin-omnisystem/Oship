---
Document ID: MCX-06-001
Title: Database Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L3 Interfaces
Knowledge Domain: 06_DATABASE
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/08_BACKEND/INDEX.md
Required By: 04_ARCHITECTURE, 08_BACKEND, 15_API, 10_SECURITY
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Database Architect / Data Engineering Lead
Last Updated: 2026-08-04
---
# Database Knowledge Domain — INDEX

## Purpose

Defines the persistence layer: data models, schemas, migrations, query patterns, and the data governance rules that back all Oship services.

## Knowledge Scope

Covers relational schemas, entity models, ER diagrams, migration strategy, caching, object storage, data governance, and query patterns. Interfaces with backend (08) and API (15).

## Responsibilities

The owners of this domain are responsible for:

- Own the logical and physical data model
- Maintain schema definitions and ER diagrams
- Define migration and versioning strategy
- Document caching and storage topology
- Enforce data governance and integrity rules

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/08_BACKEND/INDEX.md`

## Related Documents

- `database/`
- `storage/`
- `docs/diagrams/database/`
- `docs/diagrams/er/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Canonical logical and physical data model. | PLANNED |
| [`SCHEMA_REGISTRY.md`](./SCHEMA_REGISTRY.md) | Schema definitions and versioned contracts. | PLANNED |
| [`MIGRATIONS.md`](./MIGRATIONS.md) | Migration strategy and change management. | PLANNED |
| [`DATA_GOVERNANCE.md`](./DATA_GOVERNANCE.md) | Data governance, retention, and integrity rules. | PLANNED |

## Reading Order

Read DATA_MODEL first, then SCHEMA_REGISTRY, then MIGRATIONS, then DATA_GOVERNANCE.

## AI Reading Order

AI agents touching persistence must read DATA_MODEL and SCHEMA_REGISTRY before writing queries, schemas, or migrations.

## Cross References

This domain cross-references: `04_ARCHITECTURE`, `08_BACKEND`, `15_API`, `10_SECURITY`

## Future Sections

Future sections and documents planned for this domain:

- Query optimization playbooks
- Data retention and archival
- Analytics and warehousing
- Data lineage and cataloging

## AI Usage

AI agents use this domain to write correct schemas, migrations, and queries that match the authoritative data model.

## Human Usage

Data engineers and DBAs maintain the model and review schema changes.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L3 Interfaces** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core database documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
