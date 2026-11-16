# azure

Repwise's backend on Azure, as Bicep templates and two scripts. See `docs/adr/0007-azure-container-apps.md`.

| File | What it does |
| --- | --- |
| `base.bicep` | Log Analytics, Container Registry, a pull identity, the Container Apps environment, PostgreSQL Flexible Server (Burstable B1ms) with a `repwise` database |
| `apps.bicep` | `repwise-core-api` and `repwise-ai-service` container apps, HTTPS, scale to zero, health probes |
| `deploy.sh` | Creates or updates everything, builds the images in Azure, deploys, checks health, writes the URLs into `apps/mobile/eas.json` |
| `setup-github-deploy.sh` | One time: lets GitHub Actions deploy on merges to `main` without stored passwords (OpenID Connect) |
| `destroy.sh` | Deletes the whole resource group, after asking |

## First deployment

```bash
az login
REPWISE_GOOGLE_CLIENT_IDS=<your Google web client ID> ./infra/azure/deploy.sh
```

Takes about 15 minutes the first time, mostly PostgreSQL. Defaults: resource group `repwise-rg`, region `centralindia`; override with `REPWISE_RG` and `REPWISE_LOCATION`. Subscriptions that restrict regions (such as Azure for Students) are checked first, and the script lists the regions you may use. Generated passwords are kept in `infra/azure/.deploy.env` (git-ignored); keep that file, later runs reuse it.

Images are built by Azure Container Registry Tasks, so Docker is not needed. Some free-trial subscriptions block those builds; the script then falls back to a local Docker build.

Then build the installable app against the deployed services:

```bash
cd apps/mobile
eas build --profile preview --platform android
```

## Automatic deploys

Run `./infra/azure/setup-github-deploy.sh` once (needs `gh auth login`, or it prints the values to add by hand). From then on, `.github/workflows/deploy.yml` builds and rolls out both services whenever a merge to `main` touches `services/`. It can also be started from the Actions tab.

## Cost

Rough, pay-as-you-go: PostgreSQL B1ms is about US$12 to 19 a month depending on region, plus storage; the Basic registry is about US$0.17 a day; the container apps scale to zero and normally stay within Azure's monthly free grant at this traffic. Check the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) for your subscription.

To pause the biggest cost: `az postgres flexible-server stop -g repwise-rg -n <server name>` (Azure restarts it automatically after 7 days). To stop all charges: `./infra/azure/destroy.sh`.

## Not done yet (fine for a portfolio, worth doing before real users)

- PostgreSQL is reachable from Azure services over the public endpoint with TLS; private networking (VNet integration) would remove that.
- Secrets live as Container App secrets; Key Vault references would centralise and rotate them.
- `core-api` runs one replica because migrations run at start-up and the rate limit is in memory.
