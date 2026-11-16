#!/usr/bin/env bash
# Deploy Repwise's backend to Azure: shared resources, images, then both container apps.
# Safe to re-run; each run builds new images and rolls the apps forward.
#
#   ./infra/azure/deploy.sh
#
# Settings (environment variables, all optional):
#   REPWISE_RG              resource group            (default: repwise-rg)
#   REPWISE_LOCATION        Azure region              (default: centralindia)
#   REPWISE_PREFIX          name prefix               (default: repwise)
#   REPWISE_PG_LOCATION     region for PostgreSQL     (default: same as REPWISE_LOCATION)
#   REPWISE_PG_SKU          PostgreSQL size           (default: Standard_B1ms)
#   REPWISE_GOOGLE_CLIENT_IDS  Google web client ID(s) for sign-in (comma-separated)
#
# Needs: Azure CLI, logged in (az login). Docker is only needed if your subscription
# does not allow cloud image builds (ACR Tasks).
set -euo pipefail

RG="${REPWISE_RG:-repwise-rg}"
LOCATION="${REPWISE_LOCATION:-centralindia}"
PREFIX="${REPWISE_PREFIX:-repwise}"
PG_LOCATION="${REPWISE_PG_LOCATION:-$LOCATION}"
PG_SKU="${REPWISE_PG_SKU:-Standard_B1ms}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STATE="$HERE/.deploy.env"   # generated secrets; git-ignored, keep it safe
TAG="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

command -v az >/dev/null || { echo "Install the Azure CLI first: https://aka.ms/installazurecli"; exit 1; }
az account show >/dev/null 2>&1 || { echo "Run 'az login' first."; exit 1; }
echo "Subscription: $(az account show --query name -o tsv)"

