---
Document ID: MCX-24-001
Title: Diagrams Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L2 Blueprints
Knowledge Domain: 24_DIAGRAMS
AI Importance: HIGH
Human Importance: HIGH
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/23_STANDARDS/INDEX.md
Required By: 04_ARCHITECTURE, 06_DATABASE, 11_DEPLOYMENT, 14_DESIGN_SYSTEM, 13_OBSERVABILITY
Estimated AI Read Time: 4 min
Estimated Human Read Time: 10 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Architecture / Documentation Team
Last Updated: 2026-08-04
---
# Diagrams Knowledge Domain — INDEX

## Purpose

Indexes and governs every diagram in Oship: architecture, sequence, flowchart, knowledge map, decision tree, database, network, deployment, UI, and UX diagrams.

## Knowledge Scope

Covers the diagram taxonomy, canonical diagram registry, diagram standards, and rendering conventions (Mermaid/ASCII) across all diagram categories.

## Responsibilities

The owners of this domain are responsible for:

- Own the diagram taxonomy and registry
- Maintain diagram standards and conventions
- Document every diagram category
- Ensure diagrams stay in sync with content
- Govern diagram review and updates

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/23_STANDARDS/INDEX.md`

## Related Documents

- `docs/diagrams/INDEX.md`
- `assets/`
- `docs/images/`
- `architecture/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`DIAGRAM_REGISTRY.md`](./DIAGRAM_REGISTRY.md) | Canonical registry of all diagrams. | PLANNED |
| [`DIAGRAM_STANDARDS.md`](./DIAGRAM_STANDARDS.md) | Diagram conventions and rendering rules. | PLANNED |
| [`CATEGORY_GUIDES.md`](./CATEGORY_GUIDES.md) | Per-category diagram guides. | PLANNED |
| [`RENDERING.md`](./RENDERING.md) | Rendering tooling and output formats. | PLANNED |

## Reading Order

Read DIAGRAM_REGISTRY first, then CATEGORY_GUIDES, then DIAGRAM_STANDARDS, then RENDERING.

## AI Reading Order

AI agents generating or updating diagrams must read DIAGRAM_STANDARDS and CATEGORY_GUIDES before producing visual assets.

## Cross References

This domain cross-references: `04_ARCHITECTURE`, `06_DATABASE`, `11_DEPLOYMENT`, `14_DESIGN_SYSTEM`, `13_OBSERVABILITY`

## Diagram Categories

This domain documents **every diagram category** used across Oship. Each category defines its purpose, governing source domain, and typical placement.

| Category | Purpose | Primary Source Domain | Example |
| :--- | :--- | :--- | :--- |
| **Architecture diagrams** | High-level system topology, component/container structure | `04_ARCHITECTURE`, `docs/architecture/` | C4 context/container diagrams |
| **Sequence diagrams** | Message/interaction flow across services over time | `08_BACKEND`, `15_API`, `docs/diagrams/sequence/` | Auth handshake flow |
| **Flowcharts** | Algorithmic and workflow decision logic | `17_AUTOMATION`, `docs/diagrams/flowchart/` | Release gate decision flow |
| **Knowledge maps** | Structure of the knowledge graph and routing | `05_AI`, `docs/MASTER_CONTEXT/` | Global knowledge graph |
| **Decision trees** | Branching decision logic for routing and policies | `22_DECISIONS`, `10_SECURITY` | Access-control decision tree |
| **Database diagrams** | Schema, entities, and persistence topology | `06_DATABASE`, `docs/diagrams/database/` | ER / schema diagrams |
| **Network diagrams** | Network, VPC, subnet, connectivity topology | `09_INFRASTRUCTURE`, `docs/diagrams/network/` | VPC and ingress map |
| **Deployment diagrams** | Release pipeline, environment, container topology | `11_DEPLOYMENT`, `docs/diagrams/deployment/` | Promotion pipeline |
| **UI diagrams** | Screen layouts and interface structure | `14_DESIGN_SYSTEM`, `07_FRONTEND`, `design/ui/` | Component composition |
| **UX diagrams** | User flows, journeys, interaction models | `03_USERS`, `14_DESIGN_SYSTEM`, `design/ux/` | Onboarding flow |

### Category-to-Folder Mapping

Diagrams are physically stored under `docs/diagrams/` (narrative) and `assets/` (images), with a `.gitkeep`-preserved taxonomy:

```
docs/diagrams/
├── architecture/   # Architecture diagrams
├── backend/        # Backend interaction diagrams
├── frontend/       # UI/UX and state transitions
├── security/       # Threat models and auth flows
├── database/       # Database / ER diagrams
├── deployment/     # Deployment diagrams
├── network/        # Network diagrams
├── cloud/          # Cloud topologies
├── ai/             # Knowledge maps and AI flows
├── devops/         # Automation / flowchart diagrams
├── business/       # Value stream / decision trees
├── sequence/       # Sequence diagrams
├── state/          # State machine diagrams
├── flowchart/      # Flowcharts and decision trees
├── c4/             # C4 model diagrams
└── er/             # Entity-relationship diagrams
```

All diagram assets must follow the standards in `DIAGRAM_STANDARDS.md` and be registered in `DIAGRAM_REGISTRY.md`.

## Future Sections

Future sections and documents planned for this domain:

- Mermaid source-of-truth automation
- Diagram sync validation
- Interactive diagram rendering
- Diagram coverage tracking

## AI Usage

AI agents use this domain to create and maintain diagrams consistent with the taxonomy and standards.

## Human Usage

Architects and documentation team maintain and review the diagram registry.

## Completion Status

**PLANNED — INDEX complete; links to existing diagrams index; content documents planned.**

## Knowledge Layer

This domain belongs to **L2 Blueprints** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**25% — Index present; existing diagrams/ taxonomy referenced; category guides planned.**

## Estimated Reading Time

- **AI**: 4 min
- **Human**: 10 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
