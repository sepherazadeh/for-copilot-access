#!/usr/bin/env node
/**
 * orchestrator-cost-gate.js
 * 
 * Express service exposing POST /run-agent endpoint with soft/hard cost thresholds.
 * Manages usage tracking and approval workflows for expensive AI model runs.
 * 
 * Usage: node orchestrator-cost-gate.js [port]
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || process.argv[2] || 3000;
const USAGE_FILE = path.join(__dirname, 'usage.json');
const APPROVALS_FILE = path.join(__dirname, 'approvals.json');
const CONFIG_FILE = path.join(__dirname, 'agents-config-safety.json');

// ⚠️ PLACEHOLDER: Replace with actual pricing data before production
// These are example prices per 1K tokens
const PRICE_PER_1K = {
  'gpt-5': { input: 0.05, output: 0.15 },
  'gpt-4.1': { input: 0.03, output: 0.06 },
  'gpt-codex': { input: 0.01, output: 0.02 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
};

/**
 * ⚠️ TOKENIZER NOTE:
 * This is a placeholder token estimation. Before production:
 * 1. Install a proper tokenizer library (e.g., tiktoken, gpt-tokenizer)
 * 2. Replace this function with actual token counting
 * 3. Use model-specific tokenizers for accurate billing
 */
function estimateTokens(text) {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function loadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
  }
}

