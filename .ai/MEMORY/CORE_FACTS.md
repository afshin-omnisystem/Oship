<!--- File ID: MEM-CORE-001 -->
<!--- Title: Core Facts -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md -->
<!--- Related Files: .ai/CURRENT_CONTEXT.md, docs/MASTER_CONTEXT/ -->
<!--- AI Priority: Critical -->

# Core Facts

## Immutable Core Facts About Oship

### Fact 001: Project Identity

- **Fact**: Oship - Money Factory, repository afshin-omnisystem/Oship, AI-native enterprise platform
- **Importance**: Critical
- **Date Added**: 2026-08-04
- **Source**: README.md and repository metadata
- **Implications**: All architecture decisions should support AI-native, enterprise-grade, financial/money factory domain possibilities
- **Related Decisions**: DEC-2026-08-04-001, DEC-2026-08-04-002

### Fact 002: AI-First Principle

- **Fact**: Repository designed primarily for AI Agents and secondarily for human developers
- **Importance**: Critical
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification
- **Implications**: .ai workspace is mandatory, documentation must be AI-parseable, workflows optimized for AI, prompts standardized
- **Related Decisions**: DEC-2026-08-04-002, DEC-2026-08-04-004

### Fact 003: Phase 0 Constraint

- **Fact**: Phase 0 is infrastructure only, DO NOT write application code
- **Importance**: Critical
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification
- **Implications**: apps/, services/, packages/ must remain empty with .gitkeep only in Phase 0, single commit message prescribed
- **Related Decisions**: DEC-2026-08-04-008

### Fact 004: Documentation Standard

- **Fact**: Every markdown file must have metadata header: File ID, Title, Version, Status, Owner, Review Date, Dependencies, Related Files, AI Priority
- **Importance**: High
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification - Documentation Metadata Standard
- **Implications**: All future documentation must follow standard, enables determinism and AI parsing
- **Related Decisions**: DEC-2026-08-04-004

### Fact 005: Empty Folder Handling

- **Fact**: Whenever folder would otherwise be empty, create .gitkeep
- **Importance**: High
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification - General Principles
- **Implications**: Requires automation script, CI check for compliance
- **Related Decisions**: DEC-2026-08-04-006

### Fact 006: Branch Strategy

- **Fact**: Branch strategy: main (production), develop (integration), feature/*, hotfix/*, release/*, research/*, experiment/*
- **Importance**: High
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification
- **Implications**: Must document in .github/BRANCH_STRATEGY.md and docs/, enforce via branch protection
- **Related Decisions**: DEC-2026-08-04-009

### Fact 007: Release Strategy

- **Fact**: Semantic Versioning 2.0.0, milestones: Phase 0, Phase A-F, Version 0.1, 0.5, 1.0
- **Importance**: High
- **Date Added**: 2026-08-04
- **Source**: Phase 0 specification
- **Implications**: Must document in RELEASE_STRATEGY, use in GitHub Releases, milestones mirror phases
- **Related Decisions**: DEC-2026-08-04-010

### Fact 008: Current Session Branch

- **Fact**: All work in arena/019fcba3-oship branch per session instructions, push only to this branch
- **Importance**: Critical
- **Date Added**: 2026-08-04
- **Source**: Arena environment metadata
- **Implications**: Never switch to main or other branch, commit message exactly as prescribed, do not push to main
- **Related Decisions**: None

## Future Facts (To Be Added)

- Tech stack decisions (Phase A)
- Database selection
- Cloud provider
- Domain model
