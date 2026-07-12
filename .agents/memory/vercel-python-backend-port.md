---
name: Porting a non-Node backend into the multi-artifact scaffold
description: What to do when an imported app's backend is Python (or another non-Node language) but the workspace's standard backend slot is Node/Express
---

When migrating an imported app whose backend is not Node.js (e.g. Python/FastAPI), don't assume it must be rewritten into the `artifacts/api-server` Express scaffold to fit the platform.

**Why:** The proxy that routes traffic to artifact services only cares about the declared `localPort`/`paths` and the shell command in `artifact.toml` — it is language-agnostic. Rewriting a large existing backend (tens of endpoints, data-science libs like pandas/TextBlob with no direct Node equivalent) into Express is high-effort and high-regression-risk purely to match convention, when the source app already works.

**How to apply:** Repurpose the existing `artifacts/api-server/.replit-artifact/artifact.toml` via `verifyAndReplaceArtifactToml` — keep its declared `localPort`/`paths`, but change `services.development.run` (and `services.production.run.args`) to launch the other-language process directly (use absolute paths to the interpreter and entrypoint, e.g. `/home/runner/workspace/.pythonlibs/bin/python /home/runner/workspace/backend/main.py` — relative paths broke because the workflow's cwd isn't guaranteed to be repo root). Frontend then calls it same-origin through the existing `/api` path, no separate service needed.

Also: any artifact.toml file found anywhere in the repo (including inside a `.migration-backup`-style archival folder) appears to get auto-scanned and registered as a live artifact with its own workflow. If you keep an old copy of a project's source around as a backup, rename its `artifact.toml` files (e.g. to `artifact.toml.bak`) so they aren't picked up and don't create duplicate/colliding preview paths and workflows.
