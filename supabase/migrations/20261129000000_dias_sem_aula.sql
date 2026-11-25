-- =============================================================================
-- Calendário escolar: dias sem aula (feriados, recessos, formações)
-- Cadastrados pela Direção ou Secretaria; valem para a escola toda ou para
-- uma etapa. Passam a valer na entrega (o dia deixa de ser exigido) e na
-- contagem de dias úteis da antecedência.
-- =============================================================================

create table public.dias_sem_aula (
  id                 bigint generated always as identity primary key,
  data               date not null,
  descricao          text not null check (length(trim(descricao)) > 0),
  etapa_id           smallint references public.etapas (id),   -- null = escola toda
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now()
);
create unique index dias_sem_aula_unicos on public.dias_sem_aula (data, coalesce(etapa_id, 0));

create trigger dias_sem_aula_trava before insert or update on public.dias_sem_aula
  for each row execute function public.aplicar_trava();
create trigger dias_sem_aula_auditoria after insert or update or delete on public.dias_sem_aula
  for each row execute function public.registrar_auditoria();

-- Há aula nesta data (para esta etapa)? Fim de semana e dias sem aula = não.
create function public.ha_aula(p_data date, p_etapa smallint default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select extract(isodow from p_data) < 6
     and not exists (
       select 1 from public.dias_sem_aula d
       where d.data = p_data and (d.etapa_id is null or d.etapa_id = p_etapa)
     );
$$;

-- Recria a contagem de dias úteis e a situação considerando os dias sem aula.
drop function public.situacao_da_entrega(date, date);
drop function public.dias_uteis_entre(date, date);

create function public.dias_uteis_entre(a date, b date, p_etapa smallint default null)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from generate_series(a + 1, b, interval '1 day') d
  where public.ha_aula(d::date, p_etapa);
$$;

create function public.situacao_da_entrega(p_entregue date, p_prazo date, p_etapa smallint default null)
returns public.situacao_entrega
language sql
stable
set search_path = ''
as $$
  select case
    when p_entregue > p_prazo then 'atrasado'::public.situacao_entrega
    when public.dias_uteis_entre(p_entregue, p_prazo, p_etapa) >= 2 then 'antecipado'::public.situacao_entrega
    else 'no_prazo'::public.situacao_entrega
  end;
$$;

-- Regente: todo dia COM AULA do período precisa ter bloco concluído.
create or replace function public.periodo_concluido(p_periodo bigint, p_professor uuid, p_turma bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_per public.periodos_entrega;
  v_etapa smallint;
  v_regente boolean;
begin
  select * into v_per from public.periodos_entrega where id = p_periodo;
  select etapa_id into v_etapa from public.turmas where id = p_turma;

  if exists (
    select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where b.professor_id = p_professor and p.turma_id = p_turma
      and p.data between v_per.inicio and v_per.fim
      and b.excluido_em is null and b.status <> 'verde'
  ) then
    return false;
  end if;

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

  return not exists (
    select 1 from generate_series(v_per.inicio, v_per.fim, interval '1 day') d
    where public.ha_aula(d::date, v_etapa)
      and not exists (
        select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
        where b.professor_id = p_professor and p.turma_id = p_turma and p.data = d::date
          and b.excluido_em is null and b.status = 'verde'
      )
  );
end;
$$;

-- registrar_entrega passa a considerar os dias sem aula da etapa da turma.
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
  v_situacao := public.situacao_da_entrega((p_entregue_em at time zone 'America/Sao_Paulo')::date, v_per.prazo, v_turma.etapa_id);

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

-- Reavalia as entregas dos períodos que contêm a data (ex.: feriado cadastrado
-- depois pode completar o período de um Regente). Sem notificação retroativa.
create function public.reavaliar_periodos_da_data(p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  for v_id in select id from public.periodos_entrega where p_data between inicio and fim loop
    perform public.avaliar_entregas_do_periodo(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Páscoa (algoritmo de Meeus/Jones/Butcher) e feriados nacionais
-- ---------------------------------------------------------------------------
create function public.pascoa(p_ano int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a int := p_ano % 19;
  b int := p_ano / 100;
  c int := p_ano % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  mes int := (h + l - 7 * m + 114) / 31;
  dia int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_ano, mes, dia);
end;
$$;

create function public.feriados_nacionais(p_ano int)
returns table (data date, descricao text)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    (make_date(p_ano, 1, 1),   'Confraternização Universal'),
    (public.pascoa(p_ano) - 48, 'Carnaval'),
    (public.pascoa(p_ano) - 47, 'Carnaval'),
    (public.pascoa(p_ano) - 2,  'Sexta-feira Santa'),
    (make_date(p_ano, 4, 21),  'Tiradentes'),
    (make_date(p_ano, 5, 1),   'Dia do Trabalho'),
    (public.pascoa(p_ano) + 60, 'Corpus Christi'),
    (make_date(p_ano, 9, 7),   'Independência do Brasil'),
    (make_date(p_ano, 10, 12), 'Nossa Senhora Aparecida'),
    (make_date(p_ano, 11, 2),  'Finados'),
    (make_date(p_ano, 11, 15), 'Proclamação da República'),
    (make_date(p_ano, 11, 20), 'Dia Nacional de Zumbi e da Consciência Negra'),
    (make_date(p_ano, 12, 25), 'Natal')
  ) as f (data, descricao);
$$;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------
create function public.exigir_direcao_ou_secretaria()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.meu_papel() is null or public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica define o calendário.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.salvar_dia_sem_aula(p_id bigint, p_data date, p_descricao text, p_etapa smallint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_antiga date;
begin
  perform public.exigir_direcao_ou_secretaria();
  if p_data is null or nullif(trim(p_descricao), '') is null then
    raise exception 'Informe a data e o motivo.' using errcode = 'P0001';
  end if;
  begin
    if p_id is null then
      insert into public.dias_sem_aula (data, descricao, etapa_id) values (p_data, trim(p_descricao), p_etapa) returning id into v_id;
    else
      select data into v_antiga from public.dias_sem_aula where id = p_id;
      update public.dias_sem_aula set data = p_data, descricao = trim(p_descricao), etapa_id = p_etapa where id = p_id returning id into v_id;
      if v_id is null then
        raise exception 'Dia não encontrado.' using errcode = 'P0001';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Esta data já está cadastrada como dia sem aula.' using errcode = 'P0001';
  end;
  perform public.reavaliar_periodos_da_data(p_data);
  return v_id;
end;
$$;

create function public.remover_dia_sem_aula(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia public.dias_sem_aula;
begin
  perform public.exigir_direcao_ou_secretaria();
  select * into v_dia from public.dias_sem_aula where id = p_id;
  if not found then
    raise exception 'Dia não encontrado.' using errcode = 'P0001';
  end if;
  if v_dia.definido_por_nivel > public.meu_nivel() then
    raise exception 'Este dia foi cadastrado por um Diretor. Apenas um Diretor pode removê-lo.' using errcode = 'P0001';
  end if;
  delete from public.dias_sem_aula where id = p_id;
end;
$$;

-- Importa os feriados nacionais do ano (pula datas já cadastradas). Devolve quantos entraram.
create function public.importar_feriados_nacionais(p_ano int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
  v_data date;
begin
  perform public.exigir_direcao_ou_secretaria();
  if p_ano < 2000 or p_ano > 2100 then
    raise exception 'Ano inválido.' using errcode = 'P0001';
  end if;
  insert into public.dias_sem_aula (data, descricao)
  select f.data, f.descricao from public.feriados_nacionais(p_ano) f
  where not exists (select 1 from public.dias_sem_aula d where d.data = f.data and d.etapa_id is null);
  get diagnostics v_n = row_count;
  for v_data in select f.data from public.feriados_nacionais(p_ano) f loop
    perform public.reavaliar_periodos_da_data(v_data);
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------
alter table public.dias_sem_aula enable row level security;
create policy "usuários ativos leem o calendário" on public.dias_sem_aula
  for select to authenticated using (public.meu_perfil_ativo());

revoke execute on function public.reavaliar_periodos_da_data(date), public.exigir_direcao_ou_secretaria()
  from public, anon, authenticated;

revoke execute on function
  public.salvar_dia_sem_aula(bigint, date, text, smallint), public.remover_dia_sem_aula(bigint),
  public.importar_feriados_nacionais(int)
from public, anon;
grant execute on function
  public.salvar_dia_sem_aula(bigint, date, text, smallint), public.remover_dia_sem_aula(bigint),
  public.importar_feriados_nacionais(int)
to authenticated;
