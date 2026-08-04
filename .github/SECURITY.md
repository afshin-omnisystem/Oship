---
File ID: GH-SEC-001
Title: Enterprise Security & Vulnerability Policy
Version: 1.0.0
Status: ACTIVE
Owner: Enterprise Security Team / Security Architect
Review Date: 2026-11-04
Dependencies: README.md
Related Files: docs/security/INDEX.md, docs/security/SECURITY_ARCHITECTURE.md
AI Priority: CRITICAL
---

# Enterprise Security & Vulnerability Policy

## 1. Security Commitment

The **afshin-omnisystem/Oship** enterprise repository enforces a zero-trust, security-first posture across all human and AI-agent workflows. We treat repository security, software supply chain integrity, and vulnerability remediation with the highest criticality (`priority: critical`).

## 2. Supported Versions

We provide security patches and active vulnerability support according to our Semantic Versioning release lifecycle:

| Version | Support Status | Critical SLA | High SLA |
| :--- | :--- | :--- | :--- |
| `v1.0.x` | Supported (Phase F+) | 24 Hours | 72 Hours |
| `v0.5.x` | Pre-release Supported (Phase C+) | 48 Hours | 5 Days |
| `v0.1.x` | Architecture Preview (Phase 0–B) | Best Effort | 7 Days |

## 3. Reporting a Vulnerability

**DO NOT report suspected security vulnerabilities via public GitHub Issues or Discussions.**

To disclose a potential vulnerability, security flaw, or credential leak:
1. **Private Advisory**: Use the [GitHub Security Advisory Reporting Tool](https://github.com/afshin-omnisystem/Oship/security/advisories/new) to create a confidential draft advisory.
2. **Direct Security Contact**: Email `rastegri.a@gmail.com` with the subject prefix `[SECURITY ADVISORY — OSHIP]`.
3. **Required Information**:
   - Description of the vulnerability and affected repository path/component.
   - Exact steps to reproduce or deterministic proof-of-concept.
   - Potential impact and recommended mitigation if known.

## 4. Response SLA & Safe Harbor

- **Acknowledgment**: Within **24 hours** of receipt.
- **Triage & Classification**: Within **72 hours** of receipt.
- **Safe Harbor**: Security researchers acting in good faith without exfiltrating private data, exploiting services, or degrading system availability will not face legal retaliation.

## 5. AI Security Considerations

- **No Secret Hallucination**: AI agents must never output, mock, or hardcode production secrets, API keys, or private endpoints.
- **Dependency Scanning**: All dependencies introduced in later phases must undergo automated SAST, SBOM generation, and SCA checks before merge.
- **Supply Chain Defense**: All commits to protected branches must be cryptographically signed or verified via GitHub Actions governance pipelines.
