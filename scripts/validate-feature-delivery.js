#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DELIVERY_DIR = path.join(ROOT, '.feature-delivery');
const RELEASE_PATH = path.join(ROOT, 'chatgpt-sources', 'source-release.json');
const SOURCE_PAIRS = [
  {
    canonical: 'docs/CHATGPT_CONTENT_PACK_WORKFLOW.md',
    projectSource: 'chatgpt-sources/01-CHATGPT_CONTENT_PACK_WORKFLOW.md',
  },
  {
    canonical: 'VOCABULARY_GENERATION_INSTRUCTIONS.md',
    projectSource: 'chatgpt-sources/02-VOCABULARY_GENERATION_INSTRUCTIONS.md',
  },
];
const PRODUCT_PATH_PREFIXES = ['packages/', 'launchd/'];
const PRODUCT_ROOT_FILES = new Set([
  'docker-compose.yml',
  'knexfile.js',
  'package.json',
  'yarn.lock',
]);
const IGNORED_PRODUCT_SCRIPTS = new Set(['scripts/validate-feature-delivery.js']);

function fail(message) {
  console.error(`Feature delivery validation failed: ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath).toString('utf8'));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function changedFiles(base, head) {
  if (!base || !head || /^0+$/.test(base)) return [];
  try {
    return git(['diff', '--name-only', `${base}...${head}`])
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch (error) {
    fail(`cannot calculate the feature diff: ${error.message}`);
    return [];
  }
}

function isProductPath(file) {
  if (PRODUCT_ROOT_FILES.has(file)) return true;
  if (PRODUCT_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) return true;
  return file.startsWith('scripts/') && !IGNORED_PRODUCT_SCRIPTS.has(file);
}

function pathCovered(file, declaredPath) {
  if (declaredPath.endsWith('/')) return file.startsWith(declaredPath);
  return file === declaredPath;
}

function requireString(record, key, source) {
  if (typeof record[key] !== 'string' || !record[key].trim()) {
    fail(`${source}.${key} must be a non-empty string`);
  }
}

function requireStringArray(record, key, source, allowEmpty = false) {
  const value = record[key];
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(`${source}.${key} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
    return [];
  }
  if (value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${source}.${key} must contain only non-empty strings`);
  }
  return value;
}

function validateSourceRelease() {
  const release = readJson('chatgpt-sources/source-release.json');
  if (!release) return null;
  if (release.schemaVersion !== 1) fail('source-release.json.schemaVersion must be 1');
  requireString(release, 'releaseId', 'source-release.json');
  if (!Array.isArray(release.sources) || release.sources.length !== SOURCE_PAIRS.length) {
    fail(`source-release.json.sources must contain exactly ${SOURCE_PAIRS.length} sources`);
    return release;
  }

  for (const pair of SOURCE_PAIRS) {
    if (!exists(pair.canonical)) fail(`missing canonical instruction ${pair.canonical}`);
    if (!exists(pair.projectSource)) fail(`missing ChatGPT source ${pair.projectSource}`);
    if (!exists(pair.canonical) || !exists(pair.projectSource)) continue;

    const canonical = read(pair.canonical);
    const projectSource = read(pair.projectSource);
    if (!canonical.equals(projectSource)) {
      fail(`${pair.projectSource} does not exactly match ${pair.canonical}`);
    }

    const declared = release.sources.find(
      (item) => item.canonicalPath === pair.canonical && item.projectSourcePath === pair.projectSource,
    );
    if (!declared) {
      fail(`source-release.json does not map ${pair.canonical} to ${pair.projectSource}`);
      continue;
    }
    const actualHash = sha256(projectSource);
    if (declared.sha256 !== actualHash) {
      fail(`${pair.projectSource} hash is ${actualHash}, not ${declared.sha256}`);
    }
  }
  return release;
}

function loadDeliveryRecords() {
  if (!fs.existsSync(DELIVERY_DIR)) {
    fail('missing .feature-delivery directory');
    return [];
  }
  return fs
    .readdirSync(DELIVERY_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      path: `.feature-delivery/${name}`,
      record: readJson(`.feature-delivery/${name}`),
    }))
    .filter((item) => item.record);
}

function validateDeliveryRecord(item) {
  const { path: source, record } = item;
  if (record.schemaVersion !== 1) fail(`${source}.schemaVersion must be 1`);
  requireString(record, 'featureId', source);
  requireString(record, 'title', source);
  const implementationPaths = requireStringArray(record, 'implementationPaths', source);
  const validationPaths = requireStringArray(record, 'validationPaths', source);

  for (const declaredPath of [...implementationPaths, ...validationPaths]) {
    if (!exists(declaredPath)) fail(`${source} references missing path ${declaredPath}`);
  }

  const impact = record.chatgptInstructionImpact;
  if (!impact || !['required', 'not_required'].includes(impact.status)) {
    fail(`${source}.chatgptInstructionImpact.status must be required or not_required`);
    return;
  }

  if (impact.status === 'not_required') {
    if (typeof impact.rationale !== 'string' || impact.rationale.trim().length < 20) {
      fail(`${source} must explain why ChatGPT instructions are not affected`);
    }
    return;
  }

  const instructionPaths = requireStringArray(impact, 'instructionPaths', `${source}.chatgptInstructionImpact`);
  if (!Array.isArray(impact.requiredMarkers) || impact.requiredMarkers.length === 0) {
    fail(`${source}.chatgptInstructionImpact.requiredMarkers must not be empty`);
    return;
  }

  for (const instructionPath of instructionPaths) {
    if (!exists(instructionPath)) fail(`${source} references missing instruction ${instructionPath}`);
  }
  for (const marker of impact.requiredMarkers) {
    if (!marker || typeof marker.path !== 'string' || !Array.isArray(marker.contains)) {
      fail(`${source} contains a malformed requiredMarkers item`);
      continue;
    }
    if (!instructionPaths.includes(marker.path)) {
      fail(`${source} marker path ${marker.path} is not declared in instructionPaths`);
      continue;
    }
    if (!exists(marker.path)) continue;
    const content = read(marker.path).toString('utf8');
    for (const requiredText of marker.contains) {
      if (typeof requiredText !== 'string' || !requiredText || !content.includes(requiredText)) {
        fail(`${marker.path} is missing required feature text: ${JSON.stringify(requiredText)}`);
      }
    }
  }
}

function validatePullRequest(records, changed) {
  const productFiles = changed.filter(isProductPath);
  if (productFiles.length === 0) return;

  const changedRecordPaths = new Set(
    changed.filter((file) => file.startsWith('.feature-delivery/') && file.endsWith('.json')),
  );
  const changedRecords = records.filter((item) => changedRecordPaths.has(item.path));
  if (changedRecords.length === 0) {
    fail('product code changed without a new or updated .feature-delivery/*.json record');
    return;
  }

  for (const file of productFiles) {
    const covered = changedRecords.some(({ record }) =>
      (record.implementationPaths || []).some((declaredPath) => pathCovered(file, declaredPath)),
    );
    if (!covered) fail(`changed product file ${file} is not covered by a changed delivery record`);
  }

  for (const { path: source, record } of changedRecords) {
    const validationChanged = (record.validationPaths || []).some((declaredPath) =>
      changed.some((file) => pathCovered(file, declaredPath)),
    );
    if (!validationChanged) fail(`${source} has no changed validation path in this pull request`);

    const impact = record.chatgptInstructionImpact;
    if (impact?.status !== 'required') continue;
    for (const instructionPath of impact.instructionPaths || []) {
      if (!changed.includes(instructionPath)) {
        fail(`${source} requires ${instructionPath}, but it was not changed in this pull request`);
      }
      const pair = SOURCE_PAIRS.find((candidate) => candidate.canonical === instructionPath);
      if (!pair) {
        fail(`${instructionPath} has no registered ChatGPT source mirror`);
      } else if (!changed.includes(pair.projectSource)) {
        fail(`${pair.projectSource} must change with ${instructionPath}`);
      }
    }
    if (!changed.includes('chatgpt-sources/source-release.json')) {
      fail('chatgpt-sources/source-release.json must change with instruction-bearing features');
    }
  }
}

function writeEvidence(destination, release, records) {
  const output = {
    schemaVersion: 1,
    commit: process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']),
    ref: process.env.GITHUB_REF || git(['branch', '--show-current']),
    verifiedAt: new Date().toISOString(),
    sourceRelease: release,
    featureIds: records.map(({ record }) => record.featureId).sort(),
  };
  fs.writeFileSync(path.resolve(ROOT, destination), `${JSON.stringify(output, null, 2)}\n`);
}

function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? null : args[index + 1];
  };
  const base = option('--base');
  const head = option('--head');
  const evidence = option('--evidence');

  const release = validateSourceRelease();
  const records = loadDeliveryRecords();
  records.forEach(validateDeliveryRecord);
  const changed = changedFiles(base, head);
  if (base && head) validatePullRequest(records, changed);
  if (evidence && !process.exitCode) writeEvidence(evidence, release, records);

  if (!process.exitCode) {
    console.log(`Feature delivery validation passed for ${records.length} feature record(s).`);
  }
}

main();
