---
ID: DEC-VIS-052
TITLE: Identifier Definition versus Reference Semantics
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team / AI Repository Architect
AUTHORITY: L1 Constitutional
DOMAIN: 01_PRODUCT
AI_PRIORITY: CRITICAL
CREATED: 2026-08-15
UPDATED: 2026-08-15
DEPENDENCIES: docs/MASTER_CONTEXT/01_PRODUCT/SYSTEM_VISION.md, tools/docs-validate/validators/id_validator.py
RELATED: docs/reports/ADOPT-01-VALIDATION-BASELINE.md, .ai/DECISION_LOG.md
---

# `DEC-VIS-052` — Identifier Definition versus Reference Semantics

**Decision record resolving `ADOPT-OBL-03a`.**
Supplements `TBL-VIS-689` (Whole-File Identifier Uniqueness Sweep) and `VAL-VIS-949`
(mention exclusion). Supersedes nothing. Amends no frozen content.

---

## 1. Namespace audit — performed before allocation

Mandatory under `VAL-VIS-1592` (two-pass) and non-negotiable rule 11.

| Pass | Method | Result |
| :--- | :--- | :--- |
| **Pass 1 — declarations** | Search for `DEC-VIS-` ceiling *declarations* across `docs/` and `.ai/` | Ceiling **150**, declared in `.ai/PROJECT_STATUS.md` §Namespace Ceilings, regularised by `DEC-VIS-050` |
| **Pass 2 — decisions** | Search for `DEC-VIS-` ceiling *decisions* | `DEC-VIS-050` is the most recent ceiling record; **150** confirmed as effective |

| Finding | Value |
| :--- | :--- |
| Highest **allocated** `DEC-VIS-` | `DEC-VIS-050` |
| `DEC-VIS-051` | **RESERVED — not free.** Earmarked by `OBL-60` for the `VAL-VIS-` ceiling raise (`SYSTEM_VISION.md:26895`, `:27185`). Referenced as a forward pointer only; **no definition exists**. Allocating it here would collide with a committed reservation. |
| Next genuinely free | **`DEC-VIS-052`** — zero occurrences anywhere in the corpus |
| Ceiling headroom after this record | 52 of 150 (35 %) — **SUFFICIENT**, no raise required |

> The forward pointer `DEC-VIS-051` is itself an instance of the very distinction this
> record defines: a **reference** that allocates nothing. Had the checker treated it as a
> definition, it would have reported a phantom. `VAL-VIS-ID-CONTIG` correctly did not.

---

## 2. The question

`TBL-VIS-689` names a **row-class** definition pattern, `^\| \`NS-nnn\` \|`, and sets the
pass criterion at zero duplicates. On the current corpus that yields **154 findings**.
Inspection shows the corpus routinely republishes an identifier as the first cell of a
*second* table that carries **different columns about the same object**.

Two readings were available:

- **(A)** every row-class occurrence is a definition → 154 real defects
- **(B)** only the first authoritative allocation defines → 0 defects, but the sweep weakens

Neither was adopted blind. The question was settled **empirically**, in §3.

---

## 3. Evidence — measured, not assumed

Every duplicated identifier in the corpus was located, and the **table header** above each
occurrence was recovered by walking back to the nearest delimiter row.

### 3.1 `FAL-VIS-` and `VAL-VIS-` in `SYSTEM_VISION.md` — 142 identifiers

| Role | Table header signature | Rows |
| :--- | :--- | ---: |
| **FIRST** (allocation) | `\| ID \| Anti-pattern \| Symptom \| Root cause \| Impact \| Sev \|` | 120 |
| **FIRST** (allocation) | `\| ID \| Anti-pattern \| Symptom \| Cause \| Impact \|` | 11 |
| **FIRST** (allocation) | `\| ID \| Rule \| Grade \| Mechanisation \|` | 11 |
| **LATER** (republication) | `\| ID \| Detection \| Prevention \| Remediation \| AI warning \|` | 131 |
| **LATER** (republication) | `\| Rule \| What fails \| Grade \| Recorded as \|` | 10 |
| **LATER** (republication) | `\| Failing rule \| Grade \| What it requires \| Why it fails today \| ... \|` | 6 |

