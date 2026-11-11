"""Exercise lottery settlement with two independent PostgreSQL transactions.

Run against a fresh local PostgreSQL database named rockmundo_lottery_test.
Connection settings use the standard libpq environment variables.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import os
import time

import psycopg


ROOT = Path(__file__).resolve().parents[2]
DRAW = "select public.process_weekly_lottery_draw()"
MIGRATIONS = (
    "20261019063411_lottery_7_of_49_purchase_draw_contract.sql",
    "20261019064627_lottery_internal_due_time_draw_guard_20261019.sql",
)

# The real migrations provide the purchase, draw and settlement functions.
# Only the tables and roles they reference are needed in this database.
SCHEMA = """
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cash integer not null,
  fame integer not null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  died_at timestamptz
);
create table public.lottery_draws (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  jackpot_amount integer not null,
  status text not null default 'pending',
  winning_numbers integer[],
  bonus_number integer,
  draw_date timestamptz
);
create table public.lottery_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id),
  draw_id uuid not null references public.lottery_draws(id),
  selected_numbers integer[] not null,
  bonus_number integer not null,
  claimed boolean not null default false,
  matches integer,
  bonus_matched boolean,
  prize_cash integer,
  prize_xp integer,
  prize_fame integer
);
create table public.player_xp_wallet (
  profile_id uuid primary key references public.profiles(id),
  xp_balance integer,
  lifetime_xp integer,
  skill_xp_balance integer,
  skill_xp_lifetime integer,
  last_recalculated timestamptz
);
create table public.experience_ledger (
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id),
  activity_type text not null,
  xp_amount integer not null,
  metadata jsonb not null
);
"""


def main():
    if os.environ.get("PGHOSTADDR") or os.environ.get("PGHOST") != "127.0.0.1":
        raise SystemExit("Use an isolated loopback PostgreSQL instance (PGHOST=127.0.0.1).")

    connection_options = {"dbname": "rockmundo_lottery_test", "connect_timeout": 5}
    with psycopg.connect(**connection_options, autocommit=True) as observer:
        observer.execute(SCHEMA)
        for migration in MIGRATIONS:
            observer.execute((ROOT / "supabase/migrations" / migration).read_text())

        profile_id, user_id = observer.execute("""
            insert into public.profiles(user_id, cash, fame)
            values (gen_random_uuid(), 10, 5) returning id, user_id
        """).fetchone()
        future_id = observer.execute("""
            insert into public.lottery_draws(week_start, jackpot_amount)
            values (date_trunc('week', now() at time zone 'UTC')::date, 1000000)
            returning id
        """).fetchone()[0]

        with psycopg.connect(**connection_options) as buyer:
            buyer.execute("set local role authenticated")
            buyer.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(user_id),))
            future_ticket = buyer.execute(
                "select id from public.buy_lottery_ticket_atomic(%s,%s,array[1,2,3,4,5,6,7],3)",
                (profile_id, future_id),
            ).fetchone()[0]

        assert observer.execute(DRAW).fetchone()[0] == {"status": "no_due_draw"}
        due_id = observer.execute("""
            insert into public.lottery_draws
              (week_start, jackpot_amount, status, winning_numbers, bonus_number, draw_date)
            values ('2020-01-06', 1000000, 'drawn', array[1,2,3,4,5,6,7], 3, now())
            returning id
        """).fetchone()[0]
        ticket_id = observer.execute("""
            insert into public.lottery_tickets
              (user_id, profile_id, draw_id, selected_numbers, bonus_number)
            values (%s, %s, %s, array[1,2,3,4,5,6,7], 3) returning id
        """, (user_id, profile_id, due_id)).fetchone()[0]

        with (
            psycopg.connect(**connection_options) as first,
            psycopg.connect(**connection_options) as second,
            ThreadPoolExecutor(max_workers=1) as pool,
        ):
            for connection in (first, second):
                connection.execute("set local role service_role")
                connection.execute("set local statement_timeout = '15s'")

            first_pid = first.info.backend_pid
            second_pid = second.info.backend_pid
            result = first.execute(DRAW).fetchone()[0]
            try:
                retry = pool.submit(lambda: second.execute(DRAW).fetchone()[0])
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline and not retry.done():
                    blockers = observer.execute(
                        "select pg_blocking_pids(%s)", (second_pid,)
                    ).fetchone()[0]
                    if first_pid in blockers:
                        break
                    time.sleep(0.05)
                else:
                    raise AssertionError("The second draw call did not wait for the first transaction.")

                first.commit()
                assert retry.result(timeout=10) == {"status": "no_due_draw"}
            finally:
                first.rollback()

        assert result == {
            "status": "paid_out", "draw_id": str(due_id),
            "tickets_processed": 1, "total_prizes_paid": 1000000,
        }
        assert observer.execute(DRAW).fetchone()[0] == {"status": "no_due_draw"}
        assert observer.execute("""
            select status, winning_numbers, bonus_number from public.lottery_draws where id = %s
        """, (due_id,)).fetchone() == ("paid_out", [1, 2, 3, 4, 5, 6, 7], 3)
        assert observer.execute("""
            select claimed, matches, bonus_matched, prize_cash, prize_xp, prize_fame
            from public.lottery_tickets where id = %s
        """, (ticket_id,)).fetchone() == (True, 7, True, 1000000, 10000, 5000)
        assert observer.execute("select cash, fame from public.profiles").fetchall() == [(1000008, 5005)]
        assert observer.execute("""
            select xp_balance, lifetime_xp, skill_xp_balance, skill_xp_lifetime
            from public.player_xp_wallet where profile_id = %s
        """, (profile_id,)).fetchone() == (10000, 10000, 10000, 10000)
        assert observer.execute("""
            select activity_type, xp_amount, metadata->>'ticket_id' from public.experience_ledger
        """).fetchall() == [("lottery", 10000, str(ticket_id))]
        assert observer.execute("""
            select d.status, t.claimed
            from public.lottery_draws d join public.lottery_tickets t on t.draw_id = d.id
            where d.id = %s and t.id = %s
        """, (future_id, future_ticket)).fetchone() == ("pending", False)

        observer.execute(
            (ROOT / "supabase/tests/lottery_cron_only_draw_authority_harness.sql").read_text()
        )
        print("Lottery cutoff, overlapping draw calls, exact-once settlement and replay passed.")


if __name__ == "__main__":
    main()
