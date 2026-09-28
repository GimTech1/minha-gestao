-- Contas previstas (fixas, parceladas, avulsas) e o vínculo do lançamento que paga cada mês
create table public.planned (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null default 'expense' check (kind in ('expense','income')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  category_id uuid references public.categories(id) on delete set null,
  method text check (method in ('pix','credito','debito','dinheiro','boleto','transferencia','outro')),
  type text not null default 'monthly' check (type in ('monthly','installments','once')),
  day int not null check (day between 1 and 31),
  start_month date not null,
  installments int check (installments is null or installments between 2 and 480),
  end_month date,
  skipped_months date[] not null default '{}',
  created_at timestamptz not null default now()
);
create index planned_user_idx on public.planned(user_id);
create index planned_category_idx on public.planned(category_id);

alter table public.planned enable row level security;
create policy "own planned" on public.planned for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Lançamento que "paga" uma ocorrência (conta prevista + mês)
alter table public.transactions
  add column planned_id uuid references public.planned(id) on delete set null,
  add column planned_month date;
create unique index transactions_planned_idx on public.transactions(planned_id, planned_month) where planned_id is not null;

alter publication supabase_realtime add table public.planned;
