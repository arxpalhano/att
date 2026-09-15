/**
 * Estado: arquivos dos blocos (tabela att-assets). Metadados do que foi enviado
 * ao S3 (clientes/<clientId>/blocos/<blockId>/…). Até 2026-09-15 isso vivia só
 * na memória do navegador — o upload "sumia" ao recarregar. Rota gerada por
 * stateRoute(): GET lista; POST { upsert, delete } aplica delta com log.
 */
import { stateRoute } from "@/lib/activity-server";
import { TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const route = stateRoute(TABLES.ASSETS, "assets");
export const GET = route.GET;
export const POST = route.POST;
export const DELETE = route.DELETE;
