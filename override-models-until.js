#!/usr/bin/env node

/**
 * override-models-until.js
 * 
 * Script to check and manage model blocking policies based on date.
 * Automatically unblocks models when their blockedUntil date has passed.
 * 
 * Usage: node override-models-until.js [config-path]
 */

const fs = require('fs');
const path = require('path');

function main() {
  const configPath = process.argv[2] || './agents-config-safety.json';
  const absolutePath = path.resolve(configPath);

  console.log(`🔍 Checking model policy configuration: ${absolutePath}`);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: Configuration file not found at ${absolutePath}`);
    process.exit(1);
  }

  let config;
  try {
    const rawConfig = fs.readFileSync(absolutePath, 'utf8');
    config = JSON.parse(rawConfig);
  } catch (error) {
    console.error(`❌ Error parsing configuration file: ${error.message}`);
    process.exit(1);
  }

  if (!config.modelPolicy || !config.modelPolicy.blockedModels) {
    console.log('⚠️  No blocked models found in configuration');
    return;
  }

  const now = new Date();
  let modified = false;
  const blockedModels = config.modelPolicy.blockedModels;

  console.log(`\n📅 Current date: ${now.toISOString()}`);
  console.log('\n📋 Blocked models status:\n');

  for (const [modelName, modelInfo] of Object.entries(blockedModels)) {
    const blockedUntil = new Date(modelInfo.blockedUntil);
    const isExpired = now >= blockedUntil;

    console.log(`  • ${modelName}:`);
    console.log(`    - Blocked until: ${modelInfo.blockedUntil}`);
    console.log(`    - Reason: ${modelInfo.reason}`);
    console.log(`    - Status: ${isExpired ? '✅ EXPIRED (will be removed)' : '🔒 ACTIVE'}`);

    if (isExpired) {
      delete blockedModels[modelName];
      modified = true;
    }
  }

  if (modified) {
    console.log('\n✏️  Updating configuration file...');
    
    // Update metadata
    if (!config.metadata) {
      config.metadata = {};
    }
    config.metadata.lastUpdated = now.toISOString();

    try {
      fs.writeFileSync(absolutePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      console.log('✅ Configuration file updated successfully');
    } catch (error) {
      console.error(`❌ Error writing configuration file: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('\n✅ No changes needed - all blocks are still active');
  }

  // Summary
  const remainingBlocks = Object.keys(config.modelPolicy.blockedModels).length;
  console.log(`\n📊 Summary: ${remainingBlocks} model(s) still blocked`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
