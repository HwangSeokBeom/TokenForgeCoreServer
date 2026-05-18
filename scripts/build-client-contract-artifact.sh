#!/usr/bin/env bash
set -euo pipefail

BUNDLE_PATH="${1:-test/fixtures/client-contract-bundles/unity-safe-sync-contract-v1.bundle.json}"
if [ ! -f "$BUNDLE_PATH" ]; then
  echo "Client contract bundle file was not found." >&2
  exit 1
fi

mkdir -p artifacts/client-contract
cp "$BUNDLE_PATH" artifacts/client-contract/unity-safe-sync-contract-v1.bundle.json
echo "Client contract artifact written to artifacts/client-contract/unity-safe-sync-contract-v1.bundle.json"
