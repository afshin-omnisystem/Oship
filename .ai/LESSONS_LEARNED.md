---
File ID: AI-LESS-001
Title: Enterprise AI Development Lessons Learned
Version: 1.2.0
Status: ACTIVE
Owner: Architecture Team / AI Repository Architect
Review Date: 2026-11-04
Dependencies: .ai/INDEX.md
Related Files: .ai/BEST_PRACTICES.md, .ai/COMMON_MISTAKES.md
AI Priority: MEDIUM
---

# Enterprise AI Development Lessons Learned

## 1. Context Window Efficiency

- **Lesson**: Large language models perform significantly better when repository documentation is cleanly modularized rather than combined into monolithic files.
- **Application**: The repository enforces granular documents (`CURRENT_CONTEXT.md`, `NEXT_ACTION.md`, `PROJECT_STATUS.md`) so an AI agent can read only the context required for a specific task.

## 2. Deterministic Tool Execution

- **Lesson**: Without explicit rules, AI agents may create arbitrary files or omit required headers.
- **Application**: The standard YAML frontmatter header is documented as a strict invariant, and `.gitkeep` files prevent git from ignoring empty structural directories.

## 3. Clear Separation Between Governance and Implementation

- **Lesson**: Mixing repository scaffolding with application code leads to premature coupling and architectural drift.
- **Application**: Phase 0 strictly prohibits application source code, focusing 100% on governance, documentation, and DevOps skeletons.

## 4. Documentation Chunking for Large Constitutional Documents

- **Lesson**: Extremely long governance documents (>6000 lines) benefit from multi-part structure with clear section numbering continuity rather than monolithic single files.
- **Application**: PROJECT_PHILOSOPHY.md is written in sequential parts (Part 01: Sections 1-65, Part 02: Sections 66-95) to maintain quality and context window efficiency while preserving a single unified document with continuous section numbering.

## 5. Visual Variety in AI-First Documentation

- **Lesson**: AI-first repositories require diverse visual structures (Mermaid diagrams, ASCII art, tables, decision trees) approximately every 150 lines to maintain navigability and comprehension for both AI agents and human readers.
- **Application**: Part 02 includes 47+ Mermaid diagrams, 50+ ASCII art structures, 55+ tables, and 5 image placeholders distributed throughout the content.

## 6. Dual-Engine and Process-Guided Review

- **Lesson**: Human reviewers are often bottlenecks in PR pipelines. Combining systemic AI review gates with human architectural consensus avoids blocking while ensuring high quality.
- **Application**: Enforced the Dual-Engine Review model (Section 101) where AI agents verify mechanical linting/vulnerability criteria, leaving humans to focus entirely on pattern validation.

## 7. The Repository as an Operating System Kernel

- **Lesson**: Organizing multi-agent development requires clear task routing and memory persistency interfaces.
- **Application**: Treating the repository as a bootable kernel (Section 125) with a process scheduler (`NEXT_ACTION.md`), registries (YAML headers), and memory managers (`SESSION_MEMORY.md`) allows high-density agent parallelization.

## 8. Domain-Driven Repository Partitioning

- **Lesson**: Structuring a software repository using Domain-Driven Design (DDD) principles (bounded contexts, context maps, ubiquitous language) eliminates developer cognitive overload and AI agent search fatigue.
- **Application**: Configured clear, self-contained business boundaries in our topology (Section 127), preventing inter-domain bleeding and logical sprawl.

## 9. Deterministic ID Generation Prevents Duplicate Declarations

- **Lesson**: When generating high-volume ID namespaces (DGM/TBL/JSON/YML/IMG), range labels inside registry tables can collide with real declarations and create apparent duplicates.
- **Application**: For MCX-MEM-001 we removed numeric placeholders from range cells (e.g. `001–959`) and from library headings so every `TBL/DGM/JSON/YML-MEM-###` occurrence is a genuine declaration. The final document shows no duplicate declarations; range tables are described in non-colliding form.

## 10. Fence-Balance and JSON-Parsing Gates for Large Documents

- **Lesson**: Very large generated documents (30k+ lines) are prone to unbalanced code fences and malformed JSON blocks that break parsers.
- **Application**: MCX-MEM-001 was verified with a toggle-based fence-balance check (784 Mermaid fences balanced) and programmatic JSON parsing (448/448 valid) before release — a reusable gate for all future large documents.

## 11. Release Gate as Immutable Reconstruction Anchor

- **Lesson**: Tagging a major MASTER_CONTEXT document (e.g. `mcx-mem-001-v1.0.0`) gives future AI agents a fixed, immutable reference point to reconstruct the memory architecture regardless of later drift on `main`.
- **Application**: Released MCX-MEM-001 v1.0.0 via PR #5 and tag `mcx-mem-001-v1.0.0`, recording the merge commit (`e3fb4d4`) and actual metrics in the release notes.

---

## Adoption Phase — Lessons from ADOPT-01 Follow-Up (2026-08-15)

### `LL-ADOPT-01` — A checker's first output is a hypothesis, not a measurement

The v1.0.0 baseline reported 165 errors. **152 were false positives.** Had those been
treated as a work queue, the repository would have spent its next several work units
"fixing" a corpus that was already correct, and the 4 genuinely broken diagrams the
checker was silently passing would have survived.

**Rule.** Before acting on a checker's findings at scale, validate the checker against a
reference implementation or a hand-audited sample. A finding count is evidence about the
checker until it has been shown to be evidence about the corpus.

### `LL-ADOPT-02` — Verify inherited claims, even your own

