---
File ID: AI-BEST-001
Title: AI-Native Enterprise Best Practices
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md
Related Files: .ai/COMMON_MISTAKES.md, docs/development/BRANCH_STRATEGY.md
AI Priority: CRITICAL
---

# AI-Native Enterprise Best Practices

## 1. Documentation & Metadata Standards

- **Rule 1.1**: Every Markdown file MUST start with the standard YAML frontmatter header containing File ID, Title, Version, Status, Owner, Review Date, Dependencies, Related Files, and AI Priority.
- **Rule 1.2**: All documentation must be written in professional English using standard UTF-8 encoding.
- **Rule 1.3**: Use clear tables, ASCII/Mermaid diagrams, and structured bulleted lists to maximize AI parsing accuracy.

## 2. Git & Version Control Etiquette

- **Rule 2.1**: Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`).
- **Rule 2.2**: Never commit secrets, credentials, or `.env` files. Ensure security rules in `.github/SECURITY.md` are strictly observed.
- **Rule 2.3**: Always operate on designated feature or working branches (`arena/019fcbef-oship`), never pushing directly to `main` without PR review.

## 3. Architecture & Modular Engineering

- **Rule 3.1**: Maintain strict separation of concerns between top-level directories (e.g., `/architecture` for blueprints vs. `/docs/architecture` for narrative docs).
- **Rule 3.2**: Ensure every empty folder contains a `.gitkeep` file so folder structures remain deterministic across git clones.
- **Rule 3.3**: Document any structural change in `.ai/DECISION_LOG.md` and create a corresponding ADR when required.
