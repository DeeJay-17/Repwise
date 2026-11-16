# core-api

Handles Google sign-in and cross-device sync of plans and workout logs. Owns the PostgreSQL database. Built out in Phase 4; Phase 1 ships only `/health`.

```bash
uv sync                                   # create .venv with all dependencies
uv run uvicorn app.main:app --reload --port 8001
uv run pytest                             # tests
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
```

Settings come from environment variables prefixed `CORE_API_` (see `app/config.py` and the root `.env.example`).

| Folder | Holds |
| --- | --- |
| `app/routers/` | HTTP routes, one module per area |
| `app/domain/` | Business rules, free of web and database code |
| `app/db/` | Database models and migrations |
| `tests/` | Pytest tests |
