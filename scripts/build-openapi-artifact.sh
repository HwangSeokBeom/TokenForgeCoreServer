#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/openapi
cp Docs/openapi/safe-sync.openapi.yaml artifacts/openapi/safe-sync.openapi.yaml
echo "OpenAPI artifact written to artifacts/openapi/safe-sync.openapi.yaml"
