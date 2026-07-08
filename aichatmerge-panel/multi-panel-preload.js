(function() {
  try {
    function normalizeMaterialIcon(el) {
      if (!el || !el.classList || !el.classList.contains('material-symbols-outlined')) return;
      if (!el.dataset.icon) {
        var iconName = (el.textContent || '').trim();
        if (iconName) el.dataset.icon = iconName;
      }
      el.classList.add('notranslate');
      el.setAttribute('translate', 'no');
      el.setAttribute('aria-hidden', 'true');
      el.textContent = '';
    }

    function normalizeMaterialIcons(root) {
      var scope = root && root.querySelectorAll ? root : document;
      if (scope.classList && scope.classList.contains('material-symbols-outlined')) {
        normalizeMaterialIcon(scope);
      }
      scope.querySelectorAll?.('.material-symbols-outlined').forEach(normalizeMaterialIcon);
    }

    function normalizeBrandText(root) {
      var brandNames = ['DeepSeek', 'Kimi', 'ChatGPT', 'Gemini', 'Claude', 'Grok'];
      var scope = root && root.querySelectorAll ? root : document;
      var elements = [];
      if (scope.nodeType === Node.ELEMENT_NODE) elements.push(scope);
      scope.querySelectorAll?.('span, button, option').forEach(function(el) { elements.push(el); });
      elements.forEach(function(el) {
        var text = (el.textContent || '').trim();
        if (brandNames.some(function(name) { return text === name || text.startsWith(name + '('); })) {
          el.classList.add('notranslate');
          el.setAttribute('translate', 'no');
        }
      });
    }

    function normalizeUiText(root) {
      normalizeMaterialIcons(root);
      normalizeBrandText(root);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        normalizeUiText(document);
      }, { once: true });
    } else {
      normalizeUiText(document);
    }

    new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) normalizeUiText(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.sync.get({ theme: 'auto', language: null }, function(s) {
      var t = s.theme;
      if (t === 'auto') t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);

      var lang = s.language;
      if (!lang) {
        try { lang = chrome.i18n.getUILanguage(); } catch(e) { lang = navigator.language || 'en'; }
      }
      var isZh = lang.startsWith('zh');

      var translations = {
        zh: {
          prevPage: '上一页', nextPage: '下一页',
          promptLibrary: '提示词库',
          inputPlaceholder: '输入你的问题，同时发送给所有AI...',
          sendToAllAI: '发送给所有AI', mergeTooltip: '融合总结：收集所有回答并发送给目标 AI 融合',
          mergeTargetAI: '融合目标 AI',
          addPanel: '添加面板', newChat: '全部新建对话', layout: '切换布局',
          switchToPopupMode: '弹窗模式', settings: '设置',
          selectLayout: '选择布局', singlePanel: '单面板', twoPanels: '两面板',
          threePanels: '三面板', fourPanels: '四面板', fivePanels: '五面板',
          promptLibraryTitle: '提示词库', newPrompt: '新建提示词',
          searchPrompts: '搜索提示词...', allCategories: '所有分类',
          showFavoritesOnly: '仅显示收藏', recentUsed: '最近使用',
          newPromptTitle: '新建提示词', title: '标题', titlePlaceholder: '输入提示词标题...',
          content: '内容', contentPlaceholder: '输入提示词内容... 使用 {variable} 作为变量',
          category: '分类', categoryPlaceholder: '例如：写作、编程、调研',
          tags: '标签（逗号分隔）', tagsPlaceholder: '例如：写作、创意、博客',
          delete: '删除', cancel: '取消', save: '保存',
          fillVariables: '填写变量', variableInstruction: '此提示词包含变量，请填写：', apply: '应用'
        },
        en: {
          prevPage: 'Previous page', nextPage: 'Next page',
          promptLibrary: 'Prompt Library',
          inputPlaceholder: 'Enter your question to send to all AIs...',
          sendToAllAI: 'Send to all AIs', mergeTooltip: 'Merge: collect all answers and send to target AI for fusion',
          mergeTargetAI: 'Merge Target AI',
          addPanel: 'Add Panel', newChat: 'New Chat', layout: 'Layout',
          switchToPopupMode: 'Popup Mode', settings: 'Settings',
          selectLayout: 'Select Layout', singlePanel: 'Single Panel', twoPanels: 'Two Panels',
          threePanels: 'Three Panels', fourPanels: 'Four Panels', fivePanels: 'Five Panels',
          promptLibraryTitle: 'Prompt Library', newPrompt: 'New Prompt',
          searchPrompts: 'Search prompts...', allCategories: 'All Categories',
          showFavoritesOnly: 'Show Favorites Only', recentUsed: 'Recently Used',
          newPromptTitle: 'New Prompt', title: 'Title', titlePlaceholder: 'Enter prompt title...',
          content: 'Content', contentPlaceholder: 'Enter prompt content... Use {variable} as variables',
          category: 'Category', categoryPlaceholder: 'e.g.: Writing, Programming, Research',
          tags: 'Tags (comma separated)', tagsPlaceholder: 'e.g.: Writing, Creative, Blog',
          delete: 'Delete', cancel: 'Cancel', save: 'Save',
          fillVariables: 'Fill Variables', variableInstruction: 'This prompt contains variables, please fill in:', apply: 'Apply'
        }
      };
      var dict = isZh ? translations.zh : translations.en;

      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-title');
        if (dict[key]) el.setAttribute('title', dict[key]);
      });
    });
  } catch(e) {}
})();
