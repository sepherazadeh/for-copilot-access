
/**
 * Replaces blocked premium models in agents-config with the first fallback.
 * Usage:
 *   node override-models-until.js path/to/agents-config.json
 *
 * Creates a backup: <file>.bak.TIMESTAMP
 */

const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(process.cwd(), 'agents-config-safety.json');
const cfgPath = path.resolve(file);

if (!fs.existsSync(cfgPath)) {
  console.error('File not found:', cfgPath);
  process.exit(1);
}

const raw = fs.readFileSync(cfgPath, 'utf8');
let cfg;
try {
  cfg = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}

const now = new Date();

const blocked =
  (cfg.budget_control &&
    cfg.budget_control.model_policy &&
    cfg.budget_control.model_policy.blocked_models_until) ||
  {};
const fallbackOrder =
  (cfg.budget_control &&
    cfg.budget_control.model_policy &&
    cfg.budget_control.model_policy.fallback_order) ||
  ['gpt-codex'];

const backupPath = cfgPath + '.bak.' + Date.now();
fs.writeFileSync(backupPath, raw, 'utf8');
console.log('Backup written to', backupPath);

let changed = false;

if (Array.isArray(cfg.agents)) {
  cfg.agents = cfg.agents.map(agent => {
    if (!agent.model) return agent;
    const blockedDateIso = blocked[agent.model];
    if (!blockedDateIso) return agent;
    const blockedDate = new Date(blockedDateIso);
    if (isNaN(blockedDate)) return agent;
    if (now < blockedDate) {
      const replacement = fallbackOrder.find(m => m !== agent.model) || 'gpt-codex';
      console.log(`Overriding agent ${agent.id || agent.role} model ${agent.model} -> ${replacement} (blocked until ${blockedDateIso})`);
      agent.model = replacement;
      changed = true;
    }
    return agent;
  });
}

// Also check top-level default_model if present
if (cfg.default_model) {
  const topBlockedDateIso = blocked[cfg.default_model];
  if (topBlockedDateIso && new Date(topBlockedDateIso) > now) {
    const replacement = fallbackOrder.find(m => m !== cfg.default_model) || 'gpt-codex';
    console.log(`Overriding default_model ${cfg.default_model} -> ${replacement} (blocked until ${topBlockedDateIso})`);
    cfg.default_model = replacement;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('Config updated at', cfgPath);
} else {
  console.log('No changes required. All blocked dates passed or no blocked models present.');
}
