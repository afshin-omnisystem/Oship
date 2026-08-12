---
Document ID: MCX-16-001
Title: Plugins Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L3 Interfaces / L4 Configuration
Knowledge Domain: 16_PLUGINS
AI Importance: MEDIUM
Human Importance: MEDIUM
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, docs/MASTER_CONTEXT/15_API/INDEX.md
Required By: 15_API, 04_ARCHITECTURE, 17_AUTOMATION, 18_TESTING
Estimated AI Read Time: 3 min
Estimated Human Read Time: 8 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Platform / Extension Lead
Last Updated: 2026-08-04
---
# Plugins Knowledge Domain — INDEX

## Purpose

Defines the plugin and extension architecture: how Oship is extended, the plugin contract, lifecycle, packaging, and third-party integrations.

## Knowledge Scope

Covers plugin architecture, extension points, plugin SDK, lifecycle management, packaging, and third-party integration governance. Interfaces with API (15) and automation (17).

## Responsibilities

The owners of this domain are responsible for:

- Own the plugin architecture and contract
- Maintain extension points and SDK
- Define plugin lifecycle and packaging
- Govern third-party integrations
- Ensure plugin compatibility and stability

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `docs/MASTER_CONTEXT/15_API/INDEX.md`

## Related Documents

- `plugins/`
- `sdk/`
- `packages/`
- `templates/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`PLUGIN_ARCHITECTURE.md`](./PLUGIN_ARCHITECTURE.md) | Plugin model, extension points, and boundaries. | PLANNED |
| [`PLUGIN_SDK.md`](./PLUGIN_SDK.md) | Plugin SDK and development contract. | PLANNED |
| [`PLUGIN_LIFECYCLE.md`](./PLUGIN_LIFECYCLE.md) | Plugin lifecycle and versioning. | PLANNED |
| [`INTEGRATIONS.md`](./INTEGRATIONS.md) | Third-party integration governance. | PLANNED |

## Reading Order

Read PLUGIN_ARCHITECTURE first, then PLUGIN_SDK, then PLUGIN_LIFECYCLE, then INTEGRATIONS.

## AI Reading Order

AI agents building plugins must read PLUGIN_ARCHITECTURE and PLUGIN_SDK before implementing extensions.

## Cross References

This domain cross-references: `15_API`, `04_ARCHITECTURE`, `17_AUTOMATION`, `18_TESTING`

## Future Sections

Future sections and documents planned for this domain:

- Plugin marketplace
- Plugin certification and validation
- Backward-compatibility policy
- Community plugin program

## AI Usage

AI agents use this domain to build plugins that conform to the extension contract and lifecycle.

## Human Usage

Platform leads maintain the plugin model and review third-party integrations.

## Completion Status

**PLANNED — INDEX complete; content documents to be authored in later sprints.**

## Knowledge Layer

This domain belongs to **L3 Interfaces / L4 Configuration** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**15% — Index present, core plugin documents planned.**

## Estimated Reading Time

- **AI**: 3 min
- **Human**: 8 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
