#!/usr/bin/env node
/**
 * override-models-until.js
 * 
 * Script to replace blocked premium models in agents-config with first fallback model.
 * Creates a backup before making changes.
 * 
 * Usage: node override-models-until.js [config-file-path]
 */

const fs = require('fs');
const path = require('path');

function main() {
  const configPath = process.argv[2] || './agents-config-safety.json';
  const absolutePath = path.resolve(configPath);
  
  console.log(`📋 Reading configuration from: ${absolutePath}`);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: Configuration file not found: ${absolutePath}`);
    process.exit(1);
  }
  
  let config;
  try {
    const configContent = fs.readFileSync(absolutePath, 'utf8');
    config = JSON.parse(configContent);
  } catch (error) {
    console.error(`❌ Error reading or parsing configuration file: ${error.message}`);
    process.exit(1);
  }
  
  // Create backup
  const backupPath = `${absolutePath}.backup-${Date.now()}`;
  fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
  console.log(`💾 Backup created: ${backupPath}`);
  
  const blockedModels = config.blocked_models_until || {};
  const fallbackOrder = config.fallback_order || [];
  const today = new Date().toISOString().split('T')[0];
  
  if (fallbackOrder.length === 0) {
    console.warn('⚠️  Warning: No fallback models defined in fallback_order');
    process.exit(0);
  }
  
  const firstFallback = fallbackOrder[0];
  console.log(`🔄 First fallback model: ${firstFallback}`);
  
  let replacementCount = 0;
  const blockedUntilToday = [];
  
  // Check which models are blocked until today or later
  for (const [model, untilDate] of Object.entries(blockedModels)) {
    if (untilDate >= today) {
      blockedUntilToday.push(model);
      console.log(`🚫 Model "${model}" is blocked until ${untilDate}`);
    }
  }
  
  if (blockedUntilToday.length === 0) {
    console.log('✅ No models are currently blocked');
    process.exit(0);
  }
  
  // Replace blocked models in agents configuration
  if (config.agents) {
    for (const [agentName, agentConfig] of Object.entries(config.agents)) {
      const preferredModel = agentConfig.preferred_model;
      
      if (preferredModel && blockedUntilToday.includes(preferredModel)) {
        console.log(`  🔧 Agent "${agentName}": Replacing "${preferredModel}" with "${firstFallback}"`);
        agentConfig.preferred_model = firstFallback;
        agentConfig.original_model = preferredModel; // Track original for reference
        replacementCount++;
      }
    }
  }
  
  // Write updated configuration
  fs.writeFileSync(absolutePath, JSON.stringify(config, null, 2));
  
  console.log(`\n✨ Summary:`);
  console.log(`   - Blocked models: ${blockedUntilToday.join(', ')}`);
  console.log(`   - Replacements made: ${replacementCount}`);
  console.log(`   - Updated configuration: ${absolutePath}`);
  console.log(`   - Backup saved: ${backupPath}`);
  
  if (replacementCount > 0) {
    console.log('\n⚠️  Remember to review the changes and restore from backup if needed.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
