# Cost-Gate Policy and Automation Runbook

## Overview

This runbook provides instructions for setting up, testing, and integrating the cost-gate policy system for AI agent orchestration. The system implements soft/hard cost thresholds with fallback to cheaper models and queues expensive runs for human approval.

## Components

### 1. agents-config-safety.json
Configuration file defining:
- Blocked models and their expiration dates
- Fallback model order
- Per-agent monthly quotas
- Global soft/hard thresholds

### 2. override-models-until.js
Node.js script that automatically replaces blocked premium models with the first fallback model.

### 3. orchestrator-cost-gate.js
Express service providing API endpoints for:
- Running agents with cost controls
- Tracking usage statistics
- Managing approval workflows

### 4. GitHub Actions Workflow
Automated enforcement running on push and nightly cron to:
- Execute override script
- Scan for direct premium model mentions
- Validate configuration files

## Local Testing

### Prerequisites
- Node.js 16+ installed
- Basic understanding of REST APIs
- VS Code (optional, for using launch configurations)

### Step 1: Test Override Script

```bash
# Run the override script
node override-models-until.js ./agents-config-safety.json

# Expected output:
# 📋 Reading configuration from: /path/to/agents-config-safety.json
# 💾 Backup created: /path/to/agents-config-safety.json.backup-[timestamp]
# 🔄 First fallback model: gpt-codex
# 🚫 Model "gpt-5" is blocked until 2025-11-01
# 🚫 Model "gpt-4.1" is blocked until 2025-11-01
#   🔧 Agent "code-reviewer": Replacing "gpt-4.1" with "gpt-codex"
#   🔧 Agent "refactoring": Replacing "gpt-4.1" with "gpt-codex"
# ✨ Summary:
#    - Blocked models: gpt-5, gpt-4.1
#    - Replacements made: 2
```

### Step 2: Start the Orchestrator Service

```bash
# Start the service on port 3000
node orchestrator-cost-gate.js 3000

# Expected output:
# 🚀 Cost-gate orchestrator running on http://localhost:3000
# 📁 Config: /path/to/agents-config-safety.json
# 📊 Usage tracking: /path/to/usage.json
# ✅ Approvals: /path/to/approvals.json
# ⚠️  IMPORTANT: Update PRICE_PER_1K and integrate proper tokenizer before production!
```

### Step 3: Test API Endpoints

#### Using REST Client (VS Code Extension)
1. Install the REST Client extension in VS Code
2. Open `run-agent.http`
3. Click "Send Request" on any of the test requests

#### Using curl

```bash
# Test a simple agent run
curl -X POST http://localhost:3000/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-reviewer",
    "model": "gpt-codex",
    "input": "Review this code: function hello() { return '\''world'\''; }",
    "expected_output_tokens": 100
  }'

# Get usage statistics
curl http://localhost:3000/usage

# Get pending approvals
curl http://localhost:3000/approvals/pending

# Check health
curl http://localhost:3000/health
```

### Step 4: Test Approval Workflow

```bash
# Send a request that exceeds the approval threshold
curl -X POST http://localhost:3000/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "refactoring",
    "model": "gpt-4.1",
    "input": "Large refactoring task...",
    "expected_output_tokens": 5000
  }'

# Response will include a request_id
# Use it to approve the request:
curl -X POST http://localhost:3000/approve/req-1234567890-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewer": "your-name"
  }'
```

## VS Code Integration

### Launch Configurations
Press F5 or use the Run and Debug panel to:
- **Launch Cost-Gate Orchestrator**: Start the service
- **Debug Cost-Gate Orchestrator**: Start with debugging enabled
- **Run Override Models Script**: Execute the override script

### Tasks
Use Ctrl+Shift+B (Cmd+Shift+B on Mac) to access tasks:
- **Start Cost-Gate Orchestrator**: Start the service
- **Run Override Models Script**: Execute override script
- **View Usage Stats**: Quick view of current usage
- **View Pending Approvals**: See pending approval requests
- **Test Run Agent (Sample)**: Send a test request

## CI/CD Integration

### GitHub Actions Workflow

