#!/bin/bash
# API Test App - minimal server for testing /api/me, /api/users, /api/audit in Domino
# No frontend build required. Open /test in your browser to run the tests.
set -e
cd "$(dirname "$0")"

echo "Starting API Test App on 0.0.0.0:8888..."
echo "Open /test in your browser to run the API tests."
uvicorn app:app --host 0.0.0.0 --port 8888
