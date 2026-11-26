-- Avaliações: só o professor cadastra, com revisão e aprovação, e as aprovadas
-- vão para o Banco de atividades (aba "Avaliações").
--
-- * A gestão (Secretaria, Coordenação na sua etapa, Direção) só agenda as datas
--   — de uma vez, para o ano inteiro da turma (`agendar_avaliacoes`).
-- * O professor da disciplina cadastra conteúdo, material e orientações. Ao
--   cadastrar, a Coordenação da etapa (ou a Secretaria) é avisada.
-- * A gestão aprova ou pede revisão; o professor é notificado. Ao salvar de
--   novo depois de um pedido de revisão, quem pediu é avisado. Alterar uma
--   avaliação aprovada faz ela voltar a aguardar aprovação.
-- * Aprovadas ficam visíveis no banco para quem é da mesma etapa.

alter table public.avaliacoes
  add column aprovacao     text check (aprovacao in ('aprovado', 'revisar')),
  add column aprovacao_por uuid references public.perfis (id),
  add column aprovacao_em  timestamptz,
  add column aprovacao_obs text;

create policy "avaliações aprovadas no banco da etapa" on public.avaliacoes
  for select to authenticated
  using (
    aprovacao = 'aprovado' and public.meu_perfil_ativo()
    and public.pode_ver_etapa((select t.etapa_id from public.turmas t where t.id = turma_id))
  );

