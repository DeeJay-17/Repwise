# 0010. Plan generation: the model proposes, code checks, a rule-based plan backs it up

- Status: accepted
- Date: 2026-11-16

## Context

Users bring their own model and key (ADR 0006), so quality varies by provider and model. A plan must only use exercises the user can do, fit the session length and cover the body sensibly. The user must always get a usable plan.

## Decision

`ai-service` runs a LangGraph workflow: **shortlist** (code filters the catalogue by equipment and limitations) → **plan** (the model returns a small structured draft using only shortlisted ids) → **validate** (code checks day count, ids, targets, session time, weekly coverage and focus-muscle volume) → **repair** (the model gets the exact errors, at most twice) → **fallback** (a deterministic rule-based plan) → **finalize** (convert to the shared plan contract). Regeneration sends the previous plan and the chosen focus muscles.

One model with a checking loop, not several agents. The planner is injected, so tests run the whole graph with a scripted fake.

## Consequences

Plans are always valid against the contract; weak models degrade to the fallback with a visible warning instead of failing. Validation rules are plain code and easy to tune. Prompt or rule changes should be checked with `evals/run_live.py` against a real model. Provider errors (bad key, unknown model, quota) are returned to the user, not hidden behind the fallback.
