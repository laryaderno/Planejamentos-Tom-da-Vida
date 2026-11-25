# Arquitetura — Sistema de Planejamento de Aulas (Escola Tom da Vida)

Base: *Especificação de Requisitos v2.0*. Este documento define a stack, o modelo de dados,
onde cada regra é aplicada e a ordem de construção.

---

## 1. Visão geral

```
┌──────────────────────────────┐        ┌───────────────────────────────────────────┐
│  Navegador (PWA)             │        │  Supabase                                 │
│  React + Vite                │  HTTPS │  ┌─────────────┐  ┌────────────────────┐  │
│  ├─ React Router             │◄──────►│  │ Auth        │  │ Postgres           │  │
│  ├─ TanStack Query (cache)   │        │  │ e-mail+senha│  │ tabelas + RLS      │  │
│  ├─ Dexie / IndexedDB        │        │  └─────────────┘  │ triggers (auditoria│  │
│  │   (fila offline)          │        │                   │  e histórico)      │  │
│  ├─ Service Worker           │        │  ┌─────────────┐  │ funções SQL (RPC)  │  │
│  └─ Geração PDF / DOCX       │        │  │ Storage     │  │ pg_cron (agenda)   │  │
└──────────────────────────────┘        │  │ (anexos)    │  └─────────┬──────────┘  │
                                        │  └─────────────┘            │             │
                                        │  ┌──────────────────────────▼──────────┐  │
                                        │  │ Edge Functions                      │  │
                                        │  │ e-mails, aprovação, reset de senha  │  │
                                        │  └──────────────┬──────────────────────┘  │
                                        └─────────────────┼─────────────────────────┘
                                                          │
                                   ┌──────────────────────┼─────────────────────┐
                                   ▼                      ▼                     ▼
                           Resend (e-mail)    Bunny Stream / Mux (vídeo)   Vercel (hospeda o front)
```

### Por que essa stack

| Necessidade da especificação | Como é atendida |
|---|---|
| Login com aprovação prévia (§4) | Supabase Auth + coluna `status` no perfil; RLS bloqueia tudo enquanto `status ≠ 'ativo'` |
| Hierarquia e permissões rígidas (§2, §3, §12) | **Row Level Security** no Postgres: a regra fica no banco, então nem um front-end adulterado consegue burlar |
| Travas em cascata (§3.1) | Coluna `definido_por_nivel` + trigger que recusa alteração vinda de nível inferior |
| Histórico completo e log de auditoria (§6.3, §11) | Triggers do Postgres gravam automaticamente toda alteração; não depende do front lembrar de registrar |
| "Nenhum planejamento pode ser perdido" (§7) | Salvamento automático com debounce + fila local em IndexedDB que reenvia quando a conexão volta |
| E-mails periódicos e alertas de atraso (§8) | `pg_cron` agenda diária → Edge Function → Resend |
| Vídeos com auditoria de visualização (§10) | Hospedagem de vídeo dedicada (streaming adaptativo) + eventos de progresso gravados no banco |
| Exportar PDF e Word (§11) | Geração no navegador (`@react-pdf/renderer` e `docx`), sem servidor extra |

Alternativa considerada: back-end próprio (Node/NestJS + Postgres). Dá mais controle, mas exige
implementar autenticação, agendamento, hospedagem e deploy do zero. Para uma escola, o Supabase
entrega o mesmo resultado com muito menos infraestrutura para manter. Como é Postgres puro, migrar
depois continua possível.

### Bibliotecas do front-end

| Área | Biblioteca |
|---|---|
| Linguagem | **TypeScript** (migrar o protótipo atual de JSX) — a matriz de permissões e o modelo de dados se beneficiam muito de tipos |
| Rotas | `react-router` |
| Dados do servidor | `@supabase/supabase-js` + `@tanstack/react-query` |
| Formulários e validação | `react-hook-form` + `zod` (os mesmos esquemas validam o formulário e a fila offline) |
| Offline | `dexie` (IndexedDB) + `vite-plugin-pwa` (service worker) |
| Exportação | `@react-pdf/renderer` (PDF), `docx` (Word) |
| Vídeo | player do provedor (Bunny/Mux) ou `hls.js` |
| Ícones / visual | `lucide-react` (já usado) + estilos do protótipo extraídos para CSS |
| Testes | `vitest` (unidade), testes das regras do banco em Postgres em memória (PGlite), `playwright` (fluxos ponta a ponta) |

