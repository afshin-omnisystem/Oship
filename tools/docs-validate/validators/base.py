"""
Shared primitives for all Oship documentation validators.

Artefact: ADOPT-01 / TBL-VIS-730
Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, Iterable, Iterator, List, Optional


# --------------------------------------------------------------------------------------
# Severity
# --------------------------------------------------------------------------------------

class Severity:
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


# --------------------------------------------------------------------------------------
# Result records
# --------------------------------------------------------------------------------------

@dataclass
class Finding:
    """A single defect located in the corpus."""

    rule: str                 # the VAL-/control identifier enforced (VAL-VIS-1639)
    check: str                # short machine name of the check
    severity: str             # Severity.*
    message: str
    file: Optional[str] = None
    line: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def render(self) -> str:
        loc = self.file or "<corpus>"
        if self.line:
            loc = f"{loc}:{self.line}"
        return f"[{self.severity}] [{self.rule}] {loc}: {self.message}"


@dataclass
class CheckResult:
    """
    Outcome of a single named check.

    `rule` carries the VAL- identifier the check enforces. VAL-VIS-1639 makes the
    citation binding: a check that does not name its rule cannot move an artefact
    to adoption state AS-6.
    """

    name: str
    rule: str
    description: str
    measured: int = 0
    findings: List[Finding] = field(default_factory=list)
    severity_on_failure: str = Severity.ERROR
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def errors(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == Severity.ERROR]

    @property
    def warnings(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == Severity.WARNING]

    @property
    def passed(self) -> bool:
        return not self.errors

    @property
    def status(self) -> str:
        return "PASS" if self.passed else "FAIL"

    def add(
        self,
        message: str,
        file: Optional[str] = None,
        line: Optional[int] = None,
        severity: Optional[str] = None,
    ) -> None:
        self.findings.append(
            Finding(
                rule=self.rule,
                check=self.name,
                severity=severity or self.severity_on_failure,
                message=message,
                file=file,
                line=line,
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check": self.name,
            "rule": self.rule,
            "description": self.description,
            "status": self.status,
            "measured": self.measured,
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "findings": [f.to_dict() for f in self.findings],
            "extra": self.extra,
        }


@dataclass
class ValidatorResult:
    """Aggregate outcome of one validator module."""

    validator: str
    title: str
    checks: List[CheckResult] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    skipped: bool = False
    skip_reason: str = ""

    @property
    def passed(self) -> bool:
        if self.skipped:
            return True
        return all(c.passed for c in self.checks)

    @property
    def status(self) -> str:
        if self.skipped:
            return "SKIP"
        return "PASS" if self.passed else "FAIL"

    @property
    def error_count(self) -> int:
        return sum(len(c.errors) for c in self.checks)

    @property
    def warning_count(self) -> int:
        return sum(len(c.warnings) for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "validator": self.validator,
            "title": self.title,
            "status": self.status,
            "skipped": self.skipped,
            "skip_reason": self.skip_reason,
            "errors": self.error_count,
            "warnings": self.warning_count,
            "metrics": self.metrics,
            "checks": [c.to_dict() for c in self.checks],
        }


# --------------------------------------------------------------------------------------
# Corpus traversal
# --------------------------------------------------------------------------------------

DEFAULT_EXCLUDES = (
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".mypy_cache",
    ".pytest_cache",
    "tools/docs-validate/reports",
)


def _is_excluded(rel_path: str, excludes: Iterable[str]) -> bool:
    norm = rel_path.replace(os.sep, "/")
    for pattern in excludes:
        p = pattern.strip("/").replace(os.sep, "/")
        if not p:
            continue
        if norm == p or norm.startswith(p + "/") or f"/{p}/" in f"/{norm}/":
            return True
    return False


def iter_markdown_files(
    root: str,
    includes: Optional[Iterable[str]] = None,
    excludes: Optional[Iterable[str]] = None,
) -> Iterator[str]:
    """
    Yield repository-relative paths of every Markdown file in scope.

    FA-07: scope is the whole tree (or the configured include roots), never a single file.
    """
    excludes = tuple(excludes) if excludes is not None else DEFAULT_EXCLUDES
    include_roots = [i.strip("/") for i in includes] if includes else None

    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")

        dirnames[:] = [
            d
            for d in sorted(dirnames)
            if not _is_excluded(f"{rel_dir}/{d}".strip("/"), excludes)
        ]

        for name in sorted(filenames):
            if not name.lower().endswith(".md"):
                continue
            rel = f"{rel_dir}/{name}".strip("/")
            if _is_excluded(rel, excludes):
                continue
            if include_roots is not None and not any(
                rel == r or rel.startswith(r + "/") for r in include_roots
            ):
                continue
            yield rel


def read_text(root: str, rel_path: str) -> str:
    with open(os.path.join(root, rel_path), "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


# --------------------------------------------------------------------------------------
# Fenced-code handling — shared by several validators
# --------------------------------------------------------------------------------------

FENCE_RE = re.compile(r"^(\s{0,3})(`{3,}|~{3,})\s*([^\s`~]*)")


@dataclass
class Fence:
    """A fenced code block located in a Markdown document."""

    info: str
    start_line: int          # 1-based line number of the opening fence
    end_line: Optional[int]  # 1-based line number of the closing fence, None if unclosed
    lines: List[str] = field(default_factory=list)

    @property
    def closed(self) -> bool:
        return self.end_line is not None

    @property
    def body(self) -> str:
        return "\n".join(self.lines)


def scan_fences(text: str):
    """
    Return (fences, unclosed) for a Markdown document.

    A minimal CommonMark-compatible fence scanner: a fence closes only on a marker
    of the same character and at least the same length, with no info string.
    """
    fences: List[Fence] = []
    unclosed: List[Fence] = []
    lines = text.splitlines()

    i = 0
    while i < len(lines):
        m = FENCE_RE.match(lines[i])
        if not m:
            i += 1
            continue

        marker = m.group(2)
        char = marker[0]
        length = len(marker)
        info = (m.group(3) or "").strip()

        fence = Fence(info=info, start_line=i + 1, end_line=None)
        j = i + 1
        while j < len(lines):
            cm = FENCE_RE.match(lines[j])
            if cm:
                cmarker = cm.group(2)
                cinfo = (cm.group(3) or "").strip()
                if cmarker[0] == char and len(cmarker) >= length and not cinfo:
                    fence.end_line = j + 1
                    break
            fence.lines.append(lines[j])
            j += 1

        if fence.end_line is None:
            unclosed.append(fence)
            fences.append(fence)
            break

        fences.append(fence)
        i = fence.end_line

    return fences, unclosed


def strip_code_blocks(text: str) -> List[str]:
    """
    Return document lines with fenced-code content blanked out.

    Positions are preserved (blanked lines become empty strings) so that any line
    number derived from the result still refers to the original document.
    """
    lines = text.splitlines()
    out = list(lines)
    fences, _ = scan_fences(text)
    for f in fences:
        end = f.end_line if f.end_line is not None else len(lines)
        for idx in range(f.start_line - 1, min(end, len(lines))):
            out[idx] = ""
    return out
