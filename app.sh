#!/bin/bash
# Traceability Explorer - start Node server on 0.0.0.0:8888 for Domino deployment
set -e
cd "$(dirname "$0")"
node server/index.js
