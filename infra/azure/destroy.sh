#!/usr/bin/env bash
# Delete every Repwise resource in Azure (and stop all charges). Asks before deleting.
set -euo pipefail
RG="${REPWISE_RG:-repwise-rg}"
read -r -p "Delete resource group '$RG' and everything in it? Type its name to confirm: " answer
[[ "$answer" == "$RG" ]] || { echo "Cancelled."; exit 1; }
az group delete --name "$RG" --yes --no-wait
echo "Deletion started. It finishes in the background in a few minutes."
