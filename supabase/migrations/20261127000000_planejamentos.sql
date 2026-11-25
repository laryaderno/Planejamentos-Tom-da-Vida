-- =============================================================================
-- Fase 2 — Planejamentos
-- Planejamento do dia (Turma + Data + Turno) com blocos de horário, cada bloco
-- preenchido por um professor (Regente ou especialista). Status por bloco (D1),
-- turno no planejamento (D5), notas, histórico de edições e o efeito da
-- remoção de professor (Manter/Excluir, D6).
-- Ver docs/ARQUITETURA.md §3.2 e especificação §6.
-- =============================================================================

create type public.status_bloco as enum ('cinza', 'amarelo', 'verde');

create type public.inteligencia as enum (
  'linguistica', 'logico_matematica', 'espacial', 'corporal_cinestesica',
  'musical', 'interpessoal', 'intrapessoal', 'naturalista'
);

create type public.linguagem_amor as enum (
  'palavras_afirmacao', 'tempo_qualidade', 'presentes', 'atos_servico', 'toque_fisico'
);

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.planejamentos (
  id            bigint generated always as identity primary key,
  turma_id      bigint not null references public.turmas (id),
  data          date not null,
  turno         public.turno not null,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references public.perfis (id),
  atualizado_em timestamptz not null default now(),
  unique (turma_id, data, turno)
);
create index planejamentos_turma_data_idx on public.planejamentos (turma_id, data);

create table public.blocos (
  id              bigint generated always as identity primary key,
  planejamento_id bigint not null references public.planejamentos (id),
  professor_id    uuid not null references public.perfis (id),
  disciplina_id   smallint not null references public.disciplinas (id),
  hora_inicio     time not null,
  hora_fim        time not null,
  conteudo        text not null default '',
  objetivos       text not null default '',
  habilidades     public.inteligencia[] not null default '{}',
  estrategias     text not null default '',
  atividades      text not null default '',
  avaliacao       text not null default '',
  recursos        text not null default '',
  linguagem_amor  public.linguagem_amor,
  status          public.status_bloco not null default 'cinza',
  versao          int not null default 1,
  arquivado_em    timestamptz,   -- professor removido com "Manter" (D6)
  excluido_em     timestamptz,   -- professor removido com "Excluir": some das telas, fica nos relatórios
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id),
  constraint horario_valido check (hora_fim > hora_inicio)
);
create index blocos_planejamento_idx on public.blocos (planejamento_id);
create index blocos_professor_idx on public.blocos (professor_id);

create table public.notas (
  id              bigint generated always as identity primary key,
  planejamento_id bigint not null references public.planejamentos (id),
  autor_id        uuid not null references public.perfis (id) default auth.uid(),
  texto           text not null check (length(trim(texto)) > 0),
  criado_em       timestamptz not null default now()
);
create index notas_planejamento_idx on public.notas (planejamento_id);

create table public.historico_blocos (
  id             bigint generated always as identity primary key,
  bloco_id       bigint not null references public.blocos (id),
  autor_id       uuid,
  em             timestamptz not null default now(),
  campo          text not null,
  valor_anterior text,
  valor_novo     text
);
create index historico_blocos_bloco_idx on public.historico_blocos (bloco_id, em desc);

