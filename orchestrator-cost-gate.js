#!/usr/bin/env node

/**
 * orchestrator-cost-gate.js
 * 
 * Express middleware that enforces model policy and cost gates for AI agent requests.
 * Implements soft-first policy: blocks premium models, suggests fallbacks, queues for approval.
 * 
 * Usage: node orchestrator-cost-gate.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = process.env.CONFIG_PATH || './agents-config-safety.json';

// TODO: Replace PRICE_PER_1K with actual pricing from your provider
// See RUNBOOK.md for instructions on obtaining and updating these values
const MODEL_PRICING = {
  'gpt-5': {
    PRICE_PER_1K_INPUT: 0.10,
    PRICE_PER_1K_OUTPUT: 0.30
  },
  'gpt-4.1': {
    PRICE_PER_1K_INPUT: 0.05,
    PRICE_PER_1K_OUTPUT: 0.15
  },
  'gpt-codex': {
    PRICE_PER_1K_INPUT: 0.02,
    PRICE_PER_1K_OUTPUT: 0.06
  }
};

// Middleware
app.use(express.json());

// Load configuration
let config;
function loadConfig() {
  try {
    const configPath = path.resolve(CONFIG_PATH);
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(rawConfig);
    console.log('✅ Configuration loaded successfully');
    return true;
  } catch (error) {
    console.error(`❌ Error loading configuration: ${error.message}`);
    return false;
  }
}

// Cost estimation function
function estimateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return { estimated: false, cost: 0 };
  }

  const inputCost = (inputTokens / 1000) * pricing.PRICE_PER_1K_INPUT;
  const outputCost = (outputTokens / 1000) * pricing.PRICE_PER_1K_OUTPUT;
  const totalCost = inputCost + outputCost;

  return {
    estimated: true,
    cost: totalCost,
    breakdown: {
      input: inputCost,
      output: outputCost
    }
  };
}

// Check if model is blocked
function isModelBlocked(model) {
  if (!config || !config.modelPolicy || !config.modelPolicy.blockedModels) {
    return { blocked: false };
  }

  const blockedInfo = config.modelPolicy.blockedModels[model];
  if (!blockedInfo) {
    return { blocked: false };
  }

  const blockedUntil = new Date(blockedInfo.blockedUntil);
  const now = new Date();

  if (now >= blockedUntil) {
    return { blocked: false, expired: true };
  }

  return {
    blocked: true,
    reason: blockedInfo.reason,
    blockedUntil: blockedInfo.blockedUntil
  };
}

// Get fallback model
function getFallbackModel(requestedModel) {
  if (!config || !config.modelPolicy) {
    return null;
  }

  const fallbackOrder = config.modelPolicy.fallbackOrder || [];
  
  // Find the first non-blocked model in the fallback order
  for (const model of fallbackOrder) {
    if (model === requestedModel) continue;
    
    const blockStatus = isModelBlocked(model);
    if (!blockStatus.blocked) {
      return model;
    }
  }

  return config.modelPolicy.defaultModel || null;
}

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configLoaded: !!config
  });
});

// Reload configuration endpoint
app.post('/reload-config', (req, res) => {
  const success = loadConfig();
  res.json({
    success,
    timestamp: new Date().toISOString()
  });
});

// Main agent execution endpoint with cost gate
app.post('/run-agent', (req, res) => {
  const { model, prompt, estimatedInputTokens = 1000, estimatedOutputTokens = 500 } = req.body;

  if (!model) {
    return res.status(400).json({
      error: 'Missing required field: model'
    });
  }

  console.log(`\n🤖 Agent request: model=${model}`);

  // Check if model is blocked
  const blockStatus = isModelBlocked(model);
  
  if (blockStatus.blocked) {
    const fallbackModel = getFallbackModel(model);
    const costEstimate = estimateCost(model, estimatedInputTokens, estimatedOutputTokens);

    console.log(`🚫 Model ${model} is blocked until ${blockStatus.blockedUntil}`);
    console.log(`💡 Suggesting fallback: ${fallbackModel}`);

    return res.status(403).json({
      blocked: true,
      requestedModel: model,
      reason: blockStatus.reason,
      blockedUntil: blockStatus.blockedUntil,
      fallbackModel,
      costEstimate: costEstimate.estimated ? {
        currency: config.modelPolicy.costThresholds?.currency || 'USD',
        amount: costEstimate.cost.toFixed(4),
        breakdown: costEstimate.breakdown
      } : null,
      message: `Model ${model} requires approval. Consider using ${fallbackModel} as an alternative, or request approval for premium model usage.`,
      action: 'FALLBACK_SUGGESTED'
    });
  }

  // Model is allowed - estimate cost and warn if high
  const costEstimate = estimateCost(model, estimatedInputTokens, estimatedOutputTokens);
  
  if (costEstimate.estimated && config.modelPolicy?.costThresholds) {
    const warnThreshold = config.modelPolicy.costThresholds.warn;
    const blockThreshold = config.modelPolicy.costThresholds.block;

    if (costEstimate.cost >= blockThreshold) {
      console.log(`⛔ Cost exceeds block threshold: $${costEstimate.cost.toFixed(4)}`);
      return res.status(402).json({
        blocked: true,
        reason: 'Cost threshold exceeded',
        costEstimate: {
          currency: config.modelPolicy.costThresholds.currency,
          amount: costEstimate.cost.toFixed(4),
          threshold: blockThreshold
        },
        message: `Estimated cost ($${costEstimate.cost.toFixed(4)}) exceeds block threshold ($${blockThreshold}). Approval required.`,
        action: 'APPROVAL_REQUIRED'
      });
    }

    if (costEstimate.cost >= warnThreshold) {
      console.log(`⚠️  Cost warning: $${costEstimate.cost.toFixed(4)}`);
    }
  }

  // Request approved
  console.log(`✅ Model ${model} approved`);
  
  res.json({
    approved: true,
    model,
    costEstimate: costEstimate.estimated ? {
      currency: config.modelPolicy?.costThresholds?.currency || 'USD',
      amount: costEstimate.cost.toFixed(4)
    } : null,
    message: 'Request approved',
    timestamp: new Date().toISOString()
  });
});

// Start server
function startServer() {
  if (!loadConfig()) {
    console.error('⚠️  Warning: Starting server without valid configuration');
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Orchestrator Cost Gate server running on port ${PORT}`);
    console.log(`📋 Configuration file: ${CONFIG_PATH}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health          - Health check`);
    console.log(`  POST /reload-config   - Reload configuration`);
    console.log(`  POST /run-agent       - Execute agent with cost gate`);
    console.log(`\n💡 See RUNBOOK.md for usage instructions\n`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, loadConfig, isModelBlocked, getFallbackModel, estimateCost };
