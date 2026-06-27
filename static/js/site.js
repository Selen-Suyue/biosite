(function () {
  "use strict";

  document.querySelectorAll(".blog-card-cover-image").forEach((image) => {
    const markUnavailable = () => image.closest(".blog-card-cover")?.classList.add("is-unavailable");
    image.addEventListener("error", markUnavailable, { once: true });
    if (image.complete && image.naturalWidth === 0) markUnavailable();
  });
})();
