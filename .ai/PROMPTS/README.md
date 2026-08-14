<!--- File ID: AI-PROMPTS-001 -->
<!--- Title: Prompts Library -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md -->
<!--- Related Files: .ai/BEST_PRACTICES.md, .ai/RULES/ -->
<!--- AI Priority: High -->

# Prompts Library

## Overview

Standardized prompts for consistent AI agent performance in Oship repository.

## Purpose

- Deterministic AI outputs
- Versioned prompt engineering
- Reusable across sessions and agents
- Evaluation harness ready

## Structure

```
PROMPTS/
├── README.md (this file)
├── architecture/
├── documentation/
├── code-generation/
├── review/
├── testing/
└── operations/
```

## Prompt Template

Every prompt file must include:

```markdown
File ID: PROMPT-<CATEGORY>-<NUMBER>
Title:
Version:
Status:
Inputs:
Outputs:
Model Preferences:
Constraints:
Example Usage:
Prompt Body:
Evaluation Criteria:
```

## Categories

### Architecture Prompts

- Generate ADR from decision context
- Generate C4 diagram from codebase
- Generate API specification from requirements

### Documentation Prompts

- Generate markdown with metadata header
- Generate INDEX.md from folder structure
- Summarize session memory into long-term memory

### Code Generation Prompts

- Generate feature with tests from issue
- Generate shared library in packages/
- Generate API client in sdk/

### Review Prompts

- AI code review based on BEST_PRACTICES
- Security review based on SECURITY.md
- Documentation completeness review

### Testing Prompts

- Generate unit tests for function
- Generate integration tests for API
- Generate E2E scenarios

### Operations Prompts

- Generate GitHub Actions workflow skeleton
- Generate deployment manifests for k8s
- Generate runbook from incident

## Maintenance

- Version prompts with semantic versioning
- Test prompts before marking Active
- Deprecate old prompts, do not delete
- Log prompt usage in SESSION_MEMORY.md

## Cross References

- `.ai/BEST_PRACTICES.md` - Quality standards for outputs
- `.ai/RULES/` - Behavioral constraints
- `docs/DOCUMENTATION_STANDARD.md` - Documentation requirements
