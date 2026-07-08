#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
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
