import { describe, expect, it } from 'vitest';

import {
  assertPackageEntries,
  assertTargetVersionIsNewer,
  assertVersionStateConsistency,
  buildChangelogSection,
  compareVersions,
  normalizeZipEntries,
  parseChangelogEntries,
  prependChangelogSection,
  readManifestReferencedPaths
} from '../scripts/release-utils.js';

describe('release utils', () => {
  it('compares semver values correctly', () => {
    expect(compareVersions('1.1.0', '1.1.1')).toBe(-1);
    expect(compareVersions('1.1.1', '1.1.1')).toBe(0);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
  });

  it('normalizes changelog entries from literal newline input', () => {
    expect(parseChangelogEntries('Fixed one\\n- Fixed two\\n\\nAdded three')).toEqual([
      'Fixed one',
      'Fixed two',
      'Added three'
    ]);
  });

  it('rejects non-incrementing target versions', () => {
    expect(() => assertTargetVersionIsNewer('1.1.0', '1.1.0')).toThrow(/must be greater/);
    expect(() => assertTargetVersionIsNewer('1.1.0', '1.0.9')).toThrow(/must be greater/);
  });

  it('requires all version files to match the manifest version', () => {
    expect(() => assertVersionStateConsistency({
      manifest: '1.1.0',
      packageJson: '1.1.0',
      packageLock: '1.1.0',
      packageLockRootPackage: '1.1.0',
      versionInfo: '1.1.1'
    })).toThrow(/out of sync/);
  });

  it('builds changelog sections in the project format', () => {
    expect(buildChangelogSection('1.1.1', '2026-04-13', ['Fixed release prep'])).toBe(
      '## 1.1.1 - 2026-04-13\n- Fixed release prep\n\n'
    );
  });

  it('prepends a new changelog section after the title', () => {
    const original = '# Changelog\n\n## 1.1.0 - 2026-04-07\n- Existing entry\n';
    const section = '## 1.1.1 - 2026-04-13\n- New entry\n\n';

    expect(prependChangelogSection(original, section)).toBe(
      '# Changelog\n\n## 1.1.1 - 2026-04-13\n- New entry\n\n## 1.1.0 - 2026-04-07\n- Existing entry\n'
    );
  });

  it('requires changelog content to start with the heading', () => {
    expect(() => prependChangelogSection('## 1.1.0 - 2026-04-07\n- Existing entry\n', 'section'))
      .toThrow(/must start with "# Changelog"/);
  });

  it('collects manifest referenced paths for smoke checks', () => {
    const manifest = {
      background: { service_worker: 'background/service-worker.js' },
      options_page: 'options/options.html',
      content_scripts: [
        { js: ['content-scripts/a.js', 'content-scripts/b.js'] }
      ],
      web_accessible_resources: [
        { resources: ['data/version-info.json', 'multi-panel/multi-panel.html'] }
      ]
    };

    expect(readManifestReferencedPaths(manifest)).toEqual([
      'background/service-worker.js',
      'content-scripts/a.js',
      'content-scripts/b.js',
      'data/version-info.json',
      'multi-panel/multi-panel.html',
      'options/options.html'
    ]);
  });

  it('normalizes zip entry output', () => {
    expect(normalizeZipEntries('manifest.json\ncontent-scripts/\ncontent-scripts/a.js\n')).toEqual([
      'manifest.json',
      'content-scripts',
      'content-scripts/a.js'
    ]);
  });

  it('fails smoke checks on missing manifest referenced files', () => {
    const manifest = {
      background: { service_worker: 'background/service-worker.js' },
      content_scripts: [{ js: ['content-scripts/a.js'] }],
      web_accessible_resources: [{ resources: ['data/version-info.json'] }]
    };

    expect(() => assertPackageEntries(['manifest.json', 'background/service-worker.js'], manifest))
      .toThrow(/missing manifest-referenced files/);
  });

  it('fails smoke checks on excluded packaged paths', () => {
    const manifest = {
      background: { service_worker: 'background/service-worker.js' },
      content_scripts: [],
      web_accessible_resources: []
    };

    expect(() => assertPackageEntries([
      'manifest.json',
      'background/service-worker.js',
      'tests/focus.e2e.test.js'
    ], manifest)).toThrow(/contains excluded paths/);
  });
});
