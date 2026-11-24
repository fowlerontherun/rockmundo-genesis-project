import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SongSoundDesignFields } from "./SongSoundDesignFields";

describe("Advanced Songwriting sound controls", () => {
  it("starts with all creative settings optional", () => {
    render(<SongSoundDesignFields value={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Define Your Sound")).toBeInTheDocument();
    expect(screen.getByLabelText("Tempo (BPM)")).toHaveValue(null);
    expect(screen.getByText(/All settings are optional/)).toBeInTheDocument();
  });

  it("converts BPM input to a bounded numeric preference", () => {
    const onChange = vi.fn();
    render(<SongSoundDesignFields value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Tempo (BPM)"), { target: { value: "118" } });
    expect(onChange).toHaveBeenCalledWith({ bpm: 118 });
  });
});
