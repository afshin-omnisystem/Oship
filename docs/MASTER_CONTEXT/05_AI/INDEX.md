---
Document ID: MCX-05-001
Title: AI Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L1 Constitutional / L2 Blueprints
Knowledge Domain: 05_AI
AI Importance: CRITICAL
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, .ai/INDEX.md, .ai/CONTEXT_ROUTER.md, .ai/METRICS.md
Required By: 04_ARCHITECTURE, 23_STANDARDS, 17_AUTOMATION, 18_TESTING, 13_OBSERVABILITY
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: AI Repository Architect
Last Updated: 2026-08-04
---
# AI Knowledge Domain — INDEX

## Purpose

Documents the AI-native paradigm of Oship: how AI agents are onboarded, routed, governed, and measured across the repository, and how the knowledge infrastructure serves every future AI tool.

## Knowledge Scope

Covers AI agent onboarding, context routing mechanics, memory strategy, AI governance, prompt standards, model routing, and AI metrics. The bridge between the .ai/ control plane and the MASTER_CONTEXT knowledge graph.

## Responsibilities

The owners of this domain are responsible for:

- Own the AI-native onboarding and routing contract
- Maintain context routing and memory strategy
- Define AI governance and prompt standards
- Track AI metrics and knowledge completeness
- Evolve the knowledge infrastructure for new AI tools

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `.ai/INDEX.md`
- `.ai/CONTEXT_ROUTER.md`
- `.ai/METRICS.md`

## Related Documents

- `docs/ai/INDEX.md`
- `docs/ai/AI_AGENT_GUIDELINES.md`
- `docs/MASTER_CONTEXT/ENTERPRISE_ARCHITECTURE_CONTEXT.md`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`AI_ONBOARDING.md`](./AI_ONBOARDING.md) | Standard boot sequence for any AI agent entering the repo. | PLANNED |
| [`AI_ROUTING.md`](./AI_ROUTING.md) | Canonical context routing rules for agents and tools. | PLANNED |
| [`AI_GOVERNANCE.md`](./AI_GOVERNANCE.md) | Governance, guardrails, and oversight for AI-driven changes. | PLANNED |
| [`AI_METRICS.md`](./AI_METRICS.md) | Knowledge infrastructure metrics and targets. | PLANNED |

## Reading Order

Read AI_ONBOARDING first, then AI_ROUTING, then AI_GOVERNANCE, then AI_METRICS.

## AI Reading Order

AI agents MUST read AI_ONBOARDING and AI_ROUTING as part of their boot sequence before any task execution.

## Cross References

This domain cross-references: `04_ARCHITECTURE`, `23_STANDARDS`, `17_AUTOMATION`, `18_TESTING`, `13_OBSERVABILITY`

## Future Sections

Future sections and documents planned for this domain:

- Multi-agent orchestration playbooks
- Vector/embedding indexing of docs
- Model-specific routing tiers
- AI self-healing and feedback loops

## AI Usage

This is the AI-facing home: onboarding, routing, and governance for every AI coding agent that works on Oship.

## Human Usage

AI repository architects maintain routing and governance so humans can safely delegate work to agents.

## Completion Status

**PLANNED — INDEX complete; routes to existing .ai/ files; content documents planned.**

## Knowledge Layer

This domain belongs to **L1 Constitutional / L2 Blueprints** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**25% — Index present; existing .ai/ plane referenced; AI content docs planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
