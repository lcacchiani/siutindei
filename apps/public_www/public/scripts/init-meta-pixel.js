(function initMetaPixel() {
  function parseAllowedHosts(rawValue) {
    if (typeof rawValue !== 'string') {
      return [];
    }

    var seen = {};
    return rawValue
      .split(',')
      .map(function normalizeHost(hostValue) {
        return hostValue.trim().toLowerCase();
      })
      .filter(function isUniqueHost(hostValue) {
        if (hostValue === '' || seen[hostValue]) {
          return false;
        }
        seen[hostValue] = true;
        return true;
      });
  }

  var allowedHosts = parseAllowedHosts(
    document.documentElement.getAttribute('data-meta-pixel-allowed-hosts'),
  );
  var currentHost = window.location.hostname.toLowerCase();
  if (allowedHosts.length === 0 || allowedHosts.indexOf(currentHost) === -1) {
    return;
  }

  var pixelId = document.documentElement.getAttribute('data-meta-pixel-id');
  if (!pixelId || !/^\d+$/.test(pixelId)) {
    return;
  }

  var f = window;
  var b = document;
  var e = 'script';
  var n = function () {
    n.callMethod
      ? n.callMethod.apply(n, arguments)
      : n.queue.push(arguments);
  };
  if (f.fbq) {
    return;
  }
  f.fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  f._fbq = n;

  var t = b.createElement(e);
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  var s = b.getElementsByTagName(e)[0];
  if (s && s.parentNode) {
    s.parentNode.insertBefore(t, s);
  } else {
    b.head.appendChild(t);
  }

  n('init', pixelId);
  n('track', 'PageView');
})();
