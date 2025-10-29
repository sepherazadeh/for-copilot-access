```markdown
# RUNBOOK — Cost Gate (Soft Policy)

Goal
- Prevent surprise premium-model usage by applying a "soft" policy:
  - default: use cheaper fallback (gpt-codex) for deterministic code.
  - allow manual override/approval for premium runs.
  - nightly enforcement to replace any accidental re-enable.

Files added
- agents-config-safety.json
- override-models-until.js
- orchestrator-cost-gate.js
- .github/workflows/enforce-model-policy.yml
- .vscode helpers
- run-agent.http

Quick local test (VS Code)
1) Install deps:
   npm init -y
   npm install express

2) Run override once (force fallback immediately):
   node override-models-until.js ./agents-config-safety.json

3) Start the cost gate:
   node orchestrator-cost-gate.js
   (or use VS Code launch "Run Cost Gate")

4) Test with run-agent.http (REST Client) or curl:
   curl -s -X POST http://localhost:3005/run-agent -H "Content-Type: application/json" -d '{"agentId":"frontend-coder","requestedModel":"gpt-5","prompt":"Test","max_response_tokens":800,"is_premium":true}' | jq

Integration pattern (orchestrator)
- Before calling LLM provider, POST to /run-agent with request body.
- If response.status === 'allowed' → call provider with provided model.
- If response.status === 'fallback' → call provider with response.to model.
- If queued_for_approval → show human UI/Slack and wait.

CI automation
- The provided GitHub Action runs the override script on push and nightly cron to enforce the policy.
- Action currently does not commit back automatically (to avoid surprise commits); maintainers can opt to commit changes in a follow-up.

Important next steps (must do before relying on this in prod)
- Replace PRICE_PER_1K mapping in orchestrator-cost-gate.js with real provider prices.
- Integrate a proper tokenizer (tiktoken) to estimate tokens accurately.
- Add Slack webhook or proper approval endpoint to approve queued requests.
- Consider adding an emergency env var (DISABLE_PREMIUM=true) that hard-blocks premium calls if needed.
- Rotate provider API key if there was unexpected high usage.

How to create the branch & PR (commands)
1) Create branch locally:
   git checkout -b cost-gate/soft-policy

2) Add files (paste the files above into repo root), then:
   git add agents-config-safety.json override-models-until.js orchestrator-cost-gate.js .github/workflows/enforce-model-policy.yml .vscode/launch.json .vscode/tasks.json run-agent.http RUNBOOK.md

3) Commit in groups:
   git commit -m "config: add agents-config-safety.json (soft model policy and quotas)"
   git add override-models-until.js orchestrator-cost-gate.js
   git commit -m "chore: add override script and simple cost-gate middleware"
   git add .github/workflows/enforce-model-policy.yml
   git commit -m "ci: add workflow to enforce model policy on push and nightly"
   git add .vscode run-agent.http RUNBOOK.md
   git commit -m "docs: add VS Code helpers, run-agent.http and RUNBOOK"

4) Push branch:
   git push origin cost-gate/soft-policy

5) Open PR:
   - Using GitHub web: create PR from cost-gate/soft-policy -> main
   - Or using gh CLI:
     gh pr create --base main --head sepherazadeh:cost-gate/soft-policy --title "Add soft cost-gate policy and automation" --body-file PR_BODY.md

PR checklist to include in PR body
- [ ] Human review of agents-config-safety.json (blocked dates, quotas)
- [ ] Replace PRICE_PER_1K with real pricing
- [ ] Confirm no secrets/API keys are modified
- [ ] Run override-models-until.js locally and run cost-gate service
- [ ] Wire orchestrator to call /run-agent (or test one agent)
- [ ] Decide merge method: squash (recommended)

If you want, I can:
- create the branch & PR for you (I need write permissions or to operate via fork and then open PR), or
- create a zip of these files for you to upload, or
- walk you through the commands step-by-step while you run them.
```
