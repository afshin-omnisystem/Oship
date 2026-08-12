---
Document ID: MCX-09-001
Title: Infrastructure Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 09_INFRASTRUCTURE
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md
Required By: 11_DEPLOYMENT, 10_SECURITY, 12_OPERATIONS, 13_OBSERVABILITY
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Senior DevOps / Platform Engineer
Last Updated: 2026-08-04
---
# Infrastructure Knowledge Domain — INDEX

## Purpose

Defines the underlying platform: cloud topology, infrastructure-as-code, environment provisioning, and the compute, network, and storage foundations.

## Knowledge Scope

Covers cloud provider architecture, IaC modules (Terraform/Pulumi), environments, networking, compute, storage, and platform services. Interfaces with deployment (11) and security (10).

## Responsibilities

The owners of this domain are responsible for:

- Own cloud and IaC architecture
- Maintain environment provisioning and topology
- Define networking and compute standards
- Document platform services and dependencies
- Ensure reproducibility of infrastructure

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md`

## Related Documents

- `infra/`
- `k8s/`
- `docker/`
- `docs/diagrams/cloud/`
- `docs/diagrams/network/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`INFRASTRUCTURE_ARCHITECTURE.md`](./INFRASTRUCTURE_ARCHITECTURE.md) | Cloud and platform infrastructure topology. | PLANNED |
| [`IAAS_MANIFESTS.md`](./IAAS_MANIFESTS.md) | Infrastructure-as-Code modules and modules map. | PLANNED |
| [`ENVIRONMENTS.md`](./ENVIRONMENTS.md) | Environment topology and provisioning matrix. | PLANNED |
| [`NETWORKING.md`](./NETWORKING.md) | Networking, VPC, and connectivity standards. | PLANNED |

## Reading Order

Read INFRASTRUCTURE_ARCHITECTURE first, then ENVIRONMENTS, then IAAS_MANIFESTS, then NETWORKING.

## AI Reading Order

AI agents managing infrastructure must read INFRASTRUCTURE_ARCHITECTURE and ENVIRONMENTS before provisioning or modifying platform resources.

## Cross References

This domain cross-references: `11_DEPLOYMENT`, `10_SECURITY`, `12_OPERATIONS`, `13_OBSERVABILITY`

## Future Sections

Future sections and documents planned for this domain:

- Multi-cloud strategy
- Cost optimization
- Disaster recovery topology
- Compliance-scoped infrastructure

## AI Usage

AI agents use this domain to provision consistent, reproducible infrastructure that matches the approved platform design.

## Human Usage

Platform/DevOps engineers maintain infrastructure and review IaC changes.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core infrastructure documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
