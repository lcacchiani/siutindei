(function setHtmlLang() {
  var match = location.pathname.match(/^\/(en|zh-HK)(?:\/|$)/);
  if (match) {
    document.documentElement.lang = match[1];
  }
})();
