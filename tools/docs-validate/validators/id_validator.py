"""
Identifier namespace validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("identifier uniqueness across all namespaces",
"identifier contiguity").
Control:  TBL-VIS-689 — Whole-File Identifier Uniqueness Sweep.

Namespaces validated
--------------------
DGM-*  diagrams        TBL-*  tables/figures    VAL-*  validation rules
FAL-*  failure modes   IMG-*  image specs       DEC-*  decision records
ADR-*  architecture decision records            OBL-*  obligations

Mention exclusion (VAL-VIS-949)
-------------------------------
An occurrence counts as a DEFINITION only when it matches a definition pattern.
Occurrences in prose, cross-reference cells, continuation markers, ceiling tables
and redirection tables are MENTIONS and are excluded.

Acceptance criteria served
--------------------------
FA-09 : duplicate detection reproduces the IMG-VIS-030 class of defect on a fixture
FA-10 : the permanent gaps of TBL-VIS-689 are not reported as errors
FA-11 : both legacy caption forms (TBL-VIS-027, TBL-VIS-050) are recognised

Checks
------
ID-FORMAT      · VAL-VIS-ID-FORMAT   : every identifier occurrence is well formed
ID-UNIQUE      · TBL-VIS-689         : zero duplicate definitions per namespace
ID-CONTIGUITY  · VAL-VIS-ID-CONTIG   : strict namespaces have no unexplained gaps
ID-UNDEFINED   · VAL-VIS-ID-DEFINED  : referenced identifiers have a definition

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .base import (
    CheckResult,
    Severity,
    ValidatorResult,
    iter_markdown_files,
    read_text,
    strip_code_blocks,
)

VALIDATOR_NAME = "identifiers"
TITLE = "Identifier Namespace Validator"

# Namespaces in scope. Each entry declares the definition patterns that create an
# identifier, and whether contiguity is enforced as an error.
NAMESPACES: Dict[str, Dict[str, Any]] = {
    "TBL": {
        "description": "Captioned tables and figures",
        "definition_patterns": [
            # canonical caption form
            r"^###\s+(TBL-[A-Z]+-\d{1,4}):",
            # FA-11 — legacy inline caption form used by TBL-VIS-027 and TBL-VIS-050
            r"^>\s+\*\*Table ID:\*\*\s+`(TBL-[A-Z]+-\d{1,4})`",
        ],
        "strict_contiguity": True,
    },
    "DGM": {
        "description": "Mermaid diagram identifiers",
        "definition_patterns": [r"^>\s+\*\*Diagram ID:\*\*\s+`(DGM-[A-Z]+-\d{1,4})`"],
        "strict_contiguity": True,
    },
    "VAL": {
        "description": "Validation rules",
        "definition_patterns": [r"^\|\s*`(VAL-[A-Z]+-\d{1,4})`\s*\|"],
        "strict_contiguity": True,
    },
    "FAL": {
        "description": "Failure modes",
        "definition_patterns": [r"^\|\s*`(FAL-[A-Z]+-\d{1,4})`\s*\|"],
        "strict_contiguity": True,
    },
    "IMG": {
        "description": "Image specifications",
        "definition_patterns": [r"^\|\s*\*\*ID\*\*\s*\|\s*`(IMG-[A-Z]+-\d{1,4})`\s*\|"],
        # IMG specs are also introduced in summary tables; contiguity is reported,
        # not enforced, because a full spec block does not exist for every allocation.
        "strict_contiguity": False,
    },
    "DEC": {
        "description": "Decision records",
        "definition_patterns": [
            r"^\|\s*\*\*ID\*\*\s*\|\s*`(DEC-[A-Z]+-\d{1,4})`\s*\|",
            r"^\|\s*\*\*Decision ID\*\*\s*\|\s*`(DEC-[A-Z]+-\d{1,4})`\s*\|",
            r"^###\s+(DEC-[A-Z]+-\d{1,4})\s+[—-]",
        ],
        "strict_contiguity": False,
        # A decision-record heading and the `**Decision ID**` field inside the same
        # record block are one definition matched by two patterns, not a collision.
        "collapse_window": 40,
    },
    "ADR": {
        "description": "Architecture decision records",
        "definition_patterns": [r"^#\s+(ADR-\d{4})[:\s-]"],
        "strict_contiguity": False,
        "filename_definition": r"^(ADR-\d{4})-",
        # The filename and the H1 of the same file are one record, not two.
        "collapse_window": 10_000_000,
    },
    "OBL": {
        "description": "Obligations",
        "definition_patterns": [r"^\|\s*`(OBL-\d{1,4})`\s*\|\s*[A-Z]"],
        "strict_contiguity": False,
        # An obligation register republishes rows in status tables; the first
        # occurrence is the definition, later ones are restatements.
        "first_occurrence_wins": True,
    },
}

# FA-10 — permanent gaps recorded by TBL-VIS-689 / VIS-347. Never fill, never report.
PERMANENT_GAPS: Dict[str, List[str]] = {
    "TBL": ["TBL-VIS-244", "TBL-VIS-423"],
    "DEC": ["DEC-VIS-008", "DEC-VIS-009"],
    "CAP": ["CAP-VIS-057", "CAP-VIS-058", "CAP-VIS-059"],
}

# Any occurrence of a namespaced identifier, used for format and reference checks.
ANY_ID_RE = re.compile(r"\b([A-Z]{3,4})-(?:([A-Z]{2,6})-)?(\d{1,5})\b")

# A well-formed identifier: PREFIX-SCOPE-NNN (zero padded to >= 3) or PREFIX-NNNN.
WELL_FORMED_RE = re.compile(r"^(?:[A-Z]{3,4}-[A-Z]{2,6}-\d{3,4}|[A-Z]{3,4}-\d{2,4})$")


def _collect_definitions(files, root, namespaces) -> Tuple[Dict[str, List[Tuple[str, str, int]]], int]:
    """
    Return {namespace: [(identifier, file, line), ...]} for definition occurrences only.
    """
    defs: Dict[str, List[Tuple[str, str, int]]] = defaultdict(list)
    scanned = 0

    compiled = {
        ns: [re.compile(p) for p in spec["definition_patterns"]]
        for ns, spec in namespaces.items()
    }

    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        scanned += 1

        for ns, spec in namespaces.items():
            fn_pat = spec.get("filename_definition")
            if fn_pat:
                m = re.match(fn_pat, rel.rsplit("/", 1)[-1])
                if m:
                    defs[ns].append((m.group(1), rel, 1))

        for n, line in enumerate(lines, start=1):
            if not line:
                continue
            for ns, patterns in compiled.items():
                for pat in patterns:
                    m = pat.match(line)
                    if m:
                        defs[ns].append((m.group(1), rel, n))
                        break
    return defs, scanned


def _check_format(files, root) -> CheckResult:
    chk = CheckResult(
        name="ID-FORMAT",
        rule="VAL-VIS-ID-FORMAT",
        description="Every namespaced identifier occurrence matches PREFIX-SCOPE-NNN "
                    "with zero-padded numbering.",
        severity_on_failure=Severity.WARNING,
    )
    prefixes = set(NAMESPACES.keys())
    seen_bad = set()
    for rel in files:
        text = read_text(root, rel)
        for n, line in enumerate(text.splitlines(), start=1):
            for m in ANY_ID_RE.finditer(line):
                prefix = m.group(1)
                if prefix not in prefixes:
                    continue
                ident = m.group(0)
                chk.measured += 1
                if not WELL_FORMED_RE.match(ident):
                    key = (rel, ident)
                    if key in seen_bad:
                        continue
                    seen_bad.add(key)
                    chk.add(
                        f"malformed identifier '{ident}' "
                        "(expected PREFIX-SCOPE-NNN, zero padded)",
                        file=rel,
                        line=n,
                    )
    return chk


def _check_uniqueness(defs, namespaces) -> CheckResult:
    chk = CheckResult(
        name="ID-UNIQUE",
        rule="TBL-VIS-689",
        description="Zero duplicate identifier definitions in every namespace "
                    "(whole-corpus sweep, mention-excluded per VAL-VIS-949).",
    )
    for ns, spec in namespaces.items():
        occurrences = defs.get(ns, [])
        chk.measured += len(occurrences)
        if spec.get("first_occurrence_wins"):
            continue
        window = int(spec.get("collapse_window", 0) or 0)
        by_id: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        for ident, rel, line in occurrences:
            prior = by_id[ident]
            if window and prior and prior[-1][0] == rel and abs(line - prior[-1][1]) <= window:
                # Same record matched by two definition patterns; not a collision.
                continue
            prior.append((rel, line))
        for ident, locs in sorted(by_id.items()):
            if len(locs) > 1:
                where = "; ".join(f"{f}:{l}" for f, l in locs)
                chk.add(
                    f"duplicate definition of '{ident}' "
                    f"({len(locs)} definitions: {where})",
                    file=locs[0][0],
                    line=locs[0][1],
                )
    return chk


def _check_contiguity(defs, namespaces, permanent_gaps) -> CheckResult:
    chk = CheckResult(
        name="ID-CONTIGUITY",
        rule="VAL-VIS-ID-CONTIG",
        description="Strict namespaces are contiguous from their minimum to their "
                    "maximum, excluding the permanent gaps of TBL-VIS-689 (FA-10).",
    )
    for ns, spec in namespaces.items():
        occurrences = defs.get(ns, [])
        if not occurrences:
            continue
        by_scope: Dict[str, List[int]] = defaultdict(list)
        for ident, _rel, _line in occurrences:
            parts = ident.split("-")
            if len(parts) == 3:
                scope, num = parts[1], parts[2]
            else:
                scope, num = "", parts[-1]
            try:
                by_scope[scope].append(int(num))
            except ValueError:
                continue

        for scope, nums in sorted(by_scope.items()):
            unique = sorted(set(nums))
            if len(unique) < 2:
                continue
            width = max(3, max(len(str(n)) for n in unique))
            allowed = {g for g in permanent_gaps.get(ns, [])}
            missing = []
            for candidate in range(unique[0], unique[-1] + 1):
                if candidate in set(unique):
                    continue
                ident = (
                    f"{ns}-{scope}-{str(candidate).zfill(width)}"
                    if scope
                    else f"{ns}-{str(candidate).zfill(width)}"
                )
                if ident in allowed:
                    continue  # FA-10 permanent gap: correct to observe, wrong to report
                missing.append(ident)
            chk.measured += len(unique)
            if missing:
                severity = (
                    Severity.ERROR if spec.get("strict_contiguity") else Severity.WARNING
                )
                shown = ", ".join(missing[:12]) + (" …" if len(missing) > 12 else "")
                chk.add(
                    f"{ns}-{scope or 'ROOT'} namespace has {len(missing)} gap(s) "
                    f"between {unique[0]} and {unique[-1]}: {shown}",
                    severity=severity,
                )
            chk.extra.setdefault("ranges", {})[f"{ns}-{scope}" if scope else ns] = {
                "min": unique[0],
                "max": unique[-1],
                "count": len(unique),
                "gaps": len(missing),
                "permanent_gaps_honoured": sorted(allowed),
            }
    return chk


def _check_undefined_references(files, root, defs, namespaces) -> CheckResult:
    chk = CheckResult(
        name="ID-UNDEFINED",
        rule="VAL-VIS-ID-DEFINED",
        description="Every referenced identifier in a validated namespace has a definition "
                    "somewhere in the corpus.",
        severity_on_failure=Severity.WARNING,
    )
    known = set()
    for ns in namespaces:
        for ident, _f, _l in defs.get(ns, []):
            known.add(ident)
    permanent = {i for v in PERMANENT_GAPS.values() for i in v}

    reported = set()
    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        for n, line in enumerate(lines, start=1):
            for m in re.finditer(r"`([A-Z]{3,4}-[A-Z]{2,6}-\d{1,4})`", line):
                ident = m.group(1)
                ns = ident.split("-")[0]
                if ns not in namespaces:
                    continue
                chk.measured += 1
                if ident in known or ident in permanent or ident in reported:
                    continue
                reported.add(ident)
                chk.add(
                    f"identifier '{ident}' is referenced but never defined",
                    file=rel,
                    line=n,
                )
    return chk


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}

    enabled = config.get("namespaces")
    namespaces = (
        {k: v for k, v in NAMESPACES.items() if k in enabled} if enabled else dict(NAMESPACES)
    )
    permanent_gaps = dict(PERMANENT_GAPS)
    for ns, extra in (config.get("permanent_gaps") or {}).items():
        permanent_gaps.setdefault(ns, [])
        permanent_gaps[ns] = sorted(set(permanent_gaps[ns]) | set(extra))

    for ns, override in (config.get("strict_contiguity") or {}).items():
        if ns in namespaces:
            namespaces[ns] = dict(namespaces[ns], strict_contiguity=bool(override))

    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )
    defs, scanned = _collect_definitions(files, root, namespaces)

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.append(_check_format(files, root))
    result.checks.append(_check_uniqueness(defs, namespaces))
    result.checks.append(_check_contiguity(defs, namespaces, permanent_gaps))
    if config.get("check_undefined_references", False):
        result.checks.append(_check_undefined_references(files, root, defs, namespaces))

    max_dup = int(config.get("max_duplicate_ids", 0))
    dup_check = next(c for c in result.checks if c.name == "ID-UNIQUE")
    if max_dup and len(dup_check.errors) <= max_dup:
        for f in dup_check.findings:
            f.severity = Severity.WARNING

    result.metrics = {
        "files_scanned": scanned,
        "namespaces": sorted(namespaces),
        "definitions_per_namespace": {ns: len(defs.get(ns, [])) for ns in sorted(namespaces)},
        "total_definitions": sum(len(v) for v in defs.values()),
        "permanent_gaps_honoured": permanent_gaps,
    }
    return result
