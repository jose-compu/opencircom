(function () {
  if (typeof hljs !== "undefined") {
    hljs.highlightAll();
  }

  const search = document.getElementById("docs-search");
  const templates = document.querySelectorAll(".template-doc");
  const categories = document.querySelectorAll(".docs-category");
  const noResults = document.getElementById("docs-no-results");

  if (!search || !templates.length) return;

  function filterTemplates() {
    const q = search.value.trim().toLowerCase();
    let visible = 0;

    templates.forEach(function (el) {
      const hay = el.getAttribute("data-search") || "";
      const show = !q || hay.includes(q);
      el.classList.toggle("hidden", !show);
      if (show) visible++;
    });

    categories.forEach(function (cat) {
      const any = cat.querySelector(".template-doc:not(.hidden)");
      cat.classList.toggle("hidden", !any);
    });

    if (noResults) {
      noResults.classList.toggle("hidden", visible > 0 || !q);
    }
  }

  search.addEventListener("input", filterTemplates);
})();
