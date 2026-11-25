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
                   linguagens_amor[],                        -- uma ou mais; ao menos uma para concluir na Ed. Infantil
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

**Regra da Educação Infantil:** trigger em `blocos` recusa `status = 'verde'` quando a etapa da turma
tem `exige_linguagem_amor = true` e nenhuma Linguagem do Amor foi marcada (pode haver mais de uma). O front esconde o
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

### 3.3 Prazos, entregas e notificações

```sql
periodos_entrega  (id, inicio, fim, prazo, definido_por_*)   -- cadastrados pela Direção/Secretaria; trava em cascata
entregas          (id, periodo_id, professor_id, turma_id, entregue_em, situacao)
                  -- situacao: 'antecipado' | 'no_prazo' | 'atrasado'; uma por professor × turma × período
notificacoes      (id, usuario_id, tipo, titulo, mensagem, link, entrega_id, criada_em, lida_em)
```

```sql
dias_sem_aula     (id, data, descricao, etapa_id NULL, definido_por_*)   -- NULL = escola toda
horarios          (id, turma_id, dia_semana 1–5, hora_inicio, hora_fim, disciplina_id, professor_id,
                   vigente_desde, vigente_ate NULL, definido_por_*)       -- grade horária com vigência
```

**Entrega (decisões de 25/11/2026):**

- O período conta como **entregue** quando o professor conclui (verde) as aulas dele naquela turma:
  - **com grade horária:** em cada dia com aula do período, um bloco concluído de cada disciplina que a grade
    lhe atribui naquele dia da semana;
  - **sem grade** (turma ainda sem grade ou professor fora dela): o Regente, todos os dias com aula; o
    especialista, todos os blocos que criou no período (ao menos um).
- **Dias sem aula** (feriados, recessos, formações) não são exigidos e não contam como dias úteis. A Direção
  ou a Secretaria os cadastra em *Prazos e ciclos*, para a escola toda ou para uma etapa; há importação dos
  feriados nacionais do ano (inclui Carnaval, Sexta-feira Santa e Corpus Christi, calculados pela Páscoa).
  Feriados estaduais e municipais são cadastrados à mão.
- **Situação:** 2 ou mais dias úteis antes da data-limite = *com antecedência*; no dia ou na véspera =
  *no prazo*; depois = *com atraso*.
- A verificação roda no banco quando um bloco fica verde. Voltar a amarelo e concluir de novo não gera nova
  entrega. Cadastrar um período, um dia sem aula ou uma nova grade reavalia as entregas em aberto (sem
  notificar retroativamente).
- **Notificados:** o próprio professor, os Coordenadores da etapa e os Diretores.
- O sininho do menu se chama **Notificações**: junta os avisos de entrega e as solicitações de cadastro,
  com contador de não lidas.

**Grade horária:** montada pela Coordenação (na sua etapa), Secretaria e Direção, com trava em cascata. Só
aceita professor com vínculo na turma e disciplina, sem sobreposição na turma nem do mesmo professor em duas
turmas. Cada versão vale "a partir de" uma data; a anterior termina na véspera. O professor vê *Meus
horários*; no dia, os horários previstos ainda sem bloco aparecem com o botão "Planejar este horário".

**Etiqueta "Atrasado" (§8.3, Fase 5):** vermelha, ao lado do nome do professor no resumo do período da semana
e em cada bloco do dia. Aparece quando a entrega saiu com atraso ou quando o prazo venceu sem entrega. É só uma
leitura de `entregas` + `periodos_entrega` (`src/features/planejamentos/atraso.tsx`); todos que veem a turma veem
as entregas dela (política de leitura de `entregas`: o próprio professor ou `pode_ver_turma`).

### 3.3.1 Banco de atividades

```sql
atividades        (id, bloco_id, etapa_id, disciplina_id, titulo, tema, arquivo_caminho, arquivo_nome,
                   arquivo_tipo, arquivo_tamanho, status, proposta_por, proposta_em,
                   avaliada_por, avaliada_em, motivo_recusa)
                  -- status: 'pendente' | 'aprovada' | 'recusada'
storage: bucket privado "atividades", caminho <id do professor>/<nome único>
```

Decisões de 25/11/2026 (D4):

- O professor anexa arquivos nas **Atividades Propostas** do próprio bloco, com título e sugestão de tema.
  Tipos: PDF, Word, imagens, apresentações e planilhas (até 20 MB); áudio e vídeo curtos (até 50 MB).
- A atividade fica **pendente** até a Coordenação da etapa, a Secretaria ou a Direção **aprovar** (podendo
  ajustar título e tema) ou **recusar** (motivo obrigatório). A Coordenação da etapa é notificada do envio
  (se a etapa não tiver Coordenação, a Secretaria); o professor é notificado do resultado.
- Aprovada, entra no banco da **etapa**: pastas por **disciplina → tema**, com busca (título, tema,
  disciplina, arquivo e professor). Professores e Coordenação da etapa, Secretaria e Direção veem e baixam.
- Download por link temporário (10 min). Professor remove os próprios anexos enquanto não aprovados; quem
  aprova remove qualquer um da etapa.

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