---

## 2. Papéis e níveis

Cada papel recebe um nível numérico. Quase todas as regras de hierarquia viram uma comparação
simples de números.

| Papel | Nível |
|---|---|
| `administrador` | 50 |
| `diretor` | 40 |
| `secretaria` | 30 |
| `coordenador` | 20 |
| `professor` | 10 |

Regras derivadas:

- **Ninguém altera usuário de nível igual ou superior** → `nivel(ator) > nivel(alvo)`.
  *Exceções explícitas da especificação:* Administrador cria Administrador; Diretor aprova Diretor
  (se já houver ≥1 Diretor ativo). Remoção de Diretor é exclusiva do Administrador.
- **Trava em cascata** → um registro com `definido_por_nivel = 40` só pode ser alterado por quem tem
  nível ≥ 40. O Administrador não entra nas travas (não opera turmas nem prazos).
- **Escopo do Coordenador** → só age em etapas/turmas presentes em `vinculos` dele.

---

## 3. Modelo de dados

### 3.1 Estrutura escolar e usuários

```sql
etapas            (id, nome, ordem, exige_linguagem_amor bool)
                  -- 'Educação Infantil' tem exige_linguagem_amor = true
turmas            (id, etapa_id, nome, ano_letivo, ativa,
                   definido_por_id, definido_por_nivel, definido_em)
disciplinas       (id, nome)                       -- Inglês, Arte, Ed. Física, Português...

perfis            (id = auth.users.id, nome, email, papel, status,
                   -- status: 'pendente' | 'ativo' | 'recusado' | 'removido'
                   etapa_solicitada_id, turma_solicitada_id,   -- o que pediu no cadastro
                   aprovado_por, aprovado_em, criado_em)

vinculos          (id, usuario_id, etapa_id, turma_id NULL, disciplina_id NULL,
                   regente bool,
                   definido_por_id, definido_por_nivel, definido_em, ativo)
                  -- Coordenador: (usuario, etapa)
                  -- Professor regente: (usuario, etapa, turma, regente=true)
                  -- Especialista:      (usuario, etapa, turma, disciplina, regente=false)
```

`vinculos` é a tabela central de permissões: responde "quem pode ver/editar o quê" e atende ao
requisito de múltiplos vínculos (turma × etapa × disciplina).

### 3.2 Planejamento

```sql
planejamentos     (id, turma_id, data, turno,              -- UNIQUE (turma_id, data, turno)
                   periodo_entrega_id,
                   criado_em, atualizado_em)

blocos            (id, planejamento_id, professor_id, disciplina_id NULL,
                   hora_inicio, hora_fim,
                   conteudo, objetivos, habilidades text[],  -- tags de inteligências
                   estrategias, atividades, avaliacao, recursos,
                   linguagem_amor NULL,                      -- enum; obrigatório só na Ed. Infantil
                   status,                                   -- 'cinza' | 'amarelo' | 'verde'
                   concluido_em NULL,
                   versao int,                               -- para detectar edição concorrente
                   criado_em, atualizado_em, atualizado_por)

notas             (id, planejamento_id, bloco_id NULL, autor_id, texto, criado_em)

historico_blocos  (id, bloco_id, autor_id, em, campo, valor_anterior, valor_novo)
                  -- preenchido por trigger AFTER UPDATE em blocos
```

**Decisão:** o professor edita *o seu bloco*, não o planejamento inteiro. Assim:

- Regente e especialistas nunca se sobrepõem — cada um só tem permissão de escrita nas linhas de
  `blocos` em que `professor_id = auth.uid()` (§4.2: o Regente nunca preenche o bloco de Inglês).
