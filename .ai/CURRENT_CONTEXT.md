---
File ID: AI-CTX-001
Title: Current Repository Architectural Context
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
Related Files: .ai/PROJECT_STATUS.md, .ai/NEXT_ACTION.md
AI Priority: CRITICAL
---

# Current Repository Architectural Context

## 1. Current Phase & Operational State

- **Active Lifecycle Phase**: **Phase 0 — Enterprise Repository Foundation & Infrastructure**
- **Semantic Version Target**: `v0.1.0-alpha.0` (Pre-release foundation)
- **Primary Operational Goal**: Transform `afshin-omnisystem/Oship` into an enterprise-grade, world-class AI-Native Software Development Repository without writing application code.
- **Recent Completion**: PROJECT_PHILOSOPHY.md (Constitutional Document) PART 01 and PART 02 have been completed. The document now contains 95 sections across 10,278 lines covering the complete philosophical, governance, operational, and maturity framework for the repository.

## 2. Technical Boundaries & Architectural Invariants

1. **No Application Code**: During Phase 0, no source code implementations (e.g., `.js`, `.py`, `.go`, `.java`) are permitted. Only governance, docs, YAML configurations, and skeleton templates exist.
2. **UTF-8 Determinism**: Every file must be encoded in UTF-8 without BOM.
3. **Markdown-Only Documentation**: All narrative documentation must be written in Markdown (`.md`) using standard English.
4. **Metadata Header Standard**: Every `.md` file must begin with the YAML frontmatter block defined in `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`.
5. **Directory Integrity**: Empty directories must contain a `.gitkeep` file to ensure Git preservation.

## 3. Active Repository Topology

```
Oship/
├── .github/          # GitHub governance, templates, CODEOWNERS, and CI/CD workflow skeletons
├── .ai/              # AI control plane, session memory, roadmap, and execution context
├── docs/             # Comprehensive enterprise documentation, ADRs, diagrams, and wiki
├── architecture/     # High-level architectural models, domain boundaries, and blueprints
├── design/           # Brand, UX/UI specifications, color systems, and wireframes
├── assets/           # Static enterprise assets
├── configs/          # Shared platform and tooling configurations
├── scripts/          # Automation and DevOps utilities
├── tools/            # Developer and AI assistant toolchains
├── tests/            # Test harness architecture and integration plans
├── examples/         # Canonical usage examples and reference implementations
├── packages/         # Modular library components (Phase C+)
├── apps/             # Deployable end-user applications (Phase C+)
├── services/         # Microservices and backend daemons (Phase C+)
├── infra/            # Infrastructure-as-Code (Terraform, Bicep, Pulumi)
├── deployment/       # Release manifests and deployment strategies
├── docker/           # Containerization definitions and base images
├── k8s/              # Kubernetes manifests, Helm charts, and Kustomize overlays
├── monitoring/       # Application Performance Monitoring (APM) and telemetry policies
├── observability/    # Metrics, logging, and tracing definitions
├── security/         # Threat models, security policies, and vulnerability management
├── database/         # Data schemas, migrations, and storage architecture
├── storage/          # Object storage, caching, and persistence guidelines
├── apis/             # Open API specifications, GraphQL schemas, and contracts
├── sdk/              # Client SDK distributions and language bindings
├── plugins/          # Extension points and third-party plugin integrations
├── templates/        # Reusable scaffolding templates
├── experiments/      # Sandboxed prototype experiments
├── research/         # R&D documentation and competitive analysis
└── archive/          # Deprecated models and historical records
```

## 4. Immediate Architectural Constraints for Agents

- Always verify branch protection policies defined in `docs/development/BRANCH_STRATEGY.md`.
- Never delete existing milestone or label definitions.
- Ensure all GitHub issue forms in `.github/ISSUE_TEMPLATE/` conform to modern GitHub YAML syntax.
