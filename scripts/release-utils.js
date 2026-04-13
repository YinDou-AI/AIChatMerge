import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export const VERSION_FILE_PATHS = {
  manifest: 'manifest.json',
  packageJson: 'package.json',
  packageLock: 'package-lock.json',
  versionInfo: 'data/version-info.json'
};

export const BUMP_COMMIT_FILES = [
  VERSION_FILE_PATHS.manifest,
  VERSION_FILE_PATHS.packageJson,
  VERSION_FILE_PATHS.packageLock,
  VERSION_FILE_PATHS.versionInfo,
  'CHANGELOG.md'
];

export const PACKAGE_INCLUDE_PATHS = [
  '_locales',
  'background',
  'content-scripts',
  'data',
  'icons',
  'libs',
  'modules',
  'multi-panel',
  'options',
  'rules',
  'LICENSE',
  'manifest.json'
];

export const PACKAGE_EXCLUDED_PREFIXES = [
  'tests/',
  'dist/',
  'test-results/',
  'docs/',
  'assets/screenshots/',
  '.github/',
  'scripts/',
  '_metadata/',
  'icons/ICON_GUIDE.md',
  'data/prompt-libraries/Generate_a_Basic_Prompt_Library.md',
  'data/prompt-libraries/transform-libraries.js'
];

function getArgValue(argv, flagName) {
  const directIndex = argv.indexOf(flagName);
  if (directIndex >= 0 && argv[directIndex + 1]) {
    return argv[directIndex + 1];
  }

  const prefixedArg = argv.find(arg => arg.startsWith(`${flagName}=`));
  if (prefixedArg) {
    return prefixedArg.slice(flagName.length + 1);
  }

  return '';
}

export function resolveCliOptions(argv = process.argv.slice(2), env = process.env) {
  return {
    version: getArgValue(argv, '--version') || env.RELEASE_VERSION || '',
    changelog: getArgValue(argv, '--changelog') || env.RELEASE_CHANGELOG || '',
    baseRef: getArgValue(argv, '--base-ref') || env.RELEASE_BASE_REF || 'main',
    dryRun: argv.includes('--dry-run') || env.RELEASE_DRY_RUN === '1'
  };
}

export function isValidSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function compareVersions(current, next) {
  const currentParts = current.split('.').map(Number);
  const nextParts = next.split('.').map(Number);
  const maxLength = Math.max(currentParts.length, nextParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const nextPart = nextParts[index] ?? 0;

    if (currentPart < nextPart) {
      return -1;
    }

    if (currentPart > nextPart) {
      return 1;
    }
  }

  return 0;
}

export function parseChangelogEntries(rawChangelog) {
  return rawChangelog
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

export function getUtcDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function readJson(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const fileContent = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}

export async function writeJson(repoRoot, relativePath, data) {
  const filePath = path.join(repoRoot, relativePath);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readText(repoRoot, relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

export async function writeText(repoRoot, relativePath, content) {
  await fs.writeFile(path.join(repoRoot, relativePath), content);
}

export async function getVersionState(repoRoot) {
  const manifest = await readJson(repoRoot, VERSION_FILE_PATHS.manifest);
  const packageJson = await readJson(repoRoot, VERSION_FILE_PATHS.packageJson);
  const packageLock = await readJson(repoRoot, VERSION_FILE_PATHS.packageLock);
  const versionInfo = await readJson(repoRoot, VERSION_FILE_PATHS.versionInfo);

  return {
    manifest: manifest.version,
    packageJson: packageJson.version,
    packageLock: packageLock.version,
    packageLockRootPackage: packageLock.packages?.['']?.version ?? '',
    versionInfo: versionInfo.version
  };
}

export function assertVersionStateConsistency(versionState) {
  const manifestVersion = versionState.manifest;
  const candidates = [
    ['manifest.json', versionState.manifest],
    ['package.json', versionState.packageJson],
    ['package-lock.json', versionState.packageLock],
    ['package-lock.json packages[""]', versionState.packageLockRootPackage],
    ['data/version-info.json', versionState.versionInfo]
  ];

  const mismatches = candidates.filter(([, version]) => version !== manifestVersion);
  if (mismatches.length > 0) {
    const mismatchSummary = mismatches
      .map(([label, version]) => `${label}: ${version || '<missing>'}`)
      .join(', ');
    throw new Error(`Version files are out of sync. Expected ${manifestVersion}. Found ${mismatchSummary}`);
  }

  return manifestVersion;
}

export function assertTargetVersionIsNewer(currentVersion, targetVersion) {
  if (compareVersions(currentVersion, targetVersion) >= 0) {
    throw new Error(`Target version ${targetVersion} must be greater than current version ${currentVersion}`);
  }
}

export function assertChangelogEntries(entries) {
  if (entries.length === 0) {
    throw new Error('At least one changelog entry is required');
  }
}

export function localBranchExists(repoRoot, branchName) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], {
    cwd: repoRoot,
    stdio: 'ignore'
  });

  return result.status === 0;
}

