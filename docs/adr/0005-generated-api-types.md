# 5. Both clients' API types are generated from the backend's schema

- Status: Accepted
- Date: 2026-11-11

## Context

Since [ADR-0004](./0004-android-app-as-second-client.md) the backend has two clients, and each
kept its own hand-written copy of every response shape: `frontend/lib/types/finance.ts` and
`mobile/src/lib/finance/types.ts` declared `Category`, `Expense`, `Budget` and the rest field by
field, and a comment in each asked whoever changed one to change the other. The pull request
template asked the same of anyone changing the backend. Nothing checked any of it.

On the day of this decision the copies agreed with the backend in every field: the discipline
had held for one domain. Four more domains are planned, each built on backend, web and Android
together, by two authors. A wrong copy does not fail anything: TypeScript trusts the declared
type, so a renamed field is `undefined` at run time on one client while every check is green.

FastAPI already describes the API exactly, as an OpenAPI document built from the same Pydantic
models that validate requests and serialise responses.

## Decision

The backend's OpenAPI schema is committed at `docs/api/openapi.json`, written by
`tools/api/dump_openapi.py`. `tools/api/gen-types.mjs` turns its schemas into one TypeScript
module, written identically to `frontend/lib/types/api.gen.ts` and
`mobile/src/lib/types/api.gen.ts`. The clients' own type files keep their names and their
documentation but alias the generated types instead of declaring fields.

CI enforces both steps: `backend-ci` fails when the committed schema differs from what the code
produces, and `frontend-ci` and `mobile-ci` fail when a generated file differs from what the
schema produces. Each client's existing `tsc` step is then a check against the real API.

The generator is about 240 lines of our own, with no dependencies, rather than
`openapi-typescript`:

- `openapi-typescript` 7 needs TypeScript 5's compiler API as a peer; both apps run TypeScript 7.
- It would be a development dependency in two lockfiles, for a job this small.
- FastAPI and Pydantic emit a narrow, regular subset of JSON Schema (objects, references,
  `anyOf` with `null`, enums, arrays, primitives). The generator handles that subset and stops
  with the schema's name on anything else, so it cannot silently type a field as `unknown`.

## Consequences

- A field the backend adds, renames or retypes fails the type check of both clients in the PR
  that changes it. Checked by renaming one field and retyping one amount in the schema: 40
  errors on the web, 26 on Android.
- A backend change that touches a shape now has two more commands to run, and its PR carries
  the regenerated schema and both generated files. The schema diff is readable in review.
- A new domain's client types are aliases, not a second and third hand-written copy.
- The schema is written by FastAPI and Pydantic, so a release of either can change the file
  without any change of ours, and `backend-ci` will then fail on that dependency PR until the
  schema is regenerated on its branch. FastAPI 0.143 and 0.162 produce the same file today.
- Money stays a `string` in every response type, as the backend serialises it. Request types
  say `number | string` for amounts, because Pydantic accepts both; the clients send strings.
- Not covered: request bodies are still assembled from form values without being typed against
  the `Create`/`Update` schemas, error codes are not part of the schema, and the rules both
  clients implement (`money`, `dates`, `transaction-query`…) are still written twice.
- If the schema ever outgrows the generator's subset, or `openapi-typescript` supports the
  TypeScript in use, swapping generators changes `tools/api/gen-types.mjs` and nothing else:
  the aliases depend only on the exported type names.
