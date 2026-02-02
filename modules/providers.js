export const PROVIDERS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    icon: '/icons/providers/chatgpt.png',
    iconDark: '/icons/providers/dark/chatgpt.png',
    enabled: true
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    icon: '/icons/providers/claude.png',
    iconDark: '/icons/providers/dark/claude.png',
    enabled: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    icon: '/icons/providers/gemini.png',
    iconDark: '/icons/providers/dark/gemini.png',
    enabled: true
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    icon: '/icons/providers/grok.png',
    iconDark: '/icons/providers/dark/grok.png',
    enabled: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    icon: '/icons/providers/deepseek.png',
    iconDark: '/icons/providers/dark/deepseek.png',
    enabled: true
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com',
    icon: '/icons/providers/kimi.png',
    iconDark: '/icons/providers/dark/kimi.png',
    enabled: true
  },
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?udm=50',
    icon: '/icons/providers/google.png',
    iconDark: '/icons/providers/dark/google.png',
    enabled: true
  }
];

export function getProviderById(id) {
  return PROVIDERS.find(p => p.id === id);
}

export async function getProviderByIdWithSettings(id) {
  const provider = PROVIDERS.find(p => p.id === id);
  if (!provider) return null;

  return provider;
}

export async function getEnabledProviders() {
  let settings = {
    enabledProviders: ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'google'],
    providerOrder: null
  };
  
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      settings = await chrome.storage.sync.get(settings);
    }
  } catch (error) {
    console.warn('Failed to load provider settings, using defaults');
  }

  // Filter enabled providers
  let enabledProviders = PROVIDERS.filter(p => settings.enabledProviders.includes(p.id));

  // Sort by custom order if available
  if (settings.providerOrder && Array.isArray(settings.providerOrder)) {
    enabledProviders.sort((a, b) => {
      const indexA = settings.providerOrder.indexOf(a.id);
      const indexB = settings.providerOrder.indexOf(b.id);
      // If not in order array, put at the end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  return enabledProviders;
}
