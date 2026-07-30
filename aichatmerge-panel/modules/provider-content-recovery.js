// Provider content-script recovery used after a confirmed missing listener.
// This is business recovery logic and remains enabled when diagnostics are off.

export async function recoverPanelContentScript(panel) {
  if (panel?.providerId !== 'wenxin') {
    return { success: false, reason: 'unsupported-provider' };
  }
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'recoverProviderContentScript',
      providerId: panel.providerId
    });
    return result && typeof result === 'object'
      ? result
      : { success: false, reason: 'empty-response' };
  } catch (error) {
    return {
      success: false,
      reason: 'runtime-message-failed',
      message: error?.message || String(error)
    };
  }
}
