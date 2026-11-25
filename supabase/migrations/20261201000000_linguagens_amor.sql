-- =============================================================================
-- Mais de uma Linguagem do Amor por bloco (pedido de 25/11/2026).
-- Na Educação Infantil, ao menos uma é obrigatória para concluir (verde).
-- =============================================================================

alter table public.blocos add column linguagens_amor public.linguagem_amor[] not null default '{}';

-- Migra o valor atual sem disparar versão/histórico.
alter table public.blocos disable trigger user;
update public.blocos set linguagens_amor = array[linguagem_amor] where linguagem_amor is not null;
alter table public.blocos enable trigger user;

alter table public.blocos drop column linguagem_amor;

create or replace function public.validar_bloco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exige boolean;
begin
  select e.exige_linguagem_amor into v_exige
  from public.planejamentos p
  join public.turmas t on t.id = p.turma_id
  join public.etapas e on e.id = t.etapa_id
  where p.id = new.planejamento_id;

  new.linguagens_amor := array(select distinct unnest(new.linguagens_amor) order by 1);

  if not v_exige and cardinality(new.linguagens_amor) > 0 then
    raise exception 'A Linguagem do Amor só é registrada em turmas da Educação Infantil.' using errcode = 'P0001';
  end if;
  if v_exige and new.status = 'verde' and cardinality(new.linguagens_amor) = 0 then
    raise exception 'Na Educação Infantil, informe ao menos uma Linguagem do Amor trabalhada antes de marcar como concluído.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    new.versao := old.versao + 1;
    new.atualizado_em := now();
    new.atualizado_por := coalesce(auth.uid(), old.atualizado_por);
  end if;
  return new;
end;
$$;

create or replace function public.registrar_historico_bloco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb := to_jsonb(old);
  v_depois jsonb := to_jsonb(new);
  v_campo  text;
begin
  foreach v_campo in array array[
    'hora_inicio', 'hora_fim', 'conteudo', 'objetivos', 'habilidades', 'estrategias',
    'atividades', 'avaliacao', 'recursos', 'linguagens_amor', 'status', 'arquivado_em', 'excluido_em'
  ] loop
    if v_antes -> v_campo is distinct from v_depois -> v_campo then
      insert into public.historico_blocos (bloco_id, autor_id, campo, valor_anterior, valor_novo)
      values (new.id, auth.uid(), v_campo, v_antes ->> v_campo, v_depois ->> v_campo);
    end if;
  end loop;
  update public.planejamentos set atualizado_em = now() where id = new.planejamento_id;
  return new;
end;
$$;

create or replace function public.salvar_bloco(p_id bigint, p_versao int, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloco public.blocos;
  v_conflito boolean;
begin
  select * into v_bloco from public.blocos where id = p_id for update;
  if not found or v_bloco.excluido_em is not null then
    raise exception 'Bloco não encontrado.' using errcode = 'P0001';
  end if;
  if v_bloco.professor_id <> auth.uid() or public.meu_papel() <> 'professor' then
    raise exception 'Somente o professor responsável pode editar este bloco.' using errcode = 'P0001';
  end if;
  if v_bloco.arquivado_em is not null then
    raise exception 'Este planejamento está arquivado e não pode ser editado.' using errcode = 'P0001';
  end if;
  v_conflito := p_versao is not null and p_versao <> v_bloco.versao;

  update public.blocos set
    hora_inicio     = case when p_campos ? 'hora_inicio' then (p_campos ->> 'hora_inicio')::time else hora_inicio end,
    hora_fim        = case when p_campos ? 'hora_fim'    then (p_campos ->> 'hora_fim')::time else hora_fim end,
    conteudo        = case when p_campos ? 'conteudo'    then coalesce(p_campos ->> 'conteudo', '') else conteudo end,
    objetivos       = case when p_campos ? 'objetivos'   then coalesce(p_campos ->> 'objetivos', '') else objetivos end,
    habilidades     = case when p_campos ? 'habilidades'
                           then array(select jsonb_array_elements_text(p_campos -> 'habilidades'))::public.inteligencia[]
                           else habilidades end,
    estrategias     = case when p_campos ? 'estrategias' then coalesce(p_campos ->> 'estrategias', '') else estrategias end,
    atividades      = case when p_campos ? 'atividades'  then coalesce(p_campos ->> 'atividades', '') else atividades end,
    avaliacao       = case when p_campos ? 'avaliacao'   then coalesce(p_campos ->> 'avaliacao', '') else avaliacao end,
    recursos        = case when p_campos ? 'recursos'    then coalesce(p_campos ->> 'recursos', '') else recursos end,
    linguagens_amor = case when p_campos ? 'linguagens_amor'
                           then array(select jsonb_array_elements_text(p_campos -> 'linguagens_amor'))::public.linguagem_amor[]
                           else linguagens_amor end,
    status          = case when p_campos ? 'status' then (p_campos ->> 'status')::public.status_bloco else status end
  where id = p_id
  returning * into v_bloco;

  return jsonb_build_object('versao', v_bloco.versao, 'atualizado_em', v_bloco.atualizado_em, 'conflito', v_conflito);
end;
$$;
