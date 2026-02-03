# Privacy Policy for Panelize

**Last Updated: February 3, 2026**

## Overview

Panelize is committed to protecting your privacy. This privacy policy explains what data the extension collects, how it's used, and your control over it.

**In short:** Panelize stores all data locally on your device. We do not collect, transmit, or sell any of your personal information to third parties or external servers.

---

## What Data We Collect and Store

### 1. Data Stored Locally on Your Device

All of the following data is stored **exclusively in your browser's local storage** and never leaves your device:

#### Prompt Library Data
- Prompt titles, content, categories, and tags you create
- Favorites and usage statistics for prompts
- Imported prompt libraries

**Purpose:** To provide prompt management functionality across browser sessions.

#### User Preferences and Settings
- Selected theme (Light/Dark/Auto)
- Enabled AI providers
- Default AI provider
- Keyboard shortcut preferences
- Enter key behavior preferences
- Source URL placement preferences
- Language preferences

**Purpose:** To maintain your personalized extension configuration.

#### Usage Metadata
- Last opened provider
- Prompt usage counts
- Recently used prompts

**Purpose:** To improve user experience with relevant suggestions and quick access.

### 2. Data We Do NOT Collect

Panelize does **NOT** collect, store, or transmit:

- ❌ Personal identification information
- ❌ Browsing history
- ❌ IP addresses
- ❌ Analytics or telemetry data
- ❌ Usage statistics sent to external servers
- ❌ AI conversation content
- ❌ Login credentials or API keys
- ❌ Any data to external servers or third parties

---

## How We Use Your Data

All data collected by Panelize is used solely for providing extension functionality on your local device:

1. **Prompt Library:** Store and organize your saved prompts for reuse
2. **Settings:** Remember your preferences between sessions
3. **Quick Access:** Show recently used prompts and maintain provider state
4. **Context Menu Send:** When you use the right-click menu without selecting text, Panelize temporarily extracts page content locally to format the prompt you send. This content is not stored and is only sent to the AI provider you choose.

**No data is transmitted to Panelize developers or any third-party servers.**

---

## Third-Party Services

### AI Provider Websites

Panelize loads AI provider websites (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, and Google AI Mode) inside embedded panels. These providers operate under their own privacy policies.

When you interact with these AI providers through Panelize, you are subject to their respective privacy policies. Panelize does not intercept or store the content of your conversations with these services.

### Cookie Access

Panelize does not access cookie data directly and does not use the cookies API. Provider websites may use your existing browser session cookies when they load inside panels, just like in a normal tab.

### Update Checks

Panelize can check for updates by requesting version information from GitHub (api.github.com and raw.githubusercontent.com). These requests are made only to GitHub and do not include your prompts, settings, or any content you send to AI providers.

### UI Assets

Panelize loads the Material Symbols font from Google Fonts for UI icons. This request is made directly to Google Fonts.

---

## Data Storage and Security

### Local Storage Only

All extension data is stored in your browser using:
- **Chrome Storage API:** For settings and preferences
- **IndexedDB:** For prompts

This data:
- Remains on your device
- Is not accessible to websites you visit
- Is not transmitted over the network
- Is protected by browser security mechanisms

### Data Retention

Data is retained locally until you:
- Manually delete it using extension features (e.g., delete prompts)
- Use the "Reset All Data" feature in Settings
- Clear browser data (which removes all extension data)
- Uninstall the extension

---

## Your Data Control Rights

You have full control over your data:

### Export Your Data
Go to Settings → Data Management → Export to download all your prompts and settings as a JSON file.

### Delete Your Data
- **Individual Items:** Delete specific prompts
- **Category/Provider:** Clear all data from a specific category or provider
- **Complete Reset:** Settings → Data Management → Reset All Data

### No Account Required
Panelize does not require creating an account. All functionality works without registration, login, or providing any personal information.

---

## Children's Privacy

Panelize does not knowingly collect any information from children under 13. The extension is designed for general use and does not target children. If you are under 13, please do not use this extension without parental supervision.

---

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this document. Continued use of Panelize after changes constitutes acceptance of the updated policy.

Significant changes will be announced via:
- GitHub repository changelog
- Extension update notes (if applicable)

---

## Permissions Explained

Panelize requests the following Chrome extension permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Store your prompts and settings locally |
| `contextMenus` | Add "Send to Panelize" option when right-clicking |
| `declarativeNetRequest` | Allow AI provider websites to load in embedded panels (bypass X-Frame-Options) |
| `declarativeNetRequestWithHostAccess` | Apply header modifications for specific AI provider domains |
| Host permissions | Access AI provider websites, and check for updates on GitHub |

**None of these permissions are used to collect, transmit, or share your data with external parties.**

Panelize also exposes a small set of bundled, non-user resources (such as default prompt libraries and UI assets) as web-accessible so content scripts can load them. These resources contain no personal data.

---

## Open Source Transparency

Panelize is fully open source. You can review the complete source code at:

**GitHub Repository:** https://github.com/Manho/Panelize

This allows you to:
- Verify our privacy claims
- Audit the code for security
- Understand exactly what the extension does
- Contribute improvements or report issues

---

## Contact Information

If you have questions or concerns about this privacy policy or how Panelize handles data:

- **GitHub Issues:** https://github.com/Manho/Panelize/issues
- **Project Maintainer:** [Xiaolai](https://github.com/xiaolai)

---

## Compliance

### GDPR (European Users)

If you are in the European Economic Area (EEA):
- You have the right to access, correct, or delete your data (all stored locally and under your control)
- You have the right to data portability (use the Export feature)
- You can withdraw consent at any time (uninstall the extension or reset data)

### CCPA (California Users)

If you are a California resident:
- We do not sell your personal information
- We do not share personal information with third parties for marketing
- You have the right to request deletion of your data (use Reset All Data feature)

---

## Summary

✅ **What we do:**
- Store your prompts and settings locally on your device
- Use local browser storage to remember your preferences
- Temporarily process selected text or page content on-device when you use the context menu
- Load AI provider websites inside embedded panels
- Check for updates on GitHub

❌ **What we don't do:**
- Send your prompts or settings to Panelize servers
- Track your usage or behavior
- Sell or share your data with third parties
- Access your AI conversations
- Require account creation or personal information

**Your privacy is protected because all data stays on your device, under your control.**

---

*This privacy policy is effective as of February 3, 2026 and applies to Panelize version 1.0.0 and later.*
