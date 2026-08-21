(function () {
  "use strict";

  const modal = document.getElementById("local-search");
  if (!modal) return;

  const input = document.getElementById("local-search-input");
  const status = document.getElementById("local-search-status");
  const results = document.getElementById("local-search-results");
  const maxResults = Number(modal.dataset.maxResults) || 12;
  let posts = null;
  let loading = null;
  let previousFocus = null;

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase();

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
            searchable: normalize([
              post.title,
              post.summary,
              post.content,
              ...(post.categories || []),
              ...(post.tags || []),
            ].join(" ")),
            normalizedTitle: normalize(post.title),
          }));
          return posts;
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
    const categories = (post.categories || []).join(" · ");
    meta.textContent = [post.date, categories].filter(Boolean).join("  ·  ");

    const title = document.createElement("strong");
    title.textContent = post.title;

    const summary = document.createElement("span");
    summary.className = "local-search-result-summary";
    summary.textContent = post.summary || "打开文章阅读全文";

    link.append(meta, title, summary);
    return link;
  };

  const search = () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    results.replaceChildren();

    if (!terms.length) {
      status.textContent = "输入关键词开始搜索";
      return;
    }

    status.textContent = "正在搜索…";
    loadIndex()
      .then((index) => {
        const matches = index
          .filter((post) => terms.every((term) => post.searchable.includes(term)))
          .map((post) => ({
            post,
            score: terms.reduce(
              (score, term) => score + (post.normalizedTitle.includes(term) ? 5 : 1),
              0,
            ),
          }))
          .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date));

        status.textContent = matches.length
          ? `找到 ${matches.length} 篇相关文章${matches.length > maxResults ? `，显示前 ${maxResults} 篇` : ""}`
          : "没有找到相关文章，请尝试其他关键词";
        results.append(...matches.slice(0, maxResults).map(({ post }) => resultItem(post)));
      })
      .catch(() => {
        status.textContent = "搜索索引加载失败，请刷新页面后重试";
      });
  };

  const open = () => {
    previousFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-open");
    window.setTimeout(() => input.focus(), 20);
    loadIndex().catch(() => {});
  };

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-open");
    if (previousFocus) previousFocus.focus();
  };

  const installButton = () => {
    const subnav = document.getElementById("sub-nav");
    if (!subnav || document.getElementById("local-search-open")) return;
    const button = document.createElement("button");
    button.id = "local-search-open";
    button.className = "local-search-open";
    button.type = "button";
    button.title = "搜索";
    button.setAttribute("aria-label", "搜索文章");
    button.addEventListener("click", open);
    subnav.prepend(button);
  };

  input.addEventListener("input", search);
  modal.querySelectorAll("[data-search-close]").forEach((button) =>
    button.addEventListener("click", close),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) close();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    }
  });

  installButton();
  document.addEventListener("pjax:complete", installButton);
})();
