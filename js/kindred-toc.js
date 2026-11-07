(() => {
  "use strict";

  const root = document.querySelector("[data-kindred-toc]");
  if (!root) return;
  const trigger = root.querySelector(".kindred-toc-trigger");
  const panel = root.querySelector(".kindred-toc-panel");
  const list = root.querySelector(".kindred-toc-list");
  const currentLink = root.querySelector('.kindred-toc-link[aria-current="page"]');
  if (!trigger || !panel) return;
  const focusableSelector = 'a[href], button:not([disabled]), [tabindex="0"]';
  let scrollTimer;

  const setOpen = (open, restoreFocus = true) => {
    const wasOpen = root.classList.contains("is-open");
    clearTimeout(scrollTimer);
    if (open) document.dispatchEvent(new CustomEvent("site:overlay-open", { detail: { name: "kindred" } }));
    root.classList.toggle("is-open", open);
    document.body.classList.toggle("kindred-toc-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
    if (open) {
      requestAnimationFrame(() => {
        if (root.classList.contains("is-open") && !panel.inert) {
          panel.querySelector(".kindred-toc-close")?.focus({ preventScroll: true });
        }
      });
      scrollTimer = window.setTimeout(() => {
        if (!list || !currentLink || !root.classList.contains("is-open")) return;
        // Scroll the chapter list only; never move the article underneath it.
        list.scrollTo({
          top: list.scrollTop + currentLink.getBoundingClientRect().top
            - list.getBoundingClientRect().top - (list.clientHeight - currentLink.offsetHeight) / 2,
          behavior: "instant",
        });
      }, 180);
    } else if (wasOpen && restoreFocus) {
      trigger.focus({ preventScroll: true });
    }
  };

  setOpen(false, false);
  trigger.addEventListener("click", () => setOpen(!root.classList.contains("is-open")));
  root.querySelectorAll("[data-kindred-toc-close]").forEach((button) => {
    button.addEventListener("click", () => setOpen(false));
  });
  root.querySelectorAll(".kindred-toc-link").forEach((link) => {
    link.addEventListener("click", () => setOpen(false, false));
  });
  document.addEventListener("site:overlay-open", (event) => {
    if (event.detail.name !== "kindred") setOpen(false, false);
  });
  window.addEventListener("pagehide", () => setOpen(false, false));
  window.addEventListener("pageshow", (event) => { if (event.persisted) setOpen(false, false); });
  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panel.querySelectorAll(focusableSelector))
      .filter((element) => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
})();
