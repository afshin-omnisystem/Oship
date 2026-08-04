---
File ID: AI-RMAP-001
Title: AI-Native Capabilities & Agent Roadmap
Version: 1.0.0
Status: ACTIVE
Owner: AI Architecture Team
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, docs/ai/AI_AGENT_GUIDELINES.md
Related Files: .ai/PROJECT_STATUS.md, docs/roadmap/MILESTONES.md
AI Priority: MEDIUM
---

# AI-Native Capabilities & Agent Roadmap

## 1. Vision

The **Oship** repository is architected to evolve from an AI-assisted development environment into an **autonomous, self-healing, AI-native enterprise ecosystem**. This roadmap outlines the phased rollout of AI agent integrations, automated governance, and intelligent DevOps pipelines.

```
+-------------------------------------------------------------------------+
|                  AI-NATIVE ENTERPRISE CAPABILITY MATURITY               |
+-------------------------------------------------------------------------+
| Level 1: Deterministic Context (Phase 0)                                |
|   * Standardized YAML frontmatter & .ai/ workspace                      |
|   * Structured issue forms and deterministic prompt libraries          |
+-------------------------------------------------------------------------+
| Level 2: Automated Governance & Code Triage (Phase A - Phase B)         |
|   * AI PR Review workflow (ai-governance.yml skeleton)                  |
|   * Automated label triage, security scanning & complexity scoring      |
+-------------------------------------------------------------------------+
| Level 3: Self-Healing CI/CD & Autonomous Test Generation (Phase C - D)  |
|   * Automated regression suite generation for new PRs                   |
|   * Failure analysis and auto-remediation patches                       |
+-------------------------------------------------------------------------+
| Level 4: Continuous Architectural Refinement (Phase E - Phase F)        |
|   * Automated ADR generation from discussions                           |
|   * Dynamic dependency updating and performance cost optimization        |
+-------------------------------------------------------------------------+
```

## 2. Capability Delivery Schedule

| Maturity Level | Target Milestone | Key Deliverables | Active Metric |
| :--- | :--- | :--- | :--- |
| **Level 1** | Phase 0 | Repository infrastructure, `.ai/` control plane, standard headers | 100% Header Compliance |
| **Level 2** | Phase A–B | AI PR review automation, architecture drift detection | < 5m PR Triage Time |
| **Level 3** | Phase C–D | Autonomous test harness generation, CI error self-healing | 85%+ AI Test Coverage |
| **Level 4** | Phase E–F | Full-loop AI feedback, continuous cost & token optimization | 99.99% Pipeline SLA |

## 3. Integration Points

- **GitHub Actions**: Workflows in `.github/workflows/ai-governance.yml` execute semantic verification.
- **LLM Context Anchors**: `.ai/CURRENT_CONTEXT.md` provides an optimized context window summary for LLMs.
- **Vector Embeddings**: Future phases will index `/docs` and `/architecture` into a dedicated vector store located in `.ai/MEMORY/`.
