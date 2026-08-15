#!/usr/bin/env python3
"""
Assert that the authoritative Mermaid engine resolved in CI.

Artefact:  ADOPT-01 / ADOPT-OBL-01b
Rule:      VAL-VIS-MERMAID-PARSE
Honest-failure note: VAL-VIS-1746 / SC-04.

WHY THIS EXISTS
---------------
`MMD-ENGINE` already fails closed inside the validator, so this script is not the
only guard. It exists because a CI job that silently ran the structural fallback
would still produce a report, and a reader skimming the summary could mistake
"MMD-PARSE PASS" for "the corpus parses". Failing the job early, with the
resolution diagnostics printed, makes the environment defect unmissable.

Measured motivation: with the fallback active, this corpus reports 0 Mermaid
errors while 5 diagrams are genuinely broken and 612 are never parsed at all.

Usage
-----
  python3 tools/docs-validate/ci/assert-engine.py <validation-report.json>

Exit codes
----------
  0  an authoritative engine (mermaid.parse or mmdc) was active
  1  the structural fallback was active, or the report is unusable
"""

from __future__ import annotations

import json
import sys


def main(argv: list) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0] if argv else 'assert-engine.py'} <report.json>")
        return 1
    path = argv[1]

    try:
        with open(path, "r", encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, ValueError) as exc:
        print(f"::error::cannot read validator report {path}: {exc}")
        return 1

    mermaid = next(
        (v for v in report.get("validators", []) if v.get("validator") == "mermaid"),
        None,
    )
    if mermaid is None:
        print("::error::the report contains no mermaid validator section")
        return 1

    metrics = mermaid.get("metrics", {}) or {}
    engine = metrics.get("engine", "unknown")
    authoritative = bool(metrics.get("authoritative"))
    unsupported = metrics.get("unsupported_by_validator", "unknown")
    total = metrics.get("total_diagrams", "unknown")

    print(f"engine        : {engine}")
    print(f"authoritative : {authoritative}")
    print(f"diagrams      : {total}")
    print(f"unparsed      : {unsupported}")

    if authoritative:
        print(f"OK — {total} diagrams parsed by the reference implementation.")
        return 0

    diagnostics = metrics.get("engine_diagnostics") or {}
    print(
        "::error::the authoritative Mermaid engine did not resolve. "
        f"engine={engine}; {unsupported} of {total} diagrams were NOT parsed. "
        f"reason={diagnostics.get('reason', 'unknown')}; "
        f"detail={diagnostics.get('detail', 'none')}"
    )
    print(
        "::notice::install with "
        "`npm install --no-save mermaid@11 jsdom`, or set "
        "validation.mermaid.require_authoritative to false to accept reduced "
        "coverage deliberately (ADOPT-OBL-01b)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
