#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  assertPackageEntries,
  ensureCommandExists,
  normalizeZipEntries,
  PACKAGE_EXCLUDED_PREFIXES,
  PACKAGE_INCLUDE_PATHS,
  resolveCliOptions
} from './release-utils.js';

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

  ensureCommandExists('zip');
  ensureCommandExists('unzip');

  const outputDir = path.join(repoRoot, 'dist', `release-${version}`);
  const releaseZipPath = path.join(outputDir, `panelize-${version}-release.zip`);
  const cwsZipPath = path.join(outputDir, `panelize-${version}-cws.zip`);
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

  execFileSync('zip', ['-r', releaseZipPath, '.', '-x', '*.DS_Store'], {
    cwd: stagingDir,
    stdio: 'inherit'
  });

  await fs.copyFile(releaseZipPath, cwsZipPath);

  const zipEntries = normalizeZipEntries(
    execFileSync('unzip', ['-Z1', releaseZipPath], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
  );
  const packagedManifest = JSON.parse(
    execFileSync('unzip', ['-p', releaseZipPath, 'manifest.json'], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
  );

  assertPackageEntries(zipEntries, packagedManifest);
  await fs.rm(stagingDir, { recursive: true, force: true });

  console.log(`[package-release] Created ${releaseZipPath}`);
  console.log(`[package-release] Created ${cwsZipPath}`);
}

main().catch(error => {
  console.error(`[package-release] ${error.message}`);
  process.exit(1);
});
