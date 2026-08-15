---
ID: ADOPT-01-FIX-BENIGN
TITLE: Benign Gaps and Legacy Caption Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team
---

# Benign Gaps and Legacy Caption Forms (FA-10, FA-11)

Nothing in this file is a defect. A run that reports an error here has regressed.

## FA-11 — both caption forms are recognised

The canonical form:

### TBL-VIS-026: Canonical Caption Form

| A | B |
| :--- | :--- |
| 1 | 2 |

The legacy inline form used by `TBL-VIS-027` and `TBL-VIS-050`:

> **Table ID:** `TBL-VIS-027` — **Rejected Value Claim Forms**

| A | B |
| :--- | :--- |
| 1 | 2 |

> **Table ID:** `TBL-VIS-050` — **Frequently Misread Non-Goals**

| A | B |
| :--- | :--- |
| 1 | 2 |

## FA-10 — permanent gaps are correct to observe and wrong to report

`TBL-VIS-243` and `TBL-VIS-245` exist; `TBL-VIS-244` is a permanent gap under `VIS-347`
and must never be filled or flagged.

### TBL-VIS-243: Before the Permanent Gap

| A | B |
| :--- | :--- |
| 1 | 2 |

### TBL-VIS-245: After the Permanent Gap

| A | B |
| :--- | :--- |
| 1 | 2 |
