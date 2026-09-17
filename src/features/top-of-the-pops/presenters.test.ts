import { describe, expect, it } from "vitest";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";

describe("Top of the Pops presenter profiles", () => {
  it("resolves the configured guest presenter identity", () => {
    const presenter = resolveTotpPresenter("nia_vale");
    expect(presenter.key).toBe("nia_vale");
    expect(presenter.displayName).toBe("Nia Vale");
    expect(presenter.role).toBe("Guest presenter");
  });

  it("falls back safely to Alex Rayne for unknown presenter keys", () => {
    const presenter = resolveTotpPresenter("not_a_real_presenter");
    expect(presenter.key).toBe("alex_rayne");
    expect(presenter.displayName).toBe("Alex Rayne");
  });

  it("labels special editions without labelling regular shows", () => {
    expect(totpVariantLabel("guest_host")).toBe("Guest host edition");
    expect(totpVariantLabel("milestone")).toBe("Milestone edition");
    expect(totpVariantLabel("christmas")).toBe("Christmas special");
    expect(totpVariantLabel("anniversary")).toBe("Anniversary special");
    expect(totpVariantLabel("regular")).toBeNull();
  });
});
