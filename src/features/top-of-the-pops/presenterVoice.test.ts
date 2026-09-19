import { describe, expect, it } from "vitest";
import {
  pickTotpPresenterVoice,
  prepareTotpPresenterScript,
  splitTotpPresenterScript,
  totpPresenterVoiceProfile,
} from "./presenterVoice";

describe("presenter voice", () => {
  it("gives every presenter a distinct voice colour", () => {
    const alex = totpPresenterVoiceProfile("alex_rayne");
    const maya = totpPresenterVoiceProfile("maya_stone");
    expect(maya.pitch).toBeGreaterThan(alex.pitch);
    expect(totpPresenterVoiceProfile("unknown").rate).toBe(alex.rate);
  });

  it("prefers a British voice matching the presenter gender", () => {
    const voices = [
      { name: "Zarvox", lang: "en-US" },
      { name: "Google US English", lang: "en-US" },
      { name: "Serena", lang: "en-GB" },
      { name: "Daniel", lang: "en-GB" },
    ];
    expect(pickTotpPresenterVoice(voices, totpPresenterVoiceProfile("maya_stone"))?.name).toBe("Serena");
    expect(pickTotpPresenterVoice(voices, totpPresenterVoiceProfile("alex_rayne"))?.name).toBe("Daniel");
    expect(pickTotpPresenterVoice([], totpPresenterVoiceProfile("alex_rayne"))).toBeNull();
  });

  it("tidies broadcast shorthand for speech", () => {
    expect(prepareTotpPresenterScript("No. 1 in the UK  — live!")).toBe("number 1 in the U K, live!");
    expect(prepareTotpPresenterScript("Rock & roll")).toBe("Rock and roll.");
  });

  it("splits long links into sentence-sized utterances", () => {
    const parts = splitTotpPresenterScript("First line here. Second line here. Third line here.", 25);
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part) => expect(part.length).toBeLessThanOrEqual(40));
    expect(splitTotpPresenterScript("   ")).toEqual([]);
  });
});
