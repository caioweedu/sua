import "server-only";
import { prisma } from "./db";
import { contentTenantIds } from "./access";
import { loadComplianceItems, type ComplianceItem } from "./compliance";
import { sendEmail, emailConfigured } from "./email";

// Onda 3 · F3 — Notificações de vencimento de treinamentos obrigatórios.
// Rodado por cron (diário, dias úteis). Dois fluxos:
//  - Colaborador: e-mail nos marcos 30/7/1 dia antes do vencimento/prazo e um
//    aviso quando vence/atrasa. Cada marco só uma vez (NotificationLog).
//  - Gestor/RH: resumo semanal (às segundas) das pendências do seu escopo.
// Anti-spam: tudo deduplicado por (userId, key) no NotificationLog.

type Bucket = "d30" | "d7" | "d1" | "overdue";

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "";
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}
function bucketFor(target: Date, now: Date): Bucket | null {
  const d = daysUntil(target, now);
  if (d < 0) return "overdue";
  if (d <= 1) return "d1";
  if (d <= 7) return "d7";
  if (d <= 30) return "d30";
  return null;
}
// Semana ISO (para deduplicar o resumo semanal do gestor).
function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((dt.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function emailShell(opts: { tenantName: string; brandColor?: string; logoUrl?: string | null; title: string; bodyHtml: string; ctaUrl: string; ctaLabel: string }): string {
  const brand = opts.brandColor || "#4f46e5";
  const logo =
    opts.logoUrl && /^https?:\/\//i.test(opts.logoUrl)
      ? `<img src="${opts.logoUrl}" alt="${opts.tenantName}" style="max-height:44px;margin-bottom:16px" />`
      : "";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    ${logo}
    <h1 style="font-size:20px;margin:0 0 12px">${opts.title}</h1>
    ${opts.bodyHtml}
    <p style="margin:24px 0">
      <a href="${opts.ctaUrl}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:bold;display:inline-block">${opts.ctaLabel}</a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:24px">Você recebeu este aviso porque tem treinamentos obrigatórios na ${opts.tenantName}.</p>
  </div>`;
}

// Frase por item para o e-mail do colaborador.
function itemPhrase(it: { status: ComplianceItem["status"]; targetDate: Date | null; bucket: Bucket }): string {
  const d = fmt(it.targetDate);
  if (it.status === "vencido") return `venceu em ${d} — refaça o treinamento`;
  if (it.status === "pendente") return it.bucket === "overdue" ? `prazo vencido em ${d}` : `prazo: ${d}`;
  return `vence em ${d}`; // a_vencer
}

type Triggered = { title: string; status: ComplianceItem["status"]; targetDate: Date | null; bucket: Bucket; key: string };

export type NotifyDebugEntry = { kind: string; to: string; sent: boolean; error?: string; id?: string };
export type NotifyResult = {
  emailConfigured: boolean;
  weekly: boolean;
  collaboratorEmails: number;
  managerEmails: number;
  tenants: number;
  debug?: NotifyDebugEntry[];
};

export async function runComplianceNotifications(opts: {
  baseUrl: string;
  weekly: boolean;
  now?: Date;
  debug?: boolean;
}): Promise<NotifyResult> {
  const now = opts.now ?? new Date();
  const res: NotifyResult = {
    emailConfigured: emailConfigured(),
    weekly: opts.weekly,
    collaboratorEmails: 0,
    managerEmails: 0,
    tenants: 0,
    ...(opts.debug ? { debug: [] as NotifyDebugEntry[] } : {}),
  };
  if (!res.emailConfigured) return res; // sem provedor de e-mail: no-op seguro.

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, type: true, parentId: true, brandColor: true, logoUrl: true },
  });

  for (const tenant of tenants) {
    res.tenants++;
    const contentIds = contentTenantIds(tenant);
    const items = await loadComplianceItems(tenant.id, contentIds);
    if (items.length === 0) continue;

    const dashUrl = `${opts.baseUrl}/dashboard`;
    const panelUrl = `${opts.baseUrl}/admin/compliance`;

    // ---- Colaborador: marcos por item -------------------------------------
    // Só itens acionáveis com data-alvo definida.
    const perUser = new Map<string, { name: string; email: string; hits: Triggered[] }>();
    for (const it of items) {
      if (!it.targetDate) continue;
      if (!(it.status === "a_vencer" || it.status === "vencido" || it.status === "pendente")) continue;
      const bucket = bucketFor(it.targetDate, now);
      if (!bucket) continue;
      const key = `due:${it.trilhaId}:${ymd(it.targetDate)}:${bucket}`;
      const cur = perUser.get(it.userId) ?? { name: it.userName, email: it.userEmail, hits: [] };
      cur.hits.push({ title: it.title, status: it.status, targetDate: it.targetDate, bucket, key });
      perUser.set(it.userId, cur);
    }

    for (const [userId, u] of perUser) {
      if (!u.email || u.hits.length === 0) continue;
      // Filtra os marcos já enviados.
      const keys = u.hits.map((h) => h.key);
      const already = await prisma.notificationLog.findMany({
        where: { userId, key: { in: keys } },
        select: { key: true },
      });
      const sentKeys = new Set(already.map((a) => a.key));
      const fresh = u.hits.filter((h) => !sentKeys.has(h.key));
      if (fresh.length === 0) continue;

      const anyOverdue = fresh.some((h) => h.status === "vencido" || h.bucket === "overdue");
      const rows = fresh
        .map((h) => `<li style="margin:6px 0;font-size:14px;color:#334155"><b>${h.title}</b> — ${itemPhrase(h)}</li>`)
        .join("");
      const html = emailShell({
        tenantName: tenant.name,
        brandColor: tenant.brandColor,
        logoUrl: tenant.logoUrl,
        title: anyOverdue ? "Treinamento obrigatório vencido" : "Treinamento obrigatório a vencer",
        bodyHtml: `<p style="font-size:14px;line-height:1.6;color:#334155">Olá, ${u.name}. Fique atento(a) aos seus treinamentos obrigatórios:</p><ul style="padding-left:18px;margin:12px 0">${rows}</ul>`,
        ctaUrl: dashUrl,
        ctaLabel: "Ver meus treinamentos",
      });
      const r = await sendEmail({
        to: u.email,
        fromName: tenant.name,
        subject: anyOverdue
          ? `Ação necessária: treinamento obrigatório vencido`
          : `Lembrete: treinamento obrigatório a vencer`,
        html,
      });
      if (res.debug) res.debug.push({ kind: "COMPLIANCE_DUE", to: u.email, sent: r.sent, error: r.error, id: r.id });
      if (r.sent) {
        await prisma.notificationLog.createMany({
          data: fresh.map((h) => ({ tenantId: tenant.id, userId, kind: "COMPLIANCE_DUE", key: h.key })),
          skipDuplicates: true,
        });
        res.collaboratorEmails++;
      }
    }

    // ---- Gestor/RH: resumo semanal ----------------------------------------
    if (!opts.weekly) continue;

    // Problemas por pessoa (vencido/pendente/a vencer) para o resumo.
    const problems = items.filter(
      (it) => it.status === "vencido" || it.status === "pendente" || it.status === "a_vencer"
    );
    if (problems.length === 0) continue;
    const problemsByUser = new Map<string, ComplianceItem[]>();
    for (const it of problems) {
      if (!problemsByUser.has(it.userId)) problemsByUser.set(it.userId, []);
      problemsByUser.get(it.userId)!.push(it);
    }

    const weekKey = `mgrweekly:${isoWeekKey(now)}`;

    // Árvore de equipes para escopar os líderes.
    const [teams, leads, admins] = await Promise.all([
      prisma.team.findMany({ where: { tenantId: tenant.id }, select: { id: true, parentId: true } }),
      prisma.teamLead.findMany({
        where: { team: { tenantId: tenant.id }, user: { active: true } },
        select: { role: true, teamId: true, user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.user.findMany({
        where: { tenantId: tenant.id, role: { in: ["SUPER_ADMIN", "TENANT_ADMIN", "HR"] }, active: true },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const childrenOf = new Map<string | null, string[]>();
    for (const t of teams) {
      const k = t.parentId ?? null;
      if (!childrenOf.has(k)) childrenOf.set(k, []);
      childrenOf.get(k)!.push(t.id);
    }
    const subtree = (teamId: string): string[] => {
      const out = [teamId];
      for (const c of childrenOf.get(teamId) ?? []) out.push(...subtree(c));
      return out;
    };

    // Monta a lista de destinatários: admin/RH (empresa toda) + líderes (escopo).
    type Recipient = { id: string; name: string; email: string; memberIds: Set<string> | null }; // null = empresa toda
    const recipients: Recipient[] = [];
    const allProblemUserIds = new Set(problemsByUser.keys());
    for (const a of admins) {
      if (a.email) recipients.push({ id: a.id, name: a.name, email: a.email, memberIds: null });
    }
    for (const l of leads) {
      if (!l.user.email) continue;
      const teamIds = l.role === "SUPERVISOR" ? [l.teamId] : subtree(l.teamId);
      const teamSet = new Set(teamIds);
      // Pessoas do escopo do líder que têm problema.
      const memberIds = new Set(
        problems.filter((p) => p.teamId && teamSet.has(p.teamId)).map((p) => p.userId)
      );
      recipients.push({ id: l.user.id, name: l.user.name, email: l.user.email, memberIds });
    }

    // Deduplica destinatários (uma pessoa pode ser admin e líder): junta escopos.
    const mergedRecipients = new Map<string, Recipient>();
    for (const rcp of recipients) {
      const prev = mergedRecipients.get(rcp.id);
      if (!prev) {
        mergedRecipients.set(rcp.id, rcp);
      } else if (prev.memberIds === null || rcp.memberIds === null) {
        prev.memberIds = null; // empresa toda vence
      } else {
        for (const id of rcp.memberIds) prev.memberIds.add(id);
      }
    }

    for (const rcp of mergedRecipients.values()) {
      // Já recebeu o resumo desta semana?
      const seen = await prisma.notificationLog.findFirst({
        where: { userId: rcp.id, key: weekKey },
        select: { id: true },
      });
      if (seen) continue;

      const scopeUserIds = rcp.memberIds === null ? [...allProblemUserIds] : [...rcp.memberIds];
      if (scopeUserIds.length === 0) continue;

      // Ordena por gravidade (vencido > pendente > a vencer) e monta as linhas.
      const objs: { name: string; txt: string; sev: number }[] = [];
      for (const uid of scopeUserIds) {
        const its = problemsByUser.get(uid);
        if (!its || its.length === 0) continue;
        const vencido = its.filter((i) => i.status === "vencido").length;
        const pendente = its.filter((i) => i.status === "pendente").length;
        const aVencer = its.filter((i) => i.status === "a_vencer").length;
        const parts = [
          vencido ? `${vencido} vencido(s)` : "",
          pendente ? `${pendente} pendente(s)` : "",
          aVencer ? `${aVencer} a vencer` : "",
        ].filter(Boolean);
        objs.push({ name: its[0].userName, txt: parts.join(" · "), sev: vencido * 100 + pendente * 10 + aVencer });
      }
      objs.sort((a, b) => b.sev - a.sev || a.name.localeCompare(b.name));
      if (objs.length === 0) continue;

      const rowsHtml = objs
        .map((o) => `<li style="margin:6px 0;font-size:14px;color:#334155"><b>${o.name}</b> — ${o.txt}</li>`)
        .join("");
      const html = emailShell({
        tenantName: tenant.name,
        brandColor: tenant.brandColor,
        logoUrl: tenant.logoUrl,
        title: "Resumo semanal de compliance",
        bodyHtml: `<p style="font-size:14px;line-height:1.6;color:#334155">Olá, ${rcp.name}. Pessoas com treinamentos obrigatórios pendentes/vencidos no seu escopo:</p><ul style="padding-left:18px;margin:12px 0">${rowsHtml}</ul>`,
        ctaUrl: rcp.memberIds === null ? panelUrl : `${opts.baseUrl}/minha-equipe`,
        ctaLabel: "Abrir o painel",
      });
      const r = await sendEmail({ to: rcp.email, fromName: tenant.name, subject: `Resumo semanal de compliance · ${tenant.name}`, html });
      if (res.debug) res.debug.push({ kind: "COMPLIANCE_MANAGER_WEEKLY", to: rcp.email, sent: r.sent, error: r.error, id: r.id });
      if (r.sent) {
        await prisma.notificationLog.create({
          data: { tenantId: tenant.id, userId: rcp.id, kind: "COMPLIANCE_MANAGER_WEEKLY", key: weekKey },
        });
        res.managerEmails++;
      }
    }
  }

  return res;
}
