-- Cronograma de Avaliação (substitui o Conteúdo programático).
--
-- * Secretaria, Coordenação (na sua etapa) e Direção agendam as avaliações
--   no início do ano: turma, disciplina, tipo (mensal/bimestral), bimestre e data.
-- * O professor da disciplina naquela turma "cadastra a avaliação": conteúdo,
--   material de apoio (links) e orientações (vira um anexo no documento).
-- * O cronograma da turma junta tudo e é exportado no formato do modelo da escola.

create table public.avaliacoes (
  id             bigint generated always as identity primary key,
  turma_id       bigint not null references public.turmas (id),
  disciplina_id  smallint not null references public.disciplinas (id),
  tipo           text not null check (tipo in ('mensal', 'bimestral')),
  bimestre       smallint not null check (bimestre between 1 and 4),
  ano            smallint not null,
  data           date not null,
  conteudo       text not null default '',
  material       text not null default '',
  orientacoes    text not null default '',
  preenchida_por uuid references public.perfis (id),
  preenchida_em  timestamptz,
  agendada_por   uuid references public.perfis (id) default auth.uid(),
  agendada_em    timestamptz not null default now(),
  unique (turma_id, disciplina_id, tipo, bimestre, ano)
);
create index avaliacoes_turma_idx on public.avaliacoes (turma_id, ano, bimestre, tipo);

create trigger avaliacoes_auditoria after insert or update or delete on public.avaliacoes
  for each row execute function public.registrar_auditoria();

alter table public.avaliacoes enable row level security;
create policy "quem vê a turma vê as avaliações" on public.avaliacoes
  for select to authenticated using (public.pode_ver_turma(turma_id));

-- ---------------------------------------------------------------------------
-- Gestão: agendar (criar ou mudar a data) e remover
-- ---------------------------------------------------------------------------
create function public.agendar_avaliacao(
  p_id bigint, p_turma bigint, p_disciplina smallint, p_tipo text, p_bimestre smallint, p_ano smallint, p_data date
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa smallint;
  v_id bigint;
begin
  if public.meu_papel() not in ('diretor', 'secretaria', 'coordenador') then
    raise exception 'Somente a Secretaria, a Coordenação ou a Direção agendam as avaliações.' using errcode = 'P0001';
  end if;
  select etapa_id into v_etapa from public.turmas where id = p_turma;
  if v_etapa is null or not public.pode_editar_etapa(v_etapa) then
    raise exception 'Você não tem permissão para agendar avaliações desta turma.' using errcode = 'P0001';
  end if;
  if p_tipo not in ('mensal', 'bimestral') or p_bimestre not between 1 and 4 or p_ano is null or p_data is null then
    raise exception 'Informe tipo (mensal ou bimestral), bimestre (1 a 4), ano e data.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vinculos v where v.ativo and v.turma_id = p_turma and v.disciplina_id = p_disciplina) then
    raise exception 'Esta disciplina não tem professor vinculado à turma.' using errcode = 'P0001';
  end if;

  if p_id is null then
    if exists (select 1 from public.avaliacoes
               where turma_id = p_turma and disciplina_id = p_disciplina and tipo = p_tipo and bimestre = p_bimestre and ano = p_ano) then
      raise exception 'Esta disciplina já tem avaliação agendada neste bimestre.' using errcode = 'P0001';
    end if;
    insert into public.avaliacoes (turma_id, disciplina_id, tipo, bimestre, ano, data)
    values (p_turma, p_disciplina, p_tipo, p_bimestre, p_ano, p_data)
    returning id into v_id;
  else
    update public.avaliacoes set data = p_data, agendada_por = auth.uid(), agendada_em = now()
     where id = p_id and turma_id = p_turma
     returning id into v_id;
    if v_id is null then
      raise exception 'Avaliação não encontrada.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.remover_avaliacao(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa smallint;
begin
  select t.etapa_id into v_etapa from public.avaliacoes a join public.turmas t on t.id = a.turma_id where a.id = p_id;
  if v_etapa is null then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0001';
  end if;
  if public.meu_papel() not in ('diretor', 'secretaria', 'coordenador') or not public.pode_editar_etapa(v_etapa) then
    raise exception 'Você não tem permissão para remover esta avaliação.' using errcode = 'P0001';
  end if;
  delete from public.avaliacoes where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Professor (ou a gestão da etapa): cadastrar o conteúdo da avaliação
-- ---------------------------------------------------------------------------
create function public.cadastrar_avaliacao(p_id bigint, p_conteudo text, p_material text, p_orientacoes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_av public.avaliacoes;
  v_etapa smallint;
begin
  select * into v_av from public.avaliacoes where id = p_id for update;
  if not found then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0001';
  end if;
  select etapa_id into v_etapa from public.turmas where id = v_av.turma_id;
  if not (public.leciona(v_av.turma_id, v_av.disciplina_id)
          or (public.meu_papel() in ('diretor', 'secretaria', 'coordenador') and public.pode_editar_etapa(v_etapa))) then
    raise exception 'Somente o professor da disciplina nesta turma (ou a gestão da etapa) cadastra esta avaliação.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_conteudo, '')), '') is null then
    raise exception 'Informe o conteúdo da avaliação.' using errcode = 'P0001';
  end if;
  update public.avaliacoes
     set conteudo = trim(p_conteudo), material = trim(coalesce(p_material, '')), orientacoes = trim(coalesce(p_orientacoes, '')),
         preenchida_por = auth.uid(), preenchida_em = now()
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Professores de cada disciplina na turma (para o cabeçalho e "Prof(a) …").
-- Quem vê a turma pode ver; o professor não lê os vínculos dos colegas direto.
-- ---------------------------------------------------------------------------
create function public.professores_da_turma(p_turma bigint)
returns table (disciplina_id smallint, usuario_id uuid, nome text, regente boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct v.disciplina_id, v.usuario_id, pf.nome, v.regente
  from public.vinculos v
  join public.perfis pf on pf.id = v.usuario_id and pf.status = 'ativo' and pf.papel = 'professor'
  where v.ativo and v.turma_id = p_turma and v.disciplina_id is not null
    and public.pode_ver_turma(p_turma);
$$;

-- ---------------------------------------------------------------------------
-- O Conteúdo programático deixa de existir (substituído pelo cronograma).
-- ---------------------------------------------------------------------------
drop function if exists public.conteudo_programatico(bigint, date, date);

revoke execute on function public.professores_da_turma(bigint) from public, anon;
grant execute on function public.professores_da_turma(bigint) to authenticated;
revoke execute on function
  public.agendar_avaliacao(bigint, bigint, smallint, text, smallint, smallint, date),
  public.remover_avaliacao(bigint),
  public.cadastrar_avaliacao(bigint, text, text, text)
from public, anon;
grant execute on function
  public.agendar_avaliacao(bigint, bigint, smallint, text, smallint, smallint, date),
  public.remover_avaliacao(bigint),
  public.cadastrar_avaliacao(bigint, text, text, text)
to authenticated;
