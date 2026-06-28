(() => {
  const desktopQuery = window.matchMedia('(min-width: 769px)');

  const findSidebar = () => document.getElementById('sidebar') || document.querySelector('.sidebar');
  const findMask = () => document.getElementById('mask');

  const closeSidebar = () => {
    document.body.classList.remove('desktop-sidebar-open');
    const button = document.getElementById('desktop-sidebar-toggle');
    if (button) button.setAttribute('aria-expanded', 'false');
  };

  const openSidebar = () => {
    document.body.classList.add('desktop-sidebar-open');
    const button = document.getElementById('desktop-sidebar-toggle');
    if (button) button.setAttribute('aria-expanded', 'true');
  };

  const toggleSidebar = () => {
    if (document.body.classList.contains('desktop-sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  };

  const ensureToggle = () => {
    if (!desktopQuery.matches || document.getElementById('desktop-sidebar-toggle')) return;

    const sidebar = findSidebar();
    const nav = document.getElementById('main-nav');
    if (!sidebar || !nav) return;

    const wrap = document.createElement('div');
    wrap.className = 'main-nav-link-wrap desktop-sidebar-toggle-wrap';

    const button = document.createElement('button');
    button.id = 'desktop-sidebar-toggle';
    button.className = 'main-nav-link desktop-sidebar-toggle';
    button.type = 'button';
    button.setAttribute('aria-controls', sidebar.id || 'sidebar');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = '关于';
    button.addEventListener('click', toggleSidebar);

    wrap.appendChild(button);
    nav.appendChild(wrap);
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureToggle();

    findMask()?.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSidebar();
    });

    desktopQuery.addEventListener?.('change', () => {
      closeSidebar();
      ensureToggle();
    });
  });
})();
