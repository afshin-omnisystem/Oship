---
ID: ADOPT-01-CI-001
TITLE: Documentation Integrity Check — Workflow Installation
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L4 Configuration
DOMAIN: tooling
AI_PRIORITY: HIGH
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: tools/docs-validate/run-validator.py
RELATED: tools/docs-validate/README.md
---

# Workflow Installation — `FA-01`

`docs-validate.yml` in this directory is the workflow required by `TBL-VIS-730` and
acceptance criteria `FA-01` / `FA-02`. It is **version-controlled here** because the
automation credential used to deliver `ADOPT-01` lacks the GitHub `workflows` permission
and cannot write to `.github/workflows/` — a credential scope limit, not a design choice.

## Install

```bash
mkdir -p .github/workflows
cp tools/docs-validate/ci/docs-validate.yml .github/workflows/docs-validate.yml
git add .github/workflows/docs-validate.yml
git commit -m "ci(ADOPT-01): install documentation integrity check (FA-01)"
```

Any principal with normal repository write access can run this. It requires no other
change: the checker, its config, its schema and its fixtures are already committed and
already work.

## State of the acceptance criteria until it is installed

| ID | Criterion | State |
| :--- | :--- | :---: |
| `FA-01` | the workflow exists and is syntactically valid | **AUTHORED AND VALIDATED**, pending the copy above |
| `FA-02` | it triggers on push and pull request | **MET in the file** — `on.push.branches: ["**"]`, `on.pull_request` |
| `FA-03` | a run log is retrievable | **BLOCKED** until installed — this is the `EV4` evidence step |

Everything else in `TBL-VIS-732` is already satisfied and verifiable locally:

```bash
python3 tools/docs-validate/run-validator.py --self-test   # 11/11 PASS
python3 tools/docs-validate/run-validator.py               # exits 1 — intended
```

> **`ADOPT-OBL-13`.** Install this workflow. Until it runs, Oship has a checker but no
> `EV4` evidence, and `QG-4` does **not** open — the maturity `M2` claim is contingent on
> this one copy command. It is the smallest remaining action with the largest remaining
> effect in the repository.

The YAML was validated with `yaml.safe_load` before commit: two jobs (`self-test`,
`validate`), three triggers (`push`, `pull_request`, `workflow_dispatch`).
