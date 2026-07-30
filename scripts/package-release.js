#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import {
  assertPackageEntries,
  PACKAGE_EXCLUDED_PREFIXES,
  PACKAGE_INCLUDE_PATHS,
  resolveCliOptions
} from './release-utils.js';

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function getCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

async function listFiles(rootDir, currentDir = rootDir) {
  const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const dirEntry of dirEntries) {
    const absolutePath = path.join(currentDir, dirEntry.name);
    if (dirEntry.isDirectory()) {
      files.push(...(await listFiles(rootDir, absolutePath)));
      continue;
    }

    if (!dirEntry.isFile() || dirEntry.name === '.DS_Store') {
      continue;
    }

    files.push({
      absolutePath,
      zipPath: path.relative(rootDir, absolutePath).split(path.sep).join('/')
    });
  }

  return files.sort((left, right) => left.zipPath.localeCompare(right.zipPath));
}

async function createZipFromDirectory(sourceDir, zipPath) {
  const localFileRecords = [];
  const centralDirectoryRecords = [];
  let offset = 0;
  const files = await listFiles(sourceDir);
  const { dosDate, dosTime } = dosDateTime();

  for (const file of files) {
    const fileName = Buffer.from(file.zipPath, 'utf8');
    const content = await fs.readFile(file.absolutePath);
    const compressedContent = zlib.deflateRawSync(content);
    const crc32 = getCrc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(compressedContent.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localFileRecords.push(localHeader, fileName, compressedContent);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc32, 16);
    centralHeader.writeUInt32LE(compressedContent.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectoryRecords.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + compressedContent.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectoryRecords.reduce((size, record) => size + record.length, 0);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  await fs.writeFile(zipPath, Buffer.concat([
    ...localFileRecords,
    ...centralDirectoryRecords,
    endOfCentralDirectory
  ]));

  return files.map(file => file.zipPath);
}

async function assertFormalReleaseStaging(stagingDir) {
  const readStagingText = relativePath =>
    fs.readFile(path.join(stagingDir, relativePath), 'utf8');

  const [flags, diagnosticConfig, logger, contentBundle, panelHtml, optionsHtml] = await Promise.all([
    readStagingText('aichatmerge-panel/modules/build-flags.js'),
    readStagingText('modules/diagnostic-config.js'),
    readStagingText('aichatmerge-panel/modules/debug-log.js'),
    readStagingText('content-scripts/text-injection-all-providers.js'),
    readStagingText('aichatmerge-panel/multi-panel.html'),
    readStagingText('options/options.html')
  ]);

  const requiredMarkers = [
    [flags, 'export const DEBUG_LOGGING_ENABLED = false;', 'panel logging flag'],
    [flags, 'export const DEBUG_EXPORT_ENABLED = false;', 'debug export flag'],
    [diagnosticConfig, 'export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = false;', 'content diagnostics flag'],
    [contentBundle, 'INJECT_TEXT_RESULT', 'injection result protocol'],
    [contentBundle, 'SUBMIT_TEXT_RESULT', 'submission result protocol']
  ];
  for (const [source, marker, label] of requiredMarkers) {
    if (!source.includes(marker)) {
      throw new Error(`Formal release validation failed: missing ${label}`);
    }
  }

  const forbiddenLoggerMarkers = ['chrome.storage', 'chrome.downloads', 'Blob', 'setTimeout'];
  for (const marker of forbiddenLoggerMarkers) {
    if (logger.includes(marker)) {
      throw new Error(`Formal release validation failed: release logger contains ${marker}`);
    }
  }

  const forbiddenBundleMarkers = [
    'INJECTION_DIAGNOSTIC',
    'COMPLETION_DIAGNOSTIC',
    'CONTENT_SCRIPT_READY'
  ];
  for (const marker of forbiddenBundleMarkers) {
    if (contentBundle.includes(marker)) {
      throw new Error(`Formal release validation failed: content bundle contains ${marker}`);
    }
  }

  const forbiddenUiMarkers = [
    [panelHtml, 'debug-log-btn'],
    [optionsHtml, 'debug-auto-download-logs-toggle'],
    [panelHtml, 'DEBUG_ONLY_START'],
    [optionsHtml, 'DEBUG_ONLY_START']
  ];
  for (const [source, marker] of forbiddenUiMarkers) {
    if (source.includes(marker)) {
      throw new Error(`Formal release validation failed: debug UI contains ${marker}`);
    }
  }

  const removedDebugPaths = [
    'aichatmerge-panel/modules/debug-log.release.js',
    'aichatmerge-panel/modules/debug-log-utils.js',
    'aichatmerge-panel/modules/debug-verdict.js',
    'aichatmerge-panel/modules/self-test-driver.js',
    'content-scripts/src'
  ];
  for (const relativePath of removedDebugPaths) {
    try {
      await fs.access(path.join(stagingDir, relativePath));
      throw new Error(`Formal release validation failed: debug path remains: ${relativePath}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
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

  // 正式版打包：关闭日志录制、导出和自巡检。源码中的精确开关写法
  // 是发布防呆契约，任一开关未成功替换都拒绝打包。
  const buildFlagsPath = path.join(stagingDir, 'aichatmerge-panel', 'modules', 'build-flags.js');
  const buildFlagsSource = await fs.readFile(buildFlagsPath, 'utf8');
  const releaseBuildFlags = buildFlagsSource
    .replace(
      'export const DEBUG_LOGGING_ENABLED = true;',
      'export const DEBUG_LOGGING_ENABLED = false;'
    )
    .replace(
    'export const DEBUG_EXPORT_ENABLED = true;',
    'export const DEBUG_EXPORT_ENABLED = false;'
  );
  if (
    !releaseBuildFlags.includes('export const DEBUG_LOGGING_ENABLED = false;') ||
    !releaseBuildFlags.includes('export const DEBUG_EXPORT_ENABLED = false;')
  ) {
    throw new Error('build-flags.js is missing a release diagnostics flag; refusing to package');
  }
  await fs.writeFile(buildFlagsPath, releaseBuildFlags);

  // Replace the development logger with a stable no-op facade. Business modules
  // keep the same imports while the release package contains no persistence,
  // download, analysis, listener, or self-test implementation.
  const panelModulesDir = path.join(stagingDir, 'aichatmerge-panel', 'modules');
  await fs.copyFile(
    path.join(panelModulesDir, 'debug-log.release.js'),
    path.join(panelModulesDir, 'debug-log.js')
  );

  // Content scripts are already bundled in the repository, so changing only the
  // source flag would be ineffective. Flip the staging source and rebuild the
  // formal bundle before content-scripts/src is excluded from the zip.
  const diagnosticConfigPath = path.join(stagingDir, 'modules', 'diagnostic-config.js');
  const diagnosticConfigSource = await fs.readFile(diagnosticConfigPath, 'utf8');
  const releaseDiagnosticConfig = diagnosticConfigSource.replace(
    'export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = true;',
    'export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = false;'
  );
  if (releaseDiagnosticConfig === diagnosticConfigSource) {
    throw new Error('diagnostic-config.js is missing the content diagnostics flag; refusing to package');
  }
  await fs.writeFile(diagnosticConfigPath, releaseDiagnosticConfig);

  // Debug controls stay visible in the development source but are physically
  // removed from formal HTML. Markers make the removal reviewable and prevent
  // brittle matching against translated labels or surrounding layout.
  for (const relativePath of ['aichatmerge-panel/multi-panel.html', 'options/options.html']) {
    const htmlPath = path.join(stagingDir, relativePath);
    const htmlSource = await fs.readFile(htmlPath, 'utf8');
    const releaseHtml = htmlSource.replace(
      /[ \t]*<!-- DEBUG_ONLY_START -->[\s\S]*?<!-- DEBUG_ONLY_END -->[ \t]*\r?\n?/g,
      ''
    );
    if (releaseHtml === htmlSource) {
      throw new Error(`${relativePath} is missing a DEBUG_ONLY block; refusing to package`);
    }
    await fs.writeFile(htmlPath, releaseHtml);
  }

  const esbuildCliPath = path.join(repoRoot, 'node_modules', 'esbuild', 'bin', 'esbuild');
  execFileSync(process.execPath, [
    esbuildCliPath,
    path.join(stagingDir, 'content-scripts', 'src', 'text-injection-entry.js'),
    '--bundle',
    '--format=iife',
    '--minify-syntax',
    `--outfile=${path.join(stagingDir, 'content-scripts', 'text-injection-all-providers.js')}`
  ], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  for (const excludedPath of PACKAGE_EXCLUDED_PREFIXES) {
    await fs.rm(path.join(stagingDir, excludedPath), {
      recursive: true,
      force: true
    });
  }

  await assertFormalReleaseStaging(stagingDir);

  const zipEntries = await createZipFromDirectory(stagingDir, releaseZipPath);
  await fs.copyFile(releaseZipPath, cwsZipPath);

  const packagedManifest = JSON.parse(await fs.readFile(path.join(stagingDir, 'manifest.json'), 'utf8'));

  assertPackageEntries(zipEntries, packagedManifest);
  await fs.rm(stagingDir, { recursive: true, force: true });

  console.log(`[package-release] Created ${releaseZipPath}`);
  console.log(`[package-release] Created ${cwsZipPath}`);
}

main().catch(error => {
  console.error(`[package-release] ${error.message}`);
  process.exit(1);
});
