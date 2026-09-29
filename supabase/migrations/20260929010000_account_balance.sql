-- Saldo em conta informado pelo usuário; o app soma/subtrai os lançamentos feitos depois de balance_at
alter table public.profiles
  add column balance_amount numeric(12,2),
  add column balance_at timestamptz;
