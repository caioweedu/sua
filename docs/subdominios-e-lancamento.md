# Subdomínios por universidade & checklist de lançamento

Como cada universidade (mãe/filha) é acessada por um endereço próprio, e o que
precisa ser feito no dia de apontar o DNS da Cademi para cá.

## Como o sistema decide qual universidade abrir

A resolução acontece em `src/lib/tenant.ts` (`resolveTenant`), nesta ordem:

1. **Domínio próprio** (`customDomain`) — se o host bate com o campo `customDomain`
   de uma universidade, abre ela. Ex.: `treinamentos.clientex.com.br`.
2. **Subdomínio** `<slug>.ROOT_DOMAIN` — resolve pela `slug` da universidade.
   Ex.: com `ROOT_DOMAIN=weedu.com.br`, `empresafilha.weedu.com.br` → filha de
   slug `empresafilha`.
3. **Impersonação/preview** (`?tenant=slug`, só para a Weedu) — atalho de teste
   sem DNS.
4. **Fallback** → universidade **mãe** (a Weedu).

> `sua.weedu.com.br` e o domínio apex (`weedu.com.br`, `www…`) caem no **fallback**,
> ou seja, abrem a **mãe** — desde que nenhuma filha use esses `slugs`. Por isso
> `sua`, `www`, `weedu`, etc. são **slugs reservados** (bloqueados na criação de
> filha em `src/lib/actions/admin.ts`).

## Configuração para o lançamento (quando sair da Cademi)

Nada disso precisa ser feito agora — só no dia da virada.

### 1. Vercel — domínios
No projeto da Vercel, em **Settings → Domains**, adicionar:
- `weedu.com.br` (apex) e `www.weedu.com.br` → abrem a mãe.
- **Wildcard** `*.weedu.com.br` → cobre todas as filhas (`empresafilha.weedu.com.br`).
- `sua.weedu.com.br` → mãe (pode ser adicionado explicitamente).

### 2. DNS (onde o `weedu.com.br` é gerenciado)
Seguir exatamente o que a Vercel indicar ao adicionar cada domínio. Em geral:
- Apex `weedu.com.br` → registro **A** para o IP da Vercel (ou ALIAS/ANAME).
- `www` e `*` (wildcard) → **CNAME** para `cname.vercel-dns.com`.
- ⚠️ Como hoje esses nomes apontam para a **Cademi**, a troca só deve ser feita
  na hora de migrar (a mudança de DNS leva alguns minutos a horas para propagar).

### 3. Variável de ambiente
Na Vercel, **Settings → Environment Variables**:
```
ROOT_DOMAIN=weedu.com.br
```
Depois, **Redeploy** (variável só passa a valer num novo deploy).

### 4. Conferir os slugs
- A **mãe** tem slug `weedu` (banco). O endereço `sua.weedu.com.br` funciona via
  fallback; se quiser que resolva explicitamente, pode-se ajustar depois.
- Cada **filha** deve ter uma `slug` única e não reservada — é o subdomínio dela.

## Migração de conteúdo/alunos da Cademi (planejar antes)

Ponto mais sensível do lançamento — decidir e testar **antes**:
- **Conteúdo**: recriar/importar trilhas, módulos, aulas, provas e certificados
  (o import por planilha ajuda).
- **Alunos**: importar cadastros (nome, e-mail, telefone) e enviar convite/senha
  por e-mail (Resend).
- **Histórico** (progresso, conclusões, certificados já emitidos): definir se
  migra ou se recomeça. Migrar histórico é trabalho extra e precisa de export da
  Cademi.

## Checklist de virada (dia do lançamento)

1. [ ] Conteúdo e alunos já cadastrados/testados aqui.
2. [ ] Filhas criadas com slug = subdomínio; conteúdo liberado por filha.
3. [ ] `ROOT_DOMAIN=weedu.com.br` na Vercel + redeploy.
4. [ ] Domínios adicionados na Vercel (apex, www, wildcard).
5. [ ] E-mail (Resend) verificado e testado; templates de WhatsApp (se for usar).
6. [ ] Apontar o DNS da Cademi para a Vercel (apex + wildcard).
7. [ ] Testar: `sua.weedu.com.br` (mãe) e `empresafilha.weedu.com.br` (filha).
8. [ ] Backup do banco e monitoramento de erros ativos.
