/** Distinguish a specific YouTube lesson from YouTube search results or placeholder URLs. */
export const isDirectYouTubeLesson = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") return /^\/[a-zA-Z0-9_-]{11}$/.test(url.pathname);
    if (host !== "youtube.com" && host !== "www.youtube.com" && host !== "m.youtube.com") return false;
    if (url.pathname === "/watch") return /^[a-zA-Z0-9_-]{11}$/.test(url.searchParams.get("v") ?? "");
    return /^\/(shorts|live)\/[a-zA-Z0-9_-]{11}$/.test(url.pathname);
  } catch {
    return false;
  }
};

/** A search link is discovery only and never represents a completed lesson. */
export const videoTutorialSearchUrl = (skill: string, topic?: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(
    [skill.replace(/^(instruments_|genres_)/, "").replace(/^(basic_|professional_|mastery_)/, "").replace(/_/g, " "), topic, "tutorial"].filter(Boolean).join(" "),
  )}`;
