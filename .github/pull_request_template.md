## Summary

<!-- What changed and why. One or two sentences is fine. -->

## Type of change

<!-- Delete the ones that don't apply. -->

- feat — new user-facing capability
- fix — bug fix
- refactor — no behaviour change
- test / docs / chore / ci

## Release scope

<!--
Which release does this belong to? See DeveloperGuide.md section 14.
The plan has no dates — only an order. Scope creep across releases is the
biggest risk to this project shipping, so if this is scoped for a later
release, say why it's landing now.
-->

- [ ] v0.1 — Auth, Finance core, app shell, theming, CI/CD
- [ ] v0.2 — Subscriptions + reminders, notifications/scheduler, budget alerts, Health & Fitness, focus timer
- [ ] v0.3 — Google Calendar sync + events, sleep/mood/habits, correlation engine, weekly digest, onboarding
- [ ] v0.4 — Polish, performance, observability, launch
- [ ] Last — Gaming Performance
- [ ] Out of band (infra/docs/deps — no release scope)

## Testing

<!-- What did you run, and what did you check by hand? -->

## Screenshots

<!-- Frontend changes only. Delete this section otherwise. Vercel also posts a preview link. -->

## Checklist

- [ ] Backend follows model → schema → service → route → test order
- [ ] No business logic in a route handler (budget math, correlation thresholds, PR detection live in `services/`)
- [ ] Separate `Create` / `Update` / `Read` Pydantic schemas for any new domain
- [ ] Every new service function and endpoint has at least one test
- [ ] Errors use the standard shape `{"error": {"code": "...", "message": "..."}}`
- [ ] Frontend API calls go through `lib/api-client.ts`, not raw `fetch()`
- [ ] No `any` in TypeScript without an inline comment explaining why
- [ ] No API response shape changed without updating frontend types and checking usages
- [ ] Any new major dependency is noted in `README.md`'s tech stack table
- [ ] No secrets, `.env` files, or hardcoded keys

<details>
<summary><strong>Database migration</strong> — expand if this PR touches <code>backend/app/models/</code></summary>

> Render redeploys the backend the moment this merges, but migrations **do not run
> themselves**. Merging code that needs a column before that column exists breaks
> production. See `CONTRIBUTING.md` § Database migrations.

- [ ] Migration generated with `alembic revision --autogenerate -m "..."`
- [ ] Migration **hand-reviewed** — autogenerate misses type changes, server defaults, and index/constraint renames
- [ ] `alembic downgrade` tested locally, not just `upgrade`
- [ ] Change is additive and backward-compatible with the code currently deployed
- [ ] Destructive changes (drop/rename) split expand → contract across two PRs
- [ ] **Applied to production before merging this PR** (`alembic upgrade head`)

</details>
