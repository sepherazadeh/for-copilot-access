/**
 * Simple Express cost-gate service.
 * POST /run-agent
 * Body: { agentId, requestedModel, prompt, max_response_tokens, is_premium }
 *
 * Response:
 *  - { status: 'allowed', model, estCost }
 *  - { status: 'fallback', from, to, estCost }
 *  - 202 { status: 'queued_for_approval', reason }
 *
 * NOTES:
 * - Replace PRICE_PER_1K with real provider pricing.
 * - Integrate a tokenizer (tiktoken/etc) to replace approxTokensFromPrompt for accuracy.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.AGENTS_CONFIG_PATH || path.join(process.cwd(), 'agents-config-safety.json');
const USAGE_PATH = process.env.USAGE_PATH || path.join(process.cwd(), 'usage.json');
const APPROVALS_PATH = process.env.APPROVALS_PATH || path.join(process.cwd(), 'approvals.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('Config file not found at', CONFIG_PATH);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Placeholder price map — UPDATE with real prices
const PRICE_PER_1K = {
  "gpt-5": 0.060,
  "gpt-4.1": 0.030,
  "gpt-codex": 0.008
};

function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')); }
  catch (e) { return { daily_cost: 0, per_agent_tokens: {} }; }
}
function saveUsage(u) { fs.writeFileSync(USAGE_PATH, JSON.stringify(u, null, 2)); }

function approxTokensFromPrompt(prompt) {
  // heuristic: 4 chars ≈ 1 token
  return Math.max(1, Math.ceil((prompt || '').length / 4));
}

function estimateCost(model, promptTokens, maxResponseTokens) {
  const price = PRICE_PER_1K[model] || PRICE_PER_1K['gpt-codex'];
  const tokens = promptTokens + (maxResponseTokens || 0);
  return (tokens / 1000) * price;
}

function findFallback(model) {
  const order = (config.budget_control && config.budget_control.model_policy && config.budget_control.model_policy.fallback_order) || ['gpt-codex'];
  return order.find(m => m !== model) || order[0];
}

const app = express();
app.use(express.json());

app.post('/run-agent', (req, res) => {
  const { agentId, requestedModel, prompt = '', max_response_tokens = 800, is_premium = false } = req.body;
  const promptTokens = approxTokensFromPrompt(prompt);
  const estCost = estimateCost(requestedModel, promptTokens, max_response_tokens);

  const usage = loadUsage();

  const soft = (config.budget_control && config.budget_control.per_run_cost_soft_usd) || 3;
  const hard = (config.budget_control && config.budget_control.per_run_cost_hard_usd) || 10;

  const monthlyQuota = (config.budget_control && config.budget_control.per_agent_monthly_quota_tokens && config.budget_control.per_agent_monthly_quota_tokens[agentId]) || Infinity;
  const agentTokensUsed = usage.per_agent_tokens[agentId] || 0;
  const projectedAgentTokens = agentTokensUsed + promptTokens + max_response_tokens;

  if (projectedAgentTokens > monthlyQuota) {
    const approval = { agentId, requestedModel, promptTokens, max_response_tokens, estCost, reason: 'monthly_quota_exceeded', ts: new Date().toISOString() };
    const approvals = fs.existsSync(APPROVALS_PATH) ? JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8')) : [];
    approvals.push(approval);
    fs.writeFileSync(APPROVALS_PATH, JSON.stringify(approvals, null, 2));
    console.log('Queued for approval (quota exceeded):', approval);
    return res.status(202).json({ status: 'queued_for_approval', reason: 'monthly_quota_exceeded' });
  }

  if (estCost <= soft) {
    usage.daily_cost = (usage.daily_cost || 0) + estCost;
    usage.per_agent_tokens[agentId] = agentTokensUsed + promptTokens + max_response_tokens;
    saveUsage(usage);
    console.log(`Allowed run: ${agentId} model=${requestedModel} estCost=${estCost.toFixed(4)}`);
    return res.json({ status: 'allowed', model: requestedModel, estCost });
  }

  if (estCost > soft && estCost < hard) {
    const fallback = findFallback(requestedModel);
    const fallbackCost = estimateCost(fallback, promptTokens, max_response_tokens);

    usage.daily_cost = (usage.daily_cost || 0) + fallbackCost;
    usage.per_agent_tokens[agentId] = agentTokensUsed + promptTokens + max_response_tokens;
    saveUsage(usage);

    console.log(`Soft-fallback: ${agentId} ${requestedModel} -> ${fallback} estCost=${estCost.toFixed(4)} -> fallbackCost=${fallbackCost.toFixed(4)}`);
    // TODO: add Slack/webhook notification if desired
    return res.json({ status: 'fallback', from: requestedModel, to: fallback, estCost: fallbackCost });
  }

  // estCost >= hard => queue for manual approval
  const approval = { agentId, requestedModel, promptTokens, max_response_tokens, estCost, reason: 'per_run_cost_exceeds_hard', ts: new Date().toISOString() };
  const approvalsList = fs.existsSync(APPROVALS_PATH) ? JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8')) : [];
  approvalsList.push(approval);
  fs.writeFileSync(APPROVALS_PATH, JSON.stringify(approvalsList, null, 2));

  console.log('Queued for approval (cost high):', approval);
  return res.status(202).json({ status: 'queued_for_approval', reason: 'per_run_cost_exceeds_hard', estCost });
});

const port = process.env.PORT || 3005;
app.listen(port, () => console.log(`Cost-gate listening on ${port}`));
