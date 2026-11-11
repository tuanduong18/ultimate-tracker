# Contributing

This is a solo personal project, but it's built with team-ready practices — partly because
it doubles as a portfolio piece, and partly because the discipline is what keeps a
multi-domain app from rotting.

Architecture, schema, and API conventions live in [`DeveloperGuide.md`](./DeveloperGuide.md).
This file covers **how work moves through the repo**.

---

## Local setup

See [`README.md`](./README.md#getting-started) for first-time setup. Once running, install the
git hooks so lint and format failures surface before CI does:

```bash
python -m pip install pre-commit      # into backend/.venv, like every other Python tool
python -m pre_commit install
```

The oxfmt hooks run each app's own copy, from `frontend/node_modules` and
`mobile/node_modules`, so install both first (`npm ci` in each). That way the hook formats with exactly the version in
`package-lock.json`, the same one `npm run format:check` uses in CI.

Hooks run `ruff check`, `ruff format`, `oxfmt`, and a few safety checks (including
`detect-private-key`) on staged files only. To run them across the whole repo:

```bash
python -m pre_commit run --all-files
```

---

## Branching

`main` is always deployable. **No direct commits** — every change goes through a PR, even
solo. This keeps history clean and forces the test suite to actually run before code lands.

Branch names mirror the commit type:

```
feat/finance-budget-alerts
fix/step-log-timezone-bug
chore/update-deps
docs/adr-correlation-engine
```

---

## Commits and PR titles

Both follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <subject>
```

**Types:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `ci` · `perf` · `style`

**Scopes** (optional, but use one when it fits) are the domain names from
[`docs/features/`](./docs/features/), enforced by
[`pr-title.yml`](./.github/workflows/pr-title.yml):
`finance` · `fitness` · `time` · `insights` · `gaming` · `auth` ·
`dashboard` · `api` · `db` · `ci` · `deps` · `deps-dev` (Dependabot's dev-dependency PRs) ·
`mobile` (the Android app's own plumbing — shell, build, release, permissions; a feature in a
domain keeps that domain's scope on either client)

> `steps` and `wellness` were retired when those domains merged into **Fitness**.
> Use `fitness`. CI rejects the old names.

The subject starts lowercase and has no trailing period.

> **PRs are squash-merged, so the PR title becomes the commit message on `main`.**
> That means the *title* is what gets linted — by
> [`.github/workflows/pr-title.yml`](./.github/workflows/pr-title.yml) — not the individual
> commits on your branch. Commit as messily as you like while working; get the title right
> before merging.

---

## Pull requests

1. Branch off `main`, push, open a PR. The template pre-fills a checklist — fill it in rather
   than deleting it.
2. Wait for `backend-ci-ok`, `frontend-ci-ok` and `mobile-ci-ok` to go green. All three are required; `main` is
   protected by a ruleset and won't accept a merge without them.
3. Check the Vercel preview link for anything user-facing.
4. **Squash merge.** The branch auto-deletes.

**Size:** one vertical slice per PR. For a new backend domain that's model → schema → service
→ route → test in a single PR — the full chain, nothing half-wired. Resist bundling two
domains together; if the PR description needs the word "also", it's probably two PRs.

**Two clients:** a user-facing feature ships on the web and the Android app
([ADR-0004](./docs/adr/0004-android-app-as-second-client.md)). Both in one PR when the change is
small; otherwise one PR per client, back to back, with the lagging client's column in
[`docs/features/README.md`](./docs/features/README.md) showing the gap until it lands. Backend
first, as always, so neither client waits on an API that isn't there.

**Scope:** every PR names its target release. If something scoped for v0.3 is landing during
v0.1, say why in the description. Scope creep across releases is the single biggest risk to
this project shipping — which is also why the release plan carries an order but no dates.

### Why CI looks the way it does

No workflow uses a top-level `paths:` filter. A path-filtered workflow that doesn't
trigger reports *no status at all*, which would leave a frontend-only PR waiting forever on a
required `backend-ci` check that never runs. Instead each workflow has a `changes` job that
does the filtering, and a `*-ci-ok` gate job that always runs and reports the result. **Those
gate jobs are the required checks** — don't require `lint-and-test` or `lint-test-build`
directly.

---

## Database migrations

Read this before touching anything in `backend/app/models/`.

**The deploy model matters here.** Render redeploys the backend automatically the moment a PR
merges to `main`, but `alembic upgrade head` is **run by hand**. Nothing auto-migrates. So
merging code that expects a column before that column exists takes production down until you
remember to run the migration.

### The rule

> **Apply additive migrations to production *before* merging the code that uses them.**

For destructive changes (dropping or renaming a column), split it expand → contract:

1. **Expand** — PR 1 adds the new column and ships code that writes to both old and new.
   Migrate prod, merge.
2. **Contract** — PR 2 drops the old column once nothing reads it. Migrate prod, merge.

Never do both in one PR. There is no window where the old code and the new schema coexist
safely otherwise.

### Workflow for a schema change

```bash
cd backend
# 1. edit the model
python -m alembic revision --autogenerate -m "add budget breach threshold"
# 2. READ the generated file — autogenerate misses type changes, server defaults,
#    and index/constraint renames. Fix it by hand.
python -m alembic upgrade head          # apply locally
python -m alembic downgrade -1          # prove the downgrade works
python -m alembic upgrade head
python -m pytest
```

Then apply to production (`alembic upgrade head` against the prod `DATABASE_URL`) and merge.

### A new table needs row-level security

Autogenerate does not add it, so the migration that creates a table also says, by hand:

```python
op.execute("ALTER TABLE <name> ENABLE ROW LEVEL SECURITY")
```

Supabase serves the `public` schema over its Data API to anyone holding the anon key, which ships
in the frontend. RLS with no policy gives the browser's roles no rows at all; the backend connects
as the tables' owner, which RLS does not restrict, so it changes nothing for the app. Add a policy
only when the browser must read a table itself — `notifications`, for Realtime, is the one case.
`tests/integration/test_row_level_security.py` fails for any table left without it.

### What CI checks for you

`backend-ci` runs against a real Postgres service and will fail if:

- `alembic check` finds models that drifted from migrations (you changed a model and forgot to
  generate one)
- there's more than one migration head (usually from merging two branches that each added a
  migration — fix with `alembic merge`)
- `alembic downgrade base` fails, i.e. a migration isn't reversible

---

## Generated files

Three kinds of file are written by scripts in [`tools/`](./tools/README.md), never by hand. CI
regenerates each and fails if the committed copy differs.

| File | Regenerate with | When |
|---|---|---|
| `docs/api/openapi.json` | `cd backend && python ../tools/api/dump_openapi.py` | a request or response shape, a path or an enum changed |
| `frontend/lib/types/api.gen.ts`, `mobile/src/lib/types/api.gen.ts` | `node tools/api/gen-types.mjs` | the line above changed |
| the token section of `frontend/app/globals.css`, `mobile/src/theme/tokens.ts` | `node tools/design/palette.mjs --write` | a colour, scheme or mode changed |

**An API change is three commits' worth of files in one PR:** the backend code, the regenerated
schema, and the regenerated types — after which `tsc` in each client lists every place that
used the old shape. That is the point: both clients alias their API types from `api.gen.ts`
([ADR-0005](./docs/adr/0005-generated-api-types.md)), so they cannot quietly disagree with the
backend. Write a new domain's client types as aliases too, not as a second copy of the shape.

A Dependabot PR that bumps FastAPI or Pydantic can change the schema file on its own. If
`backend-ci` fails there on the schema check, regenerate on that branch and read the diff.

---

## Testing

Every new service function and API endpoint needs at least one test before it's done. This
matters most for the code that looks trivial — budget math, correlation thresholds, PR
detection — because that's exactly what breaks silently.

```bash
cd backend  && python ../tools/api/dump_openapi.py --check && python -m ruff check . && python -m ruff format --check . && python -m mypy app/ && python -m pytest
cd frontend && npm run lint && npm run format:check && npx tsc --noEmit && npm run test -- --run && npm run build
cd mobile   && npm run lint && npm run format:check && npx expo customize tsconfig.json && npx tsc --noEmit && npm test && npx expo-doctor && npm run export:android
node tools/api/gen-types.mjs --check && node tools/design/palette.mjs --check && node tools/design/contrast.mjs --quiet
```

`pytest` needs `TEST_DATABASE_URL` pointing at a throwaway Postgres database whose name contains
`test` — each run drops its schema and rebuilds it from the migrations, then empties every table
before each test. A local Postgres works; you don't need the service running permanently, and
CI provides its own. Unit tests alone run without one: `python -m pytest -m unit`.

Full strategy: [`DeveloperGuide.md` § 10](./DeveloperGuide.md#10-testing-strategy).

---

## Issues

Use the [issue forms](./.github/ISSUE_TEMPLATE) — bug, feature, or chore. Blank issues are
disabled so that every issue carries a domain, and every feature carries a target release.

### Labels

Three families, combined freely. The issue forms apply the type label; add domain and release
by hand. GitHub's default labels (`enhancement`, `dependencies`, …) are left in place —
Dependabot applies some of them.

| Family | Labels |
|---|---|
| **Type** | `bug` · `feature` · `chore` · `docs` |
| **Domain** | `finance` · `fitness` · `time` · `insights` · `gaming` · `platform` |
| **Release** | `v0.1` · `v0.2` · `v0.3` · `v0.4` |

Milestones mirror the release plan in
[`DeveloperGuide.md` § 14](./DeveloperGuide.md#14-release-plan) — `v0.1` (closed: done),
`v0.2`, `v0.3`, `v0.4` and `Last` — so progress toward a release is visible in the tracker
rather than only in a markdown table.

---

## Dependencies

Dependabot opens **grouped monthly PRs** for pip, npm, GitHub Actions, and Docker
([`.github/dependabot.yml`](./.github/dependabot.yml)). Monthly rather than weekly because five
ecosystems on a weekly schedule made dependency bumps about two in five of all commits; the
schedule covers version updates only, and a security fix still opens its own PR the day an
advisory has one. Both npm apps bundle minor and patch
into one PR and put majors in a separate group, so a breaking major can't hold up routine
updates; pip is a single group, since without a lock file Dependabot can't tell a major from a
minor. A major that needs migration work (React, Next, Tailwind, TypeScript, recharts, the
Python base image) arrives as its own PR — do the migration on that branch, or close it and take
the upgrade later as a normal PR. The frontend has no `ignore` list.

`oxlint` and `oxfmt` have a group of their own in both apps. Oxfmt is still `0.x`, where a
minor release can change formatting; in its own PR, the reformat (`npm run format`) rides along
without holding up the other updates.

**The Android app has an ignore list,** and each rule stops a PR that would fail CI; the
comments in `dependabot.yml` give the evidence for each. An Expo SDK fixes the versions of its
native modules and of the tooling it was tested with, and CI's `expo-doctor` step fails when one
drifts — `npx expo install --check` lists what the SDK expects. React, React Native and
`@types/jest` are pinned exactly; Expo's own packages (`expo`, `expo-*`, `jest-expo`), the React
Native libraries on its list, `jest` and `@types/react` allow patches only. Dependabot sends
those patches; moving to a new SDK is its own PR, done by hand:

```bash
cd mobile
npx expo install expo@^<next SDK> --fix   # moves every SDK-managed package together
npx expo-doctor
```

TypeScript is the exception. `mobile/package.json` excludes it from Expo's check
(`expo.install.exclude`), so mobile runs TypeScript 7 like the frontend while SDK 58 expects
`~6.0.3`; `expo install --fix` leaves it alone, and CI's `tsc` step checks it instead. Once an
SDK expects TypeScript 7 or later, drop the exclude.

Security alerts are separate from these PRs (Security → Dependabot). GitHub's preset
auto-triage rule, on by default for public repositories, dismisses low-impact alerts on
development-only dependencies the moment they are raised — so a lint-tooling advisory can sit
under *Closed* without ever having been open.

### Pinning policy

**Every dependency carries an upper bound.**

The frontend has `package-lock.json`, so `npm ci` is reproducible. The backend has **no lock
file** — an unbounded pin in `requirements.txt` means pip installs whatever is newest at build
time, and a release elsewhere can turn CI red on a PR that touched nothing related.

That is not hypothetical: a declared `mypy>=1.10` was silently resolving to **mypy 2.3.0**, and
`pytest>=8.2` to **pytest 9.1.1** — whole major versions arriving with no PR and no signal.

- **Floor** = the version CI is known to pass on
- **Ceiling** = the next major, or the next *minor* for `0.x` packages, where minors are
  allowed to break

Dependabot proposes range widenings as ordinary PRs, so a major shows up as a decision rather
than a surprise. Keep the ruff hook's `rev` in `.pre-commit-config.yaml` equal to the ruff CI
installs (the newest release inside the `requirements.txt` range), or the hook and CI can
disagree about formatting — when a Dependabot PR widens the ruff range, bump the `rev` in it.
Oxfmt needs no such care: each hook uses its app's locked copy.

Adding a new **major** dependency by hand means noting it in `README.md`'s tech stack table.

---

## Architecture decisions

Anything structural gets an ADR in [`docs/adr/`](./docs/adr) using
[`template.md`](./docs/adr/template.md). Number sequentially. An ADR is cheap and the reasoning
behind a decision is the first thing you forget.
