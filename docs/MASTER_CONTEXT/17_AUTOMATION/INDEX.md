---
Document ID: MCX-17-001
Title: Automation Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L4 Configuration
Knowledge Domain: 17_AUTOMATION
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md, docs/MASTER_CONTEXT/18_TESTING/INDEX.md
Required By: 11_DEPLOYMENT, 18_TESTING, 05_AI, 12_OPERATIONS
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: DevOps / Automation Lead
Last Updated: 2026-08-04
---
# Automation Knowledge Domain — INDEX

## Purpose

Defines the automation architecture: CI/CD workflows, GitOps, bot automation, and deterministic automation that keeps Oship self-operating.

## Knowledge Scope

Covers CI/CD workflows, GitOps, scripted automation, bots, self-healing processes, and automation governance. Interfaces with deployment (11) and testing (18).

## Responsibilities

The owners of this domain are responsible for:

- Own CI/CD and automation workflows
- Maintain GitOps and bot automation
- Define automation standards and determinism
- Document self-healing and automation scripts
- Govern automation safety and gates

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md`
- `docs/MASTER_CONTEXT/18_TESTING/INDEX.md`

## Related Documents

- `.github/workflows/`
- `.ai/WORKFLOWS/`
- `scripts/`
- `docs/diagrams/devops/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`CI_CD_AUTOMATION.md`](./CI_CD_AUTOMATION.md) | CI/CD workflow architecture and standards. | PLANNED |
| [`GITOPS.md`](./GITOPS.md) | GitOps model and declarative automation. | PLANNED |
| [`BOT_AUTOMATION.md`](./BOT_AUTOMATION.md) | Bot workflows and automated triage. | PLANNED |
| [`SELF_HEALING.md`](./SELF_HEALING.md) | Self-healing and deterministic automation. | PLANNED |

## Reading Order

Read CI_CD_AUTOMATION first, then GITOPS, then BOT_AUTOMATION, then SELF_HEALING.

## AI Reading Order

AI agents modifying automation must read CI_CD_AUTOMATION and GITOPS to respect determinism and safety gates.

## Cross References

This domain cross-references: `11_DEPLOYMENT`, `18_TESTING`, `05_AI`, `12_OPERATIONS`

## Future Sections

Future sections and documents planned for this domain:

- Intelligent test automation
- Automated knowledge index rebuild
- AI-assisted triage bots
- Policy-as-code enforcement

## AI Usage

AI agents use this domain to implement deterministic, safe automation that follows established workflows.

## Human Usage

DevOps engineers maintain automation and review workflow changes.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core automation documents planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
