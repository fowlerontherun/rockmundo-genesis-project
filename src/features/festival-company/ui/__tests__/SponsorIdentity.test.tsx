import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SponsorIdentity } from "../SponsorIdentity";

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
