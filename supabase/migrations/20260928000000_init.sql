-- Schema do Minha Gestão (já aplicado no projeto wzqsfsyfgyuuafhhdvxi)
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  monthly_budget numeric(12,2),
  ingest_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  emoji text not null default '💸',
  color text not null default '#8b8b9e',
  kind text not null default 'expense' check (kind in ('expense','income')),
  keywords text[] not null default '{}',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_user_idx on public.categories(user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null default 'expense' check (kind in ('expense','income')),
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  description text,
  method text check (method in ('pix','credito','debito','dinheiro','boleto','transferencia','outro')),
  occurred_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','auto')),
  raw_text text,
  raw_hash text,
  created_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index transactions_category_idx on public.transactions(category_id);
create unique index transactions_dedupe_idx on public.transactions(user_id, raw_hash) where raw_hash is not null;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "own categories" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Gera um novo token para os Atalhos do iOS
create or replace function public.rotate_ingest_token()
returns uuid language sql security invoker set search_path = '' as $$
  update public.profiles set ingest_token = gen_random_uuid()
  where id = (select auth.uid()) returning ingest_token;
$$;

-- Usuário novo: perfil + categorias iniciais (cores validadas para o fundo escuro)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  insert into public.categories (user_id, name, emoji, color, kind, keywords, sort) values
    (new.id, 'Alimentação', '🍔', '#3987e5', 'expense', array['ifood','restaurante','lanche','padaria','pizza','burger','mc donalds','mcdonalds','almoço','almoco','jantar','café','cafe','rappi','sushi','açaí','acai','lanchonete','cafeteria'], 1),
    (new.id, 'Mercado', '🛒', '#d95926', 'expense', array['mercado','supermercado','carrefour','pão de açúcar','pao de acucar','assai','atacadão','atacadao','hortifruti','sacolão','sacolao','atacarejo'], 2),
    (new.id, 'Transporte', '🚗', '#199e70', 'expense', array['uber','99app','99 pop','posto','combustivel','combustível','gasolina','shell','ipiranga','estacionamento','pedágio','pedagio','sem parar','metro','metrô','ônibus','onibus','cabify'], 3),
    (new.id, 'Casa', '🏠', '#c98500', 'expense', array['aluguel','condominio','condomínio','luz','enel','cemig','sabesp','conta de água','internet','vivo','claro','tim'], 4),
    (new.id, 'Saúde', '💊', '#d55181', 'expense', array['farmacia','farmácia','drogaria','droga raia','drogasil','pague menos','medico','médico','hospital','laboratorio','academia','smartfit','smart fit'], 5),
    (new.id, 'Lazer', '🎉', '#008300', 'expense', array['cinema','show','ingresso','netflix','spotify','prime video','disney','hbo','steam','playstation','xbox','viagem','hotel','airbnb','bar'], 6),
    (new.id, 'Compras', '🛍️', '#9085e9', 'expense', array['amazon','mercado livre','mercadolivre','shopee','shein','magalu','americanas','renner','zara','riachuelo','aliexpress'], 7),
    (new.id, 'Outros', '💸', '#8b8b9e', 'expense', array[]::text[], 99),
    (new.id, 'Salário', '💰', '#199e70', 'income', array['salario','salário','folha','provento'], 1),
    (new.id, 'Entradas', '📥', '#3987e5', 'income', array[]::text[], 2);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.transactions;
