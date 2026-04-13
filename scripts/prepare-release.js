#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  assertChangelogEntries,
  assertLocalReleaseBranchMissing,
  assertTargetVersionIsNewer,
  assertVersionStateConsistency,
  buildChangelogSection,
  formatDryRunPlan,
  getShortHeadCommitHash,
  getUtcDateStamp,
  getVersionState,
  isValidSemver,
  parseChangelogEntries,
  prependChangelogSection,
  readJson,
  readText,
  resolveCliOptions,
  VERSION_FILE_PATHS,
  writeJson,
  writeText
} from './release-utils.js';

async function main() {
  const repoRoot = process.cwd();
  const options = resolveCliOptions();

  if (!options.version) {
    throw new Error('Missing release version. Provide --version or RELEASE_VERSION');
  }

  if (!isValidSemver(options.version)) {
    throw new Error(`Invalid version "${options.version}". Expected x.y.z`);
  }

  const changelogEntries = parseChangelogEntries(options.changelog);
  assertChangelogEntries(changelogEntries);

  const versionState = await getVersionState(repoRoot);
  const currentVersion = assertVersionStateConsistency(versionState);
  assertTargetVersionIsNewer(currentVersion, options.version);
  assertLocalReleaseBranchMissing(repoRoot, options.version);

  const buildDate = getUtcDateStamp();
  const commitHash = getShortHeadCommitHash(repoRoot);

  if (options.dryRun) {
    console.log(formatDryRunPlan({
      version: options.version,
      currentVersion,
      baseRef: options.baseRef,
      buildDate,
      commitHash,
      changelogEntries
    }));
    return;
  }

  execFileSync('npm', ['version', options.version, '--no-git-tag-version'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  const manifest = await readJson(repoRoot, VERSION_FILE_PATHS.manifest);
  manifest.version = options.version;
  await writeJson(repoRoot, VERSION_FILE_PATHS.manifest, manifest);

  await writeJson(repoRoot, VERSION_FILE_PATHS.versionInfo, {
    version: options.version,
    commitHash,
    buildDate
  });

  const currentChangelog = await readText(repoRoot, 'CHANGELOG.md');
  const newSection = buildChangelogSection(options.version, buildDate, changelogEntries);
  await writeText(repoRoot, 'CHANGELOG.md', prependChangelogSection(currentChangelog, newSection));

  console.log(`[prepare-release] Updated release metadata for ${options.version}`);
}

main().catch(error => {
  console.error(`[prepare-release] ${error.message}`);
  process.exit(1);
});
