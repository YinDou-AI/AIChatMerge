# AIChatMerge

<p align="center">
  <a href="README.md"><strong>English</strong></a> |
  <a href="README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img src="assets/screenshots/PixPin_2026-06-30_14-00-42.jpg" alt="AIChatMerge - All Your AI Assistants. One Window." width="700">
</p>

<p align="center">
  <strong>Stop switching tabs. Start comparing AI responses side by side.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/languages-2-brightgreen.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Chrome-114+-4285F4.svg" alt="Chrome">
  <img src="https://img.shields.io/badge/Edge-114+-0078D7.svg" alt="Edge">
</p>

---

## Why AIChatMerge?

Ever found yourself copying the same prompt across multiple AI tabs just to compare answers? AIChatMerge eliminates that workflow entirely.

**One window. One prompt. Multiple AI responses — then merge the best answer automatically.**

<p align="center">
  <img src="assets/screenshots/PixPin_2026-06-30_14-13-19.jpg" alt="AIChatMerge Main Interface" width="800">
</p>

---

## Features at a Glance

### 🎯 Ask Once, Compare All

Type your question once and send it to your selected providers simultaneously. See which AI gives you the best answer—no tab switching required.

### 📐 Flexible Layouts

Choose from 5 different layouts (1×1, 1×2, 1×3, 1×4, 1×5) to fit your workflow. Need a quick 2-way comparison? Use 1×2. Deep research across 4 models? Try 1×4. The choice is yours.

<p align="center">
  <img src="assets/screenshots/PixPin_2026-06-30_12-31-44.jpg" alt="Discussion Mode" width="600">
</p>

### 🔀 Auto-Merge & Discussion

After all providers respond, AIChatMerge can automatically merge their answers into a single best response. You can also enter Discussion mode to continue refining the result with any provider.

### 📝 Markdown Export

Export merged results or individual conversations as Markdown files for easy sharing and archival.

### ⚡ Zero Setup

No API keys. No configuration. Just log into your AI accounts normally, and AIChatMerge uses those existing sessions. If you can use ChatGPT in a browser tab, you can use it in AIChatMerge.

### 📚 Prompt Library

Save your best prompts and reuse them across all providers. Supports variables like `{topic}` for quick customization.

### 🔒 Privacy First

- One-click privacy mode across supported providers
- AIChatMerge does not send your data to any AIChatMerge-owned server
- Prompts you submit go directly to the AI provider you select; each provider handles data according to its own privacy policy
- No tracking, no analytics, no data collection
- Open source—review the code yourself

### 🛠️ Developer-Friendly

- Custom entry URL support for Claude
- Focused Chinese & English UI

---

## Supported AI Providers

<table align="center">
  <tr>
    <td align="center"><strong>DeepSeek</strong></td>
    <td align="center"><strong>Kimi</strong></td>
    <td align="center"><strong>Doubao</strong></td>
    <td align="center"><strong>Qianwen</strong></td>
  </tr>
  <tr>
    <td align="center"><strong>Zhipu Qingyan</strong></td>
    <td align="center"><strong>Wenxin Yiyan</strong></td>
    <td align="center"><strong>Yuanbao</strong></td>
    <td align="center"><strong>Metaso AI</strong></td>
  </tr>
  <tr>
    <td align="center"><strong>ChatGPT</strong></td>
    <td align="center"><strong>Gemini</strong></td>
    <td align="center"><strong>Claude</strong></td>
    <td align="center"><strong>Grok</strong></td>
  </tr>
</table>

<p align="center">
  <img src="assets/screenshots/PixPin_2026-06-30_11-53-50.jpg" alt="Merge Result" width="700">
</p>

---

## Installation

<details>
<summary><strong>Manual Installation</strong></summary>

1. Download the source code from the official GitHub repository
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extracted folder

</details>

---

## Quick Start

1. **Log into your AI accounts** — Visit ChatGPT, Claude, etc. and log in as usual
2. **Press `Cmd/Ctrl + Shift + E`** — Opens the AIChatMerge window
3. **Pick a layout** — Choose how many AI panels you want
4. **Type and send** — Your prompt goes to all panels at once

That's it. No accounts to create, no API keys to configure.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open AIChatMerge | `Cmd/Ctrl + Shift + E` |
| Open Prompt Library | `Cmd/Ctrl + Shift + L` |

Customize shortcuts at `chrome://extensions/shortcuts`

---

## Troubleshooting

**AI provider shows login page?**
→ Log into that provider in a regular browser tab first, then refresh AIChatMerge.

**Shortcuts not working?**
→ Check for conflicts at `chrome://extensions/shortcuts`

**Need more help?**
→ [Open an issue](https://github.com/YinDou-AI/AIChatMerge/issues)

---

## Known Limitations

- You must log into each AI platform yourself before using it in AIChatMerge.
- Some AI platforms may restrict iframe embedding, limit available models, or have login/state issues within embedded panels.
- Claude's default entry URL may become unavailable. You can configure a custom page URL in Advanced Settings.
- Overseas AI platforms (ChatGPT, Gemini, Claude, Grok) may be affected by your network environment.
- Auto-merge relies on webpage state detection. In rare cases, you may need to trigger a manual merge.

---

## Contributing

Found a bug? Have an idea? Contributions are welcome:

- 🐛 Report bugs via [GitHub Issues](https://github.com/YinDou-AI/AIChatMerge/issues)
- 💡 Suggest features
- 🔧 Submit pull requests

---

## License

MIT License — see [LICENSE](LICENSE) for details.

### Third-Party Licenses

This project includes the following third-party libraries:

| Library | License | Source |
|---------|---------|--------|
| [Readability.js](https://github.com/mozilla/readability) | Apache License 2.0 | Mozilla / Arc90 Inc |

Readability.js is used in `libs/Readability.js` for extracting main content from web pages. Licensed under the Apache License, Version 2.0.

### Acknowledgments

AIChatMerge is based on [Panelize](https://github.com/Manho/Panelize), an MIT-licensed open-source project by the Panelize contributors.

---

<p align="center">
  <strong>Open source & privacy-focused</strong><br>
  Available in Chinese and English
</p>

<p align="center">
  <sub>Made for everyone who's tired of tab-switching between AI assistants.</sub>
</p>
