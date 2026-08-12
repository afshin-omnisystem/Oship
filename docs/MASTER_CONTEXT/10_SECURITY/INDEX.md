---
Document ID: MCX-10-001
Title: Security Knowledge Domain Index
Version: 1.0.0
Status: ACTIVE
Knowledge Layer: L2 Blueprints
Knowledge Domain: 10_SECURITY
AI Importance: CRITICAL
Human Importance: CRITICAL
Dependencies: docs/MASTER_CONTEXT/INDEX.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md, .github/SECURITY.md
Required By: 04_ARCHITECTURE, 06_DATABASE, 08_BACKEND, 15_API, 11_DEPLOYMENT
Estimated AI Read Time: 5 min
Estimated Human Read Time: 12 min
Repository Version: v0.1.0-alpha.0 (Phase 0)
Owner: Enterprise Security Team / Security Architect
Last Updated: 2026-08-04
---
# Security Knowledge Domain — INDEX

## Purpose

Defines the zero-trust security posture: threat model, defense-in-depth architecture, identity, secrets management, compliance, and security engineering standards.

## Knowledge Scope

Covers threat modeling, security architecture, authentication/authorization, secrets management, compliance frameworks, and incident response. Cross-cutting across all domains.

## Responsibilities

The owners of this domain are responsible for:

- Own the security architecture and threat model
- Maintain zero-trust and defense-in-depth design
- Define identity, auth, and secrets management
- Enforce compliance and data-protection rules
- Drive incident response readiness

## Dependencies

This domain depends on the following knowledge and infrastructure:

- `docs/MASTER_CONTEXT/INDEX.md`
- `docs/MASTER_CONTEXT/04_ARCHITECTURE/INDEX.md`
- `.github/SECURITY.md`

## Related Documents

- `docs/security/INDEX.md`
- `docs/security/SECURITY_ARCHITECTURE.md`
- `security/`
- `docs/diagrams/security/`

## Documents

This domain houses the following documents. All documents follow the enterprise metadata header defined in `docs/MASTER_CONTEXT/23_STANDARDS/`.

| Document | Purpose | Status |
| :--- | :--- | :--- |
| [`THREAT_MODEL.md`](./THREAT_MODEL.md) | Comprehensive threat model and risk register. | PLANNED |
| [`SECURITY_ARCHITECTURE.md`](./SECURITY_ARCHITECTURE.md) | Zero-trust and defense-in-depth design. | PLANNED |
| [`IDENTITY_AUTH.md`](./IDENTITY_AUTH.md) | Authentication, authorization, and IAM standards. | PLANNED |
| [`COMPLIANCE.md`](./COMPLIANCE.md) | Compliance frameworks and control mappings. | PLANNED |

## Reading Order

Read THREAT_MODEL first, then SECURITY_ARCHITECTURE, then IDENTITY_AUTH, then COMPLIANCE.

## AI Reading Order

AI agents must read THREAT_MODEL and SECURITY_ARCHITECTURE before implementing auth, storing data, or exposing APIs.

## Cross References

This domain cross-references: `04_ARCHITECTURE`, `06_DATABASE`, `08_BACKEND`, `15_API`, `11_DEPLOYMENT`

## Future Sections

Future sections and documents planned for this domain:

- Zero-trust network architecture
- SOC2/ISO control evidence
- Supply chain security
- Automated compliance scanning

## AI Usage

AI agents use this domain to build secure code and avoid introducing vulnerabilities, with security checks applied to all changes.

## Human Usage

Security engineers maintain the posture and review security-sensitive changes.

## Completion Status

**PLANNED — INDEX complete; links to existing security docs; content documents planned.**

## Knowledge Layer

This domain belongs to **L2 Blueprints** of the Oship knowledge layer pyramid defined in `PROJECT_PHILOSOPHY.md` Section 130.

## Knowledge Completeness

**25% — Index present; existing SECURITY_ARCHITECTURE linked; additional models planned.**

## Estimated Reading Time

- **AI**: 5 min
- **Human**: 12 min

---
*Managed by the Master Context infrastructure. See [`../INDEX.md`](../INDEX.md) for the global knowledge graph.*
