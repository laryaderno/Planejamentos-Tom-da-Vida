-- =============================================================================
-- Banco de atividades (decisões de 25/11/2026)
--   * O professor anexa arquivos nas "Atividades Propostas" do bloco, com
--     título e sugestão de tema.
--   * A atividade fica pendente até a Coordenação da etapa, a Secretaria ou a
--     Direção aprovar (podendo ajustar título e tema) ou recusar (com motivo).
--   * Aprovada, entra no banco da etapa: disciplina → tema, com busca.
--   * Arquivos: PDF, Word, imagens, apresentações, planilhas (até 20 MB);
--     áudio e vídeo curtos (até 50 MB).
-- =============================================================================

create type public.status_atividade as enum ('pendente', 'aprovada', 'recusada');

create table public.atividades (
  id              bigint generated always as identity primary key,
  bloco_id        bigint references public.blocos (id),
  etapa_id        smallint not null references public.etapas (id),
  disciplina_id   smallint not null references public.disciplinas (id),
  titulo          text not null check (length(trim(titulo)) > 0),
  tema            text not null check (length(trim(tema)) > 0),
  arquivo_caminho text not null unique,
  arquivo_nome    text not null,
  arquivo_tipo    text not null,
  arquivo_tamanho bigint not null,
  status          public.status_atividade not null default 'pendente',
  proposta_por    uuid not null references public.perfis (id),
  proposta_em     timestamptz not null default now(),
  avaliada_por    uuid references public.perfis (id),
  avaliada_em     timestamptz,
  motivo_recusa   text
);
create index atividades_bloco_idx on public.atividades (bloco_id);
create index atividades_banco_idx on public.atividades (etapa_id, disciplina_id, tema) where status = 'aprovada';

create trigger atividades_auditoria after insert or update or delete on public.atividades
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Tipos de arquivo aceitos e limite de tamanho (bytes); null = não aceito
-- ---------------------------------------------------------------------------
create function public.limite_arquivo(p_tipo text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tipo in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/webp'
    ) then 20 * 1024 * 1024
    when p_tipo in ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'video/mp4') then 50 * 1024 * 1024
    else null
  end;
$$;

