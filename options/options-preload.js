(function() {
  try {
    chrome.storage.sync.get({ theme: 'auto' }, function(s) {
      var t = s.theme;
      if (t === 'auto') t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
    });
  } catch(e) {}
})();
