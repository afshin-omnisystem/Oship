"""
Anchor and cross-reference validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("cross-reference resolution" — deferred to v2 by
the specification, implemented here as a WARNING-severity check so that installing
it cannot be mistaken for relaxing v1 scope).

Checks
------
ANC-INTERNAL   · MET-05 : same-file '#anchor' links resolve to a heading
ANC-CROSSFILE  · MET-05 : 'other.md#anchor' links resolve in the target file
ANC-TOC        · MET-05 : table-of-contents entries resolve
ANC-DUPLICATE  · DOC-STD-ANCHOR : duplicate H2 slugs (ambiguous anchor targets)

Slugging follows GitHub's algorithm: lowercase, strip anything that is not a word
character, hyphen or space, spaces to hyphens, de-duplicate with -1, -2, …

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import os
import re
import unicodedata
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from .base import (
    CheckResult,
    Severity,
    ValidatorResult,
    iter_markdown_files,
    read_text,
    strip_code_blocks,
)

VALIDATOR_NAME = "anchors"
TITLE = "Anchor and Cross-Reference Validator"

HEADING_RE = re.compile(r"^(\s{0,3})(#{1,6})\s+(.*?)\s*#*\s*$")
LINK_RE = re.compile(r"(?<!\!)\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HTML_ANCHOR_RE = re.compile(r"<a\s+(?:id|name)=\"([^\"]+)\"", re.I)
STRIP_MD_RE = re.compile(r"[`*_~]")


def slugify(text: str) -> str:
    """GitHub-compatible heading slug."""
    text = STRIP_MD_RE.sub("", text)
    # inline links in headings contribute their label only
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = unicodedata.normalize("NFKD", text)
    text = text.lower().strip()
    text = re.sub(r"[^\w\- ]+", "", text, flags=re.UNICODE)
    text = text.replace(" ", "-")
    return text


def _anchors_for(text: str) -> Tuple[Set[str], Dict[str, List[int]]]:
    """Return (all anchors, {h2 slug: [lines]}) for a document."""
    anchors: Set[str] = set()
    counts: Dict[str, int] = defaultdict(int)
    h2: Dict[str, List[int]] = defaultdict(list)

    lines = strip_code_blocks(text)
    for n, line in enumerate(lines, start=1):
        m = HEADING_RE.match(line)
        if m:
            level = len(m.group(2))
            base = slugify(m.group(3))
            if not base:
                continue
            slug = base if counts[base] == 0 else f"{base}-{counts[base]}"
            counts[base] += 1
            anchors.add(slug)
            if level == 2:
                h2[base].append(n)
        for a in HTML_ANCHOR_RE.finditer(line):
            anchors.add(a.group(1))
    return anchors, h2


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )

    cross_file_severity = (
        Severity.ERROR if config.get("fail_on_cross_file", False) else Severity.WARNING
    )
    internal_severity = (
        Severity.ERROR if config.get("fail_on_internal", False) else Severity.WARNING
    )

    anchor_index: Dict[str, Set[str]] = {}
    h2_index: Dict[str, Dict[str, List[int]]] = {}
    texts: Dict[str, str] = {}
    for rel in files:
        text = read_text(root, rel)
        texts[rel] = text
        anchor_index[rel], h2_index[rel] = _anchors_for(text)

    internal = CheckResult(
        name="ANC-INTERNAL",
        rule="MET-05",
        description="Same-file '#anchor' links resolve to an existing heading.",
        severity_on_failure=internal_severity,
    )
    crossfile = CheckResult(
        name="ANC-CROSSFILE",
        rule="MET-05",
        description="Cross-file 'path.md#anchor' links resolve in the target document.",
        severity_on_failure=cross_file_severity,
    )
    toc = CheckResult(
        name="ANC-TOC",
        rule="MET-05",
        description="Table-of-contents entries resolve to a heading in the same document.",
        severity_on_failure=internal_severity,
    )
    dupes = CheckResult(
        name="ANC-DUPLICATE",
        rule="DOC-STD-ANCHOR",
        description="No duplicate H2 heading slugs, which would make an anchor ambiguous.",
        severity_on_failure=Severity.WARNING,
    )

    broken_internal = 0
    broken_crossfile = 0

    for rel in files:
        text = texts[rel]
        lines = strip_code_blocks(text)
        own = anchor_index[rel]
        base_dir = os.path.dirname(rel)
        in_toc = False

        for n, line in enumerate(lines, start=1):
            if re.match(r"^#{1,6}\s+.*table of contents", line, re.I):
                in_toc = True
            elif re.match(r"^#{1,6}\s+", line):
                if in_toc and not re.match(r"^#{1,6}\s+.*table of contents", line, re.I):
                    in_toc = False

            for m in LINK_RE.finditer(line):
                target = m.group(2).strip()
                if "#" not in target:
                    continue
                path_part, _, frag = target.partition("#")
                frag = frag.strip()
                if not frag:
                    continue
                if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                    continue  # external URL

                if path_part == "":
                    internal.measured += 1
                    if in_toc:
                        toc.measured += 1
                    if frag not in own:
                        broken_internal += 1
                        msg = f"broken internal anchor '#{frag}' (link text '{m.group(1)[:40]}')"
                        if in_toc:
                            toc.add(msg, file=rel, line=n)
                        else:
                            internal.add(msg, file=rel, line=n)
                else:
                    if not path_part.endswith(".md"):
                        continue
                    crossfile.measured += 1
                    if path_part.startswith("/"):
                        tgt_rel = path_part.lstrip("/")
                    else:
                        tgt_rel = os.path.normpath(os.path.join(base_dir, path_part)).replace(
                            os.sep, "/"
                        )
                    if tgt_rel not in anchor_index:
                        if not os.path.exists(os.path.join(root, tgt_rel)):
                            broken_crossfile += 1
                            crossfile.add(
                                f"cross-reference target file not found: '{target}'",
                                file=rel,
                                line=n,
                            )
                        continue
                    if frag not in anchor_index[tgt_rel]:
                        broken_crossfile += 1
                        crossfile.add(
                            f"broken cross-file anchor '{target}' "
                            f"(no heading '#{frag}' in {tgt_rel})",
                            file=rel,
                            line=n,
                        )

        for slug, occurrences in h2_index[rel].items():
            dupes.measured += 1
            if len(occurrences) > 1:
                dupes.add(
                    f"duplicate H2 slug '{slug}' at lines "
                    + ", ".join(str(x) for x in occurrences),
                    file=rel,
                    line=occurrences[0],
                )

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.extend([internal, toc, crossfile, dupes])
    result.metrics = {
        "files_scanned": len(files),
        "anchors_defined": sum(len(v) for v in anchor_index.values()),
        "internal_anchor_links": internal.measured + toc.measured,
        "cross_file_anchor_links": crossfile.measured,
        "broken_anchors": broken_internal + broken_crossfile,
        "broken_internal_anchors": broken_internal,
        "broken_cross_file_anchors": broken_crossfile,
        "duplicate_h2_slugs": len(dupes.findings),
    }
    return result