export function assertLocalReleaseBranchMissing(repoRoot, version) {
  const branchName = `release/${version}`;
  if (localBranchExists(repoRoot, branchName)) {
    throw new Error(`Local branch ${branchName} already exists`);
  }
}

export function getShortHeadCommitHash(repoRoot) {
  return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim();
}

export function buildChangelogSection(version, buildDate, changelogEntries) {
  const lines = [
    `## ${version} - ${buildDate}`,
    ...changelogEntries.map(entry => `- ${entry}`),
    '',
    ''
  ];

  return lines.join('\n');
}

export function prependChangelogSection(changelogContent, section) {
  const heading = '# Changelog';
  if (!changelogContent.startsWith(heading)) {
    throw new Error('CHANGELOG.md must start with "# Changelog"');
  }

  const rest = changelogContent.slice(heading.length).replace(/^\n*/, '');
  return `${heading}\n\n${section}${rest}`;
}

export function formatDryRunPlan({
  version,
  currentVersion,
  baseRef,
  buildDate,
  commitHash,
  changelogEntries
}) {
  return [
    `[prepare-release] Dry run for ${version}`,
    `Base ref: ${baseRef}`,
    `Current version: ${currentVersion}`,
    `Next version: ${version}`,
    `Commit hash: ${commitHash}`,
    `Build date (UTC): ${buildDate}`,
    'Files to update:',
    `- ${VERSION_FILE_PATHS.packageJson} and ${VERSION_FILE_PATHS.packageLock} via npm version`,
    `- ${VERSION_FILE_PATHS.manifest}`,
    `- ${VERSION_FILE_PATHS.versionInfo}`,
    '- CHANGELOG.md',
    'Planned changelog section:',
    buildChangelogSection(version, buildDate, changelogEntries).trimEnd()
  ].join('\n');
}

export function readManifestReferencedPaths(manifest) {
  const requiredPaths = new Set();

  if (manifest.background?.service_worker) {
    requiredPaths.add(manifest.background.service_worker);
  }

  if (typeof manifest.options_page === 'string' && manifest.options_page.length > 0) {
    requiredPaths.add(manifest.options_page);
  }

  if (manifest.options_ui?.page) {
    requiredPaths.add(manifest.options_ui.page);
  }

  for (const contentScript of manifest.content_scripts ?? []) {
    for (const scriptPath of contentScript.js ?? []) {
      requiredPaths.add(scriptPath);
    }
  }

  for (const resourceGroup of manifest.web_accessible_resources ?? []) {
    for (const resourcePath of resourceGroup.resources ?? []) {
      requiredPaths.add(resourcePath);
    }
  }

  return Array.from(requiredPaths).sort();
}

export function normalizeZipEntries(rawEntries) {
  return rawEntries
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.replace(/^\.\//, '').replace(/\/$/, ''));
}

export function assertPackageEntries(entries, manifest) {
  const entrySet = new Set(entries);
  const missingPaths = readManifestReferencedPaths(manifest).filter(resourcePath => !entrySet.has(resourcePath));
  if (missingPaths.length > 0) {
    throw new Error(`Packaged zip is missing manifest-referenced files: ${missingPaths.join(', ')}`);
  }

  const forbiddenEntries = entries.filter(entry =>
    PACKAGE_EXCLUDED_PREFIXES.some(prefix => entry === prefix.replace(/\/$/, '') || entry.startsWith(prefix))
  );

  if (forbiddenEntries.length > 0) {
    throw new Error(`Packaged zip contains excluded paths: ${forbiddenEntries.join(', ')}`);
  }
}

export function ensureCommandExists(commandName) {
  const result = spawnSync('which', [commandName], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`Required command not found: ${commandName}`);
  }
}