function initializeFiles() {
  if (!fs.existsSync(USAGE_FILE)) {
    saveJSON(USAGE_FILE, { monthly_usage: {}, daily_usage: {} });
  }
  if (!fs.existsSync(APPROVALS_FILE)) {
    saveJSON(APPROVALS_FILE, { pending: [], approved: [], rejected: [] });
  }
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = PRICE_PER_1K[model];
  if (!pricing) {
    console.warn(`⚠️  No pricing data for model: ${model}`);
    return 0;
  }
  
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

function updateUsage(agent, model, cost) {
  const usage = loadJSON(USAGE_FILE, { monthly_usage: {}, daily_usage: {} });
  const month = getCurrentMonth();
  const date = getCurrentDate();
  
  // Update monthly usage
  if (!usage.monthly_usage[month]) {
    usage.monthly_usage[month] = {};
  }
  if (!usage.monthly_usage[month][agent]) {
    usage.monthly_usage[month][agent] = { total_cost: 0, runs: 0, models: {} };
  }
  usage.monthly_usage[month][agent].total_cost += cost;
  usage.monthly_usage[month][agent].runs += 1;
  
  if (!usage.monthly_usage[month][agent].models[model]) {
    usage.monthly_usage[month][agent].models[model] = 0;
  }
  usage.monthly_usage[month][agent].models[model] += cost;
  
  // Update daily usage
  if (!usage.daily_usage[date]) {
    usage.daily_usage[date] = { total_cost: 0, by_agent: {} };
  }
  usage.daily_usage[date].total_cost += cost;
  
  if (!usage.daily_usage[date].by_agent[agent]) {
    usage.daily_usage[date].by_agent[agent] = 0;
  }
  usage.daily_usage[date].by_agent[agent] += cost;
  
  saveJSON(USAGE_FILE, usage);
  return usage;
}

function checkThresholds(agent, estimatedCost) {
  const config = loadJSON(CONFIG_FILE);
  const usage = loadJSON(USAGE_FILE, { monthly_usage: {}, daily_usage: {} });
  const month = getCurrentMonth();
  
  const softThreshold = config.global_settings?.soft_threshold_usd || 100;
  const hardThreshold = config.global_settings?.hard_threshold_usd || 500;
  const requireApprovalAbove = config.global_settings?.require_approval_above_usd || 10;
  const agentQuota = config.agents?.[agent]?.monthly_quota_usd || 50;
  
  const currentMonthlyTotal = Object.values(usage.monthly_usage[month] || {})
    .reduce((sum, agentUsage) => sum + agentUsage.total_cost, 0);
  
  const currentAgentUsage = usage.monthly_usage[month]?.[agent]?.total_cost || 0;
  
  // Check hard threshold (block)
  if (currentMonthlyTotal + estimatedCost > hardThreshold) {
    return {
      allowed: false,
      reason: 'hard_threshold_exceeded',
      message: `Hard threshold exceeded: ${currentMonthlyTotal.toFixed(2)} + ${estimatedCost.toFixed(2)} > ${hardThreshold}`
    };
  }
  
  // Check agent quota (block)
  if (currentAgentUsage + estimatedCost > agentQuota) {
    return {
      allowed: false,
      reason: 'agent_quota_exceeded',
      message: `Agent "${agent}" monthly quota exceeded: ${currentAgentUsage.toFixed(2)} + ${estimatedCost.toFixed(2)} > ${agentQuota}`
    };
  }
  
  // Check if approval required
  if (estimatedCost > requireApprovalAbove) {
    return {
      allowed: false,
      reason: 'approval_required',
      message: `Run cost ${estimatedCost.toFixed(2)} exceeds approval threshold ${requireApprovalAbove}`,
      requiresApproval: true
    };
  }
  
  // Check soft threshold (warn)
  if (currentMonthlyTotal + estimatedCost > softThreshold) {
    return {
      allowed: true,
      warning: true,
      message: `Soft threshold warning: ${currentMonthlyTotal.toFixed(2)} + ${estimatedCost.toFixed(2)} > ${softThreshold}`
    };
  }
  
  return { allowed: true };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get usage statistics
app.get('/usage', (req, res) => {
  const usage = loadJSON(USAGE_FILE, { monthly_usage: {}, daily_usage: {} });
  const month = getCurrentMonth();
  
  const monthlyTotal = Object.values(usage.monthly_usage[month] || {})
    .reduce((sum, agentUsage) => sum + agentUsage.total_cost, 0);
  
  res.json({
    current_month: month,
    monthly_total: monthlyTotal,
    monthly_usage: usage.monthly_usage[month] || {},
    recent_daily: Object.keys(usage.daily_usage)
      .sort()
      .slice(-7)
      .reduce((obj, date) => {
        obj[date] = usage.daily_usage[date];
        return obj;
      }, {})
  });
});

// Run agent endpoint
app.post('/run-agent', (req, res) => {
  const { agent, model, input, expected_output_tokens } = req.body;
  
  if (!agent || !model || !input) {
    return res.status(400).json({ 
      error: 'Missing required fields: agent, model, input' 
    });
  }
  
  const config = loadJSON(CONFIG_FILE);
  
  // Check if agent exists in config
  if (!config.agents || !config.agents[agent]) {
    return res.status(400).json({ 
      error: `Unknown agent: ${agent}` 
    });
  }
  
  // Estimate tokens and cost
  const inputTokens = estimateTokens(input);
  const outputTokens = expected_output_tokens || estimateTokens(input); // Rough estimate
  const estimatedCost = calculateCost(model, inputTokens, outputTokens);
  
  console.log(`📊 Request: agent="${agent}", model="${model}", estimated_cost=$${estimatedCost.toFixed(4)}`);
  
  // Check thresholds
  const thresholdCheck = checkThresholds(agent, estimatedCost);
  
  if (!thresholdCheck.allowed) {
    if (thresholdCheck.requiresApproval) {
      // Queue for approval
      const approvals = loadJSON(APPROVALS_FILE, { pending: [], approved: [], rejected: [] });
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      approvals.pending.push({
        id: requestId,
        agent,
        model,
        estimated_cost: estimatedCost,
        input_preview: input.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      saveJSON(APPROVALS_FILE, approvals);
      
      return res.status(202).json({
        status: 'pending_approval',
        request_id: requestId,
        message: thresholdCheck.message,
        estimated_cost: estimatedCost
      });
    }
    
    return res.status(403).json({
      error: thresholdCheck.reason,
      message: thresholdCheck.message
    });
  }
  
  // Update usage
  const usage = updateUsage(agent, model, estimatedCost);
  
  const response = {
    status: 'success',
    agent,
    model,
    estimated_cost: estimatedCost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    message: 'Agent run authorized'
  };
  
  if (thresholdCheck.warning) {
    response.warning = thresholdCheck.message;
  }
  
  res.json(response);
});

// Approve/reject pending requests
app.post('/approve/:requestId', (req, res) => {
  const { requestId } = req.params;
  const { approved, reviewer } = req.body;
  
  const approvals = loadJSON(APPROVALS_FILE, { pending: [], approved: [], rejected: [] });
  const pendingIndex = approvals.pending.findIndex(r => r.id === requestId);
  
  if (pendingIndex === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  const request = approvals.pending.splice(pendingIndex, 1)[0];
  request.reviewed_at = new Date().toISOString();
  request.reviewer = reviewer;
  
  if (approved) {
    approvals.approved.push(request);
    res.json({ status: 'approved', request });
  } else {
    approvals.rejected.push(request);
    res.json({ status: 'rejected', request });
  }
  
  saveJSON(APPROVALS_FILE, approvals);
});

// Get pending approvals
app.get('/approvals/pending', (req, res) => {
  const approvals = loadJSON(APPROVALS_FILE, { pending: [], approved: [], rejected: [] });
  res.json({ pending: approvals.pending });
});

// Initialize and start server
initializeFiles();

app.listen(PORT, () => {
  console.log(`🚀 Cost-gate orchestrator running on http://localhost:${PORT}`);
  console.log(`📁 Config: ${CONFIG_FILE}`);
  console.log(`📊 Usage tracking: ${USAGE_FILE}`);
  console.log(`✅ Approvals: ${APPROVALS_FILE}`);
  console.log(`\n⚠️  IMPORTANT: Update PRICE_PER_1K and integrate proper tokenizer before production!`);
});

module.exports = app;
