import { describe, it, expect, vi, beforeEach } from 'vitest';

import { updateToggleButton } from '../aichatmerge-panel/modules/panel-header-actions.js';

describe('toggle button state bridge', () => {
  let btn, icon;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="toggle-open-mode-btn" title="">
        <span class="material-symbols-outlined"></span>
      </button>
    `;
    btn = document.getElementById('toggle-open-mode-btn');
    icon = btn.querySelector('.material-symbols-outlined');
  });

  it('should show tab icon and popup title when isPopupWindow is true', () => {
    updateToggleButton(true);
    expect(icon.dataset.icon).toBe('tab');
    expect(btn.title).toBeTruthy();
  });

  it('should show open_in_new icon and tab title when isPopupWindow is false', () => {
    updateToggleButton(false);
    expect(icon.dataset.icon).toBe('open_in_new');
    expect(btn.title).toBeTruthy();
  });

  it('should update correctly when called multiple times with different values', () => {
    updateToggleButton(true);
    expect(icon.dataset.icon).toBe('tab');

    updateToggleButton(false);
    expect(icon.dataset.icon).toBe('open_in_new');

    updateToggleButton(true);
    expect(icon.dataset.icon).toBe('tab');
  });

  it('should not throw when button does not exist', () => {
    document.body.innerHTML = '';
    expect(() => updateToggleButton(true)).not.toThrow();
    expect(() => updateToggleButton(false)).not.toThrow();
  });
});
