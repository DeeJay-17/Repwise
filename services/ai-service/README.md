# ai-service

Stateless workout plan generation. Takes a profile, an equipment list and the user's own provider, model name and API key; returns a plan that matches `packages/contracts/plan.schema.json`. It has no database and never stores or logs API keys. Built out in Phase 3; Phase 1 ships only `/health`.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8002
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
```

Settings come from environment variables prefixed `AI_SERVICE_`.

| Folder | Holds |
| --- | --- |
| `app/graph/` | The LangGraph workflow |
| `app/providers/` | One adapter per model provider |
| `app/prompts/` | Prompt templates |
| `evals/` | Test profiles and quality checks |
| `tests/` | Pytest tests |
