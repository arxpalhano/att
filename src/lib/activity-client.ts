"use client";
/**
 * Lado do browser do log de atividades.
 *
 *  - `setActivityActor(user)`   — o Portal chama ao logar/deslogar; a partir daí
 *                                  todo fetch de gravação leva o cabeçalho
 *                                  `x-att-actor` (quem fez).
 *  - `actorHeaders()`           — cabeçalho para juntar em qualquer fetch.
 *  - `logActivity({...})`       — registra na hora, sem debounce, com
 *                                  `keepalive` (o request sobrevive ao fechar
 *                                  a aba). Uma tentativa de retry em caso de
 *                                  falha de rede. Usado para o que não passa
 *                                  pelas tabelas de estado: login, logout,
 *                                  tela aberta, upload, agentes, analytics.
 */
import { ACTOR_HEADER, ActivityActor, ActivityEntity, ActivityRecord } from "./activity";

let actor: ActivityActor | null = null;

export function setActivityActor(a: ActivityActor | null): void {
  actor = a;
}
export function getActivityActor(): ActivityActor | null {
  return actor;
}

export function actorHeaders(): Record<string, string> {
  return actor ? { [ACTOR_HEADER]: JSON.stringify(actor) } : {};
}

export interface ClientActivityInput {
  type: string;
  entity: ActivityEntity;
  desc: string;
  blockId?: string;
  clientId?: string;
  entityId?: string;
  entityLabel?: string;
  page?: string;
}

/** Registra uma atividade agora. Devolve o registro carimbado pelo servidor (ou null se falhou). */
export async function logActivity(input: ClientActivityInput, actorOverride?: ActivityActor): Promise<ActivityRecord | null> {
  const who = actorOverride ?? actor;
  if (!who) return null;
  const body = JSON.stringify(input);
  const headers = { "Content-Type": "application/json", [ACTOR_HEADER]: JSON.stringify(who) };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("/api/activity", { method: "POST", headers, body, keepalive: true });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        return (j?.activity as ActivityRecord) ?? null;
      }
      if (r.status < 500) return null; // erro de validação: não adianta repetir
    } catch {
      /* rede caiu: tenta de novo uma vez */
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return null;
}
