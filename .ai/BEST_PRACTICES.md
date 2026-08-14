<!--- File ID: AI-BEST-001 -->
<!--- Title: Best Practices -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md -->
<!--- Related Files: .ai/RULES/, .ai/COMMON_MISTAKES.md -->
<!--- AI Priority: High -->

# Best Practices

## Purpose

Codified best practices for AI agents and human developers working in Oship repository.

## 1. Repository Structure

### DO

- Keep top-level folders focused and single-purpose
- Use .gitkeep for empty folders to preserve structure in Git
- Document each folder with README.md containing purpose, structure, and cross-references
- Keep architecture/, design/, docs/ as source of truth for respective domains
- Use packages/ for shared libraries, apps/ for applications, services/ for microservices

### DONT

- Don't create files directly in root unless necessary (README, LICENSE, .gitignore, .editorconfig, .gitattributes allowed)
- Don't nest more than 3 levels without strong justification
- Don't use generic names like utils1, temp, misc

## 2. Documentation

### Metadata Header (Mandatory for all Markdown)

Every markdown file must start with:

```
File ID: <CATEGORY>-<NAME>-<NUMBER> e.g., DOC-ARCH-001, AI-INDEX-001
Title: Descriptive title
Version: Semantic version (1.0.0)
Status: Draft | Active | Deprecated | Archived
Owner: Team or role
Review Date: ISO date next review
Dependencies: Comma-separated file dependencies
Related Files: Cross-references
AI Priority: Critical | High | Medium | Low
```

Implemented as HTML comments to not affect rendering.

### Writing

- English only, UTF-8 only
- Markdown only for docs (YAML exception only for .github operational)
- Use clear headings (H1 title, H2 sections, H3 subsections)
- Include Overview, Purpose, Structure, Cross References in every index/README
- Use tables for structured data, code blocks for examples
- Keep line length <120 chars where possible
- Use relative links for cross-references

### Organization

- Create INDEX.md in every docs/ subfolder
- Keep ADR (Architecture Decision Records) immutable once accepted
- Maintain glossary for domain terms
- Use diagrams/ for all visual documentation (C4, ER, sequence, etc)
- One concept per file, small focused files over monoliths

## 3. AI Workspace (.ai/)

### Context Management

- Always read CURRENT_CONTEXT.md at session start
- Update SESSION_MEMORY.md throughout session
- Check NEXT_ACTION.md for pending tasks
- Log architectural decisions in DECISION_LOG.md immediately
- Record lessons in LESSONS_LEARNED.md at session end

### Prompts (PROMPTS/)

- Standardize prompts with inputs, outputs, constraints, examples
- Version prompts
- Test prompts with multiple scenarios
- Document AI model preferences if any

### Rules (RULES/)

- Define behavioral constraints for AI agents
- Version rules, require approval for changes
- Keep rules deterministic and testable

### Workflows (WORKFLOWS/)

- Define step-by-step workflows for common tasks (e.g., bug fix, feature addition, release)
- Include preconditions, steps, verification, rollback
- Use checklists for complex workflows

### Memory (MEMORY/)

- Long-term memory for important facts that persist across sessions
- Short-term memory in SESSION_MEMORY.md
- Clean up stale memory quarterly

## 4. GitHub Operations

### Issues

- Use YAML issue forms (not markdown) for structured triage
- Require labels: priority, type, size, status
- Link issues to milestones and projects
- Use Epic for large features, break into Task and Feature issues
- Good first issue label for newcomers

### Pull Requests

- Use PULL_REQUEST_TEMPLATE.md with sections: Summary, Type, Checklist, Architecture, Documentation, Tests, Security, Breaking Changes, Screenshots, AI Notes
- Require at least one CODEOWNER review for critical paths
- Link to issues via Closes #XXX
- Keep PRs small (<500 lines), focused
- Include AI Notes section explaining AI involvement

### Labels

- priority: critical, high, medium, low (mutually exclusive)
- status: backlog, ready, blocked, review, testing, done
- type: bug, feature, documentation, architecture, security, performance, ai, backend, frontend, database, infrastructure, devops
- size: xs, s, m, l, xl
- Special: good first issue, help wanted, duplicate, invalid, wontfix, question, research, technical debt, refactor

### Branching

- main: production, protected, requires PR, no direct push
- develop: integration branch for features
- feature/*: new features from develop
- hotfix/*: urgent fixes from main
- release/*: release preparation from develop
- research/*: spikes and research
- experiment/*: experiments

### Commits

- Conventional Commits: feat:, fix:, docs:, chore:, refactor:, test:, security:, perf:
- For Phase 0: chore(repository): initialize enterprise AI-native repository foundation
- Atomic commits, clear messages, reference issues

### Security

- SECURITY.md with supported versions, reporting process
- Dependabot enabled for all ecosystems
- CodeQL and secret scanning in actions
- No secrets in code, use environment variables
- .gitignore must cover .env, secrets, node_modules, etc.

## 5. Code (Future Phases)

### General

- No application code in Phase 0 (infrastructure only)
- Keep code modular, single responsibility
- Tests co-located or in tests/ with mirroring structure
- Use configs/ for configuration, no hardcoded values
- Environment-specific configs in infra/ or deployment/

### AI Code Generation

- Provide context from .ai/CURRENT_CONTEXT.md and docs/MASTER_CONTEXT/
- Include documentation metadata in generated files
- Generate tests alongside code
- Document AI involvement in PR AI Notes

## 6. GitHub Actions

### Skeleton Phase 0

- Workflows must exist but may be minimal (name, on, jobs skeleton)
- Do not implement full pipelines in Phase 0 per spec

### Future

- CI: lint, test, build, security scan
- CD: deploy to staging, production with approvals
- Docs: auto-generate and publish docs
- AI Review: AI code review assistant

## 7. Design and Diagrams

### Design

- design/brand/ for brand guidelines
- design/logo/ for logos (SVG preferred)
- design/color-system/, typography/ for design tokens
- design/design-system/ for component specs
- wireframes/, mockups/, screens/ for UI progression
- ux/, ui/ for research and specs

### Diagrams

- Use docs/diagrams/ with 16 specialized folders (architecture, backend, frontend, security, database, deployment, network, cloud, ai, devops, business, sequence, state, flowchart, c4, er)
- Prefer Mermaid for docs (markdown-compatible) or draw.io SVG
- Version diagrams, include source files
- C4 model for architecture (Context, Container, Component, Code)

## 8. Operations

- infrastructure as code in infra/
- deployment manifests in deployment/, docker/, k8s/
- monitoring and observability configs in monitoring/, observability/
- Runbooks in docs/operations/
- No manual changes to production, everything via code

## 9. Community

- CODE_OF_CONDUCT.md: Contributor Covenant
- CONTRIBUTING.md: Clear contribution guide with setup, workflow, standards
- SUPPORT.md: How to get help, support channels
- FUNDING.yml: Sponsorship information if applicable

## 10. AI Priority Labeling

- Critical: Blocks other work, foundational, Phase 0
- High: Important for current phase
- Medium: Useful, enhances quality
- Low: Nice to have, future optimization

## Checklist for New Files

- [ ] Includes metadata header (if markdown)
- [ ] UTF-8 encoded
- [ ] English only
- [ ] Uses relative links
- [ ] Contains cross-references section
- [ ] Located in correct folder per structure
- [ ] README or INDEX updated if needed
- [ ] .gitkeep considered if folder still empty