The previous session recorded that 4 of 6 Mermaid errors were `erDiagram` over-strictness.
That claim was **half right**: the 4 false positives were real, but the same parser was
also producing 4 **false negatives** the claim never mentioned. Trusting the summary would
have propagated a wrong conclusion into the control plane.

**Rule.** A documented finding from a previous session is a hypothesis with provenance,
not a fact (`VAL-VIS-1745` already says this for measurements; it applies to diagnoses).

### `LL-ADOPT-03` — Wrong in both directions is the diagnostic to look for

A validator with false positives *and* false negatives is worse than none: it generates
noise that trains readers to ignore it, while providing false assurance. When a checker
disagrees with a reference implementation, count the disagreements in **both** directions
before deciding which is wrong.

### `LL-ADOPT-04` — Prefer abstention to guessing

The rewritten Mermaid validator reports `UNSUPPORTED_BY_VALIDATOR` for constructs it
cannot model. On the corpus this means abstaining on 612 diagrams under the fallback
engine — and **zero false positives**. An honest "I cannot tell" is more useful than a
confident wrong answer, because it is actionable: install the real parser.

### `LL-ADOPT-05` — Fixtures catch what review does not

Two real bugs in the `DEC-VIS-052` implementation were caught by the regression fixtures,
not by reading the code: header signatures learned namespace-globally, and a
range-restating derived table misread as a second allocation. Both would have produced
wrong classifications on the real corpus.

**Rule.** `ADOPT-R2` is load-bearing. A behaviour change without a fixture is unverified.

### `LL-ADOPT-06` — Let the checker judge your own work

An early draft of the baseline delta report tabulated three divergent rule texts, and the
checker flagged it as three `CROSS_FILE_DUPLICATE` definitions. **The finding was
correct** — a report about identifier semantics had itself redefined three identifiers.
The document was changed; the rule was not.

**Rule.** When the checker flags an artefact you just authored, the default assumption is
that the checker is right. Every instinct pulls the other way, and that instinct is how
validators get quietly weakened.

### `LL-ADOPT-07` — Reclassification is not relaxation, but it must be proven

Clearing 152 errors looks exactly like weakening a check. The distinction is
demonstrable, and must be demonstrated:

| Test | Answer |
| :--- | :--- |
| Threshold loosened? | No — `max_duplicate_ids` remains `0` |
| Path excluded? | No |
| Check deleted? | No |
| Detection capability | **Increased** — 5 defect classes added, 4 previously-missed diagrams caught |
| Evidence preserved? | Yes — 156 republications retained as `INFO` with definition sites |
| Reversible? | Yes — `republication_policy: strict`, verified by execution |

**Rule.** Any change that reduces the error count must publish this table.

### `LL-ADOPT-08` — Recover history without touching the working tree

This session opened with local `HEAD` rolled back to `c6f3457` while the working tree
still held the full accumulated work and the remote branch was at `4e3eacc`. The safe
recovery was: verify the 46 files byte-identical against the remote commit **first**, then
`git reset --soft`, which cannot modify the working tree. A `--hard` reset, or a fresh
commit on the rolled-back HEAD, would have destroyed or duplicated the work.

### `LL-ADOPT-09` — A validator that cannot fail to run, fails open

`LL-ADOPT-01` said a checker's first output is a hypothesis about the checker. This
session found the sharper form of that trap.

The v1.1.0 Mermaid validator had three engines in a fallback chain. The chain was designed
for **resilience** — never crash, always produce a report. That design goal, unqualified,
produced a checker that reported `PASS` for 1,998 diagrams while parsing 1,386 of them and
missing 5 real defects it had itself been built to catch.

The bug was one line: `import 'mermaid'` under `NODE_PATH`. ESM ignores `NODE_PATH`. But
the bug was only *damaging* because the fallback was silent.

**Rule.** A quality gate must distinguish *"I checked and found nothing"* from *"I could
not check."* Any degradation path that produces the first message while meaning the second
is a fail-open defect, regardless of how correct the individual engines are. Prefer a loud
failure over a resilient lie.

### `LL-ADOPT-10` — Reproduce the baseline before building on it

The previous session's baseline (13 errors / 441 warnings) was committed as fact and cited
in five documents. Re-running the same code at the same commit gave 8 / 1,055.

Two independent causes, both invisible without re-running:

1. the Mermaid engine silently degraded (`LL-ADOPT-09`);
2. the baseline was generated **mid-commit**, before the session's final control-plane
   edits landed, so it never described the tree it shipped in.

**Rule.** A baseline is evidence only if it is reproducible. Before extending prior work,
re-run its measurement and diff the result. Record the environment — engine, versions,
resolved paths — inside the report, so a future reader can tell whether they are looking
at the same experiment. `ADOPT-R6` now requires this.

The corollary is uncomfortable and worth stating plainly: **the previous session's
`ADOPT-OBL-01a` discharge was reported honestly and was still wrong.** Honesty about
method does not substitute for reproduction.

### `LL-ADOPT-11` — `git reset --hard` is not a way to undo a probe

Testing whether the credential could install a workflow required committing
`.github/workflows/` and attempting a push. The push was correctly rejected. The cleanup —
`git reset --hard HEAD~1` — then discarded every **tracked** edit made in the session up to
that point, because those edits were part of the same commit. Untracked files survived.

Roughly 40 minutes of validator work had to be reapplied from the transcript.

**Rule.** Probe destructive-permission questions on a scratch commit that contains *only*
the probe, or stash the real work first. Prefer `git reset --soft` (`LL-ADOPT-08`), which
cannot touch the working tree. `--hard` is not an undo; it is a delete.
