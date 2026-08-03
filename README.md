# Sua — Plataforma de Treinamentos (white-label)

Universidade corporativa **white-label** da Weedu: uma plataforma mãe que
gerencia várias "filhas" (clientes), cada uma com sua marca e domínio próprio.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Prisma ·
**PostgreSQL** · IA da Anthropic (professor virtual).

## Funcionalidades

- 🏢 **Multi-tenant mãe/filha** — marca própria (cor, logo) e domínio
  personalizado por universidade; a mãe cria e gerencia as filhas.
- 🎬 **Trilhas e aulas** — player de vídeo por link (YouTube, Vimeo, Panda...)
  com trilha lateral navegável + anexo de PDF.
- 📝 **Provas com banco de questões e sorteio** — cadastra-se, por exemplo, 20
  questões e o sistema sorteia 6 por tentativa; correção automática.
- 🏆 **Certificados** — emitidos ao aprovar, personalizáveis por cliente (fundo,
  logo, assinatura), com código público de validação.
- 🤖 **Professor virtual com IA** — tutor conversacional (Claude) que responde
  dúvidas restrito ao conteúdo da trilha, com respostas em streaming.
- 🔐 **Autenticação** por e-mail/senha com sessão em cookie assinado (JWT).
- 🛠️ **Painel administrativo** — criar trilhas, aulas, provas, questões, filhas
  e configurar a identidade visual.

### Próximas fases (roadmap)

- 🗺️ Processos das empresas com procedimentos/treinamentos por etapa.
- 💳 Integração de pagamentos e controle de acesso pago.
- 📊 Relatórios avançados de engajamento e aprovação.

---

## Rodar localmente

Pré-requisitos: **Node 18+** e um **PostgreSQL** (local ou na nuvem).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
#   Edite o .env: DATABASE_URL e DIRECT_URL apontando para seu Postgres,
#   AUTH_SECRET (gere um valor forte) e, se quiser o professor virtual,
#   ANTHROPIC_API_KEY.

# 3. Aplicar as migrations e popular com dados de demonstração
npm run db:deploy   # cria as tabelas
npm run db:seed     # popula trilhas e usuários de teste

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

---

## 🚀 Deploy em produção (Vercel + Neon)

Arquitetura recomendada para escala: **Vercel** (app Next.js, auto-escala,
domínios personalizados por tenant) + **Neon** (PostgreSQL serverless).

### 1. Banco no Neon

1. Crie uma conta em [neon.tech](https://neon.tech) e um projeto/banco.
2. Copie **duas** connection strings do painel do Neon:
   - **Pooled connection** (host com `-pooler`) → será a `DATABASE_URL`.
   - **Direct connection** → será a `DIRECT_URL`.

### 2. App na Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o
   repositório `caioweedu/sua`, branch de deploy.
2. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | string *pooled* do Neon |
   | `DIRECT_URL` | string *direct* do Neon |
   | `AUTH_SECRET` | um segredo forte (`openssl rand -base64 32`) |
   | `ANTHROPIC_API_KEY` | sua chave da Anthropic (professor virtual) |
   | `PROFESSOR_MODEL` | `claude-opus-5` (ou `claude-sonnet-5` / `claude-haiku-4-5`) |
   | `ROOT_DOMAIN` | seu domínio (ex.: `sua.weedu.com.br`) |
   | `SEED_SECRET` | um segredo temporário para popular o banco |

3. **Deploy.** O build roda `prisma migrate deploy` automaticamente e cria as
   tabelas no Neon.

### 3. Popular o banco (uma vez)

Abra no navegador:

```
https://SEU-APP.vercel.app/api/seed?secret=SEU_SEED_SECRET
```

Isso cria os usuários e trilhas de demonstração. Depois, **remova a variável
`SEED_SECRET`** na Vercel para desativar a rota.

### 4. Domínios personalizados (white-label)

Para cada universidade (mãe e filhas), adicione o domínio em **Vercel →
Settings → Domains** e cadastre o mesmo domínio no campo "domínio
personalizado" da filha, dentro do painel de Administração. A resolução de
tenant por domínio já está implementada em `src/lib/tenant.ts`.

---

## Estrutura

```
prisma/schema.prisma      Modelo de dados multi-tenant (PostgreSQL)
prisma/migrations/        Migrations versionadas
prisma/seed.ts            Script de seed (usa src/lib/seedData.ts)
src/lib/                  db, auth, sessão, tenant, professor (IA), seed, cover
src/app/                  páginas + rotas de API (professor, seed)
src/components/           componentes compartilhados (cards, chat, shell)
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento |
| `npm run build` | `prisma generate` + `migrate deploy` + build |
| `npm run db:migrate` | cria/aplica migration em desenvolvimento |
| `npm run db:deploy` | aplica migrations pendentes (produção) |
| `npm run db:seed` | popula dados de demonstração |
| `npm run db:studio` | abre o Prisma Studio (inspeção do banco) |