-- Link para a avaliação no cronograma.
create function public.link_avaliacao(p_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '/cronograma?turma=' || a.turma_id || '&tipo=' || a.tipo || '&bimestre=' || a.bimestre || '&ano=' || a.ano
  from public.avaliacoes a where a.id = p_id;
$$;

create function public.descricao_avaliacao(p_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.nome || ' · ' || t.nome || ' · avaliação ' || a.tipo || ' do ' || a.bimestre || 'º bimestre ('
         || to_char(a.data, 'DD/MM/YYYY') || ')'
  from public.avaliacoes a
  join public.disciplinas d on d.id = a.disciplina_id
  join public.turmas t on t.id = a.turma_id
  where a.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Professor cadastra (só ele)
-- ---------------------------------------------------------------------------
create or replace function public.cadastrar_avaliacao(p_id bigint, p_conteudo text, p_material text, p_orientacoes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_av    public.avaliacoes;
  v_novo  public.avaliacoes;
  v_etapa smallint;
  v_prof  text;
  v_dest  uuid;
  v_avisados int := 0;
  v_mudou boolean;
begin
  select * into v_av from public.avaliacoes where id = p_id for update;
  if not found then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0001';
  end if;
  if not public.leciona(v_av.turma_id, v_av.disciplina_id) then
    raise exception 'Somente o professor da disciplina nesta turma cadastra esta avaliação.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_conteudo, '')), '') is null then
    raise exception 'Informe o conteúdo da avaliação.' using errcode = 'P0001';
  end if;

  v_mudou := (trim(p_conteudo), trim(coalesce(p_material, '')), trim(coalesce(p_orientacoes, '')))
             is distinct from (v_av.conteudo, v_av.material, v_av.orientacoes);
  if not v_mudou then
    return;
  end if;

  update public.avaliacoes
     set conteudo = trim(p_conteudo), material = trim(coalesce(p_material, '')), orientacoes = trim(coalesce(p_orientacoes, '')),
         preenchida_por = auth.uid(), preenchida_em = now(),
         -- alterou: volta a aguardar aprovação (também depois de um pedido de revisão)
         aprovacao = null, aprovacao_por = null, aprovacao_em = null, aprovacao_obs = null
   where id = p_id
   returning * into v_novo;

  select nome into v_prof from public.perfis where id = auth.uid();

  if v_av.aprovacao = 'revisar' and v_av.aprovacao_por is not null then
    -- Revisão feita: avisa quem pediu.
    perform public.notificar(v_av.aprovacao_por, 'avaliacao_revisada',
      'Avaliação revisada',
      v_prof || ' revisou a ' || public.descricao_avaliacao(v_novo.id) || '. Ela aguarda a sua aprovação.',
      public.link_avaliacao(v_novo.id));
    return;
  end if;

  -- Cadastro (ou alteração): avisa a Coordenação da etapa; sem Coordenação, a Secretaria.
  select etapa_id into v_etapa from public.turmas where id = v_av.turma_id;
  for v_dest in
    select pf.id from public.perfis pf
    where pf.status = 'ativo' and pf.papel = 'coordenador'
      and exists (select 1 from public.vinculos v where v.usuario_id = pf.id and v.ativo and v.turma_id is null and v.etapa_id = v_etapa)
  loop
    perform public.notificar(v_dest, 'avaliacao_pendente', 'Avaliação para aprovar',
      v_prof || ' cadastrou a ' || public.descricao_avaliacao(v_novo.id) || '.', public.link_avaliacao(v_novo.id));
    v_avisados := v_avisados + 1;
  end loop;
  if v_avisados = 0 then
    for v_dest in select pf.id from public.perfis pf where pf.status = 'ativo' and pf.papel = 'secretaria' loop
      perform public.notificar(v_dest, 'avaliacao_pendente', 'Avaliação para aprovar',
        v_prof || ' cadastrou a ' || public.descricao_avaliacao(v_novo.id) || '.', public.link_avaliacao(v_novo.id));
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestão aprova ou pede revisão
-- ---------------------------------------------------------------------------
create function public.avaliar_avaliacao(p_id bigint, p_decisao text, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_av    public.avaliacoes;
  v_etapa smallint;
  v_quem  text;
  v_obs   text := nullif(trim(coalesce(p_observacao, '')), '');
begin
  if p_decisao not in ('aprovado', 'revisar') then
    raise exception 'Decisão inválida.' using errcode = 'P0001';
  end if;
  if public.meu_papel() not in ('diretor', 'secretaria', 'coordenador') then
    raise exception 'Somente a Coordenação, a Secretaria ou a Direção avaliam as avaliações.' using errcode = 'P0001';
  end if;
  select * into v_av from public.avaliacoes where id = p_id for update;
  if not found then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0001';
  end if;
  select etapa_id into v_etapa from public.turmas where id = v_av.turma_id;
  if not public.pode_editar_etapa(v_etapa) then
    raise exception 'Você não tem permissão para avaliar as avaliações desta etapa.' using errcode = 'P0001';
  end if;
  if trim(v_av.conteudo) = '' then
    raise exception 'O professor ainda não cadastrou o conteúdo desta avaliação.' using errcode = 'P0001';
  end if;
  if p_decisao = 'revisar' and v_obs is null then
    raise exception 'Escreva o que o professor precisa revisar.' using errcode = 'P0001';
  end if;

  update public.avaliacoes
     set aprovacao = p_decisao, aprovacao_por = auth.uid(), aprovacao_em = now(), aprovacao_obs = v_obs
   where id = p_id
   returning * into v_av;

  if v_av.preenchida_por is not null then
    select nome into v_quem from public.perfis where id = auth.uid();
    if p_decisao = 'aprovado' then
      perform public.notificar(v_av.preenchida_por, 'avaliacao_aprovada', 'Avaliação aprovada',
        'A ' || public.descricao_avaliacao(v_av.id) || ' foi aprovada por ' || v_quem || ' e já está no banco de atividades.'
          || coalesce(' Observação: ' || v_obs, ''),
        public.link_avaliacao(v_av.id));
    else
      perform public.notificar(v_av.preenchida_por, 'avaliacao_revisar', 'Revisar avaliação',
        v_quem || ' pediu revisão da ' || public.descricao_avaliacao(v_av.id) || '. ' || v_obs,
        public.link_avaliacao(v_av.id));
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestão agenda o ano inteiro da turma de uma vez (calendário acadêmico)
-- Formato: [{ "disciplina_id": 3, "tipo": "mensal", "bimestre": 1, "data": "2027-03-15" }, ...]
-- Data vazia: remove a avaliação, se o professor ainda não cadastrou o conteúdo.
-- ---------------------------------------------------------------------------
create function public.agendar_avaliacoes(p_turma bigint, p_ano smallint, p_itens jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa smallint;
  r record;
  v_atual public.avaliacoes;
  v_alteradas int := 0;
begin
  if public.meu_papel() not in ('diretor', 'secretaria', 'coordenador') then
    raise exception 'Somente a Secretaria, a Coordenação ou a Direção agendam as avaliações.' using errcode = 'P0001';
  end if;
  select etapa_id into v_etapa from public.turmas where id = p_turma;
  if v_etapa is null or not public.pode_editar_etapa(v_etapa) then
    raise exception 'Você não tem permissão para agendar avaliações desta turma.' using errcode = 'P0001';
  end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb))
      as x(disciplina_id smallint, tipo text, bimestre smallint, data date)
  loop
    if r.tipo not in ('mensal', 'bimestral') or r.bimestre not between 1 and 4 then
      raise exception 'Tipo ou bimestre inválido no calendário.' using errcode = 'P0001';
    end if;
    select * into v_atual from public.avaliacoes
     where turma_id = p_turma and disciplina_id = r.disciplina_id and tipo = r.tipo and bimestre = r.bimestre and ano = p_ano;

    if r.data is null then
      if v_atual.id is not null and trim(v_atual.conteudo) = '' then
        delete from public.avaliacoes where id = v_atual.id;
        v_alteradas := v_alteradas + 1;
      end if;
      continue;
    end if;

    if v_atual.id is null then
      if not exists (select 1 from public.vinculos v where v.ativo and v.turma_id = p_turma and v.disciplina_id = r.disciplina_id) then
        raise exception 'Uma das disciplinas não tem professor vinculado à turma.' using errcode = 'P0001';
      end if;
      insert into public.avaliacoes (turma_id, disciplina_id, tipo, bimestre, ano, data)
      values (p_turma, r.disciplina_id, r.tipo, r.bimestre, p_ano, r.data);
      v_alteradas := v_alteradas + 1;
    elsif v_atual.data <> r.data then
      update public.avaliacoes set data = r.data, agendada_por = auth.uid(), agendada_em = now() where id = v_atual.id;
      v_alteradas := v_alteradas + 1;
    end if;
  end loop;
  return v_alteradas;
end;
$$;

revoke execute on function public.link_avaliacao(bigint), public.descricao_avaliacao(bigint)
  from public, anon, authenticated;
revoke execute on function
  public.avaliar_avaliacao(bigint, text, text),
  public.agendar_avaliacoes(bigint, smallint, jsonb)
from public, anon;
grant execute on function
  public.avaliar_avaliacao(bigint, text, text),
  public.agendar_avaliacoes(bigint, smallint, jsonb)
to authenticated;
