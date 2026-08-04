---
File ID: AI-RTR-001
Title: AI Context & Query Routing Plane
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, .ai/REPOSITORY_DNA.md
Related Files: PROJECT_PHILOSOPHY.md
AI Priority: CRITICAL
---

# AI Context & Query Routing Plane

This plane acts as the core "router" or GPS system for AI Agents navigating Oship's 30+ root folders and narrative documentation directories.

---

## 1. Context Routing Map

```
                          QUERY INPUT SIGNAL
                                   |
                     +-------------v-------------+
                     |    CONTEXT ROUTING UNIT   |
                     +-------------+-------------+
                                   |
        +--------------------------+-------------------------+
        | (Architecture Queries)   | (Task Queries)          | (Governance Queries)
        v                          v                         v
 [docs/ADR/INDEX.md]         [.ai/NEXT_ACTION.md]      [PROJECT_PHILOSOPHY.md]
```

### 1.1 Query Navigation Targets

| Agent Query Domain | Intent Keyword Match | Target Workspace Files | Maximum Target Hops |
| :--- | :--- | :--- | :---: |
| **System Architecture** | `C4, schema, boundary` | `architecture/`, `docs/architecture/` | 2 hops |
| **Core Governance** | `rules, constitution` | `PROJECT_PHILOSOPHY.md` | 1 hop |
| **Active Tasks** | `task, queue, next` | `.ai/NEXT_ACTION.md` | 1 hop |
| **Development Rules** | `branch, commit, lint` | `docs/development/`, `.ai/BEST_PRACTICES.md` | 2 hops |
| **Metric Evaluations** | `health, score, metrics` | `.ai/REPOSITORY_EVOLUTION.md`, `.ai/METRICS.md`| 1 hop |

---

## 2. Router Execution Protocol
1. **Match Key**: Parse incoming user prompts for core domain keywords.
2. **Retrieve Schema**: Consult this routing plane to resolve the shortest relative directory path.
3. **Mount Context**: Inject the target documentation page directly into the context window, bypassing multi-hop folder traversals.
