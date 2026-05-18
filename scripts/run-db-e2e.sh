#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://tokenforge:tokenforge@localhost:55432/tokenforge_test}"
export DATABASE_URL

echo "Checking disposable test database URL safety."
node <<'NODE'
const raw = process.env.DATABASE_URL;
if (!raw) {
  throw new Error('DATABASE_URL is required for DB e2e.');
}
const url = new URL(raw);
const allowedHosts = new Set(['localhost', '127.0.0.1', 'postgres-test']);
const allowedPorts = new Set(['', '5432', '55432']);
const dbName = url.pathname.replace(/^\//, '');
if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
  throw new Error('DB e2e requires a PostgreSQL DATABASE_URL.');
}
if (!allowedHosts.has(url.hostname)) {
  throw new Error('Refusing DB e2e: DATABASE_URL host is not a local test host.');
}
if (!allowedPorts.has(url.port)) {
  throw new Error('Refusing DB e2e: DATABASE_URL port is not an allowed test port.');
}
if (!dbName.includes('test')) {
  throw new Error('Refusing DB e2e: database name must include "test".');
}
if (!url.username.includes('tokenforge')) {
  throw new Error('Refusing DB e2e: database username must be the test user.');
}
NODE

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for DB e2e." >&2
  exit 1
fi

echo "Starting disposable PostgreSQL test database."
docker compose -f docker-compose.test.yml up -d postgres-test
cleanup() {
  docker compose -f docker-compose.test.yml down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for disposable PostgreSQL readiness."
for _ in $(seq 1 60); do
  if docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U tokenforge -d tokenforge_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U tokenforge -d tokenforge_test >/dev/null

echo "Applying Prisma migrations to disposable test database."
npx prisma migrate deploy
echo "Running DB e2e specs."
jest --runInBand --testRegex '.*\.e2e-spec\.ts$'
