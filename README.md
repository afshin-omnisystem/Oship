---
File ID: ROOT-RME-001
Title: Oship — AI-Native Enterprise Software Development Repository
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / Senior Enterprise Software Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, docs/INDEX.md
Related Files: docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md, .github/CONTRIBUTING.md
AI Priority: CRITICAL
---

# Oship — AI-Native Enterprise Software Development Repository
### *The Enterprise "Money Factory" AI-First Ecosystem*

[![Phase](https://img.shields.io/badge/Lifecycle%20Phase-Phase%200%20(Foundation)-blue?style=for-the-badge)](./docs/roadmap/MILESTONES.md)
[![SemVer](https://img.shields.io/badge/SemVer%202.0.0-v0.1.0--alpha.0-brightgreen?style=for-the-badge)](./docs/deployment/RELEASE_STRATEGY.md)
[![AI Native](https://img.shields.io/badge/AI--Native-Deterministic%20Context-8A2BE2?style=for-the-badge)](./.ai/INDEX.md)
[![GitHub Native](https://img.shields.io/badge/GitHub--Native-Enterprise%20GitOps-black?style=for-the-badge)](./.github/CONTRIBUTING.md)

Welcome to **`afshin-omnisystem/Oship`**. This repository is architected from the ground up as a **world-class AI-Native Enterprise Software Development Repository**. It is designed **primarily for AI Coding Agents and secondarily for human engineers** — enforcing strict determinism, modular separation of concerns, and comprehensive self-documenting governance.

---

## 1. General Architectural Principles

Every contribution, file structure, and workflow in this repository must strictly adhere to our ten core principles:
1. **Enterprise-grade**: Designed for high availability, zero-trust security, strict SLA governance, and modular domain boundaries.
2. **AI-first**: Optimized for LLM context windows, deterministic parsing, explicit instructions, and automated self-healing CI/CD.
3. **GitHub-native**: Leverages GitHub Issue Forms (`.yml`), Discussion templates, declarative GitOps Labels/Milestones/Projects, and GitHub Actions workflows.
4. **Extremely scalable**: Clean directory topology supporting multi-team microservice expansion across `/apps`, `/services`, and `/packages`.
5. **Highly maintainable**: No monolithic files; clear ownership in `.github/CODEOWNERS`; strict dependency documentation.
6. **Self-documenting**: Standardized YAML frontmatter headers on every Markdown document; cross-referenced indexes in every directory.
7. **Future-proof**: Semantic Versioning 2.0.0 lifecycle, formal Architecture Decision Records (ADRs), and institutional lessons learned.
8. **Clean**: No junk, scratch, or temporary files.
9. **Modular**: Clean structural decoupling between top-level blueprints (`/architecture`) and narrative documentation (`/docs/architecture`).
10. **Deterministic**: UTF-8 encoding without BOM, explicit `.gitkeep` files in every otherwise-empty directory, and unambiguous rules.

---

## 2. Navigation & Primary Documentation Portals

| Portal | Path | Purpose | AI Priority |
| :--- | :--- | :--- | :--- |
| **AI Workspace** | [`/.ai/INDEX.md`](./.ai/INDEX.md) | **Critical Control Plane** for AI agents: session memory, active state, task queue, and operational rules. | `CRITICAL` |
| **Documentation Library** | [`/docs/INDEX.md`](./docs/INDEX.md) | Master entry point for all narrative documentation, ADRs, security policies, and roadmaps. | `CRITICAL` |
| **Architecture Blueprints** | [`/architecture/INDEX.md`](./architecture/INDEX.md) | Top-level architectural domain boundaries, schema blueprints, and ubiquitous language. | `HIGH` |
| **Design System** | [`/design/INDEX.md`](./design/INDEX.md) | Brand identity, typography, UX wireframes, atomic design tokens, and UI mockups. | `MEDIUM` |
| **Contributing Guide** | [`/.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) | Etiquette and instructions for both human contributors and AI Coding Agents. | `CRITICAL` |
| **Security Policy** | [`/.github/SECURITY.md`](./.github/SECURITY.md) | Zero-trust security policy, SLA commitments, and vulnerability reporting instructions. | `CRITICAL` |
| **Code of Conduct** | [`/.github/CODE_OF_CONDUCT.md`](./.github/CODE_OF_CONDUCT.md) | Enterprise community standards and professional pledge. | `MEDIUM` |

---

## 3. Repository Topology

The repository follows an enterprise-grade root directory hierarchy. Empty directories are preserved in Git via `.gitkeep` files to ensure cloning determinism.

```
afshin-omnisystem/Oship/
├── .github/          # GitHub templates, ISSUE_TEMPLATE/, DISCUSSION_TEMPLATE/, CODEOWNERS, workflows/
├── .ai/              # AI control plane: CURRENT_CONTEXT.md, SESSION_MEMORY.md, NEXT_ACTION.md, etc.
├── docs/             # Enterprise documentation library: ADR/, MASTER_CONTEXT/, security/, deployment/
├── architecture/     # High-level domain bounded contexts, structural models, and blueprints
├── design/           # UX/UI specifications, brand assets, mockups, wireframes, and design systems
├── assets/           # Static enterprise assets (.gitkeep)
├── configs/          # Shared platform and tooling configurations (.gitkeep)
├── scripts/          # Automated DevOps and administrative utilities (.gitkeep)
├── tools/            # Internal developer and AI assistant toolchains (.gitkeep)
├── tests/            # Test harness architecture and cross-cutting suites (.gitkeep)
├── examples/         # Canonical reference implementations and tutorials (.gitkeep)
├── packages/         # Modular library components and reusable packages (.gitkeep)
├── apps/             # Deployable end-user applications (.gitkeep)
├── services/         # Microservices and backend daemons (.gitkeep)
├── infra/            # Infrastructure-as-Code (Terraform, Bicep, Pulumi) (.gitkeep)
├── deployment/       # Release deployment manifests and environment strategies (.gitkeep)
├── docker/           # Containerization Dockerfiles and base images (.gitkeep)
├── k8s/              # Kubernetes manifests, Helm charts, and Kustomize overlays (.gitkeep)
├── monitoring/       # Application Performance Monitoring (APM) rules (.gitkeep)
├── observability/    # Telemetry metrics, logging, and tracing definitions (.gitkeep)
├── security/         # Threat modeling schemas and compliance automation (.gitkeep)
├── database/         # Database schemas, migrations, and storage models (.gitkeep)
├── storage/          # Object storage, caching, and persistence configs (.gitkeep)
├── apis/             # Open API REST specifications and GraphQL schemas (.gitkeep)
├── sdk/              # Client SDK distributions and language bindings (.gitkeep)
├── plugins/          # Third-party plugin integrations and extensions (.gitkeep)
├── templates/        # Reusable scaffolding templates (.gitkeep)
├── experiments/      # Sandboxed prototype experiments (.gitkeep)
├── research/         # R&D documentation and competitive analysis (.gitkeep)
└── archive/          # Deprecated models and historical records (.gitkeep)
```

---

## 4. Phase 0 Goals & Operational Status

This repository is currently in **Phase 0 (Enterprise Repository Foundation & Infrastructure)**.
- **Strict Invariant**: **DO NOT WRITE APPLICATION CODE DURING PHASE 0.**
- **Scope**: Prepare complete governance, documentation hierarchies, GitHub templates, issue forms, GitOps label/milestone/project configs, and CI/CD workflow skeletons.
- **Next Phase**: Upon completion of Phase 0, the repository will transition to **Phase A (Product Context & Bounded Domains)** as tracked in [`/.ai/PROJECT_STATUS.md`](./.ai/PROJECT_STATUS.md).

---

## 5. Agent Execution Protocol

AI Coding Agents interacting with this repository MUST follow this 5-step deterministic protocol:
1. **Context Initialization**: Read [`/.ai/CURRENT_CONTEXT.md`](./.ai/CURRENT_CONTEXT.md) and [`/.ai/PROJECT_STATUS.md`](./.ai/PROJECT_STATUS.md).
2. **Rule Verification**: Consult [`/.ai/BEST_PRACTICES.md`](./.ai/BEST_PRACTICES.md) and [`/.ai/COMMON_MISTAKES.md`](./.ai/COMMON_MISTAKES.md).
3. **Metadata Adherence**: Ensure every generated Markdown file contains the standard YAML frontmatter header defined in [`/docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`](./docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md).
4. **Structural Preservation**: Never delete `.gitkeep` files from otherwise-empty folders.
5. **Session Handover**: Upon task completion, append an entry to [`/.ai/SESSION_MEMORY.md`](./.ai/SESSION_MEMORY.md) and update [`/.ai/NEXT_ACTION.md`](./.ai/NEXT_ACTION.md).

---

## 6. Community & Governance

- **Reporting Security Issues**: See our private advisory policy in [`/.github/SECURITY.md`](./.github/SECURITY.md).
- **Contributing**: Refer to [`/.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md).
- **Code of Conduct**: Refer to [`/.github/CODE_OF_CONDUCT.md`](./.github/CODE_OF_CONDUCT.md).
- **Support & Triage SLAs**: Refer to [`/.github/SUPPORT.md`](./.github/SUPPORT.md).
