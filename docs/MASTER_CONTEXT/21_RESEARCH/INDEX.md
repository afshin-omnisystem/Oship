---
Document ID: MCX-21-001
Title: Research Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L5 Ephemeral
Knowledge Domain: 21_RESEARCH
AI Importance: MEDIUM
Human Importance: MEDIUM
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/22_DECISIONS/INDEX.md
Required By: 22_DECISIONS, 01_PRODUCT, 02_BUSINESS, 04_ARCHITECTURE
Estimated AI Read Time: 3 min
Estimated Human Read Time: 7 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Research / Innovation Lead
Last Updated: 2026-08-04
---
# Research Knowledge Domain — INDEX

## Purpose

Captures exploration, experiments, competitive analysis, and technical research that informs future decisions before they mature into ADRs.

## Knowledge Scope

Covers research notes, experiments, competitive teardowns, proofs-of-concept, and innovation ideas. Intended as a transient, idea-stage knowledge domain that feeds decisions (22).

## Responsibilities

The owners of this domain are responsible for:

- Capture research and experiment findings
- Maintain competitive and technical analysis
- Document proofs-of-concept and explorations
- Feed matured ideas into decisions (22)
- Keep ephemeral research current and culled

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/22_DECISIONS/INDEX.md`

## Related Documents

- `research/`
- `experiments/`
- `docs/wiki/onboarding/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`RESEARCH_INDEX.md`](./RESEARCH_INDEX.md) | Register of research topics and status. | PLANNED |
| [`EXPERIMENTS.md`](./EXPERIMENTS.md) | Experiments and proofs-of-concept log. | PLANNED |
| [`COMPETITIVE_ANALYSIS.md`](./COMPETITIVE_ANALYSIS.md) | Competitive and market teardown notes. | PLANNED |
| [`IDEAS_BACKLOG.md`](./IDEAS_BACKLOG.md) | Innovation and optimization ideas backlog. | PLANNED |

## Reading Order

Read RESEARCH_INDEX first, then EXPERIMENTS, then COMPETITIVE_ANALYSIS, then IDEAS_BACKLOG.

## AI Reading Order

AI agents researching a topic must read RESEARCH_INDEX and IDEAS_BACKLOG to avoid duplicating prior exploration.

## Cross References

This domain cross-references: `22_DECISIONS`, `01_PRODUCT`, `02_BUSINESS`, `04_ARCHITECTURE`

## Future Sections

Future sections and documents planned for this domain:

- Research-to-ADR pipeline
- Experimentation framework
- External research citations
- Innovation reviews

## AI Usage

AI agents use this domain to record findings and to draw on prior research before proposing decisions.

## Human Usage

Researchers and engineers capture findings; architects promote matured ideas to decisions.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L5 Ephemeral** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core research documents planned.**

## Estimated Reading Time

- **AI**: 3 min
- **Human**: 7 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
