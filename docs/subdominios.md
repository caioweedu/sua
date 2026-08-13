# Subdomínios por filha (multi-tenant)

A plataforma resolve o tenant pelo **host** da requisição (`src/lib/tenant.ts`):

1. **Domínio próprio** — se o host bate com `Tenant.customDomain`, usa esse tenant.
2. **Subdomínio** — se o host é `<slug>.ROOT_DOMAIN`, resolve pelo `Tenant.slug`.
3. **Cookie de preview** — `tenant_override` (atalho enquanto o DNS não existe).
4. **Fallback** — tenant mãe (`type = MOTHER`).

Estrutura escolhida (produção):

- **Raiz:** `educacao.weedu.com.br` → tenant **mãe** (Weedu)
- **Filhas:** `<slug>.educacao.weedu.com.br` (ex.: `acme.educacao.weedu.com.br`)
- **Wildcard** cobre todas as filhas sem mexer no DNS a cada nova empresa.

## Passo a passo

### 1. Variável de ambiente (Vercel)

Em **Settings › Environment Variables**, defina (Production, e pode Preview também):

```
ROOT_DOMAIN=educacao.weedu.com.br
```

> Sem porta e sem `https://`. É só o domínio.

### 2. Domínios na Vercel

Em **Settings › Domains**, adicione **dois**:

- `educacao.weedu.com.br` (a mãe)
- `*.educacao.weedu.com.br` (wildcard das filhas)

A Vercel mostra a configuração de DNS necessária para cada um.

### 3. DNS

> ⚠️ **Wildcard + SSL:** a Vercel só emite o certificado do wildcard
> (`*.educacao...`) automaticamente quando **gerencia o DNS desse subdomínio**.
> Como o `weedu.com.br` principal (site/e-mail) deve continuar onde está, a
> forma limpa é **delegar apenas o subdomínio `educacao`** para a Vercel, sem
> tocar no resto do domínio.

**Opção A — Delegar o subdomínio `educacao` (recomendada p/ wildcard):**
No DNS atual do `weedu.com.br`, crie registros **NS** para o rótulo `educacao`
apontando para os nameservers que a Vercel indicar (algo como
`ns1.vercel-dns.com` / `ns2.vercel-dns.com`). A partir daí a Vercel gerencia
`educacao.weedu.com.br` e `*.educacao.weedu.com.br`, incluindo o certificado
wildcard. O restante do `weedu.com.br` fica intacto.

**Opção B — Sem wildcard, um subdomínio por filha (sem mexer em nameserver):**
Para cada filha, adicione na Vercel `slug.educacao.weedu.com.br` e crie no DNS
um **CNAME** `slug.educacao` → `cname.vercel-dns.com`. Aqui o certificado é por
subdomínio (HTTP-01), então **não precisa** delegar nameservers. Mais trabalho a
cada filha, mas não altera a configuração do domínio principal.

### 4. Cadastro das filhas

O jeito recomendado é pela **UI de admin** (logado como **SUPER_ADMIN**, seção
**Filhas / white-label** em `/admin` → `createDaughter`). Você informa:

- **Nome** da filha
- **slug** — **igual** ao subdomínio (ex.: slug `acme` → `acme.educacao.weedu.com.br`)
- **e-mail + senha** do admin da filha (vira um `TENANT_ADMIN`)
- cor da marca / (opcional) `customDomain`

Isso cria um `Tenant` com `type = DAUGHTER`, `parentId` = mãe e o usuário admin.
O tenant precisa estar **`active = true`** (padrão; a edição tem o toggle). Feito
isso, acessar `acme.educacao.weedu.com.br` já cai no tenant certo.

> Alguns slugs são reservados (`RESERVED_SLUGS`) e são rejeitados.

## Teste rápido (antes do DNS)

Dá para validar a resolução por filha **sem DNS** usando o override por
querystring: acesse qualquer URL com **`?tenant=<slug>`** (ex.:
`https://sua-nine.vercel.app/?tenant=acme`). O middleware grava o slug num
cookie (válido 1 dia) e o app passa a responder como aquela filha. Para voltar
à mãe, acesse com **`?tenant=`** (vazio). Serve para o piloto interno enquanto o
wildcard não está no ar.