- O "last write wins" (§7) fica restrito a um bloco, reduzindo muito a chance de conflito.
- O status do planejamento do dia é derivado: **verde** se todos os blocos estão verdes,
  **amarelo** se algum foi iniciado, **cinza** caso contrário. *(ver decisão em aberto D1)*

**Regra da Educação Infantil:** constraint/trigger em `blocos` recusa `status = 'verde'` quando a
etapa da turma tem `exige_linguagem_amor = true` e `linguagem_amor IS NULL`. O front esconde o
campo nas demais etapas, mas a regra vale no banco.

**Professor removido (decisão D6):** quem remove o professor escolhe, no próprio modal de
confirmação, o destino dos planejamentos dele:

| Opção | O que acontece |
|---|---|
| **Manter** (padrão) | Os blocos do professor ficam arquivados (`blocos.arquivado_em`, somente leitura) e passam a aparecer no **Banco de Atividades → seção Planejamentos** da turma. Continuam contando no conteúdo programático e no relatório de entregas. |
| **Excluir** | Os blocos **não são apagados do banco**: recebem `blocos.excluido_em` e deixam de aparecer nas telas de planejamento e no Banco de Atividades. **Continuam contando no conteúdo programático e no relatório de entregas**, que leem todos os blocos, inclusive os excluídos. |

Em nenhuma das opções um planejamento é apagado de verdade: o registro pedagógico da escola
(conteúdo programático e entregas) fica sempre completo. A diferença entre as opções é só onde o
planejamento continua visível.

| Onde aparece | Ativo | Manter | Excluir |
|---|---|---|---|
| Telas de planejamento da turma | ✔ | ✔ (somente leitura) | — |
| Banco de Atividades → Planejamentos | — | ✔ | — |
| Conteúdo programático | ✔ | ✔ | ✔ |
| Relatório de entregas | ✔ | ✔ | ✔ |

Tudo acontece numa única função RPC `remover_professor(usuario_id, destino)` com
`destino ∈ ('manter', 'excluir')`, que também desativa os vínculos e marca o perfil como
`removido`. O modal (§3.2) informa quantos planejamentos serão afetados e que a remoção do acesso
não pode ser desfeita automaticamente. Não existe `DELETE` em `blocos` nem em `planejamentos`
para nenhum papel (RLS sem política de exclusão).

```sql
-- acréscimos em blocos
arquivado_em      timestamptz NULL      -- autor removido com "Manter": vai para o Banco de Atividades
excluido_em       timestamptz NULL      -- autor removido com "Excluir": some das telas, fica nos relatórios
```

### 3.3 Prazos e notificações

```sql
config_escola     (id = 1,                                  -- linha única (prazo global, §8.1)
                   frequencia,          -- 'semanal' | 'quinzenal' | 'mensal'
                   data_base,
                   intervalo_lembrete_dias, dias_antecedencia_lembrete,
                   definido_por_id, definido_por_nivel, definido_em)

periodos_entrega  (id, inicio, fim, prazo)                  -- gerados a partir de config_escola

entregas          (id, periodo_entrega_id, professor_id, turma_id,
                   situacao,            -- 'no_prazo' | 'atrasado' | 'nao_entregue' | 'pendente'
                   entregue_em NULL)
                  -- calculada pelo job diário; base do Relatório de Entregas (§9)

emails_enviados   (id, tipo, destinatario_id, referencia, enviado_em)
                  -- evita e-mail duplicado e serve de prova de envio
```

### 3.4 Universidade Corporativa

```sql
trilhas           (id, titulo, descricao, ordem, percentual_minimo, ativa)
aulas             (id, trilha_id, titulo, descricao, posicao, video_id, duracao_seg,
                   eh_onboarding bool)

obrigatoriedades  (id, trilha_id, tipo, valor, definido_por_id, definido_por_nivel)
                  -- tipo: 'papel' | 'etapa' | 'turma' | 'usuario'
                  -- matrícula efetiva = união das regras, sempre excluindo Diretor

progresso_aulas   (usuario_id, aula_id,
                   iniciado_em, concluido_em NULL,
                   segundos_assistidos int,   -- soma de trechos realmente assistidos
                   percentual numeric,
                   reinicios int,
                   PRIMARY KEY (usuario_id, aula_id))

eventos_video     (id, usuario_id, aula_id, tipo, posicao_seg, em)
                  -- 'play' | 'pause' | 'progresso' (a cada 10 s) | 'fim' | 'reinicio'
```

