import { describe, expect, it } from "vitest";
import { chooseEducationMethod, hasNoListedEducationResources } from "./educationMethodChoice";

describe("skill-first learning method selection", () => {
  const counts = { books: 0, university: 2, videos: 4, mentors: 1 };
  it("starts with a matching activity type for a skill", () => {
    expect(chooseEducationMethod("find", true, counts)).toBe("videos");
    expect(chooseEducationMethod(null, true, { books: 2, university: 4, videos: 0, mentors: 1 })).toBe("books");
    expect(chooseEducationMethod(null, true, { books: 0, university: 1, videos: 0, mentors: 0 })).toBe("university");
  });
  it("preserves method-specific bookmarks and manual selection", () => {
    for (const method of ["books", "university", "videos", "mentors", "players"]) {
      expect(chooseEducationMethod(method, true, counts)).toBe(method);
    }
  });
  it("retains Books as the general browsing default", () => {
    expect(chooseEducationMethod(null, false, counts)).toBe("books");
    expect(chooseEducationMethod("find", true, null)).toBe("books");
  });
  it("does not count unverified availability as no resources", () => {
    expect(hasNoListedEducationResources({ books: null, university: 0, videos: 0, mentors: 0 })).toBe(false);
    expect(hasNoListedEducationResources(null)).toBe(false);
    expect(hasNoListedEducationResources({ books: 0, university: 0, videos: 0, mentors: 0 })).toBe(true);
  });
});
