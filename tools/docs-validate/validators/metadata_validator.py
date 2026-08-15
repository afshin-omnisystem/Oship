"""
Frontmatter metadata validator.

Artefact: ADOPT-01 / TBL-VIS-730 ("frontmatter key count", METADATA_STANDARD.md).

Every constitutional Markdown file must carry a YAML frontmatter block. The
canonical field set is declared in `schemas/metadata-schema.yaml`; the repository's
two historical header dialects — `Document ID:` (METADATA_STANDARD.md, MCX-23-002)
and `File ID:` (the `.ai/` control plane) — are accepted through the schema's alias
table, so this checker validates existence and conformance without rewriting any
frozen document.

Checks
------
META-PRESENT   · VAL-VIS-001 : a frontmatter block exists and is delimited correctly
META-PARSE     · VAL-VIS-001 : the frontmatter parses as YAML mappings
META-REQUIRED  · MCX-23-002  : all required canonical fields are present
META-VALUES    · MCX-23-002  : enumerated fields carry an allowed value
META-DATES     · MCX-23-002  : date fields are ISO-8601 YYYY-MM-DD
META-SEMVER    · MCX-23-002  : VERSION is a semantic version

Honest-failure note (VAL-VIS-1746, worked scenario SC-04)
---------------------------------------------------------
This check is expected to FAIL on the existing corpus. Do not relax the schema or
exclude files to reach green; record obligations instead.

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
)

VALIDATOR_NAME = "metadata"
TITLE = "Frontmatter Metadata Validator"

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.\-]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# --------------------------------------------------------------------------------------
# Frontmatter extraction (no third-party dependency required)
# --------------------------------------------------------------------------------------

def extract_frontmatter(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Return (raw_block, error). raw_block is None when no frontmatter is present.
    """
    lines = text.splitlines()
    if not lines:
        return None, None
    if lines[0].strip() != "---":
        return None, None
    for i in range(1, len(lines)):
        if lines[i].strip() in ("---", "..."):
            return "\n".join(lines[1:i]), None
    return None, "frontmatter opened with '---' but is never closed"


def parse_simple_yaml(block: str) -> Tuple[Dict[str, str], Optional[str]]:
    """
    Parse the flat `Key: value` frontmatter dialect used across Oship.

    PyYAML is used when importable; otherwise this deterministic fallback keeps the
    checker dependency-free in CI (a tooling decision only — see FA-08).
    """
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(block)
        if data is None:
            return {}, None
        if not isinstance(data, dict):
            return {}, "frontmatter is not a YAML mapping"
        return {str(k): ("" if v is None else str(v)) for k, v in data.items()}, None
    except ImportError:
        pass
    except Exception as exc:  # noqa: BLE001
        return {}, f"YAML parse error: {str(exc).splitlines()[0]}"

    out: Dict[str, str] = {}
    current: Optional[str] = None
    for raw in block.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw[:1] in (" ", "\t") and current:
            out[current] = (out[current] + " " + raw.strip()).strip()
            continue
        m = re.match(r"^([A-Za-z0-9_][A-Za-z0-9_ .\-/]*?)\s*:\s*(.*)$", raw)
        if not m:
            return out, f"unparseable frontmatter line: '{raw[:60]}'"
        current = m.group(1).strip()
        out[current] = m.group(2).strip().strip('"').strip("'")
    return out, None


# --------------------------------------------------------------------------------------
# Schema
# --------------------------------------------------------------------------------------