Desbloqueio sequencial (§10.1) é calculado no banco por uma função
`aula_liberada(usuario, aula)`: o Onboarding é sempre liberado; qualquer outra aula exige o
Onboarding e a aula anterior da trilha concluídos. O link do vídeo só é entregue se a função
retornar verdadeiro.

Anti-burla: o player impede avançar além do trecho já assistido, e o percentual é calculado no
servidor a partir de `eventos_video` (não aceita "concluí" enviado diretamente pelo navegador).

### 3.5 Auditoria

```sql
log_auditoria     (id, em, ator_id, ator_papel, acao, tabela, registro_id,
                   antes jsonb, depois jsonb, ip)
```

Trigger genérico em `perfis`, `vinculos`, `turmas`, `config_escola`, `planejamentos`, `blocos`,
`trilhas`, `aulas`, `obrigatoriedades`. Somente leitura, visível apenas ao Administrador (§5.1).

---

## 4. Onde cada regra é aplicada

Princípio: **o banco é a fonte da verdade, o front só melhora a experiência.** Toda regra crítica
existe no banco; o front repete a regra apenas para esconder botões e mostrar mensagens claras.

| Regra | Banco (obrigatório) | Front (experiência) |
|---|---|---|
| Acesso só após aprovação | RLS: `status = 'ativo'` em todas as políticas | Tela "Aguardando aprovação" |
| Quem aprova quem (§4.1) | RPC `aprovar_usuario()` com checagem de nível/escopo | Aba Solicitações filtrada |
| Não alterar nível ≥ ao seu | RLS + RPC | Botões ocultos |
| Trava em cascata (§3.1) | Trigger `BEFORE UPDATE` que gera erro com nome, papel e data de quem definiu | Exibe a mensagem exata da especificação |
| Confirmação de ação crítica (§3.2) | — | Modal padronizado `<ConfirmarAcao>` com usuário, ação, escopo e aviso de irreversibilidade |
| Professor só edita o próprio bloco | RLS em `blocos` | Campos de outros blocos somente leitura |
| Linguagem do Amor na Ed. Infantil | Trigger | Campo obrigatório, botão "Concluir" desabilitado |
| Histórico de edições | Trigger em `blocos` | Painel "Histórico" no planejamento |
| Sequência da Universidade | Função `aula_liberada()` | Cadeado nas aulas bloqueadas |

Operações que mexem em várias tabelas ou em outros usuários (aprovar, remover, redefinir senha,
alterar permissões) passam por **funções RPC no banco** ou **Edge Functions**, nunca por
`insert/update` direto do navegador.

---

## 5. Salvamento e modo offline (§7)

```
digitação ──► estado do formulário ──(debounce 1,5 s)──► fila no IndexedDB ──► envio ao Supabase
                                                               │                     │
                                                               │            sucesso: remove da fila
                                                               │            falha de rede: mantém
                                                               ▼
                                              evento "online" / a cada 30 s: reenvia a fila
```

- Toda alteração entra **primeiro** no IndexedDB, então sobrevive a fechar a aba, travar o
  navegador ou cair a internet.
- Banner fixo quando `navigator.onLine = false` **ou** a fila tem itens com falha:
  "Você está offline. As alterações podem não ter sido salvas."
- Indicador sempre visível: *Salvando…* / *Salvo às 14:32* / *Pendente (offline)*.
- Botão **Salvar** força o envio imediato da fila.
- Conflito: cada envio leva a `versao` do bloco. Se o servidor tiver uma versão mais nova, a
  alteração local é aplicada mesmo assim (*last write wins*), mas o usuário vê um aviso e a versão
  sobrescrita fica no histórico.

---

## 6. Rotinas agendadas (§8)

Um job `pg_cron` diário (ex.: 06:00, horário de Brasília) chama a Edge Function `rotina-diaria`:

