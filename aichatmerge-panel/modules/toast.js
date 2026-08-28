// toast.js — Lightweight toast notification system
// Extracted from event-handlers.js to avoid circular dependencies

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, options = {}) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  const { duration = 3000, type = 'info', actions = [] } = options;

  const colors = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3',
    warning: '#ff9800'
  };

  toast.style.cssText = `padding:10px 16px;border-radius:6px;color:white;font-size:13px;pointer-events:auto;opacity:0;transition:opacity 0.3s;box-shadow:0 2px 8px rgba(0,0,0,0.2);background:${colors[type] || colors.info};max-width:300px;word-break:break-word;display:flex;align-items:center;gap:12px;`;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (actions.length > 0) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = 'background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;';
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.35)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.2)'; });
      btn.addEventListener('click', (e) => { e.stopPropagation(); toast.remove(); if (typeof action.onClick === 'function') action.onClick(); });
      toast.appendChild(btn);
    });
  }

  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  if (actions.length === 0) {
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}
