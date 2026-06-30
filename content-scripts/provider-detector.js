/**
 * ProviderDetector — 统一的 AI Provider 检测模块
 *
 * 消除三处重复的 detectProvider 实现:
 *   1. text-injection-all-providers.js
 *   2. sse-bridge.js
 *   3. sse-detect.js
 *
 * 提供两种检测模式:
 *   - detect(): 过滤 Claude 工具 iframe（isolated-segment 等），用于主逻辑
 *   - detectSimple(): 不过滤，用于 SSE 检测等场景
 *
 * 必须在 content_scripts 注入列表中排在最前面，早于其他脚本加载。
 */

(function () {
  'use strict';

  // 防止重复注入
  if (window.__provider_detector_loaded__) return;
  window.__provider_detector_loaded__ = true;

  /**
   * Provider 模式匹配配置
   *
   * hostPatterns: 用于 hostname.includes() 匹配的字符串数组
   * excludePaths: 当 pathname 匹配此正则时，detect() 返回 null（用于过滤工具 iframe）
   *
   * 修复说明（对比旧版）:
   * - 'google' 改为 'gemini'，仅匹配 gemini.google.com，避免误匹配其他 google 页面
   * - 'kimi' 的 moonshot 改为 moonshot.cn，避免 moonshot-test.com 误匹配
   * - 'wenxin' 移除短串 'wenxin'，仅保留 chat.baidu.com
   * - 'yuanbao' 移除短串 'yuanbao'，仅保留 yuanbao.tencent.com
   */
  const PROVIDER_PATTERNS = [
    {
      name: 'chatgpt',
      hostPatterns: ['chatgpt.com', 'openai.com'],
      excludePaths: null
    },
    {
      name: 'claude',
      hostPatterns: ['claude.ai'],
      excludePaths: /isolated|segment|embed|widget|frame\.html|extension|sandbox/i
    },
    {
      name: 'gemini',
      hostPatterns: ['gemini.google.com'],
      excludePaths: null
    },
    {
      name: 'grok',
      hostPatterns: ['grok.com'],
      excludePaths: null
    },
    {
      name: 'deepseek',
      hostPatterns: ['deepseek.com'],
      excludePaths: null
    },
    {
      name: 'kimi',
      hostPatterns: ['kimi.com', 'moonshot.cn'],
      excludePaths: null
    },
    {
      name: 'doubao',
      hostPatterns: ['doubao.com'],
      excludePaths: null
    },
    {
      name: 'qianwen',
      hostPatterns: ['qianwen.com'],
      excludePaths: null
    },
    {
      name: 'zhipu',
      hostPatterns: ['chatglm.cn'],
      excludePaths: null
    },
    {
      name: 'wenxin',
      hostPatterns: ['chat.baidu.com'],
      excludePaths: null
    },
    {
      name: 'yuanbao',
      hostPatterns: ['yuanbao.tencent.com'],
      excludePaths: null
    },
    {
      name: 'metaso',
      hostPatterns: ['metaso.cn'],
      excludePaths: null
    },
    {
      name: 'google',
      hostPatterns: ['google.com', 'google.'],
      excludePaths: null
    }
  ];

  /**
   * 检测当前页面的 AI Provider
   *
   * @param {Object} [options]
   * @param {boolean} [options.filterUtilityFrames=true] - 是否过滤 Claude 工具 iframe
   * @returns {string|null} Provider 名称，未匹配返回 null
   *
   * @example
   * const provider = ProviderDetector.detect();
   * if (provider === 'chatgpt') { ... }
   */
  function detect(options) {
    const { filterUtilityFrames = true } = options || {};
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    for (const pattern of PROVIDER_PATTERNS) {
      const hostMatch = pattern.hostPatterns.some(function (h) {
        return hostname.includes(h);
      });
      if (!hostMatch) continue;

      // Claude 工具 iframe 过滤
      if (filterUtilityFrames && pattern.excludePaths) {
        if (pattern.excludePaths.test(pathname)) {
          return null;
        }
      }
      return pattern.name;
    }
    return null;
  }

  /**
   * 简化检测 — 不过滤工具 iframe
   * 用于 SSE 检测等不需要过滤 iframe 的场景
   *
   * @returns {string|null} Provider 名称，未匹配返回 null
   */
  function detectSimple() {
    return detect({ filterUtilityFrames: false });
  }

  /**
   * 获取所有已配置的 Provider 模式列表（只读）
   * 用于调试或配置验证
   *
   * @returns {Array} Provider 模式配置数组的副本
   */
  function getPatterns() {
    return PROVIDER_PATTERNS.slice();
  }

  // 挂载到 window 对象，供所有 content script 访问
  window.ProviderDetector = {
    detect: detect,
    detectSimple: detectSimple,
    getPatterns: getPatterns
  };

})();
