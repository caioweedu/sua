# Roadmap — Plataforma de Treinamento (Weedu)

Atualizado em 18/08/2026.

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
- [x] **Fatia 6 — Níveis temáticos + arte de boton.** 20 níveis nomeados
      (jornada de gestão de resultados) com cor própria; ícone/arte personalizada
      por nível (PNG/SVG), exibida redonda (formato de boton), com fallback para
      o emoji. Upload pela interface em `/admin/niveis` (SUPER_ADMIN, arte global
      da Weedu herdada pelas filhas) + guia de tamanhos/formatos e HEX das cores.
- [x] **Fatia 7 — Gate por nível.** A gamificação passa a **destravar conteúdo**:
      novo requisito `AFTER_LEVEL` no motor de liberação (E/OU) — vitrine,
      produto, módulo, prova e certificado podem exigir um nível mínimo.

**Onda 2 concluída.** Evolução futura (backlog): ajuste de pontos por filha,
painel de engajamento, badges personalizadas pelo admin, exportar a paleta dos
20 níveis (CSV/PDF) para briefing de arte, e um exemplo de gate por nível no
seed de demonstração.

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

## 🏢 Onda 3 — Gestão de Equipes & RH (nova frente)
Transforma a plataforma de "cursos para alunos" em "gestão de treinamento de um
time". Hoje sabemos **o que a pessoa vê** (perfil de acesso) e **como ela
progride** (matrículas, provas, certificados, XP); falta a camada de **quem é
quem na empresa** — a quem a pessoa pertence e quem a acompanha.

**Duas dimensões ortogonais (não se misturam):**
- **Perfil de acesso** (já existe) = *o que a pessoa vê* (conteúdo).
- **Equipe / organograma** (novo) = *a quem pertence e quem a acompanha* (RH,
  gestor, supervisor). Cada pessoa tem os dois.

### 🎯 Diferencial (posicionamento)
Não competir como "mais um LMS". Duas apostas, ancoradas no que já temos:

1. **Universidade corporativa como MOTOR (engine) white-label — modelo B2B2B /
   OEM.** Já somos multi-tenant white-label por subdomínio — então o modelo
   "parceiro" vira produto de primeira classe: um parceiro (ex.: uma Solidés,
   uma consultoria de RH, uma software house) oferece a solução de universidade
   corporativa **da marca dele** aos **clientes corporativos dele**, usando a
   nossa plataforma como engine. É **revenda de plataforma (B2B2B)**, não de
   curso (B2B2C). Estrutura: um **nível de parceiro** na árvore — Weedu ▸
   Parceiro ▸ empresas-cliente do parceiro — com painel do parceiro (ele
   gerencia seus próprios clientes), conteúdo liberado de cima para baixo, RH
   por cliente e — na evolução — **API/embed + SSO** para plugar no produto do
   parceiro. Comercialmente, esta é a **fase 13 (engine B2B2B)** do plano.
2. **Matriz de Competências viva + prova de impacto.** O mercado (WEF Future of
   Jobs 2025: ~39% das competências mudam até 2030) corre para *skills-based
   learning*. Poucas ferramentas de PME no Brasil fazem bem. Mapear
   treinamento → competência → expectativa por equipe/cargo dá ao RH uma visão
   de **lacunas de competência por time** (não só "% concluído") e, com o
   professor de IA que já temos, **recomendação de trilha pela lacuna**.

Referências de mercado (RH/UC bem estruturada): CYPHER Learning (multi-tenant +
analytics por portal), D2L Brightspace (white-label + integrações Workday/ADP/
BambooHR/SuccessFactors), Cornerstone (compliance + skill gaps), Absorb,
iSpring. Boas práticas: níveis de proficiência ancorados em comportamento
observável e modelo de maturidade de analytics (ligar treino a competência →
fechar lacuna → provar ROI ligando a KPIs de negócio).

### Modelo de dados (aditivo, sem quebrar nada)
- `Team` — unidade organizacional em **árvore** via `parentId` (Departamento ▸
  Setor ▸ Turma), por tenant.
- `TeamLead` — liderança (`userId`, `teamId`, `role` MANAGER | SUPERVISOR).
- `User.teamId` — a qual equipe a pessoa pertence (nulo = sem equipe).

### Fatias
- [x] **F0 — Fundação (organograma).** `Team`/`TeamLead`/`User.teamId` +
      `/admin/equipes` (montar a árvore, definir gestor/supervisor, alocar
      pessoas) + seletor de equipe na edição do aluno. Migração aditiva, sem
      risco. **Entregue** — começa a acumular o organograma desde já.
- [ ] **F1 — Cockpit do RH.** Papel **RH** + visão empresa e por-equipe
      (drill-down na árvore), com métricas de adesão/conclusão/aprovação e
      certificados, só leitura, reusando o analytics atual.
- [ ] **F2 — Gestor & Supervisor (painel de acompanhamento).** Dashboard do
      líder com **métricas da equipe**: avanço nas trilhas, conclusão/aprovação,
      **ranking da equipe** e pendências — foco em acompanhar o desenvolvimento
      do time, não só listar pessoas. **Escopo de visibilidade (segurança da
      informação, alinhado à LGPD), aplicado no backend:** o **gestor** vê a sua
      equipe e toda a subárvore abaixo; o **supervisor** vê apenas a própria
      equipe. Ninguém enxerga dados fora do seu escopo. Requisito reforçado pelo
      teste da F0.
- [ ] **F3 — Competências & compliance.** Matriz de competências (treino →
      competência → expectativa por equipe/cargo), lacunas por time,
      treinamentos obrigatórios com prazo, lista de atrasados, exportação, e
      (com a Fase 6) lembretes automáticos.
- [ ] **F4 — Ações de gestão.** Matrícula em massa por equipe, metas por time e
      recomendação de trilha por lacuna (IA). Guiada por um cliente-piloto. (O
      motor white-label para parceiros — API/embed + SSO + camada de parceiro —
      é a **fase 13, engine B2B2B**, tratada como frente comercial à parte.)

**Ordem sugerida:** F0 pode entrar cedo (feito); F1–F3 na pós-virada, de
preferência construídas junto de um cliente-piloto de RH.

## 🚀 Onda 3 — Pós-virada (outros itens de backlog)
Migração da Cademi, WhatsApp (Fase 6 — aguarda templates no Twilio), PWA/app,
SSO, relatórios avançados, e o que o piloto revelar como prioridade.

---
Este arquivo é a fonte de verdade do plano. O roadmap visual (artifact) pode ser
regenerado a partir daqui quando quiser.
