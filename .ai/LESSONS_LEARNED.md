<!--- File ID: AI-LESSONS-001 -->
<!--- Title: Lessons Learned -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/DECISION_LOG.md -->
<!--- Related Files: .ai/COMMON_MISTAKES.md, .ai/BEST_PRACTICES.md -->
<!--- AI Priority: Medium -->

# Lessons Learned

## Purpose

Capture knowledge from previous work to avoid repeat mistakes and accelerate future work. Every lesson must be actionable.

## Lesson Template

```
ID: LL-YYYY-MM-DD-XXX
Date:
Context:
What happened:
What went well:
What didn't:
Action:
Owner:
```

## Phase 0 Lessons

### LL-2026-08-04-001: Greenfield Repository Advantage

- **Date**: 2026-08-04
- **Context**: Initializing repository with only README.md
- **What happened**: Repo was nearly empty, ideal for clean foundation without migration.
- **What went well**: No legacy structure conflicts, no duplicate cleanup needed yet.
- **What didn't**: Minimal context about intended product (Money Factory) - ambiguous.
- **Action**: Assume enterprise platform, keep structure generic and modular to support any future product direction. Document assumptions in CURRENT_CONTEXT.
- **Owner**: Enterprise Architecture Team

### LL-2026-08-04-002: Importance of .gitkeep Automation

- **Date**: 2026-08-04
- **Context**: Enterprise repos require many folders, most initially empty.
- **What happened**: Manual .gitkeep creation would be error-prone.
- **What went well**: Automated via bash find script.
- **What didn't**: If done too early, later file creation would leave orphan .gitkeep files (harmless but noisy).
- **Action**: Create structure first, add content files, then run final script to add .gitkeep only where still empty. Document in checklists.
- **Owner**: DevOps Engineer

### LL-2026-08-04-003: Markdown Metadata Header Value

- **Date**: 2026-08-04
- **Context**: AI agents need deterministic parsing of documentation.
- **What happened**: Defined HTML comment header standard for all markdown.
- **What went well**: Header is invisible in rendered markdown but machine-readable, enables AI priority triage and dependency tracking.
- **What didn't**: Initial overhead to add to every file.
- **Action**: Create template and checklist to ensure header in all future docs. Include in CONTRIBUTING.md.
- **Owner**: Technical Writer

### LL-2026-08-04-004: YAML Exception Justification

- **Date**: 2026-08-04
- **Context**: Requirement "Markdown only" conflicts with necessary GitHub YAML files.
- **What happened**: Identified need for FUNDING.yml, dependabot.yml, workflows/*.yml, ISSUE_TEMPLATE/*.yml.
- **What went well**: Documented explicit exception with rationale (operational necessity only).
- **What didn't**: Risk of overusing YAML elsewhere.
- **Action**: Enforce rule: YAML allowed ONLY in .github/ for operational purposes. All other docs must be markdown. Add to RULES and BEST_PRACTICES.
- **Owner**: Enterprise Architecture Team

### LL-2026-08-04-005: GitHub Labels and Milestones via API Limitations

- **Date**: 2026-08-04
- **Context**: Task requires creating labels, milestones, project boards.
- **What happened**: In AI sandbox, GitHub API may have limited write permissions or require different scopes.
- **What went well**: Can always document definitions in files (labels.yml, MILESTONES.md, PROJECTS.md) as source of truth.
- **What didn't**: Actual GitHub entities may not be creatable via gh cli in this environment.
- **Action**: Dual strategy: Document in repository files AND attempt via gh cli. If cli fails, files remain as desired state for manual creation later. Note in SUPPORT.md.
- **Owner**: GitHub Administrator

### LL-2026-08-04-006: Branch Naming in Arena Environment

- **Date**: 2026-08-04
- **Context**: Session fixed to arena/019fcba3-oship branch.
- **What happened**: Must not switch branches, must commit and push only to this branch per session instructions.
- **What went well**: Clear isolation for evaluation.
- **What didn't**: Could confuse git history if not documented.
- **Action**: Keep all work on arena/019fcba3-oship, document branch strategy separately. Commit message exactly as prescribed. Do not push to main.
- **Owner**: DevOps Engineer

## General Lessons (Carry Forward)

### Documentation

- Self-documenting repos require index files (README.md or INDEX.md) in every major directory
- Cross-references prevent knowledge silos
- Metadata headers enable automation
- Markdown only is ideal but operational YAML is reality

### GitHub-Native

- Issue forms superior to markdown templates for enterprise triage
- PR templates with checklists improve quality
- CODEOWNERS prevents unreviewed critical changes
- Labels standardize priority, status, type, size
- Milestones enable roadmap tracking
- Projects enable Kanban workflow

### AI-First

- .ai workspace crucial for session continuity
- CURRENT_CONTEXT and SESSION_MEMORY prevent context loss
- Prompt library standardization improves determinism
- Rules and checklists reduce hallucination risk
- Decision log provides audit trail

### Scalability

- Enterprise folders upfront save refactoring later
- Empty folders with .gitkeep preserve intended structure
- Modular design (packages/, apps/, services/) enables microservices later
- infra/, docker/, k8s/, deployment/ separation enables multi-cloud

## Anti-Lessons (What Not to Do Again)

- Do not write app code in Phase 0
- Do not create files without metadata header (except .gitkeep, YAML ops)
- Do not commit without review for duplicates
- Do not use non-English or non-UTF-8
- Do not leave empty folders without .gitkeep
