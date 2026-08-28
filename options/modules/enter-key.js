/**
 * Enter Key Behavior Module
 *
 * Manages enter key behavior settings including:
 * - Visibility toggles for enter behavior settings
 * - Loading/saving custom modifier settings
 * - Applying preset configurations (default, swapped, slack, discord)
 */

import { getSettings, saveSetting } from '../../modules/settings.js';
import { t } from '../../modules/i18n.js';
import { showStatus } from './ui-helpers.js';

/**
 * Show/hide the enter behavior settings section
 * @param {boolean} enabled - Whether enter behavior is enabled
 */
export function updateEnterBehaviorVisibility(enabled) {
  const settingsDiv = document.getElementById('enter-behavior-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}

/**
 * Show/hide the custom enter settings panel
 * @param {string} preset - Current preset value ('custom' shows the panel)
 */
export function updateCustomEnterSettingsVisibility(preset) {
  const customDiv = document.getElementById('custom-enter-settings');
  if (customDiv) {
    customDiv.style.display = preset === 'custom' ? 'block' : 'none';
  }
}

/**
 * Load custom enter settings from config into UI checkboxes
 * @param {Object} enterBehavior - The enterKeyBehavior settings object
 */
export function loadCustomEnterSettings(enterBehavior) {
  // Load newline modifiers
  const newlineIds = ['shift', 'ctrl', 'alt', 'meta'];
  newlineIds.forEach(id => {
    const el = document.getElementById(`newline-${id}`);
    if (el) el.checked = enterBehavior.newlineModifiers?.[id] || false;
  });

  // Load send modifiers
  const sendIds = ['shift', 'ctrl', 'alt', 'meta'];
  sendIds.forEach(id => {
    const el = document.getElementById(`send-${id}`);
    if (el) el.checked = enterBehavior.sendModifiers?.[id] || false;
  });
}

/**
 * Apply an enter key preset (default, swapped, slack, discord)
 * @param {string} preset - The preset name to apply
 */
export async function applyEnterKeyPreset(preset) {
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || {};

  enterBehavior.preset = preset;

  // Define preset configurations
  const presets = {
    default: {
      newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
    },
    swapped: {
      newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: true, ctrl: false, alt: false, meta: false }
    },
    slack: {
      newlineModifiers: { shift: false, ctrl: true, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
    },
    discord: {
      newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: true, alt: false, meta: false }
    }
  };

  if (preset !== 'custom' && presets[preset]) {
    enterBehavior.newlineModifiers = presets[preset].newlineModifiers;
    enterBehavior.sendModifiers = presets[preset].sendModifiers;
    loadCustomEnterSettings(enterBehavior);
  }

  await saveSetting('enterKeyBehavior', enterBehavior);
  showStatus('success', t('msgPresetChanged', preset));
}

/**
 * Save custom enter settings from UI checkboxes to storage
 */
export async function saveCustomEnterSettings() {
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || {};

  enterBehavior.preset = 'custom';
  enterBehavior.newlineModifiers = {
    shift: document.getElementById('newline-shift')?.checked ?? false,
    ctrl: document.getElementById('newline-ctrl')?.checked ?? false,
    alt: document.getElementById('newline-alt')?.checked ?? false,
    meta: document.getElementById('newline-meta')?.checked ?? false
  };
  enterBehavior.sendModifiers = {
    shift: document.getElementById('send-shift')?.checked ?? false,
    ctrl: document.getElementById('send-ctrl')?.checked ?? false,
    alt: document.getElementById('send-alt')?.checked ?? false,
    meta: document.getElementById('send-meta')?.checked ?? false
  };

  await saveSetting('enterKeyBehavior', enterBehavior);

  // Update preset dropdown to show custom
  const presetSelect = document.getElementById('enter-preset-select');
  if (presetSelect) {
    presetSelect.value = 'custom';
  }

  showStatus('success', t('msgCustomKeyMappingSaved'));
}
