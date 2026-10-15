(() => {
  "use strict";

  const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
  const syncComments = () => {
    document.querySelectorAll("iframe.giscus-frame").forEach((frame) => {
      frame.contentWindow?.postMessage({ giscus: { setConfig: { theme: isDark() ? "dark" : "light" } } }, "https://giscus.app");
    });
  };
  const syncButton = (button) => {
    const dark = isDark();
    button.id = dark ? "nav-moon-btn" : "nav-sun-btn";
    const label = dark ? "切换到亮色模式" : "切换到暗色模式";
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  const applyTheme = (dark, persist = true) => {
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    if (persist) {
      try { localStorage.setItem("dark_mode", String(dark)); } catch (_) {}
    }
    document.body.dispatchEvent(new CustomEvent("reimu:theme-set", {
      detail: { isDark: dark, mode: String(dark) },
    }));
    syncComments();
  };
  const boot = () => {
    const current = document.querySelector(".dark-mode-btn");
    if (!current) return;
    const button = document.createElement("button");
    button.className = current.className;
    button.type = "button";
    current.replaceWith(button);
    syncButton(button);
    button.addEventListener("click", () => {
      applyTheme(!isDark());
      syncButton(button);
    });
    const syncSavedTheme = () => {
      try {
        const saved = localStorage.getItem("dark_mode");
        if (saved === "true" || saved === "false") applyTheme(saved === "true", false);
      } catch (_) {}
      syncButton(button);
      syncComments();
    };
    window.addEventListener("pageshow", syncSavedTheme);
    window.addEventListener("storage", (event) => {
      if (event.key === "dark_mode") syncSavedTheme();
    });
    const comment = document.querySelector(".giscus-comment");
    if (comment) {
      const watched = new WeakSet();
      const watchFrames = () => {
        comment.querySelectorAll("iframe.giscus-frame").forEach((frame) => {
          if (watched.has(frame)) return;
          watched.add(frame);
          frame.addEventListener("load", syncComments);
          syncComments();
        });
      };
      new MutationObserver(watchFrames).observe(comment, { childList: true, subtree: true });
      watchFrames();
    }
    syncSavedTheme();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
