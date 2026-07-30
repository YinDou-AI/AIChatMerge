/**
 * Default prompt: bar display, prepend to input, skip once, bind events.
 */

import { getAllPrompts } from '../../../modules/prompt-manager.js';
import { showToast } from '../toast.js';
import { getSkipDefaultPromptOnce, setSkipDefaultPromptOnce } from './prompt-state.js';

async function getDefaultPrompt() {
  // The prompt store is IndexedDB-backed and optional. A store failure must never
  // break the core send flow, so degrade to "no default prompt" on any error.
  try {
    const prompts = await getAllPrompts();
    return prompts.find(p => p.isDefault === true);
  } catch (err) {
    console.warn('[DefaultPrompt] Failed to read prompt store, continuing without default prompt:', err);
    return undefined;
  }
}

export async function updateDefaultPromptBar() {
  const bar = document.getElementById('default-prompt-bar');
  const titleSpan = document.getElementById('default-prompt-title');

  if (!bar || !titleSpan) return;

  if (getSkipDefaultPromptOnce()) {
    bar.style.display = 'none';
    return;
  }

  const defaultPrompt = await getDefaultPrompt();
  if (defaultPrompt) {
    titleSpan.textContent = defaultPrompt.title || '';
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

export async function prependDefaultPrompt(userInput) {
  const defaultPrompt = await getDefaultPrompt();
  if (defaultPrompt) {
    const content = String(defaultPrompt.content || '').replace(/\n+$/, '');
    if (!content) return userInput;
    return `${content}\n\n${userInput}`;
  }
  return userInput;
}

export function bindDefaultPromptEvents() {
  const skipBtn = document.getElementById('skip-default-prompt-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      setSkipDefaultPromptOnce(true);
      updateDefaultPromptBar();
      showToast('本次发送将跳过默认提示词', { type: 'info', duration: 2000 });
    });
  }
}

export async function sendMessageWithDefaultPrompt(inputValue, broadcastMessage, autoSubmit = true, mergeSessionId = null) {
  let text = inputValue;
  if (!getSkipDefaultPromptOnce()) {
    text = await prependDefaultPrompt(text);
  }
  setSkipDefaultPromptOnce(false);
  broadcastMessage(text, autoSubmit, mergeSessionId);
  await updateDefaultPromptBar();
}
