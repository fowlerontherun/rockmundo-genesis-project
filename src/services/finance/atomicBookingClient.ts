import { supabase } from "@/integrations/supabase/client";

type RpcError = { message?: string } | null;
type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: RpcError }>;

const bookingRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

interface CountResult {
  count: number | null;
  error: RpcError;
}

interface CountQuery extends PromiseLike<CountResult> {
  eq(column: string, value: unknown): CountQuery;
  neq(column: string, value: unknown): CountQuery;
}

interface CountTable {
  select(
    columns: string,
    options: { count: "exact"; head: true },
  ): CountQuery;
}

type UntypedCountFrom = (table: string) => CountTable;
const countFrom = supabase.from.bind(supabase) as unknown as UntypedCountFrom;

interface InsertResult {
  error: RpcError;
}

interface InsertQuery extends PromiseLike<InsertResult> {}

interface InsertTable {
  insert(values: Record<string, unknown> | Record<string, unknown>[]): InsertQuery;
}

type UntypedInsertFrom = (table: string) => InsertTable;
const insertFrom = supabase.from.bind(supabase) as unknown as UntypedInsertFrom;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const numberValue = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanValue = (value: unknown): boolean => value === true;

export interface AtomicRehearsalResult {
  idempotent?: boolean;
  bookingId: string;
  totalCost: number;
  paymentSource: "band" | "personal";
  payerBalanceAfterMinor?: number;
  chemistryGain?: number;
  xpEarned?: number;
  familiarityGained?: number;
}

export interface AtomicRecordingResult {
  idempotent?: boolean;
  bookingId: string;
  totalCost: number;
  studioCost?: number;
  producerCost?: number;
  orchestraCost?: number;
  paymentSource: "band" | "personal";
  payerBalanceAfterMinor?: number;
  qualityImprovement?: number;
  labelStudioFree?: boolean;
}

export interface BandTreasurySummary {
  availableBalanceMinor: number;
  isPrimary: boolean;
}

export interface BandTreasuryDashboard {
  status: string | null;
  treasuries: BandTreasurySummary[];
}

export interface BookingInboxMessage {
  user_id: string;
  category: "system";
  priority: "normal";
  title: string;
  message: string;
  action_type: string;
  action_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const parsePaymentSource = (
  value: unknown,
): "band" | "personal" | null =>
  value === "band" || value === "personal" ? value : null;

const parseAtomicRehearsalResult = (
  data: unknown,
): AtomicRehearsalResult | null => {
  if (!isRecord(data)) return null;

  const bookingId = stringValue(data.bookingId);
  const totalCost = numberValue(data.totalCost);
  const paymentSource = parsePaymentSource(data.paymentSource);
  if (!bookingId || totalCost === null || !paymentSource) return null;

  return {
    idempotent: booleanValue(data.idempotent),
    bookingId,
    totalCost,
    paymentSource,
    payerBalanceAfterMinor: numberValue(data.payerBalanceAfterMinor) ?? undefined,
    chemistryGain: numberValue(data.chemistryGain) ?? undefined,
    xpEarned: numberValue(data.xpEarned) ?? undefined,
    familiarityGained: numberValue(data.familiarityGained) ?? undefined,
  };
};

const parseAtomicRecordingResult = (
  data: unknown,
): AtomicRecordingResult | null => {
  if (!isRecord(data)) return null;

  const bookingId = stringValue(data.bookingId);
  const totalCost = numberValue(data.totalCost);
  const paymentSource = parsePaymentSource(data.paymentSource);
  if (!bookingId || totalCost === null || !paymentSource) return null;

  return {
    idempotent: booleanValue(data.idempotent),
    bookingId,
    totalCost,
    studioCost: numberValue(data.studioCost) ?? undefined,
    producerCost: numberValue(data.producerCost) ?? undefined,
    orchestraCost: numberValue(data.orchestraCost) ?? undefined,
    paymentSource,
    payerBalanceAfterMinor: numberValue(data.payerBalanceAfterMinor) ?? undefined,
    qualityImprovement: numberValue(data.qualityImprovement) ?? undefined,
    labelStudioFree: booleanValue(data.labelStudioFree),
  };
};

export async function getBandTreasuryDashboard(
  bandId: string,
): Promise<BandTreasuryDashboard | null> {
  const { data, error } = await bookingRpc("get_band_treasury_dashboard", {
    p_band_id: bandId,
  });

  if (error || !isRecord(data)) return null;

  const treasuries = Array.isArray(data.treasuries)
    ? data.treasuries.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const availableBalanceMinor = numberValue(entry.availableBalanceMinor);
        if (availableBalanceMinor === null) return [];
        return [
          {
            availableBalanceMinor,
            isPrimary: booleanValue(entry.isPrimary),
          },
        ];
      })
    : [];

  return {
    status: stringValue(data.status),
    treasuries,
  };
}

