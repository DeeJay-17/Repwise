# 0002. One repository for the app, services and infrastructure

- Status: accepted
- Date: 2026-11-16

## Context

The app, two backend services and a shared plan schema change together, often in the same feature.

## Decision

Use one Git repository: `apps/mobile`, `services/core-api`, `services/ai-service`, `packages/contracts`, `infra`. Each component keeps its own tooling and lockfile; there is no monorepo build tool. CI runs a workflow per component, triggered by path filters.

## Consequences

A cross-cutting change is one pull request. Components stay independently buildable and deployable. If shared TypeScript packages appear later, npm workspaces can be added then.
