-- =============================================================================
-- Prazos de entrega, entregas e notificações
--
-- Decisões (conversa de 25/11/2026):
--   * A Secretaria ou o Diretor cadastra cada período (início, fim, data-limite).
--   * O período conta como entregue quando o professor conclui (verde) todos os
--     dias do período naquela turma:
--       - Regente: todos os dias úteis (seg–sex) do período;
--       - especialista: todos os blocos que criou no período (ao menos um).
--   * Situação: 2+ dias úteis antes da data-limite = antecipado; no dia ou na
--     véspera = no prazo; depois = atrasado. Feriados ainda não são considerados.
--   * Notificados: o próprio professor, os Coordenadores da etapa e os Diretores.
-- =============================================================================

create type public.situacao_entrega as enum ('antecipado', 'no_prazo', 'atrasado');

-- ---------------------------------------------------------------------------
-- Períodos de entrega
-- ---------------------------------------------------------------------------
create table public.periodos_entrega (
  id                 bigint generated always as identity primary key,
  inicio             date not null,
  fim                date not null,
  prazo              date not null,
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now(),
  constraint periodo_valido check (fim >= inicio)
);
create index periodos_entrega_datas_idx on public.periodos_entrega (inicio, fim);

create trigger periodos_trava before insert or update on public.periodos_entrega
  for each row execute function public.aplicar_trava();
create trigger periodos_auditoria after insert or update or delete on public.periodos_entrega
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Entregas (uma por professor, turma e período; base do relatório de entregas)
-- ---------------------------------------------------------------------------
create table public.entregas (
  id           bigint generated always as identity primary key,
  periodo_id   bigint not null references public.periodos_entrega (id),
  professor_id uuid not null references public.perfis (id),
  turma_id     bigint not null references public.turmas (id),
  entregue_em  timestamptz not null,
  situacao     public.situacao_entrega not null,
  unique (periodo_id, professor_id, turma_id)
);
create index entregas_turma_idx on public.entregas (turma_id);

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------
create table public.notificacoes (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id),
  tipo       text not null,                -- 'entrega'
  titulo     text not null,
  mensagem   text not null,
  link       text,
  entrega_id bigint references public.entregas (id),
  criada_em  timestamptz not null default now(),
  lida_em    timestamptz
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, criada_em desc);

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------
-- Dias úteis (seg–sex) d com a < d <= b.
create function public.dias_uteis_entre(a date, b date)
returns int
language sql
immutable
set search_path = ''
as $$
  select count(*)::int
  from generate_series(a + 1, b, interval '1 day') d
  where extract(isodow from d) < 6;
$$;

create function public.situacao_da_entrega(p_entregue date, p_prazo date)
returns public.situacao_entrega
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entregue > p_prazo then 'atrasado'::public.situacao_entrega
    when public.dias_uteis_entre(p_entregue, p_prazo) >= 2 then 'antecipado'::public.situacao_entrega
    else 'no_prazo'::public.situacao_entrega
  end;
$$;

create function public.rotulo_situacao(s public.situacao_entrega)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s when 'antecipado' then 'com antecedência' when 'no_prazo' then 'no prazo' else 'com atraso' end;
$$;

