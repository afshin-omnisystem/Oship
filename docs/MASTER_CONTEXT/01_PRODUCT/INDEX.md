---
Document ID: MCX-01-001
Title: Product Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L1 Constitutional / L2 Blueprints
Knowledge Domain: 01_PRODUCT
AI Importance: CRITICAL
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md, docs/MASTER_CONTEXT/03_USERS/INDEX.md, docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md
Required By: 02_BUSINESS, 03_USERS, 19_ROADMAP, 04_ARCHITECTURE
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Product Management / Chief Product Officer
Last Updated: 2026-08-04
---
# Product Knowledge Domain — INDEX

## Purpose

Defines what Oship is, why it exists, the value it delivers to customers, and the product strategy that governs all feature, architecture, and go-to-market decisions.

## Knowledge Scope

Covers the product vision, mission, goals, problem statement, value proposition, target segments, product strategy, feature narrative, success metrics, and competitive positioning. Excludes technical implementation details, which live in the architecture, backend, frontend, and API domains.

## Responsibilities

The owners of this domain are responsible for:

- Own the product vision and mission statements
- Maintain the value proposition and problem statement
- Define and prioritize product strategy and OKRs
- Document feature narratives and success metrics
- Feed downstream architecture and roadmap decisions

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md`
- `docs/MASTER_CONTEXT/03_USERS/INDEX.md`
- `docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md`

## Related Documents

- `docs/roadmap/INDEX.md`
- `docs/roadmap/MILESTONES.md`
- `PROJECT_PHILOSOPHY.md`
- `README.md`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`PRODUCT_VISION.md`](./PRODUCT_VISION.md) | Canonical product vision, mission, and long-term strategic intent. | PLANNED |
| [`VALUE_PROPOSITION.md`](./VALUE_PROPOSITION.md) | Customer value model and differentiation versus alternatives. | PLANNED |
| [`PRODUCT_STRATEGY.md`](./PRODUCT_STRATEGY.md) | Strategic pillars, priorities, and OKR mapping for the product. | PLANNED |
| [`FEATURE_REGISTRY.md`](./FEATURE_REGISTRY.md) | Master register of product features and their lifecycle states. | PLANNED |

## Reading Order

Start at PRODUCT_VISION, then VALUE_PROPOSITION, then PRODUCT_STRATEGY, then FEATURE_REGISTRY.

## AI Reading Order

AI agents building features must read PRODUCT_VISION and FEATURE_REGISTRY before touching implementation domains. Route feature-related prompts here first.

## Cross References

This domain cross-references: `02_BUSINESS`, `03_USERS`, `19_ROADMAP`, `04_ARCHITECTURE`

## Future Sections

Future sections and documents planned for this domain:

- Product analytics and telemetry
- Competitive teardown and positioning
- Pricing and packaging model
- Launch and go-to-market playbooks

## AI Usage

AI agents use this domain to ground feature work in product intent, avoiding implementation drift and hallucinated requirements.

## Human Usage

Product managers and leadership maintain the authoritative product narrative here and review feature scope before build.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L1 Constitutional / L2 Blueprints** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**20% — Index present, core product documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
