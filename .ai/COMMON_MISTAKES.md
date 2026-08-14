<!--- File ID: AI-MISTAKES-001 -->
<!--- Title: Common Mistakes and Anti-Patterns -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/BEST_PRACTICES.md -->
<!--- Related Files: .ai/LESSONS_LEARNED.md, .ai/RULES/ -->
<!--- AI Priority: High -->

# Common Mistakes and Anti-Patterns

## Purpose

Document common mistakes to avoid repeat failures. Treat as forbidden list for AI agents and human developers.

## Repository Structure

### MISTAKE-001: Creating Deep Nested Folders Without Justification

- **What**: Creating a/b/c/d/e/f structure with single file at bottom.
- **Why Bad**: Hard to navigate, violates clean principle, not scalable.
- **Instead**: Max 3 levels, use flat where possible.
- **Detection**: Find depth >3 via `find . -type d | awk -F/ '{print NF}'`.

### MISTAKE-002: Leaving Empty Folders Without .gitkeep

- **What**: Empty folder not tracked in Git, other clones miss structure.
- **Why Bad**: Breaks determinism, causes "works on my machine".
- **Instead**: Always create .gitkeep in empty folders.
- **Automation**: `find . -type d -empty -not -path './.git/*' -exec touch {}/.gitkeep \;`

### MISTAKE-003: Writing Application Code in Phase 0

- **What**: Implementing features when task is infrastructure only.
- **Why Bad**: Violates phase goals, creates noise, incomplete foundations lead to tech debt.
- **Instead**: Only infrastructure, no app code. Document app ideas in docs/specifications/ or research/.
- **Check**: No code in apps/, services/, packages/ in Phase 0.

### MISTAKE-004: Root Clutter

- **What**: Placing many files directly in root (random scripts, docs).
- **Why Bad**: Root should be clean, professional.
- **Instead**: Root allowed only: README.md, LICENSE, .gitignore, .editorconfig, .gitattributes. Everything else in appropriate folder.

## Documentation

### MISTAKE-005: Missing Metadata Header

- **What**: Creating markdown without File ID, Title, Version, Status, Owner, etc header.
- **Why Bad**: Breaks AI parseability, traceability, enterprise standard.
- **Instead**: Use HTML comment header per DOCUMENTATION_STANDARD.md. Automate check in CI later.

### MISTAKE-006: Using Absolute Links Instead of Relative

- **What**: `[Docs](/home/user/docs/README.md)` instead of `[Docs](../docs/README.md)` or `[Docs](./docs/README.md)`.
- **Why Bad**: Breaks when repo cloned elsewhere, breaks in GitHub UI if absolute local path.
- **Instead**: Always relative.

### MISTAKE-007: Mixing Languages or Encodings

- **What**: Non-English content or non-UTF-8 encoding.
- **Why Bad**: Violates enterprise standard, breaks AI processing, excludes global contributors.
- **Instead**: English only, UTF-8 only. Verify with `file --mime`.

### MISTAKE-008: Giant README Files

- **What**: One 5000-line README with everything.
- **Why Bad**: Unmaintainable, not modular.
- **Instead**: Small root README with badges and links, detailed content in docs/ hierarchy with INDEX.md cross-references.

## AI Workspace

### MISTAKE-009: Not Reading CURRENT_CONTEXT.md

- **What**: AI agent starts work without reading current context.
- **Why Bad**: Leads to off-track work, duplicate effort, missing constraints.
- **Instead**: Always read .ai/CURRENT_CONTEXT.md at session start. Log in SESSION_MEMORY.md.

### MISTAKE-010: Forgetting to Update SESSION_MEMORY.md

- **What**: Session memory stale, next agent loses context.
- **Why Bad**: Breaks continuity, repeat work.
- **Instead**: Update SESSION_MEMORY.md throughout session, especially after decisions.

### MISTAKE-011: Not Logging Decisions

