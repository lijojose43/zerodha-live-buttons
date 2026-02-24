/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'generate_pwa_icons.py');
const result = spawnSync('python3', [scriptPath], { stdio: 'inherit' });

if (result.error) {
  console.error('Icon generation failed:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
