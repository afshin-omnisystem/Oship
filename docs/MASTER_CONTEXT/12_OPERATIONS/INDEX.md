---
Document ID: MCX-12-001
Title: Operations Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 12_OPERATIONS
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md, docs/MASTER_CONTEXT/13_OBSERVABILITY/INDEX.md
Required By: 13_OBSERVABILITY, 11_DEPLOYMENT, 09_INFRASTRUCTURE
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Site Reliability Engineering
Last Updated: 2026-08-04
---
# Operations Knowledge Domain — INDEX

## Purpose

Defines day-to-day operational practices: runbooks, incident management, on-call, capacity planning, and operational health that keep Oship running reliably.

## Knowledge Scope

Covers operational runbooks, incident response, on-call schedules, capacity planning, maintenance windows, and operational metrics. Interfaces with observability (13) and deployment (11).

## Responsibilities

The owners of this domain are responsible for:

- Own operational runbooks and procedures
- Maintain incident management and on-call
- Define capacity and scaling planning
- Document maintenance and change procedures
- Track operational health and SLIs

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md`
- `docs/MASTER_CONTEXT/13_OBSERVABILITY/INDEX.md`

## Related Documents

- `docs/operations/`
- `docs/monitoring/`
- `monitoring/`
- `observability/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`RUNBOOKS.md`](./RUNBOOKS.md) | Standard operational runbooks and procedures. | PLANNED |
| [`INCIDENT_MANAGEMENT.md`](./INCIDENT_MANAGEMENT.md) | Incident response and escalation model. | PLANNED |
| [`ONCALL.md`](./ONCALL.md) | On-call schedules and handover procedures. | PLANNED |
| [`CAPACITY_PLANNING.md`](./CAPACITY_PLANNING.md) | Capacity, scaling, and growth planning. | PLANNED |

## Reading Order

Read RUNBOOKS first, then INCIDENT_MANAGEMENT, then ONCALL, then CAPACITY_PLANNING.

## AI Reading Order

AI agents triaging operational issues must read INCIDENT_MANAGEMENT and RUNBOOKS to follow escalation procedures.

## Cross References

This domain cross-references: `13_OBSERVABILITY`, `11_DEPLOYMENT`, `09_INFRASTRUCTURE`

## Future Sections

Future sections and documents planned for this domain:

- SLO/SLA tracking
- Chaos engineering
- Maintenance automation
- Operational risk register

## AI Usage

AI agents use this domain to execute safe operational actions and follow documented procedures during incidents.

## Human Usage

SREs maintain runbooks and manage the incident response lifecycle.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core operations documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
