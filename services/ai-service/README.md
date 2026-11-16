# ai-service

Stateless workout plan generation. Takes a profile, an equipment list, optional focus muscles and previous plan, and the user's own provider, model name and API key; returns a plan that matches `packages/contracts/plan.schema.json`. It has no database and never stores or logs API keys.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8002
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
```

## API

`POST /v1/plans/generate` with the key in the `X-LLM-API-Key` header. Full contract: `packages/contracts/openapi/ai-service.json` (regenerate with `uv run python -m scripts.export_openapi` after changing models or routes; a test fails if it is stale).

| Status | `code` | Meaning |
| --- | --- | --- |
| 200 | | `plan` plus `warnings` (for example, the fallback was used) |
| 401 | `provider_auth` | The provider rejected the key |
| 400 | `model_not_found`, `provider_bad_request` | Wrong model name, or the model cannot do structured output |
| 429 | `rate_limited`, `provider_rate_limited` | Too many requests here, or the user's provider quota |
| 502, 504 | `provider_error`, `provider_timeout` | Provider failure |

## How a plan is made

See `docs/adr/0010-plan-generation-workflow.md`. In short: code shortlists exercises, the model drafts, code validates, the model repairs up to twice, and a rule-based plan is the fallback.

| Path | Holds |
| --- | --- |
| `app/graph/` | LangGraph workflow, draft format, validator, fallback |
| `app/providers/` | OpenAI, Google and Anthropic adapters, error mapping |
| `app/prompts/` | Prompt text |
| `app/catalogue/` | Exercise catalogue (generated from the app's catalogue script) |
| `evals/` | 20 test profiles and a live evaluation script |

Settings (environment, prefix `AI_SERVICE_`): `RATE_LIMIT_PER_MINUTE` (10), `MODEL_TIMEOUT_SECONDS` (90), `MAX_REPAIRS` (2), `LOG_LEVEL`.
