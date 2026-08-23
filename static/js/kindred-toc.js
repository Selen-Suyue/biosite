(() => {
  "use strict";

  const root = document.querySelector("[data-kindred-toc]");
  if (!root) return;

  const trigger = root.querySelector(".kindred-toc-trigger");
  const panel = root.querySelector(".kindred-toc-panel");
  const closeButtons = root.querySelectorAll("[data-kindred-toc-close]");
  const currentLink = root.querySelector('.kindred-toc-link[aria-current="page"]');

  if (!trigger || !panel) return;

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const setOpen = (open, restoreFocus = true) => {
    root.classList.toggle("is-open", open);
    document.body.classList.toggle("kindred-toc-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));

    if (open) {
      const closeButton = panel.querySelector(".kindred-toc-close");
      closeButton?.focus({ preventScroll: true });
      window.setTimeout(() => currentLink?.scrollIntoView({ block: "center" }), 180);
    } else if (restoreFocus) {
      trigger.focus({ preventScroll: true });
    }
  };

  trigger.addEventListener("click", () => {
    setOpen(!root.classList.contains("is-open"));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => setOpen(false));
  });

  root.querySelectorAll(".kindred-toc-link").forEach((link) => {
    link.addEventListener("click", () => setOpen(false, false));
  });

  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(panel.querySelectorAll(focusableSelector));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