-- Quem enxerga o banco da etapa: Secretaria/Direção/Admin, Coordenação da etapa
-- e professores com vínculo na etapa.
create function public.pode_ver_etapa(p_etapa smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_nivel() >= 30
      or (public.meu_papel() = 'coordenador' and p_etapa = any (public.minhas_etapas()))
      or (public.meu_papel() = 'professor' and exists (
            select 1 from public.vinculos v where v.usuario_id = auth.uid() and v.etapa_id = p_etapa and v.ativo));
$$;

-- ---------------------------------------------------------------------------
-- Notificação simples (reutilizada pelas atividades)
-- ---------------------------------------------------------------------------
create function public.notificar(p_usuario uuid, p_tipo text, p_titulo text, p_mensagem text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  values (p_usuario, p_tipo, p_titulo, p_mensagem, p_link);
$$;

-- ---------------------------------------------------------------------------
-- RPC: propor atividade (o arquivo já foi enviado ao armazenamento)
-- ---------------------------------------------------------------------------
create function public.propor_atividade(
  p_bloco bigint, p_titulo text, p_tema text,
  p_caminho text, p_nome text, p_tipo text, p_tamanho bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloco public.blocos;
  v_turma public.turmas;
  v_id    bigint;
  v_prof  text;
  v_limite bigint := public.limite_arquivo(p_tipo);
  v_dest  uuid;
  v_avisados int := 0;
begin
  select * into v_bloco from public.blocos where id = p_bloco;
  if not found or v_bloco.professor_id <> auth.uid() or public.meu_papel() <> 'professor'
     or v_bloco.arquivado_em is not null or v_bloco.excluido_em is not null then
    raise exception 'Somente o professor responsável pelo bloco pode anexar atividades.' using errcode = 'P0001';
  end if;
  if nullif(trim(p_titulo), '') is null or nullif(trim(p_tema), '') is null then
    raise exception 'Informe o título e o tema da atividade.' using errcode = 'P0001';
  end if;
  if v_limite is null then
    raise exception 'Tipo de arquivo não aceito. Envie PDF, Word, imagem, apresentação, planilha, áudio ou vídeo.' using errcode = 'P0001';
  end if;
  if p_tamanho > v_limite then
    raise exception 'O arquivo passa do limite de % MB.', v_limite / 1024 / 1024 using errcode = 'P0001';
  end if;
  if split_part(p_caminho, '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'atividades' and o.name = p_caminho) then
    raise exception 'Arquivo não encontrado. Envie o arquivo novamente.' using errcode = 'P0001';
  end if;

  select t.* into v_turma
  from public.planejamentos p join public.turmas t on t.id = p.turma_id
  where p.id = v_bloco.planejamento_id;

  insert into public.atividades (bloco_id, etapa_id, disciplina_id, titulo, tema, arquivo_caminho, arquivo_nome,
                                 arquivo_tipo, arquivo_tamanho, proposta_por)
  values (p_bloco, v_turma.etapa_id, v_bloco.disciplina_id, trim(p_titulo), trim(p_tema), p_caminho, p_nome,
          p_tipo, p_tamanho, auth.uid())
  returning id into v_id;

  -- Avisa quem aprova: Coordenação da etapa (ou, se não houver, a Secretaria).
  select nome into v_prof from public.perfis where id = auth.uid();
  for v_dest in
    select pf.id from public.perfis pf
    where pf.status = 'ativo' and pf.papel = 'coordenador'
      and exists (select 1 from public.vinculos v where v.usuario_id = pf.id and v.ativo and v.turma_id is null and v.etapa_id = v_turma.etapa_id)
  loop
    perform public.notificar(v_dest, 'atividade_pendente', 'Nova atividade para aprovar',
      v_prof || ' enviou "' || trim(p_titulo) || '" (' || v_turma.nome || ') para o banco de atividades.', '/notificacoes');
    v_avisados := v_avisados + 1;
  end loop;
  if v_avisados = 0 then
    for v_dest in select pf.id from public.perfis pf where pf.status = 'ativo' and pf.papel = 'secretaria' loop
      perform public.notificar(v_dest, 'atividade_pendente', 'Nova atividade para aprovar',
        v_prof || ' enviou "' || trim(p_titulo) || '" (' || v_turma.nome || ') para o banco de atividades.', '/notificacoes');
    end loop;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: aprovar ou recusar
-- ---------------------------------------------------------------------------
create function public.avaliar_atividade(p_id bigint, p_aprovar boolean, p_titulo text default null, p_tema text default null, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at public.atividades;
begin
  select * into v_at from public.atividades where id = p_id for update;
  if not found or v_at.status <> 'pendente' then
    raise exception 'Esta atividade não está mais aguardando aprovação.' using errcode = 'P0001';
  end if;
  if not public.pode_editar_etapa(v_at.etapa_id) then
    raise exception 'Você não tem permissão para avaliar atividades desta etapa.' using errcode = 'P0001';
  end if;

  if p_aprovar then
    update public.atividades
       set status = 'aprovada', avaliada_por = auth.uid(), avaliada_em = now(),
           titulo = coalesce(nullif(trim(p_titulo), ''), titulo),
           tema = coalesce(nullif(trim(p_tema), ''), tema)
     where id = p_id
     returning * into v_at;
    perform public.notificar(v_at.proposta_por, 'atividade_aprovada', 'Atividade aprovada',
      '"' || v_at.titulo || '" foi aprovada e já está no banco de atividades, em ' || v_at.tema || '.', '/banco');
  else
    if nullif(trim(p_motivo), '') is null then
      raise exception 'Explique o motivo da recusa para o professor.' using errcode = 'P0001';
    end if;
    update public.atividades
       set status = 'recusada', avaliada_por = auth.uid(), avaliada_em = now(), motivo_recusa = trim(p_motivo)
     where id = p_id;
    perform public.notificar(v_at.proposta_por, 'atividade_recusada', 'Atividade não aprovada',
      '"' || v_at.titulo || '" não foi aprovada para o banco. Motivo: ' || trim(p_motivo), null);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: remover (o arquivo é apagado antes, pelo navegador)
-- Professor: as próprias, enquanto não aprovadas. Quem aprova: qualquer uma da etapa.
-- ---------------------------------------------------------------------------
create function public.remover_atividade(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at public.atividades;
begin
  select * into v_at from public.atividades where id = p_id;
  if not found then
    raise exception 'Atividade não encontrada.' using errcode = 'P0001';
  end if;
  if not (public.pode_editar_etapa(v_at.etapa_id) or (v_at.proposta_por = auth.uid() and v_at.status <> 'aprovada')) then
    raise exception 'Você não pode remover esta atividade.' using errcode = 'P0001';
  end if;
  delete from public.atividades where id = p_id;
end;
$$;

-- Nomes: inclui quem propôs/aprovou atividades do banco que o usuário vê.
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
      or exists (select 1 from public.atividades a
                 where (a.proposta_por = p.id or a.avaliada_por = p.id)
                   and a.status = 'aprovada' and public.pode_ver_etapa(a.etapa_id))
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.atividades enable row level security;
create policy "quem pode ver a atividade" on public.atividades
  for select to authenticated
  using (
    public.meu_perfil_ativo() and (
      proposta_por = auth.uid()
      or (status = 'aprovada' and public.pode_ver_etapa(etapa_id))
      or public.pode_editar_etapa(etapa_id)
      or exists (select 1 from public.blocos b
                 where b.id = bloco_id and b.excluido_em is null and public.pode_ver_planejamento(b.planejamento_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Armazenamento dos arquivos (bucket privado; acesso por link temporário)
-- Caminho: <id do professor>/<nome único>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atividades', 'atividades', false, 52428800, array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'video/mp4'
])
on conflict (id) do nothing;

create policy "professor envia para a própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'atividades' and (storage.foldername(name))[1] = auth.uid()::text and public.meu_papel() = 'professor');

-- Quem vê a atividade (pela RLS acima) pode baixar o arquivo; o autor vê a própria pasta.
create policy "baixar arquivos de atividades visíveis" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'atividades' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.atividades a where a.arquivo_caminho = name)
    )
  );

create policy "apagar arquivo de atividade" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'atividades' and (
      ((storage.foldername(name))[1] = auth.uid()::text
        and not exists (select 1 from public.atividades a where a.arquivo_caminho = name and a.status = 'aprovada'))
      or exists (select 1 from public.atividades a where a.arquivo_caminho = name and public.pode_editar_etapa(a.etapa_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke execute on function public.notificar(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function
  public.propor_atividade(bigint, text, text, text, text, text, bigint),
  public.avaliar_atividade(bigint, boolean, text, text, text),
  public.remover_atividade(bigint),
  public.pode_ver_etapa(smallint),
  public.limite_arquivo(text)
from public, anon;
grant execute on function
  public.propor_atividade(bigint, text, text, text, text, text, bigint),
  public.avaliar_atividade(bigint, boolean, text, text, text),
  public.remover_atividade(bigint),
  public.pode_ver_etapa(smallint),
  public.limite_arquivo(text)
to authenticated;
