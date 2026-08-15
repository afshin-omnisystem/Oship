"""
Documentation metrics validator and reporter.

Artefact: ADOPT-01 / TBL-VIS-730 ("ceiling compliance"), MET-01…MET-05
(.ai/METRICS.md), VAL-VIS-1592 (two-pass ceiling audit, FA-12).

It measures the corpus and enforces thresholds:

MET-COUNTS         · AI-MET-001    : produce the docs metrics report (never fails)
MET-VISUAL-DENSITY · VAL-VIS-1592  : longest unbroken non-visual prose run is within
                                     the constitutional ceiling — run as TWO passes
                                     (pass 1 declarations, pass 2 decisions) per FA-12
MET-DOC-COUNT      · AI-MET-001    : Markdown file count stays above its failure boundary

Reported metrics
----------------
markdown files · total lines · total words · Mermaid count · table count ·
validation rules count · failure modes count (plus diagrams, headings, code blocks,
bytes and per-namespace identifier counts).

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

from .base import (
    CheckResult,
    Severity,
    ValidatorResult,
    iter_markdown_files,
    read_text,
    scan_fences,
    strip_code_blocks,
)

VALIDATOR_NAME = "metrics"
TITLE = "Documentation Metrics Validator"

TABLE_ROW_RE = re.compile(r"^\s{0,3}\|.*\|\s*$")
TABLE_DELIM_RE = re.compile(r"^\s{0,3}\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+\S")

VAL_DEF_RE = re.compile(r"^\|\s*`(VAL-[A-Z]+-\d{1,4})`\s*\|")
FAL_DEF_RE = re.compile(r"^\|\s*`(FAL-[A-Z]+-\d{1,4})`\s*\|")
TBL_DEF_RE = re.compile(r"^###\s+(TBL-[A-Z]+-\d{1,4}):")
TBL_LEGACY_RE = re.compile(r"^>\s+\*\*Table ID:\*\*\s+`(TBL-[A-Z]+-\d{1,4})`")
DGM_DEF_RE = re.compile(r"^>\s+\*\*Diagram ID:\*\*\s+`(DGM-[A-Z]+-\d{1,4})`")

# Two-pass ceiling audit patterns (VAL-VIS-1592 / FA-12)
CEILING_DECLARATION_RE = re.compile(r"ceiling\s+(?:of\s+)?`?(\d{2,5})`?", re.I)
CEILING_DECISION_RE = re.compile(
    r"(?:ceiling|limit)[^.\n]{0,80}?(?:under|per|by|raised\s+to|set\s+to)\s+`?"
    r"(?:DEC-[A-Z]+-\d+|(\d{2,5}))`?",
    re.I,
)


def _is_visual_line(line: str) -> bool:
    """A line that is not unbroken prose: heading, table, list, quote, fence, blank, image."""
    s = line.strip()
    if not s:
        return True
    if HEADING_RE.match(line):
        return True
    if TABLE_ROW_RE.match(line) or TABLE_DELIM_RE.match(line):
        return True
    if s.startswith((">", "- ", "* ", "+ ", "|", "---", "***", "___", "!")):
        return True
    if re.match(r"^\s*\d+[.)]\s+", line):
        return True
    if s.startswith(("```", "~~~")):
        return True
    return False


def _measure_file(text: str) -> Dict[str, int]:
    lines = text.splitlines()
    fences, _ = scan_fences(text)
    stripped = strip_code_blocks(text)

    mermaid = sum(1 for f in fences if f.info.lower() == "mermaid")

    tables = 0
    in_table = False
    for line in stripped:
        if TABLE_ROW_RE.match(line):
            if not in_table:
                tables += 1
                in_table = True
        else:
            in_table = False

    return {
        "lines": len(lines),
        "words": len(text.split()),
        "bytes": len(text.encode("utf-8")),
        "code_blocks": len(fences),
        "mermaid": mermaid,
        "tables": tables,
        "headings": sum(1 for line in stripped if HEADING_RE.match(line)),
        "val_rules": sum(1 for line in stripped if VAL_DEF_RE.match(line)),
        "fal_modes": sum(1 for line in stripped if FAL_DEF_RE.match(line)),
        "captioned_tables": sum(
            1 for line in stripped if TBL_DEF_RE.match(line) or TBL_LEGACY_RE.match(line)
        ),
        "diagram_ids": sum(1 for line in stripped if DGM_DEF_RE.match(line)),
    }


def _longest_prose_run(text: str) -> Tuple[int, int]:
    """Return (longest run length, 1-based line where it starts)."""
    lines = strip_code_blocks(text)
    best = 0
    best_at = 0
    run = 0
    run_at = 0
    for n, line in enumerate(lines, start=1):
        if _is_visual_line(line):
            run = 0
            continue
        if run == 0:
            run_at = n
        run += 1
        if run > best:
            best, best_at = run, run_at
    return best, best_at


def _ceiling_audit(files, root) -> Dict[str, Any]:
    """
    VAL-VIS-1592 / FA-12 — two-pass audit.

    Pass 1 searches for ceiling DECLARATIONS. Pass 2 searches for ceiling DECISIONS.
    Both passes are evidenced in the output; a run that reports only one pass has
    not performed the audit.
    """
    declarations: List[Dict[str, Any]] = []
    decisions: List[Dict[str, Any]] = []
    for rel in files:
        text = read_text(root, rel)
        for n, line in enumerate(strip_code_blocks(text), start=1):
            if not line:
                continue
            for m in CEILING_DECLARATION_RE.finditer(line):
                declarations.append({"file": rel, "line": n, "value": int(m.group(1))})
            for m in CEILING_DECISION_RE.finditer(line):
                decisions.append(
                    {
                        "file": rel,
                        "line": n,
                        "value": int(m.group(1)) if m.group(1) else None,
                    }
                )
    return {
        "pass_1_declarations": {"performed": True, "hits": len(declarations)},
        "pass_2_decisions": {"performed": True, "hits": len(decisions)},
        "both_passes_performed": True,
        "declaration_samples": declarations[:10],
        "decision_samples": decisions[:10],
    }


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    thresholds = config.get("thresholds", {}) or {}
    max_prose = int(thresholds.get("visual_density_max_lines", 120))
    min_docs = int(thresholds.get("min_markdown_files", 0))

    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )

    totals: Dict[str, int] = {
        "lines": 0, "words": 0, "bytes": 0, "code_blocks": 0, "mermaid": 0,
        "tables": 0, "headings": 0, "val_rules": 0, "fal_modes": 0,
        "captioned_tables": 0, "diagram_ids": 0,
    }
    per_file: Dict[str, Dict[str, int]] = {}
    largest: List[Tuple[str, int]] = []

    density = CheckResult(
        name="MET-VISUAL-DENSITY",
        rule="VAL-VIS-1592",
        description=(
            f"Longest unbroken non-visual prose run is within the {max_prose}-line "
            "constitutional ceiling; the audit runs both passes (FA-12)."
        ),
        severity_on_failure=(
            Severity.ERROR if config.get("fail_on_density", True) else Severity.WARNING
        ),
    )

    for rel in files:
        text = read_text(root, rel)
        m = _measure_file(text)
        per_file[rel] = m
        for k, v in m.items():
            totals[k] += v
        largest.append((rel, m["lines"]))

        run_len, run_at = _longest_prose_run(text)
        density.measured += 1
        density.extra.setdefault("longest_run_per_file", {})[rel] = run_len
        if run_len > max_prose:
            density.add(
                f"unbroken prose run of {run_len} lines exceeds the {max_prose}-line ceiling",
                file=rel,
                line=run_at,
            )

    density.extra["two_pass_ceiling_audit"] = _ceiling_audit(files, root)

    counts = CheckResult(
        name="MET-COUNTS",
        rule="AI-MET-001",
        description="Documentation metrics report (informational; produces evidence, "
                    "never fails a run).",
        severity_on_failure=Severity.INFO,
    )
    counts.measured = len(files)

    doc_count = CheckResult(
        name="MET-DOC-COUNT",
        rule="AI-MET-001",
        description=f"Markdown file count stays at or above the failure boundary "
                    f"({min_docs}).",
        severity_on_failure=Severity.ERROR,
    )
    doc_count.measured = len(files)
    if min_docs and len(files) < min_docs:
        doc_count.add(
            f"corpus has {len(files)} Markdown files, below the failure boundary of {min_docs}"
        )

    largest.sort(key=lambda x: x[1], reverse=True)

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.extend([counts, density, doc_count])
    result.metrics = {
        "markdown_files": len(files),
        "total_lines": totals["lines"],
        "total_words": totals["words"],
        "total_bytes": totals["bytes"],
        "mermaid_diagrams": totals["mermaid"],
        "diagram_identifiers": totals["diagram_ids"],
        "tables": totals["tables"],
        "captioned_tables": totals["captioned_tables"],
        "code_blocks": totals["code_blocks"],
        "headings": totals["headings"],
        "validation_rules": totals["val_rules"],
        "failure_modes": totals["fal_modes"],
        "largest_documents": [
            {"file": f, "lines": n} for f, n in largest[:10]
        ],
        "visual_density_ceiling": max_prose,
        "visual_density_violations": len(density.errors) + len(density.warnings),
        "two_pass_ceiling_audit": density.extra["two_pass_ceiling_audit"],
    }
    counts.extra = {k: v for k, v in result.metrics.items() if k != "largest_documents"}
    return result
