"""
Markdown structural validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("markdown fence balance", "YAML validity",
"JSON validity" checks in scope for v1).

Checks
------
MD-FENCE-BALANCE  · VAL-VIS-1592-FENCE : every fenced code block is closed
MD-EMPTY-HEADING  · DOC-STD-HEADING    : no heading with an empty text body
MD-HEADING-FORM   · DOC-STD-HEADING    : ATX headings are well formed (space after #, depth <= 6)
MD-CODE-FENCE     · DOC-STD-FENCE      : fence info strings are well formed / language tagged
MD-LINK-SYNTAX    · MET-05             : link and image syntax is well formed, no empty targets
MD-EMBEDDED-YAML  · TBL-VIS-730-YAML   : ```yaml blocks parse
MD-EMBEDDED-JSON  · TBL-VIS-730-JSON   : ```json blocks parse
MD-TABLE-SHAPE    · DOC-STD-TABLE      : GFM tables have a delimiter row

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

from .base import (
    CheckResult,
    Severity,
    ValidatorResult,
    iter_markdown_files,
    read_text,
    scan_fences,
    strip_code_blocks,
)

VALIDATOR_NAME = "markdown"
TITLE = "Markdown Structural Validator"

ATX_RE = re.compile(r"^(\s{0,3})(#{1,})(\s*)(.*)$")
INLINE_LINK_RE = re.compile(r"(!?)\[([^\]]*)\]\(([^)]*)\)")
UNCLOSED_LINK_RE = re.compile(r"!?\[[^\]\n]*\]\([^)\n]*$")
REF_DEF_RE = re.compile(r"^\s{0,3}\[([^\]]+)\]:\s*(\S+)")
REF_USE_RE = re.compile(r"(?<!\])\[([^\]\n]+)\]\[([^\]\n]*)\]")

# A "language-less" fence is tolerated for ASCII diagrams and quoted output.
LANGLESS_TOLERATED = True


def _load_yaml_parser():
    try:
        import yaml  # type: ignore

        return yaml
    except Exception:  # pragma: no cover - environment dependent
        return None


def _check_fence_balance(files, root) -> CheckResult:
    chk = CheckResult(
        name="MD-FENCE-BALANCE",
        rule="VAL-VIS-1592-FENCE",
        description="Every fenced code block opened in a Markdown file is closed.",
    )
    for rel in files:
        text = read_text(root, rel)
        fences, unclosed = scan_fences(text)
        chk.measured += len(fences)
        for f in unclosed:
            chk.add(
                f"unclosed code fence opened at line {f.start_line} "
                f"(info string: {f.info or '<none>'})",
                file=rel,
                line=f.start_line,
            )
    return chk


def _check_headings(files, root) -> List[CheckResult]:
    empty = CheckResult(
        name="MD-EMPTY-HEADING",
        rule="DOC-STD-HEADING",
        description="No ATX heading may have an empty text body.",
    )
    form = CheckResult(
        name="MD-HEADING-FORM",
        rule="DOC-STD-HEADING",
        description="ATX headings are well formed: a space follows the hashes, depth is 1..6.",
    )
    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        for n, line in enumerate(lines, start=1):
            if not line.startswith(("#", " #", "  #", "   #")):
                continue
            m = ATX_RE.match(line)
            if not m:
                continue
            hashes, gap, body = m.group(2), m.group(3), m.group(4).strip()
            empty.measured += 1
            form.measured += 1
            body_no_trailing = body.rstrip("#").strip()
            if not body_no_trailing:
                empty.add(f"empty heading '{line.strip()}'", file=rel, line=n)
            if len(hashes) > 6:
                form.add(
                    f"heading depth {len(hashes)} exceeds the ATX maximum of 6",
                    file=rel,
                    line=n,
                )
            elif not gap and body:
                form.add(
                    "missing space between '#' and heading text "
                    f"('{line.strip()[:48]}')",
                    file=rel,
                    line=n,
                )
    return [empty, form]


def _check_code_fences(files, root) -> CheckResult:
    chk = CheckResult(
        name="MD-CODE-FENCE",
        rule="DOC-STD-FENCE",
        description="Fence info strings are well formed (no stray backticks, no whitespace-only tag).",
    )
    for rel in files:
        text = read_text(root, rel)
        fences, _ = scan_fences(text)
        for f in fences:
            chk.measured += 1
            if "`" in f.info or "~" in f.info:
                chk.add(
                    f"malformed fence info string '{f.info}'",
                    file=rel,
                    line=f.start_line,
                )
            if f.closed and not f.lines and f.info:
                chk.add(
                    f"empty '{f.info}' code block",
                    file=rel,
                    line=f.start_line,
                    severity=Severity.WARNING,
                )
            if not f.info and not LANGLESS_TOLERATED:
                chk.add(
                    "code fence without a language tag",
                    file=rel,
                    line=f.start_line,
                    severity=Severity.WARNING,
                )
    return chk


def _check_links(files, root, check_local_targets: bool = True) -> CheckResult:
    chk = CheckResult(
        name="MD-LINK-SYNTAX",
        rule="MET-05",
        description="Link and image syntax is well formed; targets are non-empty; "
                    "relative file targets resolve on disk.",
    )
    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        base_dir = os.path.dirname(rel)
        ref_defs = set()
        for line in lines:
            m = REF_DEF_RE.match(line)
            if m:
                ref_defs.add(m.group(1).strip().lower())

        for n, line in enumerate(lines, start=1):
            # inline code spans are not link contexts
            scrubbed = re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), line)

            for m in INLINE_LINK_RE.finditer(scrubbed):
                chk.measured += 1
                bang, label, target = m.group(1), m.group(2), m.group(3).strip()
                if target == "":
                    chk.add(
                        f"empty link target for {'image' if bang else 'link'} "
                        f"'[{label[:40]}]()'",
                        file=rel,
                        line=n,
                    )
                    continue
                if not bang and label.strip() == "":
                    chk.add(
                        f"link with empty text pointing at '{target[:60]}'",
                        file=rel,
                        line=n,
                        severity=Severity.WARNING,
                    )
                if not check_local_targets:
                    continue
                if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith(
                    ("#", "//", "mailto:")
                ):
                    continue
                path_part = target.split("#", 1)[0].split("?", 1)[0].strip()
                if not path_part:
                    continue
                if path_part.startswith("/"):
                    candidate = os.path.join(root, path_part.lstrip("/"))
                else:
                    candidate = os.path.join(root, base_dir, path_part)
                if not os.path.exists(candidate):
                    chk.add(
                        f"relative link target does not exist: '{target}'",
                        file=rel,
                        line=n,
                        severity=Severity.WARNING,
                    )

            if UNCLOSED_LINK_RE.search(scrubbed):
                chk.add(
                    "unterminated link construct (missing closing parenthesis)",
                    file=rel,
                    line=n,
                    severity=Severity.WARNING,
                )

            for m in REF_USE_RE.finditer(scrubbed):
                label, ref = m.group(1), (m.group(2) or m.group(1))
                if ref.strip().lower() not in ref_defs:
                    chk.add(
                        f"reference-style link '[{label[:40]}][{ref[:40]}]' has no definition",
                        file=rel,
                        line=n,
                        severity=Severity.WARNING,
                    )
    return chk


def _check_embedded_yaml(files, root) -> CheckResult:
    yaml_mod = _load_yaml_parser()
    chk = CheckResult(
        name="MD-EMBEDDED-YAML",
        rule="TBL-VIS-730-YAML",
        description="Every ```yaml fenced block parses as YAML.",
    )
    if yaml_mod is None:
        chk.extra["skipped"] = "PyYAML not installed; embedded YAML parsing not performed"
        return chk
    for rel in files:
        text = read_text(root, rel)
        fences, _ = scan_fences(text)
        for f in fences:
            if f.info.lower() not in ("yaml", "yml"):
                continue
            chk.measured += 1
            body = f.body.strip()
            if not body:
                continue
            # Illustrative snippets with placeholder angle brackets are templates,
            # not documents; YAML cannot parse them and they are not defects.
            if re.search(r"<[A-Z_ |]+>", body):
                continue
            try:
                list(yaml_mod.safe_load_all(body))
            except Exception as exc:  # noqa: BLE001
                first = str(exc).splitlines()[0]
                chk.add(f"embedded YAML does not parse: {first}", file=rel, line=f.start_line)
    return chk


def _check_embedded_json(files, root) -> CheckResult:
    chk = CheckResult(
        name="MD-EMBEDDED-JSON",
        rule="TBL-VIS-730-JSON",
        description="Every ```json fenced block parses as JSON.",
    )
    for rel in files:
        text = read_text(root, rel)
        fences, _ = scan_fences(text)
        for f in fences:
            if f.info.lower() != "json":
                continue
            chk.measured += 1
            body = f.body.strip()
            if not body:
                continue
            if "..." in body or re.search(r"<[A-Za-z_ |]+>", body):
                continue  # elided illustrative snippet
            try:
                json.loads(body)
            except Exception as exc:  # noqa: BLE001
                chk.add(
                    f"embedded JSON does not parse: {str(exc).splitlines()[0]}",
                    file=rel,
                    line=f.start_line,
                )
    return chk


def _check_tables(files, root) -> CheckResult:
    chk = CheckResult(
        name="MD-TABLE-SHAPE",
        rule="DOC-STD-TABLE",
        description="A GFM table header row is followed by a delimiter row.",
    )
    delim_re = re.compile(r"^\s{0,3}\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
    for rel in files:
        text = read_text(root, rel)
        lines = strip_code_blocks(text)
        for n, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped.startswith("|") or stripped.count("|") < 2:
                continue
            prev = lines[n - 2].strip() if n >= 2 else ""
            nxt = lines[n].strip() if n < len(lines) else ""
            if delim_re.match(stripped):
                continue
            if prev.startswith("|"):
                continue  # a body row
            chk.measured += 1
            if not delim_re.match(nxt):
                chk.add(
                    "table header row is not followed by a delimiter row",
                    file=rel,
                    line=n,
                    severity=Severity.WARNING,
                )
    return chk


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.append(_check_fence_balance(files, root))
    result.checks.extend(_check_headings(files, root))
    result.checks.append(_check_code_fences(files, root))
    result.checks.append(
        _check_links(files, root, check_local_targets=config.get("check_local_targets", True))
    )
    result.checks.append(_check_embedded_yaml(files, root))
    result.checks.append(_check_embedded_json(files, root))
    result.checks.append(_check_tables(files, root))
    result.metrics = {
        "files_scanned": len(files),
        "code_fences": next(
            (c.measured for c in result.checks if c.name == "MD-FENCE-BALANCE"), 0
        ),
        "headings": next(
            (c.measured for c in result.checks if c.name == "MD-EMPTY-HEADING"), 0
        ),
        "links": next((c.measured for c in result.checks if c.name == "MD-LINK-SYNTAX"), 0),
    }
    return result
