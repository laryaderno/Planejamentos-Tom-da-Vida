-- Aprovação do planejamento e avisos de nota.
--
-- * Coordenação (na sua etapa), Secretaria e Direção avaliam cada bloco do
--   professor: "Aprovar" ou "Revisar" (com o que precisa ser revisto).
--   O professor recebe uma notificação nos dois casos.
-- * Se o professor alterar o bloco depois de avaliado, a avaliação volta a
--   "aguardando" (o que foi aprovado não pode mudar sem nova aprovação).
-- * Nota deixada por outra pessoa no planejamento avisa os professores dele:
--   "Há uma nova nota em Planejamento de [data]".

alter table public.blocos
  add column aprovacao     text check (aprovacao in ('aprovado', 'revisar')),
  add column aprovacao_por uuid references public.perfis (id),
  add column aprovacao_em  timestamptz,
  add column aprovacao_obs text;

-- ---------------------------------------------------------------------------
-- Edição depois da avaliação: volta a aguardar.
-- ---------------------------------------------------------------------------
create function public.reabrir_aprovacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.aprovacao is not null
     and new.aprovacao is not distinct from old.aprovacao
     and new.aprovacao_em is not distinct from old.aprovacao_em
     and (to_jsonb(new) - array['versao', 'atualizado_em', 'atualizado_por', 'aprovacao', 'aprovacao_por', 'aprovacao_em', 'aprovacao_obs'])
         is distinct from
         (to_jsonb(old) - array['versao', 'atualizado_em', 'atualizado_por', 'aprovacao', 'aprovacao_por', 'aprovacao_em', 'aprovacao_obs'])
     and new.arquivado_em is not distinct from old.arquivado_em
     and new.excluido_em is not distinct from old.excluido_em
  then
    new.aprovacao := null;
    new.aprovacao_por := null;
    new.aprovacao_em := null;
    new.aprovacao_obs := null;
  end if;
  return new;
end;
$$;

create trigger blocos_reabrir_aprovacao before update on public.blocos
  for each row execute function public.reabrir_aprovacao();

-- Histórico: a avaliação também aparece nas edições do bloco.
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
    'atividades', 'avaliacao', 'recursos', 'linguagens_amor', 'status', 'arquivado_em', 'excluido_em', 'aprovacao'
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

-- ---------------------------------------------------------------------------
-- RPC: Aprovar ou Revisar
-- ---------------------------------------------------------------------------
create function public.avaliar_bloco(p_id bigint, p_decisao text, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloco public.blocos;
  v_plan  public.planejamentos;
  v_turma public.turmas;
  v_quem  text;
  v_obs   text := nullif(trim(coalesce(p_observacao, '')), '');
  v_dia   text;
begin
  if p_decisao not in ('aprovado', 'revisar') then
    raise exception 'Decisão inválida.' using errcode = 'P0001';
  end if;
  if public.meu_papel() not in ('diretor', 'secretaria', 'coordenador') then
    raise exception 'Somente a Coordenação, a Secretaria ou a Direção avaliam planejamentos.' using errcode = 'P0001';
  end if;

  select * into v_bloco from public.blocos where id = p_id for update;
  if not found or v_bloco.excluido_em is not null then
    raise exception 'Bloco não encontrado.' using errcode = 'P0001';
  end if;
  if v_bloco.arquivado_em is not null then
    raise exception 'Este planejamento está arquivado.' using errcode = 'P0001';
  end if;
  select * into v_plan from public.planejamentos where id = v_bloco.planejamento_id;
  select * into v_turma from public.turmas where id = v_plan.turma_id;
  if not public.pode_editar_etapa(v_turma.etapa_id) then
    raise exception 'Você não tem permissão para avaliar planejamentos desta etapa.' using errcode = 'P0001';
  end if;
  if p_decisao = 'aprovado' and v_bloco.status <> 'verde' then
    raise exception 'Só é possível aprovar um planejamento concluído. Use "Revisar" para pedir ajustes.' using errcode = 'P0001';
  end if;
  if p_decisao = 'revisar' and v_obs is null then
    raise exception 'Escreva o que o professor precisa revisar.' using errcode = 'P0001';
  end if;

  update public.blocos
     set aprovacao = p_decisao, aprovacao_por = auth.uid(), aprovacao_em = now(), aprovacao_obs = v_obs
   where id = p_id;

  select nome into v_quem from public.perfis where id = auth.uid();
  v_dia := to_char(v_plan.data, 'DD/MM/YYYY');
  if p_decisao = 'aprovado' then
    perform public.notificar(
      v_bloco.professor_id, 'planejamento_aprovado',
      'Planejamento de ' || v_dia || ' aprovado',
      v_turma.nome || ': aprovado por ' || v_quem || '.' || coalesce(' Observação: ' || v_obs, ''),
      '/planejamentos/' || v_turma.id || '/' || v_plan.data || '/' || v_plan.turno);
  else
    perform public.notificar(
      v_bloco.professor_id, 'planejamento_revisar',
      'Revisar planejamento de ' || v_dia,
      v_turma.nome || ': ' || v_quem || ' pediu revisão. ' || v_obs,
      '/planejamentos/' || v_turma.id || '/' || v_plan.data || '/' || v_plan.turno);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nova nota: avisa os professores do planejamento (menos quem escreveu).
-- ---------------------------------------------------------------------------
create function public.avisar_nova_nota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  public.planejamentos;
  v_turma text;
  v_autor text;
  v_prof  uuid;
begin
  select * into v_plan from public.planejamentos where id = new.planejamento_id;
  select nome into v_turma from public.turmas where id = v_plan.turma_id;
  select nome into v_autor from public.perfis where id = new.autor_id;
  for v_prof in
    select distinct b.professor_id from public.blocos b
    where b.planejamento_id = new.planejamento_id
      and b.excluido_em is null and b.arquivado_em is null
      and b.professor_id <> new.autor_id
  loop
    perform public.notificar(
      v_prof, 'nota',
      'Há uma nova nota em Planejamento de ' || to_char(v_plan.data, 'DD/MM/YYYY'),
      v_turma || ' · ' || coalesce(v_autor, 'Alguém') || ': ' ||
        case when length(new.texto) > 140 then left(new.texto, 140) || '…' else new.texto end,
      '/planejamentos/' || v_plan.turma_id || '/' || v_plan.data || '/' || v_plan.turno);
  end loop;
  return new;
end;
$$;

create trigger notas_avisar after insert on public.notas
  for each row execute function public.avisar_nova_nota();

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.reabrir_aprovacao(), public.avisar_nova_nota() from public, anon, authenticated;
revoke execute on function public.avaliar_bloco(bigint, text, text) from public, anon;
grant execute on function public.avaliar_bloco(bigint, text, text) to authenticated;