### 3.2 `VAL-ARCH-` in `SYSTEM_ARCHITECTURE.md` — 12 identifiers

| Role | Table header signature | Rows |
| :--- | :--- | ---: |
| **FIRST** (allocation) | `\| ID \| Rule \| Detection \| Severity \|` and two variants | 12 |
| **LATER** (republication) | `\| ID \| Rule summary \| Why no override exists \|` (`TBL-VIS-237`, the Non-Negotiable Set digest) | 12 |

### 3.3 The load-bearing result

> **The set of headers that appear as FIRST and the set that appear as LATER are
> DISJOINT. Overlap: zero, in both documents, across all 154 findings.**

This is not a convention an agent imposed; it is a regularity the corpus already obeys.
Allocation tables and derived tables are **structurally distinguishable**, which means the
distinction can be mechanised without a heuristic and without human adjudication per row.

### 3.4 Worked example — `FAL-VIS-001`

| Site | Caption | Columns | Role |
| :--- | :--- | :--- | :--- |
| `SYSTEM_VISION.md:3729` | `TBL-VIS-099: F1 — Symptom, Cause, Impact (`FAL-VIS-001`…`FAL-VIS-015`)` | ID, Anti-pattern, Symptom, Root cause, Impact, Sev | **DEFINITION** — the caption *declares the allocation range* |
| `SYSTEM_VISION.md:3749` | `TBL-VIS-100: F1 — Detection, Prevention, Remediation, AI Warning` | ID, Detection, Prevention, Remediation, AI warning | **DERIVED ROW** — further attributes of an object already allocated |

`TBL-VIS-099` states which identifiers it brings into existence. `TBL-VIS-100` states no
range and introduces no new object. One allocates; the other elaborates.

---

## 4. Definitions — normative

| Term | Definition |
| :--- | :--- |
| **Definition** | The single occurrence that brings an identifier into existence and fixes its normative content. Exactly one per identifier, per `VAL-ARCH-337`. |
| **Allocation** | The act of consuming a number from a namespace. Recorded by a caption range (`TBL-VIS-099`), a `NEXT_ID` advance, or a ceiling record. Allocation and definition are normally the same occurrence; where a caption declares a range, the caption is the allocation record (`VAL-VIS-1820`). |
| **Ownership** | The document and section containing the definition owns the identifier. Ownership is not transferred by republication. |
| **Reference** | Any later occurrence that points at an existing definition without altering it. A reference allocates nothing and defines nothing. |
| **Re-publication** | A reference rendered in **row position** — the identifier as the first cell of a table row in a table that is not the allocation table. Benign by default; see §5. |
| **Cross-reference** | A reference in prose, a cell other than column 1, a redirection table, or a navigation table. Already excluded by `VAL-VIS-949`. |
| **Registry row** | A row in an index, inventory or navigation register that enumerates identifiers defined elsewhere. A **reference**. |
| **Evidence row** | A row asserting the *observed state* of an identifier — pass/fail, discharged, present in Oship. Reports on the rule; does not restate it. A **reference**. |
| **Derived row** | A row supplying further attributes of an already-defined object under different column headings. A **reference**. |
| **Semantic duplication** | Two occurrences that both claim to fix normative content, where the content **differs**. Always an **ERROR**, regardless of table position. This is the defect class that matters. |
| **Forward allocation** | A `NEXT_ID` or "next free" pointer, e.g. `DEC-VIS-051`. **Never** a definition. |
| **ToC / range declaration** | A table-of-contents entry or forecast range. **Never** a definition (`ERR-02`, `VAL-VIS-1820`). |

---

## 5. The decision

**`DEC-VIS-052` adopts a refined Option A, with a semantic guard.**

1. **The first authoritative allocation of an identifier owns it.** Later occurrences are
   references and are **not** duplicate definitions.

2. **`ID Definition ≠ ID Reference`.** A secondary table — registry, index, cross-reference
   register, navigation, evidence, mapping, or derived-attribute table — may carry an
   existing identifier in row position without redefining it.

