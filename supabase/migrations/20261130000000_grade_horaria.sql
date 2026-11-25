-- =============================================================================
-- Grade horária das turmas
-- A Coordenação (na sua etapa), a Secretaria e a Direção montam a grade de cada
-- turma. A grade vale "a partir de" uma data: mudanças não alteram o passado.
-- Usos: "Meus horários" do professor, horários previstos no dia e a regra de
-- entrega (cada professor precisa concluir os horários que a grade lhe dá).
-- =============================================================================

create table public.horarios (
  id                 bigint generated always as identity primary key,
  turma_id           bigint not null references public.turmas (id),
  dia_semana         smallint not null check (dia_semana between 1 and 5),   -- 1 = segunda
  hora_inicio        time not null,
  hora_fim           time not null,
  disciplina_id      smallint not null references public.disciplinas (id),
  professor_id       uuid not null references public.perfis (id),
  vigente_desde      date not null,
  vigente_ate        date,
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now(),
  constraint horario_grade_valido check (hora_fim > hora_inicio),
  constraint vigencia_valida check (vigente_ate is null or vigente_ate >= vigente_desde)
);
create index horarios_turma_idx on public.horarios (turma_id, vigente_desde);
create index horarios_professor_idx on public.horarios (professor_id);

create trigger horarios_auditoria after insert or update or delete on public.horarios
  for each row execute function public.registrar_auditoria();

