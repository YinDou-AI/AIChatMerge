// Shared SSE completion policy for content scripts.
(function () {
  'use strict';

  if (window.ACM_SSE_COMPLETION_POLICY) return;

  const layers = {
    deepseek: ['content'],
    doubao: ['content'],
    qianwen: [],
    yuanbao: ['content'],
    wenxin: ['content'],
    zhipu: [],
    kimi: [],
    chatgpt: ['content'],
    claude: ['content'],
    gemini: [],
    grok: [],
    metaso: []
  };

  function getLayers(provider) {
    return layers[provider] || [];
  }

  window.ACM_SSE_COMPLETION_POLICY = Object.freeze({
    layers,
    accepts(provider, layer) {
      return getLayers(provider).includes(layer);
    },
    supportedProviders() {
      return Object.keys(layers).filter(provider => getLayers(provider).includes('content'));
    }
  });
})();
