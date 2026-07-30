// panel-builder.js — Merge panel DOM construction
// Extracted from merge-engine.js

import { getProviderFrameUrl } from './panel-frame-config.js';
import { getPanelHeaderRightHtml } from './panel-header-actions.js';
import { getThemeAwareProviderIcon, setBrandText } from './theme.js';
import { t } from './i18n.js';
import { getMergeBadgeMeta } from './merge-prompt.js';

export function buildMergePanel({ panelId, provider, targetProvider, question, validAnswers, mergeMode, discussRounds }) {
  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.dataset.providerId = targetProvider;

  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'panel-header-left';

  const headerIcon = document.createElement('img');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.alt = provider.name;
  headerIcon.className = 'provider-icon';
  headerIcon.dataset.providerId = provider.id;

  const headerName = document.createElement('span');
  setBrandText(headerName, `${provider.name}(${t('merge')})`);

  const mergeBadge = document.createElement('span');
  mergeBadge.id = 'merge-status-badge';
  const badgeMeta = getMergeBadgeMeta();
  mergeBadge.style.background = badgeMeta.background;
  mergeBadge.style.color = 'white';
  mergeBadge.style.padding = '2px 6px';
  mergeBadge.style.fontSize = '10px';
  mergeBadge.style.fontWeight = '600';
  mergeBadge.style.borderRadius = '3px';
  mergeBadge.style.marginLeft = '6px';
  mergeBadge.style.whiteSpace = 'nowrap';
  mergeBadge.title = badgeMeta.title;
  mergeBadge.textContent = badgeMeta.text;

  headerLeft.appendChild(headerIcon);
  headerLeft.appendChild(headerName);
  headerLeft.appendChild(mergeBadge);

  const headerRight = document.createElement('div');
  headerRight.className = 'panel-header-right';
  headerRight.innerHTML = getPanelHeaderRightHtml(targetProvider);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'panel-iframe-container';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'panel-loading';

  const loadingIcon = document.createElement('img');
  loadingIcon.src = getThemeAwareProviderIcon(provider);
  loadingIcon.alt = provider.name;
  loadingIcon.className = 'loading-icon';
  loadingIcon.dataset.providerId = provider.id;

  const loadingText = document.createElement('span');
  loadingText.className = 'loading-text';
  loadingText.textContent = t('loadingProvider', provider.name);

  loadingEl.appendChild(loadingIcon);
  loadingEl.appendChild(loadingText);

  const iframe = document.createElement('iframe');
  iframe.src = getProviderFrameUrl(targetProvider);
  iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
  iframe.allow = 'clipboard-read; clipboard-write';

  iframeContainer.appendChild(loadingEl);
  iframeContainer.appendChild(iframe);
  panelEl.appendChild(header);
  panelEl.appendChild(iframeContainer);

  return {
    panelEl,
    iframe,
    panelData: {
      id: panelId,
      providerId: targetProvider,
      iframe,
      state: 'loading',
      exportData: {
        question,
        providers: validAnswers.map(a => a.providerName),
        mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
      }
    }
  };
}
