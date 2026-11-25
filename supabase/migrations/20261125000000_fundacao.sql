-- =============================================================================
-- Fase 0 — Fundação do banco
-- Estrutura escolar, perfis de usuário, vínculos, travas em cascata e auditoria.
-- Ver docs/ARQUITETURA.md §2, §3.1, §3.5 e §4.
--
-- Nesta fase as tabelas só podem ser LIDAS pelo navegador. Toda escrita
-- (aprovar usuário, cadastrar turma, alterar vínculo) chega na Fase 1 via
-- funções RPC que verificam a hierarquia.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.papel as enum ('administrador', 'diretor', 'secretaria', 'coordenador', 'professor');
create type public.status_usuario as enum ('pendente', 'ativo', 'recusado', 'removido');
create type public.turno as enum ('matutino', 'vespertino');

-- Níveis hierárquicos. Mantenha em sincronia com src/lib/papeis.ts.
create function public.nivel_papel(p public.papel)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'administrador' then 50
    when 'diretor'       then 40
    when 'secretaria'    then 30
    when 'coordenador'   then 20
    when 'professor'     then 10
  end;
$$;

create function public.rotulo_nivel(nivel int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nivel >= 50 then 'Administrador'
    when nivel >= 40 then 'Diretor'
    when nivel >= 30 then 'Secretaria Acadêmica'
    when nivel >= 20 then 'Coordenador'
    when nivel >= 10 then 'Professor'
    else 'Sistema'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Estrutura escolar
-- ---------------------------------------------------------------------------
create table public.etapas (
  id                   smallint generated always as identity primary key,
  nome                 text not null unique,
  ordem                smallint not null unique,
  exige_linguagem_amor boolean not null default false
);
comment on column public.etapas.exige_linguagem_amor is
  'Quando verdadeiro, todo planejamento da etapa exige "Linguagem do Amor trabalhada" (§6).';

create table public.disciplinas (
  id   smallint generated always as identity primary key,
  nome text not null unique
);

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.perfis (
  id                   uuid primary key references auth.users (id) on delete cascade,
  nome                 text not null,
  email                text not null unique,
  papel                public.papel not null default 'professor',
  status               public.status_usuario not null default 'pendente',
  etapa_solicitada_id  smallint references public.etapas (id),
  aprovado_por         uuid references public.perfis (id),
  aprovado_em          timestamptz,
  criado_em            timestamptz not null default now()
);
create index perfis_status_idx on public.perfis (status);

-- ---------------------------------------------------------------------------
-- Funções de sessão (usadas pelas políticas RLS)
-- security definer: leem `perfis` sem cair na própria RLS (evita recursão).
-- ---------------------------------------------------------------------------
create function public.meu_perfil_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis where id = auth.uid() and status = 'ativo'
  );
$$;

create function public.meu_nivel()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.nivel_papel(papel) from public.perfis where id = auth.uid() and status = 'ativo'),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- Turmas e vínculos
-- ---------------------------------------------------------------------------
create table public.turmas (
  id                 bigint generated always as identity primary key,
  etapa_id           smallint not null references public.etapas (id),
  nome               text not null,
  turno_padrao       public.turno not null default 'matutino',
  ano_letivo         smallint not null default extract(year from now())::smallint,
  ativa              boolean not null default true,
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now(),
  unique (etapa_id, nome, ano_letivo)
);

-- Quem pode atuar onde (§3.1, §4.2, ARQUITETURA §3.1).
--   Coordenador:         (usuario, etapa)
--   Professor regente:   (usuario, etapa, turma, regente = true)
--   Especialista:        (usuario, etapa, turma, disciplina)
create table public.vinculos (
  id                 bigint generated always as identity primary key,
  usuario_id         uuid not null references public.perfis (id) on delete cascade,
  etapa_id           smallint not null references public.etapas (id),
  turma_id           bigint references public.turmas (id),
  disciplina_id      smallint references public.disciplinas (id),
  regente            boolean not null default false,
  ativo              boolean not null default true,
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now(),
  constraint regente_exige_turma check (not regente or turma_id is not null)
);
create unique index vinculos_unicos_ativos
  on public.vinculos (usuario_id, etapa_id, coalesce(turma_id, 0), coalesce(disciplina_id, 0))
  where ativo;
create index vinculos_turma_idx on public.vinculos (turma_id) where ativo;

