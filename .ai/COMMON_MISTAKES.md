---
File ID: AI-MIST-001
Title: Common Anti-Patterns & Mistakes
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md
Related Files: .ai/BEST_PRACTICES.md
AI Priority: HIGH
---

# Common Anti-Patterns & Mistakes

## 1. Prohibited Anti-Patterns

| Anti-Pattern | Description | Remediation |
| :--- | :--- | :--- |
| **Omitting Metadata Header** | Creating a Markdown file without the required YAML frontmatter block. | Always insert the standard YAML metadata block at lines 1–11. |
| **Premature Coding** | Creating application code (`.py`, `.ts`, etc.) during Phase 0. | Restrict Phase 0 work exclusively to docs, configs, and skeletons. |
| **Orphaned Empty Directories** | Creating a directory without placing a `.gitkeep` inside it. | Run automated `.gitkeep` verification after creating folder structures. |
| **Hallucinated Dependencies** | Referencing undocumented internal libraries or non-existent files. | Verify dependencies against `docs/INDEX.md` and `.ai/INDEX.md`. |
| **Direct Main Push** | Committing work directly to `main` without going through a pull request. | Follow `docs/development/BRANCH_STRATEGY.md` and use feature branches. |

## 2. Verification Checklist for Agents

Before submitting any commit, verify:
- [ ] No `.js`, `.py`, `.go`, or other application code files were created.
- [ ] Every new Markdown file includes valid YAML frontmatter.
- [ ] No empty folders were left without a `.gitkeep` file.
- [ ] All cross-references point to existing valid file paths.
