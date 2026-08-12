---
Document ID: MCX-22-001
Title: Decisions Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L2 Blueprints
Knowledge Domain: 22_DECISIONS
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/23_STANDARDS/INDEX.md
Required By: 04_ARCHITECTURE, 23_STANDARDS, 21_RESEARCH, 19_ROADMAP
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Architecture Board
Last Updated: 2026-08-04
---
# Decisions Knowledge Domain — INDEX

## Purpose

Registers architecture and technical decisions: ADRs, decision context, alternatives, and the record of why Oship is built the way it is.

## Knowledge Scope

Covers architecture decision records (ADRs), decision context, alternatives considered, and the decision log. Interfaces with architecture (04), standards (23), and research (21).

## Responsibilities

The owners of this domain are responsible for:

- Own the ADR registry and decision log
- Maintain decision context and rationale
- Record alternatives and trade-offs
- Link decisions to architecture and standards
- Review and supersede outdated decisions

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/23_STANDARDS/INDEX.md`

## Related Documents

- `docs/ADR/INDEX.md`
- `docs/ADR/ADR-0001-ai-native-repository-architecture.md`
- `.ai/DECISION_LOG.md`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`ADR_REGISTRY.md`](./ADR_REGISTRY.md) | Index of all architecture decision records. | PLANNED |
| [`DECISION_LOG.md`](./DECISION_LOG.md) | Chronological decision register. | PLANNED |
| [`DECISION_TEMPLATE.md`](./DECISION_TEMPLATE.md) | ADR template and acceptance criteria. | PLANNED |
| [`DECISION_REVIEWS.md`](./DECISION_REVIEWS.md) | Decision review and supersession process. | PLANNED |

## Reading Order

Read ADR_REGISTRY first, then DECISION_LOG, then DECISION_TEMPLATE, then DECISION_REVIEWS.

## AI Reading Order

AI agents must read ADR_REGISTRY before proposing architecture changes, and record new decisions per the template.

## Cross References

This domain cross-references: `04_ARCHITECTURE`, `23_STANDARDS`, `21_RESEARCH`, `19_ROADMAP`

## Future Sections

Future sections and documents planned for this domain:

- Decision health and orphan detection
- ADR automation and linting
- Decision impact analysis
- Decision supersession tracking

## AI Usage

AI agents use this domain to understand why decisions were made and to record new ADRs consistently.

## Human Usage

The architecture board reviews and approves decisions through the ADR process.

## Completion Status

**PLANNED — INDEX complete; links to existing ADR docs; content documents planned.**

## Knowledge Layer

This domain belongs to **L2 Blueprints** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**30% — Index present; existing ADR-0001 linked; registry and templates planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