- **What**: Architectural decision made but not recorded in DECISION_LOG.md or ADR.
- **Why Bad**: No audit trail, future confusion, repeat debates.
- **Instead**: Log immediately with context, options, decision, consequences.

### MISTAKE-012: Using YAML Outside .github/

- **What**: Creating YAML configs in docs/ or other places when markdown required.
- **Why Bad**: Violates "Markdown only" principle (with .github exception).
- **Instead**: YAML only allowed in .github/ for operational necessities (workflows, issue forms, dependabot, FUNDING). Docs remain markdown.

## GitHub Operations

### MISTAKE-013: Direct Push to main

- **What**: Pushing directly to main bypassing PR.
- **Why Bad**: Breaks protection, no review, risky.
- **Instead**: Always via PR from feature/*, develop, or arena/* branches. Require CODEOWNER review.

### MISTAKE-014: Missing Labels on Issues/PRs

- **What**: Issue without priority, type, size labels.
- **Why Bad**: Cannot triage, no visibility into workload.
- **Instead**: Always add priority, type, size. Use status label for workflow.

### MISTAKE-015: Large PRs

- **What**: PR with 1000+ lines, multiple concerns.
- **Why Bad**: Hard to review, increases defect risk.
- **Instead**: Keep PRs <500 lines, single purpose, focused.

### MISTAKE-016: Empty PR Description

- **What**: PR with no summary, checklist, or context.
- **Why Bad**: Reviewers lack context, quality drops.
- **Instead**: Use PULL_REQUEST_TEMPLATE.md sections: Summary, Type, Checklist, Architecture, Documentation, Tests, Security, Breaking Changes, Screenshots, AI Notes.

### MISTAKE-017: Secrets in Code

- **What**: Hardcoded API keys, passwords, tokens.
- **Why Bad**: Security breach, credential leak.
- **Instead**: Use environment variables, secrets manager, .env.example, .gitignore .env.

## Code (Future Caution)

### MISTAKE-018: Hardcoded Configuration

- **What**: Config values in code.
- **Why Bad**: Not portable, not scalable, leaks environment specifics.
- **Instead**: Use configs/ folder, environment variables, config management.

### MISTAKE-019: No Tests

- **What**: Feature without tests.
- **Why Bad**: Regressions, low confidence.
- **Instead**: Tests co-located or in tests/ mirroring structure, coverage >80% goal.

## Process

### MISTAKE-020: Multiple Commits for Phase 0 Foundation

- **What**: Committing Phase 0 work in multiple commits.
- **Why Bad**: Violates spec requirement for single clean commit, noisy history.
- **Instead**: One commit: chore(repository): initialize enterprise AI-native repository foundation per spec.

### MISTAKE-021: Creating Unnecessary Files

- **What**: Placeholder files with no purpose (e.g., temp.txt, notes.old).
- **Why Bad**: Clutter, confusion.
- **Instead**: Deterministic - only necessary files per enterprise structure.

### MISTAKE-022: Ignoring .gitignore

- **What**: Committing node_modules/, .env, dist/, build/ etc.
- **Why Bad**: Bloated repo, security risk, merge conflicts.
- **Instead**: Comprehensive .gitignore covering dependencies, env files, build outputs, caches, OS files, IDE files.

## Detection Checklist

- [ ] Empty folders without .gitkeep? Run find script.
- [ ] Markdown without header? Grep for missing File ID.
- [ ] Absolute links? Grep for `/home/` or `C:\`.
- [ ] Non-UTF-8? Check via file command.
- [ ] Root clutter? List root files, should be limited.
- [ ] App code in Phase 0? Check apps/, services/, packages/ not empty beyond .gitkeep.
- [ ] YAML outside .github/? Find *.yml outside .github/.
- [ ] Direct push risk? Ensure branch protection will be enabled.
- [ ] Secrets? Scan via secret scanning tools (future).
