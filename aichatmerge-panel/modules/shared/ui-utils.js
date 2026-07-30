/**
 * Shared UI utility functions.
 * Used across multiple modules in the panel system.
 */

/**
 * Auto-fit a <select> element's width to its currently selected option text.
 * Uses a hidden probe span to measure text width, then applies padding + border.
 * @param {HTMLSelectElement} select
 */
export function fitPanelSelectWidth(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  const text = select.options[select.selectedIndex]?.textContent || select.value || '';
  const probe = document.createElement('span');
  const cs = window.getComputedStyle(select);
  probe.textContent = text;
  Object.assign(probe.style, {
    position: 'absolute', visibility: 'hidden', whiteSpace: 'pre',
    font: cs.font, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing
  });
  document.body.appendChild(probe);
  const w = Math.ceil(probe.getBoundingClientRect().width);
  probe.remove();
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const border = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  select.style.width = `${Math.max(72, Math.ceil(w + pad + border + 6))}px`;
}