-- O professor concluiu o período nesta turma?
create function public.periodo_concluido(p_periodo bigint, p_professor uuid, p_turma bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_per public.periodos_entrega;
  v_regente boolean;
begin
  select * into v_per from public.periodos_entrega where id = p_periodo;

  -- nenhum bloco do professor pode estar em aberto no período
  if exists (
    select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where b.professor_id = p_professor and p.turma_id = p_turma
      and p.data between v_per.inicio and v_per.fim
      and b.excluido_em is null and b.status <> 'verde'
  ) then
    return false;
  end if;

  -- e precisa haver ao menos um bloco concluído
  if not exists (
    select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where b.professor_id = p_professor and p.turma_id = p_turma
      and p.data between v_per.inicio and v_per.fim and b.excluido_em is null
  ) then
    return false;
  end if;

  select exists (
    select 1 from public.vinculos v
    where v.usuario_id = p_professor and v.turma_id = p_turma and v.regente and v.ativo
  ) into v_regente;

  if not v_regente then
    return true;
  end if;

  -- Regente: todo dia útil do período precisa ter bloco concluído
  return not exists (
    select 1 from generate_series(v_per.inicio, v_per.fim, interval '1 day') d
    where extract(isodow from d) < 6
      and not exists (
        select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
        where b.professor_id = p_professor and p.turma_id = p_turma and p.data = d::date
          and b.excluido_em is null and b.status = 'verde'
      )
  );
end;
$$;

-- Registra a entrega (se ainda não houver) e, se pedido, notifica.
create function public.registrar_entrega(p_periodo bigint, p_professor uuid, p_turma bigint, p_entregue_em timestamptz, p_notificar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per      public.periodos_entrega;
  v_entrega  public.entregas;
  v_turma    public.turmas;
  v_prof     text;
  v_situacao public.situacao_entrega;
  v_periodo  text;
  v_link     text;
  v_dest     uuid;
begin
  if exists (select 1 from public.entregas where periodo_id = p_periodo and professor_id = p_professor and turma_id = p_turma) then
    return;
  end if;
  if not public.periodo_concluido(p_periodo, p_professor, p_turma) then
    return;
  end if;

  select * into v_per from public.periodos_entrega where id = p_periodo;
  select * into v_turma from public.turmas where id = p_turma;
  select nome into v_prof from public.perfis where id = p_professor;
  v_situacao := public.situacao_da_entrega((p_entregue_em at time zone 'America/Sao_Paulo')::date, v_per.prazo);

  insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao)
  values (p_periodo, p_professor, p_turma, p_entregue_em, v_situacao)
  on conflict do nothing
  returning * into v_entrega;
  if v_entrega.id is null or not p_notificar then
    return;
  end if;

  v_periodo := to_char(v_per.inicio, 'DD/MM') || ' a ' || to_char(v_per.fim, 'DD/MM');
  v_link := '/planejamentos?turma=' || p_turma || '&semana=' || v_per.inicio;

  -- o próprio professor
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, entrega_id)
  values (p_professor, 'entrega',
          'Planejamento entregue ' || public.rotulo_situacao(v_situacao),
          'Seu planejamento de ' || v_turma.nome || ' (' || v_periodo || ') foi entregue '
            || public.rotulo_situacao(v_situacao) || '. Prazo: ' || to_char(v_per.prazo, 'DD/MM') || '.',
          v_link, v_entrega.id);

  -- Coordenadores da etapa e Diretores
  for v_dest in
    select distinct pf.id from public.perfis pf
    where pf.status = 'ativo' and pf.id <> p_professor and (
      pf.papel = 'diretor'
      or (pf.papel = 'coordenador' and exists (
            select 1 from public.vinculos v
            where v.usuario_id = pf.id and v.ativo and v.turma_id is null and v.etapa_id = v_turma.etapa_id))
    )
  loop
    insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, entrega_id)
    values (v_dest, 'entrega',
            'Planejamento entregue ' || public.rotulo_situacao(v_situacao),
            v_prof || ' entregou o planejamento de ' || v_turma.nome || ' (' || v_periodo || ') '
              || public.rotulo_situacao(v_situacao) || '. Prazo: ' || to_char(v_per.prazo, 'DD/MM') || '.',
            v_link, v_entrega.id);
  end loop;
end;
$$;

-- Ao concluir um bloco, verifica se o período foi entregue.
create function public.verificar_entrega_ao_concluir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.planejamentos;
  v_per  bigint;
begin
  select * into v_plan from public.planejamentos where id = new.planejamento_id;
  for v_per in
    select id from public.periodos_entrega where v_plan.data between inicio and fim
  loop
    perform public.registrar_entrega(v_per, new.professor_id, v_plan.turma_id, now(), true);
  end loop;
  return new;
end;
$$;

create trigger blocos_verificar_entrega after update of status on public.blocos
  for each row when (new.status = 'verde' and old.status is distinct from 'verde' and new.excluido_em is null)
  execute function public.verificar_entrega_ao_concluir();

