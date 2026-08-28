# Contributing to AIChatMerge

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Google Chrome or Microsoft Edge (Chromium-based)

### Local Development

1. **Clone the repository**

```bash
git clone https://github.com/YinDou-AI/AIChatMerge.git
cd AIChatMerge
```

2. **Install dependencies**

```bash
npm install
```

3. **Load the extension in Chrome**

- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the project root directory

4. **Load the extension in Edge**

- Go to `edge://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the project root directory

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
npm run lint
```

This runs `web-ext lint` to check for common extension issues.

## Project Structure

```
AIChatMerge/
├── manifest.json              # Extension manifest (Manifest V3)
├── background/
│   └── service-worker.js      # Background service worker
├── content-scripts/           # Content scripts injected into AI pages
│   ├── provider-detector.js   # Detects which AI provider is active
│   ├── sse-bridge.js          # SSE completion detection bridge
│   ├── button-finder-utils.js # Send button detection
│   ├── send-button-finder.js  # Send button click logic
│   ├── text-injection-all-providers.js  # Unified text injection
│   ├── enter-behavior-*.js    # Per-provider Enter key behavior
│   └── answer-extractor-*.js  # Per-provider answer extraction
├── aichatmerge-panel/         # Multi-panel UI
│   ├── multi-panel.html       # Panel page
│   ├── multi-panel.js         # Panel logic
│   └── multi-panel.css        # Panel styles
├── modules/                   # Shared modules
│   ├── settings.js            # Settings management
│   └── obsidian-export.js     # Markdown export/download compatibility module
├── options/                   # Settings page
│   ├── options.html
│   └── options.js
├── _locales/                  # i18n (en, zh_CN)
├── icons/                     # Extension icons
├── libs/                      # Third-party libraries
├── data/                      # Static data files
└── tests/                     # Test files
```

## How to Add a New AI Provider

AIChatMerge supports 12 AI providers. To add a new one:

### 1. Add host permission

In `manifest.json`, add the new provider's domain to `host_permissions`:

```json
"host_permissions": [
  "*://new-provider.com/*"
]
```

### 2. Add content scripts

Create two files in `content-scripts/`:

- **`enter-behavior-{provider}.js`** — Handle Enter key behavior (some providers use Slate editors, others use textarea)
- **`answer-extractor-{provider}.js`** — Extract the AI's response from the page DOM

Add a new `content_scripts` entry in `manifest.json`:

```json
{
  "matches": ["https://new-provider.com/*"],
  "js": [
    "content-scripts/provider-detector.js",
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/send-button-finder.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-{provider}.js",
    "content-scripts/answer-extractor-{provider}.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

### 3. Add web accessible resource

Add the new domain to `web_accessible_resources.matches` in `manifest.json`.

### 4. Add bypass headers rule

Add the new domain to `rules/bypass-headers.json` to allow iframe embedding.

### 5. Test

- Load the extension
- Log into the new provider
- Open AIChatMerge multi-panel
- Select the new provider
- Send a prompt and verify the response is extracted correctly

## Submitting Changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new provider XYZ`
- `fix: resolve answer extraction issue on Kimi`
- `docs: update contributing guide`
- `chore: update dependencies`

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Commit with a clear message
7. Push and create a Pull Request

### PR Description

Include:
- What the change does
- Which providers are affected (if any)
- How to test the change
- Screenshots (for UI changes)

## Reporting Bugs

Open an issue with:

- **Browser version** (Chrome/Edge + version)
- **AI provider** affected
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Console errors** (if any)

**Do NOT include:** Cookies, session tokens, API keys, or full page URLs.

## Code Style

- Use ES modules (`import`/`export`)
- Follow existing naming conventions (`kebab-case` for files, `camelCase` for variables)
- Keep content scripts focused — each provider has its own extractor and behavior file
- Shared utilities go in `*-utils.js` files

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
