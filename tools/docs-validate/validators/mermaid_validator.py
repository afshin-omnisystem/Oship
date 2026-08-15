"""
Mermaid diagram validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("Mermaid parse" check in scope for v1).
Acceptance: FA-04 — the checker exits non-zero when a Mermaid block fails to parse.

Two engines
-----------
1. `mermaid-cli` / `@mermaid-js/mermaid-cli` (mmdc), when available on PATH:
   authoritative parse.
2. A built-in structural parser, always available: diagram-type recognition,
   empty-diagram detection, malformed-node/edge detection, unbalanced brackets,
   unterminated quotes, subgraph balance.

The structural parser is the default so the check is deterministic in CI without
a Node toolchain. Set `engine: mmdc` in validation-rules.yaml to require the CLI.

Checks
------
MMD-NONEMPTY   · VAL-VIS-MERMAID-EMPTY : no ```mermaid block is empty
MMD-TYPE       · VAL-VIS-MERMAID-TYPE  : first directive is a recognised diagram type
MMD-SYNTAX     · VAL-VIS-MERMAID-PARSE : brackets/quotes balanced, subgraphs closed
MMD-NODES      · VAL-VIS-MERMAID-NODE  : node and edge declarations are well formed

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional, Tuple

from .base import (
    CheckResult,
    Severity,
    ValidatorResult,
    iter_markdown_files,
    read_text,
    scan_fences,
)

VALIDATOR_NAME = "mermaid"
TITLE = "Mermaid Diagram Validator"

DIAGRAM_TYPES = (
    "graph",
    "flowchart",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "quadrantChart",
    "requirementDiagram",
    "gitGraph",
    "mindmap",
    "timeline",
    "zenuml",
    "sankey-beta",
    "xychart-beta",
    "block-beta",
    "packet-beta",
    "architecture-beta",
    "C4Context",
    "C4Container",
    "C4Component",
    "C4Dynamic",
    "C4Deployment",
)

DIRECTIVE_PREFIXES = ("%%", "---")

BRACKET_PAIRS = {"(": ")", "[": "]", "{": "}"}
CLOSERS = {v: k for k, v in BRACKET_PAIRS.items()}


class Diagram:
    def __init__(self, file: str, start_line: int, body: str):
        self.file = file
        self.start_line = start_line
        self.body = body
        self.errors: List[Tuple[str, str]] = []  # (rule, message)

    @property
    def ok(self) -> bool:
        return not self.errors


def _collect_diagrams(files, root) -> List[Diagram]:
    diagrams: List[Diagram] = []
    for rel in files:
        text = read_text(root, rel)
        fences, _ = scan_fences(text)
        for f in fences:
            if f.info.lower() != "mermaid":
                continue
            diagrams.append(Diagram(rel, f.start_line, f.body))
    return diagrams


def _significant_lines(body: str) -> List[str]:
    out = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("%%"):
            continue
        out.append(line)
    return out


def _strip_frontmatter(lines: List[str]) -> List[str]:
    if lines and lines[0] == "---":
        try:
            end = lines[1:].index("---") + 1
            return lines[end + 1 :]
        except ValueError:
            return lines
    return lines


def _mask_labels(line: str) -> str:
    """Blank out quoted label text so punctuation inside labels is not parsed."""
    return re.sub(r'"[^"\n]*"', lambda m: " " * len(m.group(0)), line)


def _structural_parse(d: Diagram) -> None:
    lines = _strip_frontmatter(_significant_lines(d.body))

    if not lines:
        d.errors.append(("VAL-VIS-MERMAID-EMPTY", "empty mermaid diagram (no directives)"))
        return

    header = lines[0]
    first_token = re.split(r"[\s({]", header, maxsplit=1)[0]
    if not any(
        header.startswith(t) or first_token == t for t in DIAGRAM_TYPES
    ):
        d.errors.append(
            (
                "VAL-VIS-MERMAID-TYPE",
                f"unrecognised diagram type in header '{header[:60]}'",
            )
        )

    if len(lines) == 1:
        d.errors.append(
            (
                "VAL-VIS-MERMAID-EMPTY",
                f"diagram declares '{header[:40]}' but contains no statements",
            )
        )
        return

    # quote balance
    for offset, line in enumerate(lines):
        if line.count('"') % 2 != 0:
            d.errors.append(
                (
                    "VAL-VIS-MERMAID-PARSE",
                    f"unbalanced double quote on diagram line {offset + 1}: '{line[:60]}'",
                )
            )
            break

    # bracket balance across the whole diagram, labels masked
    stack: List[Tuple[str, int]] = []
    for offset, line in enumerate(lines):
        masked = _mask_labels(line)
        for ch in masked:
            if ch in BRACKET_PAIRS:
                stack.append((ch, offset + 1))
            elif ch in CLOSERS:
                if not stack:
                    d.errors.append(
                        (
                            "VAL-VIS-MERMAID-NODE",
                            f"unmatched closing '{ch}' on diagram line {offset + 1}",
                        )
                    )
                    break
                opener, _ = stack.pop()
                if BRACKET_PAIRS[opener] != ch:
                    d.errors.append(
                        (
                            "VAL-VIS-MERMAID-NODE",
                            f"mismatched bracket: '{opener}' closed by '{ch}' "
                            f"on diagram line {offset + 1}",
                        )
                    )
                    break
    if stack:
        opener, ln = stack[0]
        d.errors.append(
            (
                "VAL-VIS-MERMAID-NODE",
                f"unclosed '{opener}' opened on diagram line {ln}",
            )
        )

    # subgraph balance (flowchart family)
    if header.startswith(("graph", "flowchart")):
        depth = 0
        for offset, line in enumerate(lines):
            token = line.split()[0] if line.split() else ""
            if token == "subgraph":
                depth += 1
            elif token == "end":
                depth -= 1
                if depth < 0:
                    d.errors.append(
                        (
                            "VAL-VIS-MERMAID-PARSE",
                            f"'end' without a matching 'subgraph' on diagram line {offset + 1}",
                        )
                    )
                    depth = 0
        if depth > 0:
            d.errors.append(
                ("VAL-VIS-MERMAID-PARSE", f"{depth} unclosed 'subgraph' block(s)")
            )

        # dangling edge operators
        for offset, line in enumerate(lines):
            masked = _mask_labels(line).strip()
            if re.search(r"(-->|---|-\.->|==>|~~~)\s*$", masked):
                d.errors.append(
                    (
                        "VAL-VIS-MERMAID-NODE",
                        f"edge with no target on diagram line {offset + 1}: '{line[:60]}'",
                    )
                )
            if re.match(r"^(-->|---|==>)", masked):
                d.errors.append(
                    (
                        "VAL-VIS-MERMAID-NODE",
                        f"edge with no source on diagram line {offset + 1}: '{line[:60]}'",
                    )
                )


def _mmdc_available() -> Optional[str]:
    return shutil.which("mmdc")


def _mmdc_parse(d: Diagram, mmdc: str, timeout: int = 30) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".mmd", delete=False, encoding="utf-8") as fh:
        fh.write(d.body)
        src = fh.name
    out = src + ".svg"
    try:
        proc = subprocess.run(
            [mmdc, "-i", src, "-o", out, "-q"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if proc.returncode != 0:
            msg = (proc.stderr or proc.stdout or "mmdc failed").strip().splitlines()
            d.errors.append(
                ("VAL-VIS-MERMAID-PARSE", f"mermaid-cli parse failure: {msg[0][:160]}")
            )
    except subprocess.TimeoutExpired:
        d.errors.append(("VAL-VIS-MERMAID-PARSE", "mermaid-cli timed out"))
    finally:
        for p in (src, out):
            try:
                import os

                os.unlink(p)
            except OSError:
                pass


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    engine = str(config.get("engine", "auto")).lower()

    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )
    diagrams = _collect_diagrams(files, root)

    mmdc = _mmdc_available() if engine in ("auto", "mmdc") else None
    if engine == "mmdc" and not mmdc:
        result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
        chk = CheckResult(
            name="MMD-ENGINE",
            rule="VAL-VIS-MERMAID-PARSE",
            description="mermaid-cli (mmdc) was required by configuration but is not installed.",
        )
        chk.add("engine 'mmdc' requested but the binary is not on PATH")
        result.checks.append(chk)
        return result

    use_mmdc = bool(mmdc) and engine in ("auto", "mmdc") and config.get("use_cli", True)

    for d in diagrams:
        _structural_parse(d)
        if use_mmdc and d.ok:
            _mmdc_parse(d, mmdc)  # type: ignore[arg-type]

    empty_chk = CheckResult(
        name="MMD-NONEMPTY",
        rule="VAL-VIS-MERMAID-EMPTY",
        description="No ```mermaid block is empty or statement-free.",
    )
    type_chk = CheckResult(
        name="MMD-TYPE",
        rule="VAL-VIS-MERMAID-TYPE",
        description="Each diagram opens with a recognised Mermaid diagram type.",
    )
    syntax_chk = CheckResult(
        name="MMD-SYNTAX",
        rule="VAL-VIS-MERMAID-PARSE",
        description="Diagram syntax parses: quotes balanced, subgraphs closed.",
    )
    node_chk = CheckResult(
        name="MMD-NODES",
        rule="VAL-VIS-MERMAID-NODE",
        description="Node and edge declarations are well formed and bracket-balanced.",
    )

    by_rule = {
        "VAL-VIS-MERMAID-EMPTY": empty_chk,
        "VAL-VIS-MERMAID-TYPE": type_chk,
        "VAL-VIS-MERMAID-PARSE": syntax_chk,
        "VAL-VIS-MERMAID-NODE": node_chk,
    }
    for chk in by_rule.values():
        chk.measured = len(diagrams)

    failed = 0
    for d in diagrams:
        if d.errors:
            failed += 1
        for rule, message in d.errors:
            by_rule[rule].add(message, file=d.file, line=d.start_line)

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.extend([empty_chk, type_chk, syntax_chk, node_chk])
    result.metrics = {
        "files_scanned": len(files),
        "total_diagrams": len(diagrams),
        "passed": len(diagrams) - failed,
        "failed": failed,
        "engine": "mermaid-cli" if use_mmdc else "structural",
    }
    return result
