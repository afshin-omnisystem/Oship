"""
Mermaid diagram validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("Mermaid parse" check in scope for v1).
Acceptance: FA-04 — the checker exits non-zero when a Mermaid block fails to parse.

Three engines, in order of authority
------------------------------------
1. `mermaid.parse()` via Node — the reference implementation. Authoritative.
   Used when `node` plus a resolvable `mermaid` package are available.
2. `mmdc` (@mermaid-js/mermaid-cli) — also authoritative, slower.
3. A built-in structural parser — a FALLBACK that recognises a deliberately narrow
   set of unambiguous defects.

Why the fallback is narrow (ADOPT-OBL-01a)
------------------------------------------
The v1.0.0 structural parser counted `{`/`}` as node delimiters. In `erDiagram`,
crow's-foot cardinality (`||--o{`, `}o--o{`) uses those characters as relationship
glyphs. Validated against `mermaid.parse()` over 2,006 corpus diagrams, that parser
was wrong in BOTH directions:

  - 4 FALSE POSITIVES  — valid erDiagram reported invalid
  - 4 FALSE NEGATIVES  — genuinely broken diagrams reported valid, including
                         unescaped '(' inside a node label and several nodes
                         declared on one line without a separator

A validator that is wrong in both directions is worse than none, because it trains
its readers to ignore it (VIS-728). The fallback therefore reports
UNSUPPORTED_BY_VALIDATOR for any construct it cannot decide, rather than INVALID.

Result classes
--------------
VALID                     parsed successfully
INVALID                   the parser rejected it — an ERROR
UNSUPPORTED_BY_VALIDATOR  the available engine cannot decide — a WARNING, never
                          an ERROR, unless a governing rule requires rejection

Checks
------
MMD-NONEMPTY    · VAL-VIS-MERMAID-EMPTY  : no ```mermaid block is empty
MMD-TYPE        · VAL-VIS-MERMAID-TYPE   : first directive is a recognised diagram type
MMD-PARSE       · VAL-VIS-MERMAID-PARSE  : the diagram parses
MMD-COVERAGE    · VAL-VIS-MERMAID-COVER  : reports engine and undecidable count

Language note (FA-08): Python here is a tooling choice, not a W2 product decision.
"""

from __future__ import annotations

import json
import os
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

# Result classes
VALID = "VALID"
INVALID = "INVALID"
UNSUPPORTED = "UNSUPPORTED_BY_VALIDATOR"

DIAGRAM_TYPES = (
    "graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram",
    "stateDiagram-v2", "erDiagram", "journey", "gantt", "pie", "quadrantChart",
    "requirementDiagram", "gitGraph", "mindmap", "timeline", "zenuml",
    "sankey-beta", "xychart-beta", "block-beta", "packet-beta",
    "architecture-beta", "C4Context", "C4Container", "C4Component",
    "C4Dynamic", "C4Deployment",
)

# Diagram families the structural fallback understands well enough to judge.
# erDiagram, classDiagram, stateDiagram, mindmap, gitGraph and the C4 family use
# braces, pipes and colons with grammar-specific meaning, so the fallback
# abstains on them (UNSUPPORTED_BY_VALIDATOR) rather than guessing.
FALLBACK_DECIDABLE = ("graph", "flowchart")


class Diagram:
    def __init__(self, file: str, start_line: int, body: str):
        self.file = file
        self.start_line = start_line
        self.body = body
        self.result: str = VALID
        self.rule: str = "VAL-VIS-MERMAID-PARSE"
        self.message: str = ""
        self.engine: str = ""

    @property
    def location(self) -> str:
        return f"{self.file}:{self.start_line}"


def _collect_diagrams(files, root) -> List[Diagram]:
    out: List[Diagram] = []
    for rel in files:
        text = read_text(root, rel)
        fences, _ = scan_fences(text)
        for f in fences:
            if f.info.lower() == "mermaid":
                out.append(Diagram(rel, f.start_line, f.body))
    return out


def _significant_lines(body: str) -> List[str]:
    out = []
    for raw in body.splitlines():
        s = raw.strip()
        if not s or s.startswith("%%"):
            continue
        out.append(s)
    return out


def _strip_frontmatter(lines: List[str]) -> List[str]:
    if lines and lines[0] == "---":
        try:
            end = lines[1:].index("---") + 1
            return lines[end + 1 :]
        except ValueError:
            return lines
    return lines


# --------------------------------------------------------------------------------------
# Engine 1 — mermaid.parse() via Node (authoritative)
# --------------------------------------------------------------------------------------

