<!--- File ID: AI-RULES-001 -->
<!--- Title: Rules Index -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md -->
<!--- Related Files: .ai/BEST_PRACTICES.md, .ai/COMMON_MISTAKES.md -->
<!--- AI Priority: High -->

# Rules Index

## Overview

Behavioral and operational rules for AI agents operating in Oship repository. Rules are mandatory, versioned, and enforceable.

## Purpose

- Govern AI agent behavior
- Enforce enterprise standards
- Prevent common mistakes
- Ensure determinism and safety

## Rule Categories

| Category | File | Purpose |
|----------|------|---------|
| General | GENERAL_RULES.md | Global rules for all operations |
| Documentation | DOC_RULES.md | Documentation creation and maintenance rules |
| GitHub | GITHUB_RULES.md | GitHub operations rules |
| Security | SECURITY_RULES.md | Security and compliance rules |
| AI Behavior | AI_RULES.md | AI-specific behavioral rules |

## Rule Enforcement

- Rules are mandatory unless explicitly overridden with decision log entry
- Violations must be documented in LESSONS_LEARNED.md
- Critical rule violations block PR merging (future CI enforcement)
- Quarterly review of all rules

## Rule Template

```
File ID: RULE-<CATEGORY>-<NUMBER>
Title:
Version:
Status: Active | Deprecated
Severity: Critical | High | Medium | Low
Rule:
Rationale:
Enforcement:
Exception Process:
Related: BEST_PRACTICES, COMMON_MISTAKES
```

## Cross References

- `.ai/BEST_PRACTICES.md` - Practices that implement rules
- `.ai/COMMON_MISTAKES.md` - Mistakes that rules prevent
- `.ai/DECISION_LOG.md` - Exceptions logged as decisions
- `.github/` - GitHub operational enforcement
