-- Revisão feita: o professor avisa quem pediu a revisão.
--
-- * Com o pedido de "Revisar" em aberto, editar o bloco não apaga o pedido
--   (ele continua visível enquanto o professor corrige).
-- * Quando termina, o professor clica em "Revisão feita": o bloco volta a
--   "aguardando aprovação" e quem pediu a revisão é notificado.
-- * Um bloco "aprovado" que for alterado continua voltando a "aguardando".

create or replace function public.reabrir_aprovacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.aprovacao = 'aprovado'
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

create function public.concluir_revisao(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloco public.blocos;
  v_plan  public.planejamentos;
  v_turma text;
  v_prof  text;
begin
  select * into v_bloco from public.blocos where id = p_id for update;
  if not found or v_bloco.excluido_em is not null then
    raise exception 'Bloco não encontrado.' using errcode = 'P0001';
  end if;
  if v_bloco.professor_id <> auth.uid() then
    raise exception 'Somente o professor responsável pode concluir a revisão.' using errcode = 'P0001';
  end if;
  if v_bloco.aprovacao is distinct from 'revisar' then
    raise exception 'Não há pedido de revisão em aberto neste planejamento.' using errcode = 'P0001';
  end if;
  if v_bloco.atualizado_em <= v_bloco.aprovacao_em then
    raise exception 'Faça as alterações pedidas antes de avisar que a revisão foi feita.' using errcode = 'P0001';
  end if;

  update public.blocos
     set aprovacao = null, aprovacao_por = null, aprovacao_em = null, aprovacao_obs = null
   where id = p_id;

  select * into v_plan from public.planejamentos where id = v_bloco.planejamento_id;
  select nome into v_turma from public.turmas where id = v_plan.turma_id;
  select nome into v_prof from public.perfis where id = v_bloco.professor_id;
  if v_bloco.aprovacao_por is not null then
    perform public.notificar(
      v_bloco.aprovacao_por, 'planejamento_revisado',
      'Planejamento de ' || to_char(v_plan.data, 'DD/MM/YYYY') || ' revisado',
      v_turma || ': ' || v_prof || ' fez a revisão que você pediu. O planejamento aguarda a sua avaliação.',
      '/planejamentos/' || v_plan.turma_id || '/' || v_plan.data || '/' || v_plan.turno);
  end if;
end;
$$;

revoke execute on function public.concluir_revisao(bigint) from public, anon;
grant execute on function public.concluir_revisao(bigint) to authenticated;
