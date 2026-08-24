import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

test.describe('finance booking and recovery browser gate', () => {
  test('rehearsal booking exposes authoritative payer and recovery UX', async ({ page }) => {
    const selector = read('src/components/bands/BandPaymentSourceSelector.tsx');
    const hook = read('src/hooks/useBandPaymentSource.ts');
    const booking = read('src/hooks/useRehearsalBooking.ts');

    expect(selector).toContain('Paying with');
    expect(selector).toContain('Band default');
    expect(selector).toContain('short — switch source or top up');
    expect(hook).toContain('treasury_available');
    expect(hook).not.toContain('treasury_available ?? bandRow?.band_balance');
    expect(booking).toContain('insufficient_band_funds');
    expect(booking).toContain('band_treasury_missing');

    await page.goto('/rehearsals');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Could not find the function public.confirm_rehearsal_booking_atomic');
  });

  test('recording uses the atomic booking authority and readable finance failures', async () => {
    const recording = read('src/hooks/useRecordingDataAtomic.tsx');
    const client = read('src/services/finance/atomicBookingClient.ts');

    expect(recording).toContain('confirmRecordingBookingAtomic');
    expect(client).toContain('confirm_recording_booking_atomic');
    expect(client).toContain('cancel_recording_session_atomic');
  });

  test('refunds are source-aware and replay-safe', async () => {
    const a2 = read('supabase/migrations/20260824104500_finance_a2_refunds_obligation_mortgage_repair.sql');

    expect(a2).toContain('booking_refunds');
    expect(a2).toContain('_refund_atomic_booking_payment');
    expect(a2).toContain("payment_source IN ('band', 'personal')");
    expect(a2).toContain('cancel_rehearsal_booking_atomic');
    expect(a2).toContain('cancel_recording_session_atomic');
    expect(a2).toContain('pg_advisory_xact_lock');
  });

  test('mortgage and obligation retry protections remain wired into the release gate', async () => {
    const a2 = read('supabase/migrations/20260824104500_finance_a2_refunds_obligation_mortgage_repair.sql');

    expect(a2).toContain('process_financial_obligation_payment_guarded');
    expect(a2).toContain('next_retry_at');
    expect(a2).toContain('sync_mortgage_financial_obligation_schedule');
    expect(a2).toContain('source_schedule_version');
  });

  test('missing treasury recovery cannot manufacture funds', async () => {
    const a3 = read('supabase/migrations/20260824111500_finance_a3_treasury_projection_and_recovery.sql');

    expect(a3).toContain('ensure_my_band_treasury');
    expect(a3).toContain("'USD',\n      0,\n      0,\n      true");
    expect(a3).toContain('availableBalanceMinor');
  });
});
