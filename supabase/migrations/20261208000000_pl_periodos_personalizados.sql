-- Horários de PL e períodos personalizados.
--
-- 1) Horários de PL (planejamento) de cada professor, cadastrados pela
--    Coordenação, Secretaria e Direção. Cada entrega guarda se aconteceu
--    fora do horário de PL (independente do prazo). Professor sem PL
--    cadastrado: não marca nada (fora_do_pl = null).
-- 2) Períodos de entrega "personalizados": valem para as turmas escolhidas
--    (em vez de uma etapa inteira ou da escola toda).

-- ---------------------------------------------------------------------------
-- 1) Horários de PL
-- ---------------------------------------------------------------------------
create table public.horarios_pl (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfis (id),
  dia_semana  smallint not null check (dia_semana between 1 and 5),   -- 1 = segunda
  hora_inicio time not null,
  hora_fim    time not null,
  criado_por  uuid references public.perfis (id) default auth.uid(),
  criado_em   timestamptz not null default now(),
  constraint horario_pl_valido check (hora_fim > hora_inicio)
);
create index horarios_pl_usuario_idx on public.horarios_pl (usuario_id, dia_semana);

create trigger horarios_pl_auditoria after insert or delete on public.horarios_pl
  for each row execute function public.registrar_auditoria();

alter table public.entregas add column fora_do_pl boolean;
comment on column public.entregas.fora_do_pl is
  'A entrega aconteceu fora dos horários de PL do professor? null = professor sem PL cadastrado.';

