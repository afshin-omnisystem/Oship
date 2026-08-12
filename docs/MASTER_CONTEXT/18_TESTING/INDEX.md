---
Document ID: MCX-18-001
Title: Testing Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 18_TESTING
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/17_AUTOMATION/INDEX.md, docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md
Required By: 17_AUTOMATION, 11_DEPLOYMENT, 08_BACKEND, 07_FRONTEND
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: QA / Test Engineering Lead
Last Updated: 2026-08-04
---
# Testing Knowledge Domain — INDEX

## Purpose

Defines the testing strategy and quality gates: test pyramid, coverage standards, automation, environments, and the evidence that validates every change.

## Knowledge Scope

Covers testing strategy, test levels (unit, integration, e2e), coverage budgets, test data, automation, and quality gates. Interfaces with automation (17), deployment (11), and all implementation domains.

## Responsibilities

The owners of this domain are responsible for:

- Own the testing strategy and pyramid
- Maintain test levels and coverage budgets
- Define test data and environment management
- Enforce quality gates and evidence
- Coordinate automated and manual testing

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/17_AUTOMATION/INDEX.md`
- `docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md`

## Related Documents

- `tests/`
- `.ai/CHECKLISTS/`
- `docs/testing/`
- `docs/diagrams/flowchart/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) | Overall testing strategy and pyramid. | PLANNED |
| [`TEST_LEVELS.md`](./TEST_LEVELS.md) | Unit, integration, and e2e test conventions. | PLANNED |
| [`COVERAGE.md`](./COVERAGE.md) | Coverage budgets and quality gates. | PLANNED |
| [`TEST_DATA.md`](./TEST_DATA.md) | Test data and environment management. | PLANNED |

## Reading Order

Read TESTING_STRATEGY first, then TEST_LEVELS, then COVERAGE, then TEST_DATA.

## AI Reading Order

AI agents must read TESTING_STRATEGY and COVERAGE before writing tests or changes, to respect quality gates.

## Cross References

This domain cross-references: `17_AUTOMATION`, `11_DEPLOYMENT`, `08_BACKEND`, `07_FRONTEND`

## Future Sections

Future sections and documents planned for this domain:

- Contract testing
- Property-based testing
- Accessibility testing automation
- Performance and load testing

## AI Usage

AI agents use this domain to write tests and evidence that satisfy coverage budgets and quality gates.

## Human Usage

QA engineers maintain the strategy and review quality evidence.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core testing documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
