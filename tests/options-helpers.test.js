// Tests for options page pure helper functions
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentBrowserLanguage,
  isEdgeBrowser,
  getExtensionResourceUrl,
  getPromptGuidePath,
  formatClaudeEntryUrlForDisplay,
  getDefaultLibraryPath,
  validatePromptStructure,
  getPromptStructureExample
} from '../options/options-helpers.js';

describe('options-helpers module', () => {
  describe('getCurrentBrowserLanguage', () => {
    it('should return zh_CN for Chinese browser language', () => {
      // Mock navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'zh-CN',
        writable: true,
        configurable: true
      });

      expect(getCurrentBrowserLanguage()).toBe('zh_CN');
    });

    it('should return zh_CN for zh-TW', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'zh-TW',
        writable: true,
        configurable: true
      });

      expect(getCurrentBrowserLanguage()).toBe('zh_CN');
    });

    it('should return en for English', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        writable: true,
        configurable: true
      });

      expect(getCurrentBrowserLanguage()).toBe('en');
    });

    it('should return en for other languages', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'ja-JP',
        writable: true,
        configurable: true
      });

      expect(getCurrentBrowserLanguage()).toBe('en');
    });
  });

  describe('isEdgeBrowser', () => {
    it('should return true for Edge browser (userAgentData)', () => {
      Object.defineProperty(navigator, 'userAgentData', {
        value: {
          brands: [
            { brand: 'Microsoft Edge', version: '100.0' },
            { brand: 'Chromium', version: '100.0' }
          ]
        },
        writable: true,
        configurable: true
      });

      expect(isEdgeBrowser()).toBe(true);
    });

    it('should return true for Edge browser (userAgent string)', () => {
      Object.defineProperty(navigator, 'userAgentData', {
        value: null,
        writable: true,
        configurable: true
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36 Edg/100.0.1185.39',
        writable: true,
        configurable: true
      });

      expect(isEdgeBrowser()).toBe(true);
    });

    it('should return false for Chrome browser', () => {
      Object.defineProperty(navigator, 'userAgentData', {
        value: {
          brands: [
            { brand: 'Google Chrome', version: '100.0' },
            { brand: 'Chromium', version: '100.0' }
          ]
        },
        writable: true,
        configurable: true
      });

      expect(isEdgeBrowser()).toBe(false);
    });

    it('should return false for Firefox', () => {
      Object.defineProperty(navigator, 'userAgentData', {
        value: null,
        writable: true,
        configurable: true
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0',
        writable: true,
        configurable: true
      });

      expect(isEdgeBrowser()).toBe(false);
    });
  });

  describe('getExtensionResourceUrl', () => {
    it('should use chrome.runtime.getURL when available', () => {
      const path = 'data/prompt-libraries/guide.en.html';
      const result = getExtensionResourceUrl(path);

      expect(chrome.runtime.getURL).toHaveBeenCalledWith(path);
      expect(result).toBe('chrome-extension://test-extension/data/prompt-libraries/guide.en.html');
    });

    it('should fallback to window.location.origin when chrome not available', () => {
      // Save original chrome
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const path = 'test.html';
      const result = getExtensionResourceUrl(path);

      // Should use window.location.origin
      expect(result).toContain(path);

      // Restore chrome
      global.chrome = originalChrome;
    });
  });

  describe('getPromptGuidePath', () => {
    it('should return Chinese guide path for zh_CN', () => {
      const result = getPromptGuidePath('zh_CN');
      expect(result).toBe('data/prompt-libraries/guide.zh_CN.html');
    });

    it('should return English guide path for en', () => {
      const result = getPromptGuidePath('en');
      expect(result).toBe('data/prompt-libraries/guide.en.html');
    });

    it('should fallback to English for unknown locale', () => {
      const result = getPromptGuidePath('ja');
      expect(result).toBe('data/prompt-libraries/guide.en.html');
    });
  });

  describe('formatClaudeEntryUrlForDisplay', () => {
    it('should return default status for empty URL', () => {
      const result = formatClaudeEntryUrlForDisplay('');
      expect(result).toBe('Using default Claude URL');
    });

    it('should return default status for null URL', () => {
      const result = formatClaudeEntryUrlForDisplay(null);
      expect(result).toBe('Using default Claude URL');
    });

    it('should format valid URL correctly', () => {
      const url = 'https://claude.ai/chat';
      const result = formatClaudeEntryUrlForDisplay(url);
      expect(result).toContain('claude.ai');
      expect(result).toContain('/chat');
    });

    it('should truncate long path', () => {
      const url = 'https://claude.ai/very/long/path/that/is/definitely/longer/than/sixteen/characters';
      const result = formatClaudeEntryUrlForDisplay(url);
      expect(result).toContain('claude.ai');
      expect(result).toContain('…');
    });

    it('should handle invalid URL gracefully', () => {
      const result = formatClaudeEntryUrlForDisplay('not-a-url');
      expect(result).toBe('Custom: Claude');
    });
  });

  describe('getDefaultLibraryPath', () => {
    it('should return Chinese prompts for zh_CN', () => {
      const result = getDefaultLibraryPath('zh_CN');
      expect(result).toBe('data/prompt-libraries/default-prompts-zh_CN.json');
    });

    it('should return English prompts for en', () => {
      const result = getDefaultLibraryPath('en');
      expect(result).toBe('data/prompt-libraries/default-prompts.json');
    });

    it('should return English prompts for zh_TW (Traditional Chinese)', () => {
      const result = getDefaultLibraryPath('zh_TW');
      expect(result).toBe('data/prompt-libraries/default-prompts.json');
    });

    it('should return English prompts for unknown language', () => {
      const result = getDefaultLibraryPath('ja');
      expect(result).toBe('data/prompt-libraries/default-prompts.json');
    });
  });

  describe('validatePromptStructure', () => {
    it('should return empty array for valid prompt', () => {
      const validPrompt = {
        title: 'Test Prompt',
        content: 'This is test content',
        category: 'Testing',
        tags: ['test', 'example'],
        variables: ['var1'],
        isFavorite: false,
        useCount: 0,
        lastUsed: null
      };

      const errors = validatePromptStructure(validPrompt);
      expect(errors).toEqual([]);
    });

    it('should return error for missing title', () => {
      const prompt = {
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: []
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('Missing or invalid "title" (string)');
    });

    it('should return error for non-string title', () => {
      const prompt = {
        title: 123,
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: []
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('Missing or invalid "title" (string)');
    });

    it('should return error for missing content', () => {
      const prompt = {
        title: 'Title',
        category: 'Category',
        tags: [],
        variables: []
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('Missing or invalid "content" (string)');
    });

    it('should return error for missing category', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        tags: [],
        variables: []
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('Missing or invalid "category" (string)');
    });

    it('should return error for non-array tags', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: 'not-array',
        variables: []
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('"tags" must be an array of strings');
    });

    it('should return error for non-array variables', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: 'not-array'
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('"variables" must be an array');
    });

    it('should return error for non-boolean isFavorite', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: [],
        isFavorite: 'yes'
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('"isFavorite" should be boolean');
    });

    it('should return error for non-number useCount', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: [],
        useCount: 'zero'
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('"useCount" should be number');
    });

    it('should return error for invalid lastUsed', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: [],
        lastUsed: 'invalid'
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).toContainEqual('"lastUsed" should be number or null');
    });

    it('should allow null lastUsed', () => {
      const prompt = {
        title: 'Title',
        content: 'Content',
        category: 'Category',
        tags: [],
        variables: [],
        lastUsed: null
      };

      const errors = validatePromptStructure(prompt);
      expect(errors).not.toContainEqual('"lastUsed" should be number or null');
    });

    it('should return multiple errors for invalid prompt', () => {
      const invalidPrompt = {};

      const errors = validatePromptStructure(invalidPrompt);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getPromptStructureExample', () => {
    it('should return a string', () => {
      const result = getPromptStructureExample();
      expect(typeof result).toBe('string');
    });

    it('should contain required fields', () => {
      const result = getPromptStructureExample();
      expect(result).toContain('title');
      expect(result).toContain('content');
      expect(result).toContain('category');
      expect(result).toContain('tags');
      expect(result).toContain('variables');
    });

    it('should contain optional fields', () => {
      const result = getPromptStructureExample();
      expect(result).toContain('isFavorite');
      expect(result).toContain('useCount');
      expect(result).toContain('lastUsed');
    });
  });
});
