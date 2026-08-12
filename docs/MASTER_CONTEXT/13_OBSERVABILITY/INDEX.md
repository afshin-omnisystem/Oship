---
Document ID: MCX-13-001
Title: Observability Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration / L5 Ephemeral
Knowledge Domain: 13_OBSERVABILITY
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/12_OPERATIONS/INDEX.md, docs/MASTER_CONTEXT/09_INFRASTRUCTURE/INDEX.md
Required By: 12_OPERATIONS, 09_INFRASTRUCTURE, 08_BACKEND
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: SRE / Observability Lead
Last Updated: 2026-08-04
---
# Observability Knowledge Domain — INDEX

## Purpose

Defines how Oship is measured and diagnosed: metrics, logs, traces, dashboards, alerting, and the telemetry standards that make the system observable.

## Knowledge Scope

Covers the three pillars (metrics, logs, traces), telemetry schema, dashboards, alerting rules, SLIs/SLOs, and tracing. Interfaces with operations (12) and infrastructure (09).

## Responsibilities

The owners of this domain are responsible for:

- Own telemetry and instrumentation standards
- Maintain metrics, logs, and tracing conventions
- Define dashboards and alerting
- Document SLIs and SLOs
- Drive incident correlation and root-cause analysis

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/12_OPERATIONS/INDEX.md`
- `docs/MASTER_CONTEXT/09_INFRASTRUCTURE/INDEX.md`

## Related Documents

- `observability/`
- `monitoring/`
- `docs/monitoring/`
- `docs/diagrams/devops/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`TELEMETRY_STANDARDS.md`](./TELEMETRY_STANDARDS.md) | Metrics, logs, and traces standards and schema. | PLANNED |
| [`DASHBOARDS.md`](./DASHBOARDS.md) | Canonical dashboard definitions and ownership. | PLANNED |
| [`ALERTING.md`](./ALERTING.md) | Alerting rules, severity, and response SLAs. | PLANNED |
| [`SLOS.md`](./SLOS.md) | SLIs, SLOs, and error budgets. | PLANNED |

## Reading Order

Read TELEMETRY_STANDARDS first, then SLOS, then DASHBOARDS, then ALERTING.

## AI Reading Order

AI agents debugging production issues must read TELEMETRY_STANDARDS and ALERTING to locate and correlate signals.

## Cross References

This domain cross-references: `12_OPERATIONS`, `09_INFRASTRUCTURE`, `08_BACKEND`

## Future Sections

Future sections and documents planned for this domain:

- Distributed tracing deep-dive
- Log correlation and structured logging
- Cost of observability
- Automated anomaly detection

## AI Usage

AI agents use this domain to add correct instrumentation and to diagnose issues from telemetry signals.

## Human Usage

SREs and observability engineers maintain dashboards, alerts, and SLOs.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration / L5 Ephemeral** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core observability documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
