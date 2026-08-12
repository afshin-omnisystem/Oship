---
Document ID: MCX-07-001
Title: Frontend Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 07_FRONTEND
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/14_DESIGN_SYSTEM/INDEX.md, docs/MASTER_CONTEXT/15_API/INDEX.md
Required By: 14_DESIGN_SYSTEM, 03_USERS, 15_API, 08_BACKEND
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Frontend Engineering Lead
Last Updated: 2026-08-04
---
# Frontend Knowledge Domain — INDEX

## Purpose

Defines the frontend architecture, application structure, state management, component strategy, and rendering approach for all Oship client applications.

## Knowledge Scope

Covers frontend framework choices, app structure, state management, routing, component architecture, performance, and accessibility. Consumes the design system (14) and API contracts (15).

## Responsibilities

The owners of this domain are responsible for:

- Own frontend architecture and app structure
- Maintain state management and data-fetching patterns
- Enforce component architecture and design-system usage
- Define performance and accessibility baselines
- Integrate with backend/API contracts

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/14_DESIGN_SYSTEM/INDEX.md`
- `docs/MASTER_CONTEXT/15_API/INDEX.md`

## Related Documents

- `apps/`
- `packages/`
- `design/ui/`
- `docs/diagrams/frontend/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`FRONTEND_ARCHITECTURE.md`](./FRONTEND_ARCHITECTURE.md) | Frontend structural and rendering architecture. | PLANNED |
| [`STATE_MANAGEMENT.md`](./STATE_MANAGEMENT.md) | State management and data-fetching conventions. | PLANNED |
| [`COMPONENTS.md`](./COMPONENTS.md) | Component architecture and reuse strategy. | PLANNED |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | Performance budgets and optimization playbooks. | PLANNED |

## Reading Order

Read FRONTEND_ARCHITECTURE first, then COMPONENTS, then STATE_MANAGEMENT, then PERFORMANCE.

## AI Reading Order

Frontend requests route: Design System -> Frontend -> UX -> API. AI agents must read FRONTEND_ARCHITECTURE and COMPONENTS before writing UI code.

## Cross References

This domain cross-references: `14_DESIGN_SYSTEM`, `03_USERS`, `15_API`, `08_BACKEND`

## Future Sections

Future sections and documents planned for this domain:

- Micro-frontend strategy
- SSR/ISR evaluation
- Accessibility conformance matrix
- Bundle and runtime budgets

## AI Usage

AI agents use this domain to build consistent, accessible frontend code that follows the established architecture and design system.

## Human Usage

Frontend engineers maintain the architecture and enforce component and performance standards.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core frontend documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
