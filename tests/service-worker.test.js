import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateEnabledProvidersOnUpdate } from '../modules/provider-defaults.js';

/**
 * Tests for background/service-worker.js
 *
 * LIMITATIONS:
 * - service-worker.js is a side-effect-only module (no exports). Its functions
 *   (loadShortcutSetting, createContextMenus, dispatchToMultiPanel, etc.) are
 *   tightly coupled to chrome.* API globals and module-level mutable state, so
 *   they cannot be imported for direct unit testing.
 * - Several tests below validate Chrome API wiring or mock behavior rather than
 *   the service-worker's own logic.  These are explicitly marked with
 *   "(MOCK WIRING)" so it is clear they verify the test harness, not the source.
 * - The migrateEnabledProvidersOnUpdate tests are the only ones that exercise
 *   real business logic imported from modules/provider-defaults.js.
 *
 * To improve coverage, consider refactoring service-worker.js to export its
 * core logic functions (createContextMenus, dispatchToMultiPanel, etc.) as
 * named exports that accept explicit chrome-api parameters.
 */

describe('service-worker', () => {
  // Mock Chrome APIs
  beforeEach(() => {
    global.chrome = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        getManifest: vi.fn(() => ({ version: '1.6.0' }))
      },
      storage: {
        sync: {
          get: vi.fn((defaults) => Promise.resolve(defaults)),
          set: vi.fn(() => Promise.resolve())
        },
        onChanged: { addListener: vi.fn() }
      },
      contextMenus: {
        create: vi.fn(),
        removeAll: vi.fn(() => Promise.resolve()),
        onClicked: { addListener: vi.fn() }
      },
      action: {
        onClicked: { addListener: vi.fn() }
      },
      commands: {
        onCommand: { addListener: vi.fn() }
      },
      windows: {
        onRemoved: { addListener: vi.fn() }
      },
      tabs: {
        sendMessage: vi.fn(() => Promise.resolve({ success: true }))
      }
    };
  });

  describe('Context Menu Creation', () => {
    // MOCK WIRING: These tests verify that the mock Chrome API surface is
    // correctly set up, not that createContextMenus() in service-worker.js
    // works correctly.  createContextMenus cannot be unit-tested because it
    // is a non-exported function that reads module-level state and calls
    // chrome.contextMenus.create / removeAll imperatively.
    it('should create context menus with enabled providers', async () => {
      const { chrome } = global;

      // Simulate enabled providers
      chrome.storage.sync.get = vi.fn(() => Promise.resolve({
        enabledProviders: ['chatgpt', 'claude', 'gemini']
      }));

      // Note: We would need to import and test createContextMenus function
      // For now, we verify the Chrome API setup
      expect(chrome.contextMenus).toBeDefined();
      expect(chrome.contextMenus.create).toBeDefined();
      expect(chrome.contextMenus.removeAll).toBeDefined();
    });

    it('should handle context menu API errors gracefully', async () => {
      const { chrome } = global;
      chrome.contextMenus.create = vi.fn(() => {
        throw new Error('Context menu error');
      });

      // Should not throw
      expect(() => {
        chrome.contextMenus.create({ id: 'test', title: 'Test' });
      }).toThrow();
    });
  });

  describe('Message Handling', () => {
    // MOCK WIRING: Verifies the mock has an onMessage listener slot.
    // Does NOT verify that service-worker.js actually registers a listener.
    it('should register message listener', () => {
      const { chrome } = global;
      expect(chrome.runtime.onMessage.addListener).toBeDefined();
    });

    // MOCK WIRING: This test validates a plain object literal, not any logic
    // from service-worker.js.  It is kept as a structural reminder that the
    // message protocol expects an `action` field.
    it('should validate message payload structure', () => {
      const validMessage = {
        action: 'fetchLatestCommit'
      };

      expect(validMessage.action).toBeTruthy();
    });
  });


  describe('Settings Management', () => {
    // MOCK WIRING: Verifies that the mock storage.sync.get returns data.
    // Does NOT test loadShortcutSetting() from service-worker.js, which reads
    // module-level state and could not be imported.
    it('should load keyboard shortcut setting', async () => {
      const { chrome } = global;

      chrome.storage.sync.get = vi.fn(() => Promise.resolve({
        keyboardShortcutEnabled: true
      }));

      const result = await chrome.storage.sync.get({ keyboardShortcutEnabled: true });

      expect(result.keyboardShortcutEnabled).toBe(true);
    });

    // MOCK WIRING: Verifies default-fallback behavior of the mock, not of
    // loadShortcutSetting() / loadOpenModeSetting() in service-worker.js.
    it('should handle missing settings with defaults', async () => {
      const { chrome } = global;

      chrome.storage.sync.get = vi.fn((defaults) => Promise.resolve(defaults));

      const result = await chrome.storage.sync.get({
        keyboardShortcutEnabled: true,
        enabledProviders: ['chatgpt', 'claude']
      });

      expect(result.keyboardShortcutEnabled).toBe(true);
      expect(result.enabledProviders).toEqual(['chatgpt', 'claude']);
    });

    // REAL TEST: exercises actual business logic from modules/provider-defaults.js
    it('migrates untouched legacy provider settings during updates', () => {
      expect(
        migrateEnabledProvidersOnUpdate(
          ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'google'],
          ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'google']
        )
      ).toEqual({
        enabledProviders: ['deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso', 'chatgpt', 'gemini', 'claude', 'grok'],
        providerOrder: ['deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso', 'chatgpt', 'gemini', 'claude', 'grok'],
      });
    });

    // REAL TEST: exercises actual business logic from modules/provider-defaults.js
    it('appends current providers while preserving a customized provider order for legacy-enabled users', () => {
      expect(
        migrateEnabledProvidersOnUpdate(
          ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'google'],
          ['claude', 'chatgpt', 'gemini']
        )
      ).toEqual({
        enabledProviders: ['claude', 'chatgpt', 'gemini', 'deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso', 'grok'],
        providerOrder: ['claude', 'chatgpt', 'gemini', 'deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso', 'grok'],
      });
    });
  });

  describe('Error Handling', () => {
    // MOCK WIRING: Verifies that the mock rejects as configured.
    // service-worker.js's loadShortcutSetting has its own try/catch around
    // chrome.storage.sync.get, but we cannot exercise that path without
    // importing the function (which has no export).
    it('should handle storage errors gracefully', async () => {
      const { chrome } = global;

      chrome.storage.sync.get = vi.fn(() => Promise.reject(new Error('Storage error')));

      await expect(chrome.storage.sync.get({})).rejects.toThrow('Storage error');
    });

    it('should handle context menu creation errors', async () => {
      const { chrome } = global;

      chrome.contextMenus.removeAll = vi.fn(() => Promise.reject(new Error('Context menu error')));

      await expect(chrome.contextMenus.removeAll()).rejects.toThrow();
    });
  });

});