1. Gera os próximos `periodos_entrega` a partir de `config_escola`, se necessário.
2. Atualiza `entregas` (no prazo / atrasado / não entregue).
3. Envia **lembretes** aos professores conforme o intervalo configurado (§8.2).
4. No dia seguinte ao prazo, envia ao Coordenador da etapa:
   "TURMA [X] DE PROFESSOR [Y] – PLANEJAMENTO NÃO IDENTIFICADO" (§8.4).
5. Grava tudo em `emails_enviados` (impede duplicidade se o job rodar duas vezes).

A etiqueta vermelha "Atrasado" (§8.3) é só uma leitura de `entregas.situacao`.

---

## 7. Exportação (PDF e Word)

| Documento | Conteúdo | Quem vê |
|---|---|---|
| Planejamento do dia | Todos os blocos de Turma + Data + Turno numa tabela, no layout dos modelos atuais da escola | conforme RLS |
| Conteúdo programático | Conteúdo + Objetivos agregados por turma, mensal ou bimestral (§6.1) | Coordenador (etapa), Secretaria, Diretor |
| Relatório de entregas | Por professor, em ordem alfabética: no prazo / atrasados / não entregues (§9) | Coordenador (etapa), Secretaria, Diretor |
| Painel de cursos | Por trilha, aula e usuário: concluiu / em andamento / não iniciou (§10.4) | Administrador, Diretor, Secretaria |

Os dados vêm de **views SQL** (`vw_conteudo_programatico`, `vw_relatorio_entregas`,
`vw_painel_cursos`) que já respeitam a RLS — o mesmo relatório mostra só a etapa para o
Coordenador e a escola inteira para a Secretaria, sem código duplicado.

Os modelos atuais da escola (Word) devem ser usados como referência visual para o layout exportado.

---

## 8. Estrutura de pastas

```
planejamento-aulas/
├─ docs/
│  └─ ARQUITETURA.md
├─ supabase/
│  ├─ migrations/              # SQL versionado: tabelas, RLS, triggers, views, funções
│  ├─ functions/               # Edge Functions (rotina-diaria, aprovar-usuario, reset-senha)
│  ├─ seed.sql                 # etapas, disciplinas, usuários de teste
│  └─ tests/                   # testes das regras do banco (Vitest + PGlite, sem Docker)
├─ src/
│  ├─ app/                     # rotas, layout (AppShell), provedores
│  ├─ lib/                     # cliente supabase, fila offline, permissões, datas
│  ├─ features/
│  │  ├─ auth/                 # login, cadastro, aguardando aprovação
│  │  ├─ usuarios/             # solicitações, professores, coordenadores, vínculos
│  │  ├─ turmas/
│  │  ├─ planejamentos/        # editor, blocos, histórico, notas
│  │  ├─ prazos/
│  │  ├─ relatorios/           # conteúdo programático, entregas, exportação
│  │  ├─ universidade/         # trilhas, player, painel de auditoria
│  │  └─ admin/                # log de auditoria, reset de senha
│  ├─ components/              # ConfirmarAcao, EmptyState, Badge de status, BannerOffline
│  └─ styles/                  # tokens de cor do protótipo atual (paleta C)
└─ tests/e2e/                  # Playwright
```

O protótipo atual (`src/App.jsx`) é reaproveitado: identidade visual, login, layout lateral,
Turmas, Professores, Solicitações e Conteúdo viram componentes dentro de `features/`.

---

## 9. Ambientes e segurança

- **Ambientes:** local (Supabase CLI) → *staging* → produção, cada um com seu projeto Supabase.
- **Segredos:** chaves do Resend e do provedor de vídeo apenas nas Edge Functions; o front só
  recebe a chave pública (`anon`), que não dá acesso a nada sem passar pela RLS.
- **LGPD:** o sistema guarda nome e e-mail de funcionários e o conteúdo pedagógico (não há dados
  de alunos). Ter política de privacidade, backup diário (incluso no Supabase pago) e região de
  hospedagem em São Paulo (`sa-east-1`).
