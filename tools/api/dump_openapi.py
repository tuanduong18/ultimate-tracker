"""Write the backend's OpenAPI schema to docs/api/openapi.json.

    cd backend
    python ../tools/api/dump_openapi.py            # rewrite the file
    python ../tools/api/dump_openapi.py --check    # exit 1 if the file is out of date (CI)

The schema is the contract both clients are typed against: tools/api/gen-types.mjs
turns it into the TypeScript each of them imports. Committing it means a change
to any request or response shape shows up in review as a diff, and the clients'
type checks run against it without needing Python.

Nothing is started and nothing is contacted: FastAPI builds the schema from the
route and Pydantic declarations when the app module is imported. No server, no
database connection.

Run it with an interpreter that has backend/requirements.txt installed at the
versions CI resolves (`python -m pip install -r requirements.txt`): FastAPI and
Pydantic write the schema, so an older install can write a different file and
CI's --check will say so. It lives outside backend/ because it is build tooling
for the clients, not application code.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
OUTPUT = ROOT / "docs" / "api" / "openapi.json"


def build() -> str:
    # The app reads backend/.env relative to the working directory and imports
    # as the `app` package, so behave as if started from backend/.
    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))
    from app.main import app  # noqa: PLC0415 - after the path is set up

    # Keys stay in the order FastAPI emits them, which is the order fields are
    # declared in: deterministic, and the generated types then read like the models.
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="compare instead of writing")
    args = parser.parse_args()

    schema = build()
    shown = OUTPUT.relative_to(ROOT).as_posix()
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current.replace("\r\n", "\n") != schema:
            print(
                f"{shown} is out of date with the backend's routes and schemas.\n"
                "Run `python ../tools/api/dump_openapi.py` from backend/, then "
                "`node tools/api/gen-types.mjs` from the repo root, and commit the results.",
                file=sys.stderr,
            )
            return 1
        print(f"{shown} is current.")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(schema, encoding="utf-8", newline="\n")
    print(f"Wrote {shown}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
