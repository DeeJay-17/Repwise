# 0004. Two small Python services: core-api and ai-service

- Status: accepted
- Date: 2026-11-16

## Context

The backend has two jobs with different needs: account and sync work that is stateful and database-bound, and AI generation that is stateless, slow and calls outside providers.

## Decision

Build two FastAPI services in Python 3.12, managed with uv: `core-api` (sign-in, sync, PostgreSQL) and `ai-service` (plan generation with LangGraph, no database). They talk over HTTPS with JSON. No gateway product, queue or service mesh.

## Consequences

Each service scales and fails on its own; a slow model call never blocks sync. Two deployables instead of one. A finer split was rejected as overhead for a solo project.
