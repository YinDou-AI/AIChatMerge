# Privacy Policy for Panelize

**Last Updated: February 2, 2026**

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

#### Chat History Data
- Conversations you manually save from AI providers
- Original conversation URLs
- Provider information and timestamps

**Purpose:** To allow you to save and revisit important AI conversations.

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
- ❌ AI conversation content (unless you manually save it locally)
- ❌ Login credentials or API keys
- ❌ Any data to external servers or third parties

---

## How We Use Your Data

All data collected by Panelize is used solely for providing extension functionality on your local device:

1. **Prompt Library:** Store and organize your saved prompts for reuse
2. **Chat History:** Save conversations you choose to preserve
3. **Settings:** Remember your preferences between sessions
4. **Quick Access:** Show recently used prompts and maintain provider state

**No data is transmitted to Panelize developers or any third-party servers.**

---

## Third-Party Services

### AI Provider Websites

Panelize loads AI provider websites (ChatGPT, Claude, Gemini, Google AI, Grok, DeepSeek) in iframes within the Panelize multi-panel view. These providers operate under their own privacy policies:

- **ChatGPT/OpenAI:** https://openai.com/policies/privacy-policy
- **Claude/Anthropic:** https://www.anthropic.com/privacy
- **Gemini/Google:** https://policies.google.com/privacy
- **Grok/xAI:** https://x.ai/legal/privacy-policy
- **DeepSeek:** https://www.deepseek.com/privacy-policy

When you interact with these AI providers through Panelize, you are subject to their respective privacy policies. Panelize does not intercept, modify, or access the content of your conversations with these services.

### Cookies and Sessions

Panelize does not read or modify cookies directly. AI provider sites run in their own frames and use their own cookies to maintain login sessions, just like normal browser tabs.

**Important:**
- Panelize does not create, modify, or transmit cookies
- Cookies remain in your browser and are managed by the AI providers
- Panelize does not access cookies via a dedicated cookies permission

---

## Data Storage and Security

### Local Storage Only

All extension data is stored in your browser using:
- **Chrome Storage API:** For settings and preferences
- **IndexedDB:** For prompts and chat history

This data:
- Remains on your device
- Is not accessible to websites you visit
- Is not transmitted over the network
- Is protected by browser security mechanisms

### Data Retention

Data is retained locally until you:
- Manually delete it using extension features (e.g., delete prompts, clear history)
- Use the "Reset All Data" feature in Settings
- Clear browser data (which removes all extension data)
- Uninstall the extension

---

## Your Data Control Rights

You have full control over your data:

### Export Your Data
Go to Settings → Data Management → Export to download all your prompts, chat history, and settings as a JSON file.

### Delete Your Data
- **Individual Items:** Delete specific prompts or conversations
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
| `storage` | Store your prompts, settings, and chat history locally |
| `contextMenus` | Add "Send to Panelize" option when right-clicking |
| `declarativeNetRequest` | Allow AI provider websites to load in Panelize (bypass X-Frame-Options) |
| `declarativeNetRequestWithHostAccess` | Apply header modifications for specific AI provider domains |
| `downloads` | Export prompts and chat history to JSON files |
| Host permissions | Access AI provider websites to load them in Panelize |

**None of these permissions are used to collect, transmit, or share your data with external parties.**

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
- Store your prompts, settings, and saved conversations locally on your device
- Use local browser storage to remember your preferences
- Load AI provider websites in the Panelize multi-panel view (providers manage their own sessions)

❌ **What we don't do:**
- Collect or transmit any data to external servers
- Track your usage or behavior
- Sell or share your data with third parties
- Store your AI conversations (unless you manually save them)
- Require account creation or personal information

**Your privacy is protected because all data stays on your device, under your control.**

---

*This privacy policy is effective as of February 2, 2026 and applies to Panelize version 1.0.0 and later.*
