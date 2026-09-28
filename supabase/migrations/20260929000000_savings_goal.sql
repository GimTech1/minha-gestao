-- Quanto o usuário quer guardar por mês; o limite diário do "posso gastar?" desconta esse valor
alter table public.profiles add column savings_goal numeric(12,2) check (savings_goal is null or savings_goal >= 0);
