# Cost Gate Policy - Runbook

## Overview

This runbook documents the soft-first model policy implementation for managing AI model costs. The system blocks premium models by default, suggests cheaper alternatives, and queues expensive requests for human approval.

## Architecture

### Components

1. **agents-config-safety.json** - Central configuration file defining blocked models, fallback order, and cost thresholds
2. **override-models-until.js** - Script to check and auto-expire model blocks based on date
3. **orchestrator-cost-gate.js** - Express middleware enforcing cost gates and model policies
4. **GitHub Action** - Automated enforcement running on push and nightly cron
5. **VS Code Helpers** - Launch configurations and tasks for local development

## Configuration

### agents-config-safety.json

```json
{
  "modelPolicy": {
    "blockedModels": {
      "gpt-5": {
        "blockedUntil": "2025-11-01T00:00:00Z",
        "reason": "High cost model - requires approval"
      }
    },
    "fallbackOrder": ["gpt-codex", "gpt-4.1", "gpt-5"],
    "defaultModel": "gpt-codex",
    "costThresholds": {
      "warn": 100,
      "block": 500,
      "currency": "USD"
    }
  }
}
```

#### Configuration Fields

- **blockedModels**: Models blocked until a specific date
  - `blockedUntil`: ISO 8601 timestamp when block expires
  - `reason`: Human-readable explanation for the block
- **fallbackOrder**: Preferred model order (first available non-blocked model is suggested)
- **defaultModel**: Fallback if all models in fallbackOrder are blocked
- **costThresholds**: 
  - `warn`: Cost threshold (USD) to trigger warnings
  - `block`: Cost threshold (USD) to block execution
  - `currency`: Currency for thresholds

### Model Pricing Configuration

**⚠️ REQUIRED ACTION**: Update `MODEL_PRICING` in `orchestrator-cost-gate.js`

The `MODEL_PRICING` object contains placeholder values marked with `PRICE_PER_1K`:

```javascript
const MODEL_PRICING = {
  'gpt-5': {
    PRICE_PER_1K_INPUT: 0.10,   // ← UPDATE THIS
    PRICE_PER_1K_OUTPUT: 0.30   // ← UPDATE THIS
  },
  'gpt-4.1': {
    PRICE_PER_1K_INPUT: 0.05,   // ← UPDATE THIS
    PRICE_PER_1K_OUTPUT: 0.15   // ← UPDATE THIS
  },
  'gpt-codex': {
    PRICE_PER_1K_INPUT: 0.02,   // ← UPDATE THIS
    PRICE_PER_1K_OUTPUT: 0.06   // ← UPDATE THIS
  }
};
```

#### How to Update Pricing

1. **Get Current Pricing** from your AI provider:
   - OpenAI: https://openai.com/pricing
   - Azure OpenAI: Check your Azure portal
   - Other providers: Consult their pricing documentation

2. **Update Values**: Replace placeholder prices with actual per-1K-token rates

3. **Add New Models**: Add entries for any models not listed

4. **Test**: Run the cost gate server and verify cost estimates are accurate

## Usage

### Local Development

#### 1. Check Model Policy

```bash
# Check current policy status
node override-models-until.js ./agents-config-safety.json
```

This script:
- Reads the configuration file
- Checks if any blocked models have expired
- Removes expired blocks automatically
- Updates the configuration file if changes were made

#### 2. Start Cost Gate Server

```bash
# Start the server
node orchestrator-cost-gate.js

# Or with custom port and config
PORT=3001 CONFIG_PATH=./custom-config.json node orchestrator-cost-gate.js
```

The server provides three endpoints:

##### GET /health
Health check endpoint
```bash
curl http://localhost:3000/health
```

##### POST /reload-config
Reload configuration without restarting server
```bash
curl -X POST http://localhost:3000/reload-config
```

##### POST /run-agent
Execute agent request with cost gate enforcement
```bash
curl -X POST http://localhost:3000/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "prompt": "Your prompt here",
    "estimatedInputTokens": 1000,
    "estimatedOutputTokens": 500
  }'
```

### Using VS Code

#### Launch Configurations (F5)

1. **Run Override Models Script** - Check and update policy
2. **Start Cost Gate Server** - Launch server in integrated terminal
3. **Debug Cost Gate Server** - Launch with debugging enabled

#### Tasks (Ctrl+Shift+B)

1. **Check Model Policy** - Run override script
2. **Start Cost Gate Server** - Launch server in background
3. **Test with curl** - Various test scenarios
4. **Install Dependencies** - Run npm install

### Using HTTP Files

Open `run-agent.http` in VS Code with REST Client extension:

1. Install REST Client extension
2. Open `run-agent.http`
3. Click "Send Request" above any request

## Testing

### Test Scenarios

#### 1. Blocked Model Request

**Request:**
```json
POST /run-agent
{
  "model": "gpt-5",
  "prompt": "test",
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500
}
```

**Expected Response (403):**
```json
{
  "blocked": true,
  "requestedModel": "gpt-5",
  "reason": "High cost model - requires approval",
  "blockedUntil": "2025-11-01T00:00:00Z",
  "fallbackModel": "gpt-codex",
  "costEstimate": {
    "currency": "USD",
    "amount": "0.2000"
  },
  "message": "Model gpt-5 requires approval...",
  "action": "FALLBACK_SUGGESTED"
}
```

#### 2. Allowed Model Request

