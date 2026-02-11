#!/bin/bash
# API Test App - minimal server for testing /api/me, /api/users, /api/audit in Domino
# No frontend build required. GET /api/test to run all API tests (returns JSON).
set -e
cd "$(dirname "$0")"

echo "Starting API Test App on 0.0.0.0:8888..."
echo "GET /api/test to run all API tests (returns JSON, no UI)."
uvicorn app:app --host 0.0.0.0 --port 8888
