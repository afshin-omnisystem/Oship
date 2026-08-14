<!--- File ID: AI-INDEX-001 -->
<!--- Title: AI Workspace Index -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: None -->
<!--- Related Files: .ai/CURRENT_CONTEXT.md, .ai/PROJECT_STATUS.md -->
<!--- AI Priority: Critical -->

# AI Workspace Index

## Overview

This directory is the central nervous system for AI Agents operating within the Oship repository. It provides deterministic context, memory, and operational guidelines to ensure consistent, enterprise-grade performance.

## Purpose

The `.ai` workspace enables:

- **Deterministic AI Operations**: All agents share the same context and rules
- **Session Continuity**: Memory and context persist across sessions
- **Knowledge Management**: Best practices, lessons, and decisions are codified
- **Prompt Engineering**: Standardized prompts for consistent outcomes
- **Workflow Automation**: Documented workflows for AI agents

## Structure

```
.ai/
├── INDEX.md                 # This file - Workspace overview
├── CURRENT_CONTEXT.md       # Current project context and focus
├── SESSION_MEMORY.md        # Active session memory and state
├── PROJECT_STATUS.md        # Project status dashboard
├── ROADMAP_AI.md            # AI-driven roadmap and planning
├── NEXT_ACTION.md           # Next action items for AI agents
├── DECISION_LOG.md          # Architectural and strategic decisions
├── LESSONS_LEARNED.md       # Lessons from previous work
├── BEST_PRACTICES.md        # Codified best practices
├── COMMON_MISTAKES.md       # Anti-patterns to avoid
├── OPTIMIZATION_IDEAS.md    # Future optimization opportunities
├── PROMPTS/                 # Standardized prompts library
├── CHECKLISTS/              # Operational checklists
├── MEMORY/                  # Long-term memory storage
├── RULES/                   # Behavioral and operational rules
└── WORKFLOWS/               # Defined workflows for agents
```

## Documentation Metadata Standard

Every markdown file in this repository MUST include a header:

```markdown
File ID:      Unique identifier (e.g., AI-INDEX-001)
Title:        Descriptive title
Version:      Semantic version
Status:       Draft | Active | Deprecated | Archived
Owner:        Responsible team or role
Review Date:  ISO date of next review
Dependencies: File dependencies
Related Files: Cross-references
AI Priority:  Critical | High | Medium | Low
```

## AI Agent Instructions

1. **Always read** `CURRENT_CONTEXT.md` at session start
2. **Update** `SESSION_MEMORY.md` throughout work
3. **Consult** `BEST_PRACTICES.md` and `RULES/` before actions
4. **Log decisions** in `DECISION_LOG.md`
5. **Record learnings** in `LESSONS_LEARNED.md`
6. **Check** `NEXT_ACTION.md` for pending tasks

## Cross References

- `/docs/MASTER_CONTEXT/` - Human-readable master context
- `/docs/ADR/` - Architecture Decision Records
- `/.github/` - GitHub operational templates
- `/docs/DOCUMENTATION_STANDARD.md` - Documentation standards

## Maintenance

- **Daily**: Update SESSION_MEMORY.md and CURRENT_CONTEXT.md
- **Weekly**: Review PROJECT_STATUS.md and NEXT_ACTION.md
- **Sprint End**: Update ROADMAP_AI.md, DECISION_LOG.md, LESSONS_LEARNED.md
- **Quarterly**: Full audit of all .ai workspace files
