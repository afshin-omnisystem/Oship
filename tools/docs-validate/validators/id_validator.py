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
from dataclasses import dataclass, field
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


# --------------------------------------------------------------------------------------
# Occurrence classification — DEC-VIS-052
# --------------------------------------------------------------------------------------

class OccClass:
    """Occurrence classes defined by DEC-VIS-052 §7."""

    DEFINITION = "DEFINITION"
    REPUBLICATION = "REPUBLICATION"
    SEMANTIC_DUPLICATE = "SEMANTIC_DUPLICATE"
    DOUBLE_ALLOCATION = "DOUBLE_ALLOCATION"
    CROSS_FILE_DUPLICATE = "CROSS_FILE_DUPLICATE"
    FORWARD_POINTER = "FORWARD_POINTER"


@dataclass
class Occurrence:
    """One row-class or caption-class occurrence of an identifier."""

    identifier: str
    namespace: str
    file: str
    line: int
    kind: str                       # "row" | "caption" | "field" | "filename"
    header: Optional[str] = None    # nearest table header signature, row class only
    caption: Optional[str] = None   # nearest '### ' caption
    payload: str = ""               # all non-id cells, normalised
    normative: Optional[str] = None # the normative statement cell, if the table has one
    klass: str = OccClass.DEFINITION

    @property
    def location(self) -> str:
        return f"{self.file}:{self.line}"


# A caption that declares an allocation range, e.g.
#   ### TBL-VIS-099: F1 — Symptom, Cause, Impact (`FAL-VIS-001`…`FAL-VIS-015`)
# The caption is the allocation record per VAL-VIS-1820.
CAPTION_RANGE_RE = re.compile(
    r"`([A-Z]{3,4}-[A-Z]{2,6}-)(\d{1,4})`\s*(?:…|\.\.\.|—|-|to)\s*`?(?:[A-Z]{3,4}-[A-Z]{2,6}-)?(\d{1,4})`"
)

TABLE_DELIM_RE = re.compile(r"^\s{0,3}\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")


def _nearest_table_header(lines: List[str], idx: int, limit: int = 60) -> Optional[str]:
    """
    Walk back from a row to the nearest table header (the line above the delimiter row).
    Stops at a '### ' caption so we never cross a table boundary.
    """
    for i in range(idx - 1, max(-1, idx - limit), -1):
        s = lines[i].strip()
        if TABLE_DELIM_RE.match(s) and s.count("|") >= 2:
            if i - 1 >= 0 and lines[i - 1].strip().startswith("|"):
                return lines[i - 1].strip()
            return None
        if s.startswith("###"):
            return None
    return None


def _nearest_caption(lines: List[str], idx: int, limit: int = 80) -> Optional[str]:
    for i in range(idx - 1, max(-1, idx - limit), -1):
        s = lines[i].strip()
        if s.startswith("###"):
            return s
    return None


def _normalise_payload(line: str) -> str:
    """
    Normative cells of a row, excluding the identifier cell, lowercased and
    whitespace-collapsed, for semantic comparison (DEC-VIS-052 §5.3).
    """
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    body = " ".join(cells[1:]) if len(cells) > 1 else ""
    body = re.sub(r"[`*_]", "", body)
    body = re.sub(r"\s+", " ", body)
    return body.strip().lower()


# Column headings that carry NORMATIVE content — the statement of what a rule or
# failure mode IS. A later occurrence that restates one of these, differently, is a
# semantic redefinition even when the surrounding table shape differs (DEC-VIS-052 §5.3b).
NORMATIVE_COLUMNS = (
    "rule",
    "statement",
    "what it requires",
    "requirement",
    "anti-pattern",
    "failure",
)

# Columns that paraphrase by design. A digest table abbreviating a rule is a
# reference, not a redefinition, so these are excluded from the semantic guard.
SUMMARY_COLUMNS = (
    "rule summary",
    "summary",
    "short form",
    "what fails",
    "why no override exists",
)


