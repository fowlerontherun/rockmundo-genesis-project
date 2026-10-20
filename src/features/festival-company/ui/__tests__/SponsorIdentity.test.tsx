import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SponsorIdentity, sponsorLogoNeedsArtworkReview } from "../SponsorIdentity";

describe("festival sponsor identity", () => {
  it("shows a name after image failure, then loads the replacement URL", () => {
    const { rerender } = render(
      <SponsorIdentity name="Rock Audio" logoReference="https://assets.example/old.png" />,
    );
    const oldLogo = screen.getByRole("img", { name: "Rock Audio logo" });
    fireEvent.error(oldLogo);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Rock Audio")).toBeInTheDocument();

    rerender(<SponsorIdentity name="Rock Audio" logoReference="https://assets.example/new.png" />);
    expect(screen.getByRole("img", { name: "Rock Audio logo" }))
      .toHaveAttribute("src", "https://assets.example/new.png");
  });

  it("#4068 shows the seeded fictional SVG data URL and safe same-origin assets", () => {
    const generatedLogo = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    const { rerender } = render(
      <SponsorIdentity name="Seeded Brand" logoReference={generatedLogo} />,
    );
    expect(screen.getByRole("img", { name: "Seeded Brand logo" })).toHaveAttribute("src", generatedLogo);
    rerender(<SponsorIdentity name="Seeded Brand" logoReference="/assets/brand.svg" />);
    expect(screen.getByRole("img", { name: "Seeded Brand logo" })).toHaveAttribute("src", "/assets/brand.svg");
    rerender(<SponsorIdentity name="Seeded Brand" logoReference="data:text/html;base64,PGh0bWw+" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<SponsorIdentity name="Seeded Brand" logoReference="//evil.example/logo.svg" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<SponsorIdentity name="Seeded Brand" logoReference="javascript:alert(1)" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("#2182 flags missing, unsafe and seeded data logos for artwork review", () => {
    expect(sponsorLogoNeedsArtworkReview(null)).toBe(true);
    expect(sponsorLogoNeedsArtworkReview("")).toBe(true);
    expect(sponsorLogoNeedsArtworkReview("javascript:alert(1)")).toBe(true);
    expect(sponsorLogoNeedsArtworkReview("data:image/svg+xml;base64,PHN2Z48L3N2Zz4=")).toBe(true);
    expect(sponsorLogoNeedsArtworkReview("/assets/approved-sponsor.svg")).toBe(false);
    expect(sponsorLogoNeedsArtworkReview("https://assets.example/approved.png")).toBe(false);
  });

  it("falls back to the sponsor name for non-HTTPS and missing references", () => {
    const { rerender } = render(
      <SponsorIdentity name="Local Gear" logoReference="http://unsafe.example/logo.png" />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Local Gear")).toBeInTheDocument();
    rerender(<SponsorIdentity name="Local Gear" logoReference={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
