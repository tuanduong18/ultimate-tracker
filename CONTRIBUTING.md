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
pip install pre-commit
pre-commit install
```

Hooks run `ruff`, `ruff-format`, `prettier`, and a few safety checks (including
`detect-private-key`) on staged files only. To run them across the whole repo:

```bash
pre-commit run --all-files
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
[`DeveloperGuide.md` § 6](./DeveloperGuide.md#6-features--functional-requirements):
`finance` · `steps` · `fitness` · `time` · `wellness` · `insights` · `gaming` · `auth` ·
`dashboard` · `api` · `db` · `ci` · `deps`

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
2. Wait for `backend-ci-ok` and `frontend-ci-ok` to go green. Both are required; `main` is
   protected by a ruleset and won't accept a merge without them.
3. Check the Vercel preview link for anything user-facing.
4. **Squash merge.** The branch auto-deletes.

**Size:** one vertical slice per PR. For a new backend domain that's model → schema → service
→ route → test in a single PR — the full chain, nothing half-wired. Resist bundling two
domains together; if the PR description needs the word "also", it's probably two PRs.

**Scope:** every PR names its target release. If something scoped for v0.3 is landing during
v0.1, say why in the description. Scope creep across releases is the single biggest risk to
this project shipping.

### Why CI looks the way it does

Neither workflow uses a top-level `paths:` filter. A path-filtered workflow that doesn't
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
alembic revision --autogenerate -m "add budget breach threshold"
# 2. READ the generated file — autogenerate misses type changes, server defaults,
#    and index/constraint renames. Fix it by hand.
alembic upgrade head          # apply locally
alembic downgrade -1          # prove the downgrade works
alembic upgrade head
pytest
```

Then apply to production (`alembic upgrade head` against the prod `DATABASE_URL`) and merge.

### What CI checks for you

`backend-ci` runs against a real Postgres service and will fail if:

- `alembic check` finds models that drifted from migrations (you changed a model and forgot to
  generate one)
- there's more than one migration head (usually from merging two branches that each added a
  migration — fix with `alembic merge`)
- `alembic downgrade base` fails, i.e. a migration isn't reversible

---

## Testing

Every new service function and API endpoint needs at least one test before it's done. This
matters most for the code that looks trivial — budget math, correlation thresholds, PR
detection — because that's exactly what breaks silently.

```bash
cd backend  && ruff check . && ruff format --check . && mypy app/ && pytest
cd frontend && npm run lint && npm run format:check && npx tsc --noEmit && npm run test -- --run && npm run build
```

Full strategy: [`DeveloperGuide.md` § 10](./DeveloperGuide.md#10-testing-strategy).

---

## Issues

Use the [issue forms](./.github/ISSUE_TEMPLATE) — bug, feature, or chore. Blank issues are
disabled so that every issue carries a domain, and every feature carries a target release.

### Labels

Three families, combined freely:

| Family | Labels |
|---|---|
| **Type** | `bug` · `feature` · `chore` · `docs` |
| **Domain** | `finance` · `steps` · `fitness` · `time` · `wellness` · `insights` · `gaming` · `platform` |
| **Release** | `v0.1` · `v0.2` · `v0.3` · `v0.4` |

Milestones mirror the release plan in
[`DeveloperGuide.md` § 14](./DeveloperGuide.md#14-release-plan), so progress toward a release
is visible in the tracker rather than only in a markdown table.

---

## Dependencies

Dependabot opens **one grouped PR per ecosystem per week** — minor and patch bundled — for
pip, npm, GitHub Actions, and Docker. Majors that need a deliberate migration (React, Next,
Tailwind, eslint, recharts, the python base image) are listed under `ignore` in
[`.github/dependabot.yml`](./.github/dependabot.yml) with the reason inline. Taking one of
those is a normal PR with the migration work included, minus its `ignore` entry.

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
than a surprise. Keep the `ruff` pin in sync with the rev in `.pre-commit-config.yaml`, or the
hook and CI can disagree about formatting.

Adding a new **major** dependency by hand means noting it in `README.md`'s tech stack table.

---

## Architecture decisions

Anything structural gets an ADR in [`docs/adr/`](./docs/adr) using
[`template.md`](./docs/adr/template.md). Number sequentially. An ADR is cheap and the reasoning
behind a decision is the first thing you forget.
