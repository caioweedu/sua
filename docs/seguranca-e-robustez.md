# Segurança & Robustez — gate de pré-lançamento

Checklist operacional antes de colocar dados reais. Dividido em **leve** (antes
do piloto interno) e **completo** (antes da virada definitiva com clientes).

## Já implementado no código

- **Health check** `GET /api/health` — retorna `200` (app + banco ok) ou `503`
  (banco fora). Use num monitor de uptime (UptimeRobot, BetterStack, Pingdom).
  Não expõe dados.
- **Headers de segurança** (`next.config.mjs`): `X-Content-Type-Options`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Strict-Transport-Security`
  (HSTS) e `Permissions-Policy` restritiva. CSP ficou de fora por ora para não
  quebrar os embeds de vídeo — é o próximo passo, testado com cuidado.
- **Keep-alive do banco** `GET /api/keep-alive` (cron) — evita cold start do Neon.
- **Isolamento por tenant**: leituras/escritas escopadas ao tenant do usuário;
  impersonação de filha só para SUPER_ADMIN sobre filhas próprias.
- **Monitoramento de erros (Sentry)**: integrado no código (server + client +
  erros de request). Ativa automaticamente quando `NEXT_PUBLIC_SENTRY_DSN`
  estiver definido na Vercel — sem o DSN, fica desligado. Source maps
  (opcional) exigem `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_AUTH_TOKEN`.

## Gate LEVE — antes do piloto interno

- [ ] **Backup do banco (Neon)**: confirmar o *point-in-time restore* do plano
      atual e **testar uma restauração** numa branch do Neon. Se o plano não
      cobrir o retention desejado, avaliar upgrade ou export periódico (`pg_dump`).
- [ ] **Monitor de uptime** apontando para `/api/health` (alerta por e-mail).
- [x] **Monitoramento de erros (Sentry)**: integrado e **validado em produção**
      (evento de teste confirmado no painel). `NEXT_PUBLIC_SENTRY_DSN` definido
      na Vercel. Rota de teste removida após a validação.
- [ ] **Revisão de variáveis de ambiente** na Vercel: `AUTH_SECRET` forte,
      `SEED_SECRET` vazio em produção (desativa `/api/seed`), chaves do Resend e
      da Anthropic corretas.

## Gate COMPLETO — antes da virada definitiva (clientes reais)

- [ ] **Revisão de segurança**: reforçar isolamento entre tenants (testes de
      acesso cruzado), rate-limiting em login/rotas sensíveis, verificação de
      autorização nas server actions.
- [ ] **CSP** (Content-Security-Policy) testada com os embeds de vídeo.
- [ ] **LGPD**: página de termos e privacidade, consentimento no cadastro/
      importação, política de retenção e processo de exclusão de dados.
- [ ] **Backups automáticos verificados** + runbook de restauração.
- [ ] **Teste de carga** com volume real de alunos (limites do Neon/Vercel).
- [ ] **2FA/senha forte** para admins (opcional, recomendável).

## Observações

- `SEED_SECRET` **precisa** ficar vazio em produção após popular — senão a rota
  `/api/seed` fica exposta.
- HSTS com `includeSubDomains` vale para todos os subdomínios de `weedu.com.br`
  quando o DNS apontar para cá — todos servidos em HTTPS pela Vercel.
