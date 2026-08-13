# Roadmap — Plataforma de Treinamento (Weedu)

Atualizado em 13/08/2026.

## ✅ Onda 1 — Plataforma base (concluída)
Multi-tenant mãe/filha, autenticação, trilhas/aulas/módulos, biblioteca de
provas + colocação, motor de liberação (E/OU), certificados, professor virtual
(IA), perfis de acesso, import por planilha, tema claro/escuro, upload de
imagens, e **white-label por subdomínio**.

## ✅ Soft launch interno (no ar)
- Subdomínio por filha: `<slug>.educacao.weedu.com.br` (CNAME na Vercel).
- Piloto interno: `piloto.educacao.weedu.com.br` (filha `piloto`).
- **Gate leve de pré-lançamento concluído** (ver `docs/seguranca-e-robustez.md`):
  health check, headers de segurança, Sentry validado, backup Neon validado,
  `/api/seed` desativado.

Pendências operacionais (painel, não código): rotacionar `AUTH_SECRET` e
`RESEND_API_KEY` (foram expostos em prints), remover `SENTRY_TEST_ENABLED`,
plugar um monitor de uptime em `/api/health`.

## 🎮 Onda 2 — Gamificação (em andamento)
- [x] **Fatia 1 — XP + níveis.** Aula +10, prova +50, certificado +100; nível
      derivado do XP; card de progresso no dashboard do aluno.
- [x] **Fatia 2 — Conquistas (badges).** 6 badges (primeira aula, maratonista,
      primeira trilha, colecionador, gabaritou, nível 5); concessão automática
      idempotente e vitrine de conquistas no dashboard.
- [x] **Fatia 3 — Ofensiva (streak).** Dias consecutivos de estudo (fuso de
      Brasília), card no dashboard e badge 🔥 por 7 dias seguidos.
- [x] **Fatia 4 — Ranking.** Placar por filha (por XP), com pódio e a posição do
      próprio aluno; configurável por filha (privacidade).
- [x] **Fatia 5 — Admin da gamificação.** Toggles no admin para ligar/desligar
      gamificação e ranking por filha.

**Onda 2 concluída.** Evolução futura (backlog): ajuste de pontos por filha,
painel de engajamento, badges personalizadas pelo admin.

## 🔒 Gate COMPLETO — antes da virada com clientes reais
Pré-requisito para migrar da Cademi e receber dados de clientes de verdade.

- [ ] **Isolamento entre tenants (reforço):** testes automatizados de acesso
      cruzado (aluno da filha A não acessa nada da filha B); revisão de
      autorização em todas as server actions.
- [ ] **Rate limiting** em login e rotas sensíveis (força bruta / abuso).
- [ ] **LGPD:** páginas de Termos e Política de Privacidade; consentimento no
      cadastro e na importação; processo de exclusão/portabilidade de dados;
      política de retenção.
- [ ] **CSP** (Content-Security-Policy) testada com os embeds de vídeo.
- [ ] **Backups reforçados:** subir o Neon para retenção de ~7 dias (hoje 24h no
      Free) + runbook de restauração.
- [ ] **Teste de carga** com volume real de alunos (limites de Neon/Vercel).
- [ ] **2FA/senha forte** para admins (recomendável).
- [ ] **Rotação de segredos** e revisão final de variáveis de ambiente.

## 🚀 Onda 3 — Pós-virada (backlog)
Migração da Cademi, WhatsApp (Fase 6 — aguarda templates no Twilio), PWA/app,
SSO, relatórios avançados, e o que o piloto revelar como prioridade.

---
Este arquivo é a fonte de verdade do plano. O roadmap visual (artifact) pode ser
regenerado a partir daqui quando quiser.
