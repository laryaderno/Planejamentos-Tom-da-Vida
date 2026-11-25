-- =============================================================================
-- Fase 4 — preparação para exportação e relatórios (decisões de 25/11/2026)
--   * Momentos de rotina na grade (Lanche, Almoço, Parque, Saída): sem professor.
--   * Disciplinas cadastráveis pela Direção/Secretaria (ex.: Programa Bilíngue, Robótica).
--   * Períodos de entrega por etapa (null = todas as etapas).
--   * Funções de relatório: conteúdo programático e relatório de entregas.
--   * Fuso horário da escola: America/Campo_Grande.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fuso horário da escola: Campo Grande (MS), UTC-4.
-- As migrações anteriores usavam America/Sao_Paulo (UTC-3), o que fazia uma
-- entrega às 23h30 contar como do dia seguinte. Todas as contas de data passam
-- a usar esta função.
-- ---------------------------------------------------------------------------
create function public.fuso_escola()
returns text
language sql
immutable
set search_path = ''
as $$ select 'America/Campo_Grande' $$;

create or replace function public.aplicar_trava()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel int := public.meu_nivel();
  v_nome  text;
begin
  if auth.uid() is null or current_setting('tv.ignorar_trava', true) = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.definido_por_nivel > v_nivel then
    select nome into v_nome from public.perfis where id = old.definido_por_id;
    raise exception 'Esta configuração foi definida por % (%) em %. Apenas % pode alterá-la.',
      coalesce(v_nome, 'usuário removido'),
      public.rotulo_nivel(old.definido_por_nivel),
      to_char(old.definido_em at time zone public.fuso_escola(), 'DD/MM/YYYY'),
      public.rotulo_nivel_com_artigo(old.definido_por_nivel)
      using errcode = 'P0001', hint = 'trava_hierarquica';
  end if;

  new.definido_por_id    := auth.uid();
  new.definido_por_nivel := v_nivel;
  new.definido_em        := now();
  return new;
end;
$$;

create or replace function public.registrar_entrega(p_periodo bigint, p_professor uuid, p_turma bigint, p_entregue_em timestamptz, p_notificar boolean)
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
  v_situacao := public.situacao_da_entrega((p_entregue_em at time zone public.fuso_escola())::date, v_per.prazo, v_turma.etapa_id);

  insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao)
  values (p_periodo, p_professor, p_turma, p_entregue_em, v_situacao)
  on conflict do nothing
  returning * into v_entrega;
  if v_entrega.id is null or not p_notificar then
    return;
  end if;

  v_periodo := to_char(v_per.inicio, 'DD/MM') || ' a ' || to_char(v_per.fim, 'DD/MM');
  v_link := '/planejamentos?turma=' || p_turma || '&semana=' || v_per.inicio;

  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, entrega_id)
  values (p_professor, 'entrega',
          'Planejamento entregue ' || public.rotulo_situacao(v_situacao),
          'Seu planejamento de ' || v_turma.nome || ' (' || v_periodo || ') foi entregue '
            || public.rotulo_situacao(v_situacao) || '. Prazo: ' || to_char(v_per.prazo, 'DD/MM') || '.',
          v_link, v_entrega.id);

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

-- ---------------------------------------------------------------------------
-- Rotina na grade
-- ---------------------------------------------------------------------------
alter table public.horarios
  alter column professor_id drop not null,
  alter column disciplina_id drop not null,
  add column rotulo text;

alter table public.horarios add constraint aula_ou_rotina check (
  (professor_id is not null and disciplina_id is not null and rotulo is null)
  or (professor_id is null and disciplina_id is null and length(trim(coalesce(rotulo, ''))) > 0)
);
comment on column public.horarios.rotulo is
  'Momento de rotina sem professor (ex.: Lanche, Almoço, Parque, Saída). Aulas têm professor e disciplina.';

