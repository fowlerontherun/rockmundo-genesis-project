import { supabase } from "@/integrations/supabase/client";

export type WalletBankTransferResult = {
  transactionId: string;
  currencyCode: string;
  walletBalanceMinor: number;
  bankBalanceMinor: number;
  idempotent: boolean;
};

export type BankAccountTransferResult = {
  transactionId: string;
  currencyCode: string;
  sourceBalanceMinor: number;
  destinationBalanceMinor: number;
  idempotent: boolean;
};

const throwRpcError = (error: { message?: string } | null, fallback: string) => {
  if (error) throw new Error(error.message || fallback);
};

export const depositWalletToBank = async ({
  bankAccountId,
  amountMinor,
  idempotencyKey,
}: {
  bankAccountId: string;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<WalletBankTransferResult> => {
  const { data, error } = await (supabase.rpc as any)(
    "deposit_my_wallet_to_bank",
    {
      p_bank_account_id: bankAccountId,
      p_amount_minor: amountMinor,
      p_idempotency_key: idempotencyKey,
    },
  );

  throwRpcError(error, "The wallet deposit could not be completed.");
  if (!data) throw new Error("wallet_deposit_empty_response");
  return data as WalletBankTransferResult;
};

export const withdrawBankToWallet = async ({
  bankAccountId,
  amountMinor,
  idempotencyKey,
}: {
  bankAccountId: string;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<WalletBankTransferResult> => {
  const { data, error } = await (supabase.rpc as any)(
    "withdraw_my_bank_to_wallet",
    {
      p_bank_account_id: bankAccountId,
      p_amount_minor: amountMinor,
      p_idempotency_key: idempotencyKey,
    },
  );

  throwRpcError(error, "The bank withdrawal could not be completed.");
  if (!data) throw new Error("bank_withdrawal_empty_response");
  return data as WalletBankTransferResult;
};

export const transferBetweenBankAccounts = async ({
  sourceBankAccountId,
  destinationBankAccountId,
  amountMinor,
  idempotencyKey,
}: {
  sourceBankAccountId: string;
  destinationBankAccountId: string;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<BankAccountTransferResult> => {
  const { data, error } = await (supabase.rpc as any)(
    "transfer_between_my_bank_accounts",
    {
      p_source_bank_account_id: sourceBankAccountId,
      p_destination_bank_account_id: destinationBankAccountId,
      p_amount_minor: amountMinor,
      p_idempotency_key: idempotencyKey,
    },
  );

  throwRpcError(error, "The account transfer could not be completed.");
  if (!data) throw new Error("bank_transfer_empty_response");
  return data as BankAccountTransferResult;
};
