import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalBrandArtwork, FestivalLineupRibbon } from "./FestivalBrandArtwork";

const festival = {
  id: "edition", name: "Moonlight Festival", festivalType: "Rock", vibe: "Electric", scale: "City",
  heroImageReference: "/festival-poster.webp",
};

afterEach(cleanup);

describe("published festival art", () => {
  it("renders a curated image as decorative and leaves text readable when the image fails", () => {
    const { container } = render(<FestivalBrandArtwork festival={festival} />);
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/festival-poster.webp");
    expect(image).toHaveAttribute("alt", "");
    fireEvent.error(image!);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("Moonlight Festival");
    expect(container).toHaveTextContent("Rock · City");
  });

  it("rejects executable and protocol-relative image references without hiding the poster", () => {
    const { container, rerender } = render(<FestivalBrandArtwork festival={{ ...festival, heroImageReference: "javascript:alert(1)" }} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<FestivalBrandArtwork festival={{ ...festival, heroImageReference: "//example.com/art.png" }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("Moonlight Festival");
  });

  it("does not present procedurally drawn artist art as real performer media", () => {
    const act = { id: "act", artistName: "The Moonlights", artistType: "band" as const, genre: "Rock", billingPosition: "headliner", festivalDate: null, stageName: "Main", startsAt: null, endsAt: null };
    const { container } = render(<FestivalLineupRibbon act={act} />);
    expect(container).toHaveTextContent("The Moonlights");
    expect(container).toHaveTextContent("Headline act");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
