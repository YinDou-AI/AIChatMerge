// T073: Version Check Module
// Checks for updates by comparing manifest version with GitHub

import { t } from './i18n.js';

const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/Manho/Panelize/main/manifest.json';

/**
 * Load local manifest version
 * @returns {Promise<Object>} {version, manifest}
 */
export async function loadVersionInfo() {
  try {
    const manifest = chrome.runtime.getManifest();
    return {
      version: manifest.version,
      manifest: manifest
    };
  } catch (error) {
    console.error('Error loading manifest:', error);
    return null;
  }
}

/**
 * Fetch latest manifest from GitHub
 * @returns {Promise<Object|null>} Latest manifest or null on error
 */
export async function fetchLatestManifest() {
  try {
    const response = await fetch(GITHUB_MANIFEST_URL, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub fetch error: ${response.status}`);
    }

    const manifest = await response.json();
    return manifest;
  } catch (error) {
    console.error('Error fetching latest manifest:', error);
    return null;
  }
}

/**
 * Compare two version strings (e.g., "1.0.0" vs "1.1.0")
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {number} -1 if current < latest, 0 if equal, 1 if current > latest
 */
function compareVersions(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  const maxLength = Math.max(currentParts.length, latestParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (currentPart < latestPart) return -1;
    if (currentPart > latestPart) return 1;
  }
  
  return 0;
}

/**
 * Check if an update is available
 * @returns {Promise<Object>} Update status
 */
export async function checkForUpdates() {
  const localInfo = await loadVersionInfo();
  if (!localInfo) {
    return {
      updateAvailable: false,
      error: t('errVersionInfoFailed')
    };
  }

  const latestManifest = await fetchLatestManifest();
  if (!latestManifest) {
    return {
      updateAvailable: false,
      currentVersion: localInfo.version,
      error: t('errGitHubFetchFailed')
    };
  }

  const comparison = compareVersions(localInfo.version, latestManifest.version);
  const updateAvailable = comparison < 0;

  return {
    updateAvailable,
    currentVersion: localInfo.version,
    latestVersion: latestManifest.version,
    error: null
  };
}

/**
 * Get the download URL for the latest version
 * @returns {string} GitHub zip download URL
 */
export function getDownloadUrl() {
  return 'https://github.com/Manho/Panelize/archive/refs/heads/main.zip';
}

/**
 * Get the GitHub repository URL
 * @returns {string} GitHub repository URL
 */
export function getRepositoryUrl() {
  return 'https://github.com/Manho/Panelize';
}