-- Período cadastrado depois: registra as entregas que já estavam concluídas,
-- com a data em que o último bloco ficou verde (sem notificar retroativamente).
create function public.avaliar_entregas_do_periodo(p_periodo bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per public.periodos_entrega;
  r record;
begin
  select * into v_per from public.periodos_entrega where id = p_periodo;
  for r in
    select b.professor_id, p.turma_id,
           max(coalesce(
             (select max(h.em) from public.historico_blocos h
              where h.bloco_id = b.id and h.campo = 'status' and h.valor_novo = 'verde'),
             b.atualizado_em)) as quando
    from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where p.data between v_per.inicio and v_per.fim and b.excluido_em is null
    group by b.professor_id, p.turma_id
  loop
    perform public.registrar_entrega(p_periodo, r.professor_id, r.turma_id, r.quando, false);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: períodos (Diretor e Secretaria; trava em cascata vale)
-- ---------------------------------------------------------------------------
create function public.salvar_periodo(p_id bigint, p_inicio date, p_fim date, p_prazo date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica define os prazos.' using errcode = 'P0001';
  end if;
  if p_inicio is null or p_fim is null or p_prazo is null or p_fim < p_inicio then
    raise exception 'Informe início, fim (depois do início) e data-limite.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.periodos_entrega
    where id is distinct from p_id and daterange(inicio, fim, '[]') && daterange(p_inicio, p_fim, '[]')
  ) then
    raise exception 'Já existe um período que cobre parte dessas datas.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.periodos_entrega (inicio, fim, prazo) values (p_inicio, p_fim, p_prazo) returning id into v_id;
  else
    if exists (select 1 from public.entregas where periodo_id = p_id)
       and exists (select 1 from public.periodos_entrega where id = p_id and (inicio, fim, prazo) is distinct from (p_inicio, p_fim, p_prazo)) then
      raise exception 'Este período já tem entregas registradas e não pode mais ser alterado.' using errcode = 'P0001';
    end if;
    update public.periodos_entrega set inicio = p_inicio, fim = p_fim, prazo = p_prazo where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Período não encontrado.' using errcode = 'P0001';
    end if;
  end if;

  perform public.avaliar_entregas_do_periodo(v_id);
  return v_id;
end;
$$;

create function public.remover_periodo(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per public.periodos_entrega;
begin
  if public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica define os prazos.' using errcode = 'P0001';
  end if;
  select * into v_per from public.periodos_entrega where id = p_id;
  if not found then
    raise exception 'Período não encontrado.' using errcode = 'P0001';
  end if;
  if v_per.definido_por_nivel > public.meu_nivel() then
    raise exception 'Este período foi definido por um Diretor. Apenas um Diretor pode removê-lo.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.entregas where periodo_id = p_id) then
    raise exception 'Este período já tem entregas registradas e não pode ser removido.' using errcode = 'P0001';
  end if;
  delete from public.periodos_entrega where id = p_id;
end;
$$;

create function public.marcar_notificacoes_lidas(p_ids bigint[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notificacoes set lida_em = now()
  where usuario_id = auth.uid() and lida_em is null and (p_ids is null or id = any (p_ids));
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.periodos_entrega enable row level security;
alter table public.entregas         enable row level security;
alter table public.notificacoes     enable row level security;

create policy "usuários ativos leem os períodos" on public.periodos_entrega
  for select to authenticated using (public.meu_perfil_ativo());

create policy "quem vê a turma vê as entregas" on public.entregas
  for select to authenticated
  using (professor_id = auth.uid() or (public.meu_papel() <> 'professor' and public.pode_ver_turma(turma_id)));

create policy "cada um lê as próprias notificações" on public.notificacoes
  for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke execute on function
  public.periodo_concluido(bigint, uuid, bigint),
  public.registrar_entrega(bigint, uuid, bigint, timestamptz, boolean),
  public.verificar_entrega_ao_concluir(),
  public.avaliar_entregas_do_periodo(bigint)
from public, anon, authenticated;

revoke execute on function
  public.salvar_periodo(bigint, date, date, date), public.remover_periodo(bigint),
  public.marcar_notificacoes_lidas(bigint[])
from public, anon;

grant execute on function
  public.salvar_periodo(bigint, date, date, date), public.remover_periodo(bigint),
  public.marcar_notificacoes_lidas(bigint[])
to authenticated;
