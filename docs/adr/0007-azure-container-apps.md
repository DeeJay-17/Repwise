# 0007. Host on Azure Container Apps

- Status: accepted
- Date: 2026-11-16

## Context

The backend needs a low-cost host for two containers and a PostgreSQL database while it is a portfolio project.

## Decision

Deploy both services as containers on Azure Container Apps with scale to zero, and use Azure Database for PostgreSQL Flexible Server. Infrastructure is written as Bicep in `infra/azure`.

## Consequences

Near-zero cost when idle, at the price of a cold start on the first request. Because everything is a standard container, moving to another cloud changes only `infra/`.