DEFAULT_SCHEMA: Dict[str, Any] = {
    "fields": {
        "ID": {
            "required": True,
            "aliases": ["ID", "Document ID", "File ID", "document_id", "DOC_ID"],
        },
        "TITLE": {"required": True, "aliases": ["TITLE", "Title", "title"]},
        "VERSION": {
            "required": True,
            "aliases": ["VERSION", "Version", "version"],
            "format": "semver",
        },
        "STATUS": {
            "required": True,
            "aliases": ["STATUS", "Status", "status"],
            "allowed": [
                "ACTIVE", "PROPOSED", "DRAFT", "DEPRECATED", "COMPLETE",
                "RELEASED", "FROZEN", "SUPERSEDED", "IN PROGRESS", "PLANNED",
            ],
        },
        "OWNER": {"required": True, "aliases": ["OWNER", "Owner", "owner"]},
        "AUTHORITY": {
            "required": False,
            "aliases": ["AUTHORITY", "Authority", "Knowledge Layer", "authority"],
        },
        "DOMAIN": {
            "required": False,
            "aliases": ["DOMAIN", "Domain", "Knowledge Domain", "domain"],
        },
        "AI_PRIORITY": {
            "required": False,
            "aliases": [
                "AI_PRIORITY", "AI Priority", "AI Importance", "ai_priority",
            ],
            "allowed": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "P0", "P1", "P2", "P3"],
        },
        "CREATED": {
            "required": False,
            "aliases": ["CREATED", "Created", "Created Date"],
            "format": "date",
        },
        "UPDATED": {
            "required": False,
            "aliases": ["UPDATED", "Updated", "Last Updated", "Review Date"],
            "format": "date",
        },
        "DEPENDENCIES": {
            "required": False,
            "aliases": ["DEPENDENCIES", "Dependencies", "dependencies"],
        },
        "RELATED": {
            "required": False,
            "aliases": ["RELATED", "Related", "Related Files", "Required By"],
        },
    },
    "constitutional_paths": ["docs/MASTER_CONTEXT", ".ai", "docs/ADR"],
}


