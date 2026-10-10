create extension if not exists "pgcrypto";

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  cliente text not null,
  quantidade int not null check (quantidade > 0),
  valor_total numeric(10,2) not null check (valor_total >= 0),
  pago boolean not null default false,
  pago_em timestamptz,
  entregue boolean not null default false,
  entregue_em timestamptz,
  data_entrega date,
  obs text,
  cancelado boolean not null default false
);
create index pedidos_cliente_idx on pedidos (lower(cliente));
create index pedidos_criado_idx on pedidos (criado_em desc);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  data date not null default ((now() at time zone 'America/Campo_Grande')::date),
  descricao text not null,
  valor numeric(10,2) not null check (valor >= 0)
);

create table mensagens (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  criado_em timestamptz not null default now()
);
create index mensagens_chat_idx on mensagens (chat_id, id desc);

create table telegram_updates (
  update_id bigint primary key,
  criado_em timestamptz not null default now()
);

create table config (
  chave text primary key,
  valor text not null
);
insert into config (chave, valor) values ('preco_pote', '12'); -- AJUSTE o preço real

alter table pedidos enable row level security;
alter table gastos enable row level security;
alter table mensagens enable row level security;
alter table telegram_updates enable row level security;
alter table config enable row level security;
-- Sem policies de propósito: só a service role (servidor) acessa.
