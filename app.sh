#!/bin/bash
# Traceability Explorer - start FastAPI server on 0.0.0.0:8888 for Domino deployment
set -e
cd "$(dirname "$0")"
uvicorn app:app --host 0.0.0.0 --port 8888
