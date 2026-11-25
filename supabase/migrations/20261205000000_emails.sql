-- =============================================================================
-- Fase 5 — Lembretes e alertas por e-mail (§8.2, §8.4)
--   * Lembrete ao professor N dias antes da data-limite e no dia (dias
--     configuráveis pela Direção/Secretaria), só para quem ainda não entregou.
--   * Alerta à Coordenação da etapa no dia seguinte ao prazo:
--     "TURMA [X] DE PROFESSOR [Y] – PLANEJAMENTO NÃO IDENTIFICADO"
--     (sem Coordenação na etapa, vai para a Secretaria). Se a rotina falhar um
--     dia, o alerta sai nos dias seguintes (janela de 7 dias).
--   * Cada e-mail também vira notificação no sistema.
--   * O banco prepara a fila (`preparar_envios`); a Edge Function
--     `rotina-diaria` envia e registra o resultado. Nada é enviado duas vezes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Configuração (linha única)
-- ---------------------------------------------------------------------------
create table public.config_notificacoes (
  id                 int primary key default 1 check (id = 1),
  emails_ativos      boolean not null default true,
  lembrete_dias      int[] not null default '{3,0}',
  alerta_coordenacao boolean not null default true,
  definido_por_id    uuid references public.perfis (id),
  definido_por_nivel int not null default 0,
  definido_em        timestamptz not null default now(),
  constraint dias_validos check (lembrete_dias <@ array[0,1,2,3,4,5,6,7,10,14])
);
insert into public.config_notificacoes (id) values (1);

create trigger config_notificacoes_trava before insert or update on public.config_notificacoes
  for each row execute function public.aplicar_trava();
create trigger config_notificacoes_auditoria after update on public.config_notificacoes
  for each row execute function public.registrar_auditoria();

