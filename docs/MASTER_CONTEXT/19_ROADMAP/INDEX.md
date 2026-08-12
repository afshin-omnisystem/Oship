---
Document ID: MCX-19-001
Title: Roadmap Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L1 Constitutional / L5 Ephemeral
Knowledge Domain: 19_ROADMAP
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md, docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md
Required By: 01_PRODUCT, 02_BUSINESS, 22_DECISIONS, 05_AI
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Program Management / Architect Board
Last Updated: 2026-08-04
---
# Roadmap Knowledge Domain — INDEX

## Purpose

Defines the strategic roadmap: phases, milestones, releases, and priorities that sequence all Oship delivery work.

## Knowledge Scope

Covers the phase model (0-F), milestones, release targets, priorities, and roadmap governance. Interfaces with product (01), business (02), and decisions (22).

## Responsibilities

The owners of this domain are responsible for:

- Own the phase and milestone model
- Maintain release targets and sequencing
- Define priorities and capacity allocation
- Track roadmap status and dependencies
- Link roadmap items to decisions and ADRs

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md`
- `docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md`

## Related Documents

- `docs/roadmap/INDEX.md`
- `docs/roadmap/MILESTONES.md`
- `.ai/ROADMAP_AI.md`
- `.ai/PROJECT_STATUS.md`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`ROADMAP.md`](./ROADMAP.md) | Master strategic roadmap and sequencing. | PLANNED |
| [`PHASES.md`](./PHASES.md) | Phase 0-F model and entry/exit gates. | PLANNED |
| [`MILESTONES.md`](./MILESTONES.md) | Milestone definitions and release targets. | PLANNED |
| [`PRIORITIES.md`](./PRIORITIES.md) | Priority framework and capacity allocation. | PLANNED |

## Reading Order

Read ROADMAP first, then PHASES, then MILESTONES, then PRIORITIES.

## AI Reading Order

AI agents planning work must read ROADMAP and PRIORITIES to align tasks with current-phase goals.

## Cross References

This domain cross-references: `01_PRODUCT`, `02_BUSINESS`, `22_DECISIONS`, `05_AI`

## Future Sections

Future sections and documents planned for this domain:

- Quarterly roadmap reviews
- Dependency graph of roadmap items
- Risk-adjusted planning
- Roadmap analytics

## AI Usage

AI agents use this domain to understand phase gates and align their work with the current strategic priorities.

## Human Usage

Program managers and the architect board maintain the roadmap and sequencing.

## Completion Status

**PLANNED — INDEX complete; links to existing roadmap docs; content documents planned.**

## Knowledge Layer

This domain belongs to **L1 Constitutional / L5 Ephemeral** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**25% — Index present; existing MILESTONES and PROJECT_STATUS linked; additional docs planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
