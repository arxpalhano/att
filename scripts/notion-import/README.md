# Importação do "Banco de Produtos" (Notion) → blocos do portal

Executada em **2026-09-02** (723 produtos do Notion → 395 blocos novos, 327 atualizados).
Backups pré-importação em `s3://archtechtour-assets/backups/` (`att-blocks-pre-import-*`,
`att-contracts-*`, `att-publications-*`).

## Como rodar de novo

1. Baixar as páginas do view "Tabela" do Banco de Produtos (Notion MCP, modo `view`,
   `page_size` 100, seguindo `next_cursor`) e salvar como `notion-page-1.json` … `notion-page-N.json`
   ao lado do script. (O modo SQL tem cota no plano atual do workspace; o modo view não.)
2. `aws dynamodb scan` de `att-blocks`, `att-clients`, `att-contracts`, `att-publications`
   para `att-*.json` no mesmo diretório.
3. `python3 import_notion.py` → dry-run com relatório completo e `import-plan.json`.
4. Revisar o relatório. `python3 import_notion.py --apply` grava.

## Regras (também em PORTAL.md §5)

- Marca vem da relação **Projetos** do Notion → cliente do portal por nome normalizado.
  Projetos internos (`.Bugs&Repairs`, `.Produto`…) são pulados.
- Produto **já existe** se, na mesma marca, o slug do "Link atual" bate com uma publicação do
  bloco, ou o nome extraído do código bate com o título do bloco.
- Bloco existente recebe `bim`, `notionUrl/Code/Tech`, `importedAt` e o status mapeado —
  **exceto** quando o portal diz `published` e o Notion está numa etapa anterior: mantém
  `published` e guarda a etapa em `notionTech`. Nunca rebaixa customizador no ar.
- Bloco novo: `sku` = código do Notion, título extraído do código, contrato mais recente da
  marca, `n` sequencial. Se tem link e está publicado/em BIM/em validação final, cria a
  publicação a partir do link.
- Mapa Tech → status: ver `map_status()`.

## O que a Jessica revisa depois

- Blocos com título igual ao código (Notion sem nome legível): filtrar por `sku` numérico
  ou terminado em `E0`.
- Divergências "portal publicado × Notion atrás": campo *Importado do Notion (etapa lá: …)*
  no "Editar bloco".
- Clientes criados a partir do Notion: **Dengo** e **Inkasa** (contratos "Em definição").
- Modelador não veio (usuários convidados do Notion não são resolvíveis pela API) — campo
  editável no bloco.

---

# Importação dos "Cadastro de Produtos - <Marca>" (acabamentos) → att-finishes

Executada em **2026-09-03**: 8 catálogos de marca e 269 cadastros de produto (duas linhas do Notion no mesmo bloco viram um registro só)
(Escal 36, Wentz 38, Tidelli 20, estudiobola 110, Riccó 51, Green House 13, DEXCO 1, Persol 1).

## Como rodar de novo

1. Linhas de cada base pelo Notion MCP em modo `view` (`rows-<marca>.json`, formato bruto);
   o que vier inline (sem arquivo) vai transcrito em `inline-rows.json` no formato compacto
   `{name, url, rel, sel{grupo:[opções]}, var, cat, desc, notes}`.
2. Opcional: `schema-<marca>.json` com `{"multi_select": {grupo: [opções]}}` do esquema da base
   (catálogo completo, não só o usado nas linhas).
3. Scan **atual** de `att-blocks` e `att-clients` em `../import/` — precisa ter `notionUrl`
   nos blocos, é por ele que o produto do Notion vira bloco do portal.
4. `python3 import_finishes.py` (dry-run) → `--apply`.

## Regras

- Grupo de acabamento = qualquer multi-seleção da base, exceto Variações / Categoria: Local /
  PRIORIDADE (viram variações e categoria). Nomes ficam como a marca usa no Notion.
- Produto ↔ bloco pela relação com o Banco de Produtos (`rel` == `block.notionUrl`); senão
  pelo nome sem o prefixo numérico, dentro da marca. Sem bloco → pulado e listado.
- Registro importado tem `updatedBy: import-notion`; o que a Jessica ou o cliente editar no
  portal muda `updatedBy` e **não é sobrescrito** numa reimportação.

## Não casou (revisão)

- **DEXCO** (63 de 64) e **Green House** (81 de 94): as bases não têm o vínculo com o Banco de
  Produtos preenchido e os nomes não batem com os blocos. Caminho: preencher o vínculo no Notion
  e reimportar, ou cadastrar direto no portal (o catálogo da marca já está lá).
- **Christie**: a base só tem status de etapa, sem acabamentos — nada a importar.
- Green House página 2 (12 linhas, sem vínculo) não foi transcrita.
