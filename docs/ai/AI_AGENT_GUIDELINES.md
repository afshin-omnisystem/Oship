---
File ID: DOC-AI-002
Title: Enterprise AI Agent Execution Guidelines
Version: 1.0.0
Status: ACTIVE
Owner: AI Architecture Team
Review Date: 2026-11-04
Dependencies: docs/ai/INDEX.md
Related Files: .ai/INDEX.md, .ai/BEST_PRACTICES.md, .ai/COMMON_MISTAKES.md
AI Priority: CRITICAL
---

# Enterprise AI Agent Execution Guidelines

## 1. Operational Precedence

When an AI agent receives a task in `afshin-omnisystem/Oship`, it must follow this order of precedence:
1. **Repository Invariants**: Check `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md` for header rules and UTF-8 requirements.
2. **Active State**: Inspect `.ai/CURRENT_CONTEXT.md` and `.ai/PROJECT_STATUS.md` to verify the active Phase (Phase 0).
3. **Branch Strategy**: Ensure changes are committed only to the designated working branch (`arena/019fcbef-oship`).
4. **No Hallucination**: Never reference unapproved external packages or create arbitrary files.
