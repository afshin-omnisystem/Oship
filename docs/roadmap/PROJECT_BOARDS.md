---
File ID: DOC-RMP-003
Title: Enterprise Project Boards Specification
Version: 1.0.0
Status: ACTIVE
Owner: GitHub Administrator / DevOps Engineer
Review Date: 2026-11-04
Dependencies: docs/roadmap/INDEX.md
Related Files: .github/projects.yml, docs/development/LABELS.md
AI Priority: HIGH
---

# Enterprise Project Boards Specification

## 1. Overview

We manage portfolio execution, technical debt, and AI research across **10 specialized GitHub Project Boards**. These boards are declaratively synchronized via [`/.github/projects.yml`](../../.github/projects.yml).

```
+-----------------------------------------------------------------------------------+
|                            ENTERPRISE PROJECT BOARDS                              |
+-----------------------------------------------------------------------------------+
| 1. Enterprise Roadmap     | Strategic portfolio tracking Phase 0–F and releases   |
| 2. Architecture           | ADRs, domain modeling, and technical governance       |
| 3. Development            | Engineering sprint backlog, feature tasks & bugs      |
| 4. Documentation          | Documentation hygiene and metadata standardization    |
| 5. AI Knowledge           | AI agent workflows, prompt libraries & vector memory  |
| 6. Research               | R&D investigation, LLM benchmarks & prototypes        |
| 7. Bug Tracking           | Defect remediation, severity tracking & regressions   |
| 8. Security               | SAST/SCA vulnerabilities, threat models & audits      |
| 9. Performance            | Latency, throughput, token-cost & capacity tracking   |
| 10. UI/UX                 | Design systems, wireframes, mockups & user flows      |
+-----------------------------------------------------------------------------------+
```

## 2. Standard Board Views & Columns

Every Project Board maintains four canonical columns:
1. **`Backlog`**: Items accepted into the board scope but not yet scheduled.
2. **`Ready`**: Refined items meeting Definition of Ready (DoR).
3. **`In Progress / Review`**: Active engineering or PR review work.
4. **`Done`**: Verified items meeting Definition of Done (DoD).
