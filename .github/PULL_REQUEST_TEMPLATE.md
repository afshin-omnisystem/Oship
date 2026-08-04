---
File ID: GH-PRT-001
Title: Enterprise Pull Request Template
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / GitHub Administrator
Review Date: 2026-11-04
Dependencies: docs/development/BRANCH_STRATEGY.md
Related Files: .github/CONTRIBUTING.md, .ai/CURRENT_CONTEXT.md
AI Priority: HIGH
---

# Enterprise Pull Request

## Summary

<!-- Provide a concise, clear executive summary of the changes in this pull request. Explain the problem being solved and the desired outcome. -->

- **Primary Outcome**: 
- **Related Issues / ADRs**: Closes #___ | ADR #___

---

## Type

<!-- Select all applicable change types -->

- [ ] `type: feature` (New capability or user outcome)
- [ ] `type: bug` (Defect, regression, or unexpected behavior)
- [ ] `type: documentation` (Missing, incorrect, or improved documentation)
- [ ] `type: architecture` (Architecture, design, or cross-cutting decision)
- [ ] `type: security` (Security control, risk, or vulnerability management)
- [ ] `type: performance` (Performance, latency, capacity, or cost improvement)
- [ ] `type: ai` (AI agent, knowledge, prompt, or automation work)
- [ ] `type: devops` / `type: infrastructure` (CI/CD, containers, K8s, or cloud infra)
- [ ] `refactor` / `technical debt` (Behavior-preserving structural improvement)

---

## Checklist

<!-- Every item must be verified prior to review request -->

- [ ] My changes follow the enterprise code and documentation standards in `.ai/BEST_PRACTICES.md`.
- [ ] Every new or modified Markdown file contains the standard YAML metadata frontmatter header.
- [ ] I have self-reviewed my changes for accuracy, determinism, and UTF-8 encoding.
- [ ] No temporary, scratch, or unnecessary files are included in this PR.
- [ ] No application implementation code (`.py`, `.ts`, etc.) is included during Phase 0.

---

## Architecture

- **Bounded Domain / Service Affected**: 
- **Architectural Impact**: <!-- Explain if this introduces any architectural drift, new dependency, or structural change. -->
- **ADR Reference**: <!-- Link to the relevant ADR in docs/ADR/ if applicable. -->

---

## Documentation

- [ ] Documentation index files (`INDEX.md`) have been updated if new directories were added.
- [ ] Relevant documentation in `docs/` has been created or updated.
- [ ] `.ai/CURRENT_CONTEXT.md` and `.ai/SESSION_MEMORY.md` have been updated if system state changed.

---

## Tests

<!-- Describe the validation or testing strategy performed for this PR -->

- [ ] Structural and schema validation performed.
- [ ] Automated CI/CD workflow checks pass.
- [ ] Validation commands executed: `_________________________`

---

## Security

- [ ] No secrets, credentials, or sensitive tokens are included.
- [ ] No new vulnerability vectors or insecure defaults are introduced.
- [ ] Conforms to enterprise security policies in `.github/SECURITY.md`.

---

## Breaking Changes

- [ ] **NO BREAKING CHANGES**
- [ ] **CONTAINS BREAKING CHANGES**
  - **Description**: <!-- Detail the breaking change and migration steps -->

---

## Screenshots

<!-- Attach screenshots, ASCII diagrams, or terminal execution logs proving completion, if applicable -->

```
[Attach visual or ASCII proof here]
```

---

## AI Notes

<!-- Provide structured context specifically for AI review agents (e.g., ai-governance workflow or next-session agents) -->

- **Agent Identity / Model**: 
- **Key Deterministic Invariants**: 
- **Context Handover Instructions**:
