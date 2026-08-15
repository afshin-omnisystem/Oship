---
ID: ADOPT-01-FIX-DUP
TITLE: Duplicate Identifier Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team
---

# Duplicate Identifier Fixture (FA-09)

Reproduces the `IMG-VIS-030` collision class repaired during PART 05: an identifier
allocated in one part and silently re-used in another, invisible to section-local
reasoning and detectable only by the whole-file sweep of `TBL-VIS-689`.

### TBL-VIS-001: First Table

| A | B |
| :--- | :--- |
| 1 | 2 |

### TBL-VIS-002: Second Table

| A | B |
| :--- | :--- |
| 1 | 2 |

### TBL-VIS-002: Third Table — DUPLICATE, must be detected

| A | B |
| :--- | :--- |
| 1 | 2 |

## Duplicate image specification — the IMG-VIS-030 class

| Field | Value |
| :--- | :--- |
| **ID** | `IMG-VIS-030` |
| **Title** | First allocation |

| Field | Value |
| :--- | :--- |
| **ID** | `IMG-VIS-030` |
| **Title** | Second allocation — DUPLICATE, must be detected |

## Duplicate validation rules

| `VAL-VIS-001` | A rule | BLOCK |
| `VAL-VIS-001` | The same rule re-declared — DUPLICATE | BLOCK |

## Mentions, which must NOT be counted as definitions (VAL-VIS-949)

Prose that cites `TBL-VIS-002` and `IMG-VIS-030` and `VAL-VIS-001` in a sentence is a
mention, not a definition, and must not raise a duplicate.

> See also `TBL-VIS-002` in the redirection table above.

### Diagram identifiers

> **Diagram ID:** `DGM-VIS-001`

> **Diagram ID:** `DGM-VIS-001`