**Request:**
```json
POST /run-agent
{
  "model": "gpt-codex",
  "prompt": "test",
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500
}
```

**Expected Response (200):**
```json
{
  "approved": true,
  "model": "gpt-codex",
  "costEstimate": {
    "currency": "USD",
    "amount": "0.0500"
  },
  "message": "Request approved"
}
```

#### 3. Cost Threshold Exceeded

**Request:**
```json
POST /run-agent
{
  "model": "gpt-codex",
  "prompt": "very large task",
  "estimatedInputTokens": 100000,
  "estimatedOutputTokens": 50000
}
```

**Expected Response (402):**
```json
{
  "blocked": true,
  "reason": "Cost threshold exceeded",
  "costEstimate": {
    "currency": "USD",
    "amount": "5.0000",
    "threshold": 500
  },
  "action": "APPROVAL_REQUIRED"
}
```

### Manual Testing Checklist

- [ ] Override script runs successfully
- [ ] Override script detects expired blocks
- [ ] Override script updates config file
- [ ] Cost gate server starts successfully
- [ ] Health endpoint returns OK
- [ ] Blocked models return 403 with fallback
- [ ] Allowed models return 200 with approval
- [ ] Cost thresholds trigger warnings/blocks
- [ ] Missing model parameter returns 400
- [ ] Config reload works without restart

## GitHub Actions Workflow

The workflow (`enforce-model-policy.yml`) automatically:

1. **On Push**: Checks model policy configuration
2. **Nightly Cron (2 AM UTC)**: Runs override script to auto-expire blocks
3. **Scans Repository**: Detects direct premium model references
4. **Auto-Updates**: Commits configuration changes if blocks expired
5. **Creates Issues**: Notifies team if premium models found in code

### Workflow Triggers

- Push to any branch (when config/scripts change)
- Scheduled: Daily at 2 AM UTC
- Manual: workflow_dispatch

### What It Does

1. Checks out repository
2. Runs `override-models-until.js`
3. Scans for hardcoded premium model names
4. Commits config updates if needed
5. Creates GitHub issue if violations found

## Approval Workflow

### When a Premium Model is Needed

1. **Request Approval**:
   - Open an issue: "Request: [Model Name] for [Use Case]"
   - Include: business justification, estimated cost, timeline
   - Tag: @team-lead or @cost-approver

2. **Temporary Override**:
   ```bash
   # Remove model from blockedModels in agents-config-safety.json
   # Or extend blockedUntil date
   git commit -m "approve: gpt-5 for Q4 analysis project"
   ```

3. **After Use**:
   - Re-block the model or set new expiry date
   - Document actual costs in the issue
   - Update pricing if actual costs differ

## Troubleshooting

### Server Won't Start

**Error**: `Cannot find module 'express'`
**Solution**: 
```bash
npm install express
```

### Configuration Not Loading

**Error**: `Configuration file not found`
**Solution**: 
- Check CONFIG_PATH environment variable
- Verify file path is absolute or relative to working directory
- Ensure `agents-config-safety.json` exists

### Blocks Not Expiring

**Issue**: Models still blocked after expiry date
**Solution**:
```bash
# Manually run override script
node override-models-until.js ./agents-config-safety.json

# Or reload config in running server
curl -X POST http://localhost:3000/reload-config
```

### GitHub Action Fails

**Error**: Permission denied when committing
**Solution**:
- Ensure workflow has write permissions
- Check repository settings > Actions > General > Workflow permissions
- Select "Read and write permissions"

## Maintenance

### Regular Tasks

- **Weekly**: Review cost reports and adjust thresholds
- **Monthly**: Update model pricing in `orchestrator-cost-gate.js`
- **Quarterly**: Review and optimize fallback order
- **As Needed**: Add new models to configuration

### Updating Model Blocks

```bash
# Edit agents-config-safety.json
# Change blockedUntil date or add/remove models

# Test locally
node override-models-until.js ./agents-config-safety.json

# Commit and push
git add agents-config-safety.json
git commit -m "update: extend gpt-5 block to 2025-12-01"
git push
```

## Security Considerations

- **Do NOT** commit API keys or secrets
- **Do NOT** expose cost gate server publicly without authentication
- **Do** regularly review access logs
- **Do** monitor for bypass attempts
- **Do** keep pricing information up to date

## Support

### Common Questions

**Q: Can I bypass the cost gate for urgent tasks?**
A: Yes, but requires approval. Contact team lead or temporarily update `agents-config-safety.json` with documented justification.

**Q: What happens if a model isn't in the pricing config?**
A: The cost gate allows it but can't estimate costs. Add pricing for better cost tracking.

**Q: How do I add a new model?**
A: 
1. Add to `MODEL_PRICING` in `orchestrator-cost-gate.js`
2. Optionally add to `fallbackOrder` in config
3. Test with sample requests

**Q: Can I use this with Azure OpenAI or other providers?**
A: Yes, update model names and pricing to match your provider's API.

## References

- [agents-config-safety.json](./agents-config-safety.json) - Configuration file
- [override-models-until.js](./override-models-until.js) - Policy script
- [orchestrator-cost-gate.js](./orchestrator-cost-gate.js) - Cost gate middleware
- [run-agent.http](./run-agent.http) - Test scenarios
- [GitHub Actions Workflow](./.github/workflows/enforce-model-policy.yml) - Automation

---

**Last Updated**: 2025-10-29  
**Version**: 1.0.0  
**Maintainer**: Development Team
