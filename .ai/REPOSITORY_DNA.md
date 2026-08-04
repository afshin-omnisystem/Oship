---
File ID: AI-DNA-001
Title: Repository Core Design Genes (DNA)
Version: 1.0.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md, PROJECT_PHILOSOPHY.md
Related Files: .ai/METRICS.md, .ai/CONTEXT_ROUTER.md
AI Priority: CRITICAL
---

# Repository Core Design Genes (DNA)

This document defines the "genetic invariants" or immutable structural design codes of the Oship repository. It acts as the fundamental design blueprint that AI agents and human architects must preserve across all branch lifecycles.

---

## 1. Core DNA Markers

```
+========================================================================+
|                        OSHIP REPOSITORY DNA                           |
+========================================================================+
|                                                                        |
|  [GENE-01: AI-FIRST PORTALS] ---> .ai/INDEX.md is supreme gateway      |
|  [GENE-02: METADATA MAPPING] ---> Every Markdown file has YAML header  |
|  [GENE-03: ZERO APP CODE P0] ---> No production source code in Phase 0 |
|  [GENE-04: TOPOLOGICAL LOCK] ---> 30+ root folders preserved via Git   |
|  [GENE-05: DET-EXECUTION]   ---> Automation produces identical outputs|
|                                                                        |
+========================================================================+
```

### 1.1 Structural DNA Invariants

| Gene ID | DNA Marker Name | Immutable Rule | Verification Hook |
| :--- | :--- | :--- | :--- |
| **DNA-01** | AI-First Paradigm | AI agents must read `.ai/INDEX.md` prior to executing any commands | Pre-Commit Hook |
| **DNA-02** | Metadata Invariant | Every `.md` file must begin with standard 9-key YAML frontmatter | Linting Runner |
| **DNA-03** | Topological Lock | Prohibits the creation of arbitrary root folders outside standard 30+ | Dir Auditor |
| **DNA-04** | Gitkeep Preserver | Empty folders must maintain `.gitkeep` to preserve topological history | Git Linter |
| **DNA-05** | No Code In Phase 0 | Absolutely no production-compiled codebase file is allowed in Phase 0 | CI Gatekeeper |

---

## 2. Dynamic Replication & Propagation Rules

To propagate these genes across all newly created branches or directories:
1. **Scaffolding Generator**: Any automated directory scaffolding task must run the DNA injector tool, creating pre-linted templates containing the File ID and YAML structure.
2. **Branch Replication Audit**: When a new branch is branched from `main`, the branch initialization pipeline checks that all files match the DNA signatures before any human or agent can commit features.
