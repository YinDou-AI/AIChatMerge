// 文心一言 Enter/Shift+Enter behavior swap
function handleEnterSwap(event) {
  if (!event.isTrusted || event.code !== "Enter" || event.isComposing) {
    return;
  }
  if (!enterKeyConfig || !enterKeyConfig.enabled) {
    return;
  }
  const activeElement = document.activeElement;
  if (!activeElement) return;

  const isInput = activeElement.isContentEditable ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.getAttribute('data-slate-editor') === 'true';

  if (!isInput) return;

  if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    // Find and click send button
    const sendBtn = document.querySelector('button[type="submit"]') ||
      document.querySelector('button[aria-label*="发送"]') ||
      document.querySelector('button[aria-label*="Send"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    }
  }
}
applyEnterSwapSetting();
