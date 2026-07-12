"""Build orchestrator: blog generation → zensical build → CSP headers → static files.

Usage:
  uv run scripts/build.py            # production build into site/
  uv run scripts/build.py --serve    # drafts included, local preview server
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

import frontmatter

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
POSTS_DIR = ROOT / "docs" / "writing" / "posts"


def run(*cmd: str) -> None:
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        sys.exit(result.returncode)


@contextmanager
def drafts_stashed():
    """Temporarily move draft posts out of docs/ so production builds exclude
    them entirely (page, sitemap, and search index). Restored on exit."""
    with tempfile.TemporaryDirectory(prefix="drafts-") as tmp:
        moved: list[tuple[Path, Path]] = []
        for path in POSTS_DIR.glob("*.md"):
            if frontmatter.load(path).get("draft"):
                target = Path(tmp) / path.name
                shutil.move(path, target)
                moved.append((path, target))
        try:
            yield
        finally:
            for original, target in moved:
                shutil.move(target, original)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--serve", action="store_true", help="include drafts and start zensical serve"
    )
    args = parser.parse_args()

    blog_cmd = [sys.executable, str(SCRIPTS / "generate_blog.py")]
    if args.serve:
        blog_cmd.append("--drafts")
    run(*blog_cmd)

    if args.serve:
        run("zensical", "serve")
        return

    with drafts_stashed():
        run("zensical", "build")
    run(sys.executable, str(SCRIPTS / "generate_headers.py"))
    shutil.copy(ROOT / "static" / "_redirects", ROOT / "site" / "_redirects")
    print("build: site/ ready (with _headers and _redirects)")


if __name__ == "__main__":
    main()
