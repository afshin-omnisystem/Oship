---
File ID: GH-CON-001
Title: Enterprise Contributing Guidelines (Human & AI Agents)
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / GitHub Administrator
Review Date: 2026-11-04
Dependencies: README.md
Related Files: .ai/BEST_PRACTICES.md, docs/development/BRANCH_STRATEGY.md
AI Priority: CRITICAL
---

# Enterprise Contributing Guidelines (Human & AI Agents)

## 1. Welcome to Oship

Thank you for contributing to `afshin-omnisystem/Oship` — a world-class AI-Native Enterprise Software Development Repository. We design our engineering workflows to be **AI-first, deterministic, clean, and highly scalable**.

## 2. General Principles & Mandatory Invariants

1. **Phase 0 Restriction**: During Phase 0, **DO NOT WRITE APPLICATION CODE**. Only repository infrastructure, Markdown documentation, YAML configurations, and skeleton templates are permitted.
2. **UTF-8 Determinism**: Every file must be UTF-8 encoded without BOM.
3. **Markdown Metadata Header**: Every Markdown (`.md`) file MUST contain the YAML frontmatter header defined in `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`.
4. **Empty Folder Protection**: Whenever a folder has no other files, it MUST contain a `.gitkeep` file.
5. **No Unnecessary Files**: Never create scratch files, temporary logs, or untracked test scripts.

## 3. Branching & Git Workflow

We enforce an enterprise Git branching strategy:
- **`main`**: Protected production-ready branch.
- **`develop`**: Integration branch for pre-release validation.
- **`feature/*`**: Feature development branches.
- **`arena/*`**: Dedicated AI agent working branches (e.g., `arena/019fcbef-oship`).
- **`hotfix/*`**: Emergency remediation branches.

### Workflow Steps:
1. Create or work within your assigned feature/working branch.
2. Ensure commits use **Conventional Commit** syntax:
   - `chore(repository): initialize enterprise AI-native repository foundation`
   - `docs(architecture): update ADR-0001 with context boundaries`
3. Push changes and submit a pull request using `.github/PULL_REQUEST_TEMPLATE.md`.

## 4. AI Agent Specific Guidelines

If you are an AI Coding Agent contributing to this repository:
1. Read `.ai/CURRENT_CONTEXT.md` and `.ai/PROJECT_STATUS.md` at the start of every session.
2. Check `.ai/COMMON_MISTAKES.md` to ensure no anti-patterns are introduced.
3. Update `.ai/SESSION_MEMORY.md` with your session handover log upon completing work.
4. Verify that every file you write conforms strictly to English Markdown or valid GitHub YAML.
