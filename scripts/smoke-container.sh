#!/usr/bin/env bash
set -euo pipefail
image="${1:-lostnetweb:ci}"
# The test container is disposable and never connects to the production API.
container="$(docker run --detach --publish 127.0.0.1::80 "$image")"
trap 'docker rm --force "$container" >/dev/null' EXIT
port="$(docker port "$container" 80/tcp | sed 's/.*://')"
base="http://127.0.0.1:$port"
mkdir -p .ci-local
proof_dir="$(mktemp -d .ci-local/container-smoke.XXXXXX)"
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 "$base/" --output "$proof_dir/login.html"
grep -q 'handleCredentialResponse' "$proof_dir/login.html"
for route in /dashboard /dashboard/; do
  curl --fail --silent --show-error --location "$base$route" --output "$proof_dir/dashboard.html"
  grep -q 'id="reports-list"' "$proof_dir/dashboard.html"
done
curl --fail --silent --show-error "$base/favicon.jpg" --output /dev/null
status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/nonexistent-route")"
test "$status" = '404'
docker exec "$container" nginx -t
echo 'Container smoke checks passed: login, dashboard with/without slash, photo asset, 404 and nginx config.'