export async function fundBandFromWallet(
  bandId: string,
  amountMinor: number,
  note: string,
): Promise<{ error: RpcError }> {
  const { error } = await bookingRpc("fund_my_band", {
    p_band_id: bandId,
    p_source_kind: "wallet",
    p_source_account_id: null,
    p_amount_minor: amountMinor,
    p_note: note,
    p_idempotency_key: crypto.randomUUID(),
  });
  return { error };
}

export async function confirmRehearsalBookingAtomic(args: {
  bandId: string;
  roomId: string;
  durationHours: number;
  songId: string | null;
  setlistId: string | null;
  scheduledStart: string;
  paymentSource: "band" | "personal";
  idempotencyKey: string;
}): Promise<{ data: AtomicRehearsalResult | null; error: RpcError }> {
  const { data, error } = await bookingRpc("confirm_rehearsal_booking_atomic", {
    p_band_id: args.bandId,
    p_room_id: args.roomId,
    p_duration_hours: args.durationHours,
    p_song_id: args.songId,
    p_setlist_id: args.setlistId,
    p_scheduled_start: args.scheduledStart,
    p_payment_source: args.paymentSource,
    p_idempotency_key: args.idempotencyKey,
  });

  return { data: parseAtomicRehearsalResult(data), error };
}

export async function confirmRecordingSessionAtomic(args: {
  bandId: string | null;
  studioId: string;
  producerId: string;
  songId: string;
  durationHours: number;
  orchestraSize: "" | "chamber" | "small" | "full";
  recordingVersion: "standard" | "remix" | "acoustic";
  recordingType: "demo" | "professional";
  rehearsalBonus: number;
  scheduledStart: string;
  scheduledEnd: string;
  paymentSource: "band" | "personal";
  idempotencyKey: string;
}): Promise<{ data: AtomicRecordingResult | null; error: RpcError }> {
  const { data, error } = await bookingRpc("confirm_recording_session_atomic", {
    p_band_id: args.bandId,
    p_studio_id: args.studioId,
    p_producer_id: args.producerId,
    p_song_id: args.songId,
    p_duration_hours: args.durationHours,
    p_orchestra_size: args.orchestraSize,
    p_recording_version: args.recordingVersion,
    p_recording_type: args.recordingType,
    p_rehearsal_bonus: args.rehearsalBonus,
    p_scheduled_start: args.scheduledStart,
    p_scheduled_end: args.scheduledEnd,
    p_payment_source: args.paymentSource,
    p_idempotency_key: args.idempotencyKey,
  });

  return { data: parseAtomicRecordingResult(data), error };
}

export async function hasScheduledBookingProjection(
  linkedColumn: "linked_rehearsal_id" | "linked_recording_id",
  bookingId: string,
): Promise<boolean> {
  const { count, error } = await countFrom("player_scheduled_activities")
    .select("id", { count: "exact", head: true })
    .eq(linkedColumn, bookingId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message || "scheduled_activity_projection_check_failed");
  }

  return (count ?? 0) > 0;
}

export async function insertBookingInboxMessages(
  rows: BookingInboxMessage[],
): Promise<void> {
  if (rows.length === 0) return;

  const values = rows.map((row) => ({ ...row }));
  const { error } = await insertFrom("player_inbox").insert(values);
  if (error) {
    throw new Error(error.message || "booking_notification_insert_failed");
  }
}
