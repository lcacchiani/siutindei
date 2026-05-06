(function showStagingBadge() {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById('staging-badge')) {
    return;
  }
  var badge = document.createElement('div');
  badge.id = 'staging-badge';
  badge.textContent = 'STAGING';
  badge.setAttribute('role', 'status');
  badge.style.position = 'fixed';
  badge.style.bottom = '12px';
  badge.style.right = '12px';
  badge.style.zIndex = '9999';
  badge.style.padding = '6px 10px';
  badge.style.borderRadius = '999px';
  badge.style.background = '#dc2626';
  badge.style.color = '#fff';
  badge.style.fontFamily = 'system-ui, sans-serif';
  badge.style.fontSize = '12px';
  badge.style.fontWeight = '700';
  badge.style.letterSpacing = '0.1em';
  badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  document.body.appendChild(badge);
})();