## 5. Salvamento e modo offline (§7) — implementado na Fase 3

```
digitação ──► fila no navegador (IndexedDB) ──(1,5 s sem digitar)──► salvar_bloco no servidor
                     │                                                     │
                     │                                   confirmado: sai da fila só o que foi enviado
                     │                                   sem conexão: fica na fila
                     ▼                                   erro de regra: fica marcado (não reenvia sozinho)
   envio automático: ao abrir o sistema, quando a conexão volta, ao voltar para a aba e a cada 30 s
```

- **Fila** (`src/lib/offline/`): toda alteração vai **primeiro** para o IndexedDB, por usuário × bloco,
  acumulando os campos. Sobrevive a fechar a aba, travar o navegador ou cair a internet. O que é digitado
  durante um envio continua na fila. Nunca há dois envios do mesmo bloco ao mesmo tempo.
- **Ao reabrir:** o editor mostra o que está no servidor com as alterações da fila por cima, e a fila é
  enviada sozinha, mesmo que o professor não volte àquele planejamento.
- **Avisos:** faixa fixa no topo — "Você está offline. As alterações podem não ter sido salvas." (ou "Sem
  conexão com o servidor", quando os envios falham com o computador online), "Enviando N alterações
  guardadas…" e, para erros de regra (ex.: bloco arquivado), "Ver o que foi digitado" / "Descartar".
  Indicador por bloco: *Guardado neste navegador — enviando…*, *Sem conexão*, *Salvo às …*.
- **Botão Salvar** força o envio imediato.
- **Conflito:** cada envio leva a última versão confirmada; se o servidor tiver outra, a alteração é
  gravada mesmo assim (*last write wins*), o usuário vê um aviso e a versão anterior fica no histórico.
- **Abrir sem internet:** o app fica guardado no navegador (service worker, `vite-plugin-pwa`, só no
  build de produção) e as consultas já feitas ficam numa cópia local (IndexedDB, 7 dias). Com internet,
  a página do dia espera os dados atuais do servidor por até 4 s antes de usar a cópia local; consultas
  desistem depois de 12 s sem resposta.
- **Sair da conta:** se houver alterações não enviadas, o sistema avisa; elas continuam guardadas
  (separadas por usuário) e são enviadas quando a pessoa entrar de novo **no mesmo navegador**. A cópia
  local dos dados é apagada ao sair.

---

## 6. Rotinas agendadas e e-mails (§8) — implementado na Fase 5

Todo dia às 7h (11:00 UTC) um job `pg_cron` (`rotina-diaria`, migração `20261205000100_agendamento.sql`) faz
um `net.http_post` para a Edge Function `rotina-diaria`, com o cabeçalho `x-segredo-rotina`. A URL e o segredo
ficam no Vault (`url_rotina_diaria`, `segredo_rotina_diaria`); sem eles, o job não chama nada.

1. A função chama `preparar_envios()` (só `service_role`), que enfileira em `emails` e em `notificacoes`:
   - **Lembretes** ao professor nos dias configurados antes do prazo (`config_notificacoes.lembrete_dias`,
     padrão 3 dias antes e no dia), um e-mail por professor e período listando as turmas ainda não entregues.
   - **Alerta à Coordenação** da etapa (sem Coordenação, à Secretaria) para cada turma não entregue:
     "TURMA [X] DE PROFESSOR [Y] – PLANEJAMENTO NÃO IDENTIFICADO". Sai no dia seguinte ao prazo; se a rotina
     falhar, recupera prazos vencidos há até 7 dias.
   - Cada envio tem uma `chave` única: rodar duas vezes no mesmo dia não duplica nada.
2. Envia o que está pendente (e tenta de novo até 3 vezes o que falhou): pelo **Resend** se houver
   `RESEND_API_KEY`; pelo **Mailpit** no ambiente local (`MAILPIT_URL`); sem nenhum, marca como "simulado".

Em *Prazos e ciclos > E-mails automáticos* a Direção e a Secretaria ligam/desligam os e-mails, escolhem os dias
de lembrete e o alerta, veem os últimos 50 e-mails e podem rodar a rotina na hora ("Enviar agora", que chama a
mesma função com o login do usuário; só Direção, Secretaria e Administração).

---

## 7. Exportação (PDF e Word) — implementado na Fase 4

Formato baseado nos modelos da escola (`PLANO 24 a 28 de agosto.docx`, `PL 24 08 a 04 09.docx`):
A4 deitada, logotipo, "PLANEJAMENTO DE AULA", turma e período; **uma tabela por dia e turno** com as colunas
Data · Conteúdo · Objetivos de aprendizagem (Habilidades) · Estratégias de Ensino · Atividades propostas ·
Avaliação · Recursos — e, só na Educação Infantil, uma 8ª coluna **Linguagens do Amor**.

| Documento | Conteúdo | Quem | Formatos |
|---|---|---|---|
| Planejamento do período | Blocos de todos os professores da turma + momentos de rotina da grade (Lanche, Saída…) + aulas da grade ainda sem planejamento ("-") + dias sem aula; período = semana, período de entrega ou datas escolhidas | quem vê a turma | PDF, Word |
| Conteúdo programático | Conteúdo e Objetivos por disciplina, mensal, bimestral (mês escolhido + seguinte) ou datas; **inclui planejamentos "excluídos"** na remoção de professor | Gestão (turmas do escopo) | PDF, Word |
| Relatório de entregas | Por professor, em ordem alfabética: com antecedência, no prazo, com atraso e não entregues (prazo vencido sem entrega), para os prazos de um intervalo | Coordenação (etapa), Secretaria, Direção, Admin | PDF |

- Os dados vêm das tabelas (respeitando a RLS) e de duas funções do servidor, `conteudo_programatico`
  e `relatorio_entregas`, que precisam ver os blocos "excluídos" e calcular os não entregues.
- Um modelo intermediário único (`src/features/exportacao/modelo.ts`) é desenhado em PDF (`pdfmake`) e Word
  (`docx`), então os dois formatos saem iguais. As bibliotecas são carregadas só na hora de exportar.
- O logotipo oficial foi extraído dos modelos (`public/logo-tom-da-vida.png`).
- No PDF, setas e emojis (sem desenho na fonte) viram equivalentes em texto; o Word mantém o original.

### Grade, disciplinas e prazos (decisões de 25/11/2026)

- **Momentos de rotina na grade** (Lanche, Almoço, Parque, Saída…): horário sem professor (`horarios.rotulo`).
  Aparecem no arquivo exportado; não contam para a entrega.
- **Programa Bilíngue e Robótica** são dados por professores do sistema: viraram disciplinas. A Direção e a
  Secretaria cadastram e renomeiam disciplinas na tela Turmas.
- **Prazos por etapa:** cada período de entrega pertence a uma etapa (`periodos_entrega.etapa_id`; vazio =
  todas). Períodos de etapas diferentes podem coincidir; a entrega usa o período da etapa da turma.

### Fuso horário

A escola fica em **Campo Grande (MS), UTC-4**. Todas as contas de data no banco usam `public.fuso_escola()`
(`America/Campo_Grande`): data da entrega, prazos vencidos e datas nas mensagens. Antes da Fase 4 estava
`America/Sao_Paulo` (UTC-3), o que fazia uma entrega às 23h30 contar como do dia seguinte.

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
| **0. Fundação** ✅ | TypeScript, rotas, Supabase local, migrações iniciais, extração do protótipo em componentes *(deploy de staging pendente)* | — |
| **1. Acesso e hierarquia** ✅ | Cadastro, aprovação, papéis, vínculos, travas, modal de confirmação, log de auditoria, reset de senha | §2–5, §11 |
| **2. Turmas e planejamentos** ✅ | Turmas, editor de planejamento com blocos, status, Linguagem do Amor, notas, histórico | §6, §6.2, §6.3 |
| **3. Salvamento à prova de falhas** ✅ | Fila offline, banner, indicador de salvamento, conflito | §7 |
| **4. Exportação e relatórios** ✅ | PDF/Word do planejamento, conteúdo programático, relatório de entregas | §6.1, §9 |
| **5. Prazos e e-mails** ✅ | Configuração global, períodos, rotina diária, lembretes, etiqueta de atraso, alerta ao Coordenador | §8 |
| **6. Universidade Corporativa** | Trilhas, aulas, upload de vídeo, desbloqueio sequencial, obrigatoriedades, painel de auditoria | §10 |

Fases 1–3 formam o **MVP**: professores já podem planejar com segurança. A fase 3 pode ser
desenvolvida junto da 2, já que o editor nasce usando a fila offline.

---

## 11. Decisões em aberto

Pontos em que a especificação é ambígua ou o protótipo diverge dela. Precisam de resposta antes
da fase indicada.

| # | Pergunta | Proposta | Fase |
|---|---|---|---|
| D1 | O status (cinza/amarelo/verde) é do planejamento inteiro ou de cada bloco? Com Regente e especialistas no mesmo dia, cada um precisa marcar o seu. | ✅ **Decidido:** status por bloco; o status do dia é derivado (verde só quando todos os blocos estão verdes) | 2 |
| D2 | O que conta como "entregue" para o prazo? | ✅ **Decidido:** o período conta como entregue quando o professor conclui todos os dias dele na turma (Regente: todos os dias úteis; especialista: todos os blocos que criou). Ver §3.3 | 5 |
| D3 | O protótipo tem **prazos por etapa/turma com dois modos**; a v2 diz que o prazo é **global**. Qual vale? | ✅ **Decidido:** global para a escola, com cada período (início, fim, data-limite) cadastrado pela Direção ou Secretaria | 5 |
| D4 | O protótipo tem um **Banco de Atividades** (aprovação de atividades por tema) que não existe na v2. Continua no escopo? | ✅ **Decidido:** continua, com anexos aprovados pela coordenação e pastas disciplina → tema (ver §3.3.1) e a aba *Planejamentos arquivados* (D6) | 2 |
| D5 | Turno pertence à turma (como no protótipo) ou ao planejamento (como na v2: Data + Turno)? | ✅ **Decidido:** ao planejamento, com turno padrão vindo da turma | 2 |
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
