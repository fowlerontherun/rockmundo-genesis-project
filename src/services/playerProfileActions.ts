import { supabase } from "@/integrations/supabase/client";

export interface TransferableEquipment {
  inventory_id: string;
  equipment_id: string;
  name: string;
  category: string;
  condition: number;
}

export interface ManageableVacancy {
  vacancy_id: string;
  company_id: string;
  company_name: string;
  job_title: string;
  weekly_wage: number;
  employment_type: string;
  positions_available: number;
  positions_filled: number;
}

export async function listTransferableEquipment(senderProfileId: string): Promise<TransferableEquipment[]> {
  const { data, error } = await (supabase as any).rpc("list_transferable_equipment", {
    sender_profile_id: senderProfileId,
  });
  if (error) throw error;
  return (data ?? []) as TransferableEquipment[];
}

export async function sendEquipmentToPlayer(params: {
  senderProfileId: string;
  targetProfileId: string;
  inventoryId: string;
  note?: string;
}) {
  const { data, error } = await (supabase as any).rpc("send_equipment_to_player", {
    target_profile_id: params.targetProfileId,
    inventory_id: params.inventoryId,
    sender_profile_id: params.senderProfileId,
    note: params.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function sendMoneyToPlayer(params: {
  senderProfileId: string;
  targetProfileId: string;
  amount: number;
  note?: string;
}) {
  const amount = Math.trunc(params.amount);
  if (!Number.isFinite(amount) || amount < 1) throw new Error("Enter an amount of at least 1.");
  if (amount > 1_000_000) throw new Error("A single transfer cannot exceed 1,000,000.");

  const { data, error } = await (supabase as any).rpc("send_money_to_player", {
    target_profile_id: params.targetProfileId,
    amount,
    sender_profile_id: params.senderProfileId,
    note: params.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function listManageableJobVacancies(actorProfileId: string): Promise<ManageableVacancy[]> {
  const { data, error } = await (supabase as any).rpc("list_manageable_job_vacancies", {
    actor_profile_id: actorProfileId,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    weekly_wage: Number(row.weekly_wage ?? 0),
    positions_available: Number(row.positions_available ?? 0),
    positions_filled: Number(row.positions_filled ?? 0),
  })) as ManageableVacancy[];
}

export async function offerJobToPlayer(params: {
  targetProfileId: string;
  vacancyId: string;
  message?: string;
}) {
  const { data, error } = await (supabase as any).rpc("offer_company_vacancy_to_player", {
    p_vacancy_id: params.vacancyId,
    p_target_profile_id: params.targetProfileId,
    p_message: params.message?.trim() || null,
  });
  if (error) throw error;
  return data;
}