def _normative_cell(header: Optional[str], line: str) -> Optional[str]:
    """
    Return the normative cell of a row, located by its column heading.

    Returns None when the table declares no normative column — evidence and
    registry tables typically do not, which is precisely why they are references.
    """
    if not header:
        return None
    cols = [c.strip().lower() for c in header.strip().strip("|").split("|")]
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    # A table that also carries a summary/paraphrase column is a digest table; its
    # cells restate rather than define.
    if any(c in SUMMARY_COLUMNS for c in cols):
        return None
    for i, col in enumerate(cols):
        if col in NORMATIVE_COLUMNS and i < len(cells):
            v = re.sub(r"[`*_]", "", cells[i])
            v = re.sub(r"\s+", " ", v).strip().lower()
            if not v:
                return None
            # The cell is a lookup key, not a statement (e.g. '| `VAL-VIS-425` |'
            # under a 'Rule' heading in an evidence table).
            if re.fullmatch(r"[a-z]{3,4}-[a-z]{2,6}-\d{1,4}", v):
                return None
            return v
    return None


def _caption_declares_range(caption: Optional[str], identifier: str) -> bool:
    """
    True only when the caption declares an explicit allocation RANGE covering this
    identifier, e.g. '### TBL-VIS-099: ... (`FAL-VIS-001`…`FAL-VIS-015`)'.

    This is the strongest allocation signal (VAL-VIS-1820) and the ONLY signal
    permitted to teach an allocation-header signature, because a range is an
    unambiguous claim of ownership. A caption that merely names an identifier is
    not sufficient — a derived table may legitimately cite one in its title.
    """
    if not caption:
        return False
    parts = identifier.rsplit("-", 1)
    if len(parts) != 2:
        return False
    prefix, num = parts[0] + "-", parts[1]
    try:
        value = int(num)
    except ValueError:
        return False
    for m in CAPTION_RANGE_RE.finditer(caption):
        if m.group(1) != prefix:
            continue
        try:
            lo, hi = int(m.group(2)), int(m.group(3))
        except ValueError:
            continue
        if lo <= value <= hi:
            return True
    return False


def _caption_allocates(caption: Optional[str], identifier: str) -> bool:
    """
    True when the caption claims allocation of this identifier: either an explicit
    range covering it, or a caption whose subject IS the identifier
    (e.g. '### DEC-VIS-043 — Identifier Collision Resolution').
    """
    if not caption:
        return False
    if _caption_declares_range(caption, identifier):
        return True
    # A caption whose subject is the identifier itself, e.g.
    #   '### DEC-VIS-043 — Identifier Collision Resolution for PART 05'
    # Requires the identifier at the START of the caption body, so that a derived
    # table merely citing an identifier in its title is not misread as allocating.
    body = caption.lstrip("#").strip()
    if re.match(r"^`?" + re.escape(identifier) + r"`?\b", body):
        return True
    return False


def _normative_compatible(a: str, b: str) -> bool:
    """
    True when two normative statements are restatements of one another rather than
    a redefinition: one contains the other, or they share most of their vocabulary.
    Deliberately conservative — when in doubt, report.
    """
    if a == b:
        return True
    if a in b or b in a:
        return True
    wa = {w for w in re.findall(r"[a-z0-9-]{4,}", a)}
    wb = {w for w in re.findall(r"[a-z0-9-]{4,}", b)}
    if not wa or not wb:
        return False
    overlap = len(wa & wb) / min(len(wa), len(wb))
    return overlap >= 0.6


