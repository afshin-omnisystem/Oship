---
File ID: ADR-0001
Title: AI-Native Enterprise Repository Architecture & Phase 0 Foundation
Version: 1.0.0
Status: APPROVED
Owner: Senior Enterprise Software Architect
Review Date: 2026-11-04
Dependencies: docs/ADR/INDEX.md
Related Files: .ai/CURRENT_CONTEXT.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
AI Priority: CRITICAL
---

# ADR-0001: AI-Native Enterprise Repository Architecture & Phase 0 Foundation

## Status

`APPROVED` (2026-08-04)

## Context

Enterprise software repositories frequently suffer from architectural drift, undocumented conventions, implicit human-only knowledge, and unstructured layouts that degrade AI agent comprehension and token efficiency. To transform `afshin-omnisystem/Oship` into an **enterprise-grade, world-class AI-native software repository**, we need an architectural foundation that is deterministic, modular, self-documenting, and GitOps-aligned.

## Decision

We adopt the following structural and governance invariants for `afshin-omnisystem/Oship` during **Phase 0**:
1. **Dedicated AI Control Plane (`.ai/`)**: Establish a dedicated directory with `CURRENT_CONTEXT.md`, `SESSION_MEMORY.md`, and deterministic operational rules to anchor LLM context windows.
2. **Standard YAML Metadata Header**: Enforce that every Markdown document must begin with a YAML frontmatter block containing `File ID`, `Title`, `Version`, `Status`, `Owner`, `Review Date`, `Dependencies`, `Related Files`, and `AI Priority`.
3. **Strict Top-Level Structure**: Standardize top-level directories (`.github/`, `.ai/`, `docs/`, `architecture/`, `design/`, `assets/`, `configs/`, `scripts/`, `tools/`, `tests/`, `examples/`, `packages/`, `apps/`, `services/`, `infra/`, `deployment/`, `docker/`, `k8s/`, `monitoring/`, `observability/`, `security/`, `database/`, `storage/`, `apis/`, `sdk/`, `plugins/`, `templates/`, `experiments/`, `research/`, `archive/`).
4. **Empty Folder Preservation**: Require `.gitkeep` files in every otherwise-empty folder to ensure deterministic git cloning.
5. **Zero Application Code in Phase 0**: Strictly decouple Phase 0 infrastructure preparation from Phase A+ application implementation.

## Consequences

### Positive
- AI coding agents can reliably read system state without hallucinating directory structures or dependencies.
- GitOps declarative files (`.github/labels.yml`, `.github/milestones.yml`, `.github/projects.yml`) enable automated synchronization.
- Seamless scalability from initial scaffolding to enterprise multi-team microservice deployment.

### Negative / Trade-offs
- Requires strict adherence to Markdown frontmatter headers on every documentation file.
- Adds initial structural overhead before application feature code is written.
