# Changelog

## 1.1.1 - 2026-04-13
- Fixed: New Chat for All now preserves temporary chat mode for supported providers.
- Fixed: Gemini and Grok temporary or private chat activation no longer toggles off when already active.
- Fixed: Grok private new-chat detection now avoids offscreen controls in narrow layouts.

## 1.1.0 - 2026-04-07
- Added: One-click temporary chat toggle for supported providers in multi-panel. (#39)
- Added: Global Google mode sync with AI/Search mode switching and repeat send/fill fixes. (#37)
- Fixed: Unified input focus retention after `New Chat for All` and `Send All`. (#36, #38)
- Fixed: Focus trap caused by iframe loading state leaking during multi-panel interactions. (#39)

## 1.0.3 - 2026-03-05
- Fixed: Enter key on standalone Gemini page now works correctly (no longer triggers sidebar menu). (#35)
- Fixed: IME composition Enter key sending message prematurely in multi-panel. (#31)
- Docs: Added zh-CN and ja READMEs with updated store link. (#30)

## 1.0.0 - 2026-02-03
- Multi-panel workspace with flexible layouts up to 1x7.
- Unified input bar to send or fill prompts across all panels.
- Prompt library with import/export, tagging, and variable templates.
- Provider management and per-provider Enter key behavior.
- Context menu send with optional local page content extraction.
- Multilingual UI (10 languages).
- Update checks via GitHub.
