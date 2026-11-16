# core-api

Google sign-in, tokens, account deletion and cross-device sync. Owns the PostgreSQL
database (SQLite locally by default). See `docs/adr/0011-sync.md` and
`docs/setup-accounts.md`.

```bash
uv sync
uv run alembic upgrade head                 # create or update the database
uv run uvicorn app.main:app --reload --port 8001
uv run pytest                               # SQLite; set TEST_DATABASE_URL for Postgres
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
```

## API

Full contract: `packages/contracts/openapi/core-api.json` (regenerate with
`uv run python -m scripts.export_openapi`; a test fails if it is stale).

| Method | Path | Does |
| --- | --- | --- |
| POST | `/v1/auth/google` | Google ID token in, access and refresh tokens out; creates the account on first sign-in |
| POST | `/v1/auth/refresh` | Single-use refresh token in, new pair out; reuse revokes every session |
| POST | `/v1/auth/logout` | Revokes a refresh token |
| GET, DELETE | `/v1/me` | The account; delete removes it and all synced data |
| POST | `/v1/sync` | Push changed rows, pull rows changed elsewhere since a cursor |

Errors are `{"code", "message"}`.

## Settings (environment, prefix `CORE_API_`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./core-api.db` | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host/db` |
| `JWT_SECRET` | dev value | 32+ random characters for signing access tokens |
| `GOOGLE_CLIENT_IDS` | none | Comma-separated OAuth client IDs whose ID tokens are accepted |
| `ACCESS_TOKEN_MINUTES` | 60 | Access token lifetime |
| `REFRESH_TOKEN_DAYS` | 60 | Refresh token lifetime |
| `SYNC_PAGE_SIZE` | 500 | Rows returned per sync call |

## Layout

| Path | Holds |
| --- | --- |
| `app/routers/` | HTTP routes: auth, me, sync, health |
| `app/auth/` | Google token verification, access and refresh tokens |
| `app/domain/` | Users and the sync rules |
| `app/db/` | Tables (`schema.py`) and Alembic migrations |
| `tests/` | API tests, run against migrated SQLite or Postgres |
