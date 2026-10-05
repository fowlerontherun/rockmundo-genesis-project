export interface LuthieryInstrumentVisual {
  instrumentName: string;
  instrumentKind: "electric_guitar" | "electric_bass";
  shapeId: string;
  shapeName: string;
  colour: string;
  finalQuality: number;
  makerName?: string | null;
  materialSnapshot?: Array<Record<string, unknown>>;
  finalStats?: Record<string, number>;
  buildSpec?: Record<string, unknown>;
}

export interface StageLuthieryInstrumentRow {
  profile_id: string;
  instrument_name: string;
  instrument_kind: string;
  shape_id: string;
  shape_name: string;
  colour: string;
  final_quality: number;
  build_spec?: Record<string, unknown> | null;
}

export function normalizeStageLuthieryInstrument(
  row: StageLuthieryInstrumentRow,
): LuthieryInstrumentVisual | null {
  if (!row?.profile_id || !row.instrument_name || !row.shape_id) return null;
  if (row.instrument_kind !== "electric_guitar" && row.instrument_kind !== "electric_bass") return null;
  return {
    instrumentName: row.instrument_name,
    instrumentKind: row.instrument_kind,
    shapeId: row.shape_id,
    shapeName: row.shape_name || row.shape_id,
    colour: /^#[0-9a-f]{6}$/i.test(row.colour || "") ? row.colour : "#8b5a2b",
    finalQuality: Math.max(0, Math.min(100, Number(row.final_quality ?? 0))),
    buildSpec: row.build_spec ?? {},
  };
}

export function normalizeReplayLuthieryInstrument(value: unknown): LuthieryInstrumentVisual | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const instrumentKind = row.instrumentKind;
  if (instrumentKind !== "electric_guitar" && instrumentKind !== "electric_bass") return null;
  const colour = String(row.colour ?? "");
  return {
    instrumentName: String(row.instrumentName ?? "Player-crafted instrument"),
    instrumentKind,
    shapeId: String(row.shapeId ?? "double-cut"),
    shapeName: String(row.shapeName ?? row.shapeId ?? "Custom"),
    colour: /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#8b5a2b",
    finalQuality: Math.max(0, Math.min(100, Number(row.finalQuality ?? 0))),
    makerName: row.makerName == null ? null : String(row.makerName),
    materialSnapshot: Array.isArray(row.materialSnapshot) ? row.materialSnapshot as Array<Record<string, unknown>> : [],
    finalStats: row.finalStats && typeof row.finalStats === "object" ? row.finalStats as Record<string, number> : {},
    buildSpec: row.buildSpec && typeof row.buildSpec === "object" ? row.buildSpec as Record<string, unknown> : {},
  };
}
