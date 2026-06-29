(() => {
  const desktopQuery = window.matchMedia('(min-width: 769px)');

  const findSidebar = () => document.getElementById('sidebar') || document.querySelector('.sidebar');
  const findMask = () => document.getElementById('mask');
  const getToggle = () => document.getElementById('desktop-sidebar-toggle');
  const getCloseButton = () => document.getElementById('desktop-sidebar-close');

  const closeSidebar = () => {
    document.body.classList.remove('desktop-sidebar-open');
    const button = getToggle();
    if (button) button.setAttribute('aria-expanded', 'false');
    const sidebar = findSidebar();
    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
    const closeButton = getCloseButton();
    if (closeButton) closeButton.setAttribute('tabindex', '-1');
  };

  const openSidebar = () => {
    document.body.classList.add('desktop-sidebar-open');
    const button = getToggle();
    if (button) button.setAttribute('aria-expanded', 'true');
    const sidebar = findSidebar();
    if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
    const closeButton = getCloseButton();
    if (closeButton) {
      closeButton.removeAttribute('tabindex');
      closeButton.focus({ preventScroll: true });
    }
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

    sidebar.setAttribute('aria-hidden', 'true');

    if (!document.getElementById('desktop-sidebar-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'desktop-sidebar-toolbar';
      toolbar.className = 'desktop-sidebar-toolbar';

      const title = document.createElement('span');
      title.className = 'desktop-sidebar-title';
      title.textContent = '关于';

      const closeButton = document.createElement('button');
      closeButton.id = 'desktop-sidebar-close';
      closeButton.className = 'desktop-sidebar-close';
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', '关闭关于侧栏');
      closeButton.setAttribute('tabindex', '-1');
      closeButton.textContent = '×';
      closeButton.addEventListener('click', closeSidebar);

      toolbar.appendChild(title);
      toolbar.appendChild(closeButton);
      sidebar.prepend(toolbar);
    }
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