-- Horário vale nesta data?
create function public.horario_vigente(h public.horarios, p_data date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select h.vigente_desde <= p_data and (h.vigente_ate is null or h.vigente_ate >= p_data);
$$;

-- ---------------------------------------------------------------------------
-- RPC: salvar a grade da turma a partir de uma data
-- Formato: [{ "dia_semana": 1, "hora_inicio": "07:30", "hora_fim": "08:20",
--             "disciplina_id": 3, "professor_id": "uuid" }, ...]
-- ---------------------------------------------------------------------------
create function public.salvar_grade(p_turma bigint, p_vigente_desde date, p_aulas jsonb)
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

  -- Trava em cascata: grade definida por nível superior (vigente ou futura)
  select h.definido_por_nivel, h.definido_em, pf.nome into v_trava
  from public.horarios h left join public.perfis pf on pf.id = h.definido_por_id
  where h.turma_id = p_turma and (h.vigente_ate is null or h.vigente_ate >= p_vigente_desde)
  order by h.definido_por_nivel desc
  limit 1;
  if found and v_trava.definido_por_nivel > public.meu_nivel() then
    raise exception 'Esta configuração foi definida por % (%) em %. Apenas % pode alterá-la.',
      coalesce(v_trava.nome, 'usuário removido'),
      public.rotulo_nivel(v_trava.definido_por_nivel),
      to_char(v_trava.definido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
      public.rotulo_nivel_com_artigo(v_trava.definido_por_nivel)
      using errcode = 'P0001', hint = 'trava_hierarquica';
  end if;

  -- Validação de cada aula
  for a in
    select * from jsonb_to_recordset(coalesce(p_aulas, '[]'))
      as x(dia_semana smallint, hora_inicio time, hora_fim time, disciplina_id smallint, professor_id uuid)
  loop
    if a.dia_semana is null or a.dia_semana not between 1 and 5 then
      raise exception 'Dia da semana inválido.' using errcode = 'P0001';
    end if;
    if a.hora_inicio is null or a.hora_fim is null or a.hora_fim <= a.hora_inicio then
      raise exception 'Cada aula precisa de início e fim (fim depois do início).' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.vinculos v
      where v.usuario_id = a.professor_id and v.turma_id = p_turma and v.disciplina_id = a.disciplina_id and v.ativo
    ) then
      raise exception 'Há uma aula com professor que não leciona essa disciplina nesta turma. Ajuste as permissões do professor antes.'
        using errcode = 'P0001';
    end if;
  end loop;

  -- Sobreposição na própria turma
  select x.dia_semana, x.hora_inicio into v_conflito
  from jsonb_to_recordset(coalesce(p_aulas, '[]')) as x(dia_semana smallint, hora_inicio time, hora_fim time)
  join jsonb_to_recordset(coalesce(p_aulas, '[]')) as y(dia_semana smallint, hora_inicio time, hora_fim time)
    on x.dia_semana = y.dia_semana and (x.hora_inicio, x.hora_fim) is distinct from (y.hora_inicio, y.hora_fim)
   and x.hora_inicio < y.hora_fim and y.hora_inicio < x.hora_fim
  limit 1;
  if found then
    raise exception 'Há aulas com horários sobrepostos na turma (dia %, %).',
      v_conflito.dia_semana, to_char(v_conflito.hora_inicio, 'HH24:MI') using errcode = 'P0001';
  end if;

  -- Mesmo professor em outra turma no mesmo horário
  select pf.nome, t.nome as turma, x.dia_semana into v_conflito
  from jsonb_to_recordset(coalesce(p_aulas, '[]')) as x(dia_semana smallint, hora_inicio time, hora_fim time, professor_id uuid)
  join public.horarios h on h.professor_id = x.professor_id and h.turma_id <> p_turma and h.dia_semana = x.dia_semana
   and public.horario_vigente(h, p_vigente_desde)
   and x.hora_inicio < h.hora_fim and h.hora_inicio < x.hora_fim
  join public.perfis pf on pf.id = x.professor_id
  join public.turmas t on t.id = h.turma_id
  limit 1;
  if found then
    raise exception '% já tem aula em % nesse mesmo horário.', v_conflito.nome, v_conflito.turma using errcode = 'P0001';
  end if;

  -- Aplica: versões futuras são substituídas; a vigente termina na véspera.
  delete from public.horarios where turma_id = p_turma and vigente_desde >= p_vigente_desde;
  update public.horarios set vigente_ate = p_vigente_desde - 1
   where turma_id = p_turma and vigente_desde < p_vigente_desde and (vigente_ate is null or vigente_ate >= p_vigente_desde);

  insert into public.horarios (turma_id, dia_semana, hora_inicio, hora_fim, disciplina_id, professor_id, vigente_desde,
                               definido_por_id, definido_por_nivel, definido_em)
  select p_turma, x.dia_semana, x.hora_inicio, x.hora_fim, x.disciplina_id, x.professor_id, p_vigente_desde,
         auth.uid(), public.meu_nivel(), now()
  from jsonb_to_recordset(coalesce(p_aulas, '[]'))
    as x(dia_semana smallint, hora_inicio time, hora_fim time, disciplina_id smallint, professor_id uuid);

  -- A nova grade pode completar entregas de períodos em aberto.
  for v_per in select id from public.periodos_entrega where fim >= p_vigente_desde loop
    perform public.avaliar_entregas_do_periodo(v_per);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Regra de entrega com a grade
--   * Professor com aulas na grade do período: precisa concluir (verde) um bloco
--     da disciplina em cada dia com aula previsto para ele.
--   * Sem grade para ele: regras anteriores (Regente = todo dia com aula;
--     especialista = os blocos que criou).
-- ---------------------------------------------------------------------------
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

  -- Com grade: cada aula prevista (dia com aula) precisa de bloco concluído da disciplina.
  if exists (
    select 1 from public.horarios h
    where h.turma_id = p_turma and h.professor_id = p_professor
      and h.vigente_desde <= v_per.fim and (h.vigente_ate is null or h.vigente_ate >= v_per.inicio)
  ) then
    return not exists (
      select 1
      from generate_series(v_per.inicio, v_per.fim, interval '1 day') d
      join public.horarios h on h.turma_id = p_turma and h.professor_id = p_professor
        and h.dia_semana = extract(isodow from d) and public.horario_vigente(h, d::date)
      where public.ha_aula(d::date, v_etapa)
        and not exists (
          select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
          where b.professor_id = p_professor and p.turma_id = p_turma and p.data = d::date
            and b.disciplina_id = h.disciplina_id and b.excluido_em is null and b.status = 'verde'
        )
    );
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

-- Nomes: inclui professores da grade das turmas que o usuário vê.
create or replace function public.nomes_usuarios(p_ids uuid[])
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome
  from public.perfis p
  where p.id = any (p_ids)
    and (
      public.meu_nivel() >= 20
      or p.id = auth.uid()
      or exists (select 1 from public.blocos b
                 where b.professor_id = p.id and public.pode_ver_planejamento(b.planejamento_id))
      or exists (select 1 from public.notas n
                 where n.autor_id = p.id and public.pode_ver_planejamento(n.planejamento_id))
      or exists (select 1 from public.historico_blocos h join public.blocos b on b.id = h.bloco_id
                 where h.autor_id = p.id and public.pode_ver_planejamento(b.planejamento_id))
      or exists (select 1 from public.horarios g
                 where g.professor_id = p.id and public.pode_ver_turma(g.turma_id))
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------
alter table public.horarios enable row level security;
create policy "quem vê a turma vê a grade; o professor vê a sua" on public.horarios
  for select to authenticated using (professor_id = auth.uid() or public.pode_ver_turma(turma_id));

revoke execute on function public.salvar_grade(bigint, date, jsonb) from public, anon;
grant execute on function public.salvar_grade(bigint, date, jsonb) to authenticated;
