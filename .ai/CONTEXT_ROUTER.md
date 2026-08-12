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

---

## 2. Master Context Routing

The **Global Knowledge Graph** in [`docs/MASTER_CONTEXT/INDEX.md`](../docs/MASTER_CONTEXT/INDEX.md) is the canonical routing plane for all knowledge domains. Every agent MUST read it before routing to a domain. The 24 knowledge domains (`01_PRODUCT` … `24_DIAGRAMS`) each have an `INDEX.md` that serves as their routing entry point.

### 2.1 Domain-to-Intent Routing Matrix

| Agent Query Domain | Intent Keyword Match | Master Context Domain | Target Entry Point | Max Hops |
| :--- | :--- | :--- | :--- | :---: |
| **Product** | `product, feature, vision` | `01_PRODUCT` | `docs/MASTER_CONTEXT/01_PRODUCT/INDEX.md` | 1 |
| **Business** | `business, value, kpi, revenue` | `02_BUSINESS` | `docs/MASTER_CONTEXT/02_BUSINESS/INDEX.md` | 1 |
| **Users** | `persona, journey, user` | `03_USERS` | `docs/MASTER_CONTEXT/03_USERS/INDEX.md` | 1 |
| **System Architecture** | `C4, schema, boundary, architecture` | `04_ARCHITECTURE` | `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md` | 1 |
| **AI Routing** | `ai, routing, agent, context` | `05_AI` | `docs/MASTER_CONTEXT/05_AI/INDEX.md` | 1 |
| **Database** | `database, schema, migration, er` | `06_DATABASE` | `docs/MASTER_CONTEXT/06_DATABASE/INDEX.md` | 1 |
| **Frontend** | `frontend, ui, component, state` | `07_FRONTEND` | `docs/MASTER_CONTEXT/07_FRONTEND/INDEX.md` | 1 |
| **Backend** | `backend, service, logic, integration` | `08_BACKEND` | `docs/MASTER_CONTEXT/08_BACKEND/INDEX.md` | 1 |
| **Infrastructure** | `infra, cloud, iac, environment` | `09_INFRASTRUCTURE` | `docs/MASTER_CONTEXT/09_INFRASTRUCTURE/INDEX.md` | 1 |
| **Security** | `security, auth, threat, secret` | `10_SECURITY` | `docs/MASTER_CONTEXT/10_SECURITY/INDEX.md` | 1 |
| **Deployment** | `deploy, release, pipeline, cd` | `11_DEPLOYMENT` | `docs/MASTER_CONTEXT/11_DEPLOYMENT/INDEX.md` | 1 |
| **Operations** | `ops, incident, runbook, oncall` | `12_OPERATIONS` | `docs/MASTER_CONTEXT/12_OPERATIONS/INDEX.md` | 1 |
| **Observability** | `metric, log, trace, slo, dashboard` | `13_OBSERVABILITY` | `docs/MASTER_CONTEXT/13_OBSERVABILITY/INDEX.md` | 1 |
| **Design System** | `design, token, brand, ux, ui` | `14_DESIGN_SYSTEM` | `docs/MASTER_CONTEXT/14_DESIGN_SYSTEM/INDEX.md` | 1 |
| **API** | `api, contract, endpoint, sdk` | `15_API` | `docs/MASTER_CONTEXT/15_API/INDEX.md` | 1 |
| **Plugins** | `plugin, extension, integration` | `16_PLUGINS` | `docs/MASTER_CONTEXT/16_PLUGINS/INDEX.md` | 1 |
| **Automation** | `automation, workflow, gitops, bot` | `17_AUTOMATION` | `docs/MASTER_CONTEXT/17_AUTOMATION/INDEX.md` | 1 |
| **Testing** | `test, coverage, qa, quality` | `18_TESTING` | `docs/MASTER_CONTEXT/18_TESTING/INDEX.md` | 1 |
| **Roadmap** | `roadmap, phase, milestone, priority` | `19_ROADMAP` | `docs/MASTER_CONTEXT/19_ROADMAP/INDEX.md` | 1 |
| **Appendix** | `glossary, reference, template` | `20_APPENDIX` | `docs/MASTER_CONTEXT/20_APPENDIX/INDEX.md` | 1 |
| **Research** | `research, experiment, competitive` | `21_RESEARCH` | `docs/MASTER_CONTEXT/21_RESEARCH/INDEX.md` | 1 |
| **Decisions** | `adr, decision, tradeoff` | `22_DECISIONS` | `docs/MASTER_CONTEXT/22_DECISIONS/INDEX.md` | 1 |
| **Standards** | `standard, metadata, naming, gate` | `23_STANDARDS` | `docs/MASTER_CONTEXT/23_STANDARDS/INDEX.md` | 1 |
| **Diagrams** | `diagram, mermaid, c4, er` | `24_DIAGRAMS` | `docs/MASTER_CONTEXT/24_DIAGRAMS/INDEX.md` | 1 |

### 2.2 Compound Routing Rules

For multi-domain requests, the router resolves a deterministic **read order** across domains:

**Backend Request**
```
Backend Request
     ↓
 Read 04_ARCHITECTURE  (system structure & boundaries)
     ↓
 Read 08_BACKEND       (service & module architecture)
     ↓
 Read 06_DATABASE      (data model & schemas)
     ↓
 Read 10_SECURITY      (auth, threat model, data protection)
     ↓
 Read 15_API           (contracts the backend must satisfy)
```

**Frontend Request**
```
Frontend Request
     ↓
 Read 14_DESIGN_SYSTEM (tokens, components, brand)
     ↓
 Read 07_FRONTEND      (frontend architecture & state)
     ↓
 Read 03_USERS         (personas & journeys -> UX)
     ↓
 Read 15_API           (contracts the frontend consumes)
```

**Data Request**
```
Data Request
     ↓
 Read 04_ARCHITECTURE
     ↓
 Read 06_DATABASE
     ↓
 Read 08_BACKEND
     ↓
 Read 10_SECURITY
```

**Infrastructure / Deployment Request**
```
Infra/Deployment Request
     ↓
 Read 04_ARCHITECTURE
     ↓
 Read 09_INFRASTRUCTURE
     ↓
 Read 11_DEPLOYMENT
     ↓
 Read 10_SECURITY
     ↓
 Read 17_AUTOMATION
```

**Security Request**
```
Security Request
     ↓
 Read 10_SECURITY
     ↓
 Read 04_ARCHITECTURE
     ↓
 Read 06_DATABASE / 15_API / 11_DEPLOYMENT (as applicable)
```

**Design / Frontend Request**
```
Design / Frontend Request
     ↓
 Read 14_DESIGN_SYSTEM
     ↓
 Read 03_USERS
     ↓
 Read 07_FRONTEND
     ↓
 Read 15_API
```

---

## 3. Router Execution Protocol
1. **Match Key**: Parse incoming user prompts for core domain keywords.
2. **Resolve Route**: Consult the Master Context routing matrix (§2.1) to resolve the shortest relative path.
3. **Follow Compound Order**: For multi-domain requests, apply the compound routing rules (§2.2) in order.
4. **Mount Context**: Inject the target documentation page directly into the context window, bypassing multi-hop folder traversals.
5. **Record Route**: Optionally log the resolved route in `.ai/SESSION_MEMORY.md` for session continuity.