-- ---------------------------------------------------------------------------
-- Visibilidade (§3): Direção/Secretaria/Admin veem tudo; Coordenador, as suas
-- etapas; Professor, as turmas em que tem vínculo.
-- ---------------------------------------------------------------------------
create function public.pode_ver_turma(p_turma bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_nivel() >= 30
      or (public.meu_papel() = 'coordenador'
          and exists (select 1 from public.turmas t where t.id = p_turma and t.etapa_id = any (public.minhas_etapas())))
      or (public.meu_papel() = 'professor'
          and exists (select 1 from public.vinculos v where v.usuario_id = auth.uid() and v.turma_id = p_turma and v.ativo));
$$;

create function public.pode_ver_planejamento(p_planejamento bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.planejamentos p where p.id = p_planejamento and public.pode_ver_turma(p.turma_id)
  );
$$;

-- Professor leciona esta disciplina nesta turma?
create function public.leciona(p_turma bigint, p_disciplina smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vinculos v
    where v.usuario_id = auth.uid() and v.ativo and v.turma_id = p_turma and v.disciplina_id = p_disciplina
  ) and public.meu_papel() = 'professor';
$$;

-- ---------------------------------------------------------------------------
-- Regras dos blocos
-- ---------------------------------------------------------------------------
-- Linguagem do Amor: obrigatória para concluir na Educação Infantil; não existe nas demais (§6).
create function public.validar_bloco()
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

  if not v_exige and new.linguagem_amor is not null then
    raise exception 'A Linguagem do Amor só é registrada em turmas da Educação Infantil.' using errcode = 'P0001';
  end if;
  if v_exige and new.status = 'verde' and new.linguagem_amor is null then
    raise exception 'Na Educação Infantil, informe a Linguagem do Amor trabalhada antes de marcar como concluído.'
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

create trigger blocos_validar before insert or update on public.blocos
  for each row execute function public.validar_bloco();

-- Histórico de edições (§6.3): um registro por campo alterado.
create function public.registrar_historico_bloco()
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
    'atividades', 'avaliacao', 'recursos', 'linguagem_amor', 'status', 'arquivado_em', 'excluido_em'
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

create trigger blocos_historico after update on public.blocos
  for each row execute function public.registrar_historico_bloco();

-- Auditoria (§11): criação de planejamentos e blocos. Edições ficam no histórico do bloco.
create trigger planejamentos_auditoria after insert or delete on public.planejamentos
  for each row execute function public.registrar_auditoria();
create trigger blocos_auditoria after insert or delete on public.blocos
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- RPC: abrir o planejamento do dia (cria se não existir)
-- ---------------------------------------------------------------------------
create function public.abrir_planejamento(p_turma bigint, p_data date, p_turno public.turno)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.pode_ver_turma(p_turma) then
    raise exception 'Você não tem acesso a esta turma.' using errcode = 'P0001';
  end if;
  select id into v_id from public.planejamentos where turma_id = p_turma and data = p_data and turno = p_turno;
  if v_id is not null then
    return v_id;
  end if;
  -- Só professor cria planejamento (§3: editar planejamento é exclusivo do professor).
  if public.meu_papel() <> 'professor' then
    return null;
  end if;
  insert into public.planejamentos (turma_id, data, turno, criado_por)
  values (p_turma, p_data, p_turno, auth.uid())
  on conflict (turma_id, data, turno) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.planejamentos where turma_id = p_turma and data = p_data and turno = p_turno;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: criar bloco de horário (o professor só cria para disciplina que leciona na turma)
-- ---------------------------------------------------------------------------
create function public.criar_bloco(p_planejamento bigint, p_disciplina smallint, p_inicio time, p_fim time)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma bigint;
  v_id    bigint;
begin
  select turma_id into v_turma from public.planejamentos where id = p_planejamento;
  if v_turma is null then
    raise exception 'Planejamento não encontrado.' using errcode = 'P0001';
  end if;
  if not public.leciona(v_turma, p_disciplina) then
    raise exception 'Você só pode criar blocos das disciplinas que leciona nesta turma.' using errcode = 'P0001';
  end if;
  if p_fim <= p_inicio then
    raise exception 'O horário de fim precisa ser depois do início.' using errcode = 'P0001';
  end if;
  insert into public.blocos (planejamento_id, professor_id, disciplina_id, hora_inicio, hora_fim, atualizado_por)
  values (p_planejamento, auth.uid(), p_disciplina, p_inicio, p_fim, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: salvar bloco (salvamento automático e manual, §7)
-- Recebe só os campos alterados. Concorrência: a última gravação vale (last
-- write wins); se a versão do navegador estava desatualizada, devolve
-- conflito = true para o aviso na tela. O histórico guarda tudo.
-- ---------------------------------------------------------------------------
create function public.salvar_bloco(p_id bigint, p_versao int, p_campos jsonb)
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
    hora_inicio    = case when p_campos ? 'hora_inicio'    then (p_campos ->> 'hora_inicio')::time else hora_inicio end,
    hora_fim       = case when p_campos ? 'hora_fim'       then (p_campos ->> 'hora_fim')::time else hora_fim end,
    conteudo       = case when p_campos ? 'conteudo'       then coalesce(p_campos ->> 'conteudo', '') else conteudo end,
    objetivos      = case when p_campos ? 'objetivos'      then coalesce(p_campos ->> 'objetivos', '') else objetivos end,
    habilidades    = case when p_campos ? 'habilidades'
                          then array(select jsonb_array_elements_text(p_campos -> 'habilidades'))::public.inteligencia[]
                          else habilidades end,
    estrategias    = case when p_campos ? 'estrategias'    then coalesce(p_campos ->> 'estrategias', '') else estrategias end,
    atividades     = case when p_campos ? 'atividades'     then coalesce(p_campos ->> 'atividades', '') else atividades end,
    avaliacao      = case when p_campos ? 'avaliacao'      then coalesce(p_campos ->> 'avaliacao', '') else avaliacao end,
    recursos       = case when p_campos ? 'recursos'       then coalesce(p_campos ->> 'recursos', '') else recursos end,
    linguagem_amor = case when p_campos ? 'linguagem_amor' then (p_campos ->> 'linguagem_amor')::public.linguagem_amor else linguagem_amor end,
    status         = case when p_campos ? 'status'         then (p_campos ->> 'status')::public.status_bloco else status end
  where id = p_id
  returning * into v_bloco;

  return jsonb_build_object('versao', v_bloco.versao, 'atualizado_em', v_bloco.atualizado_em, 'conflito', v_conflito);
end;
$$;

-- Remover bloco: só enquanto estiver vazio (nenhum planejamento escrito se perde).
create function public.remover_bloco(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloco public.blocos;
begin
  select * into v_bloco from public.blocos where id = p_id for update;
  if not found or v_bloco.professor_id <> auth.uid() or v_bloco.arquivado_em is not null or v_bloco.excluido_em is not null then
    raise exception 'Somente o professor responsável pode remover este bloco.' using errcode = 'P0001';
  end if;
  if v_bloco.status <> 'cinza'
     or trim(v_bloco.conteudo || v_bloco.objetivos || v_bloco.estrategias || v_bloco.atividades || v_bloco.avaliacao || v_bloco.recursos) <> ''
     or cardinality(v_bloco.habilidades) > 0 then
    raise exception 'Só é possível remover um bloco vazio. Este já tem conteúdo.' using errcode = 'P0001';
  end if;
  delete from public.historico_blocos where bloco_id = p_id;
  delete from public.blocos where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remoção de professor: aplica o destino dos planejamentos (D6)
-- ---------------------------------------------------------------------------
create or replace function public.remover_usuario(p_usuario uuid, p_destino text default null)
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

  perform set_config('tv.ignorar_trava', 'on', true);
  update public.vinculos set ativo = false where usuario_id = p_usuario and ativo;
  perform set_config('tv.ignorar_trava', 'off', true);

  -- Nenhum planejamento é apagado: "manter" arquiva, "excluir" só esconde das telas.
  if p_destino = 'manter' then
    update public.blocos set arquivado_em = now() where professor_id = p_usuario and arquivado_em is null and excluido_em is null;
  elsif p_destino = 'excluir' then
    update public.blocos set excluido_em = now() where professor_id = p_usuario and excluido_em is null;
  end if;

  update public.perfis
     set status = 'removido', removido_por = auth.uid(), removido_em = now(),
         destino_planejamentos = p_destino
   where id = p_usuario;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.planejamentos    enable row level security;
alter table public.blocos           enable row level security;
alter table public.notas            enable row level security;
alter table public.historico_blocos enable row level security;

create policy "quem vê a turma vê o planejamento" on public.planejamentos
  for select to authenticated using (public.pode_ver_turma(turma_id));

-- Blocos "excluídos" não aparecem nas telas (seguem nos relatórios, via funções do servidor).
create policy "quem vê o planejamento vê os blocos" on public.blocos
  for select to authenticated using (excluido_em is null and public.pode_ver_planejamento(planejamento_id));

create policy "quem vê o planejamento vê as notas" on public.notas
  for select to authenticated using (public.pode_ver_planejamento(planejamento_id));
create policy "quem vê o planejamento adiciona nota" on public.notas
  for insert to authenticated
  with check (autor_id = auth.uid() and public.meu_perfil_ativo() and public.pode_ver_planejamento(planejamento_id));

create policy "quem vê o bloco vê o histórico" on public.historico_blocos
  for select to authenticated
  using (exists (
    select 1 from public.blocos b
    where b.id = bloco_id and b.excluido_em is null and public.pode_ver_planejamento(b.planejamento_id)
  ));

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke execute on function
  public.validar_bloco(), public.registrar_historico_bloco()
from public, anon, authenticated;

revoke execute on function
  public.pode_ver_turma(bigint), public.pode_ver_planejamento(bigint), public.leciona(bigint, smallint),
  public.abrir_planejamento(bigint, date, public.turno), public.criar_bloco(bigint, smallint, time, time),
  public.salvar_bloco(bigint, int, jsonb), public.remover_bloco(bigint)
from public, anon;

grant execute on function
  public.pode_ver_turma(bigint), public.pode_ver_planejamento(bigint), public.leciona(bigint, smallint),
  public.abrir_planejamento(bigint, date, public.turno), public.criar_bloco(bigint, smallint, time, time),
  public.salvar_bloco(bigint, int, jsonb), public.remover_bloco(bigint)
to authenticated;

-- ---------------------------------------------------------------------------
-- Nomes de quem aparece nos planejamentos (autor de bloco, nota ou edição).
-- O professor não lê a tabela de perfis dos colegas; esta função devolve só o
-- nome, e só de pessoas ligadas a planejamentos que quem pergunta pode ver.
-- ---------------------------------------------------------------------------
create function public.nomes_usuarios(p_ids uuid[])
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
    );
$$;

revoke execute on function public.nomes_usuarios(uuid[]) from public, anon;
grant execute on function public.nomes_usuarios(uuid[]) to authenticated;
