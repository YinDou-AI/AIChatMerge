/**
 * Panel i18n — self-contained translation system for the multi-panel UI.
 *
 * WHY A SEPARATE SYSTEM?
 * The multi-panel page runs inside an iframe (content script context) where
 * the Chrome i18n API (chrome.i18n.getMessage) is NOT available. This module
 * provides a lightweight, standalone t() function with an embedded zh/en
 * dictionary so the panel UI works regardless of execution context.
 *
 * SCOPE: Used ONLY by aichatmerge-panel/ (multi-panel.html and its modules).
 * For extension pages that DO have Chrome API access (options, popup, etc.),
 * use modules/i18n.js instead, which reads from locale message JSON files.
 */
const I18N = {
  zh: {
    sendAll: '发送',
    merge: '融合',
    copy: '复制',
    addPanel: '添加面板',
    newChat: '新建对话',
    layout: '布局',
    settings: '设置',
    mergeTarget: '融合目标',
    switchToPopupMode: '弹窗模式',
    switchToTabMode: '标签页模式',
    switchToPopupModeTitle: '切换到弹窗模式',
    switchToTabModeTitle: '切换到标签页模式',
    inputPlaceholder: '输入你的问题，同时发送给所有AI...',
    promptLibrary: '提示词库',
    sendToAllAI: '发送给所有AI',
    mergeTooltip: '融合总结：收集所有回答并发送给目标 AI 融合',
    mergeTargetAI: '融合目标 AI',
    mergeTimeoutTooltip: '超时触发，可在设置中调整等待时间',
    copyLink: '复制链接',
    refresh: '刷新',
    home: '回到首页',
    maximize: '放大',
    restore: '还原',
    switchProvider: '切换提供商',
    close: '关闭',
    prevPage: '上一页',
    nextPage: '下一页',
    selectLayout: '选择布局',
    singlePanel: '单面板',
    twoPanels: '两面板',
    threePanels: '三面板',
    fourPanels: '四面板',
    fivePanels: '五面板',
    promptLibraryTitle: '提示词库',
    newPrompt: '新建提示词',
    searchPrompts: '搜索提示词...',
    allCategories: '所有分类',
    showFavoritesOnly: '仅显示收藏',
    recentUsed: '最近使用',
    noMatchingPrompts: '没有匹配的提示词',
    noPrompts: '暂无提示词',
    failedToLoadPrompts: '加载提示词失败',
    editPrompt: '编辑提示词',
    newPromptTitle: '新建提示词',
    title: '标题',
    titlePlaceholder: '输入提示词标题...',
    content: '内容',
    contentPlaceholder: '输入提示词内容... 使用 {variable} 作为变量',
    category: '分类',
    categoryPlaceholder: '例如：写作、编程、调研',
    tags: '标签（逗号分隔）',
    tagsPlaceholder: '例如：写作、创意、博客',
    delete: '删除',
    cancel: '取消',
    save: '保存',
    fillVariables: '填写变量',
    variableInstruction: '此提示词包含变量，请填写：',
    apply: '应用',
    minOnePanel: '至少需要保留一个面板',
    clearedAllInputs: '已清空所有输入',
    newChatCreated: '已为所有AI创建新对话',
    panelNewChatCreated: '已为当前面板创建新对话',
    promptSaved: '提示词保存成功',
    promptUpdated: '提示词更新成功',
    promptDeleted: '提示词已删除',
    promptSaveFailed: '保存提示词失败',
    promptDeleteFailed: '删除提示词失败',
    promptLoadFailed: '加载提示词失败',
    titleContentRequired: '标题和内容为必填项',
    confirmDeletePrompt: '确定要删除这个提示词吗？',
    loadingProvider: '加载 $1 中...',
    providerLoadFailed: '$1 加载失败',
    allAIAnswered: '所有AI回答完成，开始融合',
    waitTimeout: '等待超时，开始融合',
    claudeEntryWarning: 'Claude 入口异常时，可在高级设置中填写备用页面网址。',
    openSettings: '高级设置',
    dismiss: '暂时关闭',
    sending: '发送中...',
    filling: '填入中...',
    sentToAI: '已发送',
    filledToInput: '已填入',
    sentToPartial: '已发送',
    filledPartial: '已填入',
    sendFailed: '发送失败',
    fillFailed: '填入失败',
    errorOccurred: '发生错误',
    addedBadge: '已添加',
    varInputPlaceholder: '输入 $1 的值',
    clickToRetry: '点击重试',
    retrying: '正在重试...',
    autoMerge: '自动融合',
    timeoutMerge: '超时融合',
    manualMerge: '手动融合',
    obsidianExport: '导出 Markdown',
    obsidianExporting: '正在导出 Markdown...',
    obsidianExportSuccess: '已导出 Markdown: $1',
    obsidianExportFailed: '导出 Markdown 失败: $1',
    debugDownloadLogs: '下载调试日志',
    debugLogsDownloaded: '调试日志已下载',
    debugLogsEmpty: '暂无调试日志',
    discussionProgress: '讨论中',
    discussionProgressInitial: '讨论中',
    stopDiscussion: '停止讨论',
    msgDiscussionStopped: '讨论已停止',
    defaultPromptEnabled: '已启用',
    skipDefaultPrompt: '跳过',
    setDefaultPrompt: '设为默认',
    cancelDefaultPrompt: '取消默认',
  },
  en: {
    sendAll: 'Send All',
    merge: 'Merge',
    copy: 'Copy',
    addPanel: 'Add Panel',
    newChat: 'New Chat',
    layout: 'Layout',
    settings: 'Settings',
    mergeTarget: 'Merge Target',
    switchToPopupMode: 'Popup Mode',
    switchToTabMode: 'Tab Mode',
    switchToPopupModeTitle: 'Switch to popup mode',
    switchToTabModeTitle: 'Switch to tab mode',
    inputPlaceholder: 'Enter your question to send to all AIs...',
    promptLibrary: 'Prompt Library',
    sendToAllAI: 'Send to all AIs',
    mergeTooltip: 'Merge: collect all answers and send to target AI for fusion',
    mergeTargetAI: 'Merge Target AI',
    mergeTimeoutTooltip: 'Timeout triggered. Adjust wait time in settings.',
    copyLink: 'Copy Link',
    refresh: 'Refresh',
    home: 'Home',
    maximize: 'Maximize',
    restore: 'Restore',
    switchProvider: 'Switch Provider',
    close: 'Close',
    prevPage: 'Previous Page',
    nextPage: 'Next Page',
    selectLayout: 'Select Layout',
    singlePanel: 'Single Panel',
    twoPanels: 'Two Panels',
    threePanels: 'Three Panels',
    fourPanels: 'Four Panels',
    fivePanels: 'Five Panels',
    promptLibraryTitle: 'Prompt Library',
    newPrompt: 'New Prompt',
    searchPrompts: 'Search prompts...',
    allCategories: 'All Categories',
    showFavoritesOnly: 'Show Favorites Only',
    recentUsed: 'Recently Used',
    noMatchingPrompts: 'No matching prompts',
    noPrompts: 'No prompts yet',
    failedToLoadPrompts: 'Failed to load prompts',
    editPrompt: 'Edit Prompt',
    newPromptTitle: 'New Prompt',
    title: 'Title',
    titlePlaceholder: 'Enter prompt title...',
    content: 'Content',
    contentPlaceholder: 'Enter prompt content... Use {variable} for variables',
    category: 'Category',
    categoryPlaceholder: 'e.g. Writing, Coding, Research',
    tags: 'Tags (comma separated)',
    tagsPlaceholder: 'e.g. Writing, Creative, Blog',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    fillVariables: 'Fill Variables',
    variableInstruction: 'This prompt contains variables, please fill in:',
    apply: 'Apply',
    minOnePanel: 'At least one panel is required',
    clearedAllInputs: 'All inputs cleared',
    newChatCreated: 'New chat created for all AIs',
    panelNewChatCreated: 'New chat created for this panel',
    promptSaved: 'Prompt saved successfully',
    promptUpdated: 'Prompt updated successfully',
    promptDeleted: 'Prompt deleted',
    promptSaveFailed: 'Failed to save prompt',
    promptDeleteFailed: 'Failed to delete prompt',
    promptLoadFailed: 'Failed to load prompt',
    titleContentRequired: 'Title and content are required',
    confirmDeletePrompt: 'Are you sure you want to delete this prompt?',
    loadingProvider: 'Loading $1...',
    providerLoadFailed: '$1 failed to load',
    allAIAnswered: 'All AIs answered, starting merge',
    waitTimeout: 'Wait timeout, starting merge',
    claudeEntryWarning: 'Claude uses the new-chat page by default. If it still fails, set a fallback page URL in Advanced Settings.',
    openSettings: 'Advanced Settings',
    dismiss: 'Dismiss for Now',
    sending: 'Sending...',
    filling: 'Filling...',
    sentToAI: 'Sent',
    filledToInput: 'Filled',
    sentToPartial: 'Sent',
    filledPartial: 'Filled',
    sendFailed: 'Send failed',
    fillFailed: 'Fill failed',
    errorOccurred: 'An error occurred',
    addedBadge: 'Added',
    varInputPlaceholder: 'Enter value for $1',
    clickToRetry: 'Click to retry',
    retrying: 'Retrying...',
    autoMerge: 'Auto Merge',
    timeoutMerge: 'Timeout Merge',
    manualMerge: 'Manual Merge',
    obsidianExport: 'Export Markdown',
    obsidianExporting: 'Exporting Markdown...',
    obsidianExportSuccess: 'Exported Markdown: $1',
    obsidianExportFailed: 'Markdown export failed: $1',
    debugDownloadLogs: 'Download debug logs',
    debugLogsDownloaded: 'Debug logs downloaded',
    debugLogsEmpty: 'No debug logs yet',
    discussionProgress: 'Discussing',
    discussionProgressInitial: 'Discussing',
    stopDiscussion: 'Stop Discussion',
    msgDiscussionStopped: 'Discussion stopped',
    defaultPromptEnabled: 'Enabled',
    skipDefaultPrompt: 'Skip',
    setDefaultPrompt: 'Set as Default',
    cancelDefaultPrompt: 'Cancel Default',
  }
};

let _currentLocale = 'zh';

export function getCurrentLocale() {
  return _currentLocale;
}

export function setCurrentLocale(locale) {
  _currentLocale = locale;
}

export function t(key, ...subs) {
  let msg = I18N[_currentLocale]?.[key] || I18N.zh[key] || key;
  subs.forEach((sub, i) => {
    msg = msg.replace(`$${i + 1}`, sub);
  });
  return msg;
}

export function detectLocale() {
  return navigator.language.startsWith('en') ? 'en' : 'zh';
}

export { I18N };

export function applyI18n(rerenderPanelHeaders) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', t(key));
  });
  if (typeof rerenderPanelHeaders === 'function') {
    document.querySelectorAll('.panel-item').forEach(panelEl => {
      const providerId = panelEl.dataset.providerId;
      if (providerId) {
        const headerRight = panelEl.querySelector('.panel-header-right');
        if (headerRight) {
          headerRight.textContent = '';
          rerenderPanelHeaders(panelEl, providerId, headerRight);
        }
      }
    });
  }
}
