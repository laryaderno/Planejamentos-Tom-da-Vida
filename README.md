# Planejamentos Tom da Vida

Sistema web de planejamento de aulas e Universidade Corporativa da Escola Tom da Vida.

- Especificação: *Especificação de Requisitos v2.0* (documento da escola)
- Arquitetura, modelo de dados e fases: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)

## Stack

React 19 + TypeScript + Vite · React Router · TanStack Query · Supabase (Postgres, Auth, RLS) · Vitest

## Rodando localmente

Requisitos: Node 20+ e, para o banco local, Docker Desktop aberto.

```bash
npm install
npm run dev          # http://localhost:5173
```

Sem banco configurado, o app roda com os dados de exemplo do protótipo e login simulado
(qualquer e-mail e senha entram como Administrador).

### Banco local (Supabase)

```bash
npm run db:start     # sobe Postgres, Auth e Studio em Docker; mostra URL e anon key
cp .env.example .env.local   # cole a anon key exibida
npm run db:reset     # recria o banco: aplica supabase/migrations e supabase/seed.sql
npm run db:types     # gera src/lib/database.types.ts a partir do banco
```

Studio (interface do banco): http://127.0.0.1:54323

Para criar o primeiro Administrador: cadastre um usuário em *Authentication* no Studio e rode no
*SQL Editor*:

```sql
update public.perfis set papel = 'administrador', status = 'ativo' where email = 'seu@email.com';
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verificação de tipos + build de produção em `dist/` |
| `npm run typecheck` | Só a verificação de tipos |
| `npm run lint` | Oxlint |
| `npm test` | Testes (front e regras do banco — os do banco rodam em Postgres em memória, sem Docker) |

## Estrutura

```
src/
  app/           rotas, layout (AppShell), navegação
  features/      uma pasta por módulo (auth, turmas, usuarios, prazos, relatorios...)
  components/    componentes compartilhados
  lib/           cliente Supabase, papéis e níveis hierárquicos
  mocks/         dados de exemplo do protótipo (saem a partir da Fase 1)
  styles/        paleta e CSS global
supabase/
  migrations/    SQL versionado: tabelas, RLS, gatilhos
  seed.sql       etapas, disciplinas e turmas de exemplo
  tests/         testes das regras do banco
```
