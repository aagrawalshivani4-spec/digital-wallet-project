#!/bin/bash
# Shell script to execute Newman API Tests for WalletPay
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$(dirname "$PROJECT_DIR")"

echo "=========================================================="
echo " Running WalletPay Automated Postman API Test Suite"
echo "=========================================================="

# Export node path for newman modules
export NODE_PATH="$WORKSPACE_DIR/newman-runner/node_modules:$PROJECT_DIR/node_modules"

python3 "$SCRIPT_DIR/execute_tests.py"
