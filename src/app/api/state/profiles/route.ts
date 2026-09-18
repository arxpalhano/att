/**
 * Estado: perfis de acesso (tabela att-profiles). Rota gerada por stateRoute():
 * GET lista; POST { upsert, delete } aplica delta COM log de atividade;
 * DELETE ?id= exclui (com log). Tipos e perfis padrão em src/lib/access.ts.
 */
import { stateRoute } from "@/lib/activity-server";
import { TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const route = stateRoute(TABLES.PROFILES, "profiles");
export const GET = route.GET;
export const POST = route.POST;
export const DELETE = route.DELETE;
