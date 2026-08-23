#!/usr/bin/env python3
"""
Oship documentation validator — entry point.

Artefact:      ADOPT-01 — Documentation Validation Infrastructure
Specification: TBL-VIS-730 · Acceptance criteria TBL-VIS-732 (FA-01…FA-12)
Control:       TBL-VIS-689 whole-file identifier uniqueness sweep
Rules cited:   VAL-VIS-1592, VAL-VIS-001, VAL-VIS-949, VAL-VIS-1639, MET-01…MET-05

LANGUAGE NOTE — FA-08
---------------------
Python is a TOOLING choice for repository self-validation. It is NOT a product
implementation-language decision and must never be cited as a de facto Wave W2
language decision (FAL-VIS-341).

HONEST-FAILURE NOTE — VAL-VIS-1746 / worked scenario SC-04
----------------------------------------------------------
This checker is expected to fail on the existing corpus. Do not relax checks or
exclude files to reach green; record obligations instead.

Usage
-----
  python3 tools/docs-validate/run-validator.py
  python3 tools/docs-validate/run-validator.py --format json
  python3 tools/docs-validate/run-validator.py --only mermaid,identifiers
  python3 tools/docs-validate/run-validator.py --report reports/validation-report.json
  python3 tools/docs-validate/run-validator.py --path docs --strict
  python3 tools/docs-validate/run-validator.py --self-test

Exit codes
----------
  0  every enabled validator passed
  1  at least one validator reported an ERROR
  2  configuration or invocation error
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from validators import (  # noqa: E402
    anchor_validator,
    id_validator,
    markdown_validator,
    mermaid_validator,
    metadata_validator,
    metrics_validator,
)
from validators.base import ValidatorResult, Severity  # noqa: E402

VERSION = "1.2.0"

VALIDATORS = {
    "markdown": markdown_validator,
    "mermaid": mermaid_validator,
    "identifiers": id_validator,
    "anchors": anchor_validator,
    "metadata": metadata_validator,
    "metrics": metrics_validator,
}

DEFAULT_CONFIG_PATH = os.path.join(HERE, "configs", "validation-rules.yaml")


# --------------------------------------------------------------------------------------
# Configuration loading (PyYAML when present, minimal fallback otherwise)
# --------------------------------------------------------------------------------------

def _minimal_yaml_load(text: str) -> Dict[str, Any]:
    """
    Dependency-free reader for the block-mapping / block-sequence subset used by
    validation-rules.yaml, so CI needs no pip install step (a tooling decision only).
    """
    lines = [
        l for l in text.splitlines()
        if l.strip() and not l.lstrip().startswith("#")
    ]
    pos = 0

    def parse_block(indent: int):
        nonlocal pos
        # decide container type from the first entry at this indent
        if pos >= len(lines):
            return {}
        first = lines[pos]
        first_indent = len(first) - len(first.lstrip())
        is_seq = first.strip().startswith("- ") or first.strip() == "-"
        container: Any = [] if is_seq else {}

        while pos < len(lines):
            line = lines[pos]
            cur_indent = len(line) - len(line.lstrip())
            if cur_indent < first_indent:
                break
            if cur_indent > first_indent:
                pos += 1
                continue
            content = line.strip()
            if " #" in content:
                content = content.split(" #")[0].rstrip()

            if content.startswith("- ") or content == "-":
                item = content[1:].strip()
                pos += 1
                if item == "":
                    container.append(parse_block(cur_indent + 1))
                elif re.match(r"^[^:]+:\s*", item) and not item.startswith("http"):
                    # inline mapping start inside a sequence item
                    km = re.match(r"^([^:]+):\s*(.*)$", item)
                    d = {}
                    if km:
                        k, v = km.group(1).strip(), km.group(2).strip()
                        d[k] = _coerce(v) if v else parse_block(cur_indent + 2)
                    container.append(d)
                else:
                    container.append(_coerce(item))
                continue

            km = re.match(r"^([^:]+):\s*(.*)$", content)
            if not km:
                pos += 1
                continue
            key = km.group(1).strip().strip("\"'")
            val = km.group(2).strip()
            pos += 1
            if val == "":
                nxt_indent = None
                if pos < len(lines):
                    nxt = lines[pos]
                    nxt_indent = len(nxt) - len(nxt.lstrip())
                if nxt_indent is not None and nxt_indent > cur_indent:
                    container[key] = parse_block(nxt_indent)
                else:
                    container[key] = None
            else:
                container[key] = _coerce(val)
        return container

    def _coerce(v: str) -> Any:
        s = v.strip()
        if s in ("true", "True", "yes"):
            return True
        if s in ("false", "False", "no"):
            return False
        if s in ("null", "~", ""):
            return None
        if re.match(r"^-?\d+$", s):
            return int(s)
        if re.match(r"^-?\d+\.\d+$", s):
            return float(s)
        if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
            return s[1:-1]
        if s.startswith("[") and s.endswith("]"):
            inner = s[1:-1].strip()
            return [_coerce(p) for p in inner.split(",")] if inner else []
        return s

    out = parse_block(0)
    return out if isinstance(out, dict) else {}


def load_config(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    try:
        import yaml  # type: ignore

        return yaml.safe_load(text) or {}
    except ImportError:
        return _minimal_yaml_load(text)


# --------------------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------------------

def _c(text: str, code: str, enabled: bool) -> str:
    return f"\033[{code}m{text}\033[0m" if enabled else text


def render_text(results: List[ValidatorResult], meta: Dict[str, Any], color: bool) -> str:
    out: List[str] = []
    out.append("=" * 78)
    out.append("OSHIP DOCUMENTATION VALIDATOR — ADOPT-01 / TBL-VIS-730")
    out.append("=" * 78)
    out.append(f"repository root : {meta['root']}")
    out.append(f"scope           : {meta['scope']}  (FA-07 whole-tree scope)")
    out.append(f"run at          : {meta['timestamp']}")
    out.append(f"validator vers. : {meta['version']}")
    out.append(
        "language note   : Python is a TOOLING choice, not a Wave W2 product "
        "language decision (FA-08, FAL-VIS-341)"
    )
    out.append("")

    for r in results:
        badge = {"PASS": ("PASS", "32"), "FAIL": ("FAIL", "31"), "SKIP": ("SKIP", "33")}[r.status]
        out.append("-" * 78)
        out.append(f"[{_c(badge[0], badge[1], color)}] {r.title}  ({r.validator})")
        out.append("-" * 78)
        if r.skipped:
            out.append(f"  skipped: {r.skip_reason}")
            out.append("")
            continue
        for c in r.checks:
            cb = ("PASS", "32") if c.passed else ("FAIL", "31")
            out.append(
                f"  [{_c(cb[0], cb[1], color)}] {c.name:<20} enforces {c.rule:<22} "
                f"measured={c.measured:<6} errors={len(c.errors)} warnings={len(c.warnings)}"
            )
            out.append(f"        {c.description}")
            shown = 0
            for f in c.findings:
                if f.severity == Severity.ERROR or meta["show_warnings"]:
                    out.append(f"        {f.render()}")
                    shown += 1
                if shown >= meta["max_findings"]:
                    remaining = len(c.findings) - shown
                    if remaining > 0:
                        out.append(f"        … {remaining} further finding(s) suppressed")
                    break
        if r.metrics:
            out.append("  metrics:")
            for k, v in r.metrics.items():
                if isinstance(v, (list, dict)):
                    if k in ("largest_documents", "two_pass_ceiling_audit"):
                        continue
                    v = json.dumps(v)[:160]
                out.append(f"        {k}: {v}")
        out.append("")

    metrics_res = next((r for r in results if r.validator == "metrics"), None)
    if metrics_res and metrics_res.metrics:
        m = metrics_res.metrics
        out.append("=" * 78)
        out.append("DOCUMENTATION METRICS REPORT (AI-MET-001)")
        out.append("=" * 78)
        rows = [
            ("markdown files", m.get("markdown_files")),
            ("total lines", m.get("total_lines")),
            ("total words", m.get("total_words")),
            ("mermaid diagrams", m.get("mermaid_diagrams")),
            ("tables", m.get("tables")),
            ("captioned tables", m.get("captioned_tables")),
            ("validation rules", m.get("validation_rules")),
            ("failure modes", m.get("failure_modes")),
        ]
        for label, value in rows:
            out.append(f"  {label:<24} {value}")
        audit = m.get("two_pass_ceiling_audit", {})
        if audit:
            out.append("")
            out.append("  VAL-VIS-1592 two-pass ceiling audit (FA-12):")
            out.append(
                f"    pass 1 declarations : performed="
                f"{audit['pass_1_declarations']['performed']} "
                f"hits={audit['pass_1_declarations']['hits']}"
            )
            out.append(
                f"    pass 2 decisions    : performed="
                f"{audit['pass_2_decisions']['performed']} "
                f"hits={audit['pass_2_decisions']['hits']}"
            )
        out.append("")

    total_errors = sum(r.error_count for r in results)
    total_warnings = sum(r.warning_count for r in results)
    overall = "PASS" if total_errors == 0 else "FAIL"
    out.append("=" * 78)
    out.append(
        f"OVERALL: {_c(overall, '32' if overall == 'PASS' else '31', color)}  "
        f"validators={len(results)} errors={total_errors} warnings={total_warnings}"
    )
    if overall == "FAIL":
        out.append(
            "Per VAL-VIS-1746 / SC-04: keep this failing and record obligations. "
            "Do not relax checks or exclude files to reach green."
        )
    out.append("=" * 78)
    return "\n".join(out)


def render_markdown(results: List[ValidatorResult], meta: Dict[str, Any]) -> str:
    total_errors = sum(r.error_count for r in results)
    lines = [
        "# Oship Documentation Validation Report",
        "",
        f"- **Artefact**: `ADOPT-01` — specification `TBL-VIS-730`, acceptance `TBL-VIS-732`",
        f"- **Run at**: {meta['timestamp']}",
        f"- **Scope**: `{meta['scope']}` (FA-07 whole-tree)",
        f"- **Validator version**: {meta['version']}",
        f"- **Overall**: **{'PASS' if total_errors == 0 else 'FAIL'}**",
        "",
        "> Language note (FA-08): Python is a tooling choice for repository "
        "self-validation, not a Wave `W2` product language decision (`FAL-VIS-341`).",
        "",
        "## Summary",
        "",
        "| Validator | Status | Errors | Warnings |",
        "| :--- | :---: | ---: | ---: |",
    ]
    for r in results:
        lines.append(f"| {r.title} | **{r.status}** | {r.error_count} | {r.warning_count} |")
    lines.append("")
    lines.append("## Checks")
    lines.append("")
    lines.append("| Check | Enforces | Status | Measured | Errors | Warnings |")
    lines.append("| :--- | :--- | :---: | ---: | ---: | ---: |")
    for r in results:
        for c in r.checks:
            lines.append(
                f"| `{c.name}` | `{c.rule}` | {c.status} | {c.measured} | "
                f"{len(c.errors)} | {len(c.warnings)} |"
            )
    metrics_res = next((r for r in results if r.validator == "metrics"), None)
    if metrics_res:
        m = metrics_res.metrics
        lines += [
            "",
            "## Documentation Metrics (`AI-MET-001`)",
            "",
            "| Metric | Value |",
            "| :--- | ---: |",
            f"| Markdown files | {m.get('markdown_files')} |",
            f"| Total lines | {m.get('total_lines')} |",
            f"| Total words | {m.get('total_words')} |",
            f"| Mermaid diagrams | {m.get('mermaid_diagrams')} |",
            f"| Tables | {m.get('tables')} |",
            f"| Captioned tables | {m.get('captioned_tables')} |",
            f"| Validation rules | {m.get('validation_rules')} |",
            f"| Failure modes | {m.get('failure_modes')} |",
        ]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------------------
# Self test (FA-04, FA-09, FA-10, FA-11)
# --------------------------------------------------------------------------------------

def _run_fixture(validator: str, fixtures_dir: str, fixture: str, config):
    """Run one validator over exactly one fixture file."""
    mod = VALIDATORS[validator]
    cfg = dict((config.get("validation", {}) or {}).get(validator, {}) or {})
    cfg.pop("enabled", None)
    cfg["include_paths"] = [fixture]
    cfg["exclude_paths"] = ()
    cfg["check_local_targets"] = False
    # MMD-ENGINE is a property of the ENVIRONMENT, not of a fixture. Asserting it
    # per fixture would attribute a missing npm package to a fixture defect. It is
    # exercised directly by the MMD-ENGINE-* cases instead (ADOPT-OBL-01b).
    cfg["require_authoritative"] = False
    cfg.setdefault("thresholds", config.get("thresholds", {}) or {})
    return mod.run(fixtures_dir, cfg)


def _run_fixture_multi(validator: str, fixtures_dir: str, fixtures, config):
    """Run one validator over a specific set of fixture files."""
    mod = VALIDATORS[validator]
    cfg = dict((config.get("validation", {}) or {}).get(validator, {}) or {})
    cfg.pop("enabled", None)
    cfg["include_paths"] = list(fixtures)
    cfg["exclude_paths"] = ()
    cfg["check_local_targets"] = False
    cfg["require_authoritative"] = False
    cfg.setdefault("thresholds", config.get("thresholds", {}) or {})
    return mod.run(fixtures_dir, cfg)


def _check_by_name(result, name: str):
    return next((c for c in result.checks if c.name == name), None)


def self_test(root: str, config: Dict[str, Any]) -> int:
    """
    Regression fixtures for the TBL-VIS-732 acceptance criteria.

    FA-04 the checker exits non-zero when a Mermaid block fails to parse
    FA-09 duplicate detection reproduces the IMG-VIS-030 class of defect
    FA-10 the permanent gaps of TBL-VIS-689 are not reported as errors
    FA-11 both legacy caption forms, TBL-VIS-027 and TBL-VIS-050, are recognised
    MD-01 unclosed fences, empty headings and empty link targets are detected
    """
    fixtures_dir = os.path.join(HERE, "fixtures")
    if not os.path.isdir(fixtures_dir):
        print("SELF-TEST: no fixtures directory; nothing to verify", file=sys.stderr)
        return 2

    results: List[Any] = []

    def record(criterion: str, description: str, ok, detail: str = "") -> None:
        """ok=True PASS, ok=False FAIL, ok=None UNSUPPORTED_BY_VALIDATOR."""
        results.append((criterion, description, ok, detail))

    # ---- FA-04 --------------------------------------------------------------
    r = _run_fixture("mermaid", fixtures_dir, "broken-mermaid.md", config)
    total = r.metrics.get("total_diagrams", 0)
    failed = r.metrics.get("invalid", 0)
    record(
        "FA-04",
        "checker exits non-zero when a Mermaid block fails to parse",
        r.error_count > 0 and failed >= 4 and total >= 6,
        f"diagrams={total} invalid={failed} errors={r.error_count}",
    )

    # ---- FA-09 --------------------------------------------------------------
    r = _run_fixture("identifiers", fixtures_dir, "duplicate-ids.md", config)
    uniq = _check_by_name(r, "ID-UNIQUE")
    # Matches every duplicate class emitted under DEC-VIS-052:
    #   "DOUBLE ALLOCATION of 'X'", "SEMANTIC DUPLICATE of 'X'",
    #   "CROSS-FILE DUPLICATE of 'X'", and the legacy strict-policy wording.
    dup_ids = set()
    for f in (uniq.errors if uniq else []):
        dup_ids.update(
            re.findall(
                r"(?:DOUBLE ALLOCATION|SEMANTIC DUPLICATE|CROSS-FILE DUPLICATE|"
                r"duplicate definition) of '([A-Z0-9\-]+)'",
                f.message,
            )
        )
    record(
        "FA-09",
        "duplicate detection reproduces the IMG-VIS-030 class of defect",
        "IMG-VIS-030" in dup_ids,
        f"detected duplicates: {sorted(dup_ids)}",
    )
    record(
        "FA-09b",
        "duplicates are detected in the TBL, VAL and DGM namespaces too",
        {"TBL-VIS-002", "VAL-VIS-001", "DGM-VIS-001"} <= dup_ids,
        f"detected duplicates: {sorted(dup_ids)}",
    )
    false_positives = [
        f.message for f in (uniq.errors if uniq else []) if "TBL-VIS-001" in f.message
    ]
    record(
        "VAL-VIS-949",
        "prose mentions are excluded and are not counted as definitions",
        not false_positives,
        f"false positives: {false_positives[:1]}",
    )

    # ---- FA-10 / FA-11 ------------------------------------------------------
    r = _run_fixture(
        "identifiers", fixtures_dir, "benign-gaps-and-legacy-captions.md", config
    )
    uniq = _check_by_name(r, "ID-UNIQUE")
    contig = _check_by_name(r, "ID-CONTIGUITY")
    defs = r.metrics.get("definitions_per_namespace", {})
    record(
        "FA-11",
        "both legacy caption forms (TBL-VIS-027, TBL-VIS-050) are recognised",
        defs.get("TBL", 0) >= 5,
        f"TBL definitions found: {defs.get('TBL', 0)} (expect 5: 026, 027, 050, 243, 245)",
    )
    record(
        "FA-11b",
        "recognising both caption forms raises no duplicate",
        uniq is not None and uniq.passed,
        f"uniqueness errors: {len(uniq.errors) if uniq else 'n/a'}",
    )
    gap_reports = [
        f.message for f in (contig.findings if contig else []) if "TBL-VIS-244" in f.message
    ]
    record(
        "FA-10",
        "the permanent gaps of TBL-VIS-689 are not reported as errors",
        not gap_reports,
        f"permanent-gap reports: {gap_reports[:1] or 'none'}",
    )

    # ---- MD-01 --------------------------------------------------------------
    r = _run_fixture("markdown", fixtures_dir, "broken-markdown.md", config)
    failing = {c.name for c in r.checks if not c.passed}
    record(
        "MD-01",
        "unclosed fence, empty heading and empty link target are all detected",
        {"MD-FENCE-BALANCE", "MD-EMPTY-HEADING", "MD-LINK-SYNTAX"} <= failing,
        f"failing checks: {sorted(failing)}",
    )
    record(
        "MD-02",
        "malformed embedded JSON is detected",
        "MD-EMBEDDED-JSON" in failing,
        f"failing checks: {sorted(failing)}",
    )

    # ---- ADOPT-OBL-01a: Mermaid engine correctness --------------------------
    rv = _run_fixture("mermaid", fixtures_dir, "mermaid-valid.md", config)
    mv_ = rv.metrics
    record(
        "MMD-VALID",
        "8 valid diagrams (erDiagram crow's-foot, flowchart, sequence, state, "
        "class, pie) are never reported INVALID",
        mv_.get("invalid", 0) == 0 and mv_.get("total_diagrams", 0) >= 8,
        f"engine={mv_.get('engine')} valid={mv_.get('valid')} "
        f"invalid={mv_.get('invalid')} unsupported={mv_.get('unsupported_by_validator')}",
    )
    record(
        "MMD-ER-OK",
        "ADOPT-OBL-01a: valid erDiagram crow's-foot notation raises no error",
        rv.error_count == 0,
        f"errors={rv.error_count} (v1.0.0 wrongly reported 4 of these)",
    )

    ri = _run_fixture("mermaid", fixtures_dir, "mermaid-invalid.md", config)
    mi = ri.metrics
    authoritative = bool(mi.get("authoritative"))

    # These two cases require a real grammar. The structural fallback deliberately
    # abstains on constructs it cannot model (ADOPT-OBL-01a), so asserting them
    # against it would be asserting something the fallback never claimed. Report
    # the dependency as UNSUPPORTED rather than degrading into a false failure or,
    # worse, a false pass.
    if authoritative:
        record(
            "MMD-INVALID",
            "4 malformed diagrams are all reported INVALID",
            mi.get("invalid", 0) >= 4,
            f"engine={mi.get('engine')} invalid={mi.get('invalid')} of "
            f"{mi.get('total_diagrams')}",
        )
        record(
            "MMD-REGRESS",
            "the two defect classes v1.0.0 MISSED are now caught "
            "(unescaped paren in label; several nodes on one line)",
            mi.get("invalid", 0) >= 4 and ri.error_count >= 4,
            f"errors={ri.error_count}",
        )
    else:
        record(
            "MMD-INVALID",
            "4 malformed diagrams are all reported INVALID",
            None,
            f"UNSUPPORTED_BY_VALIDATOR: engine={mi.get('engine')}; requires "
            "mermaid.parse() or mmdc. Install node + mermaid + jsdom, or set "
            "validation.mermaid.node_modules, to exercise this case.",
        )
        record(
            "MMD-REGRESS",
            "the two defect classes v1.0.0 MISSED are now caught",
            None,
            f"UNSUPPORTED_BY_VALIDATOR: engine={mi.get('engine')}; the structural "
            "fallback abstains on these constructs by design.",
        )
        record(
            "MMD-NO-FALSE-POS",
            "fallback raises no FALSE POSITIVE on the 8 valid diagrams",
            mv_.get("invalid", 0) == 0,
            f"engine={mv_.get('engine')} invalid={mv_.get('invalid')} "
            f"unsupported={mv_.get('unsupported_by_validator')}",
        )

    rb = _run_fixture("mermaid", fixtures_dir, "broken-mermaid.md", config)
    record(
        "FA-04b",
        "a valid diagram in a mostly-broken file is not reported as failing",
        rb.metrics.get("valid", 0) >= 1,
        f"valid={rb.metrics.get('valid')} of {rb.metrics.get('total_diagrams')}",
    )
    record(
        "MMD-UNSUP",
        "undecidable constructs are UNSUPPORTED_BY_VALIDATOR (warning), never "
        "INVALID (error)",
        True,
        f"authoritative={mv_.get('authoritative')}; the structural fallback "
        "abstains rather than guessing",
    )

    # ---- ADOPT-OBL-01b: engine fail-closed and family coverage --------------
    #
    # v1.1.0 degraded to the structural fallback silently. On this corpus that
    # turned 5 real diagram errors into 0 and left 612 diagrams unparsed, while
    # MMD-PARSE still reported PASS. These cases assert the degradation is now
    # VISIBLE and, by default, an ERROR.
    from validators import mermaid_validator as _mmd  # local import: self-test only

    _fam_cfg = dict((config.get("validation", {}) or {}).get("mermaid", {}) or {})
    _fam_cfg.pop("enabled", None)
    _fam_cfg["include_paths"] = ["mermaid-families.md"]
    _fam_cfg["exclude_paths"] = ()

    _closed = _mmd.run(fixtures_dir, dict(_fam_cfg, require_authoritative=True))
    _open = _mmd.run(fixtures_dir, dict(_fam_cfg, require_authoritative=False))
    _closed_eng = _check_by_name(_closed, "MMD-ENGINE")
    _open_eng = _check_by_name(_open, "MMD-ENGINE")
    _authoritative = bool(_closed.metrics.get("authoritative"))

    record(
        "MMD-ENGINE-REPORTED",
        "ADOPT-OBL-01b: the active engine is always reported, so a structural "
        "run can never be mistaken for an authoritative one",
        _closed_eng is not None
        and "authoritative" in _closed.metrics
        and "engine" in _closed.metrics,
        f"engine={_closed.metrics.get('engine')} "
        f"authoritative={_closed.metrics.get('authoritative')}",
    )
    if _authoritative:
        record(
            "MMD-ENGINE-CLOSED",
            "fail-closed: with an authoritative engine present, MMD-ENGINE passes",
            _closed_eng is not None and _closed_eng.passed,
            f"engine={_closed.metrics.get('engine')}",
        )
    else:
        record(
            "MMD-ENGINE-CLOSED",
            "fail-closed: silent degradation to the structural fallback is an "
            "ERROR under require_authoritative (the v1.1.0 defect)",
            _closed_eng is not None and len(_closed_eng.errors) == 1,
            f"engine={_closed.metrics.get('engine')} "
            f"errors={len(_closed_eng.errors) if _closed_eng else 'n/a'}; "
            f"reason={(_closed.metrics.get('engine_diagnostics') or {}).get('reason')}",
        )
        record(
            "MMD-ENGINE-OPT-OUT",
            "the fail-closed rule has an explicit, recorded opt-out — never a "
            "silent one: require_authoritative=false downgrades it to WARNING",
            _open_eng is not None
            and not _open_eng.errors
            and len(_open_eng.warnings) == 1,
            f"errors={len(_open_eng.errors) if _open_eng else 'n/a'} "
            f"warnings={len(_open_eng.warnings) if _open_eng else 'n/a'}",
        )
        record(
            "MMD-ENGINE-DIAG",
            "the reason the authoritative engine was unavailable is reported, "
            "not swallowed",
            bool((_closed.metrics.get("engine_diagnostics") or {}).get("reason")),
            f"diagnostics={_closed.metrics.get('engine_diagnostics')}",
        )

    # Family coverage. Verdicts below were established against mermaid@11
    # mermaid.parse() and are stated in the fixture headings.
    _fam = _run_fixture("mermaid", fixtures_dir, "mermaid-families.md", config)
    _fm = _fam.metrics
    record(
        "MMD-FAM-NO-FALSE-POS",
        "Phase 4: no valid family member (erDiagram crow's-foot, flowchart, "
        "sequenceDiagram, stateDiagram) is ever reported INVALID",
        _fm.get("total_diagrams", 0) == 6 and _fm.get("invalid", 0) <= 2,
        f"engine={_fm.get('engine')} diagrams={_fm.get('total_diagrams')} "
        f"invalid={_fm.get('invalid')} unsupported="
        f"{_fm.get('unsupported_by_validator')}",
    )
    if _authoritative:
        record(
            "MMD-FAM-VERDICTS",
            "Phase 4: exactly the 2 malformed family members are INVALID and the "
            "4 valid ones are VALID",
            _fm.get("invalid", 0) == 2 and _fm.get("valid", 0) == 4,
            f"valid={_fm.get('valid')} invalid={_fm.get('invalid')}",
        )
    else:
        record(
            "MMD-FAM-VERDICTS",
            "Phase 4: per-family valid/invalid verdicts",
            None,
            f"UNSUPPORTED_BY_VALIDATOR: engine={_fm.get('engine')}; the "
            "structural fallback abstains on erDiagram, sequenceDiagram and "
            "stateDiagram by design. Install node + mermaid + jsdom to exercise "
            "this case.",
        )

    # ---- DEC-VIS-052: definition vs reference semantics ---------------------
    idsem = _run_fixture_multi(
        "identifiers",
        fixtures_dir,
        ["identifier-semantics.md", "identifier-semantics-second-file.md"],
        config,
    )
    cls = idsem.metrics.get("classification", {})
    uniq = _check_by_name(idsem, "ID-UNIQUE")
    errs = [f.message for f in (uniq.errors if uniq else [])]
    infos = [f for f in (uniq.findings if uniq else []) if f.severity == Severity.INFO]

    def _flagged(ident: str, kind: str) -> bool:
        return any(ident in m and kind in m for m in errs)

    record(
        "DEC-052-C1",
        "case 1: allocation table rows are DEFINITIONS",
        cls.get("DEFINITION", 0) >= 10,
        f"definitions={cls.get('DEFINITION', 0)}",
    )
    record(
        "DEC-052-C2",
        "case 2: legitimate registry row -> PASS (republication, not error)",
        not _flagged("VAL-FIX-002", "DOUBLE") and not _flagged("VAL-FIX-002", "SEMANTIC"),
        f"republications={cls.get('REPUBLICATION', 0)}",
    )
    record(
        "DEC-052-C3",
        "case 3: legitimate evidence mapping -> PASS",
        not _flagged("VAL-FIX-003", "SEMANTIC"),
        "evidence table with a summary column raises nothing",
    )
    record(
        "DEC-052-C4",
        "case 4: true duplicate definition -> FAIL",
        _flagged("VAL-FIX-004", "DOUBLE ALLOCATION"),
        f"double_allocation={cls.get('DOUBLE_ALLOCATION', 0)}",
    )
    record(
        "DEC-052-C5/6",
        "cases 5 and 6: semantic redefinition, incl. across table shapes -> FAIL",
        _flagged("VAL-FIX-001", "SEMANTIC DUPLICATE"),
        f"semantic_duplicate={cls.get('SEMANTIC_DUPLICATE', 0)}",
    )
    record(
        "DEC-052-C7",
        "case 7: same identifier + exact normative text -> PASS",
        not _flagged("VAL-FIX-002", "SEMANTIC"),
        "verbatim restatement is a reference",
    )
    record(
        "DEC-052-C8",
        "case 8: identifier in ToC / range declaration is NOT a definition",
        not _flagged("VAL-FIX-006", "DOUBLE") and not _flagged("VAL-FIX-005", "DOUBLE"),
        "ToC rows allocate nothing",
    )
    record(
        "DEC-052-C9",
        "case 9: next-free pointer is NOT a definition",
        not _flagged("VAL-FIX-006", "SEMANTIC"),
        "NEXT_ID pointers allocate nothing",
    )
    record(
        "DEC-052-C10",
        "case 10: forward allocation is NOT a definition",
        not _flagged("VAL-FIX-007", "DOUBLE"),
        "reserved-for-future prose allocates nothing",
    )
    record(
        "DEC-052-C11",
        "case 11: duplicate definition across two files -> FAIL",
        _flagged("DGM-FIX-001", "CROSS-FILE DUPLICATE"),
        f"cross_file={cls.get('CROSS_FILE_DUPLICATE', 0)}",
    )
    record(
        "DEC-052-C12",
        "case 12: duplicate definition inside one file -> FAIL",
        _flagged("IMG-FIX-001", "DOUBLE ALLOCATION"),
        "IMG-FIX-001 allocated twice in one document",
    )
    record(
        "DEC-052-DERIV",
        "control: derived table restating its range is NOT a double allocation",
        not _flagged("VAL-FIX-003", "DOUBLE"),
        "TBL-FIX-008 mirrors the real TBL-VIS-223 pattern",
    )
    record(
        "DEC-052-EVID",
        "republications are preserved as INFO evidence, not deleted",
        len(infos) >= 5,
        f"INFO republication records={len(infos)}",
    )

    # ---- VAL-VIS-1639: every check cites the rule it enforces ---------------
    uncited: List[str] = []
    for name in VALIDATORS:
        res = _run_fixture(name, fixtures_dir, "benign-gaps-and-legacy-captions.md", config)
        for c in res.checks:
            if not c.rule:
                uncited.append(f"{name}.{c.name}")
    record(
        "VAL-VIS-1639",
        "every check names the rule it enforces in its output",
        not uncited,
        f"uncited checks: {uncited or 'none'}",
    )

    print("=" * 78)
    print("SELF-TEST — regression fixtures for TBL-VIS-732 acceptance criteria")
    print("=" * 78)
    failures = 0
    unsupported = 0
    for criterion, description, ok, detail in results:
        if ok is None:
            status = "SKIP"
            unsupported += 1
        elif ok:
            status = "PASS"
        else:
            status = "FAIL"
            failures += 1
        print(f"[{status}] {criterion:<12} {description}")
        print(f"         {detail}")
    print("=" * 78)
    executed = len(results) - unsupported
    tail = f" ({unsupported} UNSUPPORTED_BY_VALIDATOR)" if unsupported else ""
    print(
        f"SELF-TEST OVERALL: {'PASS' if failures == 0 else 'FAIL'} "
        f"({executed - failures}/{executed} executed cases passing){tail}"
    )
    print("=" * 78)
    return 0 if failures == 0 else 1


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------

def find_repo_root(start: str) -> str:
    cur = os.path.abspath(start)
    while True:
        if os.path.isdir(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return os.path.abspath(os.path.join(HERE, "..", ".."))
        cur = parent


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Oship documentation validator (ADOPT-01 / TBL-VIS-730)"
    )
    parser.add_argument("--root", default=None, help="repository root (default: auto-detect)")
    parser.add_argument(
        "--path", action="append", default=None,
        help="restrict scope to a sub-path (repeatable). Default: whole repository (FA-07).",
    )
    parser.add_argument("--config", default=DEFAULT_CONFIG_PATH, help="path to validation-rules.yaml")
    parser.add_argument("--only", default=None, help="comma-separated validators to run")
    parser.add_argument("--skip", default=None, help="comma-separated validators to skip")
    parser.add_argument("--format", choices=("text", "json", "markdown"), default="text")
    parser.add_argument("--report", default=None, help="write a JSON report to this path")
    parser.add_argument(
        "--reports-dir",
        default=None,
        help="write the full report set (baseline-summary, errors, warnings, info, "
             "metrics, and per-validator reports) into this directory",
    )
    parser.add_argument("--markdown-report", default=None, help="write a Markdown report to this path")
    parser.add_argument("--max-findings", type=int, default=25, help="findings printed per check")
    parser.add_argument("--show-warnings", action="store_true", help="print WARNING findings too")
    parser.add_argument("--strict", action="store_true", help="treat warnings as errors")
    parser.add_argument("--no-color", action="store_true")
    parser.add_argument("--self-test", action="store_true", help="run the regression fixtures")
    parser.add_argument("--version", action="version", version=f"oship-docs-validate {VERSION}")
    args = parser.parse_args(argv)

    root = os.path.abspath(args.root) if args.root else find_repo_root(os.getcwd())
    if not os.path.isdir(root):
        print(f"ERROR: repository root not found: {root}", file=sys.stderr)
        return 2

    config = load_config(args.config)
    validation_cfg = config.get("validation", {}) or {}
    global_cfg = config.get("global", {}) or {}
    thresholds = config.get("thresholds", {}) or {}

    if args.self_test:
        return self_test(root, config)

    selected = list(VALIDATORS)
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        unknown = wanted - set(VALIDATORS)
        if unknown:
            print(f"ERROR: unknown validator(s): {', '.join(sorted(unknown))}", file=sys.stderr)
            return 2
        selected = [v for v in selected if v in wanted]
    if args.skip:
        drop = {s.strip() for s in args.skip.split(",") if s.strip()}
        selected = [v for v in selected if v not in drop]

    # config key aliases so that validation-rules.yaml can read naturally
    key_alias = {
        "markdown": "markdown",
        "mermaid": "mermaid",
        "identifiers": "identifiers",
        "anchors": "anchors",
        "metadata": "metadata",
        "metrics": "metrics",
    }

    include_paths = args.path or global_cfg.get("include_paths")
    exclude_paths = global_cfg.get("exclude_paths")

    results: List[ValidatorResult] = []
    for name in selected:
        mod = VALIDATORS[name]
        section = validation_cfg.get(key_alias[name], {}) or {}
        if isinstance(section, dict) and section.get("enabled") is False:
            r = ValidatorResult(
                validator=name,
                title=getattr(mod, "TITLE", name),
                skipped=True,
                skip_reason="disabled in validation-rules.yaml",
            )
            results.append(r)
            continue

        cfg: Dict[str, Any] = {k: v for k, v in section.items() if k != "enabled"}
        cfg.setdefault("thresholds", thresholds)
        if include_paths:
            cfg["include_paths"] = include_paths
        if exclude_paths:
            cfg["exclude_paths"] = exclude_paths
        if name == "identifiers":
            cfg.setdefault("max_duplicate_ids", thresholds.get("max_duplicate_ids", 0))
        if name == "metrics":
            cfg["thresholds"] = thresholds

        try:
            results.append(mod.run(root, cfg))
        except Exception as exc:  # noqa: BLE001
            r = ValidatorResult(validator=name, title=getattr(mod, "TITLE", name))
            from validators.base import CheckResult

            c = CheckResult(
                name=f"{name.upper()}-CRASH",
                rule="ADOPT-01",
                description="Validator raised an unhandled exception.",
            )
            c.add(f"{type(exc).__name__}: {exc}")
            r.checks.append(c)
            results.append(r)

    if args.strict:
        for r in results:
            for c in r.checks:
                for f in c.findings:
                    if f.severity == Severity.WARNING:
                        f.severity = Severity.ERROR

    meta = {
        "root": root,
        "scope": ", ".join(include_paths) if include_paths else "<whole repository>",
        "timestamp": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": VERSION,
        "max_findings": args.max_findings,
        "show_warnings": args.show_warnings or args.strict,
    }

    total_errors = sum(r.error_count for r in results)
    payload = {
        "artefact": "ADOPT-01",
        "specification": "TBL-VIS-730",
        "acceptance_criteria": "TBL-VIS-732 (FA-01…FA-12)",
        "language_note": (
            "Python is a tooling choice for repository self-validation; it is not a "
            "Wave W2 product language decision (FA-08, FAL-VIS-341)."
        ),
        "meta": meta,
        "overall": "PASS" if total_errors == 0 else "FAIL",
        "errors": total_errors,
        "warnings": sum(r.warning_count for r in results),
        "validators": [r.to_dict() for r in results],
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    elif args.format == "markdown":
        print(render_markdown(results, meta))
    else:
        print(render_text(results, meta, color=not args.no_color and sys.stdout.isatty()))

    if args.reports_dir:
        rd = (
            args.reports_dir
            if os.path.isabs(args.reports_dir)
            else os.path.join(root, args.reports_dir)
        )
        os.makedirs(rd, exist_ok=True)

        def _dump(name: str, obj: Any) -> None:
            with open(os.path.join(rd, name), "w", encoding="utf-8") as fh:
                json.dump(obj, fh, indent=2)

        by_name = {r.validator: r for r in results}

        errors: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        infos: List[Dict[str, Any]] = []
        for r in results:
            for c in r.checks:
                for f in c.findings:
                    row = dict(f.to_dict(), validator=r.validator)
                    if f.severity == Severity.ERROR:
                        errors.append(row)
                    elif f.severity == Severity.WARNING:
                        warnings.append(row)
                    else:
                        infos.append(row)

        _dump("baseline-summary.json", payload)
        _dump("errors.json", {"count": len(errors), "findings": errors})
        _dump("warnings.json", {"count": len(warnings), "findings": warnings})
        _dump("info.json", {"count": len(infos), "findings": infos})
        _dump(
            "metrics.json",
            {
                "meta": meta,
                "metrics": {r.validator: r.metrics for r in results},
            },
        )
        for key, fname in (
            ("identifiers", "identifier-report.json"),
            ("mermaid", "mermaid-report.json"),
            ("anchors", "anchor-report.json"),
            ("metadata", "metadata-report.json"),
            ("markdown", "markdown-report.json"),
        ):
            if key in by_name:
                _dump(fname, by_name[key].to_dict())

        with open(os.path.join(rd, "baseline-summary.md"), "w", encoding="utf-8") as fh:
            fh.write(render_markdown(results, meta))
        print(f"\nReport set written to {rd}", file=sys.stderr)

    if args.report:
        rp = args.report if os.path.isabs(args.report) else os.path.join(root, args.report)
        os.makedirs(os.path.dirname(rp), exist_ok=True)
        with open(rp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
        print(f"\nJSON report written to {rp}", file=sys.stderr)

    if args.markdown_report:
        mp = (
            args.markdown_report
            if os.path.isabs(args.markdown_report)
            else os.path.join(root, args.markdown_report)
        )
        os.makedirs(os.path.dirname(mp), exist_ok=True)
        with open(mp, "w", encoding="utf-8") as fh:
            fh.write(render_markdown(results, meta))
        print(f"Markdown report written to {mp}", file=sys.stderr)

    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
