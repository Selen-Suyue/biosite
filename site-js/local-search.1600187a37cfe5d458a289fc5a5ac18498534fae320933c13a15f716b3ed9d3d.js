(function () {
  "use strict";

  const modal = document.getElementById("local-search");
  if (!modal) return;
  const input = document.getElementById("local-search-input");
  const status = document.getElementById("local-search-status");
  const results = document.getElementById("local-search-results");
  const pageSize = Number(modal.dataset.maxResults) || 12;
  const focusableSelector = 'a[href], button:not([disabled]), input, [tabindex="0"]';
  let posts = null;
  let loading = null;
  let previousFocus = null;
  let requestId = 0;
  let matches = [];
  let visibleCount = pageSize;

  const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase();
  const excerpt = (value) => {
    const characters = Array.from(String(value || "").replace(/\s+/g, " ").trim());
    return characters.length > 160 ? `${characters.slice(0, 160).join("")}…` : characters.join("");
  };
  const loadIndex = () => {
    if (posts) return Promise.resolve(posts);
    if (!loading) {
      loading = fetch(modal.dataset.index, { credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          posts = data.map((post) => ({
            ...post,
            searchable: normalize([post.title, post.summary, post.content,
              ...(post.categories || []), ...(post.tags || [])].join(" ")),
            normalizedTitle: normalize(post.title),
          }));
          return posts;
        })
        .catch((error) => {
          loading = null;
          throw error;
        });
    }
    return loading;
  };

  const resultItem = (post) => {
    const link = document.createElement("a");
    link.className = "local-search-result";
    link.href = post.url;
    const meta = document.createElement("span");
    meta.className = "local-search-result-meta";
    meta.textContent = [post.date, (post.categories || []).join(" · ")].filter(Boolean).join(" · ");
    const title = document.createElement("strong");
    title.textContent = post.title;
    const summary = document.createElement("span");
    summary.className = "local-search-result-summary";
    summary.textContent = excerpt(post.summary || post.content) || "打开文章阅读全文";
    link.append(meta, title, summary);
    return link;
  };

  const renderResults = () => {
    const count = Math.min(visibleCount, matches.length);
    status.textContent = matches.length
      ? `找到 ${matches.length} 篇相关文章${count < matches.length ? `，已显示 ${count} 篇` : ""}`
      : "没有找到相关文章，请尝试其他关键词";
    results.replaceChildren(...matches.slice(0, count).map(resultItem));
    if (count < matches.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "local-search-more";
      more.textContent = `显示更多（剩余 ${matches.length - count} 篇）`;
      more.addEventListener("click", () => {
        visibleCount += pageSize;
        renderResults();
        results.querySelectorAll(".local-search-result")[count]?.focus({ preventScroll: true });
      });
      results.append(more);
    }
  };

  const search = () => {
    const currentRequest = ++requestId;
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    results.replaceChildren();
    visibleCount = pageSize;
    if (!terms.length) {
      status.textContent = "输入关键词开始搜索";
      return;
    }
    status.textContent = "正在搜索…";
    loadIndex().then((index) => {
      if (currentRequest !== requestId) return;
      matches = index
        .filter((post) => terms.every((term) => post.searchable.includes(term)))
        .map((post) => ({ post, score: terms.reduce(
          (score, term) => score + (post.normalizedTitle.includes(term) ? 5 : 1), 0),
        }))
        .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
        .map(({ post }) => post);
      renderResults();
    }).catch(() => {
      if (currentRequest === requestId) status.textContent = "搜索加载失败，请重新输入关键词重试";
    });
  };

  const close = (restoreFocus = true) => {
    const wasOpen = modal.classList.contains("is-open");
    ++requestId;
    modal.classList.remove("is-open");
    modal.inert = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-open");
    if (wasOpen && restoreFocus) {
      const target = previousFocus?.isConnected && previousFocus !== document.body
          && previousFocus !== document.documentElement && !previousFocus.closest("[inert]")
        && previousFocus.getClientRects().length ? previousFocus : document.getElementById("local-search-open");
      target?.focus({ preventScroll: true });
    }
  };

  const open = () => {
    if (modal.classList.contains("is-open")) return;
    previousFocus = document.activeElement;
    document.dispatchEvent(new CustomEvent("site:overlay-open", { detail: { name: "search" } }));
    modal.inert = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-open");
    requestAnimationFrame(() => {
      if (modal.classList.contains("is-open") && !modal.inert) input.focus({ preventScroll: true });
    });
    search();
    loadIndex().catch(() => {});
  };

  const subnav = document.getElementById("sub-nav");
  if (subnav && !document.getElementById("local-search-open")) {
    const button = document.createElement("button");
    button.id = "local-search-open";
    button.className = "local-search-open";
    button.type = "button";
    button.title = "搜索（⌘ / Ctrl K）";
    button.setAttribute("aria-label", "搜索文章");
    button.setAttribute("aria-controls", "local-search");
    button.addEventListener("click", open);
    subnav.prepend(button);
  }

  close(false);
  input.addEventListener("input", search);
  modal.querySelectorAll("[data-search-close]").forEach((button) => {
    button.addEventListener("click", () => close());
  });
  results.addEventListener("click", (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      && event.target.closest("a[href]")) close(false);
  });
  document.addEventListener("site:overlay-open", (event) => {
    if (event.detail.name !== "search") close(false);
  });
  window.addEventListener("pagehide", () => close(false));
  window.addEventListener("pageshow", (event) => { if (event.persisted) close(false); });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (modal.classList.contains("is-open")) close();
      else open();
      return;
    }
    if (!modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      const focusable = Array.from(modal.querySelectorAll(focusableSelector))
        .filter((element) => element.getAttribute("tabindex") !== "-1" && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
})();
