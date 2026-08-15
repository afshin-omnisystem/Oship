"""
Oship documentation validation package.

Artefact:      ADOPT-01 — Documentation Validation Infrastructure
Specification: TBL-VIS-730 (First Executable Artefact), TBL-VIS-732 (FA-01…FA-12)

LANGUAGE NOTE (FA-08)
---------------------
Python is used here as a TOOLING choice for repository self-validation only.
It is NOT a product implementation-language decision and MUST NEVER be cited as
a de facto Wave W2 language decision. See FAL-VIS-341 and tools/docs-validate/README.md.

Each validator emits, for every check it performs, the `VAL-` / control identifier
it enforces, as required by VAL-VIS-1639.
"""

from .base import (  # noqa: F401
    CheckResult,
    ValidatorResult,
    Severity,
    iter_markdown_files,
    read_text,
)

__all__ = [
    "CheckResult",
    "ValidatorResult",
    "Severity",
    "iter_markdown_files",
    "read_text",
    "markdown_validator",
    "mermaid_validator",
    "id_validator",
    "anchor_validator",
    "metadata_validator",
    "metrics_validator",
]

__version__ = "1.0.0"
