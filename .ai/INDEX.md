---
File ID: AI-INDEX-001
Title: AI Workspace Master Index
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: README.md
Related Files: .ai/CURRENT_CONTEXT.md, .ai/PROJECT_STATUS.md
AI Priority: CRITICAL
---

# AI Workspace Master Index

Welcome to the **AI Workspace** for `afshin-omnisystem/Oship`. This directory (`.ai/`) serves as the deterministic control plane, institutional memory, and operational context for all AI agents and human engineers contributing to the repository.

## 1. Architectural Purpose

This repository is designed **primarily for AI Agents and secondarily for human developers**. To ensure deterministic behavior, high maintainability, and zero hallucination, every AI agent interacting with this repository must consult the `.ai/` workspace prior to executing any engineering task.

```
       +-------------------------------------------------------------+
       |                        .ai/INDEX.md                         |
       |                (Master Control Plane & TOC)                 |
       +------------------------------+------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
+------------------+        +-------------------+        +--------------------+
| CURRENT_CONTEXT  |        |  PROJECT_STATUS   |        |   ROADMAP_AI.md    |
|  (Active State)  |        |  (Phase & SemVer) |        | (AI Enhancements)  |
+--------+---------+        +---------+---------+        +---------+----------+
         |                            |                            |
         +----------------------------+----------------------------+
                                      |
                                      v
                        +---------------------------+
                        |  Operational Rules & Log  |
                        | (DECISION_LOG, RULES, ...) |
                        +---------------------------+
```

## 2. Directory Navigation & Core Files

| File Name | Purpose | AI Priority | Review Cadence |
| :--- | :--- | :--- | :--- |
| [`INDEX.md`](./INDEX.md) | Central entry point and navigation matrix for the AI workspace. | `CRITICAL` | On Structure Change |
| [`CURRENT_CONTEXT.md`](./CURRENT_CONTEXT.md) | Current architecture state, boundaries, and Phase 0 status. | `CRITICAL` | Every PR / Turn |
| [`SESSION_MEMORY.md`](./SESSION_MEMORY.md) | Persistent working memory, handover protocol, and context state. | `HIGH` | Continuous |
| [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) | Matrix of Phase 0–F and SemVer 0.1–1.0 readiness gates. | `HIGH` | Weekly / Phase Gate |
| [`ROADMAP_AI.md`](./ROADMAP_AI.md) | Specialized roadmap for AI-native agent capabilities and DevOps. | `MEDIUM` | Monthly |
| [`NEXT_ACTION.md`](./NEXT_ACTION.md) | Deterministic task queue and immediate execution priorities. | `HIGH` | Daily / Session End |
| [`DECISION_LOG.md`](./DECISION_LOG.md) | Chronological architectural decision log linking to formal ADRs. | `HIGH` | Per ADR Approval |
| [`LESSONS_LEARNED.md`](./LESSONS_LEARNED.md) | Institutional knowledge base of prompt and DevOps learnings. | `MEDIUM` | Post-Mortem / Phase |
| [`BEST_PRACTICES.md`](./BEST_PRACTICES.md) | Enterprise coding, git etiquette, documentation, and security rules. | `CRITICAL` | Quarterly |
| [`COMMON_MISTAKES.md`](./COMMON_MISTAKES.md) | Known anti-patterns, prohibited operations, and remediation. | `HIGH` | Continuous |
| [`OPTIMIZATION_IDEAS.md`](./OPTIMIZATION_IDEAS.md) | Backlog of performance, cost, and workflow optimization proposals. | `LOW` | Monthly |

## 3. Dedicated Subdirectories

- **`PROMPTS/`**: Standardized system prompts, persona profiles, and agent execution templates.
- **`CHECKLISTS/`**: Deterministic verification checklists for PR reviews, security audits, and releases.
- **`MEMORY/`**: Long-term domain memory dumps, contextual embeddings metadata, and historical state.
- **`RULES/`**: Modular governance rules (e.g., commit linting, dependency policies, branch protections).
- **`WORKFLOWS/`**: Automated execution flows for agentic code generation, triage, and self-healing tests.

## 4. Agent Execution Protocol

1. **Read Context**: Always inspect `CURRENT_CONTEXT.md` and `PROJECT_STATUS.md` before starting work.
2. **Verify Metadata**: Ensure every generated or modified Markdown file contains the standard YAML header.
3. **Check Constraints**: Consult `COMMON_MISTAKES.md` and `BEST_PRACTICES.md` to avoid prohibited operations.
4. **Log Decisions**: Document any structural or architectural trade-off in `DECISION_LOG.md` and link to `docs/ADR/`.
5. **Update Next Actions**: Upon task completion, update `NEXT_ACTION.md` and `SESSION_MEMORY.md`.
