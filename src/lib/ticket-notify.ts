/**
 * E-mail "caiu um ticket para você" (desde 2026-10-06).
 *
 * Chamado pelo servidor depois de gravar um delta de tickets: toda criação com
 * responsável e toda troca de responsável vira um aviso por e-mail para quem
 * recebeu, com o link que abre o ticket no portal (`/portal?ticket=<id>`).
 *
 * Regras:
 *  - um e-mail por pessoa por gravação (atribuição em lote = um e-mail com a lista);
 *  - só equipe interna com e-mail @archtechtour.com — a conta SES está em sandbox e
 *    só entrega para o domínio; terceirizados (Danilo, Raquel) e clientes ficam de
 *    fora por decisão do Matheus (2026-10-06);
 *  - quem atribui a si mesmo não recebe;
 *  - falha de envio nunca derruba a gravação (só vai para o log do servidor).
 */
import { sendEmail } from "./mailer";
import { scanAll, TABLES } from "./dynamo";

const PORTAL_URL = "https://app.archtechtour.com/portal";
const SENDER = "ArchTechTour Portal <portal@archtechtour.com>";
const INTERNAL_ROLES = new Set(["admin", "internal_ops", "internal_modeling", "internal_programming"]);

type Item = Record<string, unknown> & { id: string };
export interface TicketAssignment { ticket: Item; previousAssignee?: string }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const brDate = (iso?: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };

/** Dado o antes/depois de um ticket, diz se ele acabou de cair para alguém. */
export function assignmentOf(before: Item | null, after: Item): TicketAssignment | null {
  const to = after.assignedTo as string | undefined;
  if (!to || after.status === "delivered" || after.archivedAt) return null;
  if (before && before.assignedTo === to) return null;
  return { ticket: after, previousAssignee: before?.assignedTo as string | undefined };
}

export async function notifyTicketAssignments(list: TicketAssignment[], actor: { id: string; name: string }): Promise<number> {
  if (!list.length) return 0;
  try {
    const [users, clients] = await Promise.all([scanAll<Item>(TABLES.USERS), scanAll<Item>(TABLES.CLIENTS)]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const clientName = (id: unknown) => String(clients.find((c) => c.id === id)?.name ?? "");
    const byUser = new Map<string, Item[]>();
    for (const a of list) {
      const to = a.ticket.assignedTo as string;
      if (to === actor.id) continue;                       // atribuiu a si mesmo
      const u = userById.get(to);
      if (!u || u.active === false || !INTERNAL_ROLES.has(String(u.role))) continue; // terceirizado/cliente: fora
      if (!/@archtechtour\.com$/i.test(String(u.email ?? ""))) continue;              // SES sandbox
      const l = byUser.get(to) ?? []; l.push(a.ticket); byUser.set(to, l);
    }
    let sent = 0;
    for (const [uid, tickets] of Array.from(byUser.entries())) {
      const u = userById.get(uid)!;
      const first = String(u.name ?? "").split(" ")[0];
      const many = tickets.length > 1;
      const subject = many ? `${tickets.length} tickets novos para você no portal` : `Novo ticket para você: ${tickets[0].title}`;
      const link = (t: Item) => `${PORTAL_URL}?ticket=${encodeURIComponent(t.id)}`;
      const lines = tickets.map((t) => `• ${t.title} — ${clientName(t.clientId)} · entrega ao cliente ${brDate(t.slaDate)}\n  ${link(t)}`).join("\n");
      const text = `Olá, ${first}.\n\n${actor.name} atribuiu ${many ? "estes tickets" : "este ticket"} a você no portal ArchTechTour:\n\n${lines}\n\nAbra o ticket e defina a data em que você entrega a etapa ("Definir minha data").\n\nMensagem automática do portal — não responda este e-mail.`;
      const rows = tickets.map((t) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
            <div style="font-size:15px;font-weight:600;color:#0f172a">${esc(t.title)}</div>
            <div style="font-size:13px;color:#64748b;margin-top:2px">${esc(clientName(t.clientId))} · entrega ao cliente <b>${brDate(t.slaDate)}</b>${t.desc ? `<br>${esc(t.desc)}` : ""}</div>
          </td>
          <td style="padding:12px 0 12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap">
            <a href="${link(t)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:10px">Abrir ticket</a>
          </td>
        </tr>`).join("");
      const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <div style="max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px">
            <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;font-weight:600">ArchTechTour · Portal</div>
            <h1 style="font-size:20px;color:#0f172a;margin:8px 0 4px">${many ? `${tickets.length} tickets novos para você` : "Novo ticket para você"}</h1>
            <p style="font-size:14px;color:#475569;margin:0 0 12px">Olá, ${esc(first)}. <b>${esc(actor.name)}</b> atribuiu ${many ? "estes tickets" : "este ticket"} a você.</p>
            <table style="width:100%;border-collapse:collapse">${rows}</table>
            <p style="font-size:13px;color:#475569;margin:16px 0 0">Abra o ticket e defina a data em que você entrega a etapa em <b>“Definir minha data”</b>.</p>
          </div>
          <p style="font-size:11px;color:#94a3b8;text-align:center;margin:12px 0 0">Mensagem automática do portal — não responda este e-mail.</p>
        </div></body></html>`;
      try { await sendEmail({ from: SENDER, to: [String(u.email)], subject, text, html }); sent++; }
      catch (e) { console.error(`[ticket-notify] falha ao enviar para ${u.email}:`, e); }
    }
    return sent;
  } catch (e) {
    console.error("[ticket-notify] falha geral:", e);
    return 0;
  }
}