_NODE_HARNESS = r"""
// ADOPT-OBL-01b — module resolution.
//
// The v1.1.0 harness used bare `import 'mermaid'` and relied on NODE_PATH to
// resolve it. NODE_PATH is honoured ONLY by the CommonJS resolver; the ESM
// resolver ignores it entirely. The import therefore threw ERR_MODULE_NOT_FOUND
// on every machine where the packages were not a parent directory of the
// harness, `_parse_with_node` returned False, and the validator SILENTLY
// degraded to the structural fallback — hiding 5 real diagram defects while
// still reporting MMD-PARSE as PASS.
//
// createRequire() gives us the CommonJS resolver rooted at the discovered
// node_modules directory; pathToFileURL() converts the absolute path into a
// specifier the ESM loader accepts.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const modBase = process.argv[4];
const require_ = createRequire(modBase.endsWith('/') ? modBase : modBase + '/');
const importFrom = async (name) =>
  await import(pathToFileURL(require_.resolve(name)).href);

const { JSDOM } = await importFrom('jsdom');
const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.SVGElement = dom.window.SVGElement;
global.Node = dom.window.Node;
global.DOMParser = dom.window.DOMParser;
global.NodeList = dom.window.NodeList;
global.getComputedStyle = dom.window.getComputedStyle;
const mermaid = (await importFrom('mermaid')).default;
const fs = await import('fs');
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
const out = [];
for (const it of items) {
  try {
    await mermaid.parse(it.body);
    out.push({ i: it.i, ok: true });
  } catch (e) {
    out.push({ i: it.i, ok: false, err: String(e.message || e).split('\n')[0].slice(0, 240) });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
"""


def _node_engine_available(node_modules: Optional[str]) -> Optional[str]:
    """Return a NODE_PATH that resolves both `mermaid` and `jsdom`, or None."""
    if not shutil.which("node"):
        return None
    candidates = []
    if node_modules:
        candidates.append(node_modules)
    candidates += [
        os.environ.get("NODE_PATH", ""),
        os.path.join(os.getcwd(), "node_modules"),
        "/tmp/node_modules",
        "/usr/lib/node_modules",
        "/usr/local/lib/node_modules",
    ]
    for base in candidates:
        if not base:
            continue
        if os.path.isdir(os.path.join(base, "mermaid")) and os.path.isdir(
            os.path.join(base, "jsdom")
        ):
            return base
    return None