The workflow runs on:
- Push to main, develop, or cost-gate/** branches
- Nightly at 2 AM UTC
- Manual trigger via workflow_dispatch

#### What it does:
1. **Override Models Job**: 
   - Runs the override script
   - Commits changes if models are replaced
   - Uses [skip ci] to prevent recursive triggers

2. **Scan Premium Models Job**:
   - Scans repository for direct premium model mentions
   - Validates configuration file structure
   - Provides warnings (doesn't fail build)

### Manual Workflow Trigger

```bash
# Using GitHub CLI
gh workflow run enforce-model-policy.yml

# Or via GitHub web UI:
# Navigate to Actions → Enforce Model Policy → Run workflow
```

## Production Deployment

### ⚠️ CRITICAL: Before Production

1. **Update PRICE_PER_1K in orchestrator-cost-gate.js**
   ```javascript
   const PRICE_PER_1K = {
     'gpt-5': { input: 0.05, output: 0.15 },     // ← Update with real prices
     'gpt-4.1': { input: 0.03, output: 0.06 },   // ← Update with real prices
     'gpt-codex': { input: 0.01, output: 0.02 }, // ← Update with real prices
     // Add more models as needed
   };
   ```

2. **Integrate Proper Tokenizer**
   ```bash
   # Install tokenizer library
   npm install tiktoken
   # or
   npm install gpt-tokenizer
   ```
   
   Update the `estimateTokens()` function in `orchestrator-cost-gate.js`:
   ```javascript
   const tiktoken = require('tiktoken');
   
   function estimateTokens(text, model = 'gpt-4') {
     const encoder = tiktoken.encoding_for_model(model);
     const tokens = encoder.encode(text);
     encoder.free();
     return tokens.length;
   }
   ```

3. **Configure Notification Email**
   Update `notification_email` in `agents-config-safety.json`:
   ```json
   "global_settings": {
     "notification_email": "actual-team@example.com"
   }
   ```

4. **Set up Monitoring**
   - Monitor usage.json for cost trends
   - Set up alerts for threshold breaches
   - Review approvals.json regularly

5. **Database Integration (Optional)**
   Consider replacing JSON files with a database:
   - PostgreSQL for usage tracking
   - Redis for real-time quotas
   - MongoDB for approval workflows

## Troubleshooting

### Issue: Override script not finding config file
```bash
# Check file path
ls -la agents-config-safety.json

# Use absolute path
node override-models-until.js /absolute/path/to/agents-config-safety.json
```

### Issue: Service won't start
```bash
# Check if port is in use
lsof -i :3000

# Use a different port
node orchestrator-cost-gate.js 3001
```

### Issue: API returns 403 (quota exceeded)
```bash
# Check current usage
curl http://localhost:3000/usage

# Options:
# 1. Wait for monthly reset
# 2. Increase quota in agents-config-safety.json
# 3. Request approval for specific run
```

### Issue: GitHub Actions workflow fails
- Check workflow logs in Actions tab
- Ensure Node.js 18 is available
- Verify file permissions
- Check for syntax errors in YAML

## File Structure

```
.
├── agents-config-safety.json          # Configuration file
├── override-models-until.js            # Override script
├── orchestrator-cost-gate.js           # Express service
├── run-agent.http                      # REST Client tests
├── RUNBOOK.md                          # This file
├── usage.json                          # Generated: usage tracking
├── approvals.json                      # Generated: approval queue
├── .github/
│   └── workflows/
│       └── enforce-model-policy.yml   # CI automation
└── .vscode/
    ├── launch.json                     # Debug configurations
    └── tasks.json                      # Task definitions
```

## Next Steps

1. **Review Configuration**
   - [ ] Verify `agents-config-safety.json` matches your needs
   - [ ] Update blocked_models_until dates
   - [ ] Adjust quotas and thresholds

2. **Update Pricing**
   - [ ] Replace PRICE_PER_1K with actual API pricing
   - [ ] Integrate real tokenizer library

3. **Integration**
   - [ ] Connect to existing agent orchestration system
   - [ ] Set up database for production use
   - [ ] Configure monitoring and alerting

4. **Security**
   - [ ] Review access controls for approval endpoints
   - [ ] Set up authentication/authorization
   - [ ] Audit logging for cost-related decisions

5. **Documentation**
   - [ ] Update team wiki with procedures
   - [ ] Document approval workflows
   - [ ] Create dashboards for cost visibility

## Support and Contact

For questions or issues:
- Review this runbook
- Check GitHub Issues
- Contact the platform team

## License and Compliance

Ensure compliance with:
- API provider terms of service
- Usage quotas and rate limits
- Data privacy regulations
- Internal cost policies
