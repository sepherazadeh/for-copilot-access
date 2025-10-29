# For Copilot Access - Cost Gate System

This repository contains a soft cost-gate policy system for managing LLM model usage and costs.

## System Components (All Checked ✓)

All required subsets/components of the main system have been verified and are present:

### Core Configuration Files
- ✅ `agents-config-safety.json` - Main configuration file defining agents, models, quotas, and budget controls
- ✅ `override-models-until.js` - Script to enforce model policy by replacing blocked premium models with fallbacks
- ✅ `orchestrator-cost-gate.js` - Express service that acts as a cost-gate middleware before LLM provider calls

### CI/CD Automation
- ✅ `.github/workflows/enforce-model-policy.yml` - GitHub Actions workflow that runs nightly and on push to enforce model policy

### Development Tools
- ✅ `.vscode/launch.json` - VS Code launch configurations for debugging
- ✅ `.vscode/tasks.json` - VS Code tasks for running services
- ✅ `run-agent.http` - HTTP requests for testing the cost-gate API
- ✅ `verify-components.sh` - Comprehensive verification script to check all system components

### Documentation
- ✅ `RUNBOOK.md` - Complete guide for setup, testing, and deployment

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify All Components
Run the verification script to check that all required files are present and properly configured:
```bash
./verify-components.sh
```

### 3. Test Override Script
Force fallback models for blocked premium models:
```bash
node override-models-until.js ./agents-config-safety.json
```

### 4. Start Cost Gate Service
```bash
node orchestrator-cost-gate.js
```

### 5. Test the API
Using curl:
```bash
curl -X POST http://localhost:3005/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "frontend-coder",
    "requestedModel": "gpt-codex",
    "prompt": "Test prompt",
    "max_response_tokens": 800,
    "is_premium": false
  }'
```

Or use the VS Code REST Client with `run-agent.http`.

## System Overview

### Budget Control Features
- **Soft Cost Limit ($3)**: Requests below this are automatically allowed
- **Hard Cost Limit ($10)**: Requests above this require manual approval
- **Monthly Token Quotas**: Per-agent token limits to prevent overuse
- **Model Blocking**: Temporarily block expensive models with automatic fallback

### Agent Configuration
The system includes pre-configured agents:
- `frontend-coder` - Frontend development (100K tokens/month)
- `backend-coder` - Backend development (100K tokens/month)
- `test-writer` - Test creation (50K tokens/month)
- `doc-writer` - Documentation (30K tokens/month)

## Verification Script

The `verify-components.sh` script checks:
1. ✅ All core configuration files exist
2. ✅ CI/CD workflow is present
3. ✅ VS Code configuration is correct
4. ✅ Documentation and test files are available
5. ✅ JSON configuration is valid
6. ✅ Dependencies are installed
7. ✅ Functional tests pass

## File Structure
All system files are properly organized:
- Configuration files in repository root
- VS Code settings in `.vscode/` directory
- CI/CD workflows in `.github/workflows/`
- Verification script executable at root level

## Next Steps
Refer to `RUNBOOK.md` for:
- Integration with orchestrator
- Replacing placeholder prices with real provider pricing
- Adding Slack webhooks for approval notifications
- Production deployment considerations
