#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYPATH="${1:-/home/pythoxwo/public_html}"

# Include common cPanel / CloudLinux Node.js binary paths if npm is not in default PATH
for node_bin in \
  /usr/local/bin \
  /opt/cpanel/ea-nodejs22/bin \
  /opt/cpanel/ea-nodejs20/bin \
  /opt/alt/alt-nodejs22/root/usr/bin \
  /opt/alt/alt-nodejs20/root/usr/bin; do
  if [ -d "$node_bin" ] && [[ ":$PATH:" != *":$node_bin:"* ]]; then
    PATH="$node_bin:$PATH"
  fi
done
export PATH

cd "$REPO_ROOT"

if [ "$DEPLOYPATH" = "$REPO_ROOT" ]; then
  echo "[cpanel-deploy] ERROR: Deployment target matches repository root ($REPO_ROOT). Aborting." >&2
  exit 1
fi

if [ ! -f "package-lock.json" ]; then
  echo "[cpanel-deploy] ERROR: package-lock.json not found in $REPO_ROOT. Aborting deployment." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[cpanel-deploy] ERROR: npm command not found in PATH. Ensure Node.js is installed on the server." >&2
  exit 1
fi

echo "[cpanel-deploy] Repository root: $REPO_ROOT"
echo "[cpanel-deploy] Installing dependencies..."
if ! npm ci --include=dev --no-audit --no-fund; then
  echo "[cpanel-deploy] ERROR: npm ci failed. Aborting deployment." >&2
  exit 1
fi

echo "[cpanel-deploy] Building production bundle..."
export NODE_ENV=production
if ! npm run build; then
  echo "[cpanel-deploy] ERROR: Production build failed. Aborting deployment." >&2
  exit 1
fi

if [ ! -f "dist/index.html" ]; then
  echo "[cpanel-deploy] ERROR: Build completed but dist/index.html does not exist. Aborting deployment." >&2
  exit 1
fi

echo "[cpanel-deploy] Build successful."
echo "[cpanel-deploy] Deploying to $DEPLOYPATH..."

mkdir -p "$DEPLOYPATH"

# Safely clean previous deployed website files from public_html (without touching .well-known, cgi-bin, or repo files)
rm -rf "$DEPLOYPATH/assets"
rm -f \
  "$DEPLOYPATH/index.html" \
  "$DEPLOYPATH/robots.txt" \
  "$DEPLOYPATH/sitemap.xml" \
  "$DEPLOYPATH/.htaccess"

# Copy contents of dist/ (including hidden files like .htaccess) into public_html
cp -rf dist/. "$DEPLOYPATH/"

if [ ! -f "$DEPLOYPATH/index.html" ]; then
  echo "[cpanel-deploy] ERROR: Failed to copy dist/index.html to $DEPLOYPATH." >&2
  exit 1
fi

echo "[cpanel-deploy] Deployment complete."
