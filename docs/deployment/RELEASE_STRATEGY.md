---
File ID: DOC-DEP-002
Title: Enterprise Semantic Versioning Release Strategy
Version: 1.0.0
Status: ACTIVE
Owner: DevOps & Site Reliability Engineering / GitHub Administrator
Review Date: 2026-11-04
Dependencies: docs/deployment/INDEX.md
Related Files: docs/roadmap/MILESTONES.md, docs/development/BRANCH_STRATEGY.md
AI Priority: CRITICAL
---

# Enterprise Semantic Versioning Release Strategy

## 1. Semantic Versioning Specification (SemVer 2.0.0)

Every release of `afshin-omnisystem/Oship` strictly adheres to [Semantic Versioning 2.0.0](https://semver.org/). Version numbers are formatted as:

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<BUILD_METADATA>]
```

- **`MAJOR` (`v1.x.x`, `v2.x.x`)**: Incremented for backwards-incompatible API changes or breaking architectural shifts.
- **`MINOR` (`v0.1.x`, `v0.5.x`)**: Incremented for new backward-compatible capabilities, domain additions, or phase milestones.
- **`PATCH` (`v0.1.1`, `v0.1.2`)**: Incremented for backward-compatible bug fixes, security patches, or documentation corrections.
- **`PRERELEASE` (`-alpha.0`, `-beta.1`, `-rc.1`)**: Indicates a pre-release version undergoing validation.

## 2. Release Lifecycle & Pre-1.0 Roadmap

```
Phase 0           Phase A - B       Phase C - E        Phase F (Production GA)
v0.0.1-alpha.0 ---> v0.1.0-alpha.1 ---> v0.5.0-beta.1 -----> v1.0.0-GA
(Infra Scaffolding) (Domain Models)     (Core Service RC)  (Stable Enterprise Contract)
```

| SemVer Target | Lifecycle Phase | Contract Stability | Primary Focus |
| :---: | :---: | :--- | :--- |
| **`v0.0.x`** | Phase 0 | Unstable Pre-Alpha | Repository infrastructure, `.ai/` control plane, governance YAMLs. |
| **`v0.1.x`** | Phase A | Alpha Contract | First approved domain boundaries, architecture blueprints, ADRs. |
| **`v0.5.x`** | Phase C–D | Beta Contract | Integrated backend capabilities, automated tests, security validation. |
| **`v0.9.x`** | Phase E | Release Candidate | Site reliability, SLO verification, disaster recovery evidence. |
| **`v1.0.0`** | Phase F | **GA / Stable Enterprise** | Fully supported production release with 24h security SLA. |

## 3. Automated Release Workflow

1. **Commit Convention**: Engineers and AI agents commit using Conventional Commits (`feat:`, `fix:`, etc.).
2. **Version Tagging**: Merging to `main` triggers version bump evaluation in `.github/workflows/release.yml`.
3. **Changelog Generation**: Release notes are automatically generated from commit logs and ADR references.
4. **Artifact Creation**: Release tags generate immutable artifacts and publish to enterprise registries.
