# tools/

Build tooling that belongs to no single app: each script here writes files into more than one
of `backend/`, `frontend/` and `mobile/`, so that what the three must agree on is produced
once rather than copied by hand. Nothing here ships to users or runs in production.

Every generator has a `--check` mode that exits 1 when its output is out of date. CI runs
those, so a generated file can never be stale on `main`, and a hand edit to one is caught.

| Script | Reads | Writes | Run it when |
|---|---|---|---|
| `api/dump_openapi.py` | the backend's routes and Pydantic schemas | `docs/api/openapi.json` | a request or response shape, a path or an enum changed |
| `api/gen-types.mjs` | `docs/api/openapi.json` | `frontend/lib/types/api.gen.ts`, `mobile/src/lib/types/api.gen.ts` (identical) | right after the line above |
| `design/palette.mjs` | its own `SCHEMES` table | the token section of `frontend/app/globals.css`, `mobile/src/theme/tokens.ts` | a colour, a scheme or a mode changes |
| `design/contrast.mjs` | `frontend/app/globals.css` | nothing: a WCAG AA audit of every text/background pair | after `palette.mjs --write` |

## The API contract

```bash
cd backend
python ../tools/api/dump_openapi.py     # needs requirements.txt installed; starts nothing
cd ..
node tools/api/gen-types.mjs
```

FastAPI builds its OpenAPI schema from the code, so the schema cannot disagree with the
backend. Committing it and generating both clients' types from it carries that guarantee to
the clients: `frontend/lib/types/*.ts` and `mobile/src/lib/finance/types.ts` only *name* the
generated types (`export type Category = Api.CategoryRead`) and document what the fields mean.
A field the backend adds, renames or retypes then fails `tsc` in both clients, in the same PR.
See [ADR-0005](../docs/adr/0005-generated-api-types.md) for why the generator is our own.

For a new domain, alias what the screens need from `api.gen.ts` in that domain's types file;
do not write the shape again.

`gen-types.mjs` stops with the schema's name if it meets a JSON Schema construct it does not
handle, rather than typing it as `unknown`. Add the case to `typeOf` when that happens.

## The colours

```bash
node tools/design/palette.mjs --write   # then paste any swatches it lists into frontend/lib/theme.ts
node tools/design/contrast.mjs          # must exit 0
```

One generator is why the two clients cannot drift in colour. Never edit the generated values
in `globals.css` or `tokens.ts`; change `palette.mjs` and regenerate. To add a scheme, add a row
to `SCHEMES` there and to `THEMES` in `frontend/lib/theme.ts` (and its twin in
`mobile/src/theme/themes.ts`).

Three copies are still kept by hand, because nothing generates them: the swatches in
`frontend/lib/theme.ts` (`palette.mjs --check` compares them), `mobile/app.json`'s launcher and
splash colours, and `mobile/plugins/android-theme-colours.json` (a test in `mobile/tests/plugins`
compares it with `tokens.ts`).
