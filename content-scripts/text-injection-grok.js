// Text injection handler for Grok
import { setupTextInjectionListener } from './text-injection-handler.js';

// Grok can use textarea, .tiptap, or .ProseMirror
// Send button selectors
const sendButtonSelectors = [
  'button[aria-label="Send"]',
  'button[aria-label="Submit"]',
  'button[type="submit"]',
  'form button:has(svg)'
];

setupTextInjectionListener(['.tiptap', '.ProseMirror', 'textarea'], 'Grok', sendButtonSelectors);
