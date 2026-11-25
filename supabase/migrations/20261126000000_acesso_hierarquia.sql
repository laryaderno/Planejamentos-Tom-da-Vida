-- =============================================================================
-- Fase 1 — Acesso e hierarquia
-- Aprovação de cadastros, remoção de usuários, vínculos (permissões), turmas.
-- Toda escrita passa por estas funções; nenhuma tabela recebe política de escrita.
-- Ver docs/ARQUITETURA.md §2, §3.2 (remoção de professor) e §4.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Perfis: dados da remoção
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column removido_por          uuid references public.perfis (id),
  add column removido_em           timestamptz,
  add column destino_planejamentos text
    check (destino_planejamentos in ('manter', 'excluir'));
comment on column public.perfis.destino_planejamentos is
  'Escolha feita ao remover um professor (decisão D6). Aplicada aos blocos de planejamento na Fase 2.';

-- ---------------------------------------------------------------------------
-- Funções de sessão
-- ---------------------------------------------------------------------------
create function public.meu_papel()
returns public.papel
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = auth.uid() and status = 'ativo';
$$;

-- Etapas que o usuário coordena (vínculos de etapa inteira, sem turma).
create function public.minhas_etapas()
returns smallint[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct etapa_id), '{}')
  from public.vinculos
  where usuario_id = auth.uid() and ativo and turma_id is null;
$$;

