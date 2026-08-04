---
File ID: DOC-DEV-003
Title: Enterprise GitHub Labels Taxonomy & GitOps Specification
Version: 1.0.0
Status: ACTIVE
Owner: GitHub Administrator / DevOps Engineer
Review Date: 2026-11-04
Dependencies: docs/development/INDEX.md
Related Files: .github/labels.yml, .github/CONTRIBUTING.md
AI Priority: HIGH
---

# Enterprise GitHub Labels Taxonomy & GitOps Specification

## 1. Governance Overview

This document serves as the canonical human and machine specification for all GitHub Labels in `afshin-omnisystem/Oship`. These labels are declaratively synchronized via our GitOps configuration file [`/.github/labels.yml`](../../.github/labels.yml).

## 2. Canonical Label Register

### Priorities
- **`priority: critical`** (`#B60205`): Work that blocks security, release, or repository operation.
- **`priority: high`** (`#D93F0B`): High-impact work that should be scheduled promptly.
- **`priority: medium`** (`#FBCA04`): Important work with normal scheduling priority.
- **`priority: low`** (`#0E8A16`): Useful work that can be scheduled after higher priorities.

### Statuses
- **`status: backlog`** (`#EDEDED`): Accepted work that is not yet ready to start.
- **`status: ready`** (`#1D76DB`): Work is refined and ready to begin.
- **`status: blocked`** (`#B60205`): Work cannot proceed until a dependency or decision is resolved.
- **`status: review`** (`#5319E7`): Work is awaiting review or approval.
- **`status: testing`** (`#0366D6`): Work is undergoing validation.
- **`status: done`** (`#0E8A16`): Work is complete and verified.

### Types & Domains
- **`type: bug`** (`#D73A4A`): A defect, regression, or unexpected behavior.
- **`type: feature`** (`#A2EEEF`): A new capability or user outcome.
- **`type: documentation`** (`#0075CA`): Documentation that is missing, incorrect, or needs improvement.
- **`type: architecture`** (`#6F42C1`): Architecture, design, or cross-cutting decision work.
- **`type: security`** (`#B60205`): Security control, risk, or vulnerability-management work.
- **`type: performance`** (`#F9D0C4`): Performance, capacity, latency, or cost work.
- **`type: ai`** (`#7057FF`): AI agent, knowledge, evaluation, or automation work.
- **`type: backend`** (`#0052CC`): Backend domain or service work.
- **`type: frontend`** (`#1D76DB`): Frontend, UX, or client experience work.
- **`type: database`** (`#5319E7`): Data model, persistence, or database work.
- **`type: infrastructure`** (`#0E8A16`): Infrastructure, environment, or platform work.
- **`type: devops`** (`#006B75`): Delivery, automation, or operational engineering work.

### Sizes (T-Shirt Sizing)
- **`size: xs`** (`#C2E0C6`): Extra-small change with minimal coordination.
- **`size: s`** (`#BFDADC`): Small change with limited coordination.
- **`size: m`** (`#D4C5F9`): Medium change with normal coordination.
- **`size: l`** (`#FEF2C0`): Large change requiring additional planning.
- **`size: xl`** (`#F9D0C4`): Extra-large change requiring decomposition or an epic.

### Community & Remediation
- **`good first issue`** (`#7057FF`): Appropriate for a new contributor.
- **`help wanted`** (`#008672`): Extra maintainer or contributor attention is needed.
- **`duplicate`** (`#CFD3D7`): This issue or pull request already exists.
- **`invalid`** (`#E4E669`): This does not meet repository scope or evidence requirements.
- **`wontfix`** (`#FFFFFF`): The repository will not pursue this item.
- **`question`** (`#D876E3`): Further information is requested.
- **`research`** (`#1D76DB`): Investigation intended to resolve uncertainty.
- **`technical debt`** (`#F9D0C4`): Known maintainability or structural debt.
- **`refactor`** (`#FBCA04`): Behavior-preserving structural improvement.
