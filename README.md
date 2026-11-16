# Repwise

A mobile app that drafts a workout plan from your goals, schedule and the equipment you actually have (nothing, a treadmill, a home gym or a full gym), then tracks your workouts. Use it as a guest with data on your phone, or sign in with Google to sync across devices. AI generation uses your own OpenAI, Google or Anthropic API key; without one, Repwise works as a manual tracker.

> Status: Phase 2 (offline tracker). Onboarding, equipment catalogue, manual plans and workout logging work fully offline. AI generation arrives in Phase 3.

## Layout

```text
apps/mobile/            React Native + Expo app (TypeScript, Expo Router)
services/core-api/      FastAPI: Google sign-in and sync (PostgreSQL)
services/ai-service/    FastAPI + LangGraph: stateless plan generation
packages/contracts/     Shared plan JSON schema and examples
infra/                  docker compose for local runs; Azure IaC
docs/adr/               Architecture decision records
.github/workflows/      CI, one workflow per component
```

## Prerequisites

- Node.js 22 and npm
- Python 3.12 and [uv](https://docs.astral.sh/uv/)
- Docker (for the full local backend)
- Android Studio emulator or the Expo Go app on an Android phone

## Run it

```bash
# Backend (both services + Postgres)
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up --build

# Or one service without Docker
cd services/core-api && uv sync && uv run uvicorn app.main:app --reload --port 8001

# App
cd apps/mobile && npm install && npm start
```

## Checks

Every component runs the same checks locally as in CI:

| Component | Command |
| --- | --- |
| `apps/mobile` | `npm run check` |
| `services/*` | `uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest` |
| `packages/contracts` | see its README |

Install the Git hooks once with `uvx pre-commit install`.

## Roadmap

| Phase | Delivers |
| --- | --- |
| 1. Foundations | Repo, CI, plan schema, decision records |
| 2. Offline tracker | Onboarding, equipment catalogue, manual plans, workout logging |
| 3. AI generation | LangGraph workflow, three providers, regenerate with muscle focus |
| 4. Accounts and sync | Google sign-in, core API, cross-device sync |
| 5. Deploy and polish | Azure hosting, README demo |

v2: paid subscription with Repwise-provided AI, iPhone builds, Sign in with Apple, cardio and progression.
