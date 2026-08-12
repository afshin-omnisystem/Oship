---
Document ID: MCX-23-002
Title: Enterprise Metadata Header Standard
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L1 Constitutional
Knowledge Domain: 23_STANDARDS
AI Importance: CRITICAL
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md
Required By: All 24 knowledge domains, every Markdown file in Oship
Estimated AI Read Time: 3 minutes
Estimated Human Read Time: 8 minutes
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Enterprise Standards / Architecture Board
Last Updated: 2026-08-04
---

# Enterprise Metadata Header Standard

## Purpose

This standard defines the **canonical metadata header** that every Markdown file in the Oship knowledge infrastructure **MUST** begin with. A deterministic, machine-readable header enables AI agents to parse, route, and index files reliably and lets humans understand a document's role at a glance.

It extends and formalizes the existing metadata convention documented in [`ENTERPRISE_ARCHITECTURE_CONTEXT.md`](../ENTERPRISE_ARCHITECTURE_CONTEXT.md).

## Scope

- Applies to **every** `.md` file created in `docs/MASTER_CONTEXT/` and recommended for all repository documentation.
- Defines the required keys, their meaning, and valid values.
- Establishes the standard for knowledge-layer and domain tagging.

## The Standard Header

Every Markdown file MUST begin with a YAML frontmatter block using the following keys:

```yaml
---
Document ID: <UNIQUE_ID>
Title: <HUMAN_READABLE_TITLE>
Version: <SEMVER>
Status: <ACTIVE | PROPOSED | DRAFT | DEPRECATED>
Knowledge Layer: <L1 Constitutional | L2 Blueprints | L3 Interfaces | L4 Configuration | L5 Ephemeral>
Knowledge Domain: <NN_NAME>
AI Importance: <CRITICAL | HIGH | MEDIUM | LOW>
Human Importance: <CRITICAL | HIGH | MEDIUM | LOW>
Dependencies: <COMMA_SEPARATED_PATHS>
Required By: <COMMA_SEPARATED_DOMAINS_OR_PATHS>
Estimated AI Read Time: <X min>
Estimated Human Read Time: <X min>
Repository Version: <CURRENT_SEMVER>
Owner: <TEAM_OR_ROLE>
Last Updated: <YYYY-MM-DD>
---
```

### Key Definitions

| Key | Purpose | Example |
| :--- | :--- | :--- |
| **Document ID** | Unique machine-readable identifier | `MCX-23-002` |
| **Title** | Human-readable document title | `Enterprise Metadata Header Standard` |
| **Version** | Semantic version of the document content | `1.0.0` |
| **Status** | Lifecycle state of the document | `ACTIVE` |
| **Knowledge Layer** | Oship knowledge layer (see Section 130 of `PROJECT_PHILOSOPHY.md`) | `L1 Constitutional` |
| **Knowledge Domain** | The master-context domain the file belongs to | `23_STANDARDS` |
| **AI Importance** | Criticality for AI agents | `CRITICAL` |
| **Human Importance** | Criticality for human readers | `HIGH` |
| **Dependencies** | Upstream files this document depends on | `docs/MASTER_CONTEXT/INDEX.md` |
| **Required By** | Downstream consumers of this document | `All 24 knowledge domains` |
| **Estimated AI Read Time** | Time for an AI agent to consume | `3 min` |
| **Estimated Human Read Time** | Time for a human to read | `8 min` |
| **Repository Version** | Current SemVer of the repository | `v0.1.0-alpha.0 (Phase 0)` |
| **Owner** | Team/role responsible for maintenance | `Architecture Board` |
| **Last Updated** | Date of last edit (`YYYY-MM-DD`) | `2026-08-04` |

## Compliance

- **Deterministic parsing**: The header is the FIRST block; nothing precedes it.
- **No empty documents**: Every Markdown file must also contain substantive body content (never a header-only stub).
- **Completeness**: All keys are required; missing keys reduce the Average Metadata Completeness metric (see `.ai/METRICS.md` §4).

## Related Documents

- [`ENTERPRISE_ARCHITECTURE_CONTEXT.md`](../ENTERPRISE_ARCHITECTURE_CONTEXT.md) — original metadata convention.
- [`INDEX.md`](./INDEX.md) — Standards domain index.
- `.ai/METRICS.md` — metadata completeness tracking.
