-- Usuários de TESTE para desenvolvimento local. Nunca rode em produção
-- (o `supabase db push` não executa seeds; só o `supabase db reset` local).
-- Senha de todos: senha123

create or replace function pg_temp.criar_usuario(p_email text, p_nome text, p_papel text, p_etapa text default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('senha123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('nome', p_nome, 'papel_solicitado', p_papel,
                       'etapa_id', (select id from public.etapas where nome = p_etapa)),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end;
$$;

do $$
declare
  v_admin uuid; v_dir uuid; v_sec uuid; v_coord uuid; v_marina uuid; v_renata uuid;
  ei smallint := (select id from public.etapas where nome = 'Educação Infantil');
  f2 smallint := (select id from public.etapas where nome = 'Ensino Fundamental II');
begin
  v_admin  := pg_temp.criar_usuario('admin@tomdavida.test',       'Rodolfo Santos',  'professor');
  v_dir    := pg_temp.criar_usuario('diretora@tomdavida.test',    'Helena Duarte',   'diretor');
  v_sec    := pg_temp.criar_usuario('secretaria@tomdavida.test',  'Paula Mendes',    'secretaria');
  v_coord  := pg_temp.criar_usuario('coord.infantil@tomdavida.test', 'Renata Prado', 'coordenador', 'Educação Infantil');
  v_marina := pg_temp.criar_usuario('marina@tomdavida.test',      'Marina Alves',    'professor', 'Educação Infantil');
  v_renata := pg_temp.criar_usuario('ingles@tomdavida.test',      'Lucas Ferreira',  'professor', 'Ensino Fundamental II');
  -- pendentes (aparecem na aba Solicitações)
  perform pg_temp.criar_usuario('joao@tomdavida.test',  'João Silva',    'professor',   'Educação Infantil');
  perform pg_temp.criar_usuario('carla@tomdavida.test', 'Carla Nogueira', 'coordenador', 'Ensino Fundamental I');

  update public.perfis set status = 'ativo', papel = 'administrador' where id = v_admin;
  update public.perfis set status = 'ativo' where id in (v_dir, v_sec, v_coord, v_marina, v_renata);

  insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values
    (v_coord,  ei, null, null, false),
    (v_marina, ei, (select id from public.turmas where nome = 'Jardim 1'),
                   (select id from public.disciplinas where nome = 'Polivalente (Regente)'), true),
    (v_renata, f2, (select id from public.turmas where nome = '6º Ano A'),
                   (select id from public.disciplinas where nome = 'Inglês'), false);
end;
$$;
