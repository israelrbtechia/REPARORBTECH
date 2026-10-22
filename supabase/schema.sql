-- =============================================================
-- RB Tech Celulares — esquema do Supabase
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode ser executado mais de uma vez sem problemas.
-- =============================================================

create extension if not exists pgcrypto;

-- Lojas (cada assistência é uma loja; funcionários entram por código de convite)
create table if not exists public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_convite text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  criado_em timestamptz not null default now()
);

-- Quem tem acesso a cada loja
create table if not exists public.membros (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  criado_em timestamptz not null default now(),
  primary key (loja_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);

-- Todos os registros do app (OS, clientes, estoque, vendas, financeiro...)
-- Cada linha é um registro de uma coleção, guardado como JSON.
create table if not exists public.itens (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  colecao text not null,
  id text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (loja_id, colecao, id)
);
create index if not exists itens_atualizado_idx on public.itens(loja_id, atualizado_em);

create or replace function public.tocar_itens() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists itens_tocar on public.itens;
create trigger itens_tocar before insert or update on public.itens
  for each row execute function public.tocar_itens();

-- ---------- Funções auxiliares de permissão ----------
create or replace function public.minhas_lojas() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select loja_id from public.membros where user_id = auth.uid()
$$;

create or replace function public.sou_dono(l uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.membros where loja_id = l and user_id = auth.uid() and papel = 'dono')
$$;

-- ---------- Segurança (RLS): cada usuário só vê a própria loja ----------
alter table public.lojas enable row level security;
alter table public.membros enable row level security;
alter table public.itens enable row level security;

drop policy if exists lojas_ver on public.lojas;
create policy lojas_ver on public.lojas for select using (id in (select public.minhas_lojas()));
drop policy if exists lojas_editar on public.lojas;
create policy lojas_editar on public.lojas for update using (public.sou_dono(id));

drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select using (loja_id in (select public.minhas_lojas()));
drop policy if exists membros_remover on public.membros;
create policy membros_remover on public.membros for delete
  using ((public.sou_dono(loja_id) and user_id <> auth.uid()) or (user_id = auth.uid() and papel <> 'dono'));

drop policy if exists itens_ver on public.itens;
create policy itens_ver on public.itens for select using (loja_id in (select public.minhas_lojas()));
drop policy if exists itens_inserir on public.itens;
create policy itens_inserir on public.itens for insert with check (loja_id in (select public.minhas_lojas()));
drop policy if exists itens_editar on public.itens;
create policy itens_editar on public.itens for update using (loja_id in (select public.minhas_lojas())) with check (loja_id in (select public.minhas_lojas()));
drop policy if exists itens_apagar on public.itens;
create policy itens_apagar on public.itens for delete using (loja_id in (select public.minhas_lojas()));

-- ---------- Ações (RPC) ----------
-- Cria uma loja e torna o usuário atual o dono
create or replace function public.criar_loja(p_nome text) returns public.lojas
  language plpgsql security definer set search_path = public as $$
declare l public.lojas;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into public.lojas(nome) values (coalesce(nullif(trim(p_nome), ''), 'Minha Loja')) returning * into l;
  insert into public.membros(loja_id, user_id, email, papel) values (l.id, auth.uid(), auth.jwt() ->> 'email', 'dono');
  return l;
end $$;

-- Entra numa loja existente usando o código de convite
create or replace function public.entrar_na_loja(p_codigo text) returns public.lojas
  language plpgsql security definer set search_path = public as $$
declare l public.lojas;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into l from public.lojas where codigo_convite = upper(trim(p_codigo));
  if not found then raise exception 'Código de convite inválido'; end if;
  insert into public.membros(loja_id, user_id, email, papel) values (l.id, auth.uid(), auth.jwt() ->> 'email', 'membro')
    on conflict (loja_id, user_id) do nothing;
  return l;
end $$;

-- Gera um novo código de convite (só o dono)
create or replace function public.novo_codigo_convite(p_loja uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.sou_dono(p_loja) then raise exception 'apenas o dono pode fazer isso'; end if;
  c := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  update public.lojas set codigo_convite = c where id = p_loja;
  return c;
end $$;

-- só usuários logados podem chamar as ações
revoke all on function public.criar_loja(text) from public, anon;
revoke all on function public.entrar_na_loja(text) from public, anon;
revoke all on function public.novo_codigo_convite(uuid) from public, anon;
grant execute on function public.criar_loja(text) to authenticated;
grant execute on function public.entrar_na_loja(text) to authenticated;
grant execute on function public.novo_codigo_convite(uuid) to authenticated;

-- ---------- Tempo real ----------
do $$ begin
  alter publication supabase_realtime add table public.itens;
exception when duplicate_object then null; end $$;
