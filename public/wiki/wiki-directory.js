if (!document.querySelector('link[href="./wiki-directory.css"]')) {
  const directoryStyles = document.createElement("link");
  directoryStyles.rel = "stylesheet";
  directoryStyles.href = "./wiki-directory.css";
  document.head.append(directoryStyles);
}

const homeDirectoryTemplate = document.getElementById("wiki-home-directory-template");
const deepDiveTemplate = document.getElementById("wiki-deep-dive-links");
const articleContent = document.getElementById("article-content");
const pageToc = document.getElementById("page-toc");
const directorySearchForm = document.getElementById("search-form");
const directorySearchInput = document.getElementById("wiki-search");
const directorySearchResults = document.getElementById("search-results");

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

function longFormGuideEntries() {
  if (!homeDirectoryTemplate) return [];
  const entries = new Map();
  const links = homeDirectoryTemplate.content.querySelectorAll(
    ".guide-directory-group a, .explainer-grid a"
  );

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || entries.has(href)) continue;
    entries.set(href, {
      href,
      title: link.querySelector("strong")?.textContent?.trim() || link.textContent.trim(),
      summary: link.querySelector("span")?.textContent?.trim() || "Long-form Compendium guide"
    });
  }

  return [...entries.values()];
}

function appendLongFormSearchResults(query) {
  if (!directorySearchResults) return;
  directorySearchResults.querySelector("[data-long-form-search]")?.remove();

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return;

  const matches = longFormGuideEntries()
    .map((guide) => {
      const title = guide.title.toLowerCase();
      const summary = guide.summary.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (title.includes(token)) score += 6;
        if (summary.includes(token)) score += 2;
      }
      return { guide, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title))
    .slice(0, 6);

  if (!matches.length) return;

  const section = document.createElement("section");
  section.dataset.longFormSearch = "true";
  section.setAttribute("aria-label", "Long-form guide matches");

  const heading = document.createElement("h3");
  heading.textContent = "Long-form guides";
  section.append(heading);

  for (const { guide } of matches) {
    const link = document.createElement("a");
    link.className = "search-result";
    link.href = guide.href;

    const strong = document.createElement("strong");
    strong.textContent = guide.title;
    const span = document.createElement("span");
    span.textContent = `Full walkthrough — ${guide.summary}`;

    link.append(strong, span);
    section.append(link);
  }

  directorySearchResults.append(section);
  directorySearchResults.hidden = false;
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

directorySearchForm?.addEventListener("submit", () => {
  const query = directorySearchInput?.value || "";
  queueMicrotask(() => appendLongFormSearchResults(query));
});

enhanceCompendiumPage();
