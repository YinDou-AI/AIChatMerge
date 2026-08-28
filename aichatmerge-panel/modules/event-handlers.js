/**
 * event-handlers.js — compatibility layer (transitional).
 *
 * Only re-exports setupEventListeners for multi-panel.js.
 * All domain modules are imported directly by their consumers:
 *   - panel-ui-bindings.js  (DOM event registration)
 *   - panel-menus.js        (provider switcher, merge target, add panel)
 *   - layout-controls.js    (layout modal, scroll arrows)
 *   - markdown-export.js    (markdown export domain)
 */

export { setupEventListeners } from './panel-ui-bindings.js';