3. **The guard, which is what makes this safe.** A later occurrence **IS** a duplicate
   definition, and **MUST** fail, when it:
   - introduces a **new semantic object** under an already-owned identifier; or
   - **changes the identifier's normative content**; or
   - **claims ownership or allocation** — e.g. its caption declares an allocation range
     that includes the identifier; or
   - appears in a table whose header signature is an **allocation signature** for that
     namespace, i.e. the identifier is allocated twice in two allocation tables.

4. **Discrimination is structural, not positional.** An allocation table is identified by
   its **caption declaring a range** and/or its **header signature**. This is auditable
   and reproducible, not a per-row judgement call.

5. **Nothing is deleted.** The 154 findings are **reclassified**, not suppressed. They are
   re-emitted as `INFO`-level republication records in the machine-readable report, with
   their definition site named, so the evidence survives and remains auditable.

6. **Cross-file duplicates remain ERROR unconditionally.** Two definitions of one
   identifier in two different files is always a collision — this is the `IMG-VIS-030`
   class and it must never be weakened.

### 5.1 Why not plain Option A

Plain Option A — "first wins, silence the rest" — would have made `VAL-VIS-381` at
`SYSTEM_VISION.md:13679` invisible. That occurrence carries the text *"Every published
figure names its method"*, whereas the canonical definition at `:12017` reads *"A
sub-capability's maturity must not exceed its parent's…"*. **Same identifier, different
normative content.** That is `FAL-VIS-`-class semantic drift and it is exactly what the
sweep exists to catch.

The semantic guard in §5.3 keeps that finding visible while clearing the 153 benign ones.
This is the difference between a checker that was *tuned* and a checker that was
*sharpened*.

---

## 6. Compliance with the standing prohibition

`VAL-VIS-1746` and `SC-04` forbid relaxing a check to reach green. This record is tested
against that prohibition explicitly:

| Test | Result |
| :--- | :--- |
| Is a threshold loosened? | **No.** `max_duplicate_ids` stays `0`. |
| Is a path excluded? | **No.** Scope is unchanged and whole-tree. |
| Is a check deleted? | **No.** `ID-UNIQUE` remains and still fails closed. |
| Is detection capability reduced? | **No — it is increased.** Semantic divergence, cross-file collision and double allocation were **all previously undetectable**, because a genuine defect was buried in 154 benign findings. |
| Would the `IMG-VIS-030` defect still be caught? | **Yes.** Regression fixture `FA-09` asserts it, and cross-file duplicates are unconditional errors. |
| Is the evidence preserved? | **Yes.** Reclassified to `INFO` with definition sites named; nothing is dropped. |

> **The test that matters.** A relaxation makes a checker blind to something. This record
> makes it see **three** classes it could not see before, while removing a false-positive
> class that was training readers to ignore the output — the precise harm `VIS-728`
> warns against.

---

## 7. Mechanisation

Encoded in `tools/docs-validate/validators/id_validator.py` as occurrence classification:

| Class | Emitted as | Rule cited |
| :--- | :--- | :--- |
| `DEFINITION` | counted for uniqueness | `TBL-VIS-689` |
| `REPUBLICATION` | `INFO`, definition site named | `DEC-VIS-052` |
| `SEMANTIC_DUPLICATE` | **`ERROR`** | `DEC-VIS-052` §5.3 |
| `DOUBLE_ALLOCATION` | **`ERROR`** | `TBL-VIS-689` |
| `CROSS_FILE_DUPLICATE` | **`ERROR`** | `TBL-VIS-689` |
| `FORWARD_POINTER` | ignored | `VAL-VIS-949` |

Twelve regression fixtures are required before this record may be relied upon
(non-negotiable rule 13). They are listed in `tools/docs-validate/fixtures/README.md`.

---

## 8. Status

| Field | Value |
| :--- | :--- |
| **Decision ID** | `DEC-VIS-052` |
| **Status** | `ACTIVE` |
| **Resolves** | `ADOPT-OBL-03a` |
| **Namespace impact** | `DEC-VIS-` 52 of 150; no ceiling raise required |
| **Frozen content modified** | **None.** This record is a new file; `SYSTEM_VISION.md` is byte-identical to `main`. |
| **Reversibility** | Fully reversible — set `republication_policy: strict` in `validation-rules.yaml` to restore pre-decision behaviour. |
