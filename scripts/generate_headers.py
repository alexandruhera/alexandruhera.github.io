"""Finalize the _headers file: replace __INLINE_HASHES__ with sha256 CSP hashes
of every inline <script> body found in the built HTML.

This keeps script-src free of 'unsafe-inline' and survives Zensical upgrades:
whatever inline scripts the theme emits are measured from the real output.
"""

from __future__ import annotations

import base64
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"
TEMPLATE = ROOT / "static" / "_headers"

INLINE_SCRIPT_RE = re.compile(
    r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE
)


def collect_hashes() -> list[str]:
    hashes: set[str] = set()
    for html_path in SITE_DIR.rglob("*.html"):
        for body in INLINE_SCRIPT_RE.findall(html_path.read_text(encoding="utf-8")):
            if not body.strip():
                continue
            digest = hashlib.sha256(body.encode("utf-8")).digest()
            hashes.add(f"'sha256-{base64.b64encode(digest).decode()}'")
    return sorted(hashes)


def main() -> None:
    if not SITE_DIR.is_dir():
        sys.exit("error: site/ not found — run zensical build first")
    hashes = collect_hashes()
    template = TEMPLATE.read_text()
    if "__INLINE_HASHES__" not in template:
        sys.exit("error: static/_headers missing __INLINE_HASHES__ placeholder")
    (SITE_DIR / "_headers").write_text(
        template.replace("__INLINE_HASHES__", " ".join(hashes))
    )
    print(f"generate_headers: {len(hashes)} inline script hash(es) → site/_headers")


if __name__ == "__main__":
    main()
