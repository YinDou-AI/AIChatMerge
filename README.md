# Panelize

> Compare AI chatbots side-by-side. ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Copilot, Perplexity, Google AI Mode—all in one window.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Languages](https://img.shields.io/badge/languages-10-brightgreen.svg)

**Compare multiple AI assistants simultaneously without juggling tabs.** Open a dedicated window, choose your layout, and chat with 1-8 AI providers at once with synchronized input.

---

## Quick Navigation

- [Features](#features)
- [Installation](#installation)
  - [Chrome Web Store (Recommended)](#chrome-web-store-recommended)
  - [Manual Installation (Advanced)](#manual-installation-advanced)
- [Supported AI Providers](#supported-ai-providers)
- [How to Use](#how-to-use)
- [Privacy & Security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [Support & Contributing](#support--contributing)

---

## Features

### Multi-Panel Layout

Use 1-8 AI chatbots side-by-side with flexible grid layouts:
- 1×1 to 1×7 (single row)
- 2×1 to 2×4 (two rows)
- 3×1 to 3×2 (three rows)

Each panel runs independently, so you can compare responses from different AI providers to the same question.

### Synced Input

Type once, send to all panels simultaneously. The unified input bar at the bottom lets you:
- Send the same prompt to all active AI providers at once
- Compare how different AIs respond to identical queries
- Save time when researching or fact-checking

### 9 AI Providers

Access ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Copilot, Perplexity, and Google AI Mode—all from one window.

### Prompt Library

Save, organize, and reuse your best prompts across any AI provider.

- **Categories & Tags**: Organize prompts for easy discovery
- **Variables Support**: Create dynamic templates with `{placeholders}` for quick customization
- **Search & Filter**: Find prompts instantly by keyword or favorite status
- **Import/Export**: Share prompt libraries or back up your collection

### Keyboard Shortcuts

- **`Cmd/Ctrl+Shift+E`**: Open Panelize window
- **`Cmd/Ctrl+Shift+L`**: Access prompt library
- **Customizable Enter Behavior**: Configure Enter vs Shift+Enter for each AI provider

### Your Preferences, Your Way

**Theme Customization**
Auto-detect system theme or set Light/Dark mode manually

**Language Support**
Available in 10 languages: English, Chinese (Simplified & Traditional), Japanese, Korean, Spanish, French, German, Italian, and Russian

**Provider Management**
Enable only the AI providers you use. Customize which ones appear in your panels.

### Privacy First

- **No API keys required**—uses your existing browser logins
- **All data stays local** in your browser's storage
- **Zero tracking, zero analytics**—we don't collect anything
- **Fully open source**—review the code before installing

---

## Installation

### Chrome Web Store (Recommended)

**One-click installation. Automatic updates. No developer mode needed.**

1. Visit the Chrome Web Store page (link coming soon)
2. Click **"Add to Chrome"**
3. Click **"Add Extension"** in the popup
4. Done! Click the extension icon or press `Cmd/Ctrl+Shift+E`

**Also works on Microsoft Edge:** Install from Chrome Web Store using Edge browser.

---

### Manual Installation (Advanced)

**For developers or users who prefer manual control.**

<details>
<summary><b>Click to expand: Manual installation instructions</b></summary>

#### Chrome Installation

1. **Download** the source code from this repository (Code → Download ZIP)
2. **Extract** the ZIP file to a permanent location
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable** "Developer mode" using the toggle in the top right corner
5. **Click** "Load unpacked" button
6. **Select** the extracted folder containing `manifest.json`
7. **Done!** The extension icon appears in your toolbar

#### Microsoft Edge Installation

1. **Download and extract** the ZIP file (same as Chrome step 1-2)
2. **Open Edge** and navigate to `edge://extensions/`
3. **Enable** "Developer mode" in the left menu
4. **Click** "Load unpacked" button
5. **Select** the extracted folder
6. **Done!**

</details>

---

## Supported AI Providers

| Provider | Website |
|----------|---------|
| **ChatGPT** | https://chatgpt.com |
| **Claude** | https://claude.ai |
| **Gemini** | https://gemini.google.com |
| **Grok** | https://grok.com |
| **DeepSeek** | https://chat.deepseek.com |
| **Kimi** | https://www.kimi.com |
| **Copilot** | https://copilot.microsoft.com |
| **Perplexity** | https://www.perplexity.ai |
| **Google AI Mode** | https://www.google.com (AI Mode) |

**No API keys required.** Just log into the providers you want to use in your browser, and Panelize will use those existing sessions.

---

## How to Use

### Getting Started

1. **Log into your AI providers**
   Visit the websites of the AI providers you want to use (ChatGPT, Claude, etc.) and log in normally. The extension uses these existing sessions.

2. **Open Panelize**
   Click the extension icon in your toolbar, or press `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux).

3. **Choose your layout**
   Select how many panels you want (1-8) and arrange them in your preferred grid layout.

4. **Select providers for each panel**
   Click on each panel to choose which AI provider it should display.

5. **Start comparing**
   Use the unified input bar at the bottom to send the same prompt to all panels simultaneously, or interact with each panel individually.

### Opening Panelize

- **Keyboard shortcut:** `Cmd/Ctrl+Shift+E`
- **Extension icon:** Click the icon in your browser toolbar
- **Right-click menu:** Right-click on any webpage → choose a provider to send selected text

### Using the Prompt Library

Press `Cmd/Ctrl+Shift+L` to open the Prompt Library.

**Create a prompt:**
Click "New Prompt", enter a title, content, and optional category/tags. Use `{variable}` syntax for dynamic placeholders.

**Use a prompt:**
Click any prompt to insert it. If it contains variables, you'll be prompted to fill them in.

### Customizing Keyboard Shortcuts

**Chrome:** Navigate to `chrome://extensions/shortcuts`
**Edge:** Navigate to `edge://extensions/shortcuts`

Find "Panelize" in the list and customize your shortcuts.
After installing, you may need to confirm or assign shortcuts here before they work.

---

## Privacy & Security

**Your data stays local.** Prompts and settings are stored in your browser's local storage. Panelize does not send your prompts or settings to its own servers. It may connect to GitHub for update checks and to Google Fonts for UI icons.

**No API keys required.** The extension uses your existing browser login sessions. It loads the real AI websites in iframes—just like opening them in new tabs.

**No tracking.** The extension doesn't collect analytics, usage data, or any personal information.

**How it works technically:** The extension uses Chrome's `declarativeNetRequest` API to bypass X-Frame-Options headers, allowing AI provider websites to load in panel iframes. All code is open source and available for review.

---

## Troubleshooting

### Extension Issues

**The extension won't load**
Make sure you're using a recent version of Chrome (114+) or Edge (114+).

**Extension icon doesn't appear in toolbar**
Click the puzzle piece icon in Chrome/Edge toolbar and pin "Panelize" to make it always visible.

### AI Provider Issues

**An AI provider won't load in a panel**
1. Visit that provider's website in a regular browser tab and log in
2. The extension needs an active login session to work
3. If still not working, try clearing your browser cache and cookies for that specific provider

**Provider loads but shows login page**
Your session may have expired. Open the provider in a regular tab, log in again, then refresh Panelize.

### Feature Issues

**Keyboard shortcuts don't work**
1. Check if another extension is using the same shortcut
2. Go to `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`)
3. Change Panelize shortcuts if there are conflicts

**Synced input not working**
Make sure the panels have fully loaded before using the unified input bar.

---

## Support & Contributing

### Found a Bug or Have a Feature Idea?

- **Open an issue**: [GitHub Issues](https://github.com/YOUR_USERNAME/panelize/issues)

### Contributing

Contributions are welcome! Whether it's:
- Reporting bugs
- Suggesting features
- Improving documentation
- Translating to new languages
- Submitting pull requests

---

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

**Open source & privacy-focused** • Available in 10 languages
