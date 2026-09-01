const homeDirectoryTemplate = document.getElementById("wiki-home-directory-template");
const deepDiveTemplate = document.getElementById("wiki-deep-dive-links");
const articleContent = document.getElementById("article-content");
const pageToc = document.getElementById("page-toc");

function currentCompendiumHash() {
  return window.location.hash.replace(/^#/, "") || "home";
}

function removeDirectoryEnhancements() {
  articleContent?.querySelectorAll("[data-directory-enhancement]").forEach((node) => node.remove());
}

function addHomeDirectory() {
  if (!homeDirectoryTemplate || !articleContent) return;
  const fragment = homeDirectoryTemplate.content.cloneNode(true);
  const marker = fragment.querySelector("[data-directory-enhancement]");
  const startBox = articleContent.querySelector(".note-box");

  if (startBox) {
    startBox.after(fragment);
  } else {
    articleContent.prepend(fragment);
  }

  if (pageToc && marker) {
    const existingTargets = new Set(
      [...pageToc.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    );
    const directoryLinks = [
      ["#choose-goal", "Choose your goal"],
      ["#guide-directory", "Guide directory"],
      ["#popular-explainers", "Popular explainers"]
    ];

    for (const [href, label] of directoryLinks.reverse()) {
      if (existingTargets.has(href)) continue;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = href;
      link.dataset.localAnchor = "true";
      link.textContent = label;
      item.append(link);
      pageToc.prepend(item);
    }
  }
}

function addDeepDive(articleId) {
  if (!deepDiveTemplate || !articleContent) return;
  const source = deepDiveTemplate.content.querySelector(`[data-article-id="${CSS.escape(articleId)}"]`);
  if (!source) return;

  const card = document.createElement("aside");
  card.className = "deep-dive-guide-card";
  card.dataset.directoryEnhancement = "deep-dive";
  card.setAttribute("aria-label", "Long-form guide");
  card.innerHTML = `
    <div>
      <span class="deep-dive-guide-card__eyebrow">Go deeper</span>
      <strong>${source.dataset.guideTitle || "Read the full guide"}</strong>
      <p>${source.dataset.guideSummary || "Open the longer walkthrough for practical steps, examples and connected systems."}</p>
    </div>
  `;

  const link = source.cloneNode(true);
  link.removeAttribute("data-article-id");
  link.removeAttribute("data-guide-title");
  link.removeAttribute("data-guide-summary");
  link.className = "deep-dive-guide-card__link";
  link.textContent = "Open full guide →";
  card.append(link);

  const meta = articleContent.querySelector(".article-meta");
  if (meta) {
    meta.after(card);
  } else {
    articleContent.prepend(card);
  }
}

function enhanceCompendiumPage() {
  if (!articleContent) return;
  removeDirectoryEnhancements();
  const hash = currentCompendiumHash();

  if (hash === "home") {
    addHomeDirectory();
  } else if (!hash.startsWith("section-")) {
    addDeepDive(hash);
  }
}

window.addEventListener("hashchange", () => {
  queueMicrotask(enhanceCompendiumPage);
});

enhanceCompendiumPage();