-- O Coordenador atual tem o usuário-alvo em alguma das suas etapas?
-- (vínculo ativo na etapa, ou pedido de cadastro de professor para a etapa)
create function public.coordena_usuario(p_alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_papel() = 'coordenador' and (
    exists (
      select 1 from public.vinculos v
      where v.usuario_id = p_alvo and v.ativo and v.etapa_id = any (public.minhas_etapas())
    )
    or exists (
      select 1 from public.perfis p
      where p.id = p_alvo and p.status = 'pendente' and p.papel = 'professor'
        and p.etapa_solicitada_id = any (public.minhas_etapas())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Regras de hierarquia (§2, §3, §4.1)
-- ---------------------------------------------------------------------------

-- Quem pode aprovar um cadastro com o papel informado, na etapa informada.
create function public.pode_aprovar(p_papel public.papel, p_etapa smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.meu_papel()
    when 'administrador' then true
    when 'diretor'       then p_papel <> 'administrador'          -- inclui aprovar Diretor
    when 'secretaria'    then p_papel in ('coordenador', 'professor')
    when 'coordenador'   then p_papel = 'professor' and p_etapa = any (public.minhas_etapas())
    else false
  end;
$$;

-- Quem pode alterar/remover um usuário ativo.
-- Regra geral: nível estritamente superior. Exceção: Administrador gerencia outro Administrador.
-- Coordenador só gerencia professores das suas etapas. Ninguém gerencia a si mesmo.
create function public.pode_gerenciar(p_alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when p_alvo = auth.uid() then false
      when public.meu_papel() = 'administrador' then true
      when public.meu_nivel() <= public.nivel_papel(alvo.papel) then false
      when public.meu_papel() = 'coordenador' then public.coordena_usuario(p_alvo)
      else true
    end
    from public.perfis alvo
    where alvo.id = p_alvo
  ), false);
$$;

-- Rótulo com artigo para a frase "Apenas ... pode alterá-la."
create function public.rotulo_nivel_com_artigo(nivel int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nivel >= 50 then 'um Administrador'
    when nivel >= 40 then 'um Diretor'
    when nivel >= 30 then 'a Secretaria Acadêmica (ou a Direção)'
    when nivel >= 20 then 'um Coordenador'
    else 'um Professor'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Trava em cascata: permite que operações internas (remoção de usuário)
-- desativem vínculos definidos por nível superior.
-- ---------------------------------------------------------------------------
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
      to_char(old.definido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
      public.rotulo_nivel_com_artigo(old.definido_por_nivel)
      using errcode = 'P0001', hint = 'trava_hierarquica';
  end if;

  new.definido_por_id    := auth.uid();
  new.definido_por_nivel := v_nivel;
  new.definido_em        := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vínculos: validação e gravação
-- Formato do JSON: [{ "etapa_id": 1, "turma_id": 3, "disciplina_id": 7, "regente": false }, ...]
--   Coordenador: só etapa_id (uma linha por etapa)
--   Professor:   etapa_id + turma_id + disciplina_id (uma linha por turma × disciplina)
-- ---------------------------------------------------------------------------
create function public.validar_vinculos(p_papel public.papel, p_vinculos jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if jsonb_typeof(coalesce(p_vinculos, '[]')) <> 'array' then
    raise exception 'Formato de vínculos inválido.' using errcode = 'P0001';
  end if;

  if p_papel in ('coordenador', 'professor') and jsonb_array_length(coalesce(p_vinculos, '[]')) = 0 then
    raise exception '%', case p_papel
      when 'coordenador' then 'Selecione ao menos uma etapa para o Coordenador.'
      else 'Selecione ao menos uma turma e uma disciplina para o Professor.'
    end using errcode = 'P0001';
  end if;

  if p_papel not in ('coordenador', 'professor') and jsonb_array_length(coalesce(p_vinculos, '[]')) > 0 then
    raise exception 'Este papel não recebe vínculos de etapa ou turma.' using errcode = 'P0001';
  end if;

  for v in
    select * from jsonb_to_recordset(coalesce(p_vinculos, '[]'))
      as x(etapa_id smallint, turma_id bigint, disciplina_id smallint, regente boolean)
  loop
    if v.etapa_id is null or not exists (select 1 from public.etapas where id = v.etapa_id) then
      raise exception 'Etapa inválida.' using errcode = 'P0001';
    end if;

    if p_papel = 'coordenador' and (v.turma_id is not null or v.disciplina_id is not null or coalesce(v.regente, false)) then
      raise exception 'Coordenadores são vinculados à etapa inteira, sem turma ou disciplina.' using errcode = 'P0001';
    end if;

    if p_papel = 'professor' then
      if v.turma_id is null or v.disciplina_id is null then
        raise exception 'Cada vínculo de professor precisa de turma e disciplina.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.turmas t where t.id = v.turma_id and t.etapa_id = v.etapa_id and t.ativa) then
        raise exception 'A turma informada não pertence à etapa ou está inativa.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.disciplinas where id = v.disciplina_id) then
        raise exception 'Disciplina inválida.' using errcode = 'P0001';
      end if;
    end if;

    -- Coordenador só mexe nas próprias etapas
    if public.meu_papel() = 'coordenador' and not v.etapa_id = any (public.minhas_etapas()) then
      raise exception 'Você só pode definir vínculos nas etapas que coordena.' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- Substitui o conjunto de vínculos ativos do usuário pelo informado.
-- Vínculos removidos são desativados (nunca apagados); a trava em cascata vale para cada um.
create function public.gravar_vinculos(p_usuario uuid, p_vinculos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  atual record;
begin
  -- desativa os que não estão mais na lista
  for atual in
    select * from public.vinculos
    where usuario_id = p_usuario and ativo
      and not exists (
        select 1 from jsonb_to_recordset(coalesce(p_vinculos, '[]'))
          as x(etapa_id smallint, turma_id bigint, disciplina_id smallint, regente boolean)
        where x.etapa_id = vinculos.etapa_id
          and coalesce(x.turma_id, 0) = coalesce(vinculos.turma_id, 0)
          and coalesce(x.disciplina_id, 0) = coalesce(vinculos.disciplina_id, 0)
      )
  loop
    -- O Coordenador só enxerga (e só envia) as próprias etapas: vínculos de
    -- outras etapas ficam como estão.
    if public.meu_papel() = 'coordenador' and not atual.etapa_id = any (public.minhas_etapas()) then
      continue;
    end if;
    update public.vinculos set ativo = false where id = atual.id;
  end loop;

  -- insere novos e atualiza a regência dos existentes
  for v in
    select * from jsonb_to_recordset(coalesce(p_vinculos, '[]'))
      as x(etapa_id smallint, turma_id bigint, disciplina_id smallint, regente boolean)
  loop
    select * into atual from public.vinculos
    where usuario_id = p_usuario and ativo
      and etapa_id = v.etapa_id
      and coalesce(turma_id, 0) = coalesce(v.turma_id, 0)
      and coalesce(disciplina_id, 0) = coalesce(v.disciplina_id, 0);

    if not found then
      insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente)
      values (p_usuario, v.etapa_id, v.turma_id, v.disciplina_id, coalesce(v.regente, false));
    elsif atual.regente is distinct from coalesce(v.regente, false) then
      update public.vinculos set regente = coalesce(v.regente, false) where id = atual.id;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: aprovar / recusar cadastro (§4)
-- ---------------------------------------------------------------------------
create function public.aprovar_usuario(p_usuario uuid, p_papel public.papel, p_vinculos jsonb default '[]')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo  public.perfis;
  v_etapa smallint;
begin
  select * into v_alvo from public.perfis where id = p_usuario for update;
  if not found or v_alvo.status <> 'pendente' then
    raise exception 'Esta solicitação não está mais pendente.' using errcode = 'P0001';
  end if;

  perform public.validar_vinculos(p_papel, p_vinculos);

  -- permissão: confere cada etapa envolvida (ou a etapa pedida, se não houver vínculos)
  for v_etapa in
    select (x ->> 'etapa_id')::smallint from jsonb_array_elements(coalesce(p_vinculos, '[]')) x
    union
    select v_alvo.etapa_solicitada_id where jsonb_array_length(coalesce(p_vinculos, '[]')) = 0
  loop
    if not public.pode_aprovar(p_papel, v_etapa) then
      raise exception 'Você não tem permissão para aprovar um % nesta etapa.',
        public.rotulo_nivel(public.nivel_papel(p_papel)) using errcode = 'P0001';
    end if;
  end loop;
  if not public.pode_aprovar(p_papel, v_alvo.etapa_solicitada_id)
     and jsonb_array_length(coalesce(p_vinculos, '[]')) = 0 then
    raise exception 'Você não tem permissão para aprovar este cadastro.' using errcode = 'P0001';
  end if;

  update public.perfis
     set status = 'ativo', papel = p_papel, aprovado_por = auth.uid(), aprovado_em = now()
   where id = p_usuario;

  perform public.gravar_vinculos(p_usuario, p_vinculos);
end;
$$;

create function public.recusar_usuario(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.perfis;
begin
  select * into v_alvo from public.perfis where id = p_usuario for update;
  if not found or v_alvo.status <> 'pendente' then
    raise exception 'Esta solicitação não está mais pendente.' using errcode = 'P0001';
  end if;
  if not public.pode_aprovar(v_alvo.papel, v_alvo.etapa_solicitada_id) then
    raise exception 'Você não tem permissão para recusar este cadastro.' using errcode = 'P0001';
  end if;
  update public.perfis set status = 'recusado' where id = p_usuario;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: alterar vínculos de um usuário ativo (permissões por etapa/turma/disciplina)
-- ---------------------------------------------------------------------------
create function public.alterar_vinculos(p_usuario uuid, p_vinculos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.perfis;
begin
  select * into v_alvo from public.perfis where id = p_usuario;
  if not found or v_alvo.status <> 'ativo' then
    raise exception 'Usuário não encontrado ou inativo.' using errcode = 'P0001';
  end if;
  if not public.pode_gerenciar(p_usuario) then
    raise exception 'Você não tem permissão para alterar as permissões deste usuário.' using errcode = 'P0001';
  end if;
  perform public.validar_vinculos(v_alvo.papel, p_vinculos);
  perform public.gravar_vinculos(p_usuario, p_vinculos);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: remover usuário (§3, decisão D6)
-- O perfil fica com status 'removido' (sem acesso) e os vínculos são desativados.
-- Para professor, registra o destino dos planejamentos ('manter' | 'excluir').
-- ---------------------------------------------------------------------------
create function public.remover_usuario(p_usuario uuid, p_destino text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.perfis;
begin
  select * into v_alvo from public.perfis where id = p_usuario for update;
  if not found or v_alvo.status <> 'ativo' then
    raise exception 'Usuário não encontrado ou já removido.' using errcode = 'P0001';
  end if;
  if not public.pode_gerenciar(p_usuario) then
    raise exception 'Você não tem permissão para remover este usuário.' using errcode = 'P0001';
  end if;
  if v_alvo.papel = 'professor' and coalesce(p_destino, '') not in ('manter', 'excluir') then
    raise exception 'Escolha se os planejamentos do professor serão mantidos ou excluídos.' using errcode = 'P0001';
  end if;
  if v_alvo.papel <> 'professor' and p_destino is not null then
    raise exception 'O destino dos planejamentos só se aplica a professores.' using errcode = 'P0001';
  end if;

  -- a remoção do usuário é permitida mesmo que algum vínculo tenha sido definido por nível superior
  perform set_config('tv.ignorar_trava', 'on', true);
  update public.vinculos set ativo = false where usuario_id = p_usuario and ativo;
  perform set_config('tv.ignorar_trava', 'off', true);

  update public.perfis
     set status = 'removido', removido_por = auth.uid(), removido_em = now(),
         destino_planejamentos = p_destino
   where id = p_usuario;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: turmas
-- ---------------------------------------------------------------------------
create function public.pode_editar_etapa(p_etapa smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_nivel() >= 30
      or (public.meu_papel() = 'coordenador' and p_etapa = any (public.minhas_etapas()));
$$;

create function public.salvar_turma(p_id bigint, p_etapa smallint, p_nome text, p_turno public.turno)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.turmas;
  v_id    bigint;
begin
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe o nome da turma.' using errcode = 'P0001';
  end if;
  if not public.pode_editar_etapa(p_etapa) then
    raise exception 'Você não tem permissão para cadastrar turmas nesta etapa.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.turmas (etapa_id, nome, turno_padrao)
    values (p_etapa, trim(p_nome), p_turno)
    returning id into v_id;
    return v_id;
  end if;

  select * into v_atual from public.turmas where id = p_id and ativa;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0001';
  end if;
  if not public.pode_editar_etapa(v_atual.etapa_id) then
    raise exception 'Você não tem permissão para alterar esta turma.' using errcode = 'P0001';
  end if;
  if v_atual.etapa_id <> p_etapa and exists (select 1 from public.vinculos where turma_id = p_id and ativo) then
    raise exception 'A turma tem professores vinculados; remova os vínculos antes de mudar a etapa.' using errcode = 'P0001';
  end if;

  update public.turmas set etapa_id = p_etapa, nome = trim(p_nome), turno_padrao = p_turno where id = p_id;
  return p_id;
exception
  when unique_violation then
    raise exception 'Já existe uma turma com esse nome nesta etapa e ano letivo.' using errcode = 'P0001';
end;
$$;

create function public.desativar_turma(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.turmas;
begin
  select * into v_atual from public.turmas where id = p_id and ativa;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0001';
  end if;
  if not public.pode_editar_etapa(v_atual.etapa_id) then
    raise exception 'Você não tem permissão para remover esta turma.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.vinculos where turma_id = p_id and ativo) then
    raise exception 'A turma tem professores vinculados; remova os vínculos antes.' using errcode = 'P0001';
  end if;
  update public.turmas set ativa = false where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A tela de cadastro (antes do login) precisa listar as etapas.
-- ---------------------------------------------------------------------------
create policy "visitantes leem etapas" on public.etapas
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- RLS de leitura refinada: Coordenador vê apenas as suas etapas
-- ---------------------------------------------------------------------------
drop policy "gestores leem perfis" on public.perfis;
create policy "direção e secretaria leem perfis" on public.perfis
  for select to authenticated using (public.meu_nivel() >= 30);
create policy "coordenador lê perfis das suas etapas" on public.perfis
  for select to authenticated using (public.coordena_usuario(id));

drop policy "gestores leem vínculos" on public.vinculos;
create policy "direção e secretaria leem vínculos" on public.vinculos
  for select to authenticated using (public.meu_nivel() >= 30);
create policy "coordenador lê vínculos das suas etapas" on public.vinculos
  for select to authenticated
  using (public.meu_papel() = 'coordenador' and etapa_id = any (public.minhas_etapas()));

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke execute on function
  public.validar_vinculos(public.papel, jsonb),
  public.gravar_vinculos(uuid, jsonb)
from public, anon, authenticated;

revoke execute on function
  public.meu_papel(), public.minhas_etapas(), public.coordena_usuario(uuid),
  public.pode_aprovar(public.papel, smallint), public.pode_gerenciar(uuid),
  public.pode_editar_etapa(smallint),
  public.aprovar_usuario(uuid, public.papel, jsonb), public.recusar_usuario(uuid),
  public.alterar_vinculos(uuid, jsonb), public.remover_usuario(uuid, text),
  public.salvar_turma(bigint, smallint, text, public.turno), public.desativar_turma(bigint)
from public, anon;

grant execute on function
  public.meu_papel(), public.minhas_etapas(), public.coordena_usuario(uuid),
  public.pode_aprovar(public.papel, smallint), public.pode_gerenciar(uuid),
  public.pode_editar_etapa(smallint),
  public.aprovar_usuario(uuid, public.papel, jsonb), public.recusar_usuario(uuid),
  public.alterar_vinculos(uuid, jsonb), public.remover_usuario(uuid, text),
  public.salvar_turma(bigint, smallint, text, public.turno), public.desativar_turma(bigint)
to authenticated;