def _classify_occurrences(
    occurrences: List["Occurrence"],
    allocation_headers: Dict[str, set],
) -> None:
    """
    Assign an OccClass to every occurrence of one identifier, in document order.

    DEC-VIS-052:
      - the first authoritative allocation owns the identifier
      - later occurrences are references unless they allocate or diverge semantically
      - cross-file duplication is always an error
    """
    if not occurrences:
        return

    occurrences.sort(key=lambda o: (o.file, o.line))

    # Ownership goes to the strongest allocation signal, earliest in document order —
    # NOT merely the first file alphabetically. A row under a range-declaring caption
    # or an allocation-shaped header outranks a bare registry row, so that a reference
    # in an alphabetically-earlier file cannot usurp ownership (DEC-VIS-052 §5.1).
    ns = occurrences[0].namespace
    alloc_headers = allocation_headers.get(ns, set())

    def _strength(o: "Occurrence") -> int:
        if o.kind in ("caption", "field", "filename"):
            return 3
        if _caption_declares_range(o.caption, o.identifier):
            return 3
        if o.header and o.header in alloc_headers:
            return 2
        if o.normative:
            return 1
        return 0

    best = max(range(len(occurrences)), key=lambda i: (_strength(occurrences[i]), -i))
    first = occurrences[best]
    first.klass = OccClass.DEFINITION
    rest = [o for i, o in enumerate(occurrences) if i != best]

    group_defs = [first]

    for occ in rest:
        # Rule 6: two definitions in two different files is always a collision.
        if occ.file != first.file and occ.kind != "row":
            occ.klass = OccClass.CROSS_FILE_DUPLICATE
            continue

        if occ.kind != "row":
            # A second caption/field definition of the same id is a real duplicate.
            occ.klass = OccClass.DOUBLE_ALLOCATION
            continue

        # Guard (c) / (d) — a SECOND allocation claim.
        #
        # A later occurrence claims allocation when its caption names the identifier
        # as its subject, or restates a range covering it, or it sits under a header
        # signature learned as an allocation signature.
        #
        # It is NOT a double allocation merely for restating a range: the corpus
        # legitimately does this in derived tables (TBL-VIS-222 allocates
        # `FAL-VIS-121`…`131`; TBL-VIS-223 restates the range to elaborate the same
        # objects). DEC-VIS-052 §5.1 gives ownership to the FIRST allocation, so a
        # restatement is a re-allocation only when its COLUMNS also match the
        # definition's — i.e. it is genuinely a second allocation table, not a
        # derived one. Divergent columns mean a derived table.
        claims_allocation = _caption_allocates(occ.caption, occ.identifier) or (
            occ.header is not None and occ.header in alloc_headers
        )
        if claims_allocation:
            same_shape = (
                occ.header is not None
                and first.header is not None
                and occ.header == first.header
            )
            if same_shape:
                occ.klass = OccClass.DOUBLE_ALLOCATION
                continue
            # Different columns under an allocation-shaped caption: a derived table.
            occ.klass = OccClass.REPUBLICATION
            continue

        # Guard (b): same identifier, divergent NORMATIVE content.
        #
        # Compared on the normative column (Rule / Statement / What it requires /
        # Anti-pattern / Failure), not on the whole row, so that a derived table
        # supplying different attributes is not mistaken for a redefinition. A table
        # with no normative column cannot redefine anything and is a reference by
        # construction. Applies across differing table shapes: TBL-VIS-394 restating
        # VAL-VIS-381 with different rule text is a redefinition even though its
        # columns differ from the allocation table's.
        definition_norm = None
        for cand in group_defs:
            if cand.normative:
                definition_norm = cand.normative
                break
        if (
            occ.normative
            and definition_norm
            and occ.normative != definition_norm
            and not _normative_compatible(occ.normative, definition_norm)
        ):
            occ.klass = OccClass.SEMANTIC_DUPLICATE
            continue

        # Same shape, divergent full payload — also a redefinition.
        if (
            occ.header
            and first.header
            and occ.header == first.header
            and occ.payload
            and first.payload
            and occ.payload != first.payload
        ):
            occ.klass = OccClass.SEMANTIC_DUPLICATE
            continue

        # Cross-file row-class republication is still reported, but as a duplicate:
        # ownership does not travel between documents.
        if occ.file != first.file:
            occ.klass = OccClass.CROSS_FILE_DUPLICATE
            continue

        occ.klass = OccClass.REPUBLICATION


