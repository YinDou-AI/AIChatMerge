import { describe, it, expect } from 'vitest';

describe('panel boot', () => {
  it('module graph evaluates without throwing', async () => {
    document.body.innerHTML = `
      <div id="app"><div id="panel-grid"></div>
      <textarea id="unified-input"></textarea></div>`;
    const mod = await import('../aichatmerge-panel/modules/iframe-comm.js');
    expect(mod).toBeTruthy();
    await import('../aichatmerge-panel/modules/panel-lifecycle.js');
    await import('../aichatmerge-panel/modules/event-handlers.js');
    await import('../aichatmerge-panel/modules/merge-engine.js');
    await import('../aichatmerge-panel/modules/prompting/index.js');
  });
});
