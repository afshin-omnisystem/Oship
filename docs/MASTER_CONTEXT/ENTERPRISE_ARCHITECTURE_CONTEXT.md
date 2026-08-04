---
File ID: DOC-MCX-002
Title: Enterprise Architecture Context & Metadata Standard
Version: 1.0.0
Status: ACTIVE
Owner: Senior Enterprise Software Architect
Review Date: 2026-11-04
Dependencies: docs/MASTER_CONTEXT/INDEX.md
Related Files: .ai/CURRENT_CONTEXT.md, docs/ADR/ADR-0001-ai-native-repository-architecture.md
AI Priority: CRITICAL
---

# Enterprise Architecture Context & Metadata Standard

## 1. Documentation Metadata Standard (Mandatory Invariant)

Every Markdown (`.md`) file created in this repository **MUST** begin with the standard YAML frontmatter header block. This enables deterministic AI parsing, automated dependency graphing, and clear ownership tracking.

```markdown
---
File ID: <UNIQUE_ID_STRING>
Title: <HUMAN_READABLE_TITLE>
Version: <SEMVER_VERSION_STRING>
Status: <ACTIVE | PROPOSED | DEPRECATED | DRAFT>
Owner: <TEAM_OR_ROLE_OWNER>
Review Date: <YYYY-MM-DD>
Dependencies: <COMMA_SEPARATED_PATH_DEPENDENCIES>
Related Files: <COMMA_SEPARATED_RELATED_PATHS>
AI Priority: <CRITICAL | HIGH | MEDIUM | LOW>
---
```

### Key Definitions:
- **`File ID`**: Unique identifier (e.g., `DOC-MCX-002`, `AI-CTX-001`, `ADR-0001`).
- **`Title`**: Formal title of the document.
- **`Version`**: Current semantic version of the file content (default `1.0.0`).
- **`Status`**: Lifecycle status of the document.
- **`Owner`**: Primary engineering team or role responsible for maintenance.
- **`Review Date`**: Next scheduled review date (format `YYYY-MM-DD`).
- **`Dependencies`**: Critical upstream files this document depends upon.
- **`Related Files`**: Downstream or associated file paths.
- **`AI Priority`**: How critical this document is for AI agents (`CRITICAL` = must read for core tasks; `LOW` = background reference).

## 2. Core Architectural Rules

1. **Deterministic Execution**: All automated workflows, scripts, and documentation templates must produce identical, predictable outputs across environments.
2. **Modular Granularity**: Never create monolithic multi-thousand-line documents when distinct domain topics can be split into focused `.md` files.
3. **Single Source of Truth**: Never duplicate architectural definitions across multiple files; cross-reference via relative Markdown links.
