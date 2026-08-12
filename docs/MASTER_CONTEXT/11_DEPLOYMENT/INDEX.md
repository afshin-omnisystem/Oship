---
Document ID: MCX-11-001
Title: Deployment Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 11_DEPLOYMENT
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/09_INFRASTRUCTURE/INDEX.md, docs/MASTER_CONTEXT/17_AUTOMATION/INDEX.md
Required By: 09_INFRASTRUCTURE, 17_AUTOMATION, 12_OPERATIONS, 18_TESTING
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: DevOps & Site Reliability Engineering
Last Updated: 2026-08-04
---
# Deployment Knowledge Domain — INDEX

## Purpose

Defines how Oship releases are built, tested, packaged, and promoted across environments, and the release governance that governs each promotion.

## Knowledge Scope

Covers CI/CD pipelines, release strategy, environment promotion, containerization, rollbacks, and release gates. Interfaces with infrastructure (09), automation (17), and operations (12).

## Responsibilities

The owners of this domain are responsible for:

- Own the release and deployment pipeline
- Maintain environment promotion strategy
- Define packaging and containerization
- Document rollback and recovery procedures
- Enforce release gates and versioning

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/09_INFRASTRUCTURE/INDEX.md`
- `docs/MASTER_CONTEXT/17_AUTOMATION/INDEX.md`

## Related Documents

- `docs/deployment/INDEX.md`
- `docs/deployment/RELEASE_STRATEGY.md`
- `docker/`
- `docs/diagrams/deployment/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`RELEASE_STRATEGY.md`](./RELEASE_STRATEGY.md) | SemVer and environment promotion strategy. | PLANNED |
| [`CI_CD_PIPELINE.md`](./CI_CD_PIPELINE.md) | End-to-end build, test, and deploy pipeline. | PLANNED |
| [`ENVIRONMENT_PROMOTION.md`](./ENVIRONMENT_PROMOTION.md) | Promotion gates and environment matrix. | PLANNED |
| [`ROLLBACK_PLAYBOOK.md`](./ROLLBACK_PLAYBOOK.md) | Rollback and recovery procedures. | PLANNED |

## Reading Order

Read RELEASE_STRATEGY first, then CI_CD_PIPELINE, then ENVIRONMENT_PROMOTION, then ROLLBACK_PLAYBOOK.

## AI Reading Order

AI agents modifying CI/CD or releases must read RELEASE_STRATEGY and CI_CD_PIPELINE to respect release governance.

## Cross References

This domain cross-references: `09_INFRASTRUCTURE`, `17_AUTOMATION`, `12_OPERATIONS`, `18_TESTING`

## Future Sections

Future sections and documents planned for this domain:

- Progressive delivery
- Feature flags and canary
- Zero-downtime migration
- Release evidence and audit trail

## AI Usage

AI agents use this domain to implement safe, governed releases that follow the approved strategy and gates.

## Human Usage

DevOps engineers maintain pipelines and approve environment promotions.

## Completion Status

**PLANNED — INDEX complete; links to existing deployment docs; content documents planned.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**25% — Index present; existing RELEASE_STRATEGY linked; additional docs planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
