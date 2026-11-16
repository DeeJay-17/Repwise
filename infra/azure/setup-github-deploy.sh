#!/usr/bin/env bash
# One-time: let GitHub Actions deploy to Azure without stored passwords (OpenID Connect).
# Creates an Entra ID app trusted only for this repo's main branch, gives it rights on the
# Repwise resource group, and saves the IDs as GitHub repository variables.
#
#   ./infra/azure/setup-github-deploy.sh            (after deploy.sh has run once)
#
# Needs: Azure CLI (logged in) and GitHub CLI (gh auth login), or copy the printed values
# into GitHub → Settings → Secrets and variables → Actions → Variables yourself.
set -euo pipefail

RG="${REPWISE_RG:-repwise-rg}"
REPO="${REPWISE_REPO:-DeeJay-17/Repwise}"
NAME="repwise-github-deploy"

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
RG_ID="$(az group show --name "$RG" --query id -o tsv)"
REGISTRY_ID="$(az acr list --resource-group "$RG" --query '[0].id' -o tsv)"

CLIENT_ID="$(az ad app list --display-name "$NAME" --query '[0].appId' -o tsv)"
if [[ -z "$CLIENT_ID" ]]; then
  CLIENT_ID="$(az ad app create --display-name "$NAME" --query appId -o tsv)"
  az ad sp create --id "$CLIENT_ID" --output none
fi

if ! az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='main']" -o tsv | grep -q .; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$REPO:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" --output none
fi

# Rights: manage the Repwise resource group and push images. Nothing else.
az role assignment create --assignee "$CLIENT_ID" --role Contributor --scope "$RG_ID" --output none
az role assignment create --assignee "$CLIENT_ID" --role AcrPush --scope "$REGISTRY_ID" --output none

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh variable set AZURE_CLIENT_ID --repo "$REPO" --body "$CLIENT_ID"
  gh variable set AZURE_TENANT_ID --repo "$REPO" --body "$TENANT_ID"
  gh variable set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID"
  gh variable set AZURE_RESOURCE_GROUP --repo "$REPO" --body "$RG"
  echo "Saved the GitHub variables. Merges to main that touch services/ now deploy."
else
  cat <<VARS
Add these as GitHub repository variables (Settings → Secrets and variables → Actions → Variables):
  AZURE_CLIENT_ID=$CLIENT_ID
  AZURE_TENANT_ID=$TENANT_ID
  AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
  AZURE_RESOURCE_GROUP=$RG
VARS
fi
