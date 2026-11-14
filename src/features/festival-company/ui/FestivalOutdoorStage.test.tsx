import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FestivalOutdoorStage from "./FestivalOutdoorStage";

const mocks = vi.hoisted(() => ({
  destroy: vi.fn(), settings: vi.fn(), dispose: vi.fn(), prime: vi.fn(),
  play: vi.fn(), load: vi.fn(), select: vi.fn(), fail: false,
}));

vi.mock("@/features/gig-demo-3d/ConcertScene", () => ({
  ConcertScene: class {
    destroy = mocks.destroy;
    setSettings = mocks.settings;
    constructor(_canvas: HTMLCanvasElement, _settings: unknown, _stats: unknown, state: (value: string) => void) {
      if (mocks.fail) throw new Error("WebGL unavailable");
      state("ready");
    }
  },
}));

vi.mock("@/features/shared-audio/CrowdAudioManager", () => ({
  CrowdAudioManager: class {
    dispose = mocks.dispose;
    prime = mocks.prime;
    setCrowdVolume() {}
    setAmbience = mocks.play;
  },
}));

vi.mock("@/features/shared-audio/crowdAudioCatalogue", () => ({
  loadCuratedCrowdAssets: mocks.load,
  selectCuratedCrowdClip: mocks.select,
}));

const stage = { editionId: "edition", stageId: "main", stageName: "Main Stage", capacity: 5000, reducedMotion: false };

it("recovers from a renderer failure and stops crowd audio when its snapshot disappears", async () => {
  mocks.fail = true;
  mocks.load.mockResolvedValue([{ id: "festival-loop", loopable: true }]);
  mocks.select.mockReturnValue({ id: "festival-loop" });
  mocks.play.mockResolvedValue(true);
  const view = render(<FestivalOutdoorStage {...stage} crowdBand="busy" />);
  expect(screen.getByRole("alert")).toHaveTextContent("3D stage unavailable");
  mocks.fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry 3D stage" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Camera" }), { target: { value: "crane" } });
  expect(mocks.settings).toHaveBeenLastCalledWith(expect.objectContaining({ camera: "crane" }));
  expect(mocks.load).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Play crowd audio" }));
  expect(await screen.findByText("Crowd ambience playing.")).toBeVisible();
  expect(mocks.select).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ environment: "festival" }));
  view.rerender(<FestivalOutdoorStage {...stage} />);
  expect(mocks.dispose).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Play crowd audio" })).toBeNull();
  view.unmount();
  expect(mocks.destroy).toHaveBeenCalledOnce();
});
