/**
 * Cadastro de acabamentos — espelho do "Cadastro de Produtos - <Marca>" do Notion,
 * onde o cliente diz o que vai em cada produto/parte do produto.
 *
 * Dois tipos de registro na mesma tabela (att-finishes):
 *  - catálogo da marca (`kind: "catalog"`, 1 por cliente): grupos de acabamento
 *    (Tecidos, Pintura Metálica, Melaminas…) e as opções de cada grupo.
 *  - cadastro do produto (`kind: "block"`, 1 por bloco): quais opções de cada
 *    grupo valem para o produto, variações, descrição da peça e onde vai cada
 *    material ("observação de aplicação").
 */

export interface FinishOption { id: string; name: string; note?: string }
export interface FinishGroup { id: string; name: string; options: FinishOption[] }

export interface FinishCatalog {
  id: string;            // cat_<clientId>
  kind: "catalog";
  clientId: string;
  groups: FinishGroup[];
  updatedAt: string;
  updatedBy?: string;
  notionUrl?: string;
}

export interface BlockFinishes {
  id: string;            // blk_<blockId>
  kind: "block";
  clientId: string;
  blockId: string;
  /** groupId → ids das opções que valem para este produto */
  selections: Record<string, string[]>;
  variations: string[];
  category?: string;
  pieceDescription?: string;
  applicationNotes?: string;
  updatedAt: string;
  updatedBy?: string;
  notionUrl?: string;
}

export type FinishRecord = FinishCatalog | BlockFinishes;

export const catalogId = (clientId: string) => `cat_${clientId}`;
export const blockFinishesId = (blockId: string) => `blk_${blockId}`;

export function slugId(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

/** Grupos que toda marca costuma ter — sugestão ao criar o catálogo do zero. */
export const SUGGESTED_GROUPS = ["Tecidos", "Madeiras", "Pintura Metálica", "Melaminas / Laminados", "Vidros", "Pedras", "Outros"];

export function emptyCatalog(clientId: string): FinishCatalog {
  return { id: catalogId(clientId), kind: "catalog", clientId, groups: [], updatedAt: new Date(0).toISOString() };
}

export function emptyBlockFinishes(clientId: string, blockId: string): BlockFinishes {
  return { id: blockFinishesId(blockId), kind: "block", clientId, blockId, selections: {}, variations: [], updatedAt: new Date(0).toISOString() };
}

/** Um produto está "cadastrado" quando tem ao menos uma opção marcada ou texto de aplicação. */
export function isFilled(bf: BlockFinishes | undefined): boolean {
  if (!bf) return false;
  const anySel = Object.values(bf.selections || {}).some((v) => v.length > 0);
  return anySel || !!bf.applicationNotes?.trim() || !!bf.pieceDescription?.trim();
}
