#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  assertPackageEntries,
  PACKAGE_EXCLUDED_PREFIXES,
  PACKAGE_INCLUDE_PATHS,
  resolveCliOptions
} from './release-utils.js';

function commandExists(commandName) {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookupCommand, [commandName], { stdio: 'ignore' });
  return result.status === 0;
}

async function collectPackageEntries(rootDir, currentDir = rootDir) {
  const dirents = await fs.readdir(currentDir, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    const fullPath = path.join(currentDir, dirent.name);
    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');

    if (dirent.isDirectory()) {
      entries.push(...await collectPackageEntries(rootDir, fullPath));
    } else {
      entries.push(relativePath);
    }
  }

  return entries.sort();
}

function createZipArchive(stagingDir, outputPath) {
  if (commandExists('zip')) {
    execFileSync('zip', ['-r', outputPath, '.', '-x', '*.DS_Store'], {
      cwd: stagingDir,
      stdio: 'inherit'
    });
    return;
  }

  if (process.platform === 'win32' && commandExists('tar')) {
    execFileSync('tar', [
      '-a',
      '-cf',
      outputPath,
      '-C',
      stagingDir,
      '.'
    ], {
      stdio: 'inherit'
    });
    return;
  }

  throw new Error('Required command not found: zip');
}

async function main() {
  const repoRoot = process.cwd();
  const options = resolveCliOptions();
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const version = options.version || manifest.version;

  if (options.version && options.version !== manifest.version) {
    throw new Error(
      `Requested package version ${options.version} does not match manifest version ${manifest.version}`
    );
  }

  const outputDir = path.join(repoRoot, 'dist', `release-${version}`);
  const releaseZipPath = path.join(outputDir, `aichatmerge-${version}-release.zip`);
  const cwsZipPath = path.join(outputDir, `aichatmerge-${version}-cws.zip`);
  const stagingDir = path.join(outputDir, 'staging');

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  for (const relativePath of PACKAGE_INCLUDE_PATHS) {
    await fs.cp(path.join(repoRoot, relativePath), path.join(stagingDir, relativePath), {
      recursive: true
    });
  }

  for (const excludedPath of PACKAGE_EXCLUDED_PREFIXES) {
    await fs.rm(path.join(stagingDir, excludedPath), {
      recursive: true,
      force: true
    });
  }

  const packageEntries = await collectPackageEntries(stagingDir);
  const packagedManifest = JSON.parse(await fs.readFile(path.join(stagingDir, 'manifest.json'), 'utf8'));
  assertPackageEntries(packageEntries, packagedManifest);

  createZipArchive(stagingDir, releaseZipPath);
  await fs.copyFile(releaseZipPath, cwsZipPath);
  await fs.rm(stagingDir, { recursive: true, force: true });

  console.log(`[package-release] Created ${releaseZipPath}`);
  console.log(`[package-release] Created ${cwsZipPath}`);
}

main().catch(error => {
  console.error(`[package-release] ${error.message}`);
  process.exit(1);
});