-- Formato: aula  { dia_semana, hora_inicio, hora_fim, disciplina_id, professor_id }
--          rotina { dia_semana, hora_inicio, hora_fim, rotulo }
create or replace function public.salvar_grade(p_turma bigint, p_vigente_desde date, p_aulas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma public.turmas;
  v_trava record;
  a record;
  v_conflito record;
  v_per bigint;
begin
  select * into v_turma from public.turmas where id = p_turma and ativa;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0001';
  end if;
  if not public.pode_editar_etapa(v_turma.etapa_id) then
    raise exception 'Você não tem permissão para definir a grade desta turma.' using errcode = 'P0001';
  end if;
  if p_vigente_desde is null then
    raise exception 'Informe a partir de quando a grade vale.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_aulas, '[]')) <> 'array' then
    raise exception 'Formato da grade inválido.' using errcode = 'P0001';
  end if;

  select h.definido_por_nivel, h.definido_em, pf.nome into v_trava
  from public.horarios h left join public.perfis pf on pf.id = h.definido_por_id
  where h.turma_id = p_turma and (h.vigente_ate is null or h.vigente_ate >= p_vigente_desde)
  order by h.definido_por_nivel desc
  limit 1;
  if found and v_trava.definido_por_nivel > public.meu_nivel() then
    raise exception 'Esta configuração foi definida por % (%) em %. Apenas % pode alterá-la.',
      coalesce(v_trava.nome, 'usuário removido'),
      public.rotulo_nivel(v_trava.definido_por_nivel),
      to_char(v_trava.definido_em at time zone public.fuso_escola(), 'DD/MM/YYYY'),
      public.rotulo_nivel_com_artigo(v_trava.definido_por_nivel)
      using errcode = 'P0001', hint = 'trava_hierarquica';
  end if;

  for a in
    select * from jsonb_to_recordset(coalesce(p_aulas, '[]'))
      as x(dia_semana smallint, hora_inicio time, hora_fim time, disciplina_id smallint, professor_id uuid, rotulo text)
  loop
    if a.dia_semana is null or a.dia_semana not between 1 and 5 then
      raise exception 'Dia da semana inválido.' using errcode = 'P0001';
    end if;
    if a.hora_inicio is null or a.hora_fim is null or a.hora_fim <= a.hora_inicio then
      raise exception 'Cada horário precisa de início e fim (fim depois do início).' using errcode = 'P0001';
    end if;
    if nullif(trim(a.rotulo), '') is not null then
      if a.professor_id is not null or a.disciplina_id is not null then
        raise exception 'Momento de rotina não tem professor nem disciplina.' using errcode = 'P0001';
      end if;
    elsif not exists (
      select 1 from public.vinculos v
      where v.usuario_id = a.professor_id and v.turma_id = p_turma and v.disciplina_id = a.disciplina_id and v.ativo
    ) then
      raise exception 'Há uma aula com professor que não leciona essa disciplina nesta turma. Ajuste as permissões do professor antes.'
        using errcode = 'P0001';
    end if;
  end loop;

  select x.dia_semana, x.hora_inicio into v_conflito
  from jsonb_to_recordset(coalesce(p_aulas, '[]')) as x(dia_semana smallint, hora_inicio time, hora_fim time)
  join jsonb_to_recordset(coalesce(p_aulas, '[]')) as y(dia_semana smallint, hora_inicio time, hora_fim time)
    on x.dia_semana = y.dia_semana and (x.hora_inicio, x.hora_fim) is distinct from (y.hora_inicio, y.hora_fim)
   and x.hora_inicio < y.hora_fim and y.hora_inicio < x.hora_fim
  limit 1;
  if found then
    raise exception 'Há horários sobrepostos na turma (dia %, %).',
      v_conflito.dia_semana, to_char(v_conflito.hora_inicio, 'HH24:MI') using errcode = 'P0001';
  end if;

  select pf.nome, t.nome as turma, x.dia_semana into v_conflito
  from jsonb_to_recordset(coalesce(p_aulas, '[]')) as x(dia_semana smallint, hora_inicio time, hora_fim time, professor_id uuid)
  join public.horarios h on h.professor_id = x.professor_id and h.turma_id <> p_turma and h.dia_semana = x.dia_semana
   and public.horario_vigente(h, p_vigente_desde)
   and x.hora_inicio < h.hora_fim and h.hora_inicio < x.hora_fim
  join public.perfis pf on pf.id = x.professor_id
  join public.turmas t on t.id = h.turma_id
  where x.professor_id is not null
  limit 1;
  if found then
    raise exception '% já tem aula em % nesse mesmo horário.', v_conflito.nome, v_conflito.turma using errcode = 'P0001';
  end if;

  delete from public.horarios where turma_id = p_turma and vigente_desde >= p_vigente_desde;
  update public.horarios set vigente_ate = p_vigente_desde - 1
   where turma_id = p_turma and vigente_desde < p_vigente_desde and (vigente_ate is null or vigente_ate >= p_vigente_desde);

  insert into public.horarios (turma_id, dia_semana, hora_inicio, hora_fim, disciplina_id, professor_id, rotulo, vigente_desde,
                               definido_por_id, definido_por_nivel, definido_em)
  select p_turma, x.dia_semana, x.hora_inicio, x.hora_fim,
         case when nullif(trim(x.rotulo), '') is null then x.disciplina_id end,
         case when nullif(trim(x.rotulo), '') is null then x.professor_id end,
         nullif(trim(x.rotulo), ''),
         p_vigente_desde, auth.uid(), public.meu_nivel(), now()
  from jsonb_to_recordset(coalesce(p_aulas, '[]'))
    as x(dia_semana smallint, hora_inicio time, hora_fim time, disciplina_id smallint, professor_id uuid, rotulo text);

  for v_per in select id from public.periodos_entrega where fim >= p_vigente_desde loop
    perform public.avaliar_entregas_do_periodo(v_per);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Disciplinas
-- ---------------------------------------------------------------------------
create trigger disciplinas_auditoria after insert or update or delete on public.disciplinas
  for each row execute function public.registrar_auditoria();

create function public.salvar_disciplina(p_id smallint, p_nome text)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id smallint;
begin
  if public.meu_nivel() < 30 then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica cadastra disciplinas.' using errcode = 'P0001';
  end if;
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe o nome da disciplina.' using errcode = 'P0001';
  end if;
  begin
    if p_id is null then
      insert into public.disciplinas (nome) values (trim(p_nome)) returning id into v_id;
    else
      update public.disciplinas set nome = trim(p_nome) where id = p_id returning id into v_id;
      if v_id is null then
        raise exception 'Disciplina não encontrada.' using errcode = 'P0001';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Já existe uma disciplina com esse nome.' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Períodos de entrega por etapa (null = todas as etapas)
-- ---------------------------------------------------------------------------
alter table public.periodos_entrega add column etapa_id smallint references public.etapas (id);
comment on column public.periodos_entrega.etapa_id is 'Etapa do período; null = vale para todas as etapas.';

-- O período vale para a turma?
create function public.periodo_vale_para_turma(p_periodo bigint, p_turma bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.periodos_entrega pe join public.turmas t on t.id = p_turma
    where pe.id = p_periodo and (pe.etapa_id is null or pe.etapa_id = t.etapa_id)
  );
$$;

create or replace function public.verificar_entrega_ao_concluir()
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
    select pe.id from public.periodos_entrega pe join public.turmas t on t.id = v_plan.turma_id
    where v_plan.data between pe.inicio and pe.fim and (pe.etapa_id is null or pe.etapa_id = t.etapa_id)
  loop
    perform public.registrar_entrega(v_per, new.professor_id, v_plan.turma_id, now(), true);
  end loop;
  return new;
end;
$$;

create or replace function public.avaliar_entregas_do_periodo(p_periodo bigint)
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
    from public.blocos b
    join public.planejamentos p on p.id = b.planejamento_id
    join public.turmas t on t.id = p.turma_id
    where p.data between v_per.inicio and v_per.fim and b.excluido_em is null
      and (v_per.etapa_id is null or t.etapa_id = v_per.etapa_id)
    group by b.professor_id, p.turma_id
  loop
    perform public.registrar_entrega(p_periodo, r.professor_id, r.turma_id, r.quando, false);
  end loop;
end;
$$;

drop function public.salvar_periodo(bigint, date, date, date);
create function public.salvar_periodo(p_id bigint, p_inicio date, p_fim date, p_prazo date, p_etapa smallint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if public.meu_papel() is null or public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica define os prazos.' using errcode = 'P0001';
  end if;
  if p_inicio is null or p_fim is null or p_prazo is null or p_fim < p_inicio then
    raise exception 'Informe início, fim (depois do início) e data-limite.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.periodos_entrega
    where id is distinct from p_id
      and daterange(inicio, fim, '[]') && daterange(p_inicio, p_fim, '[]')
      and (etapa_id is null or p_etapa is null or etapa_id = p_etapa)
  ) then
    raise exception 'Já existe um período desta etapa que cobre parte dessas datas.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values (p_inicio, p_fim, p_prazo, p_etapa) returning id into v_id;
  else
    if exists (select 1 from public.entregas where periodo_id = p_id)
       and exists (select 1 from public.periodos_entrega where id = p_id
                   and (inicio, fim, prazo, etapa_id) is distinct from (p_inicio, p_fim, p_prazo, p_etapa)) then
      raise exception 'Este período já tem entregas registradas e não pode mais ser alterado.' using errcode = 'P0001';
    end if;
    update public.periodos_entrega set inicio = p_inicio, fim = p_fim, prazo = p_prazo, etapa_id = p_etapa
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Período não encontrado.' using errcode = 'P0001';
    end if;
  end if;

  perform public.avaliar_entregas_do_periodo(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteúdo programático (§6.1): Conteúdo e Objetivos de todos os blocos da
-- turma no intervalo — inclusive os "excluídos" na remoção de professor (D6).
-- ---------------------------------------------------------------------------
create function public.conteudo_programatico(p_turma bigint, p_inicio date, p_fim date)
returns table (
  data date, turno public.turno, hora_inicio time, disciplina text, professor text,
  conteudo text, objetivos text, habilidades public.inteligencia[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode_ver_turma(p_turma) then
    raise exception 'Você não tem acesso a esta turma.' using errcode = 'P0001';
  end if;
  return query
    select p.data, p.turno, b.hora_inicio, d.nome, pf.nome, b.conteudo, b.objetivos, b.habilidades
    from public.blocos b
    join public.planejamentos p on p.id = b.planejamento_id
    join public.disciplinas d on d.id = b.disciplina_id
    join public.perfis pf on pf.id = b.professor_id
    where p.turma_id = p_turma and p.data between p_inicio and p_fim
      and (trim(b.conteudo) <> '' or trim(b.objetivos) <> '')
    order by d.nome, p.data, b.hora_inicio;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatório de entregas (§9): por professor ativo, em ordem alfabética, os
-- períodos com data-limite no intervalo. Período vencido sem entrega = não
-- entregue; período ainda dentro do prazo e sem entrega não conta.
-- Coordenador: só as suas etapas. Direção, Secretaria e Admin: a escola toda.
-- ---------------------------------------------------------------------------
create function public.relatorio_entregas(p_inicio date, p_fim date)
returns table (
  professor_id uuid, professor text, turmas text,
  antecipado int, no_prazo int, atrasado int, nao_entregue int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.meu_nivel() < 20 then
    raise exception 'Somente a gestão escolar acessa o relatório de entregas.' using errcode = 'P0001';
  end if;
  return query
    with pares as (
      select distinct v.usuario_id, v.turma_id, t.nome as turma, t.etapa_id
      from public.vinculos v
      join public.turmas t on t.id = v.turma_id and t.ativa
      join public.perfis pf on pf.id = v.usuario_id and pf.status = 'ativo' and pf.papel = 'professor'
      where v.ativo
        and (public.meu_nivel() >= 30 or t.etapa_id = any (public.minhas_etapas()))
    ),
    esperadas as (
      select pr.usuario_id, pr.turma_id, pe.id as periodo_id, pe.prazo
      from pares pr
      join public.periodos_entrega pe on (pe.etapa_id is null or pe.etapa_id = pr.etapa_id)
      where pe.prazo between p_inicio and p_fim
    ),
    situacoes as (
      select es.usuario_id,
             case
               when en.id is not null then en.situacao::text
               when es.prazo < (now() at time zone public.fuso_escola())::date then 'nao_entregue'
             end as situacao
      from esperadas es
      left join public.entregas en
        on en.periodo_id = es.periodo_id and en.professor_id = es.usuario_id and en.turma_id = es.turma_id
    )
    select pf.id, pf.nome,
           (select string_agg(distinct pr.turma, ', ' order by pr.turma) from pares pr where pr.usuario_id = pf.id),
           count(*) filter (where s.situacao = 'antecipado')::int,
           count(*) filter (where s.situacao = 'no_prazo')::int,
           count(*) filter (where s.situacao = 'atrasado')::int,
           count(*) filter (where s.situacao = 'nao_entregue')::int
    from public.perfis pf
    left join situacoes s on s.usuario_id = pf.id
    where pf.id in (select usuario_id from pares)
    group by pf.id, pf.nome
    order by pf.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.periodo_vale_para_turma(bigint, bigint) from public, anon, authenticated;
revoke execute on function
  public.salvar_periodo(bigint, date, date, date, smallint),
  public.salvar_disciplina(smallint, text),
  public.conteudo_programatico(bigint, date, date),
  public.relatorio_entregas(date, date)
from public, anon;
grant execute on function
  public.salvar_periodo(bigint, date, date, date, smallint),
  public.salvar_disciplina(smallint, text),
  public.conteudo_programatico(bigint, date, date),
  public.relatorio_entregas(date, date)
to authenticated;
