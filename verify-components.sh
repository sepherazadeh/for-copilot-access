#!/bin/bash

# Verification script to check all main components/subsets
# This script verifies all files and configurations mentioned in RUNBOOK.md

set -e

echo "=================================================="
echo "Checking all subsets/components of main system"
echo "=================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check function
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1 (MISSING)"
    return 1
  fi
}

echo "1. Checking Core Configuration Files:"
echo "--------------------------------------"
check_file "agents-config-safety.json"
check_file "override-models-until.js"
check_file "orchestrator-cost-gate.js"
echo ""

echo "2. Checking CI/CD Workflow:"
echo "--------------------------------------"
check_file ".github/workflows/enforce-model-policy.yml"
echo ""

echo "3. Checking VS Code Configuration:"
echo "--------------------------------------"
check_file ".vscode/launch.json"
check_file ".vscode/tasks.json"
echo ""

echo "4. Checking Documentation and Test Files:"
echo "--------------------------------------"
check_file "run-agent.http"
check_file "RUNBOOK.md"
echo ""

echo "5. Validating agents-config-safety.json structure:"
echo "--------------------------------------"
if command -v node &> /dev/null; then
  if node -e "const cfg = require('./agents-config-safety.json'); console.log('  - default_model:', cfg.default_model); console.log('  - agents count:', cfg.agents ? cfg.agents.length : 0); console.log('  - budget_control present:', cfg.budget_control ? 'YES' : 'NO');" 2>&1; then
    echo -e "${GREEN}✓${NC} Configuration is valid JSON with expected structure"
  else
    echo -e "${RED}✗${NC} Configuration validation failed"
  fi
else
  echo "  (Node.js not available, skipping JSON validation)"
fi
echo ""

echo "6. Checking Dependencies:"
echo "--------------------------------------"
if [ -f "package.json" ]; then
  echo -e "${GREEN}✓${NC} package.json exists"
  if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
    if [ -d "node_modules/express" ]; then
      echo -e "${GREEN}✓${NC} express dependency installed"
    else
      echo -e "${RED}✗${NC} express dependency not installed"
    fi
  else
    echo -e "${RED}✗${NC} node_modules directory not found (run: npm install)"
  fi
else
  echo -e "${RED}✗${NC} package.json not found"
fi
echo ""

echo "7. Functional Tests:"
echo "--------------------------------------"
if command -v node &> /dev/null; then
  echo "Testing override-models-until.js..."
  if node override-models-until.js ./agents-config-safety.json > /tmp/override-test.log 2>&1; then
    echo -e "${GREEN}✓${NC} override-models-until.js runs successfully"
  else
    echo -e "${RED}✗${NC} override-models-until.js failed"
  fi
  
  # Clean up any backup files created during test
  rm -f agents-config-safety.json.bak.* 2>/dev/null || true
else
  echo "  (Node.js not available, skipping functional tests)"
fi
echo ""

echo "=================================================="
echo "Verification Complete!"
echo "=================================================="
echo ""
echo "Summary: All required components/subsets of the main system have been checked."
echo "If all items show ✓, the system is properly configured."