# Secrets are generated once and reused on later runs.
if [[ -f "$STATE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE"
else
  POSTGRES_PASSWORD="Rw$(openssl rand -hex 16)A1"
  JWT_SECRET="$(openssl rand -hex 32)"
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' "$POSTGRES_PASSWORD" "$JWT_SECRET" > "$STATE"
  echo "Generated secrets in $STATE (git-ignored). Keep this file; re-runs reuse it."
fi
GOOGLE_CLIENT_IDS="${REPWISE_GOOGLE_CLIENT_IDS:-${GOOGLE_CLIENT_IDS:-}}"
if [[ -n "$GOOGLE_CLIENT_IDS" ]] && ! grep -q '^GOOGLE_CLIENT_IDS=' "$STATE"; then
  printf 'GOOGLE_CLIENT_IDS=%s\n' "$GOOGLE_CLIENT_IDS" >> "$STATE"
fi

step "Checking regions: apps in $LOCATION, PostgreSQL in $PG_LOCATION"
# Some subscriptions (e.g. Azure for Students) only allow certain regions.
ALLOWED="$(az policy assignment list \
  --query "[?parameters.listOfAllowedLocations].parameters.listOfAllowedLocations.value[]" -o tsv)"
for region in "$LOCATION" "$PG_LOCATION"; do
  if [[ -n "$ALLOWED" ]] && ! grep -qx "$region" <<<"$ALLOWED"; then
    echo "Your subscription does not allow '$region'. Allowed regions:"
    while read -r r; do echo "  $r"; done <<<"$ALLOWED"
    exit 1
  fi
done
# The PostgreSQL size must be offered to this subscription in its region.
# (Set REPWISE_SKIP_SKU_CHECK=1 to skip this check.)
if [[ -z "${REPWISE_SKIP_SKU_CHECK:-}" ]] \
  && ! az postgres flexible-server list-skus --location "$PG_LOCATION" -o json 2>/dev/null \
    | grep -q "\"$PG_SKU\""; then
  echo "$PG_SKU PostgreSQL is not offered in $PG_LOCATION for this subscription."
  if [[ -n "$ALLOWED" ]]; then
    echo "Regions where it is offered:"
    while read -r r; do
      az postgres flexible-server list-skus --location "$r" -o json 2>/dev/null \
        | grep -q "\"$PG_SKU\"" && echo "  $r"
    done <<<"$ALLOWED"
  fi
  echo "Re-run with REPWISE_PG_LOCATION=<one of those>."
  exit 1
fi
echo "ok"

step "Registering resource providers (first run only takes a minute)"
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry \
          Microsoft.DBforPostgreSQL Microsoft.ManagedIdentity; do
  az provider register --namespace "$ns" --wait >/dev/null
done

step "Resource group $RG"
if [[ "$(az group exists --name "$RG")" == "true" ]]; then
  echo "Using existing $RG (resources go to $LOCATION)"
else
  az group create --name "$RG" --location "$LOCATION" --output none
fi

step "Shared resources (PostgreSQL takes 5 to 10 minutes the first time)"
BASE="$(az deployment group create --resource-group "$RG" --name repwise-base \
  --template-file "$HERE/base.bicep" \
  --parameters prefix="$PREFIX" location="$LOCATION" postgresLocation="$PG_LOCATION" \
    postgresSku="$PG_SKU" postgresPassword="$POSTGRES_PASSWORD" \
  --query properties.outputs --output json)"
out() { python3 -c "import json,sys; print(json.load(sys.stdin)['$1']['value'])" <<<"$BASE"; }
REGISTRY="$(out registryName)"
SERVER="$(out registryServer)"
ENV_ID="$(out environmentId)"
IDENTITY_ID="$(out identityId)"
PG_HOST="$(out postgresHost)"
PG_ADMIN="$(out postgresAdmin)"

step "Building images ($TAG)"
build() {  # name, context
  local image="$SERVER/$1:$TAG"
  if az acr build --registry "$REGISTRY" --image "$1:$TAG" --platform linux/amd64 "$2" --output none; then
    return
  fi
  echo "Cloud build unavailable on this subscription; building locally with Docker."
  command -v docker >/dev/null || { echo "Install Docker Desktop, or use a subscription with ACR Tasks."; exit 1; }
  az acr login --name "$REGISTRY"
  docker buildx build --platform linux/amd64 --tag "$image" --push "$2"
}
build core-api "$ROOT/services/core-api"
build ai-service "$ROOT/services/ai-service"

step "Container apps"
DATABASE_URL="postgresql+psycopg://$PG_ADMIN:$POSTGRES_PASSWORD@$PG_HOST:5432/repwise?sslmode=require"
APPS="$(az deployment group create --resource-group "$RG" --name repwise-apps \
  --template-file "$HERE/apps.bicep" \
  --parameters prefix="$PREFIX" location="$LOCATION" environmentId="$ENV_ID" identityId="$IDENTITY_ID" \
    registryServer="$SERVER" coreApiImage="$SERVER/core-api:$TAG" \
    aiServiceImage="$SERVER/ai-service:$TAG" databaseUrl="$DATABASE_URL" \
    jwtSecret="$JWT_SECRET" googleClientIds="$GOOGLE_CLIENT_IDS" \
  --query properties.outputs --output json)"
CORE_URL="$(python3 -c "import json,sys; print(json.load(sys.stdin)['coreApiUrl']['value'])" <<<"$APPS")"
AI_URL="$(python3 -c "import json,sys; print(json.load(sys.stdin)['aiServiceUrl']['value'])" <<<"$APPS")"

step "Checking health (the first request wakes the apps, about 20 seconds)"
for url in "$CORE_URL" "$AI_URL"; do
  for _ in $(seq 1 12); do
    if curl -fsS --max-time 30 "$url/health" >/dev/null 2>&1; then echo "ok  $url"; break; fi
    sleep 10
  done
done

step "Pointing the app's preview and production builds at these URLs"
python3 - "$ROOT/apps/mobile/eas.json" "$CORE_URL" "$AI_URL" "${GOOGLE_CLIENT_IDS%%,*}" <<'PY'
import json, sys
path, core, ai, google = sys.argv[1:5]
config = json.load(open(path))
for profile in ("preview", "production"):
    env = config["build"].setdefault(profile, {}).setdefault("env", {})
    env["EXPO_PUBLIC_CORE_API_URL"] = core
    env["EXPO_PUBLIC_AI_SERVICE_URL"] = ai
    if google:
        env["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"] = google
json.dump(config, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY

cat <<DONE

Deployed.
  core API:    $CORE_URL
  AI service:  $AI_URL

apps/mobile/eas.json now points preview and production builds at these URLs; commit it.
Build the installable app with:  cd apps/mobile && eas build --profile preview --platform android
DONE
