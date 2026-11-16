# 0006. Users bring their own model API key in v1

- Status: accepted
- Date: 2026-11-16

## Context

The paid subscription is deferred to v2, but AI generation is a core v1 feature for both guests and signed-in users.

## Decision

In v1 every user who wants AI generation enters a provider (OpenAI, Google or Anthropic), model name and API key. The key is stored only in the phone's secure storage and is not synced. The app sends it to ai-service in a request header for each generation; ai-service uses it for that call and never stores or logs it.

## Consequences

No model costs for Repwise in v1. A user must re-enter their key on each device. The key passes through our server, so ai-service must redact it from logs and errors, and its endpoint is rate limited. In v2, subscribers can use a Repwise-provided key instead.
