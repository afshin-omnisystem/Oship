---
Document ID: MCX-23-001
Title: Standards Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L1 Constitutional
Knowledge Domain: 23_STANDARDS
AI Importance: CRITICAL
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/05_AI/INDEX.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
Required By: 05_AI, 04_ARCHITECTURE, 17_AUTOMATION, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Enterprise Standards / Architecture Board
Last Updated: 2026-08-04
---
# Standards Knowledge Domain — INDEX

## Purpose

Defines the canonical standards of Oship: the metadata header, naming conventions, documentation standards, and quality invariants that every file must obey.

## Knowledge Scope

Covers the enterprise metadata header standard, documentation standards, naming conventions, quality gates, and compliance invariants. The authoritative source for how Oship files and knowledge are structured.

## Responsibilities

The owners of this domain are responsible for:

- Own the metadata header standard
- Maintain documentation and naming conventions
- Define quality gates and invariants
- Enforce standard compliance across the repo
- Evolve standards with the knowledge graph

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/05_AI/INDEX.md`
- `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`

## Related Documents

- `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`
- `.ai/BEST_PRACTICES.md`
- `.ai/COMMON_MISTAKES.md`
- `.ai/REPOSITORY_DNA.md`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`METADATA_STANDARD.md`](./METADATA_STANDARD.md) | Canonical enterprise metadata header definition. | ACTIVE |
| [`DOCUMENTATION_STANDARDS.md`](./DOCUMENTATION_STANDARDS.md) | Documentation structure and quality standards. | PLANNED |
| [`NAMING_CONVENTIONS.md`](./NAMING_CONVENTIONS.md) | File, folder, and identifier naming rules. | PLANNED |
| [`QUALITY_GATES.md`](./QUALITY_GATES.md) | Quality gates and repository invariants. | PLANNED |

## Reading Order

Read METADATA_STANDARD first, then DOCUMENTATION_STANDARDS, then NAMING_CONVENTIONS, then QUALITY_GATES.

## AI Reading Order

AI agents MUST read METADATA_STANDARD before creating or editing any markdown file in Oship.

## Cross References

This domain cross-references: `05_AI`, `04_ARCHITECTURE`, `17_AUTOMATION`, `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`

## Future Sections

Future sections and documents planned for this domain:

- Automated metadata linting
- Standard versioning and evolution
- Compliance-check automation
- Standard adoption metrics

## AI Usage

AI agents use this domain as the compliance source of truth when creating files and metadata.

## Human Usage

The architecture board maintains standards and enforces compliance.

## Completion Status

**PLANNED — INDEX complete; links to existing standards docs; content documents planned.**

## Knowledge Layer

This domain belongs to **L1 Constitutional** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**30% — Index present; existing metadata standard linked; additional standards planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