create function public.fora_do_pl(p_professor uuid, p_em timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_em at time zone public.fuso_escola();
begin
  if not exists (select 1 from public.horarios_pl where usuario_id = p_professor) then
    return null;
  end if;
  return not exists (
    select 1 from public.horarios_pl
    where usuario_id = p_professor
      and dia_semana = extract(isodow from v_local)
      and v_local::time >= hora_inicio and v_local::time < hora_fim
  );
end;
$$;

create function public.marcar_fora_do_pl()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.fora_do_pl := public.fora_do_pl(new.professor_id, new.entregue_em);
  return new;
end;
$$;

create trigger entregas_fora_do_pl before insert on public.entregas
  for each row execute function public.marcar_fora_do_pl();

-- Quem cadastra o PL do professor: Secretaria e Direção (toda a escola) ou a
-- Coordenação de uma etapa em que o professor tem vínculo.
create function public.pode_definir_pl(p_professor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_nivel() >= 30
      or (public.meu_papel() = 'coordenador' and exists (
            select 1 from public.vinculos v
            where v.usuario_id = p_professor and v.ativo and v.etapa_id = any (public.minhas_etapas())));
$$;

-- Substitui todos os horários de PL do professor.
-- Formato: [{ "dia_semana": 2, "hora_inicio": "13:00", "hora_fim": "14:40" }, ...]
create function public.salvar_horarios_pl(p_professor uuid, p_horarios jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
begin
  if not public.pode_definir_pl(p_professor) then
    raise exception 'Você não tem permissão para definir os horários de PL deste professor.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfis where id = p_professor and papel = 'professor') then
    raise exception 'Professor não encontrado.' using errcode = 'P0001';
  end if;
  delete from public.horarios_pl where usuario_id = p_professor;
  for h in
    select * from jsonb_to_recordset(coalesce(p_horarios, '[]'::jsonb)) as x(dia_semana smallint, hora_inicio time, hora_fim time)
  loop
    if h.dia_semana is null or h.dia_semana not between 1 and 5 or h.hora_inicio is null or h.hora_fim is null or h.hora_fim <= h.hora_inicio then
      raise exception 'Confira os horários de PL: cada um precisa de dia (segunda a sexta), início e fim depois do início.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.horarios_pl
               where usuario_id = p_professor and dia_semana = h.dia_semana
                 and hora_inicio < h.hora_fim and h.hora_inicio < hora_fim) then
      raise exception 'Há horários de PL sobrepostos no mesmo dia.' using errcode = 'P0001';
    end if;
    insert into public.horarios_pl (usuario_id, dia_semana, hora_inicio, hora_fim)
    values (p_professor, h.dia_semana, h.hora_inicio, h.hora_fim);
  end loop;
end;
$$;

alter table public.horarios_pl enable row level security;
create policy "gestão e o próprio professor veem o PL" on public.horarios_pl
  for select to authenticated using (usuario_id = auth.uid() or public.meu_nivel() >= 20);

-- ---------------------------------------------------------------------------
-- 2) Períodos personalizados (turmas escolhidas)
-- ---------------------------------------------------------------------------
create table public.periodo_turmas (
  periodo_id bigint not null references public.periodos_entrega (id) on delete cascade,
  turma_id   bigint not null references public.turmas (id),
  primary key (periodo_id, turma_id)
);

alter table public.periodo_turmas enable row level security;
create policy "usuários ativos leem as turmas dos períodos" on public.periodo_turmas
  for select to authenticated using (public.meu_perfil_ativo());

-- O período vale para a turma? Personalizado: só as turmas escolhidas.
-- Senão: a etapa do período (ou todas, quando não tem etapa).
create or replace function public.periodo_vale_para_turma(p_periodo bigint, p_turma bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.periodo_turmas pt where pt.periodo_id = p_periodo)
      then exists (select 1 from public.periodo_turmas pt where pt.periodo_id = p_periodo and pt.turma_id = p_turma)
    else exists (
      select 1 from public.periodos_entrega pe join public.turmas t on t.id = p_turma
      where pe.id = p_periodo and (pe.etapa_id is null or pe.etapa_id = t.etapa_id))
  end;
$$;

drop function public.salvar_periodo(bigint, date, date, date, smallint);
create function public.salvar_periodo(
  p_id bigint, p_inicio date, p_fim date, p_prazo date, p_etapa smallint default null, p_turmas bigint[] default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_turmas bigint[];
  v_conflito text;
  v_antes bigint[];
begin
  if public.meu_papel() is null or public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica define os prazos.' using errcode = 'P0001';
  end if;
  if p_inicio is null or p_fim is null or p_prazo is null or p_fim < p_inicio then
    raise exception 'Informe início, fim (depois do início) e data-limite.' using errcode = 'P0001';
  end if;
  if p_turmas is not null and cardinality(p_turmas) = 0 then
    raise exception 'Escolha pelo menos uma turma para o período personalizado.' using errcode = 'P0001';
  end if;
  if p_turmas is not null and p_etapa is not null then
    raise exception 'Um período personalizado não tem etapa.' using errcode = 'P0001';
  end if;

  -- Turmas cobertas pelo novo período
  v_turmas := coalesce(
    (select array_agg(distinct x) from unnest(p_turmas) x),
    (select array_agg(t.id) from public.turmas t where t.ativa and (p_etapa is null or t.etapa_id = p_etapa)),
    '{}');

  -- Nenhuma turma pode ter dois períodos cobrindo a mesma data
  select t.nome into v_conflito
  from public.periodos_entrega pe
  join public.turmas t on t.id = any (v_turmas)
  where pe.id is distinct from p_id
    and daterange(pe.inicio, pe.fim, '[]') && daterange(p_inicio, p_fim, '[]')
    and public.periodo_vale_para_turma(pe.id, t.id)
  order by t.nome
  limit 1;
  if v_conflito is not null then
    raise exception 'A turma % já tem um período de entrega que cobre parte dessas datas.', v_conflito using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values (p_inicio, p_fim, p_prazo, p_etapa) returning id into v_id;
  else
    select coalesce(array_agg(turma_id order by turma_id), '{}') into v_antes from public.periodo_turmas where periodo_id = p_id;
    if exists (select 1 from public.entregas where periodo_id = p_id)
       and (exists (select 1 from public.periodos_entrega where id = p_id
                    and (inicio, fim, prazo, etapa_id) is distinct from (p_inicio, p_fim, p_prazo, p_etapa))
            or v_antes is distinct from coalesce((select array_agg(distinct x order by x) from unnest(p_turmas) x), '{}')) then
      raise exception 'Este período já tem entregas registradas e não pode mais ser alterado.' using errcode = 'P0001';
    end if;
    update public.periodos_entrega set inicio = p_inicio, fim = p_fim, prazo = p_prazo, etapa_id = p_etapa
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Período não encontrado.' using errcode = 'P0001';
    end if;
    delete from public.periodo_turmas where periodo_id = v_id;
  end if;

  if p_turmas is not null then
    insert into public.periodo_turmas (periodo_id, turma_id)
    select v_id, x from (select distinct unnest(p_turmas) as x) s;
  end if;

  perform public.avaliar_entregas_do_periodo(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rotinas que escolhem o período da turma passam a usar periodo_vale_para_turma
-- (iguais às anteriores, só muda a regra de qual período vale para a turma).
-- ---------------------------------------------------------------------------
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
    where v_plan.data between pe.inicio and pe.fim and public.periodo_vale_para_turma(pe.id, t.id)
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
      and public.periodo_vale_para_turma(v_per.id, t.id)
    group by b.professor_id, p.turma_id
  loop
    perform public.registrar_entrega(p_periodo, r.professor_id, r.turma_id, r.quando, false);
  end loop;
end;
$$;

create or replace function public.relatorio_entregas(p_inicio date, p_fim date)
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
      join public.periodos_entrega pe on public.periodo_vale_para_turma(pe.id, pr.turma_id)
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

create or replace function public.preparar_envios(p_hoje date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone public.fuso_escola())::date);
  v_cfg public.config_notificacoes;
  v_novos int := 0;
  r record;
  v_dest uuid;
  v_avisados int;
  v_texto text;
begin
  select * into v_cfg from public.config_notificacoes where id = 1;
  if not v_cfg.emails_ativos then
    return 0;
  end if;

  -- 1) Lembretes ao professor (um e-mail por professor, período e dia de antecedência)
  for r in
    select pe.id as periodo, pe.inicio, pe.fim, pe.prazo, (pe.prazo - v_hoje) as dias, pr.usuario_id,
           string_agg(pr.turma, ', ' order by pr.turma) as turmas
    from public.periodos_entrega pe
    join public.pares_esperados() pr on public.periodo_vale_para_turma(pe.id, pr.turma_id)
    where (pe.prazo - v_hoje) = any (v_cfg.lembrete_dias)
      and not exists (select 1 from public.entregas e
                      where e.periodo_id = pe.id and e.professor_id = pr.usuario_id and e.turma_id = pr.turma_id)
    group by pe.id, pe.inicio, pe.fim, pe.prazo, pr.usuario_id
  loop
    v_texto := case when r.dias = 0
      then 'Hoje é o último dia para entregar o planejamento de '
      else 'Faltam ' || r.dias || case when r.dias = 1 then ' dia' else ' dias' end || ' para entregar o planejamento de '
    end || r.turmas || ' (período de ' || to_char(r.inicio, 'DD/MM') || ' a ' || to_char(r.fim, 'DD/MM') || '). '
      || 'Data-limite: ' || to_char(r.prazo, 'DD/MM/YYYY') || '. Confira suas entregas e conclua todos os dias do período.';
    if public.enfileirar(
      'lembrete',
      'lembrete:' || r.periodo || ':' || r.usuario_id || ':' || r.dias,
      r.usuario_id,
      case when r.dias = 0 then 'Prazo de entrega do planejamento é hoje'
           else 'Prazo de entrega do planejamento em ' || r.dias || case when r.dias = 1 then ' dia' else ' dias' end end,
      v_texto,
      '/planejamentos?semana=' || r.inicio,
      case when r.dias = 0 then 'Prazo de entrega é hoje' else 'Prazo de entrega se aproximando' end
    ) then
      v_novos := v_novos + 1;
    end if;
  end loop;

  -- 2) Alerta à Coordenação no dia seguinte ao prazo (com janela de 7 dias para recuperar falhas)
  if v_cfg.alerta_coordenacao then
    for r in
      select pe.id as periodo, pe.inicio, pe.fim, pe.prazo, pr.usuario_id, pr.turma_id, pr.turma, pr.etapa_id, pr.professor
      from public.periodos_entrega pe
      join public.pares_esperados() pr on public.periodo_vale_para_turma(pe.id, pr.turma_id)
      where pe.prazo < v_hoje and pe.prazo >= v_hoje - 7
        and not exists (select 1 from public.entregas e
                        where e.periodo_id = pe.id and e.professor_id = pr.usuario_id and e.turma_id = pr.turma_id)
    loop
      v_texto := 'O planejamento de ' || r.professor || ' para a turma ' || r.turma || ' (período de '
        || to_char(r.inicio, 'DD/MM') || ' a ' || to_char(r.fim, 'DD/MM') || ') não foi entregue até a data-limite, '
        || to_char(r.prazo, 'DD/MM/YYYY') || '.';
      v_avisados := 0;
      for v_dest in
        select pf.id from public.perfis pf
        where pf.status = 'ativo' and pf.papel = 'coordenador'
          and exists (select 1 from public.vinculos v
                      where v.usuario_id = pf.id and v.ativo and v.turma_id is null and v.etapa_id = r.etapa_id)
      loop
        v_avisados := v_avisados + 1;
        if public.enfileirar(
          'alerta_coordenacao',
          'alerta:' || r.periodo || ':' || r.turma_id || ':' || r.usuario_id || ':' || v_dest,
          v_dest,
          'TURMA ' || upper(r.turma) || ' DE PROFESSOR ' || upper(r.professor) || ' – PLANEJAMENTO NÃO IDENTIFICADO',
          v_texto,
          '/planejamentos?turma=' || r.turma_id || '&semana=' || r.inicio,
          'Planejamento não identificado'
        ) then
          v_novos := v_novos + 1;
        end if;
      end loop;
      if v_avisados = 0 then
        for v_dest in select pf.id from public.perfis pf where pf.status = 'ativo' and pf.papel = 'secretaria' loop
          if public.enfileirar(
            'alerta_coordenacao',
            'alerta:' || r.periodo || ':' || r.turma_id || ':' || r.usuario_id || ':' || v_dest,
            v_dest,
            'TURMA ' || upper(r.turma) || ' DE PROFESSOR ' || upper(r.professor) || ' – PLANEJAMENTO NÃO IDENTIFICADO',
            v_texto,
            '/planejamentos?turma=' || r.turma_id || '&semana=' || r.inicio,
            'Planejamento não identificado'
          ) then
            v_novos := v_novos + 1;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  return v_novos;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.fora_do_pl(uuid, timestamptz), public.marcar_fora_do_pl(), public.pode_definir_pl(uuid)
  from public, anon, authenticated;
revoke execute on function public.periodo_vale_para_turma(bigint, bigint) from public, anon, authenticated;
revoke execute on function
  public.salvar_horarios_pl(uuid, jsonb),
  public.salvar_periodo(bigint, date, date, date, smallint, bigint[])
from public, anon;
grant execute on function
  public.salvar_horarios_pl(uuid, jsonb),
  public.salvar_periodo(bigint, date, date, date, smallint, bigint[])
to authenticated;
