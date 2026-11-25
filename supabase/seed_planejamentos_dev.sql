-- Planejamentos de TESTE para desenvolvimento local (semana atual).
-- Depende de seed_usuarios_dev.sql. Nunca rode em produção.

do $$
declare
  v_marina uuid := (select id from public.perfis where email = 'marina@tomdavida.test');
  v_lucas  uuid := (select id from public.perfis where email = 'ingles@tomdavida.test');
  v_jardim bigint := (select id from public.turmas where nome = 'Jardim 1');
  v_6ano   bigint := (select id from public.turmas where nome = '6º Ano A');
  v_poli   smallint := (select id from public.disciplinas where nome = 'Polivalente (Regente)');
  v_ing    smallint := (select id from public.disciplinas where nome = 'Inglês');
  v_seg    date := date_trunc('week', current_date)::date;
  v_plan   bigint;
begin
  if v_marina is null then
    return;
  end if;

  -- Segunda: concluído
  insert into public.planejamentos (turma_id, data, turno, criado_por) values (v_jardim, v_seg, 'matutino', v_marina) returning id into v_plan;
  insert into public.blocos (planejamento_id, professor_id, disciplina_id, hora_inicio, hora_fim, conteudo, objetivos, habilidades,
                             estrategias, atividades, avaliacao, recursos, linguagens_amor, status, atualizado_por)
  values (v_plan, v_marina, v_poli, '07:30', '11:30',
          'Cores primárias', 'Reconhecer e nomear as cores primárias; misturar cores e observar o resultado.',
          '{espacial,linguistica,interpessoal}',
          'Roda de conversa, demonstração e experimentação em pequenos grupos.',
          'Pintura livre com guache usando apenas azul, amarelo e vermelho.',
          'Observação da participação e registro fotográfico das produções.',
          'Tinta guache, pincéis, papel kraft, aventais.',
          '{tempo_qualidade,palavras_afirmacao}', 'verde', v_marina);

  -- Terça: em andamento
  insert into public.planejamentos (turma_id, data, turno, criado_por) values (v_jardim, v_seg + 1, 'matutino', v_marina) returning id into v_plan;
  insert into public.blocos (planejamento_id, professor_id, disciplina_id, hora_inicio, hora_fim, conteudo, objetivos, habilidades, status, atualizado_por)
  values (v_plan, v_marina, v_poli, '07:30', '11:30',
          'Contação de história: A Lagarta Comilona', 'Ampliar vocabulário e sequência temporal.',
          '{linguistica,naturalista}', 'amarelo', v_marina);

  -- 6º Ano A, Inglês (Fundamental II)
  insert into public.planejamentos (turma_id, data, turno, criado_por) values (v_6ano, v_seg, 'vespertino', v_lucas) returning id into v_plan;
  insert into public.blocos (planejamento_id, professor_id, disciplina_id, hora_inicio, hora_fim, conteudo, objetivos, habilidades, status, atualizado_por)
  values (v_plan, v_lucas, v_ing, '13:30', '14:20',
          'Simple present: daily routine', 'Descrever a rotina usando o simple present.',
          '{linguistica,interpessoal}', 'verde', v_lucas);
end;
$$;

-- Grade horária de exemplo (vigente desde a segunda desta semana).
do $$
declare
  v_marina uuid := (select id from public.perfis where email = 'marina@tomdavida.test');
  v_lucas  uuid := (select id from public.perfis where email = 'ingles@tomdavida.test');
  v_jardim bigint := (select id from public.turmas where nome = 'Jardim 1');
  v_6ano   bigint := (select id from public.turmas where nome = '6º Ano A');
  v_poli   smallint := (select id from public.disciplinas where nome = 'Polivalente (Regente)');
  v_ing    smallint := (select id from public.disciplinas where nome = 'Inglês');
  v_seg    date := date_trunc('week', current_date)::date;
  d int;
begin
  if v_marina is null then
    return;
  end if;
  for d in 1..5 loop
    insert into public.horarios (turma_id, dia_semana, hora_inicio, hora_fim, disciplina_id, professor_id, vigente_desde)
    values (v_jardim, d, '07:30', '11:30', v_poli, v_marina, v_seg);
  end loop;
  insert into public.horarios (turma_id, dia_semana, hora_inicio, hora_fim, disciplina_id, professor_id, vigente_desde) values
    (v_6ano, 1, '13:30', '14:20', v_ing, v_lucas, v_seg),
    (v_6ano, 3, '15:10', '16:00', v_ing, v_lucas, v_seg);
end;
$$;

-- Períodos de entrega de exemplo: semana atual (prazo: sexta anterior) e a próxima (prazo: sexta desta semana).
do $$
declare
  v_seg date := date_trunc('week', current_date)::date;
  v_id  bigint;
begin
  insert into public.periodos_entrega (inicio, fim, prazo) values (v_seg, v_seg + 4, v_seg - 3) returning id into v_id;
  perform public.avaliar_entregas_do_periodo(v_id);
  insert into public.periodos_entrega (inicio, fim, prazo) values (v_seg + 7, v_seg + 11, v_seg + 4);
end;
$$;
