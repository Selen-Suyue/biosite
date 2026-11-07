(() => {
  "use strict";

  const boot = () => {
    const menu = document.getElementById("mobile-nav");
    const toggle = document.getElementById("main-nav-toggle");
    const mask = document.getElementById("mask");
    const mobile = window.matchMedia("(max-width: 767px)");
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex="0"]';
    let previousFocus = null;

    const isOpen = () => document.body.classList.contains("mobile-nav-on");
    const sync = () => {
      const open = isOpen();
      if (menu) menu.inert = !open;
      menu?.setAttribute("aria-hidden", String(!open));
      toggle?.setAttribute("aria-expanded", String(open));
      mask?.classList.toggle("hide", !open);
    };
    const close = (restoreFocus = true) => {
      const wasOpen = isOpen();
      document.body.classList.remove("mobile-nav-on");
      sync();
      if (wasOpen && restoreFocus) {
        const target = previousFocus?.isConnected && previousFocus !== document.body
          && previousFocus !== document.documentElement && !previousFocus.closest("[inert]")
          && previousFocus.getClientRects().length ? previousFocus : toggle;
        target?.focus({ preventScroll: true });
      }
    };
    const open = () => {
      if (!mobile.matches || !menu) return;
      previousFocus = document.activeElement;
      document.dispatchEvent(new CustomEvent("site:overlay-open", { detail: { name: "navigation" } }));
      document.body.classList.add("mobile-nav-on");
      sync();
      requestAnimationFrame(() => {
        if (isOpen() && !menu.inert) {
          menu.querySelector(".mobile-nav-close, a[href], button")?.focus({ preventScroll: true });
        }
      });
    };

    // Replace the theme's click handlers so every exit uses the same state update.
    toggle?.off?.("click");
    mask?.off?.("click");
    toggle?.addEventListener("click", () => isOpen() ? close() : open());
    mask?.addEventListener("click", () => close());
    menu?.addEventListener("click", (event) => {
      if (event.target.closest(".mobile-nav-close")) close();
      else if (event.target.closest("a[href]")) close(false);
    });
    document.addEventListener("site:overlay-open", (event) => {
      if (event.detail.name !== "navigation") close(false);
    });
    document.addEventListener("keydown", (event) => {
      if (!isOpen() || !menu) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const items = Array.from(menu.querySelectorAll(focusableSelector))
          .filter((item) => item.getClientRects().length);
        const first = items[0];
        const last = items[items.length - 1];
        if (!menu.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    mobile.addEventListener("change", () => { if (!mobile.matches) close(false); });
    window.addEventListener("pagehide", () => close(false));
    window.addEventListener("pageshow", (event) => { if (event.persisted) close(false); });
    close(false);

    // Remember only this site's article-list context, in this browser tab.
    const basePath = new URL(window.siteConfig?.base || ".", location.href).pathname.replace(/\/?$/, "/");
    const postPrefix = `${basePath}post/`;
    const storageKey = `blog-return:${basePath}`;
    const restoreKey = `${storageKey}:restore`;
    const articleKey = (path) => `${storageKey}:article:${path}`;
    const currentPath = () => location.pathname + location.search;
    const isLocal = (url) => url.origin === location.origin && url.pathname.startsWith(basePath);
    const read = (key) => {
      try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; }
    };
    const write = (key, value) => {
      try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };
    const validRecord = (record) => {
      if (!record || typeof record.from !== "string" || typeof record.to !== "string"
        || !Number.isFinite(record.y) || !Number.isFinite(record.at) || Date.now() - record.at > 2 * 60 * 60 * 1000) return false;
      try {
        const source = new URL(record.from, location.origin);
        const target = new URL(record.to, location.origin);
        return isLocal(source) && isLocal(target) && !source.pathname.startsWith(postPrefix)
          && target.pathname.startsWith(postPrefix);
      } catch (_) { return false; }
    };
    const refreshReturnLinks = () => {
      const record = read(articleKey(currentPath()));
      if (!validRecord(record) || record.to !== currentPath()) return;
      document.querySelectorAll("a[data-return-to-list]").forEach((link) => {
        link.href = record.from;
        link.setAttribute("aria-label", "返回原文章列表及阅读位置");
      });
    };
    const restoreList = () => {
      const record = read(restoreKey);
      if (!validRecord(record) || record.from !== currentPath()) return;
      try { sessionStorage.removeItem(restoreKey); } catch (_) {}
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, record.y), left: 0, behavior: "instant" });
      }));
    };
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
        || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, location.href);
      if (!isLocal(destination)) return;
      const record = read(articleKey(currentPath()));
      if (link.matches("[data-return-to-list]") && validRecord(record) && record.to === currentPath()) {
        write(restoreKey, record);
      } else if (destination.pathname.startsWith(postPrefix)) {
        if (document.querySelector(".blog-list, .archive-index, .archives-outer-wrap")) {
          write(articleKey(destination.pathname + destination.search), {
            from: currentPath(), to: destination.pathname + destination.search,
            y: window.scrollY, at: Date.now(),
          });
        } else if (validRecord(record) && record.to === currentPath()) {
          write(articleKey(destination.pathname + destination.search), { ...record, to: destination.pathname + destination.search, at: Date.now() });
        }
      }
    });
    refreshReturnLinks();
    window.addEventListener("pageshow", () => {
      refreshReturnLinks();
      restoreList();
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
