(() => {
  const themeButtonSelector = ".dark-mode-btn";

  const isDark = () =>
    document.documentElement.getAttribute("data-theme") === "dark";

  const syncButton = (button) => {
    if (!button) return;
    const dark = isDark();
    button.id = dark ? "nav-moon-btn" : "nav-sun-btn";
    button.setAttribute("aria-label", "切换明暗模式");
    button.setAttribute("title", dark ? "切换到亮色模式" : "切换到暗色模式");
  };

  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("dark_mode", dark ? "true" : "false");
    document.body.dispatchEvent(
      new CustomEvent(`${dark ? "dark" : "light"}-theme-set`),
    );
  };

  const attach = () => {
    const current = document.querySelector(themeButtonSelector);
    if (!current) return false;

    const button = current.cloneNode(true);
    current.replaceWith(button);

    syncButton(button);

    button.addEventListener("click", () => {
      const nextDark = !isDark();
      applyTheme(nextDark);
      syncButton(button);
    });

    return true;
  };

  const boot = () => {
    if (attach()) return;
    requestAnimationFrame(boot);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
