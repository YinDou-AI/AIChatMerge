/**
 * Layout controls: layout modal, scroll arrows, layout switching.
 * Extracted from event-handlers.js for domain separation.
 */

import { getCurrentLayout } from './state.js';

export function openLayoutModal() {
  document.getElementById('layout-modal').style.display = 'flex';
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === getCurrentLayout());
  });
}

export function closeLayoutModal() {
  document.getElementById('layout-modal').style.display = 'none';
}
