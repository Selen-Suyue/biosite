(() => {
  const closeMobileNav = () => {
    document.body.classList.remove('mobile-nav-on');
    document.getElementById('mask')?.classList.add('hide');
    document.getElementById('mobile-nav')?.setAttribute('aria-hidden', 'true');
    document.getElementById('main-nav-toggle')?.setAttribute('aria-expanded', 'false');
  };

  const syncMobileNav = () => {
    const open = document.body.classList.contains('mobile-nav-on');
    document.getElementById('mobile-nav')?.setAttribute('aria-hidden', String(!open));
    document.getElementById('main-nav-toggle')?.setAttribute('aria-expanded', String(open));
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-nav-toggle')?.setAttribute('aria-expanded', 'false');

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobileNav();
    });

    document.addEventListener('click', (event) => {
      const target = event.target.closest('a, button');
      if (!target) return;

      if (target.matches('.mobile-nav-close')) closeMobileNav();
      if (target.matches('#main-nav-toggle')) requestAnimationFrame(syncMobileNav);

      if (
        target.matches('#main-nav a[href="https://selen-suyue.github.io/"], #main-nav a[href="https://selen-suyue.github.io"]') &&
        !window.confirm('即将前往 Selen 的个人主页，是否继续？')
      ) {
        event.preventDefault();
      }
    });
  });
})();