def _load_schema(root: str, config: Dict[str, Any]) -> Dict[str, Any]:
    schema_path = config.get("schema_path", "tools/docs-validate/schemas/metadata-schema.yaml")
    abs_path = schema_path if os.path.isabs(schema_path) else os.path.join(root, schema_path)
    if not os.path.exists(abs_path):
        return DEFAULT_SCHEMA
    try:
        import yaml  # type: ignore

        with open(abs_path, "r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        if isinstance(data, dict) and data.get("fields"):
            return data
    except ImportError:
        pass
    except Exception:  # noqa: BLE001
        pass
    return DEFAULT_SCHEMA


def _is_constitutional(rel: str, prefixes: List[str]) -> bool:
    return any(rel == p or rel.startswith(p.rstrip("/") + "/") for p in prefixes)


def _resolve(front: Dict[str, str], aliases: List[str]) -> Optional[str]:
    lowered = {k.strip().lower(): v for k, v in front.items()}
    for alias in aliases:
        if alias in front and str(front[alias]).strip():
            return str(front[alias]).strip()
        key = alias.strip().lower()
        if key in lowered and str(lowered[key]).strip():
            return str(lowered[key]).strip()
    return None


def run(root: str, config: Optional[Dict[str, Any]] = None) -> ValidatorResult:
    config = config or {}
    schema = _load_schema(root, config)
    fields: Dict[str, Any] = schema.get("fields", DEFAULT_SCHEMA["fields"])
    const_paths: List[str] = config.get(
        "constitutional_paths", schema.get("constitutional_paths", [])
    ) or DEFAULT_SCHEMA["constitutional_paths"]

    files = list(
        iter_markdown_files(
            root,
            includes=config.get("include_paths"),
            excludes=config.get("exclude_paths"),
        )
    )

    required_severity = (
        Severity.ERROR if config.get("fail_on_missing_fields", False) else Severity.WARNING
    )

    present = CheckResult(
        name="META-PRESENT",
        rule="VAL-VIS-001",
        description="Every constitutional Markdown file opens with a delimited YAML "
                    "frontmatter block.",
        severity_on_failure=required_severity,
    )
    parses = CheckResult(
        name="META-PARSE",
        rule="VAL-VIS-001",
        description="The frontmatter block parses as a YAML mapping.",
    )
    required = CheckResult(
        name="META-REQUIRED",
        rule="MCX-23-002",
        description="All required canonical metadata fields are present (aliases honoured).",
        severity_on_failure=required_severity,
    )
    values = CheckResult(
        name="META-VALUES",
        rule="MCX-23-002",
        description="Enumerated metadata fields carry an allowed value.",
        severity_on_failure=Severity.WARNING,
    )
    dates = CheckResult(
        name="META-DATES",
        rule="MCX-23-002",
        description="Date metadata fields use ISO-8601 YYYY-MM-DD.",
        severity_on_failure=Severity.WARNING,
    )
    semver = CheckResult(
        name="META-SEMVER",
        rule="MCX-23-002",
        description="VERSION is a semantic version.",
        severity_on_failure=Severity.WARNING,
    )

    conformant = 0
    with_frontmatter = 0
    constitutional = 0
    missing_by_field: Dict[str, int] = {k: 0 for k in fields}

    for rel in files:
        text = read_text(root, rel)
        is_const = _is_constitutional(rel, const_paths)
        if is_const:
            constitutional += 1
        present.measured += 1

        block, err = extract_frontmatter(text)
        if err:
            present.add(err, file=rel, line=1)
            continue
        if block is None:
            if is_const:
                present.add("no YAML frontmatter block", file=rel, line=1)
            continue

        with_frontmatter += 1
        parses.measured += 1
        front, perr = parse_simple_yaml(block)
        if perr:
            parses.add(perr, file=rel, line=1)
            continue

        file_ok = True
        for canonical, spec in fields.items():
            aliases = spec.get("aliases") or [canonical]
            value = _resolve(front, aliases)
            is_required = bool(spec.get("required")) and is_const
            if is_required:
                required.measured += 1
            if value is None:
                if is_required:
                    missing_by_field[canonical] = missing_by_field.get(canonical, 0) + 1
                    required.add(
                        f"missing required metadata field '{canonical}' "
                        f"(accepted keys: {', '.join(aliases)})",
                        file=rel,
                        line=1,
                    )
                    file_ok = False
                continue

            allowed = spec.get("allowed")
            if allowed:
                values.measured += 1
                normalised = value.strip().upper()
                if not any(normalised.startswith(str(a).upper()) for a in allowed):
                    values.add(
                        f"field '{canonical}' has value '{value[:40]}' "
                        f"outside the allowed set {allowed}",
                        file=rel,
                        line=1,
                    )
                    file_ok = False

            fmt = spec.get("format")
            if fmt == "date":
                dates.measured += 1
                if not DATE_RE.match(value.strip()):
                    dates.add(
                        f"field '{canonical}' value '{value[:40]}' is not ISO-8601 YYYY-MM-DD",
                        file=rel,
                        line=1,
                    )
                    file_ok = False
            elif fmt == "semver":
                semver.measured += 1
                cleaned = value.strip().lstrip("v")
                if not SEMVER_RE.match(cleaned):
                    semver.add(
                        f"field '{canonical}' value '{value[:40]}' is not a semantic version",
                        file=rel,
                        line=1,
                    )
                    file_ok = False

        if is_const and file_ok:
            conformant += 1

    result = ValidatorResult(validator=VALIDATOR_NAME, title=TITLE)
    result.checks.extend([present, parses, required, values, dates, semver])
    result.metrics = {
        "files_scanned": len(files),
        "constitutional_files": constitutional,
        "files_with_frontmatter": with_frontmatter,
        "conformant_constitutional_files": conformant,
        "non_conformant_constitutional_files": max(constitutional - conformant, 0),
        "conformance_pct": round(100.0 * conformant / constitutional, 2) if constitutional else 0.0,
        "missing_required_by_field": {k: v for k, v in missing_by_field.items() if v},
        "constitutional_paths": const_paths,
    }
    return result
