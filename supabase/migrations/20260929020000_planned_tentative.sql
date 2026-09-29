-- Valores possíveis (não garantidos): ficam fora do cálculo seguro e entram só no cenário "com os possíveis"
alter table public.planned add column tentative boolean not null default false;