def _collect_definitions(files, root, namespaces):
    """
    Collect every definitional occurrence, classified per DEC-VIS-052.

    Returns (occurrences_by_namespace, files_scanned, allocation_headers).
    An occurrence's `kind` records which pattern class matched:
      caption / field / filename -> definitional by construction
      row                        -> adjudicated by _classify_occurrences
    """
    occs: Dict[str, List[Occurrence]] = defaultdict(list)
    scanned = 0

    compiled = {}
    for ns, spec in namespaces.items():
        pats = []
        for p in spec["definition_patterns"]:
            kind = "row" if p.lstrip("^").startswith("\\|") else "caption"
            if "\\*\\*ID\\*\\*" in p or "Decision ID" in p:
                kind = "field"
            pats.append((re.compile(p), kind))
        compiled[ns] = pats

    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        scanned += 1

        for ns, spec in namespaces.items():
            fn_pat = spec.get("filename_definition")
            if fn_pat:
                m = re.match(fn_pat, rel.rsplit("/", 1)[-1])
                if m:
                    occs[ns].append(
                        Occurrence(m.group(1), ns, rel, 1, "filename")
                    )

        for n, line in enumerate(lines, start=1):
            if not line:
                continue
            for ns, patterns in compiled.items():
                matched = False
                for pat, kind in patterns:
                    m = pat.match(line)
                    if not m:
                        continue
                    ident = m.group(1)
                    occ = Occurrence(ident, ns, rel, n, kind)
                    if kind == "row":
                        occ.header = _nearest_table_header(lines, n - 1)
                        occ.caption = _nearest_caption(lines, n - 1)
                        occ.payload = _normalise_payload(line)
                        occ.normative = _normative_cell(occ.header, line)
                    else:
                        occ.caption = line.strip()
                    occs[ns].append(occ)
                    matched = True
                    break
                if matched:
                    break

    # Learn which table-header signatures are ALLOCATION signatures per namespace.
    #
    # A range-declaring caption is necessary but NOT sufficient: the corpus contains
    # derived tables that restate the range they elaborate (e.g. TBL-VIS-222 allocates
    # `FAL-VIS-121`…`131` and TBL-VIS-223 restates the same range for its
    # Detection/Prevention columns). Only the FIRST range-declaring occurrence of an
    # identifier, in document order, is an allocation — consistent with DEC-VIS-052 §5.1
    # "the first authoritative allocation owns the identifier".
    allocation_headers: Dict[str, set] = defaultdict(set)
    for ns, items in occs.items():
        first_seen: Dict[str, Tuple[str, int]] = {}
        for o in sorted(items, key=lambda x: (x.file, x.line)):
            if o.kind != "row" or not o.header:
                continue
            if not _caption_declares_range(o.caption, o.identifier):
                continue
            if o.identifier in first_seen:
                continue
            first_seen[o.identifier] = (o.file, o.line)
            allocation_headers[ns].add(o.header)

    return occs, scanned, allocation_headers


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


def _check_uniqueness(occs, namespaces, allocation_headers, republication_policy="dec-vis-052"):
    """
    Uniqueness sweep per TBL-VIS-689, with definition/reference semantics per DEC-VIS-052.

    Emits three distinct outcomes rather than one undifferentiated 'duplicate':
      SEMANTIC_DUPLICATE   -> ERROR  (same id, divergent normative content)
      DOUBLE_ALLOCATION    -> ERROR  (allocated twice)
      CROSS_FILE_DUPLICATE -> ERROR  (ownership does not travel between documents)
      REPUBLICATION        -> INFO   (benign; definition site named)

    republication_policy:
      "dec-vis-052" (default) — apply the decision
      "strict"                — pre-decision behaviour: every duplicate is an ERROR
    """
    chk = CheckResult(
        name="ID-UNIQUE",
        rule="TBL-VIS-689",
        description=(
            "Zero duplicate identifier DEFINITIONS in every namespace (whole-corpus "
            "sweep; mentions excluded per VAL-VIS-949; definitions distinguished from "
            "references per DEC-VIS-052)."
        ),
    )
    strict = republication_policy == "strict"
    counts = {
        OccClass.DEFINITION: 0,
        OccClass.REPUBLICATION: 0,
        OccClass.SEMANTIC_DUPLICATE: 0,
        OccClass.DOUBLE_ALLOCATION: 0,
        OccClass.CROSS_FILE_DUPLICATE: 0,
    }
    republications: List[Dict[str, Any]] = []

    for ns, spec in namespaces.items():
        items = occs.get(ns, [])
        chk.measured += len(items)
        if spec.get("first_occurrence_wins"):
            continue

        by_id: Dict[str, List[Occurrence]] = defaultdict(list)
        for o in items:
            by_id[o.identifier].append(o)

        for ident, group in sorted(by_id.items()):
            if len(group) == 1:
                group[0].klass = OccClass.DEFINITION
                counts[OccClass.DEFINITION] += 1
                continue

            # Collapse window: one record matched by two patterns is not a collision.
            window = int(spec.get("collapse_window", 0) or 0)
            if window:
                collapsed: List[Occurrence] = []
                for o in sorted(group, key=lambda x: (x.file, x.line)):
                    if (
                        collapsed
                        and collapsed[-1].file == o.file
                        and abs(o.line - collapsed[-1].line) <= window
                    ):
                        continue
                    collapsed.append(o)
                group = collapsed
                if len(group) == 1:
                    group[0].klass = OccClass.DEFINITION
                    counts[OccClass.DEFINITION] += 1
                    continue

            _classify_occurrences(group, allocation_headers)
            definition = group[0]
            counts[OccClass.DEFINITION] += 1

            for o in group[1:]:
                counts[o.klass] = counts.get(o.klass, 0) + 1

                if o.klass == OccClass.REPUBLICATION and not strict:
                    republications.append(
                        {
                            "identifier": ident,
                            "definition": definition.location,
                            "republication": o.location,
                            "definition_header": definition.header,
                            "republication_header": o.header,
                        }
                    )
                    chk.add(
                        f"'{ident}' republished at {o.location} — reference to the "
                        f"definition at {definition.location} (DEC-VIS-052 REPUBLICATION, "
                        f"not a redefinition)",
                        file=o.file,
                        line=o.line,
                        severity=Severity.INFO,
                    )
                    continue

                if o.klass == OccClass.SEMANTIC_DUPLICATE:
                    chk.add(
                        f"SEMANTIC DUPLICATE of '{ident}' at {o.location}: same "
                        f"identifier, divergent normative content against the "
                        f"definition at {definition.location} (DEC-VIS-052 §5.3b)",
                        file=o.file,
                        line=o.line,
                    )
                elif o.klass == OccClass.DOUBLE_ALLOCATION:
                    chk.add(
                        f"DOUBLE ALLOCATION of '{ident}' at {o.location}: a second "
                        f"allocation site claims an identifier already owned by "
                        f"{definition.location} (TBL-VIS-689)",
                        file=o.file,
                        line=o.line,
                    )
                elif o.klass == OccClass.CROSS_FILE_DUPLICATE:
                    chk.add(
                        f"CROSS-FILE DUPLICATE of '{ident}': defined at "
                        f"{definition.location} and again at {o.location}; ownership "
                        f"does not transfer between documents (TBL-VIS-689)",
                        file=o.file,
                        line=o.line,
                    )
                elif strict:
                    chk.add(
                        f"duplicate definition of '{ident}' at {o.location} "
                        f"(definition at {definition.location}) [strict policy]",
                        file=o.file,
                        line=o.line,
                    )

    chk.extra["classification"] = counts
    chk.extra["republication_policy"] = republication_policy
    chk.extra["republications"] = republications[:500]
    chk.extra["republication_count"] = len(republications)
    return chk


