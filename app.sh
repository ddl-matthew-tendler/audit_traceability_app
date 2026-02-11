#!/bin/bash
# Traceability Explorer - start FastAPI server on 0.0.0.0:8888 for Domino deployment
set -e
cd "$(dirname "$0")"

# Pre-flight: fail fast with clear message if frontend not built
DIST="$PWD/client/dist"
if [ ! -f "$DIST/index.html" ]; then
  echo "ERROR: client/dist/index.html not found. Run: npm run build" >&2
  echo "DOMINO: Frontend not built. Commit client/dist before deploying." >&2
  exit 1
fi
if [ ! -d "$DIST/assets" ]; then
  echo "ERROR: client/dist/assets not found. Run: npm run build" >&2
  exit 1
fi

echo "Starting Traceability Explorer on 0.0.0.0:8888..."
uvicorn app:app --host 0.0.0.0 --port 8888
