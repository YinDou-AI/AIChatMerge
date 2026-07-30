# manifest.json 校验结果

## 状态：✅ 通过

## 校验项
| 项目 | 结果 |
|------|------|
| JSON语法 | ✅ 合法 |
| 必填字段 | ✅ manifest_version=3, name, version 均存在 |
| manifest_version | ✅ 为 3（Manifest V3） |
| permissions | ✅ 全部为有效权限名 |
| background.service_worker | ✅ `background/service-worker.js` 存在 |
| content_scripts matches | ✅ 格式正确（https:// + 域名 + /*） |
| options_page | ✅ `options/options.html` 存在 |
| icons | ✅ 16/32/48/128 四个尺寸均存在 |
| 废弃字段 | ✅ 使用 `action`，无 `browser_action` |
| declarative_net_request | ✅ `rules/bypass-headers.json` 存在 |
| web_accessible_resources | ✅ 所有引用文件均存在 |
| content_security_policy | ✅ MV3 格式正确（extension_pages） |
| _locales | ✅ en/zh_CN/zh_TW 均有 messages.json |

## 权限名验证
| 权限 | 有效性 |
|------|--------|
| storage | ✅ |
| contextMenus | ✅ |
| activeTab | ✅ |
| scripting | ✅ |
| declarativeNetRequest | ✅ |
| declarativeNetRequestWithHostAccess | ✅ |

## 文件路径验证
### background
- `background/service-worker.js` ✅

### options
- `options/options.html` ✅

### icons
- `icons/icon-16.png` ✅
- `icons/icon-32.png` ✅
- `icons/icon-48.png` ✅
- `icons/icon-128.png` ✅

### content-scripts（所有引用的 JS 文件）
- `provider-detector.js` ✅
- `sse-bridge.js` ✅
- `button-finder-utils.js` ✅
- `send-button-finder.js` ✅
- `enter-behavior-utils.js` ✅
- `enter-behavior-qianwen.js` ✅
- `enter-behavior-zhipu.js` ✅
- `enter-behavior-wenxin.js` ✅
- `enter-behavior-yuanbao.js` ✅
- `enter-behavior-metaso.js` ✅
- `enter-behavior-deepseek.js` ✅
- `enter-behavior-kimi.js` ✅
- `enter-behavior-doubao.js` ✅
- `enter-behavior-chatgpt.js` ✅
- `enter-behavior-gemini.js` ✅
- `enter-behavior-claude.js` ✅
- `answer-extractor-qianwen.js` ✅
- `answer-extractor-zhipu.js` ✅
- `answer-extractor-wenxin.js` ✅
- `answer-extractor-yuanbao.js` ✅
- `answer-extractor-metaso.js` ✅
- `answer-extractor-deepseek.js` ✅
- `answer-extractor-kimi.js` ✅
- `answer-extractor-doubao.js` ✅
- `answer-extractor-chatgpt.js` ✅
- `answer-extractor-gemini.js` ✅
- `answer-extractor-claude.js` ✅
- `answer-extractor-grok.js` ✅
- `text-injection-all-providers.js` ✅
- `focus-toggle.js` ✅

### rules
- `rules/bypass-headers.json` ✅

### web_accessible_resources
- `multi-panel/multi-panel.html` ✅
- `multi-panel/multi-panel.js` ✅
- `multi-panel/multi-panel.css` ✅
- `sse-detect.js` ✅
- `data/prompt-libraries/default-prompts.json` ✅
- `data/prompt-libraries/default-prompts-zh_CN.json` ✅
- `data/prompt-libraries/custom-prompt-template.json` ✅
- `data/prompt-libraries/guide.en.html` ✅
- `data/prompt-libraries/guide.zh_CN.html` ✅
- `data/version-info.json` ✅
- `_locales/en/messages.json` ✅
- `_locales/zh_CN/messages.json` ✅
- `_locales/zh_TW/messages.json` ✅

## 问题列表
无问题。manifest.json 校验通过。
