#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const label = 'com.englishmastery.control';
const legacyLabel = 'com.englishmastery.start';
const repoRoot = path.resolve(__dirname, '..');
const userId = typeof process.getuid === 'function' ? process.getuid() : null;
const domain = userId === null ? null : `gui/${userId}`;
const launchAgents = path.join(os.homedir(), 'Library', 'LaunchAgents');
const logsDirectory = path.join(os.homedir(), 'Library', 'Logs', 'english_mastery');
const plistPath = path.join(launchAgents, `${label}.plist`);
const legacyPlistPath = path.join(launchAgents, `${legacyLabel}.plist`);
const uninstall = process.argv.includes('--uninstall');

function fail(message) {
  console.error(`\nInstallation failed: ${message}`);
  process.exit(1);
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const details = result.error?.message || result.stderr?.trim() || result.stdout?.trim();
    fail(`${command} ${args.join(' ')}${details ? `\n${details}` : ''}`);
  }
  return result;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

if (process.platform !== 'darwin') {
  fail('automatic startup currently supports macOS only.');
}
if (!domain) {
  fail('the current macOS user could not be determined.');
}

if (uninstall) {
  run('launchctl', ['bootout', domain, plistPath], { allowFailure: true });
  if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath);
  console.log('English Mastery automatic startup was removed.');
  console.log('PostgreSQL and Redis data were not removed.');
  process.exit(0);
}

const templatePath = path.join(
  repoRoot,
  'launchd',
  'com.englishmastery.control.plist.template',
);
if (!fs.existsSync(templatePath)) fail(`missing template: ${templatePath}`);
if (!fs.existsSync(path.join(repoRoot, 'scripts', 'control-server.js'))) {
  fail('control-server.js is missing.');
}

fs.mkdirSync(launchAgents, { recursive: true });
fs.mkdirSync(logsDirectory, { recursive: true });

const nodeDirectory = path.dirname(process.execPath);
const servicePath = [
  nodeDirectory,
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
].filter((entry, index, values) => values.indexOf(entry) === index).join(':');

const plist = fs
  .readFileSync(templatePath, 'utf8')
  .replaceAll('__NODE_PATH__', escapeXml(process.execPath))
  .replaceAll('__REPOSITORY_PATH__', escapeXml(repoRoot))
  .replaceAll('__LOG_PATH__', escapeXml(logsDirectory))
  .replaceAll('__PATH__', escapeXml(servicePath));

// Disable the former hard-coded service if it was installed by an older version.
run('launchctl', ['bootout', domain, legacyPlistPath], { allowFailure: true });
if (fs.existsSync(legacyPlistPath)) {
  const disabledPath = `${legacyPlistPath}.disabled`;
  if (fs.existsSync(disabledPath)) fs.unlinkSync(disabledPath);
  fs.renameSync(legacyPlistPath, disabledPath);
}

run('launchctl', ['bootout', domain, plistPath], { allowFailure: true });
fs.writeFileSync(plistPath, plist, { mode: 0o644 });
run('plutil', ['-lint', plistPath]);
run('launchctl', ['bootstrap', domain, plistPath]);
run('launchctl', ['enable', `${domain}/${label}`]);
run('launchctl', ['kickstart', '-k', `${domain}/${label}`]);

console.log('\nEnglish Mastery automatic startup is installed.');
console.log('Control page: http://localhost:3000');
console.log(`Service file: ${plistPath}`);
console.log(`Logs: ${logsDirectory}`);
console.log('\nThe service will start automatically whenever you log in to this Mac.');