- **Primeiro acesso:** o primeiro Administrador é criado via script/seed; ele cadastra o
  primeiro Diretor (§5.1).

---

## 10. Fases de construção

| Fase | Entrega | Seções |
|---|---|---|
| **0. Fundação** | TypeScript, rotas, Supabase local, migrações iniciais, deploy de staging, extração do protótipo em componentes | — |
| **1. Acesso e hierarquia** | Cadastro, aprovação, papéis, vínculos, travas, modal de confirmação, log de auditoria, reset de senha | §2–5, §11 |
| **2. Turmas e planejamentos** | Turmas, editor de planejamento com blocos, status, Linguagem do Amor, notas, histórico | §6, §6.2, §6.3 |
| **3. Salvamento à prova de falhas** | Fila offline, banner, indicador de salvamento, conflito | §7 |
| **4. Exportação e relatórios** | PDF/Word do planejamento, conteúdo programático, relatório de entregas | §6.1, §9 |
| **5. Prazos e e-mails** | Configuração global, períodos, rotina diária, lembretes, etiqueta de atraso, alerta ao Coordenador | §8 |
| **6. Universidade Corporativa** | Trilhas, aulas, upload de vídeo, desbloqueio sequencial, obrigatoriedades, painel de auditoria | §10 |

Fases 1–3 formam o **MVP**: professores já podem planejar com segurança. A fase 3 pode ser
desenvolvida junto da 2, já que o editor nasce usando a fila offline.

---

## 11. Decisões em aberto

Pontos em que a especificação é ambígua ou o protótipo diverge dela. Precisam de resposta antes
da fase indicada.

| # | Pergunta | Proposta | Fase |
|---|---|---|---|
| D1 | O status (cinza/amarelo/verde) é do planejamento inteiro ou de cada bloco? Com Regente e especialistas no mesmo dia, cada um precisa marcar o seu. | Status por bloco; status do dia derivado | 2 |
| D2 | O que conta como "entregue" para o prazo? Status verde? Todos os planejamentos do período? | Entregue = todos os blocos do professor no período verdes até o prazo | 5 |
| D3 | O protótipo tem **prazos por etapa/turma com dois modos** (automático e manual); a v2 diz que o prazo é **global**. Qual vale? | Seguir a v2 (global); manter a tabela pronta para exceções futuras | 5 |
| D4 | O protótipo tem um **Banco de Atividades** (aprovação de atividades por tema) que não existe na v2. Continua no escopo? | ✅ **Decidido:** continua; ganha a seção *Planejamentos* (ver D6). Falta definir o fluxo de aprovação de atividades | 7 |
| D5 | Turno pertence à turma (como no protótipo) ou ao planejamento (como na v2: Data + Turno)? | Ao planejamento, com turno padrão vindo da turma | 2 |
| D6 | Professor removido: o que acontece com os planejamentos dele? | ✅ **Decidido:** quem remove escolhe *Manter* (vão para Banco de Atividades → Planejamentos) ou *Excluir* (some das telas, mas continua no conteúdo programático e no relatório de entregas; ver §3.2) | 1 |
| D7 | Ano letivo: turmas e planejamentos são arquivados na virada do ano? | Campo `ano_letivo` em turmas; filtro por ano | 2 |
| D8 | Onde hospedar os vídeos? Supabase Storage é simples, mas não faz streaming adaptativo. | Bunny Stream (baixo custo, bom no Brasil) | 6 |
| D9 | Domínio de e-mail para envio (ex.: `nao-responda@escolatomdavida.com.br`) — a escola controla o DNS? | Configurar SPF/DKIM no domínio da escola | 5 |

### Custo estimado de operação (escola de porte médio)

| Serviço | Plano | Custo aproximado/mês |
|---|---|---|
| Supabase | Pro (backups diários) | US$ 25 |
| Vercel | Hobby ou Pro | US$ 0–20 |
| Resend | Gratuito até 3 mil e-mails/mês | US$ 0–20 |
| Bunny Stream | por uso | US$ 1–10 |
| **Total** | | **≈ US$ 30–75** |

Valores de referência; confirmar nos sites oficiais antes de contratar.
