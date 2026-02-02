const DEFAULT_SETTINGS = {
  enabledProviders: ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'google'],
  providerOrder: null,
  defaultProvider: 'chatgpt',
  lastSelectedProvider: 'chatgpt',
  rememberLastProvider: true,  // When true, Panelize opens last selected provider; when false, always opens default provider
  theme: 'auto',
  language: null,
  keyboardShortcutEnabled: true,
  openMode: 'tab',  // 'tab' or 'popup'
  enterKeyBehavior: {
    enabled: true,
    preset: 'default',  // 'default', 'swapped', 'slack', 'discord', 'custom'
    newlineKey: 'Enter',
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendKey: 'Enter',
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
  }
};

export async function getSettings() {
  // Check if chrome API is available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('Chrome API not available, using default settings');
    return { ...DEFAULT_SETTINGS };
  }
  
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return result;
  } catch (error) {
    console.warn('chrome.storage.sync unavailable, using local', error);
    try {
      return await chrome.storage.local.get(DEFAULT_SETTINGS);
    } catch (localError) {
      console.warn('chrome.storage.local also unavailable, using defaults');
      return { ...DEFAULT_SETTINGS };
    }
  }
}

export async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

function isChromeApiAvailable() {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

export async function saveSetting(key, value) {
  if (!isChromeApiAvailable()) {
    console.warn('Chrome API not available, cannot save setting');
    return;
  }
  
  const update = { [key]: value };
  try {
    await chrome.storage.sync.set(update);
  } catch (error) {
    console.warn('chrome.storage.sync unavailable, using local', error);
    try {
      await chrome.storage.local.set(update);
    } catch (localError) {
      console.warn('chrome.storage.local also unavailable');
    }
  }
}

export async function saveSettings(settings) {
  if (!isChromeApiAvailable()) {
    console.warn('Chrome API not available, cannot save settings');
    return;
  }
  
  try {
    await chrome.storage.sync.set(settings);
  } catch (error) {
    console.warn('chrome.storage.sync unavailable, using local', error);
    try {
      await chrome.storage.local.set(settings);
    } catch (localError) {
      console.warn('chrome.storage.local also unavailable');
    }
  }
}

export async function resetSettings() {
  if (!isChromeApiAvailable()) {
    console.warn('Chrome API not available, cannot reset settings');
    return;
  }
  
  try {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  } catch (error) {
    console.warn('chrome.storage.sync unavailable, using local', error);
    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(DEFAULT_SETTINGS);
    } catch (localError) {
      console.warn('chrome.storage.local also unavailable');
    }
  }
}

export async function exportSettings() {
  return await getSettings();
}

export async function importSettings(settings) {
  // Validate settings
  const validKeys = Object.keys(DEFAULT_SETTINGS);
  const imported = {};
  const skipped = [];
  const errors = {};

  for (const [key, value] of Object.entries(settings)) {
    if (validKeys.includes(key)) {
      imported[key] = value;
    } else {
      skipped.push(key);
      errors[key] = 'Setting key not recognized';
    }
  }

  await saveSettings(imported);

  return {
    success: true,
    imported: Object.keys(imported),
    skipped,
    errors
  };
}
