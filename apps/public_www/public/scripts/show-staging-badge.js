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
  document.body.appendChild(badge);
})();