create function public.salvar_config_notificacoes(p_ativos boolean, p_dias int[], p_alerta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.meu_papel() is null or public.meu_papel() not in ('diretor', 'secretaria') then
    raise exception 'Somente a Direção ou a Secretaria Acadêmica configura os e-mails.' using errcode = 'P0001';
  end if;
  update public.config_notificacoes
     set emails_ativos = p_ativos,
         lembrete_dias = array(select distinct unnest(coalesce(p_dias, '{}')) order by 1 desc),
         alerta_coordenacao = p_alerta
   where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fila e histórico de e-mails
-- ---------------------------------------------------------------------------
create table public.emails (
  id             bigint generated always as identity primary key,
  tipo           text not null check (tipo in ('lembrete', 'alerta_coordenacao')),
  chave          text not null unique,          -- impede envio duplicado
  destinatario_id uuid not null references public.perfis (id),
  email          text not null,
  nome           text not null,
  assunto        text not null,
  texto          text not null,
  link           text,
  status         text not null default 'pendente' check (status in ('pendente', 'enviado', 'simulado', 'erro')),
  tentativas     int not null default 0,
  erro           text,
  criado_em      timestamptz not null default now(),
  enviado_em     timestamptz
);
create index emails_status_idx on public.emails (status) where status in ('pendente', 'erro');
create index emails_criado_idx on public.emails (criado_em desc);

-- Notificações no sistema também deixam de duplicar.
alter table public.notificacoes add column chave text unique;

-- ---------------------------------------------------------------------------
-- Preparar os envios do dia
-- ---------------------------------------------------------------------------
create function public.enfileirar(
  p_tipo text, p_chave text, p_destinatario uuid, p_assunto text, p_texto text, p_link text, p_titulo_notificacao text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
  v_id bigint;
begin
  select * into v_perfil from public.perfis where id = p_destinatario and status = 'ativo';
  if not found then
    return false;
  end if;
  insert into public.emails (tipo, chave, destinatario_id, email, nome, assunto, texto, link)
  values (p_tipo, p_chave, p_destinatario, v_perfil.email, v_perfil.nome, p_assunto, p_texto, p_link)
  on conflict (chave) do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, chave)
  values (p_destinatario, p_tipo, p_titulo_notificacao, p_texto, p_link, p_chave)
  on conflict (chave) do nothing;
  return true;
end;
$$;

-- Professores e turmas esperados nas entregas (vínculo ativo, professor ativo, turma ativa).
create function public.pares_esperados()
returns table (usuario_id uuid, turma_id bigint, turma text, etapa_id smallint, professor text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct v.usuario_id, v.turma_id, t.nome, t.etapa_id, pf.nome
  from public.vinculos v
  join public.turmas t on t.id = v.turma_id and t.ativa
  join public.perfis pf on pf.id = v.usuario_id and pf.status = 'ativo' and pf.papel = 'professor'
  where v.ativo;
$$;

create function public.preparar_envios(p_hoje date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone public.fuso_escola())::date);
  v_cfg public.config_notificacoes;
  v_novos int := 0;
  r record;
  v_dest uuid;
  v_avisados int;
  v_texto text;
begin
  select * into v_cfg from public.config_notificacoes where id = 1;
  if not v_cfg.emails_ativos then
    return 0;
  end if;

  -- 1) Lembretes ao professor (um e-mail por professor, período e dia de antecedência)
  for r in
    select pe.id as periodo, pe.inicio, pe.fim, pe.prazo, (pe.prazo - v_hoje) as dias, pr.usuario_id,
           string_agg(pr.turma, ', ' order by pr.turma) as turmas
    from public.periodos_entrega pe
    join public.pares_esperados() pr on (pe.etapa_id is null or pe.etapa_id = pr.etapa_id)
    where (pe.prazo - v_hoje) = any (v_cfg.lembrete_dias)
      and not exists (select 1 from public.entregas e
                      where e.periodo_id = pe.id and e.professor_id = pr.usuario_id and e.turma_id = pr.turma_id)
    group by pe.id, pe.inicio, pe.fim, pe.prazo, pr.usuario_id
  loop
    v_texto := case when r.dias = 0
      then 'Hoje é o último dia para entregar o planejamento de '
      else 'Faltam ' || r.dias || case when r.dias = 1 then ' dia' else ' dias' end || ' para entregar o planejamento de '
    end || r.turmas || ' (período de ' || to_char(r.inicio, 'DD/MM') || ' a ' || to_char(r.fim, 'DD/MM') || '). '
      || 'Data-limite: ' || to_char(r.prazo, 'DD/MM/YYYY') || '. Confira suas entregas e conclua todos os dias do período.';
    if public.enfileirar(
      'lembrete',
      'lembrete:' || r.periodo || ':' || r.usuario_id || ':' || r.dias,
      r.usuario_id,
      case when r.dias = 0 then 'Prazo de entrega do planejamento é hoje'
           else 'Prazo de entrega do planejamento em ' || r.dias || case when r.dias = 1 then ' dia' else ' dias' end end,
      v_texto,
      '/planejamentos?semana=' || r.inicio,
      case when r.dias = 0 then 'Prazo de entrega é hoje' else 'Prazo de entrega se aproximando' end
    ) then
      v_novos := v_novos + 1;
    end if;
  end loop;

  -- 2) Alerta à Coordenação no dia seguinte ao prazo (com janela de 7 dias para recuperar falhas)
  if v_cfg.alerta_coordenacao then
    for r in
      select pe.id as periodo, pe.inicio, pe.fim, pe.prazo, pr.usuario_id, pr.turma_id, pr.turma, pr.etapa_id, pr.professor
      from public.periodos_entrega pe
      join public.pares_esperados() pr on (pe.etapa_id is null or pe.etapa_id = pr.etapa_id)
      where pe.prazo < v_hoje and pe.prazo >= v_hoje - 7
        and not exists (select 1 from public.entregas e
                        where e.periodo_id = pe.id and e.professor_id = pr.usuario_id and e.turma_id = pr.turma_id)
    loop
      v_texto := 'O planejamento de ' || r.professor || ' para a turma ' || r.turma || ' (período de '
        || to_char(r.inicio, 'DD/MM') || ' a ' || to_char(r.fim, 'DD/MM') || ') não foi entregue até a data-limite, '
        || to_char(r.prazo, 'DD/MM/YYYY') || '.';
      v_avisados := 0;
      for v_dest in
        select pf.id from public.perfis pf
        where pf.status = 'ativo' and pf.papel = 'coordenador'
          and exists (select 1 from public.vinculos v
                      where v.usuario_id = pf.id and v.ativo and v.turma_id is null and v.etapa_id = r.etapa_id)
      loop
        v_avisados := v_avisados + 1;
        if public.enfileirar(
          'alerta_coordenacao',
          'alerta:' || r.periodo || ':' || r.turma_id || ':' || r.usuario_id || ':' || v_dest,
          v_dest,
          'TURMA ' || upper(r.turma) || ' DE PROFESSOR ' || upper(r.professor) || ' – PLANEJAMENTO NÃO IDENTIFICADO',
          v_texto,
          '/planejamentos?turma=' || r.turma_id || '&semana=' || r.inicio,
          'Planejamento não identificado'
        ) then
          v_novos := v_novos + 1;
        end if;
      end loop;
      if v_avisados = 0 then
        for v_dest in select pf.id from public.perfis pf where pf.status = 'ativo' and pf.papel = 'secretaria' loop
          if public.enfileirar(
            'alerta_coordenacao',
            'alerta:' || r.periodo || ':' || r.turma_id || ':' || r.usuario_id || ':' || v_dest,
            v_dest,
            'TURMA ' || upper(r.turma) || ' DE PROFESSOR ' || upper(r.professor) || ' – PLANEJAMENTO NÃO IDENTIFICADO',
            v_texto,
            '/planejamentos?turma=' || r.turma_id || '&semana=' || r.inicio,
            'Planejamento não identificado'
          ) then
            v_novos := v_novos + 1;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  return v_novos;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.config_notificacoes enable row level security;
alter table public.emails enable row level security;

create policy "usuários ativos leem a configuração de e-mails" on public.config_notificacoes
  for select to authenticated using (public.meu_perfil_ativo());

-- Histórico: Direção, Secretaria e Admin; cada um vê os e-mails que recebeu.
create policy "gestão lê o histórico de e-mails" on public.emails
  for select to authenticated using (public.meu_nivel() >= 30 or destinatario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Permissões: preparar_envios só pelo servidor (Edge Function com service_role)
-- ---------------------------------------------------------------------------
revoke execute on function public.enfileirar(text, text, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.preparar_envios(date) from public, anon, authenticated;
revoke execute on function public.pares_esperados() from public, anon, authenticated;
grant execute on function public.preparar_envios(date) to service_role;
revoke execute on function public.salvar_config_notificacoes(boolean, int[], boolean) from public, anon;
grant execute on function public.salvar_config_notificacoes(boolean, int[], boolean) to authenticated;
grant select, update on public.emails to service_role;

-- ---------------------------------------------------------------------------
-- Etiqueta "Atrasado" (§8.3): visível a todos que veem o planejamento.
-- Quem vê a turma passa a ver as entregas dela (antes o professor via só as próprias).
-- ---------------------------------------------------------------------------
drop policy "quem vê a turma vê as entregas" on public.entregas;
create policy "quem vê a turma vê as entregas" on public.entregas
  for select to authenticated using (professor_id = auth.uid() or public.pode_ver_turma(turma_id));
