# azure

Infrastructure as code for the hosted backend, written in Phase 5 (Bicep):

- Azure Container Apps environment with `core-api` and `ai-service`, both scaling to zero
- Azure Database for PostgreSQL Flexible Server for `core-api`
- Azure Container Registry for the service images
- Log Analytics workspace for logs

Nothing is deployed in Phases 1 to 4; everything runs locally through `infra/docker-compose.yml`.
