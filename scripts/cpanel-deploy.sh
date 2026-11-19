#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -n "${1:-}" ]; then
  DEPLOYPATH="$1"
elif [ -n "${HOME:-}" ] && [ -d "${HOME}" ]; then
  DEPLOYPATH="${HOME}/public_html"
else
  DEPLOYPATH="/home/pythoxwo/public_html"
fi

cd "$REPO_ROOT"
echo "[cpanel-deploy] Repository root: $REPO_ROOT"
echo "[cpanel-deploy] Target document root: $DEPLOYPATH"

# Use pre-built dist/ directly by default so shared cPanel hosts never hang on npm install / vite build.
# To force a server-side rebuild manually, run with CPANEL_FORCE_BUILD=1.
if [ "${CPANEL_FORCE_BUILD:-0}" = "1" ] || [ ! -f "dist/index.html" ] || [ ! -d "dist/assets" ]; then
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_VER="$(node -v)"
    NODE_MAJOR="$(printf '%s' "$NODE_VER" | sed -E 's/^v([0-9]+).*/\1/')"
    if [ "${NODE_MAJOR:-0}" -ge 20 ]; then
      echo "[cpanel-deploy] Building dist/ with Node.js $NODE_VER..."
      export NODE_ENV=development
      if [ -f "package-lock.json" ]; then
        npm ci --include=dev --no-audit --no-fund || npm install --include=dev --no-audit --no-fund
      else
        npm install --include=dev --no-audit --no-fund
      fi
      export NODE_ENV=production
      npm run build
    fi
  fi
fi

if [ ! -f "dist/index.html" ] || [ ! -d "dist/assets" ]; then
  echo "[cpanel-deploy] ERROR: dist/index.html or dist/assets is missing. Aborting deployment." >&2
  exit 1
fi

mkdir -p "$DEPLOYPATH"

echo "[cpanel-deploy] Safely cleaning old website files in $DEPLOYPATH..."
rm -rf "$DEPLOYPATH/assets"
rm -f "$DEPLOYPATH/index.html" "$DEPLOYPATH/robots.txt" "$DEPLOYPATH/sitemap.xml" "$DEPLOYPATH/.htaccess"

# Remove raw source files if an earlier deploy pushed repo root into public_html
rm -rf "$DEPLOYPATH/src" "$DEPLOYPATH/public" "$DEPLOYPATH/scripts"
rm -f \
  "$DEPLOYPATH/package.json" \
  "$DEPLOYPATH/package-lock.json" \
  "$DEPLOYPATH/bun.lock" \
  "$DEPLOYPATH/vite.config.ts" \
  "$DEPLOYPATH/tsconfig.json" \
  "$DEPLOYPATH/server.ts" \
  "$DEPLOYPATH/metadata.json" \
  "$DEPLOYPATH/.cpanel.yml" \
  "$DEPLOYPATH/.env.example"

echo "[cpanel-deploy] Copying built dist/ files (including .htaccess) to $DEPLOYPATH..."
cp -rf dist/. "$DEPLOYPATH/"

echo "[cpanel-deploy] Deployment complete in <1s: $DEPLOYPATH/index.html"
