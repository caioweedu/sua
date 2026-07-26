# Sua — Plataforma de Treinamentos (white-label)

Universidade corporativa **white-label** da Weedu: uma plataforma mãe que
gerencia várias "filhas" (clientes), cada uma com sua marca e domínio próprio.

MVP construído com **Next.js 15 (App Router) + TypeScript + Tailwind + Prisma**.

## Funcionalidades do MVP

- 🏢 **Multi-tenant mãe/filha** — cada universidade tem marca (cor, logo) e pode
  ter domínio personalizado; a mãe cria e gerencia as filhas.
- 🎬 **Trilhas e aulas** — vídeos por link (YouTube, Vimeo, Panda...) + anexo de PDF.
- 📝 **Provas com banco de questões e sorteio** — cadastra-se, por exemplo, 20
  questões e o sistema sorteia 6 a cada tentativa; correção automática.
- 🏆 **Certificados** — emitidos ao aprovar na prova, personalizáveis por cliente
  (fundo, logo, assinatura), com código público de validação.
- 🔐 **Autenticação** por e-mail/senha com sessão em cookie assinado (JWT).
- 🛠️ **Painel administrativo** — criar trilhas, aulas, provas, questões, filhas e
  configurar a identidade visual.

### Próximas fases (roadmap)

- 🤖 Professor virtual com IA (Claude) que responde dúvidas sobre o conteúdo.
- 🗺️ Processos das empresas com procedimentos/treinamentos vinculados a cada etapa.
- 💳 Integração de pagamentos e controle de acesso.
- 📊 Relatórios avançados de engajamento e aprovação.

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente (copie e ajuste se quiser)
cp .env.example .env

# 3. Criar o banco (SQLite) e popular com dados de demonstração
npm run db:push
npm run db:seed

# 4. Subir em desenvolvimento
npm run dev
```

Acesse http://localhost:3000

### Usuários de demonstração

| Papel | E-mail | Senha |
|---|---|---|
| Super admin (mãe Weedu) | `admin@weedu.com.br` | `weedu123` |
| Aluno (mãe Weedu) | `aluno@weedu.com.br` | `aluno123` |
| Admin (filha Demo) | `admin@clientedemo.com` | `cliente123` |

> Entre como **aluno** para assistir à trilha e fazer a prova (veja o sorteio de
> 6 questões dentre as 20). Entre como **super admin** para gerenciar trilhas,
> questões, identidade visual e criar filhas white-label.

## Multi-tenant: como o tenant é resolvido

O tenant é identificado pelo host da requisição (`src/lib/tenant.ts`):

1. **Domínio próprio** cadastrado na filha (ex.: `universidade.cliente.com.br`);
2. **Subdomínio** `<slug>.SEU_DOMINIO` (ex.: `cliente-demo.suaplataforma.com`);
3. **Fallback**: tenant mãe.

Em `localhost` você sempre cai na mãe. Para testar uma filha localmente, use um
host como `cliente-demo.localhost:3000` (ajuste `ROOT_DOMAIN` no `.env`).

## Migrar para produção (PostgreSQL)

1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `"postgresql"`.
2. Ajuste `DATABASE_URL` no `.env` para a string do Postgres.
3. Rode `npx prisma migrate dev`.

## Estrutura

```
prisma/schema.prisma      Modelo de dados multi-tenant
prisma/seed.ts            Dados de demonstração
src/lib/                  db, auth, sessão, tenant, vídeo, server actions
src/app/                  páginas (login, dashboard, trilhas, prova, certificado, admin)
src/components/           componentes compartilhados
```
