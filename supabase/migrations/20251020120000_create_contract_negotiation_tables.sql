create table if not exists public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  contract_type text not null,
  clause_key text not null,
  title text not null,
  description text,
  default_terms jsonb not null default '{}'::jsonb,
  sort_order integer,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create unique index if not exists contract_clauses_contract_type_clause_key_idx
  on public.contract_clauses (contract_type, clause_key);

create table if not exists public.contract_negotiations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.artist_label_contracts (id) on delete cascade,
  clause_id uuid not null references public.contract_clauses (id) on delete cascade,
  status text not null default 'pending',
  proposed_terms jsonb,
  counter_terms jsonb,
  last_action_by text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create unique index if not exists contract_negotiations_unique_clause
  on public.contract_negotiations (contract_id, clause_id);
