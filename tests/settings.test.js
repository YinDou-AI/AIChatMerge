import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSettings,
  getSetting,
  saveSetting,
  saveSettings,
  resetSettings,
  exportSettings,
  importSettings,
} from '../modules/settings.js';
import { DEFAULT_GOOGLE_PROVIDER_MODE } from '../modules/google-mode.js';

describe('settings module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.storage.sync.get.mockImplementation((keys) => Promise.resolve(typeof keys === 'object' ? keys : {}));
    chrome.storage.sync.set.mockResolvedValue();
    chrome.storage.sync.clear.mockResolvedValue();
    chrome.storage.local.get.mockImplementation((keys) => Promise.resolve(typeof keys === 'object' ? keys : {}));
    chrome.storage.local.set.mockResolvedValue();
    chrome.storage.local.clear.mockResolvedValue();
  });

  describe('getSettings', () => {
    it('should return settings from chrome.storage.sync', async () => {
      const mockSettings = {
        enabledProviders: ['chatgpt', 'claude'],
        defaultProvider: 'chatgpt',
        theme: 'dark',
      };

      chrome.storage.sync.get.mockResolvedValue(mockSettings);

      const result = await getSettings();

      expect(result).toEqual(mockSettings);
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    it('should fallback to local storage if sync fails', async () => {
      chrome.storage.sync.get.mockRejectedValue(new Error('Sync unavailable'));
      chrome.storage.local.get.mockResolvedValue({ theme: 'light' });

      const result = await getSettings();

      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it('should expose the default Google provider mode', async () => {
      chrome.storage.sync.get.mockImplementation(async (defaults) => defaults);

      const result = await getSettings();

      expect(result.googleProviderMode).toBe(DEFAULT_GOOGLE_PROVIDER_MODE);
    });
  });

  describe('getSetting', () => {
    it('should return specific setting value', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        theme: 'dark',
        defaultProvider: 'claude',
      });

      const result = await getSetting('theme');

      expect(result).toBe('dark');
    });
  });

  describe('saveSetting', () => {
    it('should save single setting to chrome.storage.sync', async () => {
      await saveSetting('theme', 'dark');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should fallback to local storage if sync fails', async () => {
      chrome.storage.sync.set.mockRejectedValue(new Error('Sync unavailable'));

      await saveSetting('theme', 'dark');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should save the Google provider mode', async () => {
      await saveSetting('googleProviderMode', 'search');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ googleProviderMode: 'search' });
    });
  });

  describe('saveSettings', () => {
    it('should save multiple settings', async () => {
      const settings = {
        theme: 'dark',
        enabledProviders: ['chatgpt'],
      };

      await saveSettings(settings);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(settings);
    });
  });

  describe('resetSettings', () => {
    it('should clear and restore default settings', async () => {
      await resetSettings();

      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledProviders: expect.any(Array),
          googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
          defaultProvider: 'chatgpt',
          theme: 'auto',
        })
      );
    });
  });

  describe('importSettings', () => {
    it('should import valid settings', async () => {
      const settings = {
        theme: 'dark',
        enabledProviders: ['chatgpt', 'claude'],
      };

      const result = await importSettings(settings);

      expect(result.success).toBe(true);
      expect(result.imported).toEqual(['theme', 'enabledProviders']);
      expect(result.skipped).toEqual([]);
    });

    it('should skip invalid setting keys', async () => {
      const settings = {
        theme: 'dark',
        invalidKey: 'value',
      };

      const result = await importSettings(settings);

      expect(result.imported).toEqual(['theme']);
      expect(result.skipped).toEqual(['invalidKey']);
      expect(result.errors).toHaveProperty('invalidKey');
    });
  });

  describe('exportSettings', () => {
    it('should export current settings', async () => {
      const mockSettings = {
        theme: 'dark',
        enabledProviders: ['chatgpt'],
      };

      chrome.storage.sync.get.mockResolvedValue(mockSettings);

      const result = await exportSettings();

      expect(result).toEqual(mockSettings);
    });
  });
});
