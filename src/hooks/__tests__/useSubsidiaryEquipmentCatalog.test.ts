import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  subsidiaryEquipmentDailyRate,
  subsidiaryEquipmentHourlyRate,
  subsidiaryEquipmentType,
} from "../useSubsidiaryEquipmentCatalog";

describe("subsidiary catalog item eligibility", () => {
  it("allows supported recording equipment", () => {
    expect(subsidiaryEquipmentType("recording_equipment", { category: "recording", subcategory: "dynamic_mic" })).toBe("microphone");
    expect(subsidiaryEquipmentType("recording_equipment", { category: "stage", subcategory: "mixer" })).toBe("console");
    expect(subsidiaryEquipmentType("recording_equipment", { category: "stage", subcategory: "monitor" })).toBe("monitor");
    expect(subsidiaryEquipmentType("recording_equipment", { category: "effects", subcategory: "compressor" })).toBe("compressor");
    expect(subsidiaryEquipmentType("recording_equipment", { category: "effects", subcategory: "reverb" })).toBe("reverb");
    expect(subsidiaryEquipmentType("recording_equipment", { category: "instrument", subcategory: "guitar" })).toBe("instrument");
  });

  it("allows supported rehearsal equipment", () => {
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "amplifier", subcategory: "bass_amp" })).toBe("amp");
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "instrument", subcategory: "drums" })).toBe("drums");
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "instrument", subcategory: "synthesizer" })).toBe("keyboard");
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "stage", subcategory: "line_array" })).toBe("pa_system");
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "effects", subcategory: "fuzz" })).toBe("effects_pedals");
  });

  it("rejects unsupported types rather than inventing purchase prices", () => {
    expect(subsidiaryEquipmentType("recording_equipment", { category: "transport", subcategory: "vehicle" })).toBeNull();
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "stage", subcategory: "lighting" })).toBeNull();
    expect(subsidiaryEquipmentType("rehearsal_equipment", { category: "instrument", subcategory: "guitar" })).toBeNull();
    expect(subsidiaryEquipmentType("recording_equipment", { category: "effects", subcategory: "fuzz" })).toBeNull();
  });

  it("shows rental rates calculated by the database formula", () => {
    expect(subsidiaryEquipmentHourlyRate(99)).toBe(5);
    expect(subsidiaryEquipmentHourlyRate(10000)).toBe(50);
    expect(subsidiaryEquipmentDailyRate(10000)).toBe(250);
    expect(subsidiaryEquipmentDailyRate(99)).toBe(5);
  });
});
