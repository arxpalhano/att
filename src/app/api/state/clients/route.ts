/**
 * Estado: clients (tabela att-clients). Rota gerada por stateRoute():
 * GET lista; POST { upsert, delete } aplica delta COM log de atividade;
 * POST array = replaceAll (seed); DELETE ?id= exclui (com log).
 * Ver src/lib/activity-server.ts.
 */
import { stateRoute } from "@/lib/activity-server";
import { TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const route = stateRoute(TABLES.CLIENTS, "clients");
export const GET = route.GET;
export const POST = route.POST;
export const DELETE = route.DELETE;
