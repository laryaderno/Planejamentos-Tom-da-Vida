-- Entrega só com o período inteiro concluído.
--
-- Antes, o especialista sem aulas na grade "entregava" quando concluía os
-- blocos que já tinha criado — e a entrega saía com o resto da semana em
-- branco. Agora:
--   * Com aulas na grade: precisa de bloco concluído da disciplina em cada aula
--     prevista no período (como antes).
--   * Sem grade (Regente ou especialista): precisa de bloco concluído em todo
--     dia com aula do período.
-- E qualquer bloco do período que não esteja concluído impede a entrega.

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
begin
  select * into v_per from public.periodos_entrega where id = p_periodo;
  select etapa_id into v_etapa from public.turmas where id = p_turma;

  -- Algum bloco do professor no período ainda não concluído?
  if exists (
    select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where b.professor_id = p_professor and p.turma_id = p_turma
      and p.data between v_per.inicio and v_per.fim
      and b.excluido_em is null and b.status <> 'verde'
  ) then
    return false;
  end if;

  -- Nenhum bloco no período: nada a entregar.
  if not exists (
    select 1 from public.blocos b join public.planejamentos p on p.id = b.planejamento_id
    where b.professor_id = p_professor and p.turma_id = p_turma
      and p.data between v_per.inicio and v_per.fim and b.excluido_em is null
  ) then
    return false;
  end if;

  -- Com grade: cada aula prevista (em dia com aula) precisa de bloco concluído da disciplina.
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

  -- Sem grade: todo dia com aula do período precisa de bloco concluído.
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

-- Entregas registradas pela regra antiga que não valem pela nova (período
-- incompleto): saem, com as notificações delas. Voltam a ser registradas quando
-- o período for de fato concluído.
delete from public.notificacoes n
using public.entregas e
where n.entrega_id = e.id and not public.periodo_concluido(e.periodo_id, e.professor_id, e.turma_id);

delete from public.entregas e
where not public.periodo_concluido(e.periodo_id, e.professor_id, e.turma_id);
