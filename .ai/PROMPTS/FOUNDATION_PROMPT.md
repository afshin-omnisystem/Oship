<!--- File ID: PROMPT-FOUNDATION-001 -->
<!--- Title: Foundation Initialization Prompt -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md, .ai/CURRENT_CONTEXT.md -->
<!--- Related Files: .ai/BEST_PRACTICES.md -->
<!--- AI Priority: Critical -->

# Foundation Initialization Prompt

## Purpose

Prompt for AI agents initializing enterprise AI-native repository foundation (Phase 0).

## Inputs

- Repository name
- Current structure (from bash find)
- Phase goals from CURRENT_CONTEXT.md
- Folder list from specification

## Outputs

- Complete folder hierarchy with .gitkeep
- .ai workspace files
- .github templates
- docs hierarchy
- Enterprise root files
- Single commit with prescribed message

## Constraints

- DO NOT write application code
- Every empty folder must contain .gitkeep
- UTF-8, Markdown only (YAML exception for .github operational)
- English only
- Deterministic, enterprise-grade, AI-first
- One commit: chore(repository): initialize enterprise AI-native repository foundation

## Prompt Body

```
You are a Senior Enterprise Software Architect, GitHub Administrator, DevOps Engineer, Technical Writer, and AI Repository Architect.

Repository: {repo_name}

Task: Transform into world-class AI-Native Enterprise Software Development Repository.

Phase 0 Goals: {goals}

Current Structure:
{current_structure}

Required Top-Level Folders:
{top_level_folders}

Required .ai Workspace:
- 11 core markdown files with metadata header (File ID, Title, Version, Status, Owner, Review Date, Dependencies, Related Files, AI Priority)
- 5 subfolders: PROMPTS, CHECKLISTS, MEMORY, RULES, WORKFLOWS each with README and .gitkeep

Required docs Hierarchy:
- 23+ specialized folders plus diagrams/ with 16 types
- Every folder needs INDEX.md or README.md cross-reference
- Define documentation metadata standard

Required .github:
- CODEOWNERS, SECURITY.md, SUPPORT.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, FUNDING.yml, dependabot.yml
- ISSUE_TEMPLATE/ with 11 YAML forms: Bug, Feature, Epic, Task, Research, Documentation, Architecture, Refactor, Security, Performance, Question
- PULL_REQUEST_TEMPLATE.md with sections: Summary, Type, Checklist, Architecture, Documentation, Tests, Security, Breaking Changes, Screenshots, AI Notes
- Workflows skeletons (8 workflows)
- Labels, milestones, projects documentation
- Branch strategy and release strategy

Required design/:
- 12 subfolders: brand, logo, icons, typography, color-system, design-system, wireframes, mockups, screens, animations, ux, ui

Steps:
1. Audit existing repository via bash
2. Create folder hierarchy deterministically
3. Create .ai core files with enterprise content
4. Create .github templates
5. Create docs and design hierarchies with indexes
6. Create root enterprise files (README, LICENSE, .gitignore, .editorconfig, .gitattributes)
7. Ensure .gitkeep in all empty folders via automated script
8. Review for duplicates and consistency
9. Single commit with message: chore(repository): initialize enterprise AI-native repository foundation
10. Return summary

Rules:
- No application code
- UTF-8, Markdown, English only (YAML exception for .github)
- Deterministic, clean, modular, future-proof
- All markdown must have metadata header
- Cross-references everywhere
```

## Example Usage

- Phase 0 repository initialization
- New enterprise repo bootstrap

## Evaluation Criteria

- All folders exist
- .gitkeep in empty folders
- .ai 11 files present with correct metadata
- .github templates present with required sections
- No application code in apps/, services/, packages/
- Single clean commit
- Summary provided