def _parse_with_node(
    diagrams: List[Diagram],
    node_path: str,
    timeout: int = 900,
    diagnostics: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Parse every diagram in one Node process. Returns True on success.

    On failure the reason is recorded in `diagnostics` so the caller can report
    WHY the authoritative engine was unavailable instead of degrading silently
    (ADOPT-OBL-01b).
    """
    diag = diagnostics if diagnostics is not None else {}
    if not diagrams:
        return True
    tmpdir = tempfile.mkdtemp(prefix="oship-mermaid-")
    harness = os.path.join(tmpdir, "parse.mjs")
    infile = os.path.join(tmpdir, "in.json")
    outfile = os.path.join(tmpdir, "out.json")
    try:
        with open(harness, "w", encoding="utf-8") as fh:
            fh.write(_NODE_HARNESS)
        with open(infile, "w", encoding="utf-8") as fh:
            json.dump([{"i": i, "body": d.body} for i, d in enumerate(diagrams)], fh)

        env = dict(os.environ, NODE_PATH=node_path)
        proc = subprocess.run(
            ["node", harness, infile, outfile, node_path],
            capture_output=True, text=True, timeout=timeout, env=env, cwd=tmpdir,
        )
        if proc.returncode != 0 or not os.path.exists(outfile):
            err = (proc.stderr or proc.stdout or "").strip().splitlines()
            diag["reason"] = "node_harness_failed"
            diag["exit_code"] = proc.returncode
            diag["detail"] = next(
                (
                    l.strip()
                    for l in err
                    if l.strip().startswith(
                        ("Error", "TypeError", "SyntaxError", "ReferenceError")
                    )
                ),
                (err[0].strip() if err else "no stderr"),
            )[:300]
            diag["node_path"] = node_path
            return False
        with open(outfile, "r", encoding="utf-8") as fh:
            results = json.load(fh)

        for r in results:
            d = diagrams[r["i"]]
            d.engine = "mermaid.parse"
            if r.get("ok"):
                d.result = VALID
            else:
                d.result = INVALID
                err = r.get("err", "parse error")
                if "No diagram type detected" in err:
                    d.rule = "VAL-VIS-MERMAID-TYPE"
                d.message = err
        return True
    except (subprocess.TimeoutExpired, OSError, ValueError, json.JSONDecodeError) as exc:
        diag["reason"] = type(exc).__name__
        diag["detail"] = str(exc)[:300]
        diag["node_path"] = node_path
        return False
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------------------------
# Engine 2 — mmdc
# --------------------------------------------------------------------------------------

def _parse_with_mmdc(d: Diagram, mmdc: str, timeout: int = 60) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".mmd", delete=False, encoding="utf-8") as fh:
        fh.write(d.body)
        src = fh.name
    out = src + ".svg"
    d.engine = "mmdc"
    try:
        proc = subprocess.run(
            [mmdc, "-i", src, "-o", out, "-q"],
            capture_output=True, text=True, timeout=timeout,
        )
        if proc.returncode != 0:
            msg = (proc.stderr or proc.stdout or "mmdc failed").strip().splitlines()
            d.result = INVALID
            d.message = msg[0][:200] if msg else "mmdc failed"
    except subprocess.TimeoutExpired:
        d.result = UNSUPPORTED
        d.message = "mermaid-cli timed out"
    finally:
        for p in (src, out):
            try:
                os.unlink(p)
            except OSError:
                pass


# --------------------------------------------------------------------------------------
# Engine 3 — structural fallback (deliberately conservative)
# --------------------------------------------------------------------------------------

def _structural_parse(d: Diagram) -> None:
    """
    Decide only what can be decided without a grammar.

    Anything else -> UNSUPPORTED_BY_VALIDATOR. This parser must never report
    INVALID on a construct it does not fully model (ADOPT-OBL-01a).
    """
    d.engine = "structural"
    lines = _strip_frontmatter(_significant_lines(d.body))

    if not lines:
        d.result = INVALID
        d.rule = "VAL-VIS-MERMAID-EMPTY"
        d.message = "empty mermaid diagram (no directives)"
        return

    header = lines[0]
    first_token = re.split(r"[\s({]", header, maxsplit=1)[0]
    if not any(header.startswith(t) or first_token == t for t in DIAGRAM_TYPES):
        d.result = INVALID
        d.rule = "VAL-VIS-MERMAID-TYPE"
        d.message = f"unrecognised diagram type in header '{header[:60]}'"
        return

    if len(lines) == 1:
        d.result = INVALID
        d.rule = "VAL-VIS-MERMAID-EMPTY"
        d.message = f"diagram declares '{header[:40]}' but contains no statements"
        return

    if not header.startswith(FALLBACK_DECIDABLE):
        d.result = UNSUPPORTED
        d.message = (
            f"'{first_token}' grammar is not modelled by the structural fallback; "
            "install node + mermaid for an authoritative parse"
        )
        return

    # From here: graph / flowchart only.
    # Unbalanced quotes are unambiguous in every diagram family.
    for offset, line in enumerate(lines):
        if line.count('"') % 2 != 0:
            d.result = INVALID
            d.message = f"unbalanced double quote on diagram line {offset + 1}"
            return

    # subgraph/end balance
    depth = 0
    for offset, line in enumerate(lines):
        tok = line.split()[0] if line.split() else ""
        if tok == "subgraph":
            depth += 1
        elif tok == "end":
            depth -= 1
            if depth < 0:
                d.result = INVALID
                d.message = (
                    f"'end' without a matching 'subgraph' on diagram line {offset + 1}"
                )
                return
    if depth > 0:
        d.result = INVALID
        d.message = f"{depth} unclosed 'subgraph' block(s)"
        return

    # Dangling edge operators
    for offset, line in enumerate(lines):
        masked = re.sub(r'"[^"\n]*"', "", line).strip()
        if re.search(r"(-->|---|-\.->|==>|~~~)\s*$", masked):
            d.result = INVALID
            d.rule = "VAL-VIS-MERMAID-NODE"
            d.message = f"edge with no target on diagram line {offset + 1}"
            return

    d.result = VALID


# --------------------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------------------

def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    engine_pref = str(config.get("engine", "auto")).lower()

    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )
    diagrams = _collect_diagrams(files, root)

    # ADOPT-OBL-01b — require_authoritative makes degradation FAIL-CLOSED.
    # When true (the default), falling back to the structural parser is itself an
    # ERROR: the fallback abstains on 612 of 1,998 corpus diagrams, so a green
    # MMD-PARSE under it is not evidence that the corpus parses. Only an explicit
    # opt-out downgrades that to a warning.
    require_authoritative = bool(config.get("require_authoritative", True))

    node_path = (
        _node_engine_available(config.get("node_modules"))
        if engine_pref in ("auto", "node", "mermaid")
        else None
    )
    mmdc = shutil.which("mmdc") if engine_pref in ("auto", "mmdc") else None

    engine_used = "structural"
    engine_diag: Dict[str, Any] = {}
    if node_path and _parse_with_node(diagrams, node_path, diagnostics=engine_diag):
        engine_used = "mermaid.parse"
    elif mmdc:
        engine_used = "mmdc"
        for d in diagrams:
            _parse_with_mmdc(d, mmdc)
    else:
        if not node_path and engine_pref in ("auto", "node", "mermaid"):
            engine_diag.setdefault("reason", "packages_not_found")
            engine_diag.setdefault(
                "detail",
                "no directory containing both 'mermaid' and 'jsdom' was found; "
                "searched validation.mermaid.node_modules, $NODE_PATH, "
                "./node_modules, /tmp/node_modules and the global prefixes",
            )
        if engine_pref in ("node", "mermaid", "mmdc"):
            res = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
            chk = CheckResult(
                name="MMD-ENGINE",
                rule="VAL-VIS-MERMAID-PARSE",
                description="The configured authoritative Mermaid engine is unavailable.",
            )
            chk.add(
                f"engine '{engine_pref}' requested but not available "
                f"({engine_diag.get('reason', 'unknown')}: "
                f"{engine_diag.get('detail', 'no detail')})"
            )
            res.checks.append(chk)
            return res
        for d in diagrams:
            _structural_parse(d)

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
    parse_chk = CheckResult(
        name="MMD-PARSE",
        rule="VAL-VIS-MERMAID-PARSE",
        description=f"Each diagram parses (engine: {engine_used}).",
    )
    cover_chk = CheckResult(
        name="MMD-COVERAGE",
        rule="VAL-VIS-MERMAID-COVER",
        description=(
            "Diagrams the active engine cannot decide are reported as "
            "UNSUPPORTED_BY_VALIDATOR, never as INVALID."
        ),
        severity_on_failure=Severity.WARNING,
    )
    authoritative = engine_used in ("mermaid.parse", "mmdc")
    engine_chk = CheckResult(
        name="MMD-ENGINE",
        rule="VAL-VIS-MERMAID-PARSE",
        description=(
            "An authoritative Mermaid engine (mermaid.parse or mmdc) is active. "
            "The structural fallback abstains on most diagram families, so a PASS "
            "under it is not evidence that the corpus parses (ADOPT-OBL-01b)."
        ),
        severity_on_failure=(
            Severity.ERROR if require_authoritative else Severity.WARNING
        ),
    )
    for c in (empty_chk, type_chk, parse_chk, cover_chk, engine_chk):
        c.measured = len(diagrams)

    if not authoritative:
        engine_chk.add(
            "NOT AUTHORITATIVE: the structural fallback is active, so "
            f"{sum(1 for d in diagrams if d.result == UNSUPPORTED)} of "
            f"{len(diagrams)} diagrams were NOT parsed. "
            f"reason={engine_diag.get('reason', 'engine not requested')}; "
            f"detail={engine_diag.get('detail', 'n/a')}. "
            "Install node + mermaid + jsdom, or set "
            "validation.mermaid.require_authoritative to false to accept reduced "
            "coverage deliberately."
        )

    by_rule = {
        "VAL-VIS-MERMAID-EMPTY": empty_chk,
        "VAL-VIS-MERMAID-TYPE": type_chk,
        "VAL-VIS-MERMAID-PARSE": parse_chk,
        "VAL-VIS-MERMAID-NODE": parse_chk,
    }

    valid = invalid = unsupported = 0
    unsupported_files: Dict[str, int] = {}
    invalid_list: List[Dict[str, Any]] = []

    for d in diagrams:
        if d.result == VALID:
            valid += 1
        elif d.result == INVALID:
            invalid += 1
            by_rule.get(d.rule, parse_chk).add(
                f"INVALID: {d.message}", file=d.file, line=d.start_line
            )
            invalid_list.append(
                {"file": d.file, "line": d.start_line, "error": d.message, "rule": d.rule}
            )
        else:
            unsupported += 1
            unsupported_files[d.file] = unsupported_files.get(d.file, 0) + 1
            cover_chk.add(
                f"UNSUPPORTED_BY_VALIDATOR: {d.message}",
                file=d.file,
                line=d.start_line,
                severity=Severity.WARNING,
            )

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.extend([empty_chk, type_chk, parse_chk, cover_chk, engine_chk])
    result.metrics = {
        "files_scanned": len(files),
        "total_diagrams": len(diagrams),
        "valid": valid,
        "invalid": invalid,
        "unsupported_by_validator": unsupported,
        "engine": engine_used,
        "authoritative": authoritative,
        "engine_required": require_authoritative,
        "engine_diagnostics": engine_diag,
        "invalid_diagrams": invalid_list,
        "unsupported_by_file": unsupported_files,
    }
    return result
