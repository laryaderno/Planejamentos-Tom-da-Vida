-- Dados base para desenvolvimento local (rodado por `npm run db:reset`).

insert into public.etapas (nome, ordem, exige_linguagem_amor) values
  ('Educação Infantil', 1, true),
  ('Ensino Fundamental I', 2, false),
  ('Ensino Fundamental II', 3, false),
  ('Ensino Médio', 4, false);

insert into public.disciplinas (nome) values
  ('Polivalente (Regente)'), ('Língua Portuguesa'), ('Matemática'), ('Ciências'),
  ('História'), ('Geografia'), ('Inglês'), ('Arte'), ('Educação Física'),
  ('Programa Bilíngue'), ('Robótica');

-- Turmas do protótipo
insert into public.turmas (etapa_id, nome, turno_padrao)
select e.id, t.nome, t.turno::public.turno
from (values
  ('Educação Infantil', 'Berçário', 'matutino'),
  ('Educação Infantil', 'Maternal', 'matutino'),
  ('Educação Infantil', 'Jardim 1', 'matutino'),
  ('Educação Infantil', 'Jardim 2', 'vespertino'),
  ('Ensino Fundamental I', '1º Ano A', 'matutino'),
  ('Ensino Fundamental I', '2º Ano A', 'matutino'),
  ('Ensino Fundamental II', '6º Ano A', 'vespertino'),
  ('Ensino Médio', '1ª Série A', 'vespertino')
) as t (etapa, nome, turno)
join public.etapas e on e.nome = t.etapa;