def _check_contiguity(defs, namespaces, permanent_gaps) -> CheckResult:
    chk = CheckResult(
        name="ID-CONTIGUITY",
        rule="VAL-VIS-ID-CONTIG",
        description="Strict namespaces are contiguous from their minimum to their "
                    "maximum, excluding the permanent gaps of TBL-VIS-689 (FA-10).",
    )
    for ns, spec in namespaces.items():
        occurrences = [o.identifier for o in defs.get(ns, [])]
        if not occurrences:
            continue
        by_scope: Dict[str, List[int]] = defaultdict(list)
        for ident in occurrences:
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
        for o in defs.get(ns, []):
            known.add(o.identifier)
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
    defs, scanned, allocation_headers = _collect_definitions(files, root, namespaces)
    republication_policy = str(
        config.get("republication_policy", "dec-vis-052")
    ).strip().lower()

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.append(_check_format(files, root))
    result.checks.append(
        _check_uniqueness(defs, namespaces, allocation_headers, republication_policy)
    )
    result.checks.append(_check_contiguity(defs, namespaces, permanent_gaps))
    if config.get("check_undefined_references", False):
        result.checks.append(_check_undefined_references(files, root, defs, namespaces))

    dup_check = next(c for c in result.checks if c.name == "ID-UNIQUE")
    classification = dup_check.extra.get("classification", {})
    result.metrics = {
        "files_scanned": scanned,
        "namespaces": sorted(namespaces),
        "occurrences_per_namespace": {
            ns: len(defs.get(ns, [])) for ns in sorted(namespaces)
        },
        "definitions_per_namespace": {
            ns: sum(1 for o in defs.get(ns, []) if o.klass == OccClass.DEFINITION)
            for ns in sorted(namespaces)
        },
        "total_occurrences": sum(len(v) for v in defs.values()),
        "classification": classification,
        "republication_policy": republication_policy,
        "republication_count": dup_check.extra.get("republication_count", 0),
        "allocation_header_signatures": {
            ns: sorted(v) for ns, v in allocation_headers.items()
        },
        "permanent_gaps_honoured": permanent_gaps,
        "decision_record": "DEC-VIS-052",
    }
    return result