-- ---------------------------------------------------------------------------
-- Trava em cascata (§3.1)
-- Registra quem definiu a configuração e impede que um nível inferior a altere.
-- Chamadas sem usuário autenticado (migrações, seed, jobs do servidor) passam livres.
-- ---------------------------------------------------------------------------
create function public.aplicar_trava()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel int := public.meu_nivel();
  v_nome  text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.definido_por_nivel > v_nivel then
    select nome into v_nome from public.perfis where id = old.definido_por_id;
    raise exception 'Esta configuração foi definida por % (%) em %. Apenas um % pode alterá-la.',
      coalesce(v_nome, 'usuário removido'),
      public.rotulo_nivel(old.definido_por_nivel),
      to_char(old.definido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
      public.rotulo_nivel(old.definido_por_nivel)
      using errcode = 'P0001', hint = 'trava_hierarquica';
  end if;

  new.definido_por_id    := auth.uid();
  new.definido_por_nivel := v_nivel;
  new.definido_em        := now();
  return new;
end;
$$;

create trigger turmas_trava before insert or update on public.turmas
  for each row execute function public.aplicar_trava();
create trigger vinculos_trava before insert or update on public.vinculos
  for each row execute function public.aplicar_trava();

-- ---------------------------------------------------------------------------
-- Novo cadastro → perfil pendente (§4)
-- O papel informado no cadastro é só um pedido; o acesso depende de aprovação.
-- Ninguém consegue se cadastrar como Administrador.
-- ---------------------------------------------------------------------------
create function public.criar_perfil_ao_cadastrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido text := new.raw_user_meta_data ->> 'papel_solicitado';
begin
  insert into public.perfis (id, nome, email, papel, etapa_solicitada_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), new.email),
    new.email,
    case when v_pedido in ('diretor', 'secretaria', 'coordenador', 'professor')
         then v_pedido::public.papel else 'professor' end,
    nullif(new.raw_user_meta_data ->> 'etapa_id', '')::smallint
  );
  return new;
end;
$$;

create trigger ao_cadastrar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_ao_cadastrar();

-- ---------------------------------------------------------------------------
-- Log de auditoria (§11) — somente o Administrador lê
-- ---------------------------------------------------------------------------
create table public.log_auditoria (
  id          bigint generated always as identity primary key,
  em          timestamptz not null default now(),
  ator_id     uuid,
  ator_nivel  int,
  acao        text not null,          -- INSERT | UPDATE | DELETE
  tabela      text not null,
  registro_id text,
  antes       jsonb,
  depois      jsonb
);
create index log_auditoria_em_idx on public.log_auditoria (em desc);
create index log_auditoria_registro_idx on public.log_auditoria (tabela, registro_id);

create function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_antes = v_depois then
    return new;
  end if;
  insert into public.log_auditoria (ator_id, ator_nivel, acao, tabela, registro_id, antes, depois)
  values (
    auth.uid(),
    public.meu_nivel(),
    tg_op,
    tg_table_name,
    coalesce(v_depois ->> 'id', v_antes ->> 'id'),
    v_antes,
    v_depois
  );
  return coalesce(new, old);
end;
$$;

create trigger perfis_auditoria after insert or update or delete on public.perfis
  for each row execute function public.registrar_auditoria();
create trigger turmas_auditoria after insert or update or delete on public.turmas
  for each row execute function public.registrar_auditoria();
create trigger vinculos_auditoria after insert or update or delete on public.vinculos
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Row Level Security — leitura apenas (escrita vem na Fase 1 via RPC)
-- ---------------------------------------------------------------------------
alter table public.etapas        enable row level security;
alter table public.disciplinas   enable row level security;
alter table public.perfis        enable row level security;
alter table public.turmas        enable row level security;
alter table public.vinculos      enable row level security;
alter table public.log_auditoria enable row level security;

create policy "usuários ativos leem etapas" on public.etapas
  for select to authenticated using (public.meu_perfil_ativo());

create policy "usuários ativos leem disciplinas" on public.disciplinas
  for select to authenticated using (public.meu_perfil_ativo());

create policy "usuários ativos leem turmas" on public.turmas
  for select to authenticated using (public.meu_perfil_ativo());

-- O próprio usuário sempre vê o seu perfil (inclusive pendente, para a tela
-- "aguardando aprovação"). Coordenador ou acima vê os demais.
-- TODO Fase 1: restringir o Coordenador às próprias etapas.
create policy "usuário lê o próprio perfil" on public.perfis
  for select to authenticated using (id = auth.uid());
create policy "gestores leem perfis" on public.perfis
  for select to authenticated using (public.meu_nivel() >= 20);

create policy "usuário lê os próprios vínculos" on public.vinculos
  for select to authenticated using (usuario_id = auth.uid() and public.meu_perfil_ativo());
create policy "gestores leem vínculos" on public.vinculos
  for select to authenticated using (public.meu_nivel() >= 20);

create policy "administrador lê a auditoria" on public.log_auditoria
  for select to authenticated using (public.meu_nivel() >= 50);

-- Funções internas não devem ser chamadas diretamente pela API.
revoke execute on function public.aplicar_trava() from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.criar_perfil_ao_cadastrar() from public, anon, authenticated;
